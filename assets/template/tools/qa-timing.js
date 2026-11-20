#!/usr/bin/env node
/**
 * 节奏探针：逐场景按 15/35/50/70/85/95% 采样，检查占位符、暗显未亮、
 * 字幕与时间轴错位、场景切换残留、页脚区空帧。
 *
 *   node qa-timing.js [project-dir] [--scale 1] [--style swiss] [--json qa/timing.json]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let root = '.';
const opts = { scale: 1, json: 'qa/timing.json', chrome: null, headed: false, style: null, look: null, layout: null };

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

const PLACEHOLDER = /^(?:—+|–+|-+|…+|\.{3,}|NaN|undefined|null)$/;

function measureInPage() {
  const stage = document.getElementById('stage');
  const sr = stage.getBoundingClientRect();
  const out = { stage: { w: sr.width, h: sr.height }, leaves: [], frames: [], subs: [], active: [] };

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

  const scenes = stage.querySelectorAll('.scene');
  for (let i = 0; i < scenes.length; i++) {
    if (getComputedStyle(scenes[i]).display !== 'none') out.active.push(scenes[i].id);
  }

  const all = stage.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.closest('#subs')) continue;
    if (el.closest('[data-decor]')) continue;
    if (el.children.length) continue;
    const text = (el.textContent || '').trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = rectOf(el);
    if (r.w < 0.5 || r.h < 0.5) continue;
    const opacity = opacityOf(el);
    const ownOpacity = parseFloat(cs.opacity);
    const inside = r.r > 0 && r.l < out.stage.w && r.b > 0 && r.t < out.stage.h;
    out.leaves.push({
      path: pathOf(el),
      text: text.slice(0, 48),
      rect: r,
      font: parseFloat(cs.fontSize) || 0,
      opacity,
      ownOpacity: Number.isFinite(ownOpacity) ? ownOpacity : 1,
      inside,
      frame: !!el.closest('.frame')
    });
  }

  const frames = stage.querySelectorAll('.frame');
  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i];
    if (fr.closest('#subs')) continue;
    const r = rectOf(fr);
    if (r.w < 80) continue;
    const cx = sr.left + r.l + r.w / 2;
    const cy = sr.top + r.t + r.h / 2;
    let occluded = false;
    if (cx >= 0 && cy >= 0 && cx < window.innerWidth && cy < window.innerHeight) {
      const hit = document.elementFromPoint(cx, cy);
      occluded = !!(hit && hit !== fr && !fr.contains(hit));
    }
    const ownOpacity = parseFloat(getComputedStyle(fr).opacity);
    out.frames.push({
      path: pathOf(fr),
      opacity: opacityOf(fr),
      ownOpacity: Number.isFinite(ownOpacity) ? ownOpacity : 1,
      rect: r,
      occluded
    });
  }

  const on = stage.querySelectorAll('#subs li.on');
  for (let i = 0; i < on.length; i++) {
    out.subs.push({ text: on[i].textContent.trim(), opacity: opacityOf(on[i]), rect: rectOf(on[i]) });
  }
  return out;
}

function cueAt(cues, t) {
  return cues.find(c => t >= c.start && t < c.end) || null;
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
  try {
    const page = await browser.newPage();
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
    const cues = tl.cues || [];
    const fractionSamples = [0.15, 0.35, 0.5, 0.7, 0.85, 0.95];
    const times = [];
    tl.scenes.forEach(s => {
      fractionSamples.forEach(f => {
        times.push({ t: s.start + (s.end - s.start) * f, scene: s.id, f, label: s.id + ' ' + Math.round(f * 100) + '%' });
      });
    });
    const poster = Math.min(tl.duration - 0.001, config.posterAt * (tl.duration / 60));
    times.push({ t: poster, scene: null, f: null, label: '封面帧' });
    times.sort((a, b) => a.t - b.t);

    const errors = [];
    const warnings = [];
    const rows = [];

    for (let i = 0; i < times.length; i++) {
      const sample = times[i];
      await page.evaluate(tt => window.pauseAt(tt), sample.t);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await page.evaluate(measureInPage);
      const localErr = [];
      const localWarn = [];

      if (m.active.length !== 1) {
        localErr.push('同时激活 ' + m.active.length + ' 个场景（' + m.active.join(', ') + '）');
      } else if (sample.scene && m.active[0] !== sample.scene) {
        localErr.push('场景错位：应为 ' + sample.scene + '，实际 ' + m.active[0]);
      }

      const visible = m.leaves.filter(x => x.inside && x.opacity > 0.12);
      visible.forEach(leaf => {
        if (PLACEHOLDER.test(leaf.text) || /NaN|undefined/.test(leaf.text) || /\{[a-z]+\}/.test(leaf.text)) {
          localErr.push('占位符/无效值「' + leaf.text + '」 ' + leaf.path);
        }
      });

      if (sample.f != null && sample.f >= 0.7) {
        visible.forEach(leaf => {
          if (leaf.font >= 36 && leaf.opacity < 0.26 && leaf.ownOpacity < 0.6 && leaf.rect.w * leaf.rect.h > m.stage.w * m.stage.h * 0.004) {
            localWarn.push('大字到 ' + Math.round(sample.f * 100) + '% 仍未亮起（opacity ' + leaf.opacity.toFixed(2) + '）「' + leaf.text.slice(0, 16) + '」');
          }
        });
        m.frames.forEach(fr => {
          if (!fr.occluded && fr.opacity < 0.35 && fr.ownOpacity < 0.6 && fr.rect.w * fr.rect.h > m.stage.w * m.stage.h * 0.004) {
            localWarn.push('素材图仍暗显（opacity ' + fr.opacity.toFixed(2) + '）' + fr.path);
          }
        });
      }

      if (sample.f != null && sample.f >= 0.85 && visible.length === 0) {
        localWarn.push('场景收尾前已无可见文字（空镜？）');
      }

      const expect = cueAt(cues, sample.t);
      if (expect) {
        const onText = m.subs.map(s => s.text).join(' ');
        if (!m.subs.length) {
          localErr.push('字幕缺失：' + expect.start.toFixed(2) + '–' + expect.end.toFixed(2) + 's「' + expect.text.slice(0, 20) + '」');
        } else if (!onText.includes(expect.text.slice(0, 8))) {
          localErr.push('字幕错位：应为「' + expect.text.slice(0, 20) + '」');
        } else if (m.subs[0].opacity < 0.3 && sample.t > expect.start + 0.4 && sample.t < expect.end - 0.2) {
          localWarn.push('字幕透明度过低（' + m.subs[0].opacity.toFixed(2) + '）');
        }
        if (m.subs.length > 1) localErr.push('同时显示 ' + m.subs.length + ' 条字幕');
      } else if (m.subs.length) {
        localErr.push('字幕残留：当前无字幕区间，却显示「' + m.subs[0].text.slice(0, 20) + '」');
      }

      if (sample.label === '封面帧' && visible.length === 0) {
        localErr.push('封面帧没有可见文字');
      }

      localErr.forEach(e => errors.push('@' + sample.t.toFixed(2) + 's ' + e));
      localWarn.forEach(w => warnings.push('@' + sample.t.toFixed(2) + 's ' + w));
      rows.push({ t: +sample.t.toFixed(2), label: sample.label, visible: visible.length, errors: localErr.length, warnings: localWarn.length });
      process.stdout.write('  ' + String(i + 1).padStart(3) + '/' + times.length + '  ' + sample.t.toFixed(2).padStart(6) + 's  ' +
        (localErr.length ? '✗ ' + localErr.length : '✓') + (localWarn.length ? '  ! ' + localWarn.length : '') + '  ' + sample.label + '\n');
    }

    if (pageErrors.length) pageErrors.forEach(e => errors.push('运行时报错 ' + e));

    const report = {
      title: config.title,
      style,
      look,
      layout,
      generated: new Date().toISOString(),
      duration: tl.duration,
      samples: rows,
      errors,
      warnings
    };
    const jsonPath = path.resolve(root, opts.json);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

    console.log('\nqa-timing · ' + config.title + '  ·  ' + style + ' / ' + layout + ' / ' + look);
    console.log('  样本 ' + times.length + ' 个时刻 · 报告 ' + path.relative(process.cwd(), jsonPath));
    if (warnings.length) {
      console.log('\n警告（' + warnings.length + '）：');
      warnings.forEach(w => console.log('  ! ' + w));
    }
    if (errors.length) {
      console.log('\n失败（' + errors.length + '）：');
      errors.forEach(e => console.log('  ✗ ' + e));
      process.exitCode = 1;
    } else {
      console.log('\n通过：无占位符、无字幕错位、无场景残留。');
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(err => {
  console.error('qa-timing 失败：' + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
