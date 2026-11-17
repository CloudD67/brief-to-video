#!/usr/bin/env node
/**
 * MV 浏览器体检：原生画布、分镜、歌词、确定性与切点抽帧。
 *
 *   node tools/qa-mv.js .
 *   node tools/qa-mv.js . --no-shots
 *   node tools/qa-mv.js . --scale 2 --json qa/mv.json
 *
 * 与宣传片的 qa-layout / qa-timing / qa-engines 分开：MV 没有 DOM 版式，
 * 只检查 1920×1080 剪纸画布是否在正确时间画出正确内容、歌词是否按时出现，
 * 且同一时刻两次渲染逐像素一致。--scale 2 时画布后备 3840×2160（矢量重画）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { createServer } = require('../server');

const args = process.argv.slice(2);
const opts = { root: '.', scale: 1, out: 'qa', chrome: null, headed: false, shots: true, every: 1, json: 'qa/mv.json' };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--scale') opts.scale = Number(args[++i]);
  else if (a === '--out') opts.out = args[++i];
  else if (a === '--chrome') opts.chrome = args[++i];
  else if (a === '--headed') opts.headed = true;
  else if (a === '--no-shots') opts.shots = false;
  else if (a === '--every') opts.every = Math.max(1, Number(args[++i]));
  else if (a === '--json') opts.json = args[++i];
  else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
  else opts.root = a;
}
const ROOT = path.resolve(opts.root);
const CONFIG = require(path.join(ROOT, 'js/config.js'));

const CHROME = opts.chrome || process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].find(p => fs.existsSync(p));
if (!CHROME) {
  console.error('未找到 Chrome。用 --chrome 指定路径，或设置 CHROME_PATH。');
  process.exit(1);
}
if (!(opts.scale >= 1 && opts.scale <= 4 && Number.isInteger(opts.scale))) throw new Error('--scale 必须是 1–4 的整数（1 = 1080p，2 = 4K）');

const errors = [];
const warnings = [];
const report = {
  ok: false,
  title: CONFIG.title,
  genre: CONFIG.genre,
  canvas: { w: CONFIG.width * opts.scale, h: CONFIG.height * opts.scale },
  scenes: [],
  checks: {},
  shots: []
};

async function animFrame(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function seek(page, t) {
  await page.evaluate(tt => window.pauseAt(tt), t);
  await animFrame(page);
}

async function canvasStats(page) {
  return page.evaluate(() => {
    const list = document.querySelectorAll('.scene canvas');
    const cv = list[list.length - 1];
    if (!cv) return { ok: false, why: '当前场景没有 canvas' };
    const g = cv.getContext('2d');
    const img = g.getImageData(0, 0, cv.width, cv.height).data;
    const colors = new Set();
    let nonBg = 0;
    const TOTAL = cv.width * cv.height;
    for (let i = 0; i < img.length; i += 4) {
      const key = (img[i] >> 3) + ',' + (img[i + 1] >> 3) + ',' + (img[i + 2] >> 3);
      colors.add(key);
      if (img[i] > 10 || img[i + 1] > 12 || img[i + 2] > 20) nonBg++;
    }
    /* 与上一次采样逐像素比：统计变化像素数与最大单通道差。
       新画布首次合成会有 ±1–2 色阶的取整差，只有 ≥3 色阶才算未播种随机。 */
    const prev = window.__qaPrev;
    let changed = 0, maxd = 0;
    if (prev && prev.length === img.length) {
      for (let i = 0; i < img.length; i += 4) {
        const d = Math.max(
          Math.abs(img[i] - prev[i]),
          Math.abs(img[i + 1] - prev[i + 1]),
          Math.abs(img[i + 2] - prev[i + 2]),
          Math.abs(img[i + 3] - prev[i + 3])
        );
        if (d) { changed++; if (d > maxd) maxd = d; }
      }
    }
    window.__qaPrev = new Uint8ClampedArray(img);
    return {
      ok: true,
      width: cv.width,
      height: cv.height,
      colors: colors.size,
      nonBg: +(nonBg / TOTAL).toFixed(3),
      changed: changed,
      maxd: maxd
    };
  });
}

async function main() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  let browser = null;

  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: !opts.headed,
      protocolTimeout: 180000,
      args: [
        '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb',
        '--font-render-hinting=none', '--disable-lcd-text',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows'
      ]
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(0);
    await page.setViewport({
      width: CONFIG.width,
      height: CONFIG.height,
      deviceScaleFactor: opts.scale
    });
    page.on('pageerror', e => errors.push('页面异常：' + e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push('控制台错误：' + msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/index.html?render=1&scale=${opts.scale}`, { waitUntil: 'load', timeout: 120000 });
    await page.evaluate(() => window.ready);
    if (!(await page.evaluate(() => window.__READY === true))) {
      throw new Error('页面未就绪（window.__READY 未置位）');
    }

    const meta = await page.evaluate(() => ({
      genre: window.FILM_GENRE,
      dataset: document.documentElement.dataset.genre,
      look: window.FILM_LOOK,
      timeline: window.getTimeline(),
      qa: window.PAPER_QA,
      canvases: Array.from(document.querySelectorAll('.scene canvas')).map(c => ({ w: c.width, h: c.height }))
    }));

    if (meta.genre !== 'paper-story') errors.push('window.FILM_GENRE 不是 paper-story：' + meta.genre);
    if (meta.dataset !== 'paper-story') errors.push('html[data-genre] 不是 paper-story：' + meta.dataset);
    if (meta.look) errors.push('MV 里出现了 window.FILM_LOOK：' + meta.look + '（宣传片层混进来了）');
    if (!meta.canvases.length) errors.push('页面里没有剪纸画布');
    const wantW = CONFIG.width * opts.scale;
    const wantH = CONFIG.height * opts.scale;
    meta.canvases.forEach((c, i) => {
      if (c.w !== wantW || c.h !== wantH) {
        errors.push('画布 #' + (i + 1) + ' 是 ' + c.w + 'x' + c.h + '，按 --scale ' + opts.scale + ' 必须是 ' + wantW + 'x' + wantH);
      }
    });
    report.checks.genre = meta.genre;
    report.checks.canvasCount = meta.canvases.length;

    const tl = meta.timeline;
    const scenes = tl.scenes || [];
    if (!scenes.length) errors.push('时间轴没有场景');
    const authoredBase = tl.base || 60;
    if (scenes.length) {
      if (Math.abs(scenes[0].authoredStart) > 1e-6) errors.push('首个场景不是从 0s 开始');
      if (Math.abs(scenes[scenes.length - 1].authoredEnd - authoredBase) > 1e-6) {
        errors.push('最后一个场景不是结束于 ' + authoredBase + 's（实际 ' + scenes[scenes.length - 1].authoredEnd + 's）');
      }
      for (let i = 1; i < scenes.length; i++) {
        if (Math.abs(scenes[i].authoredStart - scenes[i - 1].authoredEnd) > 1e-6) {
          errors.push('切点不连续：' + scenes[i - 1].id + ' → ' + scenes[i].id);
        }
      }
      const last = scenes[scenes.length - 1];
      if (last.set !== 'end') errors.push('最后一镜必须是片尾卡（set = end），实际是 ' + last.set);
    }
    report.checks.sceneCount = scenes.length;
    report.checks.cueCount = (tl.cues || []).length;
    report.checks.heroShots = scenes.filter(s => s.hero).length;

    /* 每个镜头 45% 时刻：画布有内容、尺寸正确、纸感层次足够 */
    for (const s of scenes) {
      const at = s.start + s.dur * 0.45;
      /* 首次绘制会让 Skia 切换抗锯齿路径（±1 色阶），先暖一遍再取基准 */
      await seek(page, at);
      await seek(page, at);
      let st = await canvasStats(page);
      /* 极端负载下懒挂载的画布偶发一次空帧，重试一次再判定 */
      if (st.ok && st.colors <= 1) {
        await seek(page, at);
        st = await canvasStats(page);
      }
      const entry = { id: s.id, at: +at.toFixed(2), canvas: st.ok ? { w: st.width, h: st.height, colors: st.colors, nonBg: st.nonBg } : null };
      report.scenes.push(entry);
      if (!st.ok) errors.push(s.id + '：' + st.why);
      else {
        if (st.width !== wantW || st.height !== wantH) errors.push(s.id + ' 的画布尺寸不是 ' + wantW + 'x' + wantH);
        if (st.colors < 24) errors.push(s.id + ' 的画面只有 ' + st.colors + ' 种颜色，可能没画出纸层');
        if (st.nonBg < 0.12) errors.push(s.id + ' 的画面只有 ' + (st.nonBg * 100).toFixed(0) + '% 有内容');
      }

      /* 同一时刻两次渲染必须一致（容忍新画布首次合成的 ±1–2 色阶取整差） */
      await seek(page, at);
      const again = await canvasStats(page);
      if (st.ok && again.ok && again.maxd > 2) {
        errors.push(s.id + ' 同一时刻两次渲染不一致（存在未播种随机，最大差 ' + again.maxd + ' 色阶 / ' + again.changed + ' 像素）');
      }

      /* 同一镜头内 +0.45s 画面必须发生变化（不是静帧） */
      const at2 = Math.min(s.end - 0.06, at + 0.45);
      if (at2 > at + 0.1) {
        await seek(page, at2);
        const later = await canvasStats(page);
        if (st.ok && later.ok && later.maxd <= 2) errors.push(s.id + ' 在镜头内 ' + (at2 - at).toFixed(2) + 's 画面完全没有变化');
      }

      if (opts.shots && (report.scenes.length - 1) % opts.every === 0) {
        await seek(page, at);
        const dir = path.resolve(ROOT, opts.out, 'mv');
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, 'scene_' + s.id + '_' + at.toFixed(1) + '.png');
        await page.screenshot({ path: file, type: 'png', captureBeyondViewport: false });
        report.shots.push(path.relative(ROOT, file));
      }
    }

    /* 歌词画在画布底部（成片里的那一行）：每条中点 α ≥ 0.5，文字与剧本一致 */
    const cues = tl.cues || [];
    const cueFail = [];
    for (const c of cues) {
      const mid = (c.start + c.end) / 2;
      await seek(page, mid);
      const plate = await page.evaluate(() => ({
        text: window.PAPER_QA.lyric.text,
        alpha: window.PAPER_QA.lyric.alpha
      }));
      if (plate.alpha < 0.5) cueFail.push(c.text + '（alpha ' + plate.alpha.toFixed(2) + '）');
      else if (plate.text !== c.text) cueFail.push(c.text + '（画面显示「' + plate.text + '」）');
    }
    if (cueFail.length) errors.push('歌词没有按时出现：' + cueFail.join(' / '));

    /* 片尾卡：最后 1.2 秒必须已经停在最后一镜上 */
    await seek(page, Math.max(0, CONFIG.duration - 1.2));
    const endQa = await page.evaluate(() => ({
      shot: document.documentElement.dataset.shot,
      idx: window.__SHOT_INDEX,
      endCard: window.PAPER_QA.endCard,
      colors: (() => {
        const cv = document.querySelector('.scene canvas');
        if (!cv) return 0;
        const g = cv.getContext('2d');
        const img = g.getImageData(0, 0, cv.width, cv.height).data;
        const set = new Set();
        for (let i = 0; i < img.length; i += 64) set.add((img[i] >> 3) + ',' + (img[i + 1] >> 3) + ',' + (img[i + 2] >> 3));
        return set.size;
      })()
    }));
    if (scenes.length && endQa.idx !== scenes.length - 1) errors.push('最后 1.2s 没有停在片尾卡上（当前镜 #' + endQa.idx + '）');
    if (!endQa.endCard) errors.push('片尾卡没有在最后 1.2s 前完成（PAPER_QA.endCard = 0）');
    if (endQa.colors < 24) errors.push('片尾卡画面为空（' + endQa.colors + ' 个色块）');
    report.checks.endCard = !!endQa.endCard;

    if (opts.shots) {
      const dir = path.resolve(ROOT, opts.out, 'mv');
      fs.mkdirSync(dir, { recursive: true });
      const posterAt = Math.min(CONFIG.duration - 0.05, CONFIG.posterAt * (CONFIG.duration / (CONFIG.base || 60)));
      for (const [name, t] of [['end', CONFIG.duration - 1.2], ['poster', posterAt]]) {
        await seek(page, Math.min(CONFIG.duration - 0.05, Math.max(0, t)));
        const file = path.join(dir, name + '.png');
        await page.screenshot({ path: file, type: 'png', captureBeyondViewport: false });
        report.shots.push(path.relative(ROOT, file));
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  report.errors = errors;
  report.warnings = warnings;
  report.ok = errors.length === 0;

  console.log('\nqa-mv · ' + CONFIG.title);
  console.log('  ─────────────────────────────────');
  console.log('  画布    ' + report.canvas.w + '×' + report.canvas.h + '  ·  原生坐标 ' + CONFIG.width + '×' + CONFIG.height + ' × ' + opts.scale);
  console.log('  叙事    ' + report.genre + '  ·  ' + report.checks.sceneCount + ' 镜  ·  ' + report.checks.cueCount + ' 条歌词  ·  ' + report.checks.heroShots + ' 个主镜头');
  report.scenes.forEach(s => {
    console.log('  ' + s.id + '  @' + s.at.toFixed(1) + 's  ' + (s.canvas ? s.canvas.colors + ' 色 / ' + Math.round(s.canvas.nonBg * 100) + '% 有内容' : '画布缺失'));
  });
  console.log('  片尾卡  ' + (report.checks.endCard ? '✓' : '✗'));
  if (opts.shots) console.log('  抽帧    ' + report.shots.length + ' 张 → ' + path.join(opts.out, 'mv'));
  console.log('');

  if (warnings.length) warnings.forEach(w => console.log('  ! ' + w));
  if (errors.length) {
    console.log('  错误：');
    errors.forEach(e => console.log('  ✗ ' + e));
    console.log('\n未通过：' + errors.length + ' 个错误。');
  } else {
    console.log('通过：画布、分镜、歌词、片尾卡、同刻复现、画面推进。');
  }

  const jsonPath = path.resolve(ROOT, opts.json);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
  if (errors.length) process.exit(1);
}

main().catch(err => {
  console.error('qa-mv 失败：' + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
