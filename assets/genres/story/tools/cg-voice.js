#!/usr/bin/env node
/**
 * CG 长片配音：按 cg/voice.json 的绝对时间轴逐句调用 macOS say。
 *
 *   node tools/cg-voice.js [project-dir]
 *        [--voice Tingting] [--rate 180] [--gain 1]
 *        [--only 1,2,3] [--list-voices] [--dry-run] [--quiet] [--no-subs]
 *
 * 产物：
 *   assets/voice/line-XX.wav     每句一条单声道 48k WAV（Blender 端用它做口型包络）
 *   assets/voice/lines.json      实测时长与文件清单
 *   assets/voiceover.wav         按成片秒数混好的整轨（encode.js 自动识别）
 *   assets/voiceover.json        整轨清单（含句数与实测时长）
 *   assets/subs.ass / subs.srt   烧字幕用（encode.js --subs）
 *
 * 文本与时间轴都来自工程里的 cg/voice.json；镜头归属由 cg_film.py 校验。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let root = '.';
const opts = {
  voice: null, rate: null, gain: 1, only: null,
  listVoices: false, dryRun: false, quiet: false, subs: true
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--voice') opts.voice = args[++i];
  else if (a === '--rate') opts.rate = Number(args[++i]);
  else if (a === '--gain') opts.gain = Number(args[++i]);
  else if (a === '--only') opts.only = args[++i].split(',').map(Number).filter(n => n > 0);
  else if (a === '--list-voices') opts.listVoices = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--quiet') opts.quiet = true;
  else if (a === '--no-subs') opts.subs = false;
  else if (a === '-h' || a === '--help') {
    console.log('用法: node tools/cg-voice.js [project-dir] [--voice <name>] [--rate 180] [--gain 1] [--only 1,2] [--list-voices] [--dry-run] [--no-subs]');
    process.exit(0);
  } else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else root = a;
}

root = path.resolve(root);
const CONFIG = require(path.join(root, 'js', 'config.js'));
const voicePath = path.join(root, 'cg', 'voice.json');
const SCRIPT = fs.existsSync(voicePath) ? JSON.parse(fs.readFileSync(voicePath, 'utf8')) : { voices: {}, lines: [] };

function log(msg) { if (!opts.quiet) console.log(msg); }

function sayVoices() {
  const r = spawnSync('say', ['-v', '?'], { encoding: 'utf8' });
  if (r.error) throw new Error('无法执行 say：' + r.error.message +
    '\nCG 配音依赖 macOS 系统语音。Windows 上二选一：\n' +
    '  1) 跳过配音：编码时加 --no-voice，字幕不受影响\n' +
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
  for (const p of ['Tingting', 'Ting-Ting', 'Meijia', 'Mei-Jia']) {
    if (names.indexOf(p) !== -1) return p;
  }
  const cn = voices.find(v => v.locale === 'zh_CN') || voices.find(v => /^zh_/.test(v.locale));
  if (cn) return cn.name;
  throw new Error('没有找到中文语音。用 --voice 指定，或 --list-voices 查看已安装语音。');
}

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  for (const t of ['@ffmpeg-installer/ffmpeg', 'ffmpeg-static']) {
    try {
      const p = require(path.join(root, 'node_modules', t)).path;
      if (p && fs.existsSync(p)) return p;
    } catch (e) { /* continue */ }
  }
  const which = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (!which.error && which.status === 0) return 'ffmpeg';
  throw new Error('未找到 ffmpeg（npm install 或设置 FFMPEG_PATH）');
}

function stripVoiceName(v) {
  /* 新版 macOS 的语音名带语言后缀，如 "Flo (中文（中国大陆）)"；
     去掉后缀会落到英语 Flo，必须整名传给 say -v。 */
  return String(v || '').trim();
}

function cjkLen(text) {
  return String(text).replace(/[\s\u3000，。、；：！？—…·「」『』（）()《》〈〉,.!?:;'"“”‘’-]/g, '').length;
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

function transcode(ffmpeg, inFile, outFile, pitch) {
  const filters = [
    'silenceremove=start_periods=1:start_silence=0.03:start_threshold=-45dB',
    'areverse',
    'silenceremove=start_periods=1:start_silence=0.03:start_threshold=-45dB',
    'areverse',
    'aresample=48000'
  ];
  if (pitch && Math.abs(pitch - 1) > 0.001) {
    filters.push('asetrate=' + Math.round(48000 * pitch), 'aresample=48000', 'atempo=' + (1 / pitch).toFixed(4));
  }
  const r = spawnSync(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', inFile,
    '-af', filters.join(','),
    '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le',
    outFile
  ], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('转码失败 ' + path.basename(inFile) + '：' + (r.stderr || '').trim());
}

function assTime(sec) {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
}

function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0') + ',' + String(ms % 1000).padStart(3, '0');
}

function wrapSub(text) {
  if (cjkLen(text) <= 20) return text;
  const pivot = Math.floor(text.length / 2);
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if ('，。；！？、'.indexOf(text[i]) === -1) continue;
    if (best === -1 || Math.abs(i - pivot) < Math.abs(best - pivot)) best = i;
  }
  if (best < 0) return text;
  return text.slice(0, best + 1) + '\\N' + text.slice(best + 1).replace(/^[，。；！？、\s]+/, '');
}

function writeSubs(lines) {
  /* Windows 没有苹方，用微软雅黑；CG_SUB_FONT 可强制指定。 */
  const subFont = process.env.CG_SUB_FONT || (process.platform === 'win32' ? 'Microsoft YaHei' : 'PingFang SC');
  const head = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1920',
    'PlayResY: 1080',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Story,${subFont},46,&H00FFFFFF,&H00FFFFFF,&H8C000000,&H00000000,0,0,0,0,100,100,0.5,0,1,3,0,2,120,120,88,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];
  lines.forEach(l => {
    const text = wrapSub(String(l.text).replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\r?\n/g, '\\N'));
    head.push('Dialogue: 0,' + assTime(l.subStart) + ',' + assTime(l.subEnd) + ',Story,' + (l.who || '') + ',0,0,0,,' + text);
  });
  fs.mkdirSync(path.dirname(path.join(root, 'assets/subs.ass')), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/subs.ass'), head.join('\n') + '\n');
  const srt = [];
  lines.forEach((l, i) => {
    srt.push(String(i + 1));
    srt.push(srtTime(l.subStart) + ' --> ' + srtTime(l.subEnd));
    srt.push(String(l.text).replace(/\\N/g, '\n'));
    srt.push('');
  });
  fs.writeFileSync(path.join(root, 'assets/subs.srt'), srt.join('\n'));
}

function main() {
  if (opts.listVoices) {
    const voices = sayVoices().filter(v => /^zh_/.test(v.locale));
    console.log('中文语音：');
    voices.forEach(v => console.log('  ' + v.name + '  (' + v.locale + ')'));
    return;
  }
  if (opts.rate != null && !(opts.rate >= 80 && opts.rate <= 400)) throw new Error('--rate 应在 80–400 之间');
  if (!(opts.gain > 0 && opts.gain <= 4)) throw new Error('--gain 应在 0–4 之间');

  const cast = SCRIPT.voices || {};
  const all = (SCRIPT.lines || []).map((l, i) => Object.assign({ id: i + 1 }, l)).sort((a, b) => Number(a.at) - Number(b.at));
  if (!all.length) throw new Error('cg/voice.json 里没有 lines');
  const ids = new Set();
  all.forEach(l => {
    if (ids.has(l.id)) throw new Error('台词 id 重复: ' + l.id);
    ids.add(l.id);
    if (!l.text) throw new Error('台词 ' + l.id + ' 没有 text');
    if (!(Number(l.at) >= 0)) throw new Error('台词 ' + l.id + ' 的 at 无效');
  });

  const selected = opts.only ? all.filter(l => opts.only.indexOf(l.id) !== -1) : all;
  if (!selected.length) throw new Error('--only 没有匹配到台词');

  const totalSec = Math.max(
    Number(CONFIG.duration) || 0,
    ...all.map(l => Number(l.at) + Number(l.dur || 0))
  );
  const sampleRate = 48000;
  const totalSamples = Math.ceil(totalSec * sampleRate);
  const mix = new Float64Array(totalSamples);
  const defaultVoice = opts.voice || pickVoice();
  const ffmpeg = opts.dryRun ? null : findFfmpeg();
  const voiceDir = path.join(root, 'assets', 'voice');
  fs.mkdirSync(voiceDir, { recursive: true });

  log('');
  log('  ' + (CONFIG.title || 'CG') + ' · CG 配音');
  log('  ─────────────────────────────────');
  log(`  台词      ${selected.length}/${all.length} 句 · 片长 ${totalSec.toFixed(1)}s`);
  log(`  语音      ${opts.voice || '按角色（cg/voice.json）'}${opts.rate ? ' · 语速 ' + opts.rate : ''} · 增益 ${opts.gain}`);
  log('');

  const report = [];
  selected.forEach((line, i) => {
    const who = line.who || 'narrator';
    const entry = cast[who] || {};
    const voice = opts.voice || stripVoiceName(entry.voice) || defaultVoice;
    const rate = opts.rate || Number(entry.rate) || 180;
    const pitch = Number(entry.pitch || 1);
    const start = Number(line.at);
    const slot = Number(line.dur || 0);
    const aiff = path.join(voiceDir, '.line-' + String(line.id).padStart(2, '0') + '.aiff');
    const wav = path.join(voiceDir, 'line-' + String(line.id).padStart(2, '0') + '.wav');

    if (!opts.quiet) {
      process.stdout.write('  ' + String(i + 1).padStart(2) + '/' + selected.length + '  ' +
        start.toFixed(2) + 's  ' + who + ' · ' + voice + '  ' + String(line.text).slice(0, 22) + '…\n');
    }
    if (opts.dryRun) {
      report.push({ id: line.id, who, shot: line.shot || null, at: start, slot, text: line.text, chars: cjkLen(line.text), voice, rate, dryRun: true });
      return;
    }

    const say = spawnSync('say', ['-v', voice, '-r', String(rate), '-o', aiff, line.text], { encoding: 'utf8' });
    if (say.status !== 0) throw new Error('say 失败（台词 ' + line.id + '）：' + (say.stderr || '').trim());
    transcode(ffmpeg, aiff, wav, pitch);
    const audio = readWav(wav);
    if (audio.sampleRate !== sampleRate) throw new Error('采样率不一致：' + audio.sampleRate);
    if (audio.samples.length < sampleRate * 0.2) {
      throw new Error('语音合成结果为空（台词 ' + line.id + '）：检查语音名是否在 say -v ? 列表里（' + voice + '）');
    }

    const offset = Math.round(start * sampleRate);
    if (offset + audio.samples.length > totalSamples) {
      throw new Error('台词 ' + line.id + ' 在 ' + start.toFixed(2) + 's 起念 ' +
        (audio.samples.length / sampleRate).toFixed(2) + 's，超出片长 ' + totalSec.toFixed(1) + 's；检查 cg/voice.json 的 at 或加长 config.duration');
    }
    for (let k = 0; k < audio.samples.length; k++) {
      mix[offset + k] += (audio.samples[k] / 32768) * opts.gain;
    }

    const spoken = audio.samples.length / sampleRate;
    if (slot && spoken > slot + 0.35) {
      log(`    ! 比时间槽长 ${(spoken - slot).toFixed(2)}s：缩短文本或把 rate 提到 ${Math.min(400, Math.round(rate * spoken / slot))} 以上`);
    }
    report.push({
      id: line.id, who, shot: line.shot || null, at: start, slot,
      spoken: +spoken.toFixed(3), text: line.text, chars: cjkLen(line.text),
      voice, rate, file: path.relative(root, wav)
    });
    fs.rmSync(aiff, { force: true });
  });

  if (opts.dryRun) {
    log('\n  dry-run：未生成音频。');
    return;
  }

  /* 字幕槽位：念完再留 0.25s，早于下一句 0.05s 收口，且不超出片长 */
  const subs = report.map((r, i) => {
    const next = report[i + 1];
    const subStart = r.at;
    const subEnd = Math.min(
      totalSec - 0.1,
      next ? next.at - 0.05 : totalSec - 0.1,
      r.at + Math.max(r.spoken + 0.25, 1.0)
    );
    return Object.assign({}, r, { subStart, subEnd: Math.max(subStart + 0.6, subEnd) });
  });

  let peak = 0;
  for (let i = 0; i < mix.length; i++) peak = Math.max(peak, Math.abs(mix[i]));
  let normalized = false;
  if (peak > 0.98) {
    const norm = 0.95 / peak;
    for (let i = 0; i < mix.length; i++) mix[i] *= norm;
    log('  ! 峰值过高（' + (20 * Math.log10(peak)).toFixed(1) + ' dB），已自动衰减 ' + (20 * Math.log10(norm)).toFixed(1) + ' dB');
    normalized = true;
  }
  const pcm = new Int16Array(totalSamples);
  for (let i = 0; i < mix.length; i++) {
    pcm[i] = Math.round(Math.max(-1, Math.min(1, mix[i])) * 32767);
  }
  const outWav = path.join(root, 'assets', 'voiceover.wav');
  writeWav(outWav, sampleRate, pcm);

  fs.writeFileSync(path.join(voiceDir, 'lines.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'assets', 'voiceover.json'), JSON.stringify({
    title: CONFIG.title, voice: opts.voice || 'cg/voice.json', gain: opts.gain,
    normalized, duration: totalSec, generated: new Date().toISOString(),
    cues: report.map(r => ({ n: r.id, who: r.who, shot: r.shot, start: r.at, slot: r.slot, spoken: r.spoken, text: r.text, voice: r.voice, rate: r.rate }))
  }, null, 2) + '\n');
  if (opts.subs) writeSubs(subs);

  log('');
  log(`  整轨      ${path.relative(root, outWav)}  ${(fs.statSync(outWav).size / 1024 / 1024).toFixed(1)} MB`);
  log(`  逐句      assets/voice/ · ${report.length} 条（lines.json 有实测时长）`);
  if (opts.subs) log('  字幕      assets/subs.ass · assets/subs.srt');
  log('\n下一步：node tools/cg-render.js，渲染完 node encode.js --subs assets/subs.ass 烧字幕');
}

try {
  main();
} catch (e) {
  console.error('CG 配音失败：' + e.message);
  process.exit(1);
}
