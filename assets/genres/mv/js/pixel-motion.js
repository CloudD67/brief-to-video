/* 像素叙事语法不使用编辑排版的宿主运镜；在 style.js 之后覆盖动效参数。 */
(function () {
  'use strict';
  const C = window.FILM_CONFIG || {};
  if (C.genre !== 'pixel-story') return;
  document.documentElement.dataset.genre = 'pixel-story';
  document.documentElement.dataset.motion = 'pixel';
  window.FILM_GENRE = 'pixel-story';
  window.FILM_MOTION = { id: 'pixel', name: '像素叙事', camera: 0, flash: 0 };
})();
