(function () {
  'use strict';
  const C = window.FILM_CONFIG;
  const SC = window.FILM_SCRIPT.s5;
  const S = window.FILM_SCENES = window.FILM_SCENES || [];

  const TILES = SC.tiles;
  const TAGS = SC.tags;

  S.push({
    id: 's5',
    start: 44.5,
    end: 55,

    mount: function (root) {
      const hdr = kit.hdr({ brand: C.brand, sub: C.brandSub }, SC.hdr, true);
      root.appendChild(hdr);
      const hdrRight = hdr.querySelector('.r');

      const copy = kit.el('div', 'copy');
      const vis = kit.cluster('vis-s5');
      root.appendChild(copy);
      root.appendChild(vis);

      const kick = kit.kick(SC.kick);
      kick.style.position = 'absolute';
      kick.style.left = '120px';
      kick.style.top = '186px';
      copy.appendChild(kick);

      const h2 = kit.el('div', 'h2');
      const h2m = kit.maskLine(SC.title);
      h2m.node.classList.add('block');
      h2.appendChild(h2m.node);
      h2.style.position = 'absolute';
      h2.style.left = '120px';
      h2.style.top = '232px';
      copy.appendChild(h2);

      const tags = kit.el('div', 's5-tags');
      const tagNodes = [];
      for (let i = 0; i < TAGS.length; i++) {
        const tg = kit.el('span', 'tag' + (i === 0 ? ' on' : ''), TAGS[i]);
        tags.appendChild(tg);
        tagNodes.push(tg);
      }
      copy.appendChild(tags);

      const tiles = [];
      for (let i = 0; i < TILES.length; i++) {
        const d = TILES[i];
        const node = kit.el('div', 's5-tile');
        node.style.left = (120 + (i % 4) * 344) + 'px';
        node.style.top = (480 + Math.floor(i / 4) * 192) + 'px';
        const fr = kit.frame(d.v);
        node.appendChild(fr);
        const mark = kit.el('div', 'mark');
        node.appendChild(mark);
        const fav = kit.el('div', 'fav');
        node.appendChild(fav);
        const cap = kit.el('div', 'cap');
        cap.appendChild(kit.el('span', null, d.no + '  ' + d.nm));
        cap.appendChild(kit.el('span', null, d.dur));
        node.appendChild(cap);
        node.style.opacity = '0';
        vis.appendChild(node);
        tiles.push({ node: node, mark: mark, fav: fav, match: d.match });
      }

      const index = kit.el('div', 's5-index');
      const big = kit.el('div', 'big');
      big.appendChild(document.createTextNode(SC.index.big));
      big.appendChild(kit.el('em', null, SC.index.unit));
      index.appendChild(big);
      index.appendChild(kit.el('div', 'cap', SC.index.cap));
      SC.index.rows.forEach(function (r) {
        const row = kit.el('div', 'r' + (r[2] ? ' on' : ''));
        row.appendChild(kit.el('span', null, r[0]));
        row.appendChild(kit.el('b', null, r[1]));
        index.appendChild(row);
        if (r[2]) {
          index.favCount = row.querySelector('b');
          index.favBase = parseInt(r[1], 10) || 0;
        }
      });
      index.style.opacity = '0';
      vis.appendChild(index);

      /* ---------- 付印单 ---------- */

      const P = SC.panel;
      const panel = kit.el('div', 's5-panel');
      const wm = kit.el('div', 'wm', P.wm);
      wm.setAttribute('data-decor', '');
      panel.appendChild(wm);
      const pk = kit.kick(P.kick);
      panel.appendChild(pk);
      panel.appendChild(kit.el('h3', null, P.title));
      panel.appendChild(kit.el('div', 'pmeta', P.meta));
      const order = kit.el('div', 'order');
      order.appendChild(kit.el('div', null, P.order.label));
      const orderNo = kit.el('div');
      orderNo.appendChild(kit.el('b', null, P.order.no));
      order.appendChild(orderNo);
      order.appendChild(kit.el('div', null, P.order.date));
      order.appendChild(kit.el('div', null, P.order.time));
      panel.appendChild(order);

      const spec = kit.el('div', 's5-spec');
      const specRows = [];
      for (let i = 0; i < P.specs.length; i++) {
        const row = kit.el('div', 'row');
        row.appendChild(kit.el('span', null, P.specs[i].k));
        row.appendChild(kit.el('b', null, P.specs[i].v));
        row.appendChild(kit.el('em', null, P.specs[i].em));
        row.style.opacity = '0';
        spec.appendChild(row);
        specRows.push(row);
      }
      panel.appendChild(spec);

      const prog = kit.el('div', 's5-prog');
      const top = kit.el('div', 'top');
      const plabel = kit.el('span', null, P.progress.label);
      const pct = kit.el('b', null, '0 %');
      top.appendChild(plabel);
      top.appendChild(pct);
      prog.appendChild(top);
      const track = kit.el('div', 'track');
      const fill = kit.el('div', 'fill');
      track.appendChild(fill);
      prog.appendChild(track);
      const psub = kit.el('div', 'sub');
      psub.appendChild(kit.el('span', null, P.progress.sub));
      const ptime = kit.el('span', null, P.progress.time);
      psub.appendChild(ptime);
      prog.appendChild(psub);
      panel.appendChild(prog);

      const seal = kit.el('div', 's5-seal');
      seal.appendChild(kit.el('b', null, P.seal.title));
      const su = kit.el('u');
      for (let i = 0; i < P.seal.lines.length; i++) {
        if (i > 0) su.appendChild(document.createElement('br'));
        su.appendChild(document.createTextNode(P.seal.lines[i]));
      }
      seal.appendChild(su);
      seal.style.opacity = '0';
      panel.appendChild(seal);

      panel.style.opacity = '0';
      panel.style.transform = 'translate3d(0,720px,0)';
      root.appendChild(panel);

      this.node = {
        hdr: hdr, hdrRight: hdrRight, kick: kick, h2: h2m,
        tagWrap: tags, tags: tagNodes, tiles: tiles, index: index,
        favCount: index.favCount, favBase: index.favBase,
        panel: panel, pk: pk, specRows: specRows, plabel: plabel, pct: pct,
        fill: fill, ptime: ptime, seal: seal
      };
    },

    seek: function (local) {
      const t = local;
      const n = this.node;

      n.hdrRight.textContent = t > 5.95 ? SC.hdrAlt : SC.hdr;

      const hp = E.outCubic(U.inv(-0.3, 0.04, t));
      n.hdr.style.opacity = String(hp);
      n.hdr.style.transform = 'translate3d(0,' + ((1 - hp) * -10).toFixed(2) + 'px,0)';

      const kp = E.outCubic(U.inv(0, 0.36, t));
      n.kick.style.opacity = String(kp);
      n.kick.style.transform = 'translate3d(0,' + ((1 - kp) * 8).toFixed(2) + 'px,0)';

      const h2p = E.outCubic(U.inv(-0.18, 0.46, t));
      n.h2.inner.style.transform = 'translate3d(0,' + ((1 - h2p) * 104).toFixed(2) + '%,0)';

      const tp = E.outCubic(U.inv(0.3, 0.7, t));
      n.tagWrap.style.transform = 'translate3d(0,' + ((1 - tp) * 10).toFixed(2) + 'px,0)';

      const fp = E.outCubic(U.inv(2.6, 3.6, t));
      if (n.tags.length > 1) {
        const alt = Math.min(2, n.tags.length - 1);
        n.tags[0].classList.toggle('on', fp < 0.5);
        n.tags[alt].classList.toggle('on', fp >= 0.5);
      }

      const hide = E.inOutCubic(U.inv(5.75, 6.35, t));
      n.tagWrap.style.opacity = String(tp * (1 - hide));

      for (let i = 0; i < n.tiles.length; i++) {
        const d = n.tiles[i];
        const ent = E.outCubic(U.inv(-0.45 + i * 0.045, 0.1 + i * 0.045, t));
        const dim = d.match ? 1 : 0.15;
        const opa = U.lerp(1, dim, fp);
        const sc = 1 + (d.match ? 0.012 : -0.025) * fp;
        d.node.style.opacity = String(ent * opa * (1 - hide));
        d.node.style.transform =
          'translate3d(0,' + ((1 - ent) * 22).toFixed(2) + 'px,0) scale(' + sc.toFixed(4) + ')';
        d.mark.style.opacity = String(d.match ? fp * 0.85 * ent : 0);
      }

      const ip = E.outCubic(U.inv(0.55, 0.95, t));
      n.index.style.opacity = String(ip * (1 - hide));
      n.index.style.transform = 'translate3d(0,' + ((1 - ip) * 16).toFixed(2) + 'px,0)';

      let favP = 0;
      let fj = 0;
      let matches = 0;
      for (let i = 0; i < n.tiles.length; i++) {
        const d = n.tiles[i];
        if (!d.match) continue;
        const p = E.outCubic(U.inv(4.5 + fj * 0.14, 4.85 + fj * 0.14, t));
        d.fav.style.opacity = String(p);
        d.fav.style.transform = 'scale(' + (0.4 + 0.6 * p).toFixed(3) + ')';
        fj++;
        matches++;
        favP = Math.max(favP, p);
      }
      if (n.favCount) n.favCount.textContent = String(Math.round((n.favBase || 0) + matches * favP));

      const pp = E.outCubic(U.inv(5.9, 6.9, t));
      n.panel.style.opacity = String(pp);
      n.panel.style.transform = 'translate3d(0,' + ((1 - pp) * 720).toFixed(2) + 'px,0)';

      const cp = E.outCubic(U.inv(6.3, 6.7, t));
      n.pk.style.opacity = String(cp);
      n.pk.style.transform = 'translate3d(0,' + ((1 - cp) * 10).toFixed(2) + 'px,0)';

      for (let i = 0; i < n.specRows.length; i++) {
        const sp = E.outCubic(U.inv(6.45 + i * 0.09, 6.85 + i * 0.09, t));
        n.specRows[i].style.opacity = String(sp);
        n.specRows[i].style.transform = 'translate3d(' + ((1 - sp) * 18).toFixed(2) + 'px,0,0)';
      }

      const prp = E.inOutCubic(U.inv(7.6, 9.0, t));
      n.fill.style.width = (prp * 100).toFixed(2) + '%';
      n.pct.textContent = Math.round(prp * 100) + ' %';
      const done = prp > 0.995;
      n.pct.classList.toggle('done', done);
      n.plabel.textContent = done ? SC.panel.progress.done : SC.panel.progress.label;
      n.ptime.textContent = done ? SC.panel.progress.timeDone : SC.panel.progress.time;

      const sp2 = U.inv(9.1, 9.4, t);
      n.seal.style.opacity = String(sp2);
      const ss = 1 + 0.45 * (1 - E.outExpo(sp2));
      n.seal.style.transform = 'rotate(' + (-14 + 6 * E.outCubic(sp2)).toFixed(2) + 'deg) scale(' + ss.toFixed(3) + ')';
    }
  });
})();
