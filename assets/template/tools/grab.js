#!/usr/bin/env node
/**
 * 从成片里按秒抓单帧。一个时间戳一次 ffmpeg，避免多 -ss 输入时取到重复帧。
 *
 *   node tools/grab.js out/final.mp4 3.0 10.5 33.2 [--out qa/grab] [--max-width 1440]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const opts = { out: 'qa/grab', maxWidth: 1440, ffmpeg: null, quality: 2 };
const times = [];
let input = null;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-h' || a === '--help') {
    console.log(`用法: node tools/grab.js <video> <sec> [sec...] [--out qa/grab] [--max-width 1440] [--quality 2]\n\n  例：node tools/grab.js out/final.mp4 3.0 10.5 33.24`);
    process.exit(0);
  } else if (a === '--out') opts.out = args[++i];
  else if (a === '--max-width') opts.maxWidth = Number(args[++i]);
  else if (a === '--quality') opts.quality = Number(args[++i]);
  else if (a === '--ffmpeg') opts.ffmpeg = args[++i];
  else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else if (!input) input = a;
  else times.push(Number(a));
}

if (!input) throw new Error('缺少视频路径');
if (!times.length) throw new Error('至少给一个秒数');
if (times.some(n => !Number.isFinite(n) || n < 0)) throw new Error('秒数必须是 ≥0 的数字');

const root = path.resolve(__dirname, '..');
const video = path.resolve(process.cwd(), input);
if (!fs.existsSync(video)) throw new Error('找不到视频: ' + video);

function findFfmpeg() {
  if (opts.ffmpeg) return opts.ffmpeg;
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  try {
    const p = require(path.join(root, 'node_modules', '@ffmpeg-installer/ffmpeg')).path;
    if (fs.existsSync(p)) {
      try { fs.chmodSync(p, 0o755); } catch (e) {}
      return p;
    }
  } catch (e) {}
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (!r.error && r.status === 0) return 'ffmpeg';
  throw new Error('未找到 ffmpeg。运行 npm install，或用 --ffmpeg 指定');
}

const ffmpeg = findFfmpeg();
const outDir = path.resolve(process.cwd(), opts.out);
fs.mkdirSync(outDir, { recursive: true });

/* macOS 走 VideoToolbox、Windows 走 D3D11VA 解码；失败自动回退软件解码。 */
function hwDecodeArgs() {
  if (process.platform === 'darwin') return ['-hwaccel', 'videotoolbox'];
  if (process.platform === 'win32') return ['-hwaccel', 'd3d11va'];
  return [];
}

times.slice().sort((a, b) => a - b).forEach(t => {
  const file = path.join(outDir, 'grab_' + t.toFixed(2) + '.jpg');
  const grab = extra => spawnSync(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', t.toFixed(3),
    ...extra,
    '-i', video,
    '-frames:v', '1',
    '-q:v', String(opts.quality),
    file
  ], { encoding: 'utf8' });
  const hw = hwDecodeArgs();
  let r = grab(hw);
  if (r.status !== 0 && hw.length) r = grab([]);
  if (r.status !== 0 || !fs.existsSync(file) || fs.statSync(file).size < 512) {
    console.error('  ✗ ' + t.toFixed(2) + 's  ' + (r.stderr || '未生成文件').trim());
    return;
  }
  if (process.platform === 'darwin' && opts.maxWidth > 0) {
    spawnSync('sips', ['-Z', String(opts.maxWidth), file], { stdio: 'ignore' });
  }
  console.log('  ✓ ' + t.toFixed(2).padStart(6) + 's  ' + path.relative(process.cwd(), file));
});

console.log('\n抓帧完成：' + path.relative(process.cwd(), outDir) + '（' + times.length + ' 张）');
