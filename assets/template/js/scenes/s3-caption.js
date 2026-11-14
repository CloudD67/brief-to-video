(function () {
  'use strict';
  const C = window.FILM_CONFIG;
  const SC = window.FILM_SCRIPT.s3;
  const S = window.FILM_SCENES = window.FILM_SCENES || [];

  const LINES = SC.headline;
  const CUES = SC.cues;

  function buildWave(host, seed) {
    const rng = U.mulberry32(seed);
    for (let i = 0; i < 96; i++) {
      const b = document.createElement('i');
      const env = 0.38 + 0.62 * Math.abs(Math.sin(i * 0.21 + 0.6));
      b.style.height = (5 + 88 * env * (0.28 + 0.72 * rng())).toFixed(1) + 'px';
      host.appendChild(b);
    }
  }

  function tcFrom(p) {
    const sec = 2 + p * 4;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const f = Math.floor((sec % 1) * 24);
    return '00:' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + ':' + (f < 10 ? '0' : '') + f;
  }

  S.push({
    id: 's3',
    start: 21.5,
    end: 33,

    mount: function (root) {
      root.appendChild(kit.hdr({ brand: C.brand, sub: C.brandSub }, SC.hdr, true));

      const copy = kit.el('div', 'copy');
      const vis = kit.cluster('vis-s3');
      root.appendChild(copy);
      root.appendChild(vis);

      const kick = kit.kick(SC.kick);
      kick.style.position = 'absolute';
      kick.style.left = '120px';
      kick.style.top = '186px';
      copy.appendChild(kick);

      const sent = kit.el('div', 's3-sent');
      const lines = [];
      const allChars = [];
      LINES.forEach(function (text) {
        const mask = kit.el('span', 'mask');
        const inner = kit.el('span');
        const chars = kit.chars(text);
        const arr = Array.prototype.slice.call(chars.children);
        for (let i = 0; i < arr.length; i++) allChars.push(arr[i]);
        inner.appendChild(chars);
        mask.appendChild(inner);
        sent.appendChild(mask);
        lines.push({ mask: mask, inner: inner });
      });
      copy.appendChild(sent);

      const wave = kit.el('div', 's3-wave');
      const wtop = kit.el('div', 's3-wtop');
      wtop.appendChild(kit.el('span', null, SC.voice.label));
      const wtc = kit.el('b', null, SC.voice.start);
      wtop.appendChild(wtc);
      const wbody = kit.el('div', 's3-wbody');
      const bars = kit.el('div', 's3-bars');
      buildWave(bars, 0x7C1A);
      const barsRed = kit.el('div', 's3-bars red');
      buildWave(barsRed, 0x7C1A);
      const read = kit.el('div', 's3-read');
      wbody.appendChild(bars);
      wbody.appendChild(barsRed);
      wbody.appendChild(read);
      const wfoot = kit.el('div', 's3-wfoot');
      wfoot.appendChild(kit.el('span', null, SC.voice.foot[0]));
      const wfRight = kit.el('span', null, SC.voice.foot[1]);
      wfoot.appendChild(wfRight);
      wave.appendChild(wtop);
      wave.appendChild(wbody);
      wave.appendChild(wfoot);
      vis.appendChild(wave);

      const cue = kit.el('div', 's3-cue');
      const chead = kit.el('div', 's3-chead');
      const cl = kit.el('span');
      cl.appendChild(kit.el('b', null, SC.cue.title));
      cl.appendChild(document.createTextNode('  ·  ' + CUES.length + ' ' + SC.cue.unit));
      const cr = kit.el('span', null, SC.cue.meta);
      chead.appendChild(cl);
      chead.appendChild(cr);
      cue.appendChild(chead);

      const rows = [];
      for (let i = 0; i < CUES.length; i++) {
        const row = kit.el('div', 's3-crow');
        row.appendChild(kit.el('span', 'tc', CUES[i].tc));
        row.appendChild(kit.el('span', 'tx', CUES[i].tx));
        row.style.opacity = '0';
        cue.appendChild(row);
        rows.push(row);
      }
      const scan = kit.el('div', 's3-scan');
      cue.appendChild(scan);
      vis.appendChild(cue);

      const stat = kit.el('div', 's3-stat');
      const nums = [];
      for (let i = 0; i < SC.stats.length; i++) {
        const st = kit.el('div', 'st');
        st.appendChild(kit.el('span', null, SC.stats[i].label));
        const num = kit.el('b', null, '0');
        st.appendChild(num);
        st.appendChild(kit.el('em', null, SC.stats[i].unit));
        stat.appendChild(st);
        nums.push(num);
      }
      stat.style.opacity = '0';
      vis.appendChild(stat);

      const stamp = kit.el('div', 's3-stamp');
      stamp.appendChild(kit.el('b', null, SC.stamp.title));
      stamp.appendChild(kit.el('span', null, SC.stamp.sub));
      stamp.style.opacity = '0';
      vis.appendChild(stamp);

      this.node = {
        hdr: root.querySelector('.hdr'), kick: kick, sent: sent, lines: lines, chars: allChars,
        wtc: wtc, red: barsRed, read: read, wf: wfRight,
        cue: cue, rows: rows, scan: scan, stat: stat, nums: nums, stamp: stamp
      };
      this.active = -1;
    },

    seek: function (local) {
      const t = local;
      const n = this.node;

      const hp = E.outCubic(U.inv(-0.3, 0.04, t));
      n.hdr.style.opacity = String(hp);
      n.hdr.style.transform = 'translate3d(0,' + ((1 - hp) * -10).toFixed(2) + 'px,0)';

      const kp = E.outCubic(U.inv(0.08, 0.44, t));
      n.kick.style.opacity = String(kp);
      n.kick.style.transform = 'translate3d(0,' + ((1 - kp) * 8).toFixed(2) + 'px,0)';

      for (let i = 0; i < n.lines.length; i++) {
        const p = E.outCubic(U.inv(0.35 + i * 0.15, 0.85 + i * 0.15, t));
        n.lines[i].inner.style.transform = 'translate3d(0,' + ((1 - p) * 108).toFixed(2) + '%,0)';
      }

      const p = E.inOutCubic(U.inv(1.6, 3.8, t));
      const head = p * n.chars.length;
      for (let i = 0; i < n.chars.length; i++) {
        const c = n.chars[i];
        if (i < head - 1) {
          if (!c.classList.contains('on')) { c.classList.remove('hd'); c.classList.add('on'); }
        } else if (i < head) {
          if (!c.classList.contains('hd')) { c.classList.remove('on'); c.classList.add('hd'); }
        } else if (c.classList.contains('on') || c.classList.contains('hd')) {
          c.classList.remove('on');
          c.classList.remove('hd');
        }
      }

      n.red.style.clipPath = 'inset(0 ' + ((1 - p) * 100).toFixed(2) + '% 0 0)';
      n.read.style.left = (p * 700).toFixed(2) + 'px';
      n.wtc.textContent = tcFrom(p);
      n.wf.textContent = p > 0.99 ? SC.voice.done : SC.voice.foot[1];

      for (let i = 0; i < n.rows.length; i++) {
        const rp = E.outCubic(U.inv(4.3 + i * 0.15, 4.75 + i * 0.15, t));
        n.rows[i].style.opacity = String(rp);
        n.rows[i].style.transform = 'translate3d(' + ((1 - rp) * 22).toFixed(2) + 'px,0,0)';
      }

      const scanP = U.inv(5.3, 8.6, t);
      n.scan.style.opacity = String(scanP > 0 && scanP < 1 ? 0.55 : 0);
      n.scan.style.top = (scanP * n.rows.length * 64 + 8).toFixed(1) + 'px';

      const active = U.clamp(Math.floor((t - 5.2) / 0.85), 0, n.rows.length - 1);
      if (t < 5.2) {
        if (this.active !== -1) {
          for (let i = 0; i < n.rows.length; i++) n.rows[i].classList.remove('on');
          this.active = -1;
        }
      } else if (active !== this.active) {
        for (let i = 0; i < n.rows.length; i++) n.rows[i].classList.toggle('on', i === active);
        this.active = active;
      }

      const sp = E.outCubic(U.inv(5.4, 5.85, t));
      n.stat.style.opacity = String(sp);
      n.stat.style.transform = 'translate3d(0,' + ((1 - sp) * 12).toFixed(2) + 'px,0)';

      const cp = E.outCubic(U.inv(5.4, 8.5, t));
      for (let i = 0; i < n.nums.length; i++) {
        const st = SC.stats[i];
        n.nums[i].textContent = (st.to * cp).toFixed(st.decimals);
      }

      const stp = U.inv(8.85, 9.15, t);
      n.stamp.style.opacity = String(stp);
      const ss = 1 + 0.42 * (1 - E.outExpo(stp));
      n.stamp.style.transform = 'rotate(' + (-12 + 5 * E.outCubic(stp)).toFixed(2) + 'deg) scale(' + ss.toFixed(3) + ')';
    }
  });
})();
