/* 剪纸叙事没有宿主运镜；在样式加载前把类型写到 html 上，预览与 QA 共用。 */
(function () {
  'use strict';
  const C = window.FILM_CONFIG || {};
  if (C.genre !== 'paper-story') return;
  document.documentElement.dataset.genre = 'paper-story';
  document.documentElement.dataset.motion = 'paper';
  window.FILM_GENRE = 'paper-story';
  window.FILM_MOTION = { id: 'paper', name: '层叠剪纸', camera: 0, flash: 0 };
})();
