#!/usr/bin/env node
/**
 * 交付前自检修复（repair）：渲完不等于做完。
 *
 *   成片新鲜度  源文件 / 配乐比成片新 → 必须先重渲或重编码
 *   容器规格    时长 / 分辨率 / 帧率 / 音轨
 *   危险时刻抽帧  每个切点前后、每镜 78% 收尾、封面 → qa/repair/stills/
 *   像素探针    近空帧、声明时刻的画面触边（主体可能被裁）
 *   运动体检    读同目录 qa-motion.js：静止帧占比 / 最长静止段
 *   色彩体检    读同目录 qa-variety.js：主色域 / 色域数 / 明暗跨度
 *   修复清单    对白安全区 / 镜内动作 / 转场 / 状态一致
 *
 *   node tools/repair.js [project-dir] [--at 3,31.8] [--border 3,47]
 *        [--video out/final.mp4] [--json qa/repair.json] [--out qa/repair/stills]
 *        [--max-width 1440] [--skip-stills] [--strict] [--help]
 *
 * 退出码：errors > 0 → 1；--strict 时 warnings > 0 也 → 1。
 * 修完重渲重编，再跑一遍，errors=0 才算可交付。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HELP = `用法: node tools/repair.js [project-dir] [options]

交付前自检修复：新鲜度 → 容器 → 危险时刻抽帧 → 像素探针 → 修复清单。

  --at t1,t2        只检查这些时刻（默认：每个切点前 0.3s / 后 0.24s、82% 收尾、封面）
  --border t1,t2    对这些时刻跑“画面触边”探针（主体被裁的嫌疑帧）
  --video PATH      成片路径，默认 out/final.mp4
  --json PATH       报告路径，默认 qa/repair.json
  --out DIR         抽帧目录，默认 qa/repair/stills
  --max-width N     抽帧长边像素，默认 1440（0 = 原尺寸）
  --skip-stills     跳过抽帧与像素探针（只查新鲜度/容器/运动）
  --strict          警告也按失败处理（CI 用）
  --help            显示本帮助

修完：
  node render.js --at <嫌疑时刻>      局部核对
  node render.js --scale 1 && node encode.js   全片重渲
  npm run repair                      再自检一遍`;

const args = process.argv.slice(2);
const opts = {
  at: null,
  border: [],
  video: 'out/final.mp4',
  json: 'qa/repair.json',
  out: 'qa/repair/stills',
  maxWidth: 1440,
  skipStills: false,
  strict: false
};
let root = '.';

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-h' || a === '--help') {
    console.log(HELP);
    process.exit(0);
  } else if (a === '--at') opts.at = parseTimes(args[++i], '--at');
  else if (a === '--border') opts.border = parseTimes(args[++i], '--border');
  else if (a === '--video') opts.video = args[++i];
  else if (a === '--json') opts.json = args[++i];
  else if (a === '--out') opts.out = args[++i];
  else if (a === '--max-width') opts.maxWidth = Number(args[++i]);
  else if (a === '--skip-stills') opts.skipStills = true;
  else if (a === '--strict') opts.strict = true;
  else if (a.startsWith('--')) throw new Error('未知参数: ' + a + '（--help 查看用法）');
  else root = a;
}

function parseTimes(v, flag) {
  if (!v) throw new Error(flag + ' 需要一个逗号分隔的秒数列表');
  return v.split(',').map(Number).filter(n => Number.isFinite(n) && n >= 0);
}

root = path.resolve(root);
const CONFIG_PATH = path.join(root, 'js', 'config.js');
if (!fs.existsSync(CONFIG_PATH)) {
  console.error('找不到 ' + CONFIG_PATH + '，请把工程目录作为第一个参数');
  process.exit(1);
}
const CONFIG = require(CONFIG_PATH);
const DURATION = Number(CONFIG.duration) || 60;
const VIDEO = path.resolve(root, opts.video);

/* ---------- ffmpeg ---------- */

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const tries = [
    path.join(root, 'node_modules', '@ffmpeg-installer', 'ffmpeg'),
    path.join(__dirname, '..', 'node_modules', '@ffmpeg-installer', 'ffmpeg'),
    path.join(root, 'node_modules', 'ffmpeg-static'),
    path.join(__dirname, '..', 'node_modules', 'ffmpeg-static')
  ];
  for (const t of tries) {
    try {
      const p = require(t).path || require(t);
      if (p && fs.existsSync(p)) {
        try { fs.chmodSync(p, 0o755); } catch (e) {}
        return p;
      }
    } catch (e) { /* continue */ }
  }
  const which = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (!which.error && which.status === 0) return 'ffmpeg';
  throw new Error('未找到 ffmpeg：npm install，或设置 FFMPEG_PATH');
}

/* ---------- 采样时刻 ---------- */

/* story 的分镜在 js/film.js，直接导出数组（start / end，绝对秒）。
   CG 项目（engine: cg）没有机位表：优先读 out/*-manifest.json 的导演镜头表。 */
function loadShots() {
  try {
    const dir = path.join(root, 'out');
    if (fs.existsSync(dir)) {
      const file = fs.readdirSync(dir).filter((n) => /-manifest\.json$/.test(n)).sort()[0];
      if (file) {
        const m = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        const list = Array.isArray(m.shots) ? m.shots : [];
        if (list.length && Math.abs(Number(m.duration) - DURATION) < 0.05) {
          return list
            .filter(s => s && Number.isFinite(s.start) && Number.isFinite(s.sec) && s.sec > 0)
            .map(s => ({ id: s.id, start: s.start, dur: s.sec }));
        }
      }
    }
  } catch (e) { /* fall through */ }
  try {
    const film = require(path.join(root, 'js', 'film.js'));
    const list = Array.isArray(film) ? film : (film.shots || []);
    return list
      .filter(s => s && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
      .map(s => ({ id: s.id, start: s.start, dur: s.end - s.start }));
  } catch (e) {
    return [];
  }
}

function buildSamples(shots) {
  const clamp = t => Math.min(DURATION - 0.001, Math.max(0, +t.toFixed(3)));
  const out = [];
  const push = (t, label) => {
    t = clamp(t);
    if (!out.some(x => Math.abs(x.t - t) < 0.01)) out.push({ t, label });
  };
  const scale = DURATION / (Number(CONFIG.base) || 60);

  if (opts.at && opts.at.length) {
    opts.at.forEach(t => push(t, 'custom'));
  } else if (shots.length) {
    const list = shots.slice().sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      const cut = list[i].start * scale;
      push(cut - 0.25, '切点前 ' + cut.toFixed(2) + 's · ' + list[i - 1].id + '→' + list[i].id);
      push(cut + 0.24, '切点后 ' + cut.toFixed(2) + 's · ' + list[i].id);
    }
    list.forEach(s => push((s.start + s.dur * 0.78) * scale, '收镜前 · ' + s.id));
  } else {
    for (let i = 0; i < 8; i++) push(DURATION * i / 8, '均分 ' + i);
  }
  if (!opts.at) push((CONFIG.posterAt || DURATION - 1.7) * scale, '封面帧');
  return out.sort((a, b) => a.t - b.t);
}

/* ---------- 新鲜度 ---------- */

function walkNewest(dir, exts, skip, acc) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(name => {
    if (skip.has(name)) return;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkNewest(full, exts, skip, acc);
    else if (exts.some(e => name.endsWith(e))) {
      if (!acc.newest || st.mtimeMs > acc.newest.mtimeMs) acc.newest = { file: path.relative(root, full), mtimeMs: st.mtimeMs };
    }
  });
}

function freshness(videoStat) {
  const skip = new Set(['node_modules', 'frames', 'out', 'qa', 'stills', '.git']);
  const src = { newest: null };
  walkNewest(path.join(root, 'js'), ['.js'], skip, src);
  walkNewest(path.join(root, 'styles'), ['.css'], skip, src);
  walkNewest(path.join(root, 'assets', 'media'), ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.mp4', '.mov'], skip, src);
  const index = path.join(root, 'index.html');
  if (fs.existsSync(index)) {
    const st = fs.statSync(index);
    if (!src.newest || st.mtimeMs > src.newest.mtimeMs) src.newest = { file: 'index.html', mtimeMs: st.mtimeMs };
  }

  const audio = { newest: null };
  ['assets/music.wav', 'assets/voiceover.wav'].forEach(f => {
    const full = path.join(root, f);
    if (!fs.existsSync(full)) return;
    const st = fs.statSync(full);
    if (!audio.newest || st.mtimeMs > audio.newest.mtimeMs) audio.newest = { file: f, mtimeMs: st.mtimeMs };
  });

  const findings = [];
  const tol = 1000;
  if (src.newest && src.newest.mtimeMs > videoStat.mtimeMs + tol) {
    findings.push({
      level: 'ERROR', code: 'stale-render',
      message: src.newest.file + ' 比成片新：改了画面却没重渲。node render.js --scale 1 && node encode.js'
    });
  }
  if (audio.newest && audio.newest.mtimeMs > videoStat.mtimeMs + tol) {
    findings.push({
      level: 'ERROR', code: 'stale-audio',
      message: audio.newest.file + ' 比成片新：需要重编码（node encode.js）'
    });
  }
  return {
    ok: findings.length === 0,
    newestSource: src.newest ? { file: src.newest.file, at: new Date(src.newest.mtimeMs).toISOString() } : null,
    newestAudio: audio.newest ? { file: audio.newest.file, at: new Date(audio.newest.mtimeMs).toISOString() } : null,
    findings
  };
}

/* ---------- 容器 ---------- */

function container(ffmpeg) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', VIDEO], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const text = (r.stderr || '') + (r.stdout || '');
  const findings = [];
  const actual = { duration: null, width: null, height: null, fps: null, hasAudio: false };

  const dm = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (dm) actual.duration = (+dm[1]) * 3600 + (+dm[2]) * 60 + parseFloat(dm[3]);
  const vmA = text.match(/Stream #\d+:\d+.*?Video:.*?(\d{2,5})x(\d{2,5})/);
  if (vmA) { actual.width = +vmA[1]; actual.height = +vmA[2]; }
  const fm = text.match(/(\d+(?:\.\d+)?)\s*fps/);
  if (fm) actual.fps = +fm[1];
  actual.hasAudio = /Stream #\d+:\d+.*?Audio:/.test(text);

  if (actual.duration == null) {
    findings.push({ level: 'ERROR', code: 'unreadable', message: '读不出成片时长，确认 out/final.mp4 是有效视频' });
    return { actual, findings };
  }
  const fps = Number(CONFIG.fps) || 30;
  const wantDur = DURATION;
  if (Math.abs(actual.duration - wantDur) > 0.15 + 0.5 / fps) {
    findings.push({ level: 'ERROR', code: 'duration', message: '时长 ' + actual.duration.toFixed(2) + 's ≠ 配置 ' + wantDur + 's：帧数不全或渲染中断' });
  }
  const wantW = Number(CONFIG.width) || 1920;
  const wantH = Number(CONFIG.height) || 1080;
  if (actual.width && (actual.width !== wantW || actual.height !== wantH)) {
    findings.push({ level: 'ERROR', code: 'size', message: '分辨率 ' + actual.width + '×' + actual.height + ' ≠ 配置 ' + wantW + '×' + wantH });
  }
  if (actual.fps && Math.abs(actual.fps - fps) > 0.6) {
    findings.push({ level: 'WARN', code: 'fps', message: '成片 ' + actual.fps + 'fps ≠ 配置 ' + fps + 'fps' });
  }
  const audioExpected = ['assets/music.wav', 'assets/voiceover.wav'].some(f => fs.existsSync(path.join(root, f)));
  if (audioExpected && !actual.hasAudio) {
    findings.push({ level: 'ERROR', code: 'audio', message: '工程里有配乐/旁白，但成片没有音轨：检查 encode.js 日志' });
  }
  return { actual, findings };
}

/* ---------- 像素探针 ---------- */

function rawGray(ffmpeg, file, w, h) {
  const r = spawnSync(ffmpeg, [
    '-v', 'error', '-i', file,
    '-vf', 'scale=' + w + ':' + h + ':flags=area,format=gray',
    '-frames:v', '1', '-f', 'rawvideo', '-'
  ], { maxBuffer: 8 * 1024 * 1024 });
  return r.stdout && r.stdout.length >= w * h ? r.stdout.subarray(0, w * h) : null;
}

function rawRgb(ffmpeg, file, w, h) {
  const r = spawnSync(ffmpeg, [
    '-v', 'error', '-i', file,
    '-vf', 'scale=' + w + ':' + h + ':flags=area,format=rgb24',
    '-frames:v', '1', '-f', 'rawvideo', '-'
  ], { maxBuffer: 16 * 1024 * 1024 });
  return r.stdout && r.stdout.length >= w * h * 3 ? r.stdout.subarray(0, w * h * 3) : null;
}

/* 近空帧：灰度缩到 96×54，算标准差。纯色≈0，带文字的片尾卡远高于阈值。 */
function probeEmpty(ffmpeg, file) {
  const W = 96, H = 54;
  const buf = rawGray(ffmpeg, file, W, H);
  if (!buf) return { std: null, level: 'WARN', message: '读取失败' };
  let mean = 0;
  for (let i = 0; i < buf.length; i++) mean += buf[i];
  mean /= buf.length;
  let varSum = 0;
  for (let i = 0; i < buf.length; i++) { const d = buf[i] - mean; varSum += d * d; }
  const std = Math.sqrt(varSum / buf.length);
  let level = 'ok';
  if (std < 1.5) level = 'ERROR';
  else if (std < 4) level = 'WARN';
  return { std: +std.toFixed(2), mean: +mean.toFixed(1), level };
}

/* 触边探针：只对声明过的时刻跑。四角估背景色，量最外 2px 环里非背景像素占比。
   全出血构图会故意触边——报告按边给出比例，由人判定“裁切”还是“有意出画”。 */
function probeBorder(ffmpeg, file) {
  const W = 192, H = 108, ring = 2, patch = 10;
  const buf = rawRgb(ffmpeg, file, W, H);
  if (!buf) return { level: 'WARN', message: '读取失败' };
  const px = (x, y) => { const i = (y * W + x) * 3; return [buf[i], buf[i + 1], buf[i + 2]]; };
  const corners = [[0, 0], [W - patch, 0], [0, H - patch], [W - patch, H - patch]].map(([cx, cy]) => {
    let r = 0, g = 0, b = 0;
    for (let y = cy; y < cy + patch; y++) for (let x = cx; x < cx + patch; x++) {
      const p = px(x, y); r += p[0]; g += p[1]; b += p[2];
    }
    const n = patch * patch;
    return [r / n, g / n, b / n];
  });
  const med = ch => corners.map(c => c[ch]).sort((a, b) => a - b)[1.5 | 0];
  const bg = [med(0), med(1), med(2)];
  const diff = p => Math.max(Math.abs(p[0] - bg[0]), Math.abs(p[1] - bg[1]), Math.abs(p[2] - bg[2]));

  const edges = { top: [0, 0], bottom: [0, 0], left: [0, 0], right: [0, 0] };
  const mark = (edge, p) => { edges[edge][1]++; if (diff(p) > 30) edges[edge][0]++; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y >= ring && y < H - ring && x >= ring && x < W - ring) continue;
    const p = px(x, y);
    if (y < ring) mark('top', p);
    if (y >= H - ring) mark('bottom', p);
    if (x < ring) mark('left', p);
    if (x >= W - ring) mark('right', p);
  }
  const ratio = e => edges[e][1] ? edges[e][0] / edges[e][1] : 0;
  const out = { top: +ratio('top').toFixed(2), bottom: +ratio('bottom').toFixed(2), left: +ratio('left').toFixed(2), right: +ratio('right').toFixed(2) };
  const worst = Object.keys(out).sort((a, b) => out[b] - out[a])[0];
  const level = out[worst] > 0.3 ? 'WARN' : 'ok';
  return { level, edges: out, worst, bg: bg.map(v => Math.round(v)) };
}

/* ---------- 抽帧 ---------- */

function grab(ffmpeg, t, file) {
  const r = spawnSync(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', t.toFixed(3), '-i', VIDEO,
    '-frames:v', '1', '-q:v', '2', file
  ], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(file) || fs.statSync(file).size < 512) return false;
  if (process.platform === 'darwin' && opts.maxWidth > 0) {
    spawnSync('sips', ['-Z', String(opts.maxWidth), file], { stdio: 'ignore' });
  }
  return true;
}

/* ---------- 运动体检（可选，读工程里的 qa-motion.js） ---------- */

function motion() {
  const tool = path.join(root, 'tools', 'qa-motion.js');
  if (!fs.existsSync(tool)) return null;
  const r = spawnSync(process.execPath, ['tools/qa-motion.js', path.relative(root, VIDEO), '--json', 'qa/motion.json', '--quiet'], {
    cwd: root, encoding: 'utf8'
  });
  let report = null;
  try { report = JSON.parse(fs.readFileSync(path.join(root, 'qa', 'motion.json'), 'utf8')); } catch (e) {}
  if (!report) {
    return { ok: false, findings: [{ level: 'WARN', code: 'motion', message: 'qa-motion 没有产出报告：' + ((r.stderr || '').trim().split('\n')[0] || '未知原因') }] };
  }
  return {
    ok: !report.findings.some(f => f.level === 'ERROR'),
    staticRatio: report.staticRatio,
    mean: report.mean,
    longStatic: report.longStatic,
    findings: (report.findings || []).map(f => ({ level: f.level, code: f.code, message: f.message }))
  };
}

/* ---------- 色彩多样性（可选，读工程里的 qa-variety.js） ---------- */

function variety() {
  const tool = path.join(root, 'tools', 'qa-variety.js');
  if (!fs.existsSync(tool)) return null;
  spawnSync(process.execPath, ['tools/qa-variety.js', path.relative(root, VIDEO), '--json', 'qa/variety.json', '--quiet'], {
    cwd: root, encoding: 'utf8'
  });
  let report = null;
  try { report = JSON.parse(fs.readFileSync(path.join(root, 'qa', 'variety.json'), 'utf8')); } catch (e) {}
  if (!report) return { ok: false, findings: [{ level: 'WARN', code: 'variety', message: 'qa-variety 没有产出报告' }] };
  return {
    ok: !report.findings.some(f => f.level === 'ERROR'),
    dominant: report.dominant,
    distinct: report.distinct,
    lumaSpread: report.lumaSpread,
    satMedian: report.satMedian,
    timeline: report.timeline,
    findings: (report.findings || []).map(f => ({ level: f.level, code: f.code, message: f.message }))
  };
}

/* ---------- 清单 ---------- */

const CHECKLIST = [
  '对白安全区：底部字幕（安全区 120px）不被碗筷、伞沿、人物脚底压住，双行也不出安全区',
  '手机插入镜头：屏幕内容完整、时间与消息不截断，四周留出景深虚化',
  '镜内动作：每镜 70% 前收住，78% 收镜帧主体不糊、不黑、不双影',
  '转场：切点前后镜头都在动（推镜/漂移/雨丝/蒸汽），没有静止卡帧',
  '人物：伞沿不穿头、脖子不过长、双人同框时两把伞不重叠成一个',
  '文字落值：集数 HUD、片名、endTag、下集钩子没有 — / NaN / {占位}',
  '声音：13 句对白与字幕同步，响度不过响不过轻（看 encode 的 volumedetect）',
  '封面：poster 能单独当缩略图（片名完整、无动画中间态）'
];

/* ---------- 主流程 ---------- */

function main() {
  console.log('交付前自检 · ' + (CONFIG.title || path.basename(root)) + '\n');

  if (!fs.existsSync(VIDEO)) {
    console.error('  ✗ 找不到成片 ' + path.relative(root, VIDEO));
    console.error('    先渲染并编码：node render.js --scale 1 && node encode.js');
    process.exit(1);
  }
  const ffmpeg = findFfmpeg();
  const videoStat = fs.statSync(VIDEO);
  const errors = [];
  const warnings = [];
  const collect = list => list.forEach(f => (f.level === 'ERROR' ? errors : warnings).push(f.code + '：' + f.message));

  /* 1. 新鲜度 */
  const fresh = freshness(videoStat);
  collect(fresh.findings);
  console.log('  新鲜度  ' + (fresh.ok
    ? '✓ 成片新于所有源文件'
    : '✗ ' + fresh.findings.map(f => f.message).join('；')));

  /* 2. 容器 */
  const box = container(ffmpeg);
  collect(box.findings);
  const a = box.actual;
  console.log('  容器    ' + (a.duration == null ? '✗ 无法读取'
    : a.duration.toFixed(2) + 's · ' + (a.width || '?') + '×' + (a.height || '?') + ' · ' + (a.fps || '?') + 'fps · ' + (a.hasAudio ? '有音轨' : '无音轨') +
      (box.findings.length ? '  ✗' : '  ✓')));

  /* 3. 抽帧与探针 */
  const shots = loadShots();
  const samples = buildSamples(shots);
  const borderTimes = new Set(opts.border.map(t => +t.toFixed(2)));
  const declared = (CONFIG.repair && Array.isArray(CONFIG.repair.borderShots)) ? CONFIG.repair.borderShots : [];
  declared.forEach(s => {
    const t = typeof s === 'number' ? s : s.at;
    if (Number.isFinite(t)) {
      borderTimes.add(+t.toFixed(2));
      if (!samples.some(x => Math.abs(x.t - t) < 0.01)) samples.push({ t: +t.toFixed(2), label: (s && s.label) || '触边探针' });
    }
  });
  samples.sort((x, y) => x.t - y.t);

  let stillsDir = path.resolve(root, opts.out);
  const results = [];
  if (!opts.skipStills) {
    fs.mkdirSync(stillsDir, { recursive: true });
    fs.readdirSync(stillsDir).forEach(f => {
      if (/^repair_.*\.(jpg|png)$/.test(f)) fs.rmSync(path.join(stillsDir, f));
    });
    console.log('  抽帧    ' + samples.length + ' 张 → ' + path.relative(root, stillsDir));

    samples.forEach(s => {
      const file = path.join(stillsDir, 'repair_' + s.t.toFixed(2) + '.jpg');
      if (!grab(ffmpeg, s.t, file)) {
        results.push({ t: s.t, label: s.label, file: null });
        warnings.push('grab：' + s.t.toFixed(2) + 's 抽帧失败');
        return;
      }
      const empty = probeEmpty(ffmpeg, file);
      const entry = { t: s.t, label: s.label, file: path.relative(root, file), empty };
      if (empty.level !== 'ok') {
        const msg = s.t.toFixed(2) + 's 近空帧（std ' + empty.std + '）——检查是否漏画/空尾';
        (empty.level === 'ERROR' ? errors : warnings).push('empty：' + msg);
        entry.empty.message = msg;
      }
      if (borderTimes.has(+s.t.toFixed(2))) {
        const border = probeBorder(ffmpeg, file);
        entry.border = border;
        if (border.level !== 'ok') {
          warnings.push('border：' + s.t.toFixed(2) + 's 画面触边（' + border.worst + ' ' +
            Math.round(border.edges[border.worst] * 100) + '% 非背景）——主体可能被裁；若为有意全出血可忽略');
        }
      }
      results.push(entry);
    });

    const flagged = results.filter(x => x.empty && x.empty.level !== 'ok').length;
    const touched = results.filter(x => x.border && x.border.level !== 'ok').length;
    console.log('  探针    近空帧 ' + flagged + ' · 触边 ' + touched + (flagged || touched ? '  !' : '  ✓'));
  }

  /* 4. 运动体检 */
  let mot = null;
  try { mot = motion(); } catch (e) { mot = null; }
  if (mot) {
    collect(mot.findings);
    console.log('  运动    ' + (mot.findings.length
      ? (mot.ok ? '!' : '✗') + ' ' + mot.findings.map(f => f.message).join('；')
      : '✓ 静止帧 ' + Math.round((mot.staticRatio || 0) * 100) + '% · 帧差均值 ' + (mot.mean || 0).toFixed(2)));
  }

  /* 5. 色彩多样性：剪纸片的纸色与天空会让单一色域天然偏高（mv-craft §0 约定），
        只作调色提示，不计入 --strict；真正的 ERROR 仍然拦。 */
  let varR = null;
  try { varR = variety(); } catch (e) { varR = null; }
  if (varR) {
    const fatal = varR.findings.filter(f => f.level === 'ERROR');
    const notes = varR.findings.filter(f => f.level !== 'ERROR');
    collect(fatal);
    varR.advisory = notes;
    if (notes.length) {
      console.log('  色彩    ! ' + notes.map(f => f.message).join('；') + '（MV 调色提示，不计入门禁）');
    } else {
      console.log('  色彩    ✓ 主色域 ' + varR.dominant.world + ' ' + Math.round(varR.dominant.share * 100) + '% · 色域 ' + varR.distinct);
    }
  }

  /* 5. 报告 */
  const report = {
    tool: 'repair',
    project: root,
    title: CONFIG.title || null,
    generated: new Date().toISOString(),
    video: {
      path: path.relative(root, VIDEO),
      mtime: new Date(videoStat.mtimeMs).toISOString(),
      duration: a.duration, width: a.width, height: a.height, fps: a.fps, hasAudio: a.hasAudio
    },
    fresh,
    container: box,
    motion: mot,
    variety: varR,
    stillsDir: opts.skipStills ? null : path.relative(root, stillsDir),
    samples: results,
    checklist: CHECKLIST,
    errors,
    warnings,
    ok: errors.length === 0
  };
  const jsonPath = path.resolve(root, opts.json);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

  if (errors.length) {
    console.log('\n失败（' + errors.length + '）：');
    errors.slice(0, 12).forEach(e => console.log('  ✗ ' + e));
  }
  if (warnings.length) {
    console.log('\n警告（' + warnings.length + '）：');
    warnings.slice(0, 12).forEach(w => console.log('  ! ' + w));
  }
  console.log('\n修复清单（逐项打勾，见 qa/repair.json）：');
  CHECKLIST.forEach((c, i) => console.log('  ' + (i + 1) + '. ' + c));
  console.log('\n修完：node render.js --at <嫌疑时刻> → node render.js --scale 1 && node encode.js → npm run repair');
  console.log('报告 ' + opts.json + (opts.skipStills ? '' : ' · 抽帧 ' + path.relative(root, stillsDir) + '/'));

  if (!report.ok) {
    console.log('\n结论：还不能交付——先修上面的失败项。');
    process.exitCode = 1;
  } else if (opts.strict && warnings.length) {
    console.log('\n结论：--strict 下警告按失败处理。');
    process.exitCode = 1;
  } else {
    console.log('\n结论：自检通过（警告逐条看过再交付）。');
  }
}

try {
  main();
} catch (e) {
  console.error('repair 失败：' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}