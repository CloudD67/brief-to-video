/* 共享像素绘画库：所有场景都用这里的笔触，保证同一套质感与配色。
   只允许时间与种子，不允许随机数/Date.now。 */
(function (root) {
  'use strict';
  const K = root.PIXEL_KIT;
  const P = {};

  P.PAL = {
    ink: '#05070f',
    night0: '#070b1a',
    night1: '#0d1330',
    night2: '#182148',
    night3: '#2a3358',
    warm: '#f2c05e',
    warm2: '#ffe9a8',
    amber: '#e8944a',
    red: '#d8503c',
    cyan: '#8fd8d2',
    paper: '#f3e6c8',
    brick: '#6a3a32',
    brick2: '#8a4a3c',
    wood: '#7c4c34',
    wood2: '#a06a48',
    fog: '#93a4c6'
  };

  /* 柔光：缓存一张径向渐变贴图，避免出现硬边光圈或点阵圆盘 */
  const glowCache = {};
  function glowSprite(r, color) {
    const key = r + '|' + color;
    if (glowCache[key]) return glowCache[key];
    const size = r * 2;
    const cv = K.make(size, size);
    const c = cv.getContext('2d');
    const gr = c.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, color);
    gr.addColorStop(0.32, color);
    gr.addColorStop(0.62, hexA(color, 0.55));
    gr.addColorStop(0.84, hexA(color, 0.14));
    gr.addColorStop(1, hexA(color, 0));
    c.fillStyle = gr;
    c.fillRect(0, 0, size, size);
    glowCache[key] = cv;
    return cv;
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  P.glow = function (g, cx, cy, r, color, a) {
    r = Math.round(r);
    if (r < 2) return;
    const cv = glowSprite(r, color);
    g.save();
    g.globalAlpha = a == null ? 0.5 : a;
    g.drawImage(cv, Math.round(cx) - r, Math.round(cy) - r);
    g.restore();
  };

  /* ---- 基础层 ---- */

  P.sky = function (g, w, h, stops) {
    K.grad(g, 0, 0, w, h, stops || [
      { p: 0, c: P.PAL.night0 },
      { p: 0.55, c: P.PAL.night1 },
      { p: 1, c: P.PAL.night2 }
    ]);
  };

  P.stars = function (g, w, h, t, n, seed) {
    for (let i = 0; i < n; i++) {
      const x = Math.floor(K.rnd(seed + i * 3.1) * w);
      const y = Math.floor(K.rnd(seed + i * 7.7) * h * 0.72);
      const tw = 0.45 + 0.55 * Math.sin(t * (0.8 + K.rnd(seed + i * 1.3) * 1.6) + i);
      if (tw < 0.3) continue;
      K.rect(g, x, y, 1, 1, tw > 0.8 ? P.PAL.warm2 : P.PAL.fog);
    }
  };

  P.clouds = function (g, w, y, t, seed, color) {
    g.save();
    g.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) {
      const bw = 60 + K.rnd(seed + i) * 90;
      const x = ((K.rnd(seed + i * 5.3) * w + t * (2 + i * 0.7)) % (w + bw)) - bw;
      const by = y + K.rnd(seed + i * 2.1) * 26;
      for (let k = 0; k < 3; k++) {
        K.rect(g, x + k * 14, by + (k % 2), bw - k * 20, 3 - (k % 2), color || '#232c50');
      }
    }
    g.restore();
  };

  /* 一排楼：返回窗灯数组，供逐帧闪烁 */
  P.buildings = function (g, o) {
    const baseY = o.baseY;
    const lights = [];
    let x = o.x0;
    for (let i = 0; i < o.count; i++) {
      const bw = o.wMin + Math.floor(K.rnd(o.seed + i * 2.9) * (o.wMax - o.wMin));
      const bh = o.hMin + Math.floor(K.rnd(o.seed + i * 8.3 + 3) * (o.hMax - o.hMin));
      const by = baseY - bh;
      const shade = o.shades[(i + (o.shadeShift || 0)) % o.shades.length];
      K.rect(g, x, by, bw, bh, shade);
      K.rect(g, x, by, bw, 1, o.edge || '#232a4c');
      K.rect(g, x, by, 1, bh, o.edge2 || '#1a2142');
      if (o.antenna && i % 4 === 1) {
        const ax = x + Math.floor(bw / 2);
        K.rect(g, ax, by - 8, 1, 8, '#2a3352');
        lights.push({ x: ax, y: by - 9, c: P.PAL.red, blink: true, ph: K.rnd(o.seed + i) * 6.28 });
      }
      if (o.windows) {
        /* 先铺一遍暗窗网格：楼体才有立面，而不是黑块上撒亮点 */
        const cols = Math.max(1, Math.floor((bw - 4) / 5));
        const rows = Math.max(1, Math.floor((bh - 7) / 6));
        const wx0 = x + 3 + Math.floor((bw - (cols * 5 - 3)) / 2);
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const pick = K.rnd(o.seed + i * 31.7 + c * 7.3 + r * 2.9);
            const wx = wx0 + c * 5;
            const wy = by + 5 + r * 6;
            if (pick < o.litAt) {
              K.rect(g, wx, wy, 2, 3, '#101733');
              continue;
            }
            const warm = pick > 0.93 ? P.PAL.cyan : (pick > 0.86 ? '#ffb46a' : P.PAL.warm);
            K.rect(g, wx, wy, 2, 3, warm);
            K.rect(g, wx, wy + 2, 2, 1, K.shade(warm, -28));
            if (pick > 0.9) {
              lights.push({
                x: wx, y: wy,
                c: warm,
                blink: pick > 0.96,
                ph: K.rnd(o.seed + i * 5.1 + c + r) * 6.28,
                dim: 0.55 + K.rnd(o.seed + i * 3.3 + r) * 0.45
              });
            }
          }
        }
      }
      x += bw + (o.gap != null ? o.gap : 2) + Math.floor(K.rnd(o.seed + i * 9.7) * 5);
      if (x > o.x1) break;
    }
    return lights;
  };

  P.lamps = function (g, lights, t) {
    for (let i = 0; i < lights.length; i++) {
      const L = lights[i];
      if (L.blink && Math.sin(t * 2.2 + L.ph) < -0.4) continue;
      g.save();
      g.globalAlpha = L.dim != null ? L.dim : 1;
      K.rect(g, L.x, L.y, 1, 1, L.c);
      g.restore();
    }
  };

  /* 江面：横向拉长的反光条，逐帧错位 */
  P.river = function (g, x, y, w, h, t, seed, tint) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    K.grad(g, x, y, w, h, [
      { p: 0, c: tint || '#131b38' },
      { p: 0.6, c: '#0e1430' },
      { p: 1, c: '#080c1e' }
    ]);
    for (let i = 0; i < 90; i++) {
      const ry = y + Math.floor(K.rnd(seed + i * 4.9) * h);
      const rw = 2 + Math.floor(K.rnd(seed + i * 7.1) * 26);
      const rx = x + Math.floor(K.rnd(seed + i * 2.3) * w) + Math.sin(t * 0.9 + i) * 3;
      const col = i % 5 === 0 ? P.PAL.cyan : (i % 3 === 0 ? P.PAL.warm : '#3a4a7a');
      g.globalAlpha = 0.18 + 0.3 * K.rnd(seed + i * 3.7) + 0.1 * Math.sin(t * 1.6 + i * 0.9);
      K.rect(g, rx, ry, rw, 1, col);
    }
    g.restore();
  };

  P.puddle = function (g, x, y, w, h, t, seed, tint) {
    g.save();
    g.globalAlpha = 0.55;
    K.rect(g, x, y, w, h, tint || '#1a2142');
    g.globalAlpha = 0.35;
    for (let i = 0; i < Math.max(3, w / 8); i++) {
      const px = x + Math.floor(K.rnd(seed + i * 2.7) * w);
      const pw = 2 + Math.floor(K.rnd(seed + i * 5.1) * 8);
      g.globalAlpha = 0.18 + 0.28 * Math.abs(Math.sin(t * 1.3 + i));
      K.rect(g, px, y + 1 + (i % 3), pw, 1, tint || P.PAL.warm);
    }
    g.restore();
  };

  /* ---- 天气 ---- */

  P.rainStreaks = function (g, t, o) {
    const n = o.count || 90;
    const speed = o.speed || 260;
    g.save();
    g.globalAlpha = o.alpha != null ? o.alpha : 0.4;
    for (let i = 0; i < n; i++) {
      const bx = K.rnd((o.seed || 1) + i * 3.3) * o.w;
      const sp = speed * (0.7 + K.rnd((o.seed || 1) + i * 1.7) * 0.6);
      const y = ((K.rnd((o.seed || 1) + i * 5.9) * o.h) + t * sp) % o.h;
      const x = (bx + y * 0.16) % o.w;
      K.rect(g, o.x + x, o.y + y, 1, o.len || 5, o.color || '#7f95c4');
    }
    g.restore();
  };

  /* 玻璃上的雨：水珠先粘住、再下滑 */
  P.glassRain = function (g, t, o) {
    const n = o.count || 40;
    const seed = o.seed || 2;
    g.save();
    g.beginPath();
    g.rect(o.x, o.y, o.w, o.h);
    g.clip();
    for (let i = 0; i < n; i++) {
      const bx = o.x + Math.floor(K.rnd(seed + i * 3.7) * o.w);
      const phase = K.rnd(seed + i * 8.1) * o.h;
      const travel = (o.h + phase + t * (14 + K.rnd(seed + i * 6.1) * 26)) % (o.h + 20) - 10;
      const hold = K.rnd(seed + i * 2.2) > 0.55 ? Math.sin(t * 0.7 + i) * 2 : 0;
      const y = o.y + Math.min(o.h, Math.max(0, travel));
      K.rect(g, bx + hold, y, 1, 1, o.color || '#a8bcdf');
      if (K.rnd(seed + i * 9.1) > 0.6) {
        K.rect(g, bx + hold, y + 1, 1, 3 + Math.floor(K.rnd(seed + i) * 4), o.color || '#a8bcdf');
      }
      if (K.rnd(seed + i * 4.4) > 0.75) {
        K.rect(g, bx + hold - 1, y + 2, 1, 2, o.color || '#a8bcdf');
      }
    }
    g.restore();
  };

  P.steam = function (g, x, y, t, seed, n, color, len) {
    g.save();
    for (let i = 0; i < (n || 10); i++) {
      const ph = (t * (10 + K.rnd(seed + i) * 8) + i * 13) % 46;
      const sy = y - ph;
      const sx = x + Math.round(Math.sin(ph * 0.10 + i * 1.7) * (2 + ph * 0.05)) + Math.floor(K.rnd(seed + i * 3.1) * 4);
      if (ph > (len || 40)) continue;
      g.globalAlpha = 0.55 * (1 - ph / (len || 40));
      K.rect(g, sx, sy, 1, 1, color || '#d9c9a8');
      if (ph < 20) K.rect(g, sx + 1, sy, 1, 1, color || '#d9c9a8');
    }
    g.restore();
  };

  /* ---- 灯 ---- */

  P.bulbs = function (g, pts, t, color) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const sw = Math.sin(t * 1.4 + i * 0.8) * 1;
      if (i > 0) {
        const q = pts[i - 1];
        const mx = (p[0] + q[0]) / 2 + sw * 0.5;
        const my = (p[1] + q[1]) / 2 + 4;
        K.line(g, q[0], q[1], mx, my, '#2b3352', 1);
        K.line(g, mx, my, p[0], p[1], '#2b3352', 1);
      }
      const on = Math.sin(t * 3.1 + i * 2.3) > -0.85;
      if (on) {
        K.rect(g, p[0], p[1] + 1, 1, 1, color || P.PAL.warm);
        g.save();
        g.globalAlpha = 0.22;
        K.rect(g, p[0] - 1, p[1] + 1, 3, 1, color || P.PAL.warm);
        g.restore();
      }
    }
  };

  P.lantern = function (g, x, y, t, i) {
    const sway = Math.sin(t * 1.5 + i * 1.3) * 1.6;
    const lx = x + sway;
    K.rect(g, lx, y - 2, 1, 2, '#3a2a2a');
    K.rect(g, lx - 3, y, 7, 1, '#7a2a22');
    K.rect(g, lx - 4, y + 1, 9, 8, '#c9402e');
    K.rect(g, lx - 3, y + 2, 7, 6, '#e8603e');
    K.rect(g, lx - 2, y + 3, 5, 2, '#ffb46a');
    K.rect(g, lx - 3, y + 9, 7, 1, '#7a2a22');
    K.rect(g, lx, y + 10, 1, 3, '#e8c070');
    g.save();
    g.globalAlpha = 0.18 + 0.06 * Math.sin(t * 2 + i);
    K.disc(g, lx, y + 5, 9, '#e8603e');
    g.restore();
  };

  P.lampPost = function (g, x, y, t, h) {
    h = h || 46;
    K.rect(g, x, y - h, 2, h, '#232a45');
    K.rect(g, x - 1, y - h - 2, 4, 2, '#2e3757');
    K.rect(g, x - 1, y - h - 4, 4, 2, '#f2c05e');
    const fl = 0.72 + 0.10 * Math.sin(t * 5.7 + x) + 0.06 * Math.sin(t * 11.3 + x * 0.3);
    g.save();
    g.globalAlpha = fl * 0.30;
    K.disc(g, x, y - h - 3, 10, '#f2c05e');
    g.globalAlpha = fl * 0.16;
    K.disc(g, x, y - h - 3, 20, '#f2c05e');
    g.restore();
    K.rect(g, x - 1, y - h - 4, 4, 2, '#ffe9a8');
    return fl;
  };

  /* ---- 道具 ---- */

  P.tree = function (g, x, baseY, h, seed, t) {
    K.rect(g, x, baseY - h * 0.45, 2, h * 0.45, '#2a2018');
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = K.rnd(seed + i * 2.3) * 6.28;
      const r = 3 + K.rnd(seed + i * 5.7) * (h * 0.16);
      const cx = x + Math.cos(a) * r + Math.sin(t * 0.8 + i) * 1.2;
      const cy = baseY - h * 0.62 + Math.sin(a) * r * 0.8 + Math.cos(t * 0.7 + i) * 0.8;
      K.rect(g, Math.round(cx), Math.round(cy), 2, 2, i % 3 ? '#1b2a2a' : '#243a34');
    }
  };

  P.bench = function (g, x, y) {
    K.rect(g, x, y - 6, 30, 3, '#4a3026');
    K.rect(g, x, y - 3, 30, 2, '#3a241e');
    K.rect(g, x + 2, y - 1, 2, 6, '#2a1c18');
    K.rect(g, x + 26, y - 1, 2, 6, '#2a1c18');
    K.rect(g, x, y - 12, 30, 2, '#4a3026');
    K.rect(g, x + 3, y - 10, 2, 4, '#3a241e');
    K.rect(g, x + 25, y - 10, 2, 4, '#3a241e');
  };

  P.bike = function (g, x, y) {
    K.ring(g, x + 4, y, 4, '#2a3352');
    K.ring(g, x + 18, y, 4, '#2a3352');
    K.line(g, x + 4, y, x + 10, y - 7, '#5a4a6a', 1);
    K.line(g, x + 10, y - 7, x + 18, y, '#5a4a6a', 1);
    K.line(g, x + 10, y - 7, x + 8, y - 11, '#5a4a6a', 1);
    K.rect(g, x + 6, y - 12, 5, 1, '#5a4a6a');
  };

  P.ac = function (g, x, y) {
    K.rect(g, x, y, 10, 7, '#2a3352');
    K.rect(g, x + 1, y + 1, 8, 5, '#1a2142');
    K.rect(g, x + 1, y + 6, 8, 1, '#151b36');
  };

  P.laundry = function (g, x, y, t, seed) {
    K.line(g, x, y, x + 60, y + 2, '#3a4266', 1);
    for (let i = 0; i < 4; i++) {
      const px = x + 8 + i * 13;
      const sw = Math.sin(t * 1.2 + i * 1.9) * 1.5;
      const col = ['#4a4266', '#5a4a5a', '#3e4e66', '#5a4656'][i % 4];
      K.rect(g, px + sw, y + 1 + (i % 2), 7, 9 + (i % 3) * 2, col);
    }
  };

  P.cat = function (g, x, y, t, seed, flip) {
    if (!P._cat) P._cat = K.spriteCanvas(K.art.cat, K.PAL.cat, false);
    const bob = Math.sin(t * 1.6 + (seed || 0)) > 0.6 ? 1 : 0;
    g.drawImage(P._cat, Math.round(x), Math.round(y) + bob);
  };

  /* ---- 窗外远景（多个场景共用） ---- */

  P.farCity = function (g, x, y, w, h, t, seed, opt) {
    opt = opt || {};
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    K.grad(g, x, y, w, h, [
      { p: 0, c: opt.top || '#0d1630' },
      { p: 0.5, c: opt.mid || '#1b2a52' },
      { p: 1, c: opt.bot || '#33406a' }
    ]);
    const lights = P.buildings(g, {
      x0: x, x1: x + w, baseY: y + h - 4,
      count: 14, wMin: 10, wMax: 26, hMin: 14, hMax: 52,
      seed: seed || 4, shades: ['#131b36', '#18213f', '#152039'],
      windows: true, litAt: 0.62, edge: '#26315a'
    });
    P.lamps(g, lights, t);
    K.dither(g, x, y + h - 12, w, 8, '#2c3f6b', '#4a5d8a', 6);
    g.restore();
    return lights;
  };

  P.skylineSil = function (g, x, baseY, w, h, color, seed) {
    g.save();
    g.globalAlpha = 0.9;
    P.buildings(g, {
      x0: x, x1: x + w, baseY: baseY,
      count: 18, wMin: 8, wMax: 24, hMin: 8, hMax: h,
      seed: seed || 11, shades: [color, color], windows: false,
      edge: color, edge2: color, gap: 1
    });
    g.restore();
  };

  root.PIXEL_PAINT = P;
})(typeof window !== 'undefined' ? window : null);
