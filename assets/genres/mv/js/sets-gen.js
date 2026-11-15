/* 场景库 G：按镜生成的城市地点。
   每个镜头从 v 派生一套独立的地点参数（配色、朝向、结构、天气、物件），
   同一个原型也不会画出两张一样的画面。 */
(function (root) {
  'use strict';
  const K = root.PIXEL_KIT;
  const P = root.PIXEL_PAINT;
  const A = root.PIXEL_ACTORS;
  const S = root.PIXEL_SETS = root.PIXEL_SETS || {};
  const LIGHTS = {};

  function world(key, w, h, paint) {
    return K.cachedWorld(key, () => {
      const cv = K.make(w, h);
      paint(cv.getContext('2d'), cv);
      /* 首帧读回前先同步一次，保证世界层像素与随后复渲完全一致 */
      cv.getContext('2d').getImageData(0, 0, 1, 1);
      return cv;
    });
  }

  /* 六种夜色 + 黎明：每镜挑一种，整幅画的冷暖都跟着换 */
  const PAL = [
    { sky: [{ p: 0, c: '#060a18' }, { p: 0.55, c: '#101a38' }, { p: 1, c: '#26305a' }], blds: ['#0d1428', '#101a30', '#0b1222'], wall: '#141022', ground: '#1a1420', accent: '#8fd8d2', warm: '#f2c05e', fog: '#93a4c6' },
    { sky: [{ p: 0, c: '#04141a' }, { p: 0.55, c: '#0c2830' }, { p: 1, c: '#1c3e44' }], blds: ['#0a1c22', '#0e242a', '#081a20'], wall: '#0e1a1e', ground: '#101a1c', accent: '#7fe0c8', warm: '#e8c07a', fog: '#8fb4b0' },
    { sky: [{ p: 0, c: '#120818' }, { p: 0.55, c: '#2a1030' }, { p: 1, c: '#441e48' }], blds: ['#1a0e22', '#22142c', '#160c1e'], wall: '#1a101e', ground: '#180f18', accent: '#e87ab0', warm: '#ffd28a', fog: '#b48fb4' },
    { sky: [{ p: 0, c: '#100c0a' }, { p: 0.55, c: '#241a12' }, { p: 1, c: '#3e2c1a' }], blds: ['#1a1410', '#221a12', '#160f0c'], wall: '#1a120e', ground: '#181008', accent: '#f0b060', warm: '#ffd28a', fog: '#c0a488' },
    { sky: [{ p: 0, c: '#0c1016' }, { p: 0.55, c: '#1a2128' }, { p: 1, c: '#2e3740' }], blds: ['#141a20', '#1a222a', '#10161c'], wall: '#141a1e', ground: '#161a1c', accent: '#a8c4d8', warm: '#e8d0a0', fog: '#a8b8c4' },
    { sky: [{ p: 0, c: '#080818' }, { p: 0.55, c: '#181234' }, { p: 1, c: '#302650' }], blds: ['#100e24', '#161230', '#0c0a1e'], wall: '#120e22', ground: '#141020', accent: '#a89ae8', warm: '#f2c05e', fog: '#9a92c0' },
    { sky: [{ p: 0, c: '#101a3a' }, { p: 0.42, c: '#2a2c50' }, { p: 0.74, c: '#6a4460' }, { p: 1, c: '#c97a4e' }], blds: ['#141828', '#181c2e', '#121624'], wall: '#1a1828', ground: '#242030', accent: '#ffb46a', warm: '#ffd28a', fog: '#c9a890' }
  ];

  function qFor(shot) {
    const v = shot.v || 1;
    const p = shot.dawn ? 6 : K.vi(v, 1, 0, 5);
    return {
      v: v,
      p: p,
      pal: PAL[p],
      rain: shot.rain != null ? shot.rain : K.vi(v, 2, 0, 2),
      fog: K.vi(v, 3, 0, 2),
      dir: K.vi(v, 4, 0, 1),
      mode: shot.sm != null ? shot.sm : K.vi(v, 5, 0, 2),
      seed: K.vi(v, 6, 0, 900),
      a: K.vi(v, 7, 0, 1000),
      b: K.vi(v, 8, 0, 1000),
      c: K.vi(v, 9, 0, 1000)
    };
  }

  function buildings(g, q, baseY, opt) {
    return P.buildings(g, Object.assign({
      x0: -12, x1: 972, baseY: baseY,
      count: 18, wMin: 22, wMax: 56, hMin: 30, hMax: 98,
      seed: q.seed, shades: q.pal.blds,
      windows: true, litAt: 0.6, antenna: q.mode === 0
    }, opt || {}));
  }

  function carShape(g, x, y, col, flip) {
    K.rect(g, x, y, 15, 5, col);
    K.rect(g, x + (flip ? 1 : 3), y - 3, 9, 3, col);
    K.rect(g, x + (flip ? 10 : 12), y + 1, 2, 2, '#ffe9a8');
    g.save();
    g.globalAlpha = 0.18;
    K.rect(g, x - (flip ? 0 : 18), y + 1, 18, 2, '#ffe9a8');
    g.restore();
  }

  function pedShape(g, x, y, t, ph, col) {
    const step = Math.sin(t * 7.2 + ph) > 0 ? 1 : 0;
    g.save();
    g.globalAlpha = 0.82;
    K.rect(g, x, y, 5, 9, col || '#171c30');
    K.rect(g, x + 1, y - 6, 3, 6, col || '#1e2438');
    K.rect(g, x + (step ? 0 : 1), y + 9, 2, 4, col || '#12162a');
    K.rect(g, x + 3 - (step ? 0 : 1), y + 9, 2, 4, col || '#12162a');
    g.restore();
    g.save();
    g.globalAlpha = 0.16;
    K.rect(g, x - 2, y + 13, 9, 2, '#8a96bc');
    g.restore();
  }

  function lampPost(g, x, baseY, h, q, t) {
    const fl = 0.72 + 0.14 * Math.sin((t || 0) * 4.3 + x);
    K.rect(g, x, baseY - h, 2, h, '#232a45');
    K.rect(g, x - 3, baseY - h, 8, 3, '#2e3757');
    K.rect(g, x - 2, baseY - h - 3, 6, 3, q.pal.warm);
    P.glow(g, x + 1, baseY - h - 1, 26, q.pal.warm, fl * 0.22);
    return fl;
  }

  function wetFloor(g, y, w, q, seed) {
    K.grad(g, 0, y, w, 270 - y, [{ p: 0, c: K.shade(q.pal.ground, 6) }, { p: 1, c: K.shade(q.pal.ground, -26) }]);
    for (let i = 0; i < 14; i++) {
      const rx = K.rnd(seed + i * 3.1) * w;
      g.save();
      g.globalAlpha = 0.08 + 0.08 * K.rnd(seed + i * 5.7);
      K.rect(g, rx, y + 6 + K.rnd(seed + i * 2.3) * (270 - y - 12), 20 + K.rnd(seed + i * 7.1) * 60, 1, q.pal.accent);
      g.restore();
    }
  }

  function atmo(g, t, q, cam) {
    if (q.rain) {
      P.rainStreaks(g, t, {
        x: cam.x, y: 0, w: cam.w, h: 270,
        count: 40 + q.rain * 28, seed: q.seed, alpha: 0.16 + q.rain * 0.07, speed: 250 + q.rain * 50
      });
    }
    if (q.fog) {
      g.save();
      g.globalAlpha = 0.07 + 0.03 * Math.sin(t * 0.5 + q.v);
      K.rect(g, cam.x, 0, cam.w, 270, q.pal.fog);
      g.restore();
    }
  }

  function actor(g, t, shot) {
    const w = shot.who;
    if (!w) return;
    if (w.k === 'girl') A.girl(g, w.x, w.y, t, w);
    else if (w.k === 'boy') A.boy(g, w.x, w.y, t, w);
    if (w.umbrella) A.umbrella(g, w.x + 2, w.y - 26, t, '#2a3450');
  }

  /* 每个原型的“地面线”和室内外属性，前景陈设与光池按它落位 */
  const GY = {
    crossing: 208, underpass: 216, subway: 162, market: 198, laundry: 228,
    bookstore: 210, pier: 206, balcony: 220, factory: 218, shard: 204,
    overpass: 202, phone: 192, school: 212, garden: 204, cinema: 210,
    busstop: 210, parking: 210, arcade: 228, playground: 206, chapel: 202,
    rooftop: 192
  };
  const OUTDOOR = {
    underpass: false, subway: false, market: false, laundry: false,
    bookstore: false, balcony: false, shard: false, phone: false,
    cinema: false, parking: false, arcade: false
  };

  /* 地面光池：灯下的倒影，给下半幅画面一个落点 */
  function lightPool(g, x, y, r, col, a) {
    P.glow(g, x, y, r, col, a);
    g.save();
    g.globalAlpha = Math.min(1, a * 1.5);
    for (let i = 2; i < r * 0.5; i += 2) {
      const w = Math.round(r * 0.62 * Math.sqrt(Math.max(0, 1 - (i / (r * 0.5)) * (i / (r * 0.5)))));
      K.rect(g, x - w, y + i, w * 2, 1, col);
    }
    g.restore();
  }

  const PROPS = {
    rail(g, x, y, w, q, out) {
      const col = K.shade(q.pal.wall, out ? 26 : 14);
      K.rect(g, x, y - 20, w, 3, col);
      K.rect(g, x, y - 17, w, 1, K.shade(col, -38));
      for (let i = 0; i <= w; i += 24) {
        K.rect(g, x + i, y - 20, 2, 20, col);
        K.rect(g, x + i, y - 20, 1, 20, K.shade(col, 16));
      }
    },
    bollard(g, x, y, w, q) {
      const col = K.shade(q.pal.wall, 18);
      for (let i = 0; i < 3; i++) {
        const bx = x + i * 34;
        K.rect(g, bx, y - 16, 7, 16, col);
        K.rect(g, bx, y - 16, 7, 2, K.shade(col, 34));
        K.rect(g, bx + 2, y - 21, 3, 5, K.shade(col, -20));
      }
    },
    bench(g, x, y, w, q) {
      const col = K.shade(q.pal.wall, 22);
      K.rect(g, x, y - 10, 40, 3, col);
      K.rect(g, x, y - 18, 40, 3, col);
      K.rect(g, x, y - 15, 2, 5, K.shade(col, -24));
      K.rect(g, x + 38, y - 15, 2, 5, K.shade(col, -24));
      K.rect(g, x + 3, y - 7, 2, 7, K.shade(col, -30));
      K.rect(g, x + 35, y - 7, 2, 7, K.shade(col, -30));
    },
    planter(g, x, y, w, q) {
      const col = K.shade(q.pal.wall, 12);
      K.rect(g, x, y - 13, 28, 13, col);
      K.rect(g, x, y - 14, 28, 2, K.shade(col, 26));
      for (let i = 0; i < 9; i++) {
        const bx = Math.round(x + 3 + K.rnd(q.seed + i * 3.3) * 21);
        const bh = 4 + Math.round(K.rnd(q.seed + i * 5.1) * 9);
        K.rect(g, bx, y - 14 - bh, 2, bh, i % 3 ? '#173a2a' : '#24503a');
        K.rect(g, bx, y - 14 - bh, 1, 1, '#2e6444');
      }
    },
    bin(g, x, y, w, q) {
      const col = K.shade(q.pal.wall, 16);
      K.rect(g, x, y - 20, 16, 20, col);
      K.rect(g, x - 1, y - 22, 18, 3, K.shade(col, 30));
      K.rect(g, x + 2, y - 26, 12, 4, K.shade(col, 10));
      K.rect(g, x + 2, y - 13, 12, 1, K.shade(col, -26));
    },
    crates(g, x, y, w, q) {
      const col = K.shade(q.pal.wall, 20);
      K.rect(g, x, y - 11, 20, 11, col);
      K.rect(g, x, y - 11, 20, 1, K.shade(col, 28));
      K.rect(g, x + 6, y - 22, 18, 11, K.shade(col, -8));
      K.rect(g, x + 6, y - 22, 18, 1, K.shade(col, 20));
      K.rect(g, x + 10, y - 17, 10, 1, K.shade(col, 6));
    },
    puddle(g, x, y, w, q) {
      const col = K.shade(q.pal.fog, 24);
      for (let i = 0; i < 4; i++) {
        const px = Math.round(x + K.rnd(q.seed + i * 4.1) * (w - 60));
        const pw = 26 + Math.round(K.rnd(q.seed + i * 6.3) * 34);
        g.save();
        g.globalAlpha = 0.16;
        K.rect(g, px, y + 2 + i, pw, 2, col);
        g.globalAlpha = 0.1;
        K.rect(g, px + 4, y + 5 + i, pw - 10, 1, q.pal.warm);
        g.restore();
      }
    },
    cone(g, x, y, w, q) {
      for (let i = 0; i < 2; i++) {
        const cx = x + i * 30;
        K.rect(g, cx, y - 9, 8, 9, '#b04a2a');
        K.rect(g, cx + 1, y - 13, 6, 4, '#c95a34');
        K.rect(g, cx + 2, y - 7, 4, 1, '#e8d8c0');
      }
    },
    bike(g, x, y, w, q) {
      const col = K.shade(q.pal.wall, 14);
      K.ring(g, x + 6, y - 6, 5, col);
      K.ring(g, x + 22, y - 6, 5, col);
      K.line(g, x + 6, y - 6, x + 14, y - 15, col, 1);
      K.line(g, x + 14, y - 15, x + 22, y - 6, col, 1);
      K.rect(g, x + 11, y - 19, 8, 1, col);
    },
    vending(g, x, y, w, q) {
      const col = K.shade(q.pal.wall, 10);
      K.rect(g, x, y - 34, 22, 34, col);
      K.rect(g, x + 2, y - 31, 18, 22, K.shade(q.pal.sky[1].c, 10));
      for (let i = 0; i < 3; i++) {
        for (let k = 0; k < 4; k++) {
          if (K.rnd(q.seed + i * 7.1 + k * 2.3) > 0.55) continue;
          K.rect(g, x + 4 + k * 4, y - 29 + i * 6, 3, 4, K.rnd(i + k) > 0.5 ? q.pal.warm : q.pal.accent);
        }
      }
      K.rect(g, x + 3, y - 6, 16, 3, K.shade(col, -30));
      P.glow(g, x + 11, y - 20, 28, q.pal.accent, 0.12);
    }
  };

  const POOL_OUT = ['rail', 'bench', 'planter', 'bin', 'puddle', 'bollard', 'bike', 'cone'];
  const POOL_IN = ['bench', 'crates', 'vending', 'bin', 'cone', 'puddle'];

  /* 地面：室外是湿沥青（碎石、路缘、灯色竖倒影），室内是地砖与反光 */
  function groundDetail(g, y, q, out) {
    if (out) {
      K.rect(g, 0, y, 960, 1, K.shade(q.pal.ground, 26));
      K.rect(g, 0, y + 1, 960, 2, K.shade(q.pal.ground, -34));
      for (let i = 0; i < 80; i++) {
        const x = Math.round(K.rnd(q.seed + i * 1.7) * 960);
        const yy = Math.round(y + 4 + K.rnd(q.seed + i * 2.9) * (266 - y));
        g.save();
        g.globalAlpha = 0.08 + 0.12 * K.rnd(q.seed + i * 4.1);
        K.rect(g, x, yy, K.rnd(q.seed + i * 5.3) > 0.7 ? 3 : 2, 1, i % 5 ? '#262838' : q.pal.accent);
        g.restore();
      }
      for (let i = 0; i < 8; i++) {
        const x = Math.round(20 + K.rnd(q.seed + i * 7.7) * 900);
        const len = 14 + Math.round(K.rnd(q.seed + i * 3.9) * 30);
        const col = i % 3 === 0 ? q.pal.accent : q.pal.warm;
        for (let k = 0; k < len; k += 2) {
          g.save();
          g.globalAlpha = 0.11 * (1 - k / len);
          K.rect(g, Math.round(x + Math.sin(k * 0.5 + i) * 2), y + 5 + k, 5 + Math.round(K.rnd(q.seed + k * 1.3 + i) * 6), 1, col);
          g.restore();
        }
      }
    } else {
      for (let i = 1; i < 9; i++) K.rect(g, 0, y + i * 7, 960, 1, K.shade(q.pal.ground, -16));
      for (let i = 0; i < 12; i++) {
        const x = Math.round(K.rnd(q.seed + i * 3.1) * 940);
        g.save();
        g.globalAlpha = 0.07 + 0.05 * K.rnd(q.seed + i * 6.1);
        K.rect(g, x, y + 4 + Math.round(K.rnd(q.seed + i * 5.7) * 48), 24 + Math.round(K.rnd(q.seed + i * 2.3) * 46), 1, q.pal.accent);
        g.restore();
      }
    }
  }

  /* 前景陈设：位置、种类与数量都由 v 派生，同一原型也不会重样 */
  function dress(g, q, gy, out) {
    const y = gy || 208;
    groundDetail(g, y, q, out);
    P.glow(g, 480, y - 4, 300, q.pal.fog, 0.05);
    const pool = out ? POOL_OUT : POOL_IN;
    const n = 3 + (q.v % 2);
    for (let i = 0; i < n; i++) {
      const key = pool[K.vi(q.v, 40 + i, 0, pool.length - 1)];
      const x = Math.round(40 + K.rnd(q.seed + i * 11.7) * 780);
      PROPS[key](g, x, y + (i % 2), 90 + Math.round(K.rnd(q.seed + i * 3.1) * 80), q, out);
    }
    /* 两处地面光池，压住下半幅 */
    for (let i = 0; i < 2; i++) {
      const lx = 160 + Math.round(K.rnd(q.seed + i * 17.3) * 640);
      const col = i % 2 ? q.pal.warm : q.pal.accent;
      lightPool(g, lx, y + 2, 34 + Math.round(K.rnd(q.seed + i * 5.9) * 22), col, 0.07 + 0.03 * (q.v % 3));
    }
  }

  /* ---------------- 原型 ---------------- */

  const GEN = {};

  /* 斑马线：一条横街 + 六个方向的路口 */
  GEN.crossing = {
    base(g, q) {
      P.sky(g, 960, 200, q.pal.sky);
      P.stars(g, 960, 110, 0, 14 + (q.a % 30), q.seed);
      buildings(g, q, 176, { count: 14, hMin: 34, hMax: 88 });
      /* 街角两侧的楼 */
      K.rect(g, 0, 96, 150 + q.a % 80, 108, K.shade(q.pal.wall, 4));
      K.rect(g, 960 - (170 + q.b % 90), 88, 170 + q.b % 90, 116, K.shade(q.pal.wall, -4));
      for (let i = 0; i < 8; i++) {
        const sy = 106 + i * 14;
        K.rect(g, 12, sy, 110, 8, i % 3 ? '#0c1020' : q.pal.warm);
      }
      K.rect(g, 0, 204, 960, 66, q.pal.ground);
      /* 斑马线：位置每镜不同 */
      const zx = 260 + q.c % 380;
      for (let i = 0; i < 8; i++) K.rect(g, zx + i * 26, 210, 14, 58, K.shade(q.pal.ground, 18));
      /* 停止线 */
      K.rect(g, zx - 26, 210, 5, 58, K.shade(q.pal.ground, 26));
      wetFloor(g, 204, 960, q, q.seed);
      /* 两盏路灯 + 信号灯 */
      lampPost(g, 150 + q.a % 120, 208, 104, q);
      const tx = zx + 226;
      K.rect(g, tx, 118, 4, 92, '#232a45');
      K.rect(g, tx - 6, 108, 16, 32, '#12141c');
      K.rect(g, tx - 2, 112, 8, 6, '#5a2a2a');
      K.rect(g, tx - 2, 120, 8, 6, '#5a4a2a');
      K.rect(g, tx - 2, 128, 8, 6, '#2a4a3a');
      /* 路边的消防栓 / 垃圾桶 */
      K.rect(g, 60, 194, 8, 12, '#8a2a22');
      K.rect(g, 58, 198, 12, 3, '#c9402e');
      K.rect(g, 820, 186, 16, 20, '#2a3038');
      K.rect(g, 818, 184, 20, 3, '#3a4450');
    },
    live(g, t, q, shot, cam) {
      const zx = 260 + q.c % 380;
      const phase = (Math.floor(t / 2.4) + q.mode) % 3;
      K.rect(g, zx + 224, 112, 8, 6, phase === 0 ? '#e8404a' : '#5a2a2a');
      K.rect(g, zx + 224, 120, 8, 6, phase === 1 ? '#e8c04a' : '#5a4a2a');
      K.rect(g, zx + 224, 128, 8, 6, phase === 2 ? '#4ae08a' : '#2a4a3a');
      P.glow(g, zx + 228, 115, 22, phase === 0 ? '#e8404a' : '#4ae08a', 0.24);
      carShape(g, ((t * 120 + q.a) % 1200) - 120, 226, '#1a2138', false);
      carShape(g, 1080 - ((t * 90 + q.b) % 1200), 246, '#22284a', true);
      pedShape(g, ((t * 14 + q.c) % 160) - 20, 214, t, q.v, '#1a2038');
      pedShape(g, 980 - ((t * 11 + q.b) % 160), 220, t, q.v + 2, '#20263c');
      for (let i = 0; i < 7; i++) {
        const rr = (t * 6 + i * 5) % 18;
        g.save();
        g.globalAlpha = 0.22 * (1 - rr / 18);
        K.ring(g, zx + 20 + K.rnd(q.seed + i * 3.3) * 180, 232 + K.rnd(q.seed + i * 5.1) * 30, Math.max(1, Math.round(rr * 0.5)), '#9fb6d8');
        g.restore();
      }
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 地下通道：混凝土顶、荧光灯、贴砖墙 */
  GEN.underpass = {
    base(g, q) {
      K.grad(g, 0, 0, 960, 270, [{ p: 0, c: K.shade(q.pal.wall, -10) }, { p: 1, c: K.shade(q.pal.ground, -8) }]);
      /* 顶板与梁 */
      K.rect(g, 0, 0, 960, 74, K.shade(q.pal.wall, 10));
      for (let i = 0; i < 10; i++) K.rect(g, i * 100 + 10, 0, 14, 76, K.shade(q.pal.wall, -6));
      K.rect(g, 0, 72, 960, 4, K.shade(q.pal.wall, 18));
      /* 两壁瓷砖 */
      for (let y = 78; y < 214; y += 12) {
        for (let x = 0; x < 960; x += 24) {
          K.rect(g, x, y, 23, 11, K.rnd(x * 0.3 + y * 0.7 + q.seed) > 0.84 ? K.shade(q.pal.wall, 16) : K.shade(q.pal.wall, 4));
        }
      }
      /* 墙面涂鸦：每镜一组不同的色块 */
      for (let i = 0; i < 7; i++) {
        const gx = 100 + K.rnd(q.seed + i * 7.7) * 760;
        const gy = 120 + K.rnd(q.seed + i * 3.1) * 60;
        K.rect(g, gx, gy, 18 + K.rnd(q.seed + i * 5.3) * 40, 7 + K.rnd(q.seed + i * 2.9) * 10, i % 2 ? q.pal.accent : q.pal.warm);
      }
      /* 荧光灯 */
      for (let i = 0; i < 6; i++) {
        const lx = 40 + i * 156;
        K.rect(g, lx, 34, 92, 4, '#e8f0ff');
        K.rect(g, lx + 10, 30, 72, 2, '#a8b4c4');
      }
      /* 路面 */
      K.rect(g, 0, 214, 960, 56, K.shade(q.pal.ground, -4));
      K.rect(g, 0, 214, 960, 1, K.shade(q.pal.ground, 22));
      /* 排水沟 */
      K.rect(g, 0, 250, 960, 2, '#0a0e14');
      wetFloor(g, 216, 960, q, q.seed + 5);
      /* 管道 */
      for (let i = 0; i < 2; i++) {
        K.rect(g, 0, 78 + i * 10, 960, 4, K.shade(q.pal.wall, -12));
        for (let x = 40; x < 960; x += 120) K.rect(g, x, 76 + i * 10, 5, 8, K.shade(q.pal.wall, -20));
      }
    },
    live(g, t, q, shot, cam) {
      for (let i = 0; i < 6; i++) {
        const lx = 40 + i * 156;
        const on = Math.sin(t * 3.3 + i * 1.9 + q.v) > -0.82;
        g.save();
        g.globalAlpha = on ? 0.12 + 0.05 * Math.sin(t * 4.1 + i) : 0.02;
        K.rect(g, lx, 6, 92, 34, '#e8f0ff');
        g.restore();
        P.glow(g, lx + 46, 36, 34, '#dce8ff', on ? 0.10 : 0.02);
      }
      /* 车灯从一侧扫来 */
      const cx = ((t * 150 + q.a) % 1200) - 120;
      carShape(g, cx, 222, '#141a28', false);
      P.glow(g, cx + 16, 224, 46, '#ffe9a8', 0.16);
      /* 滴水与涟漪 */
      for (let i = 0; i < 5; i++) {
        const dx = 80 + K.rnd(q.seed + i * 4.3) * 800;
        const dy = 220 + ((t * 26 + i * 30) % 44);
        K.rect(g, dx, dy, 1, 3, '#8fb4c8');
        const rr = (t * 5 + i * 4) % 12;
        g.save();
        g.globalAlpha = 0.2 * (1 - rr / 12);
        K.ring(g, dx, 252, Math.max(1, Math.round(rr * 0.4)), '#8fb4c8');
        g.restore();
      }
      pedShape(g, 880 - ((t * 12 + q.b) % 200), 208, t, q.v, '#141a2a');
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 地铁入口：向下走的台阶与地下的光 */
  GEN.subway = {
    base(g, q) {
      P.sky(g, 960, 160, q.pal.sky);
      P.stars(g, 960, 90, 0, 10 + (q.a % 20), q.seed);
      buildings(g, q, 156, { count: 12, hMax: 74 });
      K.rect(g, 0, 158, 960, 112, q.pal.ground);
      /* 入口井：黑洞 + 阶梯 */
      const ex = 250 + q.c % 260;
      K.rect(g, ex, 174, 300, 96, '#070a10');
      K.rect(g, ex - 6, 168, 312, 8, K.shade(q.pal.wall, 12));
      for (let i = 0; i < 9; i++) {
        const sy = 186 + i * 9;
        K.rect(g, ex + 12 + i * 4, sy, 276 - i * 8, 4, i % 2 ? '#1a2028' : '#141a22');
        K.rect(g, ex + 12 + i * 4, sy, 276 - i * 8, 1, '#2a3440');
      }
      /* 地下的光 */
      P.glow(g, ex + 150, 268, 120, q.pal.accent, 0.20);
      /* 栏杆 */
      for (let i = 0; i < 10; i++) {
        K.rect(g, ex - 2, 172 + i * 2, 2, 22, '#3a4454');
        K.rect(g, ex + 300, 172 + i * 2, 2, 22, '#3a4454');
      }
      K.rect(g, ex - 2, 170, 306, 3, '#4a5668');
      /* 站牌 */
      K.rect(g, ex + 96, 112, 110, 40, '#101a30');
      K.frame(g, ex + 96, 112, 110, 40, '#3a4a68');
      for (let i = 0; i < 4; i++) K.rect(g, ex + 106 + i * 24, 122, 16, 18, '#c9d8f0');
      K.rect(g, ex + 148, 152, 3, 24, '#2a3444');
      wetFloor(g, 158, 960, q, q.seed + 9);
      lampPost(g, ex - 60, 172, 96, q);
    },
    live(g, t, q, shot, cam) {
      const ex = 250 + q.c % 260;
      const pulse = 0.18 + 0.06 * Math.sin(t * 1.8 + q.v);
      P.glow(g, ex + 150, 264, 120, q.pal.accent, pulse);
      /* 往下走的人：每镜的相位和速度不同 */
      for (let i = 0; i < 3; i++) {
        const pr = ((t * (18 + i * 6) + i * 40 + q.a) % 120) / 120;
        const px = ex + 70 + i * 70;
        const py = 186 + pr * 66;
        g.save();
        g.globalAlpha = 0.85 * (1 - pr * 0.5);
        K.rect(g, px, py, 5, 9, '#141a28');
        K.rect(g, px + 1, py - 6, 3, 6, '#1a2234');
        g.restore();
      }
      /* 上行的人 */
      const ur = ((t * 12 + q.b) % 100) / 100;
      pedShape(g, ex + 220, 250 - ur * 60, t, q.v, '#1a2032');
      /* 风从地下吹上来 */
      for (let i = 0; i < 8; i++) {
        const wx = ex + 20 + K.rnd(q.seed + i * 3.7) * 260;
        const wy = 250 - ((t * 30 + i * 20) % 80);
        g.save();
        g.globalAlpha = 0.14;
        K.rect(g, wx, wy, 1, 6, q.pal.fog);
        g.restore();
      }
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 夜市：两侧摊棚 + 灯笼 + 蒸汽 */
  GEN.market = {
    base(g, q) {
      K.grad(g, 0, 0, 960, 220, [{ p: 0, c: K.shade(q.pal.wall, -8) }, { p: 1, c: K.shade(q.pal.wall, 8) }]);
      K.rect(g, 0, 150, 960, 70, K.shade(q.pal.wall, -14));
      /* 摊棚：左右各一组，颜色与高度按 v 变 */
      const awn = [q.pal.accent, q.pal.warm, '#c9402e', '#3a8a6a'];
      for (let side = 0; side < 2; side++) {
        const bx = side === 0 ? 0 : 620;
        const bw = 340;
        for (let i = 0; i < 3; i++) {
          const sx = bx + i * 116;
          const sh = 96 + K.rnd(q.seed + i * 3.1 + side * 9) * 22;
          K.rect(g, sx, 196 - sh, 108, sh, '#241a1c');
          K.rect(g, sx + 2, 198 - sh, 104, sh - 6, '#120e12');
          /* 棚顶 */
          K.rect(g, sx - 8, 196 - sh - 14, 124, 12, awn[(q.mode + i + side) % 4]);
          for (let k = 0; k < 6; k++) K.rect(g, sx - 6 + k * 20, 196 - sh - 13, 10, 10, k % 2 ? '#0e0c12' : K.shade(awn[(q.mode + i + side) % 4], 14));
          K.rect(g, sx - 8, 196 - sh - 2, 124, 3, '#0a080c');
          /* 摊面与货 */
          K.rect(g, sx + 6, 196 - 46, 96, 6, '#6a4a34');
          for (let k = 0; k < 7; k++) {
            K.rect(g, sx + 10 + k * 12, 190 - 46, 8, 6, k % 3 ? q.pal.warm : q.pal.accent);
          }
          /* 灯泡串 */
          for (let k = 0; k < 4; k++) K.rect(g, sx + 10 + k * 28, 196 - sh - 16, 2, 2, q.pal.warm);
        }
      }
      /* 中间过道 */
      K.rect(g, 0, 196, 960, 74, q.pal.ground);
      for (let i = 0; i < 12; i++) K.rect(g, 0, 202 + i * 6, 960, 1, K.shade(q.pal.ground, 8));
      /* 顶上的灯笼 */
      for (let i = 0; i < 5; i++) K.rect(g, 120 + i * 170, 0, 1, 34, '#3a2a2a');
      /* 蒸笼 */
      K.rect(g, 690, 170, 28, 26, '#c9b592');
      K.rect(g, 690, 170, 28, 2, '#e8dcc0');
      wetFloor(g, 198, 960, q, q.seed + 3);
    },
    live(g, t, q, shot, cam) {
      for (let i = 0; i < 5; i++) {
        P.lantern(g, 120 + i * 170, 34, t * 0.9, i + q.mode);
      }
      for (let side = 0; side < 2; side++) {
        for (let i = 0; i < 3; i++) {
          const sx = (side === 0 ? 0 : 620) + i * 116;
          const sh = 96 + K.rnd(q.seed + i * 3.1 + side * 9) * 22;
          const fl = 0.8 + 0.16 * Math.sin(t * 5.1 + i * 2.3 + side);
          for (let k = 0; k < 4; k++) {
            P.glow(g, sx + 11 + k * 28, 196 - sh - 14, 12, q.pal.warm, fl * 0.22);
          }
          P.steam(g, sx + 52, 150, t, q.seed + i + side * 3, 5, '#d8cdb8', 34);
        }
      }
      /* 过道里来往的人 */
      for (let i = 0; i < 4; i++) {
        const px = ((t * (20 + i * 7) + i * 180 + q.a) % 1100) - 70;
        pedShape(g, px, 206 + (i % 2) * 14, t, q.v + i, '#1c1a24');
      }
      /* 灯笼在风里晃 */
      for (let i = 0; i < 5; i++) {
        g.save();
        g.globalAlpha = 0.18 + 0.08 * Math.sin(t * 3 + i);
        K.rect(g, 118 + i * 170, 32, 4, 3, q.pal.warm);
        g.restore();
      }
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 晾衣巷：两堵高墙之间，头顶全是衣服 */
  GEN.laundry = {
    base(g, q) {
      K.grad(g, 0, 0, 960, 270, [{ p: 0, c: K.shade(q.pal.wall, -6) }, { p: 1, c: K.shade(q.pal.ground, -10) }]);
      /* 巷子尽头：天空、远楼、街口的暖光 */
      const gx = 420, gw = 120;
      K.grad(g, gx, 0, gw, 226, [
        { p: 0, c: K.shade(q.pal.sky[0].c, 8) },
        { p: 0.54, c: K.shade(q.pal.sky[1].c, 2) },
        { p: 1, c: K.shade(q.pal.warm, -48) }
      ]);
      for (let i = 0; i < 9; i++) {
        const bh = 16 + Math.round(K.rnd(q.seed + i * 4.7) * 54);
        const bw = 9 + Math.round(K.rnd(q.seed + i * 8.3) * 19);
        const bx = gx + 2 + Math.round(K.rnd(q.seed + i * 2.9) * (gw - bw - 4));
        K.rect(g, bx, 226 - bh, bw, bh, K.shade(q.pal.wall, -54));
        for (let w = 0; w < 3; w++) {
          if (K.rnd(q.seed + i * 11.3 + w * 1.7) > 0.52) {
            K.rect(g, bx + 2 + (w % 2) * 5, 226 - bh + 5 + w * 9, 3, 2, K.shade(q.pal.warm, -16));
          }
        }
      }
      K.rect(g, gx, 216, gw, 10, K.shade(q.pal.ground, -20));
      P.glow(g, gx + 24, 180, 24, q.pal.warm, 0.24);
      P.glow(g, gx + gw / 2, 214, 64, q.pal.warm, 0.13);
      /* 巷口的墙体收边 */
      K.rect(g, gx - 5, 0, 5, 226, K.shade(q.pal.wall, -16));
      K.rect(g, gx + gw, 0, 5, 226, K.shade(q.pal.wall, -16));
      /* 左墙 */
      K.rect(g, 0, 0, 420, 226, K.shade(q.pal.wall, 4));
      for (let y = 0; y < 226; y += 8) K.rect(g, 0, y, 420, 1, K.shade(q.pal.wall, -4));
      for (let i = 0; i < 7; i++) {
        K.rect(g, 30 + (i % 2) * 20, 26 + i * 26, 40, 18, '#0c1020');
        K.rect(g, 32 + (i % 2) * 20, 28 + i * 26, 36, 14, K.rnd(q.seed + i * 3.1) > 0.5 ? q.pal.warm : '#141a2c');
      }
      /* 右墙 */
      K.rect(g, 540, 0, 420, 226, K.shade(q.pal.wall, -2));
      for (let y = 0; y < 226; y += 10) K.rect(g, 540, y, 420, 1, K.shade(q.pal.wall, 6));
      for (let i = 0; i < 6; i++) {
        K.rect(g, 600 + (i % 2) * 26, 22 + i * 30, 36, 16, '#0c1020');
        K.rect(g, 602 + (i % 2) * 26, 24 + i * 30, 32, 12, K.rnd(q.seed + i * 5.7) > 0.6 ? q.pal.accent : '#101624');
      }
      /* 晾衣绳：三层，每镜的位置不同 */
      for (let l = 0; l < 3; l++) {
        const y = 34 + l * 22 + q.a % 8;
        K.rect(g, 0, y, 960, 1, '#3a4460');
        for (let i = 0; i < 6; i++) {
          const bx = 40 + i * 150;
          K.rect(g, bx, y, 1, 6, '#3a4460');
        }
      }
      /* 地面与排水 */
      K.rect(g, 0, 226, 960, 44, K.shade(q.pal.ground, 2));
      K.rect(g, 478, 226, 10, 44, '#0a0c12');
      wetFloor(g, 228, 960, q, q.seed + 11);
      P.puddle(g, 200 + q.b % 200, 244, 120, 16, 0, q.seed, q.pal.accent);
      /* 空调外机 */
      P.ac(g, 330, 120);
      P.ac(g, 640, 96);
    },
    live(g, t, q, shot, cam) {
      const cols = ['#5a6a96', '#6a4a64', '#4a6a6c', '#5a5a72', '#7a5a3a'];
      for (let l = 0; l < 3; l++) {
        const y = 34 + l * 22 + q.a % 8;
        for (let i = 0; i < 6; i++) {
          const bx = 40 + i * 150 + (l % 2) * 14;
          const sway = Math.round(Math.sin(t * 1.2 + i * 1.7 + l) * 1.6);
          const c = cols[(i + l + q.mode) % 5];
          if ((i + l) % 3 === 0) {
            K.rect(g, bx + sway, y, 13, 7, c);
            K.rect(g, bx - 2 + sway, y, 3, 5, K.shade(c, -12));
            K.rect(g, bx + 13 + sway, y, 3, 5, K.shade(c, -12));
          } else if ((i + l) % 3 === 1) {
            K.rect(g, bx + sway, y, 9, 19, c);
            K.rect(g, bx + sway, y + 6, 9, 1, K.shade(c, 20));
          } else {
            K.rect(g, bx + sway, y, 11, 15, c);
            K.rect(g, bx + sway, y + 4, 11, 1, K.shade(c, 18));
          }
        }
      }
      /* 猫从墙根走过 */
      A.cat(g, ((t * 9 + q.c) % 1000) - 40, 232, t * 1.5, q.seed % 5);
      /* 窗里的灯呼吸 */
      for (let i = 0; i < 7; i++) {
        g.save();
        g.globalAlpha = 0.05 + 0.04 * Math.sin(t * 1.6 + i * 1.3 + q.v);
        K.rect(g, 32 + (i % 2) * 20, 28 + i * 26, 36, 14, q.pal.warm);
        g.restore();
      }
      /* 尽头路过的人 */
      pedShape(g, 420 + ((t * 10 + q.b) % 120), 196, t, q.v, '#121826');
      for (let i = 0; i < 5; i++) {
        const rr = (t * 5 + i * 6) % 16;
        g.save();
        g.globalAlpha = 0.2 * (1 - rr / 16);
        K.ring(g, 220 + K.rnd(q.seed + i * 3.1) * 130, 246, Math.max(1, Math.round(rr * 0.4)), '#9fb6d8');
        g.restore();
      }
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 旧书店：暖光橱窗 */
  GEN.bookstore = {
    base(g, q) {
      K.grad(g, 0, 0, 960, 190, q.pal.sky);
      buildings(g, q, 176, { count: 14, hMax: 70 });
      /* 店体 */
      K.rect(g, 120, 96, 460, 112, '#2a2024');
      K.rect(g, 120, 90, 460, 10, '#3a2c30');
      /* 橱窗：暖光 + 书架 */
      const lit = q.mode !== 1;
      K.rect(g, 144, 112, 300, 92, '#1a120e');
      K.rect(g, 148, 116, 292, 84, lit ? '#e8b46a' : '#241a14');
      for (let r = 0; r < 4; r++) {
        K.rect(g, 152, 130 + r * 18, 284, 2, lit ? '#8a5c2e' : '#1a1410');
        for (let i = 0; i < 16; i++) {
          const bw = 5 + Math.floor(K.rnd(q.seed + r * 13 + i * 3.1) * 6);
          const bh = 10 + Math.floor(K.rnd(q.seed + r * 7 + i * 5.3) * 5);
          K.rect(g, 156 + i * 17, 130 + r * 18 - bh, bw, bh, ['#5a3a3a', '#3a4a6a', '#4a3a5a', '#6a4a30'][(i + r + q.mode) % 4]);
        }
      }
      /* 玻璃与门 */
      K.rect(g, 144, 112, 300, 92, '#0a0c12');
      K.rect(g, 148, 116, 292, 84, lit ? 'rgba(232,180,106,0.32)' : 'rgba(10,12,18,0.7)');
      K.rect(g, 440, 120, 66, 88, '#2a1e1a');
      K.rect(g, 446, 126, 54, 76, lit ? '#f2c88a' : '#151018');
      K.rect(g, 472, 126, 2, 76, '#3a2a22');
      /* 招牌 */
      K.bit(g, 'BOOKS', 150, 98, q.pal.warm, 1);
      /* 雨棚 */
      for (let i = 0; i < 9; i++) K.rect(g, 136 + i * 38, 104, 20, 10, i % 2 ? q.pal.warm : '#1a1414');
      /* 人行道 */
      K.rect(g, 0, 208, 960, 62, K.shade(q.pal.ground, 6));
      for (let i = 0; i < 14; i++) K.rect(g, i * 68, 208, 2, 62, K.shade(q.pal.ground, -6));
      /* 长椅与树下 */
      P.bench(g, 660, 232);
      P.tree(g, 820, 214, 84, q.seed % 17, 0);
      wetFloor(g, 210, 960, q, q.seed + 7);
    },
    live(g, t, q, shot, cam) {
      const lit = q.mode !== 1;
      const fl = 0.8 + 0.1 * Math.sin(t * 2.3 + q.v);
      P.glow(g, 300, 158, 100, q.pal.warm, lit ? fl * 0.16 : 0.02);
      /* 店里走动的人影 */
      if (lit) {
        const px = 180 + (Math.sin(t * 0.6) * 0.5 + 0.5) * 200;
        g.save();
        g.globalAlpha = 0.45;
        K.rect(g, px, 146, 7, 30, '#4a2c1c');
        K.rect(g, px + 1, 138, 5, 8, '#3a2014');
        g.restore();
      }
      P.steam(g, 700, 200, t, q.seed + 2, 4, '#cfc4b4', 30);
      pedShape(g, ((t * 13 + q.a) % 1050) - 40, 210, t, q.v, '#1a1a26');
      for (let i = 0; i < 6; i++) {
        const rr = (t * 5 + i * 5) % 16;
        g.save();
        g.globalAlpha = 0.2 * (1 - rr / 16);
        K.ring(g, 200 + K.rnd(q.seed + i * 3.1) * 500, 244 + K.rnd(q.seed + i * 5.3) * 16, Math.max(1, Math.round(rr * 0.4)), '#9fb6d8');
        g.restore();
      }
      P.tree(g, 820, 214, 84, q.seed % 17, t);
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 江边木码头 */
  GEN.pier = {
    base(g, q) {
      P.sky(g, 960, 180, q.pal.sky);
      P.stars(g, 960, 110, 0, 16 + q.a % 28, q.seed);
      P.skylineSil(g, 0, 168, 960, 40, K.shade(q.pal.blds[0], 6), q.seed + 3);
      const lights = buildings(g, q, 172, { count: 16, hMin: 18, hMax: 52, litAt: 0.66 });
      LIGHTS[q.v] = lights;
      /* 江面 */
      K.rect(g, 0, 174, 960, 52, '#0a1020');
      P.river(g, 0, 174, 960, 52, 0, q.seed);
      /* 木栈道 */
      const dy = 218;
      K.rect(g, 0, dy, 960, 52, '#3a2a22');
      for (let i = 0; i < 48; i++) K.rect(g, i * 20, dy, 1, 52, '#2a1e18');
      K.rect(g, 0, dy, 960, 2, '#5a4234');
      /* 木桩 */
      for (let i = 0; i < 8; i++) {
        const px = 30 + i * 130;
        K.rect(g, px, dy - 26, 7, 30, '#241a14');
        K.rect(g, px, dy - 26, 7, 2, '#3e2c22');
      }
      /* 绳栏 */
      for (let i = 0; i < 8; i++) {
        const px = 30 + i * 130;
        K.line(g, px + 3, dy - 24, px + 133, dy - 24 + Math.round(Math.sin(i) * 2), '#5a4a38', 1);
      }
      /* 系着的船 */
      const bx = 120 + q.c % 300;
      K.rect(g, bx, 196, 80, 12, '#1a1410');
      K.rect(g, bx + 12, 186, 50, 10, '#241a14');
      K.rect(g, bx + 62, 194, 20, 3, '#1a1410');
      K.rect(g, bx + 22, 182, 2, 16, '#3a2c22');
      /* 灯 */
      lampPost(g, 760, dy, 108, q);
      wetFloor(g, 220, 960, q, q.seed + 13);
    },
    live(g, t, q, shot, cam) {
      if (LIGHTS[q.v]) P.lamps(g, LIGHTS[q.v], t);
      /* 水波 */
      g.save();
      g.beginPath();
      g.rect(0, 174, 960, 52);
      g.clip();
      for (let i = 0; i < 50; i++) {
        const ry = 176 + Math.floor(K.rnd(q.seed + i * 4.7) * 48);
        const rx = (K.rnd(q.seed + i * 2.9) * 960 + Math.sin(t * 1.2 + i) * 5 + 960) % 960;
        g.globalAlpha = 0.14 + 0.25 * K.rnd(q.seed + i * 3.1) + 0.1 * Math.sin(t * 2 + i);
        K.rect(g, rx, ry, 2 + Math.floor(K.rnd(q.seed + i * 6.1) * 18), 1, i % 4 === 0 ? q.pal.accent : (i % 3 ? q.pal.warm : '#4a5d8a'));
      }
      g.restore();
      /* 船随水起伏 */
      const bx = 120 + q.c % 300;
      const bob = Math.round(Math.sin(t * 1.4 + q.v) * 1);
      K.rect(g, bx, 197 + bob, 80, 12, '#1a1410');
      K.rect(g, bx + 12, 187 + bob, 50, 10, '#241a14');
      K.rect(g, bx + 66, 196 + bob, 4, 2, q.pal.warm);
      /* 栈道灯 */
      lampPost(g, 760, 218, 108, q, t);
      /* 走夜路的人 */
      pedShape(g, ((t * 12 + q.b) % 1080) - 60, 206, t, q.v, '#161c2e');
      for (let i = 0; i < 4; i++) {
        const rr = (t * 4 + i * 6) % 14;
        g.save();
        g.globalAlpha = 0.18 * (1 - rr / 14);
        K.ring(g, 200 + K.rnd(q.seed + i * 3.1) * 500, 250, Math.max(1, Math.round(rr * 0.4)), '#9fb6d8');
        g.restore();
      }
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 阳台：栏杆外整座城 */
  GEN.balcony = {
    base(g, q) {
      P.sky(g, 960, 200, q.pal.sky);
      P.stars(g, 960, 120, 0, 18 + q.a % 30, q.seed);
      P.skylineSil(g, 0, 178, 960, 44, K.shade(q.pal.blds[0], 4), q.seed + 5);
      const lights = buildings(g, q, 184, { count: 20, hMin: 20, hMax: 64, litAt: 0.64 });
      LIGHTS[q.v] = lights;
      /* 阳台地板：从画面底部往前收 */
      K.rect(g, 0, 218, 960, 52, K.shade(q.pal.wall, 8));
      for (let i = 0; i < 10; i++) K.rect(g, 0, 222 + i * 5, 960, 1, K.shade(q.pal.wall, 2));
      for (let i = 0; i < 16; i++) K.rect(g, i * 60, 218, 2, 52, K.shade(q.pal.wall, -4));
      /* 栏杆 */
      K.rect(g, 0, 196, 960, 3, '#3a4258');
      K.rect(g, 0, 208, 960, 2, '#2e3446');
      for (let i = 0; i < 34; i++) K.rect(g, i * 28 + q.a % 10, 198, 2, 14, '#3a4258');
      /* 身后的墙与推拉门 */
      K.rect(g, 0, 0, 250 + q.b % 90, 196, K.shade(q.pal.wall, -10));
      K.rect(g, 250 + q.b % 90, 0, 260, 196, '#1a1a24');
      K.rect(g, 262 + q.b % 90, 12, 236, 176, '#0c1018');
      K.rect(g, 378 + q.b % 90, 12, 3, 176, '#3a3a48');
      /* 晾着的衣服 / 植物 */
      P.laundry(g, 60, 40, 0, q.seed % 13);
      for (let i = 0; i < 2; i++) {
        K.rect(g, 660 + i * 80, 202, 22, 16, '#2a1a20');
        for (let k = 0; k < 5; k++) K.rect(g, 662 + i * 80 + k * 4, 192 - (k % 2) * 4, 3, 12, '#1e3328');
      }
      /* 藤椅 */
      K.rect(g, 540, 202, 34, 4, '#4a3a2a');
      K.rect(g, 540, 186, 4, 20, '#4a3a2a');
      K.rect(g, 570, 186, 4, 20, '#4a3a2a');
      /* 串灯 */
      for (let i = 0; i < 9; i++) K.rect(g, 300 + i * 60, 120 + Math.round(Math.sin(i * 0.8) * 8), 2, 2, q.pal.warm);
    },
    live(g, t, q, shot, cam) {
      if (LIGHTS[q.v]) P.lamps(g, LIGHTS[q.v], t);
      /* 串灯 */
      for (let i = 0; i < 9; i++) {
        const lx = 300 + i * 60;
        const ly = 120 + Math.round(Math.sin(i * 0.8) * 8 + Math.sin(t * 1.1 + i) * 1);
        K.rect(g, lx, ly, 2, 2, q.pal.warm);
        P.glow(g, lx + 1, ly + 1, 12, q.pal.warm, 0.14 + 0.08 * Math.sin(t * 3.1 + i));
      }
      /* 藤椅轻晃 */
      g.save();
      g.globalAlpha = 0.5;
      K.rect(g, 540, 200 + Math.round(Math.sin(t * 0.7 + q.v) * 1), 34, 2, '#4a3a2a');
      g.restore();
      /* 楼下掠过的车灯 */
      const cx = ((t * 40 + q.c) % 1200) - 120;
      K.rect(g, cx, 210, 5, 2, q.pal.warm);
      P.glow(g, cx + 3, 211, 18, q.pal.warm, 0.1);
      /* 窗帘被风吹起 */
      for (let i = 0; i < 6; i++) {
        const sw = Math.round(Math.sin(t * 0.9 + i * 0.6) * 3);
        K.rect(g, 262 + q.b % 90 + i * 10 + sw, 12, 9, 176, i % 2 ? 'rgba(30,20,32,0.55)' : 'rgba(20,16,28,0.7)');
      }
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 旧厂房：砖墙、烟囱、探照灯 */
  GEN.factory = {
    base(g, q) {
      P.sky(g, 960, 200, q.pal.sky);
      P.stars(g, 960, 100, 0, 12 + q.a % 24, q.seed);
      /* 厂房砖墙 */
      K.rect(g, 0, 44 + q.a % 18, 700, 170, '#3e2a26');
      for (let y = 48; y < 210; y += 5) {
        K.rect(g, 0, y, 700, 1, '#33211f');
        const off = (y % 10 === 0) ? 0 : 9;
        for (let x = off; x < 700; x += 18) K.rect(g, x, y, 1, 5, '#33211f');
      }
      /* 大窗 */
      for (let i = 0; i < 4; i++) {
        const wx = 60 + i * 160;
        K.rect(g, wx - 4, 70, 124, 88, '#241a1a');
        for (let k = 0; k < 6; k++) K.rect(g, wx, 74 + k * 14, 116, 12, '#0d1222');
        for (let k = 0; k < 5; k++) K.rect(g, wx + 24 * k, 74, 2, 82, '#241a1a');
        K.frame(g, wx - 4, 70, 124, 88, '#4a3230');
      }
      /* 烟囱 */
      for (let i = 0; i < 2; i++) {
        const cx = 740 + i * 90;
        const ch = 150 + K.rnd(q.seed + i * 3.1) * 40;
        K.rect(g, cx, 210 - ch, 30, ch, '#3a2422');
        K.rect(g, cx, 210 - ch, 30, 4, '#4e3230');
        K.rect(g, cx, 210 - ch + 30, 30, 3, '#2e1c1c');
        K.rect(g, cx, 210 - ch + 90, 30, 3, '#2e1c1c');
      }
      /* 铁丝网 */
      for (let x = 0; x < 960; x += 8) K.rect(g, x, 190, 1, 26, '#2a3038');
      for (let y = 190; y < 216; y += 6) K.rect(g, 0, y, 960, 1, '#2a3038');
      K.rect(g, 0, 214, 960, 2, '#3a4450');
      /* 地面 */
      K.rect(g, 0, 216, 960, 54, K.shade(q.pal.ground, -6));
      for (let i = 0; i < 12; i++) K.rect(g, i * 80, 216, 2, 54, K.shade(q.pal.ground, -12));
      /* 荒草 */
      for (let i = 0; i < 28; i++) {
        const gx = K.rnd(q.seed + i * 3.7) * 960;
        const gh = 6 + Math.floor(K.rnd(q.seed + i * 5.1) * 12);
        K.rect(g, gx, 220 - gh, 1, gh, '#243a2e');
      }
      /* 探照灯 */
      K.rect(g, 150, 200, 4, 28, '#2a2634');
      K.rect(g, 142, 194, 18, 8, '#3a3448');
    },
    live(g, t, q, shot, cam) {
      /* 烟囱蒸汽 */
      for (let i = 0; i < 2; i++) {
        const cx = 740 + i * 90;
        const ch = 150 + K.rnd(q.seed + i * 3.1) * 40;
        P.steam(g, cx + 15, 210 - ch - 2, t * 0.7, q.seed + i * 11, 10, '#4a4a5e', 80);
      }
      /* 窗内灯光 */
      for (let i = 0; i < 4; i++) {
        const wx = 60 + i * 160;
        g.save();
        g.globalAlpha = 0.07 + 0.05 * Math.sin(t * 1.6 + i * 1.3 + q.v);
        K.rect(g, wx, 74, 116, 82, q.pal.warm);
        g.restore();
      }
      /* 探照灯扫过 */
      const a = Math.sin(t * 0.45 + q.v) * 0.6;
      g.save();
      g.globalAlpha = 0.08;
      for (let i = 0; i < 34; i++) {
        K.rect(g, 152 + Math.sin(a) * i * 5, 200 - i * 6, 3, 3, '#cfe0ff');
      }
      g.restore();
      /* 草在风里 */
      for (let i = 0; i < 10; i++) {
        const gx = K.rnd(q.seed + i * 3.7) * 960;
        g.save();
        g.globalAlpha = 0.3;
        K.rect(g, gx + Math.round(Math.sin(t * 1.3 + i) * 1.5), 214, 1, 8, '#2e4a38');
        g.restore();
      }
      /* 远处的车 */
      const cx2 = ((t * 60 + q.b) % 1100) - 80;
      K.rect(g, cx2, 208, 4, 2, q.pal.warm);
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 碎片特写：三个模式——落地 / 掌心 / 合拢 */
  GEN.shard = {
    base(g, q) {
      K.grad(g, 0, 0, 960, 270, [{ p: 0, c: K.shade(q.pal.wall, -16) }, { p: 1, c: K.shade(q.pal.ground, -4) }]);
      if (shotMode(q) === 0) {
        /* 湿地特写：地面、水洼、草、碎片 */
        K.rect(g, 0, 150, 960, 120, K.shade(q.pal.ground, 2));
        for (let i = 0; i < 20; i++) {
          K.rect(g, K.rnd(q.seed + i * 3.1) * 960, 160 + K.rnd(q.seed + i * 5.7) * 100, 20 + K.rnd(q.seed + i * 7.3) * 60, 1, K.shade(q.pal.ground, 10));
        }
        P.puddle(g, 300, 190, 360, 50, 0, q.seed, K.shade(q.pal.accent, -76));
        P.puddle(g, 80, 236, 200, 24, 0, q.seed + 3, K.shade(q.pal.accent, -70));
        g.save();
        g.globalAlpha = 0.26;
        K.rect(g, 302, 189, 356, 1, q.pal.accent);
        K.rect(g, 82, 235, 196, 1, q.pal.accent);
        g.restore();
        for (let i = 0; i < 14; i++) {
          K.rect(g, 120 + K.rnd(q.seed + i * 2.9) * 700, 214, 1, 8 + K.rnd(q.seed + i * 4.1) * 10, '#243a2e');
        }
        /* 远处的墙根 */
        K.rect(g, 0, 0, 960, 60, K.shade(q.pal.wall, -6));
        P.glow(g, 480, 120, 90, q.pal.accent, 0.10);
      } else {
        /* 掌心：暗底 + 两只手 */
        const SKIN = '#3a2830';
        const SKIN2 = '#4e3438';
        const RIM = '#8a6050';
        function hand(dir) {
          const c = 480 + dir * 44;
          K.rect(g, c - 18, 226, 36, 34, SKIN);
          K.rect(g, c - 22, 204, 44, 24, SKIN);
          K.rect(g, c - 24, 196, 46, 10, SKIN2);
          for (let i = 0; i < 4; i++) {
            const fx = c - 25 + dir * (i * 12 - 4);
            const top = 180 + i * 3;
            K.rect(g, fx, top, 9, 22, SKIN);
            K.rect(g, fx + (dir > 0 ? 8 : 0), top, 1, 22, SKIN2);
            K.rect(g, fx, top, 9, 1, RIM);
          }
          K.rect(g, c + dir * 20, 194, 10, 16, SKIN);
          K.rect(g, c + dir * 20, 194, 10, 1, RIM);
          K.rect(g, c - 16, 200, 32, 1, '#4a5a6a');
          K.rect(g, c - 20, 206, 40, 1, '#2e3a48');
        }
        hand(-1);
        hand(1);
        for (let i = 0; i < 100; i++) {
          K.rect(g, Math.floor(K.rnd(q.seed + i * 3.1) * 960), Math.floor(K.rnd(q.seed + i * 7.3) * 270), 1, 1, K.rnd(q.seed + i * 5.9) > 0.85 ? q.pal.accent : K.shade(q.pal.wall, 6));
        }
      }
    },
    live(g, t, q, shot, cam) {
      const mode = shotMode(q);
      const cx = mode === 0 ? 480 : 480;
      const cy = mode === 0 ? 196 : 184;
      if (mode === 0) {
        /* 湿地：碎片躺在水洼里，倒影与涟漪 */
        for (let i = 0; i < 6; i++) {
          const rr = (t * 5 + i * 6) % 18;
          g.save();
          g.globalAlpha = 0.24 * (1 - rr / 18);
          K.ring(g, cx - 100 + K.rnd(q.seed + i * 3.1) * 200, 226, Math.max(1, Math.round(rr * 0.6)), q.pal.accent);
          g.restore();
        }
        A.shard(g, cx, cy - 10 + Math.sin(t * 1.1) * 2, t * 0.5, 2.2);
        P.glow(g, cx, cy - 12, 70, q.pal.accent, 0.22 + 0.06 * Math.sin(t * 2.1));
        /* 雨点 */
        for (let i = 0; i < 8; i++) {
          const dx = 120 + K.rnd(q.seed + i * 4.3) * 700;
          const dy = ((t * 90 + i * 40) % 220) + 20;
          g.save();
          g.globalAlpha = 0.3;
          K.rect(g, dx, dy, 1, 5, '#9fb6d8');
          g.restore();
        }
      } else {
        const pulse = 0.6 + 0.14 * Math.sin(t * 2.2);
        P.glow(g, cx, cy - 20, 60, q.pal.accent, pulse * 0.30);
        P.glow(g, cx, cy - 20, 100, q.pal.accent, pulse * 0.09);
        A.shard(g, cx, cy - 42 - Math.sin(t * 1.3) * 3, t, 1.8);
        if (mode === 2) {
          /* 合拢：两半向中心靠 */
          const p = K.clamp((t - (shot.mergeAt || 0.9)) / 0.9, 0, 1);
          const gap = Math.round(34 * (1 - K.smooth(p)));
          g.save();
          g.globalAlpha = 0.9;
          K.rect(g, cx - gap - 8, cy - 26, 7, 12, '#8fd8d2');
          K.rect(g, cx + gap + 2, cy - 26, 7, 12, '#8fd8d2');
          g.restore();
        }
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + t * 0.5;
          const r = 50 + Math.sin(t * 1.1 + i) * 7;
          g.save();
          g.globalAlpha = 0.45 + 0.4 * Math.sin(t * 3 + i);
          K.rect(g, Math.round(cx + Math.cos(a) * r), Math.round(cy - 22 + Math.sin(a) * r * 0.42), 1, 1, i % 3 ? q.pal.warm : q.pal.accent);
          g.restore();
        }
      }
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  function shotMode(q) { return q.mode; }

  /* 高架桥下 */
  GEN.overpass = {
    base(g, q) {
      P.sky(g, 960, 190, q.pal.sky);
      buildings(g, q, 180, { count: 14, hMax: 64 });
      /* 高架梁：斜着压在画面上方 */
      K.rect(g, 0, 26 + q.a % 18, 960, 46, '#2a2c38');
      K.rect(g, 0, 26 + q.a % 18, 960, 5, '#3e4252');
      K.rect(g, 0, 68 + q.a % 18, 960, 6, '#1a1c26');
      /* 梁下的柱 */
      for (let i = 0; i < 5; i++) {
        const cx = 60 + i * 210 + q.b % 40;
        K.rect(g, cx, 74, 34, 156, '#262832');
        K.rect(g, cx, 74, 6, 156, '#333644');
        K.rect(g, cx, 220, 44, 8, '#1a1c24');
      }
      /* 路面 */
      K.rect(g, 0, 200, 960, 70, q.pal.ground);
      K.rect(g, 0, 200, 960, 2, K.shade(q.pal.ground, 20));
      /* 中央虚线 */
      for (let i = 0; i < 12; i++) K.rect(g, 20 + i * 80, 246, 36, 3, K.shade(q.pal.ground, 28));
      wetFloor(g, 202, 960, q, q.seed + 15);
      /* 柱上的涂鸦与海报 */
      for (let i = 0; i < 5; i++) {
        const cx = 60 + i * 210 + q.b % 40;
        K.rect(g, cx + 8, 132 + (i % 3) * 18, 20, 12, i % 2 ? q.pal.accent : q.pal.warm);
      }
      /* 桥上的路灯 */
      for (let i = 0; i < 4; i++) {
        K.rect(g, 120 + i * 240, 8, 2, 20, '#232a45');
        K.rect(g, 118 + i * 240, 6, 6, 4, q.pal.warm);
      }
    },
    live(g, t, q, shot, cam) {
      /* 桥上车的影子从梁下扫过 */
      for (let i = 0; i < 3; i++) {
        const sx = ((t * (90 + i * 40) + i * 300 + q.a) % 1200) - 140;
        g.save();
        g.globalAlpha = 0.12;
        K.rect(g, sx, 72 + q.a % 18, 40, 3, '#0a0c14');
        g.restore();
      }
      /* 桥下的车 */
      carShape(g, ((t * 130 + q.c) % 1200) - 120, 218, '#141a26', false);
      carShape(g, 1080 - ((t * 100 + q.b) % 1200), 238, '#1a2030', true);
      /* 滴水 */
      for (let i = 0; i < 4; i++) {
        const dx = 90 + K.rnd(q.seed + i * 3.7) * 780;
        K.rect(g, dx, 74 + ((t * 24 + i * 30) % 140), 1, 4, '#8fb4c8');
      }
      /* 桥上路灯的辉光透过梁缝 */
      for (let i = 0; i < 4; i++) {
        P.glow(g, 121 + i * 240, 26 + q.a % 18, 30, q.pal.warm, 0.08 + 0.03 * Math.sin(t * 2 + i));
      }
      pedShape(g, ((t * 11 + q.b) % 1000) - 30, 206, t, q.v, '#161c2a');
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 雨中的电话亭 */
  GEN.phone = {
    base(g, q) {
      K.grad(g, 0, 0, 960, 190, q.pal.sky);
      buildings(g, q, 186, { count: 16, hMax: 76 });
      K.rect(g, 0, 190, 960, 80, q.pal.ground);
      wetFloor(g, 192, 960, q, q.seed + 21);
      /* 电话亭 */
      const bx = 360 + q.c % 220;
      K.rect(g, bx, 96, 88, 122, '#1a1a20');
      K.rect(g, bx + 4, 100, 80, 112, '#2a2a32');
      K.rect(g, bx + 8, 104, 72, 96, '#0c1018');
      /* 玻璃格 */
      for (let i = 0; i < 3; i++) K.rect(g, bx + 8 + i * 24, 104, 2, 96, '#3a3a44');
      for (let i = 0; i < 4; i++) K.rect(g, bx + 8, 104 + i * 24, 72, 2, '#3a3a44');
      /* 顶灯 */
      K.rect(g, bx + 10, 92, 68, 8, '#3a3a44');
      K.rect(g, bx + 14, 94, 60, 4, q.pal.warm);
      /* 话筒与电话机 */
      K.rect(g, bx + 52, 138, 16, 10, '#1a1a20');
      K.rect(g, bx + 54, 140, 12, 6, '#3a3a44');
      K.rect(g, bx + 30, 128, 3, 20, '#2a2a32');
      K.rect(g, bx + 26, 126, 11, 5, '#3a3a44');
      /* 亭外的路沿 */
      K.rect(g, 0, 210, 960, 4, '#2a2a32');
      /* 雨棚 */
      for (let i = 0; i < 5; i++) K.rect(g, bx - 6 + i * 20, 84, 20, 8, i % 2 ? q.pal.accent : '#121418');
      /* 旁边一盏灯 */
      lampPost(g, bx - 90, 210, 100, q);
    },
    live(g, t, q, shot, cam) {
      const bx = 360 + q.c % 220;
      const fl = 0.8 + 0.16 * Math.sin(t * 6.4 + q.v) + 0.04 * Math.sin(t * 17);
      P.glow(g, bx + 44, 96, 62, q.pal.warm, fl * 0.2);
      g.save();
      g.globalAlpha = fl;
      K.rect(g, bx + 14, 94, 60, 4, q.pal.warm);
      g.restore();
      /* 亭里的影子 */
      g.save();
      g.globalAlpha = 0.5;
      K.rect(g, bx + 34, 150, 7, 26, '#1a1418');
      K.rect(g, bx + 35, 142, 5, 8, '#221a20');
      g.restore();
      /* 玻璃上的水痕 */
      for (let i = 0; i < 6; i++) {
        const dx = bx + 12 + K.rnd(q.seed + i * 3.1) * 60;
        const dy = 104 + ((t * 14 + i * 30) % 90);
        K.rect(g, dx, dy, 1, 4, '#8fa4cd');
      }
      pedShape(g, 180 + ((t * 12 + q.a) % 620), 198, t, q.v, '#151a26');
      for (let i = 0; i < 5; i++) {
        const rr = (t * 5 + i * 5) % 16;
        g.save();
        g.globalAlpha = 0.2 * (1 - rr / 16);
        K.ring(g, 320 + K.rnd(q.seed + i * 3.3) * 320, 246, Math.max(1, Math.round(rr * 0.4)), '#9fb6d8');
        g.restore();
      }
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 校门口 */
  GEN.school = {
    base(g, q) {
      K.grad(g, 0, 0, 960, 186, q.pal.sky);
      buildings(g, q, 182, { count: 12, hMax: 56 });
      /* 围墙 */
      K.rect(g, 0, 150, 960, 60, K.shade(q.pal.wall, 6));
      for (let x = 0; x < 960; x += 28) K.rect(g, x, 150, 1, 60, K.shade(q.pal.wall, -6));
      K.rect(g, 0, 146, 960, 5, K.shade(q.pal.wall, 16));
      /* 校门 */
      const gx = 380 + q.c % 180;
      K.rect(g, gx, 118, 200, 92, K.shade(q.pal.wall, -4));
      for (let i = 0; i < 10; i++) K.rect(g, gx + 10 + i * 19, 126, 3, 84, '#3a4450');
      K.rect(g, gx + 10, 126, 182, 3, '#4a5664');
      K.rect(g, gx + 10, 168, 182, 2, '#4a5664');
      /* 校牌 */
      K.rect(g, gx + 40, 92, 120, 24, '#1a1a20');
      K.rect(g, gx + 44, 96, 112, 16, '#2a2a32');
      for (let i = 0; i < 5; i++) K.rect(g, gx + 54 + i * 20, 100, 12, 8, q.pal.warm);
      /* 门柱灯 */
      for (let i = 0; i < 2; i++) {
        K.rect(g, gx + i * 194, 100, 6, 20, '#2a2a32');
        K.rect(g, gx - 3 + i * 194, 96, 12, 5, q.pal.warm);
      }
      /* 地面与斑马线 */
      K.rect(g, 0, 210, 960, 60, q.pal.ground);
      for (let i = 0; i < 8; i++) K.rect(g, gx - 30 + i * 28, 216, 15, 48, K.shade(q.pal.ground, 20));
      wetFloor(g, 212, 960, q, q.seed + 17);
      P.tree(g, 120, 208, 92, q.seed % 19, 0);
      P.tree(g, 820, 208, 84, q.seed % 23, 0);
      P.bike(g, 260, 238);
    },
    live(g, t, q, shot, cam) {
      const gx = 380 + q.c % 180;
      const fl = 0.8 + 0.1 * Math.sin(t * 3.7 + q.v);
      for (let i = 0; i < 2; i++) P.glow(g, gx + 3 + i * 194, 100, 26, q.pal.warm, fl * 0.18);
      P.tree(g, 120, 208, 92, q.seed % 19, t);
      P.tree(g, 820, 208, 84, q.seed % 23, t);
      /* 放学的学生 */
      for (let i = 0; i < 3; i++) {
        pedShape(g, 200 + ((t * (14 + i * 5) + i * 120 + q.a) % 600), 202 + (i % 2) * 10, t, q.v + i, '#1a2030');
      }
      /* 门轴轻响 */
      g.save();
      g.globalAlpha = 0.2;
      K.rect(g, gx + 186, 126, 3, 84, '#8fa4cd');
      g.restore();
      for (let i = 0; i < 5; i++) {
        const rr = (t * 4 + i * 5) % 14;
        g.save();
        g.globalAlpha = 0.18 * (1 - rr / 14);
        K.ring(g, 240 + K.rnd(q.seed + i * 3.7) * 500, 244, Math.max(1, Math.round(rr * 0.4)), '#9fb6d8');
        g.restore();
      }
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 小公园 */
  GEN.garden = {
    base(g, q) {
      P.sky(g, 960, 180, q.pal.sky);
      P.stars(g, 960, 110, 0, 20 + q.a % 30, q.seed);
      buildings(g, q, 176, { count: 10, hMax: 46, litAt: 0.7 });
      /* 草地 */
      K.grad(g, 0, 176, 960, 94, [{ p: 0, c: '#12241e' }, { p: 1, c: '#0a1612' }]);
      for (let i = 0; i < 60; i++) {
        K.rect(g, K.rnd(q.seed + i * 3.1) * 960, 182 + K.rnd(q.seed + i * 5.7) * 84, 1, 2, '#1c3a2c');
      }
      /* 石板路 */
      const px = 360 + q.c % 220;
      for (let i = 0; i < 14; i++) {
        K.rect(g, px - 40 + Math.round(Math.sin(i * 0.5) * 30), 186 + i * 6, 90, 5, K.shade(q.pal.ground, 14));
      }
      /* 树 */
      P.tree(g, 140, 216, 116, q.seed % 13, 0);
      P.tree(g, 640, 220, 96, q.seed % 17, 0);
      P.tree(g, 860, 212, 78, q.seed % 19, 0);
      /* 长椅 */
      P.bench(g, px + 48, 224);
      /* 路灯 */
      lampPost(g, px - 96, 220, 104, q);
      /* 灌木 */
      for (let i = 0; i < 8; i++) {
        K.rect(g, 60 + i * 110 + q.b % 30, 214, 26, 10, '#183026');
        K.rect(g, 64 + i * 110 + q.b % 30, 210, 18, 6, '#1e3a2c');
      }
      /* 围栏 */
      for (let x = 0; x < 960; x += 22) K.rect(g, x, 160, 2, 18, '#2a3038');
      K.rect(g, 0, 158, 960, 2, '#3a4450');
    },
    live(g, t, q, shot, cam) {
      P.tree(g, 140, 216, 116, q.seed % 13, t);
      P.tree(g, 640, 220, 96, q.seed % 17, t);
      P.tree(g, 860, 212, 78, q.seed % 19, t);
      const px = 360 + q.c % 220;
      lampPost(g, px - 96, 220, 104, q, t);
      /* 萤火虫 */
      for (let i = 0; i < 12; i++) {
        const fx = 120 + K.rnd(q.seed + i * 3.1) * 720 + Math.sin(t * 0.7 + i) * 10;
        const fy = 150 + K.rnd(q.seed + i * 5.3) * 80 + Math.cos(t * 0.9 + i) * 6;
        g.save();
        g.globalAlpha = 0.3 + 0.4 * Math.sin(t * 1.6 + i * 1.7);
        K.rect(g, fx, fy, 1, 1, q.pal.warm);
        g.restore();
      }
      /* 散步的人 */
      pedShape(g, ((t * 10 + q.b) % 1040) - 40, 206, t, q.v, '#141c26');
      pedShape(g, 1000 - ((t * 8 + q.a) % 1040), 210, t, q.v + 2, '#18202c');
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 电影院门口 */
  GEN.cinema = {
    base(g, q) {
      K.grad(g, 0, 0, 960, 200, q.pal.sky);
      buildings(g, q, 186, { count: 12, hMax: 60 });
      /* 影院立面 */
      K.rect(g, 90, 56, 780, 154, '#241a22');
      K.rect(g, 90, 52, 780, 8, '#3a2a34');
      /* 灯箱招牌 */
      K.rect(g, 180, 62, 600, 44, '#120e14');
      K.rect(g, 186, 68, 588, 32, '#2a1420');
      for (let i = 0; i < 12; i++) {
        K.rect(g, 200 + i * 48, 78, 32, 12, i % 2 ? q.pal.warm : q.pal.accent);
      }
      /* 灯泡围边 */
      for (let i = 0; i < 19; i++) {
        K.rect(g, 180 + i * 33, 58, 2, 2, q.pal.warm);
        K.rect(g, 180 + i * 33, 108, 2, 2, q.pal.warm);
      }
      /* 海报柜 */
      for (let i = 0; i < 3; i++) {
        const px = 150 + i * 230;
        K.rect(g, px, 120, 90, 64, '#14101a');
        K.rect(g, px + 4, 124, 82, 56, '#1e2a3e');
        K.rect(g, px + 14, 134, 62, 30, i % 2 ? q.pal.accent : q.pal.warm);
        K.rect(g, px + 10, 172, 70, 3, '#3a3444');
      }
      /* 入口门 */
      K.rect(g, 700, 122, 90, 88, '#1a141c');
      K.rect(g, 706, 128, 78, 82, '#0c1018');
      K.rect(g, 742, 128, 3, 82, '#2a2430');
      /* 地面 */
      K.rect(g, 0, 208, 960, 62, K.shade(q.pal.ground, 8));
      for (let i = 0; i < 12; i++) K.rect(g, i * 80, 208, 2, 62, K.shade(q.pal.ground, -2));
      /* 红毯 */
      K.rect(g, 120, 212, 720, 24, '#3a1420');
      K.rect(g, 120, 212, 720, 2, '#5a2030');
      wetFloor(g, 210, 960, q, q.seed + 19);
      lampPost(g, 60, 210, 100, q);
    },
    live(g, t, q, shot, cam) {
      /* 灯泡跑马 */
      for (let i = 0; i < 19; i++) {
        const on = (Math.floor(t * 8) + i) % 3 === 0;
        if (on) {
          K.rect(g, 180 + i * 33, 58, 2, 2, q.pal.warm);
          P.glow(g, 181 + i * 33, 59, 10, q.pal.warm, 0.2);
        }
        K.rect(g, 180 + i * 33, 108, 2, 2, (Math.floor(t * 8) + i + 1) % 3 === 0 ? q.pal.warm : '#3a2a20');
      }
      /* 霓虹呼吸 */
      const fl = 0.7 + 0.2 * Math.sin(t * 2.1 + q.v);
      P.glow(g, 480, 84, 160, q.pal.accent, fl * 0.10);
      /* 排队的人 */
      for (let i = 0; i < 4; i++) {
        pedShape(g, 760 + i * 22, 196, t * 0.3, q.v + i, '#181420');
      }
      /* 散场的人 */
      pedShape(g, 240 + ((t * 9 + q.a) % 500), 204, t, q.v, '#1a1826');
      for (let i = 0; i < 5; i++) {
        const rr = (t * 4 + i * 5) % 14;
        g.save();
        g.globalAlpha = 0.2 * (1 - rr / 14);
        K.ring(g, 260 + K.rnd(q.seed + i * 3.1) * 500, 246, Math.max(1, Math.round(rr * 0.4)), '#9fb6d8');
        g.restore();
      }
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 公交站 */
  GEN.busstop = {
    base(g, q) {
      K.grad(g, 0, 0, 960, 190, q.pal.sky);
      buildings(g, q, 184, { count: 14, hMax: 70 });
      /* 候车亭 */
      const sx = 260 + q.c % 260;
      K.rect(g, sx, 108, 300, 12, '#2a3038');
      K.rect(g, sx - 6, 104, 312, 6, '#3a4450');
      K.rect(g, sx + 6, 118, 288, 88, 'rgba(120,160,180,0.12)');
      K.rect(g, sx + 6, 118, 4, 88, '#2a3038');
      K.rect(g, sx + 290, 118, 4, 88, '#2a3038');
      /* 长椅 */
      K.rect(g, sx + 30, 176, 130, 4, '#4a3a2a');
      K.rect(g, sx + 30, 166, 130, 4, '#4a3a2a');
      K.rect(g, sx + 34, 180, 4, 24, '#2a2020');
      K.rect(g, sx + 152, 180, 4, 24, '#2a2020');
      /* 站牌 */
      K.rect(g, sx + 214, 120, 4, 84, '#2a3038');
      K.rect(g, sx + 196, 120, 44, 30, '#1a2436');
      K.rect(g, sx + 200, 124, 36, 22, q.pal.accent);
      /* 广告灯箱 */
      K.rect(g, sx + 236, 142, 48, 56, '#141a22');
      K.rect(g, sx + 240, 146, 40, 48, q.pal.warm);
      /* 路面 */
      K.rect(g, 0, 208, 960, 62, q.pal.ground);
      K.rect(g, 0, 208, 960, 2, K.shade(q.pal.ground, 18));
      wetFloor(g, 210, 960, q, q.seed + 23);
      lampPost(g, sx - 60, 210, 100, q);
      P.bike(g, sx + 330, 236);
    },
    live(g, t, q, shot, cam) {
      const sx = 260 + q.c % 260;
      /* 灯箱呼吸 */
      P.glow(g, sx + 260, 174, 44, q.pal.warm, 0.14 + 0.05 * Math.sin(t * 1.7 + q.v));
      /* 公交车驶过 */
      const bus = ((t * 70 + q.a) % 1300) - 200;
      K.rect(g, bus, 168, 170, 42, '#1e2a3a');
      K.rect(g, bus, 168, 170, 4, '#2e3e52');
      for (let i = 0; i < 4; i++) K.rect(g, bus + 12 + i * 40, 176, 30, 16, q.pal.warm);
      K.rect(g, bus + 170, 180, 4, 8, q.pal.warm);
      P.glow(g, bus + 174, 184, 30, q.pal.warm, 0.14);
      /* 等车的人 */
      for (let i = 0; i < 3; i++) {
        pedShape(g, sx + 40 + i * 44, 184, t * 0.5, q.v + i, '#171c2a');
      }
      /* 雨棚滴水 */
      for (let i = 0; i < 6; i++) {
        const dx = sx + 10 + K.rnd(q.seed + i * 3.7) * 280;
        K.rect(g, dx, 118 + ((t * 30 + i * 20) % 60), 1, 3, '#8fb4c8');
      }
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 地下车库 */
  GEN.parking = {
    base(g, q) {
      K.grad(g, 0, 0, 960, 230, [{ p: 0, c: K.shade(q.pal.wall, -12) }, { p: 1, c: K.shade(q.pal.wall, 2) }]);
      /* 顶与梁 */
      K.rect(g, 0, 0, 960, 60, K.shade(q.pal.wall, -6));
      for (let i = 0; i < 8; i++) K.rect(g, i * 120, 0, 18, 66, K.shade(q.pal.wall, -12));
      /* 柱子 */
      for (let i = 0; i < 5; i++) {
        const cx = 40 + i * 210 + q.b % 30;
        K.rect(g, cx, 64, 40, 150, '#2a2c34');
        K.rect(g, cx, 64, 8, 150, '#3a3c46');
        K.rect(g, cx - 2, 76, 44, 8, q.pal.warm);
        K.rect(g, cx - 2, 76, 44, 2, K.shade(q.pal.warm, -30));
      }
      /* 后墙与车位线 */
      K.rect(g, 0, 208, 960, 62, K.shade(q.pal.ground, -8));
      for (let i = 0; i < 9; i++) K.rect(g, 60 + i * 110, 214, 3, 40, '#3a3c24');
      /* 停着的车 */
      for (let i = 0; i < 3; i++) {
        const cx = 110 + i * 300 + q.a % 50;
        K.rect(g, cx, 186, 80, 26, ['#2a2430', '#1e2a36', '#2e2622'][(i + q.mode) % 3]);
        K.rect(g, cx + 12, 172, 56, 16, ['#322a38', '#243242', '#362c28'][(i + q.mode) % 3]);
        K.rect(g, cx + 16, 176, 20, 10, '#0c1018');
        K.rect(g, cx + 44, 176, 20, 10, '#0c1018');
        K.rect(g, cx, 206, 80, 3, '#0a0c10');
      }
      /* 出口标识 */
      K.rect(g, 780, 84, 60, 20, '#1a3a2a');
      K.rect(g, 784, 88, 52, 12, q.pal.accent);
      wetFloor(g, 210, 960, q, q.seed + 25);
    },
    live(g, t, q, shot, cam) {
      /* 荧光灯 */
      for (let i = 0; i < 8; i++) {
        const lx = 20 + i * 120;
        const on = Math.sin(t * 2.6 + i * 2.1 + q.v) > -0.7;
        K.rect(g, lx, 30, 80, 3, on ? '#e8f0ff' : '#4a5260');
        P.glow(g, lx + 40, 32, 30, '#dce8ff', on ? 0.08 : 0.01);
      }
      /* 一辆车倒出来 */
      const cx = 620 - ((t * 40 + q.c) % 300);
      K.rect(g, cx, 190, 70, 24, '#26202c');
      K.rect(g, cx + 10, 178, 48, 14, '#2e2636');
      K.rect(g, cx + 14, 182, 16, 8, '#0c1018');
      K.rect(g, cx, 190, 70, 2, '#3a3040');
      P.glow(g, cx + 2, 200, 26, '#e8404a', 0.12 + 0.04 * Math.sin(t * 4));
      /* 滴水 */
      for (let i = 0; i < 4; i++) {
        const dx = 80 + K.rnd(q.seed + i * 3.3) * 800;
        K.rect(g, dx, 64 + ((t * 20 + i * 30) % 140), 1, 4, '#8fb4c8');
      }
      pedShape(g, ((t * 9 + q.b) % 1000) - 30, 204, t, q.v, '#161a24');
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 电玩城 */
  GEN.arcade = {
    base(g, q) {
      K.grad(g, 0, 0, 960, 250, [{ p: 0, c: K.shade(q.pal.wall, -10) }, { p: 1, c: K.shade(q.pal.ground, 2) }]);
      /* 后墙霓虹 */
      K.rect(g, 0, 0, 960, 60, '#0a0810');
      for (let i = 0; i < 7; i++) {
        const nx = 40 + i * 130;
        K.rect(g, nx, 18 + (i % 3) * 6, 70, 8, i % 3 === 0 ? q.pal.accent : (i % 3 === 1 ? q.pal.warm : '#e8508a'));
      }
      /* 一排机台 */
      for (let i = 0; i < 6; i++) {
        const mx = 30 + i * 152;
        K.rect(g, mx, 96, 132, 130, '#1a1622');
        K.rect(g, mx + 4, 100, 124, 126, '#241c2c');
        /* 屏幕 */
        K.rect(g, mx + 14, 108, 104, 66, '#0a0c14');
        K.rect(g, mx + 18, 112, 96, 58, i % 2 ? q.pal.accent : q.pal.warm);
        /* 控制台 */
        K.rect(g, mx + 10, 180, 112, 16, '#3a2c3a');
        K.rect(g, mx + 20, 184, 8, 6, '#c9402e');
        K.rect(g, mx + 40, 184, 8, 6, '#3a8a6a');
        K.rect(g, mx + 62, 184, 8, 6, '#4a6ac9');
        K.rect(g, mx + 84, 184, 8, 6, '#c9b24a');
        /* 顶灯 */
        K.rect(g, mx + 30, 88, 72, 6, i % 2 ? '#e8508a' : '#4ac8e8');
      }
      /* 地面 */
      K.rect(g, 0, 226, 960, 44, K.shade(q.pal.ground, -4));
      for (let i = 0; i < 10; i++) K.rect(g, 0, 230 + i * 4, 960, 1, K.shade(q.pal.ground, 4));
      wetFloor(g, 228, 960, q, q.seed + 27);
      /* 立柱 */
      K.rect(g, 0, 60, 16, 166, '#1a1620');
      K.rect(g, 944, 60, 16, 166, '#1a1620');
    },
    live(g, t, q, shot, cam) {
      for (let i = 0; i < 6; i++) {
        const mx = 30 + i * 152;
        const fl = 0.6 + 0.3 * Math.sin(t * (2 + i * 0.4) + i * 1.7 + q.v);
        g.save();
        g.globalAlpha = 0.55 + 0.35 * Math.sin(t * 3 + i);
        K.rect(g, mx + 18, 112, 96, 58, i % 2 ? q.pal.accent : q.pal.warm);
        g.restore();
        P.glow(g, mx + 66, 140, 50, i % 2 ? q.pal.accent : q.pal.warm, Math.max(0, fl) * 0.14);
      }
      /* 玩家 */
      for (let i = 0; i < 3; i++) {
        const mx = 30 + (i * 2 + 1) * 152;
        pedShape(g, mx + 50, 186, t * 0.7, q.v + i, '#14101a');
      }
      /* 霓虹扫过 */
      const nx = (t * 60 + q.a) % 1100 - 70;
      g.save();
      g.globalAlpha = 0.10;
      K.rect(g, nx, 0, 40, 270, q.pal.accent);
      g.restore();
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 小游乐场 */
  GEN.playground = {
    base(g, q) {
      P.sky(g, 960, 180, q.pal.sky);
      P.stars(g, 960, 100, 0, 16 + q.a % 24, q.seed);
      buildings(g, q, 178, { count: 12, hMax: 54 });
      /* 沙地 */
      K.grad(g, 0, 178, 960, 92, [{ p: 0, c: '#2a2418' }, { p: 1, c: '#161208' }]);
      for (let i = 0; i < 40; i++) {
        K.rect(g, K.rnd(q.seed + i * 3.1) * 960, 182 + K.rnd(q.seed + i * 5.7) * 84, 2, 1, '#3a3222');
      }
      /* 秋千架 */
      const sx = 160 + q.c % 200;
      K.rect(g, sx, 96, 4, 90, '#3a4450');
      K.rect(g, sx + 190, 96, 4, 90, '#3a4450');
      K.rect(g, sx - 4, 92, 202, 5, '#4a5664');
      for (let i = 0; i < 2; i++) {
        const rx = sx + 40 + i * 90;
        K.rect(g, rx, 97, 1, 54, '#2a3038');
        K.rect(g, rx + 14, 97, 1, 54, '#2a3038');
        K.rect(g, rx - 2, 151, 19, 3, '#2a3038');
      }
      /* 滑梯 */
      const sl = 560 + q.b % 180;
      K.rect(g, sl, 108, 5, 88, '#3a4450');
      K.rect(g, sl + 54, 150, 5, 46, '#3a4450');
      K.line(g, sl + 4, 118, sl + 56, 152, '#4a5664', 4);
      K.rect(g, sl + 2, 110, 22, 3, '#2a3038');
      /* 围栏 */
      for (let x = 0; x < 960; x += 26) K.rect(g, x, 166, 2, 26, '#2a3038');
      K.rect(g, 0, 164, 960, 2, '#3a4450');
      /* 路灯 */
      lampPost(g, 820, 218, 104, q);
      /* 树 */
      P.tree(g, 60, 220, 96, q.seed % 11, 0);
    },
    live(g, t, q, shot, cam) {
      const sx = 160 + q.c % 200;
      /* 秋千摆 */
      for (let i = 0; i < 2; i++) {
        const sw = Math.sin(t * 1.6 + i * 1.4) * 14;
        const rx = sx + 40 + i * 90 + sw;
        K.rect(g, rx, 97, 1, 54, '#2a3038');
        K.rect(g, rx + 14, 97, 1, 54, '#2a3038');
        K.rect(g, rx - 2, 151, 19, 3, '#2a3038');
      }
      P.tree(g, 60, 220, 96, q.seed % 11, t);
      lampPost(g, 820, 218, 104, q, t);
      /* 跑过的小孩 */
      pedShape(g, ((t * 22 + q.a) % 1000) - 30, 202, t, q.v, '#181c28');
      pedShape(g, 980 - ((t * 18 + q.b) % 1000), 206, t, q.v + 2, '#1c2030');
      /* 滑梯的影子随灯晃 */
      g.save();
      g.globalAlpha = 0.08 + 0.03 * Math.sin(t * 1.2);
      K.rect(g, 580 + q.b % 180, 196, 60, 3, '#8fa4cd');
      g.restore();
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 小教堂 */
  GEN.chapel = {
    base(g, q) {
      P.sky(g, 960, 180, q.pal.sky);
      P.stars(g, 960, 110, 0, 24 + q.a % 30, q.seed);
      P.skylineSil(g, 0, 172, 960, 40, K.shade(q.pal.blds[0], 4), q.seed + 7);
      /* 远处的树 */
      P.tree(g, 120, 196, 100, q.seed % 13, 0);
      P.tree(g, 840, 196, 90, q.seed % 17, 0);
      /* 小教堂 */
      const cx = 360 + q.c % 200;
      K.rect(g, cx, 96, 220, 104, '#2a2428');
      K.rect(g, cx + 30, 74, 160, 26, '#332c30');
      /* 尖顶 */
      for (let i = 0; i < 26; i++) {
        K.rect(g, cx + 110 - i * 2, 74 - i * 2, i * 4, 2, '#2a2428');
      }
      K.rect(g, cx + 108, 18, 3, 16, '#3a3238');
      K.rect(g, cx + 103, 23, 13, 3, '#3a3238');
      /* 拱窗：暖光 */
      K.rect(g, cx + 86, 118, 48, 66, '#1a1418');
      for (let i = 0; i < 20; i++) {
        const w = Math.abs(19 - i) * 2;
        K.rect(g, cx + 110 - w, 118 + i * 3, w * 2, 3, q.pal.warm);
      }
      K.rect(g, cx + 30, 140, 30, 44, '#1a1418');
      K.rect(g, cx + 34, 144, 22, 36, q.pal.accent);
      K.rect(g, cx + 158, 140, 30, 44, '#1a1418');
      K.rect(g, cx + 162, 144, 22, 36, q.pal.accent);
      /* 门 */
      K.rect(g, cx + 94, 160, 32, 40, '#241a1c');
      K.rect(g, cx + 98, 164, 24, 36, '#120e12');
      /* 石径 */
      for (let i = 0; i < 14; i++) {
        K.rect(g, cx + 60 + Math.round(Math.sin(i * 0.4) * 20), 200 + i * 5, 80, 4, K.shade(q.pal.ground, 10));
      }
      K.rect(g, 0, 200, 960, 70, K.shade(q.pal.ground, -4));
      /* 墓碑 */
      for (let i = 0; i < 5; i++) {
        K.rect(g, 90 + i * 46, 206 + (i % 2) * 8, 10, 18, '#3a3438');
        K.rect(g, 91 + i * 46, 204 + (i % 2) * 8, 8, 3, '#4a4248');
      }
      lampPost(g, cx - 60, 206, 96, q);
    },
    live(g, t, q, shot, cam) {
      const cx = 360 + q.c % 200;
      const fl = 0.75 + 0.12 * Math.sin(t * 2.7 + q.v) + 0.03 * Math.sin(t * 9);
      P.glow(g, cx + 110, 148, 80, q.pal.warm, fl * 0.18);
      /* 彩窗的光落在地上 */
      g.save();
      g.globalAlpha = 0.10 + 0.04 * Math.sin(t * 1.4 + q.v);
      K.rect(g, cx + 60, 216, 100, 30, q.pal.warm);
      g.restore();
      lampPost(g, cx - 60, 206, 96, q, t);
      /* 雾气在墓园里 */
      for (let i = 0; i < 8; i++) {
        const fx = 80 + K.rnd(q.seed + i * 3.1) * 800 + Math.sin(t * 0.4 + i) * 20;
        g.save();
        g.globalAlpha = 0.05 + 0.03 * Math.sin(t * 0.7 + i);
        K.rect(g, fx, 212 + (i % 3) * 10, 60, 4, q.pal.fog);
        g.restore();
      }
      P.tree(g, 120, 196, 100, q.seed % 13, t);
      P.tree(g, 840, 196, 90, q.seed % 17, t);
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* 天台花园 */
  GEN.rooftop = {
    base(g, q) {
      P.sky(g, 960, 190, q.pal.sky);
      P.stars(g, 960, 120, 0, 22 + q.a % 30, q.seed);
      P.skylineSil(g, 0, 176, 960, 44, K.shade(q.pal.blds[0], 4), q.seed + 9);
      const lights = buildings(g, q, 180, { count: 20, hMin: 22, hMax: 70, litAt: 0.62 });
      LIGHTS[q.v] = lights;
      /* 女儿墙 */
      K.rect(g, 0, 180, 960, 10, K.shade(q.pal.wall, 6));
      K.rect(g, 0, 180, 960, 2, K.shade(q.pal.wall, 20));
      /* 地面 */
      K.rect(g, 0, 190, 960, 80, K.shade(q.pal.wall, -2));
      for (let i = 0; i < 10; i++) K.rect(g, 0, 196 + i * 8, 960, 1, K.shade(q.pal.wall, -8));
      for (let i = 0; i < 14; i++) K.rect(g, i * 70, 190, 2, 80, K.shade(q.pal.wall, -8));
      /* 花坛与植物 */
      for (let i = 0; i < 4; i++) {
        const px = 120 + i * 200 + q.b % 40;
        K.rect(g, px, 198, 60, 18, K.shade(q.pal.wall, -14));
        K.rect(g, px, 198, 60, 2, K.shade(q.pal.wall, 8));
        for (let k = 0; k < 7; k++) {
          K.rect(g, px + 6 + k * 8, 188 - (k % 3) * 4, 3, 12, k % 2 ? '#1e3328' : '#24402e');
        }
      }
      /* 椅与灯串 */
      K.rect(g, 780, 200, 34, 4, '#4a3a2a');
      K.rect(g, 780, 186, 4, 20, '#4a3a2a');
      K.rect(g, 810, 186, 4, 20, '#4a3a2a');
      for (let i = 0; i < 8; i++) K.rect(g, 400 + i * 52, 120 + Math.round(Math.sin(i * 0.9) * 8), 2, 2, q.pal.warm);
      /* 水箱剪影 */
      K.rect(g, 60, 148, 70, 44, '#241e28');
      K.rect(g, 66, 192, 6, 12, '#1a1620');
      K.rect(g, 118, 192, 6, 12, '#1a1620');
      wetFloor(g, 240, 960, q, q.seed + 29);
    },
    live(g, t, q, shot, cam) {
      if (LIGHTS[q.v]) P.lamps(g, LIGHTS[q.v], t);
      for (let i = 0; i < 8; i++) {
        const lx = 400 + i * 52;
        const ly = 120 + Math.round(Math.sin(i * 0.9) * 8 + Math.sin(t + i) * 1);
        K.rect(g, lx, ly, 2, 2, q.pal.warm);
        P.glow(g, lx + 1, ly + 1, 10, q.pal.warm, 0.12 + 0.06 * Math.sin(t * 2.7 + i));
      }
      /* 植物摇 */
      for (let i = 0; i < 7; i++) {
        g.save();
        g.globalAlpha = 0.5;
        K.rect(g, 126 + i * 8 + Math.round(Math.sin(t * 1.2 + i) * 1.5), 186, 2, 10, '#24402e');
        g.restore();
      }
      /* 探照灯 */
      const sweep = (Math.sin(t * 0.3 + q.v) * 0.5 + 0.5) * 960;
      g.save();
      g.globalAlpha = 0.06;
      for (let i = 0; i < 30; i++) K.rect(g, sweep + i * 4 - 60, 20 + i * 5, 3, 3, '#cfe0ff');
      g.restore();
      atmo(g, t, q, cam);
      actor(g, t, shot);
    }
  };

  /* ---------------- 统一入口 ---------------- */

  S.gen = {
    w: 960, h: 270,
    world(v, shot) {
      const s = shot || { v: v, g: 'crossing' };
      const key = 'gen' + (s.v | 0) + '|' + s.g;
      return world(key, 960, 270, (g) => {
        const q = qFor(s);
        const arc = GEN[s.g] || GEN.crossing;
        arc.base(g, q);
        const name = GEN[s.g] ? s.g : 'crossing';
        dress(g, q, GY[name], OUTDOOR[name] !== false);
      });
    },
    live(g, t, shot, cam) {
      const q = qFor(shot);
      const arc = GEN[shot.g] || GEN.crossing;
      arc.live(g, t, q, shot, cam);
    }
  };

  S.gen.archetypes = Object.keys(GEN);
})(typeof window !== 'undefined' ? window : null);
