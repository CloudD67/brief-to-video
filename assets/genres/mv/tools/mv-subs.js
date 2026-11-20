#!/usr/bin/env node
/**
 * 把 js/script.js 的歌词时间轴写成 assets/subs.ass，供 CG 引擎的成片烧录。
 *
 *   node tools/mv-subs.js                 # → assets/subs.ass
 *   node tools/mv-subs.js --out s.ass     # 指定输出
 *   node tools/mv-subs.js --dry-run       # 只打印时间轴
 *
 * 2D 引擎（engine: "paper"）的歌词由 Canvas 直接画在画面底部；
 * 3D 引擎（engine: "cg"）里歌词不在场景内，编码时用 encode.js --subs 烧进去。
 * 样式只跟随 config.art 的纸色与墨色，不引入新的视觉系统。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = require(path.join(ROOT, 'js/config.js'));
const SCRIPT = require(path.join(ROOT, 'js/script.js'));

const DEFAULTS = { out: 'assets/subs.ass', dry: false };

function usage() {
  console.log(`${CONFIG.title} · MV 歌词字幕（ASS）

用法: node tools/mv-subs.js [options]

  --out <file>   输出路径（默认 assets/subs.ass）
  --dry-run      只打印时间轴，不写文件
  -h, --help     显示帮助
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
      case '-h': case '--help': usage(); process.exit(0); break;
      case '--out': opts.out = next(); break;
      case '--dry-run': opts.dry = true; break;
      default: throw new Error('未知参数: ' + a + '\n使用 --help 查看用法');
    }
  }
  return opts;
}

/* '#f3e3c6' → '&H00C6E3F3'（ASS 是 AABBGGRR） */
function assColor(hex, alpha = '00') {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) throw new Error('颜色必须是 #rrggbb：' + hex);
  const r = m[1].slice(0, 2), g = m[1].slice(2, 4), b = m[1].slice(4, 6);
  return '&H' + alpha + b + g + r;
}

function assTime(sec) {
  const cs = Math.round(sec * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
}

function esc(text) {
  return String(text).replace(/\\/g, '＼').replace(/\{/g, '（').replace(/\}/g, '）').replace(/\r?\n/g, '\\N');
}

function build(lines) {
  const art = CONFIG.art || {};
  const primary = assColor(art.cream || '#f3e3c6');
  const outline = assColor(art.ink || '#0b1424');
  const back = assColor(art.ink || '#0b1424', '80');
  /* ASS 每个 Style 只能写一个字体名：Windows 没有苹方，用微软雅黑，否则 libass 掉到默认衬线体。 */
  const font = process.env.CG_SUB_FONT || (process.platform === 'win32' ? 'Microsoft YaHei' : 'PingFang SC');
  const fontSize = Math.round((CONFIG.height || 1080) * 0.05);
  const marginV = Math.round((CONFIG.height || 1080) * 0.078);

  const head = [
    '[Script Info]',
    '; ' + CONFIG.title + ' · 由 tools/mv-subs.js 从 js/script.js 生成',
    'ScriptType: v4.00+',
    'PlayResX: ' + (CONFIG.width || 1920),
    'PlayResY: ' + (CONFIG.height || 1080),
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Lyric,${font},${fontSize},${primary},${primary},${outline},${back},-1,0,0,0,100,100,1.2,0,1,2.0,1.4,2,120,120,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];
  const events = lines.map(l =>
    `Dialogue: 0,${assTime(l.start)},${assTime(l.end)},Lyric,,0,0,0,,{\\fad(180,180)}${esc(l.text)}`);

  return head.concat(events).join('\n') + '\n';
}

function validate(lines) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('js/script.js 里没有 subtitles');
  let prevEnd = -1;
  lines.forEach((l, i) => {
    if (!(l.start >= 0) || !(l.end > l.start)) throw new Error(`第 ${i + 1} 条歌词时间不合法：${l.start}-${l.end}`);
    if (l.start < prevEnd - 0.001) throw new Error(`第 ${i + 1} 条歌词与上一条重叠：${l.start} < ${prevEnd}`);
    if (l.end > (CONFIG.duration || 60) + 0.001) throw new Error(`第 ${i + 1} 条歌词超出片长：${l.end}`);
    prevEnd = l.end;
  });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const lines = (SCRIPT && SCRIPT.subtitles) || [];
  validate(lines);

  if (opts.dry) {
    lines.forEach((l, i) => console.log(`${String(i + 1).padStart(2)}  ${assTime(l.start)} → ${assTime(l.end)}  ${l.text}`));
    return;
  }

  const outPath = path.resolve(ROOT, opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, build(lines));
  const dur = lines.reduce((a, l) => a + (l.end - l.start), 0);
  console.log(`  ${CONFIG.title} · 歌词字幕`);
  console.log(`  条目    ${lines.length} 条 · 共 ${dur.toFixed(1)}s`);
  console.log(`  输出    ${path.relative(ROOT, outPath)}（编码时 node encode.js --subs ${opts.out}）`);
}

try {
  main();
} catch (err) {
  process.stderr.write('字幕生成失败：' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
}
