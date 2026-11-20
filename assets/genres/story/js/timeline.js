/* 故事时间线：一个 Three.js 舞台 + 绝对秒数分镜 + DOM 字幕/手机/片名。
   渲染时 render.js 调 window.pauseAt(t)，所有状态只由 t 决定。 */
(function () {
  'use strict';

  const C = window.FILM_CONFIG;
  const SCRIPT = window.FILM_SCRIPT;
  const SHOTS = window.FILM_SHOTS;
  const T = window.THREE;
  const K = window.THREEKIT;
  const W = C.width;
  const H = C.height;

  const stage = K.createStage({
    width: W,
    height: H,
    fov: 45,
    near: 0.05,
    far: 90,
    exposure: C.render.exposure,
    background: 0x05070c,
    fogDensity: C.render.fogDensity,
    shadows: true
  });
  stage.post.bloom = C.render.bloom;
  stage.post.threshold = C.render.threshold;
  stage.post.grain = C.render.grain;
  stage.post.vignette = C.render.vignette;
  stage.post.contrast = C.render.contrast;
  stage.post.saturation = C.render.saturation;

  const set = window.THREE_SETS.buildNeonAlley(stage, {
    stall: true, characters: true, rain: true, fog: C.render.fogDensity
  });
  set.phone.visible = false;

  const canvas = stage.canvas;
  canvas.id = 'gl';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  document.getElementById('stage').prepend(canvas);

  const subsEl = document.getElementById('subs');
  const cardEl = document.getElementById('titlecard');
  const phoneEl = document.getElementById('phone');
  const hudEl = document.getElementById('hud');

  /* ---------- helpers ---------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const ease = (v) => { v = clamp(v, 0, 1); return 1 - Math.pow(1 - v, 3); };

  const camPos = new T.Vector3();
  const camLook = new T.Vector3();
  const tmp = new T.Vector3();

  function activeShot(t) {
    for (let i = 0; i < SHOTS.length; i++) {
      if (t >= SHOTS[i].start && t < SHOTS[i].end) return SHOTS[i];
    }
    return t >= SHOTS[SHOTS.length - 1].end ? SHOTS[SHOTS.length - 1] : SHOTS[0];
  }

  /* ---------- subtitles ---------- */
  const subNodes = SCRIPT.lines.filter((line) => !line.screen).map((line) => {
    const cast = SCRIPT.cast[line.who] || SCRIPT.cast.narrator;
    const el = document.createElement('li');
    el.className = 'sub sub-' + line.who;
    const who = document.createElement('b');
    who.textContent = cast.name;
    if (!cast.name) who.style.display = 'none';
    const p = document.createElement('span');
    p.textContent = line.text;
    el.appendChild(who);
    el.appendChild(p);
    subsEl.appendChild(el);
    return { line, el };
  });

  function renderSubs(t) {
    subNodes.forEach(({ line, el }) => {
      const a = line.at;
      const b = line.at + line.dur;
      let o = 0;
      if (t >= a - 0.06 && t <= b + 0.06) {
        o = Math.min(smooth((t - a + 0.06) / 0.16), smooth((b + 0.06 - t) / 0.2));
      }
      el.style.opacity = o.toFixed(3);
      el.style.transform = 'translateY(' + ((1 - o) * 10).toFixed(2) + 'px)';
    });
  }

  /* ---------- phone ---------- */
  const P = SCRIPT.phone;
  function phoneHTML() {
    return (
      '<div class="phone-shell">' +
        '<div class="phone-top"><i class="phone-time">' + P.time + '</i>' +
          '<span class="phone-sig"></span></div>' +
        '<div class="phone-head"><b>' + P.contact + '</b><em>在线</em></div>' +
        '<div class="phone-body">' +
          '<div class="msg in">' + P.incoming + '</div>' +
          '<div class="msg out">' + P.sent + '<i>' + P.status + '</i></div>' +
          '<div class="msg typing"><s></s><s></s><s></s><em>' + P.typing + '</em></div>' +
        '</div>' +
        '<div class="phone-home"></div>' +
      '</div>'
    );
  }
  phoneEl.innerHTML = phoneHTML();

  function renderPhone(t, shot) {
    const on = !!(shot && shot.phone);
    if (!on) {
      phoneEl.style.opacity = '0';
      phoneEl.style.transform = 'translateY(16px) scale(0.98)';
      return;
    }
    const k = smooth((t - shot.start) / 0.22) * smooth((shot.end - t) / 0.22);
    phoneEl.style.opacity = k.toFixed(3);
    phoneEl.style.transform = 'translateY(' + ((1 - k) * 24).toFixed(1) + 'px) scale(' + (0.96 + k * 0.04).toFixed(3) + ')';
    const inEl = phoneEl.querySelector('.msg.in');
    const outEl = phoneEl.querySelector('.msg.out');
    const typing = phoneEl.querySelector('.msg.typing');
    if (shot.id === 's03') {
      inEl.style.opacity = smooth((t - shot.start - 0.35) / 0.3).toFixed(3);
      outEl.style.opacity = smooth((t - shot.start - 1.5) / 0.3).toFixed(3);
      typing.style.opacity = '0';
    } else {
      inEl.style.opacity = '1';
      outEl.style.opacity = '1';
      const showTyping = t > shot.start + 1.1 && t < shot.start + 2.2;
      typing.style.opacity = showTyping ? '1' : '0';
    }
    const dots = typing.querySelectorAll('s');
    dots.forEach((d, i) => {
      d.style.opacity = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 6 - i * 0.8))).toFixed(2);
    });
  }

  /* ---------- title card / hud ---------- */
  const TITLE = SCRIPT.titleCard;
  cardEl.innerHTML =
    '<div class="card-inner">' +
      '<span class="card-kicker">' + SCRIPT.episode + '</span>' +
      '<h1>' + TITLE.title + '</h1>' +
      '<span class="card-en">' + TITLE.en + '</span>' +
      '<span class="card-hook">' + TITLE.hook + '</span>' +
    '</div>';

  function renderCard(t) {
    const a = TITLE.at;
    const k = smooth((t - a) / 0.5) * smooth((TITLE.to - t) / 0.35);
    cardEl.style.opacity = k.toFixed(3);
    cardEl.style.pointerEvents = 'none';
    const inner = cardEl.firstChild;
    inner.style.transform = 'translateY(' + ((1 - k) * 18).toFixed(1) + 'px)';
  }

  function renderHud(t) {
    const o = t < 3.2 ? smooth(t / 0.6) : t < 36.4 ? 0.55 : 0;
    hudEl.style.opacity = o.toFixed(2);
  }

  /* ---------- camera ---------- */
  function applyCamera(t, shot) {
    const anchor = set.anchors[shot.anchor] || set.anchors.wide;
    const pos = shot.pos || anchor.pos;
    const look = shot.look || anchor.look;
    const local = clamp(t - shot.start, 0, shot.end - shot.start);
    const u = ease(local / Math.max(0.001, shot.end - shot.start));

    camLook.set(look[0], look[1], look[2]);
    camPos.set(pos[0], pos[1], pos[2]);
    tmp.copy(camLook).sub(camPos).normalize();
    const push = (shot.push || 0) * u;
    camPos.addScaledVector(tmp, push);

    const drift = shot.drift || [0, 0];
    camPos.x += drift[0] * u;
    camPos.y += drift[1] * u;

    /* 手持微动：低频正弦，确定性 */
    const amp = shot.handheld == null ? 0.006 : shot.handheld;
    camPos.x += Math.sin(t * 0.83 + 1.7) * amp + Math.sin(t * 2.1) * amp * 0.35;
    camPos.y += Math.sin(t * 1.07 + 0.4) * amp * 0.7;

    stage.camera.position.copy(camPos);
    stage.camera.lookAt(camLook);
    const fov = shot.fov || anchor.fov || 40;
    if (Math.abs(stage.camera.fov - fov) > 0.001) {
      stage.camera.fov = fov;
      stage.camera.updateProjectionMatrix();
    }

    const dist = camPos.distanceTo(camLook);
    stage.post.focus = shot.focus == null ? dist : shot.focus;
    stage.post.aperture = shot.aperture == null ? 1.2 : shot.aperture;
    stage.post.maxBlur = 11;
  }

  /* ---------- characters ---------- */
  const man = set.characters.man;
  const her = set.characters.her;
  const owner = set.characters.owner;
  function applyCast(t, shot) {
    const cast = shot.cast || {};
    her.visible = cast.her !== false;
    owner.visible = cast.owner !== false;
    const visible = t >= 29.4;
    man.visible = visible;
    if (visible) {
      /* 从左侧巷道深处走来，再横移到她身边；只依赖 t。 */
      const walk = smooth((t - 30.2) / 3.8);
      const step = smooth((t - 33.6) / 1.6);
      const moving = walk < 1 || step < 1 ? 1 : 0;
      man.position.x = -2.45 + 3.4 * step + Math.sin(t * 1.7) * 0.015;
      man.position.z = -11.4 + 9.55 * walk;
      man.position.y = 0.89 + Math.abs(Math.sin(t * 8.4)) * 0.012 * moving;
      man.material.opacity = smooth((t - 29.4) / 0.7);
    }
  }

  /* ---------- frame ---------- */
  let lastShotId = null;

  function frame(t) {
    t = clamp(t, 0, C.duration);
    const shot = activeShot(t);
    if (lastShotId !== shot.id) lastShotId = shot.id;
    applyCamera(t, shot);
    applyCast(t, shot);
    set.update(t);

    const fadeIn = smooth(t / 0.45);
    const fadeOut = smooth((C.duration - t) / 0.45);
    stage.post.fade = Math.min(fadeIn, fadeOut);

    stage.renderAt(t, { motion: 1 / 60, samples: 3 });
    renderSubs(t);
    renderPhone(t, shot);
    renderCard(t);
    renderHud(t);
  }

  window.pauseAt = function (t) {
    frame(Number(t) || 0);
    return true;
  };

  window.FILM_META = {
    shots: SHOTS.length,
    duration: C.duration,
    fps: C.fps,
    width: W,
    height: H,
    genre: C.genre
  };

  function finish() {
    window.__READY = true;
    window.ready = true;
  }

  /* 先渲一帧把编译/上传做完，再宣告 ready */
  frame(0);
  requestAnimationFrame(function () {
    frame(0);
    setTimeout(finish, 120);
  });
})();
