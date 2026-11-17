/* 视觉目录：look = 主题 + 版式 + 动效气质。
   不锁死审美：15 个 curated look 覆盖不同题材，auto 按 brief 关键词排序；
   ?look= / config.look 可强制，?layout= / ?style= 可单独覆盖。 */
(function (root, factory) {
  const api = factory();
  if (root) root.FILM_LOOKS = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MOTION = {
    calm: { id: 'calm', name: '克制', camera: 0.55, flash: 0.78 },
    precise: { id: 'precise', name: '精准', camera: 0.82, flash: 0.9 },
    snappy: { id: 'snappy', name: '利落', camera: 1.18, flash: 1.08 },
    cinematic: { id: 'cinematic', name: '电影感', camera: 0.74, flash: 0.5 },
    locked: { id: 'locked', name: '锁屏', camera: 0, flash: 0 }
  };

  const LAYOUTS = {
    editorial: { id: 'editorial', name: '编辑', desc: '非对称、左文右图、栏线与编号' },
    poster: { id: 'poster', name: '海报', desc: '居中、大字号、画面压成下三分之一' },
    grid: { id: 'grid', name: '网格', desc: '十二栏、编号、严格对齐的理性构图' },
    split: { id: 'split', name: '分栏', desc: '左右硬分栏、竖分隔线、信息对照' }
  };

  const LOOKS = [
    {
      id: 'ink-editorial',
      name: '铅印 · 编辑',
      en: 'INK / EDITORIAL',
      theme: 'letterpress',
      layout: 'editorial',
      motion: 'calm',
      bestFor: '品牌片、工作室、文化活动',
      desc: '米纸、宋体、朱红与裁切标记；最像一本会动的刊物。',
      keywords: ['品牌', '品牌片', '文化', '工艺', '手作', '工作室', '活动', '展览', '出版', '编辑', '印刷', '纸', '纪录片', '城市']
    },
    {
      id: 'ink-poster',
      name: '铅印 · 海报',
      en: 'INK / POSTER',
      theme: 'letterpress',
      layout: 'poster',
      motion: 'snappy',
      bestFor: '发布、演出、宣言、动态海报',
      desc: '一句话占满画面，信息退到边缘，像一张会被撕下来的海报。',
      keywords: ['海报', '发布', '宣言', '演出', '音乐节', '开幕', '招募', '快闪', '口号', '活动预告']
    },
    {
      id: 'ink-grid',
      name: '铅印 · 年鉴',
      en: 'INK / YEARBOOK',
      theme: 'letterpress',
      layout: 'grid',
      motion: 'precise',
      bestFor: '报告、白皮书、研究、档案',
      desc: '十二栏与索引编号，把编辑判断变成可核对的秩序。',
      keywords: ['报告', '白皮书', '研究', '档案', '年鉴', '目录', '数据', '复盘', '年度', '机构']
    },
    {
      id: 'quiet-editorial',
      name: '暖白 · 日常',
      en: 'QUIET / DAILY',
      theme: 'quiet',
      layout: 'editorial',
      motion: 'calm',
      bestFor: '咖啡、餐饮、生活方式、疗愈',
      desc: '暖白、低对比、鼠尾草绿；不喊口号，只把日常放稳。',
      keywords: ['咖啡', '餐饮', '生活方式', '日常', '自然', '疗愈', '香', '茶', '花', '民宿', '旅行', '手作', '温暖', '慢']
    },
    {
      id: 'quiet-poster',
      name: '暖白 · 留白',
      en: 'QUIET / WHITESPACE',
      theme: 'quiet',
      layout: 'poster',
      motion: 'calm',
      bestFor: '极简品牌、展览、静态海报',
      desc: '大留白与居中短句，画面只保留一个呼吸点。',
      keywords: ['极简', '留白', '安静', '展览', '艺术', '香氛', '茶', '冥想', '静态']
    },
    {
      id: 'quiet-split',
      name: '暖白 · 对照',
      en: 'QUIET / SPLIT',
      theme: 'quiet',
      layout: 'split',
      motion: 'calm',
      bestFor: '服务、门店、课程、体验介绍',
      desc: '左文右图，像一张摊开的说明书，读完就知道下一步。',
      keywords: ['服务', '门店', '课程', '体验', '介绍', '预约', '菜单', '流程', '社区']
    },
    {
      id: 'swiss-grid',
      name: '瑞士 · 网格',
      en: 'SWISS / GRID',
      theme: 'swiss',
      layout: 'grid',
      motion: 'precise',
      bestFor: '科技、软件、数据、建筑、企业',
      desc: '冷白、正红、十二栏；不加装饰，只让结构说话。',
      keywords: ['科技', '软件', '数据', '建筑', '企业', '理性', '系统', '平台', 'B2B', '解决方案', '建筑事务所', '指标']
    },
    {
      id: 'swiss-split',
      name: '瑞士 · 产品',
      en: 'SWISS / PRODUCT',
      theme: 'swiss',
      layout: 'split',
      motion: 'precise',
      bestFor: '产品功能、SaaS、功能介绍',
      desc: '左栏讲清楚，右栏给出证据；最适合一屏一个卖点。',
      keywords: ['产品', '功能', '发布', 'SaaS', '介绍', '演示', '卖点', '版本', '更新', '工具']
    },
    {
      id: 'swiss-poster',
      name: '瑞士 · 宣言',
      en: 'SWISS / STATEMENT',
      theme: 'swiss',
      layout: 'poster',
      motion: 'precise',
      bestFor: '观点发布、大会开场、品牌主张',
      desc: '冷白底上只有一句主张与一个红色重音；不解释，先让人记住。',
      keywords: ['主张', '观点', '大会', '开场', '品牌', '宣言', '口号', '发布', '演讲', '主题']
    },
    {
      id: 'cinema-editorial',
      name: '银幕 · 叙事',
      en: 'CINEMA / NARRATIVE',
      theme: 'cinema',
      layout: 'editorial',
      motion: 'cinematic',
      bestFor: '影像、故事、高端品牌',
      desc: '近黑、金字、上下黑边；把字幕当成旁白，把画面当成银幕。',
      keywords: ['电影', '叙事', '故事', '影像', '预告', '高端', '夜', '情绪', '香水', '酒店', '奢华']
    },
    {
      id: 'cinema-poster',
      name: '银幕 · 预告',
      en: 'CINEMA / TRAILER',
      theme: 'cinema',
      layout: 'poster',
      motion: 'cinematic',
      bestFor: '首映、舞台、悬念预告',
      desc: '居中大字与黑场，信息越少，期待越重。',
      keywords: ['首映', '预告', '舞台', '悬念', '大片', '剧集', '开场', '片头', '沉浸']
    },
    {
      id: 'cinema-split',
      name: '银幕 · 对白',
      en: 'CINEMA / DIALOGUE',
      theme: 'cinema',
      layout: 'split',
      motion: 'cinematic',
      bestFor: '人物访谈、品牌故事、真实影像',
      desc: '一半留给画面，一半留给话；真实素材与判断并排出现。',
      keywords: ['人物', '访谈', '真实', '记录', '故事', '品牌', '影像', '案例', '客户', '幕后']
    },
    {
      id: 'tech-split',
      name: '终端 · 分栏',
      en: 'TECH / SPLIT',
      theme: 'tech',
      layout: 'split',
      motion: 'precise',
      bestFor: 'AI、开发者工具、硬件、安全',
      desc: '深蓝黑、青色信号、等宽标签；把功能讲成系统。',
      keywords: ['AI', '人工智能', '开发者', '工具', '安全', '硬件', '监控', 'API', '终端', '开源', '模型', '芯片', '服务器']
    },
    {
      id: 'tech-grid',
      name: '终端 · 仪表',
      en: 'TECH / CONSOLE',
      theme: 'tech',
      layout: 'grid',
      motion: 'precise',
      bestFor: '数据平台、监控、系统说明',
      desc: '扫描线、网格、编号与状态；像一块正在工作的仪表盘。',
      keywords: ['平台', '数据', '监控', '系统', '仪表盘', '日志', '指标', '运维', '网络', '云']
    },
    {
      id: 'tech-editorial',
      name: '终端 · 记录',
      en: 'TECH / LOG',
      theme: 'tech',
      layout: 'editorial',
      motion: 'precise',
      bestFor: '开源项目、技术发布、开发日志',
      desc: '深色终端配编辑式栏线，把代码与结果写成一篇可读的记录。',
      keywords: ['开源', '代码', '开发', '日志', '发布', '技术', '版本', '仓库', 'GitHub', '工程']
    }
  ];

  /* 视觉引擎：在主题/版式/动效之外加一层会呼吸的画面。
     全部确定性绘制（种子 PRNG + 时间），不依赖 CSS 动画，可逐帧定位。 */
  const ENGINES = {
    'ink-editorial': { engine: 'halftone', engineOpts: { alpha: 0.13, spacing: 18 } },
    'ink-poster': { engine: 'riso', engineOpts: { alpha: 0.17 } },
    'ink-grid': { engine: 'halftone', engineOpts: { alpha: 0.11, spacing: 13 } },
    'quiet-editorial': { engine: 'bokeh', engineOpts: { alpha: 0.09 } },
    'quiet-poster': { engine: 'bokeh', engineOpts: { alpha: 0.12 } },
    'quiet-split': { engine: 'bokeh', engineOpts: { alpha: 0.06 } },
    'swiss-grid': { engine: 'orbit', engineOpts: { alpha: 0.13 } },
    'swiss-split': { engine: 'orbit', engineOpts: { alpha: 0.09 } },
    'swiss-poster': { engine: 'orbit', engineOpts: { alpha: 0.12 } },
    'cinema-editorial': { engine: 'dust', engineOpts: { alpha: 0.85 } },
    'cinema-poster': { engine: 'aurora', engineOpts: { alpha: 0.9 } },
    'cinema-split': { engine: 'dust', engineOpts: { alpha: 0.6 } },
    'tech-split': { engine: 'flow', engineOpts: { alpha: 0.9 } },
    'tech-grid': { engine: 'scan', engineOpts: { alpha: 0.9 } },
    'tech-editorial': { engine: 'scan', engineOpts: { alpha: 0.75 } }
  };
  LOOKS.forEach(function (l) {
    const fx = ENGINES[l.id] || { engine: 'none' };
    l.engine = fx.engine;
    l.engineOpts = fx.engineOpts || {};
  });

  const DEFAULT_ID = 'ink-editorial';

  function normalize(text) {
    return String(text == null ? '' : text).toLowerCase();
  }

  function keywordScore(brief, look) {
    let score = 0;
    const hits = [];
    const text = normalize(brief);
    for (let i = 0; i < look.keywords.length; i++) {
      const k = look.keywords[i].toLowerCase();
      if (!k) continue;
      if (text.indexOf(k) !== -1) {
        score += k.length >= 3 ? 3 : 2;
        hits.push(look.keywords[i]);
      }
    }
    return { score: score, hits: hits };
  }

  function rankLooks(brief, opts) {
    opts = opts || {};
    const theme = opts.theme && opts.theme !== 'auto' ? opts.theme : null;
    const wantsPoster = /海报|poster|预告|trailer/i.test(brief || '');
    const wantsGrid = /网格|数据|仪表|报告|grid|dashboard/i.test(brief || '');
    const wantsSplit = /分栏|对照|产品|功能|split|对比/i.test(brief || '');

    return LOOKS.map(function (look) {
      const kw = keywordScore(brief, look);
      let score = kw.score;
      if (theme && look.theme === theme) score += 5;
      else if (theme) score -= 8;
      if (wantsPoster && look.layout === 'poster') score += 2;
      if (wantsGrid && look.layout === 'grid') score += 2;
      if (wantsSplit && look.layout === 'split') score += 2;
      return { look: look, score: score, hits: kw.hits };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  function chooseLook(brief, opts) {
    opts = opts || {};
    const theme = opts.theme && opts.theme !== 'auto' ? opts.theme : null;
    const ranked = rankLooks(brief, opts);

    let top = ranked[0];
    if (!top || top.score <= 0) {
      top = ranked.find(function (r) { return r.look.theme === (theme || 'letterpress'); }) || ranked[0];
      if (!top || top.score < 0) top = { look: getLook(DEFAULT_ID), score: 0, hits: [] };
    }
    return {
      look: top.look,
      score: top.score,
      hits: top.hits,
      confidence: top.hits.length ? 'high' : (top.score > 0 ? 'medium' : 'fallback'),
      alternatives: ranked.filter(function (r) { return r.look.id !== top.look.id; }).slice(0, 3).map(function (r) {
        return { id: r.look.id, name: r.look.name, score: r.score, hits: r.hits };
      })
    };
  }

  function getLook(id) {
    if (!id || id === 'auto') return null;
    return LOOKS.find(function (l) { return l.id === id; }) || null;
  }

  function listLooks() {
    return LOOKS.map(function (l) {
      return {
        id: l.id, name: l.name, en: l.en, theme: l.theme, layout: l.layout,
        motion: l.motion, engine: l.engine, bestFor: l.bestFor, desc: l.desc, keywords: l.keywords
      };
    });
  }

  return {
    LOOKS: LOOKS,
    LAYOUTS: LAYOUTS,
    MOTION: MOTION,
    DEFAULT_ID: DEFAULT_ID,
    chooseLook: chooseLook,
    rankLooks: rankLooks,
    getLook: getLook,
    listLooks: listLooks
  };
});
