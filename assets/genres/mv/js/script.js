/* 全片唯一文案源：字幕牌 + 片头/片尾字。
   第一人称叙事（他 = 留在这座城的人）：她来打工、觉得这座城市不好、坐车离开；
   他原本就住在这里，是她的离开让他第一次看见并爱上这座城。
   时间按成片绝对秒数写，与镜头共用同一张时间表；每条只占 3–4 秒，
   阅读速度控制在 4 字/秒以内，跨拍换句，不跨镜头抢戏。 */
(function (root) {
  'use strict';

  const SCRIPT = {
    subtitles: [
      { start: 3.2, end: 7.0, text: '她拖着箱子，从雨里来' },
      { start: 8.0, end: 12.0, text: '六楼那间房，窗对着别人的灯' },
      { start: 15.4, end: 19.4, text: '我守着街角的小店' },
      { start: 22.8, end: 26.8, text: '她在面馆做工，手上全是汤气' },
      { start: 27.4, end: 29.6, text: '她说，这里也就那样' },
      { start: 30.4, end: 34.4, text: '雨下了整夜，伞骨断了一根' },
      { start: 37.8, end: 41.8, text: '她走了，钥匙压在便签下面' },
      { start: 42.4, end: 46.4, text: '车开走以后，站台空得厉害' },
      { start: 48.0, end: 52.0, text: '回去的路，我第一次觉得很长' },
      { start: 53.0, end: 57.0, text: '我住了二十多年，今天才看见' }
    ]
  };

  if (root) root.FILM_SCRIPT = SCRIPT;
  if (typeof module === 'object' && module.exports) module.exports = SCRIPT;
})(typeof window !== 'undefined' ? window : null);
