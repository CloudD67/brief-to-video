#!/usr/bin/env node
/**
 * Look 推荐：给一句 brief，按关键词打分返回 top look 与备选。
 * 用于在写场景之前确定主题/版式/动效，或把决定权交给 AI 时核对依据。
 *
 *   node tools/pick-look.js "成都城市品牌片，文化气质，30 秒"
 *   node tools/pick-look.js --theme swiss --layout grid "数据平台发布"
 *   node tools/pick-look.js --list
 *   node tools/pick-look.js --json "AI 开发者工具，功能介绍"
 *   node "$SKILL/assets/template/tools/pick-look.js" --root "$SKILL/assets/template" --json "brief"
 */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opts = { theme: null, layout: null, list: false, json: false, root: null };
const words = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--theme') opts.theme = args[++i];
  else if (a === '--layout') opts.layout = args[++i];
  else if (a === '--root') {
    const dir = args[++i];
    if (!dir) throw new Error('--root 需要一个目录');
    opts.root = path.resolve(dir);
  }
  else if (a === '--list') opts.list = true;
  else if (a === '--json') opts.json = true;
  else if (a === '-h' || a === '--help') {
    console.log('用法: node tools/pick-look.js [brief…] [--root <dir>] [--theme <t>] [--layout <l>] [--list] [--json]');
    process.exit(0);
  } else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else words.push(a);
}

const rootPinned = !!opts.root;
if (!opts.root) opts.root = path.resolve('.');
if (!rootPinned && words.length === 1 && !opts.list && fs.existsSync(path.join(words[0], 'js', 'config.js'))) {
  opts.root = path.resolve(words.shift());
}
if (!fs.existsSync(path.join(opts.root, 'js', 'looks.js'))) {
  throw new Error('找不到 ' + path.join(opts.root, 'js', 'looks.js') + '；请在工程根目录运行，或用 --root 指向模板/工程目录');
}

const LOOKS = require(path.join(opts.root, 'js', 'looks.js'));
const configPath = path.join(opts.root, 'js', 'config.js');
const config = fs.existsSync(configPath) ? require(configPath) : {};

if (opts.list) {
  const rows = LOOKS.listLooks();
  console.log('look 目录 · ' + rows.length + ' 个');
  rows.forEach(l => {
    console.log('  ' + l.id.padEnd(18) + l.theme.padEnd(13) + l.layout.padEnd(11) + l.motion.padEnd(11) + l.name);
    console.log('    ' + l.desc);
    console.log('    适合 ' + l.bestFor);
  });
  process.exit(0);
}

let brief = words.join(' ').trim();
if (!brief) brief = [config.brief, config.title, config.slogan, config.brandSub].filter(Boolean).join(' ');
if (!brief) throw new Error('给一句 brief，或在 config.js 里填 brief');

if (opts.theme && !LOOKS.LOOKS.some(l => l.theme === opts.theme)) {
  throw new Error('未知主题 "' + opts.theme + '"；可用：' + Array.from(new Set(LOOKS.LOOKS.map(l => l.theme))).join(' / '));
}
if (opts.layout && !LOOKS.LAYOUTS[opts.layout]) {
  throw new Error('未知版式 "' + opts.layout + '"；可用：' + Object.keys(LOOKS.LAYOUTS).join(' / '));
}

let ranked = LOOKS.rankLooks(brief, { theme: opts.theme });
if (opts.layout) {
  ranked = ranked
    .map(r => Object.assign({}, r, { score: r.score + (r.look.layout === opts.layout ? 4 : 0) }))
    .sort((a, b) => b.score - a.score);
}
const top = ranked[0];
const confidence = top.hits.length ? 'high' : (top.score > 0 ? 'medium' : 'fallback');

if (opts.json) {
  console.log(JSON.stringify({
    brief,
    theme: opts.theme || null,
    layout: opts.layout || null,
    recommendation: {
      id: top.look.id, name: top.look.name, theme: top.look.theme,
      layout: top.look.layout, motion: top.look.motion,
      score: top.score, confidence, hits: top.hits
    },
    ranking: ranked.map(r => ({
      id: r.look.id, name: r.look.name, score: r.score, hits: r.hits,
      theme: r.look.theme, layout: r.look.layout, motion: r.look.motion
    }))
  }, null, 2));
  process.exit(0);
}

console.log('look · ' + brief);
console.log('  推荐  ' + top.look.id + '  ' + top.look.name);
console.log('        ' + top.look.theme + ' / ' + top.look.layout + ' / ' + top.look.motion);
console.log('  依据  ' + confidence + ' · 得分 ' + top.score + (top.hits.length ? ' · 命中 ' + top.hits.join('、') : ' · 无关键词命中'));
console.log('  ' + top.look.desc);
console.log('\n  备选');
ranked.slice(1, 5).forEach(r => {
  console.log('    ' + r.look.id.padEnd(18) + String(r.score).padStart(3) + '  ' + (r.hits.length ? r.hits.slice(0, 3).join('、') : '—'));
});
console.log('\n  用法  node render.js --look ' + top.look.id);
console.log('        node render.js --look ' + top.look.id + ' --layout ' + top.look.layout);
console.log('  全部  node tools/pick-look.js --list');
