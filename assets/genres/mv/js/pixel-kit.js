/* 像素叙事绘制库：480×270 的画布、确定性随机、抖动渐变、像素字、精灵与 HUD。
   所有绘制只依赖传入的时间与种子，保证逐帧可复现。 */
(function (root) {
  'use strict';

  const W = 480;
  const H = 270;
  const K = {};
  K.W = W;
  K.H = H;
  root.FILM_SCENES = root.FILM_SCENES || [];

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function rnd(seed) {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
    return x - Math.floor(x);
  }
  K.rnd = rnd;

  /* 分镜种子：每镜一个唯一序号，所有几何变化都从它派生，
     保证“用过的画面不再出现”，同时逐帧可复现。 */
  K.seed = function (v, salt) {
    return rnd((v + 1) * 3.71 + (salt || 0) * 17.33);
  };
  K.vi = function (v, salt, a, b) {
    return a + Math.floor(K.seed(v, salt) * (b - a + 1));
  };
  K.vf = function (v, salt, a, b) {
    return a + K.seed(v, salt) * (b - a);
  };
  K.vpick = function (v, salt, arr) {
    return arr[K.vi(v, salt, 0, arr.length - 1)];
  };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  K.clamp = clamp;
  K.lerp = lerp;
  K.smooth = smooth;

  function rgb(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function toHex(r, g, b) {
    const f = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + f(r) + f(g) + f(b);
  }

  K.mix = function (a, b, t) {
    const A = rgb(a);
    const B = rgb(b);
    return toHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
  };

  K.shade = function (c, amt) {
    /* 调用方习惯写百分数（12 = 12%），也接受 0–1 比例 */
    if (amt > 1 || amt < -1) amt = amt / 100;
    const A = rgb(c);
    if (amt >= 0) return toHex(A[0] + (255 - A[0]) * amt, A[1] + (255 - A[1]) * amt, A[2] + (255 - A[2]) * amt);
    return toHex(A[0] * (1 + amt), A[1] * (1 + amt), A[2] * (1 + amt));
  };

  function make(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return c;
  }
  K.make = make;

  K.stage = function (hostEl) {
    const cv = document.createElement('canvas');
    cv.className = 'pixel-canvas';
    cv.width = W;
    cv.height = H;
    hostEl.appendChild(cv);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    return cv;
  };

  /* 逐帧合成画布：世界按 1:1 画在这里，再整数采样缩放到 480×270，
     避免分数变换把 1px 线抗锯齿成灰边。 */
  const scratchCache = {};
  K.scratch = function (w, h) {
    const key = w + 'x' + h;
    if (!scratchCache[key]) {
      const cv = make(w, h);
      scratchCache[key] = cv;
    }
    return scratchCache[key];
  };

  /* 世界层只留最近几镜：111 张全缓存会顶到浏览器的画布显存上限，
     旧画布会被浏览器静默清空，抽查时出现空帧。 */
  const worldCache = new Map();
  K.cachedWorld = function (key, build) {
    let cv = worldCache.get(key);
    if (cv) {
      worldCache.delete(key);
      worldCache.set(key, cv);
      return cv;
    }
    cv = build();
    worldCache.set(key, cv);
    while (worldCache.size > 8) {
      worldCache.delete(worldCache.keys().next().value);
    }
    return cv;
  };

  K.rect = function (g, x, y, w, h, c) {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  K.frame = function (g, x, y, w, h, c) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    K.rect(g, x, y, w, 1, c);
    K.rect(g, x, y + h - 1, w, 1, c);
    K.rect(g, x, y, 1, h, c);
    K.rect(g, x + w - 1, y, 1, h, c);
  };

  K.line = function (g, x0, y0, x1, y1, c, thick) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    thick = thick || 1;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let guard = 0;
    while (guard++ < 2000) {
      K.rect(g, x0, y0, thick, thick, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  };

  K.disc = function (g, cx, cy, r, c) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
      K.rect(g, cx - half, cy + y, half * 2 + 1, 1, c);
    }
  };

  K.ring = function (g, cx, cy, r, c) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    let prev = -1;
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
      if (half !== prev) {
        K.rect(g, cx - half, cy + y, 1, 1, c);
        K.rect(g, cx + half, cy + y, 1, 1, c);
        prev = half;
      }
    }
    K.rect(g, cx - r, cy, 1, 1, c);
    K.rect(g, cx + r, cy, 1, 1, c);
  };

  const patCache = new WeakMap();
  function patternFor(g, color, level) {
    let map = patCache.get(g);
    if (!map) { map = new Map(); patCache.set(g, map); }
    const key = color + '|' + level;
    let pat = map.get(key);
    if (pat) return pat;
    const tile = make(4, 4);
    const tg = tile.getContext('2d');
    const img = tg.createImageData(4, 4);
    const C = rgb(color);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const i = (y * 4 + x) * 4;
        const on = BAYER[y * 4 + x] < level;
        img.data[i] = C[0];
        img.data[i + 1] = C[1];
        img.data[i + 2] = C[2];
        img.data[i + 3] = on ? 255 : 0;
      }
    }
    tg.putImageData(img, 0, 0);
    pat = g.createPattern(tile, 'repeat');
    map.set(key, pat);
    return pat;
  }

  K.dither = function (g, x, y, w, h, base, dots, level) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (w <= 0 || h <= 0) return;
    if (level <= 0) { K.rect(g, x, y, w, h, base); return; }
    if (level >= 16) { K.rect(g, x, y, w, h, dots); return; }
    K.rect(g, x, y, w, h, base);
    g.fillStyle = patternFor(g, dots, level);
    g.fillRect(x, y, w, h);
  };

  K.grad = function (g, x, y, w, h, stops) {
    /* 先把每段插值量化成若干中间色，再在相邻两级之间抖动：
       色阶差小，棋盘纹就不会变成噪点。 */
    const LV = 12;
    const cache = [];
    for (let j = 0; j < h; j++) {
      const p = h <= 1 ? 0 : j / (h - 1);
      let a = stops[0];
      let b = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (p >= stops[i].p && p <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break; }
      }
      const t = b.p > a.p ? (p - a.p) / (b.p - a.p) : 0;
      if (t <= 0.001) { K.rect(g, x, y + j, w, 1, a.c); continue; }
      if (t >= 0.999) { K.rect(g, x, y + j, w, 1, b.c); continue; }
      const q = t * LV;
      const i0 = Math.min(LV, Math.floor(q));
      const f = q - i0;
      const key = a.c + b.c + i0;
      let pair = null;
      for (let k = 0; k < cache.length; k++) if (cache[k].key === key) { pair = cache[k]; break; }
      if (!pair) {
        pair = { key: key, c0: K.mix(a.c, b.c, i0 / LV), c1: K.mix(a.c, b.c, Math.min(LV, i0 + 1) / LV) };
        if (cache.length < 64) cache.push(pair);
      }
      K.dither(g, x, y + j, w, 1, pair.c0, pair.c1, Math.max(1, Math.min(15, Math.round(f * 15))));
    }
  };

  /* 把少量色标扩成多级色标：级差越小，抖动带越不刺眼。 */
  K.ramp = function (anchors, steps) {
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      let a = anchors[0];
      let b = anchors[anchors.length - 1];
      for (let j = 0; j < anchors.length - 1; j++) {
        if (p >= anchors[j].p && p <= anchors[j + 1].p) { a = anchors[j]; b = anchors[j + 1]; break; }
      }
      const t = b.p > a.p ? (p - a.p) / (b.p - a.p) : 0;
      out.push({ p: p, c: K.mix(a.c, b.c, t) });
    }
    return out;
  };

  K.fleck = function (g, x, y, w, h, c, step, seed, prob) {
    step = Math.max(1, step || 3);
    for (let yy = y; yy < y + h; yy += step) {
      for (let xx = x; xx < x + w; xx += step) {
        if (rnd(xx * 0.37 + yy * 1.13 + seed) < prob) K.rect(g, xx, yy, 1, 1, c);
      }
    }
  };

  const glyphCache = new Map();
  function glyph(ch, size, color, outline, weight, soft) {
    const key = ch + '|' + size + '|' + color + '|' + (outline || '') + '|' + weight + (soft ? '|s' : '');
    let hit = glyphCache.get(key);
    if (hit) return hit;
    const font = weight + ' ' + size + 'px "PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
    const m = make(8, 8).getContext('2d');
    m.font = font;
    const pad = 1;
    const adv = m.measureText(ch).width;
    const w = Math.max(1, Math.ceil(adv) + pad * 2 + 1);
    const h = size + pad * 2 + 4;
    const cv = make(w, h);
    const c = cv.getContext('2d');
    c.font = font;
    c.textBaseline = 'top';
    if (outline) {
      c.fillStyle = outline;
      c.fillText(ch, pad - 1, pad);
      c.fillText(ch, pad + 1, pad);
      c.fillText(ch, pad, pad - 1);
      c.fillText(ch, pad, pad + 1);
    }
    c.fillStyle = color;
    c.fillText(ch, pad, pad);
    const img = c.getImageData(0, 0, w, h);
    const d = img.data;
    /* 正文/标签走二值化，保持像素硬边。字幕牌例外（soft）：12px 下
       笔画多的汉字（窗、害、整）二值化后内部会糊成方块，保留灰度才读得清。 */
    if (!soft) {
      const cut = 64;
      for (let i = 0; i < d.length; i += 4) d[i + 3] = d[i + 3] >= cut ? 255 : 0;
      c.putImageData(img, 0, 0);
    }
    hit = { cv, adv: Math.ceil(adv) + pad * 2 };
    glyphCache.set(key, hit);
    return hit;
  }

  K.textWidth = function (str, size, track, weight) {
    const chars = Array.from(String(str));
    let total = 0;
    for (let i = 0; i < chars.length; i++) total += glyph(chars[i], size, '#ffffff', null, weight || (size <= 11 ? 700 : 600)).adv + (track || 0);
    return chars.length ? total - (track || 0) : 0;
  };

  K.text = function (g, str, x, y, opt) {
    opt = opt || {};
    const size = opt.size || 12;
    const color = opt.color || '#f2e4c6';
    const weight = opt.weight || (size <= 11 ? 700 : 600);
    const track = opt.track || 0;
    const alpha = opt.alpha == null ? 1 : opt.alpha;
    if (alpha <= 0.01) return 0;
    const chars = Array.from(String(str));
    let total = 0;
    const gs = chars.map(ch => {
      const gl = glyph(ch, size, color, opt.outline || null, weight, opt.soft);
      total += gl.adv + track;
      return gl;
    });
    if (chars.length) total -= track;
    let cx = Math.round(opt.align === 'center' ? x - total / 2 : opt.align === 'right' ? x - total : x);
    g.save();
    g.globalAlpha = alpha;
    for (let i = 0; i < gs.length; i++) {
      g.drawImage(gs[i].cv, cx, Math.round(y));
      cx += gs[i].adv + track;
    }
    g.restore();
    return total;
  };

  const FONT = {
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
    'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'I': ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
    'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
    'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
    '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
    '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'],
    ',': ['00000', '00000', '00000', '00000', '00110', '00110', '00100'],
    ':': ['00000', '00110', '00110', '00000', '00110', '00110', '00000'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
    '·': ['00000', '00000', '00000', '00100', '00100', '00000', '00000'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
    '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
  };

  K.bitWidth = function (str, scale, spacing) {
    scale = scale || 1;
    spacing = spacing == null ? 1 : spacing;
    return Array.from(String(str)).length * (5 + spacing) * scale - spacing * scale;
  };

  K.bit = function (g, str, x, y, color, scale, spacing) {
    scale = scale || 1;
    spacing = spacing == null ? 1 : spacing;
    const chars = Array.from(String(str).toUpperCase());
    let cx = Math.round(x);
    g.fillStyle = color;
    for (let i = 0; i < chars.length; i++) {
      const rows = FONT[chars[i]];
      if (rows) {
        for (let r = 0; r < 7; r++) {
          for (let c = 0; c < 5; c++) {
            if (rows[r][c] === '1') g.fillRect(cx + c * scale, Math.round(y) + r * scale, scale, scale);
          }
        }
      }
      cx += (5 + spacing) * scale;
    }
  };

  K.cueAt = function (scene, local) {
    const at = (scene.start || 0) + local;
    const cues = (root && root.FILM_CUES) || [];
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      if (at >= c.authoredStart && at < c.authoredEnd) {
        const a = Math.min(1, (at - c.authoredStart) / 0.16, (c.authoredEnd - at) / 0.16);
        return { text: c.text, alpha: Math.max(0, a) };
      }
    }
    return { text: '', alpha: 0 };
  };

  K.QA = {
    genre: 'pixel-story',
    canvas: true,
    scene: null,
    endCard: 0,
    plate: { text: '', alpha: 0 }
  };
  root.PIXEL_QA = K.QA;

  K.hud = function (g, o) {
    o = o || {};
    K.rect(g, 0, 0, W, 17, '#080d1c');
    K.rect(g, 0, 17, W, 1, '#2b3a63');
    K.rect(g, 7, 6, 4, 4, o.accent || '#d8503c');
    K.text(g, o.title || '', 16, 2, { size: 10, color: '#f1e3c4', outline: '#080d1c' });
    const right = o.right || '';
    const bw = K.bitWidth(right, 1);
    K.bit(g, right, W - 8 - bw, 5, '#93a4c6', 1);
    if (Math.floor((o.t || 0) * 1.4) % 2 === 0) K.rect(g, W - 14 - bw, 6, 2, 2, '#f2c05e');
    K.rect(g, 0, 0, 3, 1, '#2b3a63');
    K.rect(g, W - 3, 0, 3, 1, '#2b3a63');
  };

  K.plate = function (g, text, a) {
    K.QA.plate.text = text || '';
    K.QA.plate.alpha = a || 0;
    if (!text || !(a > 0.01)) return;
    const size = 12;
    const tw = Math.round(K.textWidth(text, size, 0));
    const w = Math.min(W - 24, tw + 36);
    const h = 26;
    const x = Math.round((W - w) / 2);
    const y = 232;
    g.save();
    g.globalAlpha = a;
    K.rect(g, x + 2, y + 2, w, h, '#05070f');
    K.rect(g, x, y, w, h, '#f3e6c8');
    K.frame(g, x, y, w, h, '#2a1d20');
    K.rect(g, x + 7, y + 11, 3, 3, '#d8503c');
    K.text(g, text, x + 16, y + 7, { size, color: '#241a20', weight: 600, soft: true });
    g.restore();
  };

  const vigCache = new Map();
  K.vignette = function (g, strength) {    strength = strength == null ? 0.65 : strength;
    const key = String(Math.round(strength * 100));
    let cv = vigCache.get(key);
    if (!cv) {
      cv = make(W, H);
      const c = cv.getContext('2d');
      const img = c.createImageData(W, H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
          const t = Math.max(0, 1 - edge / 54) * strength;
          const on = BAYER[(y & 3) * 4 + (x & 3)] / 16 < t;
          if (!on) continue;
          const i = (y * W + x) * 4;
          img.data[i] = 3;
          img.data[i + 1] = 5;
          img.data[i + 2] = 12;
          img.data[i + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
      vigCache.set(key, cv);
    }
    g.drawImage(cv, 0, 0);
  };

  /* 抖动光晕：同心圆逐层加密网点，不允许出现平滑 alpha 渐变。
     与画面其他部分共用 4×4 Bayer 相位，缩放后才能保持像素感。 */
  function dotDisc(g, cx, cy, r, color, level) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    if (r < 1 || level <= 0) return;
    g.save();
    g.fillStyle = patternFor(g, color, Math.min(15, level));
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
      g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
    }
    g.restore();
  }

  K.glow = function (g, cx, cy, r, color, strength) {
    strength = strength == null ? 1 : strength;
    const steps = Math.max(3, Math.min(14, Math.round(r / 2.6)));
    for (let s = steps; s >= 1; s--) {
      const rr = Math.max(1, Math.round(r * s / steps));
      const lvl = Math.round(Math.pow(1 - (s - 1) / steps, 1.3) * 8 * strength);
      if (lvl > 0) dotDisc(g, cx, cy, rr, color, lvl);
    }
    if (r >= 4) dotDisc(g, cx, cy, Math.max(1, Math.round(r * 0.3)), color, Math.min(14, Math.round(11 * strength)));
  };

  /* 章节标签：深色小牌 + 12px 中文 + 5×7 状态字，避免压在抖动底上。
     中文低于 12px 时笔画多的字（第/步/城市）会糊。 */
  K.tag = function (g, label, opt) {
    opt = opt || {};
    const size = 13;
    const lw = K.textWidth(label || '', size, 0, 700);
    const pw = opt.progress != null ? 12 * 6 - 2 : 0;
    const bw = opt.bit ? K.bitWidth(opt.bit, 1) : 0;
    const w = Math.max(lw, pw, bw) + 20;
    const h = opt.progress != null || opt.bit ? 36 : 23;
    const x = 6;
    const y = 22;
    K.rect(g, x, y, w, h, '#080d1c');
    K.frame(g, x, y, w, h, '#2b3a63');
    K.rect(g, x + 4, y + 6, 2, 2, opt.accent || '#d8503c');
    K.text(g, label || '', x + 10, y + 2, { size, color: '#cfdaf2', weight: 700 });
    if (opt.progress != null) {
      const done = Math.round(K.clamp(opt.progress, 0, 1) * 12);
      for (let i = 0; i < 12; i++) {
        K.rect(g, x + 10 + i * 6, y + 24, 4, 4, i < done ? (opt.accent || '#8fd8d2') : '#1c2747');
      }
    } else if (opt.bit) {
      K.bit(g, opt.bit, x + 10, y + 23, opt.accent || '#8fd8d2', 1);
    }
    return { x, y, w, h };
  };

  K.drawBg = function (g, bg, sx) {
    g.imageSmoothingEnabled = false;
    g.drawImage(bg, Math.round(sx || 0), 0, W, H, 0, 0, W, H);
  };

  K.rain = function (g, t, o) {
    const n = o.count || 40;
    g.save();
    g.globalAlpha = o.alpha == null ? 1 : o.alpha;
    for (let i = 0; i < n; i++) {
      const seed = i * 17.17 + (o.seed || 0);
      const x = o.x + Math.floor(rnd(seed) * o.w);
      const speed = (o.speed || 90) + rnd(seed + 1.3) * 80;
      const len = (o.len || 3) + Math.floor(rnd(seed + 2.7) * (o.len || 3));
      const y = o.y + ((rnd(seed + 4.1) * o.h + t * speed) % o.h);
      const sway = o.sway ? Math.round(Math.sin(t * 2.2 + i) * 0.8) : 0;
      K.rect(g, x + sway, y, 1, len, o.color || '#5f7ab0');
    }
    g.restore();
  };

  K.stars = function (g, t, o) {
    const n = o.count || 40;
    for (let i = 0; i < n; i++) {
      const seed = i * 31.7 + (o.seed || 0);
      const x = o.x + Math.floor(rnd(seed) * o.w);
      const y = o.y + Math.floor(rnd(seed + 2.1) * o.h);
      const twinkle = 0.55 + 0.45 * Math.sin(t * (1.1 + rnd(seed + 3.3) * 1.6) + i * 1.7);
      const bright = rnd(seed + 5.5) > 0.86;
      g.save();
      g.globalAlpha = twinkle * (o.alpha == null ? 1 : o.alpha);
      K.rect(g, x, y, 1, 1, o.color || '#ffeeb8');
      if (bright) {
        K.rect(g, x - 1, y, 1, 1, o.color || '#ffeeb8');
        K.rect(g, x + 1, y, 1, 1, o.color || '#ffeeb8');
        K.rect(g, x, y - 1, 1, 1, o.color || '#ffeeb8');
        K.rect(g, x, y + 1, 1, 1, o.color || '#ffeeb8');
      }
      g.restore();
    }
  };

  K.spriteCanvas = function (map, pal, flip) {
    const h = map.length;
    let w = 0;
    for (let i = 0; i < h; i++) w = Math.max(w, map[i].length);
    const cv = make(w, h);
    const c = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = map[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (!col) continue;
        K.rect(c, flip ? w - 1 - x : x, y, 1, 1, col);
      }
    }
    return cv;
  };

  K.PAL = {
    girl: { o: '#241a2b', h: '#3a2740', H: '#6a4a63', s: '#f2c9a4', c: '#e9d9b8', C: '#c6ac86', d: '#3c405e', b: '#2a2230' },
    silhouette: { o: '#05070f', h: '#05070f', H: '#05070f', s: '#05070f', c: '#05070f', C: '#05070f', d: '#05070f', b: '#05070f' },
    cat: { o: '#2a1a1a', h: '#d98a4e', H: '#f2b573' }
  };

  const GIRL_BACK = [
    '........oooooo........',
    '......oohhhhhhoo......',
    '.....ohhhhhhhhhho.....',
    '....ohhhhhhhhhhhho....',
    '....ohhhHHHHHHhhho....',
    '....ohhHHHHHHHHhho....',
    '....ohhhhhhhhhhhho....',
    '....ohhhhhhhhhhhho....',
    '.....ohhhhhhhhhho.....',
    '......ohhhhhhhho......',
    '......ohhssssshho.....',
    '.......osssssso.......',
    '.....occcccccccco.....',
    '....occcccccccccco....',
    '...occcccccccccccco...',
    '...occcccccccccccco...',
    '...occcccccccccccco...',
    '..occcccccccccccccco..',
    '..occcccccccccccccco..',
    '..occCCccccccccCCcco..',
    '..occCCccccccccCCcco..',
    '..occCCccccccccCCcco..',
    '..ocCCCCccccccCCCCco..',
    '...occcccccccccccco...',
    '....oooooooooooooo....'
  ];

  const GIRL_STAND = [
    '........oooooo......',
    '......oohhhhhhoo....',
    '.....ohhhhhhhhhho...',
    '....ohhhhhhhhhhhho..',
    '....ohhhHHHHHHhhho..',
    '....ohhHHHHHHHHhho..',
    '....ohhhhhhhhhhhho..',
    '....ohhhhhhhhhhhho..',
    '.....ohhhhhhhhhho...',
    '......ohhhhhhhho....',
    '......ohhsssssho....',
    '.......osssssso.....',
    '......occcccccco....',
    '.....occcccccccco...',
    '....occcccccccccco..',
    '....occcccccccccco..',
    '....occcccccccccco..',
    '...occcccccccccccco.',
    '...occcccccccccccco.',
    '...occCCccccccccCCco',
    '...occCCccccccccCCco',
    '...occCCccccccccCCco',
    '...ocCCCCccccCCCCco.',
    '....occcccccccccco..',
    '....occcccccccccco..',
    '.....cccccccccccc...',
    '.....dddddddddddd...',
    '.....dddddddddddd...',
    '.....ddd......ddd...',
    '.....ddd......ddd...',
    '....bbbb......bbbb..',
    '....bbbb......bbbb..'
  ];

  const WALK_BASE = [
    '........oooooo....',
    '......oohhhhhhoo..',
    '.....ohhhhhhhhhho.',
    '....ohhhhhhhhhhho.',
    '....ohhHHHHHHhhho.',
    '....ohhhhhhhhhhho.',
    '....ohhhhhhhhhsss.',
    '....ohhhhhhhhssss.',
    '.....ohhhhhsssss..',
    '......ohhhhssss...',
    '......occccccc....',
    '.....occcccccc....',
    '....occccccccc....',
    '....occccccccc....',
    '....occccccccc....',
    '...occcccccccco...',
    '...occcccccccco...',
    '...occcccccccco...',
    '...occcccccccco...',
    '...occcccccccco...',
    '....cccccccccc....',
    '....cccccccccc....',
    '.....dddddddd.....',
    '.....ddd..ddd.....',
    '.....ddd..ddd.....',
    '....ddd....ddd....',
    '....ddd....ddd....',
    '...bbb......bbb...',
    '...bbb......bbb...'
  ];

  function walkFrame(mode) {
    const m = WALK_BASE.slice();
    if (mode === 0) {
      m[23] = '....ddd..ddd......';
      m[24] = '...ddd....ddd.....';
      m[25] = '..ddd......ddd....';
      m[26] = '..ddd......ddd....';
      m[27] = '.bbb........bbb...';
      m[28] = '.bbb........bbb...';
    } else if (mode === 1) {
      m[23] = '.....ddddddd......';
      m[24] = '.....ddd.ddd......';
      m[25] = '....ddd...ddd.....';
      m[26] = '....ddd...ddd.....';
      m[27] = '...bbb.....bbb....';
      m[28] = '...bbb.....bbb....';
    } else if (mode === 2) {
      m[23] = '......ddd..ddd....';
      m[24] = '.....ddd....ddd...';
      m[25] = '....ddd......ddd..';
      m[26] = '....ddd......ddd..';
      m[27] = '...bbb........bbb.';
      m[28] = '...bbb........bbb.';
    } else {
      m[23] = '.....ddddddd......';
      m[24] = '......dddddd......';
      m[25] = '......ddd.dd......';
      m[26] = '.....ddd...dd.....';
      m[27] = '....bbb....bbb....';
      m[28] = '....bbb....bbb....';
    }
    return m;
  }

  const CAT = [
    '........oooo',
    '..o..o..ohho',
    '..oo.oo.ohho',
    '..ohhhhhhhho',
    '..ohhhhhhhho',
    '..ohhhhhhhho',
    '..ohhhhhhho.',
    '..ohhhhhhho.',
    '...oohhhhoo.',
    '.....oooo...'
  ];

  K.art = {
    girlBack: GIRL_BACK,
    girlStand: GIRL_STAND,
    walk: [walkFrame(0), walkFrame(1), walkFrame(2), walkFrame(3)],
    cat: CAT
  };

  K.SCENE_ORDER = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

  root.PIXEL_KIT = K;
})(typeof window !== 'undefined' ? window : null);
