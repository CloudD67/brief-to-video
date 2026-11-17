#!/usr/bin/env node
/**
 * 视觉回归：对全部 look 在固定时刻截图，和本地基线做 SSIM 对比。
 * 基线只在本机有意义（字体/抗锯齿随系统变化），所以 qa/baseline 不进版本库；
 * 有意改设计后用 --update 重建基线，然后提交前再跑一次确认没顺手改坏别的 look。
 *
 *   node tools/qa-regress.js .                 # 对比
 *   node tools/qa-regress.js . --update        # 重建基线
 *   node tools/qa-regress.js . --looks ink-poster,tech-grid --times 2.4,7.6
 *   node tools/qa-regress.js . --threshold 0.99 --json qa/regress.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let root = '.';
const opts = {
  update: false,
  looks: null,
  times: [2.4, 7.6],
  threshold: 0.985,
  scale: 1,
  json: 'qa/regress.json',
  chrome: null,
  keep: false
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-h' || a === '--help') {
    console.log('用法: node tools/qa-regress.js [工程目录] [--update] [--looks a,b] [--times 2.4,7.6] [--threshold 0.985] [--scale 1] [--json qa/regress.json] [--chrome 路径]');
    process.exit(0);
  } else if (a === '--update') opts.update = true;
  else if (a === '--looks') opts.looks = String(args[++i]).split(',').filter(Boolean);
  else if (a === '--times') opts.times = String(args[++i]).split(',').map(Number).filter(Number.isFinite);
  else if (a === '--threshold') opts.threshold = Number(args[++i]);
  else if (a === '--scale') opts.scale = Number(args[++i]);
  else if (a === '--json') opts.json = args[++i];
  else if (a === '--chrome') opts.chrome = args[++i];
  else if (a === '--keep') opts.keep = true;
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
const CONFIG = require(configPath);
const LOOKS = require(looksPath);

function ffmpegPath() {
  try {
    return require('@ffmpeg-installer/ffmpeg').path;
  } catch (e) {
    return null;
  }
}

const FFMPEG = ffmpegPath();
if (!FFMPEG) {
  console.error('缺少 @ffmpeg-installer/ffmpeg，先 npm install');
  process.exit(1);
}

const times = opts.times.map(t => Math.max(0, Math.min(CONFIG.duration - 0.1, t)));
const lookIds = opts.looks && opts.looks.length
  ? opts.looks
  : LOOKS.LOOKS.map(l => l.id);
for (const id of lookIds) {
  if (!LOOKS.getLook(id)) {
    console.error('未知 look：' + id + '；可用：' + LOOKS.LOOKS.map(l => l.id).join(' / '));
    process.exit(1);
  }
}

const BASE = path.join(root, 'qa', 'baseline');
const ACTUAL = path.join(root, 'qa', 'regress-actual');
const DIFF = path.join(root, 'qa', 'regress-diff');

function ssim(a, b) {
  const r = spawnSync(FFMPEG, [
    '-hide_banner', '-nostats',
    '-i', a, '-i', b,
    '-lavfi', 'ssim', '-f', 'null', '-'
  ], { encoding: 'utf8' });
  const text = String(r.stderr || '');
  const m = /All:([0-9.]+)/.exec(text);
  return m ? Number(m[1]) : NaN;
}

function saveDiff(a, b, out) {
  spawnSync(FFMPEG, [
    '-hide_banner', '-nostats', '-y',
    '-i', a, '-i', b,
    '-lavfi', 'blend=all_mode=difference,eq=contrast=6:brightness=0.06',
    out
  ], { stdio: 'ignore' });
}

function capture(dir, lookId, t) {
  const r = spawnSync(process.execPath, [
    path.join(root, 'render.js'),
    '--at', String(t),
    '--look', lookId,
    '--scale', String(opts.scale),
    '--out', dir,
    '--quiet'
  ].concat(opts.chrome ? ['--chrome', opts.chrome] : []), { cwd: root, stdio: 'inherit' });
  const file = path.join(dir, `still_${Number(t).toFixed(2)}.png`);
  return r.status === 0 && fs.existsSync(file) ? file : null;
}

function clean(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

console.log('');
console.log('  视觉回归 · ' + path.basename(root));
console.log('  ─────────────────────────────────');
console.log(`  look      ${lookIds.length} 个`);
console.log(`  时刻      ${times.map(t => t.toFixed(2) + 's').join(', ')}`);
console.log(`  阈值      SSIM ≥ ${opts.threshold}`);
console.log(`  模式      ${opts.update ? '重建基线' : '对比基线'}`);
console.log('');

fs.mkdirSync(path.join(root, 'qa'), { recursive: true });
if (opts.update) {
  clean(BASE);
  fs.mkdirSync(BASE, { recursive: true });
} else if (!fs.existsSync(BASE)) {
  console.error('还没有基线。先跑一次 --update 生成 qa/baseline/');
  process.exit(1);
}

const report = {
  mode: opts.update ? 'update' : 'compare',
  threshold: opts.threshold,
  width: CONFIG.width * opts.scale,
  height: CONFIG.height * opts.scale,
  createdAt: new Date().toISOString(),
  looks: [],
  pass: true
};

let failed = 0;
let total = 0;

for (const lookId of lookIds) {
  const look = LOOKS.getLook(lookId);
  const baseDir = path.join(BASE, lookId);
  const actDir = path.join(ACTUAL, lookId);

  if (opts.update) {
    fs.mkdirSync(baseDir, { recursive: true });
    const shots = [];
    for (const t of times) {
      const file = capture(baseDir, lookId, t);
      if (!file) throw new Error(`${lookId} @${t}s 截图失败`);
      shots.push({ t, file: path.relative(root, file) });
    }
    report.looks.push({ id: lookId, name: look.name, engine: look.engine, updated: true, shots });
    console.log(`  ✓ ${lookId.padEnd(18)} 基线已更新（${times.length} 帧）`);
    continue;
  }

  if (!fs.existsSync(baseDir)) {
    report.looks.push({ id: lookId, name: look.name, engine: look.engine, skipped: '缺少基线' });
    console.log(`  – ${lookId.padEnd(18)} 缺少基线，跳过`);
    continue;
  }

  clean(actDir);
  fs.mkdirSync(actDir, { recursive: true });
  const shots = [];
  for (const t of times) {
    const baseFile = path.join(baseDir, `still_${t.toFixed(2)}.png`);
    const actFile = capture(actDir, lookId, t);
    if (!actFile) throw new Error(`${lookId} @${t}s 截图失败`);
    total++;
    if (!fs.existsSync(baseFile)) {
      shots.push({ t, status: 'missing-baseline' });
      failed++;
      continue;
    }
    const score = ssim(baseFile, actFile);
    const ok = Number.isFinite(score) && score >= opts.threshold;
    if (!ok) {
      failed++;
      fs.mkdirSync(DIFF, { recursive: true });
      saveDiff(baseFile, actFile, path.join(DIFF, `${lookId}_${t.toFixed(2)}.png`));
    }
    shots.push({ t, ssim: Number.isFinite(score) ? +score.toFixed(4) : null, status: ok ? 'pass' : 'fail' });
  }
  const worst = shots.reduce((m, s) => (s.ssim != null && (m == null || s.ssim < m) ? s.ssim : m), null);
  const bad = shots.filter(s => s.status !== 'pass').length;
  if (bad) report.pass = false;
  report.looks.push({ id: lookId, name: look.name, engine: look.engine, shots, worst });
  const tag = bad ? '✗' : '✓';
  console.log(`  ${tag} ${lookId.padEnd(18)} ${bad ? bad + ' 帧超差' : '通过'}  worst ${worst == null ? '--' : worst.toFixed(4)}`);
}

report.failed = failed;
report.total = total;

if (!opts.keep) clean(ACTUAL);
if (fs.existsSync(DIFF) && fs.readdirSync(DIFF).length === 0) clean(DIFF);

const jsonPath = path.resolve(root, opts.json);
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

console.log('');
if (opts.update) {
  console.log(`  基线已写入 ${path.relative(root, BASE)}/（共 ${lookIds.length} 个 look × ${times.length} 帧）`);
} else if (failed) {
  console.log(`  ${failed}/${total} 帧超出阈值。差异图：${path.relative(root, DIFF)}/`);
  console.log('  确认是有意改动后，跑 --update 重建基线。');
  process.exitCode = 1;
} else {
  console.log(`  全部通过：${total} 帧 SSIM ≥ ${opts.threshold}`);
}
console.log(`  报告 ${path.relative(root, jsonPath)}`);
console.log('');
