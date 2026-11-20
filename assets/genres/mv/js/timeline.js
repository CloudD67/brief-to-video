/* 时间轴：一条 1920×1080 原生画布，按镜头硬切。
   没有溶解、没有推拉摇移；每次 seek 只画当前这一镜，
   所有动画都是 local 的函数，同一时刻多次渲染逐像素一致。 */
(function () {
  'use strict';

  const C = window.FILM_CONFIG;
  const F = window.FILM_FILM;
  const SCRIPT = window.FILM_SCRIPT || { subtitles: [] };
  const K = window.PAPER_KIT;
  const DURATION = C.duration;
  const BASE = C.base || 60;
  const SCALE = DURATION / BASE;
  window.FILM_SCALE = SCALE;

  const renderMode = /[?&]render=1(&|$)/.test(location.search);
  document.documentElement.dataset.render = renderMode ? '1' : '0';

  const stage = document.getElementById('stage');
  const host = document.getElementById('scenes');
  const subsRoot = document.getElementById('subs');
  const fade = document.getElementById('fade');

  const scenes = F.shots.map(function (shot) {
    const start = shot.start * SCALE;
    const dur = shot.dur * SCALE;
    return {
      id: shot.id,
      start: start,
      end: start + dur,
      dur: dur,
      shot: shot
    };
  });

  let section = null;
  let canvas = null;
  let ctx = null;

  function ensureCanvas() {
    if (canvas) return;
    section = document.createElement('section');
    section.className = 'scene';
    section.style.display = 'block';
    host.appendChild(section);
    canvas = K.stage(section);
    ctx = K.ctx(canvas);
  }

  /* 歌词：绝对秒数；画布里按分镜基准的时间查表，所以句子可以跨切点 */
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
    ensureCanvas();

    const idx = sceneIndexAt(t);
    const s = scenes[idx];
    window.PAPER_SHOT.render(ctx, s.shot, Math.max(0, t - s.start), s.dur);

    seekSubs(t);

    const intro = 1 - U.inv(0, 0.5, t);
    const outro = U.inv(DURATION - 0.9, DURATION, t);
    fade.style.opacity = String(Math.max(intro * 0.96, outro));

    document.documentElement.dataset.shot = s.id;
    window.__SHOT_INDEX = idx;
    window.__T = t;

    if (!renderMode) {
      const p = document.getElementById('progress-fill');
      if (p) p.style.width = ((t / DURATION) * 100).toFixed(3) + '%';
    }
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
      genre: C.genre,
      canvas: {
        width: C.width,
        height: C.height,
        backingW: C.width * K.R,
        backingH: C.height * K.R,
        scale: K.R
      },
      shots: scenes.length,
      scenes: scenes.map(function (s) {
        const sh = s.shot;
        return {
          id: s.id, start: s.start, end: s.end, dur: s.dur,
          authoredStart: sh.start, authoredEnd: sh.start + sh.dur,
          set: sh.s, mood: sh.mood, frame: sh.frame,
          hero: !!(sh.who || sh.hands || sh.hero)
        };
      }),
      cues: CUES.map(function (c) {
        return {
          start: c.start, end: c.end,
          authoredStart: c.authoredStart, authoredEnd: c.authoredEnd,
          text: c.text
        };
      })
    };
  };

  window.__READY = false;
  window.ready = Promise.all([
    document.fonts.ready,
    window.__fontReady || Promise.resolve(false),
    window.__mediaReady || Promise.resolve(false)
  ]).then(function () {
    /* 后台标签页不派发 rAF，定时器兜底保证并行渲染能启动。 */
    return new Promise(function (resolve) {
      let done = false;
      const finish = function () {
        if (done) return;
        done = true;
        resolve();
      };
      requestAnimationFrame(function () {
        requestAnimationFrame(finish);
      });
      setTimeout(finish, 250);
    });
  }).then(function () {
    window.__READY = true;
  });

  if (!renderMode) {
    console.log(C.title + ' · ' + DURATION + 's · ' + scenes.length + ' 镜\n空格播放/暂停，←/→ 逐秒，Home 回到开头');
  }
})();
