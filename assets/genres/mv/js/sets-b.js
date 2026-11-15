/* 场景库 B：巷子 / 面馆 / 红砖院 / 街角便利店 */
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

  function brickParams(v) {
    return {
      sd: vno(v, 41, 0, 900),
      doorX: 250 + vno(v, 42, 0, 250),
      lineX: 90 + vno(v, 43, 0, 220),
      treeX: [24 + vno(v, 44, 0, 90), 600 + vno(v, 45, 0, 110)],
      bikeX: [240 + vno(v, 46, 0, 130), 470 + vno(v, 47, 0, 130)],
      acX: [360 + vno(v, 48, 0, 80), 540 + vno(v, 49, 0, 90)],
      col: 1 + vno(v, 50, 0, 4),
      row: 1 + vno(v, 51, 0, 1)
    };
  }

  function streetParams(v) {
    return {
      sd: vno(v, 41, 0, 900),
      zebraX: 300 + vno(v, 42, 0, 150),
      lampA: 410 + vno(v, 43, 0, 100),
      lampB: 650 + vno(v, 44, 0, 100),
      shopX: 560 + vno(v, 45, 0, 130),
      carOff: vno(v, 46, 0, 600),
      carN: 1 + vno(v, 47, 0, 2)
    };
  }

  function alleyParams(v) {
    return {
      sd: vno(v, 41, 0, 900),
      signX: 150 + vno(v, 42, 0, 90),
      acX: 70 + vno(v, 43, 0, 70),
      lineX: 90 + vno(v, 44, 0, 60),
      steamX: 330 + vno(v, 45, 0, 60)
    };
  }

  /* ============ 巷子 ============ */
  S.alley = {
    w: 700, h: 270,
    world(v) {
      const al = alleyParams(v);
      return world('alley' + (v | 0), 700, 270, (g) => {
        K.grad(g, 0, 0, 700, 270, [
          { p: 0, c: '#080b18' },
          { p: 0.55, c: '#12142a' },
          { p: 1, c: '#1c1424' }
        ]);
        /* 巷口尽头：一条横向的老街 */
        g.save();
        g.globalAlpha = 0.5;
        K.grad(g, 300, 40, 110, 150, [
          { p: 0, c: '#2a2a52' },
          { p: 1, c: '#12142a' }
        ]);
        g.restore();
        K.rect(g, 300, 44, 110, 26, '#161a36');
        P.glow(g, 352, 72, 46, '#3c4a7e', 0.22);
        /* 对街的房子：三层剪影 + 零星窗 */
        K.rect(g, 302, 72, 34, 78, '#151a30');
        K.rect(g, 338, 60, 30, 90, '#11172c');
        K.rect(g, 370, 76, 38, 74, '#131a30');
        for (let i = 0; i < 9; i++) {
          const wx = 306 + (i % 3) * 11 + Math.floor(i / 6) * 36;
          const wy = 80 + Math.floor(i / 3) % 3 * 14;
          const on = K.rnd(al.sd + i * 3.7) > 0.5;
          K.rect(g, wx, wy, 5, 7, on ? (K.rnd(al.sd + i * 5.1) > 0.6 ? '#e8c88a' : '#8fd0c8') : '#0c1122');
        }
        K.rect(g, 300, 148, 110, 3, '#0a0e1e');
        /* 街面 */
        K.rect(g, 300, 151, 110, 61, '#202a46');
        K.rect(g, 300, 151, 110, 1, '#3a4a70');
        for (let i = 0; i < 3; i++) K.rect(g, 302, 160 + i * 16, 106, 1, '#18203a');
        /* 路灯 */
        K.rect(g, 318, 104, 2, 48, '#2e3550');
        K.rect(g, 314, 102, 10, 2, '#2e3550');
        K.rect(g, 312, 100, 6, 3, '#ffe9a8');
        /* 远处的一点光 */
        K.rect(g, 330, 150, 44, 60, '#1e2038');
        K.rect(g, 336, 158, 32, 44, '#2a2e4e');
        P.glow(g, 352, 186, 40, '#f2c05e', 0.3);
        P.glow(g, 315, 104, 22, '#ffe9a8', 0.34);
        /* 左墙 */
        K.rect(g, 0, 0, 262, 220, '#141022');
        K.rect(g, 0, 0, 262, 220, '#141022');
        for (let y = 0; y < 220; y += 7) K.rect(g, 0, y, 262, 1, '#181428');
        for (let i = 0; i < 9; i++) {
          const wy = 22 + i * 22;
          K.rect(g, 26, wy, 34, 16, '#1e1a30');
          K.rect(g, 28, wy + 2, 30, 12, i % 3 === 0 ? '#3a2c30' : '#0c1020');
        }
        /* 右墙 */
        K.rect(g, 438, 0, 262, 220, '#160f1e');
        for (let y = 0; y < 220; y += 9) K.rect(g, 438, y, 262, 1, '#1c1426');
        for (let i = 0; i < 8; i++) {
          const wy = 18 + i * 24;
          K.rect(g, 500, wy, 30, 15, '#221628');
          K.rect(g, 502, wy + 2, 26, 11, '#0e0c18');
        }
        /* 远处的一点光 */
        K.rect(g, 330, 150, 44, 60, '#1e2038');
        K.rect(g, 336, 158, 32, 44, '#2a2e4e');
        P.glow(g, 352, 186, 40, '#f2c05e', 0.3);
        /* 招牌 */
        K.rect(g, al.signX, 46, 16, 62, '#2a1a20');
        K.rect(g, al.signX + 2, 48, 12, 58, '#c9402e');
        for (let i = 0; i < 6; i++) K.rect(g, al.signX + 4, 52 + i * 9, 8, 6, '#f2d492');
        K.rect(g, 470, 62, 14, 48, '#1a2436');
        K.rect(g, 472, 64, 10, 44, '#8fd8d2');
        for (let i = 0; i < 4; i++) K.rect(g, 474, 68 + i * 10, 6, 6, '#0d1630');
        /* 空调外机与管线 */
        K.rect(g, al.acX, 132, 22, 14, '#2a3352');
        K.rect(g, al.acX + 2, 134, 18, 10, '#1a2142');
        K.rect(g, al.acX + 26, 136, 14, 2, '#2a3352');
        K.rect(g, 590 + (al.sd % 30), 118, 20, 13, '#2a3352');
        /* 地面 */
        K.grad(g, 0, 212, 700, 58, [
          { p: 0, c: '#241a24' },
          { p: 1, c: '#120e16' }
        ]);
        for (let i = 0; i < 10; i++) K.rect(g, 0, 216 + i * 6, 700, 1, '#1a121c');
        /* 水洼 */
        P.puddle(g, 260 + (al.sd % 80), 236, 110, 20, 0, al.sd + 7, '#3a2c40');
        P.puddle(g, 100 + (al.sd % 60), 228, 70, 14, 0, al.sd + 12, '#2a3352');
        P.puddle(g, 500 + (al.sd % 60), 232, 90, 16, 0, al.sd + 15, '#3a2c40');
        /* 井盖 */
        K.ring(g, 230 + (al.sd % 40), 246, 8, '#2a2230');
        K.ring(g, 230 + (al.sd % 40), 246, 5, '#2a2230');
        if (S.variant) S.variant.dress(g, v, { land: false, w: 700, gy: 226 });
      });
    },
    live(g, t, shot, cam) {
      const al = alleyParams(shot.v || 1);
      /* 晾衣绳与衣服：随风轻摆 */
      K.line(g, al.lineX, 92, al.lineX + 140, 98, '#4a567e', 1);
      for (let i = 0; i < 4; i++) {
        const bx = al.lineX + 12 + i * 32;
        const by = 92 + Math.round(bx * 0.043) + Math.round(Math.sin(t * 1.3 + i * 1.9) * 1);
        if (i === 0) {
          K.rect(g, bx, by, 14, 7, '#5a6a96');
          K.rect(g, bx - 3, by, 3, 5, '#4a5a86');
          K.rect(g, bx + 14, by, 3, 5, '#4a5a86');
          K.rect(g, bx + 1, by + 7, 12, 1, '#3e4a70');
        } else if (i === 1) {
          K.rect(g, bx, by, 10, 20, '#6a4a64');
          K.rect(g, bx, by + 6, 10, 1, '#8a6a84');
          K.rect(g, bx, by + 19, 10, 1, '#4a3248');
        } else if (i === 2) {
          K.rect(g, bx, by, 12, 16, '#4a6a6c');
          K.rect(g, bx, by + 4, 12, 1, '#6a8a8c');
        } else {
          K.rect(g, bx, by, 3, 12, '#5a5a72');
          K.rect(g, bx + 5, by, 3, 12, '#5a5a72');
          K.rect(g, bx, by, 8, 3, '#5a5a72');
        }
      }
      /* 灯笼 */
      const lx = [270, 340, 410];
      for (let i = 0; i < 3; i++) {
        K.line(g, lx[i], 30, lx[i], 44, '#3a2a2a', 1);
        P.lantern(g, lx[i], 44, t, i);
      }
      /* 招牌灯闪 */
      g.save();
      g.globalAlpha = Math.sin(t * 3.7) > -0.7 ? 0.9 : 0.35;
      K.rect(g, al.signX + 4, 52, 8, 6, '#ffe9a8');
      g.restore();
      /* 蒸汽 */
      P.steam(g, al.steamX, 200, t, 4, 12, '#b9c4e0', 54);
      P.steam(g, al.acX + 14, 210, t, 8, 6, '#9aa8c8', 30);
      /* 水洼涟漪 */
      for (let i = 0; i < 6; i++) {
        const rx = 280 + (al.sd % 60) + K.rnd(i * 3.1) * 90;
        const ry = 238 + K.rnd(i * 5.3) * 14;
        const rr = (t * 6 + i * 7) % 14;
        g.save();
        g.globalAlpha = 0.28 * (1 - rr / 14);
        K.ring(g, rx, ry, Math.max(1, Math.round(rr * 0.5)), '#8fa4cd');
        g.restore();
      }
      /* 猫走过 */
      const cx = ((t * 8) % 900) - 60;
      if (cx > -20 && cx < 720) A.cat(g, cx, 224, t * 1.6, 2);
      /* 巷口走过的人影 */
      const px = 300 + ((t * 16) % 150);
      if (px < 404) {
        const step = Math.sin(t * 7.4) > 0 ? 1 : 0;
        g.save();
        g.globalAlpha = 0.85;
        K.rect(g, px, 166, 5, 9, '#171c30');
        K.rect(g, px + 1, 160, 3, 6, '#1e2438');
        K.rect(g, px + (step ? 0 : 1), 175, 2, 4, '#12162a');
        K.rect(g, px + 3 - (step ? 0 : 1), 175, 2, 4, '#12162a');
        g.restore();
        g.save();
        g.globalAlpha = 0.18;
        K.rect(g, px - 2, 179, 9, 2, '#8a96bc');
        g.restore();
      }
      /* 路灯轻微跳闪 */
      g.save();
      g.globalAlpha = Math.sin(t * 9.3) > 0.94 ? 0.55 : 1;
      P.glow(g, 315, 104, 22, '#ffe9a8', 0.30);
      g.restore();
      /* 雨 */
      P.rainStreaks(g, t, { x: cam.x, y: 0, w: cam.w, h: 270, count: 60, seed: 17, alpha: 0.22, speed: 280 });
      /* 人物 */
      const w = shot.who;
      if (w) {
        if (w.k === 'girl') A.girl(g, w.x, w.y, t, w);
        else if (w.k === 'boy') A.boy(g, w.x, w.y, t, w);
      }
    }
  };

  /* ============ 面馆 ============ */
  S.noodle = {
    w: 620, h: 270,
    world(v) {
      return world('noodle' + (v | 0), 620, 270, (g) => {
        K.grad(g, 0, 0, 620, 270, [
          { p: 0, c: '#1a1218' },
          { p: 0.55, c: '#241820' },
          { p: 1, c: '#160f16' }
        ]);
        /* 后墙瓷砖 */
        for (let y = 0; y < 200; y += 13) {
          for (let x = 0; x < 620; x += 13) {
            K.rect(g, x, y, 12, 12, K.rnd(x * 0.7 + y * 1.3) > 0.7 ? '#2e2028' : '#2a1c24');
          }
        }
        /* 灶台 */
        K.rect(g, 300, 150, 320, 52, '#3a2a2a');
        K.rect(g, 300, 150, 320, 3, '#5a4038');
        K.rect(g, 300, 202, 320, 14, '#241a1a');
        /* 大锅与蒸汽口 */
        K.rect(g, 360, 138, 56, 14, '#4a4a52');
        K.rect(g, 362, 140, 52, 10, '#2a2a32');
        K.rect(g, 370, 134, 36, 5, '#7a7a86');
        /* 碗架 */
        K.rect(g, 40, 40, 156, 68, '#2a1c20');
        K.rect(g, 43, 43, 150, 62, '#180f14');
        for (let i = 0; i < 3; i++) {
          K.rect(g, 44, 66 + i * 20, 148, 2, '#3a282c');
          for (let b = 0; b < 7; b++) {
            K.rect(g, 48 + b * 20, 58 + i * 20, 14, 7, '#d9c9a8');
            K.rect(g, 48 + b * 20, 58 + i * 20, 14, 1, '#efe3c8');
            K.rect(g, 50 + b * 20, 60 + i * 20, 10, 2, '#b9a887');
          }
        }
        /* 挂着的菜单牌 */
        for (let i = 0; i < 4; i++) {
          const mx = 240 + i * 34;
          K.rect(g, mx, 22, 26, 36, '#c9b592');
          K.rect(g, mx + 1, 23, 24, 34, '#e8dcc0');
          for (let k = 0; k < 4; k++) K.rect(g, mx + 4, 27 + k * 8, 18, 3, '#7a5a44');
          K.rect(g, mx + 12, 18, 1, 4, '#3a2a2a');
        }
        /* 吊灯 */
        for (let i = 0; i < 3; i++) {
          const lx = 150 + i * 170;
          K.rect(g, lx, 0, 1, 18, '#3a2a2a');
          K.rect(g, lx - 6, 18, 13, 5, '#4a3026');
          K.rect(g, lx - 4, 23, 9, 3, '#ffe9a8');
        }
        /* 吧台 */
        K.rect(g, 0, 196, 620, 12, '#7c4c34');
        K.rect(g, 0, 196, 620, 2, '#a06a48');
        K.rect(g, 0, 208, 620, 62, '#3a2420');
        for (let x = 0; x < 620; x += 40) K.rect(g, x, 210, 1, 60, '#2e1c1a');
        /* 高脚凳 */
        for (let i = 0; i < 3; i++) {
          const sx = 90 + i * 120;
          K.rect(g, sx - 11, 214, 22, 4, '#5a3828');
          K.rect(g, sx - 1, 218, 2, 26, '#3a2420');
          K.rect(g, sx - 8, 244, 16, 2, '#2a1a18');
        }
        /* 碗与筷 */
        K.rect(g, 96, 188, 26, 8, '#e8dcc0');
        K.rect(g, 96, 188, 26, 1, '#fff3d8');
        K.rect(g, 100, 190, 18, 2, '#c9a878');
        K.rect(g, 130, 186, 2, 10, '#8a6a3e');
        K.rect(g, 134, 187, 1, 9, '#8a6a3e');
        /* 辣椒罐 */
        K.rect(g, 200, 182, 10, 14, '#8a2a22');
        K.rect(g, 202, 180, 6, 3, '#c9402e');
      });
    },
    live(g, t, shot, cam) {
      /* 蒸汽 */
      P.steam(g, 388, 136, t, 3, 16, '#e0d8c8', 72);
      P.steam(g, 108, 184, t, 6, 8, '#d9c9a8', 40);
      /* 吊灯 */
      for (let i = 0; i < 3; i++) {
        const lx = 150 + i * 170;
        const fl = 0.8 + 0.12 * Math.sin(t * 4.3 + i * 2.1);
        P.glow(g, lx, 26, 34, '#f2c05e', fl * 0.26);
        g.save();
        g.globalAlpha = fl;
        K.rect(g, lx - 4, 23, 9, 3, '#ffe9a8');
        g.restore();
      }
      /* 煮面的手 */
      const hx = 400 + Math.round(Math.sin(t * 1.6) * 8);
      K.rect(g, hx, 130, 3, 14, '#d9a878');
      K.rect(g, hx - 4, 126, 11, 6, '#2a2a32');
      K.rect(g, hx - 6, 124, 15, 2, '#4a4a52');
      /* 女孩吃面 / 在店里帮工 */
      const w = shot.who;
      if (w !== false) {
        const gx = (w && w.x) || 150;
        const work = shot.work === true;
        A.sit(g, gx, 170, t, {
          coat: work ? '#cfc9ba' : '#e9d9b8',
          hair: '#3a2740',
          hands: true,
          apron: work ? '#5e6e62' : null
        });
        if (work) {
          /* 抹布在柜台上打圈：帮工的人和吃面的人是两套动作 */
          const wx = gx + 6 + Math.round(Math.sin(t * 2.4) * 7);
          K.rect(g, wx, 184, 9, 3, '#8a6a3e');
          K.rect(g, wx + 1, 183, 7, 1, '#a8885a');
          K.rect(g, wx + 10, 184, 2, 3, '#e9d9b8');
        } else {
          const lift = Math.max(0, Math.sin(t * 1.9)) * 4;
          K.rect(g, gx + 6, 178 - lift, 2, 14, '#8a6a3e');
          K.rect(g, gx + 8, 180 - lift, 1, 12, '#8a6a3e');
        }
      }
      /* 门口飘进来的雨 */
      P.glassRain(g, t, { x: 500, y: 30, w: 110, h: 150, count: 10, seed: 21, color: '#8fa4cd' });
      P.rainStreaks(g, t, { x: cam.x, y: 0, w: cam.w, h: 270, count: 30, seed: 23, alpha: 0.14, speed: 240 });
      /* 热气在灯下打转 */
      for (let i = 0; i < 8; i++) {
        const x = 330 + Math.floor(K.rnd(i * 4.1) * 180 + Math.sin(t * 0.8 + i) * 6);
        const y = 120 + Math.floor((K.rnd(i * 6.7) * 70 + t * 7) % 70);
        g.save();
        g.globalAlpha = 0.14 + 0.12 * Math.sin(t * 2 + i);
        K.rect(g, x, y, 1, 1, '#f2d492');
        g.restore();
      }
    }
  };

  /* ============ 红砖居民楼 ============ */
  S.brick = {
    w: 760, h: 270,
    world(v) {
      const bk = brickParams(v);
      return world('brick' + (v | 0), 760, 270, (g) => {
        K.grad(g, 0, 0, 760, 270, [
          { p: 0, c: '#0a0c1a' },
          { p: 0.6, c: '#151428' },
          { p: 1, c: '#1e1622' }
        ]);
        /* 楼体 */
        K.rect(g, 0, 0, 760, 216, '#3a2422');
        for (let y = 0; y < 216; y += 5) {
          K.rect(g, 0, y, 760, 1, '#2e1c1c');
          const off = (y % 10 === 0) ? 0 : 9;
          for (let x = off; x < 760; x += 18) K.rect(g, x, y, 1, 5, '#2e1c1c');
        }
        /* 楼层线 */
        for (let i = 0; i < 3; i++) K.rect(g, 0, 72 + i * 48, 760, 3, '#241618');
        /* 窗 */
        for (let f = 0; f < 3; f++) {
          for (let c = 0; c < 7; c++) {
            const wx = 46 + c * 104;
            const wy = 26 + f * 48;
            if ((f * 7 + c) % 9 === 4) continue;
            K.rect(g, wx - 3, wy - 3, 46, 36, '#22161a');
            K.rect(g, wx, wy, 40, 30, '#0c1020');
            const lit = K.rnd(bk.sd + f * 13 + c * 5.1) > 0.42;
            if (lit) {
              K.rect(g, wx + 1, wy + 1, 38, 28, K.rnd(bk.sd + c * 3.3 + f) > 0.7 ? '#e8a04a' : '#d9a84e');
              g.save();
              g.globalAlpha = 0.135;
              K.rect(g, wx + 1, wy + 1, 38, 28, '#ffe9a8');
              g.restore();
              /* 窗帘/人影 */
              K.rect(g, wx + 1, wy + 1, 12, 28, '#a8763c');
              if (K.rnd(bk.sd + c * 7.7 + f * 2.3) > 0.6) {
                K.rect(g, wx + 20, wy + 10, 8, 18, '#8a5a30');
                K.rect(g, wx + 22, wy + 6, 4, 4, '#7a4a28');
              }
            } else {
              K.rect(g, wx + 1, wy + 1, 38, 28, '#101626');
              K.dither(g, wx + 1, wy + 1, 38, 28, '#101626', '#1a2440', 2);
            }
            K.rect(g, wx + 19, wy, 2, 30, '#1a1216');
            K.frame(g, wx, wy, 40, 30, '#4a3230');
            K.rect(g, wx - 4, wy + 30, 48, 3, '#2a1a1a');
          }
        }
        /* 楼道门 */
        const dx = bk.doorX;
        K.rect(g, dx, 158, 40, 58, '#1a1014');
        K.rect(g, dx + 4, 162, 32, 54, '#2a1c1c');
        K.rect(g, dx + 8, 168, 24, 20, '#0c1020');
        g.save();
        g.globalAlpha = 0.5;
        K.rect(g, dx + 8, 168, 24, 20, '#8a6a3e');
        g.restore();
        K.rect(g, dx + 28, 196, 2, 4, '#c9b592');
        /* 地面 */
        K.rect(g, 0, 216, 760, 54, '#1a1418');
        for (let i = 0; i < 9; i++) K.rect(g, 0, 220 + i * 6, 760, 1, '#241a1e');
        P.puddle(g, 120 + (bk.sd % 160), 236, 150, 18, 0, bk.sd + 31, '#2e2440');
        P.puddle(g, 420 + (bk.sd % 120), 244, 120, 14, 0, bk.sd + 33, '#2e2440');
        /* 树 */
        P.tree(g, bk.treeX[0], 222, 70 + (bk.sd % 30), bk.sd + 5, 0);
        P.tree(g, bk.treeX[1], 222, 76 + (bk.sd % 26), bk.sd + 9, 0);
        /* 自行车 */
        P.bike(g, bk.bikeX[0], 240);
        P.bike(g, bk.bikeX[1], 246);
        /* 空调外机 */
        P.ac(g, bk.acX[0], 108);
        P.ac(g, bk.acX[1], 60);
        /* 晾衣绳 */
        P.laundry(g, bk.lineX, 96, 0, bk.sd + 3);
        if (S.variant) S.variant.dress(g, v, { land: false, w: 760, gy: 232 });
      });
    },
    live(g, t, shot, cam) {
      const bk = brickParams(shot.v || 1);
      /* 串灯 */
      const pts = [];
      for (let i = 0; i < 13; i++) {
        const x = 20 + i * 60;
        const y = 14 + Math.sin(i * 0.7) * 5;
        pts.push([x, y]);
      }
      P.bulbs(g, pts, t, '#f2c05e');
      /* 窗光呼吸 */
      for (let f = 0; f < 3; f++) {
        for (let c = 0; c < 7; c++) {
          if ((f * 7 + c) % 9 === 4) continue;
          const lit = K.rnd(bk.sd + f * 13 + c * 5.1) > 0.42;
          if (!lit) continue;
          const wx = 46 + c * 104;
          const wy = 26 + f * 48;
          g.save();
          g.globalAlpha = 0.06 + 0.04 * Math.sin(t * 1.7 + f + c);
          K.rect(g, wx + 1, wy + 1, 38, 28, '#ffe9a8');
          g.restore();
        }
      }
      /* 晾衣摆动 */
      P.laundry(g, bk.lineX, 96, t, bk.sd + 3);
      /* 水洼涟漪 + 灯光倒影 */
      for (let i = 0; i < 5; i++) {
        const rx = 200 + K.rnd(i * 3.3) * 110;
        const rr = (t * 5 + i * 8) % 16;
        g.save();
        g.globalAlpha = 0.22 * (1 - rr / 16);
        K.ring(g, rx, 242, Math.max(1, Math.round(rr * 0.4)), '#8fa4cd');
        g.restore();
      }
      /* 猫在台阶上 */
      A.cat(g, bk.doorX + 8, 210, t, bk.sd % 8);
      /* 有人开窗：一格窗里的影子移动 */
      const wx = 46 + bk.col * 104;
      const wy = 26 + bk.row * 48;
      const sh = Math.sin(t * 0.6) * 6;
      g.save();
      g.globalAlpha = 0.55;
      K.rect(g, wx + 22 + sh, wy + 10, 7, 18, '#8a5a30');
      g.restore();
      /* 雨 */
      P.rainStreaks(g, t, { x: cam.x, y: 0, w: cam.w, h: 270, count: 50, seed: 27, alpha: 0.2 * (shot.rain || 1), speed: 260 });
      const w = shot.who;
      if (w) {
        if (w.k === 'girl') A.girl(g, w.x, w.y, t, w);
        else if (w.k === 'boy') A.boy(g, w.x, w.y, t, w);
      }
    }
  };

  /* ============ 街角 / 便利店 ============ */
  S.street = {
    w: 800, h: 270,
    world(v) {
      const st = streetParams(v);
      return world('street' + (v | 0), 800, 270, (g) => {
        K.grad(g, 0, 0, 800, 190, [
          { p: 0, c: '#070a16' },
          { p: 0.6, c: '#101528' },
          { p: 1, c: '#1a1a2c' }
        ]);
        if (S.variant) S.variant.sky(g, v, { w: 800, hz: 178 });
        /* 远处楼 */
        P.skylineSil(g, 0, 190, 800, 54, '#0a0f1e', st.sd);
        const lights = P.buildings(g, {
          x0: -8, x1: 810, baseY: 192,
          count: 12 + (st.sd % 8), wMin: 30, wMax: 60, hMin: 36, hMax: 66 + (st.sd % 28),
          seed: st.sd + 8, shades: ['#0c1224', '#0f1628', '#0a1020'],
          windows: true, litAt: 0.66
        });
        this.lights = lights;
        (this.lightsByV = this.lightsByV || {})[v | 0] = lights;
        /* 便利店：玻璃偏青，货架压暗，避免整块惨白 */
        K.rect(g, 60, 130, 200, 78, '#1a1c2e');
        K.rect(g, 60, 130, 200, 5, '#2a2e44');
        K.rect(g, 68, 138, 184, 54, '#9fc8c6');
        K.grad(g, 68, 138, 184, 54, [
          { p: 0, c: '#a8d2cc' },
          { p: 1, c: '#6e9c9e' }
        ]);
        /* 货架剪影 */
        for (let i = 0; i < 3; i++) {
          K.rect(g, 80 + i * 56, 148, 40, 36, '#5f8a8c');
          K.rect(g, 80 + i * 56, 158, 40, 2, '#466e72');
          K.rect(g, 80 + i * 56, 170, 40, 2, '#466e72');
        }
        /* 玻璃格栅 */
        for (let i = 0; i < 4; i++) K.rect(g, 68 + i * 46, 138, 2, 54, '#4a6a70');
        /* 门 */
        K.rect(g, 176, 146, 62, 62, '#7fa8a8');
        K.rect(g, 178, 148, 58, 58, '#a8ccc8');
        K.rect(g, 206, 148, 2, 58, '#5f8a8c');
        /* 招牌 */
        K.rect(g, 58, 112, 204, 18, '#1e3a3a');
        K.rect(g, 60, 114, 200, 14, '#2e6a6a');
        for (let i = 0; i < 6; i++) K.rect(g, 72 + i * 30, 118, 20, 6, '#8fd0c8');
        /* 店内：柜台、店员剪影、货品色带 */
        K.rect(g, 74, 176, 96, 16, '#5d8486');
        K.rect(g, 74, 176, 96, 2, '#7aa2a2');
        K.rect(g, 196, 170, 12, 20, '#4e7678');
        K.rect(g, 198, 164, 8, 7, '#3c5c60');
        for (let i = 0; i < 3; i++) {
          for (let k = 0; k < 7; k++) {
            if (K.rnd(i * 9.1 + k * 3.7) > 0.55) continue;
            K.rect(g, 82 + i * 56 + k * 5, 150 + (k % 2) * 6, 3, 4, K.rnd(i + k * 2.3) > 0.6 ? '#d8a05a' : '#6a8aa0');
          }
        }
        /* 雨棚与吊牌 */
        K.rect(g, 54, 126, 212, 4, '#20262e');
        for (let i = 0; i < 6; i++) K.rect(g, 60 + i * 34, 126, 2, 5, '#161a20');
        K.bit(g, '24H', 232, 100, '#8fd0c8', 1);
        /* 光晕 */
        P.glow(g, 160, 166, 92, '#9fd8d8', 0.10);
        /* 楼脚与远处的湿路面 */
        K.rect(g, 0, 192, 800, 16, '#0d1120');
        for (let i = 0; i < 26; i++) {
          const sx = K.rnd(i * 4.7) * 800;
          g.save();
          g.globalAlpha = 0.10 + 0.10 * K.rnd(i * 2.3);
          K.rect(g, sx, 194 + (i % 3) * 5, 4 + Math.floor(K.rnd(i * 6.1) * 12), 1, i % 2 ? '#8fa4cd' : '#f2c05e');
          g.restore();
        }
        /* 人行道与马路 */
        K.rect(g, 0, 208, 800, 12, '#38343f');
        K.rect(g, 0, 208, 800, 1, '#4a4652');
        for (let i = 0; i < 20; i++) K.rect(g, i * 40, 208, 2, 12, '#2c2830');
        K.rect(g, 0, 220, 800, 50, '#181620');
        /* 湿地面倒影：竖向拉长的灯色 */
        const refl = [[160, '#9fd8d8', 0.18], [470, '#ffd98a', 0.16], [700, '#ffd98a', 0.14]];
        for (let i = 0; i < refl.length; i++) {
          const rx = refl[i][0];
          for (let y = 222; y < 268; y += 3) {
            const w = 6 + Math.floor(K.rnd(i * 7.1 + y) * 14);
            g.save();
            g.globalAlpha = refl[i][2] * (1 - (y - 222) / 50);
            K.rect(g, rx - w / 2 + Math.sin(y * 0.7 + i) * 2, y, w, 1, refl[i][1]);
            g.restore();
          }
        }
        /* 街边：自行车与花坛 */
        P.bike(g, 236, 236);
        /* 第二间小店 */
        K.rect(g, st.shopX, 138, 74, 54, '#1a1826');
        K.rect(g, st.shopX + 4, 142, 66, 38, '#2a2438');
        K.rect(g, st.shopX + 6, 144, 62, 34, '#5a4a3e');
        for (let i = 0; i < 3; i++) K.rect(g, st.shopX + 10 + i * 20, 150, 14, 24, '#3a2e28');
        K.rect(g, st.shopX - 3, 132, 80, 8, '#2e2432');
        for (let i = 0; i < 5; i++) K.rect(g, st.shopX + 1 + i * 16, 132, 8, 8, i % 2 ? '#8a4a3a' : '#c8a06a');
        P.glow(g, st.shopX + 36, 160, 34, '#ffd98a', 0.10);
        /* 斑马线 */
        for (let i = 0; i < 8; i++) {
          K.rect(g, st.zebraX + i * 26, 232, 14, 34, '#2e2e40');
        }
        /* 路灯 */
        K.rect(g, st.lampA, 110, 2, 100, '#232a45');
        K.rect(g, st.lampA - 2, 106, 6, 4, '#2e3757');
        K.rect(g, st.lampA - 4, 100, 10, 6, '#ffe9a8');
        K.rect(g, st.lampB, 96, 2, 114, '#232a45');
        K.rect(g, st.lampB - 2, 92, 6, 4, '#2e3757');
        K.rect(g, st.lampB - 4, 86, 10, 6, '#ffe9a8');
        /* 红绿灯 */
        K.rect(g, 574, 96, 4, 116, '#232a45');
        K.rect(g, 568, 90, 16, 30, '#1a1a24');
        K.rect(g, 572, 94, 8, 6, '#5a2a2a');
        K.rect(g, 572, 102, 8, 6, '#5a4a2a');
        K.rect(g, 572, 110, 8, 6, '#2a4a3a');
        /* 消防栓 */
        K.rect(g, 320, 196, 8, 12, '#8a2a22');
        K.rect(g, 318, 200, 12, 3, '#c9402e');
        /* 护栏 */
        for (let i = 0; i < 5; i++) K.rect(g, 740 + i * 14, 196, 2, 16, '#2a3352');
        K.rect(g, 740, 198, 58, 2, '#2a3352');
        if (S.variant) S.variant.dress(g, v, { w: 800, hz: 192, gy: 208 });
      });
    },
    live(g, t, shot, cam) {
      const st = streetParams(shot.v || 1);
      const L = this.lightsByV && this.lightsByV[(shot.v || 1) | 0];
      if (L) P.lamps(g, L, t);
      /* 店招呼吸 */
      const fl = 0.85 + 0.15 * Math.sin(t * 6.2);
      P.glow(g, 160, 160, 84, '#9fd8d8', fl * 0.12);
      /* 红绿灯 */
      const phase = Math.floor((t + st.carOff * 0.01) / 2.2) % 3;
      K.rect(g, 572, 94, 8, 6, phase === 0 ? '#e8404a' : '#5a2a2a');
      K.rect(g, 572, 102, 8, 6, phase === 1 ? '#e8c04a' : '#5a4a2a');
      K.rect(g, 572, 110, 8, 6, phase === 2 ? '#4ae08a' : '#2a4a3a');
      /* 路灯 */
      P.lampPost(g, st.lampA, 208, t, 100);
      P.lampPost(g, st.lampB, 208, t, 110);
      /* 过路的车 */
      for (let c = 0; c < st.carN; c++) {
        const dirL = (c + st.sd) % 2 === 0;
        const sp = 90 + ((st.sd + c * 37) % 60);
        const cx = dirL
          ? 820 - ((t * sp + c * 300 + st.carOff) % 1000)
          : -80 + ((t * sp + c * 260 + st.carOff) % 1000);
        const cy = 226 + (c % 2) * 24;
        g.save();
        g.globalAlpha = 0.95;
        K.rect(g, cx, cy, 40, 13, c % 2 ? '#1a1c2e' : '#241c26');
        K.rect(g, cx + 7, cy - 8, 26, 9, c % 2 ? '#20242e' : '#2a2130');
        K.rect(g, cx + 9, cy - 7, 10, 7, '#3a4258');
        K.rect(g, cx + 22, cy - 7, 9, 7, '#3a4258');
        K.rect(g, cx + (dirL ? 0 : 37), cy + 4, 3, 3, '#ffe9a8');
        g.restore();
        g.save();
        g.globalAlpha = 0.16;
        K.rect(g, cx - (dirL ? 0 : 20) + (dirL ? -24 : 44), cy + 5, 24, 2, '#ffe9a8');
        K.rect(g, cx, cy + 13, 40, 4, '#0a0c16');
        g.restore();
      }
      /* 雨 */
      P.rainStreaks(g, t, { x: cam.x, y: 0, w: cam.w, h: 270, count: 90, seed: 29, alpha: 0.34 * (shot.rain || 1), speed: 320 });
      /* 水洼 */
      for (let i = 0; i < 8; i++) {
        const rx = 90 + K.rnd(i * 3.7) * 600;
        const ry = 228 + K.rnd(i * 5.9) * 34;
        const rr = (t * 6 + i * 5) % 18;
        g.save();
        g.globalAlpha = 0.24 * (1 - rr / 18);
        K.ring(g, rx, ry, Math.max(1, Math.round(rr * 0.5)), '#9fb6d8');
        g.restore();
      }
      /* 便利店里的店员走动 */
      const clerkX = 88 + (st.sd % 20) + (Math.sin(t * 0.5 + st.sd * 0.01) * 0.5 + 0.5) * 60;
      g.save();
      g.globalAlpha = 0.5;
      K.rect(g, clerkX, 154, 6, 16, '#4a8888');
      K.rect(g, clerkX + 1, 150, 4, 4, '#3a6a6a');
      g.restore();
      /* 打伞的人 */
      const w = shot.who;
      if (w) {
        if (w.k === 'girl') {
          A.girl(g, w.x, w.y, t, w);
          if (w.umbrella) A.umbrella(g, w.x + 2, w.y - 26, t, '#3a4a6a');
        } else if (w.k === 'boy') {
          A.boy(g, w.x, w.y, t, w);
          if (w.umbrella) A.umbrella(g, w.x + 2, w.y - 26, t, '#2a3450');
        }
      }
    }
  };
})(typeof window !== 'undefined' ? window : null);
