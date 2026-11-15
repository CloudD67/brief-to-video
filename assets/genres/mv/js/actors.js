/* 角色与随身道具：女孩 / 男孩 / 碎片 / 掌心里的城 / 伞 / 手机。
   全部按 1px 网格手绘，绘制时只依赖时间与种子。 */
(function (root) {
  'use strict';
  const K = root.PIXEL_KIT;
  const A = {};

  const BOY_PAL = {
    o: '#080b16', h: '#121a2e', H: '#26314f', s: '#e6b48c',
    c: '#141b31', C: '#232e4e', d: '#0c1122', b: '#070a14', r: '#c9503c'
  };

  const BOY_BACK = [
    '.....oooooo.........',
    '...oohhhhhhoo.......',
    '..ohhhhhhhhhho......',
    '..ohhhHHHHHhho......',
    '..ohhHHHHHHhho......',
    '..ohhhhhhhhhho......',
    '..ohhhhhhhhhho......',
    '...ohhhhhhhho.......',
    '....osssssso........',
    '...orrrrrrrro.......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..ocCCCCCCCCco......',
    '..occcccccccco......',
    '...occcccccco.......',
    '....dddddddd........',
    '....dddddddd........',
    '....ddd..ddd........',
    '....ddd..ddd........',
    '....bbb..bbb........',
    '....bbb..bbb........'
  ];

  const BOY_STAND = [
    '.....oooooo.........',
    '...oohhhhhhoo.......',
    '..ohhhhhhhhhho......',
    '..ohhhssssshho......',
    '..ohhsssssssho......',
    '..ohhsssosssho......',
    '..ohhssssssso.......',
    '...ohhssssso........',
    '....osssssso........',
    '...orrrrrrrro.......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '.occcccccccccco.....',
    '.occcccccccccco.....',
    '.occcccccccccco.....',
    '.occcccccccccco.....',
    '.occcccccccccco.....',
    '..occcccccccco......',
    '..occcccccccco......',
    '..ocCCCCCCCCco......',
    '..occcccccccco......',
    '...occcccccco.......',
    '....dddddddd........',
    '....dddddddd........',
    '....ddd..ddd........',
    '....ddd..ddd........',
    '....bbb..bbb........',
    '....bbb..bbb........'
  ];

  const BOY_WALK_BASE = [
    '.....oooooo.........',
    '...oohhhhhhoo.......',
    '..ohhhhhhhhhho......',
    '..ohhHHHHHHhho......',
    '..ohhhhhhhhhho......',
    '..ohhhhhhhhhho......',
    '..ohhhhhsssshho.....',
    '...ohhhssssso.......',
    '....osssssso........',
    '...orrrrrrrro.......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '..occcccccccco......',
    '...occcccccco.......',
    '....dddddddd........',
    '....ddd..ddd........',
    '....ddd..ddd........',
    '...ddd....ddd.......',
    '...ddd....ddd.......',
    '..bbb......bbb......',
    '..bbb......bbb......'
  ];

  function boyWalk(mode) {
    const m = BOY_WALK_BASE.slice();
    if (mode === 0) {
      m[23] = '....ddd.ddd........';
      m[24] = '...ddd...ddd.......';
      m[25] = '..ddd.....ddd......';
      m[26] = '..ddd.....ddd......';
      m[27] = '.bbb.......bbb.....';
      m[28] = '.bbb.......bbb.....';
    } else if (mode === 1) {
      m[23] = '.....dddddd........';
      m[24] = '.....dd.ddd........';
      m[25] = '....dd...ddd.......';
      m[26] = '....dd...ddd.......';
      m[27] = '...bbb....bbb......';
      m[28] = '...bbb....bbb......';
    } else if (mode === 2) {
      m[23] = '.....ddd.ddd.......';
      m[24] = '....ddd...ddd......';
      m[25] = '...ddd.....ddd.....';
      m[26] = '...ddd.....ddd.....';
      m[27] = '..bbb.......bbb....';
      m[28] = '..bbb.......bbb....';
    } else {
      m[23] = '.....dddddd........';
      m[24] = '......ddddd........';
      m[25] = '......dd.dd........';
      m[26] = '.....dd...dd.......';
      m[27] = '....bbb...bbb......';
      m[28] = '....bbb...bbb......';
    }
    return m;
  }

  const cache = {};
  function spr(map, pal, key) {
    if (!cache[key]) cache[key] = K.spriteCanvas(map, pal, false);
    return cache[key];
  }

  A.GIRL_H = 32;
  A.BOY_H = 31;

  /* 女孩：back / stand / walk / run（walk 加速即 run） */
  A.girl = function (g, x, y, t, o) {
    o = o || {};
    const sc = o.scale || 1;
    const walk = o.pose === 'walk' || o.pose === 'run';
    const speed = o.pose === 'run' ? 8.5 : 5.2;
    const f = walk ? Math.floor(t * speed) % 4 : 0;
    let map, pal = K.PAL.girl;
    if (o.pose === 'back') map = K.art.girlBack;
    else if (o.pose === 'walk' || o.pose === 'run') map = K.art.walk[f];
    else map = K.art.girlStand;
    if (o.silhouette) pal = K.PAL.silhouette;
    const img = spr(map, pal, 'g' + (o.silhouette ? 's' : '') + (walk ? f : (o.pose || 'stand')));
    const bob = walk ? 0 : (Math.sin(t * 1.6 + (o.ph || 0)) > 0.55 ? 1 : 0);
    const dx = Math.round(x - (img.width * sc) / 2);
    const dy = Math.round(y - img.height * sc) + bob * sc;
    g.drawImage(img, dx, dy, img.width * sc, img.height * sc);
    return { x: dx, y: dy, w: img.width * sc, h: img.height * sc };
  };

  A.boy = function (g, x, y, t, o) {
    o = o || {};
    const sc = o.scale || 1;
    const walk = o.pose === 'walk' || o.pose === 'run';
    const speed = o.pose === 'run' ? 8.5 : 5.2;
    const f = walk ? Math.floor(t * speed) % 4 : 0;
    let map;
    let pal = BOY_PAL;
    if (o.pose === 'back') map = BOY_BACK;
    else if (walk) map = boyWalk(f);
    else map = BOY_STAND;
    if (o.silhouette) pal = K.PAL.silhouette;
    const img = spr(map, pal, 'b' + (o.silhouette ? 's' : '') + (walk ? f : (o.pose || 'stand')));
    const bob = walk ? 0 : (Math.sin(t * 1.4 + (o.ph || 1.3)) > 0.55 ? 1 : 0);
    const dx = Math.round(x - (img.width * sc) / 2);
    const dy = Math.round(y - img.height * sc) + bob * sc;
    g.save();
    if (o.flip) {
      g.translate(dx + img.width * sc, 0);
      g.scale(-1, 1);
      g.drawImage(img, 0, dy, img.width * sc, img.height * sc);
    } else {
      g.drawImage(img, dx, dy, img.width * sc, img.height * sc);
    }
    g.restore();
    return { x: dx, y: dy, w: img.width * sc, h: img.height * sc };
  };

  /* 坐姿：面朝吧台/桌面，只画背影与手 */
  A.sit = function (g, x, y, t, o) {
    o = o || {};
    const coat = o.coat || '#3c405e';
    const hair = o.hair || '#3a2740';
    const bob = Math.sin(t * 1.1 + (o.ph || 0)) > 0.6 ? 1 : 0;
    const bx = Math.round(x);
    const by = Math.round(y) + bob;
    K.rect(g, bx - 9, by, 18, 2, hair);
    K.rect(g, bx - 8, by + 2, 16, 4, hair);
    K.rect(g, bx - 7, by + 6, 14, 3, '#e9d9b8');
    K.rect(g, bx - 8, by + 9, 16, 12, coat);
    K.rect(g, bx - 7, by + 10, 14, 3, K.shade(coat, 14));
    K.rect(g, bx - 10, by + 19, 20, 3, K.shade(coat, -10));
    if (o.apron) {
      K.rect(g, bx - 6, by + 10, 12, 12, o.apron);
      K.rect(g, bx - 6, by + 10, 12, 1, K.shade(o.apron, 18));
      K.rect(g, bx - 4, by + 14, 8, 1, K.shade(o.apron, -12));
      K.rect(g, bx - 6, by + 22, 12, 1, K.shade(o.apron, -20));
    }
    if (o.hands) {
      K.rect(g, bx - 7, by + 14, 3, 3, '#e9d9b8');
      K.rect(g, bx + 4, by + 14, 3, 3, '#e9d9b8');
    }
  };

  /* 靠窗坐着的人（背面）：y 为臀部接触点 */
  A.seated = function (g, x, y, t, o) {
    o = o || {};
    const coat = o.coat || '#3c405e';
    const hair = o.hair || '#3a2740';
    const cx = Math.round(x);
    const hy = Math.round(y) - 34 + (Math.sin(t * 0.9 + (o.ph || 0)) > 0.7 ? 1 : 0);
    const long = o.k === 'girl';
    /* 后脑与头发 */
    K.rect(g, cx - 9, hy, 18, 9, hair);
    K.rect(g, cx - 8, hy - 3, 16, 3, hair);
    K.rect(g, cx - 8, hy, 6, 1, K.shade(hair, 22));
    if (long) {
      K.rect(g, cx - 10, hy + 7, 20, 14, hair);
      K.rect(g, cx - 10, hy + 7, 3, 12, K.shade(hair, -12));
      K.rect(g, cx + 7, hy + 7, 3, 12, K.shade(hair, -12));
    } else {
      K.rect(g, cx - 7, hy + 8, 14, 4, hair);
    }
    /* 耳朵与脖颈 */
    K.rect(g, cx - 10, hy + 4, 2, 4, o.skin || '#c99a76');
    K.rect(g, cx + 8, hy + 4, 2, 4, o.skin || '#c99a76');
    K.rect(g, cx - 3, hy + (long ? 19 : 12), 6, 3, o.skin || '#c99a76');
    /* 肩背与外套 */
    K.rect(g, cx - 14, hy + (long ? 22 : 15), 28, 14, coat);
    K.rect(g, cx - 13, hy + (long ? 23 : 16), 26, 2, K.shade(coat, 16));
    K.rect(g, cx - 14, hy + (long ? 35 : 28), 28, 3, K.shade(coat, -14));
    /* 手臂：一只搭在窗台上 */
    K.rect(g, cx - 17, hy + (long ? 25 : 18), 4, 11, K.shade(coat, -8));
    K.rect(g, cx + 13, hy + (long ? 25 : 18), 4, 11, K.shade(coat, -8));
    K.rect(g, cx + 12, hy + (long ? 35 : 28), 6, 3, o.skin || '#c99a76');
    /* 贴在玻璃上的淡淡倒影 */
    g.save();
    g.globalAlpha = 0.16;
    K.rect(g, cx - 12, hy - 2, 24, 30, '#a8bade');
    g.restore();
  };

  /* 发光碎片 */
  A.shard = function (g, x, y, t, s) {
    s = s || 1;
    const pts = [[0, -4], [2, -2], [3, 1], [1, 3], [-2, 2], [-3, -1]];
    const pulse = 0.75 + 0.25 * Math.sin(t * 4.1);
    const PG = root.PIXEL_PAINT;
    PG.glow(g, x, y, 12 * s, '#8fd8d2', 0.34 * pulse);
    PG.glow(g, x, y, 22 * s, '#8fd8d2', 0.14 * pulse);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      K.line(g, x + p[0] * s, y + p[1] * s, x + q[0] * s, y + q[1] * s, '#bff2ea', 1);
    }
    g.save();
    g.globalAlpha = 0.9;
    K.rect(g, x - 1, y - 2, 2, 3, '#eafffb');
    g.restore();
  };

  /* 掌心里的城：一层层小方块楼 + 亮点 */
  A.miniCity = function (g, x, y, t, s, seed) {
    s = s || 1;
    seed = seed || 3;
    const cols = 9;
    for (let i = 0; i < cols; i++) {
      const h = (3 + Math.floor(K.rnd(seed + i * 2.7) * 7)) * s;
      const w = (2 + (i % 2)) * s;
      const bx = x + (i - cols / 2) * 3 * s;
      const rise = Math.sin(t * 1.4 + i * 0.7) * 0.6;
      K.rect(g, bx, y - h + rise, w, h, '#141b33');
      K.rect(g, bx, y - h + rise, w, 1, '#2a3454');
      const lit = Math.sin(t * 3.4 + i * 1.9) > -0.2;
      if (lit) K.rect(g, bx, y - h + 2 + rise, 1, 1, i % 3 ? '#f2c05e' : '#8fd8d2');
    }
    root.PIXEL_PAINT.glow(g, x, y - 4 * s, 18 * s, '#8fd8d2', 0.22 + 0.06 * Math.sin(t * 2.6));
  };

  /* 街猫：蜷坐，尾巴摆动、耳朵抖动，x/y 是落脚点 */
  A.cat = function (g, x, y, t, seed) {
    seed = seed || 1;
    const bx = Math.round(x);
    const by = Math.round(y);
    const fur = '#20223a';
    const dark = '#14162a';
    const tail = Math.round(Math.sin(t * 2.1 + seed) * 2);
    const ear = Math.sin(t * 5.3 + seed * 2) > 0.85 ? 1 : 0;
    K.rect(g, bx - 4, by - 3, 8, 3, fur);
    K.rect(g, bx - 3, by - 5, 6, 2, fur);
    K.rect(g, bx - 4, by - 4, 8, 1, dark);
    K.rect(g, bx - 3, by - 7, 2, 2, fur);
    K.rect(g, bx + 2, by - 7 + ear, 2, 2 - ear, fur);
    K.rect(g, bx - 2, by - 4, 1, 1, '#8fd8d2');
    K.rect(g, bx + 2, by - 4, 1, 1, '#8fd8d2');
    K.rect(g, bx - 5, by - 1, 2, 1, dark);
    K.rect(g, bx + 3, by - 1, 2, 1, dark);
    K.rect(g, bx + 5, by - 2 + tail, 1, 2, fur);
    K.rect(g, bx + 6, by - 3 + tail, 2, 1, fur);
  };

  A.umbrella = function (g, x, y, t, col) {
    col = col || '#3a4a6a';
    const sway = Math.sin(t * 1.1) * 1;
    K.rect(g, x + sway, y, 1, 18, '#2a3352');
    for (let i = 0; i < 7; i++) {
      const w = 16 - Math.abs(i - 3) * 4;
      K.rect(g, x + sway - w / 2, y - 8 + i, w, 1, i < 2 ? K.shade(col, 18) : col);
    }
    K.rect(g, x + sway - 8, y - 1, 16, 1, K.shade(col, -12));
  };

  A.phone = function (g, x, y, t) {
    K.rect(g, x, y, 7, 12, '#0b0f1c');
    K.rect(g, x + 1, y + 1, 5, 9, '#1a2544');
    const on = Math.sin(t * 1.8) > -0.3;
    g.save();
    g.globalAlpha = on ? 0.9 : 0.5;
    K.rect(g, x + 1, y + 2, 5, 7, '#8fd8d2');
    g.restore();
    g.save();
    g.globalAlpha = 0.22;
    K.disc(g, x + 3, y + 5, 10, '#8fd8d2');
    g.restore();
  };

  A.cup = function (g, x, y, t, o) {
    o = o || {};
    K.rect(g, x, y, 10, 9, '#241a26');
    K.rect(g, x, y, 10, 1, '#4a3348');
    K.rect(g, x + 1, y + 1, 8, 1, '#5a3f52');
    K.rect(g, x + 10, y + 3, 3, 4, '#241a26');
    K.rect(g, x - 1, y + 9, 12, 1, '#120c18');
    if (o.steam !== false) root.PIXEL_PAINT.steam(g, x + 5, y - 1, t, o.seed || 3, 6, '#c9b592', 22);
  };

  /* 行李箱：y 是落地点（轮子着地）。roll=拉杆拖行，t 驱动轮子与吊牌摆动 */
  A.suitcase = function (g, x, y, t, o) {
    o = o || {};
    const sc = o.scale || 1;
    const col = o.col || '#8a3a3a';
    const bx = Math.round(x - 6 * sc);
    const bob = o.roll ? (Math.sin(t * 8.6) > 0.15 ? 1 : 0) : 0;
    const by = Math.round(y) - 2 * sc + bob;
    const top = by - 13 * sc;
    /* 拉杆 / 提手 */
    if (o.roll) {
      K.rect(g, bx + 2 * sc, top - 6 * sc, 1, 6 * sc, '#2a2228');
      K.rect(g, bx + 10 * sc, top - 6 * sc, 1, 6 * sc, '#2a2228');
      K.rect(g, bx + 1 * sc, top - 7 * sc, 11 * sc, 1, '#3a3038');
    } else {
      K.rect(g, bx + 4 * sc, top - 4 * sc, 6 * sc, 2, '#2a2228');
      K.rect(g, bx + 4 * sc, top - 2 * sc, 1, 2, '#2a2228');
      K.rect(g, bx + 9 * sc, top - 2 * sc, 1, 2, '#2a2228');
    }
    /* 箱体 */
    K.rect(g, bx, top, 13 * sc, 13 * sc, col);
    K.rect(g, bx, top, 13 * sc, 2, K.shade(col, 24));
    K.rect(g, bx, top + 11 * sc, 13 * sc, 2, K.shade(col, -28));
    K.rect(g, bx + 2 * sc, top + 3 * sc, 9 * sc, 1, K.shade(col, -18));
    K.rect(g, bx + 6 * sc, top + 3 * sc, 2, 2, '#c9b56a');
    /* 吊牌：一直轻轻摆 */
    const sw = Math.round(Math.sin(t * 2.4 + (o.ph || 0)) * 1.5);
    K.rect(g, bx + 12 * sc, top, 1, 3 * sc, '#c9b592');
    K.rect(g, bx + 12 * sc + sw, top + 3 * sc, 3, 2, '#e8dcc0');
    /* 轮子 */
    K.rect(g, bx + 1 * sc, by, 2 * sc, 2 * sc, '#141018');
    K.rect(g, bx + 10 * sc, by, 2 * sc, 2 * sc, '#141018');
    g.save();
    g.globalAlpha = 0.18;
    K.rect(g, bx, by + 2 * sc, 13 * sc, 1, '#8a96bc');
    g.restore();
  };

  root.PIXEL_ACTORS = A;
})(typeof window !== 'undefined' ? window : null);
