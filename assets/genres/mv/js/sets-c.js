/* 场景库 C：站台 / 桥 / 江边 / 天台 */
(function (root) {
  'use strict';
  const K = root.PIXEL_KIT;
  const P = root.PIXEL_PAINT;
  const A = root.PIXEL_ACTORS;
  const S = root.PIXEL_SETS = root.PIXEL_SETS || {};

  function world(key, w, h, paint) {
    return K.cachedWorld(key, () => {
      const cv = K.make(w, h);
      paint(cv.getContext('2d'), cv);
      cv.getContext('2d').getImageData(0, 0, 1, 1);
      return cv;
    });
  }

  function vno(v, salt, min, max) { return K.vi((v | 0) || 1, salt, min, max); }

  /* 每镜的结构参数：画家与动态层共用，保证灯、柱、拱对得上 */
  function platformParams(v) {
    return {
      n: 4 + vno(v, 41, 0, 2),
      bench: vno(v, 43, 0, 1),
      signX: 60 + vno(v, 44, 0, 240),
      trainOff: vno(v, 45, 0, 700)
    };
  }

  function bridgeParams(v) {
    return {
      r: 112 + vno(v, 41, 0, 66),
      h: 92 + vno(v, 42, 0, 38),
      lampN: 9 + vno(v, 43, 0, 5),
      lampStep: 72 + vno(v, 44, 0, 18),
      seed: vno(v, 45, 0, 900)
    };
  }

  function roofParams(v) {
    return {
      tankX: 360 + vno(v, 51, 0, 220),
      antX: 40 + vno(v, 52, 0, 250),
      lineX: 90 + vno(v, 53, 0, 200),
      chairX: 260 + vno(v, 54, 0, 120),
      seed: vno(v, 55, 0, 900)
    };
  }

  function riverParams(v) {
    return {
      seed: vno(v, 41, 0, 900),
      lampN: 4 + vno(v, 42, 0, 3),
      lampStep: 140 + vno(v, 43, 0, 70),
      treeX: [40 + vno(v, 44, 0, 170), 300 + vno(v, 45, 0, 170), 680 + vno(v, 46, 0, 200)],
      bench: vno(v, 47, 0, 1),
      boat: vno(v, 48, 0, 1),
      seed2: vno(v, 49, 0, 900)
    };
  }

  /* ============ 站台 ============ */
  S.platform = {
    w: 900, h: 270,
    world(v) {
      const pp = platformParams(v);
      return world('platform' + (v | 0), 900, 270, (g) => {
        K.grad(g, 0, 0, 900, 270, [
          { p: 0, c: '#0a0e18' },
          { p: 0.5, c: '#12161e' },
          { p: 1, c: '#1a1a20' }
        ]);
        /* 后墙瓷砖 */
        K.rect(g, 0, 40, 900, 150, '#1a1e26');
        for (let y = 44; y < 188; y += 12) {
          for (let x = 0; x < 900; x += 24) {
            const c = K.rnd(x * 0.3 + y * 0.9) > 0.86 ? '#232833' : '#1e222c';
            K.rect(g, x, y, 23, 11, c);
          }
        }
        K.rect(g, 0, 36, 900, 4, '#2a3040');
        K.rect(g, 0, 188, 900, 4, '#2a3040');
        /* 立柱 */
        const step = Math.round(900 / (pp.n + 1));
        for (let i = 0; i < pp.n; i++) {
          const cx = step * (i + 1) - 8;
          K.rect(g, cx, 34, 16, 158, '#262c3a');
          K.rect(g, cx + 1, 34, 4, 158, '#313a4c');
          K.rect(g, cx, 34, 16, 3, '#3a4458');
        }
        /* 站名牌 */
        K.rect(g, pp.signX, 60, 108, 30, '#101a30');
        K.frame(g, pp.signX, 60, 108, 30, '#3a4a68');
        for (let i = 0; i < 4; i++) K.rect(g, pp.signX + 8 + i * 24, 68, 16, 12, '#c9d8f0');
        /* 轨道与对面 */
        K.rect(g, 0, 196, 900, 12, '#0a0c12');
        K.rect(g, 0, 196, 900, 2, '#2a3040');
        K.rect(g, 0, 208, 900, 14, '#06080e');
        /* 对面轨道墙 */
        K.rect(g, 0, 222, 900, 48, '#0c1018');
        for (let i = 0; i < 6; i++) K.rect(g, 40 + i * 160, 226, 3, 44, '#151a24');
        /* 站台地面 */
        K.rect(g, 0, 222, 900, 48, '#191d26');
        for (let i = 0; i < 14; i++) K.rect(g, 0, 226 + i * 4, 900, 1, '#141820');
        /* 黄色安全线 */
        K.rect(g, 0, 216, 900, 4, '#8a7a2a');
        K.rect(g, 0, 216, 900, 1, '#c9b24a');
        /* 长椅 / 杂物 */
        const bx = pp.bench ? 660 : 90;
        K.rect(g, bx, 200, 58, 4, '#3a3040');
        K.rect(g, bx, 196, 58, 3, '#4a3e50');
        K.rect(g, bx + 4, 204, 3, 14, '#2a2230');
        K.rect(g, bx + 50, 204, 3, 14, '#2a2230');
        if (!pp.bench) P.bike(g, 690, 214);
        /* 顶灯 */
        for (let i = 0; i < 6; i++) K.rect(g, 40 + i * 150, 8, 90, 5, '#cfd8e8');
      });
    },
    live(g, t, shot, cam) {
      /* 顶灯闪 */
      for (let i = 0; i < 6; i++) {
        g.save();
        g.globalAlpha = 0.10 + 0.05 * Math.sin(t * 3.1 + i * 1.7);
        K.rect(g, 40 + i * 150, 6, 90, 8, '#e8f0ff');
        g.restore();
      }
      /* 对面的列车 */
      const pp = platformParams(shot.v || 1);
      if (shot.train !== false) {
        const tx = -120 + ((t * 190 + pp.trainOff) % 1250);
        if (tx < 900) {
          g.save();
          g.globalAlpha = 0.95;
          /* 车体 */
          K.rect(g, tx, 96, 420, 100, '#232a38');
          K.rect(g, tx, 96, 420, 4, '#3a4458');
          K.rect(g, tx, 190, 420, 6, '#151a22');
          for (let i = 0; i < 6; i++) {
            K.rect(g, tx + 16 + i * 66, 110, 52, 44, '#ffe9a8');
            K.rect(g, tx + 16 + i * 66, 110, 52, 3, '#fff8dc');
            /* 车厢里有人 */
            if (K.rnd(i * 3.1 + 1) > 0.45) {
              K.rect(g, tx + 30 + i * 66, 132, 14, 22, '#0d1220');
              K.rect(g, tx + 33 + i * 66, 126, 8, 8, '#0d1220');
            }
          }
          K.rect(g, tx, 100, 420, 2, '#4a566e');
          g.restore();
          /* 车灯 */
          g.save();
          g.globalAlpha = 0.5;
          K.rect(g, tx - 34, 150, 34, 10, '#ffe9a8');
          g.restore();
          P.glow(g, tx - 20, 156, 44, '#ffe9a8', 0.18);
        }
        /* 列车掠过的风 */
        for (let i = 0; i < 10; i++) {
          const lx = ((t * 300 + i * 90) % 1100) - 100;
          g.save();
          g.globalAlpha = 0.10 + 0.06 * Math.sin(t * 6 + i);
          K.rect(g, lx, 100 + (i % 5) * 18, 40, 2, '#8fa4cd');
          g.restore();
        }
      }
      /* 站台反光 */
      for (let i = 0; i < 9; i++) {
        const rx = 60 + K.rnd(i * 3.3) * 800;
        g.save();
        g.globalAlpha = 0.10 + 0.05 * Math.sin(t * 1.6 + i);
        K.rect(g, rx, 226 + K.rnd(i * 5.7) * 30, 30 + K.rnd(i * 2.1) * 40, 1, '#8fa4cd');
        g.restore();
      }
      /* 人 */
      const w = shot.who;
      if (w) {
        if (w.k === 'girl') A.girl(g, w.x, w.y, t, w);
        else if (w.k === 'boy') A.boy(g, w.x, w.y, t, w);
      }
    }
  };

  /* ============ 桥 ============ */
  S.bridge = {
    w: 960, h: 270,
    world(v) {
      const bp = bridgeParams(v);
      return world('bridge' + (v | 0), 960, 270, (g) => {
        K.grad(g, 0, 0, 960, 190, [
          { p: 0, c: '#060a18' },
          { p: 0.55, c: '#101a38' },
          { p: 1, c: '#26305a' }
        ]);
        if (S.variant) S.variant.sky(g, v, { w: 960, hz: 168 });
        P.skylineSil(g, 0, 186, 960, 60, '#0a1024', bp.seed);
        const lights = P.buildings(g, {
          x0: -10, x1: 970, baseY: 188,
          count: 16 + (bp.seed % 9), wMin: 24, wMax: 56, hMin: 30, hMax: 76 + (bp.seed % 30),
          seed: bp.seed + 7, shades: ['#0d1428', '#101a30', '#0b1222'],
          windows: true, litAt: 0.6
        });
        this.lights = lights;
        (this.lightsByV = this.lightsByV || {})[v | 0] = lights;
        /* 江 */
        K.rect(g, 0, 190, 960, 80, '#0a1020');
        P.river(g, 0, 190, 960, 80, 0, 3);
        /* 桥体 */
        K.rect(g, 0, 176, 960, 8, '#2a3350');
        K.rect(g, 0, 176, 960, 2, '#465478');
        K.rect(g, 0, 184, 960, 5, '#1a2138');
        /* 栏杆 */
        for (let i = 0; i < 40; i++) K.rect(g, i * 24, 158, 2, 18, '#3a4668');
        K.rect(g, 0, 156, 960, 3, '#4a5878');
        K.rect(g, 0, 170, 960, 2, '#3a4668');
        /* 桥拱（水里补成圆） */
        for (let i = 0; i < 40; i++) {
          const cx = 480 + Math.cos(Math.PI + i * Math.PI / 39) * bp.r;
          const cy = 176 - Math.sin(i * Math.PI / 39) * bp.h;
          K.rect(g, Math.round(cx), Math.round(cy), 3, 3, '#3a4a74');
        }
        for (let i = 0; i < 40; i++) {
          const cx = 480 + Math.cos(Math.PI + i * Math.PI / 39) * bp.r;
          const cy = 184 + Math.sin(i * Math.PI / 39) * 60;
          g.save();
          g.globalAlpha = 0.35;
          K.rect(g, Math.round(cx), Math.round(cy), 3, 3, '#46587e');
          g.restore();
        }
        /* 桥上的灯 */
        for (let i = 0; i < bp.lampN; i++) K.rect(g, 24 + i * bp.lampStep, 148, 3, 10, '#ffe9a8');
        /* 引桥 */
        K.rect(g, 0, 190, 960, 3, '#2a3350');
        if (S.variant) S.variant.dress(g, v, { w: 960, hz: 188, gy: 176 });
      });
    },
    live(g, t, shot, cam) {
      const L = this.lightsByV && this.lightsByV[(shot.v || 1) | 0];
      if (L) P.lamps(g, L, t);
      /* 江面 */
      g.save();
      g.beginPath();
      g.rect(0, 190, 960, 80);
      g.clip();
      for (let i = 0; i < 60; i++) {
        const ry = 192 + Math.floor(K.rnd(i * 4.7) * 76);
        const rw = 2 + Math.floor(K.rnd(i * 6.1) * 22);
        const rx = (K.rnd(i * 2.9) * 960 + Math.sin(t * 1.1 + i) * 5 + 960) % 960;
        g.globalAlpha = 0.16 + 0.3 * K.rnd(i * 3.1) + 0.1 * Math.sin(t * 1.9 + i);
        K.rect(g, rx, ry, rw, 1, i % 4 === 0 ? '#8fd8d2' : (i % 3 ? '#f2c05e' : '#4a5d8a'));
      }
      g.restore();
      /* 桥灯呼吸 */
      const bp = bridgeParams(shot.v || 1);
      for (let i = 0; i < bp.lampN; i++) {
        const lx = 24 + i * bp.lampStep;
        const fl = 0.7 + 0.12 * Math.sin(t * 4.1 + i * 1.3);
        P.glow(g, lx + 1, 148, 18, '#ffe9a8', fl * 0.24);
        K.rect(g, lx, 148, 3, 10, '#ffe9a8');
      }
      /* 过桥的车 */
      for (let c = 0; c < 4; c++) {
        const cx = ((t * (60 + c * 30) + c * 260) % 1200) - 120;
        K.rect(g, cx, 170, 14, 5, c % 2 ? '#1a2138' : '#22284a');
        K.rect(g, cx + 2, 168, 10, 2, c % 2 ? '#1a2138' : '#22284a');
        K.rect(g, cx + 13, 171, 2, 2, '#ffe9a8');
        g.save();
        g.globalAlpha = 0.18;
        K.rect(g, cx - 16, 172, 16, 2, '#ffe9a8');
        g.restore();
      }
      /* 桥拱灯带 */
      for (let i = 0; i < 40; i++) {
        const a = Math.PI + i * Math.PI / 39;
        const cx = 480 + Math.cos(a) * bp.r;
        const cy = 176 - Math.sin(a) * bp.h;
        const on = Math.sin(t * 2.4 + i * 0.4) > -0.55;
        if (on) K.rect(g, Math.round(cx), Math.round(cy), 3, 3, i % 5 === 0 ? '#8fd8d2' : '#6a86b8');
      }
      /* 人 */
      const w = shot.who;
      if (w) {
        if (w.k === 'girl') A.girl(g, w.x, w.y, t, w);
        else if (w.k === 'boy') A.boy(g, w.x, w.y, t, w);
      }
      if (shot.rain) P.rainStreaks(g, t, { x: cam.x, y: 0, w: cam.w, h: 270, count: 50, seed: 37, alpha: 0.22, speed: 280 });
    }
  };

  /* ============ 江边步道 ============ */
  S.river = {
    w: 960, h: 270,
    world(v) {
      const rp = riverParams(v);
      return world('river' + (v | 0), 960, 270, (g) => {
        K.grad(g, 0, 0, 960, 170, [
          { p: 0, c: '#070b1a' },
          { p: 0.5, c: '#141d3c' },
          { p: 1, c: '#333a62' }
        ]);
        if (S.variant) S.variant.sky(g, v, { w: 960, hz: 146 });
        /* 对岸 */
        P.skylineSil(g, 0, 156, 960, 52, '#0a1022', rp.seed);
        const lights = P.buildings(g, {
          x0: -6, x1: 966, baseY: 158,
          count: 18 + (rp.seed % 10), wMin: 16, wMax: 40, hMin: 18, hMax: 52 + (rp.seed % 26),
          seed: rp.seed + 3, shades: ['#0c1428', '#0f1830', '#0b1224'],
          windows: true, litAt: 0.58
        });
        this.lights = lights;
        (this.lightsByV = this.lightsByV || {})[v | 0] = lights;
        /* 江面 */
        K.rect(g, 0, 160, 960, 66, '#0a1022');
        P.river(g, 0, 160, 960, 66, 0, 53 + (rp.seed % 20));
        /* 步道 */
        K.rect(g, 0, 218, 960, 52, '#2a2632');
        for (let y = 222; y < 270; y += 6) K.rect(g, 0, y, 960, 1, '#221e2a');
        for (let i = 0; i < 22; i++) K.rect(g, i * 44, 218, 1, 52, '#221e2a');
        /* 栏杆 */
        K.rect(g, 0, 210, 960, 3, '#3a4258');
        K.rect(g, 0, 224, 960, 2, '#2e3446');
        for (let i = 0; i < 40; i++) K.rect(g, i * 24, 206, 2, 20, '#3a4258');
        /* 路灯 */
        for (let i = 0; i < rp.lampN; i++) {
          const lx = 24 + i * rp.lampStep;
          K.rect(g, lx, 158, 2, 62, '#232a45');
          K.rect(g, lx - 2, 152, 7, 6, '#2e3757');
          K.rect(g, lx - 1, 148, 5, 4, '#ffe9a8');
        }
        /* 树 */
        for (let i = 0; i < 3; i++) {
          P.tree(g, rp.treeX[i], 216, 52 + ((rp.seed + i * 7) % 26), rp.seed + i * 2, 0);
        }
        /* 长椅 / 自行车 / 泊船 */
        if (rp.bench) P.bench(g, 340 + (rp.seed % 120), 236);
        else P.bike(g, 380 + (rp.seed % 100), 236);
        if (rp.boat) {
          const bx = 420 + (rp.seed % 300);
          K.rect(g, bx, 190, 46, 5, '#0d1424');
          K.rect(g, bx + 4, 186, 30, 4, '#111a2c');
          K.rect(g, bx + 40, 188, 6, 3, '#161f34');
          g.save();
          g.globalAlpha = 0.5;
          K.rect(g, bx + 6, 187, 8, 2, '#e8b45c');
          g.restore();
        }
        if (S.variant) S.variant.dress(g, v, { w: 960, hz: 158, gy: 218 });
      });
    },
    live(g, t, shot, cam) {
      const rp = riverParams(shot.v || 1);
      const L = this.lightsByV && this.lightsByV[(shot.v || 1) | 0];
      if (L) P.lamps(g, L, t);
      /* 江面 */
      g.save();
      g.beginPath();
      g.rect(0, 160, 960, 66);
      g.clip();
      for (let i = 0; i < 70; i++) {
        const ry = 162 + Math.floor(K.rnd(rp.seed2 + i * 4.3) * 62);
        const rw = 2 + Math.floor(K.rnd(rp.seed2 + i * 6.7) * 20);
        const rx = (K.rnd(rp.seed2 + i * 2.7) * 960 + Math.sin(t * 1.3 + i) * 6 + 960) % 960;
        g.globalAlpha = 0.14 + 0.28 * K.rnd(rp.seed2 + i * 3.9) + 0.12 * Math.sin(t * 2.1 + i);
        K.rect(g, rx, ry, rw, 1, i % 5 === 0 ? '#8fd8d2' : (i % 3 ? '#f2c05e' : '#4a5d8a'));
      }
      g.restore();
      /* 路灯 */
      for (let i = 0; i < rp.lampN; i++) {
        const lx = 24 + i * rp.lampStep;
        const fl = P.lampPost(g, lx, 220, t, 62);
        P.glow(g, lx, 216, 40, '#f2c05e', fl * 0.11);
      }
      /* 地面反光 */
      for (let i = 0; i < 12; i++) {
        const rx = 40 + K.rnd(rp.seed2 + i * 3.1) * 880;
        g.save();
        g.globalAlpha = 0.08 + 0.05 * Math.sin(t * 1.2 + i);
        K.rect(g, rx, 226 + K.rnd(rp.seed2 + i * 5.1) * 38, 40 + K.rnd(rp.seed2 + i * 2.3) * 60, 1, '#8fa4cd');
        g.restore();
      }
      /* 跑步的人 */
      const w = shot.who;
      if (w) {
        if (w.k === 'girl') A.girl(g, w.x, w.y, t, w);
        else if (w.k === 'boy') A.boy(g, w.x, w.y, t, w);
      }
      /* 风吹过树 */
      for (let i = 0; i < 3; i++) {
        P.tree(g, rp.treeX[i], 216, 52 + ((rp.seed + i * 7) % 26), rp.seed + i * 2, t);
      }
    }
  };

  /* ============ 天台 ============ */
  S.roof = {
    w: 720, h: 270,
    world(v) {
      const rf = roofParams(v);
      return world('roof' + (v | 0), 720, 270, (g) => {
        K.grad(g, 0, 0, 720, 200, [
          { p: 0, c: '#070b1a' },
          { p: 0.5, c: '#131c3c' },
          { p: 1, c: '#2a3158' }
        ]);
        if (S.variant) S.variant.sky(g, v, { w: 720, hz: 160 });
        P.skylineSil(g, 0, 176, 720, 44, '#0a1020', rf.seed);
        const lights = P.buildings(g, {
          x0: -8, x1: 730, baseY: 178,
          count: 14 + (rf.seed % 9), wMin: 18, wMax: 44, hMin: 22, hMax: 52 + (rf.seed % 24),
          seed: rf.seed + 5, shades: ['#0c1326', '#0f172e', '#0a1122'],
          windows: true, litAt: 0.6, antenna: true
        });
        this.lights = lights;
        (this.lightsByV = this.lightsByV || {})[v | 0] = lights;
        /* 天台的女儿墙 */
        K.rect(g, 0, 178, 720, 8, '#2a2634');
        K.rect(g, 0, 178, 720, 2, '#3e3a4a');
        /* 天台地面 */
        K.grad(g, 0, 186, 720, 84, [
          { p: 0, c: '#242030' },
          { p: 1, c: '#120f1a' }
        ]);
        for (let y = 192; y < 270; y += 14) K.rect(g, 0, y, 720, 1, '#1c1826');
        for (let i = 0; i < 10; i++) K.rect(g, i * 74, 186, 1, 84, '#1c1826');
        /* 水箱 */
        const tx = rf.tankX;
        K.rect(g, tx, 118, 90, 62, '#2a2634');
        K.rect(g, tx, 118, 90, 3, '#3e3a4a');
        K.rect(g, tx + 10, 180, 8, 18, '#1a1622');
        K.rect(g, tx + 70, 180, 8, 18, '#1a1622');
        K.rect(g, tx + 8, 128, 74, 2, '#1a1622');
        /* 天线 */
        const ax = rf.antX;
        K.rect(g, ax, 92, 2, 96, '#2a2634');
        K.rect(g, ax - 12, 104, 26, 2, '#2a2634');
        K.rect(g, ax - 8, 116, 18, 2, '#2a2634');
        K.rect(g, ax - 18, 96, 38, 1, '#38334a');
        /* 空调外机 */
        K.rect(g, 120, 158, 26, 20, '#2a2634');
        K.rect(g, 123, 161, 20, 14, '#1a1622');
        K.ring(g, 133, 168, 5, '#151220');
        /* 晾衣绳与衣服 */
        P.laundry(g, rf.lineX, 96, 0, rf.seed);
        /* 旧椅子 */
        const chx = rf.chairX;
        K.rect(g, chx, 172, 22, 3, '#3a2a2a');
        K.rect(g, chx + 2, 162, 18, 3, '#3a2a2a');
        K.rect(g, chx + 2, 175, 2, 12, '#2a1c1c');
        K.rect(g, chx + 18, 175, 2, 12, '#2a1c1c');
        /* 花盆 */
        K.rect(g, chx + 90, 168, 16, 12, '#2a1a20');
        for (let i = 0; i < 6; i++) {
          K.rect(g, chx + 92 + Math.floor(K.rnd(rf.seed + i * 3.7) * 12), 158 + Math.floor(K.rnd(rf.seed + i * 5.1) * 8), 2, 6, '#1e3328');
        }
        if (S.variant) S.variant.dress(g, v, { w: 720, hz: 178, gy: 190 });
      });
    },
    live(g, t, shot, cam) {
      const rf = roofParams(shot.v || 1);
      const L = this.lightsByV && this.lightsByV[(shot.v || 1) | 0];
      if (L) P.lamps(g, L, t);
      P.clouds(g, 720, 40, t, rf.seed, '#1c2448');
      /* 天线红灯 */
      g.save();
      g.globalAlpha = Math.sin(t * 2.1) > 0.2 ? 0.95 : 0.2;
      K.rect(g, rf.antX, 90, 2, 2, '#e8404a');
      g.restore();
      /* 晾衣 */
      P.laundry(g, rf.lineX, 96, t, rf.seed);
      /* 天台积水反光 */
      for (let i = 0; i < 5; i++) {
        const rx = 40 + K.rnd(i * 3.3) * 620;
        g.save();
        g.globalAlpha = 0.10 + 0.06 * Math.sin(t * 1.5 + i);
        K.rect(g, rx, 230 + K.rnd(i * 4.7) * 30, 30 + K.rnd(i * 2.9) * 40, 1, '#8fa4cd');
        g.restore();
      }
      /* 探照灯扫过夜空 */
      const sweep = (Math.sin(t * 0.35) * 0.5 + 0.5) * 720;
      g.save();
      g.globalAlpha = 0.07;
      for (let i = 0; i < 30; i++) {
        K.rect(g, sweep + i * 4 - 60, 20 + i * 5, 3, 3, '#cfe0ff');
      }
      g.restore();
      /* 人 */
      const w = shot.who;
      if (w) {
        if (w.k === 'girl') A.girl(g, w.x, w.y, t, w);
        else if (w.k === 'boy') A.boy(g, w.x, w.y, t, w);
      }
    }
  };
})(typeof window !== 'undefined' ? window : null);
