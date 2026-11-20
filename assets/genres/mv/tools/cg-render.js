#!/usr/bin/env node
/**
 * Blender CG 渲染桥：把 cg/film.py 交给便携版 Blender 无头执行。
 *
 *   node tools/cg-render.js                 # 全片
 *   node tools/cg-render.js --at 1.5,4.0    # 抽帧到 stills/
 *   node tools/cg-render.js --from 0 --to 10 --resume
 *
 * 帧命名与故事管线一致：frame_0000.png = 第 0 秒，encode.js 可直接编码。
 * Blender 查找顺序：BLENDER_BIN → config.cg.blender → 便携安装 → /Applications。
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = require(path.join(ROOT, 'js/config.js'));

const DEFAULTS = {
  from: 0,
  to: CONFIG.duration || 60,
  at: null,
  out: 'frames',
  samples: (CONFIG.cg && CONFIG.cg.samples) || 24,
  engine: (CONFIG.cg && CONFIG.cg.engine) || 'EEVEE',
  device: (CONFIG.cg && CONFIG.cg.device) || 'auto',
  file: (CONFIG.cg && CONFIG.cg.file) || 'cg/film.py',
  blender: null,
  poster: null,
  resume: false,
  quiet: false,
  dry: false
};

function usage() {
  console.log(`${CONFIG.title} · CG 帧渲染（Blender）

用法: node tools/cg-render.js [options]

  --from <sec>      起始秒（默认 0）
  --to <sec>        结束秒（默认 config.duration）
  --at <list>       抽帧模式：逗号分隔秒数，写到 stills/
  --out <dir>       帧目录（默认 frames/）
  --samples <n>     EEVEE TAA 采样（默认 ${DEFAULTS.samples}）
  --engine <name>   EEVEE | CYCLES（默认 ${DEFAULTS.engine}）
  --device <mode>   CYCLES 设备 auto|gpu|cpu（macOS Metal / Windows OptiX·CUDA·HIP；默认 auto）
  --file <path>     电影脚本（默认 ${DEFAULTS.file}）
  --blender <path>  Blender 可执行文件
  --poster <sec>    全片渲染后追加一帧封面到 out/poster.png
  --resume          跳过已存在且大于 1KB 的帧
  --dry             只打印将要执行的命令
  --quiet           只输出错误
  -h, --help        显示帮助
`);
}

function parseArgs(argv) {
  const opts = Object.assign({}, DEFAULTS);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error('缺少参数值: ' + a);
      return v;
    };
    switch (a) {
      case '-h': case '--help': usage(); process.exit(0); break;
      case '--from': opts.from = Number(next()); break;
      case '--to': opts.to = Number(next()); break;
      case '--at': opts.at = String(next()).split(',').map(Number).filter(Number.isFinite); break;
      case '--out': opts.out = next(); break;
      case '--samples': opts.samples = Number(next()); break;
      case '--engine': opts.engine = String(next()).toUpperCase(); break;
      case '--device': opts.device = String(next()).toLowerCase(); break;
      case '--file': opts.file = next(); break;
      case '--blender': opts.blender = next(); break;
      case '--poster': opts.poster = Number(next()); break;
      case '--scale': {
        /* 故事脚本里 npm run build:1080 / stills 会带 --scale 1；CG 只做 config 原生分辨率 */
        const s = Number(next());
        if (s !== 1) throw new Error('CG 渲染只做 config 里的原生分辨率（1920×1080）；--scale ' + s + ' 不支持');
        break;
      }
      case '--resume': opts.resume = true; break;
      case '--quiet': opts.quiet = true; break;
      case '--dry': opts.dry = true; break;
      default: throw new Error('未知参数: ' + a);
    }
  }
  if (!(opts.from >= 0)) throw new Error('--from 不能为负');
  if (opts.at && opts.at.length === 0) throw new Error('--at 没有有效秒数');
  if (opts.at) opts.to = Math.max(...opts.at);
  if (!opts.at && !(opts.to > opts.from)) throw new Error('--to 必须大于 --from');
  if (!['EEVEE', 'CYCLES'].includes(opts.engine)) throw new Error('--engine 只支持 EEVEE 或 CYCLES');
  if (!['auto', 'gpu', 'cpu'].includes(opts.device)) throw new Error('--device 只支持 auto / gpu / cpu');
  return opts;
}

function blenderFromProgramFiles() {
  /* Windows 官方安装器把 Blender 放进版本号的子目录，版本号会变，直接扫目录。 */
  if (process.platform !== 'win32') return null;
  const roots = [
    path.join(process.env.ProgramFiles || 'C:/Program Files', 'Blender Foundation'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Blender Foundation')
  ];
  for (const root of roots) {
    let dirs = [];
    try { dirs = fs.readdirSync(root).sort().reverse(); } catch (e) { continue; }
    for (const d of dirs) {
      const exe = path.join(root, d, 'blender.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

function findBlender(explicit) {
  const portable = path.join(os.homedir(), '.qoder/tools/blender');
  const candidates = [
    explicit,
    process.env.BLENDER_BIN,
    CONFIG.cg && CONFIG.cg.blender,
    path.join(portable, 'Blender.app/Contents/MacOS/Blender'),
    path.join(portable, 'blender.exe'),
    path.join(portable, 'blender'),
    '/Applications/Blender.app/Contents/MacOS/Blender'
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  const win = blenderFromProgramFiles();
  if (win) return win;
  try {
    const p = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['blender'], { encoding: 'utf8' })
      .split(/\r?\n/)[0].trim();
    if (p && fs.existsSync(p)) return p;
  } catch (e) { /* not on PATH */ }
  throw new Error(
    '未找到 Blender。任选其一：\n' +
    '  1) 运行 scripts/install-blender.sh（macOS）或 scripts/install-blender.ps1（Windows）安装便携版\n' +
    '  2) 设置 BLENDER_BIN=/path/to/Blender（Windows: set BLENDER_BIN=C:\\path\\blender.exe）\n' +
    '  3) node tools/cg-render.js --blender "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe"'
  );
}

function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '--';
  const s = Math.ceil(sec);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

function run(argv) {
  const opts = parseArgs(argv);
  const film = path.resolve(ROOT, opts.file);
  if (!fs.existsSync(film)) {
    throw new Error(
      `电影脚本不存在: ${path.relative(ROOT, film)}\n` +
      '先按 references/mv-craft.md（3D 纸剧场）或 cg-pipeline.md 写 cg/mv3d.py，或在 config.js 里把 engine 改回 "paper"。'
    );
  }
  const blender = findBlender(opts.blender);
  const outDir = path.resolve(ROOT, opts.out);
  fs.mkdirSync(outDir, { recursive: true });

  const env = Object.assign({}, process.env, {
    CG_OUT: outDir,
    CG_FROM: String(opts.from),
    CG_TO: String(opts.to),
    CG_FPS: String(CONFIG.fps || 24),
    CG_WIDTH: String(CONFIG.width || 1920),
    CG_HEIGHT: String(CONFIG.height || 1080),
    CG_SAMPLES: String(opts.samples),
    CG_ENGINE: opts.engine,
    CG_DEVICE: opts.device,
    CG_DURATION: String(CONFIG.duration || 0),
    CG_RESUME: opts.resume ? '1' : '0'
  });
  if (opts.at) env.CG_AT = opts.at.join(',');
  if (opts.poster != null) {
    if (!(opts.poster >= 0)) throw new Error('--poster 必须是非负数秒');
    env.CG_POSTER = String(opts.poster);
  }

  const args = ['--background', '--factory-startup', '--python', film];
  if (!opts.quiet) {
    console.log('');
    console.log(`  ${CONFIG.title} · CG 帧渲染`);
    console.log('  ─────────────────────────────────');
    console.log(`  脚本      ${path.relative(ROOT, film)}`);
    console.log(`  Blender   ${blender}`);
    console.log(`  引擎      ${opts.engine} @ ${opts.samples} 采样  · 设备 ${opts.device}`);
    console.log(`  输出      ${opts.out}/${CONFIG.width}x${CONFIG.height} @${CONFIG.fps}fps`);
    console.log(opts.at
      ? `  抽帧      ${opts.at.map(t => t.toFixed(2) + 's').join(', ')}`
      : `  时间      ${opts.from}s → ${opts.to}s`);
    console.log('  提示      首帧要编译着色器，比稳定帧慢；Ctrl-C 可中断，--resume 续渲');
    console.log('');
  }
  if (opts.dry) {
    console.log('DRY_RUN', blender, args.join(' '));
    console.log('ENV', JSON.stringify({ CG_OUT: env.CG_OUT, CG_FROM: env.CG_FROM, CG_TO: env.CG_TO, CG_AT: env.CG_AT || null, CG_ENGINE: env.CG_ENGINE, CG_DEVICE: env.CG_DEVICE }));
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const child = spawn(blender, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let frames = 0;
    let skipped = 0;
    let expected = opts.at ? opts.at.length : Math.round((opts.to - opts.from) * (CONFIG.fps || 24));
    const t0 = Date.now();
    let buf = '';

    child.stdout.on('data', chunk => {
      buf += chunk.toString();
      let idx;
      while ((idx = buf.search(/\r|\n/)) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        const filmMatch = /^CG_FILM (.+) (\d+) ([\d.]+) (\d+)$/.exec(line);
        if (filmMatch) {
          /* 多镜长片：镜头表由 Blender 端打印，期望帧数按 --from/--to 裁进片长 */
          if (!opts.at) {
            const fps = CONFIG.fps || 24;
            const lo = Math.round(opts.from * fps);
            const hi = Math.min(Number(filmMatch[2]), Math.round(opts.to * fps));
            expected = Math.max(0, hi - lo);
          }
          if (!opts.quiet) {
            process.stdout.write(`  镜头表  ${filmMatch[1]} · ${filmMatch[4]} 镜 · ${filmMatch[3]}s · ${filmMatch[2]} 帧\n`);
          }
        } else if (line.startsWith('CG_SHOT ')) {
          const p = line.split(' ');
          if (!opts.quiet) process.stdout.write(`  ── 镜头 ${p[1]} · ${p[2]} 帧 · 从 ${p[3]}s\n`);
        } else if (line.startsWith('CG_FILM_SKIP')) {
          const n = Number(line.split(' ')[1]) || 0;
          skipped += n;
          if (!opts.quiet) process.stdout.write(`  已有 ${n} 帧，跳过\n`);
        } else if (line.startsWith('CG_SKIP')) {
          skipped++;
          if (!opts.quiet) process.stdout.write(`  跳过 ${line.split(' ')[1]}\n`);
        } else if (line.startsWith('CG_FRAME')) {
          frames++;
          if (opts.quiet) continue;
          const parts = line.split(' ');
          const bt = Number(parts[3]);
          const elapsed = (Date.now() - t0) / 1000;
          const done = frames + skipped;
          const eta = frames > 0 ? (expected - done) * (elapsed / frames) : 0;
          const pct = expected ? (done / expected * 100).toFixed(1) : '0.0';
          process.stdout.write(`  ${pct.padStart(5)}%  ${done}/${expected}  ${bt.toFixed(2)}s/帧  已用 ${fmtDuration(elapsed)}  剩余 ${fmtDuration(eta)}\n`);
        } else if (line.startsWith('CG_POSTER')) {
          if (!opts.quiet) process.stdout.write(`  封面 out/poster.png  ${line.split(' ')[2]}s\n`);
        } else if (line.startsWith('CG_CONTINUITY_WARN')) {
          process.stdout.write('  ! ' + line.slice('CG_CONTINUITY_WARN'.length).trim() + '\n');
        } else if (line.startsWith('CG_CONTINUITY')) {
          if (!opts.quiet) process.stdout.write('  连续性  ' + line.slice('CG_CONTINUITY'.length).trim() + '\n');
        } else if (line.startsWith('CG_VOICE_SKIP')) {
          process.stderr.write('  [cg-voice] ' + line + '\n');
        } else if (line.startsWith('CG_REPORT')) {
          if (!opts.quiet) process.stdout.write(`  ${line.replace('CG_REPORT ', '报告 ')}\n`);
        } else if (/Error|Traceback|Exception/.test(line)) {
          process.stderr.write('  [blender] ' + line + '\n');
        }
      }
    });
    let errBuf = '';
    child.stderr.on('data', chunk => { errBuf += chunk.toString(); });

    child.on('error', reject);
    child.on('exit', code => {
      const tail = errBuf.split(/\r?\n/).filter(Boolean).slice(-12).join('\n');
      /* Blender 的 Python traceback 不一定影响退出码（--background 下常是 0），
         以实际出帧数为准，否则“0 帧成功”会骗过整条管线 */
      if (code === 0 && frames + skipped === 0) {
        reject(new Error(`Blender 跑完但没有产生任何帧${tail ? '\n' + tail : ''}`));
        return;
      }
      if (code === 0) {
        if (!opts.quiet) {
          const dt = (Date.now() - t0) / 1000;
          console.log(`  完成：${frames} 帧${skipped ? `，跳过 ${skipped} 帧` : ''}，用时 ${fmtDuration(dt)}`);
          if (expected && frames + skipped < expected) {
            console.log(`  ! 只出了 ${frames + skipped}/${expected} 帧；脚本可能提前结束，检查 film.py 的 duration 与 --to`);
          }
        }
        resolve();
      } else {
        reject(new Error(`Blender 退出码 ${code}${tail ? '\n' + tail : ''}`));
      }
    });
  });
}

if (require.main === module) {
  Promise.resolve().then(() => run(process.argv.slice(2))).catch(err => {
    process.stderr.write('\nCG 渲染失败：' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  });
}

module.exports = { run };