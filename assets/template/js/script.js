/* 全片剧本：观众能看到的文字都在这里。场景文件只负责画。
   这是空白起步工程的一套占位文案：先写故事与分镜，再整段替换。
   字幕与场景时间按 60s 基准书写，改 config.duration 后运行时自动等比缩放。 */
(function (root) {
  'use strict';

  const SCRIPT = {
    /* 每条字幕归属于场景：at = 场景内第几秒，dur = 停留多久。
       改场景长度或片长都不用重算时间码；也兼容 { start, end } 绝对秒写法。 */
    subtitles: [
      { scene: 's0', at: 4, dur: 3, text: '故事，从这里开始。' },
      { scene: 's0', at: 10, dur: 3, text: '先写一个人，他想要什么。' },
      { scene: 's0', at: 16, dur: 3, text: '再给他一个过不去的坎。' },
      { scene: 's0', at: 22, dur: 3, text: '每一次选择，都改变一点。' },
      { scene: 's0', at: 28, dur: 3, text: '分镜跟着故事走。' },
      { scene: 's0', at: 34, dur: 3, text: '不是先选骨架，再填内容。' },
      { scene: 's0', at: 40, dur: 3, text: '让画面从情节里长出来。' },
      { scene: 's0', at: 46, dur: 3, text: '把这一场，换成你的故事。' },
      { scene: 's0', at: 52, dur: 3, text: '然后，再开机。' }
    ],

    s0: {
      hdr: 'SCENE 01 / 第一场',
      sub: '把这一页，换成你写下的故事。',
      meta: 'BRIEF → FILM · {duration} SEC · {height}P'
    }
  };

  if (root) root.FILM_SCRIPT = SCRIPT;
  if (typeof module === 'object' && module.exports) module.exports = SCRIPT;
})(typeof window !== 'undefined' ? window : null);
