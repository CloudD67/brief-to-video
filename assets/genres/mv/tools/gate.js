#!/usr/bin/env node
/**
 * 交付门禁：把「写完稿 → 画完 → 渲完」串成一条命令，任何一环失败都不许交付。
 *
 *   node tools/gate.js .            # 全门禁：treatment + 静态/单测 + repair --strict + variety
 *   node tools/gate.js . --pre      # 只跑写作/静态门禁（建工程后、渲染前）
 *   node tools/gate.js . --json qa/gate.json
 *
 * 门禁顺序：
 *   1. treatment.md 结构（check-treatment.js）
 *   2. 宣传片：check-project.js（含 grammar/shots 分镜契约）；MV：test/unit.test.js
 *   3. 全门禁才跑：repair --strict（成片/切点/静帧/响度/新鲜度 + variety 严格告警）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let root = '.';
let pre = false;
let jsonPath = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--pre') pre = true;
  else if (args[i] === '--json') jsonPath = args[++i];
  else if (!args[i].startsWith('-')) root = args[i];
}
const ROOT = path.resolve(root);
const report = { ok: false, at: new Date().toISOString(), pre: pre, stages: [] };

function isMv() {
  try {
    return /data-genre="paper-story"/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
  } catch (e) {
    return false;
  }
}

function run(stage, cmd, argv) {
  process.stdout.write('\n▸ ' + stage + '\n');
  const r = spawnSync(cmd, argv, { cwd: ROOT, stdio: 'inherit', env: process.env });
  const ok = r.status === 0;
  report.stages.push({ stage: stage, cmd: [cmd].concat(argv).join(' '), ok: ok, status: r.status });
  if (!ok) {
    report.stages[report.stages.length - 1].error = '退出码 ' + r.status;
  }
  return ok;
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error('目录不存在: ' + ROOT);
    process.exit(1);
  }
  const mv = isMv();
  if (!fs.existsSync(path.join(ROOT, 'treatment.md'))) {
    console.error('✗ 缺少 treatment.md：先把 brief 扩写成可拍的稿子，再写分镜（不设字数，越详细越好）。');
    report.stages.push({ stage: 'treatment', ok: false, error: '缺少 treatment.md' });
    return finish();
  }

  let ok = run('treatment', process.execPath, [path.join(__dirname, 'check-treatment.js'), ROOT]);
  if (ok) {
    ok = mv
      ? run('contract', process.execPath, ['--test', path.join(ROOT, 'test', 'unit.test.js')])
      : run('static', process.execPath, [path.join(__dirname, 'check-project.js'), ROOT]);
  }
  if (!ok) return finish();

  if (!pre) {
    ok = run('repair', process.execPath, [path.join(__dirname, 'repair.js'), ROOT, '--strict']);
  }
  report.ok = ok;
  finish();
}

function finish() {
  report.ok = report.stages.length > 0 && report.stages.every(s => s.ok);
  if (jsonPath) {
    const out = path.resolve(ROOT, jsonPath);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  }
  console.log('\n' + (report.ok ? '✓ 门禁通过' : '✗ 门禁未通过') + '（' + report.stages.length + ' 环）');
  if (!report.ok) {
    report.stages.filter(s => !s.ok).forEach(s => console.log('  ✗ ' + s.stage + (s.error ? '：' + s.error : '')));
  }
  process.exit(report.ok ? 0 : 1);
}

main();