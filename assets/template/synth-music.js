#!/usr/bin/env node
/**
 * 纯 Node 合成配乐（无采样、无依赖）→ assets/music.wav
 * 低频 drone + 和弦垫 + 脉冲 + 转场音效。默认时长读 js/config.js。
 *
 *   node synth-music.js
 *   node synth-music.js --duration 30 --mood warm --cuts 5,12,20,27
 */
'use strict';

const fs = require('fs');
const path = require('path');
const CONFIG = require('./js/config.js');

const USAGE = `用法: node synth-music.js [options]

  --duration <sec>   片长（默认读 js/config.js，${CONFIG.duration || 60}s）
  --bpm <n>          速度 30–240（默认 100）
  --mood <name>      calm | warm | tense（默认 calm）
  --cuts <a,b,c>     切点秒数，用来卡音效（默认按片长比例）
  --pulse-from <sec> 脉冲起点（默认第一个切点）
  --pulse-to <sec>   脉冲终点（默认片尾前 5s）
  --out <file>       输出路径（默认 assets/music.wav）
  -h, --help         显示帮助`;

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) throw new Error('缺少参数值: ' + a);
      return v;
    };
    switch (a) {
      case '-h': case '--help': console.log(USAGE); process.exit(0); break;
      case '--duration': opts.duration = Number(next()); break;
      case '--bpm': opts.bpm = Number(next()); break;
      case '--mood': opts.mood = String(next()); break;
      case '--cuts': opts.cuts = String(next()); break;
      case '--pulse-from': opts.pulseFrom = Number(next()); break;
      case '--pulse-to': opts.pulseTo = Number(next()); break;
      case '--out': opts.out = next(); break;
      default: throw new Error('未知参数: ' + a + '\n\n' + USAGE);
    }
  }
  return opts;
}

let OPTS;
try {
  OPTS = parseArgs(process.argv.slice(2));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const DUR = Math.max(1, Number(OPTS.duration != null ? OPTS.duration : (CONFIG.duration || 60)));
const BPM = Math.max(30, Math.min(240, Number(OPTS.bpm != null ? OPTS.bpm : 100)));
const OUT = path.resolve(__dirname, OPTS.out || 'assets/music.wav');
const MOOD = String(OPTS.mood || 'calm');
if (!(DUR > 0)) { console.error('--duration 必须是正数'); process.exit(1); }
if (!Number.isFinite(BPM)) { console.error('--bpm 必须是数字'); process.exit(1); }
const SR = 48000;
const N = Math.round(SR * DUR);
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

const defaultCuts = [0.1667, 0.3583, 0.55, 0.7417, 0.9167].map(f => +(f * DUR).toFixed(2));
const CUTS = String(OPTS.cuts != null ? OPTS.cuts : defaultCuts.join(','))
  .split(',').map(Number).filter(n => Number.isFinite(n) && n > 0 && n < DUR)
  .sort((a, b) => a - b);
const PULSE_FROM = Number(OPTS.pulseFrom != null ? OPTS.pulseFrom : (CUTS[0] != null ? CUTS[0] : DUR * 0.16));
const PULSE_TO = Number(OPTS.pulseTo != null ? OPTS.pulseTo : Math.max(PULSE_FROM, DUR - 5));

const MOODS = {
  calm: {
    chords: [
      { root: 73.42, notes: [146.83, 174.61, 220.0] },
      { root: 58.27, notes: [116.54, 146.83, 174.61] },
      { root: 87.31, notes: [174.61, 220.0, 261.63] },
      { root: 65.41, notes: [130.81, 164.81, 196.0] }
    ],
    arp: [587.33, 440.0, 349.23, 440.0, 523.25, 349.23, 293.66, 349.23]
  },
  warm: {
    chords: [
      { root: 65.41, notes: [261.63, 329.63, 392.0] },
      { root: 55.0, notes: [220.0, 261.63, 329.63] },
      { root: 87.31, notes: [174.61, 220.0, 261.63] },
      { root: 98.0, notes: [196.0, 246.94, 293.66] }
    ],
    arp: [523.25, 392.0, 329.63, 392.0, 440.0, 349.23, 293.66, 349.23]
  },
  tense: {
    chords: [
      { root: 73.42, notes: [146.83, 174.61, 220.0] },
      { root: 77.78, notes: [155.56, 185.0, 233.08] },
      { root: 58.27, notes: [116.54, 146.83, 174.61] },
      { root: 55.0, notes: [110.0, 138.59, 164.81] }
    ],
    arp: [440.0, 349.23, 293.66, 349.23, 392.0, 293.66, 246.94, 293.66]
  }
};
if (!MOODS[MOOD]) {
  console.error('未知 mood: "' + MOOD + '"，可选: ' + Object.keys(MOODS).join(' / '));
  process.exit(1);
}
if (!(PULSE_TO > PULSE_FROM)) {
  console.error('--pulse-to 必须大于 --pulse-from');
  process.exit(1);
}
const MOOD_DEF = MOODS[MOOD];
const CHORDS = MOOD_DEF.chords;
const CHORD_LEN = BAR * 2;

const L = new Float32Array(N);
const R = new Float32Array(N);

function panGains(pan) {
  const p = Math.max(-1, Math.min(1, pan));
  return [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];
}

function addStereo(i, v, gl, gr) {
  if (i < 0 || i >= N) return;
  L[i] += v * gl;
  R[i] += v * gr;
}

function envASR(t, dur, atk, rel) {
  if (t < 0 || t > dur) return 0;
  const a = atk > 0 ? Math.min(1, t / atk) : 1;
  const r = rel > 0 ? Math.min(1, (dur - t) / rel) : 1;
  const x = Math.min(a, r);
  return x * x * (3 - 2 * x);
}

function tone(t0, dur, freq, amp, opt) {
  opt = opt || {};
  const atk = opt.atk == null ? 0.02 : opt.atk;
  const rel = opt.rel == null ? 0.05 : opt.rel;
  const detune = opt.detune || 0;
  const [gl, gr] = panGains(opt.pan || 0);
  const harm = opt.harm || [];
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  const w = 2 * Math.PI * freq * Math.pow(2, detune / 1200) / SR;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const e = envASR(t, dur, atk, rel);
    if (e <= 0) continue;
    let v = Math.sin(w * k + (opt.phase || 0));
    for (let h = 0; h < harm.length; h++) {
      v += harm[h][1] * Math.sin(w * harm[h][0] * k + h * 1.7);
    }
    addStereo(i0 + k, v * e * amp, gl, gr);
  }
}

function kick(t0, amp, opt) {
  opt = opt || {};
  const dur = opt.dur || 0.38;
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  const [gl, gr] = panGains(0);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = 42 + 96 * Math.exp(-t * 26);
    ph += 2 * Math.PI * f / SR;
    const e = Math.exp(-t * 8.5) * Math.min(1, t / 0.004);
    addStereo(i0 + k, Math.sin(ph) * e * amp, gl, gr);
  }
}

function noiseHit(t0, dur, amp, cut, opt) {
  opt = opt || {};
  const [gl, gr] = panGains(opt.pan || 0);
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  let low = 0, band = 0;
  let seed = 0x9e3779b9;
  const q = 1.1;
  for (let k = 0; k < n; k++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed / 2147483648 - 1;
    const t = k / SR;
    const fc = typeof cut === 'function' ? cut(t / dur) : cut;
    const f = 2 * Math.sin(Math.PI * Math.min(0.45, fc / SR));
    low += f * band;
    const high = x - low - q * band;
    band += f * high;
    const e = opt.decay ? Math.exp(-t * opt.decay) : envASR(t, dur, dur * 0.6, dur * 0.4);
    addStereo(i0 + k, band * e * amp, gl, gr);
  }
}

function boom(t0, amp) {
  tone(t0, 2.2, 68, amp, { atk: 0.005, rel: 1.4, harm: [[0.5, 0.25]] });
  tone(t0, 2.6, 41, amp * 0.8, { atk: 0.01, rel: 2.0 });
  noiseHit(t0, 0.5, amp * 0.35, 220, { decay: 12 });
}

function bell(t0, freq, amp) {
  tone(t0, 3.2, freq, amp, { atk: 0.004, rel: 2.6, harm: [[2.01, 0.38], [2.99, 0.14], [4.2, 0.05]] });
  tone(t0, 3.2, freq * 1.5, amp * 0.25, { atk: 0.006, rel: 2.6, pan: 0.25 });
}

function whoosh(t0, dur, amp) {
  noiseHit(t0, dur, amp, u => 260 + 3600 * Math.pow(u, 2.2), { pan: -0.3 });
}

function pluck(t0, freq, amp, pan) {
  tone(t0, 0.42, freq, amp, { atk: 0.003, rel: 0.3, harm: [[2, 0.28], [3.01, 0.08]], pan });
}

// 低频 drone（整片）
tone(0, DUR, 73.42, 0.055, { atk: 2.8, rel: 4.5 });
tone(0, DUR, 110.0, 0.03, { atk: 3.4, rel: 4.5, detune: 4 });
tone(0, DUR, 146.83, 0.016, { atk: 4.0, rel: 4.5, detune: -5 });

// 和弦垫
for (let t0 = 0; t0 < DUR; t0 += CHORD_LEN) {
  const c = CHORDS[Math.round(t0 / CHORD_LEN) % CHORDS.length];
  const dur = Math.min(CHORD_LEN + 1.6, DUR - t0);
  const lift = t0 >= DUR * 0.36 ? 1.18 : 1;
  c.notes.forEach((f, idx) => {
    tone(t0, dur, f, 0.034 * lift, { atk: 1.4, rel: 1.5, pan: (idx - 1) * 0.35, harm: [[2, 0.12]] });
    tone(t0, dur, f, 0.018 * lift, { atk: 1.8, rel: 1.5, detune: 6, pan: (idx - 1) * 0.35 });
  });
}

// 脉冲
for (let t0 = PULSE_FROM; t0 < PULSE_TO; t0 += BEAT) kick(t0, 0.085);
for (let t0 = Math.max(PULSE_FROM, DUR * 0.36); t0 < PULSE_TO; t0 += BEAT) {
  noiseHit(t0 + BEAT / 2, 0.05, 0.016, 5200, { decay: 90, pan: 0.2 });
}

// 贝斯：每小节 1、3 拍
for (let b = 0; b < DUR; b += BAR) {
  if (b < PULSE_FROM - 0.4 || b > PULSE_TO) continue;
  const c = CHORDS[Math.round(b / CHORD_LEN) % CHORDS.length];
  tone(b, 1.3, c.root, 0.07, { atk: 0.01, rel: 0.9, harm: [[2, 0.14]] });
  tone(b + BEAT * 2, 1.0, c.root, 0.045, { atk: 0.01, rel: 0.7 });
}

// 琶音：后半段
{
  const arpStart = CUTS[2] != null ? CUTS[2] : DUR * 0.55;
  let k = 0;
  for (let t0 = arpStart; t0 < PULSE_TO; t0 += BEAT / 2) {
    pluck(t0, MOOD_DEF.arp[k % MOOD_DEF.arp.length], 0.026, (k % 2 ? 0.3 : -0.3));
    k++;
  }
}

// 转场音效
CUTS.forEach((t, i) => {
  if (t > 1.6) whoosh(t - 1.4, 1.3 + (i % 2) * 0.2, i === CUTS.length - 1 ? 0.06 : 0.045);
  bell(t, [1174.66, 880.0, 1396.91, 1046.5, 1174.66][i % 5], i === CUTS.length - 1 ? 0.03 : 0.022);
});
boom(0, 0.09);
if (CUTS[0]) boom(CUTS[0], 0.12);
if (CUTS[2]) boom(CUTS[2], 0.1);
if (CUTS[CUTS.length - 1]) boom(CUTS[CUTS.length - 1], 0.14);

// 母带：软限幅 + 尾部淡出
const fadeStart = Math.max(0, DUR - 2.4);
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = t < fadeStart ? 1 : Math.max(0, 1 - (t - fadeStart) / (DUR - fadeStart));
  L[i] = Math.tanh(L[i] * 1.6) * fade;
  R[i] = Math.tanh(R[i] * 1.6) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = peak > 0 ? 0.89 / peak : 1;

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(L[i] * norm * 32767), i * 4);
  data.writeInt16LE(Math.round(R[i] * norm * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([header, data]));
console.log('已生成 ' + path.relative(__dirname, OUT) + '  ' + (data.length / 1024 / 1024).toFixed(1) + 'MB' +
  '  ' + DUR + 's / ' + MOOD + ' / ' + BPM + 'BPM  峰值归一化 ' + norm.toFixed(2));
