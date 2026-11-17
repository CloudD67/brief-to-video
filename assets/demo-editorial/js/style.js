/* 风格解析：look（主题+版式+动效）优先，?style= / ?layout= / ?look= 可分别覆盖。
   预览时 S 轮换主题、L 轮换版式、K 轮换 look。 */
(function () {
  'use strict';

  const C = window.FILM_CONFIG || {};
  const LOOKS = window.FILM_LOOKS;
  const params = new URLSearchParams(location.search);

  const links = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]'));
  const installedThemes = links.map(function (l) {
    const m = /themes\/([a-z0-9-]+)\.css/.exec(l.getAttribute('href') || '');
    return m ? m[1] : null;
  }).filter(Boolean);
  const installedLayouts = ['editorial', 'poster', 'grid', 'split'];

  const urlStyle = params.get('style');
  const urlLayout = params.get('layout');
  const urlLook = params.get('look');
  const configStyle = C.style && C.style !== 'auto' ? C.style : null;
  const configLayout = C.layout && C.layout !== 'auto' ? C.layout : null;
  const requestedLook = urlLook || C.look || 'auto';

  const brief = [C.brief, C.title, C.slogan, C.brandSub].filter(Boolean).join(' ');
  const themeHint = urlStyle || configStyle || null;

  let look = null;
  let auto = null;
  if (LOOKS && requestedLook !== 'auto' && requestedLook !== 'none') {
    look = LOOKS.getLook(requestedLook);
    if (!look) {
      console.warn('未知 look "' + requestedLook + '"，改为自动选择；可用：' + LOOKS.LOOKS.map(function (l) { return l.id; }).join(' / '));
    }
  }
  if (!look && LOOKS) {
    auto = LOOKS.chooseLook(brief, { theme: themeHint });
    look = auto.look;
  }

  let theme = urlStyle || configStyle || (look && look.theme) || 'letterpress';
  if (installedThemes.length && installedThemes.indexOf(theme) === -1) {
    console.warn('未知风格 "' + theme + '"，回退到 ' + installedThemes[0] + '；可用：' + installedThemes.join(' / '));
    theme = installedThemes[0];
  }

  let layout = urlLayout || configLayout || (look && look.layout) || 'editorial';
  if (installedLayouts.indexOf(layout) === -1) {
    console.warn('未知版式 "' + layout + '"，回退到 editorial；可用：' + installedLayouts.join(' / '));
    layout = 'editorial';
  }

  const motionId = (look && look.motion) || 'calm';
  const motion = (LOOKS && LOOKS.MOTION[motionId]) || { id: 'calm', camera: 1, flash: 1 };
  const aspect = (C.width || 1920) < (C.height || 1080) ? 'portrait' : 'landscape';

  document.documentElement.dataset.style = theme;
  document.documentElement.dataset.layout = layout;
  document.documentElement.dataset.motion = motion.id;
  document.documentElement.dataset.look = look ? look.id : 'none';
  document.documentElement.dataset.aspect = aspect;

  window.FILM_STYLE = theme;
  window.FILM_THEMES = installedThemes;
  window.FILM_LAYOUT = layout;
  window.FILM_MOTION = motion;
  window.FILM_LOOK = look ? look.id : 'none';
  window.FILM_LOOK_OBJ = look;
  window.FILM_LOOK_AUTO = auto;

  const renderMode = /[?&]render=1(&|$)/.test(location.search);
  if (renderMode) return;

  if (look) {
    console.log('look → ' + look.name + '（' + look.theme + ' / ' + look.layout + ' / ' + motion.name + '）' +
      (auto ? ' · 自动：' + auto.confidence : ' · 手动'));
  }

  function applyLook(next) {
    look = next;
    theme = next.theme;
    layout = next.layout;
    const m = (LOOKS && LOOKS.MOTION[next.motion]) || motion;
    document.documentElement.dataset.style = theme;
    document.documentElement.dataset.layout = layout;
    document.documentElement.dataset.motion = m.id;
    document.documentElement.dataset.look = next.id;
    window.FILM_STYLE = theme;
    window.FILM_LAYOUT = layout;
    window.FILM_LOOK = next.id;
    window.FILM_LOOK_OBJ = next;
    window.FILM_MOTION = m;
    console.log('look → ' + next.name + '（' + theme + ' / ' + layout + ' / ' + m.name + '）');
  }

  function cycleTheme() {
    const next = installedThemes[(installedThemes.indexOf(window.FILM_STYLE) + 1) % installedThemes.length];
    window.FILM_STYLE = next;
    document.documentElement.dataset.style = next;
    console.log('风格 → ' + next);
  }

  function cycleLayout() {
    const next = installedLayouts[(installedLayouts.indexOf(window.FILM_LAYOUT) + 1) % installedLayouts.length];
    window.FILM_LAYOUT = next;
    document.documentElement.dataset.layout = next;
    console.log('版式 → ' + next);
  }

  function cycleLook() {
    if (!LOOKS || !LOOKS.LOOKS.length) return;
    const ids = LOOKS.LOOKS.map(function (l) { return l.id; });
    const i = ids.indexOf(window.FILM_LOOK);
    applyLook(LOOKS.LOOKS[(i + 1) % LOOKS.LOOKS.length]);
  }

  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'KeyS') cycleTheme();
    else if (e.code === 'KeyL') cycleLayout();
    else if (e.code === 'KeyK') cycleLook();
  });
})();
