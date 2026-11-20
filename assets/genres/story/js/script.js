/* 剧本层：角色、对白、旁白、屏幕字与片尾钩子。
   所有可见文字都在这里；film.js 只负责镜头，scene/timeline 只负责画。 */
(function (root) {
  'use strict';

  const SCRIPT = {
    title: "雨停之前",
    titleEn: "BEFORE THE RAIN ENDS",
    episode: "第一集",

    /* voice 只写系统语音的基础名；pitch<1 用 ffmpeg 降调模拟男声/老人。
       新版中文语音（Flo/Eddy/Grandpa…）需要先在系统里下载，未下载会静音。 */
    cast: {
      her: { name: "她", voice: "Tingting", rate: 176, color: "#ffd9b0" },
      him: { name: "他", voice: "Meijia", rate: 164, pitch: 0.82, color: "#9fc6ff" },
      owner: { name: "老板", voice: "Meijia", rate: 148, pitch: 0.72, color: "#e8c98f" },
      narrator: { name: "", voice: "Meijia", rate: 180, color: "#cfd8e4" }
    },

    /* at / dur 是成片绝对秒数；dur 是字幕槽位，也是配音的时长上限 */
    lines: [
      { at: 0.6, dur: 2.3, who: "narrator", text: "雨下了一整夜，面摊还亮着。" },
      { at: 3.0, dur: 1.7, who: "her", text: "老板，一碗面。" },
      { at: 5.7, dur: 1.2, who: "him", text: "我到了。", screen: true },
      { at: 6.9, dur: 0.9, who: "her", text: "你在哪？", screen: true },
      { at: 8.4, dur: 1.5, who: "owner", text: "还是老样子？" },
      { at: 10.9, dur: 1.7, who: "her", text: "嗯。多下一碗。" },
      { at: 13.6, dur: 1.8, who: "narrator", text: "第二碗，摆在对面。" },
      { at: 16.4, dur: 1.8, who: "owner", text: "姑娘，面要坨了。" },
      { at: 18.9, dur: 1.7, who: "her", text: "再等等。" },
      { at: 24.0, dur: 1.8, who: "narrator", text: "消息停在「正在输入」。" },
      { at: 27.0, dur: 1.5, who: "narrator", text: "面凉了，雨没停。" },
      { at: 34.3, dur: 1.8, who: "him", text: "对不起，我来晚了。" },
      { at: 36.6, dur: 1.3, who: "her", text: "坐吧，还热着。" }
    ],

    /* 第 4 镜的手机屏幕：竖屏对话框 */
    phone: {
      time: "21:59",
      contact: "他",
      incoming: "我到了。",
      typing: "对方正在输入…",
      sent: "你在哪？",
      status: "已发送"
    },

    titleCard: {
      at: 38.0,
      to: 40.0,
      title: "雨停之前",
      en: "BEFORE THE RAIN ENDS",
      hook: "下一集 · 那碗面，他还是没吃"
    },

    endHook: "有些人，值得多等一碗面"
  };

  if (root) root.FILM_SCRIPT = SCRIPT;
  if (typeof module === 'object' && module.exports) module.exports = SCRIPT;
})(typeof window !== 'undefined' ? window : null);
