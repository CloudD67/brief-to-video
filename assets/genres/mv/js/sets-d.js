/* 场景库 D：楼梯 / 掌心里的城 / 黎明 / 旧厂房 */
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

  function stairParams(v) {
    return {
      stepW: 40 + vno(v, 41, 0, 10),
      stepH: 17 + vno(v, 42, 0, 6),
      lampN: 3 + vno(v, 43, 0, 2),
      lampStep: 104 + vno(v, 44, 0, 30),
      winX: 400 + vno(v, 45, 0, 70),
      seed: vno(v, 46, 0, 900)
    };
  }

  function dawnParams(v) {
    return {
      sunX: 540 + vno(v, 41, 0, 300),
      lampN: 4 + vno(v, 42, 0, 2),
      lampStep: 160 + vno(v, 43, 0, 60),
      treeX: 760 + vno(v, 44, 0, 110),
      bridgeX: 70 + vno(v, 45, 0, 130),
      seed: vno(v, 46, 0, 900)
    };
  }

  /* ============ 楼梯 ============ */
  S.stair = {
    w: 520, h: 270,
    world(v) {
      const sr = stairParams(v);
      return world('stair' + (v | 0), 520, 270, (g) => {
        K.grad(g, 0, 0, 520, 270, [
          { p: 0, c: '#0c0f1c' },
          { p: 0.6, c: '#151628' },
          { p: 1, c: '#1e1724' }
        ]);
        /* 侧墙 */
        K.rect(g, 0, 0, 520, 270, '#14121f');
        for (let y = 0; y < 270; y += 8) K.rect(g, 0, y, 520, 1, '#181528');
        /* 楼梯：从左下到右上 */
        const stepW = sr.stepW;
        const stepH = sr.stepH;
        for (let i = 0; i < 11; i++) {
          const x = i * stepW;
          const y = 250 - i * stepH;
          K.rect(g, x, y, stepW, 14, '#2e2636');
          K.rect(g, x, y, stepW, 2, '#443a4e');
          K.rect(g, x, y + 14, stepW, stepH - 14, '#241e2c');
          K.rect(g, x, y + 14, 2, stepH - 14, '#1a1622');
        }
        /* 台阶下方的暗面 */
        K.rect(g, 0, 250, 520, 20, '#0c0a12');
        /* 扶手 */
        for (let i = 0; i < 11; i++) {
          const x = i * stepW + 20;
          const y = 250 - i * stepH;
          K.rect(g, x, y - 26, 2, 26, '#3a3040');
        }
        for (let i = 0; i < 11; i++) {
          const x = i * stepW + 20;
          const y = 250 - i * stepH - 26;
          const x2 = (i + 1) * stepW + 20;
          const y2 = 250 - (i + 1) * stepH - 26;
          K.line(g, x, y, x2, y2, '#4a3e50', 2);
        }
        /* 壁灯 */
        for (let i = 0; i < sr.lampN; i++) {
          const lx = 70 + i * sr.lampStep;
          const ly = 200 - i * Math.round(sr.lampStep * 0.39);
          K.rect(g, lx, ly, 3, 8, '#3a3040');
          K.rect(g, lx - 2, ly + 8, 7, 4, '#ffe9a8');
        }
        /* 尽头的小窗 */
        const wx = sr.winX;
        K.rect(g, wx, 24, 44, 40, '#1a1424');
        K.rect(g, wx + 3, 27, 38, 34, '#2a2c50');
        K.frame(g, wx + 3, 27, 38, 34, '#3a2a3a');
        g.save();
        g.globalAlpha = 0.35;
        K.grad(g, wx + 3, 27, 38, 34, [
          { p: 0, c: '#3a4a7a' },
          { p: 1, c: '#1a1c34' }
        ]);
        g.restore();
      });
    },
    live(g, t, shot, cam) {
      const sr = stairParams(shot.v || 1);
      /* 壁灯呼吸 */
      for (let i = 0; i < sr.lampN; i++) {
        const lx = 70 + i * sr.lampStep;
        const ly = 200 - i * Math.round(sr.lampStep * 0.39);
        const fl = 0.72 + 0.14 * Math.sin(t * 4.7 + i * 2.3);
        P.glow(g, lx + 1, ly + 10, 26, '#ffd98a', fl * 0.26);
        g.save();
        g.globalAlpha = fl;
        K.rect(g, lx - 2, ly + 8, 7, 4, '#ffe9a8');
        g.restore();
      }
      /* 墙上的光斑 */
      for (let i = 0; i < 5; i++) {
        P.glow(g, 60 + i * sr.lampStep, 150 - i * 30, 34, '#ffd98a', 0.07 + 0.04 * Math.sin(t * 2.1 + i * 1.7));
      }
      /* 灰尘 */
      for (let i = 0; i < 12; i++) {
        const x = 40 + Math.floor(K.rnd(i * 3.7) * 440 + Math.sin(t * 0.5 + i) * 4);
        const y = 120 + Math.floor((K.rnd(i * 5.3) * 120 + t * 4) % 120);
        g.save();
        g.globalAlpha = 0.16 + 0.14 * Math.sin(t * 1.6 + i);
        K.rect(g, x, y, 1, 1, '#e8dcb8');
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

  /* ============ 掌心里的城 ============ */
  S.mini = {
    w: 480, h: 270,
    world(v) {
      return world('mini' + (v | 0), 480, 270, (g) => {
        K.grad(g, 0, 0, 480, 270, [
          { p: 0, c: '#05070f' },
          { p: 0.5, c: '#0a0f1e' },
          { p: 1, c: '#120d1a' }
        ]);
        /* 远处的星尘带 */
        for (let i = 0; i < 120; i++) {
          const x = Math.floor(K.rnd(i * 3.1) * 480);
          const y = Math.floor(K.rnd(i * 7.3) * 270);
          K.rect(g, x, y, 1, 1, K.rnd(i * 5.9) > 0.85 ? '#8fd8d2' : '#2a3352');
        }
        /* 两只捧起的手：掌心朝上，手指微向内收，边缘有城市投来的冷光 */
        const SKIN = '#3a2830';
        const SKIN2 = '#4e3438';
        const RIM = '#8a6050';
        function hand(dir) {
          const c = 240 + dir * 40;
          /* 手腕 → 掌心：从下往上收窄 */
          K.rect(g, c - 18, 236, 36, 34, SKIN);
          K.rect(g, c - 22, 214, 44, 24, SKIN);
          K.rect(g, c - 24, 206, 46, 10, SKIN2);
          /* 四指：由外到内变长，向内微收 */
          const fw = 9;
          for (let i = 0; i < 4; i++) {
            const fx = c - 25 + dir * (i * 12 - 4) - (dir < 0 ? 0 : 0);
            const top = 190 + i * 3;
            K.rect(g, fx, top, fw, 22, SKIN);
            K.rect(g, fx + (dir > 0 ? fw - 1 : 0), top, 1, 22, SKIN2);
            K.rect(g, fx, top, fw, 1, RIM);
          }
          /* 拇指：靠内侧、更低 */
          K.rect(g, c + dir * 20, 204, 10, 16, SKIN);
          K.rect(g, c + dir * 20, 204, 10, 1, RIM);
          /* 掌心冷光 */
          K.rect(g, c - 16, 210, 32, 1, '#4a5a6a');
          K.rect(g, c - 20, 216, 40, 1, '#2e3a48');
        }
        hand(-1);
        hand(1);
      });
    },
    live(g, t, shot) {
      const cx = 240;
      const cy = 194;
      /* 掌心光 */
      const pulse = 0.6 + 0.14 * Math.sin(t * 2.2);
      P.glow(g, cx, cy - 10, 58, '#8fd8d2', pulse * 0.34);
      P.glow(g, cx, cy - 10, 96, '#8fd8d2', pulse * 0.10);
      /* 微缩城市 */
      A.miniCity(g, cx, cy, t, 2.2, 5);
      /* 环绕的光点 */
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + t * 0.55;
        const r = 44 + Math.sin(t * 1.1 + i) * 6;
        const x = cx + Math.cos(a) * r;
        const y = cy - 12 + Math.sin(a) * r * 0.42;
        g.save();
        g.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3 + i);
        K.rect(g, Math.round(x), Math.round(y), 1, 1, i % 3 ? '#f2c05e' : '#8fd8d2');
        g.restore();
      }
      /* 上浮的碎片 */
      for (let i = 0; i < 8; i++) {
        const y = 200 - ((t * 12 + i * 24) % 140);
        const x = cx - 60 + K.rnd(i * 4.3) * 120 + Math.sin(t * 0.9 + i) * 6;
        const s = 1 + Math.floor(K.rnd(i * 2.7) * 2);
        g.save();
        g.globalAlpha = 0.7 * (1 - (200 - y) / 170);
        K.rect(g, Math.round(x), Math.round(y), s, s, i % 3 ? '#4a6a8a' : '#8fd8d2');
        g.restore();
      }
      /* 碎片合拢的一瞬 */
      if (shot.merge) {
        const p = K.clamp((t - (shot.mergeAt || 1.2)) / 0.9, 0, 1);
        if (p > 0) {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const r = 60 * (1 - K.smooth(p));
            const x = cx + Math.cos(a) * r;
            const y = cy - 12 + Math.sin(a) * r * 0.6;
            K.rect(g, Math.round(x), Math.round(y), 2, 2, '#bff2ea');
          }
        }
      }
      /* 中间悬浮的碎片 */
      A.shard(g, cx, cy - 30 - Math.sin(t * 1.3) * 3, t, 1.4);
    }
  };

  /* ============ 黎明 ============ */
  S.dawn = {
    w: 900, h: 270,
    world(v) {
      const dn = dawnParams(v);
      return world('dawn' + (v | 0), 900, 270, (g) => {
        K.grad(g, 0, 0, 900, 190, [
          { p: 0, c: '#101a3a' },
          { p: 0.4, c: '#2a2c50' },
          { p: 0.72, c: '#6a4460' },
          { p: 1, c: '#c97a4e' }
        ]);
        /* 晨光 */
        const sunR = 58 + dn.seed % 26;
        g.save();
        g.globalAlpha = 0.5;
        K.disc(g, dn.sunX, 178, sunR, '#e8944a');
        g.globalAlpha = 0.3;
        K.disc(g, dn.sunX, 178, sunR + 60, '#c9703e');
        g.restore();
        P.skylineSil(g, 0, 186, 900, 48 + dn.seed % 14, '#1a1c30', dn.seed);
        const lights = P.buildings(g, {
          x0: -8, x1: 910, baseY: 188,
          count: 15 + dn.seed % 6, wMin: 20, wMax: 48 + dn.seed % 10,
          hMin: 24, hMax: 70 + dn.seed % 30,
          seed: dn.seed + 7, shades: ['#141828', '#181c2e', '#121624'],
          windows: true, litAt: 0.82
        });
        this.lights = lights;
        (this.lightsByV = this.lightsByV || {})[v | 0] = lights;
        /* 路面 */
        K.rect(g, 0, 188, 900, 82, '#242030');
        for (let i = 0; i < 10; i++) K.rect(g, 0, 192 + i * 8, 900, 1, '#1e1a28');
        /* 车道线 */
        for (let i = 0; i < 12; i++) K.rect(g, 20 + i * 76, 244, 40, 3, '#4a4458');
        /* 路灯 */
        for (let i = 0; i < dn.lampN; i++) {
          const lx = 90 + Math.round(i * (900 - 140) / dn.lampN) + dn.seed % 18;
          K.rect(g, lx, 128, 2, 62, '#2a2634');
          K.rect(g, lx - 1, 124, 5, 4, '#3a3448');
          K.rect(g, lx, 122, 3, 3, '#ffd28a');
        }
        /* 树 */
        P.tree(g, dn.treeX, 190, 52 + dn.seed % 22, dn.seed + 11, 0);
        /* 远处的桥 */
        const bw = 140 + dn.seed % 70;
        K.rect(g, dn.bridgeX, 176, bw, 3, '#22243a');
        for (let i = 0; i < 4; i++) K.rect(g, dn.bridgeX + 10 + Math.round(i * (bw - 20) / 4), 179, 2, 12, '#1e2034');
        /* 与别的镜头区分：远处多一站灯 */
        if (dn.seed % 3 === 0) {
          K.rect(g, 40 + dn.seed % 40, 168, 3, 20, '#2a2634');
          K.rect(g, 33 + dn.seed % 40, 164, 17, 4, '#2f2b3c');
        }
      });
    },
    live(g, t, shot, cam) {
      const dn = dawnParams(shot.v || 1);
      const L = this.lightsByV && this.lightsByV[(shot.v || 1) | 0];
      if (L) P.lamps(g, L, t);
      /* 晨光升高一点点 */
      g.save();
      g.globalAlpha = 0.10 + 0.04 * Math.sin(t * 0.6);
      K.disc(g, dn.sunX, 176 - Math.sin(t * 0.3) * 3, 90, '#ffb46a');
      g.restore();
      /* 路灯将熄：越到后面越暗 */
      const fade = shot.fade != null ? shot.fade : 0.85;
      for (let i = 0; i < dn.lampN; i++) {
        const lx = 90 + Math.round(i * (900 - 140) / dn.lampN) + dn.seed % 18;
        const fl = (0.55 + 0.35 * Math.sin(t * 3.3 + i * 1.9)) * fade;
        P.glow(g, lx + 1, 124, 28, '#ffd28a', Math.max(0, fl) * 0.26);
      }
      /* 鸟 */
      const birdN = 3 + dn.seed % 4;
      for (let i = 0; i < birdN; i++) {
        const bx = ((t * (26 + i * 6) + i * 160 + dn.seed % 240) % 1000) - 60;
        const by = 62 + dn.seed % 16 + Math.sin(t * 0.9 + i) * 14 + i * 8;
        const fl = Math.sin(t * 6 + i * 2) > 0 ? 1 : -1;
        K.line(g, bx - 3, by, bx, by + fl * 2, '#1a1c30', 1);
        K.line(g, bx, by + fl * 2, bx + 3, by, '#1a1c30', 1);
      }
      /* 云 */
      P.clouds(g, 900, 30, t * 0.6, dn.seed + 5, '#3a3454');
      /* 人 */
      const w = shot.who;
      if (w) {
        if (w.k === 'girl') A.girl(g, w.x, w.y, t, w);
        else if (w.k === 'boy') A.boy(g, w.x, w.y, t, w);
      }
    }
  };

  /* ============ 旧厂房 / 东郊记忆 ============ */
  S.station = {
    w: 820, h: 270,
    world(v) {
      return world('station' + (v | 0), 820, 270, (g) => {
        K.grad(g, 0, 0, 820, 200, [
          { p: 0, c: '#080a16' },
          { p: 0.6, c: '#121428' },
          { p: 1, c: '#22203a' }
        ]);
        P.stars(g, 820, 100, 0, 20, 97);
        /* 厂房砖体 */
        K.rect(g, 40, 40, 620, 170, '#3e2a26');
        for (let y = 42; y < 208; y += 5) {
          K.rect(g, 40, y, 620, 1, '#33211f');
          const off = (y % 10 === 0) ? 0 : 9;
          for (let x = 40 + off; x < 660; x += 18) K.rect(g, x, y, 1, 5, '#33211f');
        }
        /* 大窗 */
        for (let i = 0; i < 4; i++) {
          const wx = 78 + i * 148;
          K.rect(g, wx - 4, 70, 116, 84, '#241a1a');
          for (let k = 0; k < 6; k++) K.rect(g, wx, 74 + k * 13, 108, 11, '#0d1222');
          for (let k = 0; k < 6; k++) K.rect(g, wx, 74 + k * 13, 108, 1, '#1e2740');
          for (let k = 0; k < 4; k++) K.rect(g, wx + 24 * k, 74, 2, 78, '#241a1a');
          K.frame(g, wx - 4, 70, 116, 84, '#4a3230');
          /* 里面的灯 */
          g.save();
          g.globalAlpha = 0.25;
          K.rect(g, wx, 74, 108, 78, '#e8a04a');
          g.restore();
        }
        /* 烟囱 */
        K.rect(g, 690, 34, 26, 176, '#3a2422');
        K.rect(g, 690, 34, 26, 4, '#4e3230');
        K.rect(g, 690, 60, 26, 3, '#2e1c1c');
        K.rect(g, 690, 120, 26, 3, '#2e1c1c');
        /* 屋顶 */
        K.rect(g, 30, 34, 640, 8, '#2a1c1c');
        for (let i = 0; i < 21; i++) K.rect(g, 30 + i * 32, 30, 3, 5, '#3a2626');
        /* 铁轨 */
        K.rect(g, 0, 214, 820, 6, '#2a2634');
        for (let i = 0; i < 40; i++) K.rect(g, i * 22, 220, 18, 2, '#1e1a26');
        for (let i = 0; i < 2; i++) K.rect(g, 0, 210 + i * 12, 820, 1, '#5a5468');
        /* 地面 */
        K.rect(g, 0, 222, 820, 48, '#14121c');
        for (let i = 0; i < 14; i++) K.rect(g, i * 62, 226, 1, 44, '#1a1622');
        /* 荒草 */
        for (let i = 0; i < 26; i++) {
          const gx = Math.floor(K.rnd(i * 3.7) * 820);
          const gh = 6 + Math.floor(K.rnd(i * 5.1) * 12);
          K.rect(g, gx, 224 - gh, 1, gh, '#243a2e');
        }
        /* 探照灯 */
        K.rect(g, 148, 214, 4, 26, '#2a2634');
        K.rect(g, 142, 208, 16, 8, '#3a3448');
      });
    },
    live(g, t, shot, cam) {
      /* 烟囱蒸汽 */
      P.steam(g, 703, 32, t * 0.7, 101, 16, '#4a4a5e', 96);
      /* 厂房内灯呼吸 */
      for (let i = 0; i < 4; i++) {
        const wx = 78 + i * 148;
        g.save();
        g.globalAlpha = 0.08 + 0.05 * Math.sin(t * 1.7 + i * 1.3);
        K.rect(g, wx, 74, 108, 78, '#ffb46a');
        g.restore();
      }
      /* 探照灯扫 */
      const a = Math.sin(t * 0.5) * 0.5;
      g.save();
      g.globalAlpha = 0.08;
      for (let i = 0; i < 30; i++) {
        const px = 150 + Math.sin(a) * i * 5;
        const py = 208 - i * 6;
        K.rect(g, px, py, 3, 3, '#cfe0ff');
      }
      g.restore();
      /* 铁轨反光 */
      for (let i = 0; i < 8; i++) {
        const rx = 20 + K.rnd(i * 3.3) * 780;
        g.save();
        g.globalAlpha = 0.10 + 0.06 * Math.sin(t * 1.9 + i);
        K.rect(g, rx, 212 + (i % 2) * 12, 30 + K.rnd(i * 2.7) * 50, 1, '#8fa4cd');
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
})(typeof window !== 'undefined' ? window : null);
