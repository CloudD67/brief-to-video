(function () {
  'use strict';
  const C = window.FILM_CONFIG;
  const SC = window.FILM_SCRIPT.s6;
  const S = window.FILM_SCENES = window.FILM_SCENES || [];

  const CARDS = SC.cards;

  S.push({
    id: 's6',
    start: 55,
    end: 60,

    mount: function (root) {
      root.appendChild(kit.hdr({ brand: C.brand, sub: C.brandSub }, SC.hdrRight, true));

      ['tl', 'tr', 'bl', 'br'].forEach(function (k) {
        const c = kit.el('div', 'crop ' + k);
        c.style.left = (k[1] === 'l' ? '96px' : 'auto');
        c.style.right = (k[1] === 'r' ? '96px' : 'auto');
        c.style.top = (k[0] === 't' ? '96px' : 'auto');
        c.style.bottom = (k[0] === 'b' ? '96px' : 'auto');
        c.style.opacity = '0.7';
        root.appendChild(c);
      });

      const wrap = kit.el('div', 's6-wrap');
      const mark = kit.el('div', 's6-mark');
      const name = kit.el('div', 's6-name');
      const split = window.FILM_LAYOUT === 'split' && C.width >= C.height;
      const availW = C.width < C.height ? C.width - 128 : (split ? 624 : 1704);
      name.style.fontSize = Math.min(128, Math.floor(availW / (Math.max(1, C.title.length) * 1.02))) + 'px';
      const nameMask = kit.maskLine(C.title);
      name.appendChild(nameMask.node);
      const rule = kit.el('div', 's6-rule');
      const slogan = kit.el('div', 's6-slogan', C.slogan);
      slogan.style.fontSize = Math.min(38, Math.floor(availW / (Math.max(1, C.slogan.length) * 1.14))) + 'px';
      wrap.appendChild(mark);
      wrap.appendChild(name);
      wrap.appendChild(rule);
      wrap.appendChild(slogan);
      root.appendChild(wrap);

      const vis = kit.cluster('vis-s6');
      root.appendChild(vis);
      const cards = kit.el('div', 's6-cards');
      const items = [];
      for (let i = 0; i < CARDS.length; i++) {
        const d = CARDS[i];
        const card = kit.el('div', 's6-card');
        const no = kit.el('span', 'no', d.no + ' — ');
        no.style.color = 'var(--red)';
        card.appendChild(no);
        card.appendChild(kit.el('span', 'en', d.en));
        card.appendChild(kit.el('span', 'nm', d.nm));
        const fr = kit.frame(d.v);
        card.appendChild(fr);
        card.style.opacity = '0';
        cards.appendChild(card);
        items.push(card);
      }
      vis.appendChild(cards);

      const foot = kit.el('div', 's6-foot');
      foot.appendChild(kit.el('span', null, SC.footer));
      const fr = kit.el('span');
      fr.appendChild(document.createTextNode(SC.footerEnd));
      fr.appendChild(kit.el('em', null, C.duration + ' SEC'));
      foot.appendChild(fr);
      root.appendChild(foot);

      this.node = {
        hdr: root.querySelector('.hdr'), mark: mark, nameMask: nameMask,
        rule: rule, slogan: slogan, items: items, foot: foot
      };
    },

    seek: function (local) {
      const t = local;
      const n = this.node;

      const hp = E.outCubic(U.inv(-0.3, 0.04, t));
      n.hdr.style.opacity = String(hp);
      n.hdr.style.transform = 'translate3d(0,' + ((1 - hp) * -10).toFixed(2) + 'px,0)';

      const mp = E.outExpo(U.inv(-0.02, 0.16, t));
      n.mark.style.opacity = String(mp);
      n.mark.style.transform = 'scale(' + (2.2 - 1.2 * mp).toFixed(3) + ')';

      const np = E.outCubic(U.inv(0.10, 0.64, t));
      n.nameMask.inner.style.transform = 'translate3d(0,' + ((1 - np) * 106).toFixed(2) + '%,0)';

      const rp = E.outExpo(U.inv(0.52, 0.98, t));
      n.rule.style.transform = 'scaleX(' + rp.toFixed(4) + ')';

      const sp = E.outCubic(U.inv(0.72, 1.20, t));
      n.slogan.style.opacity = String(sp);
      n.slogan.style.transform = 'translate3d(0,' + ((1 - sp) * 12).toFixed(2) + 'px,0)';

      for (let i = 0; i < n.items.length; i++) {
        const p = E.outCubic(U.inv(0.95 + i * 0.13, 1.45 + i * 0.13, t));
        n.items[i].style.opacity = String(p);
        n.items[i].style.transform = 'translate3d(0,' + ((1 - p) * 44).toFixed(2) + 'px,0)';
      }

      const fp = E.outCubic(U.inv(1.5, 1.9, t));
      n.foot.style.opacity = String(fp);
      n.foot.style.transform = 'translate3d(0,' + ((1 - fp) * 10).toFixed(2) + 'px,0)';
    }
  });
})();
