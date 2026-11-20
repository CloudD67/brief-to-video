/* 故事赛道配置：横屏 3D 短剧。
   1920×1080 横屏，24fps，绝对秒数分镜；3D 雨夜布景 + 剪影人物 + 对白字幕。
   时间基准 base = duration，改片长只改 duration 与 film.js 的镜头表。 */
(function (root) {
  'use strict';

  const CONFIG = {
    title: "雨停之前",
    brand: "STORY / 01",
    brandSub: "横屏故事 · 第一集",
    slogan: "有些人，值得多等一碗面",

    kicker: "A RAIN-NIGHT STORY",
    endTag: "雨停之前 · 第一集",
    disclaimer: "横屏故事 · 全片代码绘制",

    /* 原生横屏：1920×1080 是逻辑尺寸，也是 1080p 的实际像素尺寸 */
    width: 1920,
    height: 1080,
    duration: 40,
    fps: 24,

    /* 1 = 1080p（默认），2 = 4K；故事赛道默认只做 1080p */
    renderScale: 1,

    /* 分镜按成片绝对秒数编写，base 与 duration 相等 */
    base: 40,

    genre: "story",

    /* 渲染引擎：
       three = 浏览器 previs（现有 3D 舞台 + 剪纸人物，快、可迭代）
       cg    = Blender 程序化 CG（真实 HDRI/PBR、体积、粒子、景深；成片用） */
    engine: "three",
    cg: {
      file: "cg/film.py",
      samples: 24,
      engine: "EEVEE",
      blender: ""
    },

    /* 故事层没有 look / 主题 / 版式 */
    look: "none",
    style: "none",
    layout: "none",
    brief: "雨夜面摊，她多要了一碗面，等一个说马上到的人",

    /* 3D 布景的全局曝光与雾；镜头各自还有 focus / aperture */
    render: {
      exposure: 1.12,
      fogDensity: 0.019,
      bloom: 0.46,
      threshold: 0.93,
      grain: 0.012,
      vignette: 0.8,
      contrast: 1.06,
      saturation: 1.05
    },

    /* 横屏字幕安全区：底部留 120px，左右各留 120px */
    safe: {
      top: 80,
      bottom: 120,
      side: 120
    },

    posterAt: 38.9,
    tcFps: 24,
    fontFamily: "StorySans"
  };

  if (root && root.document) {
    const m = /[?&]scale=(\d+)/.exec(root.location ? root.location.search : '');
    if (m) {
      const s = Number(m[1]);
      if (s >= 1 && s <= 4) CONFIG.renderScale = s;
    }
    const d = root.document.documentElement;
    d.style.setProperty('--stage-w', CONFIG.width + 'px');
    d.style.setProperty('--stage-h', CONFIG.height + 'px');
    d.style.setProperty('--safe-bottom', CONFIG.safe.bottom + 'px');
    d.style.setProperty('--safe-side', CONFIG.safe.side + 'px');
  }
  if (root) root.FILM_CONFIG = CONFIG;
  if (typeof module === 'object' && module.exports) module.exports = CONFIG;
})(typeof window !== 'undefined' ? window : null);
