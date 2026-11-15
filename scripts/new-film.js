#!/usr/bin/env node
/**
 * 从模板创建一个新的影片工程。
 *
 *   node new-film.js ./my-film --genre promo --title "北岸咖啡" --duration 30
 *   node new-film.js ./my-mv    --genre mv    --title "把答案拼好"
 *
 * 两种类型是两条独立的语法，不共用 look / 主题 / 版式：
 *   promo = 宣传片：编辑排版、look、主题、品牌信息
 *   mv    = MV：像素叙事，480×270 画布、角色、镜头、字幕牌
 *
 * 只做三件事：复制模板、改配置、装依赖。不覆盖已存在的目录。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROMO_TEMPLATE = path.resolve(__dirname, '..', 'assets', 'template');
const MV_TEMPLATE = path.resolve(__dirname, '..', 'assets', 'genres', 'mv');

function usage() {
  console.log(`用法: node new-film.js <target-dir> --genre promo|mv [options]

  这是第一道分叉，先定类型，再建工程：
    promo  宣传片：编辑排版 / look / 主题 / 品牌信息
    mv     MV：像素叙事 / 角色 / 镜头 / 字幕牌（没有 look / 主题 / 版式）

  --genre <g>         promo | mv；省略时在终端里用数字选择，非终端会报错
  --resolution <r>    仅 mv：1080p | 4k，必填（先问用户，不要替他默认）
  --title <str>       片名（默认沿用模板）
  --brief <str>       一句话需求：题材+气质+用途（promo 用来排序 look）
  --look <id>         仅 promo：用户选定的 look（见 node tools/pick-look.js --list）
  --layout <name>     仅 promo：强制版式 editorial|poster|grid|split
  --style <name>      仅 promo：强制主题 letterpress|swiss|cinema|quiet|tech
  --brand <str>       品牌字（promo 页眉 / MV 片尾）
  --brand-sub <str>   品牌副标（MV 片尾中文名取斜杠前第一段）
  --slogan <str>      片尾标语
  --disclaimer <str>  免责声明 / 片尾注脚（MV 写进 endNote）
  --duration <sec>    仅 promo：时长，默认 60；MV 固定 60s 分镜，改片长请改 film.js
  --width <px>        画布宽，默认 1920
  --height <px>       画布高，默认 1080
  --size <WxH>        画布尺寸，例如 1920x1080
  --vertical          仅 promo：竖屏 9:16（= --size 1080x1920）
  --poster-at <sec>   封面帧在成片中的秒数；promo 默认 duration-1.7，MV 沿用模板 58.5
  --no-install        跳过 npm install
  --force             允许写入非空目录（谨慎）
  -h, --help          显示帮助

示例:
  node new-film.js ../../films/coffee --genre promo --title "北岸咖啡" --duration 30 --brief "咖啡店，日常温暖，生活方式"
  node new-film.js ../../films/vertical --genre promo --title "山野来信" --vertical --brief "民宿，自然疗愈"
  node new-film.js ../../films/launch --genre promo --title "2.0 发布" --look swiss-split
  node new-film.js ../../films/mv --genre mv --resolution 1080p --title "把答案拼好" --brand PIXEL --brand-sub "像素叙事 / PIXEL STORY" --slogan "让复杂问题，有解"
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
      case '--genre': opts.genre = normalizeGenre(next()); break;
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
  if (!opts.target) throw new Error('缺少目标目录\n\n' + '用法: node new-film.js <target-dir> --genre promo|mv [options]');
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
  if (s === 'mv' || s === 'pixel-story' || s === 'pixel') return 'mv';
  throw new Error('未知类型: ' + v + '\n可用: promo（宣传片） / mv（MV）');
}

function normalizeResolution(v) {
  const s = String(v).trim().toLowerCase();
  if (s === '1080p' || s === '1080' || s === 'fhd') return 1;
  if (s === '4k' || s === '2160p' || s === 'uhd') return 2;
  throw new Error('未知分辨率: ' + v + '\n可用: 1080p / 4k');
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
      '未指定影片类型。先问用户要做「宣传片」还是「MV」，再传 --genre promo 或 --genre mv。\n' +
      '  宣传片 = 编辑排版 / look / 主题 / 品牌信息\n' +
      '  MV     = 像素叙事 / 角色 / 镜头 / 字幕牌，不使用 look / 版式'
    );
  }
  const answer = askLine(
    '\n这支片属于哪一种？\n' +
    '  [1] 宣传片 · 编辑排版 / look / 品牌信息\n' +
    '  [2] MV     · 像素叙事 / 角色 / 镜头 / 字幕牌\n' +
    '选择 [1]: '
  ).toLowerCase();
  if (!answer || answer === '1' || answer === 'promo' || answer === '宣传片') return 'promo';
  if (answer === '2' || answer === 'mv' || answer === 'pixel-story' || answer === 'pixel') return 'mv';
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
    throw new Error('MV 目前是 16:9 叙事画布；竖屏需要重排 270×480 的场景，不能用 --vertical 缩放。');
  }
  if (!opts.resolution) {
    throw new Error(
      'MV 必须显式指定分辨率，不要替用户默认。先问「1080p 还是 4K」，再传 --resolution 1080p 或 --resolution 4k。'
    );
  }
  if (opts.duration && opts.duration !== 60) {
    throw new Error(
      'MV 示范模板按 60s 分镜编写（24 镜 × 2.5s）。改片长请改 js/film.js：增删镜头、让每镜保持 2–3 秒，\n' +
      '并把最后一行收在新的总时长上；不要用 --duration 缩放，否则每镜会短于 2 秒。'
    );
  }
  const w = opts.width || 1920;
  const h = opts.height || 1080;
  if (Math.abs(w / h - 16 / 9) > 0.001) {
    throw new Error('MV 画布必须是 16:9；当前 ' + w + 'x' + h);
  }
  if (w % 480 !== 0 || h % 270 !== 0) {
    throw new Error('MV 画布需要 480×270 的整数倍（960×540 / 1920×1080 / 2880×1620…）；当前 ' + w + 'x' + h +
      '。4K 请用 --resolution 4k（内部走 render.js --scale 2），不要改 config 尺寸。');
  }
}

function main() {
  const opts = parse(process.argv.slice(2));
  const genre = chooseGenre(opts);
  const target = path.resolve(process.cwd(), opts.target);
  const TEMPLATE = genre === 'mv' ? MV_TEMPLATE : PROMO_TEMPLATE;
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
  fs.cpSync(TEMPLATE, target, { recursive: true });

  const configPath = path.join(target, 'js', 'config.js');
  let config = fs.readFileSync(configPath, 'utf8');
  if (genre === 'promo') {
    if (opts.style) config = setField(config, 'style', JSON.stringify(opts.style));
    if (opts.look) config = setField(config, 'look', JSON.stringify(opts.look));
    if (opts.layout) config = setField(config, 'layout', JSON.stringify(opts.layout));
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
    /* 分辨率是 MV 的第一等交付规格：写进 config，render.js 默认读取它 */
    config = setField(config, 'renderScale', String(opts.resolution));
    if (opts.brand) {
      const tag = String(opts.brand).toUpperCase().replace(/[^\x20-\x7e]/g, '').trim() + ' · PIXEL STORY';
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

  /* MV 的片头/片尾文字统一从 config 读；script.js 只放字幕，建工程时不改字幕样例 */

  const indexPath = path.join(target, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const title = opts.title || (genre === 'mv' ? '把答案拼好' : '一句话，一条片');
  const suffix = genre === 'mv' ? ' · PIXEL STORY' : ' · BRIEF TO FILM';
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
  console.log('  类型：' + (genre === 'mv' ? 'MV（像素叙事）' : '宣传片（编辑排版）'));
  console.log('  片名：' + title + (opts.duration ? '  ·  ' + opts.duration + 's' : '') + '  ·  ' + (opts.width || 1920) + 'x' + (opts.height || 1080));
  if (genre === 'promo') {
    console.log('  Look：' + resolved.look.id + '（' + resolved.look.theme + ' / ' + (opts.layout || resolved.look.layout) + ' / ' + resolved.look.motion + ' / ' + resolved.look.engine + '）' + (opts.look ? ' 手动' : ' 自动'));
    if (opts.duration && opts.duration < 50) {
      console.log('  注意：模板字幕按 60s 编写，' + opts.duration + 's 片请把字幕减到 ' + (opts.duration <= 15 ? '≤ 7' : '≤ 12') + ' 条，并缩短单条文字（check 会报语速偏快）。');
    }
  } else {
    const factor = (opts.width || 1920) / 480;
    console.log('  叙事：pixel-story · 480×270 画布 ×' + factor + ' 整数放大 · 无 look / 主题 / 版式');
    console.log('  交付：' + (opts.resolution === 2 ? '4K（3840×2160，render --scale 2）' : '1080p（1920×1080，render --scale 1）'));
  }
  console.log('  浏览器：' + (chrome || '未找到 Chrome（用 --chrome 或 CHROME_PATH 指定）'));
  console.log('\n下一步：');
  console.log('  cd ' + target);
  if (genre === 'promo') {
    console.log('  改 js/script.js（全片文字与字幕）、js/config.js（片名/时长/风格）、js/scenes/*.js（画面）');
    console.log('  时长由 config.duration 控制，场景与字幕自动等比缩放，无需改时间码');
    console.log('  字幕推荐场景内定位 { scene:"s1", at:0.4, dur:3.2, text:"…" }');
    console.log('  npm run preview               # 本地预览：S 轮换主题 / L 轮换版式 / K 轮换 look');
    console.log('  node tools/pick-look.js --list # 查看 15 个 look');
    console.log('  npm run doctor                # 环境体检：Node/依赖/Chrome/ffmpeg/磁盘');
    console.log('  npm test                      # 契约单测：look/引擎/config/剧本/CLI');
    console.log('  npm run check                 # 配置/风格契约/对比度/场景/剧本/颜色令牌检查');
    console.log('  npm run qa                    # 一条命令：静态 → 版式 → 节奏 → 引擎 → 抽帧');
    console.log('  npm run styles                # 5 个主题各出一组静帧，挑风格');
    console.log('  node render.js --scale 1 --from 0 --to 12   # 低成本试渲');
    console.log('  npm run music && npm run build               # 配乐 + 4K 渲染 + 合成');
  } else {
    console.log('  先改 js/film.js（分镜：每行一拍、每镜 2–3 秒）与 js/script.js（字幕），再动画面');
    console.log('  js/config.js 只放片名/品牌/标语/时长/封面；片尾标签是 ASCII 的 kicker 与 endTag');
    console.log('  npm run preview               # 本地预览：空格播放/暂停，←/→ 逐秒');
    console.log('  npm run doctor                # 环境体检：Node/依赖/Chrome/ffmpeg/磁盘/画布');
    console.log('  npm test                      # 镜头制契约：24 镜、2–3 秒、唯一 v、字幕、确定性');
    console.log('  npm run qa                    # qa-mv（画布/字幕/复现/推进）+ 逐镜抽帧');
    console.log('  node render.js --at 1.2,26.2,58.7                       # 抽关键帧目检');
    console.log('  node render.js && node encode.js                        # ' + (opts.resolution === 2 ? '4K' : '1080p') + ' 全片 + 合成');
    console.log('  npm run music                                           # 可选：芯片配乐（不使用就静音成片）');
    console.log('  硬规则：每镜 2–3 秒、同场景不同 v、字幕不压主体、绘制只依赖 local、随机走 K.rnd(seed)');
    console.log('          不写 look / 主题 / 版式；分辨率由本次 --resolution 决定');
  }
}

try {
  main();
} catch (err) {
  console.error('创建失败：' + (err && err.message ? err.message : String(err)));
  process.exit(1);
}
