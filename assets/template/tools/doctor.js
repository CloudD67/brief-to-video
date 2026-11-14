#!/usr/bin/env node
/**
 * 环境体检：Node / 依赖 / Chrome / ffmpeg / 磁盘 / 主题 / 工具链。
 * 渲染前先跑一遍，把「跑到一半才失败」的问题提前暴露。
 *
 *   node doctor.js [project-dir] [--style swiss] [--chrome <path>] [--json qa/doctor.json]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let root = '.';
const opts = { json: null, chrome: null, style: null };

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') opts.json = args[++i];
  else if (a === '--chrome') opts.chrome = args[++i];
  else if (a === '--style') opts.style = args[++i];
  else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else root = a;
}

root = path.resolve(root);
const CONFIG_PATH = path.join(root, 'js', 'config.js');
if (!fs.existsSync(CONFIG_PATH)) {
  console.error('找不到 ' + CONFIG_PATH + '，请把工程目录作为第一个参数');
  process.exit(1);
}
const CONFIG = require(CONFIG_PATH);

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];

const REQUIRED_TOOLS = [
  'server.js', 'render.js', 'encode.js',
  'tools/check-project.js', 'tools/qa-layout.js', 'tools/qa-timing.js',
  'tools/qa-stills.js', 'tools/qa-all.js', 'tools/doctor.js',
  'tools/grab.js', 'tools/style-gallery.js', 'tools/pick-look.js', 'tools/look-gallery.js',
  'tools/voiceover.js', 'tools/prep-media.js',
  'js/looks.js', 'js/media.js', 'styles/layouts.css', 'styles/portrait.css'
];

const rows = [];
function row(level, name, detail, hint) {
  rows.push({ level, name, detail: detail || '', hint: hint || '' });
}

function versionOf(pkg) {
  try {
    return require(pkg).version;
  } catch (e) {
    return null;
  }
}

function firstLine(text) {
  return String(text || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
}

function checkNode() {
  const v = process.version.replace(/^v/, '');
  const major = Number(v.split('.')[0]);
  if (major >= 18) row('ok', 'node', process.version);
  else row('error', 'node', process.version, '需要 Node ≥ 18（建议 20/22 LTS）');
}

function checkFiles() {
  REQUIRED_TOOLS.forEach(f => {
    if (!fs.existsSync(path.join(root, f))) row('error', '工程文件', '缺少 ' + f, '从模板重新拷贝，或补回该文件');
  });
  ['index.html', 'js/config.js', 'js/script.js', 'js/timeline.js', 'styles/tokens.css'].forEach(f => {
    if (!fs.existsSync(path.join(root, f))) row('error', '工程文件', '缺少 ' + f);
  });
  try {
    fs.accessSync(root, fs.constants.W_OK);
    row('ok', '写入权限', path.basename(root) + '/ 可写');
  } catch (e) {
    row('error', '写入权限', root + ' 不可写', 'chmod 或换一个目录');
  }
}

function checkDeps() {
  const nm = path.join(root, 'node_modules');
  if (!fs.existsSync(nm)) {
    row('error', '依赖', '缺少 node_modules/', '在工程目录运行 npm install');
    return;
  }
  const puppeteer = versionOf(path.join(nm, 'puppeteer-core', 'package.json'));
  if (puppeteer) row('ok', '依赖', 'puppeteer-core ' + puppeteer);
  else row('error', '依赖', '缺少 puppeteer-core', 'npm install（或 npm i puppeteer-core）');

  let ff = null;
  try {
    ff = require(path.join(nm, '@ffmpeg-installer', 'ffmpeg'));
  } catch (e) { /* fall through */ }
  if (ff && ff.path && fs.existsSync(ff.path)) {
    row('ok', '依赖', '@ffmpeg-installer/ffmpeg ' + (versionOf(path.join(nm, '@ffmpeg-installer', 'ffmpeg', 'package.json')) || ''));
  }
}

function findChrome() {
  if (opts.chrome) return opts.chrome;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  return CHROME_CANDIDATES.find(p => fs.existsSync(p)) || null;
}

function checkChrome() {
  const p = findChrome();
  if (!p) {
    row('error', 'chrome', '未找到 Chrome/Chromium', '安装 Chrome，或用 --chrome 指定路径 / 设置 CHROME_PATH');
    return null;
  }
  if (!fs.existsSync(p)) {
    row('error', 'chrome', '指定路径不存在: ' + p);
    return null;
  }
  const r = spawnSync(p, ['--version'], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) {
    row('error', 'chrome', firstLine(r.stderr) || '无法执行 ' + p, '检查可执行权限');
    return p;
  }
  row('ok', 'chrome', firstLine(r.stdout) + '  ' + p);
  return p;
}

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  try {
    const p = require(path.join(root, 'node_modules', '@ffmpeg-installer', 'ffmpeg')).path;
    if (p && fs.existsSync(p)) return p;
  } catch (e) { /* ignore */ }
  try {
    const p = require(path.join(root, 'node_modules', 'ffmpeg-static'));
    if (p && fs.existsSync(p)) return p;
  } catch (e) { /* ignore */ }
  const which = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (!which.error && which.status === 0) return 'ffmpeg';
  return null;
}

function checkFfmpeg() {
  const p = findFfmpeg();
  if (!p) {
    row('error', 'ffmpeg', '未找到 ffmpeg', 'npm install，或 brew install ffmpeg / 设置 FFMPEG_PATH');
    return;
  }
  const r = spawnSync(p, ['-hide_banner', '-version'], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) {
    row('error', 'ffmpeg', '无法执行 ' + p);
    return;
  }
  const m = (r.stdout || '').match(/ffmpeg version (\S+)/);
  row('ok', 'ffmpeg', (m ? m[1] : firstLine(r.stdout)) + '  ' + p);
}

function checkDisk() {
  if (typeof fs.statfsSync !== 'function') {
    row('warn', '磁盘', '当前 Node 不支持 statfs，跳过空间检查');
    return;
  }
  let free = null;
  try {
    const st = fs.statfsSync(root);
    free = st.bsize * st.bavail;
  } catch (e) {
    row('warn', '磁盘', '无法读取磁盘空间: ' + e.message);
    return;
  }
  const width = CONFIG.width * 2;
  const height = CONFIG.height * 2;
  const frames = Math.round((CONFIG.duration || 60) * (CONFIG.fps || 30));
  const perFrame = 8.5 * 1024 * 1024 * ((width * height) / (3840 * 2160));
  const need = frames * perFrame;
  const gb = n => (n / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  const detail = '渲染约需 ' + gb(need) + '（' + frames + ' 帧 @' + width + 'x' + height + ' PNG）· 可用 ' + gb(free);
  if (free < need * 0.6) row('error', '磁盘', detail, '清理空间，或降低 --scale / 片长，或先清空 frames/');
  else if (free < need * 1.3) row('warn', '磁盘', detail, '空间偏紧；frames/ 会一直涨，渲完记得清理旧帧');
  else row('ok', '磁盘', detail);
}

function checkTheme() {
  const dir = path.join(root, 'styles', 'themes');
  if (!fs.existsSync(dir)) {
    row('error', '主题', '缺少 styles/themes/');
    return;
  }
  const themes = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => f.replace(/\.css$/, '')).sort();
  let style = opts.style || (CONFIG.style && CONFIG.style !== 'auto' ? CONFIG.style : null);
  let lookId = null;
  try {
    const LOOKS = require(path.join(root, 'js', 'looks.js'));
    const requested = CONFIG.look && CONFIG.look !== 'auto' ? CONFIG.look : null;
    const brief = [CONFIG.brief, CONFIG.title, CONFIG.slogan, CONFIG.brandSub].filter(Boolean).join(' ');
    const look = requested ? LOOKS.getLook(requested) : LOOKS.chooseLook(brief, { theme: style }).look;
    if (look) {
      lookId = look.id;
      if (!style) style = look.theme;
    }
  } catch (e) {
    row('warn', 'look', 'js/looks.js 不可用: ' + e.message);
  }
  if (!themes.length) row('error', '主题', '没有任何主题 CSS');
  else if (themes.indexOf(style) === -1) row('error', '主题', '当前风格 "' + style + '" 不存在', '可用：' + themes.join(' / '));
  else row('ok', '主题', style + (lookId ? ' · look ' + lookId : '') + '（' + themes.length + ' 个）');
}

function checkMusic() {
  const file = path.join(root, 'assets', 'music.wav');
  if (fs.existsSync(file) && fs.statSync(file).size > 1024) {
    row('ok', '配乐', 'assets/music.wav ' + (fs.statSync(file).size / 1024 / 1024).toFixed(1) + ' MB');
  } else {
    row('warn', '配乐', 'assets/music.wav 缺失或为空', 'npm run music 生成，或放入自己的音乐');
  }
}

function main() {
  checkNode();
  checkFiles();
  checkDeps();
  checkChrome();
  checkFfmpeg();
  checkDisk();
  checkTheme();
  checkMusic();

  const errors = rows.filter(r => r.level === 'error');
  const warnings = rows.filter(r => r.level === 'warn');

  console.log('doctor · ' + CONFIG.title);
  rows.forEach(r => {
    const mark = r.level === 'ok' ? '✓' : r.level === 'warn' ? '!' : '✗';
    console.log('  ' + mark + ' ' + r.name.padEnd(8) + ' ' + r.detail);
    if (r.hint && r.level !== 'ok') console.log('    → ' + r.hint);
  });
  console.log('');
  console.log(errors.length
    ? '失败 ' + errors.length + ' 项 · 警告 ' + warnings.length + ' 项。先修完再渲染。'
    : '环境就绪' + (warnings.length ? '（' + warnings.length + ' 项提醒）' : '') + '。');

  if (opts.json) {
    const file = path.resolve(root, opts.json);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      title: CONFIG.title,
      generated: new Date().toISOString(),
      rows,
      errors: errors.map(r => r.name + ': ' + r.detail),
      warnings: warnings.map(r => r.name + ': ' + r.detail)
    }, null, 2) + '\n');
  }
  if (errors.length) process.exit(1);
}

try {
  main();
} catch (e) {
  console.error('doctor 失败：' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}
