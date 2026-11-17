(function () {
  'use strict';

  const TC_FPS = (window.FILM_CONFIG && window.FILM_CONFIG.tcFps) || 24;

  window.initSubtitles = function (root, scriptCues, scale) {
    scale = scale || 1;
    const cues = [];

    if (Array.isArray(scriptCues) && scriptCues.length) {
      for (let i = 0; i < scriptCues.length; i++) {
        const c = scriptCues[i];
        const li = document.createElement('li');
        li.dataset.start = String(c.start * scale);
        li.dataset.end = String(c.end * scale);
        const tc = document.createElement('span');
        tc.className = 'tc';
        tc.textContent = fmtTC(c.start * scale) + ' — ' + fmtTC(c.end * scale);
        li.appendChild(tc);
        li.appendChild(document.createTextNode(c.text));
        root.appendChild(li);
        cues.push({ start: c.start * scale, end: c.end * scale, node: li });
      }
    } else {
      const items = Array.prototype.slice.call(root.querySelectorAll('li'));
      for (let i = 0; i < items.length; i++) {
        const li = items[i];
        const start = parseFloat(li.dataset.start);
        const end = parseFloat(li.dataset.end);
        const tc = document.createElement('span');
        tc.className = 'tc';
        tc.textContent = fmtTC(start) + ' — ' + fmtTC(end);
        li.insertBefore(tc, li.firstChild);
        cues.push({ start: start, end: end, node: li });
      }
    }

    let active = -2;

    return function (t) {
      let idx = -1;
      for (let i = 0; i < cues.length; i++) {
        if (t >= cues[i].start && t < cues[i].end) { idx = i; break; }
      }

      if (idx !== active) {
        for (let i = 0; i < cues.length; i++) {
          cues[i].node.classList.toggle('on', i === idx);
          cues[i].node.style.opacity = '';
          cues[i].node.style.transform = '';
        }
        active = idx;
      }

      if (idx < 0) return;

      const c = cues[idx];
      const p = E.outCubic(U.inv(c.start, c.start + 0.26 * scale, t));
      const out = U.inv(c.end - 0.12 * scale, c.end, t);
      c.node.style.opacity = String((0.16 + 0.84 * p) * (1 - out));
      c.node.style.transform = 'translate3d(0,' + ((1 - p) * 9).toFixed(2) + 'px,0)';
    };
  };

  function fmtTC(sec) {
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    const ss = Math.floor(s);
    const ff = Math.min(TC_FPS - 1, Math.round((s - ss) * TC_FPS));
    return pad(m) + ':' + pad(ss) + ':' + pad(ff);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
})();
