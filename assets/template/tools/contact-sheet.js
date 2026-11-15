#!/usr/bin/env node
/**
 * Look 总览图：每个 look 渲一帧，拼成带标签的 contact sheet（JPEG）。
 * 产出可直接放进 README，也可用来快速目检全部审美方向。
 *
 *   node tools/contact-sheet.js . --out ../looks-contact-sheet.jpg
 *   node tools/contact-sheet.js . --at 26 --cols 4 --tile 620
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let root = '.';
const opts = { at: null, cols: 4, tile: 620, out: 'qa/looks-contact-sheet.jpg', scale: 0.5, chrome: null, quality: 86 };

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-h' || a === '--help') {
    console.log('用法: node tools/contact-sheet.js [工程目录] [--at 26] [--cols 4] [--tile 620] [--scale 0.5] [--out 路径.jpg] [--chrome 路径]');
    process.exit(0);
  } else if (a === '--at') opts.at = Number(args[++i]);
  else if (a === '--cols') opts.cols = Math.max(2, Math.min(6, Number(args[++i]) || 4));
  else if (a === '--tile') opts.tile = Math.max(240, Number(args[++i]) || 620);
  else if (a === '--scale') opts.scale = Number(args[++i]) || 0.5;
  else if (a === '--out') opts.out = args[++i];
  else if (a === '--chrome') opts.chrome = args[++i];
  else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else root = a;
}

root = path.resolve(root);
const config = require(path.join(root, 'js', 'config.js'));
const LOOKS = require(path.join(root, 'js', 'looks.js'));
const looks = LOOKS.listLooks();
const at = Number.isFinite(opts.at) ? opts.at : +((config.duration || 60) * 0.48).toFixed(2);

function chromePath() {
  if (opts.chrome) return opts.chrome;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function main() {
  const chrome = chromePath();
  if (!chrome) throw new Error('未找到 Chrome。用 --chrome 指定，或设置 CHROME_PATH。');

  const frameDir = path.resolve(root, 'qa/contact-frames');
  fs.mkdirSync(frameDir, { recursive: true });

  console.log('contact-sheet · ' + config.title);
  console.log('  ' + looks.length + ' 个 look · ' + at.toFixed(2) + 's · ' + opts.cols + ' 列');

  const tiles = [];
  for (const look of looks) {
    const dir = path.join(frameDir, look.id);
    fs.mkdirSync(dir, { recursive: true });
    // 清掉旧帧，避免换了 --at 之后拿到上一次的文件
    fs.readdirSync(dir).forEach(f => {
      if (/^still_.*\.(jpg|png)$/.test(f)) fs.rmSync(path.join(dir, f));
    });
    const renderArgs = [
      path.join(root, 'render.js'),
      '--scale', String(opts.scale),
      '--format', 'jpg',
      '--out', path.relative(root, dir),
      '--at', String(at),
      '--look', look.id
    ];
    if (opts.chrome) renderArgs.push('--chrome', opts.chrome);
    const r = spawnSync(process.execPath, renderArgs, { cwd: root, stdio: 'inherit' });
    const file = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).sort()[0];
    if (r.status !== 0 || !file) {
      console.error('  ✗ ' + look.id + ' 渲染失败');
      continue;
    }
    tiles.push({ look, img: fs.readFileSync(path.join(dir, file)).toString('base64') });
    console.log('  ✓ ' + look.id);
  }
  if (!tiles.length) throw new Error('没有渲染出任何帧');

  const gap = 16;
  const pad = 44;
  const cols = Math.min(opts.cols, tiles.length);
  const sheetW = pad * 2 + cols * opts.tile + (cols - 1) * gap;
  const cells = tiles.map((t, i) => {
    const no = String(i + 1).padStart(2, '0');
    return `<figure class="tile">
  <img src="data:image/jpeg;base64,${t.img}" alt="${esc(t.look.name)}">
  <figcaption>
    <span class="no">${no}</span>
    <span class="name">${esc(t.look.name)}</span>
    <code>${esc(t.look.id)}</code>
    <span class="eng">${esc(t.look.theme)} · ${esc(t.look.layout)} · ${esc(t.look.engine)}</span>
  </figcaption>
</figure>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${sheetW}px;
    padding: ${pad}px;
    background: #131009;
    color: #ece5d4;
    font: 15px/1.5 -apple-system, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
  }
  header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #33291c; }
  h1 { font: 34px/1.15 "Songti SC", "Noto Serif CJK SC", Georgia, serif; letter-spacing: .02em; }
  h1 em { font-style: normal; color: #c8462b; }
  .meta { text-align: right; color: #8d8474; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: repeat(${cols}, ${opts.tile}px); gap: ${gap}px; }
  .tile { background: #1b160e; border: 1px solid #2c2416; }
  .tile img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
  figcaption { display: flex; align-items: baseline; gap: 10px; padding: 10px 12px 11px; flex-wrap: wrap; }
  .no { color: #c8462b; font: 11px/1 ui-monospace, monospace; }
  .name { font-size: 14px; font-weight: 600; }
  code { color: #a3988a; font: 11px/1 ui-monospace, monospace; }
  .eng { margin-left: auto; color: #6f6657; font: 10px/1 ui-monospace, monospace; letter-spacing: .06em; }
  footer { margin-top: 24px; color: #6f6657; font: 11px/1.6 ui-monospace, monospace; letter-spacing: .08em; display: flex; justify-content: space-between; }
</style></head>
<body>
<header>
  <h1>${esc(config.title)}<em> · </em>Look 总览</h1>
  <div class="meta">${tiles.length} looks · engine layer · ${esc(config.width)}×${esc(config.height)} · ${esc(config.duration)}s</div>
</header>
<div class="grid">
${cells}
</div>
<footer><span>brief-to-video · deterministic HTML timeline</span><span>frame @ ${at.toFixed(2)}s · theme / layout / engine</span></footer>
</body></html>
`;

  const puppeteer = require(path.join(root, 'node_modules', 'puppeteer-core'));
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    protocolTimeout: 120000,
    args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: sheetW, height: 900, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    const height = await page.evaluate(() => document.body.getBoundingClientRect().height);
    await page.setViewport({ width: sheetW, height: Math.ceil(height), deviceScaleFactor: 2 });
    await new Promise(r => setTimeout(r, 120));

    const outPath = path.resolve(root, opts.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, type: 'jpeg', quality: opts.quality, fullPage: true });
    console.log('\n总览图：' + path.relative(process.cwd(), outPath));
    console.log('尺寸：' + sheetW + '×' + Math.ceil(height) + ' @2x');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('contact-sheet 失败：' + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
