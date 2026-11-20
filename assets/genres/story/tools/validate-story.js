#!/usr/bin/env node
/**
 * 故事契约校验：剧本（script.js）与分镜（film.js）必须对得上。
 * 只做纯 Node 检查，不开浏览器，秒级返回。
 *
 *   node tools/validate-story.js [project-dir] [--json out.json] [--strict]
 *
 * 错误 = 交付会出问题（时间越界、镜头断档、锚点不存在）。
 * 警告 = 可能影响观感（字幕跨镜、台词过长、片尾钩子过长），--strict 时按错误计。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PUNCT = /[\s\u3000，。、；：！？—…·「」『』（）()《》〈〉,.!?:;'"“”‘’-]/g;
const cjkLen = (text) => String(text).replace(PUNCT, '').length;

function loadProject(root) {
  const configPath = path.join(root, 'js', 'config.js');
  const scriptPath = path.join(root, 'js', 'script.js');
  const filmPath = path.join(root, 'js', 'film.js');
  for (const p of [configPath, scriptPath, filmPath]) {
    if (!fs.existsSync(p)) throw new Error('缺少 ' + path.relative(root, p));
  }
  const CONFIG = require(configPath);
  const SCRIPT = require(scriptPath);
  const filmMod = require(filmPath);
  const SHOTS = Array.isArray(filmMod) ? filmMod : filmMod.SHOTS;
  if (!Array.isArray(SHOTS)) throw new Error('js/film.js 需要导出镜头数组');
  return { CONFIG, SCRIPT, SHOTS };
}

function parseAnchors(root) {
  const file = path.join(root, 'js', 'three-sets.js');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('const anchorList = {');
  if (start === -1) return null;
  const body = text.slice(start, text.indexOf('};', start));
  const keys = [];
  const re = /^\s*(\w+):\s*\{\s*pos:/gm;
  let m;
  while ((m = re.exec(body))) keys.push(m[1]);
  return keys;
}

function shotAt(shots, t) {
  return shots.find((s) => t >= s.start && t < s.end) || null;
}

function checkConfig(CONFIG, err) {
  const duration = Number(CONFIG.duration);
  if (CONFIG.genre !== 'story') err('config.genre', 'genre 必须是 story');
  if (CONFIG.width !== 1920 || CONFIG.height !== 1080) {
    err('config.size', '3D 故事赛道固定 1920×1080 横屏，当前 ' + CONFIG.width + '×' + CONFIG.height);
  }
  if (!(duration > 8 && duration <= 180)) err('config.duration', 'duration 应在 8–180s，当前 ' + duration);
  if (!(CONFIG.fps >= 24)) err('config.fps', 'fps 至少 24');
  if (!CONFIG.safe || CONFIG.safe.bottom < 96) err('config.safe', '字幕安全区 bottom 应 ≥96px');
}

function findCgManifest(root) {
  const dir = path.join(root, 'out');
  if (!fs.existsSync(dir)) return null;
  const file = fs.readdirSync(dir).filter((f) => /-manifest\.json$/.test(f)).sort()[0];
  if (!file) return null;
  try {
    return { file, data: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) };
  } catch (e) {
    return { file, error: e.message };
  }
}

/* CG 项目（engine: cg）没有 js/film.js 的机位表：镜头表在 cg 脚本里，
   真源是 cg/voice.json（台词/角色/落点）与 out/*-manifest.json（导演镜头表）。 */
function validateCg(root, CONFIG) {
  const errors = [];
  const warnings = [];
  const err = (code, msg) => errors.push({ code, msg });
  const warn = (code, msg) => warnings.push({ code, msg });
  const duration = Number(CONFIG.duration);
  checkConfig(CONFIG, err);

  const voicePath = path.join(root, 'cg', 'voice.json');
  let voice = { voices: {}, lines: [] };
  if (!fs.existsSync(voicePath)) {
    err('cg.voice', 'CG 项目缺少 cg/voice.json（对白的唯一真源）');
  } else {
    try {
      voice = JSON.parse(fs.readFileSync(voicePath, 'utf8'));
    } catch (e) {
      err('cg.voice', 'cg/voice.json 不是合法 JSON：' + e.message);
    }
  }
  const voices = voice.voices || {};
  const lines = Array.isArray(voice.lines) ? voice.lines : [];

  const manifest = findCgManifest(root);
  const shots = manifest && manifest.data && Array.isArray(manifest.data.shots) ? manifest.data.shots : [];
  const shotIds = new Set(shots.map((s) => s.id));

  if (!lines.length) warn('cg.lines', 'voice.json 还没有台词（空镜集可忽略）');
  let lastAt = -Infinity;
  const ids = new Set();
  lines.forEach((line, i) => {
    const tag = '台词#' + (line.id != null ? line.id : i + 1) + '「' + String(line.text || '').slice(0, 10) + '」';
    if (line.id == null) err('cg.id', tag + ' 缺 id');
    else if (ids.has(line.id)) err('cg.id', 'id 重复：' + line.id);
    else ids.add(line.id);
    const who = line.who || 'narrator';
    if (who !== 'narrator' && !voices[who]) err('cg.who', tag + ' 的 who=' + who + ' 不在 voices 里');
    if (!line.shot) err('cg.shot', tag + ' 缺 shot（CG 台词必须挂到镜头 id）');
    else if (shotIds.size && !shotIds.has(line.shot)) err('cg.shot', tag + ' 指向镜头表里没有的 ' + line.shot);
    const slot = Number(line.slot != null ? line.slot : line.dur);
    if (!(line.at >= 0 && line.at < duration)) err('cg.at', tag + ' 的 at 必须在 0–' + duration + 's');
    if (!(slot >= 0.4)) err('cg.slot', tag + ' 的 slot/dur 必须 ≥0.4s');
    if (line.at < lastAt) err('cg.order', tag + ' 没有按 at 排序');
    lastAt = line.at;
    const n = cjkLen(line.text);
    if (n < 1) err('cg.text', tag + ' 没有文本');
    if (n > 24) warn('cg.text', tag + ' 有 ' + n + ' 字，一行放不下');
    if (slot && line.at + slot > duration + 0.001) err('cg.overrun', tag + ' 的槽位超出片长');
  });

  const spokenPath = path.join(root, 'assets', 'voice', 'lines.json');
  if (fs.existsSync(spokenPath)) {
    try {
      const spoken = JSON.parse(fs.readFileSync(spokenPath, 'utf8'));
      const byId = new Map((Array.isArray(spoken) ? spoken : []).map((x) => [Number(x.id), x]));
      lines.forEach((line) => {
        const meta = byId.get(Number(line.id));
        if (!meta) {
          warn('cg.spoken', '台词 ' + line.id + ' 还没有配音');
          return;
        }
        const over = Number(meta.spoken) - Number(line.slot != null ? line.slot : line.dur || 0);
        if (over > 0.35) {
          warn('cg.slot', '台词 ' + line.id + ' 实测 ' + Number(meta.spoken).toFixed(2) + 's，超槽位 ' + over.toFixed(2) + 's');
        }
      });
    } catch (e) {
      warn('cg.spoken', 'assets/voice/lines.json 读不了：' + e.message);
    }
  } else if (lines.length) {
    warn('cg.spoken', '还没有配音（node tools/cg-voice.js .）');
  }

  if (manifest && manifest.error) warn('cg.manifest', manifest.file + ' 读不了：' + manifest.error);
  if (shots.length) {
    if (Math.abs(Number(manifest.data.frames) - Math.round(duration * Number(CONFIG.fps))) > 0.5) {
      err('cg.frames', 'manifest 帧数 ' + manifest.data.frames + ' 与片长×fps 不符');
    }
    let prev = null;
    shots.forEach((s) => {
      if (!s.id) err('cg.shots', '镜头缺 id');
      if (!(s.sec > 0)) err('cg.shots', '镜头 ' + s.id + ' 的 sec 非法');
      if (prev && Math.abs(s.start - (prev.start + prev.sec)) > 0.001) {
        err('cg.gap', prev.id + ' → ' + s.id + ' 时间断档/重叠');
      }
      prev = s;
    });
    if (prev && Math.abs(prev.start + prev.sec - duration) > 0.01) {
      err('cg.end', '镜头表结束于 ' + (prev.start + prev.sec).toFixed(2) + 's，片长是 ' + duration + 's');
    }
  } else if (lines.length) {
    warn('cg.manifest', '还没有渲染清单（跑 cg-render 后复核镜头表）');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: { duration, shots: shots.length || new Set(lines.map((l) => l.shot).filter(Boolean)).size, lines: lines.length, cast: Object.keys(voices).length }
  };
}

function validate(root) {
  const configPath = path.join(root, 'js', 'config.js');
  if (!fs.existsSync(configPath)) throw new Error('缺少 js/config.js');
  const CONFIG = require(configPath);
  if (String(CONFIG.engine || '').toLowerCase() === 'cg') return validateCg(root, CONFIG);

  const { SCRIPT, SHOTS } = loadProject(root);
  const errors = [];
  const warnings = [];
  const err = (code, msg) => errors.push({ code, msg });
  const warn = (code, msg) => warnings.push({ code, msg });
  const duration = Number(CONFIG.duration);

  /* ---------- 配置 ---------- */
  checkConfig(CONFIG, err);

  /* ---------- 分镜 ---------- */
  const ids = new Set();
  const anchors = parseAnchors(root);
  let prev = null;
  SHOTS.forEach((shot, i) => {
    const tag = shot.id || '#' + (i + 1);
    if (!shot.id) err('shot.id', tag + ' 缺少 id');
    if (ids.has(shot.id)) err('shot.id', 'id 重复：' + shot.id);
    ids.add(shot.id);
    if (!(typeof shot.start === 'number' && typeof shot.end === 'number')) {
      err('shot.time', tag + ' 的 start/end 必须是数字');
      return;
    }
    if (shot.end <= shot.start) err('shot.time', tag + ' 的 end 必须大于 start');
    const len = shot.end - shot.start;
    if (len < 0.8) warn('shot.short', tag + ' 只有 ' + len.toFixed(2) + 's，短于 0.8s');
    if (len > 12) warn('shot.long', tag + ' 有 ' + len.toFixed(1) + 's，长于 12s');
    if (prev) {
      if (Math.abs(shot.start - prev.end) > 0.001) {
        const d = shot.start - prev.end;
        err('shot.gap', prev.id + ' → ' + tag + ' 时间' + (d > 0 ? '留空 ' : '重叠 ') + Math.abs(d).toFixed(2) + 's');
      }
    } else if (Math.abs(shot.start) > 0.001) {
      err('shot.start', '第一镜必须从 0s 开始，当前 ' + shot.start);
    }
    if (shot.anchor && anchors && anchors.indexOf(shot.anchor) === -1) {
      err('shot.anchor', tag + ' 的锚点 ' + shot.anchor + ' 不存在于 three-sets.js');
    }
    if (!shot.anchor && !(Array.isArray(shot.pos) && Array.isArray(shot.look))) {
      err('shot.anchor', tag + ' 既没有合法 anchor，也没有 pos/look');
    }
    if (shot.fov != null && !(shot.fov >= 20 && shot.fov <= 60)) {
      warn('shot.fov', tag + ' 的 fov ' + shot.fov + ' 超出 20–60');
    }
    if (shot.push != null && !(shot.push >= 0 && shot.push <= 3)) {
      warn('shot.push', tag + ' 的 push ' + shot.push + ' 超出 0–3m');
    }
    if (shot.focus != null && !(shot.focus > 0)) err('shot.focus', tag + ' 的 focus 必须大于 0');
    if (!shot.note || cjkLen(shot.note) < 4) warn('shot.note', tag + ' 缺少画面说明');
    prev = shot;
  });
  if (SHOTS.length && prev && Math.abs(prev.end - duration) > 0.001) {
    err('shot.end', '最后一镜结束于 ' + prev.end + 's，片长是 ' + duration + 's');
  }

  /* ---------- 角色与台词 ---------- */
  const cast = SCRIPT.cast || {};
  const castKeys = Object.keys(cast);
  if (!castKeys.length) err('script.cast', 'cast 不能为空');
  castKeys.forEach((k) => {
    if (k !== 'narrator' && !cast[k].name) warn('script.cast', 'cast.' + k + ' 缺少 name');
    if (!cast[k].voice) warn('script.cast', 'cast.' + k + ' 缺少 voice，配音将回落到 --voice');
  });
  const lines = Array.isArray(SCRIPT.lines) ? SCRIPT.lines : [];
  if (!lines.length) err('script.lines', 'lines 不能为空');
  let lastAt = -Infinity;
  lines.forEach((line, i) => {
    const tag = '台词#' + (i + 1) + '「' + String(line.text || '').slice(0, 10) + '」';
    if (!cast[line.who]) err('script.who', tag + ' 的 who=' + line.who + ' 不在 cast 里');
    if (!(line.at >= 0)) err('script.at', tag + ' 的 at 非法');
    if (!(line.dur > 0)) err('script.dur', tag + ' 的 dur 必须大于 0');
    if (line.at < lastAt) err('script.order', tag + ' 没有按 at 排序');
    lastAt = line.at;
    if (line.at + line.dur > duration + 0.001) {
      err('script.overrun', tag + ' 结束于 ' + (line.at + line.dur).toFixed(2) + 's，超出片长');
    }
    const n = cjkLen(line.text);
    if (n < 2) err('script.text', tag + ' 太短');
    if (n > 24) warn('script.text', tag + ' 有 ' + n + ' 字，一行放不下');
    if (line.at + line.dur > (duration - 0.2)) warn('script.overrun', tag + ' 压到片尾淡出');
    const host = shotAt(SHOTS, line.at);
    if (!host) {
      err('script.noShot', tag + ' 开始于 ' + line.at + 's，但那个时刻没有镜头');
    } else if (line.at + line.dur > host.end + 0.001) {
      const next = SHOTS.find((s) => s.start <= line.at + line.dur && s.end > line.at);
      warn('script.crossCut', tag + ' 跨过 ' + host.id + ' 的切点（' + next.id + '）');
    }
    if (line.screen && line.who === 'narrator') warn('script.screen', tag + ' 旁白不应标 screen');
  });

  /* ---------- 手机屏 ---------- */
  if (SHOTS.some((s) => s.phone)) {
    const p = SCRIPT.phone || {};
    ['incoming', 'typing', 'sent', 'contact'].forEach((k) => {
      if (!p[k]) err('script.phone', '有 phone 镜头，但 script.phone.' + k + ' 缺失');
    });
  }

  /* ---------- 片名卡与钩子 ---------- */
  const card = SCRIPT.titleCard;
  if (!card) {
    warn('script.titleCard', '没有 titleCard，片尾会缺少落版');
  } else {
    if (!(card.to > card.at)) err('script.titleCard', 'titleCard.to 必须大于 at');
    if (card.to > duration + 0.001) err('script.titleCard', 'titleCard 超出片长');
    if (card.at < duration - 4) warn('script.titleCard', 'titleCard 提前 ' + (duration - card.at).toFixed(1) + 's 出现');
    const lastLine = lines[lines.length - 1];
    if (lastLine && lastLine.at + lastLine.dur > card.at) {
      warn('script.titleCard', '最后一句台词与 titleCard 重叠 ' + (lastLine.at + lastLine.dur - card.at).toFixed(2) + 's');
    }
    if (card.hook && cjkLen(card.hook) > 24) warn('script.hook', '下集钩子 ' + cjkLen(card.hook) + ' 字，过长');
  }

  return { ok: errors.length === 0, errors, warnings, stats: { duration, shots: SHOTS.length, lines: lines.length, cast: castKeys.length } };
}

function main() {
  const args = process.argv.slice(2);
  let root = '.';
  let json = null;
  let strict = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') json = args[++i];
    else if (a === '--strict') strict = true;
    else if (a === '-h' || a === '--help') {
      console.log('用法: node tools/validate-story.js [project-dir] [--json out.json] [--strict]');
      process.exit(0);
    } else if (a.startsWith('--')) throw new Error('未知参数: ' + a);
    else root = a;
  }
  root = path.resolve(root);
  const result = validate(root);
  const t = result.stats;
  console.log('故事契约 · ' + path.basename(root));
  console.log('  片长 ' + t.duration + 's · ' + t.shots + ' 镜 · ' + t.lines + ' 句台词 · ' + t.cast + ' 个角色');
  result.warnings.forEach((w) => console.log('  ! ' + w.code + '  ' + w.msg));
  result.errors.forEach((e) => console.log('  × ' + e.code + '  ' + e.msg));
  if (json) {
    const out = path.resolve(json);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  }
  if (!result.ok) {
    console.log('\n  ' + result.errors.length + ' 个错误，先修好再渲染。');
    process.exit(1);
  }
  if (strict && result.warnings.length) {
    console.log('\n  strict：' + result.warnings.length + ' 个警告按错误处理。');
    process.exit(1);
  }
  console.log('\n  通过。');
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error('validate-story 失败：' + e.message);
    process.exit(1);
  }
}

module.exports = { validate, cjkLen };
