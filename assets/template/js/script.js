/* 全片剧本：观众能看到的文字都在这里。场景文件只负责画。
   字幕与场景时间按 60s 基准书写，改 config.duration 后运行时自动等比缩放。 */
(function (root) {
  'use strict';

  const SCRIPT = {
    /* 每条字幕归属于场景：at = 场景内第几秒，dur = 停留多久。
       改场景长度或片长都不用重算时间码；也兼容 { start, end } 绝对秒写法。 */
    subtitles: [
      { scene: 's1', at: 0, dur: 1.8, text: '一句话，先要有画面' },
      { scene: 's1', at: 1.8, dur: 1.8, text: '街景、光线、人的动作' },
      { scene: 's1', at: 3.6, dur: 1.8, text: '素材齐了，故事才站得住' },
      { scene: 's1', at: 5.4, dur: 1.6, text: '先看清手上有什么' },

      { scene: 's2', at: 0, dur: 2, text: '把素材排进时间线' },
      { scene: 's2', at: 2, dur: 2, text: '视频、声音、字幕各走各的轨' },
      { scene: 's2', at: 4, dur: 2.2, text: '剪一刀，其余自动跟上' },
      { scene: 's2', at: 6.2, dur: 2.2, text: '结构清楚，修改才不慌' },
      { scene: 's2', at: 8.4, dur: 3.1, text: '一条线，收住所有混乱' },

      { scene: 's3', at: 0, dur: 2.5, text: '让人声和字幕对齐' },
      { scene: 's3', at: 2.5, dur: 3, text: '逐句校对，随时能改' },
      { scene: 's3', at: 5.5, dur: 3.3, text: '长片也能快速过一遍' },
      { scene: 's3', at: 8.8, dur: 2.7, text: '字幕不该是体力活' },

      { scene: 's4', at: 0, dur: 3.2, text: '关键的几帧，决定节奏' },
      { scene: 's4', at: 3.2, dur: 3.3, text: '起止一拉，动画就有了' },
      { scene: 's4', at: 6.5, dur: 2.7, text: '转场把两个画面接上' },
      { scene: 's4', at: 9.2, dur: 2.3, text: '细节留在你手里' },

      { scene: 's5', at: 0, dur: 3, text: '素材分好类，随手可取' },
      { scene: 's5', at: 3, dur: 3.5, text: '标签和收藏，替你做筛选' },
      { scene: 's5', at: 6.5, dur: 2.6, text: '参数选定，一键付印' },
      { scene: 's5', at: 9.1, dur: 1.4, text: '剩下的时间，留给创作' }
    ],

    s0: {
      meta: 'BRIEF → FILM · {duration} SEC · {height}P'
    },

    s1: {
      hdr: '01 — 素材 · FOOTAGE',
      kick: '01 — 素材',
      title: ['先有画面', '再有故事'],
      sub: '一句话只是起点，先把能拍的东西找齐：街景、光线、人的动作。',
      notes: [
        { no: '01', text: '找场景' },
        { no: '02', text: '定光线' },
        { no: '03', text: '备素材' }
      ],
      gauge: { label: '可用的画面 · USABLE', from: 2200, to: 552 },
      cards: ['001', '002', '003', '004', '005', '006', '007', '008']
    },

    s2: {
      hdr: '02 — 时间线 · TIMELINE',
      kick: '02 — 多轨时间线',
      title: '各归其位',
      sub: '把混乱收进一条线里。',
      file: '城市清晨 / 01_城市清晨_v07.film',
      save: '已自动保存 14:32',
      tc: '00:00:12:00',
      lanes: [
        {
          k: 'v2', h: 110, name: '叠加', tail: '04 · VIDEO', clips: [
            { no: 'V2 · 03', nm: '城市晨光 / 叠加层', dur: '00:03:12', x: 16, w: 140 },
            { no: 'V2 · 04', nm: '窗格投影', dur: '00:02:04', x: 176, w: 124 },
            { no: 'V2 · 05', nm: '光斑过渡', dur: '00:02:20', x: 340, w: 150, rip: -40 },
            { no: 'V2 · 06', nm: '尘埃 / 慢速', dur: '00:01:16', x: 510, w: 140, rip: -40 }
          ]
        },
        {
          k: 'v1', h: 170, name: '主画面', tail: '04 · VIDEO', clips: [
            { no: 'V1 · 01', nm: '巷口空镜 04', dur: '00:04:12', x: 16, w: 130 },
            { no: 'V1 · 02', nm: '早餐摊的热气', dur: '00:06:00', x: 156, w: 144, sel: true },
            { no: 'V1 · 03', nm: '公交站排队', dur: '00:05:18', x: 340, w: 160, rip: -40 },
            { no: 'V1 · 04', nm: '树影落地', dur: '00:03:22', x: 520, w: 130, rip: -40 }
          ]
        },
        {
          k: 'a1', h: 116, name: '对白', tail: '04 · AUDIO', clips: [
            { no: 'A1 · 01', nm: '对白 01「再等两分钟」', x: 16, w: 140, audio: true },
            { no: 'A1 · 02', nm: '对白 02「车来了」', x: 176, w: 100, audio: true },
            { no: 'A1 · 03', nm: '对白 03「走吧」', x: 340, w: 160, audio: true, rip: -40 },
            { no: 'A1 · 04', nm: '对白 04「风起了」', x: 520, w: 150, audio: true, rip: -40 }
          ]
        },
        {
          k: 'a2', h: 96, name: '环境', tail: '01 · AUDIO', clips: [
            { no: 'A2 · 城市环境声', nm: '清晨街道 / 远处车流 / 鸟鸣', x: 16, w: 660, audio: true }
          ]
        },
        {
          k: 's1', h: 110, name: '字幕', tail: '05 · CAPTION', clips: [
            { text: '从巷口慢慢吹过', x: 16, w: 120 },
            { text: '早餐摊冒着热气', x: 146, w: 140 },
            { text: '公交站排起了队', x: 300, w: 120 },
            { text: '有人快步走过路口', x: 436, w: 130 },
            { text: '树影落在地面上', x: 578, w: 110 }
          ]
        }
      ],
      inspector: [
        {
          title: '变换', rows: [
            { k: '缩放', v: '112.0 %', cls: 'hot' },
            { k: '位置', v: '240 / 96', key: 'pos' },
            { k: '旋转', v: '0.0°' },
            { k: '不透明度', v: '84 %' }
          ]
        },
        {
          title: '时间', rows: [
            { k: '入点', v: '00:00:03:06' },
            { k: '出点', v: '00:00:09:00', key: 'out' },
            { k: '时长', v: '00:06:00', key: 'dur' }
          ]
        },
        {
          title: '音频', rows: [
            { k: '增益', v: '-6.0 dB' },
            { k: '淡入', v: '0.4 s' }
          ]
        },
        {
          title: '调色', rows: [
            { k: '预设', v: '清晨 K1' },
            { k: '强度', v: '78 %' }
          ]
        },
        {
          title: '标记', rows: [
            { k: '波纹', v: '关闭', key: 'rip' },
            { k: '章节', v: '02 多轨' }
          ]
        }
      ],
      dynamics: {
        pos: { base: '0 / 96', moved: '-10 / 96' },
        dur: { base: '00:06:00', trimmed: '00:05:00' },
        out: { base: '00:00:09:00', trimmed: '00:00:08:12' },
        rip: { base: '关闭', moved: '三轨顺延' }
      }
    },

    s3: {
      hdr: '03 — 字幕 · CAPTION',
      kick: '03 — 字幕',
      headline: ['今天的风，是从巷口', '慢慢吹过来的。'],
      voice: {
        label: 'A1 · 人声 / VOICE',
        start: '00:00:02:00',
        foot: ['48 kHz · 单声道', '对齐误差 0.02 s'],
        done: '对齐完成 · 0.02 s'
      },
      cue: { title: '字幕轨 S1', meta: '自动对齐 · AUTO ALIGN', unit: '句' },
      cues: [
        { tc: '00:00:02:06', tx: '今天的风，是从巷口' },
        { tc: '00:00:04:12', tx: '慢慢吹过来的。' },
        { tc: '00:00:06:18', tx: '巷子不宽，光斜着下来。' },
        { tc: '00:00:09:02', tx: '石板上有昨天的雨。' },
        { tc: '00:00:11:14', tx: '他把机器架起来。' },
        { tc: '00:00:14:08', tx: '等一阵风。' }
      ],
      stats: [
        { label: '识别句数', unit: '句', to: 128, decimals: 0 },
        { label: '对齐准确率', unit: '%', to: 99.2, decimals: 1 }
      ],
      stamp: { title: '校对完成', sub: 'FILM · 2026.11.14 · 21:40' }
    },

    s4: {
      hdr: '04 — 关键帧 · KEYFRAME',
      kick: '04 — 关键帧',
      title: '起止之间',
      sub: '拉一条曲线，画面前后就连起来了。',
      preview: { label: 'PREVIEW · 01', xLabel: 'X ', scaleUnit: '%' },
      curve: { title: '曲线 · 位置 X', meta: '关键帧 01 — 02 · EASE OUT' },
      chips: [
        { k: '缩放', base: 100, delta: 8, suffix: ' %', decimals: 0 },
        { k: '位移 X', base: 0, delta: 26, suffix: ' px', decimals: 0 },
        { k: '不透明度', base: 100, delta: -4, suffix: ' %', decimals: 1 }
      ],
      foot: ['FILM MOTION / 曲线编辑器', '24 fps · 子帧 0.25'],
      transition: { a: 'A · 巷口', b: 'B · 早餐摊', tag: '交叉溶解 · 0.6 s' },
      keyTimes: ['00:00:04:12', '00:00:06:00']
    },

    s5: {
      hdr: '05 — 素材库 · LIBRARY',
      hdrAlt: '06 — 导出 · EXPORT',
      kick: '05 — 素材库',
      title: '随手可取',
      tags: ['全部', '巷口', '晨光', '逆光', '空镜', '环境音'],
      tiles: [
        { no: '001', nm: '巷口空镜 04', dur: '00:04:12', v: 1, match: true },
        { no: '002', nm: '早餐摊的热气', dur: '00:06:03', v: 2, match: false },
        { no: '003', nm: '窗格投影', dur: '00:02:04', v: 3, match: true },
        { no: '004', nm: '公交站排队', dur: '00:05:18', v: 7, match: false },
        { no: '005', nm: '石板路上的雨', dur: '00:03:22', v: 5, match: false },
        { no: '006', nm: '逆光 / 树影', dur: '00:04:06', v: 4, match: true },
        { no: '007', nm: '远处车流', dur: '00:02:18', v: 6, match: false },
        { no: '008', nm: '收工 / 空镜', dur: '00:01:12', v: 8, match: false }
      ],
      index: {
        big: '262',
        unit: '件',
        cap: '素材库 · MEDIA POOL',
        rows: [
          ['视频', '214', false],
          ['音频', '36', false],
          ['字幕', '12', false],
          ['常用', '12', true],
          ['标签', '18', false]
        ]
      },
      panel: {
        wm: '4K',
        kick: '06 — 导出',
        title: '付印单',
        meta: '城市清晨 / 01 · SEQUENCE 02 · 五轨',
        order: { label: 'PRINT ORDER', no: 'NO. 001', date: '2026.11.14', time: '21:40' },
        specs: [
          { k: '格式', v: 'MP4 · H.264', em: '标准' },
          { k: '分辨率', v: '3840 × 2160', em: '4K UHD' },
          { k: '帧率', v: '30 fps', em: '恒定' },
          { k: '音频', v: '48 kHz · 立体声', em: 'AAC 320' }
        ],
        progress: {
          label: '渲染中 / RENDERING',
          done: '完成 / DONE',
          sub: '3840 × 2160 · H.264 · 30P',
          time: '用时 00:01:12',
          timeDone: '用时 00:01:12 · 已归档'
        },
        seal: { title: '已付印', lines: ['FILM PRESS', '4K · 2026'] }
      }
    },

    s6: {
      hdrRight: 'END · 06 / 06',
      cards: [
        { no: '01', nm: '素材', en: 'FOOTAGE', v: 1 },
        { no: '02', nm: '时间线', en: 'TIMELINE', v: 2 },
        { no: '03', nm: '字幕', en: 'CAPTION', v: 3 },
        { no: '04', nm: '关键帧', en: 'KEYFRAME', v: 4 },
        { no: '05', nm: '素材库', en: 'LIBRARY', v: 5 },
        { no: '06', nm: '导出', en: 'EXPORT', v: 6 }
      ],
      footer: '© 2026 FILM STUDIO',
      footerEnd: 'END OF REEL · '
    }
  };

  if (root) root.FILM_SCRIPT = SCRIPT;
  if (typeof module === 'object' && module.exports) module.exports = SCRIPT;
})(typeof window !== 'undefined' ? window : null);
