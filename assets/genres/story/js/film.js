/* 分镜表：《雨停之前》40s / 15 镜 / 24fps / 16:9 横屏。
   镜头用成片绝对秒数；anchor 来自 three-sets 的机位表，fov 是 16:9 垂直视角。
   push = 本镜推近的米数，drift = 横向漂移，focus = 对焦距离（米）。 */
(function (root) {
  'use strict';

  const SHOTS = [
    {
      id: "s01", start: 0.0, end: 2.9, anchor: "wide",
      pos: [2.0, 1.95, 4.4], look: [0.35, 1.15, -6.0], fov: 46,
      push: 0.55, drift: [0.04, 0.01], focus: 6.2, aperture: 1.0,
      note: "建立：雨夜巷口，面摊亮着，她撑伞站在摊前"
    },
    {
      id: "s02", start: 2.9, end: 5.2, anchor: "herBack",
      fov: 38, push: 0.3, drift: [0.02, 0], focus: 2.4, aperture: 1.25,
      note: "她的背影与伞，雨沿伞骨往下滴"
    },
    {
      id: "s03", start: 5.2, end: 7.8, anchor: "phone",
      fov: 32, push: 0.15, focus: 1.0, aperture: 1.9, phone: true,
      note: "手机屏幕：他的消息「我到了」"
    },
    {
      id: "s04", start: 7.8, end: 10.4, anchor: "counter",
      push: 0.3, drift: [-0.03, 0], focus: 2.4, aperture: 1.2, cast: { her: false },
      note: "老板在灶前抬头，碗里冒热气"
    },
    {
      id: "s05", start: 10.4, end: 13.0, anchor: "herSide",
      fov: 34, push: 0.2, focus: 1.9, aperture: 1.3,
      note: "她的侧脸藏在伞下，眼睛看向巷口"
    },
    {
      id: "s06", start: 13.0, end: 15.6, anchor: "bowl",
      fov: 38, push: 0.12, focus: 1.7, aperture: 1.5, cast: { her: false, owner: false },
      note: "第二副碗筷被放到对面，汤面还在冒气"
    },
    {
      id: "s07", start: 15.6, end: 18.2, anchor: "overShoulder",
      fov: 38, push: 0.25, focus: 2.6, aperture: 1.15,
      note: "越过她的肩，看向空着的巷口"
    },
    {
      id: "s08", start: 18.2, end: 20.8, anchor: "arrival",
      fov: 32, push: 0.9, drift: [0.02, 0.01], focus: 9, aperture: 0.85, cast: { her: false },
      note: "空巷，雨线被路灯照亮，没有人来"
    },
    {
      id: "s09", start: 20.8, end: 23.4, anchor: "herSide",
      fov: 32, push: 0.15, focus: 1.7, aperture: 1.4,
      note: "她低头看了一眼手机，又抬起来"
    },
    {
      id: "s10", start: 23.4, end: 26.0, anchor: "herBack",
      fov: 36, push: 0.2, focus: 1.4, aperture: 1.7, phone: true,
      note: "手机：对方正在输入…然后停住"
    },
    {
      id: "s11", start: 26.0, end: 28.6, anchor: "wide",
      pos: [1.4, 1.9, 3.6], look: [0.35, 1.15, -5.5], fov: 46,
      push: 0.4, focus: 5.5, aperture: 1.0,
      note: "她一个人坐在摊前，伞收在脚边"
    },
    {
      id: "s12", start: 28.6, end: 31.2, anchor: "arrival",
      fov: 30, push: 0.55, focus: 8.5, aperture: 0.9,
      note: "巷子深处，一个撑伞的身影出现"
    },
    {
      id: "s13", start: 31.2, end: 33.8, anchor: "herBack",
      fov: 34, push: 0.3, focus: 1.8, aperture: 1.5,
      note: "她抬起头，伞沿的水滴停了一瞬"
    },
    {
      id: "s14", start: 33.8, end: 36.4, anchor: "two",
      fov: 36, push: 0.35, focus: 3.2, aperture: 1.1,
      note: "两把伞在摊前并在一起，他站到她身边"
    },
    {
      id: "s15", start: 36.4, end: 40.0, anchor: "end",
      fov: 40, push: 0.5, focus: 4.5, aperture: 1.0,
      note: "她推过那碗面，片名与下集钩子"
    }
  ];

  if (root) root.FILM_SHOTS = SHOTS;
  if (typeof module === 'object' && module.exports) module.exports = SHOTS;
})(typeof window !== 'undefined' ? window : null);
