#!/usr/bin/env node
/**
 * 自动版式体检：逐场景抽若干时刻，在真实浏览器里量文字盒。
 * 检查越界、被祖先裁切、单行溢出、字幕压字、页脚/角标超界、页面报错。
 *
 *   node qa-layout.js [project-dir] [--scale 1] [--style swiss] [--json qa/layout.json]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let root = '.';
const opts = { scale: 1, json: 'qa/layout.json', chrome: null, headed: false, style: null, look: null, layout: null };

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--scale') opts.scale = Number(args[++i]);
  else if (a === '--json') opts.json = args[++i];
  else if (a === '--chrome') opts.chrome = args[++i];
  else if (a === '--style') opts.style = args[++i];
  else if (a === '--look') opts.look = args[++i];
  else if (a === '--layout') opts.layout = args[++i];
  else if (a === '--headed') opts.headed = true;
  else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else root = a;
}

root = path.resolve(root);
const configPath = path.join(root, 'js', 'config.js');
if (!fs.existsSync(configPath)) {
  console.error('找不到 ' + configPath + '，请把工程目录作为第一个参数');
  process.exit(1);
}
const config = require(configPath);

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
];

function chromePath() {
  if (opts.chrome) return opts.chrome;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  return CHROME_CANDIDATES.find(p => fs.existsSync(p)) || null;
}

function measureInPage() {
  const stage = document.getElementById('stage');
  const sr = stage.getBoundingClientRect();
  const out = { stage: { w: sr.width, h: sr.height }, leaves: [], subs: [] };

  function pathOf(el) {
    const bits = [];
    let n = el;
    while (n && n !== stage && bits.length < 5) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      else if (n.className && typeof n.className === 'string') {
        const cls = n.className.trim().split(/\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) s += '.' + cls.join('.');
      }
      bits.unshift(s);
      n = n.parentElement;
    }
    return bits.join(' > ');
  }

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return { l: r.left - sr.left, t: r.top - sr.top, r: r.right - sr.left, b: r.bottom - sr.top, w: r.width, h: r.height };
  }

  function opacityOf(el) {
    let o = 1;
    let n = el;
    while (n && n !== document.documentElement) {
      const v = parseFloat(getComputedStyle(n).opacity);
      if (Number.isFinite(v)) o *= v;
      n = n.parentElement;
    }
    return o;
  }

  const all = stage.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.closest('#subs') || el.closest('[data-decor]')) continue;
    if (el.children.length) continue;
    const text = (el.textContent || '').trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (parseFloat(cs.fontSize) <= 0) continue;
    const r = rectOf(el);
    if (r.w < 0.5 || r.h < 0.5) continue;
    if (opacityOf(el) < 0.08) continue;

    const clipped = [];
    let n = el.parentElement;
    while (n && n !== stage) {
      const s = getComputedStyle(n);
      if (s.overflow === 'hidden' || s.overflow === 'clip' || s.overflowX === 'hidden' || s.overflowY === 'hidden') {
        const pr = rectOf(n);
        const dx = Math.max(pr.l - r.l, r.r - pr.r);
        const dy = Math.max(pr.t - r.t, r.b - pr.b);
        if (dx > 2.5 || dy > 2.5) clipped.push({ by: pathOf(n), dx: +Math.max(0, dx).toFixed(1), dy: +Math.max(0, dy).toFixed(1) });
      }
      n = n.parentElement;
    }

    const overflowX = cs.whiteSpace === 'nowrap' && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2;
    out.leaves.push({
      path: pathOf(el),
      text: text.slice(0, 42),
      rect: r,
      font: parseFloat(cs.fontSize),
      clipped,
      overflowX,
      bleed: !!el.closest('[data-bleed]')
    });
  }

  const active = stage.querySelectorAll('#subs li.on');
  for (let i = 0; i < active.length; i++) {
    out.subs.push({ text: active[i].textContent.trim().slice(0, 60), rect: rectOf(active[i]) });
  }
  return out;
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

  const pageErrors = [];
  let browser1 = browser;
  try {
    const page = await browser1.newPage();
    page.setDefaultTimeout(0);
    await page.setViewport({ width: config.width, height: config.height, deviceScaleFactor: opts.scale });
    page.on('pageerror', err => pageErrors.push('pageerror: ' + err.message));
    page.on('console', msg => { if (msg.type() === 'error') pageErrors.push('console: ' + msg.text()); });

    const q = new URLSearchParams({ render: '1' });
    if (opts.style) q.set('style', opts.style);
    if (opts.look) q.set('look', opts.look);
    if (opts.layout) q.set('layout', opts.layout);
    await page.goto('http://127.0.0.1:' + port + '/index.html?' + q.toString(), { waitUntil: 'load', timeout: 120000 });
    await page.evaluate(() => window.ready);

    const tl = await page.evaluate(() => window.getTimeline());
    const style = await page.evaluate(() => window.FILM_STYLE);
    const look = await page.evaluate(() => window.FILM_LOOK);
    const layout = await page.evaluate(() => window.FILM_LAYOUT);
    const times = [];
    const push = (t, label) => {
      t = Math.min(tl.duration - 0.001, Math.max(0, +t.toFixed(3)));
      if (!times.some(x => Math.abs(x.t - t) < 0.12)) times.push({ t, label });
    };
    tl.scenes.forEach(s => {
      const slot = s.end - s.start;
      [0.15, 0.45, 0.75, 0.9].forEach(f => push(s.start + slot * f, s.id + ' ' + Math.round(f * 100) + '%'));
    });
    const cues = await page.evaluate(() =>
      (window.FILM_CUES || []).map(c => ({ s: c.start, e: c.end, text: c.text }))
    );
    cues.forEach((c, i) => push((c.s + c.e) / 2, '字幕 ' + (i + 1) + ' · ' + c.text.slice(0, 14)));
    times.sort((a, b) => a.t - b.t);

    const errors = [];
    const warnings = [];
    const rows = [];

    for (let i = 0; i < times.length; i++) {
      const t = times[i].t;
      await page.evaluate(tt => window.pauseAt(tt), t);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await page.evaluate(measureInPage);
      const localErr = [];
      const localWarn = [];

      for (const leaf of m.leaves) {
        const r = leaf.rect;
        /* 真屏片的面板故意出画；字幕、间幕卡与普通版式文字仍按画框判 */
        if (!leaf.bleed && (r.l < -1.5 || r.t < -1.5 || r.r > m.stage.w + 1.5 || r.b > m.stage.h + 1.5)) {
          localErr.push('出画 ' + leaf.path + ' 「' + leaf.text + '」');
        }
        if (!leaf.bleed && leaf.clipped.length) {
          localErr.push('被裁切 ' + leaf.path + ' 「' + leaf.text + '」 by ' + leaf.clipped[0].by);
        }
        if (leaf.overflowX) {
          localErr.push('单行溢出 ' + leaf.path + ' 「' + leaf.text + '」');
        }
        if (leaf.font < 7.5) {
          localWarn.push('字号 ' + leaf.font.toFixed(1) + 'px 偏小：' + leaf.path);
        }
      }

      if (m.subs.length > 1) localErr.push('同时有 ' + m.subs.length + ' 条字幕在显示');
      if (m.subs.length === 1) {
        const sub = m.subs[0];
        if (sub.rect.l < -1.5 || sub.rect.r > m.stage.w + 1.5 || sub.rect.b > m.stage.h + 1.5) {
          localErr.push('字幕出画：「' + sub.text + '」');
        }
        for (const leaf of m.leaves) {
          const r = leaf.rect;
          const ix = Math.max(0, Math.min(r.r, sub.rect.r) - Math.max(r.l, sub.rect.l));
          const iy = Math.max(0, Math.min(r.b, sub.rect.b) - Math.max(r.t, sub.rect.t));
          const area = Math.max(1, r.w * r.h);
          if (ix * iy > area * 0.55) {
            localWarn.push('字幕压到画面文字：' + leaf.path + ' 「' + leaf.text.slice(0, 16) + '」');
          }
        }
      }

      localErr.forEach(e => errors.push('@' + t.toFixed(2) + 's ' + e));
      localWarn.forEach(w => warnings.push('@' + t.toFixed(2) + 's ' + w));
      rows.push({ t: +t.toFixed(2), label: times[i].label, leaves: m.leaves.length, errors: localErr.length, warnings: localWarn.length });
      process.stdout.write('  ' + String(i + 1).padStart(2) + '/' + times.length + '  ' + t.toFixed(2).padStart(6) + 's  ' +
        (localErr.length ? '✗ ' + localErr.length : '✓') + (localWarn.length ? '  ! ' + localWarn.length : '') + '  ' + times[i].label + '\n');
    }

    if (pageErrors.length) {
      pageErrors.forEach(e => errors.push('运行时报错 ' + e));
    }

    const report = {
      title: config.title,
      style: style,
      look: look,
      layout: layout,
      generated: new Date().toISOString(),
      duration: tl.duration,
      samples: rows,
      errors,
      warnings
    };
    const jsonPath = path.resolve(root, opts.json);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

    console.log('\nqa-layout · ' + config.title + '  ·  ' + style + ' / ' + layout + ' / ' + look);
    console.log('  样本 ' + times.length + ' 个时刻');
    console.log('  报告 ' + path.relative(process.cwd(), jsonPath));
    if (warnings.length) {
      console.log('\n警告（' + warnings.length + '）：');
      warnings.forEach(w => console.log('  ! ' + w));
    }
    if (errors.length) {
      console.log('\n失败（' + errors.length + '）：');
      errors.forEach(e => console.log('  ✗ ' + e));
      process.exitCode = 1;
    } else {
      console.log('\n通过：文字均在画内，未被裁切，字幕无压字。');
    }
  } finally {
    await browser1.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(err => {
  console.error('qa-layout 失败：' + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
