/* 场景库 A：城市天际线 / 女孩的房间 / 玻璃特写 / 夜车 */
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

  /* 城市：每镜一条不同的天际线（层数/高度/桥位/星量都从 v 派生） */
  function cityParams(v) {
    const pal = [
      [{ p: 0, c: '#060a18' }, { p: 0.55, c: '#111a38' }, { p: 1, c: '#2c3055' }],
      [{ p: 0, c: '#080a14' }, { p: 0.5, c: '#1a1c3a' }, { p: 1, c: '#3a3050' }],
      [{ p: 0, c: '#050c16' }, { p: 0.6, c: '#0e2032' }, { p: 1, c: '#243a52' }]
    ][K.vi(v, 1, 0, 2)];
    return {
      pal: pal,
      stars: K.vi(v, 2, 18, 60),
      farSeed: K.vi(v, 3, 0, 300),
      farH: K.vi(v, 4, 44, 78),
      midSeed: K.vi(v, 5, 0, 600),
      midCount: K.vi(v, 6, 16, 34),
      midHmin: K.vi(v, 7, 30, 54),
      midHmax: K.vi(v, 8, 88, 140),
      nearCount: K.vi(v, 9, 8, 18),
      nearSeed: K.vi(v, 10, 0, 500),
      bridgeX: K.vi(v, 11, 60, 660),
      bridgeW: K.vi(v, 12, 190, 360),
      bridgePiers: K.vi(v, 13, 3, 6),
      boats: K.vi(v, 14, 1, 3)
    };
  }

  function windowParams(v) {
    return {
      mx: 170 + K.vi((v | 0) || 1, 41, 0, 140),
      my: 104 + K.vi((v | 0) || 1, 42, 0, 48),
      shardX: 190 + K.vi((v | 0) || 1, 43, 0, 120),
      shardY: 168 + K.vi((v | 0) || 1, 44, 0, 44),
      seed: K.vi((v | 0) || 1, 45, 0, 900),
      rail: K.vi((v | 0) || 1, 46, 0, 1),
      lampX: 320 + K.vi((v | 0) || 1, 47, 0, 120)
    };
  }

  function windowSpots(v) {
    const sd = K.vi((v | 0) || 1, 48, 0, 900);
    const cols = ['#2c3f6b', '#33406a', '#3a2c50', '#2a3a66', '#c9703e'];
    const out = [];
    for (let i = 0; i < 10; i++) {
      out.push([
        Math.round(K.rnd(sd + i * 3.1) * 470),
        40 + Math.round(K.rnd(sd + i * 5.7) * 200),
        14 + Math.round(K.rnd(sd + i * 7.3) * 20),
        cols[i % cols.length],
        0.16 + K.rnd(sd + i * 2.3) * 0.14
      ]);
    }
    return out;
  }

  function carParams(v) {
    const k = (v | 0) || 1;
    return {
      seed: K.vi(k, 41, 0, 900),
      poleX: 480 + K.vi(k, 42, 0, 80),
      strapN: 6 + K.vi(k, 43, 0, 3),
      bandY: 30 + K.vi(k, 44, 0, 12),
      bandH: 116 + K.vi(k, 45, 0, 14),
      extra: K.vi(k, 46, 0, 1),
      rainN: 12 + K.vi(k, 47, 0, 10)
    };
  }

  S.city = {
    w: 960, h: 270,
    world(v) {
      const q = cityParams(v || 1);
      return world('city' + (v | 0), 960, 270, (g) => {
        P.sky(g, 960, 200, q.pal);
        P.stars(g, 960, 150, 0, q.stars, 7);
        /* 远层 */
        P.skylineSil(g, 0, 200, 960, q.farH, '#0b1226', q.farSeed);
        /* 中层：有窗 */
        const mid = P.buildings(g, {
          x0: -10, x1: 970, baseY: 202,
          count: q.midCount, wMin: 22, wMax: 52, hMin: q.midHmin, hMax: q.midHmax,
          seed: q.midSeed, shades: ['#0e1630', '#121a38', '#0c1330'],
          windows: true, litAt: 0.62, antenna: true
        });
        /* 近层：压暗轮廓 */
        P.buildings(g, {
          x0: -20, x1: 980, baseY: 208,
          count: q.nearCount, wMin: 34, wMax: 70, hMin: 30, hMax: 74,
          seed: q.nearSeed, shades: ['#05080f'], windows: false,
          edge: '#141a30', edge2: '#0a0e1c', gap: 6
        });
        /* 江 */
        K.rect(g, 0, 204, 960, 66, '#0a0f22');
        P.river(g, 0, 204, 960, 66, 0, 5);
        K.rect(g, 0, 203, 960, 1, '#2a3560');
        /* 远处桥：位置与跨度每镜不同 */
        K.rect(g, q.bridgeX, 176, q.bridgeW, 4, '#1a2240');
        for (let i = 0; i < q.bridgePiers; i++) {
          K.rect(g, q.bridgeX + 20 + i * Math.floor(q.bridgeW / q.bridgePiers), 180, 3, 26, '#161d36');
        }
        for (let i = 0; i < 10; i++) K.rect(g, q.bridgeX + 10 + i * 30, 174, 1, 3, '#3a4670');
        this.lights = mid;
        (this.lightsByV = this.lightsByV || {})[v | 0] = mid;
      });
    },
    live(g, t, shot, cam) {
      const q = cityParams(shot.v || 1);
      const lights = this.lightsByV && this.lightsByV[(shot.v || 1) | 0];
      if (lights) P.lamps(g, lights, t);
      /* 江面 */
      const x0 = Math.max(0, cam.x - 40);
      const x1 = Math.min(960, cam.x + cam.w + 40);
      g.save();
      g.beginPath();
      g.rect(x0, 204, x1 - x0, 66);
      g.clip();
      for (let i = 0; i < 70; i++) {
        const ry = 206 + Math.floor(K.rnd(i * 4.9) * 62);
        const rw = 2 + Math.floor(K.rnd(i * 7.1) * 24);
        const rx = ((K.rnd(i * 2.3) * 960 + Math.sin(t * 0.9 + i) * 4 + 960) % 960);
        const col = i % 5 === 0 ? P.PAL.cyan : (i % 3 === 0 ? P.PAL.warm : '#3a4a7a');
        g.globalAlpha = 0.14 + 0.26 * K.rnd(i * 3.7) + 0.10 * Math.sin(t * 1.6 + i * 0.9);
        K.rect(g, rx, ry, rw, 1, col);
      }
      g.restore();
      /* 船 */
      for (let b = 0; b < q.boats; b++) {
        const bx = ((t * (7 + b * 4) + b * 420) % 1100) - 80;
        const by = 226 + b * 20;
        K.rect(g, bx, by, 16, 3, '#0d1226');
        K.rect(g, bx + 4, by - 3, 8, 3, '#151d3a');
        K.rect(g, bx + 7 + (b % 2), by - 4, 1, 1, P.PAL.warm);
        g.save();
        g.globalAlpha = 0.3 + 0.1 * Math.sin(t * 2 + b);
        K.rect(g, bx + 2, by + 3, 12, 1, '#5a6a9a');
        g.restore();
      }
      /* 桥上过车 */
      for (let c = 0; c < 3; c++) {
        const cx = q.bridgeX + ((t * (26 + c * 9) + c * 90) % Math.max(60, q.bridgeW - 40));
        K.rect(g, cx, 172, 4, 2, c % 2 ? '#ffe9a8' : '#c9402e');
      }
      if (shot.rain) {
        P.rainStreaks(g, t, { x: cam.x, y: 0, w: cam.w, h: 270, count: 70, seed: 9, alpha: 0.3 * shot.rain, speed: 300 });
      }
      if (shot.who) this.actor(g, t, shot);
    },
    actor(g, t, shot) {
      const w = shot.who;
      if (w.k === 'girl') A.girl(g, w.x, w.y, t, w);
      else if (w.k === 'boy') A.boy(g, w.x, w.y, t, w);
    }
  };

  /* 房间：每镜一间不同的屋子（窗位/家具/墙色/物件都从 v 派生） */
  function roomParams(v) {
    const walls = [
      [{ p: 0, c: '#0b0e1e' }, { p: 0.6, c: '#121428' }, { p: 1, c: '#1a1428' }],
      [{ p: 0, c: '#101018' }, { p: 0.6, c: '#181826' }, { p: 1, c: '#221a20' }],
      [{ p: 0, c: '#0a1018' }, { p: 0.6, c: '#101a24' }, { p: 1, c: '#18202a' }]
    ][K.vi(v, 1, 0, 2)];
    const floors = [
      [{ p: 0, c: '#4c3028' }, { p: 1, c: '#26161a' }],
      [{ p: 0, c: '#3e3a34' }, { p: 1, c: '#1e1c1a' }],
      [{ p: 0, c: '#46322a' }, { p: 1, c: '#221416' }]
    ][K.vi(v, 2, 0, 2)];
    const wx = K.vi(v, 3, 24, 132);
    const ww = K.vi(v, 4, 150, 236);
    const wy = K.vi(v, 5, 24, 42);
    const wh = K.vi(v, 6, 116, 158);
    const deskX = K.vi(v, 7, 180, 356);
    const deskW = K.vi(v, 8, 150, 210);
    const shelf = K.vi(v, 9, 0, 2);
    const shelfX = shelf === 0 ? 0 : K.vi(v, 10, 300, 470);
    const poster = K.vi(v, 11, 0, 3);
    const posterX = K.vi(v, 12, 400, 520);
    return {
      walls, floors, wx, ww, wy, wh, deskX, deskW,
      deskCol: ['#7c4c34', '#6a5a48', '#5c4a52'][K.vi(v, 13, 0, 2)],
      curtain: ['#2c2135', '#24303a', '#33242a'][K.vi(v, 14, 0, 2)],
      curtain2: ['#43304f', '#36505c', '#4c3440'][K.vi(v, 14, 0, 2)],
      shelf: shelf, shelfX: shelfX,
      poster: poster, posterX: posterX,
      lampX: deskX + deskW - 62,
      prop: K.vi(v, 15, 0, 4),
      cat: K.vi(v, 16, 0, 1) === 1
    };
  }

  S.room = {
    w: 620, h: 270,
    world(v) {
      const r = roomParams(v || 1);
      return world('room' + (v | 0), 620, 270, (g) => {
        K.grad(g, 0, 0, 620, 200, r.walls);
        for (let x = 0; x < 620; x += 16) K.rect(g, x, 0, 1, 200, K.shade(r.walls[1].c, 10));
        for (let y = 20; y < 190; y += 44) {
          for (let x = 8; x < 620; x += 16) K.rect(g, x, y, 1, 1, K.shade(r.walls[2].c, 12));
        }
        /* 地板 */
        K.grad(g, 0, 198, 620, 72, r.floors);
        for (let y = 206; y < 270; y += 12) K.rect(g, 0, y, 620, 1, K.shade(r.floors[1].c, 10));
        for (let i = 0; i < 12; i++) K.rect(g, 14 + i * 51, 208 + (i * 37) % 54, 1, 9, K.shade(r.floors[1].c, 6));
        K.rect(g, 0, 196, 620, 3, K.shade(r.floors[1].c, 14));

        /* 窗 */
        const wx = r.wx, wy = r.wy, ww = r.ww, wh = r.wh;
        K.rect(g, wx - 7, wy - 7, ww + 14, wh + 14, '#251a1e');
        K.rect(g, wx - 3, wy - 3, ww + 6, wh + 6, '#4d382e');
        K.rect(g, wx, wy, ww, wh, '#0d1630');
        P.farCity(g, wx + 1, wy + 1, ww - 2, wh - 2, 0, 6, { top: '#101a38', mid: '#1d2c55', bot: '#3e5180' });
        K.rect(g, wx + Math.floor(ww / 2) - 2, wy, 4, wh, '#3a2a2a');
        K.rect(g, wx, wy + Math.floor(wh / 2) - 2, ww, 4, '#3a2a2a');
        K.frame(g, wx, wy, ww, wh, '#5a4034');
        K.rect(g, wx - 9, wy + wh + 2, ww + 18, 7, '#5a4034');
        K.rect(g, wx - 9, wy + wh + 8, ww + 18, 1, '#241a18');

        /* 窗帘 */
        K.rect(g, wx - 32, wy - 14, 30, wh + 30, r.curtain);
        for (let x = wx - 29; x < wx - 2; x += 6) K.rect(g, x, wy - 11, 2, wh + 24, r.curtain2);
        K.rect(g, wx - 32, wy - 14, 30, 3, K.shade(r.curtain, -14));
        K.rect(g, wx + ww + 2, wy - 14, 28, wh + 30, r.curtain);
        for (let x = wx + ww + 5; x < wx + ww + 28; x += 6) K.rect(g, x, wy - 11, 2, wh + 24, r.curtain2);
        K.rect(g, wx + ww + 2, wy - 14, 28, 3, K.shade(r.curtain, -14));

        /* 书架 */
        if (r.shelf) {
          const sx = r.shelfX;
          K.rect(g, sx, 34, 96, 84, '#2a1c24');
          K.rect(g, sx + 3, 37, 90, 78, '#150f1a');
          for (let i = 0; i < 3; i++) {
            const by = 46 + i * 25;
            K.rect(g, sx + 4, by + 20, 88, 2, '#3a2830');
            for (let b = 0; b < 9; b++) {
              const bw = 5 + Math.floor(K.rnd(i * 13 + b * 3.1) * 5);
              const bh = 14 + Math.floor(K.rnd(i * 7 + b * 5.3) * 5);
              const col = ['#5a3a3a', '#3a4a6a', '#4a3a5a', '#6a4a30', '#2e4a44'][(i + b) % 5];
              K.rect(g, sx + 7 + b * 9 + (b > 5 ? 2 : 0), by + 20 - bh, bw, bh, col);
            }
          }
        }
        /* 墙上小画 / 挂钟 / 空墙 */
        if (r.poster === 1) {
          K.rect(g, r.posterX, 48, 58, 46, '#1a1424');
          K.rect(g, r.posterX + 3, 51, 52, 40, '#0c1020');
          K.frame(g, r.posterX + 3, 51, 52, 40, '#3a2a3a');
          for (let i = 0; i < 5; i++) {
            const px = r.posterX + 10 + Math.floor(K.rnd(i * 5.7) * 38);
            const py = 58 + Math.floor(K.rnd(i * 8.1) * 26);
            K.rect(g, px, py, 1, 1, '#d8b878');
          }
          K.line(g, r.posterX + 10, 76, r.posterX + 26, 62, '#8a6a3e', 1);
          K.line(g, r.posterX + 26, 62, r.posterX + 48, 70, '#8a6a3e', 1);
        } else if (r.poster === 2) {
          K.ring(g, r.posterX + 20, 66, 20, '#1a1424');
          K.ring(g, r.posterX + 20, 66, 18, '#0c1020');
          K.line(g, r.posterX + 20, 66, r.posterX + 20, 54, '#8a6a3e', 1);
          K.line(g, r.posterX + 20, 66, r.posterX + 28, 70, '#8a6a3e', 1);
        }

        /* 书桌 */
        const dx = r.deskX, dw = r.deskW;
        K.rect(g, dx, 176, dw, 10, r.deskCol);
        K.rect(g, dx, 176, dw, 2, K.shade(r.deskCol, 18));
        K.rect(g, dx, 186, dw, 22, K.shade(r.deskCol, -34));
        K.rect(g, dx + 6, 208, 8, 40, K.shade(r.deskCol, -46));
        K.rect(g, dx + dw - 14, 208, 8, 40, K.shade(r.deskCol, -46));
        K.rect(g, dx, 176, 4, 30, K.shade(r.deskCol, -20));

        /* 桌面物件：每镜不同 */
        if (r.prop === 0) {
          K.rect(g, dx + 42, 168, 26, 9, '#e8dcc0');
          K.rect(g, dx + 40, 170, 30, 7, '#d9c9a8');
          K.rect(g, dx + 46, 167, 18, 1, '#b9a887');
          K.rect(g, dx + 18, 164, 18, 13, '#3a241f');
        } else if (r.prop === 1) {
          K.rect(g, dx + 18, 166, 40, 4, '#3a4a6a');
          K.rect(g, dx + 20, 161, 36, 5, '#2e3c58');
          K.rect(g, dx + 60, 168, 12, 8, '#c9b56a');
        } else if (r.prop === 2) {
          K.rect(g, dx + 26, 158, 16, 18, '#2a3a2a');
          for (let i = 0; i < 6; i++) {
            K.rect(g, dx + 28 + (i % 3) * 5, 148 + Math.floor(i / 3) * 6, 4, 5, '#3a5a3a');
          }
        } else if (r.prop === 3) {
          K.rect(g, dx + 30, 160, 34, 16, '#4a3a30');
          K.rect(g, dx + 33, 163, 28, 10, '#c9a06a');
          K.rect(g, dx + 40, 165, 14, 2, '#e8c88a');
        } else {
          K.rect(g, dx + 24, 166, 30, 10, '#d8cbb0');
          K.rect(g, dx + 24, 170, 30, 2, '#b9a887');
          K.rect(g, dx + 58, 162, 6, 14, '#8a5c3e');
        }
        /* 台灯 */
        const lx = r.lampX;
        K.rect(g, lx - 16, 170, 30, 5, '#3a2620');
        K.rect(g, lx - 14, 167, 26, 3, '#6b4433');
        K.rect(g, lx - 1, 134, 3, 34, '#8a5c3e');
        K.rect(g, lx - 4, 132, 10, 3, '#a06a48');
        for (let i = 0; i < 11; i++) {
          const half = 4 + i;
          K.rect(g, lx - half, 121 + i, half * 2, 1, i > 7 ? '#f2c05e' : '#b8623e');
        }
        K.rect(g, lx - 6, 130, 14, 2, '#f2d492');
        /* 笔筒 / 杯子 */
        K.rect(g, dx + dw - 40, 154, 13, 20, '#3e4a6a');
        K.rect(g, dx + dw - 38, 156, 9, 16, '#55648a');
        K.rect(g, dx + dw - 36, 146, 2, 9, '#e8dcc0');
        K.rect(g, dx + dw - 32, 148, 2, 7, '#c95a44');
        /* 地面反光 */
        for (let y = 210; y < 262; y += 4) {
          const tt = 1 - Math.abs(y - 234) / 30;
          if (tt > 0) K.dither(g, dx + 78, y, 128, 3, K.shade(r.floors[1].c, 16), K.shade(r.floors[0].c, -8), Math.round(tt * 5));
        }
      });
    },
    live(g, t, shot, cam) {
      const r = roomParams(shot.v || 1);
      /* 窗外雨 */
      P.glassRain(g, t, { x: r.wx + 1, y: r.wy + 1, w: r.ww - 2, h: r.wh - 2, count: 26, seed: 4, color: '#8fa4cd' });
      /* 台灯呼吸 */
      const fl = 0.74 + 0.06 * Math.sin(t * 5.3) + 0.04 * Math.sin(t * 11.7);
      P.glow(g, r.lampX + 1, 140, 54, '#f2b35e', fl * 0.30);
      /* 蒸汽 */
      P.steam(g, r.deskX + 25, 162, t, 2, 7, '#c9b592', 26);
      /* 女孩写字 */
      if (shot.who !== false) {
        const girl = shot.who || { x: r.deskX + 94, y: 156 };
        A.sit(g, girl.x, girl.y, t, { coat: '#e9d9b8', hair: '#3a2740', ph: 0.4 });
        const px = girl.x - 24 + Math.round(Math.sin(t * 1.25) * 4);
        K.rect(g, px, 180, 16, 1, '#d9a04e');
        K.rect(g, px, 181, 16, 1, '#b87a38');
        K.rect(g, px - 3, 180, 3, 2, '#f2e4c6');
        K.rect(g, girl.x - 32, 176, 9, 5, '#e9d9b8');
        K.rect(g, girl.x - 32, 176, 9, 1, '#f4e7ca');
      }
      /* 猫在窗台 */
      if (r.cat) A.cat(g, r.wx + r.ww * 0.55, r.wy + r.wh + 6, t, 1.7);
      /* 灰尘 */
      for (let i = 0; i < 10; i++) {
        const x = r.lampX - 48 + Math.floor(K.rnd(i * 5.1) * 74 + Math.sin(t * 0.7 + i) * 4);
        const y = 140 + Math.floor((K.rnd(i * 7.3) * 50 + t * 5) % 50);
        g.save();
        g.globalAlpha = 0.2 + 0.2 * Math.sin(t * 1.9 + i);
        K.rect(g, x, y, 1, 1, '#f2d492');
        g.restore();
      }
      if (shot.rain) {
        P.rainStreaks(g, t, { x: cam.x, y: 0, w: cam.w, h: 270, count: 40, seed: 5, alpha: 0.18, speed: 240 });
      }
    }
  };

  /* ============ 玻璃特写（另一个人） ============ */
  S.window = {
    w: 480, h: 270,
    world(v) {
      const wn = windowParams(v);
      return world('window' + (v | 0), 480, 270, (g) => {
        K.grad(g, 0, 0, 480, 270, [
          { p: 0, c: '#0a1024' },
          { p: 0.5, c: '#1a2547' },
          { p: 1, c: '#2c2a4e' }
        ]);
        /* 窗外被雨打散的城市光斑 */
        const spots = windowSpots(v);
        for (let i = 0; i < spots.length; i++) {
          const s = spots[i];
          P.glow(g, s[0], s[1], s[2], s[3], s[4]);
        }
        /* 对面楼的窗格 / 消防梯剪影 */
        if (wn.rail) {
          const rx = 20 + (wn.seed % 120);
          K.rect(g, rx, 44, 2, 210, '#080c18');
          K.rect(g, rx + 54, 44, 2, 210, '#080c18');
          for (let i = 0; i < 9; i++) K.rect(g, rx, 52 + i * 22, 56, 2, '#080c18');
        }
        /* 玻璃上的雾气与灰 */
        for (let i = 0; i < 220; i++) {
          const x = Math.floor(K.rnd(i * 3.7) * 480);
          const y = Math.floor(K.rnd(i * 8.1) * 270);
          const edge = Math.min(x, 480 - x) / 240;
          g.save();
          g.globalAlpha = 0.05 + (1 - edge) * 0.07;
          K.rect(g, x, y, 1, 1, '#cdd8ee');
          g.restore();
        }
        /* 亮点 */
        for (let i = 0; i < 40; i++) {
          const x = Math.floor(K.rnd(i * 4.3) * 480);
          const y = Math.floor(K.rnd(i * 9.1) * 250);
          if (K.rnd(i * 2.7) > 0.55) K.rect(g, x, y, 1, 1, i % 4 ? '#f2c05e' : '#8fd8d2');
        }
        /* 反射的室内：一盏暖灯与窗框 */
        P.glow(g, wn.lampX, 66, 34, '#f2b35e', 0.34);
        K.rect(g, 0, wn.my, 480, 2, '#1a1420');
        K.rect(g, wn.mx, 0, 3, 270, '#1a1420');
      });
    },
    live(g, t, shot) {
      /* 水珠：几颗大的慢慢往下爬，途中会停一下 */
      for (let i = 0; i < 16; i++) {
        const bx = Math.floor(K.rnd(i * 3.9 + 2) * 440) + 12;
        const r = K.rnd(i * 6.3);
        const drop = 10 + r * 40;
        const y = ((K.rnd(i * 8.3) * 280 + t * drop * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.5 + i))) ) % 290) - 10;
        const wob = Math.sin(t * 0.8 + i) * 1.2;
        const big = r > 0.72;
        const rr = big ? 2 : 1;
        g.save();
        g.globalAlpha = 0.7;
        K.rect(g, bx + wob, y, rr, rr + (big ? 1 : 0), '#8fa8d4');
        K.rect(g, bx + wob, y - 1, 1, 1, '#dce8f8');
        g.restore();
        /* 细尾巴 */
        if (r > 0.4) {
          g.save();
          g.globalAlpha = 0.28;
          K.rect(g, bx + wob, y + rr + 1, 1, 4 + Math.floor(r * 8), '#9fb6d8');
          g.restore();
        }
      }
      /* 光斑呼吸 */
      const spots = windowSpots(shot.v || 1);
      for (let i = 0; i < 6; i++) {
        const s = spots[i];
        P.glow(g, s[0], s[1], s[2] + Math.sin(t * 0.9 + i) * 3, '#7f9ad0', 0.10 + 0.05 * Math.sin(t * 1.1 + i * 1.7));
      }
      /* 擦过玻璃的斜向反光 */
      g.save();
      g.globalAlpha = 0.05;
      const gx = ((t * 30) % 900) - 240;
      for (let i = 0; i < 16; i++) {
        K.rect(g, gx + i * 9, i * 15 - 30, 7, 90, '#a8bade');
      }
      g.restore();
      /* 雾：贴脸的位置被呼出的气擦亮 */
      const wn = windowParams(shot.v || 1);
      P.glow(g, wn.shardX, wn.shardY, 70, '#cdd8ee', 0.12 + 0.05 * Math.sin(t * 1.4));
      if (shot.shard !== false) A.shard(g, wn.shardX, wn.shardY, t * 0.4, 0.6);
    }
  };

  /* ============ 夜车 / 地铁车窗 ============ */
  S.car = {
    w: 600, h: 270,
    world(v) {
      const cp = carParams(v);
      return world('car' + (v | 0), 600, 270, (g) => {
        K.rect(g, 0, 0, 600, 270, '#0a0d1a');
        /* 车厢内壁 */
        K.grad(g, 0, 0, 600, 270, [
          { p: 0, c: '#161a2c' },
          { p: 0.4, c: '#0e1120' },
          { p: 1, c: '#080a14' }
        ]);
        /* 窗带 */
        K.rect(g, 24, cp.bandY, 552, cp.bandH, '#0a1024');
        P.farCity(g, 26, cp.bandY + 2, 548, cp.bandH - 4, 0, cp.seed, { top: '#0b1430', mid: '#1a2a52', bot: '#3a4a78' });
        K.frame(g, 24, cp.bandY, 552, cp.bandH, '#2a2030');
        for (let i = 0; i < 3; i++) K.rect(g, 24 + 138 * (i + 1), cp.bandY, 4, cp.bandH, '#241a26');
        /* 窗外掠过的近景柱子 */
        for (let i = 0; i < 5; i++) {
          K.rect(g, 40 + i * 130, cp.bandY + 2, 5, cp.bandH - 4, '#060810');
        }
        /* 窗台：一道冷光，把座椅上沿提亮 */
        K.rect(g, 20, 156, 560, 5, '#20304e');
        K.rect(g, 20, 156, 560, 1, '#4e6890');
        K.rect(g, 20, 161, 560, 3, '#0d1224');
        /* 座椅：靠背 + 坐垫 + 前板 + 分缝 */
        for (let i = 0; i < 3; i++) {
          const sx = 60 + i * 168;
          K.rect(g, sx - 4, 164, 140, 6, '#1e1830');
          K.rect(g, sx - 4, 164, 140, 1, '#332a46');
          K.rect(g, sx, 170, 132, 9, '#2f2440');
          K.rect(g, sx, 170, 132, 1, '#4a3a60');
          K.rect(g, sx, 178, 132, 1, '#1a1424');
          K.rect(g, sx, 179, 132, 33, '#1c1524');
          K.rect(g, sx + 2, 182, 128, 1, '#241a30');
          for (let s = 1; s < 3; s++) K.rect(g, sx + s * 44, 170, 1, 9, '#251c38');
          /* 端头扶手 */
          K.rect(g, sx - 4, 168, 3, 20, '#3a3448');
          K.rect(g, sx + 133, 168, 3, 20, '#3a3448');
          /* 优先座标牌 */
          if (i === 1) {
            K.rect(g, sx + 56, 186, 20, 12, '#2a2033');
            K.rect(g, sx + 58, 188, 16, 8, '#c9b56a');
            K.rect(g, sx + 61, 190, 4, 4, '#3a2f1a');
          }
        }
        /* 立柱 */
        K.rect(g, cp.poleX, 40, 5, 172, '#252a3e');
        K.rect(g, cp.poleX + 1, 40, 1, 172, '#4a5474');
        K.rect(g, cp.poleX - 2, 208, 9, 4, '#1a1f30');
        /* 扶手与吊环 */
        K.rect(g, 0, 20, 600, 2, '#3a3040');
        K.rect(g, 0, 20, 600, 1, '#584c64');
        for (let i = 0; i < cp.strapN; i++) {
          const hx = Math.round((600 / cp.strapN) * (i + 0.5));
          K.rect(g, hx, 22, 1, 12, '#4a4050');
          K.ring(g, hx, 38, 3, '#5a5060');
        }
        /* 地板 */
        K.rect(g, 0, 212, 600, 58, '#0b0d16');
        for (let y = 216; y < 270; y += 14) K.rect(g, 0, y, 600, 1, '#141826');
        /* 窗光落在地板上：从窗台往下逐渐变宽、变淡的冷色梯形 */
        for (let i = 0; i < 22; i++) {
          const y = 213 + i * 2;
          const inset = 20 - i * 0.8;
          g.save();
          g.globalAlpha = 0.26 - i * 0.0105;
          K.rect(g, 24 + inset, y, 552 - inset * 2, 2, '#3a5480');
          g.restore();
        }
        /* 顶灯与灯罩 */
        for (let i = 0; i < 4; i++) {
          K.rect(g, 40 + i * 148, 4, 88, 3, '#6a6152');
          K.rect(g, 40 + i * 148, 7, 88, 3, '#e8dcb8');
          K.rect(g, 40 + i * 148, 10, 88, 1, '#a89a78');
        }
      });
    },
    live(g, t, shot, cam) {
      const cp = carParams(shot.v || 1);
      /* 掠过的光带 */
      for (let i = 0; i < 8; i++) {
        const x = ((t * (280 + i * 60) + i * 210) % 900) - 160;
        g.save();
        g.globalAlpha = 0.16 + 0.14 * Math.sin(t * 3 + i);
        K.rect(g, x, cp.bandY + 2, 30 + i * 6, cp.bandH - 4, i % 3 ? '#2a3a66' : '#4a3a5a');
        g.restore();
      }
      /* 窗外灯点流动 */
      for (let i = 0; i < 26; i++) {
        const x = ((t * (90 + K.rnd(cp.seed + i * 3.1) * 130) + K.rnd(cp.seed + i * 7.7) * 700) % 760) - 80;
        const y = cp.bandY + 16 + Math.floor(K.rnd(cp.seed + i * 5.3) * (cp.bandH - 22));
        K.rect(g, x, y, 1, 1, i % 4 ? '#ffe9a8' : '#8fd8d2');
      }
      /* 玻璃雨 */
      P.glassRain(g, t, { x: 26, y: cp.bandY + 2, w: 546, h: cp.bandH - 4, count: cp.rainN, seed: cp.seed, color: '#8fa4cd' });
      /* 吊环摇 */
      for (let i = 0; i < cp.strapN; i++) {
        const hx = Math.round((600 / cp.strapN) * (i + 0.5));
        const sw = Math.sin(t * 1.7 + i * 0.9) * 1.6;
        g.save();
        g.globalAlpha = 0.9;
        K.line(g, hx, 24, hx + sw, 34, '#4a4050', 1);
        g.restore();
        K.ring(g, hx + sw, 38, 3, '#5a5060');
      }
      /* 坐着的人 */
      const w = shot.who;
      if (w !== false) {
        const gx = (w && w.x) || 210;
        const gy = (w && w.y) || 158;
        const isGirl = !w || w.k === 'girl';
        A.seated(g, gx, gy + 12, t, {
          k: isGirl ? 'girl' : 'boy',
          coat: isGirl ? '#4a3e58' : '#33405e',
          hair: isGirl ? '#2e1f2c' : '#2a2330',
          ph: (w && w.x) || 0
        });
        /* 头靠在玻璃上压出的暗影 */
        g.save();
        g.globalAlpha = 0.22;
        K.rect(g, gx - 11, gy + 12 - 34, 22, 26, '#070a12');
        g.restore();
      }
      /* 顶灯的光落在车厢壁和地板上 */
      for (let i = 0; i < 4; i++) {
        const lx = 84 + i * 148;
        P.glow(g, lx, 26, 44, '#ffe9b8', 0.10 + 0.015 * Math.sin(t * 7.1 + i));
        P.glow(g, lx, 236, 30, '#c9a976', 0.05 + 0.008 * Math.sin(t * 5.3 + i));
      }
      /* 玻璃上的斜向反光缓缓移过 */
      g.save();
      g.globalAlpha = 0.08;
      const rx = ((t * 26) % 900) - 200;
      for (let i = 0; i < 10; i++) {
        K.rect(g, rx + i * 7, 38 + i * 11, 5, 12, '#9fb6e0');
      }
      g.restore();
      /* 顶灯闪 */
      g.save();
      g.globalAlpha = 0.05 + 0.02 * Math.sin(t * 7.1);
      K.rect(g, 0, 0, 600, 30, '#fff4d0');
      g.restore();
    }
  };
})(typeof window !== 'undefined' ? window : null);
