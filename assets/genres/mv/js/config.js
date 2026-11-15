/* 全片单一配置源：浏览器和 Node（render/encode/synth）共用。
   MV 只有叙事层：没有 look / 主题 / 版式 / 引擎，这三项必须保持 none。
   分辨率在建工程前就必须问用户：1080p 直接渲，4K 用 render.js --scale 2。 */
(function (root) {
  'use strict';

  const CONFIG = {
    title: "把灯留着",
    brand: "NIGHT TOWN",
    brandSub: "城市夜行 / NIGHT TOWN",
    slogan: "灯亮着，就有人回来",

    /* 像素字标签：片头小标 / 片尾英文行，必须是 ASCII，可留空 */
    kicker: "A PIXEL STORY",
    endTag: "NIGHT TOWN · PIXEL STORY",
    disclaimer: "像素叙事 · 全片代码绘制",

    width: 1920,
    height: 1080,
    duration: 60,
    fps: 60,

    /* 建工程时由 new-film.js 写入：1 = 1080p，2 = 4K；render.js 的 --scale 可临时覆盖 */
    renderScale: 1,

    /* 分镜按成片绝对秒数编写（base 与 duration 相等时不做任何缩放） */
    base: 60,

    /* pixel-story = 像素叙事 MV：角色 / 场景 / 镜头 / 字幕牌 */
    genre: "pixel-story",

    /* 宣传片层在 MV 里不存在；写死 none，避免两套语法混在一起 */
    look: "none",
    style: "none",
    layout: "none",
    brief: "城市夜行，像素叙事，双主角，她走他留",

    mediaFrames: {},
    tcFps: 60,
    posterAt: 58.5,

    fontFamily: "BrandSans"
  };

  if (root && root.document) {
    const d = root.document.documentElement;
    d.style.setProperty('--stage-w', CONFIG.width + 'px');
    d.style.setProperty('--stage-h', CONFIG.height + 'px');
  }
  if (root) root.FILM_CONFIG = CONFIG;
  if (typeof module === 'object' && module.exports) module.exports = CONFIG;
})(typeof window !== 'undefined' ? window : null);
