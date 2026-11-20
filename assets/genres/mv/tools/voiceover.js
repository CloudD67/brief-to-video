#!/usr/bin/env node
/**
 * 旁白生成：按字幕时间轴逐句调用 macOS say，拼接成 assets/voiceover.wav。
 * 每句可单独调语速；生成 assets/voiceover.json 记录实测时长，便于核对。
 *
 *   node tools/voiceover.js [project-dir]
 *                          [--voice Tingting] [--rate 180] [--gain 1]
 *                          [--out assets/voiceover.wav] [--only 1,2,3]
 *                          [--list-voices] [--dry-run]
 *
 * 文本优先级：cue.narration > cue.text。字幕可以短，旁白可以更长。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let root = '.';
const opts = {
  voice: null, rate: 180, gain: 1, out: 'assets/voiceover.wav',
  only: null, listVoices: false, dryRun: false, json: null, quiet: false
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--voice') opts.voice = args[++i];
  else if (a === '--rate') opts.rate = Number(args[++i]);
  else if (a === '--gain') opts.gain = Number(args[++i]);
  else if (a === '--out') opts.out = args[++i];
  else if (a === '--json') opts.json = args[++i];
  else if (a === '--only') opts.only = args[++i].split(',').map(Number).filter(n => n > 0);
  else if (a === '--list-voices') opts.listVoices = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--quiet') opts.quiet = true;
  else if (a === '-h' || a === '--help') {
    console.log('用法: node tools/voiceover.js [project-dir] [--voice <name>] [--rate 180] [--gain 1] [--out assets/voiceover.wav] [--only 1,2] [--list-voices] [--dry-run]');
    process.exit(0);
  } else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else root = a;
}

root = path.resolve(root);
const CONFIG = require(path.join(root, 'js', 'config.js'));
const SCRIPT = require(path.join(root, 'js', 'script.js'));

function log(msg) { if (!opts.quiet) console.log(msg); }

function sayVoices() {
  const r = spawnSync('say', ['-v', '?'], { encoding: 'utf8' });
  if (r.error) throw new Error('无法执行 say：' + r.error.message +
    '\n旁白功能依赖 macOS 系统语音。Windows 上二选一：\n' +
    '  1) 跳过旁白：编码时加 --no-voice，其余流程不受影响\n' +
    '  2) 用任意 TTS 生成 assets/voiceover.wav（48kHz）后直接编码');
  const seen = new Set();
  return (r.stdout || '').split('\n').filter(Boolean).map(line => {
    const m = /^(.+?)\s{2,}([a-z]{2}_[A-Z]{2})/.exec(line);
    if (!m) return null;
    const name = m[1].replace(/\s*\([^)]*\)\s*$/, '').trim();
    const key = name + '/' + m[2];
    if (!name || seen.has(key)) return null;
    seen.add(key);
    return { name, locale: m[2] };
  }).filter(Boolean);
}

function pickVoice() {
  if (opts.voice) return opts.voice;
  const voices = sayVoices();
  const names = voices.map(v => v.name);
  const prefer = ['Tingting', 'Ting-Ting', 'Meijia', 'Mei-Jia'];
  for (const p of prefer) if (names.indexOf(p) !== -1) return p;
  const cn = voices.find(v => v.locale === 'zh_CN');
  if (cn) return cn.name;
  const zh = voices.find(v => /^zh_/.test(v.locale));
  if (zh) return zh.name;
  throw new Error('没有找到中文语音。用 --voice 指定，或 --list-voices 查看已安装语音。');
}

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
  throw new Error('未找到 ffmpeg（npm install 或设置 FFMPEG_PATH）');
}

function cjkLen(text) {
  return String(text).replace(/[\s\u3000，。、；：！？—…·「」『』（）()《》〈〉,.!?:;'"“”‘’-]/g, '').length;
}

function normalizeCues() {
  const cues = [];
  const subtitles = SCRIPT.subtitles || [];
  subtitles.forEach((c, i) => {
    let start, end;
    if (typeof c.scene === 'string') {
      const scene = (SCRIPT.sceneTimes || {})[c.scene];
      let s = scene;
      if (!s) {
        // 场景时间来自 js/scenes/*.js；这里用粗解码：读取 scene 文件里的 start/end
        s = sceneTimeFromFile(c.scene);
      }
      if (!s) throw new Error('字幕 ' + (i + 1) + ' 指向场景 ' + c.scene + '，但找不到场景时间');
      const at = Number(c.at);
      const dur = c.dur != null ? Number(c.dur) : Number(c.end) - at;
      start = s.start + at;
      end = Math.min(s.end, start + dur);
    } else {
      start = Number(c.start);
      end = Number(c.end);
    }
    const text = String(c.narration || c.text || '').trim();
    cues.push({ n: i + 1, start, end, text, subtitle: c.text || '' });
  });
  return cues.filter(c => c.text).sort((a, b) => a.start - b.start);
}

const sceneTimeCache = {};
function sceneTimeFromFile(id) {
  if (sceneTimeCache[id] !== undefined) return sceneTimeCache[id];
  const dir = path.join(root, 'js', 'scenes');
  let found = null;
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      const block = new RegExp("id:\\s*['\"]" + id + "['\"][\\s\\S]{0,300}?start:\\s*([\\d.]+)[\\s\\S]{0,120}?end:\\s*([\\d.]+)").exec(text);
      if (block) found = { start: Number(block[1]), end: Number(block[2]) };
    });
  }
  sceneTimeCache[id] = found;
  return found;
}

function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('不是 WAV：' + file);
  }
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    const start = off + 8;
    if (id === 'fmt ') {
      fmt = {
        format: b.readUInt16LE(start),
        channels: b.readUInt16LE(start + 2),
        sampleRate: b.readUInt32LE(start + 4),
        bits: b.readUInt16LE(start + 14)
      };
    } else if (id === 'data') {
      data = b.subarray(start, Math.min(start + size, b.length));
    }
    off = start + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('WAV 缺少 fmt/data：' + file);
  if (fmt.channels !== 1 || fmt.bits !== 16) throw new Error('旁白 WAV 需要单声道 16-bit：' + file);
  return {
    sampleRate: fmt.sampleRate,
    samples: new Int16Array(data.buffer, data.byteOffset, Math.floor(data.length / 2))
  };
}

function writeWav(file, sampleRate, samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

function transcode(ffmpeg, inFile, outFile) {
  const r = spawnSync(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', inFile,
    '-af', 'silenceremove=start_periods=1:start_silence=0.03:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_silence=0.03:start_threshold=-45dB,areverse',
    '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le',
    outFile
  ], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('转码失败 ' + path.basename(inFile) + '：' + (r.stderr || '').trim());
}

function main() {
  if (opts.listVoices) {
    const voices = sayVoices().filter(v => /^zh_/.test(v.locale));
    console.log('中文语音：');
    voices.forEach(v => console.log('  ' + v.name + '  (' + v.locale + ')'));
    return;
  }

  if (!(opts.rate >= 80 && opts.rate <= 400)) throw new Error('--rate 应在 80–400 之间');
  if (!(opts.gain > 0 && opts.gain <= 4)) throw new Error('--gain 应在 0–4 之间');

  const cues = normalizeCues();
  if (!cues.length) throw new Error('js/script.js 里没有可用字幕文本');

  const selected = opts.only ? cues.filter(c => opts.only.indexOf(c.n) !== -1) : cues;
  if (!selected.length) throw new Error('--only 没有匹配到字幕');

  const scale = (CONFIG.duration || 60) / 60;
  const totalSec = CONFIG.duration || 60;
  const voice = pickVoice();
  const outWav = path.resolve(root, opts.out);
  const tmpDir = path.join(root, 'assets', '.voice');
  fs.mkdirSync(tmpDir, { recursive: true });
  const ffmpeg = opts.dryRun ? null : findFfmpeg();

  log('voiceover · ' + CONFIG.title);
  log('  语音  ' + voice + ' · 语速 ' + opts.rate + ' wpm · 增益 ' + opts.gain);
  log('  字幕  ' + selected.length + '/' + cues.length + ' 句 · 片长 ' + totalSec + 's');
  log('');

  const sampleRate = 48000;
  const totalSamples = Math.ceil(totalSec * sampleRate);
  const mix = new Float64Array(totalSamples);
  const report = [];

  selected.forEach((cue, i) => {
    const startSec = cue.start * scale;
    const endSec = cue.end * scale;
    const aiff = path.join(tmpDir, 'cue-' + String(cue.n).padStart(2, '0') + '.aiff');
    const wav = path.join(tmpDir, 'cue-' + String(cue.n).padStart(2, '0') + '.wav');

    if (!opts.quiet) process.stdout.write('  ' + String(i + 1).padStart(2) + '/' + selected.length + '  ' + startSec.toFixed(2) + 's  ' + cue.text.slice(0, 24) + '…\n');
    if (opts.dryRun) {
      report.push({ n: cue.n, start: +startSec.toFixed(3), slot: +(endSec - startSec).toFixed(3), text: cue.text, chars: cjkLen(cue.text), voice, rate: opts.rate, dryRun: true });
      return;
    }

    const say = spawnSync('say', ['-v', voice, '-r', String(opts.rate), '-o', aiff, cue.text], { encoding: 'utf8' });
    if (say.status !== 0) throw new Error('say 失败（字幕 ' + cue.n + '）：' + (say.stderr || '').trim());
    transcode(ffmpeg, aiff, wav);
    const audio = readWav(wav);
    if (audio.sampleRate !== sampleRate) throw new Error('采样率不一致：' + audio.sampleRate);

    const offset = Math.round(startSec * sampleRate);
    const len = Math.min(audio.samples.length, totalSamples - offset);
    for (let k = 0; k < len; k++) mix[offset + k] += (audio.samples[k] / 32768) * opts.gain;

    const spoken = audio.samples.length / sampleRate;
    const slot = endSec - startSec;
    if (spoken > slot + 0.35) {
      log('    ! 比字幕长 ' + (spoken - slot).toFixed(2) + 's：缩短文本或把 --rate 提到 ' + Math.min(400, Math.round(opts.rate * spoken / slot)) + ' 以上');
    }
    report.push({
      n: cue.n, start: +startSec.toFixed(3), slot: +slot.toFixed(3), spoken: +spoken.toFixed(3),
      text: cue.text, chars: cjkLen(cue.text), voice, rate: opts.rate
    });
    fs.rmSync(aiff, { force: true });
  });

  if (opts.dryRun) {
    log('\n  dry-run：未生成音频。');
    return;
  }

  let peak = 0;
  for (let i = 0; i < mix.length; i++) peak = Math.max(peak, Math.abs(mix[i]));
  let normalized = false;
  if (peak > 0.98) {
    const norm = 0.95 / peak;
    for (let i = 0; i < mix.length; i++) mix[i] *= norm;
    log('  ! 峰值过高（' + (20 * Math.log10(peak)).toFixed(1) + ' dB），已自动衰减 ' + (20 * Math.log10(norm)).toFixed(1) + ' dB');
    peak = 0.95;
    normalized = true;
  }
  let clipped = 0;
  const pcm = new Int16Array(totalSamples);
  for (let i = 0; i < mix.length; i++) {
    const v = Math.max(-1, Math.min(1, mix[i]));
    if (Math.abs(mix[i]) > 1) clipped++;
    pcm[i] = Math.round(v * 32767);
  }
  writeWav(outWav, sampleRate, pcm);

  const jsonPath = path.resolve(root, opts.json || 'assets/voiceover.json');
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify({
    title: CONFIG.title, voice, rate: opts.rate, gain: opts.gain, normalized,
    duration: totalSec, generated: new Date().toISOString(), cues: report
  }, null, 2) + '\n');

  log('');
  log('  输出  ' + path.relative(root, outWav) + '  ' + (fs.statSync(outWav).size / 1024 / 1024).toFixed(1) + ' MB');
  log('  清单  ' + path.relative(root, jsonPath));
  log('  峰值  ' + (20 * Math.log10(Math.max(peak, 0.0001))).toFixed(1) + ' dB' + (clipped ? '（' + clipped + ' 个采样削波）' : ''));
  log('\n下一步：node encode.js（自动混入旁白并对音乐做闪避）');
}

try {
  main();
} catch (e) {
  console.error('voiceover 失败：' + e.message);
  process.exit(1);
}
