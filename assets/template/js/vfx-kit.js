/* 2D 确定性 VFX：雨、尘、烟、火、火星、体积光、镜头光晕、暗角、胶片颗粒。
   给 Canvas 场景的 seek(local) 用；不要读 Date.now / Math.random。 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = n => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  };
  const rng = seed => {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function rain(ctx, t, w, h, opts) {
    const o = Object.assign({ count: 240, angle: 0.18, speed: 900, color: '190,215,240', alpha: 0.42, width: 1.1, splash: true }, opts || {});
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < o.count; i++) {
      const depth = 0.35 + hash(i + 3) * 0.65;
      const x0 = hash(i + 11) * w * 1.2 - w * 0.1;
      const y0 = (hash(i + 17) * h + t * o.speed * depth) % (h + 90);
      const len = (8 + hash(i + 23) * 26) * depth;
      const x = x0 + Math.sin(o.angle) * y0;
      ctx.strokeStyle = 'rgba(' + o.color + ',' + (o.alpha * depth).toFixed(3) + ')';
      ctx.lineWidth = o.width * depth;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x - Math.sin(o.angle) * len, y0 + Math.cos(o.angle) * len);
      ctx.stroke();
    }
    if (o.splash) {
      for (let i = 0; i < o.count / 10; i++) {
        const x = hash(i + 71) * w;
        const phase = (t * 1.4 + hash(i + 73)) % 1;
        const r = 1 + phase * 9;
        ctx.strokeStyle = 'rgba(' + o.color + ',' + ((1 - phase) * 0.22).toFixed(3) + ')';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(x, h * (0.74 + hash(i + 79) * 0.22), r, r * 0.24, 0, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function dust(ctx, t, w, h, opts) {
    const o = Object.assign({ count: 70, color: '255,226,184', alpha: 0.35, size: 1.6, rise: 18 }, opts || {});
    ctx.save();
    for (let i = 0; i < o.count; i++) {
      const x = (hash(i + 2) * w + Math.sin(t * 0.25 + i) * 24) % w;
      const y = h - ((hash(i + 5) * h + t * o.rise * (0.4 + hash(i + 7))) % h);
      const a = o.alpha * (0.3 + hash(i + 9) * 0.7);
      ctx.fillStyle = 'rgba(' + o.color + ',' + a.toFixed(3) + ')';
      const s = o.size * (0.5 + hash(i + 13));
      ctx.beginPath();
      ctx.arc(x, y, s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function embers(ctx, t, w, h, opts) {
    const o = Object.assign({ count: 46, color: '255,138,60', alpha: 0.8, size: 2.2, rise: 90, originY: 0.78 }, opts || {});
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ox = w * 0.5;
    const oy = h * o.originY;
    for (let i = 0; i < o.count; i++) {
      const life = (t * (0.22 + hash(i + 3) * 0.24) + hash(i + 5)) % 1;
      const x = ox + (hash(i + 7) - 0.5) * w * 0.45 + Math.sin(t * 2.1 + i) * 16 * life;
      const y = oy - life * h * 0.55;
      const a = o.alpha * (1 - life) * Math.min(1, life * 8);
      const s = o.size * (0.4 + hash(i + 11) * 0.9) * (1 - life * 0.4);
      const g = ctx.createRadialGradient(x, y, 0, x, y, s * 4);
      g.addColorStop(0, 'rgba(255,230,180,' + a.toFixed(3) + ')');
      g.addColorStop(0.35, 'rgba(' + o.color + ',' + (a * 0.8).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + o.color + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, s * 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function smoke(ctx, t, w, h, opts) {
    const o = Object.assign({ count: 18, color: '196,206,218', alpha: 0.12, origin: [0.5, 0.72], spread: 0.22, height: 0.45, size: 0.18 }, opts || {});
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < o.count; i++) {
      const life = (t * (0.08 + hash(i + 3) * 0.06) + hash(i + 5)) % 1;
      const x = (o.origin[0] + (hash(i + 7) - 0.5) * o.spread * 2) * w + Math.sin(t * 0.4 + i) * 28 * life;
      const y = (o.origin[1] - life * o.height) * h;
      const r = o.size * w * (0.5 + life * 1.5);
      const a = o.alpha * Math.sin(life * Math.PI);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + o.color + ',' + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + o.color + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function fire(ctx, t, w, h, opts) {
    const o = Object.assign({ origin: [0.5, 0.82], width: 0.26, height: 0.42, alpha: 0.8 }, opts || {});
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ox = w * o.origin[0];
    const oy = h * o.origin[1];
    for (let i = 0; i < 16; i++) {
      const life = (t * (0.7 + hash(i + 3) * 0.8) + hash(i + 5)) % 1;
      const x = ox + (hash(i + 7) - 0.5) * w * o.width * (0.4 + life);
      const y = oy - life * h * o.height;
      const r = w * o.width * 0.22 * (1 - life * 0.6) * (0.6 + hash(i + 11) * 0.8);
      const a = o.alpha * (1 - life) * Math.min(1, life * 6);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,236,180,' + a.toFixed(3) + ')');
      g.addColorStop(0.3, 'rgba(255,150,50,' + (a * 0.8).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function lightShaft(ctx, x, y, w, h, opts) {
    const o = Object.assign({ color: '255,214,160', alpha: 0.22, spread: 0.5, angle: -0.25 }, opts || {});
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.rotate(o.angle);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(' + o.color + ',' + o.alpha.toFixed(3) + ')');
    g.addColorStop(0.6, 'rgba(' + o.color + ',' + (o.alpha * 0.35).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + o.color + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w * 0.08, 0);
    ctx.lineTo(w * 0.08, 0);
    ctx.lineTo(w * o.spread, h);
    ctx.lineTo(-w * o.spread, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function flare(ctx, x, y, opts) {
    const o = Object.assign({ color: '255,196,140', alpha: 0.55, size: 90, streak: 2.6 }, opts || {});
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, o.size);
    g.addColorStop(0, 'rgba(' + o.color + ',' + o.alpha.toFixed(3) + ')');
    g.addColorStop(0.25, 'rgba(' + o.color + ',' + (o.alpha * 0.5).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + o.color + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, o.size, 0, TAU);
    ctx.fill();
    const lg = ctx.createLinearGradient(x - o.size * o.streak, y, x + o.size * o.streak, y);
    lg.addColorStop(0, 'rgba(' + o.color + ',0)');
    lg.addColorStop(0.5, 'rgba(' + o.color + ',' + (o.alpha * 0.5).toFixed(3) + ')');
    lg.addColorStop(1, 'rgba(' + o.color + ',0)');
    ctx.fillStyle = lg;
    ctx.fillRect(x - o.size * o.streak, y - 2, o.size * o.streak * 2, 4);
    ctx.restore();
  }

  function vignette(ctx, w, h, opts) {
    const o = Object.assign({ strength: 0.5, color: '0,0,0', start: 0.45, end: 1.05 }, opts || {});
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * o.start, w / 2, h / 2, Math.max(w, h) * o.end);
    g.addColorStop(0, 'rgba(' + o.color + ',0)');
    g.addColorStop(1, 'rgba(' + o.color + ',' + o.strength.toFixed(3) + ')');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  let grainTile = null;
  function grain(ctx, t, w, h, amount) {
    if (!grainTile) {
      grainTile = document.createElement('canvas');
      grainTile.width = grainTile.height = 192;
      const g = grainTile.getContext('2d');
      const img = g.createImageData(192, 192);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.round(hash(i * 0.37) * 255);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    const pat = ctx.createPattern(grainTile, 'repeat');
    const ox = Math.floor(hash(Math.floor(t * 24) + 1) * 192);
    const oy = Math.floor(hash(Math.floor(t * 24) + 2) * 192);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = clamp(amount == null ? 0.06 : amount, 0, 1);
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w + 192, h + 192);
    ctx.restore();
  }

  window.VFX = {
    rng,
    hash,
    rain,
    dust,
    embers,
    smoke,
    fire,
    lightShaft,
    flare,
    vignette,
    grain
  };
})();
