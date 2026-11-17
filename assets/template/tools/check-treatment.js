#!/usr/bin/env node
/**
 * treatment 验收：把「先扩写、后分镜」从文档口号变成机器检查。
 *
 *   node tools/check-treatment.js [project-dir] [--duration 60] [--json] [--strict]
 *
 * 宣传片查：方向锁四项、空间 / 序列 / 候选镜 / 色域配额、色域占比、删除日志。
 * MV 查：方向锁、2–3 人物与关系、母题 3–5、四段歌词、≥32 候选镜、mood ≥3 档且单一 ≤60%、
 *       wide/mid/close 覆盖、主角镜头 ≥50%。
 * 不查字数：写得越详细越好；只查「能不能直接拍」的结构。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PLACEHOLDER = /^(（[^）]*）|\([^)]*\)|—+|–+|-+|…+|TODO|TBD|待补|待填|待定|暂无)$/i;

function quotasFor(duration, genre) {
  if (genre === 'mv') {
    const minShots = Math.max(32, Math.ceil((duration / 2.5) * 1.3));
    return { shots: minShots, finalMin: 20, finalMax: 28, moods: 3, moodMax: 0.6, heroMin: 0.5, sections: 4, motifs: 3 };
  }
  if (duration >= 60) return { spaces: 6, sequences: 10, shots: 30, palettes: 4, finalMin: 20, finalMax: 30 };
  if (duration >= 30) return { spaces: 5, sequences: 8, shots: 20, palettes: 4, finalMin: 14, finalMax: 20 };
  return { spaces: 4, sequences: 6, shots: 14, palettes: 3, finalMin: 10, finalMax: 14 };
}

function clean(s) {
  return String(s == null ? '' : s).replace(/\r/g, '').trim();
}

function isPlaceholder(s) {
  const v = clean(s);
  if (!v) return true;
  if (PLACEHOLDER.test(v)) return true;
  return /^（[^）]*）$/.test(v);
}

function splitRow(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(clean);
}

function isSeparator(cells) {
  return cells.length > 0 && cells.every(c => /^:?-{3,}:?$/.test(c.replace(/\s/g, '')));
}

/* 返回文档里的表格：[{ header, rows, startLine }] */
function tablesIn(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i])) continue;
    const block = [];
    let j = i;
    while (j < lines.length && /^\s*\|/.test(lines[j])) {
      block.push({ line: lines[j], no: j + 1 });
      j++;
    }
    if (block.length < 2) { i = j - 1; continue; }
    const cells = block.map(b => splitRow(b.line));
    const header = cells[0];
    const rows = [];
    for (let k = 1; k < cells.length; k++) {
      if (isSeparator(cells[k])) continue;
      rows.push({ cells: cells[k], no: block[k].no });
    }
    out.push({ header, rows, startLine: block[0].no, endLine: block[block.length - 1].no });
    i = j - 1;
  }
  return out;
}

function sectionsIn(text) {
  const lines = text.split('\n');
  const out = [];
  let cur = null;
  lines.forEach((line, i) => {
    const m = line.match(/^#{1,3}\s+(.+?)\s*$/);
    if (m) {
      cur = { title: m[1], startLine: i + 1, lines: [] };
      out.push(cur);
    } else if (cur) {
      cur.lines.push({ line, no: i + 1 });
    }
  });
  return out.map(s => Object.assign(s, { text: s.lines.map(x => x.line).join('\n') }));
}

function findSection(sections, re) {
  return sections.find(s => re.test(s.title)) || null;
}

function meaningfulBullets(text) {
  return text.split('\n').filter(line => {
    const t = line.trim();
    if (!t || /^（.*）$/.test(t)) return false;
    if (/^[-*]\s*/.test(t)) return !isPlaceholder(t.replace(/^[-*]\s*/, '').replace(/^[^：:]+[：:]/, ''));
    return false;
  });
}

function countTableRows(section) {
  if (!section) return 0;
  const tables = tablesIn(section.text);
  if (!tables.length) return meaningfulBullets(section.text).length;
  const t = tables[0];
  return t.rows.filter(r => r.cells.some(c => !isPlaceholder(c))).length;
}

function sectionBody(section) {
  if (!section) return '';
  return section.text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !/^[-*]/.test(line) && !/^\|/.test(line) && !/^（.*）$/.test(line))
    .join('');
}

function readField(text, label) {
  const re = new RegExp('(?:^|\\n)[ \\t]*(?:[-*][ \\t]*)?(?:\\*\\*|__)?' + label + '(?:\\*\\*|__)?[ \\t]*[：:][ \\t]*(.*)');
  const m = text.match(re);
  return m ? clean(m[1]) : '';
}

function readSectionTitle(text) {
  const m = text.match(/^#\s+(.+)$/m);
  return m ? clean(m[1]).replace(/\s*·\s*treatment\s*$/i, '') : '';
}

function detectGenre(text) {
  if (/类型\s*[：:]\s*MV|·\s*MV\s+treatment|写作轨道\s*[：:]\s*故事\s*\/\s*人物/i.test(text)) return 'mv';
  return 'promo';
}

function parsePercent(cell) {
  const m = String(cell || '').match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) / 100 : null;
}

function paletteStats(section) {
  if (!section) return { rows: 0, percents: [], missing: true };
  const tables = tablesIn(section.text);
  if (!tables.length) return { rows: countTableRows(section), percents: [], missing: true };
  const rows = tables[0].rows.filter(r => r.cells.some(c => !isPlaceholder(c)));
  const percents = rows.map(r => parsePercent(r.cells[r.cells.length - 1]));
  return { rows: rows.length, percents: percents.filter(v => v != null), missing: percents.every(v => v == null) };
}

function columnIndex(header, names) {
  for (let i = 0; i < header.length; i++) {
    const h = header[i].replace(/\s/g, '');
    if (names.some(n => h.indexOf(n) >= 0)) return i;
  }
  return -1;
}

function analyze(text, opts) {
  const options = opts || {};
  const duration = Number(options.duration) || 60;
  const genre = options.genre || detectGenre(text);
  const quota = quotasFor(duration, genre);
  const errors = [];
  const warnings = [];
  const stats = {};
  const sections = sectionsIn(text);
  const title = readSectionTitle(text);

  const placeholders = [];
  text.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    if (/^（[^）]*）$/.test(t)) placeholders.push({ line: i + 1, text: t });
  });
  if (placeholders.length) {
    errors.push('还有 ' + placeholders.length + ' 处模板占位符未替换（如第 ' + placeholders[0].line + ' 行「' + placeholders[0].text.slice(0, 30) + '」）');
  }
  if (isPlaceholder(title)) errors.push('缺少片名标题（# <片名> · treatment）');
  if (!/类型\s*[：:]\s*(宣传片|MV)/.test(text)) errors.push('缺少「类型：宣传片 · promo」或「类型：MV · paper-story」');

  const lock = readField(text, '主体锚点');
  const promise = readField(text, '观众承诺') || readField(text, '情绪落点');
  const notThis = readField(text, '这不是');
  const wild = readField(text, 'Wild card');
  stats.lock = { anchor: !isPlaceholder(lock), promise: !isPlaceholder(promise), notThis: !isPlaceholder(notThis), wild: !isPlaceholder(wild) };
  if (!stats.lock.anchor) errors.push('方向锁缺「主体锚点」：主体在这支片里只负责什么');
  if (!stats.lock.promise) errors.push('方向锁缺「' + (genre === 'mv' ? '情绪落点' : '观众承诺') + '」');
  if (!stats.lock.notThis) errors.push('方向锁缺「这不是」：不写最容易跑偏的两种片，分镜一定跑偏');
  if (!stats.lock.wild) warnings.push('方向锁缺「Wild card」：建议留一个不直接展示主体、但解释改变的镜头');

  if (genre === 'promo') {
    const spacesSec = findSection(sections, /空间/);
    const seqSec = findSection(sections, /序列/);
    const shotsSec = findSection(sections, /候选镜头|镜头候选/);
    const palSec = findSection(sections, /色域|色彩脚本/);
    const storySec = findSection(sections, /一句话故事|一句话/);
    const delSec = findSection(sections, /删除日志|删减记录|删减/);

    stats.spaces = countTableRows(spacesSec);
    stats.sequences = countTableRows(seqSec);
    stats.shots = countTableRows(shotsSec);
    const pal = paletteStats(palSec);
    stats.palettes = pal.rows;
    stats.duration = duration;
    stats.genre = genre;

    if (stats.spaces < quota.spaces) errors.push('空间表 ' + stats.spaces + ' 个，下限 ' + quota.spaces + '：只写一个空间会拍成产品目录');
    if (stats.sequences < quota.sequences) errors.push('序列表 ' + stats.sequences + ' 条，下限 ' + quota.sequences + '：先做够再删');
    if (stats.shots < quota.shots) errors.push('候选镜头 ' + stats.shots + ' 条，下限 ' + quota.shots + '：' + duration + 's 片至少 ' + quota.shots + ' 镜候选，最后留 ' + quota.finalMin + '–' + quota.finalMax);
    if (stats.palettes < quota.palettes) errors.push('色域表 ' + stats.palettes + ' 组，下限 ' + quota.palettes + '：全片一个颜色 = 没有色彩脚本');
    if (pal.missing) warnings.push('色域表没有可读的占比（每格写「22%」），无法机器校验 ≥8% 与主色域 ≤60%');
    pal.percents.forEach((p, i) => {
      if (p < 0.08 - 1e-9) errors.push('第 ' + (i + 1) + ' 组色域只占 ' + Math.round(p * 100) + '%，低于 8%：观众记不住');
      if (p > 0.60 + 1e-9) errors.push('第 ' + (i + 1) + ' 组色域占 ' + Math.round(p * 100) + '%，超过 60%：会变成单一色调');
    });
    if (pal.percents.length > 1 && pal.percents.reduce((a, b) => a + b, 0) > 1.35) {
      warnings.push('色域占比合计 ' + Math.round(pal.percents.reduce((a, b) => a + b, 0) * 100) + '%，可能把重叠/转场重复计入；确认总和接近 100%');
    }
    if (!storySec || (meaningfulBullets(storySec.text).length === 0 && sectionBody(storySec).length < 24)) {
      errors.push('缺「一句话故事」：主角是谁、想要什么、被什么挡住、最后改变了什么');
    }
    if (!delSec || (meaningfulBullets(delSec.text).length === 0 && sectionBody(delSec).length < 20)) {
      warnings.push('删除日志是空的：被删的镜头比留下的更能说明这支片的选择');
    }
    const hasHuman = /手|背影|剪影|呼气|杯|痕|指纹|袖|肩/.test(text);
    if (!hasHuman) warnings.push('没有人的痕迹：加手、背影、剪影或一个用过的物件，画面才有体温');
    const hasMacro = /微距|特写|细节|键帽|铰链|接口|材质/.test(text);
    if (!hasMacro) warnings.push('没有微距/材质细节：硬件片至少 3 个细节镜（键帽、铰链、接口、铝边）');
  } else {
    const peopleSec = findSection(sections, /人物与关系|人物/);
    const motifSec = findSection(sections, /母题|意象/);
    const lyricSec = findSection(sections, /歌词段/);
    const shotsSec = findSection(sections, /镜头候选|候选镜头/);
    const moodSec = findSection(sections, /mood\s*表/);
    const storySec = findSection(sections, /故事弧/);
    const delSec = findSection(sections, /删除日志|删减记录|删减/);

    const people = sections.filter(s => /^人物\s*[A-Z一-龥]/.test(s.title));
    stats.characters = people.length;
    stats.duration = duration;
    stats.genre = genre;
    if (people.length < 2) errors.push('人物只有 ' + people.length + ' 个：MV 必须有 2–3 个有关系的人，单主角会变成歌词配空镜');
    if (people.length > 3) warnings.push('人物 ' + people.length + ' 个，建议 2–3 个；人物过多时 60s 内谁也立不住');
    people.forEach(p => {
      ['想要什么', '怕什么', '不肯说的事', '这次必须做的选择', '最后的改变'].forEach(k => {
        if (isPlaceholder(readField(p.text, k))) errors.push('「' + p.title + '」缺「' + k + '」');
      });
    });
    const relSection = sections.find(s => /^关系$/.test(s.title.trim()));
    const rel = relSection ? relSection.text : '';
    if (!rel) errors.push('缺「关系」小节：谁在等谁、谁欠谁、这次相遇或分离改变什么');
    else ['谁在等谁', '谁欠谁', '这次相遇或分离会改变什么'].forEach(k => {
      if (isPlaceholder(readField(rel, k))) errors.push('关系缺「' + k + '」');
    });

    stats.motifs = motifSec ? meaningfulBullets(motifSec.text).length : 0;
    if (stats.motifs < quota.motifs) errors.push('母题只写了 ' + stats.motifs + ' 个，下限 3：每个母题要出现三次以上，每次都要变');
    if (stats.motifs > 5) warnings.push('母题 ' + stats.motifs + ' 个，建议 3–5 个；太多会失焦');

    const lyricRows = lyricSec ? tablesIn(lyricSec.text)[0] : null;
    stats.lyricSections = lyricRows ? lyricRows.rows.filter(r => r.cells.some(c => !isPlaceholder(c))).length : 0;
    if (stats.lyricSections < quota.sections) errors.push('歌词段表只有 ' + stats.lyricSections + ' 段，必须覆盖 verse / chorus / bridge / finale 四段');
    else {
      const modes = lyricRows.rows.map(r => r.cells.join(' ')).join(' ');
      ['verse', 'chorus', 'bridge', 'finale'].forEach(m => {
        if (!new RegExp(m, 'i').test(modes)) errors.push('歌词段表缺 ' + m + ' 段');
      });
    }

    const shotTable = shotsSec ? tablesIn(shotsSec.text)[0] : null;
    const shotRows = shotTable ? shotTable.rows.filter(r => r.cells.some(c => !isPlaceholder(c))) : [];
    stats.shots = shotRows.length;
    if (stats.shots < quota.shots) errors.push('候选镜头 ' + stats.shots + ' 条，下限 ' + quota.shots + '（60s 至少 32 镜候选，删到 20–28）');

    const moodIdx = shotTable ? columnIndex(shotTable.header, ['mood', '情绪/天气', '天气']) : -1;
    const frameIdx = shotTable ? columnIndex(shotTable.header, ['frame', '景别']) : -1;
    const heroIdx = shotTable ? columnIndex(shotTable.header, ['主角']) : -1;
    let moods = [];
    if (shotTable && moodIdx >= 0) {
      moods = shotRows.map(r => clean(r.cells[moodIdx]).toLowerCase()).filter(Boolean).filter(m => !isPlaceholder(m));
      const counts = {};
      moods.forEach(m => { counts[m] = (counts[m] || 0) + 1; });
      stats.moods = Object.keys(counts).length;
      stats.moodCounts = counts;
      if (stats.moods < quota.moods) errors.push('镜头只用了 ' + stats.moods + ' 档 mood，下限 3：光与天气必须推进');
      Object.keys(counts).forEach(m => {
        const share = counts[m] / moods.length;
        if (share > quota.moodMax + 1e-9) errors.push('mood「' + m + '」占 ' + Math.round(share * 100) + '%，超过 60%：单一气氛会拍成同一条片');
      });
    } else {
      const moodTable = moodSec ? tablesIn(moodSec.text)[0] : null;
      if (!moodTable) warnings.push('镜头候选表没有 mood 列，无法校验 mood ≥3 档与单一 ≤60%');
      else stats.moods = moodTable.rows.length;
    }
    if (shotTable && frameIdx >= 0) {
      const frames = new Set(shotRows.map(r => clean(r.cells[frameIdx]).toLowerCase()).filter(Boolean));
      stats.frames = Array.from(frames);
      ['wide', 'mid', 'close'].forEach(f => {
        if (!frames.has(f)) errors.push('镜头候选缺 ' + f + ' 景别：wide / mid / close 必须都有');
      });
    } else {
      warnings.push('镜头候选表没有 frame 列，无法校验 wide/mid/close 覆盖');
    }
    if (shotTable && heroIdx >= 0) {
      const heroRows = shotRows.filter(r => /^(是|yes|y|✓|√|1|true)/i.test(clean(r.cells[heroIdx])));
      const ratio = shotRows.length ? heroRows.length / shotRows.length : 0;
      stats.hero = ratio;
      if (ratio < quota.heroMin - 1e-9) errors.push('主角镜头只占 ' + Math.round(ratio * 100) + '%，下限 50%：会变成风景明信片');
    } else {
      warnings.push('镜头候选表没有「主角?」列，无法校验主角镜头 ≥50%');
    }

    if (!storySec || storySec.text.replace(/（.*?）/g, '').replace(/\s/g, '').length < 24) {
      errors.push('缺「故事弧」：主角是谁 → 想要什么 → 被什么挡住 → 做了什么选择 → 最后一个镜头与第一个镜头有什么不同');
    }
    if (!delSec || meaningfulBullets(delSec.text).length === 0) warnings.push('删除日志是空的：被删的镜头比留下的更能说明这支片的选择');
  }

  return {
    title: title || path.basename(options.root || ''),
    genre,
    duration,
    quota,
    stats,
    errors,
    warnings,
    ok: errors.length === 0
  };
}

function main() {
  const args = process.argv.slice(2);
  let dir = '.';
  let duration = null;
  let json = false;
  let strict = false;
  let genre = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') json = true;
    else if (args[i] === '--strict') strict = true;
    else if (args[i] === '--duration') duration = Number(args[++i]);
    else if (args[i] === '--genre') genre = args[++i];
    else if (!args[i].startsWith('-')) dir = args[i];
  }
  const root = path.resolve(dir);
  const file = path.join(root, 'treatment.md');
  if (!fs.existsSync(file)) {
    const msg = '缺少 treatment.md：一句话 brief 必须先扩写成可拍的稿子，再写分镜（见 references/brief-expansion.md 或 mv-craft.md §0）';
    if (json) console.log(JSON.stringify({ ok: false, errors: [msg], warnings: [] }, null, 2));
    else console.log('✗ ' + msg);
    process.exit(1);
  }
  let cfg = {};
  try { cfg = require(path.join(root, 'js', 'config.js')); } catch (e) { /* config 可缺省 */ }
  if (!duration) duration = Number(cfg.duration) || 60;
  const text = fs.readFileSync(file, 'utf8');
  const report = analyze(text, { root, duration, genre: genre || undefined });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('check-treatment · ' + report.title + '（' + report.genre + ' · ' + report.duration + 's）');
    if (report.genre === 'promo') {
      console.log('  空间 ' + report.stats.spaces + '/' + report.quota.spaces +
        '  ·  序列 ' + report.stats.sequences + '/' + report.quota.sequences +
        '  ·  候选镜 ' + report.stats.shots + '/' + report.quota.shots +
        '  ·  色域 ' + report.stats.palettes + '/' + report.quota.palettes);
    } else {
      console.log('  人物 ' + report.stats.characters + '  ·  母题 ' + report.stats.motifs +
        '  ·  候选镜 ' + report.stats.shots + '/' + report.quota.shots +
        '  ·  mood ' + (report.stats.moods || '?') + ' 档' +
        (report.stats.moodCounts ? '（' + Object.keys(report.stats.moodCounts).map(k => k + ' ' + report.stats.moodCounts[k]).join(' / ') + '）' : ''));
      if (report.stats.frames) console.log('  景别 ' + report.stats.frames.join(' / ') + '  ·  主角 ' + Math.round((report.stats.hero || 0) * 100) + '%');
    }
    if (report.warnings.length) {
      console.log('\n警告：');
      report.warnings.forEach(w => console.log('  ! ' + w));
    }
    if (report.errors.length) {
      console.log('\n失败：');
      report.errors.forEach(e => console.log('  ✗ ' + e));
      console.log('\n先改 treatment，再写分镜。');
      process.exit(1);
    }
    console.log('\n通过：' + (report.genre === 'mv'
      ? '方向锁、人物与关系、母题、四段歌词、镜头候选、mood 分布。'
      : '方向锁、扩写配额、色域占比、删除日志。'));
  }
  if (strict && report.warnings.length) process.exit(1);
}

if (require.main === module) main();

module.exports = { analyze, quotasFor, detectGenre, tablesIn, sectionsIn, parsePercent };