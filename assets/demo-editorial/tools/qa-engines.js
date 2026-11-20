#!/usr/bin/env node
/**
 * 引擎体检：逐个 look 打开页面，读 Canvas 像素，确认
 * 1) 引擎真的画了东西（不是空白层）；2) 同一时刻可复现；3) 不同时刻确实在动；
 * 4) 引擎与 look 绑定正确；5) 没有页面报错。
 *
 *   node tools/qa-engines.js . [--looks all] [--times 2.4,7.6] [--json qa/engines.json]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let root = '.';
const opts = { looks: null, times: [2.4, 7.6], json: 'qa/engines.json', chrome: null, headed: false, scale: 1 };

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-h' || a === '--help') {
    console.log('用法: node tools/qa-engines.js [工程目录] [--looks all|a,b] [--times 2.4,7.6] [--scale 1] [--json qa/engines.json] [--chrome 路径] [--headed]');
    process.exit(0);
  } else if (a === '--looks') opts.looks = String(args[++i]).split(',').filter(Boolean);
  else if (a === '--times') opts.times = String(args[++i]).split(',').map(Number).filter(Number.isFinite);
  else if (a === '--json') opts.json = args[++i];
  else if (a === '--chrome') opts.chrome = args[++i];
  else if (a === '--scale') opts.scale = Number(args[++i]);
  else if (a === '--headed') opts.headed = true;
  else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else root = a;
}

root = path.resolve(root);
const configPath = path.join(root, 'js', 'config.js');
const looksPath = path.join(root, 'js', 'looks.js');
if (!fs.existsSync(configPath) || !fs.existsSync(looksPath)) {
  console.error('找不到 js/config.js 或 js/looks.js，请把工程目录作为第一个参数');
  process.exit(1);
}
const config = require(configPath);
const LOOKS = require(looksPath);

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
  '/usr/bin/chromium'
];

function chromePath() {
  if (opts.chrome) return opts.chrome;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  return CHROME_CANDIDATES.find(p => fs.existsSync(p)) || null;
}

const lookIds = opts.looks && opts.looks.length && opts.looks[0] !== 'all'
  ? opts.looks
  : LOOKS.LOOKS.map(l => l.id);

for (const id of lookIds) {
  if (!LOOKS.getLook(id)) {
    console.error('未知 look：' + id);
    process.exit(1);
  }
}

const t1 = Math.max(0, Math.min(config.duration - 2, opts.times[0]));
const t2 = Math.max(0.5, Math.min(config.duration - 0.5, opts.times[1]));

/* 在页面里读 .fx-canvas：覆盖面积、亮度/透明度分布，并把像素留档供复现对比。
   Chrome 的 GPU 光栅化在重复绘制时会有 ±1 的抖动，所以复现性用容差而不是哈希。 */
function snapCanvas() {
  const canvas = document.querySelector('.fx-canvas');
  if (!canvas) return { exists: false };
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  let drawn = 0;
  let sum = 0;
  let sum2 = 0;
  let aSum = 0;
  let aSum2 = 0;
  const total = w * h;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    aSum += a;
    aSum2 += a * a;
    if (a > 8) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      drawn++;
      sum += lum;
      sum2 += lum * lum;
    }
  }
  const mean = drawn ? sum / drawn : 0;
  const variance = drawn ? Math.max(0, sum2 / drawn - mean * mean) : 0;
  const aMean = aSum / total;
  const aVar = Math.max(0, aSum2 / total - aMean * aMean);
  window.__qaSnap = new Uint8ClampedArray(data);
  return {
    exists: true,
    width: w,
    height: h,
    coverage: +(drawn / total).toFixed(4),
    mean: +mean.toFixed(1),
    std: +Math.sqrt(variance).toFixed(2),
    alphaStd: +Math.sqrt(aVar).toFixed(2),
    opacity: parseFloat(getComputedStyle(canvas).opacity) || 0,
    blend: getComputedStyle(canvas).mixBlendMode,
    inBg: !!(canvas.parentElement && canvas.parentElement.classList.contains('bg')),
    count: document.querySelectorAll('.fx-canvas').length
  };
}

/* 与留档对比：key = 'A' 比首帧，否则比上一帧。
   全画面先做预乘再比：透明像素的 RGB 是噪声，Chrome 每次重建画布时
   会在 alpha≈0 的地方留下任意 RGB，直接比原始字节会整片误报。 */
function diffCanvas(key) {
  const canvas = document.querySelector('.fx-canvas');
  const a = key === 'A' ? window.__qaSnapA : window.__qaSnap;
  if (!canvas || !a) return null;
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  const samples = Math.floor(d.length / 16);
  let over = 0;
  let sum = 0;
  let max = 0;
  for (let p = 0; p < samples; p++) {
    const i = p * 16;
    const aa = a[i + 3];
    const ba = d[i + 3];
    const ka = aa / 255;
    const kb = ba / 255;
    const m = Math.max(
      Math.abs(d[i] * kb - a[i] * ka),
      Math.abs(d[i + 1] * kb - a[i + 1] * ka),
      Math.abs(d[i + 2] * kb - a[i + 2] * ka),
      Math.abs(ba - aa)
    );
    sum += m;
    if (m > max) max = m;
    if (m > 2) over++;
  }
  return {
    overRate: +(over / Math.max(1, samples)).toFixed(5),
    meanAbs: +(sum / Math.max(1, samples)).toFixed(2),
    max: +max.toFixed(1)
  };
}

async function main() {
  const chrome = chromePath();
  if (!chrome) throw new Error('未找到 Chrome。用 --chrome 指定，或设置 CHROME_PATH。');

  const puppeteer = require(path.join(root, 'node_modules', 'puppeteer-core'));
  const { createServer } = require(path.join(root, 'server.js'));

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: !opts.headed,
    protocolTimeout: 120000,
    args: ['--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text']
  });

  console.log('');
  console.log('  视觉引擎体检 · ' + config.title);
  console.log('  ─────────────────────────────────');
  console.log(`  look      ${lookIds.length} 个`);
  console.log(`  时刻      ${t1.toFixed(2)}s / ${t2.toFixed(2)}s`);
  console.log('');

  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  await page.setViewport({ width: config.width, height: config.height, deviceScaleFactor: opts.scale });

  const report = { createdAt: new Date().toISOString(), looks: [], pass: true };
  let failures = 0;

  try {
    for (const lookId of lookIds) {
      const expected = LOOKS.getLook(lookId);
      const errors = [];
      page.removeAllListeners('pageerror');
      page.removeAllListeners('console');
      page.on('pageerror', err => errors.push('pageerror: ' + err.message));
      page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

      await page.goto('http://127.0.0.1:' + port + '/index.html?render=1&look=' + lookId, { waitUntil: 'load', timeout: 120000 });
      await page.evaluate(() => window.ready);
      await page.evaluate(tt => window.pauseAt(tt), t1);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const a = await page.evaluate(snapCanvas);
      await page.evaluate(() => { window.__qaSnapA = window.__qaSnap; });

      await page.evaluate(tt => window.pauseAt(tt), t2);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const move = await page.evaluate(diffCanvas, 'A');

      await page.evaluate(tt => window.pauseAt(tt), t1);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const repro = await page.evaluate(diffCanvas, 'A');

      const engine = await page.evaluate(() => window.FILM_ENGINE || 'none');
      const htmlEngine = await page.evaluate(() => document.documentElement.dataset.engine || 'none');
      const checks = [];
      const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); if (!ok) failures++; };

      check('引擎与 look 绑定', engine === expected.engine && htmlEngine === expected.engine,
        `runtime=${engine} html=${htmlEngine} expect=${expected.engine}`);
      check('只有一层引擎', a.count === 1, 'fx-canvas 数量 ' + (a.count == null ? '缺失' : a.count));
      check('位于背景层内', a.inBg, 'parent=' + (a.inBg ? '.bg' : '其他'));
      check('不透明度可用', a.opacity > 0.5, String(a.opacity));
      check('确实画了内容', a.exists && a.coverage > 0.002 && (a.std > 0.6 || a.alphaStd > 1),
        `coverage=${a.coverage} std=${a.std} alphaStd=${a.alphaStd}`);
      check('同一时刻可复现', repro && repro.overRate <= 0.1 && repro.meanAbs <= 0.5,
        repro ? `over=${(repro.overRate * 100).toFixed(2)}% meanAbs=${repro.meanAbs} max=${repro.max}` : '无留档');
      check('时间推进有变化', move && move.max > 3 && move.overRate > 0.0002,
        move ? `over=${(move.overRate * 100).toFixed(2)}% meanAbs=${move.meanAbs} max=${move.max}` : '无留档');
      check('无页面报错', errors.length === 0, errors.slice(0, 2).join(' | '));

      const bad = checks.filter(x => !x.ok);
      if (bad.length) report.pass = false;
      report.looks.push({ id: lookId, name: expected.name, engine: expected.engine, checks, errors });

      const tag = bad.length ? '✗' : '✓';
      console.log(`  ${tag} ${lookId.padEnd(18)} ${String(expected.engine).padEnd(9)} ` +
        `cov ${(a.coverage == null ? 0 : a.coverage).toFixed(3)} · std ${(a.std == null ? 0 : a.std).toFixed(1)} · ${a.blend || '--'}` +
        (bad.length ? '  ← ' + bad.map(x => x.name).join(' / ') : ''));
      bad.forEach(x => console.log('      ' + x.name + '：' + x.detail));
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  report.failures = failures;
  const jsonPath = path.resolve(root, opts.json);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

  console.log('');
  console.log(failures ? `  ${failures} 项未通过。` : `  全部通过：${lookIds.length} 个 look 的引擎都可用、可复现、有时序变化。`);
  console.log(`  报告 ${path.relative(root, jsonPath)}`);
  console.log('');
  if (failures) process.exitCode = 1;
}

main().catch(err => {
  console.error('\n引擎体检失败：' + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
