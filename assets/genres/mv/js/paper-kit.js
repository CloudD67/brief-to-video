/* 层叠剪纸绘制层：原生 1920×1080 逻辑画布，按设备像素重画。
   所有形状都是矢量（路径 / 渐变 / 纸边），1080p 与 4K 共用同一套坐标；
   不缩放位图，所以 4K 不是“把 1080p 拉大”。随机只走 rnd(seed)，不读挂钟。 */
(function (root) {
  'use strict';

  const C = root.FILM_CONFIG;
  const W = C.width;
  const H = C.height;
  const R = Math.max(1, Math.round(C.renderScale || 1));
  const ART = C.art || {};
  const FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
  const K = {};

  K.W = W;
  K.H = H;
  K.R = R;
  K.ART = ART;

  /* ── 数学 ─────────────────────────────────────────────── */

  K.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  K.lerp = function (a, b, p) { return a + (b - a) * p; };
  K.smooth = function (p) { p = K.clamp(p, 0, 1); return p * p * (3 - 2 * p); };
  K.ease = function (p) { p = K.clamp(p, 0, 1); return 1 - Math.pow(1 - p, 3); };
  K.rnd = function (seed) {
    let x = Math.imul((Math.floor(seed) || 1) ^ 0x9e3779b9, 2654435761) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 2246822519) >>> 0;
    x ^= x >>> 13;
    x = Math.imul(x, 3266489917) >>> 0;
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  };

  K.rgba = function (hex, a) {
    const h = String(hex || '#000').replace('#', '');
    const v = h.length === 3
      ? h.split('').map(c => c + c).join('')
      : h.padEnd(6, '0');
    const n = parseInt(v, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  K.mix = function (a, b, p) {
    const pa = parseInt(String(a).replace('#', ''), 16);
    const pb = parseInt(String(b).replace('#', ''), 16);
    const r = Math.round(K.lerp((pa >> 16) & 255, (pb >> 16) & 255, p));
    const g = Math.round(K.lerp((pa >> 8) & 255, (pb >> 8) & 255, p));
    const bl = Math.round(K.lerp(pa & 255, pb & 255, p));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  };

  /* ── 画布 ─────────────────────────────────────────────── */

  K.make = function (w, h) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * R));
    cv.height = Math.max(1, Math.round(h * R));
    return cv;
  };

  K.stage = function (host) {
    const cv = K.make(W, H);
    cv.className = 'paper-canvas';
    host.appendChild(cv);
    return cv;
  };

  K.ctx = function (cv) {
    const g = cv.getContext('2d');
    g.setTransform(R, 0, 0, R, 0, 0);
    g.imageSmoothingEnabled = true;
    return g;
  };

  K.clear = function (g) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W * R, H * R);
    g.restore();
    g.setTransform(R, 0, 0, R, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  };

  /* ── 调色板 ───────────────────────────────────────────── */

  const PAL = {
    dusk: {
      sky: ['#263a63', '#385177', '#6b6a84', '#b98a83'],
      sea: ['#3c6584', '#315a78', '#264c67', '#1d3d55', '#163043'],
      ink: '#0b1526',
      cream: '#f3e3c6',
      warm: '#f7c27d',
      ember: '#d96a56',
      star: 0.32,
      moon: '#f6e7c6'
    },
    night: {
      sky: ['#06101f', '#0a1a30', '#122744', '#1b3453'],
      sea: ['#1d4664', '#173b57', '#123049', '#0d2439', '#081828'],
      ink: '#050c17',
      cream: '#f4e8cd',
      warm: '#ffc473',
      ember: '#e07a5c',
      star: 0.85,
      moon: '#f8efd2'
    },
    storm: {
      sky: ['#0a1422', '#132436', '#1d3446', '#2a4354'],
      sea: ['#244c62', '#1d4054', '#173346', '#112737', '#0a1a27'],
      ink: '#050b13',
      cream: '#e2e9e5',
      warm: '#ffc473',
      ember: '#d96a56',
      star: 0.12,
      moon: '#e6e3d4'
    },
    dawn: {
      sky: ['#27395e', '#4b5478', '#9a7581', '#e9a37c', '#f5c495'],
      sea: ['#4b7792', '#406b86', '#345c76', '#284c64', '#1d3a4e'],
      ink: '#0a1422',
      cream: '#f9edd2',
      warm: '#ffd08f',
      ember: '#e5836a',
      star: 0.1,
      moon: '#f9edd2'
    }
  };

  K.pal = function (mood) { return PAL[mood] || PAL.night; };

  /* ── 纸层 ─────────────────────────────────────────────── */

  /* 剪纸层：主体 + 一层向上错开的浅色纸边，形成“叠纸”的厚度。
     阴影只在纸层之间用，天空与海面这种满幅底色要关掉。 */
  K.paper = function (g, build, fill, opt) {
    opt = opt || {};
    g.save();
    if (opt.shadow !== false) {
      g.shadowColor = opt.shadowColor || 'rgba(5,10,20,0.30)';
      g.shadowBlur = opt.blur == null ? 18 : opt.blur;
      g.shadowOffsetY = opt.dy == null ? 8 : opt.dy;
    }
    g.fillStyle = fill;
    g.beginPath();
    build(g);
    g.fill();
    g.restore();

    if (opt.edge === null) return;
    const ew = opt.edgeW == null ? 3 : opt.edgeW;
    const ec = opt.edge || ART.cream || '#f3e3c6';
    const ea = opt.edgeA == null ? 0.34 : opt.edgeA;
    g.save();
    g.translate(0, -ew);
    g.globalAlpha = ea;
    g.fillStyle = ec;
    g.beginPath();
    build(g);
    g.fill();
    g.restore();
    g.save();
    g.fillStyle = fill;
    g.beginPath();
    build(g);
    g.fill();
    g.restore();
  };

  K.glow = function (g, x, y, r, color, alpha) {
    if (r <= 0) return;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, K.rgba(color, alpha));
    grd.addColorStop(0.4, K.rgba(color, alpha * 0.45));
    grd.addColorStop(1, K.rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };

  /* ── 天空 / 星 / 月 ───────────────────────────────────── */

  K.sky = function (g, mood, t, opt) {
    opt = opt || {};
    const P = K.pal(mood);
    const hz = opt.horizon == null ? 650 : opt.horizon;
    const grd = g.createLinearGradient(0, 0, 0, hz + 150);
    for (let i = 0; i < P.sky.length; i++) grd.addColorStop(i / (P.sky.length - 1), P.sky[i]);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, hz + 180);

    if (opt.sun) {
      const s = opt.sun;
      K.glow(g, s.x, s.y, s.r * 4.2, P.warm, 0.24);
      g.fillStyle = P.cream;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
    }

    const stars = opt.stars == null ? P.star : opt.stars;
    if (stars > 0) K.stars(g, t, opt.seed || 11, stars, hz);

    if (opt.moon) {
      const m = opt.moon;
      K.moon(g, m.x, m.y, m.r || 120, t, P);
    }

    if (mood === 'storm') {
      for (let i = 0; i < 5; i++) {
        const y = 150 + i * 88 + Math.sin(t * 0.16 + i) * 10;
        const off = (t * (8 + i * 3) + i * 320) % (W + 700) - 350;
        g.save();
        g.globalAlpha = 0.16 + i * 0.035;
        g.fillStyle = '#081220';
        g.beginPath();
        g.moveTo(-100, y);
        for (let x = -100; x <= W + 100; x += 90) {
          g.quadraticCurveTo(x + 45, y + (i % 2 ? 26 : -22), x + 90, y + Math.sin((x + off) * 0.004 + i) * 14);
        }
        g.lineTo(W + 100, y + 170);
        g.lineTo(-100, y + 170);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
  };

  K.stars = function (g, t, seed, density, hz) {
    const n = Math.round(70 * density);
    for (let i = 0; i < n; i++) {
      const x = K.rnd(seed + i * 3.17) * W;
      const y = K.rnd(seed + i * 7.71) * (hz || 640) * 0.92;
      const base = 0.25 + K.rnd(seed + i * 1.93) * 0.7;
      const tw = 0.55 + 0.45 * Math.sin(t * (1.1 + K.rnd(seed + i * 5.3) * 1.6) + i * 1.7);
      const r = 1.4 + K.rnd(seed + i * 9.1) * 2.4;
      g.save();
      g.globalAlpha = base * tw;
      g.fillStyle = i % 7 === 0 ? '#ffe6b8' : '#e8eef5';
      if (i % 11 === 0) {
        g.beginPath();
        g.moveTo(x, y - r * 3.2);
        g.quadraticCurveTo(x + r * 0.5, y - r * 0.5, x + r * 3.2, y);
        g.quadraticCurveTo(x + r * 0.5, y + r * 0.5, x, y + r * 3.2);
        g.quadraticCurveTo(x - r * 0.5, y + r * 0.5, x - r * 3.2, y);
        g.quadraticCurveTo(x - r * 0.5, y - r * 0.5, x, y - r * 3.2);
        g.fill();
      } else {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  };

  K.moon = function (g, x, y, r, t, P) {
    P = P || K.pal('night');
    const breath = 1 + Math.sin(t * 0.5) * 0.012;
    K.glow(g, x, y, r * 3.6, P.cream, 0.20);
    g.save();
    g.shadowColor = K.rgba(P.cream, 0.5);
    g.shadowBlur = 46;
    g.fillStyle = P.moon || P.cream;
    g.beginPath();
    g.arc(x, y, r * breath, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.save();
    g.globalAlpha = 0.22;
    g.fillStyle = '#d8c79e';
    const craters = [[-0.28, -0.2, 0.17], [0.24, 0.12, 0.12], [0.02, 0.38, 0.08], [-0.12, 0.5, 0.05]];
    for (let i = 0; i < craters.length; i++) {
      const c = craters[i];
      g.beginPath();
      g.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };

  /* ── 海 ───────────────────────────────────────────────── */

  K.wavePath = function (g, y, amp, wl, phase) {
    g.moveTo(-80, H + 80);
    g.lineTo(-80, y + Math.sin(phase) * amp);
    for (let x = -80; x <= W + 80; x += 20) {
      g.lineTo(x, y + Math.sin(x / wl + phase) * amp + Math.sin(x / (wl * 0.37) + phase * 1.7) * amp * 0.28);
    }
    g.lineTo(W + 80, H + 80);
    g.closePath();
  };

  K.ocean = function (g, mood, t, opt) {
    opt = opt || {};
    const P = K.pal(mood);
    const hz = opt.horizon == null ? 650 : opt.horizon;
    const bands = opt.bands || 5;
    const amp0 = opt.amp == null ? 9 : opt.amp;
    const rise = opt.rise || 0;
    for (let i = 0; i < bands; i++) {
      const y = hz + 14 + i * ((H - hz) / bands) * 1.04;
      const amp = amp0 * (0.55 + i * 0.38);
      const phase = t * (0.42 + i * 0.08) + i * 1.9;
      const climb = rise * (i + 1) * 34 * K.smooth(K.clamp((t - i * 0.16) / 0.85, 0, 1));
      const wobble = Math.sin(t * (0.9 + i * 0.12) + i * 0.8) * (rise ? 12 : 3);
      K.paper(g, function (ctx) { K.wavePath(ctx, y - climb + wobble, amp, 330 - i * 26, phase); },
        P.sea[i % P.sea.length],
        { edge: P.cream, edgeA: opt.edgeA == null ? 0.22 : opt.edgeA, edgeW: 3, blur: 15, dy: 7 });
    }
    if (opt.shimmer) K.shimmer(g, opt.shimmer.x, hz + 16, t, opt.shimmer.color || P.cream, opt.shimmer.alpha || 0.3);
  };

  K.shimmer = function (g, x, y, t, color, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = color;
    for (let r = 0; r < 16; r++) {
      const yy = y + r * 18 + Math.sin(t * 1.3 + r) * 3;
      const w = 26 + r * 7;
      const dx = Math.sin(t * 1.7 + r * 0.9) * (10 + r * 2);
      g.fillRect(x - w / 2 + dx, yy, w, 3);
    }
    g.restore();
  };

  /* ── 小镇 / 灯塔 / 码头 ───────────────────────────────── */

  K.town = function (g, x, y, w, opt) {
    opt = opt || {};
    const P = K.pal(opt.mood || 'night');
    const seed = opt.seed || 21;
    const n = opt.n || 14;
    const hMax = opt.h || 150;
    const step = w / n;
    const back = opt.back || '#101c2e';
    const tail = opt.tail == null ? 200 : opt.tail;
    g.save();
    /* 岸线：楼群坐在一条连续的地基上，楼与楼之间不透海（后排行多压 22px，一并盖住） */
    g.fillStyle = P.ink;
    g.fillRect(x, y, w, tail + 24);
    for (let row = 0; row < 2; row++) {
      g.globalAlpha = row === 0 ? 0.55 : 1;
      g.fillStyle = row === 0 ? back : P.ink;
      for (let i = 0; i < n; i++) {
        const bw = step * (0.72 + K.rnd(seed + i * 2.3 + row * 9) * 0.5);
        const bh = hMax * (0.35 + K.rnd(seed + i * 5.1 + row * 7) * 0.65) * (row ? 1 : 0.85);
        const bx = x + i * step + (row ? step * 0.15 : 0);
        const by = y - bh + (row ? 22 : 0);
        g.fillRect(bx, by, bw, bh + tail);
        g.beginPath();
        if (K.rnd(seed + i * 3.7 + row) > 0.35) {
          g.moveTo(bx - 6, by);
          g.lineTo(bx + bw / 2, by - bh * 0.34);
          g.lineTo(bx + bw + 6, by);
        } else {
          g.moveTo(bx - 3, by);
          g.lineTo(bx + bw / 2, by - 8);
          g.lineTo(bx + bw + 3, by);
        }
        g.closePath();
        g.fill();
      }
    }
    g.restore();

    if (opt.windows !== false) {
      for (let i = 0; i < n; i++) {
        if (K.rnd(seed + i * 8.9) > (opt.lit == null ? 0.34 : opt.lit)) continue;
        const bx = x + i * step + step * 0.3;
        const by = y - hMax * (0.3 + K.rnd(seed + i * 4.4) * 0.5);
        const flick = 0.65 + 0.35 * Math.sin(tSafe(opt.t) * (0.8 + K.rnd(seed + i) * 1.5) + i);
        g.save();
        g.globalAlpha = flick;
        g.fillStyle = P.warm;
        g.fillRect(bx, by, 5, 7);
        g.restore();
      }
    }
  };

  function tSafe(t) { return Number.isFinite(t) ? t : 0; }

  K.lighthouse = function (g, x, baseY, h, t, opt) {
    opt = opt || {};
    const P = K.pal(opt.mood || 'night');
    const w = h * 0.20;
    const topY = baseY - h;
    const topW = w * 0.56;
    const lampY = topY + h * 0.09;

    /* 礁石 */
    g.save();
    g.fillStyle = P.ink;
    g.beginPath();
    g.moveTo(x - w * 1.9, baseY + 10);
    g.bezierCurveTo(x - w * 1.2, baseY - 30, x - w * 0.7, baseY - 24, x - w * 0.4, baseY - 8);
    g.lineTo(x + w * 0.4, baseY - 8);
    g.bezierCurveTo(x + w * 0.8, baseY - 28, x + w * 1.3, baseY - 32, x + w * 1.9, baseY + 10);
    g.closePath();
    g.fill();
    g.restore();

    /* 光柱：先画，让塔身压住根部 */
    if (opt.beam) {
      const ang = opt.beamAngle == null ? 0.16 + Math.sin(t * 0.45) * 0.34 : opt.beamAngle;
      const alpha = opt.beamAlpha == null ? 0.16 : opt.beamAlpha;
      K.beam(g, x, lampY, ang, 1900, P.cream, alpha);
      K.beam(g, x, lampY, ang + Math.PI, 1500, P.cream, alpha * 0.7);
    }

    /* 塔身：下宽上窄，奶油纸面 + 两道深色纸带 */
    const towerFill = opt.tower || '#efe0c2';
    K.paper(g, function (ctx) {
      ctx.moveTo(x - w / 2, baseY);
      ctx.lineTo(x - topW / 2, topY + h * 0.10);
      ctx.lineTo(x + topW / 2, topY + h * 0.10);
      ctx.lineTo(x + w / 2, baseY);
      ctx.closePath();
    }, towerFill, { edge: '#fff6e2', edgeA: 0.5, blur: 26, dy: 12 });

    g.save();
    g.fillStyle = P.ember;
    g.globalAlpha = 0.9;
    for (let i = 0; i < 2; i++) {
      const yy = baseY - h * (0.26 + i * 0.22);
      const ww = K.lerp(w, topW, (baseY - yy) / h) * 0.92;
      g.fillRect(x - ww / 2, yy, ww, h * 0.085);
    }
    g.restore();

    /* 塔门：拱形，给底部一个落点 */
    g.save();
    g.fillStyle = P.ink;
    g.beginPath();
    g.moveTo(x - w * 0.15, baseY);
    g.lineTo(x - w * 0.15, baseY - h * 0.105);
    g.quadraticCurveTo(x, baseY - h * 0.165, x + w * 0.15, baseY - h * 0.105);
    g.lineTo(x + w * 0.15, baseY);
    g.closePath();
    g.fill();
    g.restore();

    /* 观景台 + 灯室 */
    const gy = topY + h * 0.075;
    g.fillStyle = P.ink;
    g.fillRect(x - w * 0.48, gy, w * 0.96, h * 0.028);
    g.fillRect(x - w * 0.30, gy - h * 0.035, w * 0.60, h * 0.035);
    g.fillRect(x - topW * 0.62, lampY - h * 0.075, topW * 1.24, h * 0.080);
    g.fillRect(x - w * 0.52, gy - h * 0.005, w * 0.04, h * 0.02);
    g.fillRect(x + w * 0.48 - w * 0.04, gy - h * 0.005, w * 0.04, h * 0.02);

    /* 栏杆：细竖条，远看也读得出是观景台 */
    g.save();
    g.fillStyle = P.ink;
    for (let i = 0; i <= 7; i++) {
      const rx = x - w * 0.46 + (w * 0.92 / 7) * i;
      g.fillRect(rx - 1.5, gy - h * 0.046, 3, h * 0.046);
    }
    g.fillRect(x - w * 0.46, gy - h * 0.046, w * 0.92, h * 0.005);
    g.restore();

    const light = opt.lampOn == null ? 1 : opt.lampOn;
    if (light > 0.02) {
      K.glow(g, x, lampY, h * 0.30, P.warm, 0.30 * light);
      g.save();
      g.globalAlpha = light;
      g.fillStyle = P.warm;
      g.fillRect(x - topW * 0.34, lampY - h * 0.045, topW * 0.68, h * 0.045);
      g.fillStyle = '#fff1c9';
      g.fillRect(x - topW * 0.16, lampY - h * 0.032, topW * 0.32, h * 0.024);
      g.restore();
    } else {
      g.save();
      g.globalAlpha = 0.5;
      g.fillStyle = '#1a2b41';
      g.fillRect(x - topW * 0.34, lampY - h * 0.045, topW * 0.68, h * 0.045);
      g.restore();
    }

    /* 屋顶 */
    g.fillStyle = P.ink;
    g.beginPath();
    g.moveTo(x - topW * 0.78, lampY - h * 0.075);
    g.lineTo(x, lampY - h * 0.145);
    g.lineTo(x + topW * 0.78, lampY - h * 0.075);
    g.closePath();
    g.fill();
    g.fillRect(x - 2, lampY - h * 0.165, 4, h * 0.03);

    /* 塔身小窗：守灯人上楼时逐格被点亮 */
    const litAt = opt.climbWindows || 0;
    for (let i = 0; i < 5; i++) {
      const yy = baseY - h * (0.20 + i * 0.13);
      const on = litAt > i * 0.34 + 0.2;
      g.save();
      g.globalAlpha = on ? 0.95 : 0.30;
      g.fillStyle = on ? P.warm : '#20324a';
      g.fillRect(x - 7, yy, 14, 22);
      g.restore();
    }
  };

  K.beam = function (g, x, y, angle, len, color, alpha, opt) {
    opt = opt || {};
    const spread = opt.spread == null ? 0.10 : opt.spread;
    const root = opt.root == null ? 14 : opt.root;
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    const grd = g.createLinearGradient(0, 0, len, 0);
    grd.addColorStop(0, K.rgba(color, alpha));
    grd.addColorStop(0.45, K.rgba(color, alpha * 0.34));
    grd.addColorStop(1, K.rgba(color, 0));
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, -root);
    g.lineTo(len, -len * spread);
    g.lineTo(len, len * spread);
    g.lineTo(0, root);
    g.closePath();
    g.fill();
    g.restore();
  };

  K.pier = function (g, t, opt) {
    opt = opt || {};
    const P = K.pal(opt.mood || 'night');
    const y = opt.y == null ? 890 : opt.y;
    const from = opt.from == null ? -30 : opt.from;
    const to = opt.to == null ? W + 30 : opt.to;
    const deckH = opt.h == null ? 26 : opt.h;

    g.save();
    g.fillStyle = P.ink;
    const posts = Math.max(2, Math.round((to - from) / 190));
    for (let i = 0; i <= posts; i++) {
      const x = from + (to - from) * (i / posts);
      g.fillRect(x - 11, y + deckH, 22, H - y);
    }
    g.restore();

    K.paper(g, function (ctx) {
      ctx.moveTo(from, y);
      ctx.lineTo(to, y);
      ctx.lineTo(to, y + deckH);
      ctx.lineTo(from, y + deckH);
      ctx.closePath();
    }, '#e8d6b6', { edge: '#fff4dc', edgeA: 0.45, blur: 18, dy: 9 });

    g.save();
    g.globalAlpha = 0.22;
    g.fillStyle = '#6b5a44';
    for (let x = from + 30; x < to; x += 74) g.fillRect(x, y + 3, 3, deckH - 6);
    g.restore();

    if (opt.rail !== false) {
      const railY = y - (opt.railH == null ? 96 : opt.railH);
      g.save();
      g.strokeStyle = '#e4cfae';
      g.lineWidth = 8;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(from, railY);
      g.lineTo(to, railY);
      g.stroke();
      g.lineWidth = 6;
      for (let x = from + 40; x < to; x += 180) {
        g.beginPath();
        g.moveTo(x, railY);
        g.lineTo(x, y + 4);
        g.stroke();
      }
      g.restore();
    }

    if (opt.lanterns) {
      for (let i = 0; i < opt.lanterns.length; i++) {
        const lx = opt.lanterns[i];
        const ly = y - (opt.railH == null ? 96 : opt.railH) - 40;
        g.save();
        g.strokeStyle = P.ink;
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(lx, ly - 26);
        g.lineTo(lx, ly);
        g.stroke();
        g.restore();
        const flick = 0.8 + 0.2 * Math.sin(t * 7 + i * 2.1) * Math.sin(t * 3.1 + i);
        K.glow(g, lx, ly + 10, 70, P.warm, 0.24 * flick);
        g.save();
        g.fillStyle = P.warm;
        g.beginPath();
        g.roundRect(lx - 10, ly, 20, 26, 4);
        g.fill();
        g.restore();
      }
    }
  };

  /* ── 船 ───────────────────────────────────────────────── */

  K.boat = function (g, x, y, s, t, opt) {
    opt = opt || {};
    const P = K.pal(opt.mood || 'night');
    const ph = opt.ph || 0;
    const bob = Math.sin(t * 1.6 + ph) * 7 * s;
    const tilt = Math.sin(t * 1.2 + ph) * 0.035 + (opt.tilt || 0);
    g.save();
    g.translate(x, y + bob);
    g.rotate(tilt);
    g.scale((opt.dir || 1) * s, s);

    /* 水面倒影 */
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = P.cream;
    for (let i = 0; i < 5; i++) {
      g.fillRect(-70 + i * 8, 42 + i * 10, 140 - i * 16, 4);
    }
    g.restore();

    /* 桅杆与帆 */
    const billow = 0.64 + Math.sin(t * 2.2 + ph) * 0.07;
    g.save();
    g.fillStyle = '#e9d8b8';
    g.beginPath();
    g.moveTo(6, -150);
    g.quadraticCurveTo(86 * billow, -96, 6, -34);
    g.closePath();
    g.fill();
    g.restore();
    g.save();
    g.strokeStyle = '#c9b18b';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(6, -160);
    g.lineTo(6, -12);
    g.stroke();
    g.restore();

    /* 船身 */
    K.paper(g, function (ctx) {
      ctx.moveTo(-96, -18);
      ctx.quadraticCurveTo(-70, 30, -28, 34);
      ctx.lineTo(56, 34);
      ctx.quadraticCurveTo(92, 24, 104, -18);
      ctx.quadraticCurveTo(20, -2, -96, -18);
      ctx.closePath();
    }, '#f0dfbf', { edge: '#fff6e1', edgeA: 0.5, blur: 12, dy: 6 });

    g.save();
    g.fillStyle = P.ink;
    g.fillRect(-74, -12, 156, 9);
    g.restore();

    /* 船头灯 */
    const flick = 0.82 + 0.18 * Math.sin(t * 8.3 + ph);
    K.glow(g, -78, -34, 96, P.warm, 0.34 * flick);
    g.save();
    g.fillStyle = P.warm;
    g.beginPath();
    g.arc(-78, -34, 8, 0, Math.PI * 2);
    g.fill();
    g.restore();

    if (opt.keeper && root.PAPER_FIG) {
      root.PAPER_FIG.fig(g, {
        p: 'keeper',
        x: -8,
        y: -22,
        h: 150,
        pose: opt.keeper === 'wave' ? 'wave' : 'stand',
        dir: 1,
        ph: 0.4
      }, t, { rim: 0.3 });
    }
    g.restore();
  };

  /* ── 雨 / 雾 / 玻璃 ───────────────────────────────────── */

  K.rain = function (g, t, opt) {
    opt = opt || {};
    const n = opt.n || 170;
    const seed = opt.seed || 5;
    const speed = opt.speed || 1500;
    const slant = opt.slant == null ? 0.26 : opt.slant;
    g.save();
    g.strokeStyle = opt.color || 'rgba(198,218,232,0.55)';
    g.globalAlpha = opt.alpha == null ? 0.55 : opt.alpha;
    g.lineWidth = opt.w == null ? 2 : opt.w;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const x = K.rnd(seed + i * 3.1) * (W + 300) - 150;
      const y0 = K.rnd(seed + i * 7.7) * (H + 260);
      const y = ((y0 + t * speed * (0.7 + K.rnd(seed + i * 1.3) * 0.6)) % (H + 260)) - 130;
      const len = 30 + K.rnd(seed + i * 5.9) * 44;
      g.moveTo(x, y);
      g.lineTo(x - len * slant, y + len);
    }
    g.stroke();
    g.restore();
  };

  K.fog = function (g, t, opt) {
    opt = opt || {};
    const P = K.pal(opt.mood || 'dawn');
    const alpha = opt.alpha == null ? 0.16 : opt.alpha;
    for (let i = 0; i < 6; i++) {
      const y = (opt.y == null ? 420 : opt.y) + i * (opt.gap == null ? 92 : opt.gap);
      const off = (t * (12 + i * 5) + i * 260) % (W + 900) - 450;
      g.save();
      g.globalAlpha = alpha * (0.6 + i * 0.08);
      g.fillStyle = i % 2 ? P.cream : '#cfd9dc';
      g.beginPath();
      g.moveTo(-200, y + 120);
      g.lineTo(-200, y);
      for (let x = -200; x <= W + 200; x += 120) {
        g.quadraticCurveTo(x + 60, y - 26 - i * 4, x + 120, y + Math.sin((x + off) * 0.004) * 22);
      }
      g.lineTo(W + 200, y + 120);
      g.closePath();
      g.fill();
      g.restore();
    }
  };

  /* 玻璃上的雾：整面薄雾 + 絮状霜花，中心被手掌擦开一个渐隐的圆 */
  K.fogOnGlass = function (g, rect, t, clearR, opt) {
    opt = opt || {};
    const alpha = opt.alpha == null ? 0.3 : opt.alpha;
    const cx = rect.x + rect.w * (opt.cx == null ? 0.5 : opt.cx);
    const cy = rect.y + rect.h * (opt.cy == null ? 0.55 : opt.cy);
    g.save();
    g.beginPath();
    g.rect(rect.x, rect.y, rect.w, rect.h);
    g.clip();

    g.fillStyle = '#dfe6e4';
    g.globalAlpha = alpha * 0.7;
    g.beginPath();
    g.rect(rect.x, rect.y, rect.w, rect.h);
    if (clearR > 0) g.arc(cx, cy, clearR, 0, Math.PI * 2);
    g.fill('evenodd');

    if (clearR > 0) {
      const ring = g.createRadialGradient(cx, cy, clearR * 0.86, cx, cy, clearR + 30);
      ring.addColorStop(0, K.rgba('#dfe6e4', 0));
      ring.addColorStop(1, K.rgba('#dfe6e4', alpha * 0.9));
      g.globalAlpha = 1;
      g.fillStyle = ring;
      g.beginPath();
      g.arc(cx, cy, clearR + 34, 0, Math.PI * 2);
      g.fill();
    }

    const step = 34;
    let k = 0;
    for (let y = rect.y - step * 0.5; y < rect.y + rect.h + step * 0.5; y += step) {
      for (let x = rect.x - step * 0.5; x < rect.x + rect.w + step * 0.5; x += step) {
        k++;
        const jx = x + step * (0.5 + (K.rnd(71 + k * 2.3) - 0.5) * 0.9);
        const jy = y + step * (0.5 + (K.rnd(71 + k * 3.7) - 0.5) * 0.9);
        const d = Math.hypot(jx - cx, jy - cy);
        if (clearR > 0 && d < clearR + 12) continue;
        const rx = 7 + K.rnd(71 + k * 7.9) * 9;
        g.fillStyle = '#dfe6e4';
        g.globalAlpha = alpha * (0.25 + K.rnd(71 + k * 4.4) * 0.35);
        g.beginPath();
        g.ellipse(jx, jy, rx, rx * (0.7 + K.rnd(71 + k * 9.3) * 0.4), K.rnd(71 + k * 6.2) * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
    }

    if (clearR > 0) {
      g.strokeStyle = '#f4efe4';
      g.lineCap = 'round';
      g.globalAlpha = 0.1;
      g.lineWidth = 26;
      g.beginPath();
      g.arc(cx, cy, Math.max(8, clearR - 40), Math.PI * 0.55, Math.PI * 1.35);
      g.stroke();
      g.globalAlpha = 0.16;
      g.lineWidth = 7;
      g.beginPath();
      g.arc(cx, cy, clearR + 6, Math.PI * 0.62, Math.PI * 1.28);
      g.stroke();
    }
    g.restore();
  };

  K.drops = function (g, rect, t, opt) {
    opt = opt || {};
    const n = opt.n || 46;
    g.save();
    for (let i = 0; i < n; i++) {
      const x = rect.x + K.rnd(31 + i * 2.7) * rect.w;
      const speed = 26 + K.rnd(31 + i * 5.1) * 54;
      const y = rect.y + ((K.rnd(31 + i * 7.3) * rect.h + t * speed) % rect.h);
      const len = 10 + K.rnd(31 + i * 4.3) * 30;
      const a = 0.18 + K.rnd(31 + i * 9.7) * 0.3;
      g.globalAlpha = a;
      g.fillStyle = '#dbe7ea';
      g.beginPath();
      g.roundRect(x, y, 3, len, 2);
      g.fill();
    }
    g.restore();
  };

  /* ── 火 / 透镜 / 散景 ─────────────────────────────────── */

  K.flame = function (g, x, y, size, t, opt) {
    opt = opt || {};
    const P = K.pal(opt.mood || 'night');
    const low = opt.low ? 0.62 : 1;
    const f = (0.86 + 0.10 * Math.sin(t * 11.3) + 0.06 * Math.sin(t * 17.7) + 0.05 * Math.sin(t * 26.1)) * low;
    const sway = Math.sin(t * 7.1) * size * 0.05 + Math.sin(t * 13.3) * size * 0.025;
    K.glow(g, x, y - size * 0.2, size * 4.6, P.warm, 0.30 * f);
    g.save();
    g.translate(x + sway, y);
    g.scale(f, f);
    g.fillStyle = K.rgba(P.ember, 0.92);
    g.beginPath();
    g.moveTo(0, -size * 1.65);
    g.bezierCurveTo(size * 0.62, -size * 0.72, size * 0.52, size * 0.26, 0, size * 0.42);
    g.bezierCurveTo(-size * 0.52, size * 0.26, -size * 0.62, -size * 0.72, 0, -size * 1.65);
    g.closePath();
    g.fill();
    g.fillStyle = P.cream;
    g.beginPath();
    g.moveTo(0, -size * 0.96);
    g.bezierCurveTo(size * 0.30, -size * 0.40, size * 0.26, size * 0.08, 0, size * 0.24);
    g.bezierCurveTo(-size * 0.26, size * 0.08, -size * 0.30, -size * 0.40, 0, -size * 0.96);
    g.closePath();
    g.fill();
    g.fillStyle = '#fff9e4';
    g.beginPath();
    g.ellipse(0, -size * 0.16, size * 0.12, size * 0.26, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };

  K.lens = function (g, x, y, r, t, opt) {
    opt = opt || {};
    const P = K.pal(opt.mood || 'night');
    g.save();
    g.translate(x, y);
    /* 玻璃：暖色圆盘，读成一块被照亮的透镜 */
    const gl = g.createRadialGradient(0, 0, r * 0.10, 0, 0, r * 0.90);
    gl.addColorStop(0, K.rgba('#ffeab8', 0.36));
    gl.addColorStop(0.62, K.rgba('#eab060', 0.13));
    gl.addColorStop(1, K.rgba('#2a2117', 0.26));
    g.fillStyle = gl;
    g.beginPath();
    g.arc(0, 0, r * 0.90, 0, Math.PI * 2);
    g.fill();
    /* 黄铜框 */
    g.strokeStyle = '#8d6a3f';
    g.lineWidth = r * 0.09;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = K.rgba('#c49a5c', 0.55);
    g.lineWidth = r * 0.022;
    g.beginPath();
    g.arc(0, 0, r * 0.93, 0, Math.PI * 2);
    g.stroke();
    /* 两道菲涅尔环 + 一根竖向支撑，避免同心圆读成靶心 */
    for (let i = 1; i <= 3; i++) {
      const rr = r * (0.30 + i * 0.19);
      g.globalAlpha = 0.16 + 0.05 * Math.sin(t * 2.1 + i * 0.7);
      g.strokeStyle = i % 2 ? '#d8b174' : P.cream;
      g.lineWidth = r * 0.014;
      g.beginPath();
      g.arc(0, 0, rr, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 0.32;
    g.fillStyle = '#6b4c2c';
    g.fillRect(-r * 0.022, -r * 0.94, r * 0.044, r * 1.88);
    g.restore();
  };

  K.bokeh = function (g, t, seed, opt) {
    opt = opt || {};
    const P = K.pal(opt.mood || 'night');
    const n = opt.n || 16;
    g.save();
    for (let i = 0; i < n; i++) {
      const x = K.rnd(seed + i * 4.1) * W;
      const y = K.rnd(seed + i * 8.7) * H;
      const r = 40 + K.rnd(seed + i * 2.9) * 150;
      const dx = Math.sin(t * (0.18 + K.rnd(seed + i) * 0.24) + i) * 26;
      const dy = Math.cos(t * (0.15 + K.rnd(seed + i * 3) * 0.2) + i * 1.7) * 18;
      const warm = K.rnd(seed + i * 6.3) > 0.45;
      const col = warm ? P.warm : P.sea[1];
      const a = (warm ? 0.10 : 0.13) * (0.6 + K.rnd(seed + i * 7.9) * 0.6);
      const grd = g.createRadialGradient(x + dx, y + dy, r * 0.1, x + dx, y + dy, r);
      grd.addColorStop(0, K.rgba(col, a));
      grd.addColorStop(0.72, K.rgba(col, a * 0.55));
      grd.addColorStop(1, K.rgba(col, 0));
      g.fillStyle = grd;
      g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
    g.restore();
  };

  /* ── 文字 ─────────────────────────────────────────────── */

  K.textWidth = function (str, size, track, weight, family) {
    const cv = K._measure || (K._measure = document.createElement('canvas').getContext('2d'));
    cv.font = (weight || 500) + ' ' + size + 'px ' + (family || FONT);
    const chars = Array.from(String(str));
    let total = 0;
    for (let i = 0; i < chars.length; i++) total += cv.measureText(chars[i]).width + (track || 0);
    return chars.length ? total - (track || 0) : 0;
  };

  K.text = function (g, str, x, y, opt) {
    opt = opt || {};
    const size = opt.size || 36;
    const weight = opt.weight || 500;
    const color = opt.color || ART.cream || '#f3e3c6';
    const track = opt.track || 0;
    const alpha = opt.alpha == null ? 1 : opt.alpha;
    if (alpha <= 0.005) return 0;
    const chars = Array.from(String(str || ''));
    if (!chars.length) return 0;
    g.save();
    g.font = weight + ' ' + size + 'px ' + (opt.family || FONT);
    g.textBaseline = 'alphabetic';
    g.fillStyle = color;
    g.globalAlpha = alpha;
    if (opt.shadow) {
      g.shadowColor = opt.shadow;
      g.shadowBlur = opt.blur == null ? 14 : opt.blur;
      g.shadowOffsetY = opt.dy == null ? 3 : opt.dy;
    }
    let total = 0;
    if (track) {
      const widths = chars.map(function (ch) { return g.measureText(ch).width; });
      for (let i = 0; i < widths.length; i++) total += widths[i] + track;
      total -= track;
    } else {
      total = g.measureText(chars.join('')).width;
    }
    let cx = opt.align === 'center' ? x - total / 2 : opt.align === 'right' ? x - total : x;
    if (track) {
      for (let i = 0; i < chars.length; i++) {
        g.fillText(chars[i], cx, y);
        cx += g.measureText(chars[i]).width + track;
      }
    } else {
      g.textAlign = opt.align || 'left';
      g.fillText(chars.join(''), x, y);
    }
    g.restore();
    return total;
  };

  /* 底部歌词：小字、暖白、轻描边，不做大色块字幕牌 */
  K.lyric = function (g, text, alpha) {
    K.QA.lyric.text = text || '';
    K.QA.lyric.alpha = alpha || 0;
    if (!text || !(alpha > 0.01)) return;
    const grd = g.createLinearGradient(0, H - 230, 0, H);
    grd.addColorStop(0, 'rgba(4,8,15,0)');
    grd.addColorStop(0.62, 'rgba(4,8,15,0.26)');
    grd.addColorStop(1, 'rgba(4,8,15,0.52)');
    g.fillStyle = grd;
    g.fillRect(0, H - 230, W, 230);
    K.text(g, text, W / 2, H - 58, {
      size: 40,
      weight: 500,
      color: '#f8f1e3',
      align: 'center',
      track: 2,
      alpha: alpha,
      shadow: 'rgba(3,7,14,0.92)',
      blur: 16,
      dy: 3
    });
  };

  K.titleCard = function (g, local, slot) {
    const aIn = K.smooth((local - 0.12) / 0.55);
    const aOut = 1 - K.smooth((local - (slot - 0.72)) / 0.48);
    const a = Math.min(aIn, aOut);
    if (a <= 0.01) return;
    const kicker = C.kicker || 'A PAPER STORY';
    K.text(g, kicker, W / 2, 402, {
      size: 20, weight: 600, color: K.rgba('#f3e3c6', 0.78), align: 'center', track: 7,
      alpha: a, shadow: 'rgba(4,8,15,0.85)', blur: 10, dy: 2
    });
    K.text(g, C.title, W / 2, 556, {
      size: 124, weight: 600, color: '#f8edd6', align: 'center', track: 18,
      alpha: a, shadow: 'rgba(4,8,15,0.92)', blur: 26, dy: 4
    });
    g.save();
    g.globalAlpha = a * 0.85;
    g.fillStyle = ART.ember || '#d96a56';
    g.fillRect(W / 2 - 52, 596, 104, 4);
    g.restore();
    if (C.brandSub) {
      K.text(g, C.brandSub.split('/')[0].trim(), W / 2, 654, {
        size: 22, weight: 400, color: K.rgba('#f3e3c6', 0.72), align: 'center', track: 4,
        alpha: a, shadow: 'rgba(4,8,15,0.8)', blur: 8, dy: 2
      });
    }
  };

  K.endCard = function (g, local) {
    const a = K.smooth((local - 0.45) / 0.75);
    if (a <= 0.002) return;
    K.QA.endCard = a > 0.5 ? 1 : 0;
    g.save();
    g.globalAlpha = a * 0.58;
    g.fillStyle = '#050a14';
    g.fillRect(0, 0, W, H);
    g.restore();

    g.save();
    g.globalAlpha = a;
    g.fillStyle = ART.ember || '#d96a56';
    g.fillRect(W / 2 - 44, 366, 88, 4);
    g.restore();

    K.text(g, C.title, W / 2, 488, {
      size: 108, weight: 600, color: '#f8edd6', align: 'center', track: 16, alpha: a,
      shadow: 'rgba(3,7,14,0.9)', blur: 24, dy: 4
    });
    K.text(g, C.slogan, W / 2, 570, {
      size: 34, weight: 400, color: K.rgba('#ffd9a4', 0.95), align: 'center', track: 3, alpha: a,
      shadow: 'rgba(3,7,14,0.9)', blur: 14, dy: 3
    });
    K.text(g, C.brand, W / 2, 740, {
      size: 22, weight: 600, color: K.rgba('#f3e3c6', 0.7), align: 'center', track: 8, alpha: a
    });
    if (C.endTag) {
      K.text(g, C.endTag, W / 2, 786, {
        size: 16, weight: 400, color: K.rgba('#f3e3c6', 0.44), align: 'center', track: 5, alpha: a
      });
    }
  };

  K.cueAt = function (scene, local) {
    const at = (scene.start || 0) + local / ((root && root.FILM_SCALE) || 1);
    const cues = (root && root.FILM_CUES) || [];
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      if (at >= c.authoredStart && at < c.authoredEnd) {
        const a = Math.min(1, (at - c.authoredStart) / 0.18, (c.authoredEnd - at) / 0.22);
        return { text: c.text, alpha: Math.max(0, a) };
      }
    }
    return { text: '', alpha: 0 };
  };

  /* ── 纸张纹理 / 暗角 ──────────────────────────────────── */

  let grainTile = null;
  K.grain = function (g) {
    if (!grainTile) {
      const size = 256;
      const cv = document.createElement('canvas');
      cv.width = size;
      cv.height = size;
      const c = cv.getContext('2d');
      const img = c.createImageData(size, size);
      for (let i = 0; i < size * size; i++) {
        const v = K.rnd(700 + i * 1.37);
        const dark = v < 0.5;
        const a = Math.round((dark ? 16 : 22) * K.rnd(1700 + i * 2.11));
        const p = i * 4;
        img.data[p] = dark ? 0 : 255;
        img.data[p + 1] = dark ? 0 : 250;
        img.data[p + 2] = dark ? 0 : 238;
        img.data[p + 3] = a;
      }
      c.putImageData(img, 0, 0);
      grainTile = cv;
    }
    const pat = g.createPattern(grainTile, 'repeat');
    g.save();
    g.fillStyle = pat;
    g.fillRect(0, 0, W, H);
    g.restore();
  };

  K.vignette = function (g, strength) {
    const a = strength == null ? 0.42 : strength;
    const grd = g.createRadialGradient(W / 2, H * 0.48, H * 0.30, W / 2, H * 0.5, H * 0.86);
    grd.addColorStop(0, 'rgba(3,6,12,0)');
    grd.addColorStop(0.66, 'rgba(3,6,12,' + (a * 0.22).toFixed(3) + ')');
    grd.addColorStop(1, 'rgba(3,6,12,' + a.toFixed(3) + ')');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  };

  K.QA = {
    genre: 'paper-story',
    canvas: true,
    scene: null,
    frame: null,
    who: null,
    endCard: 0,
    lyric: { text: '', alpha: 0 },
    cameraFree: true
  };
  root.PAPER_QA = K.QA;
  root.PAPER_KIT = K;
})(typeof window !== 'undefined' ? window : null);
