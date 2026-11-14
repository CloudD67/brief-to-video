(function () {
  'use strict';

  /* 文案占位符：剧本里写 {duration} {width} {height} {fps}，随 config 自动替换 */
  function inject(text) {
    if (typeof text !== 'string' || text.indexOf('{') < 0) return text;
    const C = window.FILM_CONFIG || {};
    return text.replace(/\{(duration|width|height|fps)\}/g, function (m, k) {
      return C[k] != null ? String(C[k]) : m;
    });
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = inject(text);
    return n;
  }

  /* 印刷照片：用主题令牌取色，深浅主题自动反转 */
  const INK = 'var(--ill-ink)';
  const PAPER = 'var(--ill-paper)';

  const SCENES = {
    /* 巷口空镜 */
    1:
      '<path d="M0 0H118L104 186H0Z" fill="' + INK + '" opacity=".30"/>' +
      '<path d="M280 0H172L184 186H280Z" fill="' + INK + '" opacity=".34"/>' +
      '<path d="M118 0H172L184 186H104Z" fill="' + PAPER + '" opacity=".34"/>' +
      '<path d="M118 0L104 186M172 0L184 186" stroke="' + INK + '" stroke-width="1" opacity=".5" fill="none"/>' +
      '<rect y="132" width="280" height="54" fill="' + INK + '" opacity=".18"/>' +
      '<path d="M0 132H96L72 186H0Z" fill="' + PAPER + '" opacity=".22"/>' +
      '<rect x="16" y="66" width="28" height="60" fill="' + INK + '" opacity=".22"/>' +
      '<rect x="210" y="58" width="26" height="70" fill="' + INK + '" opacity=".26"/>' +
      '<path d="M94 34Q144 48 194 30M102 46Q150 60 200 44" stroke="' + INK + '" stroke-width="1.2" fill="none" opacity=".45"/>' +
      '<ellipse cx="150" cy="102" rx="4.4" ry="5" fill="' + INK + '" opacity=".62"/>' +
      '<path d="M150 107C145 110 143 122 144 134H156C157 122 155 110 150 107Z" fill="' + INK + '" opacity=".62"/>' +
      '<path d="M144 134L142 138M156 134L158 138" stroke="' + INK + '" stroke-width="2" opacity=".6"/>',

    /* 早餐摊的热气 */
    2:
      '<rect y="150" width="280" height="36" fill="' + INK + '" opacity=".20"/>' +
      '<path d="M22 50H258L248 64H32Z" fill="' + INK + '" opacity=".44"/>' +
      '<rect x="30" y="64" width="4" height="86" fill="' + INK + '" opacity=".4"/>' +
      '<rect x="244" y="64" width="4" height="86" fill="' + INK + '" opacity=".4"/>' +
      '<rect x="52" y="112" width="176" height="38" fill="' + INK + '" opacity=".34"/>' +
      '<rect x="48" y="107" width="184" height="6" fill="' + PAPER + '" opacity=".45"/>' +
      '<ellipse cx="94" cy="102" rx="17" ry="5" fill="' + INK + '" opacity=".45"/>' +
      '<ellipse cx="94" cy="96" rx="17" ry="5" fill="' + INK + '" opacity=".34"/>' +
      '<ellipse cx="94" cy="90" rx="17" ry="5" fill="' + INK + '" opacity=".26"/>' +
      '<ellipse cx="150" cy="103" rx="13" ry="4" fill="' + INK + '" opacity=".4"/>' +
      '<path d="M92 84C84 70 100 62 92 46M104 82C98 68 112 60 106 44M150 96C142 82 158 74 150 58" stroke="' + INK + '" stroke-width="5" stroke-linecap="round" fill="none" opacity=".10"/>' +
      '<path d="M92 84C84 70 100 62 92 46M104 82C98 68 112 60 106 44" stroke="' + PAPER + '" stroke-width="3" stroke-linecap="round" fill="none" opacity=".55"/>' +
      '<ellipse cx="212" cy="96" rx="5" ry="5.6" fill="' + INK + '" opacity=".55"/>' +
      '<path d="M212 102C205 106 203 122 204 138H220C221 122 219 106 212 102Z" fill="' + INK + '" opacity=".55"/>' +
      '<circle cx="62" cy="72" r="3.2" fill="' + PAPER + '" opacity=".8"/>' +
      '<circle cx="62" cy="72" r="5.4" stroke="' + INK + '" stroke-width=".7" fill="none" opacity=".28"/>',

    /* 窗格投影 */
    3:
      '<rect width="280" height="186" fill="' + INK + '" opacity=".24"/>' +
      '<path d="M58 22H212L248 152H28Z" fill="' + PAPER + '" opacity=".5"/>' +
      '<path d="M74 36H132L128 82H68Z" fill="' + PAPER + '" opacity=".6"/>' +
      '<path d="M142 36H198L206 82H138Z" fill="' + PAPER + '" opacity=".6"/>' +
      '<path d="M68 92H128L124 138H60Z" fill="' + PAPER + '" opacity=".6"/>' +
      '<path d="M138 92H206L212 138H134Z" fill="' + PAPER + '" opacity=".6"/>' +
      '<path d="M134 24L130 82M198 24L206 82M64 86H212M58 144H218" stroke="' + INK + '" stroke-width="3" opacity=".42" fill="none"/>' +
      '<path d="M42 24H80M210 152H250" stroke="' + INK + '" stroke-width="1" opacity=".3"/>' +
      '<path d="M28 152L248 152L280 186H0Z" fill="' + PAPER + '" opacity=".26"/>',

    /* 逆光 / 树影 */
    4:
      '<circle cx="206" cy="44" r="27" fill="' + PAPER + '" opacity=".85"/>' +
      '<circle cx="206" cy="44" r="35" stroke="' + INK + '" stroke-width="1" opacity=".14" fill="none"/>' +
      '<rect x="0" y="120" width="74" height="66" fill="' + INK + '" opacity=".16"/>' +
      '<rect x="228" y="104" width="52" height="82" fill="' + INK + '" opacity=".14"/>' +
      '<rect y="160" width="280" height="26" fill="' + INK + '" opacity=".22"/>' +
      '<path d="M0 186H280V170L104 158Z" fill="' + INK + '" opacity=".14"/>' +
      '<path d="M58 186C62 148 60 108 66 72" stroke="' + INK + '" stroke-width="4" stroke-linecap="round" opacity=".68" fill="none"/>' +
      '<path d="M64 96L30 76M64 88L104 66M66 74L58 40M66 72L92 34M64 110L38 104" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round" opacity=".55" fill="none"/>' +
      '<ellipse cx="84" cy="62" rx="50" ry="32" fill="' + INK + '" opacity=".34"/>' +
      '<ellipse cx="122" cy="46" rx="34" ry="22" fill="' + INK + '" opacity=".26"/>' +
      '<ellipse cx="46" cy="82" rx="26" ry="16" fill="' + INK + '" opacity=".22"/>',

    /* 石板路上的雨 */
    5:
      '<rect width="280" height="74" fill="' + INK + '" opacity=".18"/>' +
      '<rect y="74" width="280" height="112" fill="' + INK + '" opacity=".26"/>' +
      '<path d="M0 74H280M0 104H280M0 136H280M0 164H280" stroke="' + PAPER + '" stroke-width="1" opacity=".22"/>' +
      '<path d="M44 74V104M128 74V104M212 74V104M84 104V136M168 104V136M244 104V136M52 136V164M136 136V164M220 136V164" stroke="' + PAPER + '" stroke-width="1" opacity=".18"/>' +
      '<ellipse cx="146" cy="150" rx="72" ry="15" fill="' + PAPER + '" opacity=".45"/>' +
      '<path d="M96 150H196" stroke="' + INK + '" stroke-width="1" opacity=".16"/>' +
      '<path d="M30 20L18 44M58 8L46 32M86 24L74 48M114 6L102 30M142 22L130 46M170 10L158 34M198 26L186 50M226 8L214 32M254 22L242 46" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round" opacity=".24"/>' +
      '<path d="M30 62L18 86M86 66L74 90M142 60L130 84M198 66L186 90M254 62L242 86" stroke="' + PAPER + '" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>',

    /* 远处车流 */
    6:
      '<rect x="0" y="66" width="58" height="86" fill="' + INK + '" opacity=".42"/>' +
      '<rect x="52" y="88" width="46" height="64" fill="' + INK + '" opacity=".32"/>' +
      '<rect x="186" y="76" width="40" height="76" fill="' + INK + '" opacity=".36"/>' +
      '<rect x="220" y="58" width="60" height="94" fill="' + INK + '" opacity=".46"/>' +
      '<rect x="102" y="118" width="18" height="34" fill="' + INK + '" opacity=".3"/>' +
      '<rect x="8" y="74" width="5" height="8" fill="' + PAPER + '" opacity=".5"/>' +
      '<rect x="20" y="94" width="5" height="8" fill="' + PAPER + '" opacity=".42"/>' +
      '<rect x="232" y="70" width="6" height="9" fill="' + PAPER + '" opacity=".5"/>' +
      '<rect x="248" y="96" width="6" height="9" fill="' + PAPER + '" opacity=".4"/>' +
      '<rect x="254" y="66" width="7" height="7" fill="var(--accent)" opacity=".85"/>' +
      '<rect y="152" width="280" height="34" fill="' + INK + '" opacity=".5"/>' +
      '<path d="M0 152H280" stroke="' + PAPER + '" stroke-width="1" opacity=".2"/>' +
      '<path d="M118 168C164 160 214 172 280 158" stroke="' + PAPER + '" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>' +
      '<path d="M122 176C170 168 220 178 280 166" stroke="' + PAPER + '" stroke-width="2" stroke-linecap="round" fill="none" opacity=".45"/>' +
      '<circle cx="262" cy="159" r="2.4" fill="' + PAPER + '" opacity=".9"/>',

    /* 公交站排队 */
    7:
      '<rect y="152" width="280" height="34" fill="' + INK + '" opacity=".22"/>' +
      '<rect x="10" y="28" width="204" height="6" fill="' + INK + '" opacity=".55"/>' +
      '<rect x="16" y="34" width="3" height="118" fill="' + INK + '" opacity=".45"/>' +
      '<rect x="204" y="34" width="3" height="118" fill="' + INK + '" opacity=".45"/>' +
      '<rect x="24" y="40" width="176" height="96" fill="' + INK + '" opacity=".12"/>' +
      '<circle cx="52" cy="92" r="5" fill="' + INK + '" opacity=".66"/>' +
      '<path d="M52 98C46 101 44 118 45 136H59C60 118 58 101 52 98Z" fill="' + INK + '" opacity=".66"/>' +
      '<circle cx="86" cy="86" r="5.4" fill="' + INK + '" opacity=".58"/>' +
      '<path d="M86 93C80 96 78 114 79 134H93C94 114 92 96 86 93Z" fill="' + INK + '" opacity=".58"/>' +
      '<circle cx="120" cy="90" r="5" fill="' + INK + '" opacity=".5"/>' +
      '<path d="M120 96C114 99 112 116 113 135H127C128 116 126 99 120 96Z" fill="' + INK + '" opacity=".5"/>' +
      '<circle cx="154" cy="84" r="5.6" fill="' + INK + '" opacity=".6"/>' +
      '<path d="M154 91C148 94 146 114 147 136H161C162 114 160 94 154 91Z" fill="' + INK + '" opacity=".6"/>' +
      '<rect x="216" y="84" width="64" height="76" fill="' + INK + '" opacity=".42"/>' +
      '<rect x="222" y="92" width="52" height="22" fill="' + PAPER + '" opacity=".42"/>' +
      '<circle cx="232" cy="162" r="6" fill="' + INK + '" opacity=".6"/>' +
      '<circle cx="264" cy="162" r="6" fill="' + INK + '" opacity=".6"/>',

    /* 收工 / 空镜 */
    8:
      '<path d="M0 186L92 116H196L280 186Z" fill="' + INK + '" opacity=".16"/>' +
      '<path d="M0 0V186H74L104 116V0Z" fill="' + INK + '" opacity=".34"/>' +
      '<path d="M280 0V186H210L196 116V0Z" fill="' + INK + '" opacity=".3"/>' +
      '<path d="M104 116H196" stroke="' + INK + '" stroke-width="1" opacity=".3"/>' +
      '<ellipse cx="150" cy="116" rx="52" ry="12" fill="' + PAPER + '" opacity=".55"/>' +
      '<path d="M196 186V58" stroke="' + INK + '" stroke-width="3" opacity=".62"/>' +
      '<path d="M196 58H176" stroke="' + INK + '" stroke-width="3" opacity=".62"/>' +
      '<circle cx="174" cy="63" r="5" fill="' + PAPER + '" opacity=".9"/>' +
      '<circle cx="174" cy="63" r="16" fill="' + PAPER + '" opacity=".18"/>' +
      '<path d="M66 186L84 116M214 186L196 116" stroke="' + INK + '" stroke-width="1" opacity=".2"/>' +
      '<path d="M24 54H72M208 40H262" stroke="' + INK + '" stroke-width="1" opacity=".24"/>'
  };

  const mediaCursor = {};

  function mediaFor(variant) {
    const all = window.FILM_MEDIA || {};
    const scene = window.__KIT_SCENE;
    const list = (scene && all[scene]) || all[String(variant)] || all['*'];
    if (!list || !list.length) return null;
    const key = (scene && all[scene]) ? scene : ('f' + variant);
    const i = (mediaCursor[key] || 0) % list.length;
    mediaCursor[key] = (mediaCursor[key] || 0) + 1;
    return list.length > 1 ? list.slice(i).concat(list.slice(0, i)) : list;
  }

  function frame(variant, label) {
    const n = el('div', 'frame f' + variant);
    const seq = mediaFor(variant);
    if (seq) {
      n.classList.add('media');
      const img = document.createElement('img');
      img.src = seq[0].src;
      img.alt = seq[0].alt || '';
      img.decoding = 'async';
      if (seq[0].focus) img.style.objectPosition = seq[0].focus;
      if (seq.length > 1) img._seq = seq.map(function (item) { return item.src; });
      n.appendChild(img);
    } else {
      n.insertAdjacentHTML('beforeend',
        '<svg class="ph" viewBox="0 0 280 186" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        (SCENES[variant] || SCENES[1]) + '</svg>');
    }
    if (label) {
      const no = el('span', 'no', label);
      n.appendChild(no);
    }
    return n;
  }


  /* 页眉 */
  function hdr(left, right, slim) {
    const h = el('header', 'hdr' + (slim ? ' slim' : ''));
    const l = el('div', 'l');
    l.appendChild(el('i'));
    l.appendChild(el('b', null, left.brand || 'FILM'));
    if (left.sub) l.appendChild(el('span', null, left.sub));
    h.appendChild(l);
    const r = el('div', 'r', right || '');
    h.appendChild(r);
    return h;
  }

  function kick(text) {
    const k = el('div', 'kick');
    k.appendChild(el('i'));
    k.appendChild(el('span', null, text));
    return k;
  }

  /* 规格表 */
  function spec(rows) {
    const s = el('div', 'spec');
    rows.forEach(function (r) {
      s.appendChild(el('span', null, r[0]));
      s.appendChild(el('b', null, r[1]));
    });
    return s;
  }

  /* 逐字拆分 */
  function chars(text, cls) {
    const host = el('span', 'chars' + (cls ? ' ' + cls : ''));
    const src = inject(text);
    for (let i = 0; i < src.length; i++) {
      const c = document.createElement('span');
      c.textContent = src[i];
      host.appendChild(c);
    }
    return host;
  }

  /* 遮罩行：外层裁切，内层上移 */
  function maskLine(text, cls) {
    const outer = el('span', 'mask' + (cls ? ' ' + cls : ''));
    const inner = document.createElement('span');
    inner.textContent = inject(text);
    outer.appendChild(inner);
    return { node: outer, inner: inner };
  }

  function setReveal(node, p, dy) {
    node.style.opacity = String(p);
    node.style.transform = 'translate3d(0,' + ((1 - p) * dy).toFixed(2) + 'px,0)';
  }

  /* 视觉簇：版式层移动/缩放整组画面，场景内部坐标不变 */
  function cluster(cls) {
    return el('div', 'vis-cluster' + (cls ? ' ' + cls : ''));
  }

  window.kit = {
    el: el,
    cluster: cluster,
    frame: frame,
    hdr: hdr,
    kick: kick,
    spec: spec,
    chars: chars,
    maskLine: maskLine,
    setReveal: setReveal
  };
})();
