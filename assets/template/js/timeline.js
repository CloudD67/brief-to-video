(function () {
  'use strict';

  const C = window.FILM_CONFIG;
  const SCRIPT = window.FILM_SCRIPT || { subtitles: [] };
  const DURATION = C.duration;
  const FPS = C.fps;
  const MOTION = window.FILM_MOTION || { camera: 1, flash: 1 };
  const CAM = MOTION.camera != null ? MOTION.camera : 1;
  const FLASH = MOTION.flash != null ? MOTION.flash : 1;

  /* 场景与字幕按 60s 基准编写；改 duration 后整片等比伸缩 */
  const SCALE = DURATION / 60;
  /* 硬切；切点由纸色闪白遮断，不做长溶解 */
  const FLASH_IN = 0.02;
  const FLASH_OUT = 0.10;
  const FLASH_PEAK = 0.93;

  const renderMode = /[?&]render=1(&|$)/.test(location.search);
  document.documentElement.dataset.render = renderMode ? '1' : '0';

  const stage = document.getElementById('stage');
  const host = document.getElementById('scenes');
  const subsRoot = document.getElementById('subs');
  const fade = document.getElementById('fade');
  const flash = document.getElementById('flash');
  const disc = document.getElementById('disclaimer');
  const discText = disc.querySelector('span');
  if (discText) discText.textContent = C.disclaimer;
  const progFill = document.getElementById('progress-fill');

  const scenes = (window.FILM_SCENES || []).slice().sort(function (a, b) { return a.start - b.start; });

  scenes.forEach(function (s, i) {
    s.aStart = s.start * SCALE;
    s.aEnd = i === scenes.length - 1 ? DURATION : s.end * SCALE;
    s.aSlot = Math.max(0.001, s.aEnd - s.aStart);

    const el = document.createElement('section');
    el.className = 'scene';
    el.id = s.id;
    el.dataset.index = String(i + 1).padStart(2, '0');
    el.dataset.total = String(scenes.length).padStart(2, '0');
    el.style.zIndex = String(10 + i);
    el.style.opacity = '0';
    host.appendChild(el);
    s.el = el;
    window.__KIT_SCENE = s.id;
    try {
      s.mount(el);
    } catch (err) {
      console.error('scene mount failed:', s.id, err);
    }
    window.__KIT_SCENE = null;
  });

  /* 字幕两种写法：
     A. 场景内定位 { scene:'s1', at:0.4, dur:3.2, text:'…' } —— 推荐，改场景长度不用重算
     B. 全片绝对时间 { start:30.0, end:33.2, text:'…' }（60s 基准，自动随片长缩放） */
  function resolveCues(list) {
    const byId = {};
    scenes.forEach(function (s) { byId[s.id] = s; });
    const out = [];
    (Array.isArray(list) ? list : []).forEach(function (c, i) {
      if (c && typeof c.scene === 'string') {
        const s = byId[c.scene];
        if (!s) { console.warn('字幕 #' + i + ' 指向不存在的场景：' + c.scene); return; }
        const at = Number(c.at) || 0;
        const dur = c.dur != null ? Number(c.dur) : (c.end != null ? Number(c.end) - at : NaN);
        if (!(dur > 0)) { console.warn('字幕 #' + i + ' 缺少有效 dur：' + c.text); return; }
        const aStart = s.start + at;
        const aEnd = Math.min(s.start + at + dur, s.end);
        if (aEnd <= aStart) { console.warn('字幕 #' + i + ' 落在场景之外：' + c.text); return; }
        if (s.start + at + dur > s.end + 1e-6) {
          console.warn('字幕 #' + i + ' 越过场景 ' + c.scene + ' 的切点，已截断：' + c.text);
        }
        out.push({
          start: aStart * SCALE, end: aEnd * SCALE,
          authoredStart: aStart, authoredEnd: aEnd,
          scene: c.scene, text: c.text
        });
      } else if (c && Number.isFinite(Number(c.start)) && Number.isFinite(Number(c.end))) {
        out.push({
          start: Number(c.start) * SCALE, end: Number(c.end) * SCALE,
          authoredStart: Number(c.start), authoredEnd: Number(c.end),
          scene: sceneAt(Number(c.start)), text: c.text
        });
      } else {
        console.warn('字幕 #' + i + ' 格式无效（需要 scene+at+dur 或 start+end）');
      }
    });
    return out.sort(function (a, b) { return a.start - b.start; });
  }

  function sceneAt(authoredT) {
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      if (authoredT >= s.start && authoredT < s.end) return s.id;
    }
    return null;
  }

  const CUES = resolveCues(SCRIPT.subtitles);
  window.FILM_CUES = CUES;

  const seekSubs = window.initSubtitles(subsRoot, CUES, 1);
  const seekChrome = window.initPaperChrome ? window.initPaperChrome() : function () {};

  let current = 0;
  let playing = false;
  let rafId = 0;
  let t0 = 0;

  function seekTo(t) {
    t = U.clamp(t, 0, DURATION);
    current = t;

    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const active = i === scenes.length - 1 ? t >= s.aStart : (t >= s.aStart && t < s.aEnd);

      if (!active) {
        if (s.el.style.display !== 'none') s.el.style.display = 'none';
        continue;
      }
      s.el.style.display = 'block';
      s.el.style.opacity = '1';

      const local = (t - s.aStart) / SCALE;
      const slot = s.aSlot / SCALE;
      const p = U.clamp(local / slot, 0, 1);
      const dir = i % 2 ? -1 : 1;
      s.el.style.transform =
        'translate3d(' + (dir * (0.5 - p) * 16 * CAM).toFixed(2) + 'px,' +
        ((0.5 - p) * 8 * dir * CAM).toFixed(2) + 'px,0) scale(' + (1.006 + 0.010 * p * CAM).toFixed(4) + ')';
      s.el.style.setProperty('--scene-p', p.toFixed(4));

      const imgs = s.el.querySelectorAll('.frame.media img');
      for (let k = 0; k < imgs.length; k++) {
        const seq = imgs[k]._seq;
        if (!seq || seq.length < 2) continue;
        const idx = Math.min(seq.length - 1, Math.floor(p * seq.length));
        if (imgs[k].getAttribute('src') !== seq[idx]) imgs[k].src = seq[idx];
      }

      try { s.seek(U.clamp(local, 0, slot), slot); } catch (e) { console.error('scene seek failed:', s.id, e); }
    }

    seekSubs(t);
    seekChrome(t);

    let flashP = 0;
    for (let i = 1; i < scenes.length; i++) {
      const d = Math.abs(t - scenes[i].aStart);
      if (d >= FLASH_OUT) continue;
      flashP = Math.max(flashP, d <= FLASH_IN ? 1 : Math.cos(((d - FLASH_IN) / (FLASH_OUT - FLASH_IN)) * Math.PI / 2));
    }
    flash.style.opacity = (Math.min(1, flashP * FLASH_PEAK * FLASH)).toFixed(3);

    const discP = Math.min(U.inv(1.0, 1.6, t), 1 - U.inv(DURATION - 1.4, DURATION - 0.9, t));
    disc.style.opacity = String(discP * 0.85);

    progFill.style.width = ((t / DURATION) * 100).toFixed(3) + '%';
    progFill.parentNode.style.opacity = String(0.9 * U.inv(0.2, 0.8, t));

    const intro = 1 - U.inv(0, 0.28, t);
    const outro = U.inv(DURATION - 0.75, DURATION, t);
    fade.style.opacity = String(Math.max(intro * 0.96, outro));
  }

  function loop() {
    if (!playing) return;
    const t = (performance.now() - t0) / 1000;
    if (t >= DURATION) {
      seekTo(DURATION);
      playing = false;
      return;
    }
    seekTo(t);
    rafId = requestAnimationFrame(loop);
  }

  function play() {
    if (playing) return;
    playing = true;
    const startT = current >= DURATION - 1e-3 ? 0 : current;
    t0 = performance.now() - startT * 1000;
    rafId = requestAnimationFrame(loop);
  }

  function pause() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function seekToPaused(t) {
    pause();
    seekTo(t);
  }

  function fit() {
    if (renderMode) {
      stage.style.transform = 'translate(-50%,-50%) scale(1)';
      return;
    }
    const s = Math.min(window.innerWidth / C.width, window.innerHeight / C.height);
    stage.style.transform = 'translate(-50%,-50%) scale(' + s.toFixed(5) + ')';
  }

  fit();
  window.addEventListener('resize', fit);

  if (!renderMode) {
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space') {
        e.preventDefault();
        if (playing) pause(); else play();
      } else if (e.code === 'ArrowRight') {
        seekToPaused(Math.min(DURATION, current + 1));
      } else if (e.code === 'ArrowLeft') {
        seekToPaused(Math.max(0, current - 1));
      } else if (e.code === 'Home') {
        seekToPaused(0);
      }
    });
  }

  seekTo(0);

  window.seekTo = seekTo;
  window.pauseAt = seekToPaused;
  window.play = play;
  window.pause = pause;
  window.getTimeline = function () {
    return {
      duration: DURATION,
      fps: FPS,
      scale: SCALE,
      crossfade: 0,
      style: window.FILM_STYLE || (C.style || 'letterpress'),
      layout: window.FILM_LAYOUT || (C.layout || 'editorial'),
      look: window.FILM_LOOK || (C.look || 'auto'),
      motion: MOTION.id || 'calm',
      scenes: scenes.map(function (s) {
        return { id: s.id, start: s.aStart, end: s.aEnd, authoredStart: s.start, authoredEnd: s.end };
      }),
      cues: CUES.map(function (c) {
        return { scene: c.scene, start: c.start, end: c.end, text: c.text };
      })
    };
  };

  window.__READY = false;
  window.ready = Promise.all([
    document.fonts.ready,
    window.__fontReady || Promise.resolve(false),
    window.__mediaReady || Promise.resolve(false)
  ]).then(function () {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () { requestAnimationFrame(resolve); });
    });
  }).then(function () {
    window.__READY = true;
  });

  if (!renderMode) {
    console.log(C.title + ' · ' + DURATION + 's 预览\n空格播放/暂停，←/→ 逐秒，Home 回到开头');
  }
})();
