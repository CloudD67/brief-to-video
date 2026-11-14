(function () {
  'use strict';
  const C = window.FILM_CONFIG;
  const SC = window.FILM_SCRIPT.s2;
  const S = window.FILM_SCENES = window.FILM_SCENES || [];

  const LANES = SC.lanes;

  const RULER = [];
  for (let i = 0; i <= 8; i++) {
    const s = i * 2;
    RULER.push({ x: i * 80, label: '00:' + (s < 10 ? '0' : '') + s });
  }

  function waveBars(host, w, seed, hMax) {
    const rng = U.mulberry32(seed);
    const n = Math.max(16, Math.floor((w - 14) / 4));
    for (let i = 0; i < n; i++) {
      const b = document.createElement('i');
      const env = 0.42 + 0.58 * Math.abs(Math.sin(i * 0.19 + seed * 0.001));
      b.style.height = (4 + hMax * env * (0.35 + 0.65 * rng())).toFixed(1) + 'px';
      host.appendChild(b);
    }
  }

  S.push({
    id: 's2',
    start: 10,
    end: 21.5,

    mount: function (root) {
      root.appendChild(kit.hdr({ brand: C.brand, sub: C.brandSub }, SC.hdr, true));

      const lead = kit.el('div', 's2-lead');
      const kick = kit.kick(SC.kick);
      const h2 = kit.el('div', 'h2');
      const h2m = kit.maskLine(SC.title);
      h2m.node.classList.add('block');
      h2.appendChild(h2m.node);
      const sub = kit.el('p', 'sub', SC.sub);
      lead.appendChild(kick);
      lead.appendChild(h2);
      lead.appendChild(sub);
      root.appendChild(lead);

      const legend = kit.el('div', 's2-leg');
      const lrows = [];
      for (let i = 0; i < LANES.length; i++) {
        const row = kit.el('div', 's2-lrow');
        row.appendChild(kit.el('b', null, LANES[i].k.toUpperCase()));
        row.appendChild(kit.el('span', null, LANES[i].name));
        row.appendChild(kit.el('em', null, LANES[i].tail));
        row.style.opacity = '0';
        legend.appendChild(row);
        lrows.push(row);
      }
      root.appendChild(legend);

      /* ---------- 编辑器 ---------- */

      const ed = kit.el('div', 'ed');
      const bar = kit.el('div', 'ed-bar');
      const dots = kit.el('div', 'dots');
      dots.appendChild(kit.el('i'));
      dots.appendChild(kit.el('i'));
      dots.appendChild(kit.el('i'));
      bar.appendChild(dots);
      bar.appendChild(kit.el('span', 'file', SC.file));
      bar.appendChild(kit.el('span', 'save', SC.save));
      bar.appendChild(kit.el('span', 'tc', SC.tc));
      ed.appendChild(bar);

      const body = kit.el('div', 'ed-body');
      const heads = kit.el('div', 'ed-heads');
      heads.appendChild(kit.el('div', 'k', 'TC'));
      body.appendChild(heads);
      const lanes = kit.el('div', 'ed-lanes');
      const ruler = kit.el('div', 'ed-ruler');
      for (let i = 0; i < RULER.length; i++) {
        const r = RULER[i];
        const tick = kit.el('i', r.x % 160 === 0 ? 'big' : '');
        tick.style.left = r.x + 'px';
        ruler.appendChild(tick);
        if (!(r.x > 460 && r.x < 620)) {
          const lb = kit.el('span', null, r.label);
          lb.style.left = r.x + 'px';
          if (i > 0) lb.style.transform = 'translateX(-50%)';
          else lb.style.left = '7px';
          ruler.appendChild(lb);
        }
      }
      lanes.appendChild(ruler);

      const clips = [];
      let sel = null;
      let selDur = null;

      for (let li = 0; li < LANES.length; li++) {
        const lane = LANES[li];
        const th = kit.el('div', 't ' + lane.k);
        th.style.height = lane.h + 'px';
        th.appendChild(kit.el('b', null, lane.k.toUpperCase()));
        th.appendChild(kit.el('span', null, lane.name));
        heads.appendChild(th);

        const row = kit.el('div', 'ed-row ' + lane.k);
        row.style.height = lane.h + 'px';
        for (let ci = 0; ci < lane.clips.length; ci++) {
          const c = lane.clips[ci];
          let node;
          let durNode = null;
          if (c.text) {
            node = kit.el('div', 'ed-cap', c.text);
            node.style.left = c.x + 'px';
            node.style.width = c.w + 'px';
          } else {
            node = kit.el('div', 'ed-clip' + (c.audio ? ' audio' : '') + (c.sel ? ' sel' : ''));
            node.style.left = c.x + 'px';
            node.style.width = c.w + 'px';
            if (!c.audio) node.appendChild(kit.el('div', 'pic'));
            node.appendChild(kit.el('span', 'no', c.no));
            node.appendChild(kit.el('span', 'nm', c.nm));
            if (c.audio) {
              const wv = kit.el('div', 'ed-wave');
              waveBars(wv, c.w, 0x51A0 + li * 97 + ci * 31, c.no.indexOf('A2') === 0 ? 20 : 34);
              node.appendChild(wv);
            } else {
              durNode = kit.el('span', 'dur', c.dur);
              node.appendChild(durNode);
            }
          }
          node.style.opacity = '0';
          row.appendChild(node);
          const rec = {
            node: node, x: c.x, w: c.w, rip: c.rip || 0,
            li: li, ci: ci, sel: !!c.sel, durNode: durNode
          };
          clips.push(rec);
          if (c.sel) { sel = rec; selDur = durNode; }
        }
        lanes.appendChild(row);
      }

      const ph = kit.el('div', 'ed-playhead');
      ph.appendChild(kit.el('span', 'tag', SC.tc));
      lanes.appendChild(ph);

      const gSnap = kit.el('div', 'ed-guide');
      gSnap.style.left = '146px';
      lanes.appendChild(gSnap);

      const gRip = kit.el('div', 'ed-guide');
      lanes.appendChild(gRip);

      body.appendChild(lanes);

      const insp = kit.el('aside', 'ed-insp');
      function section(title) {
        insp.appendChild(kit.el('h4', null, title));
      }
      function kv(label, value, cls) {
        const row = kit.el('div', 'kv');
        row.appendChild(kit.el('span', null, label));
        const b = kit.el('b', cls || '', value);
        row.appendChild(b);
        insp.appendChild(row);
        return b;
      }
      const keyed = {};
      for (let i = 0; i < SC.inspector.length; i++) {
        const grp = SC.inspector[i];
        section(grp.title);
        for (let j = 0; j < grp.rows.length; j++) {
          const row = grp.rows[j];
          const b = kv(row.k, row.v, row.cls);
          if (row.key) keyed[row.key] = b;
        }
      }
      body.appendChild(insp);
      const kPos = keyed.pos;
      const kOut = keyed.out;
      const kDur = keyed.dur;
      const kRip = keyed.rip;

      ed.appendChild(body);
      ed.appendChild(kit.el('div', 'ed-rough'));
      ed.style.opacity = '0';
      const vis = kit.cluster('vis-s2');
      vis.appendChild(ed);
      root.appendChild(vis);

      this.node = {
        hdr: root.querySelector('.hdr'),
        kick: kick, h2: h2m, sub: sub,
        lrows: lrows, ed: ed, clips: clips, sel: sel, selDur: selDur,
        gSnap: gSnap, gRip: gRip,
        kPos: kPos, kOut: kOut, kDur: kDur, kRip: kRip
      };
    },

    seek: function (local) {
      const t = local;
      const n = this.node;

      const hp = E.outCubic(U.inv(-0.3, 0.04, t));
      n.hdr.style.opacity = String(hp);
      n.hdr.style.transform = 'translate3d(0,' + ((1 - hp) * -10).toFixed(2) + 'px,0)';

      const kp = E.outCubic(U.inv(0.12, 0.52, t));
      n.kick.style.opacity = String(kp);
      n.kick.style.transform = 'translate3d(0,' + ((1 - kp) * 8).toFixed(2) + 'px,0)';

      const p2 = E.outCubic(U.inv(0.24, 0.74, t));
      n.h2.inner.style.transform = 'translate3d(0,' + ((1 - p2) * 104).toFixed(2) + '%,0)';

      const sp = E.outCubic(U.inv(0.58, 1.0, t));
      n.sub.style.opacity = String(sp);
      n.sub.style.transform = 'translate3d(0,' + ((1 - sp) * 10).toFixed(2) + 'px,0)';

      const ep = E.outCubic(U.inv(-0.4, 0.3, t));
      const es = E.outCubic(U.inv(0, 0.9, t));
      const push = E.outCubic(U.inv(7.8, 11.5, t));
      n.ed.style.opacity = String(ep);
      n.ed.style.transform =
        'translate3d(' + ((1 - es) * -90).toFixed(2) + 'px,0,0) scale(' + (1 + 0.012 * push).toFixed(4) + ')';

      for (let i = 0; i < n.lrows.length; i++) {
        const lp = E.outCubic(U.inv(1.32 + i * 0.26, 1.68 + i * 0.26, t));
        n.lrows[i].style.opacity = String(lp);
        n.lrows[i].style.transform = 'translate3d(' + ((1 - lp) * 18).toFixed(2) + 'px,0,0)';
      }

      const dragP = E.inOutCubic(U.inv(4.0, 5.2, t));
      const trimP = E.inOutCubic(U.inv(5.3, 6.05, t));
      const ripP = E.inOutCubic(U.inv(6.15, 7.35, t));

      const selX = 156 - 10 * dragP;
      const selW = 144 - 40 * trimP;
      n.sel.node.style.left = selX.toFixed(2) + 'px';
      n.sel.node.style.width = selW.toFixed(2) + 'px';

      for (let i = 0; i < n.clips.length; i++) {
        const c = n.clips[i];
        const start = 1.2 + c.li * 0.26 + c.ci * 0.05;
        const cp = E.outCubic(U.inv(start, start + 0.5, t));
        c.node.style.opacity = String(cp);
        c.node.style.clipPath = c.node.classList.contains('ed-cap')
          ? 'none'
          : 'inset(0 ' + ((1 - cp) * 100).toFixed(2) + '% 0 0)';
        if (c.rip) {
          c.node.style.transform = 'translate3d(' + (c.rip * ripP).toFixed(2) + 'px,0,0)';
        }
        if (c.node.classList.contains('ed-cap')) {
          c.node.style.transform = 'translate3d(0,' + ((1 - cp) * 8).toFixed(2) + 'px,0)';
        }
      }

      const snapIn = E.outCubic(U.inv(4.75, 5.0, t)) * (1 - E.outCubic(U.inv(6.05, 6.4, t)));
      n.gSnap.style.opacity = String(snapIn);

      const ripIn = E.outCubic(U.inv(6.05, 6.3, t)) * (1 - E.outCubic(U.inv(7.6, 7.95, t)));
      n.gRip.style.opacity = String(ripIn);
      n.gRip.style.left = (340 - 40 * ripP).toFixed(1) + 'px';

      const dyn = SC.dynamics;
      n.kPos.textContent = dragP > 0.01 ? dyn.pos.moved : dyn.pos.base;
      n.kPos.classList.toggle('hot', dragP > 0.01);
      n.kDur.textContent = trimP > 0.5 ? dyn.dur.trimmed : dyn.dur.base;
      n.kDur.classList.toggle('hot', trimP > 0.01);
      n.kOut.textContent = trimP > 0.5 ? dyn.out.trimmed : dyn.out.base;
      n.kRip.textContent = ripP > 0.01 ? dyn.rip.moved : dyn.rip.base;
      n.kRip.classList.toggle('hot', ripP > 0.01);

      if (n.selDur) n.selDur.textContent = trimP > 0.5 ? dyn.dur.trimmed : dyn.dur.base;
    }
  });
})();
