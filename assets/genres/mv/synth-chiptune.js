#!/usr/bin/env node
/**
 * 像素叙事短片的原创芯片配乐（无采样、无依赖）→ assets/music.wav
 * 120 BPM / A 小调 / 30 小节，结构与切点对齐：
 *   0–8 夜雨前奏 · 8–24 拼合 · 24–40 推进 · 40–52 答案 · 52–60 清晨尾卡
 *
 *   node synth-chiptune.js
 *   node synth-chiptune.js --out assets/music.wav --bpm 120
 */
'use strict';

const fs = require('fs');
const path = require('path');
const CONFIG = require('./js/config.js');

const ARGS = process.argv.slice(2);
let OUT = 'assets/music.wav';
let BPM = 120;
for (let i = 0; i < ARGS.length; i++) {
  if (ARGS[i] === '--out') OUT = ARGS[++i];
  else if (ARGS[i] === '--bpm') BPM = Number(ARGS[++i]);
  else if (ARGS[i] === '-h' || ARGS[i] === '--help') {
    console.log('用法: node synth-chiptune.js [--out assets/music.wav] [--bpm 120]');
    process.exit(0);
  }
}
if (!(BPM >= 60 && BPM <= 200)) { console.error('--bpm 范围 60–200'); process.exit(1); }

const DUR = Number(CONFIG.duration) || 60;
const SR = 48000;
const N = Math.round(SR * DUR);
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const EIGHTH = BEAT / 2;
const SIXTEENTH = BEAT / 4;

const L = new Float32Array(N);
const R = new Float32Array(N);

function add(i, v, pan) {
  if (i < 0 || i >= N) return;
  const p = Math.max(-1, Math.min(1, pan || 0));
  L[i] += v * Math.cos((p + 1) * Math.PI / 4);
  R[i] += v * Math.sin((p + 1) * Math.PI / 4);
}

function attack(t, dur, atk, rel) {
  if (t < 0 || t > dur) return 0;
  const a = atk > 0 ? Math.min(1, t / atk) : 1;
  const r = rel > 0 ? Math.min(1, (dur - t) / rel) : 1;
  return Math.min(a, r);
}

function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

/* 脉冲波：duty 0.125 / 0.25 / 0.5 */
function pulse(t0, dur, note, amp, opt) {
  opt = opt || {};
  const duty = opt.duty || 0.25;
  const f = typeof note === 'number' ? midi(note) : note;
  const atk = opt.atk == null ? 0.006 : opt.atk;
  const rel = opt.rel == null ? 0.04 : opt.rel;
  const vib = opt.vib || 0;
  const vibRate = opt.vibRate || 5.2;
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  let ph = opt.phase || 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const e = attack(t, dur, atk, rel);
    if (e <= 0) continue;
    const vf = vib ? 1 + vib * Math.sin(2 * Math.PI * vibRate * t) : 1;
    ph += f * vf / SR;
    const v = (ph - Math.floor(ph)) < duty ? 1 : -1;
    add(i0 + k, v * e * amp, opt.pan || 0);
  }
}

/* 三角波：贝斯与低音 */
function triangle(t0, dur, note, amp, opt) {
  opt = opt || {};
  const f = typeof note === 'number' ? midi(note) : note;
  const atk = opt.atk == null ? 0.008 : opt.atk;
  const rel = opt.rel == null ? 0.05 : opt.rel;
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const e = attack(t, dur, atk, rel);
    if (e <= 0) continue;
    ph += f / SR;
    const v = 2 * Math.abs(2 * (ph - Math.floor(ph)) - 1) - 1;
    add(i0 + k, v * e * amp, opt.pan || 0);
  }
}

/* 15-bit LFSR 噪声，按 period 采样保持 */
function noise(t0, dur, amp, opt) {
  opt = opt || {};
  const rate = opt.rate || 9000;
  const decay = opt.decay || 12;
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  let lfsr = opt.seed || 0x2ace;
  let hold = 1;
  let count = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const e = opt.hold ? attack(t, dur, 0.002, 0.002) : Math.exp(-t * decay) * Math.min(1, t / 0.002);
    if (e <= 0) continue;
    if (count <= 0) {
      const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
      lfsr = (lfsr >> 1) | (bit << 14);
      hold = (lfsr & 1) ? 1 : -1;
      count = Math.max(1, Math.round(SR / rate));
    }
    count--;
    add(i0 + k, hold * e * amp, opt.pan || 0);
  }
}

function kick(t0, amp) {
  const dur = 0.22;
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = 42 + 130 * Math.exp(-t * 30);
    ph += f / SR;
    const v = 2 * Math.abs(2 * (ph - Math.floor(ph)) - 1) - 1;
    add(i0 + k, v * Math.exp(-t * 11) * amp, 0);
  }
}

function snare(t0, amp) {
  noise(t0, 0.14, amp, { rate: 7000, decay: 22, seed: 0x1f3d });
  triangle(t0, 0.06, 55, amp * 0.5, { atk: 0.001, rel: 0.03 });
}

function hat(t0, amp) {
  noise(t0, 0.035, amp, { rate: 24000, decay: 90, seed: 0x77a1 });
}

function crash(t0, amp) {
  noise(t0, 1.1, amp, { rate: 11000, decay: 3.4, seed: 0x51b7, pan: -0.2 });
  noise(t0, 0.9, amp * 0.5, { rate: 18000, decay: 4.2, seed: 0x3c9d, pan: 0.25 });
}

function lead(t0, dur, note, amp, opt) {
  pulse(t0 + 0.375, dur * 0.9, note, amp * 0.27, { duty: 0.125, pan: (opt && opt.pan ? -opt.pan : 0.3), rel: 0.12, atk: 0.01 });
  pulse(t0, dur, note, amp, opt);
}

const CHORDS = [
  { root: 45, notes: [57, 60, 64] },   /* Am */
  { root: 41, notes: [53, 57, 60] },   /* F  */
  { root: 48, notes: [60, 64, 67] },   /* C  */
  { root: 43, notes: [55, 59, 62] }    /* G  */
];

const NOTE = {
  A2: 45, C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, B3: 59,
  C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71,
  C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, E6: 88, G6: 91
};

/* 每小节 8 个八分音符槽：[音名, 时值(八分)] */
const PHRASE_A = [
  [['E5', 2], ['C5', 1], ['A4', 1], ['B4', 2], [null, 2]],
  [['C5', 2], ['A4', 1], ['F4', 1], ['G4', 2], [null, 2]],
  [['E5', 2], ['G5', 1], ['E5', 1], ['D5', 2], [null, 2]],
  [['B4', 2], ['D5', 1], ['G4', 1], ['B4', 2], [null, 2]]
];

const PHRASE_B = [
  [['A4', 1], ['C5', 1], ['E5', 2], ['D5', 1], ['C5', 1], ['B4', 1], [null, 1]],
  [['A4', 1], ['C5', 1], ['F5', 2], ['E5', 1], ['C5', 1], ['A4', 1], [null, 1]],
  [['G4', 1], ['C5', 1], ['E5', 2], ['G5', 1], ['E5', 1], ['D5', 1], [null, 1]],
  [['B4', 1], ['D5', 1], ['G5', 2], ['D5', 1], ['B4', 1], ['G4', 1], [null, 1]]
];

const PHRASE_C = [
  [['A5', 2], ['E5', 1], ['C5', 1], ['D5', 2], ['E5', 2]],
  [['F5', 2], ['C5', 1], ['A4', 1], ['C5', 2], ['F5', 2]],
  [['G5', 2], ['E5', 1], ['C5', 1], ['E5', 2], ['G5', 2]],
  [['G5', 2], ['D5', 1], ['B4', 1], ['D5', 2], ['G5', 2]]
];

const PHRASE_END = [
  [['E5', 4], ['C5', 2], ['A4', 2]],
  [['C5', 4], ['A4', 2], ['F4', 2]],
  [['E5', 4], ['G5', 2], ['E5', 2]],
  [['A4', 8]]
];

function playPhrase(phrase, bar0, opt) {
  for (let b = 0; b < phrase.length; b++) {
    let slot = 0;
    for (let s = 0; s < phrase[b].length; s++) {
      const item = phrase[b][s];
      const t0 = (bar0 + b) * BAR + slot * EIGHTH;
      if (item[0]) {
        const dur = item[1] * EIGHTH * 0.92;
        const m = NOTE[item[0]] + (opt.oct || 0) * 12;
        lead(t0, dur, m, opt.amp, { duty: opt.duty || 0.25, pan: opt.pan || 0, vib: opt.vib || 0.0035 });
        if (opt.harmony) {
          pulse(t0, dur, m - 3, opt.amp * opt.harmony, { duty: 0.125, pan: -0.35, atk: 0.01, rel: 0.08 });
        }
      }
      slot += item[1];
    }
  }
}

/* ---------- 编曲 ---------- */

/* 夜雨：0–8s 的滤波噪声，8s 后收掉 */
for (let t0 = 0; t0 < 7.8; t0 += 0.5) {
  const a = 0.028 * (1 - Math.min(1, Math.max(0, (t0 - 5.5) / 2.3))) * (t0 < 0.4 ? t0 / 0.4 : 1);
  noise(t0, 0.5, a, { rate: 5200 + (t0 * 97) % 1800, decay: 1.4, seed: 0x1234 + Math.round(t0 * 1000), pan: (t0 % 1 ? -0.4 : 0.4) });
}

/* 和弦：每 2 小节换一次；前奏用长音，尾段收成三角波 */
for (let bar = 0; bar < 30; bar++) {
  const ch = CHORDS[bar % 4];
  const t0 = bar * BAR;
  const outro = bar >= 26;
  if (outro) {
    triangle(t0, BAR * 0.95, ch.root, 0.05, { atk: 0.02, rel: 0.4 });
    ch.notes.forEach(function (m, k) {
      triangle(t0, BAR * 0.95, m, 0.02, { atk: 0.05, rel: 0.5, pan: (k - 1) * 0.4 });
    });
  } else {
    triangle(t0, BAR * 0.96, ch.root, bar < 4 ? 0.035 : 0.055, { atk: 0.02, rel: 0.2 });
  }
}

/* 前奏：0–8s，稀疏琶音 + 长音旋律 */
for (let bar = 0; bar < 4; bar++) {
  const ch = CHORDS[bar % 4];
  for (let s = 0; s < 8; s++) {
    const m = ch.notes[s % 3] + (s >= 6 ? 12 : 0);
    pulse(bar * BAR + s * EIGHTH, EIGHTH * 0.72, m, 0.026, { duty: 0.125, pan: (s % 2 ? 0.25 : -0.25), atk: 0.01, rel: 0.08 });
  }
}
PHRASE_END.forEach(function (bar, b) {
  let slot = 0;
  bar.forEach(function (item) {
    if (item[0]) {
      lead(5 * BAR + b * BAR + slot * EIGHTH, item[1] * EIGHTH * 0.94, NOTE[item[0]] - 12, 0.05, { duty: 0.125, vib: 0.002, pan: 0.15 });
    }
    slot += item[1];
  });
});

/* 主歌 8–24s：鼓、贝斯八分、琶音、A/B 乐句 */
for (let bar = 4; bar < 12; bar++) {
  const ch = CHORDS[bar % 4];
  const t0 = bar * BAR;
  for (let b = 0; b < 4; b++) kick(t0 + b * BEAT, 0.16);
  snare(t0 + BEAT, 0.095);
  snare(t0 + BEAT * 3, 0.11);
  for (let s = 0; s < 16; s++) hat(t0 + s * SIXTEENTH, s % 4 === 2 ? 0.018 : 0.01);
  for (let s = 0; s < 8; s++) {
    const m = ch.root + (s === 3 || s === 7 ? 12 : 0);
    triangle(t0 + s * EIGHTH, EIGHTH * 0.8, m, 0.06, { atk: 0.005, rel: 0.06 });
  }
  for (let s = 0; s < 16; s++) {
    const m = ch.notes[s % 3] + 12 + (Math.floor(s / 8) % 2 ? 12 : 0);
    pulse(t0 + s * SIXTEENTH, SIXTEENTH * 0.7, m, 0.022, { duty: 0.125, pan: s % 2 ? 0.3 : -0.3, atk: 0.004, rel: 0.04 });
  }
}
playPhrase(PHRASE_A, 4, { amp: 0.085, duty: 0.25, pan: 0.05, vib: 0.0035 });
playPhrase(PHRASE_B, 8, { amp: 0.09, duty: 0.25, pan: 0.05, vib: 0.0035, harmony: 0.22 });

/* 推进 24–40s：加第三声部、十六分琶音、渐强的军鼓 */
for (let bar = 12; bar < 20; bar++) {
  const ch = CHORDS[bar % 4];
  const t0 = bar * BAR;
  for (let b = 0; b < 4; b++) kick(t0 + b * BEAT, 0.19);
  snare(t0 + BEAT, 0.11);
  snare(t0 + BEAT * 3, 0.125);
  for (let s = 0; s < 16; s++) hat(t0 + s * SIXTEENTH, s % 4 === 2 ? 0.024 : 0.012);
  for (let s = 0; s < 16; s++) {
    const m = ch.root + (s === 5 || s === 13 ? 12 : 0);
    triangle(t0 + s * EIGHTH / 2, EIGHTH * 0.42, m, 0.055, { atk: 0.004, rel: 0.04 });
  }
  const chordTones = [ch.notes[0], ch.notes[1], ch.notes[2], ch.notes[0] + 12];
  for (let s = 0; s < 16; s++) {
    const m = chordTones[s % 4] + 12;
    pulse(t0 + s * SIXTEENTH, SIXTEENTH * 0.62, m, 0.02, { duty: 0.125, pan: s % 2 ? 0.35 : -0.35, atk: 0.004, rel: 0.035 });
  }
}
playPhrase(PHRASE_A, 12, { amp: 0.095, duty: 0.25, pan: 0.05, vib: 0.0038, harmony: 0.26 });
playPhrase(PHRASE_C, 16, { amp: 0.1, duty: 0.5, pan: 0.05, vib: 0.004, harmony: 0.24 });
/* 军鼓滚奏进入 40s */
for (let s = 0; s < 8; s++) snare(19 * BAR + s * SIXTEENTH * 2, 0.05 + s * 0.008);

/* 高潮 40–52s：高八度主旋律 + 强拍 */
for (let bar = 20; bar < 26; bar++) {
  const ch = CHORDS[bar % 4];
  const t0 = bar * BAR;
  for (let b = 0; b < 4; b++) kick(t0 + b * BEAT, 0.22);
  snare(t0 + BEAT, 0.13);
  snare(t0 + BEAT * 3, 0.145);
  for (let s = 0; s < 16; s++) hat(t0 + s * SIXTEENTH, s % 2 ? 0.012 : 0.02);
  for (let s = 0; s < 8; s++) {
    const m = ch.root + (s === 3 || s === 7 ? 12 : 0);
    triangle(t0 + s * EIGHTH, EIGHTH * 0.85, m, 0.07, { atk: 0.004, rel: 0.05 });
  }
  const tones = [ch.notes[0], ch.notes[1], ch.notes[2], ch.notes[0] + 12];
  for (let s = 0; s < 16; s++) {
    const m = tones[s % 4] + 24;
    pulse(t0 + s * SIXTEENTH, SIXTEENTH * 0.55, m, 0.017, { duty: 0.25, pan: s % 2 ? 0.4 : -0.4, atk: 0.003, rel: 0.03 });
  }
}
crash(20 * BAR, 0.1);
crash(24 * BAR, 0.13);
playPhrase(PHRASE_C, 20, { amp: 0.105, duty: 0.5, pan: 0.0, vib: 0.0045, harmony: 0.3 });
playPhrase(PHRASE_C, 24, { amp: 0.11, duty: 0.5, pan: 0.0, vib: 0.0045, harmony: 0.3, oct: 1 });

/* 答案闪白（51s）：一串上行芯片音 */
[69, 72, 76, 81, 84, 88].forEach(function (m, i) {
  pulse(50.9 + i * 0.045, 0.22, m, 0.05 - i * 0.004, { duty: 0.125, pan: (i - 2.5) * 0.14, atk: 0.003, rel: 0.12 });
});

/* 收束 52–60s：雨声回来一点，音乐盒乐句，最后落在 A */
noise(52, 6.4, 0.012, { rate: 6400, decay: 0.9, seed: 0x6a1f, pan: 0.3 });
for (let t0 = 52.2; t0 < 58.6; t0 += 0.5) {
  const a = 0.006 * (1 - Math.max(0, (t0 - 56) / 3));
  noise(t0, 0.3, a, { rate: 7200, decay: 4, seed: 0x2b00 + Math.round(t0 * 100), pan: t0 % 1 ? -0.35 : 0.35 });
}
PHRASE_END.forEach(function (bar, b) {
  let slot = 0;
  bar.forEach(function (item) {
    if (item[0]) {
      const m = NOTE[item[0]];
      const t0 = 26 * BAR + b * BAR + slot * EIGHTH;
      pulse(t0, item[1] * EIGHTH * 0.9, m, 0.065, { duty: 0.25, pan: 0.1, vib: 0.003, atk: 0.006, rel: 0.18 });
      pulse(t0 + 0.01, item[1] * EIGHTH * 0.85, m + 12, 0.02, { duty: 0.125, pan: -0.3, atk: 0.004, rel: 0.2 });
    }
    slot += item[1];
  });
});
[69, 72, 76, 81, 84].forEach(function (m, i) {
  pulse(56 + i * 0.11, 0.7, m, 0.022, { duty: 0.125, pan: (i - 2) * 0.2, atk: 0.01, rel: 0.5 });
});
kick(56, 0.14);
noise(56, 1.4, 0.035, { rate: 9000, decay: 2.2, seed: 0x5a5a, pan: -0.15 });

/* 每个切点的芯片提示音与低频落点 */
const CUTS = [8, 17, 26, 35, 44, 52];
CUTS.forEach(function (t, i) {
  const notes = [88, 83, 91, 86, 93, 84];
  pulse(t - 0.09, 0.16, notes[i % notes.length], 0.028, { duty: 0.125, pan: i % 2 ? 0.3 : -0.3, atk: 0.002, rel: 0.1 });
  if (i !== 5) triangle(t - 0.02, 0.28, 33, 0.09, { atk: 0.002, rel: 0.2 });
});

/* 母带：软限幅 + 尾部淡出 */
const fadeStart = DUR - 1.6;
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = t < fadeStart ? 1 : Math.max(0, 1 - (t - fadeStart) / (DUR - fadeStart));
  L[i] = Math.tanh(L[i] * 1.5) * fade;
  R[i] = Math.tanh(R[i] * 1.5) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = peak > 0 ? 0.86 / peak : 1;

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

const OUT_ABS = path.resolve(__dirname, OUT);
fs.mkdirSync(path.dirname(OUT_ABS), { recursive: true });
fs.writeFileSync(OUT_ABS, Buffer.concat([header, data]));
console.log('已生成 ' + path.relative(__dirname, OUT_ABS) + '  ' +
  (data.length / 1024 / 1024).toFixed(1) + 'MB  ' + DUR + 's / chiptune / ' + BPM + 'BPM  峰值归一化 ' + norm.toFixed(2));
