(function () {
  'use strict';
  const C = window.FILM_CONFIG;
  const SC = window.FILM_SCRIPT.s0;
  const S = window.FILM_SCENES = window.FILM_SCENES || [];

  S.push({
    id: 's0',
    start: 0,
    end: 3,

    mount: function (root) {
      const wrap = kit.el('div', 's0-wrap');

      const mark = kit.el('div', 's0-mark');

      const name = kit.el('div', 's0-name');
      const text = C.title;
      const availW = C.width < C.height ? C.width - 128 : 1560;
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
      const slogan = kit.el('div', 's0-slogan', C.slogan);
      slogan.style.fontSize = Math.min(42, Math.floor(availW / (Math.max(1, C.slogan.length) * 1.2))) + 'px';
      const meta = kit.el('div', 's0-meta', SC.meta);

      wrap.appendChild(mark);
      wrap.appendChild(name);
      wrap.appendChild(rule);
      wrap.appendChild(slogan);
      wrap.appendChild(meta);
      root.appendChild(wrap);

      this.node = { wrap, mark, name, cells, rule, slogan, meta };
    },

    seek: function (local) {
      const t = local;
      const n = this.node;

      const mp = E.outExpo(U.inv(0.30, 0.62, t));
      n.mark.style.opacity = String(Math.min(1, mp * 1.4));
      n.mark.style.transform = 'scale(' + (2.6 - 1.6 * mp).toFixed(3) + ')';

      for (let i = 0; i < n.cells.length; i++) {
        const p = E.outCubic(U.inv(0.46 + i * 0.045, 0.98 + i * 0.045, t));
        n.cells[i].style.transform = 'translate3d(0,' + ((1 - p) * 106).toFixed(2) + '%,0)';
        n.cells[i].style.opacity = String(0.001 + 0.999 * p);
      }

      const rp = E.outExpo(U.inv(0.92, 1.46, t));
      n.rule.style.transform = 'scaleX(' + rp.toFixed(4) + ')';

      const sp = E.outCubic(U.inv(1.36, 1.90, t));
      n.slogan.style.opacity = String(sp);
      n.slogan.style.transform = 'translate3d(0,' + ((1 - sp) * 12).toFixed(2) + 'px,0)';
      n.slogan.style.letterSpacing = (0.18 - 0.10 * sp).toFixed(3) + 'em';

      const ep = E.outCubic(U.inv(1.62, 2.10, t));
      n.meta.style.opacity = String(ep * 0.85);
    }
  });
})();
