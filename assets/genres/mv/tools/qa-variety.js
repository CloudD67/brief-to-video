#!/usr/bin/env node
/**
 * 色彩多样性体检：量「一支片是不是只有一个颜色」。
 *
 * 按 1fps 采样成片，取每帧平均 RGB → 色相/饱和度/明度，
 * 归入 12 个色域 + 中性域，输出色域时间轴与占比。
 *
 * 判据（宣传片 / 硬件片）：
 *   主色域占比 > 60%        → 颜色单一
 *   色域数（≥8% 占比）< 3   → 没有色彩脚本
 *   明暗跨度 p90-p10 < 0.10 → 光也单一
 *   饱和度中位 < 0.10       → 整体发灰
 *
 *   node tools/qa-variety.js out/final.mp4 [--json qa/variety.json] [--fps 1] [--strict] [--quiet]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const tries = [
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'ffmpeg'),
    path.join(ROOT, 'node_modules', '@ffmpeg-installer', 'ffmpeg'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static'),
    path.join(ROOT, 'node_modules', 'ffmpeg-static')
  ];
  for (const t of tries) {
    try {
      const p = require(t).path || require(t);
      if (p && fs.existsSync(p)) return p;
    } catch (e) { /* continue */ }
  }
  const which = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (which.status === 0) return 'ffmpeg';
  throw new Error('需要 ffmpeg（npm install 或设置 FFMPEG_PATH）');
}

const WORLDS = [
  ['红', 'r'], ['橙', 'o'], ['黄', 'y'], ['黄绿', 'l'], ['绿', 'g'], ['青绿', 's'],
  ['青', 'c'], ['天蓝', 'a'], ['蓝', 'b'], ['紫', 'v'], ['品红', 'm'], ['玫红', 'p']
];

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max ? d / max : 0, v: max };
}

function classify(hsv) {
  if (hsv.s < 0.12 || hsv.v < 0.10) return -1;
  return Math.floor(hsv.h / 30) % 12;
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];
}

function main() {
  const args = process.argv.slice(2);
  const opts = { video: null, json: 'qa/variety.json', fps: 1, strict: false, quiet: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h' || a === '--help') {
      console.log('用法: node tools/qa-variety.js <video> [--json qa/variety.json] [--fps 1] [--strict] [--quiet]');
      process.exit(0);
    } else if (a === '--json') opts.json = args[++i];
    else if (a === '--fps') opts.fps = Number(args[++i]) || 1;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
    else if (!opts.video) opts.video = a;
  }
  if (!opts.video) throw new Error('缺少视频路径（如 out/final.mp4）');
  const video = path.resolve(process.cwd(), opts.video);
  if (!fs.existsSync(video)) throw new Error('找不到视频: ' + video);

  const ffmpeg = findFfmpeg();
  const W = 32, H = 18;
  const r = spawnSync(ffmpeg, [
    '-v', 'error', '-i', video,
    '-vf', 'fps=' + opts.fps + ',scale=' + W + ':' + H + ':flags=area,format=rgb24',
    '-f', 'rawvideo', '-'
  ], { maxBuffer: 256 * 1024 * 1024 });
  const buf = r.stdout;
  const frameSize = W * H * 3;
  if (!buf || buf.length < frameSize) throw new Error('没有读到画面：确认输入是视频');
  const frames = Math.floor(buf.length / frameSize);

  const shares = new Array(12).fill(0);
  let neutral = 0;
  const lums = [];
  const sats = [];
  const timeline = [];
  const worldsTimeline = [];

  for (let f = 0; f < frames; f++) {
    const base = f * frameSize;
    let rSum = 0, gSum = 0, bSum = 0;
    for (let i = 0; i < W * H; i++) {
      const o = base + i * 3;
      rSum += buf[o]; gSum += buf[o + 1]; bSum += buf[o + 2];
    }
    const hsv = rgbToHsv(rSum / (W * H), gSum / (W * H), bSum / (W * H));
    lums.push(hsv.v);
    sats.push(hsv.s);
    const w = classify(hsv);
    if (w < 0) neutral++;
    else shares[w]++;
    timeline.push(w < 0 ? 'n' : WORLDS[w][1]);
    worldsTimeline.push(w);
  }

  const total = frames || 1;
  const share = i => shares[i] / total;
  const ranked = shares.map((n, i) => ({ world: WORLDS[i][0], key: WORLDS[i][1], share: share(i) }))
    .sort((a, b) => b.share - a.share);
  const dominant = ranked[0];
  const neutralShare = neutral / total;
  const distinct = ranked.filter(x => x.share >= 0.08).length + (neutralShare >= 0.08 ? 1 : 0);
  const lumsSorted = lums.slice().sort((a, b) => a - b);
  const spread = pct(lumsSorted, 0.9) - pct(lumsSorted, 0.1);
  const satMedian = pct(sats.slice().sort((a, b) => a - b), 0.5);

  const findings = [];
  const add = (level, code, message) => findings.push({ level, code, message });
  if (Math.max(dominant.share, neutralShare) > 0.60) {
    const top = neutralShare > dominant.share ? { world: '中性（黑白灰）', share: neutralShare } : dominant;
    add('WARN', 'dominant', '主色域「' + top.world + '」占 ' + Math.round(top.share * 100) + '%，全片颜色单一');
  }
  if (distinct < 3) add('WARN', 'worlds', '只有 ' + distinct + ' 个色域（≥8% 占比），没有色彩脚本');
  if (spread < 0.10) add('WARN', 'luma', '明暗跨度 ' + spread.toFixed(2) + '，光也单一');
  if (satMedian < 0.10) add('WARN', 'saturation', '饱和度中位 ' + satMedian.toFixed(2) + '，整体发灰');

  const report = {
    video: path.relative(ROOT, video),
    generated: new Date().toISOString(),
    fps: opts.fps,
    frames,
    seconds: +(frames / opts.fps).toFixed(1),
    neutralShare: +neutralShare.toFixed(2),
    worlds: ranked.map(x => ({ world: x.world, share: +x.share.toFixed(2) })),
    distinct,
    dominant: { world: neutralShare > dominant.share ? '中性（黑白灰）' : dominant.world, share: +(Math.max(dominant.share, neutralShare)).toFixed(2) },
    lumaSpread: +spread.toFixed(2),
    satMedian: +satMedian.toFixed(2),
    timeline: timeline.join(''),
    findings
  };

  const out = path.resolve(process.cwd(), opts.json);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');

  if (!opts.quiet) {
    console.log('色彩体检 ' + path.relative(process.cwd(), video));
    console.log('  时长      ' + report.seconds + 's  @' + opts.fps + 'fps 采样');
    console.log('  主色域    ' + report.dominant.world + ' ' + Math.round(report.dominant.share * 100) + '%  · 色域数 ' + report.distinct);
    console.log('  色域表    ' + ranked.filter(x => x.share > 0.02).map(x => x.world + ' ' + Math.round(x.share * 100) + '%').join(' · ') + (neutralShare > 0.02 ? ' · 中性 ' + Math.round(neutralShare * 100) + '%' : ''));
    console.log('  明暗跨度  ' + report.lumaSpread + '（p90-p10）  饱和度中位 ' + report.satMedian);
    console.log('  时间轴    ' + report.timeline);
    findings.forEach(f => console.log('  ' + (f.level === 'ERROR' ? '✗' : '!') + ' ' + f.message));
    if (!findings.length) console.log('  ✓ 色域与明暗有层次');
    console.log('  报告      ' + opts.json);
  }

  if (findings.some(f => f.level === 'ERROR') || (opts.strict && findings.length)) process.exit(1);
}

if (require.main === module) {
  try { main(); } catch (err) { console.error('色彩体检失败: ' + err.message); process.exit(1); }
}

module.exports = { rgbToHsv, classify };