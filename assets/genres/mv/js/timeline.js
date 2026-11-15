/* 时间轴：镜头按分镜的绝对时间排列，段落决定溶解或硬切，镜头按需挂载。
   所有动画只依赖 local 时间，同一时刻多次渲染逐像素一致。 */
(function () {
  'use strict';

  const C = window.FILM_CONFIG;
  const F = window.FILM_FILM;
  const SCRIPT = window.FILM_SCRIPT || { subtitles: [] };
  const DURATION = C.duration;
  const BASE = C.base || 60;
  const SCALE = DURATION / BASE;

  const renderMode = /[?&]render=1(&|$)/.test(location.search);
  document.documentElement.dataset.render = renderMode ? '1' : '0';

  const stage = document.getElementById('stage');
  const host = document.getElementById('scenes');
  const subsRoot = document.getElementById('subs');
  const fade = document.getElementById('fade');

  /* 段落 → 入点转场 */
  const TR = {
    verse: { t: 'dx', d: 0.55 },
    chorus: { t: 'hc', d: 0 },
    bridge: { t: 'dx', d: 0.80 },
    finale: { t: 'dx', d: 0.45 }
  };
  function modeAt(t) {
    let m = 'verse';
    for (let i = 0; i < F.sections.length; i++) {
      if (t >= F.sections[i].at) m = F.sections[i].mode;
    }
    return m;
  }

  const scenes = F.shots.map(function (shot, i) {
    const start = shot.start * SCALE;
    const dur = shot.dur * SCALE;
    const s = {
      id: shot.id,
      start: start,
      end: start + dur,
      dur: dur,
      shot: shot,
      el: null,
      mounted: false,
      tr: shot.tr ? { t: shot.tr, d: shot.trDur != null ? shot.trDur : 0.5 } : (i === 0 ? { t: 'hc', d: 0 } : TR[modeAt(shot.start)]),
      mount: function () {
        if (this.mounted) return;
        const el = document.createElement('section');
        el.className = 'scene';
        el.id = this.id;
        el.dataset.index = String(i + 1).padStart(3, '0');
        el.dataset.total = String(scenes.length).padStart(3, '0');
        el.style.zIndex = String(10 + i);
        el.style.opacity = '0';
        host.appendChild(el);
        this.el = el;
        this.cv = window.PIXEL_KIT.stage(el);
        this.g = this.cv.getContext('2d');
        this.g.imageSmoothingEnabled = false;
        this.mounted = true;
      },
      seek: function (local) {
        window.PIXEL_SHOT.render(this.g, this.shot, Math.max(0, local), this.dur);
      }
    };
    return s;
  });

  /* 字幕牌：绝对时间，按镜头渲染时的当前时间查表 */
  const CUES = (Array.isArray(SCRIPT.subtitles) ? SCRIPT.subtitles : []).map(function (c) {
    return {
      start: Number(c.start) * SCALE,
      end: Number(c.end) * SCALE,
      authoredStart: Number(c.start),
      authoredEnd: Number(c.end),
      text: c.text
    };
  }).sort(function (a, b) { return a.start - b.start; });
  window.FILM_CUES = CUES;

  const seekSubs = window.initSubtitles(subsRoot, CUES, 1);

  let current = 0;
  let playing = false;
  let rafId = 0;
  let t0 = 0;

  function sceneIndexAt(t) {
    let lo = 0, hi = scenes.length - 1, idx = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (scenes[mid].start <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return idx;
  }

  function seekTo(t) {
    t = U.clamp(t, 0, DURATION);
    current = t;

    const idx = sceneIndexAt(t);
    const cur = scenes[idx];
    const prev = idx > 0 ? scenes[idx - 1] : null;
    const tr = cur.tr;
    const inProgress = prev && tr.t === 'dx' && t < cur.start + tr.d;

    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const active = (i === idx) || (inProgress && i === idx - 1);
      if (!active) {
        if (s.el && s.el.style.display !== 'none') s.el.style.display = 'none';
        continue;
      }
      s.mount();
      s.el.style.display = 'block';
      let a = 1;
      if (i === idx && prev && tr.t === 'dx') {
        a = K01((t - cur.start) / tr.d);
      } else if (i === idx - 1) {
        a = 1 - K01((t - cur.start) / tr.d);
      }
      s.el.style.opacity = a.toFixed(4);
      s.seek(t - s.start);
    }

    seekSubs(t);

    const intro = 1 - U.inv(0, 0.45, t);
    const outro = U.inv(DURATION - 1.0, DURATION, t);
    fade.style.opacity = String(Math.max(intro * 0.95, outro));

    if (root_progress()) {
      const p = document.getElementById('progress-fill');
      if (p) p.style.width = ((t / DURATION) * 100).toFixed(3) + '%';
    }
  }

  function K01(x) { return x <= 0 ? 0 : (x >= 1 ? 1 : x * x * (3 - 2 * x)); }
  function root_progress() { return false; }

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
  function pauseAt(t) { pause(); seekTo(t); }

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
      if (e.code === 'Space') { e.preventDefault(); if (playing) pause(); else play(); }
      else if (e.code === 'ArrowRight') pauseAt(Math.min(DURATION, current + 1));
      else if (e.code === 'ArrowLeft') pauseAt(Math.max(0, current - 1));
      else if (e.code === 'Home') pauseAt(0);
    });
  }

  seekTo(0);
  scenes[0].mount();

  window.seekTo = seekTo;
  window.pauseAt = pauseAt;
  window.play = play;
  window.pause = pause;
  window.getTimeline = function () {
    return {
      duration: DURATION,
      fps: C.fps,
      base: BASE,
      scale: SCALE,
      crossfade: 0,
      genre: 'pixel-story',
      shots: scenes.length,
      scenes: scenes.map(function (s) {
        return {
          id: s.id, start: s.start, end: s.end, dur: s.dur,
          authoredStart: s.start / SCALE, authoredEnd: s.end / SCALE,
          tr: s.tr.t, set: s.shot.s
        };
      }),
      cues: CUES.map(function (c) {
        return { start: c.start, end: c.end, text: c.text };
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
    console.log(C.title + ' · ' + DURATION + 's · ' + scenes.length + ' 镜\n空格播放/暂停，←/→ 逐秒，Home 回到开头');
  }
})();
