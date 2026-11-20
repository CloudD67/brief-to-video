#!/usr/bin/env node
/**
 * 素材准备：扫描 assets/media/，把图片接到场景，把视频抽成帧序列。
 *
 * 命名约定：<场景id>-<说明>.<ext>，例如 s1-alley.jpg、s4-keyframe.mp4。
 * 产物：js/media.generated.js（window.FILM_MEDIA），渲染时自动替换内置插画。
 *
 *   node tools/prep-media.js .                # 扫描 + 抽帧 + 写清单
 *   node tools/prep-media.js . --dry-run      # 只看计划
 *   node tools/prep-media.js . --scene s1     # 目录里所有素材都归 s1
 *   node tools/prep-media.js . --fps 2 --max-frames 12 --width 1920
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

const args = process.argv.slice(2);
let root = '.';
const opts = {
  src: 'assets/media', out: 'js/media.generated.js', scene: null,
  fps: 1, maxFrames: 8, width: 1600, dryRun: false, quiet: false
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--src') opts.src = args[++i];
  else if (a === '--out') opts.out = args[++i];
  else if (a === '--scene') opts.scene = args[++i];
  else if (a === '--fps') opts.fps = Number(args[++i]);
  else if (a === '--max-frames') opts.maxFrames = Number(args[++i]);
  else if (a === '--width') opts.width = Number(args[++i]);
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--quiet') opts.quiet = true;
  else if (a === '-h' || a === '--help') {
    console.log('用法: node tools/prep-media.js [project-dir] [--src assets/media] [--out js/media.generated.js] [--scene s1] [--fps 1] [--max-frames 8] [--width 1600] [--dry-run]');
    process.exit(0);
  } else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else root = a;
}

root = path.resolve(root);
const srcDir = path.resolve(root, opts.src);
const outFile = path.resolve(root, opts.out);

function log(msg) { if (!opts.quiet) console.log(msg); }

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const tries = [
    path.join(root, 'node_modules', '@ffmpeg-installer', 'ffmpeg'),
    path.join(root, 'node_modules', 'ffmpeg-static')
  ];
  for (const t of tries) {
    try {
      const p = require(t).path || require(t);
      if (p && fs.existsSync(p)) return p;
    } catch (e) { /* continue */ }
  }
  const which = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (!which.error && which.status === 0) return 'ffmpeg';
  throw new Error('处理视频需要 ffmpeg（npm install 或设置 FFMPEG_PATH）');
}

function rel(p) {
  return path.relative(root, p).split(path.sep).join('/');
}

function sceneKey(file) {
  if (opts.scene) return opts.scene;
  const name = path.basename(file);
  const m = /^(s\d+|scene[-_]?(\d+)|(\d+))[-_.]/i.exec(name);
  if (!m) return null;
  if (/^s\d+$/i.test(m[1])) return 's' + Number(m[1].slice(1));
  const n = m[2] || m[3];
  return n ? 's' + Number(n) : null;
}

/* 抽帧解码：macOS 走 VideoToolbox，Windows 走 D3D11VA；帧自动回读到内存，
   不影响后面的 fps/scale 滤镜。硬件解码不可用时自动退回软件解码。 */
function hwDecodeArgs() {
  if (process.platform === 'darwin') return ['-hwaccel', 'videotoolbox'];
  if (process.platform === 'win32') return ['-hwaccel', 'd3d11va'];
  return [];
}

function extractVideo(ffmpeg, file, key) {
  const base = path.basename(file, path.extname(file));
  const dir = path.join(srcDir, 'frames', base);
  if (!opts.dryRun) fs.mkdirSync(dir, { recursive: true });
  const pattern = path.join(dir, 'frame_%03d.jpg');
  const vf = 'fps=' + opts.fps + ",scale='min(" + opts.width + ",iw)':-2";
  log('    抽帧  ' + rel(file) + '  → ' + rel(dir) + '/  @' + opts.fps + 'fps  最多 ' + opts.maxFrames + ' 帧');
  if (opts.dryRun) return [];
  const runOnce = extra => spawnSync(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...extra,
    '-i', file,
    '-vf', vf,
    '-frames:v', String(opts.maxFrames),
    '-q:v', '3',
    pattern
  ], { encoding: 'utf8' });
  const hw = hwDecodeArgs();
  let r = runOnce(hw);
  if (r.status !== 0 && hw.length) {
    log('    ! 硬件解码失败，改用软件解码：' + rel(file));
    r = runOnce([]);
  }
  if (r.status !== 0) throw new Error('抽帧失败 ' + rel(file) + '：' + (r.stderr || '').trim());
  const frames = fs.readdirSync(dir)
    .filter(f => /^frame_\d+\.jpg$/.test(f))
    .sort()
    .map(f => rel(path.join(dir, f)));
  if (!frames.length) throw new Error('视频没有抽出帧：' + rel(file));
  return frames;
}

function main() {
  if (!(opts.fps > 0 && opts.fps <= 30)) throw new Error('--fps 应在 0–30 之间');
  if (!(opts.maxFrames >= 1 && opts.maxFrames <= 120)) throw new Error('--max-frames 应在 1–120 之间');
  if (!(opts.width >= 320 && opts.width <= 4096)) throw new Error('--width 应在 320–4096 之间');

  if (!fs.existsSync(srcDir)) {
    throw new Error('素材目录不存在：' + rel(srcDir) + '\n先建目录并放入 <场景id>-<说明>.jpg 或 .mp4。');
  }

  const files = fs.readdirSync(srcDir, { withFileTypes: true })
    .filter(d => d.isFile() && !d.name.startsWith('.'))
    .map(d => path.join(srcDir, d.name))
    .filter(f => IMAGE_EXT.test(f) || VIDEO_EXT.test(f))
    .sort();

  if (!files.length) throw new Error('素材目录里没有图片或视频：' + rel(srcDir));

  let ffmpeg = null;
  const map = {};
  let images = 0;
  let videos = 0;

  log('');
  log('  prep-media · ' + path.basename(root));
  log('  ─────────────────────────────────');
  log('  素材    ' + rel(srcDir) + '  ' + files.length + ' 个文件');

  files.forEach(file => {
    const key = sceneKey(file);
    if (!key) {
      log('    ! 跳过（文件名要以 s1-/s4- 开头）：' + rel(file));
      return;
    }
    map[key] = map[key] || [];
    if (IMAGE_EXT.test(file)) {
      log('    图片  ' + rel(file) + '  → ' + key);
      map[key].push(rel(file));
      images++;
    } else {
      if (!ffmpeg) ffmpeg = findFfmpeg();
      const frames = extractVideo(ffmpeg, file, key);
      if (opts.dryRun) {
        map[key].push(rel(path.join(srcDir, 'frames', path.basename(file, path.extname(file)), 'frame_001.jpg')));
      } else {
        map[key] = map[key].concat(frames);
      }
      videos++;
    }
  });

  const keys = Object.keys(map).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  if (!keys.length) throw new Error('没有可用的素材：文件名需要以场景 id 开头，例如 s1-alley.jpg');

  const js = '/* 由 tools/prep-media.js 生成 · ' + new Date().toISOString() + ' */\n' +
    'window.FILM_MEDIA = ' + JSON.stringify(map, null, 2) + ';\n';

  if (opts.dryRun) {
    log('\n  dry-run：未抽帧、未写清单。\n');
    return;
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, js);

  log('');
  log('  场景    ' + keys.map(k => k + '×' + map[k].length).join('  '));
  log('  输出    ' + rel(outFile) + '  （' + images + ' 张图片 · ' + videos + ' 个视频）');
  log('\n下一步：npm run check && npm run render');
  log('');
}

try {
  main();
} catch (e) {
  console.error('prep-media 失败：' + e.message);
  process.exit(1);
}
