/* 故事赛道纯 Node 单测：不开浏览器。
   1) 示范集必须通过故事契约；
   2) 契约本身要能抓住断档 / 越界 / 未知角色；
   3) 配音清单（如有）必须按角色分声，并且每句不超字幕槽。 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { validate, cjkLen } = require(path.join(root, 'tools', 'validate-story.js'));

const CONFIG = require(path.join(root, 'js', 'config.js'));
const SCRIPT = require(path.join(root, 'js', 'script.js'));
const SHOTS = require(path.join(root, 'js', 'film.js'));

function writeProject(config, script, shots) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-contract-'));
  fs.mkdirSync(path.join(dir, 'js'));
  const dump = (name, value) => fs.writeFileSync(
    path.join(dir, 'js', name + '.js'),
    'module.exports = ' + JSON.stringify(value) + ';\n'
  );
  dump('config', config);
  dump('script', script);
  dump('film', shots);
  return dir;
}

test('示范集通过故事契约，没有错误', () => {
  const res = validate(root);
  assert.deepEqual(res.errors, []);
  assert.equal(res.stats.shots, SHOTS.length);
  assert.equal(res.stats.lines, SCRIPT.lines.length);
});

test('3D 故事固定横屏 16:9 与字幕安全区', () => {
  assert.equal(CONFIG.width, 1920);
  assert.equal(CONFIG.height, 1080);
  assert.ok(CONFIG.safe.bottom >= 96);
  assert.ok(CONFIG.safe.side >= 96);
  assert.equal(CONFIG.base, CONFIG.duration);
});

test('镜头首尾相接，从 0 到片长', () => {
  assert.equal(SHOTS[0].start, 0);
  assert.equal(SHOTS[SHOTS.length - 1].end, CONFIG.duration);
  for (let i = 1; i < SHOTS.length; i++) {
    assert.equal(SHOTS[i].start, SHOTS[i - 1].end, SHOTS[i - 1].id + ' → ' + SHOTS[i].id);
  }
  const ids = new Set(SHOTS.map((s) => s.id));
  assert.equal(ids.size, SHOTS.length);
});

test('每句台词都落在镜头内，且角色在 cast 里', () => {
  SHOTS.forEach((shot) => assert.ok(shot.note, shot.id + ' 缺画面说明'));
  for (const line of SCRIPT.lines) {
    assert.ok(SCRIPT.cast[line.who], '未知角色：' + line.who);
    assert.ok(line.at >= 0 && line.dur > 0);
    assert.ok(line.at + line.dur <= CONFIG.duration + 1e-6, '越界：' + line.text);
    const host = SHOTS.find((s) => line.at >= s.start && line.at < s.end);
    assert.ok(host, '台词开始时没有镜头：' + line.text);
  }
});

test('契约能抓住镜头断档', () => {
  const config = { ...CONFIG, genre: 'story' };
  const shots = SHOTS.map((s, i) => (i === 1 ? { ...s, start: s.start + 0.4 } : s));
  const dir = writeProject(config, SCRIPT, shots);
  const res = validate(dir);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'shot.gap'));
});

test('契约能抓住台词越界与未知角色', () => {
  const config = { ...CONFIG, genre: 'story' };
  const script = {
    ...SCRIPT,
    cast: { her: SCRIPT.cast.her },
    lines: [
      { at: 1.0, dur: 2.0, who: 'ghost', text: '我是谁。' },
      { at: CONFIG.duration - 0.5, dur: 3.0, who: 'her', text: '太晚了。' }
    ]
  };
  const dir = writeProject(config, script, SHOTS);
  const res = validate(dir);
  const codes = res.errors.map((e) => e.code);
  assert.ok(codes.includes('script.who'));
  assert.ok(codes.includes('script.overrun'));
});

test('配音清单按角色分声，且不超槽位', () => {
  const file = path.join(root, 'assets', 'voiceover.json');
  if (!fs.existsSync(file)) return;
  const report = require(file);
  assert.ok(report.cues.length > 0);
  const voices = new Set(report.cues.map((c) => c.voice));
  assert.ok(voices.size >= 2, '至少两个声线：' + [...voices].join(', '));
  for (const cue of report.cues) {
    if (cue.spoken == null) continue;
    assert.ok(cue.spoken <= cue.slot + 0.35, '第 ' + cue.n + ' 句超出槽位 ' + (cue.spoken - cue.slot).toFixed(2) + 's');
  }
});

function writeCgProject(config, voice, manifest) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-cg-'));
  for (const d of ['js', 'cg', 'out']) fs.mkdirSync(path.join(dir, d));
  fs.writeFileSync(path.join(dir, 'js', 'config.js'), 'module.exports = ' + JSON.stringify(config) + ';\n');
  fs.writeFileSync(path.join(dir, 'cg', 'voice.json'), JSON.stringify(voice) + '\n');
  if (manifest) fs.writeFileSync(path.join(dir, 'out', 'demo-manifest.json'), JSON.stringify(manifest) + '\n');
  return dir;
}

test('CG 项目按 voice.json 与渲染清单校验', () => {
  const config = { ...CONFIG, engine: 'cg', duration: 20 };
  const voice = {
    voices: { yao: { voice: 'Reed', rate: 168 } },
    lines: [{ id: 1, who: 'yao', shot: 's1', at: 2.0, dur: 2.0, text: '一碗素面。' }]
  };
  const manifest = {
    fps: 24, duration: 20, frames: 480,
    shots: [{ id: 's1', start: 0, sec: 10 }, { id: 's2', start: 10, sec: 10 }]
  };
  const ok = validate(writeCgProject(config, voice, manifest));
  assert.deepEqual(ok.errors, []);

  const badVoice = {
    voices: { yao: { voice: 'Reed' } },
    lines: [
      { id: 1, who: 'ghost', shot: 's9', at: 2.0, dur: 2.0, text: '我是谁。' },
      { id: 2, who: 'yao', shot: 's1', at: 1.0, dur: 2.0, text: '太早了。' }
    ]
  };
  const badManifest = {
    fps: 24, duration: 20, frames: 480,
    shots: [{ id: 's1', start: 0, sec: 8 }, { id: 's2', start: 10, sec: 10 }]
  };
  const res = validate(writeCgProject(config, badVoice, badManifest));
  const codes = res.errors.map((e) => e.code);
  assert.ok(codes.includes('cg.who'), '抓住未知角色');
  assert.ok(codes.includes('cg.shot'), '抓住不存在的镜头');
  assert.ok(codes.includes('cg.order'), '抓住台词乱序');
  assert.ok(codes.includes('cg.gap'), '抓住镜头断档');
});

test('中文字数按字计，不把标点算进去', () => {
  assert.equal(cjkLen('嗯。多下一碗。'), 5);
  assert.equal(cjkLen('「对方正在输入…」'), 6);
});
