#!/usr/bin/env node
/**
 * 运动体检：读成片或任意视频，量「流畅度」而不是靠肉眼。
 *
 * 参考基线（30fps 成片）：
 *   CrewVela 参考片：静止帧 7%，平均帧差 2.96，p90 5.99
 *   模板 ink-editorial / calm：静止帧 0.5%，平均帧差 0.81，p90 0.91
 *   第二版错误导出：静止帧 62%，平均帧差 0.35
 *
 *   帧差绝对值取决于画面密度：实拍/科技 look 天然高于印刷图形。
 *   主判据是「有没有静止」，帧差均值只作强度参考：
 *   好片子：静止帧 < 10%，均值 ≥ 1.5，最长静止段 < 0.8s
 *   可接受：静止帧 < 25%，均值 ≥ 0.6，最长静止段 < 1.2s
 *   发闷：  静止帧 > 50% 或均值 < 0.4（大量定格 + 突发动画）
 *
 *   node tools/qa-motion.js out/final.mp4
 *   node tools/qa-motion.js out/final.mp4 --fps 60 --json qa/motion.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const tries = [
    path.join(ROOT, 'node_modules', '@ffmpeg-installer', 'ffmpeg'),
    path.join(ROOT, 'node_modules', 'ffmpeg-static')
  ];
  for (const t of tries) {
    try {
      const p = require(t).path || require(t);
      if (p && fs.existsSync(p)) return p;
    } catch (e) { /* continue */ }
  }
  const which = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (!which.error && which.status === 0) return 'ffmpeg';
  throw new Error('需要 ffmpeg（npm install 或设置 FFMPEG_PATH）');
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i];
}

function analyze(diffs, fps, opts) {
  const sorted = diffs.slice().sort(function (a, b) { return a - b; });
  const n = diffs.length;
  const staticThreshold = 0.02;
  let staticCount = 0;
  const runs = [];
  let runStart = -1;

  diffs.forEach(function (d, i) {
    if (d < staticThreshold) {
      staticCount++;
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      runs.push({ start: runStart / fps, end: i / fps, seconds: (i - runStart) / fps });
      runStart = -1;
    }
  });
  if (runStart >= 0) runs.push({ start: runStart / fps, end: n / fps, seconds: (n - runStart) / fps });

  const longRuns = runs.filter(function (r) { return r.seconds >= opts.maxStatic; })
    .sort(function (a, b) { return b.seconds - a.seconds; });

  const mean = diffs.reduce(function (s, d) { return s + d; }, 0) / (n || 1);
  const p50 = percentile(sorted, 0.5);
  const p90 = percentile(sorted, 0.9);
  const max = sorted.length ? sorted[sorted.length - 1] : 0;

  const staticRatio = staticCount / (n || 1);
  const findings = [];
  if (staticRatio > 0.5) findings.push({ level: 'ERROR', code: 'static-ratio', message: '静止帧占比 ' + (staticRatio * 100).toFixed(0) + '%，成片大量定格' });
  else if (staticRatio > 0.25) findings.push({ level: 'WARN', code: 'static-ratio', message: '静止帧占比 ' + (staticRatio * 100).toFixed(0) + '%，建议加连续运镜或真实素材' });
  if (mean < 0.4) findings.push({ level: 'ERROR', code: 'motion-mean', message: '平均帧差 ' + mean.toFixed(2) + '，画面几乎没有运动' });
  else if (mean < opts.minMean) findings.push({ level: 'WARN', code: 'motion-mean', message: '平均帧差 ' + mean.toFixed(2) + '，低于 ' + opts.minMean + ' 的流畅下限' });
  longRuns.slice(0, 5).forEach(function (r) {
    findings.push({ level: 'WARN', code: 'static-run', message: '静止 ' + r.seconds.toFixed(2) + 's @ ' + r.start.toFixed(2) + 's' });
  });

  return {
    frames: n,
    duration: n / fps,
    fps: fps,
    staticRatio: staticRatio,
    mean: mean,
    p50: p50,
    p90: p90,
    max: max,
    longStatic: longRuns.slice(0, 10).map(function (r) {
      return { start: Number(r.start.toFixed(2)), seconds: Number(r.seconds.toFixed(2)) };
    }),
    findings: findings
  };
}

function detectCuts(ffmpeg, video, threshold) {
  const res = spawnSync(ffmpeg, [
    '-hide_banner', '-i', video,
    '-vf', "select='gt(scene," + threshold + ")',showinfo",
    '-vsync', 'vfr', '-f', 'null', '-'
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const times = [];
  const re = /pts_time:([0-9.]+)/g;
  let m;
  const text = res.stderr || '';
  while ((m = re.exec(text))) {
    const t = Number(m[1]);
    if (t < 0.3) continue;
    if (times.length && t - times[times.length - 1] < 0.3) continue;
    times.push(t);
  }
  return times;
}

function parseArgs(argv) {
  const opts = { video: 'out/final.mp4', fps: 30, json: 'qa/motion.json', minMean: 0.6, maxStatic: 1.2, cuts: true, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = function () {
      const v = argv[++i];
      if (v === undefined) throw new Error('缺少参数值: ' + a);
      return v;
    };
    if (a === '-h' || a === '--help') {
      console.log('用法: node tools/qa-motion.js [video] [--fps 30] [--json qa/motion.json] [--min-mean 0.6] [--max-static 1.2] [--no-cuts]');
      process.exit(0);
    } else if (a === '--fps') opts.fps = Number(next());
    else if (a === '--json') opts.json = next();
    else if (a === '--min-mean') opts.minMean = Number(next());
    else if (a === '--max-static') opts.maxStatic = Number(next());
    else if (a === '--no-cuts') opts.cuts = false;
    else if (a === '--quiet') opts.quiet = true;
    else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
    else opts.video = a;
  }
  if (!(opts.fps > 0)) throw new Error('--fps 必须大于 0');
  if (!(opts.minMean >= 0)) throw new Error('--min-mean 不能为负');
  if (!(opts.maxStatic > 0)) throw new Error('--max-static 必须大于 0');
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const video = path.resolve(ROOT, opts.video);
  if (!fs.existsSync(video)) throw new Error('找不到视频: ' + video + '（先渲染并编码，或用参数指定视频）');
  const ffmpeg = findFfmpeg();

  if (!opts.quiet) console.log('运动体检 ' + path.relative(ROOT, video));

  const res = spawnSync(ffmpeg, [
    '-loglevel', 'info', '-i', video,
    '-vf', 'fps=' + opts.fps + ',tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG',
    '-f', 'null', '-'
  ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

  const diffs = [];
  const re = /lavfi\.signalstats\.YAVG=([0-9.]+)/g;
  let m;
  while ((m = re.exec(res.stderr || ''))) diffs.push(Number(m[1]));
  if (diffs.length < 2) throw new Error('没有读到足够的帧；确认输入是视频文件');

  const report = analyze(diffs, opts.fps, opts);
  if (opts.cuts) report.cuts = detectCuts(ffmpeg, video, 0.1);

  const out = path.resolve(ROOT, opts.json);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');

  if (!opts.quiet) {
    console.log('  时长      ' + report.duration.toFixed(2) + 's  @' + report.fps + 'fps');
    console.log('  静止帧    ' + (report.staticRatio * 100).toFixed(0) + '%   平均帧差 ' + report.mean.toFixed(2) +
      '   p50 ' + report.p50.toFixed(2) + '   p90 ' + report.p90.toFixed(2));
    if (report.longStatic.length) {
      console.log('  最长静止  ' + report.longStatic.map(function (r) { return r.seconds + 's@' + r.start + 's'; }).join(' / '));
    }
    if (report.cuts && report.cuts.length) console.log('  切点      ' + report.cuts.length + ' 个');
  }

  report.findings.forEach(function (f) {
    console.log('  ' + (f.level === 'ERROR' ? '✗' : '!') + ' ' + f.message);
  });
  if (!report.findings.length && !opts.quiet) console.log('  ✓ 运动连续，没有长静止段');
  console.log('  报告      ' + path.relative(ROOT, out));

  if (report.findings.some(function (f) { return f.level === 'ERROR'; })) process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('运动体检失败: ' + err.message);
    process.exit(1);
  }
}

module.exports = { analyze };
