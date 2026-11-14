#!/usr/bin/env node
/**
 * Look 样片墙：每个 look 各渲几张静帧，并生成一个可打开的 gallery.html。
 * 用来在交付前目检所有审美方向，或作为 skill 的分发样例。
 *
 *   node tools/look-gallery.js [project-dir] [--looks a,b] [--at 6,26,47]
 *                              [--out qa/looks] [--max-width 960]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let root = '.';
const opts = { looks: null, at: null, out: 'qa/looks', chrome: null, maxWidth: 960 };

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--looks') opts.looks = args[++i];
  else if (a === '--at') opts.at = args[++i];
  else if (a === '--out') opts.out = args[++i];
  else if (a === '--chrome') opts.chrome = args[++i];
  else if (a === '--max-width') opts.maxWidth = Number(args[++i]);
  else if (a === '-h' || a === '--help') {
    console.log('用法: node tools/look-gallery.js [project-dir] [--looks a,b] [--at 6,26,47] [--out qa/looks] [--max-width 960]');
    process.exit(0);
  } else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else root = a;
}

root = path.resolve(root);
const config = require(path.join(root, 'js', 'config.js'));
const LOOKS = require(path.join(root, 'js', 'looks.js'));

const all = LOOKS.listLooks();
const picked = opts.looks
  ? opts.looks.split(',').map(s => s.trim()).filter(Boolean).map(id => {
    const l = LOOKS.getLook(id);
    if (!l) throw new Error('未知 look: ' + id);
    return all.find(x => x.id === id);
  })
  : all;

const dur = config.duration || 60;
const at = opts.at ? opts.at.split(',').map(Number).filter(n => Number.isFinite(n)) : [0.12, 0.42, 0.78].map(f => +(dur * f).toFixed(2));
if (!at.length) throw new Error('--at 没有有效秒数');

const outRoot = path.resolve(root, opts.out);
fs.mkdirSync(outRoot, { recursive: true });

console.log('look-gallery · ' + config.title);
console.log('  ' + picked.length + ' 个 look · ' + at.map(t => t.toFixed(2) + 's').join(', '));

const ok = [];
picked.forEach(look => {
  const dir = path.join(outRoot, look.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.readdirSync(dir).forEach(f => {
    if (/^still_.*\.(jpg|png)$/.test(f)) fs.rmSync(path.join(dir, f));
  });
  const renderArgs = [
    path.join(root, 'render.js'),
    '--scale', '1',
    '--format', 'jpg',
    '--out', path.relative(root, dir),
    '--at', at.join(','),
    '--look', look.id
  ];
  if (opts.chrome) renderArgs.push('--chrome', opts.chrome);
  const r = spawnSync(process.execPath, renderArgs, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('  ✗ ' + look.id + ' 渲染失败');
    return;
  }
  if (process.platform === 'darwin' && opts.maxWidth > 0) {
    fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).forEach(f => {
      spawnSync('sips', ['-Z', String(opts.maxWidth), path.join(dir, f)], { stdio: 'ignore' });
    });
  }
  ok.push(look);
  console.log('  ✓ ' + look.id + ' → ' + path.relative(process.cwd(), dir));
});

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const cards = ok.map(look => {
  const files = fs.readdirSync(path.join(outRoot, look.id)).filter(f => /^still_.*\.jpg$/.test(f)).sort();
  return `<section class="look">
  <header><b>${esc(look.name)}</b><code>${esc(look.id)}</code>
    <span>${esc(look.theme)} / ${esc(look.layout)} / ${esc(look.motion)}</span></header>
  <p>${esc(look.desc)}<em>适合：${esc(look.bestFor)}</em></p>
  <div class="strip">${files.map(f => `<img src="${esc(look.id)}/${esc(f)}" alt="${esc(look.id)}">`).join('')}</div>
</section>`;
}).join('\n');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(config.title)} · Look 样片墙</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 48px; background: #111; color: #ece5d4; font: 14px/1.6 -apple-system, "PingFang SC", sans-serif; }
  h1 { font-size: 22px; letter-spacing: .06em; margin: 0 0 8px; }
  .meta { color: #8d8474; margin-bottom: 36px; }
  .look { border-top: 1px solid #2c271e; padding: 22px 0 30px; }
  .look header { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .look b { font-size: 17px; }
  .look code { color: #c93b22; font-size: 12px; }
  .look span { color: #8d8474; font-size: 12px; letter-spacing: .08em; }
  .look p { margin: 6px 0 14px; color: #b8ad99; }
  .look em { font-style: normal; color: #8d8474; margin-left: 16px; }
  .strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .strip img { width: 100%; display: block; border: 1px solid #2c271e; }
  @media (max-width: 900px) { .strip { grid-template-columns: 1fr; } }
</style></head>
<body>
<h1>${esc(config.title)} · Look 样片墙</h1>
<div class="meta">${ok.length} 个 look · 每个 ${at.length} 帧 · ${esc(config.width)}x${esc(config.height)} · ${esc(config.duration)}s</div>
${cards}
</body></html>
`;

const htmlPath = path.join(outRoot, 'gallery.html');
fs.writeFileSync(htmlPath, html);
console.log('\n样片墙：' + path.relative(process.cwd(), htmlPath));
console.log('打开：open "' + htmlPath + '"');
