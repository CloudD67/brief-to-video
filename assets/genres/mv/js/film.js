/* 分镜数据：一条完整的故事线，按节拍行分组，组内等分时长（2–3 秒）。
   示范故事（可整段替换）：她拖着箱子来这座城市打工，觉得这里不好，坐车离开；
   他守着街角小店，本来就住在这里，却因为看见她离开，第一次爱上这座城。

   写法：每行 t = 这一拍开始的绝对秒数，shots = 这一拍里的镜头。
   行内等分（3 镜 2.5s）；每镜自动拿到唯一的 v，场景库据此派生独立的世界几何与调色——
   因此同一个场景可以反复出现，但不会出现同一张画面。
   最后一镜（end: true）画片尾卡，收在时间轴末尾。 */
(function (root) {
  'use strict';

  const G = function (x, y, p, o) { return Object.assign({ k: 'girl', x: x, y: y, pose: p || 'stand' }, o || {}); };
  const B = function (x, y, p, o) { return Object.assign({ k: 'boy', x: x, y: y, pose: p || 'stand' }, o || {}); };

  /* 程序化场景：arc = sets-gen.js 里的原型名 */
  const gs = function (arc, m, o) {
    return Object.assign({ s: 'gen', g: arc, m: m || 'hold' }, o || {});
  };

  /* 段落语法：主歌平滑溶解、副歌硬切、桥段慢溶、尾声慢溶 */
  const SECTIONS = [
    { at: 0.0, mode: 'verse' },
    { at: 37.5, mode: 'chorus' },
    { at: 52.5, mode: 'finale' }
  ];

  /* 道具简写：她走的时候，箱子一直在旁边 */
  const CASE = function (x, y, ph) {
    return { x: x, y: y, roll: true, ph: ph || 0 };
  };

  const LINES = [
    /* —— 她来 —— */
    { t: 0.0, shots: [
      { s: 'city', m: 'pan-r', card: true },
      { s: 'platform', m: 'pan-r', who: false, cx: 330, train: true,
        duo: G(300, 222, 'walk', { case: CASE(316, 234, 0.6) }) },
      { s: 'station', m: 'in', who: false, cx: 430,
        duo: G(410, 222, 'walk', { case: CASE(426, 234, 1.4) }) }
    ] },
    { t: 7.5, shots: [
      /* 六楼那间房，窗对着别人的灯 */
      { s: 'street', m: 'pan-l', who: false, cx: 330,
        duo: G(330, 214, 'walk', { case: CASE(346, 214, 2.1) }) },
      { s: 'stair', m: 'tilt-u', who: false, cx: 160, zoom: 1.35, cy: 198,
        duo: G(150, 210, 'walk', { case: CASE(166, 210, 0.3) }) },
      { s: 'room', m: 'in', who: G(352, 156) }
    ] },
    { t: 15.0, shots: [
      /* 我守着街角的小店，看她每天路过 */
      { s: 'window', m: 'pan-l', who: false, shard: false },
      { s: 'store', m: 'pan-r', zoom: 1.18, cx: 230,
        duo: G(300, 224, 'walk', { umbrella: true }) },
      { s: 'store', m: 'hold', who: B(150, 208, 'stand'), zoom: 2.1, cx: 150, cy: 190 }
    ] },
    { t: 22.5, shots: [
      /* 她在面馆做工，手上全是汤气 */
      { s: 'noodle', m: 'pan-r', who: G(150, 172, 'sit'), work: true },
      { s: 'noodle', m: 'hold', who: G(300, 172, 'sit'), work: true, zoom: 1.9, cx: 300, cy: 180 },
      { s: 'insert', ins: 'phone', m: 'in', zoom: 1.3, cy: 140 }
    ] },

    /* —— 雨，她走 —— */
    { t: 30.0, shots: [
      /* 雨太大，她的伞骨断了一根 */
      { s: 'insert', ins: 'umbrella', m: 'in', cy: 170 },
      { s: 'street', m: 'pan-l', who: G(330, 214, 'walk', { umbrella: true }), rain: 1 },
      gs('crossing', 'pan-r', { who: G(300, 232, 'walk', { umbrella: true }), rain: 1 })
    ] },
    { t: 37.5, shots: [
      /* 钥匙压在便签下面，写着我走了 */
      { s: 'store', m: 'in', zoom: 1.2, cx: 290,
        duo: G(300, 224, 'stand', { case: CASE(316, 224, 0.2), umbrella: true }) },
      { s: 'insert', ins: 'key', m: 'in', cy: 160 },
      { s: 'platform', m: 'pan-r', who: false, cx: 520, train: true,
        duo: G(520, 222, 'stand', { case: { x: 536, y: 234, roll: true, ph: 0.4 } }) }
    ] },
    { t: 45.0, shots: [
      /* 车开走以后，站台空得厉害 */
      { s: 'car', m: 'out', who: G(322, 158, 'sit') },
      { s: 'platform', m: 'hold', who: B(520, 232, 'stand'), train: false },
      { s: 'alley', m: 'pan-l', who: B(352, 228, 'walk') }
    ] },

    /* —— 他看见 —— */
    { t: 52.5, shots: [
      /* 我住了二十多年，今天才第一次看见它 */
      { s: 'roof', m: 'in', who: B(360, 200, 'stand') },
      { s: 'city', m: 'pan-r', who: false },
      { s: 'dawn', m: 'in', who: false, end: true }
    ] }
  ];

  const SHOTS = [];
  function modeAt(t) {
    let m = 'verse';
    for (let i = 0; i < SECTIONS.length; i++) if (t >= SECTIONS[i].at) m = SECTIONS[i].mode;
    return m;
  }
  for (let i = 0; i < LINES.length; i++) {
    const line = LINES[i];
    const end = i + 1 < LINES.length ? LINES[i + 1].t : 60;
    const span = end - line.t;
    const n = line.shots.length;
    /* 等分：每个画面都落在 2–3 秒，不靠长短镜制造节奏 */
    for (let k = 0; k < n; k++) {
      const sh = line.shots[k];
      const d = span / n;
      SHOTS.push(Object.assign({}, sh, {
        id: 's' + (SHOTS.length + 1),
        v: SHOTS.length + 1,
        mode: modeAt(line.t + k * d),
        start: line.t + k * d,
        dur: d
      }));
    }
  }

  const FILM = { sections: SECTIONS, lines: LINES, shots: SHOTS, total: 60 };
  if (root) root.FILM_FILM = FILM;
  if (typeof module === 'object' && module.exports) module.exports = FILM;
})(typeof window !== 'undefined' ? window : null);
