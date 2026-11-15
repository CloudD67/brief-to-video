# Look 视觉目录

Look = 主题（theme）+ 版式（layout）+ 动效气质（motion）+ 视觉引擎（engine）。主题决定颜色/字体/质感，版式决定信息骨架，motion 决定运镜与闪白的力度，engine 决定背景层那口气氛。**四者分开**，所以 5 个主题 × 4 个版式能组成很多方向；内置 15 个经过挑选的组合，既不把审美定死，也不让 AI 每次从零发明。

## 15 个 curated look

| id | 名称 | 主题 / 版式 / 动效 · 引擎 | 适合 | 一句话气质 |
|---|---|---|---|---|
| `ink-editorial` | 铅印 · 编辑 | letterpress / editorial / calm · `halftone` | 品牌片、工作室、文化活动 | 米纸、宋体、朱红与裁切标记；像一本会动的刊物 |
| `ink-poster` | 铅印 · 海报 | letterpress / poster / snappy · `riso` | 发布、演出、宣言、动态海报 | 一句话占满画面，信息退到边缘 |
| `ink-grid` | 铅印 · 年鉴 | letterpress / grid / precise · `halftone` | 报告、白皮书、研究、档案 | 十二栏与索引编号，把判断变成可核对的秩序 |
| `quiet-editorial` | 暖白 · 日常 | quiet / editorial / calm · `bokeh` | 咖啡、餐饮、生活方式、疗愈 | 暖白、低对比、鼠尾草绿；不喊口号 |
| `quiet-poster` | 暖白 · 留白 | quiet / poster / calm · `bokeh` | 极简品牌、展览、静态海报 | 大留白与居中短句，只保留一个呼吸点 |
| `quiet-split` | 暖白 · 对照 | quiet / split / calm · `bokeh` | 服务、门店、课程、体验介绍 | 像一张摊开的说明书，读完知道下一步 |
| `swiss-grid` | 瑞士 · 网格 | swiss / grid / precise · `orbit` | 科技、软件、数据、建筑、企业 | 冷白、正红、十二栏；只让结构说话 |
| `swiss-split` | 瑞士 · 产品 | swiss / split / precise · `orbit` | 产品功能、SaaS、功能介绍 | 左栏讲清楚，右栏给证据；一屏一个卖点 |
| `swiss-poster` | 瑞士 · 宣言 | swiss / poster / precise · `orbit` | 观点发布、大会开场、品牌主张 | 冷白底上只有一句主张与一个红色重音；不解释 |
| `cinema-editorial` | 银幕 · 叙事 | cinema / editorial / cinematic · `dust` | 影像、故事、高端品牌 | 近黑、金字、上下黑边；字幕像旁白 |
| `cinema-poster` | 银幕 · 预告 | cinema / poster / cinematic · `aurora` | 首映、舞台、悬念预告 | 居中大字与黑场，信息越少期待越重 |
| `cinema-split` | 银幕 · 对白 | cinema / split / cinematic · `dust` | 人物访谈、品牌故事、真实影像 | 一半留给画面，一半留给话；素材与判断并排 |
| `tech-split` | 终端 · 分栏 | tech / split / precise · `flow` | AI、开发者工具、硬件、安全 | 深蓝黑、青色信号、等宽标签 |
| `tech-grid` | 终端 · 仪表 | tech / grid / precise · `scan` | 数据平台、监控、系统说明 | 扫描线、网格、状态；像工作中的仪表盘 |
| `tech-editorial` | 终端 · 记录 | tech / editorial / precise · `scan` | 开源项目、技术发布、开发日志 | 深色终端配编辑式栏线，把代码与结果写成记录 |

完整关键词见 `assets/template/js/looks.js` 的 `keywords`；`node tools/pick-look.js --list` 会列出全部。

## 选择流程（默认：用户选，AI 只推荐）

审美不交给 AI 拍板。除非用户已经指定 look 或明确授权代选，建工程前必须用**编辑器自带的交互选择器**（问题/选项卡片、ask_user、提问工具等）把 15 个方向交给用户，分两轮：

**第一轮 · 气质方向**（把推荐 look 所在分组标「推荐」）：

| 分组选项 | 包含 | 气质 |
|---|---|---|
| 纸感编辑 · 铅印 | `ink-editorial` / `ink-poster` / `ink-grid` | 米纸、宋体、朱红、裁切标记 |
| 暖白日常 · 静物 | `quiet-editorial` / `quiet-poster` / `quiet-split` | 暖白、低对比、鼠尾草绿 |
| 银幕影像 · 电影 | `cinema-editorial` / `cinema-poster` / `cinema-split` | 近黑、金字、上下黑边 |
| 结构与信号 | `swiss-grid` / `swiss-split` / `swiss-poster` / `tech-split` / `tech-grid` / `tech-editorial` | 冷白网格或深蓝黑终端 |

**第二轮 · 具体 look**：只列所选分组的具体 look，每个选项写 `主题/版式/动效 · 引擎` + 适合 + 一句话气质；推荐项标「推荐」。选择器最多 4 个选项：分组 ≤3 个 look 时，第 4 个给「按 brief 自动（用推荐）」；分组 4–6 个时分两屏，第一屏列 3 个 + 「看另外 N 个」，第二屏列剩余 + 「返回上一组」。

```bash
# 建工程前先算排序（不建工程，可在 Skill 目录直接跑）
SKILL="$HOME/.qoder/skills/brief-to-video"
node "$SKILL/assets/template/tools/pick-look.js" --root "$SKILL/assets/template" --json "<brief>"
```

- 有工程时也可以 `node tools/pick-look.js --json "<brief>"`，或 `npm run look:gallery` 出 15 look 样片墙让用户看图选。
- 随包总览图 `assets/looks-contact-sheet.jpg` 可直接给用户预览。
- 编辑器没有选择器时：按四个分组打印 15 个编号，请用户回编号；不要默认 auto。
- 用户说「你定 / 随便 / 自动」时才用 auto，并在交付时说明。

选定的 id 直接进 `new-film.js --look <id>`；不要先 auto 建工程再改配置。

## 自动推荐（只在用户授权时直接采用）

`config.look: 'auto'` 时，用 `brief + title + slogan + brandSub` 做关键词计分：

1. 每个命中关键词 +3（长度 ≥3）或 +2（短词）。
2. 指定主题时，同主题 +5，其他主题 −8。
3. brief 出现「海报 / 预告」→ poster 版式 +2；「网格 / 数据 / 仪表 / 报告」→ grid +2；「分栏 / 对照 / 产品 / 功能」→ split +2。
4. 取最高分；没有命中则回退到同主题的编辑版式，最终兜底 `ink-editorial`。

结果带 `confidence`（high / medium / fallback）、命中的关键词和 3 个备选。**计分只用于排序和选择器的默认高亮，不替用户拍板**：任何一层都可以手动覆盖。

```bash
node tools/pick-look.js "成都，城市宣传片，文化"        # 推荐 + 命中词 + 备选
node tools/pick-look.js --json "咖啡店，日常温暖"       # 给程序读（选择器流程用）
node tools/pick-look.js --root "$SKILL/assets/template" --json "brief"  # 工程外调用
node tools/pick-look.js "数据平台发布" --theme tech     # 主题约束下重排
node tools/pick-look.js "产品功能介绍" --layout split   # 只改版式
```

## 覆盖层级（从软到硬）

```bash
# 建工程时指定
node scripts/new-film.js ./film --title "北岸咖啡" --look quiet-editorial
node scripts/new-film.js ./film --title "山野来信" --vertical --look quiet-poster

# 渲染时临时指定
node render.js --look swiss-grid
node render.js --look auto --style quiet --layout split

# 预览时键盘切换（不写回文件）
npm run preview     # S 主题 / L 版式 / K look
```

URL 也支持 `?look=ink-poster&style=letterpress&layout=poster`，便于同一工程截多套图。优先级：URL > CLI > `config` > look 默认值。

## 版式

| 版式 | 骨架 | 适合 | 不要这样用 |
|---|---|---|---|
| `editorial` | 非对称左文右图，栏线与编号 | 大多数叙事/品牌片 | 需要一屏对照时信息会散 |
| `poster` | 居中等宽文案，画面压到边缘 | 海报、预告、口号 | 正文超过 2 行会拥挤 |
| `grid` | 十二栏、水平细线、严格基线 | 数据、系统、报告 | 情绪片会显得冷 |
| `split` | 左文右图硬分栏 + 竖分隔线 | 产品、功能、对照 | 左右都放密集内容会像说明书 |

版式覆盖写在 `styles/layouts.css`，只改坐标/层级，不回写场景动画。场景把文案包在 `.copy`、画面包在 `.vis-cluster`，版式层才能整体移动；自己写场景时保持这两个 wrapper。

## Motion

| id | 名称 | camera | flash | 适合 |
|---|---|---|---|---|
| `calm` | 克制 | 0.55 | 0.78 | 生活、文化、品牌 |
| `precise` | 精准 | 0.82 | 0.90 | 产品、数据、系统 |
| `snappy` | 利落 | 1.18 | 1.08 | 海报、发布、短视频 |
| `cinematic` | 电影感 | 0.74 | 0.50 | 预告、影像、高端 |

motion 只调 `timeline.js` 的连续运镜幅度与切点闪白，不改变场景内部动画。

## 视觉引擎

引擎是 Canvas 2D 画在 `.bg` 里的确定性氛围层：种子 PRNG + 时间函数，同一秒永远同一帧，不参与布局，不依赖 CSS 动画。

| 引擎 | 画面语言 | 默认归属 |
|---|---|---|
| `halftone` | 径向网点场 + 套印偏移 | ink-editorial / ink-grid |
| `riso` | 双色叠印色块 + 印刷噪点 | ink-poster |
| `bokeh` | 柔光散景 + 呼吸明暗 | quiet-editorial / quiet-poster / quiet-split |
| `dust` | 尘埃、斜光束、暖角漏光 | cinema-editorial / cinema-split |
| `aurora` | 极光带 + 竖光帘 | cinema-poster |
| `flow` | 解析流线场 + 亮节点 | tech-split |
| `scan` | 扫描带 + 遥测刻度 + 数据点列 | tech-grid / tech-editorial |
| `orbit` | 同心圆弧 + 十字标 + 行进刻度 | swiss-grid / swiss-split / swiss-poster |

```bash
# 临时对比引擎（URL 覆盖，不写回文件）
open "http://127.0.0.1:5173/?look=ink-editorial&engine=riso"
open "http://127.0.0.1:5173/?look=tech-grid&engine=none"
```

规则：一帧只允许一个引擎；深色主题用 `screen` 混合（其余 `multiply`）；引擎强度在 `js/looks.js` 的 `engineOpts` 里按 look 调好，手改幅度 ≤ ±0.03；改完跑 `npm run qa:engines` 并抽帧对比。完整目录、签名动作与反套路见 `design-dna.md`。

## 竖屏 9:16

```bash
node scripts/new-film.js ./vertical --title "山野来信" --vertical --look quiet-editorial
```

- 画布 1080×1920；文案在上、画面在中间 1920×1080 横带，底部留字幕安全区。
- `styles/portrait.css` 重排页眉、字号、`.copy`、`.vis-cluster` 和字幕；无需改场景代码。
- 竖屏 + poster 会去掉纸张水印，grid 收成 6 栏，split 隐藏竖分隔线。
- 竖屏也跑 `npm run qa`：`qa-layout` / `qa-timing` / `qa-stills` 会自动读 `data-aspect`。

## 素材与 look 的关系

真实素材只替换「印刷照片」占位图，不改变主题/版式。图片会继承主题的网点、暗角、纸色混合，所以 15 个 look 都能直接用。

```bash
# 文件名以场景 id 开头；视频会抽帧
cp alley.jpg assets/media/s1-alley.jpg
cp store.mp4 assets/media/s4-store.mp4
npm run media      # → js/media.generated.js
npm run check
```

多张图会在片内按进度切换，并有确定性的 Ken Burns（由 `--scene-p` 驱动，暂停/逐帧渲染也一致）。详见 `scene-authoring.md`。

产品/软件界面优先抓真实页面，而不是画插画：`tools/capture-web.js` 可对自有/授权页面做平滑滚动、合成光标与点击，输出场景素材帧。**只抓用户自己的页面或已明确授权的页面**，不抓竞品/第三方站点、不绕过登录与付费墙。详见 `scene-authoring.md` 第 8 节。

## 样片墙

随包有一张 15 look 一页总览，每个格子里标了主题 / 版式 / 引擎：`assets/looks-contact-sheet.jpg`。重新生成或给客户做提案：

```bash
npm run look:gallery                          # 15 个 look × 3 帧 → qa/looks/gallery.html
node tools/look-gallery.js . --looks ink-poster,tech-split
node tools/look-gallery.js . --at 6,26,47
open qa/looks/gallery.html

node tools/contact-sheet.js . --at 29.2 --out qa/contact-sheet.jpg   # 一页总览 JPEG
```

用于交付前目检所有审美方向，或给客户做风格提案。看的时候除了版式，也要看引擎：背景是否与主题同温、有没有压过标题、15 个方向是否真的长得不一样。

## 增加第 16 个 look

1. 在 `js/looks.js` 的 `LOOKS` 里加一条：`{ id, name, en, theme, layout, motion, bestFor, desc, keywords }`。
2. 在 `ENGINES` 里给它绑定引擎（不绑则 `engine: 'none'`）；新引擎要先在 `js/engines.js` 注册。
3. `node tools/check-project.js .` 会校验 id、主题文件、版式选择器与 keywords；`npm test` 会校验引擎 id 合法、alpha 范围。
4. 跑 `node tools/look-gallery.js . --looks <新 id>` 和 `npm run qa:engines -- --looks <新 id>` 目检。
5. 不需要改场景；只有当新 look 需要全新骨架时，才在 `styles/layouts.css` 增加 `html[data-layout="..."]`。

审美方向是开放的：15 个是起点，不是白名单。
