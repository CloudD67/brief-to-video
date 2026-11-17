(function () {
  'use strict';
  const C = window.FILM_CONFIG;
  const SC = window.FILM_SCRIPT.s0;
  const S = window.FILM_SCENES = window.FILM_SCENES || [];

  S.push({
    id: 's0',
    start: 0,
    end: 60,

    mount: function (root) {
      const wrap = kit.el('div', 's0-wrap');
      const kicker = kit.el('div', 's0-kicker', SC.hdr);
      const mark = kit.el('div', 's0-mark');

      const name = kit.el('div', 's0-name');
      const text = C.title;
      const split = window.FILM_LAYOUT === 'split' && C.width >= C.height;
      const availW = C.width < C.height ? C.width - 128 : (split ? 624 : 1560);
      name.style.fontSize = Math.min(148, Math.floor(availW / (Math.max(1, text.length) * 1.02))) + 'px';
      const tightR = '，。、；：！？';
      const tightL = '「『（《';
      const cells = [];
      for (let i = 0; i < text.length; i++) {
        const m = kit.el('span', 'm');
        const inner = kit.el('span', null, text[i]);
        m.appendChild(inner);
        if (i < text.length - 1 && tightR.indexOf(text[i]) >= 0) m.style.marginRight = '-0.36em';
        if (i > 0 && tightL.indexOf(text[i]) >= 0) m.style.marginLeft = '-0.36em';
        name.appendChild(m);
        cells.push(inner);
      }

      const rule = kit.el('div', 's0-rule');
      const dot = kit.el('div', 's0-dot');
      rule.appendChild(dot);

      const slogan = kit.el('div', 's0-slogan', C.slogan);
      slogan.style.fontSize = Math.min(42, Math.floor(availW / (Math.max(1, C.slogan.length) * 1.2))) + 'px';
      const sub = kit.el('div', 's0-sub', SC.sub);
      const meta = kit.el('div', 's0-meta', SC.meta);

      wrap.appendChild(kicker);
      wrap.appendChild(mark);
      wrap.appendChild(name);
      wrap.appendChild(rule);
      wrap.appendChild(slogan);
      wrap.appendChild(sub);
      wrap.appendChild(meta);
      root.appendChild(wrap);

      this.node = { wrap, kicker, mark, name, cells, rule, dot, slogan, sub, meta };
    },

    seek: function (local) {
      const t = local;
      const n = this.node;

      const kp = E.outCubic(U.inv(0.12, 0.80, t));
      n.kicker.style.opacity = String(kp * 0.8);
      n.kicker.style.transform = 'translate3d(0,' + ((1 - kp) * 8).toFixed(2) + 'px,0)';

      const mp = E.outExpo(U.inv(0.30, 0.70, t));
      n.mark.style.opacity = String(Math.min(1, mp * 1.4));
      n.mark.style.transform = 'scale(' + (2.2 - 1.2 * mp).toFixed(3) + ')';

      for (let i = 0; i < n.cells.length; i++) {
        const p = E.outCubic(U.inv(0.60 + i * 0.04, 1.50 + i * 0.04, t));
        n.cells[i].style.transform = 'translate3d(0,' + ((1 - p) * 106).toFixed(2) + '%,0)';
        n.cells[i].style.opacity = String(0.001 + 0.999 * p);
      }

      const rp = E.outExpo(U.inv(1.00, 2.00, t));
      n.rule.style.transform = 'scaleX(' + rp.toFixed(4) + ')';

      const sp = E.outCubic(U.inv(1.80, 2.70, t));
      n.slogan.style.opacity = String(sp);
      n.slogan.style.transform = 'translate3d(0,' + ((1 - sp) * 12).toFixed(2) + 'px,0)';

      const up = E.outCubic(U.inv(2.40, 3.30, t));
      n.sub.style.opacity = String(up);
      n.sub.style.transform = 'translate3d(0,' + ((1 - up) * 10).toFixed(2) + 'px,0)';

      const ep = E.outCubic(U.inv(2.80, 3.70, t));
      n.meta.style.opacity = String(ep * 0.85);

      /* 一条细线加一颗缓慢移动的点，保证空白起步工程全片也不是静帧；
         写自己的场景后整段删掉即可。 */
      const w = n.rule.clientWidth || 620;
      const travel = U.inv(6, 55, t);
      const dotIn = U.inv(5.8, 7.0, t);
      const dotOut = 1 - U.inv(56.0, 58.5, t);
      n.dot.style.opacity = String(dotIn * dotOut);
      n.dot.style.transform =
        'translate3d(' + (travel * w).toFixed(2) + 'px,' + (Math.sin(t * 1.25) * 2).toFixed(2) + 'px,0)';
    }
  });
})();
