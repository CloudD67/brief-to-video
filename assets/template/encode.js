#!/usr/bin/env node
/**
 * 合成：frames/*.png → out/video.mp4
 * 若存在 assets/music.wav，则混入背景音乐输出 out/final.mp4；否则 final.mp4 为无声版。
 *
 *   node encode.js
 *   node encode.js --proxy            # 额外输出 1080p 代理
 *   node encode.js --music assets/music.wav --crf 20 --preset slow
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = __dirname;
const CONFIG = require('./js/config.js');

const DEFAULTS = {
  fps: CONFIG.fps || 30,
  crf: 18,
  preset: 'medium',
  hw: 'auto',
  hwQuality: 65,
  frames: 'frames',
  out: 'out',
  music: 'assets/music.wav',
  voice: 'assets/voiceover.wav',
  muted: false,
  proxy: false,
  quiet: false,
  duck: true,
  noVoice: false,
  musicGain: 0.55,
  musicGainExplicit: false,
  voiceGain: 1
};

function usage() {
  console.log(`${CONFIG.title} · 视频合成

用法: node encode.js [options]

  --fps <n>        输入帧率（默认 ${CONFIG.fps}，需与 render.js 一致）
  --crf <n>        x264 质量，越小越清晰（默认 18）
  --preset <name>  x264 预设 ultrafast…veryslow（默认 medium）
  --frames <dir>   帧目录（默认 frames/）
  --out <dir>      输出目录（默认 out/）
  --music <file>   背景音乐路径（默认 assets/music.wav，不存在则输出无声版）
  --music-gain <g> 音乐增益系数（默认有旁白 0.40 / 无旁白 0.55）
  --voice <file>   旁白音轨（默认 assets/voiceover.wav，存在则自动启用）
  --voice-gain <g> 旁白增益系数（默认 1.00）
  --no-voice       忽略旁白，只混背景音乐
  --no-duck        关闭侧链闪避（默认旁白出现时自动压低音乐）
  --muted          忽略音乐与旁白，强制无声
  --hw <mode>      编码器 auto|off|h264|hevc（默认 auto：macOS 用 VideoToolbox，Windows 用 NVENC/QSV/AMF）
  --hw-quality <n> 硬件编码质量 1–100（默认 65，越高越清晰；macOS 映射 -q:v，Windows 映射 cq）
  --proxy          额外输出 1080p 代理 out/final_1080p.mp4
  --quiet          减少输出
  -h, --help       显示帮助
`);
}

function parseArgs(argv) {
  const opts = Object.assign({}, DEFAULTS);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error('缺少参数值: ' + a);
      return v;
    };
    switch (a) {
      case '-h':
      case '--help':
        usage();
        process.exit(0);
        break;
      case '--fps': opts.fps = Number(next()); break;
      case '--crf': opts.crf = Number(next()); break;
      case '--preset': opts.preset = String(next()); break;
      case '--frames': opts.frames = next(); break;
      case '--out': opts.out = next(); break;
      case '--music': opts.music = next(); break;
      case '--music-gain': opts.musicGain = Number(next()); opts.musicGainExplicit = true; break;
      case '--voice': opts.voice = next(); break;
      case '--voice-gain': opts.voiceGain = Number(next()); break;
      case '--no-voice': opts.noVoice = true; break;
      case '--no-duck': opts.duck = false; break;
      case '--muted': opts.muted = true; break;
      case '--hw': opts.hw = String(next()).toLowerCase(); break;
      case '--hw-quality': opts.hwQuality = Number(next()); break;
      case '--proxy': opts.proxy = true; break;
      case '--quiet': opts.quiet = true; break;
      default: throw new Error('未知参数: ' + a + '\n使用 --help 查看用法');
    }
  }
  if (!(opts.fps > 0)) throw new Error('--fps 必须大于 0');
  if (!(opts.crf >= 0 && opts.crf <= 51)) throw new Error('--crf 必须在 0-51 之间');
  if (['auto', 'off', 'h264', 'hevc'].indexOf(opts.hw) === -1) throw new Error('--hw 只能是 auto / off / h264 / hevc');
  if (!(opts.hwQuality >= 1 && opts.hwQuality <= 100)) throw new Error('--hw-quality 必须在 1-100 之间');
  if (!(opts.musicGain > 0 && opts.musicGain <= 4)) throw new Error('--music-gain 必须在 0-4 之间');
  if (!(opts.voiceGain > 0 && opts.voiceGain <= 4)) throw new Error('--voice-gain 必须在 0-4 之间');
  opts.framesDir = path.resolve(ROOT, opts.frames);
  opts.outDir = path.resolve(ROOT, opts.out);
  opts.musicPath = path.resolve(ROOT, opts.music);
  opts.voicePath = path.resolve(ROOT, opts.voice);
  opts.voiceJsonPath = opts.voicePath.replace(/\.wav$/i, '.json');
  opts.videoFile = path.join(opts.outDir, 'video.mp4');
  opts.finalFile = path.join(opts.outDir, 'final.mp4');
  opts.proxyFile = path.join(opts.outDir, 'final_1080p.mp4');
  return opts;
}

function log(opts, msg) {
  if (!opts.quiet) process.stdout.write(msg + '\n');
}

function findFfmpeg() {
  const tried = [];
  if (process.env.FFMPEG_PATH) {
    const p = process.env.FFMPEG_PATH;
    tried.push(p);
    if (fs.existsSync(p)) return p;
  }
  try {
    const p = require('@ffmpeg-installer/ffmpeg').path;
    tried.push(p);
    if (fs.existsSync(p)) {
      try { fs.chmodSync(p, 0o755); } catch (e) { /* ignore */ }
      return p;
    }
  } catch (e) { /* not installed */ }
  try {
    const p = require('ffmpeg-static');
    tried.push(p);
    if (p && fs.existsSync(p)) {
      try { fs.chmodSync(p, 0o755); } catch (e) { /* ignore */ }
      return p;
    }
  } catch (e) { /* not installed */ }
  const which = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (!which.error && which.status === 0) return 'ffmpeg';
  throw new Error(
    '未找到 ffmpeg。已尝试：\n  ' + tried.join('\n  ') + '\n  系统 PATH 中的 ffmpeg\n' +
    '请运行 npm install，或设置 FFMPEG_PATH 指向 ffmpeg 可执行文件。'
  );
}

function ffmpegVersion(ffmpeg) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return 'unknown';
  return (r.stdout || '').split('\n')[0].trim();
}

function listEncoders(ffmpeg) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  const text = (r.stdout || '') + '\n' + (r.stderr || '');
  const set = new Set();
  text.split('\n').forEach(line => {
    const m = line.match(/^\s*[VAS][.A-Z]{5}\s+(\S+)/);
    if (m) set.add(m[1]);
  });
  return set;
}

/* Windows 的 ffmpeg 几乎总把 NVENC/QSV/AMF 全列出来，机器上却未必有对应硬件，
   所以先跑一帧试编码确认真的能用，再决定用谁。 */
function encoderWorks(ffmpeg, args) {
  const r = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'color=c=black:s=256x144:d=0.1',
    '-frames:v', '1', ...args, '-f', 'null', '-'
  ], { encoding: 'utf8' });
  return r.status === 0;
}

function softwareEncoder(opts) {
  return {
    mode: 'libx264',
    label: 'libx264  crf ' + opts.crf + '  preset ' + opts.preset,
    args: ['-c:v', 'libx264', '-preset', opts.preset, '-crf', String(opts.crf)],
    loglevel: 'warning'
  };
}

/* macOS：VideoToolbox。--hw-quality 映射 -q:v（1-100，越高越清晰，65 约等于 x264 crf18） */
function darwinEncoder(ffmpeg, opts, available) {
  const want = opts.hw === 'hevc' ? 'hevc_videotoolbox' : 'h264_videotoolbox';
  if (!available.has(want)) {
    if (opts.hw === 'auto') return null;
    throw new Error('当前 ffmpeg 没有 ' + want + '，用 --hw off 或换一份带 VideoToolbox 的 ffmpeg');
  }
  const enc = {
    mode: want,
    label: want + '  q ' + opts.hwQuality + '  (macOS VideoToolbox)',
    args: ['-c:v', want, '-allow_sw', '1', '-realtime', '0', '-q:v', String(opts.hwQuality)],
    loglevel: 'error'
  };
  if (want === 'hevc_videotoolbox') enc.args.push('-tag:v', 'hvc1');
  return enc;
}

/* Windows：NVENC -> QSV -> AMF，逐个一帧试编码，全不可用返回 null */
function windowsEncoder(ffmpeg, opts, available) {
  const codec = opts.hw === 'hevc' ? 'hevc' : 'h264';
  const cq = Math.max(16, Math.min(32, Math.round(30 - opts.hwQuality * 0.1)));
  const candidates = [
    [codec + '_nvenc', ['-c:v', codec + '_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', String(cq), '-b:v', '0'], 'NVENC'],
    [codec + '_qsv', ['-c:v', codec + '_qsv', '-global_quality', String(cq)], 'QSV'],
    [codec + '_amf', ['-c:v', codec + '_amf', '-rc', 'cqp', '-qp_i', String(cq), '-qp_p', String(cq)], 'AMF']
  ];
  for (const [name, args, vendor] of candidates) {
    if (!available.has(name)) continue;
    if (!encoderWorks(ffmpeg, args)) continue;
    return {
      mode: name,
      label: name + '  cq ' + cq + '  (' + vendor + ')',
      args,
      loglevel: 'error'
    };
  }
  return null;
}

/* 平台分派：darwin / win32 各走各的硬件实现，其他平台只用 libx264。
   --hw h264|hevc 是显式要求，本平台不可用时直接报错；auto 则静默回退。 */
function pickEncoder(ffmpeg, opts) {
  if (opts.hw === 'off') return softwareEncoder(opts);
  const available = listEncoders(ffmpeg);
  if (process.platform === 'darwin') {
    const hw = darwinEncoder(ffmpeg, opts, available);
    if (hw) return hw;
    const sw = softwareEncoder(opts);
    sw.note = 'VideoToolbox 不可用，回退 libx264';
    return sw;
  }
  if (process.platform === 'win32') {
    const hw = windowsEncoder(ffmpeg, opts, available);
    if (hw) return hw;
    if (opts.hw === 'auto') {
      const sw = softwareEncoder(opts);
      sw.note = '没有可用的 NVENC / QSV / AMF 硬件编码器，回退 libx264';
      return sw;
    }
    throw new Error('这台机器的 ffmpeg 用不了 ' + opts.hw + ' 硬件编码（试过 NVENC / QSV / AMF）。\n' +
      '检查显卡驱动，或用 --hw off 走 libx264');
  }
  if (opts.hw !== 'auto') {
    throw new Error('--hw ' + opts.hw + ' 只支持 macOS（VideoToolbox）与 Windows（NVENC/QSV/AMF）；其他平台用 --hw off 或 --hw auto');
  }
  const sw = softwareEncoder(opts);
  sw.note = '当前平台没有硬件编码路径，回退 libx264';
  return sw;
}

/* 代理：macOS 固定 h264_videotoolbox（兼容性最好），Windows 沿用主编码器的硬件参数，
   软件编码才回退 x264 crf20。 */
function proxyEncoder(mainEncoder, opts) {
  if (mainEncoder.mode.indexOf('videotoolbox') !== -1) {
    return {
      args: ['-c:v', 'h264_videotoolbox', '-allow_sw', '1', '-realtime', '0', '-q:v', '70'],
      loglevel: 'error'
    };
  }
  if (mainEncoder.mode === 'libx264') {
    return {
      args: ['-c:v', 'libx264', '-preset', opts.preset, '-crf', '20'],
      loglevel: 'warning'
    };
  }
  return { args: mainEncoder.args.slice(), loglevel: 'error' };
}

function detectFrames(opts) {
  if (!fs.existsSync(opts.framesDir)) {
    throw new Error('帧目录不存在: ' + path.relative(ROOT, opts.framesDir) + '\n请先运行 npm run render');
  }
  const files = fs.readdirSync(opts.framesDir);
  /* 按数字排序：超过 9999 帧后 frame_10000.png 会排在 frame_9999.png 之前，
     字典序会把 0-9999 误判成“最后一帧”。 */
  const byNum = (a, b) => parseInt(a.match(/_(\d+)\./)[1], 10) - parseInt(b.match(/_(\d+)\./)[1], 10);
  const png = files.filter(f => /^frame_\d+\.png$/.test(f)).sort(byNum);
  const jpg = files.filter(f => /^frame_\d+\.jpg$/.test(f)).sort(byNum);
  const list = png.length >= jpg.length ? png : jpg;
  if (list.length === 0) {
    throw new Error('帧目录中没有 frame_0000.png / frame_0000.jpg：' + path.relative(ROOT, opts.framesDir));
  }
  const ext = list[0].endsWith('.png') ? 'png' : 'jpg';
  const nums = list.map(f => parseInt(f.match(/(\d+)\./)[1], 10));
  const first = nums[0];
  const last = nums[nums.length - 1];
  const padding = list[0].match(/_(\d+)\./)[1].length;
  const expected = last - first + 1;
  if (list.length !== expected) {
    const missing = [];
    const have = new Set(nums);
    for (let n = first; n <= last && missing.length < 8; n++) if (!have.has(n)) missing.push(n);
    throw new Error(`帧不连续：${first}-${last} 应有 ${expected} 帧，实际 ${list.length} 帧。缺少 ${missing.join(', ')}${missing.length >= 8 ? ' …' : ''}\n用 npm run render -- --resume 补齐缺失帧。`);
  }
  if (list.length < 2) throw new Error('至少需要 2 帧才能合成视频');
  return { first, last, count: list.length, ext, padding };
}

function analyzeLoudness(ffmpeg, file) {
  const r = spawnSync(ffmpeg, [
    '-hide_banner', '-nostats',
    '-i', file,
    '-map', '0:a:0',
    '-af', 'volumedetect',
    '-f', 'null', '-'
  ], { encoding: 'utf8' });
  const text = (r.stderr || '') + '\n' + (r.stdout || '');
  const mean = /mean_volume:\s*(-?[\d.]+)\s*dB/.exec(text);
  const max = /max_volume:\s*(-?[\d.]+)\s*dB/.exec(text);
  return mean && max ? { mean: Number(mean[1]), max: Number(max[1]) } : null;
}

function run(ffmpeg, args, label) {
  return new Promise((resolve, reject) => {
    process.stdout.write('\n  ' + label + '\n');
    const child = spawn(ffmpeg, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(label + ' 失败（ffmpeg 退出码 ' + code + '）'));
    });
  });
}

function humanSize(bytes) {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const ffmpeg = findFfmpeg();
  const info = detectFrames(opts);
  const encoder = pickEncoder(ffmpeg, opts);
  fs.mkdirSync(opts.outDir, { recursive: true });

  const hasMusicFile = fs.existsSync(opts.musicPath);
  const hasVoiceFile = fs.existsSync(opts.voicePath) && fs.statSync(opts.voicePath).size > 1024;
  const hasMusic = !opts.muted && hasMusicFile;
  const hasVoice = !opts.muted && !opts.noVoice && hasVoiceFile;
  const musicGain = opts.musicGainExplicit ? opts.musicGain : (hasVoice ? 0.4 : opts.musicGain);
  let voiceMeta = null;
  if (hasVoice && fs.existsSync(opts.voiceJsonPath)) {
    try { voiceMeta = JSON.parse(fs.readFileSync(opts.voiceJsonPath, 'utf8')); } catch (e) { /* sidecar optional */ }
  }
  const voiceCount = voiceMeta && Array.isArray(voiceMeta.cues) ? voiceMeta.cues.length : null;
  const seconds = info.count / opts.fps;

  log(opts, '');
  log(opts, '  ' + CONFIG.title + ' · 视频合成');
  log(opts, '  ─────────────────────────────────');
  log(opts, '  FFmpeg    ' + ffmpegVersion(ffmpeg));
  log(opts, `  帧        ${info.count} 帧  ${info.ext.toUpperCase()}  (${info.first}-${info.last})`);
  log(opts, `  时长      ${seconds.toFixed(2)}s  @${opts.fps}fps`);
  log(opts, `  编码      ${encoder.label}${encoder.note ? '  · ' + encoder.note : ''}`);
  log(opts, `  旁白      ${hasVoice ? path.relative(ROOT, opts.voicePath) + (voiceCount ? ` · ${voiceCount} 句` : '') : (opts.muted ? '已跳过（--muted）' : opts.noVoice ? '已跳过（--no-voice）' : '无（先运行 npm run voice）')}`);
  log(opts, `  音乐      ${hasMusic ? path.relative(ROOT, opts.musicPath) + ` · 增益 ${musicGain}${hasVoice && opts.duck ? ' · 侧链闪避' : ''}` : '无（导出无声版）'}`);
  log(opts, '');

  if (seconds > CONFIG.duration + 0.5) {
    log(opts, `  注意：帧数对应 ${seconds.toFixed(1)}s，超过配置的 ${CONFIG.duration}s，成片会略长于预期。`);
  }

  const inputPattern = 'frame_%0' + info.padding + 'd.' + info.ext;
  const videoArgs = [
    '-y', '-hide_banner', '-loglevel', encoder.loglevel, '-stats',
    '-framerate', String(opts.fps),
    '-start_number', String(info.first),
    '-i', path.join(opts.framesDir, inputPattern),
    ...encoder.args,
    '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709',
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    '-movflags', '+faststart',
    '-an',
    opts.videoFile
  ];
  await run(ffmpeg, videoArgs, '① 编码视频轨 → ' + path.relative(ROOT, opts.videoFile));

  if (hasMusic || hasVoice) {
    const fade = Math.min(2, seconds / 4);
    const trim = 'atrim=0:' + seconds.toFixed(3) + ',asetpts=PTS-STARTPTS';
    const muxInputs = ['-i', opts.videoFile];
    let audioFilter = '';
    let stepLabel = '';

    if (hasMusic && hasVoice) {
      muxInputs.push('-stream_loop', '-1', '-i', opts.musicPath, '-i', opts.voicePath);
      const musicChain = [
        '[1:a]volume=' + musicGain,
        trim,
        'afade=t=in:st=0:d=' + fade.toFixed(2),
        'afade=t=out:st=' + Math.max(0, seconds - fade).toFixed(2) + ':d=' + fade.toFixed(2),
        'aresample=48000,aformat=channel_layouts=stereo[music]'
      ].join(',');
      const voiceChain = [
        '[2:a]volume=' + opts.voiceGain,
        trim,
        'aresample=48000,aformat=channel_layouts=stereo',
        opts.duck ? 'asplit=2[voice][sc]' : '[voice]'
      ].join(',');
      const mix = opts.duck
        ? '[music][sc]sidechaincompress=threshold=0.05:ratio=6:attack=25:release=400[ducked];' +
          '[ducked][voice]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]'
        : '[music][voice]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]';
      audioFilter = musicChain + ';' + voiceChain + ';' + mix;
      stepLabel = '② 混入旁白与背景音乐' + (opts.duck ? '（侧链闪避）' : '');
    } else if (hasVoice) {
      muxInputs.push('-i', opts.voicePath);
      audioFilter = ['[1:a]volume=' + opts.voiceGain, trim, 'aresample=48000,aformat=channel_layouts=stereo[a]'].join(',');
      stepLabel = '② 混入旁白';
    } else {
      muxInputs.push('-stream_loop', '-1', '-i', opts.musicPath);
      audioFilter = [
        '[1:a]volume=' + musicGain,
        trim,
        'afade=t=in:st=0:d=' + fade.toFixed(2),
        'afade=t=out:st=' + Math.max(0, seconds - fade).toFixed(2) + ':d=' + fade.toFixed(2),
        'aresample=48000[a]'
      ].join(',');
      stepLabel = '② 混入背景音乐';
    }

    const muxArgs = [
      '-y', '-hide_banner', '-loglevel', 'warning', '-stats',
      ...muxInputs,
      '-filter_complex', audioFilter,
      '-map', '0:v:0',
      '-map', '[a]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-shortest',
      '-movflags', '+faststart',
      opts.finalFile
    ];
    await run(ffmpeg, muxArgs, stepLabel + ' → ' + path.relative(ROOT, opts.finalFile));
  } else {
    fs.copyFileSync(opts.videoFile, opts.finalFile);
    log(opts, '  ② 无音轨，输出无声版 → ' + path.relative(ROOT, opts.finalFile));
  }

  if (opts.proxy) {
    const proxyScale = CONFIG.width >= CONFIG.height ? 'scale=1920:-2' : 'scale=-2:1920';
    const proxy = proxyEncoder(encoder, opts);
    const proxyArgs = [
      '-y', '-hide_banner', '-loglevel', proxy.loglevel, '-stats',
      '-i', opts.finalFile,
      '-vf', proxyScale + ':flags=lanczos',
      ...proxy.args,
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      opts.proxyFile
    ];
    await run(ffmpeg, proxyArgs, '③ 生成 1080p 代理 → ' + path.relative(ROOT, opts.proxyFile));
  }

  const finalSize = fs.statSync(opts.finalFile).size;
  const videoSize = fs.statSync(opts.videoFile).size;
  const loud = hasMusic ? analyzeLoudness(ffmpeg, opts.finalFile) : null;

  log(opts, '');
  log(opts, '  ─────────────────────────────────');
  log(opts, `  成片      ${path.relative(ROOT, opts.finalFile)}  ${humanSize(finalSize)}`);
  log(opts, `  视频轨    ${path.relative(ROOT, opts.videoFile)}  ${humanSize(videoSize)}`);
  log(opts, `  音轨      ${[
    hasVoice ? `旁白（增益 ${opts.voiceGain}${voiceCount ? `，${voiceCount} 句` : ''}）` : null,
    hasMusic ? `背景音乐（增益 ${musicGain}${hasVoice && opts.duck ? '，侧链闪避' : '，2s 淡入淡出'}）` : null
  ].filter(Boolean).join(' + ') || '无'}`);
  if (loud) {
    log(opts, `  响度      mean ${loud.mean.toFixed(1)} dB · max ${loud.max.toFixed(1)} dB`);
    if (loud.max > -0.3) log(opts, '  ! 峰值贴 0dB，可能削波：把 --music-gain 降一档');
    if (loud.mean < -30) log(opts, '  ! 平均响度偏低：把 --music-gain 提到 0.6–0.8');
    if (loud.mean > -12) log(opts, '  ! 音乐偏响，有解说时容易盖住人声：降到 0.4–0.5');
  }
  if (opts.proxy) {
    log(opts, `  1080p     ${path.relative(ROOT, opts.proxyFile)}  ${humanSize(fs.statSync(opts.proxyFile).size)}`);
  }
  log(opts, '  下一步    交付前跑 npm run repair（新鲜度 / 容器 / 抽帧 / 探针 / 运动 / 色彩）');
  log(opts, '');
}

main().catch(err => {
  process.stderr.write('\n合成失败：' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
