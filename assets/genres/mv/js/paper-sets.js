/* 九个剪纸场景：港口、码头、特写、灯塔、灯室、火苗、海面、窗内、片尾。
   同一场景靠 mood / 道具 / 人物参数复用，不靠缩放或移动镜头换画面。
   每一帧至少有一层在动：浪、雨、火、发丝、呼吸、光束或船。 */
(function (root) {
  'use strict';
  const K = root.PAPER_KIT;
  const F = root.PAPER_FIG;
  const W = K.W;
  const H = K.H;
  const S = {};

  function moodOf(shot) { return shot.mood || 'night'; }
  function tOf(local) { return Math.max(0, local); }

  function bird(g, x, y, s, t, ph) {
    const flap = Math.sin(t * 5.2 + ph) * 0.7;
    g.save();
    g.strokeStyle = 'rgba(12,20,32,0.75)';
    g.lineWidth = Math.max(2, 3 * s);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - 18 * s, y);
    g.quadraticCurveTo(x - 8 * s, y - 10 * s - flap * 7 * s, x, y);
    g.quadraticCurveTo(x + 8 * s, y - 10 * s - flap * 7 * s, x + 18 * s, y);
    g.stroke();
    g.restore();
  }

  function gulls(g, t, seed, n, y0) {
    for (let i = 0; i < n; i++) {
      const speed = 46 + K.rnd(seed + i * 3.3) * 40;
      const x = ((K.rnd(seed + i * 7.1) * (W + 300) + t * speed) % (W + 300)) - 150;
      const y = (y0 || 220) + K.rnd(seed + i * 2.7) * 190 + Math.sin(t * 1.1 + i) * 14;
      bird(g, x, y, 0.8 + K.rnd(seed + i * 5.9) * 0.7, t, i * 1.7);
    }
  }

  function lightning(g, t, seed, strength) {
    let flash = 0;
    const times = [0.75, 1.85];
    for (let i = 0; i < times.length; i++) {
      const p = (t - times[i]) / 0.22;
      if (p > 0 && p < 1) flash = Math.max(flash, Math.sin(p * Math.PI));
    }
    if (flash <= 0.01) return;
    g.save();
    g.globalAlpha = 0.30 * flash * (strength == null ? 1 : strength);
    g.fillStyle = '#dfeaff';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.55 * flash;
    g.strokeStyle = '#eef4ff';
    g.lineWidth = 5;
    g.beginPath();
    const bx = 380 + K.rnd(seed) * 900;
    g.moveTo(bx, 60);
    g.lineTo(bx - 40, 220);
    g.lineTo(bx + 10, 250);
    g.lineTo(bx - 60, 430);
    g.lineTo(bx - 10, 460);
    g.lineTo(bx - 90, 640);
    g.stroke();
    g.restore();
  }

  function lightMotes(g, x, y, r, t, n, seed) {
    g.save();
    for (let i = 0; i < n; i++) {
      const a = K.rnd(seed + i * 2.3) * Math.PI * 2;
      const rr = r * (0.15 + K.rnd(seed + i * 5.1) * 0.85);
      const mx = x + Math.cos(a) * rr + Math.sin(t * 0.5 + i) * 12;
      const my = y + Math.sin(a) * rr - ((t * (9 + i * 2)) % (r * 1.2));
      g.globalAlpha = 0.18 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.1 + i));
      g.fillStyle = '#ffd9a0';
      g.beginPath();
      g.arc(mx, my, 1.5 + K.rnd(seed + i * 7.7) * 2.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function foam(g, t, hz) {
    g.save();
    g.fillStyle = '#efe6cf';
    for (let i = 0; i < 46; i++) {
      const x = K.rnd(211 + i * 3.7) * W;
      const row = i % 4;
      const y = hz + 54 + row * 128 + Math.sin(t * 1.15 + i * 1.3) * 16;
      g.globalAlpha = 0.14 + K.rnd(211 + i * 5.1) * 0.22;
      g.beginPath();
      g.ellipse(x, y, 8 + K.rnd(211 + i * 2.3) * 26, 3 + K.rnd(211 + i) * 4, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  /* ── 港口：片头全景 ───────────────────────────────────── */

  S.harbor = function (g, shot, local) {
    const t = tOf(local);
    const mood = moodOf(shot);
    K.sky(g, mood, t, {
      horizon: 640,
      moon: { x: 1460, y: 238, r: 104 },
      sun: mood === 'dawn' ? { x: 1500, y: 596, r: 64 } : null,
      stars: 0.42,
      seed: 17
    });
    K.ocean(g, mood, t, {
      horizon: 640,
      amp: 10,
      surge: 0,
      shimmer: { x: 1460, alpha: 0.22 }
    });
    K.town(g, -60, 720, 900, { mood: mood, h: 168, n: 13, lit: 0.4, t: t, seed: 23 });
    K.lighthouse(g, 1600, 700, 430, t, { mood: mood, lampOn: 0, beam: false });

    K.pier(g, t, { mood: mood, y: 906, from: -20, to: 1220, lanterns: [260, 760], railH: 92 });

    if (shot.who) {
      const walk = K.smooth(K.clamp(t / 2.3, 0, 1));
      const fig = Object.assign({}, shot.who, { x: K.lerp(430, 700, walk) });
      F.fig(g, fig, t, { rim: 0.24 });
    }
    gulls(g, t, 31, 3, 250);
    K.rain(g, t, { n: 80, alpha: 0.16, speed: 900, seed: 41 });
  };

  /* ── 码头：她靠着栏杆看海 ─────────────────────────────── */

  S.pier = function (g, shot, local, slot) {
    const t = tOf(local);
    const mood = moodOf(shot);
    const horizon = 560;
    K.sky(g, mood, t, {
      horizon: horizon,
      sun: mood === 'dawn' ? { x: 1450, y: 520, r: 72 } : null,
      moon: mood === 'dusk' ? { x: 1380, y: 220, r: 96 } : null,
      stars: 0.34,
      seed: 29
    });
    K.ocean(g, mood, t, { horizon: horizon, amp: 11, shimmer: { x: 1380, alpha: 0.18 } });
    K.town(g, -80, 600, 620, { mood: mood, h: 120, n: 9, lit: 0.3, t: t, seed: 33, tail: 26 });
    K.lighthouse(g, 1700, 620, 300, t, { mood: mood, lampOn: mood === 'dawn' ? 1 : 0, beam: false });

    const b = shot.boat;
    if (b) K.boat(g, b.x, b.y, b.s || 0.7, t, { mood: mood, ph: 1.2 });

    K.pier(g, t, { mood: mood, y: 930, from: -40, to: W + 40, rail: false, lanterns: [180, 1560] });

    if (shot.who) F.fig(g, shot.who, t, { rim: 0.3 });
    if (shot.who) {
      /* 栏杆压在她身前：读作“靠着栏杆”，而不是站在栏杆后面 */
      g.save();
      g.strokeStyle = '#e4cfae';
      g.lineWidth = 10;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-40, 852);
      g.lineTo(W + 40, 852);
      g.stroke();
      g.lineWidth = 7;
      for (let x = 30; x < W; x += 220) {
        g.beginPath();
        g.moveTo(x, 852);
        g.lineTo(x, 934);
        g.stroke();
      }
      g.restore();
    }

    if (shot.runWho) {
      const rw = Object.assign({}, shot.runWho);
      if (shot.runWho.move) {
        const p = K.smooth(K.clamp((t - 0.3) / 1.7, 0, 1));
        rw.x = K.lerp(shot.runWho.move[0], shot.runWho.move[1], p);
      }
      F.fig(g, rw, t, { rim: 0.3 });
    }
    gulls(g, t, 47, 2, 300);
  };

  /* ── 特写：表情镜头 ───────────────────────────────────── */

  S.portrait = function (g, shot, local) {
    const t = tOf(local);
    const mood = moodOf(shot);
    const P = K.pal(mood);
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, P.sky[0]);
    grd.addColorStop(0.58, P.sky[Math.min(P.sky.length - 1, 1)]);
    grd.addColorStop(1, P.ink);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    K.bokeh(g, t, 71, { mood: mood, n: 17 });
    if (mood === 'storm') {
      K.rain(g, t, { n: 120, alpha: 0.16, speed: 1200, seed: 57, w: 3 });
      lightning(g, t, 61, 1);
    }
    if (mood === 'dawn') {
      K.glow(g, 1500, 620, 520, P.warm, 0.20);
    }
    /* 焦外：只留一片暖雾，避免横带把半身像切成浮头 */
    K.glow(g, 960, 700, 720, P.cream, mood === 'dawn' ? 0.10 : 0.07);
    lightMotes(g, 980, 560, 620, t, 14, 91);

    if (shot.who) {
      F.bust(g, Object.assign({}, shot.who, { seed: 3 + (shot.v || 1) * 0.37 }), t, {
        rim: mood === 'storm' ? 0.22 : 0.32
      });
    }
  };

  /* ── 灯塔外景：从塔下到塔顶 ───────────────────────────── */

  S.tower = function (g, shot, local) {
    const t = tOf(local);
    const mood = moodOf(shot);
    const horizon = 760;
    K.sky(g, mood, t, {
      horizon: horizon,
      sun: mood === 'dawn' ? { x: 520, y: 720, r: 76 } : null,
      moon: mood === 'night' ? { x: 440, y: 220, r: 120 } : null,
      stars: mood === 'night' ? 0.9 : 0.2,
      seed: 43
    });
    K.ocean(g, mood, t, { horizon: horizon, amp: 14, rise: mood === 'storm' ? 0.5 : 0, shimmer: { x: 440, alpha: 0.16 } });
    K.town(g, -60, 774, 560, { mood: mood, h: 100, n: 8, lit: mood === 'storm' ? 0.18 : 0.3, t: t, seed: 51, tail: 22 });
    K.lighthouse(g, 1430, 830, 540, t, {
      mood: mood,
      lampOn: shot.lampOn == null ? 1 : shot.lampOn,
      beam: !!shot.beam,
      beamAlpha: mood === 'dawn' ? 0.07 : 0.15,
      climbWindows: shot.climb ? t * 1.5 : 0
    });

    /* 前景礁石 */
    g.save();
    g.fillStyle = K.pal(mood).ink;
    g.beginPath();
    g.moveTo(-40, H);
    g.bezierCurveTo(160, 960, 300, 940, 420, H);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(W + 40, H);
    g.bezierCurveTo(W - 180, 986, W - 300, 970, W - 420, H);
    g.closePath();
    g.fill();
    g.restore();

    if (shot.climb) {
      /* 外挂铁梯：贴着塔身，给攀爬一个可读的路径 */
      g.save();
      g.strokeStyle = 'rgba(16,24,38,0.92)';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(1430 + 14, 800);
      g.lineTo(1430 + 14, 340);
      g.moveTo(1430 + 30, 800);
      g.lineTo(1430 + 30, 340);
      g.stroke();
      g.lineWidth = 3;
      for (let i = 0; i < 14; i++) {
        const ry = 780 - i * 32;
        g.beginPath();
        g.moveTo(1430 + 14, ry);
        g.lineTo(1430 + 30, ry);
        g.stroke();
      }
      g.restore();
      const cp = K.smooth(K.clamp((t - 0.10) / 2.05, 0, 1));
      const fy = K.lerp(792, 348, cp);
      F.fig(g, {
        p: 'girl',
        x: 1430 + 22,
        y: fy,
        h: 62,
        pose: 'climb',
        dir: -1,
        silhouette: true
      }, t, {});
    }
    if (mood === 'storm') {
      K.rain(g, t, { n: 220, alpha: 0.42, speed: 1700, seed: 67 });
      lightning(g, t, 69, 0.8);
    }
    gulls(g, t, 53, mood === 'storm' ? 0 : 2, 300);
  };

  /* ── 灯室：点火、守火、打盹 ───────────────────────────── */

  S.lamp = function (g, shot, local) {
    const t = tOf(local);
    const mood = moodOf(shot);
    const P = K.pal(mood);
    const room = mood === 'dawn' ? '#1b2536' : '#141d2f';

    g.fillStyle = room;
    g.fillRect(0, 0, W, H);
    const wall = g.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, K.mix(room, '#000000', 0.35));
    wall.addColorStop(0.65, room);
    wall.addColorStop(1, K.mix(room, '#000000', 0.25));
    g.fillStyle = wall;
    g.fillRect(0, 0, W, H);

    /* 窗外的海 */
    const win = { x: 120, y: 120, w: 900, h: 600 };
    g.save();
    g.beginPath();
    g.rect(win.x, win.y, win.w, win.h);
    g.clip();
    K.sky(g, mood, t, { horizon: 470, moon: mood === 'night' ? { x: 760, y: 250, r: 86 } : null, stars: 0.5, seed: 73 });
    K.ocean(g, mood, t, { horizon: 470, amp: 10, rise: mood === 'storm' ? 0.35 : 0, shimmer: { x: 760, alpha: 0.14 } });
    if (shot.rain) K.rain(g, t, { n: 170, alpha: 0.4, speed: 1500, seed: 77 });
    if (mood === 'storm') lightning(g, t, 79, 0.7);
    g.restore();

    /* 窗框 */
    g.save();
    g.fillStyle = '#0d1524';
    g.fillRect(win.x - 22, win.y - 22, win.w + 44, 26);
    g.fillRect(win.x - 22, win.y + win.h - 4, win.w + 44, 30);
    g.fillRect(win.x - 22, win.y, 24, win.h);
    g.fillRect(win.x + win.w - 2, win.y, 24, win.h);
    g.fillRect(win.x + win.w * 0.5 - 8, win.y, 16, win.h);
    g.fillRect(win.x, win.y + win.h * 0.55 - 8, win.w, 16);
    g.restore();
    g.save();
    g.strokeStyle = 'rgba(243,227,198,0.22)';
    g.lineWidth = 4;
    g.strokeRect(win.x - 22, win.y - 22, win.w + 44, win.h + 48);
    g.restore();

    if (shot.rain) K.drops(g, win, t, { n: 38 });

    /* 地板与墙板 */
    g.save();
    g.fillStyle = '#0f1726';
    g.fillRect(0, 962, W, H - 962);
    g.strokeStyle = 'rgba(243,227,198,0.08)';
    g.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(0, 986 + i * 22);
      g.lineTo(W, 986 + i * 22);
      g.stroke();
    }
    g.strokeStyle = 'rgba(230,215,185,0.05)';
    for (let i = 0; i < 5; i++) {
      const px = 1060 + i * 190;
      g.beginPath();
      g.moveTo(px, 120);
      g.lineTo(px - 34, 962);
      g.stroke();
    }
    g.restore();

    /* 右墙搁板：几只瓶罐，房间不再是一块黑板 */
    g.save();
    g.fillStyle = '#3a2c1d';
    g.fillRect(1140, 520, 420, 18);
    g.fillStyle = 'rgba(255,240,210,0.10)';
    g.fillRect(1140, 520, 420, 4);
    const jarCols = ['#2e4a4a', '#3d3346', '#4a3a26', '#25384d'];
    for (let i = 0; i < 4; i++) {
      const jx = 1180 + i * 96;
      const jh = 58 + K.rnd(181 + i * 3.3) * 52;
      const jw = 34 + K.rnd(181 + i * 7.7) * 16;
      g.fillStyle = jarCols[i];
      g.beginPath();
      g.roundRect(jx, 520 - jh, jw, jh, 8);
      g.fill();
      g.fillStyle = 'rgba(255,240,210,0.16)';
      g.fillRect(jx + 5, 520 - jh + 8, 5, jh - 16);
      g.fillStyle = '#2b2233';
      g.fillRect(jx + 4, 520 - jh - 10, jw - 8, 6);
    }
    g.restore();

    /* 灯座与透镜 */
    const lx = 880;
    const ly = 610;
    g.save();
    g.fillStyle = '#3a2c1d';
    g.beginPath();
    g.moveTo(lx - 150, 902);
    g.lineTo(lx + 150, 902);
    g.lineTo(lx + 96, 790);
    g.lineTo(lx - 96, 790);
    g.closePath();
    g.fill();
    g.fillStyle = '#5d4528';
    g.fillRect(lx - 168, 902, 336, 26);
    g.restore();

    K.glow(g, lx, ly, 420, P.warm, shot.lampLow ? 0.10 : 0.16);
    K.lens(g, lx, ly, 168, t, { mood: mood });

    /* 点火：先擦火柴，再让火苗长起来 */
    let flameSize = 62;
    let flameAlpha = 1;
    if (shot.ignite) {
      const grow = K.smooth(K.clamp((t - 0.55) / 0.85, 0, 1));
      flameSize = 18 + grow * 52;
      flameAlpha = grow;
      if (t > 0.18 && t < 0.55) {
        const sp = K.smooth((t - 0.18) / 0.16) * (1 - K.smooth((t - 0.42) / 0.13));
        K.glow(g, lx + 120, ly + 40, 90, '#ffd9a0', 0.5 * sp);
        g.save();
        g.strokeStyle = '#ffe6b8';
        g.lineWidth = 4;
        g.globalAlpha = sp;
        const sr = 16 + sp * 20;
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          g.beginPath();
          g.moveTo(lx + 120 + Math.cos(a) * 10, ly + 40 + Math.sin(a) * 10);
          g.lineTo(lx + 120 + Math.cos(a) * sr, ly + 40 + Math.sin(a) * sr);
          g.stroke();
        }
        g.restore();
      }
    }
    if (shot.lampLow) flameSize = 34;
    if (flameAlpha > 0.01) {
      g.save();
      g.globalAlpha = flameAlpha;
      K.flame(g, lx, ly + 46, flameSize, t, { mood: mood, low: shot.lampLow });
      g.restore();
    }
    lightMotes(g, lx, ly, 340, t, 22, 83);

    /* 她：伸手调灯芯 / 打盹 */
    if (shot.who) F.fig(g, shot.who, t, { rim: 0.34 });

    if (shot.who && shot.who.pose === 'sleep') {
      g.save();
      g.fillStyle = '#0e1728';
      g.fillRect(980, 900, 420, 26);
      g.fillRect(1010, 926, 22, 128);
      g.fillRect(1350, 926, 22, 128);
      g.restore();
    }

    /* 室内暖光边缘 */
    g.save();
    const warm = g.createRadialGradient(lx, ly, 60, lx, ly, 760);
    warm.addColorStop(0, K.rgba(P.warm, 0.16));
    warm.addColorStop(1, K.rgba(P.warm, 0));
    g.fillStyle = warm;
    g.fillRect(0, 0, W, H);
    g.restore();
  };

  /* ── 火苗特写：手护着它 ───────────────────────────────── */

  S.flame = function (g, shot, local) {
    const t = tOf(local);
    const mood = moodOf(shot);
    const P = K.pal(mood);
    const grd = g.createRadialGradient(960, 540, 80, 960, 560, 900);
    grd.addColorStop(0, K.mix(P.ink, '#3a2a1c', mood === 'dawn' ? 0.4 : 0.22));
    grd.addColorStop(1, '#050a12');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    K.bokeh(g, t, 97, { mood: mood, n: 12 });

    /* 玻璃罩：两侧高光 */
    g.save();
    g.globalAlpha = 0.13;
    g.fillStyle = '#dfe9e6';
    g.beginPath();
    g.moveTo(780, 900);
    g.lineTo(806, 300);
    g.lineTo(846, 300);
    g.lineTo(836, 900);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(1120, 900);
    g.lineTo(1094, 300);
    g.lineTo(1054, 300);
    g.lineTo(1064, 900);
    g.closePath();
    g.fill();
    g.restore();
    g.save();
    g.globalAlpha = 0.4;
    g.strokeStyle = '#d8e3df';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(806, 300);
    g.lineTo(780, 900);
    g.moveTo(1094, 300);
    g.lineTo(1120, 900);
    g.stroke();
    g.restore();

    /* 黄铜灯头 */
    g.save();
    g.fillStyle = '#7a5a35';
    g.beginPath();
    g.moveTo(846, 1020);
    g.lineTo(1074, 1020);
    g.lineTo(1040, 856);
    g.lineTo(880, 856);
    g.closePath();
    g.fill();
    g.fillStyle = '#a67c46';
    g.fillRect(852, 862, 216, 20);
    g.fillStyle = '#4c3720';
    g.fillRect(936, 716, 48, 146);
    g.fillStyle = '#2f2314';
    g.fillRect(930, 726, 60, 16);
    g.restore();

    const size = shot.low ? 48 : 74;
    K.flame(g, 960, 690, size, t, { mood: mood, low: shot.low });

    /* 手：守护时靠近，火光弱时伸进来 */
    let s = 0.92;
    let y = 700;
    let alpha = 1;
    if (shot.reach) {
      const p = K.smooth(K.clamp((t - 0.25) / 1.1, 0, 1));
      s = K.lerp(0.78, 0.92, p);
      y = K.lerp(960, 700, p);
      alpha = 0.5 + p * 0.5;
    }
    g.save();
    g.globalAlpha = alpha;
    F.hands(g, 960, y, s, t, { shield: shot.shield == null ? 0.6 : shot.shield });
    g.restore();

    if (mood === 'storm') {
      g.save();
      for (let i = 0; i < 18; i++) {
        const sx = 900 + K.rnd(101 + i * 3.7) * 120;
        const sy = 640 - ((t * (60 + i * 4)) % 340);
        g.globalAlpha = 0.4 * (0.4 + K.rnd(101 + i * 7.1));
        g.fillStyle = '#ffcf88';
        g.beginPath();
        g.arc(sx + Math.sin(t * 2 + i) * 12, sy, 2 + K.rnd(101 + i * 9.3) * 2, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  };

  /* ── 海面：光束、风暴、巨浪、雾里归船 ─────────────────── */

  S.sea = function (g, shot, local, slot) {
    const t = tOf(local);
    const mood = moodOf(shot);
    const P = K.pal(mood);
    const horizon = 560;
    K.sky(g, mood, t, {
      horizon: horizon,
      moon: mood === 'night' ? { x: 1290, y: 220, r: 132 } : null,
      sun: mood === 'dawn' ? { x: 1420, y: 530, r: 84 } : null,
      stars: mood === 'night' ? 1 : mood === 'storm' ? 0.1 : 0.2,
      seed: 103
    });

    if (shot.beam) {
      const lx = W + 210;
      const ang = Math.PI - 0.10 + Math.sin(t * 0.42) * 0.12;
      K.beam(g, lx, 470, ang, 2000, '#ffdca4', 0.11, { spread: 0.045, root: 9 });
      K.glow(g, W - 6, 470, 190, '#ffd9a0', 0.16);
    }

    K.ocean(g, mood, t, {
      horizon: horizon,
      amp: mood === 'storm' ? 26 : 10,
      bands: mood === 'storm' ? 6 : 5,
      edgeA: mood === 'storm' ? 0.30 : 0.22,
      rise: shot.waveRise ? 1 : shot.waveSurge ? 0.35 : 0,
      shimmer: { x: mood === 'night' ? 1290 : 1420, alpha: 0.24 }
    });
    if (mood === 'storm') foam(g, t, horizon);

    if (shot.giant) {
      giantWave(g, shot, t);
      if (shot.boat) K.boat(g, shot.boat.x, shot.boat.y, shot.boat.s || 0.8, t, {
        mood: mood, tilt: -0.16 + Math.sin(t * 1.4) * 0.05, ph: 0.6
      });
      if (shot.rain) K.rain(g, t, { n: 230, alpha: 0.4, speed: 1800, seed: 109 });
      lightning(g, t, 107, 0.7);
    } else if (shot.boat) {
      let bx = shot.boat.x;
      let by = shot.boat.y;
      if (shot.boat.move) {
        const p = K.smooth(K.clamp((t - 0.4) / 1.8, 0, 1));
        bx = K.lerp(shot.boat.move[0], shot.boat.move[1], p);
        by += Math.sin(t * 1.3) * 6;
      }
      K.boat(g, bx, by, shot.boat.s || 0.8, t, {
        mood: mood,
        keeper: shot.keeperWave ? 'wave' : null,
        tilt: shot.boat.tilt || 0,
        ph: shot.boat.ph || 1.1
      });
      if (shot.horn) horn(g, bx, by - 150, t, P);
    }

    if (shot.fog) K.fog(g, t, { mood: mood, alpha: 0.19, y: 470 });
    if (shot.rain) K.rain(g, t, { n: 170, alpha: 0.38, speed: 1600, seed: 113 });
    if (mood === 'dawn' && !shot.fog) K.fog(g, t, { mood: mood, alpha: 0.08, y: 640 });
    gulls(g, t, 127, mood === 'storm' ? 0 : 2, 260);
  };

  function giantWave(g, shot, t) {
    const P = K.pal('storm');
    const rise = K.smooth(K.clamp((t - 0.15) / 1.35, 0, 1));
    const crest = 540 - rise * 150;
    K.paper(g, function (ctx) {
      ctx.moveTo(-80, H + 40);
      ctx.lineTo(-80, 760);
      ctx.bezierCurveTo(150, 780, 220, 620, 430, 590);
      ctx.bezierCurveTo(650, 556, 700, 690, 900, 710);
      ctx.bezierCurveTo(950, 728, 1000, 880, 1040, H + 40);
      ctx.closePath();
    }, P.sea[1], { edge: P.cream, edgeA: 0.26, edgeW: 4, blur: 26, dy: 12 });

    K.paper(g, function (ctx) {
      ctx.moveTo(-80, H + 40);
      ctx.lineTo(-80, 846);
      ctx.bezierCurveTo(160, 858, 260, 700, 520, crest + 80);
      ctx.bezierCurveTo(700, crest + 56, 760, 760, 860, 786);
      ctx.bezierCurveTo(960, 812, 1040, 940, 1090, H + 40);
      ctx.closePath();
    }, P.sea[2], { edge: P.cream, edgeA: 0.34, edgeW: 4, blur: 26, dy: 14 });

    /* 浪脊白沫：贴着前浪 bezier 的浪脊撒纸屑 */
    const crestAt = (p) => {
      if (p < 0.5) {
        const u = p * 2, v = 1 - u;
        return {
          x: v * v * v * -80 + 3 * v * v * u * 160 + 3 * v * u * u * 260 + u * u * u * 520,
          y: v * v * v * 846 + 3 * v * v * u * 858 + 3 * v * u * u * 700 + u * u * u * (crest + 80)
        };
      }
      const u = (p - 0.5) * 2, v = 1 - u;
      return {
        x: v * v * v * 520 + 3 * v * v * u * 720 + 3 * v * u * u * 790 + u * u * u * 940,
        y: v * v * v * (crest + 80) + 3 * v * v * u * (crest + 60) + 3 * v * u * u * 780 + u * u * u * 800
      };
    };
    g.save();
    g.fillStyle = P.cream;
    for (let i = 0; i < 26; i++) {
      const p = 0.04 + (i / 25) * 0.82;
      const pt = crestAt(p);
      const nx = crestAt(Math.min(1, p + 0.01));
      const dx = nx.x - pt.x, dy = nx.y - pt.y;
      const dl = Math.hypot(dx, dy) || 1;
      const lift = 4 + K.rnd(131 + i * 3.1) * 8 + Math.sin(t * 2.4 + i * 1.7) * 2.5;
      const x = pt.x + (dy / dl) * lift + Math.sin(t * 1.8 + i) * 3;
      const y = pt.y + (-dx / dl) * lift;
      const r = 3.5 + K.rnd(131 + i * 5.7) * 7;
      g.globalAlpha = 0.32 + K.rnd(131 + i * 7.3) * 0.4;
      g.beginPath();
      g.ellipse(x, y, r, r * 0.72, Math.atan2(dy, dx), 0, Math.PI * 2);
      g.fill();
      if (i % 3 === 0) {
        g.globalAlpha = 0.2;
        g.beginPath();
        g.ellipse(x + 6, y + 12 + K.rnd(131 + i * 9.1) * 10, r * 0.6, r * 0.45, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  function horn(g, x, y, t, P) {
    g.save();
    for (let i = 0; i < 3; i++) {
      const p = K.clamp((t - 1.0 - i * 0.16) / 0.7, 0, 1);
      if (p <= 0 || p >= 1) continue;
      g.globalAlpha = (1 - p) * 0.4;
      g.strokeStyle = P.cream;
      g.lineWidth = 5;
      g.beginPath();
      g.arc(x, y, 80 + p * 220, -0.9, 0.9);
      g.stroke();
    }
    g.restore();
  }

  /* ── 窗内：她背对镜头看海 ─────────────────────────────── */

  S.window = function (g, shot, local) {
    const t = tOf(local);
    const mood = moodOf(shot);
    const P = K.pal(mood);
    const win = { x: 380, y: 120, w: 1120, h: 640 };

    g.save();
    g.beginPath();
    g.rect(win.x, win.y, win.w, win.h);
    g.clip();
    K.sky(g, mood, t, {
      horizon: 470,
      sun: mood === 'dawn' ? { x: 1200, y: 440, r: 76 } : null,
      moon: mood === 'night' ? { x: 1120, y: 230, r: 104 } : null,
      stars: mood === 'night' ? 0.9 : mood === 'dawn' ? 0.08 : 0.1,
      seed: 137
    });
    K.ocean(g, mood, t, { horizon: 470, amp: 12, rise: mood === 'storm' ? 0.4 : 0, shimmer: { x: 1120, alpha: 0.2 } });
    if (shot.beam) K.beam(g, win.x + win.w + 160, 300, Math.PI + 0.4, 1900, '#ffdca4', 0.09, { spread: 0.05, root: 10 });
    if (mood === 'storm') {
      K.rain(g, t, { n: 190, alpha: 0.42, speed: 1700, seed: 139 });
      lightning(g, t, 149, 0.6);
    }
    if (shot.boat) K.boat(g, shot.boat.x, shot.boat.y, shot.boat.s || 0.6, t, { mood: mood, ph: 1.7 });
    g.restore();

    /* 窗框与墙 */
    g.fillStyle = '#0c1422';
    g.fillRect(0, 0, W, win.y);
    g.fillRect(0, win.y + win.h, W, H - win.y - win.h);
    g.fillRect(0, win.y, win.x, win.h);
    g.fillRect(win.x + win.w, win.y, W - win.x - win.w, win.h);
    g.save();
    g.fillStyle = '#0a111d';
    g.fillRect(win.x - 26, win.y - 26, win.w + 52, 30);
    g.fillRect(win.x - 26, win.y + win.h - 4, win.w + 52, 34);
    g.fillRect(win.x - 26, win.y, 28, win.h);
    g.fillRect(win.x + win.w - 2, win.y, 28, win.h);
    g.fillRect(win.x + win.w * 0.52 - 8, win.y, 16, win.h);
    g.fillRect(win.x, win.y + win.h * 0.52 - 8, win.w, 16);
    g.restore();
    g.save();
    g.strokeStyle = 'rgba(243,227,198,0.18)';
    g.lineWidth = 3;
    g.strokeRect(win.x - 4, win.y - 4, win.w + 8, win.h + 8);
    g.restore();

    if (mood === 'storm') K.drops(g, win, t, { n: 54 });
    if (shot.wipe) {
      const clear = K.smooth(K.clamp((t - 0.5) / 1.5, 0, 1)) * 290;
      K.fogOnGlass(g, win, t, clear, { cx: 0.34, cy: 0.48, alpha: 0.34 });
    }

    /* 地板与踢脚线：她有一个站的地方 */
    g.save();
    g.fillStyle = '#070d17';
    g.fillRect(0, 1000, W, H - 1000);
    g.fillStyle = 'rgba(243,227,198,0.10)';
    g.fillRect(0, 1000, W, 3);
    g.strokeStyle = 'rgba(243,227,198,0.05)';
    g.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(0, 1022 + i * 22);
      g.lineTo(W, 1022 + i * 22);
      g.stroke();
    }
    g.restore();

    /* 左墙：挂钩上的旧外套与一盘绳，给空墙一点生活 */
    g.save();
    g.fillStyle = '#0a111d';
    g.fillRect(196, 262, 10, 26);
    g.beginPath();
    g.moveTo(150, 292);
    g.bezierCurveTo(196, 268, 240, 268, 252, 296);
    g.lineTo(268, 470);
    g.quadraticCurveTo(200, 500, 142, 470);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(243,227,198,0.14)';
    g.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(196, 706, 44 + i * 13, 0.4, Math.PI * 1.7);
      g.stroke();
    }
    g.restore();

    /* 右墙：一张边桌与油灯，给暖光一个出处 */
    g.save();
    g.fillStyle = '#0a111d';
    g.fillRect(1652, 936, 268, 16);
    g.fillRect(1674, 952, 16, 126);
    g.fillRect(1882, 952, 16, 126);
    g.beginPath();
    g.roundRect(1766, 862, 48, 74, 10);
    g.fill();
    g.restore();
    K.flame(g, 1790, 856, 24, t, { mood: mood, low: true });

    /* 室内右侧的一盏小灯，把她从背景里分出来 */
    K.glow(g, 1760, 760, 300, P.warm, 0.10);

    if (shot.who) {
      const who = Object.assign({}, shot.who);
      if (shot.press) {
        const p = K.smooth(K.clamp((t - 0.55) / 0.85, 0, 1));
        who.x = who.x - p * 36;
        who.pose = p > 0.65 ? 'reach' : 'back';
        who.dir = 1;
      }
      F.fig(g, who, t, { rim: 0.18 });
    }
  };

  /* ── 片尾：灯亮着，海静下来 ───────────────────────────── */

  S.end = function (g, shot, local) {
    const t = tOf(local);
    const P = K.pal('dawn');
    K.sky(g, 'dawn', t, {
      horizon: 640,
      sun: { x: 520, y: 610, r: 72 },
      stars: 0.06,
      seed: 151
    });
    K.ocean(g, 'dawn', t, { horizon: 640, amp: 8, shimmer: { x: 520, alpha: 0.28 } });
    K.town(g, -60, 760, 620, { mood: 'dawn', h: 110, n: 9, lit: 0.24, t: t, seed: 157, tail: 26 });
    K.lighthouse(g, 1560, 780, 460, t, { mood: 'dawn', lampOn: 1, beam: true, beamAlpha: 0.06 });
    if (shot.boat) K.boat(g, shot.boat.x, shot.boat.y, shot.boat.s || 0.6, t, { mood: 'dawn', keeper: 'wave' });
    gulls(g, t, 163, 3, 270);
    K.fog(g, t, { mood: 'dawn', alpha: 0.07, y: 660 });
  };

  root.PAPER_SETS = S;
})(typeof window !== 'undefined' ? window : null);
