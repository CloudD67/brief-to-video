/* 全片单一配置源：浏览器和 Node（render/encode/synth）共用 */
(function (root) {
  'use strict';

  const CONFIG = {
    title: '一句话，一条片',
    brand: 'FILM',
    brandSub: '从一句话到成片 / BRIEF TO FILM',
    slogan: '从分镜到成片，一次说清',
    disclaimer: '演示影片 · 画面均由代码绘制',

    width: 1920,
    height: 1080,
    duration: 60,
    fps: 30,

    // 视觉目录：look = 主题 + 版式 + 动效气质
    // auto 会按 brief/title/slogan 关键词选择；?look= 可强制指定
    // 可用：node tools/pick-look.js --list
    look: 'auto',
    brief: '',

    // 单独覆盖（auto 表示跟随 look）
    // style: auto | letterpress | swiss | cinema | quiet | tech
    // layout: auto | editorial | poster | grid | split
    style: 'auto',
    layout: 'auto',

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
