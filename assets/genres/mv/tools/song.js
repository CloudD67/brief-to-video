#!/usr/bin/env node
/**
 * 歌曲 / 歌词接入：把用户的歌转成 assets/music.wav，并按歌词写 js/script.js。
 *
 *   node tools/song.js --audio ~/Music/tide.mp3 --lyrics ~/Music/tide.lrc
 *   node tools/song.js --lyrics tide.txt --dry-run
 *   npm run song -- --audio song.m4a --lyrics song.lrc
 *
 * LRC 用 [mm:ss.xx] 时间码；纯文本按行均分在 [片头留白, 片长-收尾] 之间。
 * 只改 assets/music.wav 与 js/script.js，不动分镜——分镜仍要按歌词重排 film.js。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const opts = { root: '.', audio: null, lyrics: null, out: 'assets/music.wav', lead: 2, tail: 3, gap: 0.32, dry: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => {
    const v = args[++i];
    if (v == null) throw new Error('缺少参数值: ' + a);
    return v;
  };
  if (a === '--audio') opts.audio = next();
  else if (a === '--lyrics') opts.lyrics = next();
  else if (a === '--out') opts.out = next();
  else if (a === '--lead') opts.lead = Number(next());
  else if (a === '--tail') opts.tail = Number(next());
  else if (a === '--gap') opts.gap = Number(next());
  else if (a === '--dry-run') opts.dry = true;
  else if (a === '-h' || a === '--help') {
    console.log(`用法: node tools/song.js --lyrics <file> [options]

  --audio <file>   歌曲文件（mp3/m4a/wav/flac…），用 ffmpeg 转成 assets/music.wav
  --lyrics <file>  歌词：.lrc（带 [mm:ss.xx] 时间码）或 .txt（按行均分）
  --out <file>     配乐输出路径（默认 assets/music.wav）
  --lead <sec>     纯文本歌词第一句起点（默认 2）
  --tail <sec>     纯文本歌词最后一句的收尾留白（默认 3）
  --gap <sec>      两句之间的换气（默认 0.32）
  --dry-run        只打印时间轴，不写文件
  -h, --help       显示帮助`);
    process.exit(0);
  } else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else opts.root = a;
}
if (!opts.lyrics) throw new Error('缺少 --lyrics（.lrc 或 .txt）');

const ROOT = path.resolve(opts.root);
const CONFIG = require(path.join(ROOT, 'js/config.js'));

function ffmpegPath() {
  try { return require(path.join(ROOT, 'node_modules', '@ffmpeg-installer/ffmpeg')).path; } catch (e) { /* fallthrough */ }
  return 'ffmpeg';
}

function audioDuration(file) {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(String(r.stderr || ''));
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

function toWav(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = spawnSync(ffmpegPath(), ['-y', '-hide_banner', '-i', src, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', dest], { stdio: 'pipe' });
  if (r.status !== 0) {
    throw new Error('ffmpeg 转码失败：' + String(r.stderr || '').split('\n').slice(-3).join(' '));
  }
}

function readLrc(file) {
  const out = [];
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const stamps = Array.from(raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g));
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    if (!stamps.length || !text) continue;
    for (const s of stamps) {
      out.push({ start: Number(s[1]) * 60 + Number(s[2]), text });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function readText(file, duration) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) throw new Error('歌词文件是空的');
  const from = opts.lead;
  const to = Math.max(from + lines.length * 2, duration - opts.tail);
  const slot = (to - from) / lines.length;
  return lines.map((text, i) => ({ start: +(from + i * slot).toFixed(2), text, slot }));
}

function closeTimes(lines, duration) {
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].start;
    const next = i + 1 < lines.length ? lines[i + 1].start : Infinity;
    const longest = Math.max(1.6, Math.min(7, Array.from(lines[i].text).length / 3.2));
    let end = Math.min(start + longest, Number.isFinite(next) ? next - opts.gap : duration - 0.6);
    if (end < start + 1.0) end = Math.min(Number.isFinite(next) ? next : duration - 0.2, start + 1.0);
    lines[i].start = +start.toFixed(2);
    lines[i].end = +Math.max(start + 0.8, end).toFixed(2);
  }
  return lines;
}

function cjk(s) {
  return Array.from(String(s)).filter(ch => /[\u3400-\u9fff]/.test(ch)).length;
}

function writeScript(lines, lyricsName) {
  const rows = lines.map(l => `      { start: ${l.start}, end: ${l.end}, text: ${JSON.stringify(l.text)} }`).join(',\n');
  return `/* 全片唯一文案源：底部歌词 + 片头/片尾字。
   由 tools/song.js 从「${lyricsName}」导入；换歌或改句子后重跑 npm run song。
   时间是分镜基准的绝对秒数，句子可以跨切点；按换气点手动微调 start/end 即可。 */
(function (root) {
  'use strict';

  const SCRIPT = {
    subtitles: [
${rows}
    ]
  };

  if (root) root.FILM_SCRIPT = SCRIPT;
  if (typeof module === 'object' && module.exports) module.exports = SCRIPT;
})(typeof window !== 'undefined' ? window : null);
`;
}

function main() {
  if (!(opts.gap >= 0 && opts.gap < 2)) throw new Error('--gap 必须在 0–2 秒之间');
  if (!fs.existsSync(opts.lyrics)) throw new Error('歌词文件不存在：' + opts.lyrics);

  const songDur = CONFIG.duration;
  let lines;
  const isLrc = /\.lrc$/i.test(opts.lyrics);
  if (isLrc) {
    lines = readLrc(opts.lyrics);
    if (lines.length < 2) throw new Error('LRC 里没有解析到带时间码的歌词行');
  } else {
    lines = readText(opts.lyrics, songDur).map(l => ({ start: l.start, text: l.text }));
  }
  closeTimes(lines, songDur);

  /* 静态检查：读不完、太长、越界都在这里先亮出来 */
  const warnings = [];
  for (const l of lines) {
    const n = cjk(l.text);
    if (n < 4) warnings.push('太短（' + n + ' 字）：' + l.text);
    if (n > 20) warnings.push('太长（' + n + ' 字）：' + l.text);
    if (n / Math.max(0.4, l.end - l.start) > 7) warnings.push('语速偏快：' + l.text);
    if (l.end > songDur) warnings.push('超出片长 ' + songDur + 's：' + l.text);
  }

  let audioInfo = '未提供歌曲（保留现有 assets/music.wav）';
  if (opts.audio) {
    if (!fs.existsSync(opts.audio)) throw new Error('歌曲文件不存在：' + opts.audio);
    const dur = audioDuration(opts.audio);
    audioInfo = path.basename(opts.audio) + (dur ? ' · ' + dur.toFixed(1) + 's' : '') +
      (dur && dur < songDur ? '（短于片长，encode 会自动循环）' : '');
    if (!opts.dry) toWav(opts.audio, path.resolve(ROOT, opts.out));
  }

  console.log('\nsong · ' + CONFIG.title);
  console.log('  ─────────────────────────────────');
  console.log('  歌曲    ' + audioInfo);
  console.log('  歌词    ' + lines.length + ' 句 · ' + (isLrc ? 'LRC 时间码' : '纯文本均分') + (opts.dry ? ' · dry-run' : ''));
  lines.forEach((l, i) => {
    console.log('  ' + String(i + 1).padStart(2, '0') + '  ' + l.start.toFixed(2).padStart(6) + '–' + l.end.toFixed(2).padStart(6) +
      's  ' + cjk(l.text) + ' 字  ' + l.text);
  });
  warnings.forEach(w => console.log('  ! ' + w));

  if (opts.dry) {
    console.log('\n未写文件（--dry-run）。');
    return;
  }

  const scriptPath = path.join(ROOT, 'js', 'script.js');
  fs.writeFileSync(scriptPath, writeScript(lines, path.basename(opts.lyrics)));
  console.log('\n已写入 js/script.js 与 ' + (opts.audio ? opts.out : '（配乐未改）'));
  console.log('下一步：按歌词重排 js/film.js 的分镜，再 npm test && node render.js --at <关键秒> 目检。');
}

main();
