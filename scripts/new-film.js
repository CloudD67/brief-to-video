#!/usr/bin/env node
/**
 * 从模板创建一个新的影片工程。
 *
 *   node new-film.js ./my-film --title "北岸咖啡" --duration 30 --width 1080 --height 1920
 *
 * 只做三件事：复制模板、改配置、装依赖。不覆盖已存在的目录。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TEMPLATE = path.resolve(__dirname, '..', 'assets', 'template');

function usage() {
  console.log(`用法: node new-film.js <target-dir> [options]

  --title <str>       片名（默认沿用模板）
  --brief <str>       一句话需求：题材+气质+用途，用于自动选 look
  --look <id>         指定 look（见 node tools/pick-look.js --list），默认 auto
  --layout <name>     强制版式 editorial|poster|grid|split，默认跟随 look
  --style <name>      强制主题 letterpress|swiss|cinema|quiet|tech，默认跟随 look
  --brand <str>       页眉品牌字（默认 FILM）
  --brand-sub <str>   页眉副标
  --slogan <str>      片尾标语
  --duration <sec>    时长，默认 60
  --width <px>        画布宽，默认 1920
  --height <px>       画布高，默认 1080
  --size <WxH>        画布尺寸，例如 1080x1920
  --vertical          竖屏 9:16（= --size 1080x1920）
  --poster-at <sec>   封面帧在成片中的秒数，默认 duration - 1.7
  --no-install        跳过 npm install
  --force             允许写入非空目录（谨慎）
  -h, --help          显示帮助

示例:
  node new-film.js ../../films/coffee --title "北岸咖啡" --duration 30 --brief "咖啡店，日常温暖，生活方式"
  node new-film.js ../../films/vertical --title "山野来信" --vertical --brief "民宿，自然疗愈"
  node new-film.js ../../films/launch --title "2.0 发布" --look swiss-split`);
}

function parse(argv) {
  const opts = { install: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) throw new Error('缺少参数值: ' + a);
      return v;
    };
    switch (a) {
      case '-h': case '--help': usage(); process.exit(0); break;
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
      case '--vertical': opts.width = 1080; opts.height = 1920; break;
      case '--title': opts.title = next(); break;
      case '--brand': opts.brand = next(); break;
      case '--brand-sub': opts.brandSub = next(); break;
      case '--slogan': opts.slogan = next(); break;
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
  if (!opts.target) throw new Error('缺少目标目录\n\n' + '用法: node new-film.js <target-dir> [options]');
  if (opts.width) opts.width = Math.round(opts.width / 2) * 2;
  if (opts.height) opts.height = Math.round(opts.height / 2) * 2;
  if (opts.duration && !(opts.duration > 1)) throw new Error('--duration 必须大于 1 秒');
  if (opts.style && !/^[a-z0-9-]+$/.test(opts.style)) throw new Error('--style 只能是小写字母、数字和连字符');
  if (opts.look && !/^[a-z0-9-]+$/.test(opts.look)) throw new Error('--look 只能是小写字母、数字和连字符');
  if (opts.layout && !/^[a-z0-9-]+$/.test(opts.layout)) throw new Error('--layout 只能是小写字母、数字和连字符');
  return opts;
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

function main() {
  const opts = parse(process.argv.slice(2));
  const target = path.resolve(process.cwd(), opts.target);

  if (fs.existsSync(target) && fs.readdirSync(target).length > 0 && !opts.force) {
    throw new Error('目标目录已存在且非空: ' + target + '\n换一个名字，或确认后加 --force');
  }
  const themeDir = path.join(TEMPLATE, 'styles', 'themes');
  const themeList = fs.readdirSync(themeDir).filter(f => f.endsWith('.css')).map(f => f.replace(/\.css$/, '')).sort();
  if (opts.style && themeList.indexOf(opts.style) === -1) {
    throw new Error('未知风格: ' + opts.style + '\n可用: ' + themeList.join(' / '));
  }
  const LOOKS = require(path.join(TEMPLATE, 'js', 'looks.js'));
  if (opts.look && !LOOKS.getLook(opts.look)) {
    throw new Error('未知 look: ' + opts.look + '\n可用: ' + LOOKS.listLooks().map(l => l.id).join(' / '));
  }
  if (opts.layout && !LOOKS.LAYOUTS[opts.layout]) {
    throw new Error('未知版式: ' + opts.layout + '\n可用: ' + Object.keys(LOOKS.LAYOUTS).join(' / '));
  }
  const brief = opts.brief || [opts.title, opts.slogan, opts.brandSub].filter(Boolean).join(' ');
  const resolved = opts.look ? { look: LOOKS.getLook(opts.look), auto: false }
    : { look: LOOKS.chooseLook(brief, { theme: opts.style || null }).look, auto: true };
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(TEMPLATE, target, { recursive: true });

  const configPath = path.join(target, 'js', 'config.js');
  let config = fs.readFileSync(configPath, 'utf8');
  if (opts.style) config = setField(config, 'style', JSON.stringify(opts.style));
  if (opts.look) config = setField(config, 'look', JSON.stringify(opts.look));
  if (opts.layout) config = setField(config, 'layout', JSON.stringify(opts.layout));
  config = setField(config, 'brief', JSON.stringify(opts.brief || ''));
  if (opts.title) config = setField(config, 'title', JSON.stringify(opts.title));
  if (opts.brand) config = setField(config, 'brand', JSON.stringify(opts.brand));
  if (opts.brandSub) config = setField(config, 'brandSub', JSON.stringify(opts.brandSub));
  if (opts.slogan) config = setField(config, 'slogan', JSON.stringify(opts.slogan));
  if (opts.width) config = setField(config, 'width', String(opts.width));
  if (opts.height) config = setField(config, 'height', String(opts.height));
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
  fs.writeFileSync(configPath, config);

  const indexPath = path.join(target, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const title = opts.title || '一句话，一条片';
  html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + ' · BRIEF TO FILM</title>');
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
  console.log('  片名：' + title + (opts.duration ? '  ·  ' + opts.duration + 's' : '') + '  ·  ' + (opts.width || 1920) + 'x' + (opts.height || 1080));
  console.log('  Look：' + resolved.look.id + '（' + resolved.look.theme + ' / ' + (opts.layout || resolved.look.layout) + ' / ' + resolved.look.motion + '）' + (opts.look ? ' 手动' : ' 自动'));
  if (opts.duration && opts.duration < 50) {
    console.log('  注意：模板字幕按 60s 编写，' + opts.duration + 's 片请把字幕减到 ' + (opts.duration <= 15 ? '≤ 7' : '≤ 12') + ' 条，并缩短单条文字（check 会报语速偏快）。');
  }
  console.log('  浏览器：' + (chrome || '未找到 Chrome（用 --chrome 或 CHROME_PATH 指定）'));
  console.log('\n下一步：');
  console.log('  cd ' + target);
  console.log('  改 js/script.js（全片文字与字幕）、js/config.js（片名/时长/风格）、js/scenes/*.js（画面）');
  console.log('  时长由 config.duration 控制，场景与字幕自动等比缩放，无需改时间码');
  console.log('  字幕推荐场景内定位 { scene:"s1", at:0.4, dur:3.2, text:"…" }');
  console.log('  npm run preview               # 本地预览：S 轮换主题 / L 轮换版式 / K 轮换 look');
  console.log('  node tools/pick-look.js --list # 查看 12 个 look');
  console.log('  npm run doctor                # 环境体检：Node/依赖/Chrome/ffmpeg/磁盘');
  console.log('  npm run check                 # 配置/风格契约/对比度/场景/剧本/颜色令牌检查');
  console.log('  npm run qa                    # 一条命令：静态 → 版式 → 节奏 → 抽帧');
  console.log('  npm run qa:layout             # 只量版式：出框/裁切/字幕压字');
  console.log('  npm run qa:timing             # 只跑节奏探针：占位符/暗显/字幕错位');
  console.log('  npm run qa:stills             # 只抽帧：切点/收尾/封面');
  console.log('  npm run styles                # 5 个主题各出一组静帧，挑风格');
  console.log('  node render.js --scale 1 --from 0 --to 12   # 低成本试渲');
  console.log('  npm run music && npm run build               # 配乐 + 4K 渲染 + 合成');
}

try {
  main();
} catch (err) {
  console.error('创建失败：' + (err && err.message ? err.message : String(err)));
  process.exit(1);
}
