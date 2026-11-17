/* 剪纸人物：同一套比例贯穿全景、中景与特写。
   全景是深色剪影 + 一圈暖纸边；特写才画眉眼与表情。
   所有动作只依赖入镜时间 t，眨眼、发丝、呼吸都由 t 与种子推导。 */
(function (root) {
  'use strict';
  const K = root.PAPER_KIT;
  const P = {};

  const PAL = {
    girl: {
      coat: '#1a2740',
      coat2: '#243654',
      skin: '#f0cfae',
      skin2: '#e0b892',
      hair: '#0f1729',
      hair2: '#1d2a46',
      scarf: '#c2544a',
      scarf2: '#d9705f',
      boot: '#0a1220',
      lip: '#b96a63'
    },
    keeper: {
      coat: '#141f33',
      coat2: '#1e2d48',
      skin: '#d8b28d',
      skin2: '#c39a76',
      hair: '#0c1322',
      hair2: '#1a2740',
      scarf: '#2c405f',
      scarf2: '#3a5275',
      boot: '#08101d',
      lip: '#a96760'
    }
  };
  P.PAL = PAL;

  function fill(g, build, color) {
    g.beginPath();
    build(g);
    g.fillStyle = color;
    g.fill();
  }

  function cap(g, x1, y1, x2, y2, w, color) {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }

  P.fig = function (g, spec, t, opt) {
    opt = opt || {};
    const who = spec.p === 'keeper' ? 'keeper' : 'girl';
    const pal = opt.silhouette ? silhouette(PAL[who]) : PAL[who];
    const h = spec.h || 180;
    const s = h / 1000;
    const dir = spec.dir || 1;
    const pose = spec.pose || 'stand';
    const ph = spec.ph || 0;
    const moving = pose === 'walk' || pose === 'run' || pose === 'climb';
    const stride = pose === 'run' ? 10.2 : pose === 'walk' ? 5.4 : 4.2;
    const wp = t * stride + ph;
    const bob = moving ? Math.abs(Math.sin(wp)) * (pose === 'run' ? 16 : 8) : Math.sin(t * 1.5 + ph) * 3;
    const lean = pose === 'run' ? 0.10 : pose === 'sleep' ? -0.16 : pose === 'reach' ? 0.03 : 0;

    g.save();
    g.translate(spec.x, spec.y - bob * s + (pose === 'sleep' ? 34 * s : 0));
    g.rotate(lean * dir);
    g.scale(s * dir, s);

    let legA = 0.035;
    let legB = -0.035;
    if (moving) {
      legA = Math.sin(wp) * (pose === 'run' ? 0.62 : 0.44);
      legB = -legA;
    }
    leg(g, -42, -360, legA, pal, moving ? Math.max(0, Math.sin(wp)) : 0);
    leg(g, 42, -360, legB, pal, moving ? Math.max(0, -Math.sin(wp)) : 0);

    /* 大衣：宽下摆，给风留出摆动的边 */
    const hem = 128 + Math.sin(t * 1.7 + ph) * 4;
    fill(g, function (ctx) {
      ctx.moveTo(-86, -748);
      ctx.bezierCurveTo(-112, -700, -122, -540, -hem, -352);
      ctx.quadraticCurveTo(0, -326, hem, -352);
      ctx.bezierCurveTo(122, -540, 112, -700, 86, -748);
      ctx.quadraticCurveTo(0, -772, -86, -748);
      ctx.closePath();
    }, pal.coat);

    /* 背光侧的一块浅纸，让大衣有层 */
    g.save();
    g.globalAlpha = 0.5;
    fill(g, function (ctx) {
      ctx.moveTo(46, -742);
      ctx.bezierCurveTo(76, -700, 86, -540, 96, -366);
      ctx.quadraticCurveTo(118, -358, hem, -352);
      ctx.bezierCurveTo(122, -540, 112, -700, 86, -748);
      ctx.closePath();
    }, pal.coat2);
    g.restore();

    /* 手臂 */
    let armA = 0.10;
    let armB = -0.10;
    if (moving) {
      armA = -Math.sin(wp) * (pose === 'run' ? 0.55 : 0.34);
      armB = Math.sin(wp) * (pose === 'run' ? 0.55 : 0.34);
    }
    if (pose === 'wave') armB = -2.55 + Math.sin(t * 4.2 + ph) * 0.16;
    if (pose === 'reach') armB = 1.16;
    if (pose === 'shield') armB = -1.85;
    if (pose === 'climb') { armA = -2.1; armB = -2.75 + Math.sin(wp) * 0.25; }
    if (pose === 'sleep') { armA = 0.42; armB = 0.18; }
    const gesturing = pose === 'wave' || pose === 'reach' || pose === 'shield' || pose === 'climb';
    arm(g, -80, -735, armA, pal, pose === 'shield', gesturing && pose !== 'reach');
    arm(g, 80, -735, armB, pal, pose === 'wave' || pose === 'reach', gesturing);

    /* 围巾：绕颈一圈，尾巴迎风 */
    fill(g, function (ctx) {
      ctx.roundRect(-74, -806, 148, 46, 20);
    }, pal.scarf);
    const fl = Math.sin(t * 2.2 + ph) * 14;
    fill(g, function (ctx) {
      ctx.moveTo(28, -782);
      ctx.bezierCurveTo(96 + fl, -744, 80 + fl, -656, 46 + fl, -604);
      ctx.lineTo(4 + fl * 0.8, -626);
      ctx.bezierCurveTo(34 + fl * 0.6, -682, 26, -740, -6, -782);
      ctx.closePath();
    }, pal.scarf2);

    /* 头：后发 → 脸 → 刘海 */
    const headY = -872;
    fill(g, function (ctx) { ctx.ellipse(0, headY - 8, 76, 80, 0, 0, Math.PI * 2); }, pal.hair);
    if (pose === 'back') {
      fill(g, function (ctx) {
        ctx.moveTo(-70, -890);
        ctx.bezierCurveTo(-92, -840, -86, -796, -62, -778);
        ctx.lineTo(64, -778);
        ctx.bezierCurveTo(88, -798, 90, -842, 68, -890);
        ctx.closePath();
      }, pal.hair2);
    } else {
      fill(g, function (ctx) { ctx.ellipse(8, headY + 4, 58, 62, 0, 0, Math.PI * 2); }, pal.skin);
      fill(g, function (ctx) {
        ctx.moveTo(-72, headY - 40);
        ctx.bezierCurveTo(-56, headY - 92, 44, headY - 96, 76, headY - 34);
        ctx.lineTo(58, headY - 18);
        ctx.bezierCurveTo(26, headY - 52, -22, headY - 50, -54, headY - 8);
        ctx.closePath();
      }, pal.hair);
      if (h >= 230 && spec.face !== false) {
        const fx = 10;
        g.fillStyle = pal.boot;
        g.beginPath();
        g.arc(-14 + fx, headY + 2, 5.2, 0, Math.PI * 2);
        g.arc(30 + fx, headY + 2, 5.2, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = K.rgba(pal.lip, 0.8);
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(2 + fx, headY + 34);
        g.quadraticCurveTo(12 + fx, headY + 38, 20 + fx, headY + 33);
        g.stroke();
      }
    }

    /* 耳后发丝：两条细线，风一吹就分开 */
    g.strokeStyle = pal.hair2;
    g.lineWidth = 11;
    g.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const sway = Math.sin(t * 1.9 + i * 1.7 + ph) * 8;
      g.beginPath();
      g.moveTo(-58 + i * 8, headY - 12);
      g.bezierCurveTo(-86 + sway, headY + 40, -82 - sway, headY + 100, -64 - sway, headY + 128);
      g.stroke();
    }

    if (!opt.silhouette) {
      /* 暖纸边：贴着面向灯火的一侧 */
      const r = opt.rim == null ? 0.26 : opt.rim;
      g.save();
      g.globalAlpha = r;
      g.strokeStyle = '#ffc473';
      g.lineWidth = 8;
      g.beginPath();
      g.arc(6, headY, 74, -1.25, 0.35);
      g.stroke();
      g.globalAlpha = r * 0.7;
      g.beginPath();
      g.moveTo(78, -742);
      g.bezierCurveTo(104, -660, 116, -520, 122, -380);
      g.stroke();
      g.restore();
    }

    g.restore();
  };

  function leg(g, hipX, hipY, angle, pal, lift) {
    const kneeX = hipX + Math.sin(angle) * 72;
    const kneeY = hipY + Math.cos(angle) * 178;
    const footX = hipX + Math.sin(angle) * 138;
    const footY = -16 - lift * 26;
    g.strokeStyle = pal.boot;
    g.lineWidth = 46;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.lineTo(kneeX, kneeY);
    g.lineTo(footX, footY);
    g.stroke();
    g.save();
    g.fillStyle = pal.boot;
    g.beginPath();
    g.roundRect(footX - 34, footY - 8, 74, 26, 9);
    g.fill();
    g.restore();
  }

  function arm(g, shoulderX, shoulderY, angle, pal, front, showHand) {
    const ex = shoulderX + Math.sin(angle) * 92;
    const ey = shoulderY + Math.cos(angle) * 148;
    const hx = ex + Math.sin(angle * 0.82) * 70;
    const hy = ey + Math.cos(angle * 0.82) * 118;
    /* 抬起的手臂先在纸上压一道影子，避免与大衣糊成一片 */
    if (front) {
      g.strokeStyle = K.rgba('#070d17', 0.55);
      g.lineWidth = 44;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(shoulderX + 6, shoulderY + 8);
      g.lineTo(ex + 8, ey + 10);
      g.lineTo(hx + 10, hy + 12);
      g.stroke();
    }
    g.strokeStyle = front ? pal.coat2 : pal.coat;
    g.lineWidth = 36;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(shoulderX, shoulderY);
    g.lineTo(ex, ey);
    g.lineTo(hx, hy);
    g.stroke();
    /* 袖口：一条横向断口，让垂手不再读成纽扣 */
    const fa = Math.atan2(hy - ey, hx - ex);
    g.strokeStyle = K.rgba(pal.boot, 0.85);
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(hx - Math.sin(fa) * 15, hy + Math.cos(fa) * 15);
    g.lineTo(hx + Math.sin(fa) * 15, hy - Math.cos(fa) * 15);
    g.stroke();
    if (!showHand) return;
    g.fillStyle = pal.skin;
    g.beginPath();
    g.arc(hx, hy, 15, 0, Math.PI * 2);
    g.fill();
  }

  function silhouette(pal) {
    const out = {};
    for (const k in pal) out[k] = k === 'skin' ? '#101a2c' : '#101a2c';
    out.lip = '#101a2c';
    return out;
  }

  /* ── 特写：胸口以上，眉眼可见 ─────────────────────────── */

  P.bust = function (g, spec, t, opt) {
    opt = opt || {};
    const who = spec.p === 'keeper' ? 'keeper' : 'girl';
    const pal = PAL[who];
    const u = (spec.h || 340) / 340;
    const dir = spec.dir || 1;
    const expr = spec.expr || 'calm';
    const seed = spec.seed || 3;
    const breath = Math.sin(t * 1.35 + seed) * 2.4;
    const tiltBase = (spec.tilt || 0) + Math.sin(t * 0.55 + seed) * 0.008;
    const tilt = expr === 'listen' ? 0.035 : tiltBase;

    const blinkAt = 0.95 + K.rnd(seed * 4.7) * 1.0;
    const blinkSpan = 0.15;
    let open = 1;
    if (t > blinkAt && t < blinkAt + blinkSpan) {
      const p = (t - blinkAt) / blinkSpan;
      open = Math.abs(p - 0.5) * 2;
    }
    if (expr === 'sleep') open = 0;

    g.save();
    g.translate(spec.x, spec.y + breath);
    g.scale(u * dir, u);

    /* 肩膀与大衣 */
    fill(g, function (ctx) {
      ctx.moveTo(-480, 700);
      ctx.bezierCurveTo(-452, 468, -306, 352, -172, 322);
      ctx.quadraticCurveTo(0, 286, 172, 322);
      ctx.bezierCurveTo(306, 352, 452, 468, 480, 700);
      ctx.lineTo(480, 900);
      ctx.lineTo(-480, 900);
      ctx.closePath();
    }, pal.coat);
    g.save();
    g.globalAlpha = 0.55;
    fill(g, function (ctx) {
      ctx.moveTo(118, 330);
      ctx.bezierCurveTo(272, 356, 404, 470, 452, 700);
      ctx.lineTo(452, 900);
      ctx.lineTo(168, 900);
      ctx.bezierCurveTo(202, 640, 190, 470, 118, 330);
      ctx.closePath();
    }, pal.coat2);
    g.restore();

    /* 后发 */
    fill(g, function (ctx) {
      ctx.ellipse(0, 12, 205, 236, 0, 0, Math.PI * 2);
    }, pal.hair);
    fill(g, function (ctx) {
      ctx.moveTo(-196, 20);
      ctx.bezierCurveTo(-222, 142, -188, 236, -132, 274);
      ctx.lineTo(136, 274);
      ctx.bezierCurveTo(192, 234, 222, 142, 198, 20);
      ctx.closePath();
    }, pal.hair);

    /* 脖子：短，接在围巾里，头不悬空 */
    fill(g, function (ctx) {
      ctx.roundRect(-76, 150, 152, 120, 54);
    }, pal.skin2);

    /* 头与五官整体轻微转动 */
    g.save();
    g.translate(0, 174);
    g.rotate(tilt);
    g.translate(0, -174);

    /* 脸 */
    fill(g, function (ctx) {
      ctx.moveTo(0, -198);
      ctx.bezierCurveTo(112, -198, 164, -108, 158, -6);
      ctx.bezierCurveTo(152, 112, 92, 188, 0, 198);
      ctx.bezierCurveTo(-92, 188, -152, 112, -158, -6);
      ctx.bezierCurveTo(-164, -108, -112, -198, 0, -198);
      ctx.closePath();
    }, pal.skin);

    /* 耳朵 */
    fill(g, function (ctx) {
      ctx.ellipse(150, 34, 30, 46, -0.12, 0, Math.PI * 2);
    }, pal.skin2);
    g.save();
    g.strokeStyle = K.rgba(pal.skin2, 0.9);
    g.lineWidth = 5;
    g.beginPath();
    g.arc(152, 36, 17, -1.2, 1.4);
    g.stroke();
    g.restore();

    /* 刘海：侧分，露出额头 */
    fill(g, function (ctx) {
      ctx.moveTo(-188, 22);
      ctx.bezierCurveTo(-204, -166, -104, -238, 0, -238);
      ctx.bezierCurveTo(116, -238, 204, -156, 188, 24);
      ctx.lineTo(148, 10);
      ctx.bezierCurveTo(142, -88, 92, -146, 24, -150);
      ctx.bezierCurveTo(-42, -154, -104, -116, -136, -22);
      ctx.closePath();
    }, pal.hair2);

    /* 被风吹乱的两缕：贴着发缘，不划过额头 */
    g.strokeStyle = K.rgba(pal.hair2, 0.85);
    g.lineWidth = 6;
    g.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const sway = Math.sin(t * 1.55 + i * 1.3 + seed) * 10;
      g.beginPath();
      g.moveTo(154 + i * 18, -128 + i * 26);
      g.bezierCurveTo(190 + sway, -60, 198 - sway, 60, 180 - sway, 150 + i * 24);
      g.stroke();
    }

    drawFace(g, expr, open, pal, t, seed, spec);

    /* 暖边：脸颊内侧一道薄光，发缘外圈一圈 */
    g.save();
    const rim = opt.rim == null ? 0.3 : opt.rim;
    g.strokeStyle = '#ffc473';
    g.lineCap = 'round';
    g.globalAlpha = rim * 0.85;
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(128, 4);
    g.bezierCurveTo(122, 92, 70, 158, 6, 174);
    g.stroke();
    g.globalAlpha = rim * 0.5;
    g.lineWidth = 8;
    g.beginPath();
    g.ellipse(0, 6, 204, 234, 0, -1.28, -0.02);
    g.stroke();
    g.restore();

    g.restore();

    /* 围巾：压在锁骨上 */
    fill(g, function (ctx) {
      ctx.moveTo(-178, 256);
      ctx.bezierCurveTo(-66, 218, 74, 218, 182, 258);
      ctx.lineTo(156, 376);
      ctx.bezierCurveTo(54, 342, -54, 342, -158, 378);
      ctx.closePath();
    }, pal.scarf);
    g.save();
    g.globalAlpha = 0.6;
    fill(g, function (ctx) {
      ctx.moveTo(-144, 292);
      ctx.bezierCurveTo(-42, 264, 54, 264, 154, 294);
      ctx.lineTo(146, 324);
      ctx.bezierCurveTo(50, 298, -46, 298, -140, 326);
      ctx.closePath();
    }, pal.scarf2);
    g.restore();
    fill(g, function (ctx) {
      ctx.moveTo(116, 332);
      ctx.bezierCurveTo(198, 392, 208, 528, 170, 632);
      ctx.lineTo(76, 616);
      ctx.bezierCurveTo(118, 508, 110, 414, 64, 352);
      ctx.closePath();
    }, pal.scarf2);

    g.restore();
  };

  function drawFace(g, expr, open, pal, t, seed, spec) {
    const fx = 6;
    const eyeY = -22;
    const ex = 62;
    const iris = '#232536';

    if (expr === 'sleep') {
      g.strokeStyle = pal.hair;
      g.lineWidth = 7;
      g.lineCap = 'round';
      for (let s = -1; s <= 1; s += 2) {
        g.beginPath();
        g.moveTo(s * ex - 28 + fx, eyeY + 2);
        g.quadraticCurveTo(s * ex + fx, eyeY + 18, s * ex + 28 + fx, eyeY + 2);
        g.stroke();
      }
    } else if (open < 0.10) {
      g.strokeStyle = pal.hair;
      g.lineWidth = 6;
      g.lineCap = 'round';
      for (let s = -1; s <= 1; s += 2) {
        g.beginPath();
        g.moveTo(s * ex - 30 + fx, eyeY + 2);
        g.quadraticCurveTo(s * ex + fx, eyeY + 14, s * ex + 30 + fx, eyeY + 2);
        g.stroke();
      }
    } else {
      const smile = expr === 'smile' || expr === 'cry';
      for (let s = -1; s <= 1; s += 2) {
        const cx = s * ex + fx;
        if (smile) {
          g.strokeStyle = pal.hair;
          g.lineWidth = 7;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(cx - 30, eyeY + 6);
          g.quadraticCurveTo(cx, eyeY - 16, cx + 30, eyeY + 6);
          g.stroke();
        } else {
          const h = 19 * open;
          g.save();
          g.beginPath();
          g.ellipse(cx, eyeY, 33, h, 0, 0, Math.PI * 2);
          g.fillStyle = '#f8f0df';
          g.fill();
          g.clip();
          g.fillStyle = iris;
          g.beginPath();
          g.arc(cx + 4, eyeY, 16, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#0b101c';
          g.beginPath();
          g.arc(cx + 4, eyeY, 7, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#fff6df';
          g.beginPath();
          g.arc(cx + 10, eyeY - 6, 4, 0, Math.PI * 2);
          g.fill();
          if (spec && spec.eyesFlame) {
            const f = 0.7 + 0.3 * Math.sin(t * 12 + s);
            g.fillStyle = K.rgba('#ffc473', 0.9 * f);
            g.beginPath();
            g.ellipse(cx + 4, eyeY + 7, 4.2, 7.5 * f, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = K.rgba('#fff4d8', 0.9);
            g.beginPath();
            g.ellipse(cx + 4, eyeY + 8, 1.7, 3.4 * f, 0, 0, Math.PI * 2);
            g.fill();
          }
          g.restore();
          g.strokeStyle = pal.hair;
          g.lineWidth = 5;
          g.beginPath();
          g.ellipse(cx, eyeY, 33, h, 0, Math.PI * 1.02, Math.PI * 1.98);
          g.stroke();
        }
      }
    }

    /* 眉 */
    g.strokeStyle = pal.hair;
    g.lineWidth = 9;
    g.lineCap = 'round';
    for (let s = -1; s <= 1; s += 2) {
      const cx = s * ex + fx;
      let inX = cx - s * 34;
      let inY = -88;
      let outX = cx + s * 34;
      let outY = -84;
      if (expr === 'worry' || expr === 'listen') { inY -= 14; outY -= 2; }
      if (expr === 'determined') { inY += 12; outY -= 2; }
      g.beginPath();
      g.moveTo(inX, inY);
      g.quadraticCurveTo(cx, inY - 10, outX, outY);
      g.stroke();
    }

    /* 鼻 */
    g.strokeStyle = K.rgba(pal.skin2, 0.9);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(fx + 2, 10);
    g.quadraticCurveTo(fx - 8, 44, fx + 10, 48);
    g.stroke();

    /* 嘴 */
    const my = 106;
    if (expr === 'worry') {
      g.strokeStyle = K.rgba(pal.lip, 0.92);
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(fx - 22, my + 8);
      g.quadraticCurveTo(fx, my - 6 + Math.sin(t * 5.4 + seed) * 1.6, fx + 22, my + 8);
      g.stroke();
    } else if (expr === 'smile' || expr === 'cry') {
      g.strokeStyle = pal.lip;
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(fx - 44, my);
      g.quadraticCurveTo(fx, my + 34, fx + 44, my);
      g.stroke();
      g.save();
      g.globalAlpha = 0.35;
      g.fillStyle = '#e89a8c';
      g.beginPath();
      g.ellipse(fx - 108, 52, 38, 20, -0.2, 0, Math.PI * 2);
      g.ellipse(fx + 108, 52, 38, 20, 0.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    } else if (expr === 'determined') {
      g.strokeStyle = pal.lip;
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(fx - 38, my + 2);
      g.lineTo(fx + 38, my + 2);
      g.stroke();
    } else {
      g.strokeStyle = K.rgba(pal.lip, 0.85);
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(fx - 34, my);
      g.quadraticCurveTo(fx, my + 12, fx + 34, my);
      g.stroke();
    }

    /* 泪 */
    if (spec && (spec.tear || expr === 'cry')) {
      const slide = 0.55 + 0.45 * K.smooth(K.clamp((t - 0.7) / 1.1, 0, 1));
      g.save();
      g.globalAlpha = 0.62;
      g.fillStyle = '#e8f1ee';
      g.beginPath();
      g.moveTo(fx + ex + 19, eyeY + 16);
      g.bezierCurveTo(fx + ex + 23, eyeY + 28, fx + ex + 21, 24 * slide + 4, fx + ex + 16, 27 * slide + 4);
      g.bezierCurveTo(fx + ex + 12, 24 * slide + 4, fx + ex + 14, eyeY + 28, fx + ex + 19, eyeY + 16);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  /* ── 手：守住火苗的双手 ───────────────────────────────── */

  P.hands = function (g, x, y, s, t, opt) {
    opt = opt || {};
    const pal = PAL.girl;
    const shield = opt.shield == null ? 0.55 : opt.shield;
    const tremble = Math.sin(t * 8.7) * 2 + Math.sin(t * 13.1) * 1.2;
    g.save();
    g.translate(x, y + tremble);
    g.scale(s, s);

    for (let side = -1; side <= 1; side += 2) {
      g.save();
      g.scale(side, 1);
      g.translate(34, 0);

      /* 袖口：从画面下缘伸上来的一截大衣 */
      g.fillStyle = pal.coat;
      g.beginPath();
      g.moveTo(60, 300);
      g.lineTo(330, 300);
      g.lineTo(372, 620);
      g.lineTo(24, 620);
      g.closePath();
      g.fill();

      /* 拇指：先画，藏在掌沿内侧，只露出贴火的一截 */
      g.strokeStyle = pal.skin2;
      g.lineWidth = 46;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(176, 300);
      g.quadraticCurveTo(112, 250, 96, 168);
      g.stroke();

      /* 掌背：上宽下窄，斜着托住火 */
      g.save();
      g.translate(206, 214);
      g.rotate(-0.15);
      g.fillStyle = pal.skin;
      g.beginPath();
      g.moveTo(-118, 96);
      g.bezierCurveTo(-140, 6, -112, -74, -40, -100);
      g.lineTo(92, -92);
      g.bezierCurveTo(140, -58, 150, 18, 132, 98);
      g.closePath();
      g.fill();
      /* 掌心的浅色纸片 */
      g.globalAlpha = 0.35;
      g.fillStyle = pal.skin2;
      g.beginPath();
      g.ellipse(-14, 26, 62, 52, 0.2, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.restore();

      /* 四指：向火苗一侧收拢 */
      const fing = [
        { bx: 184, by: 152, tx: 108, ty: -96 },
        { bx: 210, by: 158, tx: 148, ty: -128 },
        { bx: 236, by: 160, tx: 184, ty: -112 },
        { bx: 260, by: 156, tx: 216, ty: -80 }
      ];
      for (let i = 0; i < fing.length; i++) {
        const f = fing[i];
        const sh = shield * (i * 3);
        g.strokeStyle = pal.skin;
        g.lineWidth = 38 - i * 2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(f.bx, f.by);
        g.quadraticCurveTo(f.bx - 22, (f.by + f.ty) * 0.42, f.tx - sh, f.ty + sh * 0.4);
        g.stroke();
      }

      /* 指根与手背的暖边 */
      g.save();
      g.globalAlpha = 0.28;
      g.strokeStyle = '#ffc473';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(150, 120);
      g.quadraticCurveTo(120, 30, 100, -70);
      g.stroke();
      g.restore();

      /* 袖口压住手腕 */
      g.fillStyle = pal.coat;
      g.beginPath();
      g.moveTo(58, 296);
      g.lineTo(334, 296);
      g.lineTo(348, 372);
      g.lineTo(44, 372);
      g.closePath();
      g.fill();
      g.globalAlpha = 0.4;
      g.fillStyle = pal.coat2;
      g.fillRect(64, 306, 262, 20);
      g.globalAlpha = 1;

      g.restore();
    }
    g.restore();
  };

  root.PAPER_FIG = P;
})(typeof window !== 'undefined' ? window : null);
