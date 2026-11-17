#!/usr/bin/env node
/**
 * 逐帧截图：Puppeteer 打开 index.html?render=1，调用 window.pauseAt(t) 定位，
 * 截图到 frames/。默认 --scale 2 = 3840x2160（4K）。
 *
 *   node render.js                 # 4K 全片
 *   node render.js --scale 1       # 1080p 全片
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
const LOOKS = require('./js/looks.js');

const DEFAULTS = {
  scale: 2,
  fps: CONFIG.fps || 30,
  from: 0,
  to: CONFIG.duration || 60,
  format: 'png',
  out: null,
  at: null,
  style: null,
  look: null,
  layout: null,
  brief: null,
  chrome: null,
  port: 0,
  resume: false,
  quiet: false,
  headed: false
};

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];

function usage() {
  console.log(`${CONFIG.title} · 逐帧渲染

用法: node render.js [options]

  --scale <n>      设备像素比，2 = ${CONFIG.width * 2}x${CONFIG.height * 2}（默认 2），1 = ${CONFIG.width}x${CONFIG.height}
  --fps <n>        帧率（默认 ${CONFIG.fps}）
  --from <sec>     起始时间（默认 0）
  --to <sec>       结束时间（默认 ${CONFIG.duration}）
  --format <fmt>   png | jpg（默认 png）
  --at <list>      抽帧模式：逗号分隔的秒数，例如 1.5,15,33
  --out <dir>      输出目录（默认 frames/，抽帧为 stills/）
  --look <id>      指定 look（主题+版式+动效）；auto = 按 brief 自动（默认）
  --layout <name>  临时覆盖版式（editorial|poster|grid|split）
  --brief <str>    临时覆盖 brief 文本，供 --look auto 计分
  --style <name>   临时覆盖视觉风格（letterpress|swiss|cinema|quiet|tech）
  --resume         跳过已存在的帧（按 manifest 校验参数一致）
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
      case '--format': opts.format = String(next()).toLowerCase(); break;
      case '--at': opts.at = String(next()).split(',').map(Number).filter(n => Number.isFinite(n)); break;
      case '--style': opts.style = String(next()); break;
      case '--look': opts.look = String(next()); break;
      case '--layout': opts.layout = String(next()); break;
      case '--brief': opts.brief = String(next()); break;
      case '--out': opts.out = next(); break;
      case '--chrome': opts.chrome = next(); break;
      case '--port': opts.port = Number(next()); break;
      case '--resume': opts.resume = true; break;
      case '--quiet': opts.quiet = true; break;
      case '--headed': opts.headed = true; break;
      default:
        throw new Error('未知参数: ' + a + '\n使用 --help 查看用法');
    }
  }
  if (!(opts.scale > 0)) throw new Error('--scale 必须大于 0');
  if (!(opts.fps > 0)) throw new Error('--fps 必须大于 0');
  if (!['png', 'jpg', 'jpeg'].includes(opts.format)) throw new Error('--format 仅支持 png 或 jpg');
  if (opts.format === 'jpeg') opts.format = 'jpg';
  if (opts.style && !/^[a-z0-9-]+$/.test(opts.style)) throw new Error('--style 只能是小写字母、数字和连字符');
  if (opts.look && opts.look !== 'auto' && !/^[a-z0-9-]+$/.test(opts.look)) throw new Error('--look 只能是小写字母、数字和连字符');
  if (opts.layout && opts.layout !== 'auto' && !/^[a-z0-9-]+$/.test(opts.layout)) throw new Error('--layout 只能是小写字母、数字和连字符');
  opsCheck(opts);
  return opts;
}

function resolveLook(opts) {
  const cfgStyle = CONFIG.style && CONFIG.style !== 'auto' ? CONFIG.style : null;
  const cfgLayout = CONFIG.layout && CONFIG.layout !== 'auto' ? CONFIG.layout : null;
  const cfgLook = CONFIG.look && CONFIG.look !== 'auto' ? CONFIG.look : null;
  const requested = opts.look && opts.look !== 'auto' ? opts.look : (cfgLook || 'auto');

  if (requested !== 'auto' && !LOOKS.getLook(requested)) {
    throw new Error('未知 look "' + requested + '"；可用：' + LOOKS.LOOKS.map(l => l.id).join(' / '));
  }
  if (opts.layout && opts.layout !== 'auto' && !LOOKS.LAYOUTS[opts.layout]) {
    throw new Error('未知版式 "' + opts.layout + '"；可用：' + Object.keys(LOOKS.LAYOUTS).join(' / '));
  }

  const brief = [opts.brief, CONFIG.brief, CONFIG.title, CONFIG.slogan, CONFIG.brandSub].filter(Boolean).join(' ');
  const resolved = requested !== 'auto'
    ? { look: LOOKS.getLook(requested), auto: null }
    : (function () {
      const auto = LOOKS.chooseLook(brief, { theme: opts.style || cfgStyle });
      return { look: auto.look, auto: auto };
    })();

  opts.lookObj = resolved.look;
  opts.lookAuto = resolved.auto;
  opts.effectiveLook = resolved.look.id;
  opts.effectiveStyle = opts.style || cfgStyle || resolved.look.theme;
  opts.effectiveLayout = (opts.layout && opts.layout !== 'auto' ? opts.layout : null) || cfgLayout || resolved.look.layout;
  opts.effectiveMotion = resolved.look.motion;
}

function opsCheck(opts) {
  resolveLook(opts);
  const stills = !!opts.at;
  if (!stills) {
    if (opts.from < 0) opts.from = 0;
    if (opts.to > CONFIG.duration) opts.to = CONFIG.duration;
    if (opts.to <= opts.from) throw new Error('--to 必须大于 --from');
  }
  opts.stills = stills;
  opts.outDir = path.resolve(ROOT, opts.out || (stills ? 'stills' : 'frames'));
  const effectiveStyle = opts.effectiveStyle;
  const dir = path.join(ROOT, 'styles', 'themes');
  const available = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => f.replace(/\.css$/, '')).sort()
    : [];
  if (available.indexOf(effectiveStyle) === -1) {
    const from = opts.style ? '--style' : ('look "' + opts.effectiveLook + '" 的 theme / config.style');
    throw new Error(from + ' = "' + effectiveStyle + '" 没有对应主题文件；可用：' + (available.join(' / ') || '（styles/themes/ 为空）'));
  }
  if (!opts.chrome) {
    opts.chrome = process.env.CHROME_PATH || CHROME_CANDIDATES.find(p => fs.existsSync(p)) || null;
  } else if (opts.chrome.indexOf('/') !== -1) {
    opts.chrome = path.resolve(opts.chrome);
    if (!fs.existsSync(opts.chrome)) throw new Error('--chrome 指定的文件不存在: ' + opts.chrome);
  }
  if (!opts.chrome) {
    throw new Error(
      '未找到 Chrome。请用 --chrome 指定路径，或设置环境变量 CHROME_PATH。\n' +
      '常见路径: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
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
  const perFrame = (ext === 'jpg' ? 1.5 : 8.5) * 1024 * 1024 * ((outW * outH) / (3840 * 2160));
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
    style: opts.effectiveStyle,
    look: opts.effectiveLook,
    layout: opts.effectiveLayout,
    motion: opts.effectiveMotion,
    frames: totalFrames || undefined,
    mode: opts.stills ? 'stills' : 'frames',
    created: new Date().toISOString()
  };

  if (!opts.stills && opts.resume) {
    const prev = readManifest(opts.outDir);
    if (prev && (prev.width !== outW || prev.height !== outH || prev.fps !== opts.fps || prev.from !== opts.from || prev.to !== opts.to || prev.format !== ext || (prev.style || '') !== manifest.style || (prev.look || '') !== manifest.look || (prev.layout || '') !== manifest.layout)) {
      throw new Error(
        '--resume 与已有帧的参数不一致：\n' +
        `  已有: ${prev.width}x${prev.height} @${prev.fps}fps ${prev.from}-${prev.to}s ${prev.format} ${prev.style || '(未记录风格)'} ${prev.look || ''} ${prev.layout || ''}\n` +
        `  本次: ${outW}x${outH} @${opts.fps}fps ${opts.from}-${opts.to}s ${ext} ${manifest.style} ${manifest.look} ${manifest.layout}\n` +
        '请换一个 --out 目录，或先清空 frames/。'
      );
    }
  }
  if (!opts.stills) {
    diskCheck(opts, outW, outH, countTodo(opts, totalFrames, startFrame, endFrame, ext), ext);
    writeManifest(opts.outDir, manifest);
  }

  log(opts, '');
  log(opts, '  ' + CONFIG.title + ' · 帧渲染');
  log(opts, '  ─────────────────────────────────');
  log(opts, `  输出      ${outW}x${outH}  ${ext.toUpperCase()}`);
  log(opts, `  设备像素比 ${opts.scale}`);
  log(opts, opts.stills
    ? `  抽帧      ${opts.at.map(t => t.toFixed(2) + 's').join(', ')}`
    : `  时间      ${opts.from}s → ${opts.to}s  @${opts.fps}fps  (${totalFrames} 帧)`);
  log(opts, `  风格      ${manifest.style}  ·  ${manifest.layout}  ·  ${manifest.motion}`);
  log(opts, `  Look      ${manifest.look}` + (opts.lookAuto ? `（自动 · ${opts.lookAuto.confidence}${opts.lookAuto.hits.length ? ' · ' + opts.lookAuto.hits.slice(0, 3).join('/') : ''}）` : '（手动）'));
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

    const q = new URLSearchParams({ render: '1' });
    if (opts.style) q.set('style', opts.style);
    if (opts.effectiveLook) q.set('look', opts.effectiveLook);
    if (opts.layout && opts.layout !== 'auto') q.set('layout', opts.layout);
    const url = `http://127.0.0.1:${port}/index.html?${q.toString()}`;
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.evaluate(() => window.ready);
    const ready = await page.evaluate(() => window.__READY === true);
    if (!ready) throw new Error('页面未就绪（window.__READY 未置位）');

    const shotOpts = {
      type: ext === 'jpg' ? 'jpeg' : 'png',
      optimizeForSpeed: true,
      captureBeyondViewport: false
    };
    if (ext === 'jpg') shotOpts.quality = 95;

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
