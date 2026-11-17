#!/usr/bin/env node
/**
 * 一条命令跑完内容体检：静态检查 → 版式 → 节奏 → 视觉引擎 → 抽帧。
 * 静态检查不过就停下；其余步骤全部跑完再汇总，报告写入 qa/。
 *
 *   node qa-all.js [project-dir] [--style swiss] [--scale 1] [--skip-stills] [--json qa/summary.json]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let root = '.';
const opts = { style: null, look: null, layout: null, scale: null, skipStills: false, json: 'qa/summary.json' };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--style') opts.style = args[++i];
  else if (a === '--look') opts.look = args[++i];
  else if (a === '--layout') opts.layout = args[++i];
  else if (a === '--scale') opts.scale = args[++i];
  else if (a === '--skip-stills') opts.skipStills = true;
  else if (a === '--json') opts.json = args[++i];
  else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else root = a;
}

root = path.resolve(root);
const CONFIG_PATH = path.join(root, 'js', 'config.js');
if (!fs.existsSync(CONFIG_PATH)) {
  console.error('找不到 ' + CONFIG_PATH + '，请把工程目录作为第一个参数');
  process.exit(1);
}
const CONFIG = require(CONFIG_PATH);
const LOOKS = require(path.join(root, 'js', 'looks.js'));
const requestedLook = opts.look || (CONFIG.look && CONFIG.look !== 'auto' ? CONFIG.look : null);
const autoBrief = [CONFIG.brief, CONFIG.title, CONFIG.slogan, CONFIG.brandSub].filter(Boolean).join(' ');
const resolved = requestedLook ? LOOKS.getLook(requestedLook) : LOOKS.chooseLook(autoBrief, { theme: opts.style || (CONFIG.style !== 'auto' ? CONFIG.style : null) }).look;
if (!resolved) throw new Error('未知 look：' + requestedLook);
const style = opts.style || resolved.theme;
const layout = opts.layout || (CONFIG.layout && CONFIG.layout !== 'auto' ? CONFIG.layout : null) || resolved.layout;
const look = resolved.id;

function run(name, scriptArgs) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, scriptArgs, { cwd: root, stdio: 'inherit' });
  return { name, code: r.status == null ? 1 : r.status, seconds: +((Date.now() - t0) / 1000).toFixed(1) };
}

function readReport(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (e) {
    return null;
  }
}

function passthrough(list) {
  if (opts.style) list.push('--style', opts.style);
  if (opts.look) list.push('--look', opts.look);
  if (opts.layout) list.push('--layout', opts.layout);
  if (opts.scale) list.push('--scale', opts.scale);
  return list;
}

function main() {
  const steps = [];
  const label = 'qa:all · ' + CONFIG.title + ' · ' + style + ' / ' + layout + ' / ' + look;
  console.log(label + '\n');

  const check = run('check-project', ['tools/check-project.js', '.']);
  steps.push(check);
  if (check.code !== 0) {
    console.log('\n静态检查未通过，先修 js/script.js、场景或主题，再跑浏览器体检。');
    finish(steps);
    return;
  }

  const layoutArgs = passthrough(['tools/qa-layout.js', '.', '--json', 'qa/layout.json']);
  steps.push(run('qa-layout', layoutArgs));
  const timingArgs = passthrough(['tools/qa-timing.js', '.', '--json', 'qa/timing.json']);
  steps.push(run('qa-timing', timingArgs));

  const engineArgs = ['tools/qa-engines.js', '.', '--looks', look, '--json', 'qa/engines.json'];
  if (opts.scale) engineArgs.push('--scale', opts.scale);
  steps.push(run('qa-engines', engineArgs));

  const stillsDir = opts.look ? 'qa/looks/' + look : (opts.style ? 'qa/styles/' + style : 'qa/stills');
  if (!opts.skipStills) {
    const stillsArgs = ['tools/qa-stills.js', '.', '--out', stillsDir];
    if (opts.style) stillsArgs.push('--style', opts.style);
    if (opts.look) stillsArgs.push('--look', opts.look);
    if (opts.layout) stillsArgs.push('--layout', opts.layout);
    steps.push(run('qa-stills', stillsArgs));
  }

  console.log('\n  ── qa:all 汇总 ──');
  steps.forEach((s, i) => {
    console.log('  [' + (i + 1) + '/' + steps.length + '] ' + s.name.padEnd(14) + (s.code === 0 ? '✓' : '✗') + '  ' + s.seconds + 's');
  });

  finish(steps);
}

function finish(steps) {
  const ran = new Set(steps.map(s => s.name));
  const layout = ran.has('qa-layout') ? readReport('qa/layout.json') : null;
  const timing = ran.has('qa-timing') ? readReport('qa/timing.json') : null;
  const engines = ran.has('qa-engines') ? readReport('qa/engines.json') : null;
  const errors = [];
  const warnings = [];
  if (layout) {
    layout.errors.forEach(e => errors.push('layout ' + e));
    layout.warnings.forEach(w => warnings.push('layout ' + w));
  }
  if (timing) {
    timing.errors.forEach(e => errors.push('timing ' + e));
    timing.warnings.forEach(w => warnings.push('timing ' + w));
  }
  if (engines) {
    (engines.looks || []).forEach(l => {
      (l.checks || []).filter(c => !c.ok).forEach(c => errors.push('engine ' + l.id + ' ' + c.name + '：' + c.detail));
    });
  }
  const broken = steps.filter(s => s.code !== 0);
  const stillsDir = opts.look ? 'qa/looks/' + look : (opts.style ? 'qa/styles/' + style : 'qa/stills');
  const stills = ran.has('qa-stills') ? (() => {
    try {
      return fs.readdirSync(path.join(root, stillsDir)).filter(f => /^still_.*\.jpg$/.test(f)).length;
    } catch (e) {
      return 0;
    }
  })() : 0;

  const summary = {
    title: CONFIG.title,
    style,
    look,
    layout,
    generated: new Date().toISOString(),
    steps,
    stills,
    errors,
    warnings,
    ok: broken.length === 0 && errors.length === 0
  };
  const file = path.resolve(root, opts.json);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(summary, null, 2) + '\n');

  if (errors.length) {
    console.log('\n失败（' + errors.length + '）：');
    errors.slice(0, 20).forEach(e => console.log('  ✗ ' + e));
    if (errors.length > 20) console.log('  … 其余见 ' + opts.json);
  }
  if (warnings.length) {
    console.log('\n警告（' + warnings.length + '）：');
    warnings.slice(0, 12).forEach(w => console.log('  ! ' + w));
    if (warnings.length > 12) console.log('  … 其余见 ' + opts.json);
  }
  console.log('\n报告 ' + opts.json + (stills ? ' · 抽帧 ' + stills + ' 张（' + stillsDir + '/）' : ''));
  if (summary.ok) {
    console.log('通过：静态、版式、节奏、引擎' + (opts.skipStills ? '' : '、抽帧') + '。');
  } else {
    console.log(broken.length ? '有 ' + broken.length + ' 个步骤失败，先修再渲染。' : '体检发现 ' + errors.length + ' 个问题，先修再渲染。');
    process.exitCode = 1;
  }
}

try {
  main();
} catch (e) {
  console.error('qa:all 失败：' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}
