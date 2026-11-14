(function () {
  'use strict';
  const C = window.FILM_CONFIG;
  const SC = window.FILM_SCRIPT.s1;
  const S = window.FILM_SCENES = window.FILM_SCENES || [];

  const CARDS = [
    { cx: 980, cy: 310, rot: -6, v: 1 },
    { cx: 1230, cy: 300, rot: 4, v: 2 },
    { cx: 1470, cy: 340, rot: -2, v: 3 },
    { cx: 1684, cy: 300, rot: 7, v: 7 },
    { cx: 930, cy: 580, rot: 5, v: 5 },
    { cx: 1180, cy: 590, rot: -4, v: 4 },
    { cx: 1430, cy: 570, rot: 3, v: 6 },
    { cx: 1660, cy: 600, rot: -7, v: 8 }
  ];

  const NOTES = SC.notes.map(function (n, i) {
    const ex = [836, 786, 1036][i % 3];
    const ey = [386, 600, 646][i % 3];
    return { no: n.no, text: n.text, x: 410, y: 628 + i * 64, ex: ex, ey: ey };
  });

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  S.push({
    id: 's1',
    start: 3,
    end: 10,

    mount: function (root) {
      const hdr = kit.hdr({ brand: C.brand, sub: C.brandSub }, SC.hdr, true);
      root.appendChild(hdr);

      const lead = kit.el('div', 's1-lead');
      const kick = kit.kick(SC.kick);
      const h2 = kit.el('div', 'h2');
      const l1 = kit.maskLine(SC.title[0]);
      const l2 = kit.maskLine(SC.title[1]);
      l1.node.classList.add('block');
      l2.node.classList.add('block');
      h2.appendChild(l1.node);
      h2.appendChild(l2.node);
      const sub = kit.el('p', 'sub', SC.sub);
      lead.appendChild(kick);
      lead.appendChild(h2);
      lead.appendChild(sub);
      root.appendChild(lead);

      const vis = kit.cluster('vis-s1');
      root.appendChild(vis);

      const rng = U.mulberry32(0x1B0A3C);
      const cards = [];
      for (let i = 0; i < CARDS.length; i++) {
        const c = CARDS[i];
        const node = kit.el('div', 's1-card');
        node.style.left = (c.cx - 140) + 'px';
        node.style.top = (c.cy - 93) + 'px';
        node.style.zIndex = String(2 + i);
        node.style.opacity = '0';
        node.appendChild(kit.frame(c.v, SC.cards[i % SC.cards.length]));
        vis.appendChild(node);
        cards.push({
          node: node,
          cx: c.cx, cy: c.cy, rot: c.rot,
          dx: (rng() * 2 - 1) * 300,
          dy: (rng() * 2 - 1) * 260,
          dr: (rng() * 2 - 1) * 13,
          d: i * 0.16
        });
      }

      const svg = U.svg('svg', { class: 's1-lines', viewBox: '0 0 1920 1080' });
      const lines = [];
      const notes = [];
      const noteWrap = kit.el('div', 's1-notes');
      for (let i = 0; i < NOTES.length; i++) {
        const n = NOTES[i];
        const ln = U.svg('line', { x1: n.x, y1: n.y, x2: n.ex, y2: n.ey });
        svg.appendChild(ln);
        lines.push({ node: ln, len: Math.sqrt(Math.pow(n.ex - n.x, 2) + Math.pow(n.ey - n.y, 2)) });
        const dot = U.svg('circle', { cx: n.ex, cy: n.ey, r: 3 });
        svg.appendChild(dot);
        lines[i].dot = dot;

        const row = kit.el('div', 's1-note');
        row.style.opacity = '0';
        row.appendChild(kit.el('b', null, n.no));
        row.appendChild(kit.el('i'));
        row.appendChild(kit.el('span', null, n.text));
        noteWrap.appendChild(row);
        notes.push(row);
      }
      vis.appendChild(svg);
      vis.appendChild(noteWrap);

      const gauge = kit.el('div', 's1-gauge');
      const lb = kit.el('div', 'lb', SC.gauge.label);
      const val = kit.el('div', 'val', '');
      const track = kit.el('div', 'track');
      const fill = kit.el('div', 'fill');
      const capL = kit.el('div', 'cap');
      const capR = kit.el('div', 'cap');
      gauge.appendChild(fill);
      gauge.appendChild(lb);
      gauge.appendChild(val);
      gauge.appendChild(track);
      gauge.appendChild(capL);
      gauge.appendChild(capR);
      vis.appendChild(gauge);

      this.node = { hdr, kick, l1, l2, sub, cards, lines, notes, gauge, fill, val, capL, capR };
    },

    seek: function (local) {
      const t = local;
      const n = this.node;

      const hp = E.outCubic(U.inv(-0.3, 0.04, t));
      n.hdr.style.opacity = String(hp);
      n.hdr.style.transform = 'translate3d(0,' + ((1 - hp) * -10).toFixed(2) + 'px,0)';

      const kp = E.outCubic(U.inv(0.08, 0.5, t));
      n.kick.style.opacity = String(kp);
      n.kick.style.transform = 'translate3d(0,' + ((1 - kp) * 8).toFixed(2) + 'px,0)';

      const p1 = E.outCubic(U.inv(0.18, 0.62, t));
      const p2 = E.outCubic(U.inv(0.30, 0.74, t));
      n.l1.inner.style.transform = 'translate3d(0,' + ((1 - p1) * 104).toFixed(2) + '%,0)';
      n.l2.inner.style.transform = 'translate3d(0,' + ((1 - p2) * 104).toFixed(2) + '%,0)';

      const sp = E.outCubic(U.inv(0.62, 1.02, t));
      n.sub.style.opacity = String(sp);
      n.sub.style.transform = 'translate3d(0,' + ((1 - sp) * 10).toFixed(2) + 'px,0)';

      for (let i = 0; i < n.cards.length; i++) {
        const d = n.cards[i];
        const p = E.outCubic(U.inv(0.30 + d.d, 1.02 + d.d, t));
        const bp = E.backOut(U.clamp(U.inv(0.30 + d.d, 1.10 + d.d, t), 0, 1));
        const dx = d.dx * (1 - p);
        const dy = d.dy * (1 - p);
        const rot = d.rot + d.dr * (1 - p);
        const sc = 1 + 0.15 * (1 - bp);
        d.node.style.transform =
          'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0) ' +
          'rotate(' + rot.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
        const op = U.inv(0.30 + d.d, 0.52 + d.d, t);
        d.node.style.opacity = String(op);
      }

      for (let i = 0; i < n.notes.length; i++) {
        const np = E.outCubic(U.inv(3.55 + i * 0.55, 3.95 + i * 0.55, t));
        n.notes[i].style.opacity = String(np);
        n.notes[i].style.transform = 'translate3d(' + ((1 - np) * -16).toFixed(2) + 'px,0,0)';

        const lp = E.outCubic(U.inv(3.75 + i * 0.55, 4.35 + i * 0.55, t));
        const ln = n.lines[i];
        ln.node.style.strokeDasharray = String(ln.len);
        ln.node.style.strokeDashoffset = String((1 - lp) * ln.len);
        ln.dot.style.opacity = String(lp);
        ln.dot.style.transform = 'scale(' + (0.4 + 0.6 * lp).toFixed(3) + ')';
        ln.dot.style.transformOrigin = n.x + 'px ' + n.y + 'px';
      }

      const gp = E.outCubic(U.inv(5.15, 5.5, t));
      n.gauge.style.opacity = String(gp);

      const sq = E.inOutCubic(U.inv(5.45, 6.90, t));
      const w = 1164 * (1 - 0.72 * sq);
      const left = (1164 - w) / 2;
      n.fill.style.left = left.toFixed(1) + 'px';
      n.fill.style.width = w.toFixed(1) + 'px';
      n.capL.style.left = left.toFixed(1) + 'px';
      n.capR.style.left = (left + w - 1).toFixed(1) + 'px';
      n.val.textContent = fmt(U.lerp(SC.gauge.from, SC.gauge.to, sq));
    }
  });
})();
