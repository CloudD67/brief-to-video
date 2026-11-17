#!/usr/bin/env node
/**
 * 从模板创建一个新的影片工程。
 *
 *   node new-film.js ./my-film --intake direction.json --title "北岸咖啡"
 *   node new-film.js --intake-template promo
 *
 * 建工程前先走七问定向（见 references/intake.md）：第 1 问用编辑器选择器定
 * promo / MV，之后每个类型各 6 问。答案写进 direction.json，再传给 --intake。
 *
 * 两种类型是两条独立的语法，不共用 look / 主题 / 版式：
 *   promo = 宣传片：编辑排版、look、主题、品牌信息
 *   mv    = MV：层叠剪纸叙事，原生 1920×1080、角色、镜头、底部歌词
 *
 * 只做四件事：复制模板、写七问答案、改配置、装依赖；宣传片与 MV 各留一份 treatment 底稿。
 * 不覆盖已存在的目录。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STARTER_TEMPLATE = path.resolve(__dirname, '..', 'assets', 'template');
const DEMO_TEMPLATE = path.resolve(__dirname, '..', 'assets', 'demo-editorial');
const MV_TEMPLATE = path.resolve(__dirname, '..', 'assets', 'genres', 'mv');

function usage() {
  console.log(`用法: node new-film.js <target-dir> --intake direction.json [options]
       node new-film.js --intake-template promo|mv

  建工程前先问完七问（宣传片 / MV 各 7 问）：
  第 1 问用编辑器选择器定类型，之后 6 问定方向与边界；完整问题库见 references/intake.md。
  答案写成 direction.json，再传 --intake；非终端没有 --intake 会直接报错。

  --intake <file>     七问答案 JSON（非终端必填；--intake-template 生成骨架）
  --intake-template <g>  打印 promo|mv 的空白骨架后退出
  --genre <g>         promo | mv；从 intake 读；与 intake 冲突会报错
  --demo              仅 promo：复制七场编辑排版示例（不是默认骨架）
  --resolution <r>    仅 mv：1080p | 4k，默认 1080p（4K = renderScale 2，矢量重画）
  --title <str>       片名（promo 默认「未命名影片」，MV 默认「把答案拼好」）
  --brief <str>       一句话需求；不传时由七问答案拼成
  --look <id>         仅 promo：七问第 5 问选定的 look（见 node tools/pick-look.js --list）
  --layout <name>     仅 promo：强制版式 editorial|poster|grid|split
  --style <name>      仅 promo：强制主题 letterpress|swiss|cinema|quiet|tech
  --brand <str>       品牌字（promo 页眉 / MV 片尾）
  --brand-sub <str>   品牌副标（MV 片尾中文名取斜杠前第一段）
  --slogan <str>      片尾标语
  --disclaimer <str>  免责声明 / 片尾注脚（MV 写进 endNote）
  --duration <sec>    仅 promo：时长；从 intake 的 format 读
  --width <px>        画布宽；从 intake 的 format 读
  --height <px>       画布高；从 intake 的 format 读
  --size <WxH>        画布尺寸，例如 1920x1080
  --vertical          仅 promo：竖屏 9:16（= --size 1080x1920）；从 intake 读
  --poster-at <sec>   封面帧在成片中的秒数；promo 默认 duration-1.7，MV 沿用模板 58.6
  --no-install        跳过 npm install
  --force             允许写入非空目录（谨慎）
  -h, --help          显示帮助

示例:
  node new-film.js --intake-template promo > direction.json
  node new-film.js ../../films/coffee --intake direction.json --title "北岸咖啡"
  node new-film.js ../../films/mv --intake direction-mv.json --title "把灯留着" --brand "TIDE HARBOR"
`);
}

function parse(argv) {
  const opts = { install: true, genre: null, vertical: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) throw new Error('缺少参数值: ' + a);
      return v;
    };
    switch (a) {
      case '-h': case '--help': usage(); process.exit(0); break;
      case '--intake': opts.intake = next(); break;
      case '--genre': opts.genre = normalizeGenre(next()); break;
      case '--demo': opts.demo = true; break;
      case '--resolution': opts.resolution = normalizeResolution(next()); break;
      case '--style': opts.style = next(); break;
      case '--look': opts.look = next(); break;
      case '--layout': opts.layout = next(); break;
      case '--brief': opts.brief = next(); break;
      case '--width': opts.width = Number(next()); break;
      case '--height': opts.height = Number(next()); break;
      case '--size': {
        const m = /^(\d+)x(\d+)$/i.exec(next());
        if (!m) throw new Error('--size 格式应为 1920x1080');
        opts.width = Number(m[1]);
        opts.height = Number(m[2]);
        break;
      }
      case '--vertical': opts.width = 1080; opts.height = 1920; opts.vertical = true; break;
      case '--title': opts.title = next(); break;
      case '--brand': opts.brand = next(); break;
      case '--brand-sub': opts.brandSub = next(); break;
      case '--slogan': opts.slogan = next(); break;
      case '--disclaimer': opts.disclaimer = next(); break;
      case '--duration': opts.duration = Number(next()); break;
      case '--poster-at': opts.posterAt = Number(next()); break;
      case '--no-install': opts.install = false; break;
      case '--force': opts.force = true; break;
      default:
        if (a.startsWith('--')) throw new Error('未知参数: ' + a);
        if (!opts.target) opts.target = a;
        else throw new Error('只能指定一个目标目录');
    }
  }
  if (!opts.target) throw new Error('缺少目标目录\n\n' + '用法: node new-film.js <target-dir> --intake direction.json [options]');
  if (opts.width) opts.width = Math.round(opts.width / 2) * 2;
  if (opts.height) opts.height = Math.round(opts.height / 2) * 2;
  if (opts.duration && !(opts.duration > 1)) throw new Error('--duration 必须大于 1 秒');
  if (opts.style && !/^[a-z0-9-]+$/.test(opts.style)) throw new Error('--style 只能是小写字母、数字和连字符');
  if (opts.look && !/^[a-z0-9-]+$/.test(opts.look)) throw new Error('--look 只能是小写字母、数字和连字符');
  if (opts.layout && !/^[a-z0-9-]+$/.test(opts.layout)) throw new Error('--layout 只能是小写字母、数字和连字符');
  return opts;
}

function normalizeGenre(v) {
  const s = String(v).trim().toLowerCase();
  if (s === 'promo' || s === '宣传片') return 'promo';
  if (s === 'mv' || s === 'paper-story' || s === 'paper') return 'mv';
  throw new Error('未知类型: ' + v + '\n可用: promo（宣传片） / mv（MV）');
}

function normalizeResolution(v) {
  const s = String(v).trim().toLowerCase();
  if (s === '1080p' || s === '1080' || s === 'fhd') return 1;
  if (s === '4k' || s === '2160p' || s === 'uhd') return 2;
  throw new Error('未知分辨率: ' + v + '\n可用: 1080p / 4k');
}

/* ── 七问定向 ─────────────────────────────────────── */

const PROMO_IDS = {
  subjects: ['software', 'hardware', 'space', 'people'],
  audiences: ['consumer', 'pro', 'internal', 'public'],
  memories: ['moment', 'use', 'problem', 'lifestyle'],
  formats: ['60-16x9', '30-16x9', '30-9x16', '15-9x16'],
  audio: ['synth', 'voice', 'user-music', 'silent'],
  materials: ['none', 'user']
};

const MV_IDS = {
  music: ['song', 'instrumental', 'synth', 'silent'],
  protagonists: ['one', 'two', 'ensemble', 'object'],
  wants: ['wait', 'leave', 'keep', 'remember'],
  endings: ['reunion', 'release', 'continue', 'open'],
  moods: ['dusk-night-storm-dawn', 'day-dusk-night', 'rain-warm-snow', 'other']
};

const FORMATS = {
  '60-16x9': { duration: 60, width: 1920, height: 1080 },
  '30-16x9': { duration: 30, width: 1920, height: 1080 },
  '30-9x16': { duration: 30, width: 1080, height: 1920 },
  '15-9x16': { duration: 15, width: 1080, height: 1920 }
};

const LABELS = {
  subject: { software: '软件 / AI / 平台', hardware: '硬件 / 实体产品', space: '空间 / 场所 / 服务', people: '人物 / 团队 / 理念' },
  audience: { consumer: '潜在客户', pro: '专业客户 / 合作方', internal: '内部 / 投资人', public: '公众 / 社媒' },
  memory: { moment: '一个具体时刻', use: '产品被使用的一瞬', problem: '一个麻烦被解决', lifestyle: '一种生活方式' },
  format: { '60-16x9': '60s · 16:9', '30-16x9': '30s · 16:9', '30-9x16': '30s · 9:16', '15-9x16': '15s · 9:16' },
  audio: { synth: '本地合成配乐', voice: '中文口播 + 配乐', 'user-music': '用户提供音乐', silent: '静音' },
  materials: { none: '代码绘制', user: '用户提供素材' },
  music: { song: '成品歌 + 歌词', instrumental: '纯音乐', synth: '本地合成配乐', silent: '静音' },
  protagonist: { one: '一个人', two: '两个人', ensemble: '一群人', object: '一个地方 / 物件的视角' },
  want: { wait: '等一个人回来', leave: '离开熟悉的地方', keep: '守住一件东西', remember: '找回一段记忆 / 一个人' },
  ending: { reunion: '重逢', release: '释然 / 放下', continue: '继续上路', open: '没有答案，但人变了' },
  moodArc: {
    'dusk-night-storm-dawn': '黄昏 → 夜 → 风暴 → 黎明',
    'day-dusk-night': '白昼 → 黄昏 → 深夜',
    'rain-warm-snow': '冷雨 → 暖室 → 雪停',
    other: '其他'
  }
};

function intakeTemplate(genre) {
  if (genre === 'promo') {
    return JSON.stringify({
      _readme: '七问答案：把每个字段改成实际选择后再传给 --intake；选项见 references/intake.md',
      genre: 'promo',
      subject: 'software|hardware|space|people',
      subjectNote: '',
      audience: 'consumer|pro|internal|public',
      audienceNote: '',
      memory: 'moment|use|problem|lifestyle',
      memoryNote: '',
      look: '<look-id 或 auto>',
      lookAuthorized: false,
      avoid: [],
      format: '60-16x9|30-16x9|30-9x16|15-9x16',
      audio: 'synth|voice|user-music|silent',
      materials: 'none|user'
    }, null, 2) + '\n';
  }
  return JSON.stringify({
    _readme: '七问答案：把每个字段改成实际选择后再传给 --intake；选项见 references/intake.md',
    genre: 'mv',
    music: 'song|instrumental|synth|silent',
    musicNote: '',
    protagonist: 'one|two|ensemble|object',
    protagonistNote: '',
    want: 'wait|leave|keep|remember',
    wantNote: '',
    ending: 'reunion|release|continue|open',
    endingNote: '',
    avoid: [],
    moodArc: 'dusk-night-storm-dawn|day-dusk-night|rain-warm-snow|other',
    reference: ''
  }, null, 2) + '\n';
}

function loadLooks() {
  return require(path.join(STARTER_TEMPLATE, 'js', 'looks.js'));
}

function requireChoice(data, key, list, label) {
  const v = data[key];
  if (!v || typeof v !== 'string') {
    throw new Error('direction.json 缺「' + key + '」：七问里的「' + label + '」还没有答案');
  }
  if (list.indexOf(v) === -1) {
    throw new Error('direction.json 的 ' + key + ' 不认识：' + v + '\n可用：' + list.join(' / '));
  }
}

function validateIntake(data) {
  if (!Array.isArray(data.avoid)) {
    throw new Error('direction.json 缺 avoid 数组：七问第 6 问「最怕变成什么」；没有就给 []');
  }
  if (data.genre === 'promo') {
    requireChoice(data, 'subject', PROMO_IDS.subjects, '主角是什么');
    requireChoice(data, 'audience', PROMO_IDS.audiences, '给谁看');
    requireChoice(data, 'memory', PROMO_IDS.memories, '只记住一个东西');
    requireChoice(data, 'format', PROMO_IDS.formats, '交付形态');
    if (!data.look) throw new Error('direction.json 缺「look」：七问第 5 问还没有答案');
    if (data.look === 'auto') {
      if (data.lookAuthorized !== true) throw new Error('look: "auto" 只在用户明确授权代选时使用，并写 lookAuthorized: true');
    } else if (!loadLooks().getLook(data.look)) {
      throw new Error('未知 look: ' + data.look + '\n可用：' + loadLooks().listLooks().map(l => l.id).join(' / '));
    }
    if (data.audio == null) data.audio = 'synth';
    if (data.materials == null) data.materials = 'none';
    if (PROMO_IDS.audio.indexOf(data.audio) === -1) throw new Error('direction.json 的 audio 不认识：' + data.audio);
    if (PROMO_IDS.materials.indexOf(data.materials) === -1) throw new Error('direction.json 的 materials 不认识：' + data.materials);
  } else {
    requireChoice(data, 'music', MV_IDS.music, '歌 / 声音从哪来');
    requireChoice(data, 'protagonist', MV_IDS.protagonists, '这是谁的故事');
    requireChoice(data, 'want', MV_IDS.wants, '最想要什么、什么挡着');
    requireChoice(data, 'ending', MV_IDS.endings, '最后停在什么情绪');
    requireChoice(data, 'moodArc', MV_IDS.moods, '想要什么情绪走向');
  }
}

function loadIntake(source, genre) {
  const s = String(source || '').trim();
  let raw;
  if (s.startsWith('{')) raw = s;
  else raw = fs.readFileSync(path.resolve(process.cwd(), s), 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error('direction JSON 解析失败：' + e.message);
  }
  data.genre = normalizeGenre(data.genre || genre);
  if (genre && data.genre !== genre) {
    throw new Error('--genre 是 ' + genre + '，但 direction.json 写的是 ' + data.genre + '；先统一再建工程');
  }
  validateIntake(data);
  return data;
}

function intakeBrief(intake, genre) {
  if (genre === 'promo') {
    return [intake.subjectNote, intake.audienceNote, intake.memoryNote].filter(Boolean).join('；');
  }
  return [intake.protagonistNote, intake.wantNote, intake.endingNote].filter(Boolean).join('；');
}

function applyIntake(opts, intake, genre) {
  opts.genre = genre;
  if (!opts.brief) opts.brief = intakeBrief(intake, genre);
  if (genre === 'promo') {
    const f = FORMATS[intake.format];
    if (opts.duration && opts.duration !== f.duration) {
      throw new Error('--duration ' + opts.duration + ' 与七问第 7 问 ' + intake.format + '（' + f.duration + 's）不一致');
    }
    if (opts.width && opts.width !== f.width) {
      throw new Error('--width ' + opts.width + ' 与七问第 7 问 ' + intake.format + '（' + f.width + '）不一致');
    }
    if (opts.height && opts.height !== f.height) {
      throw new Error('--height ' + opts.height + ' 与七问第 7 问 ' + intake.format + '（' + f.height + '）不一致');
    }
    if (opts.vertical && f.width > f.height) {
      throw new Error('--vertical 与七问第 7 问 ' + intake.format + '（横屏）不一致');
    }
    opts.duration = f.duration;
    opts.width = f.width;
    opts.height = f.height;
    opts.vertical = f.width < f.height;
    if (opts.look && intake.look === 'auto') {
      throw new Error('direction.json 已把 look 交给 AI（auto），不要再传 --look');
    }
    if (opts.look && opts.look !== intake.look) {
      throw new Error('--look ' + opts.look + ' 与七问第 5 问 ' + intake.look + ' 不一致');
    }
    opts.look = intake.look === 'auto' ? null : intake.look;
    opts.grammar = intake.subject === 'software' ? 'screen' : 'world';
  } else {
    opts.grammar = null;
  }
}

function cell(s) {
  return String(s == null ? '' : s).replace(/\|/g, '／').replace(/\s*\n\s*/g, ' ').trim();
}

function joinNote(label, note) {
  return [label, note].filter(Boolean).join(' — ');
}

function directionTable(intake, genre) {
  const rows = [['1', '类型', genre === 'mv' ? 'MV（paper-story）' : '宣传片（promo）']];
  if (genre === 'promo') {
    rows.push(['2', '主角', joinNote(LABELS.subject[intake.subject], intake.subjectNote)]);
    rows.push(['3', '给谁看 / 看完做什么', joinNote(LABELS.audience[intake.audience], intake.audienceNote)]);
    rows.push(['4', '唯一记忆点', joinNote(LABELS.memory[intake.memory], intake.memoryNote)]);
    rows.push(['5', '气质 / look', intake.look]);
    rows.push(['6', '最怕变成', intake.avoid.length ? intake.avoid.join('；') : '用户未指定']);
    rows.push(['7', '交付', LABELS.format[intake.format] + ' · ' + LABELS.audio[intake.audio] + ' · ' + LABELS.materials[intake.materials]]);
  } else {
    rows.push(['2', '歌 / 声音', joinNote(LABELS.music[intake.music], intake.musicNote)]);
    rows.push(['3', '谁的故事', joinNote(LABELS.protagonist[intake.protagonist], intake.protagonistNote)]);
    rows.push(['4', '想要什么 / 什么挡着', joinNote(LABELS.want[intake.want], intake.wantNote)]);
    rows.push(['5', '情绪落点', joinNote(LABELS.ending[intake.ending], intake.endingNote)]);
    rows.push(['6', '最怕变成', intake.avoid.length ? intake.avoid.join('；') : '用户未指定']);
    rows.push(['7', '情绪走向', LABELS.moodArc[intake.moodArc]]);
  }
  return ['| # | 问 | 答 |', '|---|---|---|']
    .concat(rows.map(r => '| ' + r.map(cell).join(' | ') + ' |'))
    .join('\n');
}

function directionLock(intake, genre) {
  if (genre === 'promo') {
    return {
      anchor: joinNote(LABELS.subject[intake.subject], intake.subjectNote) || '（主体在这一支片里只负责什么；一句话）',
      promise: joinNote(LABELS.memory[intake.memory], intake.memoryNote) || '（看完记住的那个变化或画面）',
      notThis: intake.avoid.length ? intake.avoid.join('；') : '（最容易跑偏的两种片，例如 功能演示 / 城市空镜集 / 品牌隐喻诗）'
    };
  }
  return {
    anchor: joinNote(LABELS.protagonist[intake.protagonist], intake.protagonistNote) || '（这是谁的故事；一句话）',
    promise: joinNote(LABELS.ending[intake.ending], intake.endingNote) || '（最后一个镜头要让观众感到什么）',
    notThis: intake.avoid.length ? intake.avoid.join('；') : '（最容易跑偏的两种片，例如 纯空镜 MV / 风景明信片 / 抽象诗）'
  };
}

function nonTtyIntakeError(genre) {
  const g = genre === 'mv' ? 'mv' : (genre === 'promo' ? 'promo' : 'promo');
  return '建工程前必须先问完七问（见 references/intake.md）。\n' +
    '把答案写成 direction.json，再传 --intake direction.json；\n' +
    '或先跑 node new-film.js --intake-template ' + g + ' 生成骨架。\n' +
    '不要用 --genre + 默认值绕过。';
}

function askChoice(title, options, defaultIndex) {
  console.log('\n' + title);
  options.forEach((o, i) => console.log('  [' + (i + 1) + '] ' + o.label + (o.hint ? ' — ' + o.hint : '')));
  const def = defaultIndex == null ? 0 : defaultIndex;
  const answer = askLine('选择 [' + (def + 1) + ']: ').trim();
  if (!answer) return options[def].id;
  const n = Number(answer);
  if (n >= 1 && n <= options.length) return options[n - 1].id;
  const hit = options.find(o => o.id === answer || o.label === answer);
  if (hit) return hit.id;
  throw new Error('无法识别选项：' + answer);
}

function askText(title, fallback) {
  const answer = askLine(title + '（回车跳过）: ').trim();
  return answer || fallback || '';
}

function askMulti(title, options) {
  console.log('\n' + title + '（可多选，逗号分隔编号；直接回车 = 都没有）');
  options.forEach((o, i) => console.log('  [' + (i + 1) + '] ' + o.label));
  const answer = askLine('选择: ').trim();
  if (!answer) return [];
  const out = [];
  answer.split(/[,，]+/).forEach(token => {
    const t = token.trim();
    if (!t) return;
    const n = Number(t);
    if (n >= 1 && n <= options.length) out.push(options[n - 1].label);
    else out.push(t);
  });
  return out;
}

function askLook() {
  const LOOKS = loadLooks();
  const list = LOOKS.listLooks();
  console.log('\n第 5 问：你想要什么气质？');
  list.forEach((l, i) => {
    console.log('  [' + (i + 1) + '] ' + l.id + ' · ' + l.name + ' — ' + l.desc);
  });
  const answer = askLine('输入编号或 look id（直接回车 = 交给 AI 代选，需你确认）: ').trim();
  if (!answer || answer === 'auto') return 'auto';
  const n = Number(answer);
  if (n >= 1 && n <= list.length) return list[n - 1].id;
  if (LOOKS.getLook(answer)) return answer;
  throw new Error('未知 look：' + answer);
}

function askPromoIntake() {
  const subject = askChoice('第 2 问：这支片的主角是什么？', [
    { id: 'software', label: '软件 / AI / 平台', hint: '真屏语法：真实界面、屏幕长镜、主题色间幕卡' },
    { id: 'hardware', label: '硬件 / 实体产品', hint: '世界语法：真实空间与光、材质微距、屏幕 ≤30%' },
    { id: 'space', label: '空间 / 场所 / 服务', hint: '世界语法：人在这个空间里做什么' },
    { id: 'people', label: '人物 / 团队 / 理念', hint: '人物与行动为主，产品只做证据' }
  ]);
  const subjectNote = askText('用一句话补充主角 / 具体产品');
  const audience = askChoice('第 3 问：给谁看，看完你希望他们做什么？', [
    { id: 'consumer', label: '潜在客户', hint: '记住并想了解 / 购买' },
    { id: 'pro', label: '专业客户 / 合作方', hint: '评估并愿意接触' },
    { id: 'internal', label: '内部 / 投资人', hint: '理解方向并支持' },
    { id: 'public', label: '公众 / 社媒', hint: '愿意看完并转发' }
  ]);
  const audienceNote = askText('补充观众、使用场景或投放平台');
  const memory = askChoice('第 4 问：如果观众只记住一个东西，你希望是什么？', [
    { id: 'moment', label: '一个具体时刻', hint: '人和产品在某个瞬间发生的事' },
    { id: 'use', label: '产品被使用的一瞬', hint: '真实生活里的一个动作' },
    { id: 'problem', label: '一个麻烦被解决', hint: '先看见麻烦，再看见解决' },
    { id: 'lifestyle', label: '一种生活方式', hint: '让人想靠近的气质与日常' }
  ]);
  const memoryNote = askText('用一句话说出那个画面');
  const look = askLook();
  const avoid = askMulti('第 6 问：你最怕这支片变成什么？', [
    { label: '功能演示 / 只拍屏幕' },
    { label: '城市空镜集' },
    { label: '产品参数目录' },
    { label: '空洞的品牌隐喻诗' }
  ]);
  const format = askChoice('第 7 问：交付形态？', [
    { id: '60-16x9', label: '60s · 16:9 · 合成乐 · 无旁白' },
    { id: '30-16x9', label: '30s · 16:9 · 中文口播 + 配乐' },
    { id: '30-9x16', label: '30s · 9:16 · 合成乐 · 无旁白' },
    { id: '15-9x16', label: '15s · 9:16 · 合成乐 · 无旁白' }
  ]);
  return {
    genre: 'promo', subject, subjectNote, audience, audienceNote, memory, memoryNote,
    look, lookAuthorized: look === 'auto', avoid, format,
    audio: format === '30-16x9' ? 'voice' : 'synth',
    materials: 'none'
  };
}

function askMvIntake() {
  const music = askChoice('第 2 问：歌 / 声音从哪来？', [
    { id: 'song', label: '我有成品歌 + 歌词', hint: '建完用 npm run song 接入' },
    { id: 'instrumental', label: '我有纯音乐，没有歌词', hint: '歌词由 AI 写，或只用画面内文字' },
    { id: 'synth', label: '还没有音乐', hint: '本地合成配乐' },
    { id: 'silent', label: '想做成静音片', hint: '只靠画面与文字' }
  ]);
  const musicNote = askText('音频 / 歌词文件在哪？或补充声音想法');
  const protagonist = askChoice('第 3 问：这是谁的故事？', [
    { id: 'one', label: '一个人', hint: '一个主角的等待、出发或选择' },
    { id: 'two', label: '两个人', hint: '相遇、分离或谁在等谁' },
    { id: 'ensemble', label: '一群人', hint: '共同经历一件事的群像' },
    { id: 'object', label: '一个地方 / 物件的视角', hint: '拟人视角，但要落到人的情感' }
  ]);
  const protagonistNote = askText('用一句话补充主角与关系');
  const want = askChoice('第 4 问：他 / 她最想要什么，什么挡着？', [
    { id: 'wait', label: '等一个人回来', hint: '时间、距离或天气阻挡' },
    { id: 'leave', label: '离开熟悉的地方', hint: '牵绊与不舍阻挡' },
    { id: 'keep', label: '守住一件东西', hint: '外部力量要把它拿走' },
    { id: 'remember', label: '找回一段记忆 / 一个人', hint: '遗忘与时间阻挡' }
  ]);
  const wantNote = askText('用一句话补充欲望与阻力');
  const ending = askChoice('第 5 问：最后一个镜头，你希望停在什么情绪？', [
    { id: 'reunion', label: '重逢', hint: '暖，但不一定圆满' },
    { id: 'release', label: '释然 / 放下', hint: '轻一点，留白' },
    { id: 'continue', label: '继续上路', hint: '开阔，不回头' },
    { id: 'open', label: '没有答案，但人变了', hint: '余味' }
  ]);
  const endingNote = askText('用一句话补充最后一个画面');
  const avoid = askMulti('第 6 问：你最怕这支 MV 变成什么？', [
    { label: '纯空镜风景片' },
    { label: '歌词配图' },
    { label: '抽象诗' },
    { label: '角色走过场' }
  ]);
  const moodArc = askChoice('第 7 问：你想要什么情绪走向？', [
    { id: 'dusk-night-storm-dawn', label: '黄昏 → 夜 → 风暴 → 黎明', hint: '先压后扬' },
    { id: 'day-dusk-night', label: '白昼 → 黄昏 → 深夜', hint: '慢慢沉下去' },
    { id: 'rain-warm-snow', label: '冷雨 → 暖室 → 雪停', hint: '从冷到暖' },
    { id: 'other', label: '其他（我来说）' }
  ]);
  return {
    genre: 'mv', music, musicNote, protagonist, protagonistNote, want, wantNote,
    ending, endingNote, avoid, moodArc, reference: ''
  };
}

function askIntake(genre) {
  console.log('\n七问定向：先定方向。答完我会先回述理解，再写 treatment 给你确认。');
  return genre === 'promo' ? askPromoIntake() : askMvIntake();
}

function askLine(question) {
  process.stdout.write(question);
  let out = '';
  for (;;) {
    const buf = Buffer.alloc(64);
    let n;
    try {
      n = fs.readSync(0, buf, 0, buf.length, null);
    } catch (e) {
      throw new Error('读取终端输入失败：' + e.message);
    }
    if (!n) break;
    out += buf.toString('utf8', 0, n);
    if (out.indexOf('\n') !== -1) break;
  }
  return out.replace(/[\r\n].*$/, '').trim();
}

/* 省略 --genre 时的第一道分叉。非终端不猜，直接要求调用方问用户。 */
function chooseGenre(opts) {
  if (opts.genre) return opts.genre;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      '未指定影片类型。先问用户要做「宣传片」还是「MV」，并走完七问。\n' +
      '  宣传片 = 编辑排版 / look / 主题 / 品牌信息\n' +
      '  MV     = 层叠剪纸叙事 / 角色 / 镜头 / 底部歌词，不使用 look / 版式\n\n' +
      nonTtyIntakeError(null)
    );
  }
  const answer = askLine(
    '\n这支片属于哪一种？\n' +
    '  [1] 宣传片 · 编辑排版 / look / 品牌信息\n' +
    '  [2] MV     · 层叠剪纸叙事 / 角色 / 镜头 / 底部歌词\n' +
    '选择 [1]: '
  ).toLowerCase();
  if (!answer || answer === '1' || answer === 'promo' || answer === '宣传片') return 'promo';
  if (answer === '2' || answer === 'mv' || answer === 'paper-story' || answer === 'paper') return 'mv';
  throw new Error('无法识别类型：' + answer + '（输入 1 或 2）');
}

function setField(source, key, literal) {
  const re = new RegExp('(\\n\\s*' + key + ':\\s*)([^,\\n]+)(,?)');
  if (!re.test(source)) throw new Error('配置里找不到字段: ' + key);
  return source.replace(re, (m, pre, value, comma) => pre + literal + comma);
}

function chromePath() {
  const list = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
  ];
  return process.env.CHROME_PATH || list.find(p => fs.existsSync(p)) || null;
}

function mvGuard(opts) {
  if (opts.look || opts.style || opts.layout) {
    throw new Error('MV 没有 look / 主题 / 版式；--look、--style、--layout 只属于宣传片。');
  }
  if (opts.vertical) {
    throw new Error('MV 是 16:9 横屏剪纸叙事；竖屏要重排 1080×1920 的场景，不能用 --vertical 缩放。');
  }
  /* 1080p 是默认交付；4K 只是设备像素比 2，坐标与场景不改 */
  if (!opts.resolution) opts.resolution = 1;
  if (opts.duration && opts.duration !== 60) {
    throw new Error(
      'MV 示范模板按 60s 分镜编写（24 镜 × 2.5s）。改片长请改 js/film.js：增删镜头、让每镜保持 2–3 秒，\n' +
      '并把最后一行收在新的总时长上；不要用 --duration 缩放，否则每镜会短于 2 秒。'
    );
  }
  const w = opts.width || 1920;
  const h = opts.height || 1080;
  if (w !== 1920 || h !== 1080) {
    throw new Error('MV 场景按原生 1920×1080 写坐标；当前 ' + w + 'x' + h +
      '。要 4K 用 --resolution 4k（renderScale 2 矢量重画），不要改画布尺寸。');
  }
}

function main() {
  const argv = process.argv.slice(2);
  const tplAt = argv.indexOf('--intake-template');
  if (tplAt !== -1) {
    const g = argv[tplAt + 1];
    if (!g) throw new Error('--intake-template 需要 promo 或 mv');
    console.log(intakeTemplate(normalizeGenre(g)));
    return;
  }
  const opts = parse(argv);
  let intake = null;
  if (opts.intake) {
    intake = loadIntake(opts.intake, opts.genre);
    opts.genre = intake.genre;
  }
  const genre = chooseGenre(opts);
  if (!intake) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error(nonTtyIntakeError(genre));
    intake = askIntake(genre);
    validateIntake(intake);
  }
  applyIntake(opts, intake, genre);
  if (genre === 'mv' && opts.demo) {
    throw new Error('--demo 只属于宣传片；MV 模板本身就是一支示范分镜，建完请整段替换 film.js。');
  }
  const target = path.resolve(process.cwd(), opts.target);
  const TEMPLATE = genre === 'mv' ? MV_TEMPLATE : (opts.demo ? DEMO_TEMPLATE : STARTER_TEMPLATE);
  if (!fs.existsSync(TEMPLATE)) throw new Error('模板不存在: ' + TEMPLATE);

  if (fs.existsSync(target) && fs.readdirSync(target).length > 0 && !opts.force) {
    throw new Error('目标目录已存在且非空: ' + target + '\n换一个名字，或确认后加 --force');
  }

  if (genre === 'mv') mvGuard(opts);
  else if (opts.resolution) throw new Error('--resolution 只属于 MV；宣传片分辨率由 render.js --scale 控制。');

  let LOOKS = null;
  if (genre === 'promo') {
    const themeDir = path.join(TEMPLATE, 'styles', 'themes');
    const themeList = fs.readdirSync(themeDir).filter(f => f.endsWith('.css')).map(f => f.replace(/\.css$/, '')).sort();
    if (opts.style && themeList.indexOf(opts.style) === -1) {
      throw new Error('未知风格: ' + opts.style + '\n可用: ' + themeList.join(' / '));
    }
    LOOKS = require(path.join(TEMPLATE, 'js', 'looks.js'));
    if (opts.look && !LOOKS.getLook(opts.look)) {
      throw new Error('未知 look: ' + opts.look + '\n可用: ' + LOOKS.listLooks().map(l => l.id).join(' / '));
    }
    if (opts.layout && !LOOKS.LAYOUTS[opts.layout]) {
      throw new Error('未知版式: ' + opts.layout + '\n可用: ' + Object.keys(LOOKS.LAYOUTS).join(' / '));
    }
  }

  const brief = opts.brief || [opts.title, opts.slogan, opts.brandSub].filter(Boolean).join(' ');
  const resolved = genre === 'mv'
    ? { look: null, auto: false }
    : (opts.look ? { look: LOOKS.getLook(opts.look), auto: false }
      : { look: LOOKS.chooseLook(brief, { theme: opts.style || null }).look, auto: true });

  fs.mkdirSync(target, { recursive: true });
  const SKIP = new Set(['node_modules', '.git', 'qa', 'frames', 'out', 'stills']);
  fs.cpSync(TEMPLATE, target, {
    recursive: true,
    filter: (src) => !SKIP.has(path.basename(src)) && path.basename(src) !== 'treatment.md'
  });

  /* 七问答案落盘：后续写 treatment、改分镜、交付都要先读它，不能各写各的。 */
  const direction = Object.assign({}, intake);
  delete direction._readme;
  fs.writeFileSync(path.join(target, 'direction.json'), JSON.stringify(direction, null, 2) + '\n');

  const configPath = path.join(target, 'js', 'config.js');
  let config = fs.readFileSync(configPath, 'utf8');
  if (genre === 'promo') {
    if (opts.style) config = setField(config, 'style', JSON.stringify(opts.style));
    if (opts.look) config = setField(config, 'look', JSON.stringify(opts.look));
    if (opts.layout) config = setField(config, 'layout', JSON.stringify(opts.layout));
    config = setField(config, 'grammar', JSON.stringify(opts.grammar));
  }
  if (opts.brief) config = setField(config, 'brief', JSON.stringify(opts.brief));
  if (opts.title) config = setField(config, 'title', JSON.stringify(opts.title));
  if (opts.brand) config = setField(config, 'brand', JSON.stringify(opts.brand));
  if (opts.brandSub) config = setField(config, 'brandSub', JSON.stringify(opts.brandSub));
  if (opts.slogan) config = setField(config, 'slogan', JSON.stringify(opts.slogan));
  if (opts.disclaimer) config = setField(config, 'disclaimer', JSON.stringify(opts.disclaimer));
  if (opts.width) config = setField(config, 'width', String(opts.width));
  if (opts.height) config = setField(config, 'height', String(opts.height));
  if (genre === 'mv') {
    /* 分辨率写进 config：默认 1080p，render.js 不传 --scale 时读这里 */
    config = setField(config, 'renderScale', String(opts.resolution));
    if (opts.brand) {
      const tag = String(opts.brand).toUpperCase().replace(/[^\x20-\x7e]/g, '').trim() + ' · PAPER STORY';
      config = setField(config, 'endTag', JSON.stringify(tag));
    }
    /* 60s 分镜是绝对秒数，封面时间不再做 60s 基准换算 */
    if (opts.posterAt) config = setField(config, 'posterAt', String(opts.posterAt));
  } else {
    if (opts.duration) {
      config = setField(config, 'duration', String(opts.duration));
      if (!opts.posterAt) {
        const eff = Math.max(0.5, opts.duration - 1.7);
        config = setField(config, 'posterAt', String(+(eff * 60 / opts.duration).toFixed(1)));
      }
    }
    if (opts.posterAt) {
      const dur = opts.duration || 60;
      if (!(opts.posterAt >= 0 && opts.posterAt < dur)) throw new Error('--poster-at 必须落在 0 与片长之间');
      config = setField(config, 'posterAt', String(Math.min(59.9, +(opts.posterAt * 60 / dur).toFixed(2))));
    }
  }
  fs.writeFileSync(configPath, config);

  /* 每支片先扩写再分镜：工程里留一份 treatment.md 底稿（已存在则不覆盖）。
     两种类型内容不同：宣传片见 references/brief-expansion.md；
     MV 见 references/mv-craft.md §0（背景/人物/关系/母题/歌词段/候选镜/mood）。 */
  const qTable = directionTable(intake, genre);
  const lock = directionLock(intake, genre);
  if (genre === 'promo') {
    const treatmentPath = path.join(target, 'treatment.md');
    if (!fs.existsSync(treatmentPath)) {
      const titleText = opts.title || '未命名影片';
      const briefText = opts.brief || '（一句话 brief）';
      const duration = opts.duration || 60;
      const quota = duration >= 60
        ? { spaces: 6, sequences: 10, shots: 30, palettes: 4 }
        : duration >= 30
          ? { spaces: 5, sequences: 8, shots: 20, palettes: 4 }
          : { spaces: 4, sequences: 6, shots: 14, palettes: 3 };
      fs.writeFileSync(treatmentPath, `# ${titleText} · treatment
类型：宣传片 · promo　写作轨道：世界 / 空间 / 序列 / 色域

> 一句话 brief：${briefText}
> 这份底稿先于分镜写；写完给用户过目，再写分镜表。
> 不设字数上下限，写得越详细越好：每个空间、每个动作、每条候选镜都要写到能直接拍。
> 下限（${duration}s）：≥${quota.spaces} 空间 · ≥${quota.sequences} 序列 · ≥${quota.shots} 候选镜 · ≥${quota.palettes} 色域。配额是下限，不是处方。

## 0.0 制作人七问（direction.json）
${qTable}

## 0. 方向锁
- 主体锚点：${lock.anchor}
- 观众承诺：${lock.promise}
- 这不是：${lock.notThis}
- Wild card：（一个不直接展示主体、但解释主体带来的改变的镜头）

## 1. 一句话故事
（主角是谁、想要什么、被什么挡住、最后改变了什么）

## 2. 空间表（≥${quota.spaces}）
| # | 空间 | 时间/光 | 材质与声音 | 产品在做什么 |

## 3. 主角
（只写与产品动作有关的人：手上做什么、留下什么痕迹；不写前史、关系与内心戏）

## 4. 序列表（候选 ≥${quota.sequences}，最后留 6–8）
| # | 段落 | 动作/判断 | 空间 | 色域 | 进片? |

## 5. 候选镜头（≥${quota.shots}，最后留 20–30）
| # | 镜头 | 景别/机位 | 主体动作 | 空间 | 光 | 备注 |

## 6. 色域表（≥${quota.palettes}，每个 ≥8%，主色域 ≤60%）
| 色域 | 颜色 | 情绪 | 对应空间/段落 | 占比 |

## 7. 声音与文案草案
（环境声、音乐情绪、旁白/字幕主题；文案最后写）

## 8. 删除日志
（删掉的镜头与原因——被删的比留下的更能说明这支片的选择）
`);
    }
  } else {
    const treatmentPath = path.join(target, 'treatment.md');
    if (!fs.existsSync(treatmentPath)) {
      const titleText = opts.title || '未命名 MV';
      const briefText = opts.brief || '（一句话 brief）';
      const people = intake.protagonist === 'ensemble' ? ['A', 'B', 'C'] : ['A', 'B'];
      const peopleText = people.map(p => `### 人物 ${p}
- 想要什么：
- 怕什么：
- 不肯说的事：
- 这次必须做的选择：
- 最后的改变：`).join('\n');
      fs.writeFileSync(treatmentPath, `# ${titleText} · MV treatment
类型：MV · paper-story　写作轨道：故事 / 人物 / 歌词 / 镜头

> 一句话 brief：${briefText}
> MV 固定 60s：20–28 镜、每镜 2–3 秒；先写方向锁、背景、人物与关系、母题、故事弧、歌词段与镜头候选，给用户确认后再整段替换 js/film.js 与 js/script.js。
> 不设字数上下限，写得越详细越好：背景、人物、关系、母题都要写透，写到每个镜头都能直接拍。
> 下限（60s）：候选镜 ≥32（删到 20–28）· 4 段 verse/chorus/bridge/finale · mood ≥3 档（dusk/night/storm/dawn）· 单一 mood ≤60% 镜头 · 主角镜头 ≥50%。片长超过 60s 时按 2–3 秒一镜等比增加候选。配额是下限，不是处方。

## 0.0 制作人七问（direction.json）
${qTable}

## 0. 方向锁
- 主体锚点：${lock.anchor}
- 情绪落点：${lock.promise}
- 这不是：${lock.notThis}
- Wild card：（一个不推进剧情、但揭示人物内心的镜头）

## 1. 世界与背景
（地方/时代/社会质感/天气与日常仪式；只保留能改变人物选择的 3–5 件事，落到可拍的名词）

## 2. 人物与关系（2–3 人）
${peopleText}
### 关系
- 谁在等谁：
- 谁欠谁：
- 这次相遇或分离会改变什么：

## 3. 故事弧
（主角是谁 → 想要什么 → 被什么挡住 → 做了什么选择 → 最后一个镜头与第一个镜头有什么不同）

## 4. 母题与意象（3–5 个）
（每个母题出现三次以上，每次都要变：点亮 → 熄灭 → 再点亮）

## 5. 歌词段表
| # | 段落 | 时间 | 情绪/天气 | 歌词（逐句，标秒数） |

## 6. 镜头候选（≥32，删到 20–28）
| # | 时间 | s | mood | frame | 主角? | 这一镜发生什么（一个动作） | 歌词 | 进片? |

## 7. mood 表（≥3 档，单一 ≤60%）
| mood | 颜色/光 | 情绪 | 对应段落 | 镜头数 |

## 8. 声音与片头片尾
（成品歌/合成配乐/静音；片头卡、片尾卡、kicker、endTag）

## 9. 删除日志
（删掉的镜头与原因——被删的比留下的更能说明这支片的选择）
`);
    }
  }

  const indexPath = path.join(target, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const title = opts.title || (genre === 'mv' ? '把答案拼好' : (opts.demo ? '一句话，一条片' : '未命名影片'));
  const suffix = genre === 'mv' ? ' · PAPER STORY' : ' · BRIEF TO FILM';
  html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + suffix + '</title>');
  fs.writeFileSync(indexPath, html);

  if (opts.install) {
    console.log('安装依赖（puppeteer-core + ffmpeg）…');
    const npm = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: target, stdio: 'inherit' });
    if (npm.status !== 0) {
      console.log('\n依赖安装失败，可稍后在工程目录手动运行 npm install。');
    }
  }

  const chrome = chromePath();
  console.log('\n✓ 工程已创建：' + target);
  console.log('  类型：' + (genre === 'mv' ? 'MV（层叠剪纸叙事）' : (opts.demo ? '宣传片（七场示例 · 仅用于研究契约）' : '宣传片（空白起步 · 先写故事）')));
  console.log('  片名：' + title + (opts.duration ? '  ·  ' + opts.duration + 's' : '') + '  ·  ' + (opts.width || 1920) + 'x' + (opts.height || 1080));
  if (genre === 'promo') {
    console.log('  Look：' + resolved.look.id + '（' + resolved.look.theme + ' / ' + (opts.layout || resolved.look.layout) + ' / ' + resolved.look.motion + ' / ' + resolved.look.engine + '）' + (opts.look ? ' 手动' : ' 自动'));
    if (opts.duration && opts.duration < 50) {
      console.log('  注意：起步字幕按 60s 节奏写，' + opts.duration + 's 片请先重写字幕（' + (opts.duration <= 15 ? '≤ 7' : '≤ 12') + ' 条），不要直接缩放交付。');
    }
    console.log(opts.demo
      ? '  示例：js/scenes/ 里是七场编辑排版样例，只用于研究契约与组件，不要直接换色交付。'
      : '  起步：只有 js/scenes/s0.js 一场 0–60s 占位；先写故事与分镜，再按场拆文件。');
  } else {
    console.log('  叙事：paper-story · 原生 1920×1080 剪纸画布 · 无 look / 主题 / 版式');
    console.log('  交付：' + (opts.resolution === 2 ? '4K（3840×2160，renderScale 2 矢量重画）' : '1080p（1920×1080，默认）'));
  }
  console.log('  浏览器：' + (chrome || '未找到 Chrome（用 --chrome 或 CHROME_PATH 指定）'));
  console.log('\n下一步：');
  console.log('  cd ' + target);
  if (genre === 'promo') {
    if (opts.demo) {
      console.log('  先看七场结构与组件写法，再把同样的契约用在自己现场写的故事上');
    } else {
      console.log('  先写 treatment.md（方向锁 / 空间 / 序列 / 候选镜 / 色域，不设字数、越详细越好），再写故事与分镜（references/brief-to-beats.md）');
      console.log('  起步文案只是占位：不写故事就换色渲染，交付物不会有这支片自己的叙事');
    }
    console.log('  文案：js/script.js（全片文字与字幕）；配置：js/config.js（片名/时长/风格）；画面：js/scenes/*.js');
    console.log('  时长由 config.duration 控制，场景与字幕自动等比缩放，无需改时间码');
    console.log('  字幕推荐场景内定位 { scene:"s0", at:0.4, dur:3.2, text:"…" }');
    console.log('  npm run preview               # 本地预览：S 轮换主题 / L 轮换版式 / K 轮换 look');
    console.log('  node tools/pick-look.js --list # 查看 15 个 look');
    console.log('  npm run doctor                # 环境体检：Node/依赖/Chrome/ffmpeg/磁盘');
    console.log('  npm test                      # 通用契约单测：look/config/场景/剧本/CLI');
    console.log('  npm run check                 # 配置/风格契约/对比度/场景/剧本/颜色令牌检查');
    console.log('  npm run qa                    # 一条命令：静态 → 版式 → 节奏 → 引擎 → 抽帧');
    console.log('  npm run gate:pre              # treatment 结构 + 静态检查：不过不许开渲');
    console.log('  npm run styles                # 5 个主题各出一组静帧，挑风格');
    console.log('  node render.js --scale 1 --from 0 --to 12   # 低成本试渲');
    console.log('  npm run music && npm run build               # 配乐 + 1080p 渲染 + 合成 + repair 自检');
    console.log('  npm run gate                  # 交付门禁：treatment + 静态 + repair --strict');
    console.log('  扩写：treatment.md 写到每个空间、每条候选镜都能直接拍；不设字数');
  } else {
    console.log('  先写 treatment.md（方向锁 / 背景 / 人物与关系 / 母题 / 故事弧 / 歌词段 / ≥32 候选镜 / mood 表，不设字数、越详细越好），确认后再改 js/film.js 与 js/script.js');
    console.log('  js/film.js：20–28 镜、每镜 2–3 秒、每镜一个动作；js/script.js：画布歌词');
    console.log('  js/config.js 只放片名/品牌/标语/封面；片尾标签是 ASCII 的 kicker 与 endTag');
    console.log('  用户给了歌与歌词：npm run song -- --audio <歌曲> --lyrics <歌词.lrc|txt>   # 转码 + 按句写歌词时间');
    console.log('  npm run preview               # 本地预览：空格播放/暂停，←/→ 逐秒');
    console.log('  npm run doctor                # 环境体检：Node/依赖/Chrome/ffmpeg/磁盘/画布');
    console.log('  npm test                      # 分镜契约：镜数/2–3 秒/唯一 v/歌词/确定性');
    console.log('  npm run qa                    # qa-mv（画布/歌词/复现/推进）+ 逐镜抽帧');
    console.log('  npm run gate:pre              # treatment + 分镜单测：不过不许开渲');
    console.log('  node render.js --at 1.2,26.2,58.7                       # 抽关键帧目检');
    console.log('  node render.js && node encode.js                        # ' + (opts.resolution === 2 ? '4K' : '1080p') + ' 全片 + 合成');
    console.log('  npm run gate                  # 交付门禁：treatment + 分镜单测 + repair --strict');
    console.log('  npm run music                                           # 可选：合成配乐（用户歌曲用 npm run song 接入）');
    console.log('  硬规则：每镜 2–3 秒、同场景不同 v、歌词不压主体、绘制只依赖 local、随机走 K.rnd(seed)');
    console.log('          不写 look / 主题 / 版式；默认 1080p，4K 只在用户要求时用 --resolution 4k');
  }
}

try {
  main();
} catch (err) {
  console.error('创建失败：' + (err && err.message ? err.message : String(err)));
  process.exit(1);
}
