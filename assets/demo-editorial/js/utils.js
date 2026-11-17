(function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function inv(a, b, v) { return clamp((v - a) / ((b - a) || 1e-6), 0, 1); }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function el(tag, cls, style) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (style) for (const k in style) n.style[k] = style[k];
    return n;
  }

  function svg(tag, attrs) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function set(node, styles) {
    for (const k in styles) node.style[k] = styles[k];
    return node;
  }

  const HUES = [206, 214, 226, 238, 250, 262, 190, 172];

  function thumb(rng, w, h, variant) {
    const node = el('div', 'thumb' + ' v' + (((variant || 0) % 3) + 1));
    node.style.width = w + 'px';
    node.style.height = h + 'px';
    const h1 = HUES[Math.floor(rng() * HUES.length)];
    const h2 = h1 + 16 + rng() * 26;
    const l1 = 20 + rng() * 14;
    const l2 = 9 + rng() * 8;
    const deg = 118 + rng() * 66;
    node.style.background =
      'linear-gradient(' + deg.toFixed(1) + 'deg, hsl(' + h1 + ' ' + (58 + rng() * 18).toFixed(0) + '% ' + l1.toFixed(0) + '%) 0%, ' +
      'hsl(' + h2.toFixed(0) + ' ' + (48 + rng() * 20).toFixed(0) + '% ' + l2.toFixed(0) + '%) 100%)';
    node.appendChild(el('i', 'thumb-a'));
    node.appendChild(el('i', 'thumb-b'));
    node.appendChild(el('i', 'thumb-c'));
    node.appendChild(el('i', 'thumb-d'));
    return node;
  }

  function fmt(n) { return Math.round(n * 100) / 100; }

  window.U = {
    clamp, lerp, inv, mulberry32, el, svg, set, thumb, fmt,
    pick: function (rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
  };
})();
