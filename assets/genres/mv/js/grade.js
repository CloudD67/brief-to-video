/* 每镜专属的调色与前景：同一场景库靠这两层得到完全不同的构图，
   保证一支片里没有两镜长得一样。全部只依赖 shot.v 与 local。 */
(function (root) {
  'use strict';
  const K = root.PIXEL_KIT;
  const G = root.PIXEL_GRADE = {};

  const TINT = {
    verse: ['#20304e', '#1a2c4c', '#243252', '#1e3048', '#1c2a4a'],
    chorus: ['#3a2434', '#2e2440', '#40261e', '#342038'],
    bridge: ['#16323a', '#123038', '#1a3230'],
    finale: ['#3a2418', '#422a1a', '#34261e']
  };

  G.tint = function (shot) {
    const arr = TINT[shot.mode] || TINT.verse;
    return arr[(shot.v * 3) % arr.length];
  };

  /* 手绘场景的底色是固定的：用乘色 + 极轻的提亮换掉每镜的色温 */
  const TEMP = ['#ffd8b4', '#bcd2ff', '#ffc8da', '#d6ffd8', '#ffe2a8', '#c4f0ff'];

  /* 全片统一留白 + 每镜不同的冷暖倾向与暗角强度 */
  G.apply = function (g, shot) {
    g.save();
    if (shot.s !== 'gen') {
      const tc = TEMP[(shot.v * 5) % TEMP.length];
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = 0.3;
      g.fillStyle = tc;
      g.fillRect(0, 0, 480, 270);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.035;
      g.fillRect(0, 0, 480, 270);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 0.12;
    g.fillStyle = G.tint(shot);
    g.fillRect(0, 0, 480, 270);
    g.restore();
    K.vignette(g, 0.55 + ((shot.v * 5) % 4) * 0.045);
  };

  /* ---------- 前景区 ---------- */
  const PROPS = ['rail', 'wires', 'branch', 'tank', 'awning', 'pipes', 'laundry',
    'frame', 'bollard', 'curtain', 'sign', 'umbrella', 'plant', 'bike', 'rope'];

  G.propFor = function (shot) {
    return PROPS[(shot.v * 7 + (shot.v % 3)) % PROPS.length];
  };

  function sway(t, s, a) { return Math.round(Math.sin(t * 0.9 + s) * a); }

  const DRAW = {
    rail(g, t, v, cam) {
      const y = 232;
      const off = Math.round((cam.x * 2.2) % 26);
      K.rect(g, 0, y, 480, 3, '#0c1120');
      K.rect(g, 0, y, 480, 1, '#2c3a5c');
      for (let x = -off; x < 500; x += 26) {
        K.rect(g, x, y + 3, 2, 34, '#0a0e1c');
        K.rect(g, x, y + 3, 1, 34, '#1a2338');
      }
      K.rect(g, 0, y + 33, 480, 3, '#070a14');
    },
    wires(g, t, v) {
      for (let i = 0; i < 3; i++) {
        const y0 = 14 + i * 9;
        for (let x = 0; x < 480; x += 2) {
          const sag = Math.round(Math.sin((x / 480) * Math.PI) * (10 - i * 2));
          K.rect(g, x, y0 + sag, 2, 1, '#080b16');
        }
      }
      const bx = 120 + (v % 5) * 60;
      const sw = sway(t, v, 2);
      K.rect(g, bx + sw, 30, 1, 10, '#0a0e1a');
      K.rect(g, bx + sw - 3, 40, 7, 3, '#e8d8a8');
    },
    branch(g, t, v) {
      const sw = sway(t, v, 3);
      K.line(g, -6, 8, 70 + sw, 26, '#080c16', 3);
      K.line(g, 70 + sw, 26, 116 + sw * 2, 20, '#080c16', 2);
      K.line(g, 40, 18, 52 + sw, 52, '#080c16', 2);
      for (let i = 0; i < 9; i++) {
        const lx = 24 + i * 11 + sw * (i % 3);
        const ly = 22 + (i % 4) * 9 - (i % 2) * 6;
        K.rect(g, lx, ly, 9 - (i % 3), 3, i % 2 ? '#0d1a24' : '#0a1620');
      }
    },
    tank(g, t, v) {
      const x = 300 + (v % 4) * 30;
      const y = 116;
      K.rect(g, x, y, 86, 10, '#0b0f1a');
      K.rect(g, x + 4, y - 52, 78, 52, '#080c16');
      K.rect(g, x + 4, y - 52, 78, 2, '#1a2338');
      for (let i = 0; i < 6; i++) K.rect(g, x + 8 + i * 12, y - 46, 2, 40, '#101828');
      K.rect(g, x + 8, y + 10, 4, 32, '#080c16');
      K.rect(g, x + 70, y + 10, 4, 32, '#080c16');
      K.line(g, x + 10, y + 42, x + 78, y + 10, '#0a0e18', 1);
    },
    awning(g, t, v) {
      const c1 = ['#5a2430', '#24405a', '#4a3a1a', '#2a3a2a'][v % 4];
      for (let i = 0; i < 14; i++) {
        const x = -20 + i * 20;
        K.rect(g, x, -6, 20, 34 + sway(t, v + i, 1), i % 2 ? c1 : '#10141f');
      }
      K.rect(g, 0, 26, 260, 3, '#0a0d16');
      for (let i = 0; i < 13; i++) K.rect(g, i * 20, 29, 10, 4, i % 2 ? c1 : '#10141f');
    },
    pipes(g, t, v) {
      for (let i = 0; i < 3; i++) {
        const x = 8 + i * 9;
        K.rect(g, x, 0, 4, 270, '#0a0e18');
        K.rect(g, x, 0, 1, 270, '#1c2840');
        for (let y = 30 + i * 20; y < 270; y += 74) K.rect(g, x - 1, y, 6, 4, '#141c2e');
      }
      K.rect(g, 4, 128, 26, 4, '#0a0e18');
    },
    laundry(g, t, v) {
      for (let x = 0; x < 480; x += 2) {
        const sag = Math.round(Math.sin((x / 480) * Math.PI) * 8);
        K.rect(g, x, 10 + sag, 2, 1, '#0a0e1a');
      }
      const cols = ['#3a4a6a', '#4a3a52', '#3a4a4a', '#5a4a3a'];
      for (let i = 0; i < 4; i++) {
        const bx = 76 + i * 84;
        const by = 18 + Math.round(Math.sin((bx / 480) * Math.PI) * 8) + sway(t, i, 1);
        K.rect(g, bx, by, 26, 4, cols[i]);
        K.rect(g, bx + 2, by + 4, 22, 18 - (i % 2) * 6, cols[i]);
        K.rect(g, bx + 2, by + 20 - (i % 2) * 6, 22, 1, K.shade(cols[i], -34));
      }
    },
    frame(g, t, v) {
      K.rect(g, 0, 0, 22, 270, '#060a12');
      K.rect(g, 458, 0, 22, 270, '#060a12');
      K.rect(g, 22, 0, 2, 270, '#182238');
      K.rect(g, 456, 0, 2, 270, '#182238');
      K.rect(g, 0, 236, 480, 34, '#070b14');
      K.rect(g, 0, 236, 480, 2, '#1a2438');
    },
    bollard(g, t, v) {
      for (let i = 0; i < 3; i++) {
        const x = 40 + i * 190;
        K.rect(g, x, 206, 9, 64, '#080c16');
        K.rect(g, x, 206, 9, 3, '#1c263c');
        K.rect(g, x + 2, 200, 5, 6, '#0e1424');
      }
      K.rect(g, 0, 262, 480, 8, '#060a12');
    },
    rope(g, t, v) {
      for (let x = 0; x < 480; x += 2) {
        const sag = Math.round(Math.sin((x / 480) * Math.PI) * 26);
        K.rect(g, x, 6 + sag, 2, 1, '#0a0f1c');
      }
      for (let i = 0; i < 5; i++) {
        const bx = 60 + i * 92;
        const by = 26 + Math.round(Math.sin((bx / 480) * Math.PI) * 26) + sway(t, i, 2);
        K.rect(g, bx, by, 2, 8, '#0a0f1c');
        K.rect(g, bx - 5, by + 8, 12, 3, '#0a0f1c');
      }
    },
    chain(g, t, v) {
      K.rect(g, 0, 214, 480, 56, '#070b14');
      for (let y = 214; y < 270; y += 4) K.rect(g, 0, y, 480, 1, '#101828');
      for (let x = 0; x < 480; x += 6) K.rect(g, x, 214, 1, 56, '#0d1424');
    },
    bollard2(g, t, v) {
      for (let i = 0; i < 3; i++) K.rect(g, 30 + i * 180, 214, 8, 56, '#080c18');
      K.rect(g, 0, 262, 480, 8, '#060a12');
    },
    curtain(g, t, v) {
      const c = ['#2a2036', '#1e2a38', '#34242a'][v % 3];
      for (let i = 0; i < 7; i++) {
        const x = -6 + i * 9 + Math.round(Math.sin(t * 0.7 + i) * 1.5);
        K.rect(g, x, 0, 10, 270, c);
        K.rect(g, x, 0, 2, 270, K.shade(c, 12));
      }
      K.rect(g, 0, 0, 240, 6, '#0a0d16');
    },
    sign(g, t, v) {
      const sw = sway(t, v, 3);
      K.rect(g, 380, 0, 2, 26, '#0a0e18');
      K.rect(g, 336 + sw, 26, 90, 34, '#0a0e18');
      K.rect(g, 338 + sw, 28, 86, 30, ['#5a2a24', '#24405a', '#3a3a1e'][v % 3]);
      for (let i = 0; i < 3; i++) K.rect(g, 348 + i * 26 + sw, 36, 16, 3, '#f2d492');
      for (let i = 0; i < 3; i++) K.rect(g, 348 + i * 26 + sw, 44, 16, 2, '#e8c07a');
    },
    umbrella(g, t, v) {
      K.rect(g, 200, 0, 3, 90, '#080c16');
      for (let i = 0; i < 7; i++) {
        const x = 120 + i * 34;
        const y = 84 - Math.abs(3 - i) * 8;
        K.rect(g, x, y, 34, 8, i % 2 ? '#1a2436' : '#0e1422');
      }
      K.rect(g, 118, 90, 240, 3, '#0a0e18');
    },
    plant(g, t, v) {
      K.rect(g, 396, 214, 30, 40, '#2a1c1e');
      K.rect(g, 396, 214, 30, 3, '#3e2a2c');
      for (let i = 0; i < 8; i++) {
        const a = i * 0.8 + sway(t, v + i, 0.06);
        const lx = 411 + Math.cos(a) * (10 + i);
        const ly = 210 - Math.abs(Math.sin(a)) * (16 + i);
        K.rect(g, lx, ly, 5, 3, i % 2 ? '#173a2a' : '#0f2e22');
      }
    },
    bike(g, t, v) {
      K.ring(g, 60, 244, 12, '#0a0e18');
      K.ring(g, 96, 244, 12, '#0a0e18');
      K.line(g, 60, 244, 80, 222, '#0a0e18', 2);
      K.line(g, 96, 244, 80, 222, '#0a0e18', 2);
      K.line(g, 80, 222, 96, 244, '#0a0e18', 2);
      K.rect(g, 74, 216, 14, 2, '#0a0e18');
      K.rect(g, 54, 236, 12, 2, '#0a0e18');
    }
  };

  G.fg = function (g, shot, local, cam) {
    const key = G.propFor(shot);
    const fn = DRAW[key === 'curtain' ? 'curtain' : key];
    if (!fn) return;
    g.save();
    fn(g, local, shot.v || 1, cam);
    g.restore();
  };

  G.propName = G.propFor;
})(typeof window !== 'undefined' ? window : null);
