(function () {
  'use strict';
  const C = window.FILM_CONFIG;
  const SC = window.FILM_SCRIPT.s4;
  const S = window.FILM_SCENES = window.FILM_SCENES || [];

  const P = [[70, 250], [300, 250], [640, 60], [946, 60]];

  function bez(u) {
    return [
      E.cubicPoint(u, P[0][0], P[1][0], P[2][0], P[3][0]),
      E.cubicPoint(u, P[0][1], P[1][1], P[2][1], P[3][1])
    ];
  }

  S.push({
    id: 's4',
    start: 33,
    end: 44.5,

    mount: function (root) {
      root.appendChild(kit.hdr({ brand: C.brand, sub: C.brandSub }, SC.hdr, true));

      const copy = kit.el('div', 'copy');
      const vis = kit.cluster('vis-s4');
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

      const sub = kit.el('p', 'sub', SC.sub);
      sub.style.position = 'absolute';
      sub.style.left = '120px';
      sub.style.top = '362px';
      sub.style.width = '560px';
      copy.appendChild(sub);

      const prev = kit.el('div', 's4-prev');
      const pframe = kit.el('div', 'pframe');
      pframe.appendChild(kit.frame(3, '003'));
      prev.appendChild(pframe);
      const pcap = kit.el('div', 'pcap');
      pcap.appendChild(kit.el('span', null, SC.preview.label));
      const pval = kit.el('span', null, '');
      pcap.appendChild(pval);
      prev.appendChild(pcap);
      ['tl', 'tr', 'bl', 'br'].forEach(function (k) {
        const c = kit.el('div', 'crop ' + k);
        c.style.left = (k[1] === 'l' ? '8px' : 'auto');
        c.style.right = (k[1] === 'r' ? '8px' : 'auto');
        c.style.top = (k[0] === 't' ? '8px' : 'auto');
        c.style.bottom = (k[0] === 'b' ? '8px' : 'auto');
        prev.appendChild(c);
      });
      vis.appendChild(prev);

      /* ---------- 曲线卡 ---------- */

      const card = kit.el('div', 's4-card');
      const chead = kit.el('div', 's4-chead');
      const cl = kit.el('span');
      cl.appendChild(kit.el('b', null, SC.curve.title));
      chead.appendChild(cl);
      chead.appendChild(kit.el('span', null, SC.curve.meta));
      card.appendChild(chead);

      const plot = kit.el('div', 's4-plot');
      const svg = U.svg('svg', { width: 1016, height: 300, viewBox: '0 0 1016 300' });
      const areaD = 'M' + P[0][0] + ',' + P[0][1] +
        ' C' + P[1][0] + ',' + P[1][1] + ' ' + P[2][0] + ',' + P[2][1] + ' ' + P[3][0] + ',' + P[3][1] +
        ' L' + P[3][0] + ',250 L' + P[0][0] + ',250 Z';
      const area = U.svg('path', { d: areaD, fill: 'color-mix(in srgb, var(--accent) 5%, transparent)', opacity: 0 });
      svg.appendChild(area);

      const h1 = U.svg('line', { x1: P[0][0], y1: P[0][1], x2: P[1][0], y2: P[1][1], stroke: 'color-mix(in srgb, var(--ink) 28%, transparent)', 'stroke-width': 1, 'stroke-dasharray': '4 4' });
      const h2l = U.svg('line', { x1: P[3][0], y1: P[3][1], x2: P[2][0], y2: P[2][1], stroke: 'color-mix(in srgb, var(--ink) 28%, transparent)', 'stroke-width': 1, 'stroke-dasharray': '4 4' });
      svg.appendChild(h1);
      svg.appendChild(h2l);
      const c1 = U.svg('circle', { cx: P[1][0], cy: P[1][1], r: 4, fill: 'var(--paper-2)', stroke: 'color-mix(in srgb, var(--ink) 40%, transparent)', 'stroke-width': 1 });
      const c2 = U.svg('circle', { cx: P[2][0], cy: P[2][1], r: 4, fill: 'var(--paper-2)', stroke: 'color-mix(in srgb, var(--ink) 40%, transparent)', 'stroke-width': 1 });
      svg.appendChild(c1);
      svg.appendChild(c2);

      const path = U.svg('path', {
        d: 'M' + P[0][0] + ',' + P[0][1] + ' C' + P[1][0] + ',' + P[1][1] + ' ' + P[2][0] + ',' + P[2][1] + ' ' + P[3][0] + ',' + P[3][1],
        fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linecap': 'round'
      });
      svg.appendChild(path);

      const gx = U.svg('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: 'color-mix(in srgb, var(--accent) 40%, transparent)', 'stroke-width': 1, 'stroke-dasharray': '2 4', opacity: 0 });
      const gy = U.svg('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: 'color-mix(in srgb, var(--accent) 40%, transparent)', 'stroke-width': 1, 'stroke-dasharray': '2 4', opacity: 0 });
      svg.appendChild(gx);
      svg.appendChild(gy);

      const k0 = U.svg('rect', { x: P[0][0] - 7, y: P[0][1] - 7, width: 14, height: 14, fill: 'var(--accent)' });
      const k1 = U.svg('rect', { x: P[3][0] - 7, y: P[3][1] - 7, width: 14, height: 14, fill: 'var(--paper-2)', stroke: 'var(--accent)', 'stroke-width': 2 });
      svg.appendChild(k0);
      svg.appendChild(k1);

      const dot = U.svg('circle', { cx: P[0][0], cy: P[0][1], r: 8, fill: 'var(--accent)', stroke: 'var(--paper-2)', 'stroke-width': 3 });
      svg.appendChild(dot);

      const xa = U.svg('text', { x: 70, y: 284, fill: 'color-mix(in srgb, var(--ink) 40%, transparent)', 'font-size': 9, 'letter-spacing': 2, 'font-family': 'SF Mono, Menlo, monospace' });
      xa.textContent = SC.keyTimes[0];
      const xb = U.svg('text', { x: 946, y: 284, fill: 'color-mix(in srgb, var(--ink) 40%, transparent)', 'font-size': 9, 'letter-spacing': 2, 'text-anchor': 'end', 'font-family': 'SF Mono, Menlo, monospace' });
      xb.textContent = SC.keyTimes[1];
      svg.appendChild(xa);
      svg.appendChild(xb);

      plot.appendChild(svg);
      card.appendChild(plot);

      const read = kit.el('div', 's4-read');
      const chips = [];
      for (let i = 0; i < SC.chips.length; i++) {
        const c = SC.chips[i];
        const chip = kit.el('div', 's4-chip');
        chip.appendChild(kit.el('span', null, c.k));
        const b = kit.el('b', null, c.base.toFixed(c.decimals) + c.suffix);
        chip.appendChild(b);
        read.appendChild(chip);
        chips.push(b);
      }
      card.appendChild(read);

      const foot = kit.el('div', 's4-foot');
      foot.appendChild(kit.el('span', null, SC.foot[0]));
      foot.appendChild(kit.el('span', null, SC.foot[1]));
      card.appendChild(foot);

      card.style.opacity = '0';
      vis.appendChild(card);

      /* ---------- 转场条 ---------- */

      const strip = kit.el('div', 's4-trans');
      const fa = kit.el('div', 'tf a');
      const fA = kit.frame(2, '');
      fa.appendChild(fA);
      fa.appendChild(kit.el('span', 'lb', SC.transition.a));
      const fb = kit.el('div', 'tf b');
      const fB = kit.frame(5, '');
      fb.appendChild(fB);
      fb.appendChild(kit.el('span', 'lb', SC.transition.b));
      const sw = kit.el('div', 'sw');
      const swtag = kit.el('div', 'swtag', SC.transition.tag);
      strip.appendChild(fa);
      strip.appendChild(fb);
      strip.appendChild(sw);
      strip.appendChild(swtag);
      strip.style.opacity = '0';
      vis.appendChild(strip);

      /* ---------- 弧长表 ---------- */

      const SAMPLES = [];
      let acc = 0;
      let lastPt = null;
      for (let i = 0; i <= 120; i++) {
        const u = i / 120;
        const p = bez(u);
        if (lastPt) acc += Math.sqrt(Math.pow(p[0] - lastPt[0], 2) + Math.pow(p[1] - lastPt[1], 2));
        SAMPLES.push({ u: u, len: acc });
        lastPt = p;
      }
      const totalLen = acc;

      this.node = {
        hdr: root.querySelector('.hdr'), kick: kick, h2: h2m, sub: sub,
        prev: prev, pframe: pframe, pval: pval,
        card: card, path: path, area: area, dot: dot, gx: gx, gy: gy, k0: k0, k1: k1,
        c1: c1, c2: c2, h1: h1, h2l: h2l,
        chips: chips, strip: strip, sw: sw, swtag: swtag,
        samples: SAMPLES, totalLen: totalLen
      };
      this.ready = false;
    },

    seek: function (local) {
      const t = local;
      const n = this.node;

      if (!this.ready) {
        const len = n.path.getTotalLength();
        n.path.style.strokeDasharray = String(len);
        n.path.style.strokeDashoffset = String(len);
        this.len = len;
        this.ready = true;
      }

      const hp = E.outCubic(U.inv(-0.3, 0.04, t));
      n.hdr.style.opacity = String(hp);
      n.hdr.style.transform = 'translate3d(0,' + ((1 - hp) * -10).toFixed(2) + 'px,0)';

      const kp = E.outCubic(U.inv(0.02, 0.38, t));
      n.kick.style.opacity = String(kp);
      n.kick.style.transform = 'translate3d(0,' + ((1 - kp) * 8).toFixed(2) + 'px,0)';

      const h2p = E.outCubic(U.inv(-0.12, 0.42, t));
      n.h2.inner.style.transform = 'translate3d(0,' + ((1 - h2p) * 104).toFixed(2) + '%,0)';
      const sp = E.outCubic(U.inv(0.52, 0.94, t));
      n.sub.style.opacity = String(sp);
      n.sub.style.transform = 'translate3d(0,' + ((1 - sp) * 10).toFixed(2) + 'px,0)';

      const cp = E.outCubic(U.inv(-0.35, 0.3, t));
      const cs = E.outCubic(U.inv(0, 0.85, t));
      n.card.style.opacity = String(cp);
      n.card.style.transform = 'translate3d(0,' + ((1 - cs) * 24).toFixed(2) + 'px,0)';

      const pp = E.outCubic(U.inv(0.12, 0.7, t));
      n.prev.style.opacity = String(pp);
      n.prev.style.transform = 'translate3d(0,' + ((1 - pp) * 20).toFixed(2) + 'px,0)';

      const kf = E.outCubic(U.inv(0.55, 1.05, t));
      n.k0.setAttribute('opacity', String(kf));
      n.k1.setAttribute('opacity', String(kf));
      n.c1.setAttribute('opacity', String(kf * 0.85));
      n.c2.setAttribute('opacity', String(kf * 0.85));
      n.h1.setAttribute('opacity', String(kf * 0.7));
      n.h2l.setAttribute('opacity', String(kf * 0.7));

      const dp = E.inOutCubic(U.inv(4.4, 6.3, t));
      n.path.style.strokeDashoffset = String((1 - dp) * this.len);

      const frac = dp;
      let u = 0;
      const sm = n.samples;
      for (let i = 1; i < sm.length; i++) {
        if (sm[i].len / n.totalLen >= frac) {
          const t0 = sm[i - 1].len / n.totalLen;
          const t1 = sm[i].len / n.totalLen;
          const k = t1 > t0 ? (frac - t0) / (t1 - t0) : 0;
          u = U.lerp(sm[i - 1].u, sm[i].u, k);
          break;
        }
        u = 1;
      }
      if (frac <= 0) u = 0;

      const pt = bez(u);
      const prog = (250 - pt[1]) / 190;
      n.dot.setAttribute('cx', pt[0].toFixed(2));
      n.dot.setAttribute('cy', pt[1].toFixed(2));

      const showGuide = dp > 0.01 ? 1 : 0;
      n.gx.setAttribute('opacity', String(showGuide * 0.9));
      n.gy.setAttribute('opacity', String(showGuide * 0.9));
      n.gx.setAttribute('x1', pt[0]);
      n.gx.setAttribute('x2', pt[0]);
      n.gx.setAttribute('y1', pt[1]);
      n.gx.setAttribute('y2', 250);
      n.gy.setAttribute('x1', 70);
      n.gy.setAttribute('x2', pt[0]);
      n.gy.setAttribute('y1', pt[1]);
      n.gy.setAttribute('y2', pt[1]);

      const ap = E.outCubic(U.inv(6.15, 6.85, t));
      n.area.setAttribute('opacity', String(ap));

      for (let i = 0; i < n.chips.length; i++) {
        const c = SC.chips[i];
        n.chips[i].textContent = (c.base + c.delta * prog).toFixed(c.decimals) + c.suffix;
      }

      const scChip = SC.chips[0];
      const xChip = SC.chips[1];
      const xNow = xChip.delta * prog;
      n.pframe.style.transform =
        'translate3d(' + (-xNow).toFixed(2) + 'px,0,0) scale(' + (1 + (scChip.delta / 100) * prog).toFixed(4) + ')';
      n.pframe.style.opacity = String(1 - (Math.abs(SC.chips[2].delta) / 100) * prog);
      n.pval.textContent =
        SC.preview.xLabel + Math.abs(xNow).toFixed(0) + ' · ' +
        (scChip.base + scChip.delta * prog).toFixed(scChip.decimals) + SC.preview.scaleUnit;

      const tp = E.outCubic(U.inv(6.75, 7.15, t));
      n.strip.style.opacity = String(tp);
      const swp = E.inOutCubic(U.inv(7.15, 8.85, t));
      const sx = 464 + 136 * swp;
      n.sw.style.left = sx.toFixed(1) + 'px';
      n.swtag.style.left = (sx - 150).toFixed(1) + 'px';
    }
  });
})();
