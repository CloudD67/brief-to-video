/* 全片单一配置源：浏览器和 Node（render/encode/synth）共用。
   MV = 层叠剪纸故事：原生 1920×1080 画布，没有整体放大；
   1080p 是默认交付，4K 由 renderScale 2 / render.js --scale 2 打开。
   仍然只有叙事层：look / style / layout 必须保持 none。 */
(function (root) {
  'use strict';

  const CONFIG = {
    title: "把灯留着",
    brand: "TIDE HARBOR",
    brandSub: "潮汐港 / TIDE HARBOR",
    slogan: "灯亮着，就有人回来",

    /* 片头小标 / 片尾英文行，必须是 ASCII，可留空 */
    kicker: "A PAPER STORY",
    endTag: "TIDE HARBOR · PAPER STORY",
    disclaimer: "层叠剪纸叙事 · 全片代码绘制",

    /* 原生画布：1920×1080 是逻辑尺寸，也是 1080p 的实际像素尺寸。
       4K 时画布后备 = 3840×2160，矢量按 2 倍设备像素重画，不做位图放大。 */
    width: 1920,
    height: 1080,
    duration: 60,
    fps: 30,

    /* 1 = 1080p（默认），2 = 4K；render.js 的 --scale 可临时覆盖 */
    renderScale: 1,

    /* 分镜按成片绝对秒数编写（base 与 duration 相等时不做任何缩放） */
    base: 60,

    /* paper-story = 层叠剪纸故事 MV：主角 / 场景 / 镜头 / 底部歌词 */
    genre: "paper-story",

    /* 渲染引擎：paper = 原生 Canvas 层叠剪纸（默认，确定性、快）；
       cg = Blender 3D 纸剧场（cg/mv3d.py：纸片在真实三维空间里，真景深/光影/体积）。
       引擎只换渲染方式，分镜节拍、歌词、音乐与交付契约都不变。 */
    engine: "paper",
    cg: {
      file: "cg/mv3d.py",
      samples: 16,
      engine: "EEVEE",
      blender: ""
    },

    /* 宣传片层在 MV 里不存在；写死 none，避免两套语法混在一起 */
    look: "none",
    style: "none",
    layout: "none",
    brief: "海边灯塔，守灯的人，等一艘船回来",

    /* 全片共用色：纸张边缘、剪影、灯火、强调色。
       场景内部的明暗层次在各 mood 调色板里派生，不在这里堆色值。 */
    art: {
      ink: "#0b1424",
      cream: "#f3e3c6",
      warm: "#ffc473",
      ember: "#d96a56",
      sea: "#173450",
      dusk: "#3a5279",
      dawn: "#efae78"
    },

    mediaFrames: {},
    tcFps: 30,
    posterAt: 58.6,

    fontFamily: "BrandSans"
  };

  if (root && root.document) {
    /* render.js / qa-mv.js 用 ?scale= 临时覆盖设备像素比：
       画布后备尺寸必须在脚本加载前就位，否则 4K 会变成 1080p 位图拉伸 */
    const m = /[?&]scale=(\d+)/.exec(root.location ? root.location.search : '');
    if (m) {
      const s = Number(m[1]);
      if (s >= 1 && s <= 4) CONFIG.renderScale = s;
    }
    const d = root.document.documentElement;
    d.style.setProperty('--stage-w', CONFIG.width + 'px');
    d.style.setProperty('--stage-h', CONFIG.height + 'px');
  }
  if (root) root.FILM_CONFIG = CONFIG;
  if (typeof module === 'object' && module.exports) module.exports = CONFIG;
})(typeof window !== 'undefined' ? window : null);
