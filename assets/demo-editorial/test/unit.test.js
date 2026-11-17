/* 纯 Node 单元测试：不启浏览器，秒级跑完。
   覆盖看得到的契约：look 目录、引擎绑定、brief 选择、config、剧本、CLI 输出。 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const LOOKS = require(path.join(root, 'js', 'looks.js'));
const CONFIG = require(path.join(root, 'js', 'config.js'));
const SCRIPT = require(path.join(root, 'js', 'script.js'));

const THEMES = ['letterpress', 'swiss', 'cinema', 'quiet', 'tech'];
const ENGINES = ['halftone', 'riso', 'bokeh', 'dust', 'aurora', 'flow', 'scan', 'orbit'];

test('look 目录：15 个，id 唯一，主题/版式/动效/引擎全部合法', () => {
  assert.equal(LOOKS.LOOKS.length, 15);
  const ids = new Set();
  const combos = new Set();
  for (const look of LOOKS.LOOKS) {
    assert.ok(!ids.has(look.id), '重复 id: ' + look.id);
    ids.add(look.id);
    const combo = look.theme + '/' + look.layout;
    assert.ok(!combos.has(combo), '主题+版式重复: ' + combo);
    combos.add(combo);
    assert.ok(THEMES.includes(look.theme), look.id + ' 主题非法: ' + look.theme);
    assert.ok(LOOKS.LAYOUTS[look.layout], look.id + ' 版式非法: ' + look.layout);
    assert.ok(LOOKS.MOTION[look.motion], look.id + ' 动效非法: ' + look.motion);
    assert.ok(ENGINES.includes(look.engine), look.id + ' 引擎非法: ' + look.engine);
    assert.ok(look.keywords.length >= 6, look.id + ' 关键词太少，auto 选择会失准');
    assert.ok(look.name && look.desc && look.bestFor, look.id + ' 缺少展示字段');
  }
});

test('engineOpts：alpha 落在 0–1，spacing 为正数', () => {
  for (const look of LOOKS.LOOKS) {
    const o = look.engineOpts || {};
    assert.equal(typeof o.alpha, 'number', look.id + ' 缺 alpha');
    assert.ok(o.alpha > 0 && o.alpha <= 1, look.id + ' alpha 越界: ' + o.alpha);
    if (o.spacing != null) assert.ok(o.spacing > 0, look.id + ' spacing 非法');
  }
});

test('getLook：默认与非默认都能取到，伪造 id 返回 null', () => {
  assert.equal(LOOKS.getLook('ink-editorial').theme, 'letterpress');
  assert.equal(LOOKS.getLook('auto'), null);
  assert.equal(LOOKS.getLook('not-a-look'), null);
  assert.equal(LOOKS.getLook(undefined), null);
});

test('chooseLook：关键词命中的 confidence 为 high 且命中词出现在依据里', () => {
  const cases = [
    ['AI 开发者工具，功能介绍', 'tech-split'],
    ['城市文化品牌片，讲手作工艺', 'ink-editorial'],
    ['咖啡店日常，慢生活', 'quiet-editorial'],
    ['服务器日志监控，运维看板', 'tech-grid'],
    ['新品海报，快闪活动预告', 'ink-poster']
  ];
  for (const [brief, expectId] of cases) {
    const r = LOOKS.chooseLook(brief);
    assert.equal(r.look.id, expectId, brief + ' → ' + r.look.id + '，期望 ' + expectId);
    assert.equal(r.confidence, 'high', brief + ' 应为 high');
    assert.ok(r.hits.length > 0, brief + ' 应有命中词');
  }
});

test('chooseLook：theme 强制时只在该主题内选', () => {
  const r = LOOKS.chooseLook('咖啡店日常', { theme: 'swiss' });
  assert.equal(r.look.theme, 'swiss');
  assert.equal(r.confidence, 'medium');
  const r2 = LOOKS.chooseLook('', { theme: 'cinema' });
  assert.equal(r2.look.theme, 'cinema');
});

test('chooseLook：空 brief 走 fallback 且不报错', () => {
  const r = LOOKS.chooseLook('');
  assert.equal(r.look.id, LOOKS.DEFAULT_ID);
  assert.equal(r.confidence, 'fallback');
  assert.equal(r.score, 0);
  const r2 = LOOKS.chooseLook(null);
  assert.equal(r2.look.id, LOOKS.DEFAULT_ID);
});

test('rankLooks：得分单调递减，alternatives 不含冠军', () => {
  const ranked = LOOKS.rankLooks('城市品牌片，文化气质');
  assert.equal(ranked.length, LOOKS.LOOKS.length);
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].score >= ranked[i].score, '排序非递减');
  }
  const r = LOOKS.chooseLook('城市品牌片，文化气质');
  assert.equal(r.alternatives.length, 3);
  assert.ok(!r.alternatives.some(a => a.id === r.look.id));
});

test('config：画幅、时长、帧率在可编码范围', () => {
  assert.ok(CONFIG.width > 0 && CONFIG.height > 0);
  assert.equal(CONFIG.width % 2, 0, 'H.264 要求偶数宽度');
  assert.equal(CONFIG.height % 2, 0, 'H.264 要求偶数高度');
  const ratio = CONFIG.width / CONFIG.height;
  assert.ok(Math.abs(ratio - 16 / 9) < 0.01 || Math.abs(ratio - 9 / 16) < 0.01, '只支持 16:9 / 9:16: ' + ratio);
  assert.ok(CONFIG.duration >= 3 && CONFIG.duration <= 600, 'duration 越界');
  assert.ok(CONFIG.fps >= 24 && CONFIG.fps <= 60, 'fps 越界');
  // posterAt 按 60s 基准书写，运行时随 duration 等比缩放
  assert.ok(CONFIG.posterAt >= 0 && CONFIG.posterAt <= 60.01, 'posterAt 应在 60s 基准内');
});

test('script：字幕引用真实场景，时间单调且不越界', () => {
  assert.ok(SCRIPT.subtitles.length >= 5, '字幕太少');
  const sceneKeys = new Set(Object.keys(SCRIPT).filter(k => /^s\d+$/.test(k)));
  assert.ok(sceneKeys.size >= 1);
  const lastAt = {};
  for (const cue of SCRIPT.subtitles) {
    assert.ok(sceneKeys.has(cue.scene), '字幕指向不存在的场景: ' + cue.scene);
    assert.ok(typeof cue.text === 'string' && cue.text.trim(), '空字幕');
    assert.ok(cue.text.length <= 40, '单条字幕过长: ' + cue.text);
    assert.ok(cue.at >= 0 && cue.dur > 0, '字幕时间非法: ' + JSON.stringify(cue));
    const prev = lastAt[cue.scene];
    if (prev != null) assert.ok(cue.at >= prev, cue.scene + ' 字幕时间回退');
    lastAt[cue.scene] = cue.at + cue.dur;
  }
});

test('script：片头/片尾与每场标题等字段无 undefined 洞', () => {
  const walk = (v, pathStr) => {
    if (v == null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, pathStr + '[' + i + ']'));
    else if (typeof v === 'object') {
      for (const k of Object.keys(v)) walk(v[k], pathStr + '.' + k);
    } else if (typeof v === 'string') {
      assert.ok(v.trim().length > 0, pathStr + ' 是空字符串');
    } else if (typeof v === 'number') {
      assert.ok(Number.isFinite(v), pathStr + ' 不是有限数');
    }
  };
  walk(SCRIPT.s0, 's0');
  walk(SCRIPT.s6, 's6');
  for (let i = 1; i <= 5; i++) {
    const s = SCRIPT['s' + i];
    assert.ok(s && s.hdr && s.kick && (s.title || s.headline), 's' + i + ' 缺标题字段');
    walk(s, 's' + i);
  }
});

test('listLooks：输出可直接 JSON 序列化，字段齐全', () => {
  const rows = LOOKS.listLooks();
  assert.equal(rows.length, 15);
  const parsed = JSON.parse(JSON.stringify(rows));
  for (const row of parsed) {
    for (const k of ['id', 'name', 'en', 'theme', 'layout', 'motion', 'engine', 'bestFor', 'desc']) {
      assert.ok(row[k], row.id + ' 缺字段 ' + k);
    }
  }
});

test('pick-look CLI：--json 契约稳定，排名长度等于目录长度', () => {
  const out = execFileSync(process.execPath, [path.join(root, 'tools', 'pick-look.js'), '--json', 'AI 开发者工具，功能介绍'], {
    cwd: root, encoding: 'utf8'
  });
  const data = JSON.parse(out);
  assert.ok(data.brief.includes('AI'));
  assert.equal(data.recommendation.id, 'tech-split');
  assert.equal(data.recommendation.confidence, 'high');
  assert.equal(data.ranking.length, 15);
  assert.ok(data.ranking[0].score >= data.ranking[data.ranking.length - 1].score);
});

test('pick-look CLI：--root 允许在工程外调用（建工程前的选择器流程）', () => {
  const out = execFileSync(process.execPath, [path.join(root, 'tools', 'pick-look.js'), '--root', root, '--json', 'AI 开发者工具，功能介绍'], {
    cwd: path.dirname(root), encoding: 'utf8'
  });
  const data = JSON.parse(out);
  assert.equal(data.recommendation.id, 'tech-split');
  assert.equal(data.ranking.length, 15);
});

test('qa-motion：能识别静止帧比例与长静止段', () => {
  const { analyze } = require(path.join(root, 'tools', 'qa-motion.js'));
  const diffs = new Array(60).fill(0.5);
  for (let i = 10; i < 55; i++) diffs[i] = 0.001;
  const r = analyze(diffs, 30, { minMean: 1.0, maxStatic: 1.2 });
  assert.equal(r.frames, 60);
  assert.ok(r.staticRatio > 0.7, '静止帧比例应被算出');
  assert.equal(r.longStatic.length, 1, '应报出一个长静止段');
  assert.ok(r.longStatic[0].seconds >= 1.4, '长静止段时长应约 1.5s');
  assert.ok(r.findings.some(f => f.level === 'ERROR'), '大量静止应报 ERROR');
});
