#!/usr/bin/env node
/**
 * 风格样片：同一时刻、每个主题各渲一张 1080p 静帧，用来挑选和目检风格。
 *
 *   node tools/style-gallery.js [project-dir] [--themes letterpress,swiss,...]
 *                               [--at 8,26,47] [--out qa/styles]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let root = '.';
const opts = { themes: null, at: null, out: 'qa/styles', chrome: null, maxWidth: 1280 };

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--themes') opts.themes = args[++i];
  else if (a === '--at') opts.at = args[++i];
  else if (a === '--out') opts.out = args[++i];
  else if (a === '--chrome') opts.chrome = args[++i];
  else if (a === '--max-width') opts.maxWidth = Number(args[++i]);
  else if (a === '-h' || a === '--help') {
    console.log('用法: node tools/style-gallery.js [project-dir] [--themes a,b] [--at 8,26,47] [--out qa/styles]');
    process.exit(0);
  } else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else root = a;
}

root = path.resolve(root);
const config = require(path.join(root, 'js', 'config.js'));

const themeDir = path.join(root, 'styles', 'themes');
const available = fs.readdirSync(themeDir).filter(f => f.endsWith('.css')).map(f => f.replace(/\.css$/, '')).sort();
const themes = (opts.themes ? opts.themes.split(',') : available).map(s => s.trim()).filter(Boolean);
const unknown = themes.filter(t => available.indexOf(t) === -1);
if (unknown.length) throw new Error('未知主题: ' + unknown.join(', ') + '（可用: ' + available.join(' / ') + '）');

const dur = config.duration || 60;
const at = opts.at ? opts.at.split(',').map(Number).filter(n => Number.isFinite(n)) : [0.12, 0.42, 0.78].map(f => +(dur * f).toFixed(2));
if (!at.length) throw new Error('--at 没有有效秒数');

const outRoot = path.resolve(root, opts.out);
console.log('style-gallery · ' + config.title);
console.log('  主题 ' + themes.join(' / '));
console.log('  时刻 ' + at.map(t => t.toFixed(2) + 's').join(', '));

themes.forEach(theme => {
  const dir = path.join(outRoot, theme);
  fs.mkdirSync(dir, { recursive: true });
  fs.readdirSync(dir).forEach(f => {
    if (/^still_.*\.(jpg|png)$/.test(f)) fs.rmSync(path.join(dir, f));
  });
  const renderArgs = [
    path.join(root, 'render.js'),
    '--scale', '1',
    '--format', 'jpg',
    '--out', path.relative(root, dir),
    '--at', at.join(','),
    '--style', theme
  ];
  if (opts.chrome) renderArgs.push('--chrome', opts.chrome);
  const r = spawnSync(process.execPath, renderArgs, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('  ✗ ' + theme + ' 渲染失败');
    return;
  }
  if (process.platform === 'darwin' && opts.maxWidth > 0) {
    fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).forEach(f => {
      spawnSync('sips', ['-Z', String(opts.maxWidth), path.join(dir, f)], { stdio: 'ignore' });
    });
  }
  console.log('  ✓ ' + theme + ' → ' + path.relative(process.cwd(), dir));
});

console.log('\n逐张看：' + path.relative(process.cwd(), outRoot) + '/<theme>/still_*.jpg');
console.log('重点：标题断行、字幕与画面文字是否打架、深色主题下插画是否还读得清。');
