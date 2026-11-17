/* ============================================================
   真屏语言工具箱 · SCREEN KIT
   产品界面片的零件：窗口 / 分栏 / 终端 / 看板 / 卡片 / 弹窗 / 任务条 /
   光标 / 连线 / 底部字幕 / 间幕卡 / 桌面拼贴。
   规则：
   - 全部确定性：只依赖 seek(local)，无随机、无 Date.now、无 CSS 动画。
   - 窗口/面板可以故意出画（data-bleed）：真实工作区永远比画框大；字幕与间幕卡不允许出画。
   - 界面文字要小（20–28px），越像真界面越可信；只有字幕和间幕卡放大。
   - 颜色只来自 styles/screen.css 的 .scr-* 与 tokens.css 的 --scr-*；
     主色跟主题 --accent 走，零件本身不带任何一支参考片的肤色。
   ============================================================ */
(function () {
  'use strict';

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
  function inv(local, at, dur) { return clamp01((local - at) / Math.max(0.001, dur)); }
  function num(v) { return (Math.round(v * 100) / 100).toFixed(2); }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function span(text, cls) { return el('span', cls, text); }
  function fade(n, p) { n.style.opacity = String(num(clamp01(p))); }

  /* ---------- 舞台 ---------- */

  function stage(o) {
    o = o || {};
    const n = el('div', 'scr-stage' + (o.light ? ' scr-light' : '') + (o.cls ? ' ' + o.cls : ''));
    n.appendChild(el('div', 'scr-wash'));
    n.appendChild(el('div', 'scr-vig'));
    return n;
  }

  function dim() {
    const n = el('div', 'scr-dim');
    n.seek = function (local, at, dur) {
      fade(n, easeOut(inv(local, at == null ? 0 : at, dur == null ? 0.3 : dur)));
    };
    return n;
  }

  function dot(tone) { return el('i', 'scr-dot' + (tone ? ' ' + tone : '')); }

  function live(text, tone) {
    const n = el('span', 'scr-live');
    n.appendChild(dot(tone));
    n.appendChild(span(text));
    return n;
  }

  function icon(text, tone) {
    return el('div', 'scr-icon' + (tone ? ' ' + tone : ''), text);
  }

  /* ---------- 窗口 / 面板 ---------- */

  function win(o) {
    o = o || {};
    const w = el('div', 'scr-win' + (o.cls ? ' ' + o.cls : ''));
    w.setAttribute('data-bleed', '1');
    if (o.x != null) w.style.left = o.x + 'px';
    if (o.y != null) w.style.top = o.y + 'px';
    if (o.w != null) w.style.width = o.w + 'px';
    if (o.h != null) w.style.height = o.h + 'px';

    const bar = el('div', 'scr-win-bar');
    if (o.icon) bar.appendChild(o.icon);
    if (o.title) bar.appendChild(el('div', 'scr-win-title', o.title));
    if (o.sub) bar.appendChild(el('div', 'scr-win-sub', o.sub));
    if (o.status) bar.appendChild(live(o.status, o.tone));

    const count = o.actions == null ? 3 : o.actions;
    const acts = el('div', 'scr-win-actions');
    acts.setAttribute('data-decor', '1');
    for (let i = 0; i < count; i++) acts.appendChild(el('div', 'scr-btn', ['−', '□', '×'][i] || '×'));
    if (o.extra) acts.appendChild(o.extra);
    bar.appendChild(acts);

    const body = el('div', 'scr-win-body');
    w.appendChild(bar);
    w.appendChild(body);
    w.body = body;
    w.bar = bar;
    return w;
  }

  /* ---------- 分栏 ---------- */

  function split(o) {
    o = o || {};
    const n = el('div', 'scr-split');
    n.style.left = (o.x || 0) + 'px';
    n.style.top = (o.y || 0) + 'px';
    if (o.w != null) n.style.width = o.w + 'px';
    if (o.h != null) n.style.height = o.h + 'px';
    return n;
  }

  function col(w, cls) {
    const n = el('div', 'scr-col' + (cls ? ' ' + cls : ''));
    if (w != null) n.style.width = w + 'px';
    return n;
  }

  function divider() { return el('div', 'scr-divider'); }

  /* ---------- 终端 ---------- */

  function term(o) {
    o = o || {};
    const n = el('div', 'scr-term');
    n.setAttribute('data-bleed', '1');
    if (o.size) n.style.fontSize = o.size + 'px';
    const lines = [];
    function add(kind, text) {
      const ln = el('div', 'ln ' + (kind || 'out'));
      ln.textContent = text;
      n.appendChild(ln);
      lines.push(ln);
      return ln;
    }
    (o.lines || []).forEach(function (row) { add(row[0], row[1]); });
    n.add = add;
    n.lines = lines;
    return n;
  }

  function caret(node, local, visible) {
    let c = node.querySelector('.scr-caret');
    if (!c) { c = el('span', 'scr-caret'); node.appendChild(c); }
    if (visible === false) { c.style.opacity = '0'; return; }
    c.style.opacity = Math.floor(local * 1.8) % 2 ? '0.12' : '1';
  }

  /* 打字：p 0→1，逐字显示；未打完时保留光标 */
  function type(node, text, p, o) {
    o = o || {};
    const src = String(text);
    const k = Math.max(0, Math.round(src.length * clamp01(p)));
    node.textContent = src.slice(0, k);
    if (o.caret !== false && (k < src.length || o.keepCaret)) {
      node.appendChild(el('span', 'scr-caret'));
    }
  }

  /* 成组入场：节点依次淡入上移，用于表格行、卡片、日志行 */
  function reveal(nodes, local, at, stagger, dur) {
    stagger = stagger == null ? 0.06 : stagger;
    dur = dur == null ? 0.32 : dur;
    for (let i = 0; i < nodes.length; i++) {
      const p = easeOut(inv(local, (at || 0) + i * stagger, dur));
      fade(nodes[i], p);
      nodes[i].style.transform = 'translate3d(0,' + num((1 - p) * 10) + 'px,0)';
    }
  }

  function hr() { return el('div', 'scr-hr'); }

  /* ---------- 看板 ---------- */

  function board(o) {
    o = o || {};
    const n = el('div', 'scr-board');
    n.setAttribute('data-bleed', '1');

    const tabs = el('div', 'scr-tabs');
    (o.tabs || []).forEach(function (t) {
      const tab = el('div', 'scr-tab' + (t.on ? ' on' : ''), t.label);
      if (t.count != null) tab.appendChild(el('span', 'n', String(t.count)));
      tabs.appendChild(tab);
    });

    const filters = el('div', 'scr-filters');
    (o.filters || []).forEach(function (f) {
      const p = el('div', 'scr-filter' + (f.on ? ' on' : ''), f.label);
      if (f.count != null) p.appendChild(el('span', 'n', String(f.count)));
      filters.appendChild(p);
    });
    if (o.field) filters.appendChild(el('div', 'scr-field', o.field));
    if (o.note) filters.appendChild(el('div', 'scr-note', o.note));

    const grid = el('div', 'scr-grid');
    grid.style.gridTemplateColumns = 'repeat(' + (o.cols || 5) + ', 1fr)';

    n.appendChild(tabs);
    n.appendChild(filters);
    n.appendChild(grid);
    n.tabs = tabs;
    n.filters = filters;
    n.grid = grid;
    return n;
  }

  function chip(text, kind) {
    return el('span', 'scr-chip' + (kind ? ' ' + kind : ''), text);
  }

  function card(o) {
    o = o || {};
    const n = el('div', 'scr-card');
    n.setAttribute('data-bleed', '1');
    const head = el('div', 'scr-card-head');
    if (o.avatar) head.appendChild(o.avatar);
    const meta = el('div');
    meta.appendChild(el('div', 'scr-card-name', o.name));
    if (o.tags && o.tags.length) {
      const tags = el('div', 'scr-card-tags');
      o.tags.forEach(function (t) { tags.appendChild(chip(t.label, t.kind)); });
      meta.appendChild(tags);
    }
    head.appendChild(meta);
    n.appendChild(head);
    if (o.desc) n.appendChild(el('div', 'scr-card-desc', o.desc));
    const foot = el('div', 'scr-card-foot');
    foot.appendChild(span(o.left || ''));
    foot.appendChild(span(o.right || ''));
    n.appendChild(foot);
    return n;
  }

  function avatar(glyph) { return el('div', 'scr-avatar', glyph); }

  /* ---------- 交接弹窗 ---------- */

  function dialog(o) {
    o = o || {};
    const n = el('div', 'scr-dialog' + (o.cls ? ' ' + o.cls : ''));
    n.setAttribute('data-bleed', '1');
    if (o.x != null) n.style.left = o.x + 'px';
    if (o.y != null) n.style.top = o.y + 'px';
    if (o.w != null) n.style.width = o.w + 'px';

    const head = el('div', 'scr-dialog-head');
    if (o.icon) head.appendChild(o.icon);
    const meta = el('div');
    meta.appendChild(el('div', 'scr-dialog-title', o.title));
    if (o.sub) meta.appendChild(el('div', 'scr-dialog-sub', o.sub));
    head.appendChild(meta);

    const body = el('div', 'scr-dialog-body');
    (o.rows || []).forEach(function (r) {
      const row = el('div', 'scr-dialog-row');
      if (r[0]) row.appendChild(el('b', null, r[0]));
      row.appendChild(span(r[1]));
      body.appendChild(row);
    });
    if (o.node) body.appendChild(o.node);

    n.appendChild(head);
    n.appendChild(body);

    if (o.actions !== false) {
      const foot = el('div', 'scr-dialog-foot');
      const acts = o.actions || ['取消', '确认'];
      acts.forEach(function (a, i) {
        foot.appendChild(el('div', 'scr-dialog-btn' + (i === acts.length - 1 ? ' primary' : ''), a));
      });
      n.appendChild(foot);
    }

    n.body = body;
    n.seek = function (local, at, dur) {
      const p = easeOut(inv(local, at == null ? 0 : at, dur == null ? 0.34 : dur));
      fade(n, p);
      n.style.transform = 'translate3d(0,' + num((1 - p) * 14) + 'px,0) scale(' + num(0.97 + 0.03 * p) + ')';
    };
    return n;
  }

  /* ---------- 任务条 ---------- */

  function taskbar(o) {
    o = o || {};
    const n = el('div', 'scr-taskbar' + (o.cls ? ' ' + o.cls : ''));
    n.setAttribute('data-bleed', '1');
    if (o.x != null) n.style.left = o.x + 'px';
    if (o.y != null) n.style.top = o.y + 'px';
    if (o.w != null) n.style.width = o.w + 'px';
    if (o.icon) n.appendChild(o.icon);
    if (o.title) n.appendChild(span(o.title));
    if (o.meta) n.appendChild(el('span', 'meta', o.meta));
    if (o.status) {
      n.statusNode = live(o.status, o.tone);
      n.appendChild(n.statusNode);
    }
    if (o.right) {
      const push = el('div', 'push');
      if (typeof o.right === 'string') push.textContent = o.right;
      else push.appendChild(o.right);
      n.appendChild(push);
    }
    n.seek = function (local, at, dur) {
      const p = easeOut(inv(local, at == null ? 0 : at, dur == null ? 0.3 : dur));
      fade(n, p);
      n.style.transform = 'translate3d(' + num((1 - p) * -12) + 'px,0,0)';
    };
    return n;
  }

  /* ---------- 对话记录 ---------- */

  function chat(messages) {
    const n = el('div', 'scr-chat');
    n.setAttribute('data-bleed', '1');
    const rows = (messages || []).map(function (m) {
      const row = el('div', 'scr-msg' + (m.me ? ' me' : ''));
      row.appendChild(m.avatar || avatar(m.who ? m.who.slice(0, 1) : '·'));
      const body = el('div', 'scr-msg-body');
      if (m.who) body.appendChild(el('div', 'scr-msg-name', m.who));
      body.appendChild(el('div', 'scr-bubble', m.text));
      row.appendChild(body);
      n.appendChild(row);
      return row;
    });
    n.rows = rows;
    n.seek = function (local, at, stagger) {
      at = at == null ? 0 : at;
      stagger = stagger == null ? 0.28 : stagger;
      for (let i = 0; i < rows.length; i++) {
        const p = easeOut(inv(local, at + i * stagger, 0.3));
        fade(rows[i], p);
        rows[i].style.transform = 'translate3d(0,' + num((1 - p) * 8) + 'px,0)';
      }
    };
    return n;
  }

  /* ---------- 底部字幕（画面内） ---------- */

  function caption(pill, text) {
    const n = el('div', 'scr-cap');
    const p = el('div', 'scr-cap-pill', pill);
    const line = el('div', 'scr-cap-line', text);
    n.appendChild(p);
    n.appendChild(line);
    n.pillNode = p;
    n.lineNode = line;
    /* 时序（学自参考片的动效，不含其肤色）：胶囊 0.26s 弹入，大字错开 0.08s；退场 0.16s 硬收 */
    n.seek = function (local, t0, t1) {
      const a = easeOut(inv(local, t0, 0.26));
      const b = easeOut(inv(local, t0 + 0.08, 0.30));
      const out = 1 - inv(local, t1, 0.16);
      p.style.opacity = String(num(a * out));
      p.style.transform = 'scale(' + num(0.92 + 0.08 * a) + ')';
      line.style.opacity = String(num(b * out));
      line.style.transform = 'translate3d(0,' + num((1 - b) * 12) + 'px,0)';
    };
    return n;
  }

  /* ---------- 间幕卡（纸色标点） ---------- */

  function intertitle(phrases, o) {
    o = o || {};
    const n = el('div', 'scr-inter');
    const row = el('div', 'scr-inter-line');
    const segs = [];
    const start = o.start == null ? 0.12 : o.start;
    const gap = o.gap == null ? 0.42 : o.gap;

    phrases.forEach(function (ph, i) {
      const seg = el('span', 'scr-inter-seg' + (ph.accent ? ' em' : ''), ph.text);
      let rule = null;
      if (ph.underline) {
        rule = el('i', 'scr-inter-rule');
        seg.appendChild(rule);
      }
      row.appendChild(seg);
      segs.push({ node: seg, rule: rule, at: start + i * gap });
    });

    n.appendChild(row);
    if (o.foot) n.appendChild(el('div', 'scr-inter-foot', o.foot));

    /* 时序：每段纯淡入 0.42s（不带位移），下划线在入场后 0.30s 从左画到右 0.42s */
    n.seek = function (local) {
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        fade(s.node, easeOut(inv(local, s.at, 0.42)));
        if (s.rule) {
          s.rule.style.transform = 'scaleX(' + num(easeOut(inv(local, s.at + 0.30, 0.42))) + ')';
        }
      }
    };
    return n;
  }

  /* ---------- 结尾拼贴 ---------- */

  function collage(items, o) {
    o = o || {};
    const n = el('div', 'scr-collage');
    const list = items.map(function (it, i) {
      const wrap = el('div', 'scr-collage-item');
      wrap.style.left = it.x + 'px';
      wrap.style.top = it.y + 'px';
      wrap.style.width = it.w + 'px';
      if (it.h) wrap.style.height = it.h + 'px';
      wrap.style.zIndex = String(it.z || 10 + i);
      wrap.appendChild(it.node);
      n.appendChild(wrap);
      return { node: wrap, rot: it.rot || 0, phase: i * 0.9, amp: it.amp == null ? 3 : it.amp };
    });
    n.seek = function (local, inAt) {
      inAt = inAt || 0;
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        const p = easeOut(inv(local, inAt + i * 0.05, 0.5));
        fade(it.node, p);
        const dy = Math.sin(local * 0.55 + it.phase) * it.amp + (1 - p) * 18;
        it.node.style.transform =
          'translate3d(0,' + num(dy) + 'px,0) rotate(' + num(it.rot) + 'deg) scale(' + num(0.96 + 0.04 * p) + ')';
      }
    };
    return n;
  }

  /* ---------- 连线 / 光标 ---------- */

  function wire(o) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'scr-wire');
    svg.setAttribute('viewBox', '0 0 ' + o.w + ' ' + o.h);
    svg.setAttribute('width', String(o.w));
    svg.setAttribute('height', String(o.h));
    if (o.x != null) svg.style.left = o.x + 'px';
    if (o.y != null) svg.style.top = o.y + 'px';
    if (o.w != null) svg.style.width = o.w + 'px';
    if (o.h != null) svg.style.height = o.h + 'px';

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', o.d);
    if (o.dash) path.style.strokeDasharray = o.dash;
    const halo = document.createElementNS(ns, 'circle');
    halo.setAttribute('class', 'halo');
    halo.setAttribute('r', '15');
    const head = document.createElementNS(ns, 'circle');
    head.setAttribute('class', 'head');
    head.setAttribute('r', '6');

    svg.appendChild(path);
    svg.appendChild(halo);
    svg.appendChild(head);

    let len = 0;
    return {
      node: svg,
      path: path,
      /* outAt：轨迹开始退场的本地秒数；路径、线头、光晕在 0.24s 内一起归零。
         交接镜头必须给 outAt——新内容可读前清不干净，就会留下压在新标题上的虚线或孤立的亮点。 */
      seek: function (local, t0, dur, outAt) {
        if (!len) {
          try { len = path.getTotalLength(); } catch (e) { len = 1; }
        }
        const p = easeOut(inv(local, t0 == null ? 0 : t0, dur == null ? 1.2 : dur));
        const fadeOut = outAt == null ? 1 : 1 - easeOut(inv(local, outAt, 0.24));
        const pt = path.getPointAtLength(Math.max(0.01, len * p));
        head.setAttribute('cx', pt.x);
        head.setAttribute('cy', pt.y);
        halo.setAttribute('cx', pt.x);
        halo.setAttribute('cy', pt.y);
        const headP = pt ? p * fadeOut : 0;
        head.setAttribute('opacity', headP > 0.001 ? String(num(headP)) : '0');
        halo.setAttribute('opacity', p > 0.02 && fadeOut > 0.001 ? String(num((0.16 + 0.1 * Math.sin(local * 3.2)) * fadeOut)) : '0');
        if (outAt != null) path.style.opacity = String(num(0.85 * fadeOut));
      }
    };
  }

  function cursor() { return el('div', 'scr-cursor'); }

  window.screen = {
    inv: inv,
    ease: easeOut,
    stage: stage,
    dim: dim,
    win: win,
    split: split,
    col: col,
    divider: divider,
    term: term,
    type: type,
    caret: caret,
    reveal: reveal,
    hr: hr,
    board: board,
    card: card,
    chip: chip,
    avatar: avatar,
    icon: icon,
    dot: dot,
    live: live,
    dialog: dialog,
    taskbar: taskbar,
    chat: chat,
    caption: caption,
    intertitle: intertitle,
    collage: collage,
    wire: wire,
    cursor: cursor
  };
})();
