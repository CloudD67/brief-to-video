/* 场景库 E：街角小店（里外同框）与桌面特写。
   小店场景库：门外与柜台后两个站位；钥匙、硬币、工牌、热水等桌面特写。 */
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

  function storeParams(v) {
    const vv = (v | 0) || 1;
    const winX = 30 + vno(vv, 61, 0, 18);
    const winW = 252 + vno(vv, 62, 0, 24);
    return {
      winX: winX, winW: winW, winY: 112, winH: 96,
      doorX: winX + winW + 12, doorW: 56,
      signY: 92,
      boyX: winX + 92 + vno(vv, 65, 0, 42),
      catX: winX + winW + 92 + vno(vv, 66, 0, 20),
      shelfRow: 2 + vno(vv, 63, 0, 1),
      seed: vno(vv, 68, 0, 900),
      wall: ['#1a1420', '#141a20', '#1c1618'][vv % 3],
      awnCol: ['#5a2430', '#24405a', '#4a3a1a', '#2a3a2a'][vv % 4],
      neon: ['#8fd8d2', '#f2c05e', '#e87ab0'][vv % 3]
    };
  }

  /* ============ 街角小店 ============ */
  S.store = {
    w: 700, h: 270,
    world(v) {
      const sp = storeParams(v);
      return world('store' + (v | 0), 700, 270, (g) => {
        const winX = sp.winX, winW = sp.winW, winY = sp.winY, winH = sp.winH;

        /* 招牌上方的一条夜街 */
        K.grad(g, 0, 0, 700, 64, [{ p: 0, c: '#060914' }, { p: 1, c: '#151b2e' }]);
        for (let i = 0; i < 15; i++) {
          const bw = 34 + Math.floor(K.rnd(sp.seed + i * 2.9) * 22);
          const bh = 14 + Math.floor(K.rnd(sp.seed + i * 6.1) * 30);
          const bx = i * 50 - 10;
          K.rect(g, bx, 64 - bh, bw, bh, '#0b1120');
          for (let k = 0; k < 3; k++) {
            if (K.rnd(sp.seed + i * 3.7 + k * 5.3) > 0.55) {
              K.rect(g, bx + 5 + k * 10, 64 - bh + 5 + (k % 2) * 7, 3, 4, '#e8b45c');
            }
          }
        }

        /* 店墙 */
        K.rect(g, winX - 14, 56, sp.doorX + sp.doorW - winX + 28, 156, sp.wall);
        for (let y = 56; y < 212; y += 9) K.rect(g, winX - 14, y, sp.doorX + sp.doorW - winX + 28, 1, K.shade(sp.wall, 8));

        /* 右邻：拉下的卷帘门 */
        const nx = sp.doorX + sp.doorW + 18;
        K.rect(g, nx - 4, 64, 700 - nx + 4, 148, '#12101a');
        K.rect(g, nx, 124, 700 - nx, 84, '#1c1a24');
        for (let y = 128; y < 208; y += 5) K.rect(g, nx, y, 700 - nx, 1, '#2a2832');
        for (let x = nx; x < 700; x += 26) K.rect(g, x, 124, 1, 84, '#26242e');
        K.rect(g, nx, 208, 700 - nx, 3, '#0c0a12');
        K.rect(g, nx + 8, 98, 120, 20, '#241a20');
        K.rect(g, nx + 10, 100, 116, 16, '#3a2a2a');
        for (let i = 0; i < 5; i++) K.rect(g, nx + 18 + i * 20, 105, 12, 6, '#5a4a4a');
        /* 卷帘门上的涂鸦 */
        K.line(g, nx + 40, 176, nx + 66, 152, '#3c4a6a', 2);
        K.line(g, nx + 66, 152, nx + 84, 174, '#3c4a6a', 2);
        K.line(g, nx + 84, 174, nx + 104, 150, '#5a3c4a', 2);
        K.rect(g, nx + 52, 176, 40, 3, '#5a3c4a');
        /* 门口的纸箱与拖把 */
        K.rect(g, nx + 132, 186, 34, 22, '#3a2a1e');
        K.rect(g, nx + 134, 188, 30, 18, '#2a1e16');
        K.rect(g, nx + 138, 192, 22, 1, '#4a3826');
        K.rect(g, nx + 140, 178, 26, 8, '#33251a');
        K.rect(g, nx + 186, 150, 2, 58, '#2a2228');
        K.rect(g, nx + 180, 148, 14, 6, '#4a3a30');
        K.rect(g, nx + 182, 146, 10, 3, '#5a4a3a');

        /* 雨棚 */
        const ax = winX - 22, aw = sp.doorW + winW + 44;
        K.rect(g, ax, 58, aw, 34, sp.awnCol);
        for (let i = 0; i < aw; i += 20) K.rect(g, ax + i, 58, 10, 34, K.shade(sp.awnCol, -22));
        for (let i = 0; i < aw; i += 10) K.rect(g, ax + i, 92, 5, 5, i % 20 === 0 ? sp.awnCol : K.shade(sp.awnCol, -22));
        K.rect(g, ax, 58, aw, 2, K.shade(sp.awnCol, 26));

        /* 招牌板（字在 live 里闪） */
        K.rect(g, winX - 6, sp.signY, sp.doorW + winW + 12, 16, '#0c0e16');
        K.rect(g, winX - 6, sp.signY, sp.doorW + winW + 12, 1, '#2a3048');
        K.rect(g, winX - 6, sp.signY + 15, sp.doorW + winW + 12, 1, '#05070e');

        /* 橱窗框与内部 */
        K.rect(g, winX - 8, winY - 8, winW + 16, winH + 16, '#241a1e');
        K.rect(g, winX - 5, winY - 5, winW + 10, winH + 10, '#3a2a2e');
        K.rect(g, winX, winY, winW, winH, '#3a2a26');
        for (let x = winX; x < winX + winW; x += 12) K.rect(g, x, winY, 1, winH, '#332420');
        K.rect(g, winX, winY, winW, 6, '#2a1e1c');

        /* 货架 */
        const shX = winX + 10, shW = winW - 86;
        for (let r = 0; r < sp.shelfRow; r++) {
          const sy = 146 + r * 20;
          K.rect(g, shX, sy, shW, 2, '#4a3428');
          const n = Math.floor(shW / 9);
          for (let i = 0; i < n; i++) {
            const bh = 5 + Math.floor(K.rnd(sp.seed + r * 13 + i * 3.1) * 5);
            const col = ['#8a5a3a', '#4a6a6a', '#7a4a5a', '#5a6a3a', '#8a7a3a', '#4a5a7a'][(i + r) % 6];
            K.rect(g, shX + 2 + i * 9, sy - bh, 6, bh, col);
          }
        }

        /* 冰柜 */
        const fx = winX + winW - 66, fy = 132;
        K.rect(g, fx, fy, 60, 74, '#16222a');
        K.rect(g, fx + 2, fy + 2, 56, 60, '#8fd8d2');
        g.save();
        g.globalAlpha = 0.4;
        K.rect(g, fx + 2, fy + 2, 56, 60, '#cfeeea');
        g.restore();
        for (let i = 0; i < 3; i++) K.rect(g, fx + 4, fy + 18 + i * 14, 52, 1, '#5a8a8c');
        for (let i = 0; i < 12; i++) {
          K.rect(g, fx + 7 + (i % 6) * 8, fy + 8 + Math.floor(i / 6) * 14, 4, 7, i % 3 ? '#3a5a6a' : '#c9503c');
        }
        K.rect(g, fx, fy, 60, 2, '#2a3a42');

        /* 柜台与柜台上的水壶 */
        K.rect(g, winX + 4, 192, winW - 14, 3, '#8a5c3e');
        K.rect(g, winX + 4, 195, winW - 14, 13, '#3a2620');
        for (let x = winX + 12; x < winX + winW - 12; x += 18) K.rect(g, x, 197, 1, 11, '#2a1a16');
        K.rect(g, winX + 24, 184, 12, 8, '#4a4a52');
        K.rect(g, winX + 26, 182, 8, 3, '#7a7a86');
        K.rect(g, winX + 36, 185, 4, 3, '#3a3a42');

        /* 吊灯 */
        for (let i = 0; i < 3; i++) {
          const lx = winX + 34 + i * Math.floor(winW / 3.2);
          K.rect(g, lx, winY, 1, 12, '#2a2228');
          K.rect(g, lx - 5, winY + 12, 11, 2, '#4a3a30');
          K.rect(g, lx - 4, winY + 14, 9, 2, '#ffe9a8');
        }

        /* 玻璃门 */
        K.rect(g, sp.doorX - 6, winY - 8, sp.doorW + 12, winH + 16, '#241a1e');
        K.rect(g, sp.doorX - 3, winY - 4, sp.doorW + 6, winH + 8, '#3a2a2e');
        K.rect(g, sp.doorX, winY, sp.doorW, winH, '#0e1626');
        for (let y = winY + 6; y < winY + winH; y += 10) K.rect(g, sp.doorX, y, sp.doorW, 1, '#121c30');
        K.rect(g, sp.doorX, winY, 2, winH, '#2a3448');
        K.rect(g, sp.doorX + sp.doorW - 2, winY, 2, winH, '#2a3448');
        K.rect(g, sp.doorX + sp.doorW - 13, 160, 2, 16, '#5a6a86');
        K.rect(g, sp.doorX + sp.doorW - 14, 159, 5, 2, '#5a6a86');
        /* 门铃 */
        K.rect(g, sp.doorX + 20, winY + 4, 1, 4, '#3a3038');
        K.rect(g, sp.doorX + 18, winY + 8, 5, 4, '#5a4a3a');

        /* 台阶与湿路面 */
        K.rect(g, sp.doorX - 10, 208, sp.doorW + 20, 6, '#2a2228');
        K.rect(g, 0, 208, 700, 4, '#0c0a12');
        K.grad(g, 0, 212, 700, 58, [{ p: 0, c: '#201a26' }, { p: 1, c: '#0c0a12' }]);
        for (let y = 216; y < 270; y += 7) K.rect(g, 0, y, 700, 1, '#181420');
        for (let x = 0; x < 700; x += 34) K.rect(g, x, 212, 1, 58, '#181420');
        K.rect(g, 0, 262, 700, 8, '#141018');
        K.rect(g, 0, 212, 700, 1, '#2e2634');
        P.puddle(g, winX + 30, 236, 120, 16, 0, sp.seed + 5, '#2a2234');
        P.puddle(g, sp.doorX + 40, 246, 90, 12, 0, sp.seed + 9, '#241e30');
      });
    },
    live(g, t, shot, cam) {
      const sp = storeParams(shot.v || 1);
      const winX = sp.winX, winW = sp.winW, winY = sp.winY, winH = sp.winH;

      /* 店内吊灯：三盏不同相位 */
      for (let i = 0; i < 3; i++) {
        const lx = winX + 34 + i * Math.floor(winW / 3.2);
        const fl = 0.72 + 0.12 * Math.sin(t * 3.7 + i * 2.1);
        P.glow(g, lx, winY + 16, 26, '#f2c05e', fl * 0.22);
        g.save();
        g.globalAlpha = fl;
        K.rect(g, lx - 4, winY + 14, 9, 2, '#ffe9a8');
        g.restore();
      }
      /* 冰柜冷光呼吸 */
      const fx = winX + winW - 66;
      P.glow(g, fx + 30, 160, 38, '#8fd8d2', 0.09 + 0.03 * Math.sin(t * 1.6));
      /* 水壶蒸汽 */
      P.steam(g, winX + 30, 182, t, sp.seed, 6, '#d8cfc0', 26);

      /* 柜台后的人：默认是店主（他） */
      const w = shot.who === false ? null : (shot.who || { k: 'boy', x: sp.boyX, y: 208, pose: 'stand' });
      if (w) {
        if (w.k === 'girl') A.girl(g, w.x, w.y, t, w);
        else A.boy(g, w.x, w.y, t, w);
        if (w.umbrella) A.umbrella(g, w.x + 2, w.y - 26, t, '#2a3450');
      }
      /* 柜台前沿重新压一遍：站着的人被挡到腰 */
      K.rect(g, winX + 4, 192, winW - 14, 3, '#8a5c3e');
      K.rect(g, winX + 4, 195, winW - 14, 13, '#3a2620');
      for (let x = winX + 12; x < winX + winW - 12; x += 18) K.rect(g, x, 197, 1, 11, '#2a1a16');

      /* 玻璃：冷调 + 斜反光 + 水珠 + 窗棂 */
      g.save();
      g.globalAlpha = 0.2;
      K.rect(g, winX, winY, winW, winH, '#16243c');
      g.restore();
      g.save();
      g.globalAlpha = 0.055;
      const gx = ((t * 16) % (winW + 140)) - 120;
      for (let i = 0; i < 8; i++) K.rect(g, winX + ((gx + i * 30) % winW), winY, 12, winH, '#cfe0ff');
      g.restore();
      P.glassRain(g, t, { x: winX, y: winY, w: winW, h: winH, count: 16, seed: sp.seed, color: '#8fa4cd' });
      K.rect(g, winX + Math.floor(winW / 2), winY, 3, winH, '#3a2a2e');
      K.rect(g, winX, winY + Math.floor(winH / 2), winW, 2, '#3a2a2e');
      K.rect(g, winX - 5, winY - 5, winW + 10, 5, '#3a2a2e');

      /* 门里的灯：他在门口时的暖光 */
      P.glow(g, sp.doorX + Math.floor(sp.doorW / 2), winY + 30, 34, '#f2c05e', 0.12);

      /* 招牌与 OPEN：偶尔闪一下 */
      const on = Math.sin(t * 2.3) > -0.82;
      if (on) P.glow(g, winX + winW / 2 + 36, sp.signY + 8, 54, sp.neon, 0.13);
      K.bit(g, 'NIGHT MART', winX + 14, sp.signY + 4, on ? sp.neon : '#2a3a44', 2);
      const openOn = Math.sin(t * 1.7) > -0.5;
      K.bit(g, 'OPEN', sp.doorX + 12, winY + 20, openOn ? '#8fd8d2' : '#284a44', 1);

      /* 门口的雨：只落在雨棚以下 */
      if (shot.rain !== false) {
        P.rainStreaks(g, t, { x: 0, y: 94, w: 700, h: 176, count: 44, seed: sp.seed, alpha: 0.15, speed: 300, len: 5 });
      }
      /* 雨棚滴水 */
      for (let i = 0; i < 7; i++) {
        const dx = winX - 16 + Math.floor(K.rnd(sp.seed + i * 3.1) * (winW + sp.doorW + 26));
        const ph = (t * 90 + K.rnd(sp.seed + i * 5.3) * 120) % 120;
        if (94 + ph < 210) K.rect(g, dx, 94 + ph, 1, 3, '#8fa4cd');
      }
      /* 猫蹲在纸箱上 */
      A.cat(g, sp.catX, 186, t, sp.seed % 9);

      /* 地面水光：橱窗与招牌的倒影 */
      for (let i = 0; i < 18; i++) {
        const rx = winX + K.rnd(sp.seed + i * 4.7) * (winW + 80);
        g.save();
        g.globalAlpha = 0.06 + 0.05 * Math.sin(t * 1.3 + i);
        K.rect(g, rx, 216 + Math.floor(K.rnd(sp.seed + i * 6.1) * 44), 18 + Math.floor(K.rnd(sp.seed + i * 2.9) * 40), 1, i % 3 ? '#f2c05e' : sp.neon);
        g.restore();
      }
      /* 水洼涟漪 */
      for (let i = 0; i < 4; i++) {
        const rr = (t * 6 + i * 9) % 18;
        g.save();
        g.globalAlpha = 0.2 * (1 - rr / 18);
        K.ring(g, winX + 60 + i * 26, 244, Math.max(1, Math.round(rr * 0.4)), '#8fa4cd');
        g.restore();
      }
    }
  };

  /* ============ 桌面特写 ============ */
  function insertParams(v) {
    const vv = (v | 0) || 1;
    return {
      seed: vno(vv, 71, 0, 900),
      flip: vno(vv, 72, 0, 1) === 1,
      warm: ['#f2c05e', '#e8a060', '#c9d8f0'][vv % 3],
      n: vno(vv, 73, 0, 3)
    };
  }

  /* 一张纸：右下角折起来，纸面带两三条手写线 */
  function paper(g, x, y, w, h, tone, lines, seed) {
    K.rect(g, x, y, w, h, tone || '#e8dcc0');
    K.rect(g, x, y, w, 1, '#fff3d8');
    K.rect(g, x + w - 6, y + h - 6, 6, 6, K.shade(tone || '#e8dcc0', -18));
    K.rect(g, x + w - 6, y + h - 6, 6, 1, K.shade(tone || '#e8dcc0', -6));
    for (let i = 0; i < (lines || 3); i++) {
      const lw = Math.round(w * (0.45 + K.rnd(seed + i * 3.1) * 0.34));
      K.rect(g, x + 6, y + 8 + i * 6, lw, 1, K.shade(tone || '#e8dcc0', -46));
    }
  }

  /* 硬币：一道亮边的扁圆 */
  function coin(g, x, y, r) {
    K.rect(g, x - r, y - 1, r * 2, 2, '#8a6a2a');
    K.rect(g, x - r + 1, y - 2, r * 2 - 2, 1, '#c9a84e');
    K.rect(g, x - r + 2, y - 2, 2, 1, '#f2e0a0');
    K.rect(g, x - r + 1, y, r * 2 - 2, 1, '#5a4418');
  }

  const INS = {
    phone(g, t, ip) {
      /* 桌面：夜里的木桌，左冷右暖 */
      K.grad(g, 0, 0, 480, 270, [{ p: 0, c: '#221a20' }, { p: 0.6, c: '#181218' }, { p: 1, c: '#0f0b10' }]);
      for (let i = 0; i < 12; i++) K.rect(g, 0, 16 + i * 22, 480, 1, '#2a1f24');
      P.glow(g, 52, 60, 90, '#4a6a9a', 0.13);
      P.glow(g, 430, 30, 70, ip.warm, 0.10);
      /* 杯子与笔记本 */
      K.rect(g, 88, 176, 26, 30, '#2a2026');
      K.rect(g, 88, 176, 26, 2, '#4a3a3e');
      K.ring(g, 101, 176, 12, '#3a2e32');
      P.glow(g, 101, 162, 22, ip.warm, 0.1);
      P.steam(g, 101, 172, t, ip.seed, 5, '#c9b592', 26);
      K.rect(g, 300, 196, 92, 44, '#2a2432');
      K.rect(g, 300, 196, 92, 2, '#463a4e');
      for (let i = 0; i < 5; i++) K.rect(g, 306, 204 + i * 7, 74 - (i % 2) * 16, 1, '#3a3244');
      /* 手机 */
      const px = 214, py = 122;
      K.rect(g, px - 2, py - 2, 44, 92, '#05070e');
      K.rect(g, px, py, 40, 88, '#0d1220');
      K.rect(g, px + 3, py + 3, 34, 82, '#101a30');
      K.rect(g, px + 17, py + 1, 6, 2, '#1a2438');
      /* 聊天界面 */
      K.rect(g, px + 3, py + 3, 34, 9, '#16223a');
      K.bit(g, '03:12', px + 10, py + 5, '#8fa4cd', 1);
      K.rect(g, px + 6, py + 16, 18, 5, '#25324a');
      K.rect(g, px + 6, py + 22, 24, 5, '#25324a');
      K.rect(g, px + 16, py + 30, 18, 5, '#2a5a5a');
      K.rect(g, px + 16, py + 36, 22, 5, '#2a5a5a');
      K.rect(g, px + 6, py + 46, 14, 5, '#25324a');
      /* 电量：只剩一格 */
      K.rect(g, px + 24, py + 4, 8, 4, '#2a3448');
      K.rect(g, px + 25, py + 5, 2, 2, '#c9503c');
      K.rect(g, px + 32, py + 5, 1, 2, '#2a3448');
      /* 输字框 */
      K.rect(g, px + 4, py + 74, 32, 8, '#1a2438');
      K.rect(g, px + 7, py + 77, 14, 1, '#3a4a68');
      /* 拇指：从右下伸进来，悬在屏幕上 */
      const th = Math.round(Math.sin(t * 0.9) * 2);
      K.rect(g, px + 30, py + 44 + th, 10, 22, '#d9a878');
      K.rect(g, px + 30, py + 44 + th, 10, 3, '#e8c09a');
      K.rect(g, px + 40, py + 48 + th, 4, 14, '#c99a76');
      /* 屏幕光 */
      g.save();
      g.globalAlpha = 0.14 + 0.05 * Math.sin(t * 2.3);
      K.rect(g, px + 3, py + 3, 34, 82, '#8fd8d2');
      g.restore();
      P.glow(g, px + 20, py + 44, 54, '#8fd8d2', 0.12 + 0.04 * Math.sin(t * 2.3));
      /* 新消息：滑进来的一小条 */
      const slide = K.smooth((t - 1.1) / 0.4);
      if (slide > 0.01) {
        const ox = Math.round((1 - slide) * 30);
        g.save();
        g.globalAlpha = slide;
        K.rect(g, px + 10 + ox, py + 56, 22, 6, '#2a5a5a');
        K.rect(g, px + 12 + ox, py + 58, 12, 1, '#7fd0c8');
        g.restore();
      }
      /* 手机震一下 */
      const vib = (t > 1.8 && t < 2.15) ? (Math.sin(t * 90) > 0 ? 1 : -1) : 0;
      if (vib) {
        K.rect(g, px + 2, py + 70, 36, 1, '#3a4a68');
        P.glow(g, px + 20, py + 44, 60, '#8fd8d2', 0.2);
      }
    },

    coins(g, t, ip) {
      /* 柜台：木纹 + 一盏顶灯 */
      K.grad(g, 0, 0, 480, 270, [{ p: 0, c: '#2a1e1c' }, { p: 1, c: '#140f10' }]);
      for (let i = 0; i < 16; i++) K.rect(g, 0, 10 + i * 17, 480, 1, '#31231f');
      P.glow(g, 240, 20, 120, ip.warm, 0.12);
      /* 收据 */
      paper(g, 78, 150, 62, 76, '#d8cfb8', 7, ip.seed);
      for (let i = 0; i < 5; i++) K.rect(g, 84, 160 + i * 11, 44 - (i % 3) * 8, 1, '#a89878');
      /* 催租单：白纸红章 */
      paper(g, 300, 128, 104, 96, '#e8e0cc', 5, ip.seed + 3);
      K.ring(g, 360, 176, 15, '#a83a2e');
      K.rect(g, 352, 172, 16, 2, '#a83a2e');
      K.rect(g, 352, 180, 16, 2, '#a83a2e');
      K.rect(g, 356, 168, 2, 16, '#a83a2e');
      K.rect(g, 364, 168, 2, 16, '#a83a2e');
      /* 硬币：三摞 + 散的 */
      for (let s = 0; s < 3; s++) {
        const cx = 196 + s * 22, base = 208 - s * 4;
        const n = 3 + s;
        for (let i = 0; i < n; i++) coin(g, cx, base - i * 2, 7);
      }
      for (let i = 0; i < 9; i++) {
        const cx = 120 + Math.floor(K.rnd(ip.seed + i * 3.7) * 240);
        const cy = 178 + Math.floor(K.rnd(ip.seed + i * 5.1) * 56);
        coin(g, cx, cy, 4 + (i % 3));
      }
      /* 钱包 */
      K.rect(g, 324, 210, 56, 30, '#3a2226');
      K.rect(g, 324, 210, 56, 2, '#5a3438');
      K.rect(g, 330, 218, 40, 1, '#2a181c');
      /* 一只手：从右边进来，拿走一枚 */
      const reach = K.clamp((t - 0.5) / 1.2, 0, 1);
      const hx = 470 - reach * 90;
      K.rect(g, hx, 196, 46, 16, '#d9a878');
      K.rect(g, hx, 196, 46, 3, '#e8c09a');
      K.rect(g, hx + 2, 212, 38, 4, '#c99a76');
      if (reach > 0.7) {
        K.rect(g, hx + 4, 190, 8, 8, '#d9a878');
        K.rect(g, hx + 14, 192, 7, 7, '#d9a878');
      }
      /* 反光：一道扫过的亮 */
      const sweep = ((t * 60) % 520) - 40;
      g.save();
      g.globalAlpha = 0.16;
      for (let i = 0; i < 6; i++) K.rect(g, sweep + i * 5, 140 + i * 14, 4, 26, '#ffe9a8');
      g.restore();
      /* 纸角被风吹起 */
      const lift = Math.max(0, Math.sin(t * 1.7)) * 2;
      K.rect(g, 402, 128 - lift, 2, 2 + lift, '#f4ecd8');
      /* 灰 */
      for (let i = 0; i < 5; i++) {
        const dx = (K.rnd(ip.seed + i * 3.3) * 480 + Math.sin(t * 0.6 + i) * 6) % 480;
        const dy = 40 + (K.rnd(ip.seed + i * 5.9) * 200 + t * 4) % 200;
        g.save();
        g.globalAlpha = 0.1 + 0.06 * Math.sin(t * 1.3 + i);
        K.rect(g, dx, dy, 1, 1, '#c9b592');
        g.restore();
      }
    },

    key(g, t, ip) {
      /* 门口的地垫 + 木地板 */
      K.grad(g, 0, 0, 480, 270, [{ p: 0, c: '#1c1618' }, { p: 1, c: '#0d0a0c' }]);
      for (let i = 0; i < 10; i++) K.rect(g, 0, 20 + i * 26, 480, 1, '#241c1e');
      for (let i = 0; i < 10; i++) K.rect(g, i * 52, 0, 1, 270, '#141012');
      /* 地垫 */
      K.rect(g, 60, 150, 250, 92, '#28222a');
      for (let y = 154; y < 240; y += 6) K.rect(g, 62, y, 246, 1, '#332c36');
      for (let x = 64; x < 308; x += 8) K.rect(g, x, 152, 1, 88, '#332c36');
      K.rect(g, 60, 150, 250, 2, '#3a323e');
      /* 便签 */
      paper(g, 140, 168, 88, 56, '#f0e8d4', 4, ip.seed);
      /* 钥匙：两把，一把门钥匙一把小铜钥匙 */
      const ky = 204;
      K.rect(g, 196, ky, 34, 2, '#c9b56a');
      K.ring(g, 192, ky + 1, 5, '#c9b56a');
      K.ring(g, 192, ky + 1, 3, '#8a7434');
      K.rect(g, 214, ky + 2, 2, 6, '#c9b56a');
      K.rect(g, 220, ky + 2, 2, 5, '#c9b56a');
      K.rect(g, 226, ky + 2, 2, 7, '#c9b56a');
      K.rect(g, 200, ky + 8, 24, 2, '#a88a3e');
      K.ring(g, 210, ky + 16, 4, '#8a6a3a');
      K.rect(g, 214, ky + 16, 14, 2, '#8a6a3a');
      /* 钥匙上的红牌：一直轻轻摆 */
      const sw = Math.round(Math.sin(t * 2.1) * 2);
      K.rect(g, 188, ky + 6, 1, 6, '#8a3a3a');
      K.rect(g, 184 + sw, ky + 12, 9, 6, '#c9503c');
      K.rect(g, 186 + sw, ky + 14, 5, 2, '#f2d492');
      /* 信封 */
      K.rect(g, 246, 176, 52, 34, '#d8cfb8');
      K.rect(g, 246, 176, 52, 2, '#efe6d0');
      K.line(g, 246, 176, 272, 194, '#b8ad94', 1);
      K.line(g, 298, 176, 272, 194, '#b8ad94', 1);
      /* 行李箱的一角：她刚要走 */
      K.rect(g, 330, 160, 84, 76, '#5a2a2e');
      K.rect(g, 330, 160, 84, 3, '#7a4448');
      K.rect(g, 336, 172, 72, 1, '#4a2226');
      K.rect(g, 336, 218, 72, 2, '#3a1a1e');
      K.rect(g, 370, 226, 4, 8, '#2a2228');
      K.rect(g, 420, 200, 3, 26, '#2a2228');
      /* 门缝里漏进来的冷光 */
      g.save();
      g.globalAlpha = 0.1;
      K.rect(g, 400, 0, 80, 270, '#6a86b8');
      g.restore();
      /* 一滴水落在纸上 */
      const drop = (t * 26) % 90;
      if (drop < 60) K.rect(g, 170 + Math.round(drop * 0.2), 160 + Math.round(drop), 1, 2, '#8fa4cd');
      const rr = (t * 7) % 14;
      g.save();
      g.globalAlpha = 0.22 * (1 - rr / 14);
      K.ring(g, 174, 198, Math.max(1, Math.round(rr * 0.4)), '#8fa4cd');
      g.restore();
    },

    badge(g, t, ip) {
      /* 后厨台面 + 折好的围裙 */
      K.grad(g, 0, 0, 480, 270, [{ p: 0, c: '#241c1e' }, { p: 1, c: '#121012' }]);
      for (let i = 0; i < 12; i++) K.rect(g, 0, 12 + i * 22, 480, 1, '#2e2426');
      P.glow(g, 300, 40, 110, ip.warm, 0.14);
      /* 围裙：叠成一块的灰绿布 */
      K.rect(g, 96, 150, 180, 96, '#4a5a50');
      K.rect(g, 96, 150, 180, 3, '#5e6e62');
      K.rect(g, 100, 178, 172, 2, '#3e4c44');
      K.rect(g, 100, 204, 172, 2, '#3e4c44');
      K.rect(g, 96, 244, 180, 2, '#2e3a34');
      /* 工牌：白卡 + 照片 + 红色挂绳 */
      K.rect(g, 196, 160, 54, 72, '#0e1420');
      K.rect(g, 198, 162, 50, 68, '#e8e4d8');
      K.rect(g, 202, 166, 24, 28, '#8a9ab8');
      K.rect(g, 204, 168, 20, 22, '#b8c8e0');
      K.rect(g, 208, 176, 12, 12, '#6a7a96');
      K.rect(g, 202, 198, 42, 2, '#5a5a66');
      K.rect(g, 202, 204, 32, 2, '#8a8a96');
      K.rect(g, 202, 210, 38, 2, '#8a8a96');
      K.rect(g, 202, 220, 16, 4, '#a83a2e');
      /* 挂绳：从卡片顶端向上，随风轻摆 */
      const sw = Math.round(Math.sin(t * 1.6 + 1) * 2);
      K.line(g, 210, 160, 204 + sw, 128, '#a83a2e', 1);
      K.line(g, 236, 160, 244 + sw, 128, '#a83a2e', 1);
      K.rect(g, 204, 128, 42, 3, '#a83a2e');
      /* 杯子留下的圆印 */
      K.ring(g, 320, 196, 28, '#332a2c');
      K.ring(g, 320, 196, 26, '#2a2224');
      /* 筷子与碗沿 */
      K.rect(g, 300, 232, 22, 8, '#d8cfb8');
      K.rect(g, 300, 232, 22, 1, '#f0e8d4');
      K.rect(g, 326, 226, 2, 4, '#8a6a3e');
      K.rect(g, 344, 224, 2, 30, '#8a6a3e');
      K.rect(g, 350, 226, 2, 28, '#8a6a3e');
      /* 蒸汽从碗里升起 */
      P.steam(g, 311, 230, t, ip.seed, 5, '#c9b592', 34);
      /* 塑料卡面反光 */
      const sweep2 = ((t * 40) % 300) - 40;
      g.save();
      g.globalAlpha = 0.12;
      for (let i = 0; i < 4; i++) K.rect(g, 198 + sweep2 + i * 4, 162 + i * 10, 3, 26, '#ffffff');
      g.restore();
      /* 灰 */
      for (let i = 0; i < 4; i++) {
        const dx = (K.rnd(ip.seed + i * 4.1) * 480 + Math.sin(t * 0.5 + i) * 8) % 480;
        const dy = 60 + (K.rnd(ip.seed + i * 7.3) * 180 + t * 3) % 180;
        g.save();
        g.globalAlpha = 0.09 + 0.05 * Math.sin(t * 1.1 + i);
        K.rect(g, dx, dy, 1, 1, '#c9b592');
        g.restore();
      }
    },

    water(g, t, ip) {
      /* 铁皮台面：冷灰的厨房 */
      K.grad(g, 0, 0, 480, 270, [{ p: 0, c: '#20242a' }, { p: 0.55, c: '#181c22' }, { p: 1, c: '#0e1116' }]);
      for (let i = 0; i < 9; i++) K.rect(g, 0, 24 + i * 28, 480, 1, '#2a3038');
      for (let i = 0; i < 6; i++) K.rect(g, 60 + i * 70, 0, 1, 270, '#262c34');
      P.glow(g, 240, 30, 120, '#c9d8f0', 0.1);
      P.glow(g, 200, 140, 60, ip.warm, 0.08);
      /* 暖水瓶 */
      K.rect(g, 74, 118, 46, 92, '#3a3a44');
      K.rect(g, 74, 118, 46, 4, '#5a5a66');
      K.rect(g, 78, 122, 38, 84, '#2a2a34');
      K.rect(g, 88, 106, 18, 12, '#4a4a56');
      K.rect(g, 92, 100, 10, 6, '#5a5a66');
      K.rect(g, 80, 176, 34, 1, '#1e1e26');
      /* 杯子 */
      K.rect(g, 226, 170, 40, 54, '#d8cfc0');
      K.rect(g, 226, 170, 40, 3, '#f0e8d8');
      K.rect(g, 266, 184, 10, 20, '#d8cfc0');
      K.rect(g, 266, 184, 10, 3, '#f0e8d8');
      K.rect(g, 230, 176, 32, 2, '#b8ad9c');
      /* 水面：随 t 升高，微微起伏 */
      const lvl = K.clamp((t - 0.3) / 2.2, 0, 1);
      const wy = 216 - lvl * 30;
      K.rect(g, 228, wy, 36, 218 - wy, '#7a9a96');
      K.rect(g, 228, wy, 36, 1, '#cfe0d8');
      g.save();
      g.globalAlpha = 0.4;
      for (let i = 0; i < 4; i++) {
        K.rect(g, 230 + i * 9, wy + 1 + Math.round(Math.sin(t * 5 + i) * 1), 5, 1, '#a8c8c0');
      }
      g.restore();
      /* 水流：从壶嘴到杯口 */
      if (lvl < 0.98) {
        const sx = 96, sy = 108;
        for (let i = 0; i < 20; i++) {
          const yy = sy + i * 5 + ((t * 60) % 5);
          if (yy > 170) break;
          K.rect(g, sx + Math.round(i * 0.55), yy, 1, 4, '#a8c8c0');
          K.rect(g, sx + Math.round(i * 0.55) + 1, yy + 2, 1, 2, '#cfe0d8');
        }
      }
      /* 两只手：左手提壶，右手扶着杯子 */
      K.rect(g, 150, 100, 26, 16, '#d9a878');
      K.rect(g, 150, 100, 26, 3, '#e8c09a');
      K.rect(g, 172, 96, 8, 12, '#d9a878');
      K.rect(g, 284, 196, 30, 16, '#d9a878');
      K.rect(g, 284, 196, 30, 3, '#e8c09a');
      K.rect(g, 280, 200, 8, 10, '#c99a76');
      /* 蒸汽 */
      P.steam(g, 244, 168, t, ip.seed, 9, '#e0e8e0', 54);
      /* 水面涟漪 */
      for (let i = 0; i < 3; i++) {
        const rr = (t * 8 + i * 6) % 12;
        g.save();
        g.globalAlpha = 0.25 * (1 - rr / 12);
        K.ring(g, 246, wy + 2, Math.max(1, Math.round(rr * 0.4)), '#e0f0e8');
        g.restore();
      }
    },

    umbrella(g, t, ip) {
      /* 湿 pavement：一场夜雨 */
      K.grad(g, 0, 0, 480, 270, [{ p: 0, c: '#121826' }, { p: 0.6, c: '#0c1220' }, { p: 1, c: '#070a12' }]);
      for (let y = 0; y < 270; y += 18) K.rect(g, 0, y, 480, 1, '#161e2e');
      for (let x = 0; x < 480; x += 40) K.rect(g, x, 0, 1, 270, '#141c2a');
      /* 积水 */
      P.puddle(g, 60, 170, 260, 70, t, ip.seed, '#1e2a44');
      P.puddle(g, 330, 210, 120, 40, t, ip.seed + 4, '#1a2438');
      P.glow(g, 420, 40, 80, ip.warm, 0.14);
      P.glow(g, 420, 40, 20, '#ffe9a8', 0.2);
      /* 伞：斜躺在地上，伞骨断了一根 */
      const bx = 150, by = 198;
      K.line(g, bx, by + 8, bx + 130, by - 6, '#2a3450', 2);
      for (let i = 0; i < 9; i++) {
        const rx = bx + i * 14;
        K.rect(g, rx, by + 6 - Math.round(i * 0.6), 3, 12 - (i % 3), i % 2 ? '#3a4a6a' : '#2e3a56');
      }
      K.rect(g, bx + 4, by + 4, 118, 2, '#46587e');
      K.rect(g, bx + 10, by + 12, 96, 2, '#2a3856');
      /* 断掉的伞骨 */
      K.line(g, bx + 74, by + 2, bx + 92, by - 18, '#5a6a8a', 1);
      K.rect(g, bx + 92, by - 20, 2, 3, '#8fa4cd');
      /* 伞柄：一个弯钩 */
      K.line(g, bx + 130, by - 6, bx + 146, by - 14, '#2a3450', 2);
      K.line(g, bx + 146, by - 14, bx + 152, by - 10, '#2a3450', 2);
      K.line(g, bx + 152, by - 10, bx + 148, by - 4, '#2a3450', 2);
      /* 伞上的水珠 */
      for (let i = 0; i < 7; i++) {
        const dx = bx + 8 + i * 16;
        const dy = by + 6 + ((t * 20 + i * 9) % 10);
        K.rect(g, dx, dy, 1, 1, '#a8bcdf');
      }
      /* 一只手从右边伸进来，要捡伞 */
      const reach = K.clamp((t - 0.7) / 0.9, 0, 1);
      const hx = 500 - reach * 80;
      K.rect(g, hx, 168, 60, 18, '#d9a878');
      K.rect(g, hx, 168, 60, 3, '#e8c09a');
      K.rect(g, hx + 4, 186, 44, 4, '#c99a76');
      if (reach > 0.6) {
        K.rect(g, hx + 2, 158, 9, 12, '#d9a878');
        K.rect(g, hx + 14, 158, 9, 12, '#d9a878');
      }
      /* 雨：满屏，落在地上溅起 */
      P.rainStreaks(g, t, { x: 0, y: 0, w: 480, h: 270, count: 60, seed: ip.seed, alpha: 0.2, speed: 320, len: 6 });
      for (let i = 0; i < 10; i++) {
        const rr = (t * 9 + i * 5) % 14;
        const rx = 40 + Math.floor(K.rnd(ip.seed + i * 3.3) * 400);
        const ry = 180 + Math.floor(K.rnd(ip.seed + i * 5.7) * 70);
        g.save();
        g.globalAlpha = 0.3 * (1 - rr / 14);
        K.ring(g, rx, ry, Math.max(1, Math.round(rr * 0.35)), '#8fa4cd');
        g.restore();
      }
      /* 水面反光 */
      g.save();
      g.globalAlpha = 0.1 + 0.04 * Math.sin(t * 1.7);
      K.rect(g, 90, 196, 90, 1, ip.warm);
      K.rect(g, 120, 214, 60, 1, '#8fd8d2');
      g.restore();
    }
  };

  S.insert = {
    w: 480, h: 270,
    world(v, shot) {
      const ins = (shot && shot.ins) || 'phone';
      const ip = insertParams(v);
      return world('insert-' + ins + (v | 0), 480, 270, (g) => {
        (INS[ins] || INS.phone)(g, 0, ip);
      });
    },
    live(g, t, shot) {
      const ins = shot.ins || 'phone';
      const ip = insertParams(shot.v || 1);
      (INS[ins] || INS.phone)(g, t, ip);
      /* 顶光扫过：每个特写都在动 */
      g.save();
      g.globalAlpha = 0.05 + 0.03 * Math.sin(t * 0.9);
      const sx = ((t * 40) % 560) - 80;
      for (let i = 0; i < 8; i++) K.rect(g, sx + i * 8, i * 24 - 20, 5, 120, '#cfe0ff');
      g.restore();
    }
  };
})(typeof window !== 'undefined' ? window : null);
