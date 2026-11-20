#!/usr/bin/env node
/**
 * 长片 / 剧集分块渲染：把 [0, duration] 按 --chunk 秒切开，逐块调用 render.js。
 * 每块写同一套 frame_XXXX.png 编号，encode.js 仍能按连续性一次合成。
 *
 *   node tools/render-chunks.js . --chunk 60 --workers 3 --format jpg --encode
 *   node tools/render-chunks.js . --from 0 --to 300 --chunk 30 --workers 4
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const opts = {
  root: '.',
  chunk: 60,
  workers: 1,
  scale: 1,
  format: 'png',
  from: 0,
  to: null,
  encode: false,
  quiet: false
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => {
    const v = args[++i];
    if (v == null) throw new Error('缺少参数值: ' + a);
    return v;
  };
  if (a === '--chunk') opts.chunk = Number(next());
  else if (a === '--workers') opts.workers = Number(next());
  else if (a === '--scale') opts.scale = Number(next());
  else if (a === '--format') opts.format = String(next()).toLowerCase();
  else if (a === '--from') opts.from = Number(next());
  else if (a === '--to') opts.to = Number(next());
  else if (a === '--encode') opts.encode = true;
  else if (a === '--quiet') opts.quiet = true;
  else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else opts.root = a;
}

const ROOT = path.resolve(opts.root);
const CONFIG = require(path.join(ROOT, 'js', 'config.js'));
const duration = CONFIG.duration;
const fps = CONFIG.fps || 30;
const from = Math.max(0, opts.from || 0);
const to = Math.min(duration, opts.to == null ? duration : opts.to);
const chunk = Math.max(1, opts.chunk);
const format = opts.format === 'jpg' || opts.format === 'jpeg' ? 'jpg' : 'png';
const ext = format;
if (!(to > from)) throw new Error('--to 必须大于 --from');
if (!(opts.workers >= 1)) throw new Error('--workers 必须大于等于 1');

function pad4(n) {
  return String(n).padStart(4, '0');
}

function frameDone(frame) {
  const file = path.join(ROOT, 'frames', 'frame_' + pad4(frame) + '.' + ext);
  try {
    return fs.statSync(file).size > 1024;
  } catch (e) {
    return false;
  }
}

function chunkDone(a, b) {
  const start = Math.round(a * fps);
  const end = Math.round(b * fps);
  for (let f = start; f < end; f++) if (!frameDone(f)) return false;
  return true;
}

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { cwd: ROOT, stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(cmd + ' 退出码 ' + r.status);
}

function fmt(sec) {
  const s = Math.max(0, Math.round(sec));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

const plan = [];
for (let a = from; a < to; a += chunk) plan.push([a, Math.min(to, a + chunk)]);

console.log('');
console.log('  ' + CONFIG.title + ' · 分块渲染');
console.log('  ─────────────────────────────────');
console.log('  片长      ' + duration + 's  @' + fps + 'fps  →  ' + Math.round((to - from) * fps) + ' 帧');
console.log('  分块      ' + plan.length + ' 块 × ' + chunk + 's  ·  每块 ' + opts.workers + ' 页并行');
console.log('  帧格式    ' + format.toUpperCase() + '  ·  scale ' + opts.scale);
console.log('  帧目录    frames/');
console.log('');

const t0 = Date.now();
let rendered = 0;
let skipped = 0;

plan.forEach(([a, b], i) => {
  const label = '[' + String(i + 1).padStart(2, '0') + '/' + String(plan.length).padStart(2, '0') + '] ' +
    fmt(a) + '–' + fmt(b);
  if (chunkDone(a, b)) {
    skipped++;
    console.log('  ' + label + '  已完成，跳过');
    return;
  }
  console.log('\n  ' + label + '  开渲');
  const argv = [
    'render.js',
    '--scale', String(opts.scale),
    '--from', String(a),
    '--to', String(b),
    '--format', format,
    '--workers', String(opts.workers)
  ];
  if (opts.quiet) argv.push('--quiet');
  run(process.execPath, argv);
  rendered++;
});

const dt = (Date.now() - t0) / 1000;
console.log('');
console.log('  分块渲染完成：' + rendered + ' 块新渲，' + skipped + ' 块跳过，用时 ' + fmt(dt));
if (opts.encode) {
  console.log('\n  开始合成…');
  run(process.execPath, ['encode.js']);
  const final = path.join(ROOT, 'out', 'final.mp4');
  if (fs.existsSync(final)) {
    console.log('  成片：' + path.relative(process.cwd(), final) + '  ' +
      (fs.statSync(final).size / 1024 / 1024).toFixed(1) + ' MB');
  }
}
console.log('');
