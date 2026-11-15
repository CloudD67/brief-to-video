/* 手绘场景的每镜变体：天空、地标、地物、室内墙饰、天气，以及整幅镜像。
   sets-a..d 的画家只画一次底，这里按 v 换掉构图里的大件，
   保证同一个地点在不同镜头里不是同一张画。 */
(function (root) {
  'use strict';
  const K = root.PIXEL_KIT;
  const P = root.PIXEL_PAINT;
  const S = root.PIXEL_SETS;
  if (!S || !K || !P) return;
  const V = S.variant = {};

  const DARK = '#070b14';
  const DARK2 = '#0c1220';
  const LIT = '#e8b45c';
  const RED = '#d8503c';

  const INDOOR = { room: 1, noodle: 1, stair: 1, mini: 1, station: 1, window: 1, car: 1, store: 1, insert: 1 };

  V.params = function (shot) {
    const v = shot.v || 1;
    return {
      v: v,
      flip: K.vi(v, 21, 0, 1) === 1,
      seed: K.vi(v, 28, 0, 900),
      indoor: !!INDOOR[shot.s]
    };
  };

  /* ---------------- 天空 ---------------- */

  function stars(g, w, hz, sd, n) { P.stars(g, w, hz, 0, n, sd); }

  function moon(g, w, hz, sd) {
    const mx = 54 + K.vi(sd, 1, 0, Math.max(20, w - 110));
    const my = 24 + K.vi(sd, 2, 0, 40);
    P.glow(g, mx, my, 28, '#dfe8ff', 0.14);
    K.disc(g, mx, my, 7, '#dfe6fa');
    K.disc(g, mx + 2, my - 1, 5, '#f2f6ff');
    g.save();
    g.globalAlpha = 0.18;
    K.disc(g, mx + 3, my + 2, 2, '#b9c6e8');
    g.restore();
  }

  function cloudBank(g, w, y, sd, col, a) {
    g.save();
    g.globalAlpha = a;
    for (let i = 0; i < 4; i++) {
      const cw = 120 + Math.round(K.rnd(sd + i * 3.1) * 240);
      const cx = Math.round(K.rnd(sd + i * 5.3) * Math.max(1, w - cw));
      const cy = y + i * 10 + Math.round(K.rnd(sd + i * 7.9) * 8);
      K.rect(g, cx, cy, cw, 2, col);
      K.rect(g, cx + Math.round(cw * 0.14), cy + 2, Math.round(cw * 0.62), 2, col);
      K.rect(g, cx + Math.round(cw * 0.3), cy + 4, Math.round(cw * 0.4), 1, col);
    }
    g.restore();
  }

  V.sky = function (g, v, o) {
    o = o || {};
    const w = o.w || 960;
    const hz = o.hz || 160;
    const sd = K.vi(v, 28, 0, 900);
    if (o.dawn) {
      const sx = 70 + K.vi(v, 27, 0, Math.max(20, w - 200));
      P.glow(g, sx, hz - 20, 90, '#ffb46a', 0.16);
      P.glow(g, sx, hz - 20, 40, '#ffe0a0', 0.18);
      stars(g, w, Math.round(hz * 0.55), sd, 8);
      /* 早飞的鸟 */
      for (let i = 0; i < 5; i++) {
        const bx = sx + 40 + i * 17;
        const by = 52 + (i % 3) * 9;
        K.rect(g, bx, by, 3, 1, '#3a3038');
        K.rect(g, bx + 4, by - 1, 2, 1, '#3a3038');
      }
      return;
    }
    const mode = K.vi(v, 26, 0, 3);
    if (mode === 0) {
      stars(g, w, hz, sd, 16 + (sd % 16));
      moon(g, w, hz, sd);
    } else if (mode === 1) {
      stars(g, w, hz, sd, 8 + (sd % 10));
      cloudBank(g, w, 42 + K.vi(v, 31, 0, 30), sd, '#8fa0c8', 0.10);
    } else {
      stars(g, w, Math.round(hz * 0.72), sd, 22 + (sd % 12));
      g.save();
      g.globalAlpha = 0.09;
      K.rect(g, 0, Math.max(0, hz - 26), w, 26, '#9fb0d0');
      g.restore();
      cloudBank(g, w, hz - 44, sd + 7, '#7f90b8', 0.08);
    }
  };

  /* ---------------- 远处地标 ---------------- */

  function landTower(g, x, hz, sd) {
    const h = 58 + Math.round(K.rnd(sd) * 28);
    const w = 20 + Math.round(K.rnd(sd + 1) * 12);
    K.rect(g, x, hz - h, 2, h, DARK2);
    K.rect(g, x + w - 2, hz - h, 2, h, DARK2);
    K.line(g, x, hz - h * 0.5, x + w - 2, hz - h * 0.78, DARK2, 1);
    K.rect(g, x - 3, hz - h - 16, w + 6, 16, DARK);
    K.rect(g, x - 3, hz - h - 16, w + 6, 1, '#1c2438');
    for (let i = 1; i < 4; i++) K.rect(g, x - 1, hz - h - 16 + i * 4, w + 2, 1, '#111828');
    K.rect(g, x + Math.round(w / 2), hz - h - 27, 1, 11, DARK2);
    g.save();
    g.globalAlpha = 0.85;
    K.rect(g, x + Math.round(w / 2) - 1, hz - h - 28, 3, 2, RED);
    g.restore();
  }

  function landCrane(g, x, hz, sd) {
    const h = 62 + Math.round(K.rnd(sd) * 30);
    const arm = 54 + Math.round(K.rnd(sd + 1) * 62);
    K.rect(g, x, hz - h, 2, h, DARK2);
    for (let i = 0; i < h - 10; i += 7) K.rect(g, x, hz - h + i, 6, 1, DARK2);
    K.rect(g, x - 10, hz - h, arm, 2, DARK2);
    K.rect(g, x - 10, hz - h - 2, 2, 4, DARK2);
    K.rect(g, x - 8 + arm, hz - h, 1, 10, DARK2);
    K.rect(g, x - 9 + arm, hz - h + 10, 3, 2, LIT);
    K.rect(g, x + 2, hz - h - 9, 1, 9, DARK2);
    K.rect(g, x - 4, hz - h - 11, 9, 2, '#2a2230');
  }

  function landBillboard(g, x, hz, sd) {
    const w = 46 + Math.round(K.rnd(sd) * 30);
    const h = 24 + Math.round(K.rnd(sd + 2) * 14);
    const y = hz - 74 - Math.round(K.rnd(sd + 3) * 16);
    K.rect(g, x + 8, y + h, 2, hz - y - h, DARK2);
    K.rect(g, x + w - 14, y + h, 2, hz - y - h, DARK2);
    K.rect(g, x, y, w, h, '#10162a');
    K.rect(g, x, y, w, 1, '#26304a');
    K.rect(g, x + 3, y + 3, w - 6, h - 6, '#161d33');
    g.save();
    g.globalAlpha = 0.75;
    K.rect(g, x + 7, y + 7, Math.round(w * 0.42), 3, LIT);
    K.rect(g, x + 7, y + 13, Math.round(w * 0.6), 1, '#6f7f9f');
    K.rect(g, x + 7, y + 17, Math.round(w * 0.34), 1, '#6f7f9f');
    g.restore();
    P.glow(g, x + w / 2, y + h / 2, 34, LIT, 0.07);
  }

  function landPylon(g, x, hz, sd) {
    const h = 66 + Math.round(K.rnd(sd) * 26);
    const w = 16 + Math.round(K.rnd(sd + 4) * 10);
    K.line(g, x, hz, x + Math.round(w / 2), hz - h, DARK2, 2);
    K.line(g, x + w, hz, x + Math.round(w / 2), hz - h, DARK2, 2);
    for (let i = 1; i < 5; i++) {
      const yy = hz - (h / 5) * i;
      const half = Math.round((w / 2) * (1 - i / 5)) + 2;
      K.rect(g, x + Math.round(w / 2) - half, yy, half * 2, 1, DARK2);
    }
    K.rect(g, x + Math.round(w / 2) - 12, hz - h + 8, 24, 1, DARK2);
    K.rect(g, x + Math.round(w / 2) - 9, hz - h + 15, 18, 1, DARK2);
    for (let i = 0; i < 3; i++) {
      K.line(g, x + Math.round(w / 2) - 12 + i * 12, hz - h + 8, x + Math.round(w / 2) - 12 + i * 12, hz - h + 15, DARK2, 1);
    }
    g.save();
    g.globalAlpha = 0.28;
    K.rect(g, x - 40, hz - h + 8, 40, 1, '#4a5570');
    K.rect(g, x + w + 2, hz - h + 8, 44, 1, '#4a5570');
    g.restore();
  }

  function landStacks(g, x, hz, sd) {
    for (let i = 0; i < 3; i++) {
      const h = 34 + Math.round(K.rnd(sd + i * 3.7) * 36);
      const sw = 5 + Math.round(K.rnd(sd + i * 5.1) * 4);
      const sx = x + i * 17;
      K.rect(g, sx, hz - h, sw, h, DARK);
      K.rect(g, sx + sw - 1, hz - h, 1, h, '#141b2c');
      g.save();
      g.globalAlpha = 0.5;
      K.rect(g, sx, hz - h, sw, 1, '#20283c');
      g.restore();
      for (let k = 1; k < 5; k++) {
        const py = hz - h - k * 9;
        g.save();
        g.globalAlpha = 0.2 - k * 0.03;
        K.rect(g, sx - 2 + Math.round(Math.sin(k + i) * 3), Math.max(0, py), 7 + k, 2, '#8a93ad');
        g.restore();
      }
    }
    g.save();
    g.globalAlpha = 0.5;
    K.rect(g, x - 6, hz - 4, 60, 2, DARK2);
    g.restore();
  }

  function landArch(g, x, hz, sd) {
    const w = 74 + Math.round(K.rnd(sd) * 56);
    const deck = hz - 12;
    K.rect(g, x, deck, w, 3, DARK);
    K.rect(g, x, deck, w, 1, '#1a2438');
    const n = 2;
    for (let i = 0; i < n; i++) {
      const cw = w / n;
      const cx = x + cw * i + cw / 2;
      const r = Math.round(cw / 2) - 2;
      g.save();
      g.beginPath();
      g.rect(Math.round(x + cw * i), deck - r, Math.round(cw), r + 2);
      g.clip();
      K.ring(g, Math.round(cx), deck, r, DARK2);
      K.ring(g, Math.round(cx), deck, Math.max(1, r - 3), '#131a2c');
      g.restore();
    }
    for (let i = 0; i <= n; i++) K.rect(g, Math.round(x + (w / n) * i) - 1, deck, 3, Math.max(4, hz - deck + 8), DARK2);
    for (let i = 0; i < 4; i++) {
      g.save();
      g.globalAlpha = 0.8;
      K.rect(g, x + 4 + i * Math.round(w / 4), deck - 1, 2, 1, LIT);
      g.restore();
    }
  }

  const LAND = [landTower, landCrane, landBillboard, landPylon, landStacks, landArch];

  /* ---------------- 近处地物 ---------------- */

  function nearFence(g, x, gy, sd) {
    const w = 54 + Math.round(K.rnd(sd) * 46);
    K.rect(g, x, gy - 16, w, 1, '#2e3750');
    K.rect(g, x, gy - 8, w, 1, '#2a3248');
    for (let i = 0; i <= w; i += 8) K.rect(g, x + i, gy - 18, 1, 18, '#232c42');
    for (let i = 0; i <= w; i += 3) K.rect(g, x + i, gy - 15, 1, 7, '#1a2236');
    g.save();
    g.globalAlpha = 0.2;
    K.rect(g, x, gy, w, 1, '#5d6d92');
    g.restore();
  }

  function nearBooth(g, x, gy, sd) {
    K.rect(g, x, gy - 34, 18, 34, '#141b2e');
    K.rect(g, x + 2, gy - 31, 14, 20, '#26304a');
    g.save();
    g.globalAlpha = 0.5;
    K.rect(g, x + 3, gy - 30, 12, 18, LIT);
    g.restore();
    K.rect(g, x - 2, gy - 36, 22, 3, '#0b1120');
    K.rect(g, x + 6, gy - 11, 6, 9, '#1d2740');
    P.glow(g, x + 9, gy - 20, 24, LIT, 0.16);
  }

  function nearStall(g, x, gy, sd) {
    const w = 48 + Math.round(K.rnd(sd) * 26);
    K.rect(g, x, gy - 24, 3, 24, '#1a2236');
    K.rect(g, x + w - 3, gy - 24, 3, 24, '#1a2236');
    K.rect(g, x - 2, gy - 6, w + 4, 3, '#2a2030');
    for (let i = 0; i < Math.round(w / 8); i++) {
      K.rect(g, x + 2 + i * 8, gy - 30, 8, 6, i % 2 ? '#8a3a3a' : '#c8b48a');
    }
    K.rect(g, x - 2, gy - 32, w + 4, 2, '#1a2236');
    for (let i = 0; i < 5; i++) {
      g.save();
      g.globalAlpha = 0.5;
      K.rect(g, x + 5 + i * Math.round(w / 5), gy - 10, 3, 2, i % 2 ? LIT : '#a86a4a');
      g.restore();
    }
    P.glow(g, x + w / 2, gy - 22, 26, LIT, 0.12);
  }

  function nearStack(g, x, gy, sd) {
    for (let i = 0; i < 3; i++) {
      const bw = 12 + Math.round(K.rnd(sd + i * 3.1) * 8);
      const bh = 9 + Math.round(K.rnd(sd + i * 5.7) * 7);
      const bx = x + i * 13;
      K.rect(g, bx, gy - bh, bw, bh, i % 2 ? '#2a2234' : '#241e2e');
      K.rect(g, bx, gy - bh, bw, 1, '#3c3248');
      K.rect(g, bx + 1, gy - bh + 3, bw - 2, 1, '#1a1622');
    }
    K.rect(g, x - 2, gy, 42, 2, '#1a1622');
  }

  const NEAR = [nearFence, nearBooth, nearStall, nearStack];

  V.dress = function (g, v, o) {
    o = o || {};
    const w = o.w || 960;
    const hz = o.hz || 160;
    const gy = o.gy || 220;
    const sd = K.vi(v, 28, 0, 900);
    if (o.land !== false) {
      const li = K.vi(v, 22, 0, LAND.length - 1);
      const lx = 40 + K.vi(v, 23, 0, Math.max(20, w - 160));
      LAND[li](g, lx, hz, sd + li * 7);
    }
    if (o.near === false) return;
    const ni = K.vi(v, 24, 0, NEAR.length - 1);
    const nx = 30 + K.vi(v, 25, 0, Math.max(20, w - 110));
    NEAR[ni](g, nx, gy, sd + ni * 13);
  };

  /* 室内：墙上的一件东西（挂画、窗、钟、架子），位置与种类按镜头换 */
  V.indoor = function (g, v, o) {
    o = o || {};
    const w = o.w || 480;
    const h = o.h || 270;
    const sd = K.vi(v, 28, 0, 900);
    const kind = K.vi(v, 33, 0, 3);
    const x = 24 + K.vi(v, 34, 0, Math.max(20, w - 110));
    const y = 34 + K.vi(v, 35, 0, 60);
    if (kind === 0) {
      const fw = 26 + Math.round(K.rnd(sd) * 18);
      const fh = 18 + Math.round(K.rnd(sd + 1) * 12);
      K.rect(g, x, y, fw, fh, '#0a0f1c');
      K.rect(g, x + 2, y + 2, fw - 4, fh - 4, '#1c2438');
      g.save();
      g.globalAlpha = 0.35;
      K.rect(g, x + 4, y + 5, fw - 8, 2, '#8fa4cd');
      K.rect(g, x + 4, y + 10, Math.round((fw - 8) * 0.6), 1, '#8fa4cd');
      g.restore();
    } else if (kind === 1) {
      /* 挂钟 */
      K.disc(g, x + 10, y + 10, 8, '#0d1424');
      K.ring(g, x + 10, y + 10, 8, '#3a4560');
      K.rect(g, x + 10, y + 5, 1, 5, '#c8d4f0');
      K.rect(g, x + 10, y + 9, 4, 1, '#c8d4f0');
      g.save();
      g.globalAlpha = 0.18;
      K.rect(g, x + 1, y + 21, 19, 9, '#3a4560');
      g.restore();
    } else if (kind === 2) {
      /* 小书架 */
      K.rect(g, x, y, 34, 3, '#1a1420');
      for (let i = 0; i < 6; i++) {
        K.rect(g, x + 2 + i * 5, y - 8 - (i % 3) * 2, 4, 8 + (i % 3) * 2, i % 2 ? '#4a3a4a' : '#3a3048');
      }
      K.rect(g, x, y + 12, 34, 2, '#1a1420');
      K.rect(g, x + 4, y + 3, 8, 9, '#2a3448');
    } else {
      /* 一只吊灯 */
      K.rect(g, x + 12, 0, 1, y + 6, '#222a3e');
      K.rect(g, x + 6, y + 6, 13, 3, '#2a3450');
      K.rect(g, x + 8, y + 9, 9, 1, LIT);
      P.glow(g, x + 12, y + 12, 26, LIT, 0.16);
    }
  };

  /* ---------------- 天气（屏幕层） ---------------- */

  V.live = function (g, shot, local, cam) {
    if (!shot || shot.s === 'gen') return;
    const p = V.params(shot);
    const sd = p.seed;
    const t = local;
    if (p.indoor) {
      for (let i = 0; i < 8; i++) {
        const x = (K.rnd(sd + i * 3.1) * 480 + Math.sin(t * 0.4 + i) * 6 + 480) % 480;
        const y = (K.rnd(sd + i * 5.7) * 270 + t * (3 + i % 3)) % 270;
        g.save();
        g.globalAlpha = 0.06 + 0.05 * Math.sin(t * 0.9 + i * 1.7);
        K.rect(g, x, y, 1, 1, i % 3 ? '#cfe0ff' : LIT);
        g.restore();
      }
      return;
    }
    const wm = K.vi(p.v, 30, 0, 2);
    if (wm === 0) {
      g.save();
      for (let i = 0; i < 30; i++) {
        const sx = (K.rnd(sd + i * 2.9) * 520 + t * (40 + (i % 4) * 9)) % 520 - 20;
        const sy = (K.rnd(sd + i * 4.3) * 300 + t * (180 + (i % 5) * 24)) % 300 - 15;
        g.globalAlpha = 0.10 + 0.10 * K.rnd(sd + i * 6.1);
        K.rect(g, sx, sy, 1, 4 + (i % 3), '#9fb6d8');
        K.rect(g, sx + 1, sy + 3 + (i % 3), 1, 2, '#9fb6d8');
      }
      g.restore();
    } else if (wm === 1) {
      g.save();
      for (let i = 0; i < 3; i++) {
        const y = 168 + i * 30;
        const off = ((t * (9 + i * 4) + i * 120) % 560) - 60;
        g.globalAlpha = 0.05 + i * 0.012;
        for (let k = 0; k < 9; k++) {
          const x = off + k * 64;
          K.rect(g, x, y + Math.round(Math.sin(k * 1.3 + i) * 2), 44, 1, '#a8b8d8');
          K.rect(g, x + 10, y + 2 + Math.round(Math.sin(k * 1.3 + i) * 2), 26, 1, '#a8b8d8');
        }
      }
      g.restore();
    } else {
      g.save();
      for (let i = 0; i < 12; i++) {
        const x = (K.rnd(sd + i * 3.7) * 480 + Math.sin(t * 0.7 + i * 2.1) * 14 + 480) % 480;
        const y = 270 - ((K.rnd(sd + i * 5.9) * 300 + t * (10 + (i % 4) * 5)) % 300);
        g.globalAlpha = 0.14 + 0.12 * Math.sin(t * 1.7 + i);
        K.rect(g, x, y, 1, 1, i % 3 ? LIT : '#d8e4ff');
      }
      g.restore();
    }
    /* 高空一颗缓慢闪烁的航行灯 */
    const bx = 60 + K.vi(p.v, 36, 0, 360);
    const by = 14 + K.vi(p.v, 37, 0, 40);
    const blink = Math.sin(t * 2.4 + p.v) > 0.72 ? 1 : 0;
    if (blink) {
      g.save();
      g.globalAlpha = 0.7;
      K.rect(g, bx, by, 1, 1, RED);
      g.globalAlpha = 0.18;
      K.rect(g, bx - 2, by - 1, 5, 3, RED);
      g.restore();
    }
  };

  V.landmarks = LAND.length;
  V.nearProps = NEAR.length;
})(typeof window !== 'undefined' ? window : null);
