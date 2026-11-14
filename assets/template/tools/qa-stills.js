#!/usr/bin/env node
/**
 * 在所有场景切点前后和场景中点抽帧，输出小尺寸 JPG 供逐张目检。
 *
 *   node qa-stills.js [project-dir] [--times 3.05,33.2] [--out qa] [--style swiss]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let root = '.';
const opts = { out: 'qa', times: null, maxWidth: 1440, style: null, look: null, layout: null };

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--times') opts.times = args[++i];
  else if (a === '--out') opts.out = args[++i];
  else if (a === '--style') opts.style = args[++i];
  else if (a === '--look') opts.look = args[++i];
  else if (a === '--layout') opts.layout = args[++i];
  else if (a === '--max-width') opts.maxWidth = Number(args[++i]);
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
let script = null;
try {
  script = require(path.join(root, 'js', 'script.js'));
} catch (e) {
  console.warn('  ! js/script.js 未加载：' + e.message);
}

function loadScenes() {
  const dir = path.join(root, 'js', 'scenes');
  const box = {
    window: { FILM_CONFIG: config, FILM_SCRIPT: script, FILM_SCENES: [] },
    console: { log() {}, warn() {}, error() {} },
    Math, Number, String, Array, Object, JSON, Date, isFinite, parseFloat, parseInt
  };
  box.window.window = box.window;
  vm.createContext(box);
  fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), box, { filename: f });
  });
  return box.window.FILM_SCENES || [];
}

function buildTimes(scenes) {
  if (opts.times) {
    return opts.times.split(',').map(Number).filter(n => Number.isFinite(n) && n >= 0 && n < config.duration)
      .sort((a, b) => a - b).map(t => ({ t, label: 'custom' }));
  }
  const list = scenes.slice().sort((a, b) => a.start - b.start);
  const scale = config.duration / 60;
  const out = [];
  const push = (t, label) => {
    t = Math.min(config.duration - 0.001, Math.max(0, +t.toFixed(3)));
    if (!out.some(x => Math.abs(x.t - t) < 0.01)) out.push({ t, label });
  };
  for (let i = 1; i < list.length; i++) {
    const cut = list[i].start * scale;
    push(cut - 0.3, '切点前 ' + cut.toFixed(2) + 's · ' + list[i - 1].id + '→' + list[i].id);
    push(cut, '切点 · ' + list[i].id);
    push(cut + 0.24, '切点后 ' + cut.toFixed(2) + 's · ' + list[i].id);
  }
  list.forEach(s => {
    const mid = (s.start + (s.end - s.start) / 2) * scale;
    push(mid, '中点 · ' + s.id);
    push((s.start + (s.end - s.start) * 0.82) * scale, '收尾前 · ' + s.id);
  });
  push(config.posterAt * scale, '封面帧');
  return out.sort((a, b) => a.t - b.t);
}

function main() {
  const scenes = loadScenes();
  if (!scenes.length) throw new Error('没有场景');
  const times = buildTimes(scenes);
  const outDir = path.resolve(root, opts.out);
  fs.mkdirSync(outDir, { recursive: true });
  fs.readdirSync(outDir).forEach(f => {
    if (/^still_.*\.(jpg|png)$/.test(f)) fs.rmSync(path.join(outDir, f));
  });

  console.log('qa-stills · ' + config.title);
  console.log('  抽帧 ' + times.length + ' 张 · ' + outDir);
  const renderArgs = [
    path.join(root, 'render.js'),
    '--scale', '1',
    '--format', 'jpg',
    '--out', path.relative(root, outDir),
    '--at', times.map(x => x.t).join(',')
  ];
  if (opts.style) renderArgs.push('--style', opts.style);
  if (opts.look) renderArgs.push('--look', opts.look);
  if (opts.layout) renderArgs.push('--layout', opts.layout);
  const r = spawnSync(process.execPath, renderArgs, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('render.js 抽帧失败');

  const files = fs.readdirSync(outDir).filter(f => f.endsWith('.jpg')).sort();
  if (process.platform === 'darwin' && opts.maxWidth > 0) {
    files.forEach(f => {
      spawnSync('sips', ['-Z', String(opts.maxWidth), f], { cwd: outDir, stdio: 'ignore' });
    });
  }

  console.log('\n逐张看：');
  times.forEach(x => {
    const name = 'still_' + x.t.toFixed(2) + '.jpg';
    const exists = fs.existsSync(path.join(outDir, name));
    console.log('  ' + (exists ? path.join(path.relative(process.cwd(), outDir), name) : '—') + '  ← ' + x.label + ' @ ' + x.t.toFixed(2) + 's');
  });
  console.log('\n检查：元素是否越界/被裁、切点是否空帧、文字是否溢出、单位是否生效。');
}

try {
  main();
} catch (e) {
  console.error('QA 抽帧失败：' + e.message);
  process.exit(1);
}
