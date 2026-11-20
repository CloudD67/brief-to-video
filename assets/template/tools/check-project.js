#!/usr/bin/env node
/**
 * 工程体检：配置 / 主题契约 / 对比度 / 场景 / 剧本与字幕 / 引用 / 语法 / CSS / 颜色令牌。
 *
 *   node check-project.js [project-dir]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const root = path.resolve(process.argv[2] || '.');
const errors = [];
const warnings = [];
let config;
let script;
let scenes = [];
let sceneFiles = [];
let themes = [];
let tokenRoot = {};
let LOOKS = null;

const ROOT_TOKENS = [
  '--paper', '--paper-2', '--paper-3', '--paper-4', '--paper-hi',
  '--ink', '--ink-2', '--mute', '--faint',
  '--accent', '--accent-2',
  '--dark', '--dark-2', '--dark-3', '--on-dark', '--on-dark-2',
  '--font-display', '--font-sans', '--font-mono',
  '--sub-color', '--sub-size',
  '--ill-ink', '--ill-paper', '--warm',
  '--f1-sky', '--f1-mid', '--f1-gnd', '--f2-sky', '--f2-mid', '--f2-gnd',
  '--f3-sky', '--f3-mid', '--f3-gnd', '--f4-sky', '--f4-mid', '--f4-gnd',
  '--f5-sky', '--f5-mid', '--f5-gnd', '--f6-sky', '--f6-mid', '--f6-gnd'
];
const FRAME_TOKENS = ROOT_TOKENS.filter(k => /^--f[1-6]-/.test(k));

const THEME_REQUIRED = [
  '--paper', '--paper-2', '--paper-3',
  '--ink', '--ink-2', '--mute', '--faint',
  '--accent', '--dark', '--on-dark'
];
const THEME_TYPO = ['--font-display', '--sub-size'];

const CONTRAST_PAIRS = [
  { fg: '--ink', bg: '--paper', min: 10, label: '正文 / 纸色' },
  { fg: '--ink-2', bg: '--paper-2', min: 7, label: '次级文字 / 浅纸' },
  { fg: '--sub-color', bg: '--paper', min: 7, label: '字幕 / 纸色' },
  { fg: '--on-dark', bg: '--dark', min: 10, label: '深底文字 / 深色' },
  { fg: '--accent', bg: '--paper', min: 3, label: '强调色 / 纸色' },
  { fg: '--mute', bg: '--paper', min: 4.5, label: '弱化文字 / 纸色' }
];
let contrastSummary = null;

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function parseCssVars(text) {
  const out = {};
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;{}]+);/g;
  let m;
  while ((m = re.exec(clean))) out['--' + m[1]] = m[2].trim();
  return out;
}

function resolveColor(value, vars, depth) {
  if (!value || (depth || 0) > 8) return null;
  const v = String(value).trim();
  const alias = v.match(/^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/);
  if (alias) return resolveColor(vars[alias[1]], vars, (depth || 0) + 1);
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  const rgb = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (rgb) return '#' + [rgb[1], rgb[2], rgb[3]].map(n => {
    const x = Math.max(0, Math.min(255, Math.round(Number(n))));
    return x.toString(16).padStart(2, '0');
  }).join('');
  return null;
}

function colorLum(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  const c = [0, 2, 4].map(i => {
    let v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  const x = colorLum(a);
  const y = colorLum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function cssBraceBalance(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, s => s.replace(/[^\n]/g, ' '));
  let depth = 0;
  let quote = null;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quote) {
      if (c === quote && clean[i - 1] !== '\\') quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth < 0) {
        const line = clean.slice(0, i).split('\n').length;
        return { ok: false, why: '第 ' + line + ' 行多了一个 }' };
      }
    }
  }
  return depth === 0
    ? { ok: true }
    : { ok: false, why: '文件末尾缺 ' + depth + ' 个 }' };
}

function loadConfig() {
  const file = path.join(root, 'js', 'config.js');
  if (!fs.existsSync(file)) {
    err('缺少 js/config.js');
    return null;
  }
  delete require.cache[require.resolve(file)];
  return require(file);
}

function loadScript() {
  const file = path.join(root, 'js', 'script.js');
  if (!fs.existsSync(file)) {
    err('缺少 js/script.js（全片剧本与字幕）');
    return null;
  }
  delete require.cache[require.resolve(file)];
  try {
    return require(file);
  } catch (e) {
    err('js/script.js 加载失败: ' + e.message);
    return null;
  }
}

function loadScenes() {
  const dir = path.join(root, 'js', 'scenes');
  if (!fs.existsSync(dir)) {
    err('缺少 js/scenes/');
    return [];
  }
  sceneFiles = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  const box = {
    window: { FILM_CONFIG: config, FILM_SCRIPT: script, FILM_SCENES: [] },
    console: { log() {}, warn() {}, error() {} },
    Math, Number, String, Array, Object, JSON, Date, isFinite, parseFloat, parseInt
  };
  box.window.window = box.window;
  vm.createContext(box);
  for (const f of sceneFiles) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      vm.runInContext(code, box, { filename: f });
    } catch (e) {
      err('场景定义加载失败 ' + f + ': ' + e.message);
    }
  }
  return box.window.FILM_SCENES || [];
}

function checkThemes() {
  const dir = path.join(root, 'styles', 'themes');
  if (!fs.existsSync(dir)) {
    err('缺少 styles/themes/（至少需要 letterpress.css）');
    return;
  }
  themes = fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => f.replace(/\.css$/, '')).sort();
  if (!themes.length) err('styles/themes/ 里没有任何主题 CSS');
  if (themes.length && themes.indexOf('letterpress') === -1) {
    err('缺少默认主题 letterpress.css（配置未指定风格时的兜底）');
  }
  if (config && config.style && config.style !== 'auto' && themes.indexOf(config.style) === -1) {
    err('config.style = "' + config.style + '" 没有对应主题；可用：' + themes.join(' / '));
  }

  const tokenFile = path.join(root, 'styles', 'tokens.css');
  if (!fs.existsSync(tokenFile)) {
    err('缺少 styles/tokens.css');
  } else {
    tokenRoot = parseCssVars(fs.readFileSync(tokenFile, 'utf8'));
    const missing = ROOT_TOKENS.filter(k => !tokenRoot[k]);
    if (missing.length) err('tokens.css 缺少根令牌：' + missing.join(' '));
  }

  const rows = [];
  themes.forEach(t => {
    const text = fs.readFileSync(path.join(dir, t + '.css'), 'utf8');
    const brace = cssBraceBalance(text);
    if (!brace.ok) err('主题 ' + t + '.css 花括号不平衡：' + brace.why);

    const selector = new RegExp('html\\[data-style\\s*=\\s*["\']' + t + '["\']\\]');
    if (!selector.test(text)) {
      err('主题 ' + t + '.css 缺少选择器 html[data-style="' + t + '"]（?style=' + t + ' 不会生效）');
    }

    const vars = parseCssVars(text);
    if (t !== 'letterpress') {
      const missing = THEME_REQUIRED.filter(k => !vars[k]);
      if (missing.length) err('主题 ' + t + ' 未定义 ' + missing.join(' ') + '，会继承铅印配色');
      const typo = THEME_TYPO.filter(k => !vars[k]);
      if (typo.length) warn('主题 ' + t + ' 未覆盖 ' + typo.join(' ') + '，沿用铅印排版');
      const frames = FRAME_TOKENS.filter(k => vars[k]).length;
      if (frames > 0 && frames < FRAME_TOKENS.length) {
        warn('主题 ' + t + ' 只覆盖 ' + frames + '/' + FRAME_TOKENS.length + ' 个帧色令牌，其余继承铅印夜空，画风会混');
      }
    }

    const eff = Object.assign({}, tokenRoot, vars);
    CONTRAST_PAIRS.forEach(p => {
      const fg = resolveColor(eff[p.fg], eff);
      const bg = resolveColor(eff[p.bg], eff);
      if (!fg || !bg) {
        warn('主题 ' + t + ' 的「' + p.label + '」不是可解析的纯色（' + p.fg + ' / ' + p.bg + '），跳过对比度检查');
        return;
      }
      const ratio = contrast(fg, bg);
      rows.push({ theme: t, pair: p.fg + ' / ' + p.bg, label: p.label, ratio });
      if (ratio < p.min) {
        err('主题 ' + t + ' 对比度不足：' + p.label + ' ' + ratio.toFixed(2) + ':1 < ' + p.min + ':1（调深/调浅 ' + p.fg + '）');
      }
    });
  });

  if (rows.length) {
    const worst = rows.slice().sort((a, b) => a.ratio - b.ratio)[0];
    contrastSummary = { count: rows.length, worst };
  }
}

function checkLooks() {
  try {
    LOOKS = require(path.join(root, 'js', 'looks.js'));
  } catch (e) {
    err('js/looks.js 加载失败: ' + e.message);
    return;
  }
  const looks = LOOKS.listLooks();
  const lookIds = looks.map(l => l.id);
  if (config && config.look && config.look !== 'auto' && lookIds.indexOf(config.look) === -1) {
    err('config.look = "' + config.look + '" 不存在；可用：' + lookIds.join(' / '));
  }
  if (config && config.layout && config.layout !== 'auto' && !LOOKS.LAYOUTS[config.layout]) {
    err('config.layout = "' + config.layout + '" 不存在；可用：' + Object.keys(LOOKS.LAYOUTS).join(' / '));
  }
  looks.forEach(l => {
    if (themes.length && themes.indexOf(l.theme) === -1) {
      err('look "' + l.id + '" 指向的主题 "' + l.theme + '" 没有 CSS 文件');
    }
    if (!LOOKS.LAYOUTS[l.layout]) err('look "' + l.id + '" 指向未知版式 "' + l.layout + '"');
    if (!LOOKS.MOTION[l.motion]) err('look "' + l.id + '" 指向未知动效 "' + l.motion + '"');
    if (!l.keywords || !l.keywords.length) warn('look "' + l.id + '" 没有关键词，auto 永远选不到');
  });
  if (config && (!config.brief || !String(config.brief).trim())) {
    warn('config.brief 为空：look auto 只能靠片名/标语匹配，建议写一句需求（题材+气质+用途）');
  }

  const layoutsCss = path.join(root, 'styles', 'layouts.css');
  if (!fs.existsSync(layoutsCss)) {
    err('缺少 styles/layouts.css');
  } else {
    const text = fs.readFileSync(layoutsCss, 'utf8');
    Object.keys(LOOKS.LAYOUTS).forEach(name => {
      const re = new RegExp('html\\[data-layout\\s*=\\s*["\']' + name + '["\']\\]');
      if (!re.test(text)) err('styles/layouts.css 缺少 html[data-layout="' + name + '"] 规则');
    });
  }
  const portraitCss = path.join(root, 'styles', 'portrait.css');
  if (!fs.existsSync(portraitCss)) {
    err('缺少 styles/portrait.css');
  } else if (!/html\[data-aspect\s*=\s*["']portrait["']\]/.test(fs.readFileSync(portraitCss, 'utf8'))) {
    err('styles/portrait.css 缺少 html[data-aspect="portrait"] 规则');
  }
}

function checkCssHealth() {
  const files = ['tokens.css', 'base.css', 'components.css', 'scenes.css', 'layouts.css', 'portrait.css']
    .map(f => path.join(root, 'styles', f)).filter(f => fs.existsSync(f));
  ['base.css', 'components.css', 'scenes.css', 'layouts.css', 'portrait.css', 'screen.css', 'product.css'].forEach(f => {
    if (!fs.existsSync(path.join(root, 'styles', f))) err('缺少 styles/' + f);
  });
  files.forEach(f => {
    const brace = cssBraceBalance(fs.readFileSync(f, 'utf8'));
    if (!brace.ok) err('CSS 花括号不平衡 ' + path.relative(root, f) + '：' + brace.why);
  });
  return files.length;
}

function checkConfig() {
  if (!config) return;
  const { width, height, duration, fps, posterAt } = config;
  if (!(width > 0 && height > 0)) err('config.width/height 必须是正数');
  if (width % 2 || height % 2) err('config.width/height 必须是偶数（H.264 要求）');
  if (!((width === 1920 && height === 1080) || (width === 1080 && height === 1920))) {
    warn('非标准画布 ' + width + 'x' + height + '：场景坐标按 1920×1080 / 1080×1920 编写，可能出框；降分辨率请用 render.js --scale');
  }
  if (!(duration > 0)) err('config.duration 必须大于 0');
  if (!(fps > 0)) err('config.fps 必须大于 0');
  if (!(posterAt >= 0 && posterAt < 60)) err('config.posterAt 是 60s 基准时间，必须落在 0 与 60 之间');
  if (config.tcFps != null && !(config.tcFps > 0)) err('config.tcFps 必须是正数');
  if (!config.style) warn('config.style 未设置，将使用 letterpress');
  const frames = duration * fps;
  if (Math.abs(frames - Math.round(frames)) > 1e-6) warn('duration × fps 不是整数，最后一帧可能不完整');
  const posterFinal = posterAt * (duration / 60);
  if (posterFinal >= duration) err('封面帧 ' + posterFinal.toFixed(2) + 's 超出片长 ' + duration + 's');
  const cut = scenes.map(s => s.start * (duration / 60)).find(t => Math.abs(t - posterFinal) < 0.35);
  if (cut != null) warn('封面帧 ' + posterFinal.toFixed(2) + 's 贴着切点 ' + cut.toFixed(2) + 's（闪白），换个 posterAt');
}

/* 分镜契约：grammar 决定空间数、材质微距与人手痕迹的下限；屏幕占比只做诊断，
   超过经验值时警告、不拦交付——配额是参考，不是处方。镜头时间用成片绝对秒数。 */
function checkStoryboard() {
  if (!config) return { count: 0, grammar: null };
  const grammar = config.grammar;
  if (!grammar || grammar === 'auto') return { count: 0, grammar: null };
  if (grammar !== 'screen' && grammar !== 'world') {
    err('config.grammar 只能是 screen / world / auto，当前：' + grammar);
    return { count: 0, grammar: grammar };
  }
  const shots = Array.isArray(config.shots) ? config.shots : [];
  const duration = Number(config.duration) || 60;
  if (!shots.length) {
    err('config.shots 为空：' + (grammar === 'world' ? '世界语法' : '真屏语法') + '必须先写分镜表再画场景（见 references/hardware-promo-grammar.md）');
    return { count: 0, grammar: grammar };
  }
  const clean = shots.map((s, i) => ({
    n: i + 1,
    at: Number(s.at),
    dur: Number(s.dur),
    space: String(s.space || '').trim(),
    frame: String(s.frame || '').trim().toLowerCase(),
    subject: String(s.subject || '').trim(),
    screen: s.screen === true || /^(是|yes|y|✓|√|1|true)$/i.test(String(s.screen || '')),
    macro: s.macro === true || /macro|微距|细节/.test(String(s.frame || '') + ' ' + String(s.subject || '')),
    human: s.human === true || /手|人|背影|剪影|肩|指|呼气|袖/.test(String(s.subject || '') + ' ' + String(s.note || ''))
  }));
  clean.sort((a, b) => a.at - b.at);
  let prevEnd = 0;
  clean.forEach(s => {
    if (!(s.at >= 0)) err('分镜 ' + s.n + ' 的 at 必须是秒数');
    if (!(s.dur > 0)) err('分镜 ' + s.n + ' 的 dur 必须大于 0');
    if (!s.space) err('分镜 ' + s.n + ' 缺 space');
    if (!s.frame) err('分镜 ' + s.n + ' 缺 frame（wide / mid / close / macro）');
    if (!s.subject) err('分镜 ' + s.n + ' 缺 subject（这一镜谁/什么在动）');
    if (s.at < prevEnd - 0.35) err('分镜 ' + s.n + ' 与前一镜重叠超过 0.35s（' + s.at.toFixed(2) + 's < ' + prevEnd.toFixed(2) + 's）');
    prevEnd = Math.max(prevEnd, s.at + s.dur);
  });
  const last = clean[clean.length - 1];
  if (last && Math.abs(last.at + last.dur - duration) > 0.75) {
    warn('分镜表结束于 ' + (last.at + last.dur).toFixed(2) + 's，片长 ' + duration + 's；确认没有漏写的镜头');
  }
  const spaces = new Set(clean.map(s => s.space).filter(Boolean));
  const screenShare = clean.filter(s => s.screen).length / clean.length;
  const macros = clean.filter(s => s.macro).length;
  const humans = clean.filter(s => s.human).length;
  if (grammar === 'world') {
    const minSpaces = duration >= 60 ? 4 : duration >= 30 ? 3 : 2;
    if (spaces.size < minSpaces) {
      err('世界语法只有 ' + spaces.size + ' 个空间，下限 ' + minSpaces + '：硬件/实体产品必须活在多个真实空间里，不能一整支片一个背景');
    }
    if (screenShare > 0.30 + 1e-9) {
      warn('屏幕镜头占 ' + Math.round(screenShare * 100) + '%，超过经验值 30%：确认不是把实体产品拍成了功能演示（有意为之可以继续）');
    }
    const minMacro = duration >= 30 ? 2 : 1;
    if (macros < minMacro) {
      err('材质微距只有 ' + macros + ' 镜，下限 ' + minMacro + '：键帽、铰链、接口、铝边、织物至少给 2 个细节镜');
    }
    const minHuman = duration >= 30 ? 2 : 1;
    if (humans < minHuman) {
      err('人手/人迹镜头只有 ' + humans + ' 镜，下限 ' + minHuman + '：加手、背影、剪影或使用痕迹，画面才有体温');
    }
  } else {
    const minScreen = 0.5;
    if (screenShare < minScreen - 1e-9) {
      warn('真屏语法只有 ' + Math.round(screenShare * 100) + '% 屏幕镜头，低于经验值 50%：确认界面没有被空镜或隐喻替代（有意为之可以继续）');
    }
  }
  for (let i = 1; i < clean.length; i++) {
    const a = clean[i - 1], b = clean[i];
    if (a.space === b.space && a.subject === b.subject && a.frame === b.frame) {
      err('分镜 ' + a.n + ' 与 ' + b.n + ' 同空间、同主体、同景别：会像同一张画面复制，换构图或换动作');
    }
  }
  return {
    count: clean.length,
    grammar: grammar,
    spaces: spaces.size,
    screenShare: screenShare,
    macros: macros,
    humans: humans
  };
}

function checkScenes() {
  if (!scenes.length) {
    err('没有注册任何场景（window.FILM_SCENES 为空）');
    return;
  }
  const seen = new Set();
  scenes.slice().sort((a, b) => a.start - b.start).forEach((s, i) => {
    if (!s.id) err('第 ' + (i + 1) + ' 个场景缺少 id');
    if (seen.has(s.id)) err('场景 id 重复: ' + s.id);
    seen.add(s.id);
    if (!(s.end > s.start)) err('场景 ' + s.id + ' 的 end 必须大于 start');
    if (typeof s.mount !== 'function' || typeof s.seek !== 'function') err('场景 ' + s.id + ' 缺少 mount/seek');
  });
  const list = scenes.slice().sort((a, b) => a.start - b.start);
  if (Math.abs(list[0].start) > 1e-6) err('时间轴必须从 0 开始，首个场景 ' + list[0].id + ' 从 ' + list[0].start + ' 开始');
  if (Math.abs(list[list.length - 1].end - 60) > 0.01) {
    err('最后一个场景应结束于 60s 基准（当前 ' + list[list.length - 1].end + 's）；改片长只需改 config.duration');
  }
  for (let i = 1; i < list.length; i++) {
    const gap = list[i].start - list[i - 1].end;
    if (gap > 0.01) err('场景之间有空档: ' + list[i - 1].id + ' 结束 ' + list[i - 1].end + 's，' + list[i].id + ' 开始 ' + list[i].start + 's');
    else if (gap < -0.01) err('场景重叠: ' + list[i - 1].id + ' 与 ' + list[i].id + '（' + Math.abs(gap).toFixed(2) + 's）');
  }
  const scale = config ? config.duration / 60 : 1;
  list.forEach(s => {
    const slot = (s.end - s.start) * scale;
    if (slot < 1.5) warn('场景 ' + s.id + ' 只有 ' + slot.toFixed(2) + 's，观众来不及看清');
  });
}

function cjkLen(text) {
  return text.replace(/[\s\u3000，。、；：！？—…·「」『』（）()《》〈〉,.!?:;'"“”‘’-]/g, '').length;
}

function normalizeCues() {
  const list = [];
  if (!script) return list;
  if (!Array.isArray(script.subtitles)) {
    err('SCRIPT.subtitles 必须是数组（真屏片可以用画面内 caption，写空数组）');
    return list;
  }
  if (!script.subtitles.length) return list;
  const byId = {};
  scenes.forEach(s => { byId[s.id] = s; });
  script.subtitles.forEach((c, i) => {
    const n = i + 1;
    if (!c || typeof c !== 'object') { err('字幕 ' + n + ' 不是对象'); return; }
    if (typeof c.text !== 'string' || !c.text.trim()) err('字幕 ' + n + ' 缺少 text');
    let start, end, sceneId = null;
    if (typeof c.scene === 'string') {
      const s = byId[c.scene];
      if (!s) { err('字幕 ' + n + ' 指向不存在的场景: ' + c.scene); return; }
      const at = Number(c.at);
      const dur = c.dur != null ? Number(c.dur) : (c.end != null ? Number(c.end) - at : NaN);
      if (!(at >= 0)) err('字幕 ' + n + ' 的 at 必须 ≥ 0');
      if (!(dur > 0)) { err('字幕 ' + n + ' 缺少有效 dur'); return; }
      start = s.start + at;
      end = s.start + at + dur;
      sceneId = c.scene;
      if (end > s.end + 1e-6) {
        warn('字幕 ' + n + ' 越过场景 ' + c.scene + ' 的切点 ' + s.end + 's，运行时截断；把 dur 缩到 ' + Math.max(0, s.end - start).toFixed(2) + 's 内');
        end = s.end;
      }
      if (end <= start) { err('字幕 ' + n + ' 完全落在场景 ' + c.scene + ' 之外'); return; }
    } else if (Number.isFinite(Number(c.start)) && Number.isFinite(Number(c.end))) {
      start = Number(c.start);
      end = Number(c.end);
      sceneId = sceneIdAt(start);
    } else {
      err('字幕 ' + n + ' 格式无效（用 scene+at+dur，或 start+end）');
      return;
    }
    if (!(end > start)) err('字幕 ' + n + ' 的 end 必须大于 start');
    list.push({ n, start, end, scene: sceneId, text: c.text || '' });
  });
  return list.sort((a, b) => a.start - b.start);
}

function sceneIdAt(t) {
  const s = scenes.find(x => t >= x.start && t < x.end);
  return s ? s.id : null;
}

function checkScript() {
  if (!script) return;
  const cues = normalizeCues();
  const scale = config ? config.duration / 60 : 1;
  let prevEnd = 0;
  cues.forEach(c => {
    if (c.start < prevEnd - 0.01) warn('字幕 ' + c.n + ' 与前一条重叠（只显示一条）');
    prevEnd = Math.max(prevEnd, c.end);
    const dur = (c.end - c.start) * scale;
    if (dur < 0.7) warn('字幕 ' + c.n + ' 只有 ' + dur.toFixed(2) + 's，阅读时间偏短');
    const chars = cjkLen(c.text);
    const speed = chars / Math.max(0.001, dur);
    if (speed > 7.2) warn('字幕 ' + c.n + ' 语速 ' + speed.toFixed(1) + ' 字/秒（>7.2），念不完：「' + c.text.slice(0, 18) + '」');
  });
  if (cues.length && cues[cues.length - 1].end > 60.01) {
    err('字幕结束于 ' + cues[cues.length - 1].end + 's，超出 60s 基准');
  }
  for (let i = 1; i < cues.length; i++) {
    const gap = cues[i].start - cues[i - 1].end;
    if (gap > 3.5) {
      warn('字幕空档 ' + (cues[i - 1].end * scale).toFixed(1) + '–' + (cues[i].start * scale).toFixed(1) + 's（' + (gap * scale).toFixed(1) + 's 无字幕）');
    }
  }
  scenes.forEach(s => {
    if (!script[s.id] || typeof script[s.id] !== 'object') {
      err('SCRIPT 缺少场景文案: ' + s.id + '.{}（场景从 SCRIPT 读取全部可见文字）');
    }
  });
  checkPlaceholders(script, 'SCRIPT');
}

function checkPlaceholders(node, at) {
  if (typeof node === 'string') {
    const t = node.trim();
    if (/^[—–\-…]+$/.test(t) && t.length > 0) err(at + ' 是占位符「' + t + '」，换成真实文字');
    if (/NaN|undefined/.test(node)) {
      err(at + ' 含无效值（NaN/undefined）：「' + node.slice(0, 40) + '」');
    } else if (/\{(duration|width|height|fps)\}/.test(node) === false && /\{[a-z]+\}/.test(node)) {
      warn(at + ' 含未知注入占位符（只支持 duration/width/height/fps）：「' + node.slice(0, 40) + '」');
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((x, i) => checkPlaceholders(x, at + '[' + i + ']'));
    return;
  }
  if (node && typeof node === 'object') {
    Object.keys(node).forEach(k => {
      if (k === 'subtitles') return;
      checkPlaceholders(node[k], at + '.' + k);
    });
  }
}

function checkScriptRefs() {
  const index = path.join(root, 'index.html');
  if (!fs.existsSync(index)) {
    err('缺少 index.html');
    return;
  }
  const html = fs.readFileSync(index, 'utf8');
  sceneFiles.forEach(f => {
    if (!html.includes('js/scenes/' + f)) err('index.html 未引用场景脚本: js/scenes/' + f);
  });
  if (!html.includes('js/config.js')) err('index.html 未在场景之前引用 js/config.js');
  if (!html.includes('js/script.js')) err('index.html 未在场景之前引用 js/script.js');
  if (!html.includes('js/looks.js')) err('index.html 未引用 js/looks.js（look 目录）');
  if (!html.includes('js/style.js')) err('index.html 未引用 js/style.js（风格切换）');
  if (!html.includes('js/media.generated.js')) err('index.html 未引用 js/media.generated.js（素材清单）');
  if (!html.includes('js/media.js')) err('index.html 未引用 js/media.js（素材预处理）');
  if (!html.includes('styles/layouts.css')) err('index.html 未引用 styles/layouts.css（版式骨架）');
  if (!html.includes('styles/portrait.css')) err('index.html 未引用 styles/portrait.css（竖屏重排）');
  if (!html.includes('js/timeline.js')) err('index.html 未引用 js/timeline.js');
  if (config && config.style && config.style !== 'auto' && !html.includes('styles/themes/' + config.style + '.css')) {
    err('index.html 没有引入当前风格主题 styles/themes/' + config.style + '.css');
  }
  themes.forEach(t => {
    if (!html.includes('styles/themes/' + t + '.css')) warn('index.html 未引入主题 ' + t + '.css，?style=' + t + ' 会失效');
  });
  if (/<ol id="subs"[\s\S]*?<li/.test(html)) warn('index.html 里还有手写字幕 <li>，字幕应写在 js/script.js');
}

function checkMedia() {
  const manifestFile = path.join(root, 'js', 'media.generated.js');
  let manifest = {};
  if (fs.existsSync(manifestFile)) {
    try {
      const vm = require('vm');
      const sandbox = { window: {} };
      vm.runInNewContext(fs.readFileSync(manifestFile, 'utf8'), sandbox, { timeout: 1000 });
      manifest = sandbox.window.FILM_MEDIA || {};
    } catch (e) {
      err('js/media.generated.js 解析失败: ' + e.message);
      return 0;
    }
  }
  const merged = Object.assign({}, config && config.mediaFrames ? config.mediaFrames : {}, manifest);
  const ids = new Set(scenes.map(s => s.id));
  let count = 0;
  Object.keys(merged).forEach(key => {
    if (key !== '*' && !/^s\d+$/.test(key) && !/^[1-8]$/.test(key)) {
      warn('素材键 "' + key + '" 不是场景 id（s1）或镜头编号（1–8）');
    }
    if (/^s\d+$/.test(key) && !ids.has(key)) {
      warn('素材键 "' + key + '" 没有对应场景');
    }
    const raw = merged[key];
    const list = Array.isArray(raw) ? raw : [raw];
    list.forEach(item => {
      const src = typeof item === 'string' ? item : item && item.src;
      if (!src) return;
      count++;
      if (!fs.existsSync(path.resolve(root, src))) err('素材文件不存在: ' + src);
      if (!/\.(jpe?g|png|webp|avif)$/i.test(src)) warn('素材不是图片: ' + src + '（先运行 npm run media 抽帧）');
    });
  });

  const mediaDir = path.join(root, 'assets', 'media');
  if (fs.existsSync(mediaDir) && !count) {
    const hasRaw = fs.readdirSync(mediaDir).some(f => /\.(jpe?g|png|webp|avif|mp4|mov|webm)$/i.test(f));
    if (hasRaw) warn('assets/media/ 里有素材但清单为空：运行 npm run media');
  }

  const voiceFile = path.join(root, 'assets', 'voiceover.wav');
  if (fs.existsSync(voiceFile)) {
    const voiceJson = voiceFile.replace(/\.wav$/i, '.json');
    if (!fs.existsSync(voiceJson)) warn('有 assets/voiceover.wav 但缺少同名 .json 清单，重新运行 npm run voice');
  }
  return count;
}

function checkSyntax() {
  const skip = new Set(['node_modules', '.git', 'frames', 'stills', 'qa', 'out']);
  const files = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
      if (skip.has(d.name)) return;
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else if (d.name.endsWith('.js')) files.push(p);
    });
  })(root);
  files.forEach(f => {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) {
      const line = (r.stderr || '').split('\n').filter(l => l.trim()).slice(0, 3).join(' | ');
      err('语法错误 ' + path.relative(root, f) + ': ' + line);
    }
  });
  return files.length;
}

function checkUnits() {
  const dirs = [path.join(root, 'js')];
  const files = [];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    (function walk(d) {
      fs.readdirSync(d, { withFileTypes: true }).forEach(x => {
        const p = path.join(d, x.name);
        if (x.isDirectory()) walk(p);
        else if (x.name.endsWith('.js')) files.push(p);
      });
    })(dir);
  });
  const patterns = [
    { re: /\.style\.(left|top|right|bottom|width|height)\s*=\s*[\d.]+\s*;/g, why: '数字缺单位' },
    { re: /\.style\.(left|top|right|bottom)\s*=\s*[^;]*\?\s*[\d.]+\s*:/g, why: '三元分支里的数字缺单位' }
  ];
  let hits = 0;
  files.forEach(f => {
    const text = fs.readFileSync(f, 'utf8');
    const lines = text.split('\n');
    patterns.forEach(p => {
      let m;
      while ((m = p.re.exec(text))) {
        const line = text.slice(0, m.index).split('\n').length;
        err('CSS 单位问题（' + p.why + '）' + path.relative(root, f) + ':' + line + ' → ' + lines[line - 1].trim());
        hits++;
      }
    });
  });
  return hits;
}

/* 颜色只能住在 tokens.css 和 themes/*.css；场景与组件里写死颜色会让换肤失效 */
function checkColors() {
  const cssFiles = ['base.css', 'components.css', 'scenes.css', 'layouts.css', 'portrait.css', 'screen.css']
    .map(f => path.join(root, 'styles', f)).filter(f => fs.existsSync(f));
  const jsFiles = [];
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else if (d.name.endsWith('.js')) jsFiles.push(p);
    });
  })(path.join(root, 'js'));

  let hits = 0;
  cssFiles.forEach(f => {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*(?:\/\*|\*)/.test(line)) return;
      const re = /(?:^|[\s:(,])(#[0-9a-fA-F]{3,8}\b)/g;
      let m;
      while ((m = re.exec(line))) {
        const after = line.slice(m.index + m[0].length);
        if (/^\s*[{,]/.test(after)) continue;
        err('写死颜色 ' + path.relative(root, f) + ':' + (i + 1) + ' → ' + m[1] + '（改用 var(--token)）');
        hits++;
      }
      if (/rgba?\(/.test(line)) {
        err('写死颜色 ' + path.relative(root, f) + ':' + (i + 1) + ' → rgb(a)（改用 color-mix + var(--token)）');
        hits++;
      }
    });
  });

  jsFiles.forEach(f => {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (/querySelector|getElementById|closest|matches/.test(line)) return;
      // Canvas 只能用解析后的颜色：rgba(var(--token), a) 这类由令牌派生的调用不算写死
      if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*['"]?[0-9]/.test(line)) {
        warn('JS 里出现颜色字面量 ' + path.relative(root, f) + ':' + (i + 1) + '（推荐 var(--token)）');
        hits++;
      }
    });
  });
  return hits;
}

function main() {
  if (!fs.existsSync(root)) {
    console.error('目录不存在: ' + root);
    process.exit(1);
  }
  config = loadConfig();
  script = loadScript();
  themes = [];
  checkThemes();
  checkLooks();
  const cssCount = checkCssHealth();
  scenes = loadScenes();
  checkConfig();
  const storyboard = checkStoryboard();
  checkScenes();
  checkScript();
  checkScriptRefs();
  const mediaCount = checkMedia();
  const syntaxCount = checkSyntax();
  checkUnits();
  checkColors();

  const sorted = scenes.slice().sort((a, b) => a.start - b.start);
  const map = sorted.map(s => s.id + ' ' + s.start + '–' + s.end).join('  ·  ');
  const cueCount = script && Array.isArray(script.subtitles) ? script.subtitles.length : 0;
  let themed = config && config.style ? config.style : 'auto';
  const requestedLook = config && config.look ? config.look : 'auto';
  let lookLine = requestedLook;
  let layoutLine = config && config.layout ? config.layout : 'auto';
  if (LOOKS && config) {
    const brief = [config.brief, config.title, config.slogan, config.brandSub].filter(Boolean).join(' ');
    const resolved = requestedLook !== 'auto' ? { look: LOOKS.getLook(requestedLook), confidence: 'manual', hits: [] }
      : LOOKS.chooseLook(brief, { theme: config.style !== 'auto' ? config.style : null });
    if (resolved && resolved.look) {
      lookLine = resolved.look.id + (requestedLook === 'auto' ? '（自动 · ' + resolved.confidence + '）' : '（手动）');
      if (layoutLine === 'auto') layoutLine = resolved.look.layout;
      if (themed === 'auto') themed = resolved.look.theme;
    }
  }

  console.log('check-project · ' + (config ? config.title : root));
  console.log('  style    ' + themed + '  ·  ' + (themes.length ? themes.join(' / ') : 'MISSING'));
  console.log('  look     ' + lookLine + '  ·  版式 ' + layoutLine);
  console.log('  config   ' + (config ? config.width + 'x' + config.height + ' @' + config.fps + 'fps · ' + config.duration + 's · poster ' + (config.posterAt * (config.duration > 0 ? config.duration / 60 : 1)).toFixed(2) + 's' : 'MISSING'));
  console.log('  scenes   ' + (map || '—'));
  console.log('  script   ' + (script && Array.isArray(script.subtitles) ? cueCount + ' 条字幕 · ' + Object.keys(script).filter(k => k !== 'subtitles').length + ' 段文案' : 'MISSING'));
  if (storyboard.grammar) {
    const sbSpaces = storyboard.spaces || 0;
    const sbScreen = Math.round((storyboard.screenShare || 0) * 100);
    const sbMacros = storyboard.macros || 0;
    const sbHumans = storyboard.humans || 0;
    console.log('  分镜     ' + storyboard.grammar + ' 语法 · ' + storyboard.count + ' 镜 · ' + sbSpaces +
      ' 个空间 · 屏幕 ' + sbScreen + '% · 微距 ' + sbMacros + ' · 人迹 ' + sbHumans);
  }
  console.log('  media    ' + (mediaCount ? mediaCount + ' 张素材' : '内置插画（无外部素材）') +
    (fs.existsSync(path.join(root, 'assets', 'voiceover.wav')) ? '  ·  旁白已生成' : ''));
  console.log('  syntax   ' + syntaxCount + ' 个 JS 文件 · ' + cssCount + ' 个 CSS 文件');
  if (contrastSummary) {
    console.log('  contrast ' + contrastSummary.count + ' 组 · 最低 ' + contrastSummary.worst.ratio.toFixed(2) + ':1（' +
      contrastSummary.worst.theme + ' ' + contrastSummary.worst.pair + '，' + contrastSummary.worst.label + '）');
  }
  if (warnings.length) {
    console.log('\n警告：');
    warnings.forEach(w => console.log('  ! ' + w));
  }
  if (errors.length) {
    console.log('\n失败：');
    errors.forEach(e => console.log('  ✗ ' + e));
    console.log('\n共 ' + errors.length + ' 个问题，先修完再渲染。');
    process.exit(1);
  }
  console.log('\n通过：配置、风格契约、look/版式契约、对比度、场景覆盖、剧本/字幕、引用、素材清单、语法、CSS、单位、颜色令牌。');
  if (!fs.existsSync(path.join(root, 'assets', 'music.wav'))) {
    console.log('提示：还没有配乐，运行 npm run music 生成（或放入自己的 assets/music.wav）。');
  }
}

main();
