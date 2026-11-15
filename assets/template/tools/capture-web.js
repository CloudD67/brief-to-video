#!/usr/bin/env node
/**
 * 网页 / 产品界面录制成逐帧素材：平滑滚动 + 可选光标路径 + 可选点击。
 * 产物是 assets/media/<scene>-cap-####.jpg，随后 npm run media 自动接入场景。
 *
 * 只录制你拥有或已获授权录制的页面；不要用它抓取第三方受版权保护的界面。
 *
 *   node tools/capture-web.js --url http://localhost:5173 --scene s4 --seconds 6 --fps 12
 *   node tools/capture-web.js --url https://your.site --scene s2 --scroll 0,900 --cursor 320,420;980,520
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(ROOT, 'assets', 'media');

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
  console.log(`网页录制 · 逐帧素材

用法: node tools/capture-web.js --url <url> --scene <sN> [options]

  --url <url>          要录制的页面（必须是你拥有或获授权的页面）
  --scene <sN>         场景 id，决定文件名前缀，如 s4
  --seconds <n>        录制时长，默认 6
  --fps <n>            采样帧率，默认 12（建议 12–30）
  --size <WxH>         视口，默认 1920x1080
  --scroll <a,b>       从 a 滚到 b（px），缓入缓出；不填则不滚
  --cursor <path>      光标路径 x,y;x,y;…；不填则不画光标
  --click <selector>   加载后先点击一次（可用于展开菜单）
  --wait <ms>          加载后等待，默认 1200
  --out <dir>          输出目录，默认 assets/media
  --chrome <path>      指定 Chrome/Chromium
  --headed             显示浏览器窗口
  -h, --help           显示帮助

产物:
  <out>/<scene>-cap-0001.jpg …        逐帧素材
  <out>/<scene>-cap.json              录制参数与来源

示例:
  node tools/capture-web.js --url http://localhost:5173 --scene s4 --seconds 6 --fps 12 --scroll 0,800
  node tools/capture-web.js --url https://your.site --scene s2 --cursor 240,360;900,480;1200,600
  npm run media && npm run check
`);
}

function parseArgs(argv) {
  const opts = {
    url: null, scene: null, seconds: 6, fps: 12, size: '1920x1080',
    scroll: null, cursor: null, click: null, wait: 1200,
    out: DEFAULT_OUT, chrome: null, headed: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error('缺少参数值: ' + a);
      return v;
    };
    switch (a) {
      case '-h': case '--help': usage(); process.exit(0); break;
      case '--url': opts.url = next(); break;
      case '--scene': opts.scene = next(); break;
      case '--seconds': opts.seconds = Number(next()); break;
      case '--fps': opts.fps = Number(next()); break;
      case '--size': opts.size = next(); break;
      case '--scroll': opts.scroll = next(); break;
      case '--cursor': opts.cursor = next(); break;
      case '--click': opts.click = next(); break;
      case '--wait': opts.wait = Number(next()); break;
      case '--out': opts.out = next(); break;
      case '--chrome': opts.chrome = next(); break;
      case '--headed': opts.headed = true; break;
      default: throw new Error('未知参数: ' + a + '\n使用 --help 查看用法');
    }
  }
  if (!opts.url) throw new Error('必须提供 --url');
  if (!/^s\d+$/.test(opts.scene || '')) throw new Error('--scene 必须是 s1 / s2 … 形式');
  if (!(opts.seconds > 0 && opts.seconds <= 60)) throw new Error('--seconds 必须在 0–60 之间');
  if (!(opts.fps > 0 && opts.fps <= 60)) throw new Error('--fps 必须在 0–60 之间');
  if (!/^\d+x\d+$/i.test(opts.size.replace(/\s+/g, ''))) throw new Error('--size 形如 1920x1080');
  if (!(opts.wait >= 0)) throw new Error('--wait 不能为负');

  opts.scroll = opts.scroll ? opts.scroll.split(',').map(Number) : null;
  if (opts.scroll && (opts.scroll.length !== 2 || !opts.scroll.every(Number.isFinite))) {
    throw new Error('--scroll 形如 0,800（两个像素值）');
  }
  opts.cursor = opts.cursor ? opts.cursor.split(';').map(function (pair) {
    const p = pair.split(',').map(Number);
    if (p.length !== 2 || !p.every(Number.isFinite)) throw new Error('--cursor 形如 320,420;900,500');
    return { x: p[0], y: p[1] };
  }) : null;
  return opts;
}

function findChrome(explicit) {
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error('找不到 Chrome: ' + explicit);
    return explicit;
  }
  const hit = CHROME_CANDIDATES.find(function (p) { return fs.existsSync(p); });
  if (!hit) throw new Error('找不到 Chrome/Chromium；用 --chrome 指定可执行文件');
  return hit;
}

function smooth(p) {
  p = Math.max(0, Math.min(1, p));
  return p * p * (3 - 2 * p);
}

function cursorAt(waypoints, p) {
  if (!waypoints || !waypoints.length) return null;
  if (waypoints.length === 1) return waypoints[0];
  const span = p * (waypoints.length - 1);
  const i = Math.min(waypoints.length - 2, Math.floor(span));
  const local = smooth(span - i);
  const a = waypoints[i];
  const b = waypoints[i + 1];
  return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
}

const CURSOR_SCRIPT = `
window.__capCursor = (function () {
  var el = document.createElement('div');
  el.id = '__cap_cursor';
  el.style.cssText = [
    'position:fixed', 'left:0', 'top:0', 'width:22px', 'height:22px',
    'z-index:2147483647', 'pointer-events:none', 'will-change:transform',
    'filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))'
  ].join(';');
  el.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none">' +
    '<path d="M4 2.5L20.2 11.2L12.8 12.9L9.3 20.4L4 2.5Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>' +
    '</svg>';
  document.documentElement.appendChild(el);
  return function (x, y) {
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
  };
})();
document.documentElement.style.scrollBehavior = 'auto';
document.documentElement.style.cursor = 'none';
`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [w, h] = opts.size.replace(' ', '').toLowerCase().split('x').map(Number);
  const chrome = findChrome(opts.chrome);
  const outDir = path.resolve(opts.out);
  fs.mkdirSync(outDir, { recursive: true });

  const prefix = opts.scene + '-cap';
  const frames = Math.round(opts.seconds * opts.fps);

  console.log('录制 ' + opts.url);
  console.log('  ' + w + 'x' + h + ' @' + opts.fps + 'fps  ' + frames + ' 帧  → ' + outDir + '/' + prefix + '-####.jpg');
  console.log('  仅可录制你拥有或已获授权的页面；产物请勿作为第三方素材再分发。');

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: !opts.headed,
    args: ['--hide-scrollbars', '--disable-lcd-text', '--force-device-scale-factor=1']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(opts.url, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.evaluate(CURSOR_SCRIPT);
    if (opts.click) {
      await page.waitForSelector(opts.click, { timeout: 10000 });
      await page.click(opts.click);
    }
    await new Promise(function (r) { setTimeout(r, opts.wait); });

    const interval = 1000 / opts.fps;
    const t0 = Date.now();
    for (let f = 0; f < frames; f++) {
      const p = frames > 1 ? f / (frames - 1) : 1;
      const ep = smooth(p);

      if (opts.scroll) {
        const y = opts.scroll[0] + (opts.scroll[1] - opts.scroll[0]) * ep;
        await page.evaluate(function (top) { window.scrollTo(0, top); }, y);
      }

      const pos = cursorAt(opts.cursor, p);
      if (pos) {
        await page.evaluate(function (x, y) {
          if (window.__capCursor) window.__capCursor(x, y);
        }, pos.x, pos.y);
      }

      const file = path.join(outDir, prefix + '-' + String(f + 1).padStart(4, '0') + '.jpg');
      await page.screenshot({ path: file, type: 'jpeg', quality: 92 });

      const wait = t0 + (f + 1) * interval - Date.now();
      if (wait > 0) await new Promise(function (r) { setTimeout(r, wait); });
      if ((f + 1) % Math.max(1, Math.round(opts.fps * 2)) === 0) {
        process.stdout.write('  ' + (f + 1) + '/' + frames + '\r');
      }
    }
    console.log('  完成 ' + frames + ' 帧，用时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');

    fs.writeFileSync(path.join(outDir, prefix + '.json'), JSON.stringify({
      url: opts.url,
      scene: opts.scene,
      seconds: opts.seconds,
      fps: opts.fps,
      size: opts.size,
      scroll: opts.scroll,
      cursor: opts.cursor,
      click: opts.click,
      frames: frames,
      capturedAt: new Date().toISOString(),
      note: '仅录制自有或授权页面；素材版权归页面所有者。'
    }, null, 2) + '\n');

    console.log('\n下一步:');
    console.log('  npm run media      # 写入 js/media.generated.js');
    console.log('  npm run check      # 校验素材引用');
    console.log('  npm run preview    # 在场景里看真实画面');
  } finally {
    await browser.close();
  }
}

main().catch(function (err) {
  console.error('录制失败: ' + err.message);
  process.exit(1);
});
