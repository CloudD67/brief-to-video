#!/usr/bin/env node
/**
 * MV 环境体检：Node、依赖、Chrome、ffmpeg、磁盘、画布、配乐。
 *
 *   node tools/doctor.js .
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(process.argv[2] || '.');
const CONFIG = require(path.join(ROOT, 'js/config.js'));
const rows = [];
function row(level, name, msg, extra) {
  rows.push({ level, name, msg, extra: extra || '' });
}

/* Node */
const major = Number(process.versions.node.split('.')[0]);
row(major >= 18 ? 'ok' : 'error', 'Node', process.versions.node + (major >= 18 ? '' : '（需要 ≥18）'));

/* 依赖 */
try {
  require.resolve('puppeteer-core', { paths: [ROOT] });
  row('ok', 'puppeteer-core', '已安装');
} catch (e) {
  row('error', 'puppeteer-core', '未安装', '在工程目录运行 npm install');
}
let ffmpegInstaller = null;
try {
  ffmpegInstaller = require('@ffmpeg-installer/ffmpeg', { paths: [ROOT] });
  row(fs.existsSync(ffmpegInstaller.path) ? 'ok' : 'error', 'ffmpeg', ffmpegInstaller.path);
} catch (e) {
  row('error', 'ffmpeg', '未安装 @ffmpeg-installer/ffmpeg', 'npm install');
}

/* Chrome */
const candidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
];
const chrome = process.env.CHROME_PATH || candidates.find(p => fs.existsSync(p));
row(chrome ? 'ok' : 'error', 'Chrome', chrome || '未找到', '用 CHROME_PATH 指定');

/* 画布 */
if (CONFIG.width === 1920 && CONFIG.height === 1080) {
  row('ok', '画布', '原生 1920×1080 · ' + (CONFIG.renderScale === 2 ? '4K 矢量重画' : '1080p 默认'));
} else {
  row('error', '画布', CONFIG.width + 'x' + CONFIG.height + ' 不是原生 1920×1080', '剪纸场景按 1920×1080 写坐标，分辨率只改 renderScale');
}

/* 配置 */
if (CONFIG.genre === 'paper-story' && CONFIG.look === 'none' && CONFIG.style === 'none' && CONFIG.layout === 'none') {
  row('ok', '配置', 'paper-story · ' + CONFIG.duration + 's · ' + CONFIG.fps + 'fps · 无 look/版式');
} else {
  row('error', '配置', 'MV 的 look/style/layout 必须为 none，genre 必须为 paper-story', '宣传片语法混进来了');
}

/* 场景与剧本 */
const setsSrc = fs.readFileSync(path.join(ROOT, 'js/paper-sets.js'), 'utf8');
const scenes = Array.from(setsSrc.matchAll(/S\.([a-z][a-z-]*)\s*=\s*function/g), m => m[1]);
row(scenes.length ? 'ok' : 'error', '场景', scenes.length + ' 个：' + scenes.sort().join(' '));
const SCRIPT = require(path.join(ROOT, 'js/script.js'));
const cues = Array.isArray(SCRIPT.subtitles) ? SCRIPT.subtitles.length : 0;
row(cues ? 'ok' : 'warn', '歌词', cues + ' 条');

/* 磁盘：4K 按 4MB/帧估算（像素画面压缩率高） */
if (typeof fs.statfsSync === 'function') {
  try {
    const st = fs.statfsSync(ROOT);
    const free = st.bsize * st.bavail;
    const frames4k = Math.round(CONFIG.duration * CONFIG.fps);
    const need = frames4k * 4 * 1024 * 1024;
    const gb = n => (n / 1024 / 1024 / 1024).toFixed(1) + ' GB';
    row(free > need * 1.3 ? 'ok' : (free > need * 0.7 ? 'warn' : 'error'), '磁盘',
      '可用 ' + gb(free) + ' · 4K 预计 ' + gb(need) + '（' + frames4k + ' 帧）',
      free <= need * 0.7 ? '清理空间或先渲 1080p' : '');
  } catch (e) { /* skip */ }
}

/* 配乐 */
const music = path.join(ROOT, 'assets', 'music.wav');
row(fs.existsSync(music) ? 'ok' : 'info', '配乐', fs.existsSync(music) ? 'assets/music.wav' + (fs.statSync(music).size > 1024 ? '' : '（空文件）') : '未生成（npm run music 合成，或用 npm run song 接入用户歌曲）');

/* 语法 */
const check = spawnSync(process.execPath, ['--check', path.join(ROOT, 'js', 'timeline.js')], { stdio: 'pipe' });
row(check.status === 0 ? 'ok' : 'error', '时间轴', check.status === 0 ? 'js/timeline.js 语法正常' : String(check.stderr).split('\n')[0]);

/* 输出 */
console.log('\ndoctor · MV · ' + CONFIG.title);
console.log('  ─────────────────────────────────');
rows.forEach(r => {
  const tag = r.level === 'ok' ? '✓' : r.level === 'warn' ? '!' : r.level === 'error' ? '✗' : '·';
  console.log('  ' + tag + ' ' + r.name.padEnd(14) + r.msg + (r.extra ? '  ' + r.extra : ''));
});
const bad = rows.filter(r => r.level === 'error').length;
console.log('\n' + (bad ? '有 ' + bad + ' 项需要先修，再开渲。' : '环境就绪。'));
process.exit(bad ? 1 : 0);
