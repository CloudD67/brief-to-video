/* 全片单一配置源：浏览器和 Node（render/encode/synth）共用 */
(function (root) {
  'use strict';

  const CONFIG = {
    title: '未命名影片',
    brand: 'STUDIO',
    brandSub: '从一句话到成片 / BRIEF TO FILM',
    slogan: '故事先于画面',
    disclaimer: '空白起步 · 先写故事，再写分镜',

    width: 1920,
    height: 1080,
    duration: 60,
    fps: 30,

    // 视觉目录：look = 主题 + 版式 + 动效气质
    // auto 会按 brief/title/slogan 关键词选择；?look= 可强制指定
    // 可用：node tools/pick-look.js --list
    look: 'auto',
    brief: '品牌片，编辑排版，先写故事与分镜',

    // 单独覆盖（auto 表示跟随 look）；显式写了的层优先于 look
    // style: auto | letterpress | swiss | cinema | quiet | tech
    // layout: auto | editorial | poster | grid | split
    style: 'auto',
    layout: 'auto',
    // 动效气质：auto 跟随 look；真屏产品片写 'locked'（无全片漂移、切点不闪白）
    // 可选：calm | precise | snappy | cinematic | locked
    motion: 'auto',

    // 镜头语法：screen = 软件/AI/平台的真屏语法；world = 硬件/空间/人物的世界语法
    // auto 由 new-film.js 按七问第 2 问写入；check-project 会按它查空间数与屏幕镜头（屏幕只提示）
    grammar: 'auto',

    // 分镜表契约（写进剧本后再填，check-project 用它查覆盖与相邻镜差异，屏幕占比只提示）
    // [{ id, at, dur, space, frame, subject, screen?, note? }]
    shots: [],

    // 竖屏：width 1080 / height 1920 即自动启用 portrait 重排

    // 真实素材缩略图：把图片放 assets/media/，用场景 id 替换内置插画
    // 例：{ "s1": ["assets/media/s1-alley.jpg"], "s4": ["a.jpg", "b.jpg"] }
    // 多张图会按片内进度切换；也兼容用镜头编号 1–8 作为键。
    // 视频素材先跑 npm run media 抽帧，自动写入 js/media.generated.js。
    mediaFrames: {},

    // 字幕轨时间码的显示帧率（只影响画面上的 00:00:00:00 标签）
    tcFps: 24,

    // 以 60s 为基准，改 duration 后自动等比缩放
    posterAt: 58.3,

    // 可选品牌字体：把 woff2 放到 assets/fonts/brand.woff2，
    // 再把 fontUrl 改成 'assets/fonts/brand.woff2' 即可自动接管拉丁字
    fontUrl: '',
    fontFamily: 'BrandSans'
  };

  if (root && root.document) {
    const d = root.document.documentElement;
    d.style.setProperty('--stage-w', CONFIG.width + 'px');
    d.style.setProperty('--stage-h', CONFIG.height + 'px');
  }
  if (root) root.FILM_CONFIG = CONFIG;
  if (typeof module === 'object' && module.exports) module.exports = CONFIG;
})(typeof window !== 'undefined' ? window : null);
