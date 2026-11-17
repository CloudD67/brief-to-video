/* 固定机位合成器：场景 → 纸纹 → 暗角 → 片头/片尾卡 → 底部歌词。
   镜头之间没有推拉摇移，画面差别全部来自场景层与人物动作；
   每个时刻都至少有一层在动（浪 / 雨 / 火 / 呼吸 / 船 / 雾）。 */
(function (root) {
  'use strict';
  const K = root.PAPER_KIT;
  const SETS = root.PAPER_SETS;
  const SHOT = {};

  SHOT.render = function (g, shot, local, slot) {
    const qa = K.QA;
    qa.endCard = 0;
    qa.id = shot.id;
    qa.v = shot.v;
    qa.scene = shot.s;
    qa.mood = shot.mood;
    qa.frame = shot.frame;
    qa.who = shot.who ? shot.who.p : (shot.hands ? 'girl-hands' : (shot.hero ? 'girl-silhouette' : null));
    qa.hero = !!(shot.who || shot.hands || shot.hero);
    qa.card = !!shot.card;
    qa.last = !!shot.end;

    K.clear(g);
    const set = SETS[shot.s];
    if (set) set(g, shot, local, slot);

    K.grain(g);
    K.vignette(g, shot.vig == null ? 0.4 : shot.vig);

    if (shot.card) K.titleCard(g, local, slot);
    if (shot.end) K.endCard(g, local);

    if (shot.end) {
      qa.lyric.text = '';
      qa.lyric.alpha = 0;
    } else {
      const cue = K.cueAt(shot, local);
      K.lyric(g, cue.text, cue.alpha);
    }
  };

  root.PAPER_SHOT = SHOT;
})(typeof window !== 'undefined' ? window : null);
