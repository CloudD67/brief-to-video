#!/usr/bin/env node
/**
 * MV 逐帧截图：Puppeteer 打开 index.html?render=1，调用 window.pauseAt(t) 定位，
 * 截图到 frames/。默认沿用 config.renderScale（建工程时按用户选择写入 1=1080p / 2=4K），
 * --scale 可临时覆盖。
 *
 * 这条管线只有叙事层：没有 look / 主题 / 版式 / 引擎参数。
 *
 *   node render.js                 # 按 config.renderScale 全片
 *   node render.js --scale 1       # 1080p 全片
 *   node render.js --scale 2       # 4K 全片
 *   node render.js --at 1.5,15,33  # 抽帧到 stills/
 *   node render.js --resume        # 断点续渲
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { createServer } = require('./server');

const ROOT = __dirname;
const CONFIG = require('./js/config.js');

const DEFAULTS = {
  scale: CONFIG.renderScale || 1,
  fps: CONFIG.fps || 30,
  from: 0,
  to: CONFIG.duration || 60,
  format: 'png',
  jpegQuality: 95,
  fast: false,
  out: null,
  at: null,
  chrome: null,
  port: 0,
  resume: false,
  quiet: false,
  headed: false,
  estMb: 0
};

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];

function usage() {
  console.log(`${CONFIG.title} · MV 逐帧渲染

用法: node render.js [options]

  --scale <n>      设备像素比：1 = ${CONFIG.width}x${CONFIG.height}（1080p），2 = ${CONFIG.width * 2}x${CONFIG.height * 2}（4K）；默认 ${CONFIG.renderScale || 1}
  --fps <n>        帧率（默认 ${CONFIG.fps}）
  --from <sec>     起始时间（默认 0）
  --to <sec>       结束时间（默认 ${CONFIG.duration}）
  --format <fmt>   png | jpg（默认 png）
  --fast           快速采集：默认切到 jpg q92（迭代/审片用；交付按需重渲 png）
  --jpeg-quality <n> jpg 质量 1-100（默认 95，--fast 时 92）
  --at <list>      抽帧模式：逗号分隔的秒数，例如 1.5,15,33
  --out <dir>      输出目录（默认 frames/，抽帧为 stills/）
  --resume         跳过已存在的帧（按 manifest 校验参数一致）
  --est-mb <n>     单帧体积估值（MB），用于磁盘预检；默认按格式/分辨率估，有历史帧时用实测
  --chrome <path>  指定 Chrome/Chromium 可执行文件
  --port <n>       本地服务端口，0 = 随机
  --headed         显示浏览器窗口（调试用）
  --quiet          只输出错误
  -h, --help       显示帮助

示例:
  npm run stills
  node render.js --scale 1 --from 0 --to 10
  node render.js --resume
`);
}

function parseArgs(argv) {
  const opts = Object.assign({}, DEFAULTS);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error('缺少参数值: ' + a);
      return v;
    };
    switch (a) {
      case '-h':
      case '--help':
        usage();
        process.exit(0);
        break;
      case '--scale': opts.scale = Number(next()); break;
      case '--fps': opts.fps = Number(next()); break;
      case '--from': opts.from = Number(next()); break;
      case '--to': opts.to = Number(next()); break;
      case '--format': opts.format = String(next()).toLowerCase(); opts.formatExplicit = true; break;
      case '--fast': opts.fast = true; break;
      case '--jpeg-quality': opts.jpegQuality = Number(next()); opts.jpegQualityExplicit = true; break;
      case '--at': opts.at = String(next()).split(',').map(Number).filter(n => Number.isFinite(n)); break;
      case '--out': opts.out = next(); break;
      case '--chrome': opts.chrome = next(); break;
      case '--port': opts.port = Number(next()); break;
      case '--resume': opts.resume = true; break;
      case '--est-mb': opts.estMb = Number(next()); break;
      case '--quiet': opts.quiet = true; break;
      case '--headed': opts.headed = true; break;
      default:
        throw new Error('未知参数: ' + a + '\nMV 没有 --look / --style / --layout；使用 --help 查看用法');
    }
  }
  if (!(opts.scale >= 1 && opts.scale <= 4 && Number.isInteger(opts.scale))) throw new Error('--scale 必须是 1–4 的整数（1 = 1080p，2 = 4K）');
  if (!(opts.fps > 0)) throw new Error('--fps 必须大于 0');
  if (!['png', 'jpg', 'jpeg'].includes(opts.format)) throw new Error('--format 仅支持 png 或 jpg');
  if (opts.format === 'jpeg') opts.format = 'jpg';
  if (!(opts.jpegQuality >= 1 && opts.jpegQuality <= 100)) throw new Error('--jpeg-quality 必须在 1-100 之间');
  opsCheck(opts);
  if (opts.fast) {
    if (!opts.formatExplicit) opts.format = 'jpg';
    if (!opts.jpegQualityExplicit) opts.jpegQuality = 92;
  }
  return opts;
}

function genreCheck() {
  if (CONFIG.genre !== 'paper-story') {
    throw new Error('config.genre = "' + CONFIG.genre + '"；MV 工程必须是 paper-story。宣传片请用 --genre promo 新建。');
  }
  if ((CONFIG.look && CONFIG.look !== 'none') || (CONFIG.style && CONFIG.style !== 'none') || (CONFIG.layout && CONFIG.layout !== 'none')) {
    throw new Error('MV 配置里出现了 look/style/layout；MV 只有叙事层，不要混入宣传片的 look/主题/版式。');
  }
  const ratio = CONFIG.width / CONFIG.height;
  if (Math.abs(ratio - 16 / 9) > 0.001) {
    throw new Error('MV 叙事画布是 16:9；当前 ' + CONFIG.width + 'x' + CONFIG.height + '。竖屏 MV 需要重排场景，不能靠缩放。');
  }
}

function opsCheck(opts) {
  genreCheck();
  const stills = !!opts.at;
  if (!stills) {
    if (opts.from < 0) opts.from = 0;
    if (opts.to > CONFIG.duration) opts.to = CONFIG.duration;
    if (opts.to <= opts.from) throw new Error('--to 必须大于 --from');
  }
  opts.stills = stills;
  opts.outDir = path.resolve(ROOT, opts.out || (stills ? 'stills' : 'frames'));
  if (!opts.chrome) {
    opts.chrome = process.env.CHROME_PATH || CHROME_CANDIDATES.find(p => fs.existsSync(p)) || null;
  } else if (/[\\/]/.test(opts.chrome) || path.isAbsolute(opts.chrome)) {
    opts.chrome = path.resolve(opts.chrome);
    if (!fs.existsSync(opts.chrome)) throw new Error('--chrome 指定的文件不存在: ' + opts.chrome);
  }
  if (!opts.chrome) {
    throw new Error(
      '未找到 Chrome。请用 --chrome 指定路径，或设置环境变量 CHROME_PATH。\n' +
      '常见路径:\n' +
      '  macOS    /Applications/Google Chrome.app/Contents/MacOS/Google Chrome\n' +
      '  Windows  C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    );
  }
  if (stills && opts.at.length === 0) throw new Error('--at 没有有效的秒数');
}

function log(opts, msg) {
  if (!opts.quiet) process.stdout.write(msg + '\n');
}

function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '--';
  const s = Math.ceil(sec);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

function pad4(n) {
  return String(n).padStart(4, '0');
}

async function animFrame(page) {
  await page.evaluate(function () {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  });
}

function writeManifest(dir, data) {
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(data, null, 2) + '\n');
}

function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  } catch (e) {
    return null;
  }
}

function countTodo(opts, totalFrames, startFrame, endFrame, ext) {
  if (!opts.resume) return totalFrames;
  let done = 0;
  for (let f = startFrame; f < endFrame; f++) {
    try {
      if (fs.statSync(path.join(opts.outDir, 'frame_' + pad4(f) + '.' + ext)).size > 1024) done++;
    } catch (e) { /* 缺帧 */ }
  }
  return Math.max(0, totalFrames - done);
}

function diskCheck(opts, outW, outH, todo, ext) {
  if (typeof fs.statfsSync !== 'function') return;
  let free;
  try {
    const st = fs.statfsSync(ROOT);
    free = st.bsize * st.bavail;
  } catch (e) {
    return;
  }
  /* 单帧体积优先用已有帧的实测值：像素画与实拍差一个数量级，估高了会误拦 */
  let estMb = opts.estMb;
  if (!estMb) {
    estMb = (ext === 'jpg' ? 1.5 : 8.5) * ((outW * outH) / (3840 * 2160));
    try {
      const known = fs.readdirSync(opts.outDir)
        .filter(f => new RegExp('^frame_\\d+\\.' + ext + '$').test(f))
        .slice(-16);
      if (known.length) {
        let bytes = 0;
        for (const f of known) bytes += fs.statSync(path.join(opts.outDir, f)).size;
        estMb = bytes / known.length / 1024 / 1024;
      }
    } catch (e) { /* 还没有历史帧 */ }
  }
  const perFrame = estMb * 1024 * 1024;
  const need = todo * perFrame;
  const gb = n => (n / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  if (free < need * 0.6) {
    throw new Error('磁盘可用 ' + gb(free) + '，预计还需 ' + gb(need) + '（' + todo + ' 帧 @' + outW + 'x' + outH + ' ' +
      ext.toUpperCase() + '）。请清理空间、降低 --scale，或缩短 --to。');
  }
  if (free < need * 1.3) {
    log(opts, '  ! 磁盘可用 ' + gb(free) + '，预计还需 ' + gb(need) + '，空间偏紧，用 --resume 可续渲。');
  }
}

async function main() {
  /* engine: "cg" 时整条渲染交给 Blender（cg/mv3d.py）；
     帧仍写 frames/frame_%04d.png，encode/repair 不用改。 */
  if ((CONFIG.engine || 'paper') === 'cg') {
    return require('./tools/cg-render.js').run(process.argv.slice(2));
  }
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(opts.outDir, { recursive: true });
  if (opts.fps !== CONFIG.fps) {
    process.stderr.write('  ! --fps ' + opts.fps + ' 与 config.fps ' + CONFIG.fps + ' 不一致；encode 默认按 ' + CONFIG.fps + ' 编码，请同样传 --fps ' + opts.fps + '\n');
  }

  const width = CONFIG.width;
  const height = CONFIG.height;
  const outW = width * opts.scale;
  const outH = height * opts.scale;
  const ext = opts.format;

  const totalFrames = opts.stills ? 0 : Math.round((opts.to - opts.from) * opts.fps);
  const startFrame = opts.stills ? 0 : Math.round(opts.from * opts.fps);
  const endFrame = opts.stills ? 0 : startFrame + totalFrames;

  const manifest = {
    width: outW,
    height: outH,
    scale: opts.scale,
    fps: opts.fps,
    format: ext,
    from: opts.from,
    to: opts.to,
    genre: CONFIG.genre,
    motion: 'paper',
    frames: totalFrames || undefined,
    mode: opts.stills ? 'stills' : 'frames',
    created: new Date().toISOString()
  };

  if (!opts.stills && opts.resume) {
    const prev = readManifest(opts.outDir);
    if (prev && (prev.width !== outW || prev.height !== outH || prev.fps !== opts.fps || prev.from !== opts.from || prev.to !== opts.to || prev.format !== ext || (prev.genre || '') !== manifest.genre)) {
      throw new Error(
        '--resume 与已有帧的参数不一致：\n' +
        `  已有: ${prev.width}x${prev.height} @${prev.fps}fps ${prev.from}-${prev.to}s ${prev.format} ${prev.genre || '(未记录叙事)'}\n` +
        `  本次: ${outW}x${outH} @${opts.fps}fps ${opts.from}-${opts.to}s ${ext} ${manifest.genre}\n` +
        '请换一个 --out 目录，或先清空 frames/。'
      );
    }
  }
  if (!opts.stills) {
    diskCheck(opts, outW, outH, countTodo(opts, totalFrames, startFrame, endFrame, ext), ext);
    writeManifest(opts.outDir, manifest);
  }

  log(opts, '');
  log(opts, '  ' + CONFIG.title + ' · MV 帧渲染');
  log(opts, '  ─────────────────────────────────');
  log(opts, `  输出      ${outW}x${outH}  ${ext.toUpperCase()}`);
  log(opts, `  设备像素比 ${opts.scale}  ·  原生画布 ${width}×${height}（矢量重画，不做位图放大）`);
  log(opts, opts.stills
    ? `  抽帧      ${opts.at.map(t => t.toFixed(2) + 's').join(', ')}`
    : `  时间      ${opts.from}s → ${opts.to}s  @${opts.fps}fps  (${totalFrames} 帧)`);
  log(opts, `  叙事      paper-story（层叠剪纸 · 固定机位 · 无 look / 主题 / 版式）`);
  log(opts, `  目录      ${path.relative(ROOT, opts.outDir) || '.'}`);
  log(opts, `  浏览器    ${opts.chrome}`);
  log(opts, '');

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port, '127.0.0.1', resolve);
  });
  const port = server.address().port;

  let browser = null;
  let stopped = false;
  const onSigint = () => {
    if (stopped) process.exit(1);
    stopped = true;
    log(opts, '\n  收到中断，正在保存当前帧并退出…（再按一次强制退出）');
  };
  process.on('SIGINT', onSigint);

  try {
    browser = await puppeteer.launch({
      executablePath: opts.chrome,
      headless: !opts.headed,
      protocolTimeout: 180000,
      args: [
        '--hide-scrollbars',
        '--mute-audio',
        '--force-color-profile=srgb',
        '--font-render-hinting=none',
        '--disable-lcd-text',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=Translate,BackForwardCache',
        `--window-size=${width},${height}`
      ]
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(0);
    page.setDefaultNavigationTimeout(120000);
    await page.setViewport({ width, height, deviceScaleFactor: opts.scale });
    page.on('pageerror', err => process.stderr.write('  [pageerror] ' + err.message + '\n'));
    page.on('console', msg => {
      if (msg.type() === 'error') process.stderr.write('  [console] ' + msg.text() + '\n');
    });

    const url = `http://127.0.0.1:${port}/index.html?render=1&scale=${opts.scale}`;
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.evaluate(() => window.ready);
    const ready = await page.evaluate(() => window.__READY === true);
    if (!ready) throw new Error('页面未就绪（window.__READY 未置位）');

    const shotOpts = {
      type: ext === 'jpg' ? 'jpeg' : 'png',
      optimizeForSpeed: true,
      captureBeyondViewport: false
    };
    if (ext === 'jpg') shotOpts.quality = opts.jpegQuality;

    const t0 = Date.now();

    if (opts.stills) {
      const times = opts.at.slice().sort((a, b) => a - b);
      for (let i = 0; i < times.length; i++) {
        const t = Math.max(0, Math.min(CONFIG.duration - 0.001, times[i]));
        await page.evaluate(tt => window.pauseAt(tt), t);
        await animFrame(page);
        const file = path.join(opts.outDir, `still_${t.toFixed(2)}.${ext}`);
        await page.screenshot(Object.assign({ path: file }, shotOpts));
        log(opts, `  [${String(i + 1).padStart(2, '0')}/${times.length}] ${t.toFixed(2)}s  ${path.basename(file)}`);
      }
      const dt = (Date.now() - t0) / 1000;
      log(opts, `\n  完成：${times.length} 张抽帧，用时 ${fmtDuration(dt)}`);
    } else {
      let done = 0;
      let skipped = 0;
      for (let f = startFrame; f < endFrame; f++) {
        if (stopped) break;
        const t = f / opts.fps;
        const file = path.join(opts.outDir, `frame_${pad4(f)}.${ext}`);
        if (opts.resume && fs.existsSync(file) && fs.statSync(file).size > 1024) {
          skipped++;
          done++;
          continue;
        }
        await page.evaluate(tt => window.pauseAt(tt), t);
        await animFrame(page);
        await page.screenshot(Object.assign({ path: file }, shotOpts));
        done++;

        if (!opts.quiet) {
          const elapsed = (Date.now() - t0) / 1000;
          const speed = done / Math.max(elapsed, 0.001);
          const eta = (totalFrames - done) / Math.max(speed, 0.001);
          const pct = (done / totalFrames * 100).toFixed(1);
          const widthBar = 24;
          const filled = Math.round(done / totalFrames * widthBar);
          const bar = '█'.repeat(filled) + '·'.repeat(widthBar - filled);
          const line = `  ${bar} ${pct.padStart(5)}%  ${done}/${totalFrames}  ${speed.toFixed(1)}fps  剩余 ${fmtDuration(eta)}`;
          if (process.stdout.isTTY) {
            process.stdout.write('\r' + line + '   ');
          } else if (done === totalFrames || done % Math.max(1, Math.round(opts.fps * 5)) === 0) {
            process.stdout.write(line.trim() + '\n');
          }
        }
      }
      if (process.stdout.isTTY && !opts.quiet) process.stdout.write('\n');

      const dt = (Date.now() - t0) / 1000;
      if (stopped) {
        log(opts, `  已中断：${done}/${totalFrames} 帧，用时 ${fmtDuration(dt)}。用 --resume 继续。`);
      } else {
        log(opts, `  帧渲染完成：${done - skipped} 张新帧${skipped ? `，跳过 ${skipped} 张已有帧` : ''}，用时 ${fmtDuration(dt)}`);
      }

      if (!stopped && opts.to >= CONFIG.duration && opts.from <= 0) {
        const posterAt = await page.evaluate(() => {
          const c = window.FILM_CONFIG || {};
          const base = c.posterAt != null ? c.posterAt : 56.4;
          const dur = c.duration || 60;
          /* posterAt 是相对分镜基准（base）的秒数；MV 的 base 与 duration 相等，
             不能再按 60s 基准二次缩放，否则封面会飘到片尾。 */
          const baseDur = c.base || 60;
          return Math.max(0, Math.min(base * (dur / baseDur), dur - 0.1));
        });
        await page.evaluate(tt => window.pauseAt(tt), posterAt);
        await animFrame(page);
        const outDir = path.resolve(ROOT, 'out');
        fs.mkdirSync(outDir, { recursive: true });
        const poster = path.join(outDir, 'poster.' + ext);
        await page.screenshot(Object.assign({ path: poster }, shotOpts));
        log(opts, `  封面图：${path.relative(ROOT, poster)}  (${posterAt}s)`);
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
    process.removeListener('SIGINT', onSigint);
  }
}

main().catch(err => {
  process.stderr.write('\n渲染失败：' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
