#!/usr/bin/env node
/**
 * MV 一条命令体检：qa-mv（画布 / 字幕牌 / 确定性 / 画面推进）→ 抽帧目检。
 *
 *   node tools/qa-all.js .
 *   node tools/qa-all.js . --no-qa        # 只抽帧
 *   node tools/qa-all.js . --scale 1 --every 2
 *
 * 抽帧规则：每镜 30% 与 78% 各一张，外加每个镜头的切点前 0.25s，
 * 覆盖「切点是否干净、主体是否被字幕牌压住、70% 后是否只剩残影」。
 */
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const opts = { root: '.', scale: 1, qa: true, every: 1 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--scale') opts.scale = Number(args[++i]);
  else if (a === '--every') opts.every = Math.max(1, Number(args[++i]));
  else if (a === '--no-qa') opts.qa = false;
  else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else opts.root = a;
}
const ROOT = path.resolve(opts.root);

function loadShots() {
  /* film.js 同时支持浏览器全局与 Node require，直接读同一份数据 */
  return require(path.join(ROOT, 'js/film.js')).shots || [];
}

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}

const steps = [];
if (opts.qa) steps.push(['qa-mv', ['tools/qa-mv.js', '.', '--scale', String(opts.scale), '--json', 'qa/mv.json']]);

const shots = loadShots();
const times = [];
for (let i = 0; i < shots.length; i += opts.every) {
  const s = shots[i];
  times.push(Number((s.start + s.dur * 0.30).toFixed(2)));
  times.push(Number((s.start + s.dur * 0.78).toFixed(2)));
  if (i > 0) times.push(Number(Math.max(0, s.start - 0.25).toFixed(2)));
}
steps.push(['stills', ['render.js', '--scale', String(opts.scale), '--at', times.join(',')]]);

for (const [name, argv] of steps) {
  console.log('\n▶ ' + name);
  run(process.execPath, argv);
}

console.log('\nMV 体检完成：qa/mv.json · stills/ · 成片前请逐张目检切点与 78% 收尾帧');
