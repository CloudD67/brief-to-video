/* 视觉引擎层：版式之外再加一层画面。
   全部用 Canvas 2D 确定性绘制：种子随机 + 时间函数，任意 seek 都得到同一帧。
   引擎由 look 决定，也可用 ?engine= / config.engine 覆盖。 */
(function () {
  'use strict';

  const C = window.FILM_CONFIG || {};
  const LOOK = window.FILM_LOOK_OBJ || null;
  const params = new URLSearchParams(location.search);
  const KNOWN = ['halftone', 'riso', 'bokeh', 'dust', 'aurora', 'flow', 'scan', 'orbit'];
  const requested = String(params.get('engine') || C.engine || (LOOK && LOOK.engine) || 'none').toLowerCase();
  const id = requested === 'auto' ? ((LOOK && LOOK.engine) || 'none') : requested;
  const active = KNOWN.indexOf(id) !== -1;
  const opts = (LOOK && LOOK.engineOpts) || {};
  const stageStyle = document.documentElement.dataset.style || window.FILM_STYLE || 'letterpress';
  const dark = stageStyle === 'cinema' || stageStyle === 'tech';
  const TAU = Math.PI * 2;

  window.FILM_ENGINE = active ? id : 'none';

  if (!active) {
    if (requested !== 'none') console.warn('未知视觉引擎 "' + requested + '"，可用：' + KNOWN.join(' / '));
    document.documentElement.dataset.engine = 'none';
    window.engineSeek = null;
    return;
  }

  const probe = document.createElement('canvas').getContext('2d');
  function toRgb(str, fallback) {
    probe.fillStyle = '#000000';
    try { probe.fillStyle = str || fallback; } catch (e) { probe.fillStyle = fallback; }
    const v = String(probe.fillStyle);
    if (v.charAt(0) === '#') {
      let h = v.slice(1);
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const m = /rgba?\(([^)]+)\)/.exec(v);
    if (m) {
      const p = m[1].split(',').map(function (n) { return Number(n) || 0; });
      return [p[0] | 0, p[1] | 0, p[2] | 0];
    }
    return [128, 128, 128];
  }

  function rgba(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, a)).toFixed(4) + ')';
  }

  /* fillStyle 只认字符串；直接赋 [r,g,b] 数组会静默失效，退回上一个样式。 */
  function solid(c) {
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }

  function rnd(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const css = function (name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };
  /* Canvas 不认 var(--token)：启动时从 :root 解析成 RGB。
     这里的字面量只是样式表缺令牌时的兜底，换主题不需要改它们。 */
  const colors = {
    ink: toRgb(css('--ink', '#222222'), '#222222'),
    accent: toRgb(css('--accent', '#cc3322'), '#cc3322'),
    accent2: toRgb(css('--accent-2', css('--accent', '#cc3322')), '#cc3322'),
    paper: toRgb(css('--paper', '#eee8da'), '#eee8da'),
    paperHi: toRgb(css('--paper-hi', '#ffffff'), '#ffffff')
  };

  const bg = document.querySelector('.bg');
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const stageW = C.width || 1920;
  const stageH = C.height || 1080;
  const scale = Math.min(0.6, 1400 / stageW);
  const W = Math.max(320, Math.round(stageW * scale));
  const H = Math.max(180, Math.round(stageH * scale));
  const S = W / stageW;
  canvas.width = W;
  canvas.height = H;
  canvas.style.mixBlendMode = dark ? 'screen' : 'multiply';
  if (bg) bg.insertBefore(canvas, bg.querySelector('.paper-fiber') || null);
  else document.getElementById('stage').appendChild(canvas);
  const ctx = canvas.getContext('2d');
  document.documentElement.dataset.engine = id;
  document.documentElement.dataset.engineBlend = dark ? 'screen' : 'multiply';

  function reset() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
  }

  /* ---------- 印刷：网点场 ---------- */
  function drawHalftone(t) {
    const ink = colors.ink;
    const accent = colors.accent;
    const a0 = opts.alpha == null ? 0.1 : opts.alpha;
    const step = Math.max(6, (opts.spacing || 18) * S);
    const maxR = step * 0.34;
    const cx = W * (0.34 + 0.05 * Math.sin(t * 0.07));
    const cy = H * (0.42 + 0.04 * Math.cos(t * 0.06));
    const reach = Math.hypot(W, H) * 0.62;

    const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
    wash.addColorStop(0, rgba(ink, 0.05));
    wash.addColorStop(1, rgba(ink, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);

    for (let y = step * 0.5; y < H; y += step) {
      for (let x = step * 0.5; x < W; x += step) {
        const dx = (x - cx) / reach;
        const dy = (y - cy) / reach;
        const d = Math.sqrt(dx * dx + dy * dy);
        const wave = 0.5 + 0.5 * Math.sin(d * 8.8 - t * 0.85 + (x / W) * 2.1);
        let dens = (1 - d * 1.1) * 0.72 + wave * 0.55 - 0.2;
        if (dens <= 0.04) continue;
        dens = Math.min(1, dens);
        ctx.globalAlpha = a0 * (0.3 + 0.7 * dens);
        ctx.fillStyle = solid(ink);
        ctx.beginPath();
        ctx.arc(x, y, maxR * dens, 0, TAU);
        ctx.fill();
        if (dens > 0.62) {
          ctx.globalAlpha = a0 * 0.5 * (dens - 0.62);
          ctx.fillStyle = solid(accent);
          ctx.beginPath();
          ctx.arc(x + step * 0.09, y - step * 0.07, maxR * 0.72 * dens, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 印刷：双色叠印块 ---------- */
  function drawRiso(t) {
    const a0 = opts.alpha == null ? 0.17 : opts.alpha;
    const min = Math.min(W, H);
    const blobs = [
      { x: 0.10, y: 0.88, r: 0.34, c: colors.accent, a: a0 * 0.5, sp: 0.05 },
      { x: 0.90, y: 0.14, r: 0.30, c: colors.accent2, a: a0 * 0.42, sp: 0.04 },
      { x: 0.56, y: 0.97, r: 0.24, c: colors.ink, a: a0 * 0.2, sp: 0.06 }
    ];
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const x = W * (b.x + 0.045 * Math.sin(t * b.sp + i * 1.7));
      const y = H * (b.y + 0.05 * Math.cos(t * b.sp * 0.9 + i));
      const r = min * b.r * (1 + 0.09 * Math.sin(t * 0.16 + i * 2.1));
      const breathe = 0.62 + 0.38 * Math.sin(t * 0.13 + i * 1.3);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(b.c, b.a * breathe));
      g.addColorStop(0.62, rgba(b.c, b.a * breathe * 0.5));
      g.addColorStop(1, rgba(b.c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = a0 * 0.5;
    ctx.fillStyle = solid(colors.accent2);
    for (let i = 0; i < 260; i++) {
      const rng = rnd(0x51A0 + i);
      const x = rng() * W;
      const y = rng() * H;
      ctx.beginPath();
      ctx.arc(x, y, (0.7 + rng() * 1.4) * S, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 柔光：散景 ---------- */
  function drawBokeh(t) {
    const a0 = opts.alpha == null ? 0.09 : opts.alpha;
    const min = Math.min(W, H);
    const accent = colors.accent;
    const wash = ctx.createRadialGradient(W * 0.72, H * 0.18, 0, W * 0.72, H * 0.18, min * 0.95);
    wash.addColorStop(0, rgba(accent, a0 * 0.55));
    wash.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);

    const rng = rnd(0xB0C4);
    for (let i = 0; i < 24; i++) {
      const bx = rng();
      const by = rng();
      const r = min * (0.05 + rng() * 0.16);
      const ph = rng() * TAU;
      const sp = 0.4 + rng() * 0.9;
      const dx = 0.012 + rng() * 0.02;
      const dy = 0.01 + rng() * 0.02;
      const x = W * (bx + Math.sin(t * 0.05 * sp + ph) * dx);
      const y = H * (by + Math.cos(t * 0.04 * sp + ph) * dy);
      const col = dark
        ? (i % 4 === 0 ? colors.paperHi : accent)
        : (i % 6 === 0 ? colors.paperHi : (i % 3 === 0 ? colors.accent2 : accent));
      const a = a0 * (0.3 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.11 * sp + ph)));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.55, rgba(col, a * 0.45));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  }

  /* ---------- 银幕：尘埃与光束 ---------- */
  function drawDust(t) {
    const a0 = opts.alpha == null ? 0.85 : opts.alpha;
    const ink = colors.ink;
    const accent = colors.accent;

    const haze = ctx.createLinearGradient(0, 0, W, H);
    haze.addColorStop(0, rgba(ink, 0.10 * a0));
    haze.addColorStop(0.45, rgba(ink, 0.02 * a0));
    haze.addColorStop(1, rgba(ink, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(W * (0.06 + i * 0.28), -H * 0.05);
      ctx.rotate(-0.26);
      const w = W * 0.17;
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, rgba(ink, 0));
      g.addColorStop(0.5, rgba(ink, 0.05 * a0));
      g.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, H * 1.5);
      ctx.restore();
    }

    const rng = rnd(0xD057);
    for (let i = 0; i < 160; i++) {
      const depth = 0.3 + rng() * 0.7;
      const x0 = rng() * W;
      const y0 = rng() * H;
      const x = x0 + Math.sin(t * 0.12 * depth + i) * W * 0.012 * depth;
      const y = ((y0 - t * 4 * S * depth) % H + H) % H;
      const a = a0 * (0.1 + 0.55 * depth) * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.5 * depth + i * 1.3)));
      ctx.globalAlpha = a;
      ctx.fillStyle = solid(i % 6 === 0 ? accent : ink);
      ctx.beginPath();
      ctx.arc(x, y, (0.5 + rng() * 1.6) * S * (0.6 + depth), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const leak = ctx.createRadialGradient(W * 0.12, H * 0.9, 0, W * 0.12, H * 0.9, Math.min(W, H) * 0.72);
    leak.addColorStop(0, rgba(accent, 0.08 * a0 * (0.7 + 0.3 * Math.sin(t * 0.2))));
    leak.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = leak;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------- 银幕：极光带 ---------- */
  function drawAurora(t) {
    const a0 = opts.alpha == null ? 0.9 : opts.alpha;
    for (let i = 0; i < 5; i++) {
      const x = W * (0.3 + 0.16 * Math.sin(t * 0.04 + i * 1.3));
      const y = H * (0.16 + i * 0.17);
      const r = W * (0.38 + 0.08 * Math.cos(t * 0.03 + i));
      const col = i % 2 ? colors.accent2 : colors.accent;
      const a = a0 * (i === 2 ? 0.12 : 0.065);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.3);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.55, rgba(col, a * 0.4));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    const rng = rnd(0xA0A1);
    ctx.globalAlpha = a0 * 0.06;
    ctx.fillStyle = solid(colors.ink);
    for (let i = 0; i < 26; i++) {
      const x = rng() * W;
      const h = H * (0.2 + rng() * 0.5);
      ctx.fillRect(x, 0, Math.max(1, S), h);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 终端：流场 ---------- */
  function drawFlow(t) {
    const a0 = opts.alpha == null ? 0.9 : opts.alpha;
    const accent = colors.accent;
    const ink = colors.ink;
    const rng = rnd(0xF10A);
    ctx.lineWidth = Math.max(0.5, 1.1 * S);
    for (let i = 0; i < 440; i++) {
      let x = rng() * W;
      let y = rng() * H;
      const ph = rng() * TAU;
      const stepLen = (16 + rng() * 26) * S;
      const life = 0.5 + 0.5 * Math.sin(t * 0.3 + ph);
      ctx.globalAlpha = a0 * (0.05 + 0.1 * life);
      ctx.strokeStyle = solid(i % 7 === 0 ? ink : accent);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        const ang = Math.sin((x / W) * 6 + t * 0.22 + ph) * 1.6 +
          Math.cos((y / H) * 5 - t * 0.16) * 1.2;
        x += Math.cos(ang) * stepLen;
        y += Math.sin(ang) * stepLen;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const rng2 = rnd(0xF10B);
    for (let i = 0; i < 16; i++) {
      const x = rng2() * W;
      const y = rng2() * H;
      const a = a0 * 0.25 * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i)));
      ctx.globalAlpha = a;
      ctx.fillStyle = solid(accent);
      ctx.beginPath();
      ctx.arc(x, y, (1.2 + rng2() * 1.8) * S, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 终端：扫描与遥测 ---------- */
  function drawScan(t) {
    const a0 = opts.alpha == null ? 0.9 : opts.alpha;
    const accent = colors.accent;
    const ink = colors.ink;
    const gy = ((t * 0.06) % 1) * H;
    const band = ctx.createLinearGradient(0, gy - H * 0.13, 0, gy + H * 0.13);
    band.addColorStop(0, rgba(accent, 0));
    band.addColorStop(0.5, rgba(accent, 0.055 * a0));
    band.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = band;
    ctx.fillRect(0, gy - H * 0.13, W, H * 0.26);
    ctx.fillStyle = rgba(accent, 0.3 * a0);
    ctx.fillRect(0, gy, W, Math.max(1, S));

    const rng = rnd(0x5CA7);
    ctx.lineWidth = Math.max(0.5, S);
    for (let i = 0; i < 54; i++) {
      const x = W * (0.58 + rng() * 0.38);
      const y = rng() * H;
      const len = (6 + rng() * 26) * S;
      const a = a0 * (0.06 + 0.1 * rng()) * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.4 + i)));
      ctx.globalAlpha = a;
      ctx.strokeStyle = solid(i % 9 === 0 ? accent : ink);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }

    for (let i = 0; i < 9; i++) {
      const x = W * (0.05 + i * 0.105);
      for (let k = 0; k < 26; k++) {
        const y = H * (0.12 + k * 0.031);
        const a = a0 * 0.05 * (0.5 + 0.5 * Math.sin(t * 0.5 + k * 0.4 + i));
        ctx.globalAlpha = a;
        ctx.fillStyle = solid(k % 7 === 0 ? accent : ink);
        ctx.fillRect(x, y, Math.max(1, 3 * S), Math.max(1, 1.4 * S));
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 瑞士：圆弧与十字标 ---------- */
  function drawOrbit(t) {
    const a0 = opts.alpha == null ? 0.1 : opts.alpha;
    const accent = colors.accent;
    const ink = colors.ink;
    const min = Math.min(W, H);
    const cx = W * 1.02;
    const cy = H * 0.94;
    ctx.lineWidth = Math.max(1, 1.25 * S);
    for (let i = 0; i < 4; i++) {
      const r = min * (0.35 + i * 0.24);
      const dir = i % 2 ? -1 : 1;
      const start = Math.PI * (1.04 + i * 0.01) + t * 0.045 * dir;
      const end = Math.PI * (1.86 - i * 0.02) + t * 0.045 * dir;
      ctx.globalAlpha = a0 * (i === 0 ? 1.5 : 0.85);
      ctx.strokeStyle = solid(i === 0 ? accent : ink);
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.stroke();
    }

    const gapX = W / 16;
    const gapY = H / 9;
    ctx.globalAlpha = a0 * 0.8;
    ctx.strokeStyle = solid(ink);
    for (let i = 1; i < 16; i += 2) {
      for (let j = 1; j < 9; j += 2) {
        const x = gapX * i;
        const y = gapY * j;
        const s = 5 * S;
        ctx.beginPath();
        ctx.moveTo(x - s, y);
        ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s);
        ctx.lineTo(x, y + s);
        ctx.stroke();
      }
    }

    const p = (t * 0.03) % 1;
    ctx.globalAlpha = Math.min(1, a0 * 3);
    ctx.fillStyle = solid(accent);
    ctx.fillRect(W * 0.08 + p * W * 0.84, H * 0.93, Math.max(1.5, 3 * S), 12 * S);
    ctx.globalAlpha = 1;
  }

  const DRAW = {
    halftone: drawHalftone,
    riso: drawRiso,
    bokeh: drawBokeh,
    dust: drawDust,
    aurora: drawAurora,
    flow: drawFlow,
    scan: drawScan,
    orbit: drawOrbit
  };

  let lastT = -1;
  function seek(t) {
    const time = Number(t) || 0;
    if (time === lastT) return;
    lastT = time;
    try {
      reset();
      DRAW[id](time);
    } catch (err) {
      console.error('engine render failed:', id, err);
      window.engineSeek = null;
    }
  }

  window.engineSeek = seek;
  seek(0);
})();
