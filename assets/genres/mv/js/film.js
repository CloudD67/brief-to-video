/* 分镜：一个人守着灯，等一艘船。
   24 镜 × 2.5s = 60s，镜内只有一个主动作，镜头本身不推不拉不摇。
   景别写在 frame 里（wide / mid / close），QA 用它核对「主角镜头够不够」。
   场次字段全部是构图参数，不是相机参数：没有 zoom / cx / cy / m。 */
(function (root) {
  'use strict';

  const GIRL = function (o) {
    return Object.assign({ p: 'girl', h: 200, pose: 'stand', dir: 1 }, o || {});
  };

  const SECTIONS = [
    { at: 0, mode: 'verse' },
    { at: 20, mode: 'chorus' },
    { at: 40, mode: 'bridge' },
    { at: 52.5, mode: 'finale' }
  ];

  const SHOTS = [
    /* ── 主歌：黄昏，她来到港口 ─────────────────────── */
    {
      id: 's01', v: 1, start: 0, dur: 2.5, s: 'harbor', mood: 'dusk', frame: 'wide',
      card: true,
      who: GIRL({ x: 430, y: 906, h: 200, pose: 'walk', dir: 1 })
    },
    {
      id: 's02', v: 2, start: 2.5, dur: 2.5, s: 'pier', mood: 'dusk', frame: 'mid',
      who: GIRL({ x: 700, y: 930, h: 330, pose: 'stand', dir: -1 }),
      boat: { x: 1230, y: 800, s: 0.44 }
    },
    {
      id: 's03', v: 3, start: 5, dur: 2.5, s: 'portrait', mood: 'dusk', frame: 'close',
      who: GIRL({ x: 960, y: 470, h: 380, pose: 'stand', dir: 1, expr: 'calm', tilt: -0.02 })
    },
    {
      id: 's04', v: 4, start: 7.5, dur: 2.5, s: 'tower', mood: 'night', frame: 'wide',
      climb: true, lampOn: 0, beam: false, hero: true
    },

    /* ── 主歌 II：擦亮火柴，把灯点起来 ───────────────── */
    {
      id: 's05', v: 5, start: 10, dur: 2.5, s: 'lamp', mood: 'night', frame: 'mid',
      ignite: true,
      who: GIRL({ x: 620, y: 1050, h: 540, pose: 'reach', dir: 1 })
    },
    {
      id: 's06', v: 6, start: 12.5, dur: 2.5, s: 'flame', mood: 'night', frame: 'close',
      hands: true, shield: 0.55
    },
    {
      id: 's07', v: 7, start: 15, dur: 2.5, s: 'sea', mood: 'night', frame: 'wide',
      beam: true, boat: { x: 1240, y: 690, s: 0.65 }
    },
    {
      id: 's08', v: 8, start: 17.5, dur: 2.5, s: 'window', mood: 'night', frame: 'mid',
      who: GIRL({ x: 1040, y: 1000, h: 660, pose: 'back', dir: 1 }),
      boat: { x: 1180, y: 590, s: 0.34 }
    },

    /* ── 副歌：风暴来了 ─────────────────────────────── */
    {
      id: 's09', v: 9, start: 20, dur: 2.5, s: 'sea', mood: 'storm', frame: 'wide',
      waveRise: true, rain: true, boat: { x: 1220, y: 700, s: 0.7 }
    },
    {
      id: 's10', v: 10, start: 22.5, dur: 2.5, s: 'portrait', mood: 'storm', frame: 'close',
      who: GIRL({ x: 960, y: 480, h: 390, pose: 'stand', dir: -1, expr: 'worry', tilt: 0.03 })
    },
    {
      id: 's11', v: 11, start: 25, dur: 2.5, s: 'lamp', mood: 'storm', frame: 'mid',
      rain: true,
      who: GIRL({ x: 620, y: 1050, h: 540, pose: 'reach', dir: 1 })
    },
    {
      id: 's12', v: 12, start: 27.5, dur: 2.5, s: 'tower', mood: 'storm', frame: 'wide',
      lampOn: 1, beam: true, hero: true
    },
    {
      id: 's13', v: 13, start: 30, dur: 2.5, s: 'flame', mood: 'storm', frame: 'close',
      hands: true, shield: 0.92
    },
    {
      id: 's14', v: 14, start: 32.5, dur: 2.5, s: 'sea', mood: 'storm', frame: 'wide',
      giant: true, rain: true, boat: { x: 1150, y: 700, s: 0.75 }
    },
    {
      id: 's15', v: 15, start: 35, dur: 2.5, s: 'window', mood: 'storm', frame: 'mid',
      wipe: true,
      who: GIRL({ x: 980, y: 1010, h: 680, pose: 'back', dir: 1 })
    },
    {
      id: 's16', v: 16, start: 37.5, dur: 2.5, s: 'portrait', mood: 'storm', frame: 'close',
      who: GIRL({ x: 960, y: 470, h: 385, pose: 'stand', dir: 1, expr: 'determined', eyesFlame: true })
    },

    /* ── 桥段：天快亮了 ─────────────────────────────── */
    {
      id: 's17', v: 17, start: 40, dur: 2.5, s: 'tower', mood: 'dawn', frame: 'wide',
      lampOn: 1, beam: true, hero: true
    },
    {
      id: 's18', v: 18, start: 42.5, dur: 2.5, s: 'lamp', mood: 'dawn', frame: 'mid',
      lampLow: true,
      who: GIRL({ x: 1180, y: 1010, h: 450, pose: 'sleep', dir: -1 })
    },
    {
      id: 's19', v: 19, start: 45, dur: 2.5, s: 'flame', mood: 'dawn', frame: 'close',
      hands: true, low: true, reach: true, shield: 0.7
    },
    {
      id: 's20', v: 20, start: 47.5, dur: 2.5, s: 'sea', mood: 'dawn', frame: 'wide',
      fog: true, horn: true, keeperWave: true,
      boat: { x: 880, y: 700, s: 0.9, move: [880, 1080] }
    },
    {
      id: 's21', v: 21, start: 50, dur: 2.5, s: 'window', mood: 'dawn', frame: 'mid',
      press: true,
      who: GIRL({ x: 1000, y: 1000, h: 680, pose: 'back', dir: 1 }),
      boat: { x: 1250, y: 600, s: 0.4 }
    },

    /* ── 尾声：她跑下码头 ───────────────────────────── */
    {
      id: 's22', v: 22, start: 52.5, dur: 2.5, s: 'pier', mood: 'dawn', frame: 'mid',
      who: GIRL({ x: 760, y: 930, h: 330, pose: 'stand', dir: -1 }),
      runWho: GIRL({ x: 1340, y: 930, h: 320, pose: 'run', dir: -1, move: [1420, 1180] }),
      boat: { x: 1560, y: 800, s: 0.52 }
    },
    {
      id: 's23', v: 23, start: 55, dur: 2.5, s: 'portrait', mood: 'dawn', frame: 'close',
      who: GIRL({ x: 960, y: 470, h: 385, pose: 'stand', dir: -1, expr: 'smile', tear: true })
    },
    {
      id: 's24', v: 24, start: 57.5, dur: 2.5, s: 'end', mood: 'dawn', frame: 'wide',
      end: true,
      boat: { x: 1180, y: 760, s: 0.62 }
    }
  ];

  const FILM = {
    title: '把灯留着',
    logline: '风暴夜里，她守住灯塔的灯；天亮时，父亲的那艘船回来了。',
    sections: SECTIONS,
    shots: SHOTS,
    total: 60
  };

  if (root) root.FILM_FILM = FILM;
  if (typeof module === 'object' && module.exports) module.exports = FILM;
})(typeof window !== 'undefined' ? window : null);
