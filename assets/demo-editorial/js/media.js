(function () {
  'use strict';

  const C = window.FILM_CONFIG || {};
  const map = {};

  function toList(v) {
    if (!v) return [];
    return (Array.isArray(v) ? v : [v]).map(function (item) {
      return typeof item === 'string' ? { src: item } : item;
    }).filter(function (item) {
      return item && item.src;
    });
  }

  [window.FILM_MEDIA || {}, C.mediaFrames || {}].forEach(function (source) {
    Object.keys(source).forEach(function (key) {
      const list = toList(source[key]);
      if (list.length) map[key] = list;
    });
  });

  window.FILM_MEDIA = map;

  const jobs = [];
  Object.keys(map).forEach(function (key) {
    map[key].forEach(function (item) {
      const img = new Image();
      img.decoding = 'async';
      img.src = item.src;
      jobs.push(img.decode ? img.decode().catch(function () {}) : new Promise(function (resolve) {
        img.onload = img.onerror = resolve;
      }));
    });
  });

  window.__mediaReady = Promise.all(jobs).then(function () {
    return Object.keys(map).length > 0;
  });
})();
