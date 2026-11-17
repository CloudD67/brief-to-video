/* 全片唯一文案源：底部歌词 + 片头/片尾字。
   示范用的是一首原创短歌《把灯留着》：黄昏送船出港，风暴夜守灯，天亮船回。
   时间写成分镜基准的绝对秒数（60s 片长下就是成片秒数）；
   一句 3.8 秒、9–10 个字，约 2.6 字/秒，留出呼吸，不抢画面。

   换成你提供的歌时：保留结构，把 text 换成歌词原句，
   按歌词的换气点改 start/end；句子可以跨切点，底部歌词是连续的。 */
(function (root) {
  'use strict';

  const SCRIPT = {
    subtitles: [
      { start: 2.2, end: 6.0, text: '潮水把黄昏推上了岸' },
      { start: 6.6, end: 10.4, text: '你走那天，风没说再见' },
      { start: 10.9, end: 14.7, text: '我把灯芯拨亮一点' },
      { start: 15.2, end: 19.0, text: '让光替我，多看你一眼' },
      { start: 20.4, end: 24.2, text: '浪再高，也别把路遮住' },
      { start: 25.4, end: 29.2, text: '我守着这盏不灭的灯' },
      { start: 29.8, end: 33.6, text: '雨打在窗上，像你在敲' },
      { start: 34.2, end: 38.0, text: '我数到第一千次潮声' },
      { start: 38.6, end: 42.4, text: '风把海面，吹成一条路' },
      { start: 44.6, end: 48.4, text: '天快亮了，船就快到了' },
      { start: 52.8, end: 56.6, text: '灯还亮着，你回来了' }
    ]
  };

  if (root) root.FILM_SCRIPT = SCRIPT;
  if (typeof module === 'object' && module.exports) module.exports = SCRIPT;
})(typeof window !== 'undefined' ? window : null);
