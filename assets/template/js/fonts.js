(function () {
  'use strict';

  const c = window.FILM_CONFIG;

  window.__fontReady = Promise.resolve(false);

  if (!c || !c.fontUrl) return;

  const url = c.fontUrl;

  window.__fontReady = fetch(url, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('font missing');
      return res.arrayBuffer();
    })
    .then(function (buf) {
      const face = new FontFace(c.fontFamily, buf);
      return face.load();
    })
    .then(function (loaded) {
      document.fonts.add(loaded);
      document.documentElement.style.setProperty(
        '--font-sans',
        '"' + c.fontFamily + '", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif'
      );
      return true;
    })
    .catch(function () { return false; });
})();
