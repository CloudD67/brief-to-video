/* 通用镜头渲染器：所有镜头共用一套运镜、画布、字幕牌与「每一帧都在动」的底线。
   镜头之间的差别只来自 sets 的画与 film.js 的参数。 */
(function (root) {
  'use strict';
  const K = root.PIXEL_KIT;
  const S = root.PIXEL_SETS;
  const A = root.PIXEL_ACTORS;
  const C = root.FILM_CONFIG;

  function camFor(shot, local, slot, set) {
    const W = set.w, H = set.h;
    const who = shot.who;
    const p = K.clamp(local / Math.max(0.001, slot), 0, 1);
    const e = K.smooth(p);
    const seed = (parseInt(String(shot.id).slice(1), 10) || 1) * 1.7;
    let z0 = 1.04, z1 = 1.04;
    let pan0 = 0, pan1 = 0;
    let dy0 = 0, dy1 = 0;
    const m = shot.m || 'hold';
    if (m === 'in') { z0 = 1.0; z1 = 1.16; }
    else if (m === 'out') { z0 = 1.16; z1 = 1.0; }
    else if (m === 'pan-r') { pan0 = -85; pan1 = 85; z0 = z1 = 1.05; }
    else if (m === 'pan-l') { pan0 = 85; pan1 = -85; z0 = z1 = 1.05; }
    else if (m === 'push-r') { pan0 = -55; pan1 = 70; z0 = 1.0; z1 = 1.12; }
    else if (m === 'tilt-u') { dy0 = 34; dy1 = -26; z0 = 1.02; z1 = 1.12; }
    else if (m === 'track') { z0 = z1 = 1.12; }
    else { pan0 = -12; pan1 = 12; }

    /* 特写：整段推近，上限 2.6 倍，像素仍落在整格上 */
    const zm = shot.zoom || 1;
    if (zm !== 1) {
      z0 = Math.min(2.6, z0 * zm);
      z1 = Math.min(2.6, z1 * zm);
    }

    /* cx/cy 可把机位钉在两人之间或某个物件上；没有 who 时跟 duo，最后才回中心 */
    const focal = who || shot.duo || null;
    const anchorX = shot.cx != null ? shot.cx : (focal ? focal.x : (shot.x != null ? shot.x : W * 0.5));
    const anchorY = shot.cy != null ? shot.cy : (focal ? focal.y - 72 : (shot.y != null ? shot.y : 0));
    const z = K.lerp(z0, z1, e);
    const w = 480 / z;
    const h = 270 / z;
    let camX = anchorX + K.lerp(pan0, pan1, e) - w * 0.52;
    let camY = anchorY - h * 0.5 + K.lerp(dy0, dy1, e);
    camX = K.clamp(camX, 0, Math.max(0, W - w));
    camY = K.clamp(camY, 0, Math.max(0, H - h));

    /* 手持微动 + 单向漂移：任何一帧都不会与上一帧完全相同 */
    camX += Math.sin(local * 0.83 + seed) * 2.0 + Math.sin(local * 2.17 + seed * 1.7) * 0.7 + local * 1.6;
    camY += Math.cos(local * 0.71 + seed) * 1.5 + Math.sin(local * 1.93 + seed * 0.6) * 0.55;
    camX = K.clamp(camX, 0, Math.max(0, W - w));
    camY = K.clamp(camY, 0, Math.max(0, H - h));
    return { x: camX, y: camY, w: w, h: h, z: z };
  }

  function livingMotes(g, t, seed) {
    for (let i = 0; i < 6; i++) {
      const sp = 5 + K.rnd(seed + i * 2.3) * 9;
      const x = (K.rnd(seed + i * 4.7) * 480 + Math.sin(t * 0.9 + i * 1.6) * 8 + 480) % 480;
      const y = 270 - ((K.rnd(seed + i * 6.1) * 270 + t * sp) % 270);
      const a = 0.10 + 0.14 * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.1));
      g.save();
      g.globalAlpha = a;
      K.rect(g, x, y, 1, 1, i % 3 === 0 ? '#f2c05e' : '#cfe0ff');
      g.restore();
    }
  }

  function titleCard(g, local) {
    const a = Math.min(K.smooth((local - 0.20) / 0.55), 1 - K.smooth((local - 1.50) / 0.40));
    if (a <= 0.01) return;
    g.save();
    g.globalAlpha = a * 0.55;
    K.rect(g, 0, 96, 480, 86, '#05070f');
    g.globalAlpha = a;
    K.rect(g, 214, 92, 52, 2, '#d8503c');
    K.text(g, C.title, 240, 104, { size: 34, color: '#f4e7c8', outline: '#05070f', align: 'center', track: 6 });
    const kicker = C.kicker || 'A PIXEL STORY';
    K.bit(g, kicker, 240 - K.bitWidth(kicker, 1) / 2, 152, '#93a4c6', 1);
    g.restore();
  }

  function endCard(g, local, slot) {
    const a = K.smooth((local - 0.55) / 0.7);
    if (a <= 0.001) return;
    K.QA.endCard = a > 0.5 ? 1 : 0;
    g.save();
    g.globalAlpha = a * 0.72;
    K.rect(g, 0, 0, 480, 270, '#05070f');
    g.restore();
    g.save();
    g.globalAlpha = a;
    K.rect(g, 208, 82, 64, 2, '#d8503c');
    K.text(g, C.title, 240, 94, { size: 32, color: '#f4e7c8', outline: '#05070f', align: 'center', track: 6 });
    K.text(g, C.slogan, 240, 142, { size: 14, color: '#f2c05e', outline: '#05070f', align: 'center', track: 2 });
    if (C.endTag) K.bit(g, C.endTag, 240 - K.bitWidth(C.endTag, 1) / 2, 168, '#93a4c6', 1);
    g.restore();
  }

  function plate(g, shot, local) {
    const cue = K.cueAt({ start: shot.start }, local);
    K.plate(g, cue.text, cue.alpha);
    return cue;
  }

  /* 第二个人与随身行李：画在场景动态层之后，门外/前景的人永远压在最上面 */
  function figure(g, f, t) {
    if (!f) return;
    if (f.k === 'girl') A.girl(g, f.x, f.y, t, f);
    else if (f.k === 'boy') A.boy(g, f.x, f.y, t, f);
    if (f.umbrella) A.umbrella(g, f.x + 2, f.y - 26, t, f.umb || '#2a3450');
    if (f.case) A.suitcase(g, f.case.x, f.case.y, t, f.case);
  }

  function drawExtras(g, shot, local) {
    figure(g, shot.duo, local);
    if (shot.case) A.suitcase(g, shot.case.x, shot.case.y, local, shot.case);
  }

  const SHOT = {
    camFor: camFor,
    render: function (g, shot, local, slot) {
      const set = S[shot.s];
      if (!set) return;
      const world = set.world(shot.v || 0, shot);
      const vp = S.variant ? S.variant.params(shot) : null;
      const cam = camFor(shot, local, slot, set);

      /* 第一段：世界 + 动态层按 1:1 画进合成画布，像素永远落在整格上 */
      const fr = K.scratch(set.w, set.h);
      const fg = fr.getContext('2d');
      fg.setTransform(1, 0, 0, 1, 0, 0);
      fg.globalAlpha = 1;
      fg.imageSmoothingEnabled = false;
      fg.clearRect(0, 0, set.w, set.h);
      fg.drawImage(world, 0, 0);
      if (set.live) set.live(fg, local, shot, cam);
      drawExtras(fg, shot, local);

      /* 第二段：把镜头窗口最近邻缩放铺满 480×270，硬边不抖 */
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, 480, 270);
      g.imageSmoothingEnabled = false;
      if (vp && vp.flip) {
        g.save();
        g.translate(480, 0);
        g.scale(-1, 1);
        g.drawImage(fr, cam.x, cam.y, cam.w, cam.h, 0, 0, 480, 270);
        g.restore();
      } else {
        g.drawImage(fr, cam.x, cam.y, cam.w, cam.h, 0, 0, 480, 270);
      }

      K.vignette(g, 0.62);
      livingMotes(g, local, (parseInt(String(shot.id).slice(1), 10) || 1) * 3.1);
      if (root.PIXEL_GRADE) {
        root.PIXEL_GRADE.apply(g, shot);
        if (S.variant) S.variant.live(g, shot, local, cam);
        root.PIXEL_GRADE.fg(g, shot, local, cam);
      }
      if (shot.card) titleCard(g, local);
      if (shot.end) endCard(g, local, slot);
      plate(g, shot, local);

      if (root.PIXEL_QA) root.PIXEL_QA.scene = shot.id;
    }
  };

  root.PIXEL_SHOT = SHOT;
})(typeof window !== 'undefined' ? window : null);
