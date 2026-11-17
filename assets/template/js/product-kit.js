/* 产品 / 硬件视觉套件 · PRODUCT KIT
   给“拍产品”提供真实世界的底子：三层空间、窗光、桌面接触阴影、尘埃、
   铝壳 / 玻璃 / 键帽材质、开合与光扫。全部 CSS / SVG 绘制，不调用 AI 生图。
   只画 16:9 的 1920×1080 坐标系；竖屏请用编辑版式，不要把本套件硬裁。

   用法（场景 mount 里）：
     const shot = product.hardwareShot({
       place:'loft', tone:'dawn', light:'left',
       device:'laptop', material:'silver',
       framing:'mid', move:'push', screen:'lock',
       open:{ from:0.18, to:1 }, sweep:{ from:0.1, to:0.9 }
     });
     root.appendChild(shot.node);
     // seek(local, slot) 里：shot.seek(local, slot)
*/
(function () {
  'use strict';

  const C = window.FILM_CONFIG || {};
  const U = window.U;
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function sv(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function add(parent, child) {
    if (child) parent.appendChild(child);
    return child;
  }

  function stop(grad, offset, color, opacity) {
    const s = sv('stop', { offset: offset, 'stop-color': color });
    if (opacity != null) s.setAttribute('stop-opacity', String(opacity));
    grad.appendChild(s);
  }

  function linear(defs, id, stops, x1, y1, x2, y2) {
    const g = sv('linearGradient', { id: id, x1: x1 || '0%', y1: y1 || '0%', x2: x2 || '100%', y2: y2 || '100%' });
    stops.forEach(s => stop(g, s[0], s[1], s[2]));
    defs.appendChild(g);
    return g;
  }

  function radial(defs, id, stops, cx, cy, r) {
    const g = sv('radialGradient', { id: id, cx: cx || '50%', cy: cy || '50%', r: r || '50%' });
    stops.forEach(s => stop(g, s[0], s[1], s[2]));
    defs.appendChild(g);
    return g;
  }

  const PROPS = ['mug', 'notebook', 'plant', 'lamp', 'paper', 'chair'];

  function space(opts) {
    const o = Object.assign({
      place: 'loft',
      tone: 'dawn',
      light: 'left',
      props: ['mug', 'notebook', 'plant'],
      dust: 26,
      grain: true
    }, opts || {});
    const node = el('div', 'pd-space pd-place-' + o.place + ' pd-tone-' + o.tone + ' pd-light-' + o.light);
    const far = el('div', 'pd-layer pd-far');
    const mid = el('div', 'pd-layer pd-mid');
    const desk = el('div', 'pd-layer pd-desk');

    const sky = el('div', 'pd-sky');
    const win = el('div', 'pd-window');
    win.appendChild(el('i', 'pd-window-sky'));
    win.appendChild(el('i', 'pd-window-glow'));
    win.appendChild(el('i', 'pd-bar pd-bar-v1'));
    win.appendChild(el('i', 'pd-bar pd-bar-v2'));
    win.appendChild(el('i', 'pd-bar pd-bar-h1'));
    win.appendChild(el('i', 'pd-bar pd-bar-h2'));
    win.appendChild(el('i', 'pd-outside pd-outside-a'));
    win.appendChild(el('i', 'pd-outside pd-outside-b'));
    win.appendChild(el('i', 'pd-window-sill'));
    win.appendChild(el('i', 'pd-curtain pd-curtain-l'));
    win.appendChild(el('i', 'pd-curtain pd-curtain-r'));
    far.appendChild(sky);
    far.appendChild(el('i', 'pd-far-haze'));

    const wall = el('div', 'pd-wall');
    const shelf = el('div', 'pd-shelf');
    ['b1', 'b2', 'b3', 'b4', 'b5'].forEach(k => shelf.appendChild(el('i', 'pd-book ' + k)));
    const shelfLine = el('i', 'pd-shelf-line');
    shelf.appendChild(shelfLine);
    const plant = el('div', 'pd-prop pd-plant');
    plant.appendChild(el('i', 'pd-pot'));
    ['l1', 'l2', 'l3', 'l4', 'l5'].forEach(k => plant.appendChild(el('i', 'pd-leaf ' + k)));
    mid.appendChild(wall);
    mid.appendChild(win);
    mid.appendChild(el('div', 'pd-wall-light'));
    mid.appendChild(el('div', 'pd-baseboard'));
    mid.appendChild(shelf);
    mid.appendChild(plant);

    const deskTop = el('div', 'pd-desk-top');
    const deskEdge = el('div', 'pd-desk-edge');
    const deskGrain = el('div', 'pd-desk-grain');
    const contact = el('div', 'pd-contact');
    desk.appendChild(deskTop);
    desk.appendChild(deskGrain);
    desk.appendChild(deskEdge);
    desk.appendChild(el('div', 'pd-desk-light'));
    desk.appendChild(contact);

    const propsHost = el('div', 'pd-props');
    const active = (o.props || []).filter(p => PROPS.indexOf(p) >= 0);
    if (active.indexOf('mug') >= 0) {
      const mug = el('div', 'pd-prop pd-mug');
      mug.appendChild(el('i', 'pd-mug-body'));
      mug.appendChild(el('i', 'pd-mug-handle'));
      mug.appendChild(el('i', 'pd-mug-top'));
      const steam = el('i', 'pd-steam');
      steam.appendChild(el('b'));
      steam.appendChild(el('b'));
      steam.appendChild(el('b'));
      mug.appendChild(steam);
      propsHost.appendChild(mug);
    }
    if (active.indexOf('notebook') >= 0) {
      const nb = el('div', 'pd-prop pd-notebook');
      nb.appendChild(el('i', 'pd-nb-pages'));
      nb.appendChild(el('i', 'pd-nb-cover'));
      nb.appendChild(el('i', 'pd-nb-band'));
      propsHost.appendChild(nb);
    }
    if (active.indexOf('lamp') >= 0) {
      const lamp = el('div', 'pd-prop pd-lamp');
      lamp.appendChild(el('i', 'pd-lamp-base'));
      lamp.appendChild(el('i', 'pd-lamp-arm'));
      lamp.appendChild(el('i', 'pd-lamp-shade'));
      lamp.appendChild(el('i', 'pd-lamp-glow'));
      propsHost.appendChild(lamp);
    }
    if (active.indexOf('paper') >= 0) {
      const paper = el('div', 'pd-prop pd-paper');
      paper.appendChild(el('i', 'pd-paper-a'));
      paper.appendChild(el('i', 'pd-paper-b'));
      paper.appendChild(el('i', 'pd-paper-c'));
      propsHost.appendChild(paper);
    }
    if (active.indexOf('chair') >= 0) {
      const chair = el('div', 'pd-prop pd-chair');
      chair.appendChild(el('i', 'pd-chair-back'));
      chair.appendChild(el('i', 'pd-chair-seat'));
      chair.appendChild(el('i', 'pd-chair-leg a'));
      chair.appendChild(el('i', 'pd-chair-leg b'));
      propsHost.appendChild(chair);
    }
    desk.appendChild(propsHost);

    const shaft = el('div', 'pd-light-shaft');
    const dust = el('div', 'pd-dust');
    const dustNodes = [];
    const rng = U.mulberry32(0x9D57 + o.dust);
    for (let i = 0; i < o.dust; i++) {
      const d = el('i', 'pd-mote');
      const x = 6 + rng() * 88;
      const y = 10 + rng() * 70;
      const s = 1 + rng() * 2.4;
      d.style.left = x.toFixed(2) + '%';
      d.style.top = y.toFixed(2) + '%';
      d.style.width = s.toFixed(2) + 'px';
      d.style.height = s.toFixed(2) + 'px';
      d.style.opacity = (0.18 + rng() * 0.5).toFixed(2);
      d._phase = rng();
      d._speed = 0.4 + rng() * 1.1;
      d._x = rng() * 8 - 4;
      dust.appendChild(d);
      dustNodes.push(d);
    }
    const vignette = el('div', 'pd-vignette');
    const haze = el('div', 'pd-haze');

    node.appendChild(far);
    node.appendChild(mid);
    node.appendChild(desk);
    node.appendChild(shaft);
    node.appendChild(dust);
    node.appendChild(haze);
    if (o.grain) node.appendChild(el('div', 'pd-grain'));
    node.appendChild(vignette);

    const steamNodes = Array.prototype.slice.call(node.querySelectorAll('.pd-steam b'));

    function seek(p, local) {
      const t = Number(local) || 0;
      const drift = (p - 0.5);
      far.style.transform = 'translate3d(' + (drift * -16).toFixed(2) + 'px,0,0)';
      mid.style.transform = 'translate3d(' + (drift * -30).toFixed(2) + 'px,0,0)';
      desk.style.transform = 'translate3d(' + (drift * -44).toFixed(2) + 'px,0,0)';
      shaft.style.opacity = String(0.55 + Math.sin(t * 0.55) * 0.08);
      shaft.style.transform = 'translate3d(' + (drift * -20).toFixed(2) + 'px,' + (Math.sin(t * 0.4) * 4).toFixed(2) + 'px,0)';
      for (let i = 0; i < dustNodes.length; i++) {
        const d = dustNodes[i];
        const lift = ((p * d._speed + d._phase) % 1) * 210;
        const sway = Math.sin(t * (0.35 + d._phase * 0.5) + d._phase * 6.28) * 9 + d._x;
        d.style.transform = 'translate3d(' + sway.toFixed(2) + 'px,' + (-lift).toFixed(2) + 'px,0)';
      }
      for (let i = 0; i < steamNodes.length; i++) {
        const s = steamNodes[i];
        const q = (p * 0.6 + i * 0.21) % 1;
        s.style.transform = 'translate3d(' + (Math.sin(t * 1.4 + i) * 4).toFixed(2) + 'px,' + (-q * 64).toFixed(2) + 'px,0)';
        s.style.opacity = String(Math.sin(q * Math.PI) * 0.55);
      }
    }

    return {
      node: node,
      seek: seek,
      setTone: function (tone) { node.className = node.className.replace(/pd-tone-\w+/g, 'pd-tone-' + tone); },
      setLight: function (side) { node.className = node.className.replace(/pd-light-\w+/g, 'pd-light-' + side); }
    };
  }

  function laptop(opts) {
      const o = Object.assign({
        material: 'silver',
        screen: 'lock',
        angle: 'left',
        shadow: true,
        time: '09:41',
        caption: ''
      }, opts || {});
      const n = ++uid;
      const id = 'pd' + n;
      const wrap = el('div', 'pd-device pd-laptop pd-mat-' + o.material + ' pd-screen-' + o.screen + ' pd-angle-' + o.angle);
      wrap.style.setProperty('--pd-device-rot', (o.angle === 'right' ? 1.0 : -1.0) + 'deg');

      const root = sv('svg', {
        class: 'pd-device-svg',
        viewBox: '0 0 1600 1120',
        preserveAspectRatio: 'xMidYMid meet',
        'aria-hidden': 'true'
      });
      const defs = add(root, sv('defs'));
      const u = function (k) { return 'url(#' + id + '-' + k + ')'; };

      linear(defs, id + '-metal-lid', [
        ['0%', 'var(--pd-metal-a)'], ['24%', 'var(--pd-metal-b)'], ['48%', 'var(--pd-metal-c)'],
        ['74%', 'var(--pd-metal-b)'], ['100%', 'var(--pd-metal-d)']
      ], '4%', '0%', '96%', '100%');
      linear(defs, id + '-metal-base', [
        ['0%', 'var(--pd-metal-c)'], ['32%', 'var(--pd-metal-b)'],
        ['68%', 'var(--pd-metal-a)'], ['100%', 'var(--pd-metal-c)']
      ], '0%', '10%', '100%', '90%');
      linear(defs, id + '-deck', [
        ['0%', 'var(--pd-deck)'], ['46%', 'var(--pd-deck-hi)'], ['100%', 'var(--pd-deck)']
      ], '0%', '0%', '100%', '100%');
      linear(defs, id + '-screen-bg', [
        ['0%', 'var(--pd-screen-a)'], ['52%', 'var(--pd-screen-b)'], ['100%', 'var(--pd-screen-c)']
      ], '8%', '0%', '92%', '100%');
      radial(defs, id + '-screen-sun', [
        ['0%', 'var(--pd-sun)', 0.85], ['55%', 'var(--pd-sun)', 0.2], ['100%', 'var(--pd-sun)', 0]
      ], '50%', '50%', '50%');
      linear(defs, id + '-screen-haze', [
        ['0%', 'var(--pd-screen-c)', 0], ['58%', 'var(--pd-screen-c)', 0.1], ['100%', 'var(--pd-screen-c)', 0.78]
      ], '0%', '0%', '0%', '100%');
      linear(defs, id + '-key', [
        ['0%', 'var(--pd-key-hi)'], ['42%', 'var(--pd-key)'], ['100%', 'var(--pd-key)']
      ], '0%', '0%', '0%', '100%');
      linear(defs, id + '-sheen', [
        ['0%', 'var(--pd-screen-reflect)', 0], ['44%', 'var(--pd-screen-reflect)', 0.05],
        ['56%', 'var(--pd-screen-reflect)', 0.028], ['100%', 'var(--pd-screen-reflect)', 0]
      ], '0%', '0%', '100%', '100%');
      radial(defs, id + '-spill', [
        ['0%', 'var(--pd-glow)', 0.8], ['52%', 'var(--pd-glow)', 0.24], ['100%', 'var(--pd-glow)', 0]
      ], '50%', '50%', '50%');
      radial(defs, id + '-shadow', [
        ['0%', 'var(--pd-shadow)', 0.9], ['58%', 'var(--pd-shadow)', 0.34], ['100%', 'var(--pd-shadow)', 0]
      ], '50%', '50%', '50%');

      const blurSoft = add(defs, sv('filter', { id: id + '-blur-soft', x: '-40%', y: '-90%', width: '180%', height: '280%' }));
      add(blurSoft, sv('feGaussianBlur', { stdDeviation: '8' }));
      const blurMed = add(defs, sv('filter', { id: id + '-blur-med', x: '-40%', y: '-140%', width: '180%', height: '380%' }));
      add(blurMed, sv('feGaussianBlur', { stdDeviation: '18' }));
      const blurWide = add(defs, sv('filter', { id: id + '-blur-wide', x: '-40%', y: '-180%', width: '180%', height: '460%' }));
      add(blurWide, sv('feGaussianBlur', { stdDeviation: '34' }));

      const dots = add(defs, sv('pattern', { id: id + '-dots', width: '7', height: '7', patternUnits: 'userSpaceOnUse' }));
      add(dots, sv('circle', { cx: '2', cy: '2', r: '1.1', fill: 'var(--pd-grille)' }));

      const lidShape = 'M316 52 Q300 52 299 68 L272 762 Q271 780 289 780 L1311 780 Q1329 780 1328 762 L1301 68 Q1300 52 1284 52 Z';
      const glassShape = 'M342 78 Q330 78 329 90 L304 744 Q303 756 315 756 L1285 756 Q1297 756 1296 744 L1271 90 Q1270 78 1258 78 Z';
      const baseShape = 'M300 772 L1300 772 Q1316 772 1318 787 L1352 1052 Q1356 1082 1324 1082 L276 1082 Q244 1082 248 1052 L282 787 Q284 772 300 772 Z';

      if (o.shadow) {
        add(root, sv('ellipse', {
          cx: '800', cy: '1098', rx: '660', ry: '46', fill: u('shadow'), opacity: '.95', filter: u('blur-wide')
        }));
        add(root, sv('ellipse', {
          cx: '800', cy: '1086', rx: '500', ry: '14', fill: 'var(--pd-shadow-deep)', opacity: '.8', filter: u('blur-soft')
        }));
        add(root, sv('ellipse', {
          cx: '962', cy: '1086', rx: '520', ry: '24', fill: u('shadow'), opacity: '.55',
          filter: u('blur-med'), transform: 'rotate(-5 962 1086)', class: 'pd-cast pd-cast-l'
        }));
        add(root, sv('ellipse', {
          cx: '638', cy: '1086', rx: '520', ry: '24', fill: u('shadow'), opacity: '.55',
          filter: u('blur-med'), transform: 'rotate(5 638 1086)', class: 'pd-cast pd-cast-r'
        }));
      }

      const lid = add(root, sv('g', { class: 'pd-lid' }));
      add(lid, sv('path', { d: lidShape, fill: u('metal-lid'), stroke: 'var(--pd-edge)', 'stroke-width': '1.6' }));
      add(lid, sv('path', { d: lidShape, fill: 'none', stroke: 'var(--pd-rim)', 'stroke-width': '2.4', opacity: '.55' }));
      add(lid, sv('path', { d: glassShape, fill: 'var(--pd-glass)', stroke: 'var(--pd-glass-edge)', 'stroke-width': '1.2' }));

      const glassClip = add(defs, sv('clipPath', { id: id + '-glassclip' }));
      add(glassClip, sv('path', { d: glassShape }));

      const wp = add(lid, sv('g', { class: 'pd-screen-wallpaper', 'clip-path': 'url(#' + id + '-glassclip)' }));
      add(wp, sv('rect', { x: '296', y: '70', width: '1010', height: '690', fill: u('screen-bg') }));
      add(wp, sv('ellipse', { cx: '1028', cy: '338', rx: '300', ry: '210', fill: u('screen-sun'), opacity: '.55', class: 'pd-screen-sun' }));
      add(wp, sv('circle', { cx: '1028', cy: '338', r: '46', fill: 'var(--pd-sun-core)', opacity: '.92', class: 'pd-screen-sun' }));
      add(wp, sv('path', {
        d: 'M300 560 L470 470 L640 520 L810 430 L1010 520 L1180 458 L1300 512 V760 H300 Z',
        fill: 'var(--pd-screen-far)', opacity: '.55'
      }));
      add(wp, sv('path', {
        d: 'M300 636 L500 560 L690 604 L880 528 L1080 596 L1260 546 L1300 570 V760 H300 Z',
        fill: 'var(--pd-screen-near)', opacity: '.75'
      }));
      add(wp, sv('path', {
        d: 'M300 706 L520 664 L760 694 L980 648 L1200 686 L1300 666 V760 H300 Z',
        fill: 'var(--pd-screen-fore)', opacity: '.92'
      }));
      add(wp, sv('rect', { x: '296', y: '70', width: '1010', height: '690', fill: u('screen-haze') }));
      add(wp, sv('path', { d: 'M330 104 L800 60 L900 60 L380 220 Z', fill: 'var(--pd-screen-reflect)', opacity: '.03' }));
      add(wp, sv('path', { d: 'M480 756 L1080 200 L1160 200 L560 756 Z', fill: 'var(--pd-screen-reflect)', opacity: '.02' }));

      const lock = add(lid, sv('g', { class: 'pd-screen-lock', 'clip-path': 'url(#' + id + '-glassclip)' }));
      const time = add(lock, sv('text', {
        x: '800', y: '318', 'text-anchor': 'middle', fill: 'var(--pd-screen-ink)',
        'font-family': 'var(--font-sans)', 'font-size': '72', 'font-weight': '300',
        'letter-spacing': '4', opacity: '.94'
      }));
      time.textContent = String(o.time || '09:41');
      const cap = add(lock, sv('text', {
        x: '800', y: '360', 'text-anchor': 'middle', fill: 'var(--pd-screen-ink)',
        'font-family': 'var(--font-sans)', 'font-size': '17', 'letter-spacing': '6', opacity: '.55'
      }));
      cap.textContent = String(o.caption || C.brand || C.brandSub || 'READY').slice(0, 26);
      add(lock, sv('rect', { x: '778', y: '466', width: '44', height: '34', rx: '8', fill: 'var(--pd-screen-ink)', opacity: '.76' }));
      add(lock, sv('path', {
        d: 'M788 466 V452 A12 12 0 0 1 812 452 V466', fill: 'none',
        stroke: 'var(--pd-screen-ink)', 'stroke-width': '4.5', opacity: '.76'
      }));

      const ui = add(lid, sv('g', { class: 'pd-screen-ui', 'clip-path': 'url(#' + id + '-glassclip)', opacity: '0' }));
      add(ui, sv('rect', { x: '342', y: '188', width: '568', height: '424', rx: '14', fill: 'var(--pd-screen-ui-ink)', opacity: '.2' }));
      add(ui, sv('rect', { x: '336', y: '180', width: '568', height: '424', rx: '14', fill: 'var(--pd-screen-ui)', opacity: '.98' }));
      add(ui, sv('rect', { x: '336', y: '180', width: '568', height: '36', rx: '14', fill: 'var(--pd-screen-ui-ink)', opacity: '.06' }));
      add(ui, sv('path', { d: 'M336 216 H904', stroke: 'var(--pd-screen-ui-ink)', 'stroke-width': '.9', opacity: '.14' }));
      add(ui, sv('circle', { cx: '364', cy: '198', r: '5.4', fill: 'var(--pd-screen-ui-ink)', opacity: '.28' }));
      add(ui, sv('circle', { cx: '382', cy: '198', r: '5.4', fill: 'var(--pd-screen-ui-ink)', opacity: '.2' }));
      add(ui, sv('circle', { cx: '400', cy: '198', r: '5.4', fill: 'var(--pd-screen-ui-ink)', opacity: '.14' }));
      add(ui, sv('rect', { x: '366', y: '258', width: '206', height: '14', rx: '7', fill: 'var(--pd-screen-ui-ink)', opacity: '.74' }));
      add(ui, sv('rect', { x: '366', y: '290', width: '372', height: '9', rx: '4.5', fill: 'var(--pd-screen-ui-ink)', opacity: '.26' }));
      add(ui, sv('rect', { x: '366', y: '312', width: '312', height: '9', rx: '4.5', fill: 'var(--pd-screen-ui-ink)', opacity: '.2' }));
      add(ui, sv('rect', { x: '366', y: '378', width: '228', height: '132', rx: '10', fill: 'var(--pd-accent)', opacity: '.9' }));
      add(ui, sv('rect', { x: '366', y: '378', width: '228', height: '132', rx: '10', fill: 'none', stroke: 'var(--pd-screen-ui-ink)', 'stroke-width': '1', opacity: '.1' }));
      add(ui, sv('rect', { x: '384', y: '472', width: '74', height: '7', rx: '3.5', fill: 'var(--pd-screen-ui)', opacity: '.82' }));
      add(ui, sv('rect', { x: '384', y: '452', width: '126', height: '10', rx: '5', fill: 'var(--pd-screen-ui)', opacity: '.9' }));
      add(ui, sv('circle', { cx: '574', cy: '492', r: '7', fill: 'var(--pd-screen-ui)', opacity: '.72' }));
      add(ui, sv('path', { d: 'M572 488 L580 492 L572 496 Z', fill: 'var(--pd-accent)' }));
      add(ui, sv('rect', { x: '620', y: '378', width: '248', height: '56', rx: '8', fill: 'var(--pd-screen-ui-ink)', opacity: '.08' }));
      add(ui, sv('rect', { x: '620', y: '448', width: '248', height: '56', rx: '8', fill: 'var(--pd-screen-ui-ink)', opacity: '.055' }));
      add(ui, sv('rect', { x: '620', y: '518', width: '248', height: '56', rx: '8', fill: 'var(--pd-screen-ui-ink)', opacity: '.04' }));
      add(ui, sv('circle', { cx: '638', cy: '406', r: '7', fill: 'var(--pd-accent)', opacity: '.78' }));
      add(ui, sv('circle', { cx: '638', cy: '476', r: '7', fill: 'var(--pd-screen-ui-ink)', opacity: '.24' }));
      add(ui, sv('circle', { cx: '638', cy: '546', r: '7', fill: 'var(--pd-screen-ui-ink)', opacity: '.16' }));
      add(ui, sv('rect', { x: '656', y: '398', width: '132', height: '8', rx: '4', fill: 'var(--pd-screen-ui-ink)', opacity: '.5' }));
      add(ui, sv('rect', { x: '656', y: '414', width: '88', height: '7', rx: '3.5', fill: 'var(--pd-screen-ui-ink)', opacity: '.22' }));
      add(ui, sv('rect', { x: '656', y: '468', width: '146', height: '8', rx: '4', fill: 'var(--pd-screen-ui-ink)', opacity: '.42' }));
      add(ui, sv('rect', { x: '656', y: '484', width: '74', height: '7', rx: '3.5', fill: 'var(--pd-screen-ui-ink)', opacity: '.18' }));
      add(ui, sv('rect', { x: '656', y: '538', width: '118', height: '8', rx: '4', fill: 'var(--pd-screen-ui-ink)', opacity: '.34' }));
      add(ui, sv('rect', { x: '656', y: '554', width: '96', height: '7', rx: '3.5', fill: 'var(--pd-screen-ui-ink)', opacity: '.15' }));

      add(lid, sv('path', { d: glassShape, fill: u('sheen') }));
      add(lid, sv('circle', { cx: '800', cy: '66', r: '4.6', fill: 'var(--pd-camera)', opacity: '.85' }));
      add(lid, sv('circle', { cx: '798.6', cy: '64.8', r: '1.4', fill: 'var(--pd-screen-ink)', opacity: '.25' }));
      add(lid, sv('path', { d: 'M299 68 L1301 68', stroke: 'var(--pd-rim)', 'stroke-width': '1.4', opacity: '.35' }));

      const lidSweepClip = add(defs, sv('clipPath', { id: id + '-lidsweep' }));
      add(lidSweepClip, sv('path', { d: lidShape }));
      const lidSweep = add(lid, sv('g', { class: 'pd-sweep', 'clip-path': 'url(#' + id + '-lidsweep)' }));
      add(lidSweep, sv('polygon', {
        points: '-200,0 40,0 -220,1120 -460,1120', fill: 'var(--pd-sweep)', opacity: '.16'
      }));

      const base = add(root, sv('g', { class: 'pd-base' }));
      add(base, sv('path', {
        d: 'M292 756 H1308 Q1318 756 1318 768 V782 H282 V768 Q282 756 292 756 Z',
        fill: 'var(--pd-hinge)'
      }));
      add(base, sv('path', { d: baseShape, fill: u('metal-base'), stroke: 'var(--pd-edge)', 'stroke-width': '1.6' }));
      add(base, sv('path', { d: baseShape, fill: 'none', stroke: 'var(--pd-rim)', 'stroke-width': '2.2', opacity: '.35' }));
      add(base, sv('path', { d: 'M312 786 L1288 786 L1322 1062 L278 1062 Z', fill: u('deck') }));
      add(base, sv('path', { d: 'M312 786 L1288 786', stroke: 'var(--pd-rim)', 'stroke-width': '1.6', opacity: '.42' }));
      add(base, sv('rect', { x: '390', y: '800', width: '820', height: '132', rx: '14', fill: 'var(--pd-keywell)' }));

      const kg = add(base, sv('g', { class: 'pd-keys' }));
      const pitch = 58;
      const kw = 51;
      function keyAt(x, y, w, h, dim) {
        add(kg, sv('rect', {
          x: x.toFixed(1), y: String(y), width: w.toFixed(1), height: String(h), rx: '3.4',
          fill: 'var(--pd-key)', stroke: 'var(--pd-key-edge)', 'stroke-width': '.7'
        }));
        add(kg, sv('rect', {
          x: (x + 2).toFixed(1), y: (y + 2).toFixed(1),
          width: Math.max(w - 4, 6).toFixed(1), height: Math.max(h - 4.4, 4).toFixed(1), rx: '2.2',
          fill: 'var(--pd-key-hi)', opacity: dim ? '.13' : '.28'
        }));
        if (!dim && w < 80) {
          add(kg, sv('rect', {
            x: (x + w / 2 - 7).toFixed(1), y: (y + h / 2 - 2).toFixed(1), width: '14', height: '4', rx: '2',
            fill: 'var(--pd-key-hi)', opacity: '.38'
          }));
        }
      }
      for (let c = 0; c < 14; c++) keyAt(404 + c * pitch, 806, kw, 13, true);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 14; c++) keyAt(404 + c * pitch, 823 + r * 25, kw, 20);
      }
      for (let c = 0; c < 4; c++) keyAt(404 + c * pitch, 898, kw, 20);
      keyAt(404 + 4 * pitch, 898, 51 * 6 + 5 * 7, 20);
      for (let c = 10; c < 14; c++) keyAt(404 + c * pitch, 898, kw, 20);

      add(base, sv('rect', { x: '336', y: '804', width: '34', height: '160', rx: '8', fill: u('dots'), opacity: '.9' }));
      add(base, sv('rect', { x: '1230', y: '804', width: '34', height: '160', rx: '8', fill: u('dots'), opacity: '.9' }));

      add(base, sv('rect', {
        x: '620', y: '948', width: '360', height: '82', rx: '10',
        fill: 'var(--pd-trackpad)', stroke: 'var(--pd-key-edge)', 'stroke-width': '1'
      }));
      add(base, sv('path', { d: 'M636 952 H964', stroke: 'var(--pd-rim)', 'stroke-width': '.8', opacity: '.22' }));

      add(base, sv('ellipse', {
        cx: '800', cy: '796', rx: '410', ry: '34', fill: u('spill'), opacity: '.4', class: 'pd-screen-spill'
      }));

      add(base, sv('path', { d: 'M278 1062 H1322 L1352 1082 H248 Z', fill: 'var(--pd-lip)' }));
      add(base, sv('path', { d: 'M278 1062 H1322', stroke: 'var(--pd-rim)', 'stroke-width': '1.2', opacity: '.35' }));

      const baseSweepClip = add(defs, sv('clipPath', { id: id + '-basesweep' }));
      add(baseSweepClip, sv('path', { d: baseShape }));
      const baseSweep = add(base, sv('g', { class: 'pd-sweep', 'clip-path': 'url(#' + id + '-basesweep)' }));
      add(baseSweep, sv('polygon', {
        points: '-200,0 40,0 -220,1120 -460,1120', fill: 'var(--pd-sweep)', opacity: '.12'
      }));

      const spill = base.querySelector('.pd-screen-spill');

      wrap.appendChild(root);

      let open = o.open != null ? o.open : 1;
      let sweep = 0;
      let screenState = o.screen;

      function setOpen(v) {
        open = U.clamp(Number(v), 0, 1);
        const sy = 0.05 + 0.95 * open;
        lid.setAttribute('transform', 'translate(800 780) scale(1 ' + sy.toFixed(4) + ') translate(-800 -780)');
        lid.style.opacity = String(open < 0.02 ? 0.0 : 1);
        lid.setAttribute('pointer-events', 'none');
      }

      function setSweep(v) {
        sweep = U.clamp(Number(v), 0, 1);
        const x = (-420 + sweep * 1400).toFixed(1);
        lidSweep.setAttribute('transform', 'translate(' + x + ' 0)');
        baseSweep.setAttribute('transform', 'translate(' + x + ' 0)');
      }

      function setScreen(state) {
        screenState = state;
        wrap.className = wrap.className.replace(/pd-screen-\w+/g, 'pd-screen-' + state);
      }

      setOpen(open);
      setSweep(sweep);

      function seek(p, local, anim) {
        const a = anim || {};
        if (a.open != null) setOpen(a.open);
        if (a.sweep != null) setSweep(a.sweep);
        if (a.screen != null) setScreen(a.screen);
        const t = Number(local) || 0;
        const glow = screenState === 'off' ? 0.04 : (screenState === 'glow' ? 0.9 : 0.5);
        if (spill) spill.setAttribute('opacity', String(glow * (0.55 + Math.sin(t * 1.1) * 0.04)));
        wrap.style.setProperty('--pd-device-lift', (Math.sin(t * 0.7) * 0.6).toFixed(2) + 'px');
      }

      return {
        node: wrap,
        seek: seek,
        setOpen: setOpen,
        setSweep: setSweep,
        setScreen: setScreen,
        getOpen: function () { return open; }
      };
    }

  const FOCUS = {
    keys: ['50%', '72%'],
    hinge: ['50%', '57%'],
    port: ['17%', '65%'],
    edge: ['72%', '44%'],
    screen: ['50%', '40%'],
    auto: ['50%', '55%']
  };

  function hardwareShot(opts) {
    const o = Object.assign({
      place: 'loft',
      tone: 'dawn',
      light: 'left',
      props: ['mug', 'notebook', 'plant'],
      device: 'laptop',
      material: 'silver',
      angle: 'left',
      framing: 'mid',
      focus: 'auto',
      move: 'push',
      screen: 'lock',
      open: 1,
      sweep: 0.42,
      className: ''
    }, opts || {});
    if (C.height > C.width) {
      console.warn('product.hardwareShot 只支持 16:9；竖屏请用编辑版式或重排空间。');
    }
    const node = el('div', 'pd-shot pd-tone-' + o.tone + ' pd-place-' + o.place + ' pd-light-' + o.light +
      ' pd-framing-' + o.framing + ' pd-move-' + o.move + (o.className ? ' ' + o.className : ''));
    const camera = el('div', 'pd-camera');
    const sp = space(o);
    camera.appendChild(sp.node);

    let dev = null;
    if (o.device !== 'none') {
      const wrap = el('div', 'pd-device-wrap');
      if (o.device === 'laptop') dev = laptop({ material: o.material, screen: o.screen, angle: o.angle, open: typeof o.open === 'object' ? o.open.from : o.open });
      else dev = laptop({ material: o.material, screen: o.screen, angle: o.angle, open: typeof o.open === 'object' ? o.open.from : o.open });
      wrap.appendChild(dev.node);
      camera.appendChild(wrap);
      dev._wrap = wrap;
    }

    const vignette = el('div', 'pd-shot-vignette');
    const grain = el('div', 'pd-shot-grain');
    node.appendChild(camera);
    node.appendChild(vignette);
    node.appendChild(grain);

    const fo = FOCUS[o.focus] || FOCUS.auto;
    camera.style.transformOrigin = fo[0] + ' ' + fo[1];

    const openSpec = typeof o.open === 'object' ? o.open : { from: o.open, to: o.open };
    const sweepSpec = typeof o.sweep === 'object' ? o.sweep : { from: o.sweep, to: o.sweep };

    function seek(local, slot) {
      const dur = slot || 3;
      const p = U.clamp(local / dur, 0, 1);
      sp.seek(p, local);

      const openV = U.lerp(Number(openSpec.from), Number(openSpec.to), p);
      const sweepV = typeof o.sweep === 'number' ? o.sweep : U.lerp(Number(sweepSpec.from), Number(sweepSpec.to), p);
      if (dev) dev.seek(p, local, { open: openV, sweep: sweepV });

      const k = p - 0.5;
      let x = 0, y = 0, s = 1;
      if (o.move === 'push') s = 1 + 0.055 * p;
      else if (o.move === 'pan') x = k * 34;
      else if (o.move === 'rise') { y = -k * 26; s = 1 + 0.02 * p; }
      else if (o.move === 'drift') { x = k * 22; y = -k * 18; s = 1 + 0.025 * p; }
      else if (o.move === 'handheld') {
        x = Math.sin(local * 0.9) * 3.2;
        y = Math.cos(local * 0.7) * 2.4;
        s = 1 + 0.012 * p;
      }
      if (o.framing === 'macro') s *= 1.12 + 0.05 * p;
      camera.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + s.toFixed(4) + ')';

      if (dev && dev._wrap) {
        const sway = Math.sin(local * 0.55) * 1.4;
        dev._wrap.style.transform = 'translateX(-50%) translate3d(' + sway.toFixed(2) + 'px,0,0) rotate(' + (o.angle === 'right' ? 1.1 : -1.1) + 'deg)';
      }
    }

    return {
      node: node,
      space: sp,
      device: dev,
      camera: camera,
      seek: seek,
      setScreen: function (state) { if (dev) dev.setScreen(state); },
      setOpen: function (v) { if (dev) dev.setOpen(v); }
    };
  }

  window.product = {
    space: space,
    laptop: laptop,
    hardwareShot: hardwareShot,
    PROPS: PROPS.slice()
  };
})();