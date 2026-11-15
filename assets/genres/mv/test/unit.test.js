/* MV 契约单测：不启浏览器，秒级。
   覆盖镜头制叙事的硬规则：配置、时间轴、场景引用、字幕、确定性、图层隔离。 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = require(path.join(ROOT, 'js/config.js'));
const SCRIPT = require(path.join(ROOT, 'js/script.js'));
const FILM = require(path.join(ROOT, 'js/film.js'));
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function cjk(s) {
  return Array.from(String(s)).filter(ch => /[\u3400-\u9fff]/.test(ch)).length;
}

function sceneKeys() {
  const keys = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => /^sets-.*\.js$/.test(f))) {
    const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    for (const m of src.matchAll(/S\.([a-z][a-z-]*)\s*=\s*\{/g)) keys.add(m[1]);
  }
  return keys;
}

function genKeys() {
  const src = read('js/sets-gen.js');
  return new Set(Array.from(src.matchAll(/GEN\.([a-z][a-z-]*)\s*=\s*\{/g), m => m[1]));
}

test('config：MV 只有叙事层，16:9，时序自洽', () => {
  assert.equal(CONFIG.genre, 'pixel-story');
  assert.equal(CONFIG.look, 'none');
  assert.equal(CONFIG.style, 'none');
  assert.equal(CONFIG.layout, 'none');
  assert.equal(CONFIG.width * 9, CONFIG.height * 16, 'MV 画布必须是 16:9');
  assert.ok(CONFIG.duration >= 15 && CONFIG.duration <= 600);
  assert.ok(CONFIG.fps >= 24 && CONFIG.fps <= 60);
  assert.equal(CONFIG.base, FILM.total, '分镜基准必须与 film 的总时长一致');
  assert.ok([1, 2].includes(CONFIG.renderScale), 'renderScale 只能是 1（1080p）或 2（4K）');
  assert.ok(cjk(CONFIG.title) >= 2 && cjk(CONFIG.title) <= 10);
  assert.ok(CONFIG.posterAt > 0 && CONFIG.posterAt < CONFIG.duration);
});

test('film：镜头首尾相接、每镜 2–3 秒、id 与 v 唯一', () => {
  const shots = FILM.shots;
  assert.ok(shots.length >= 12, '镜头太少：' + shots.length);
  assert.equal(shots[0].start, 0);
  const last = shots[shots.length - 1];
  assert.equal(FILM.total, CONFIG.base, 'film.total 必须等于 config.base');
  assert.ok(Math.abs(last.start + last.dur - FILM.total) < 1e-6, '最后一镜没有收在 total');
  assert.equal(last.end, true, '最后一镜必须是片尾卡（end: true）');

  const ids = new Set();
  const vs = new Set();
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    assert.ok(s.dur >= 2 - 1e-6 && s.dur <= 3 + 1e-6, s.id + ' 时长 ' + s.dur.toFixed(2) + 's，必须在 2–3 秒');
    assert.ok(s.id && !ids.has(s.id), '镜头 id 重复：' + s.id);
    assert.ok(s.v && !vs.has(s.v), '镜头 v 重复：' + s.v + '（同场景会画出同一张画面）');
    ids.add(s.id);
    vs.add(s.v);
    if (i > 0) {
      const prev = shots[i - 1];
      assert.ok(Math.abs(s.start - (prev.start + prev.dur)) < 1e-6, s.id + ' 与上一镜不连续');
    }
  }
});

test('film：场景引用都存在，段落切换单调递增', () => {
  const sets = sceneKeys();
  const gens = genKeys();
  for (const s of FILM.shots) {
    if (s.s === 'gen') {
      assert.ok(gens.has(s.g), s.id + ' 引用了不存在的程序化原型：' + s.g);
    } else {
      assert.ok(sets.has(s.s), s.id + ' 引用了不存在的场景：' + s.s);
    }
  }
  let at = -1;
  const modes = new Set(['verse', 'chorus', 'bridge', 'finale']);
  for (const sec of FILM.sections) {
    assert.ok(sec.at > at, '段落起点必须递增');
    assert.ok(modes.has(sec.mode), '未知段落语法：' + sec.mode);
    at = sec.at;
  }
});

test('script：字幕不重叠、不越界、可读完', () => {
  const subs = SCRIPT.subtitles;
  assert.ok(subs.length >= 6, '字幕太少');
  let prevEnd = 0;
  for (const s of subs) {
    const chars = cjk(s.text);
    assert.ok(s.start >= prevEnd - 1e-6, '字幕重叠：' + s.text);
    assert.ok(s.end > s.start && s.end <= CONFIG.duration + 1e-6, '字幕越界：' + s.text);
    assert.ok(chars >= 6 && chars <= 18, '每条字幕 6–18 字：' + s.text + '（' + chars + '）');
    assert.ok(chars / (s.end - s.start) <= 7, '读得太快：' + s.text);
    prevEnd = s.end;
  }
  assert.ok(subs[0].start >= 1, '第一条字幕不要抢在片头卡上');
});

test('确定性：js 图层不出现未播种随机与挂钟时间', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    for (const line of src.split('\n')) {
      if (/^\s*(\*|\/\/)/.test(line)) continue;
      assert.ok(!/Math\.random\s*\(/.test(line), f + ' 使用了 Math.random：' + line.trim());
      assert.ok(!/Date\.now\s*\(/.test(line), f + ' 使用了 Date.now：' + line.trim());
    }
  }
  /* 相机必须跟着镜头主体锚定：双人镜曾因锚点取错把人切出画面 */
  assert.ok(/focal\s*=/.test(read('js/shot.js')), 'shot.js 的相机锚点必须读取 who/duo');
});

test('图层隔离：index.html 只引 MV 层，不引宣传片层', () => {
  const html = read('index.html');
  assert.ok(/data-genre="pixel-story"/.test(html));
  assert.ok(/<ol id="subs"[^>]*><\/ol>/.test(html), '字幕容器必须是空的 ol#subs');
  for (const must of ['js/config.js', 'js/film.js', 'js/shot.js', 'js/timeline.js', 'styles/mv.css']) {
    assert.ok(html.includes(must), 'index.html 缺少 ' + must);
  }
  for (const banned of ['js/looks.js', 'js/engines.js', 'js/layouts.js', 'js/scenes/', 'styles/themes/']) {
    assert.ok(!html.includes(banned), '宣传片层混进 MV：' + banned);
  }
  const order = html.indexOf('js/film.js') < html.indexOf('js/shot.js') && html.indexOf('js/shot.js') < html.indexOf('js/timeline.js');
  assert.ok(order, '脚本顺序必须是 film → shot → timeline');
});

test('工程：模板自带 QA 与两档分辨率入口', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.check, undefined, '旧的 check-project 已删除，不要再挂 scripts.check');
  assert.ok(pkg.scripts.qa, '缺少 qa 脚本');
  assert.ok(pkg.scripts['render:1080'] && pkg.scripts['render:4k'], '缺少 1080p / 4K 渲染入口');
  assert.ok(fs.existsSync(path.join(ROOT, 'tools/qa-mv.js')), '缺少 tools/qa-mv.js');
  assert.ok(fs.existsSync(path.join(ROOT, 'tools/qa-all.js')), '缺少 tools/qa-all.js');
  assert.ok(!fs.existsSync(path.join(ROOT, 'tools/check-project.js')), '旧的 check-project.js 不应存在');
  assert.ok(/--scale/.test(read('render.js')), 'render.js 必须支持 --scale');
});
