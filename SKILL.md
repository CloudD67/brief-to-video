---
name: brief-to-video
description: 把一句话的视频需求做成可交付成片，先分类型：宣传片（promo，编辑排版 + look 系统）或 MV（mv，像素叙事 + 角色 + 镜头 + 字幕牌），两套语法绝不混用。宣传片支持 16:9 横屏与 9:16 竖屏，内置 15 个 curated look（5 主题 × 4 版式 × 4 动效气质）与 8 个确定性视觉引擎，默认用编辑器的选择器把方向交给用户选（AI 只排序推荐）；MV 用 480×270 像素画布、镜头制分镜（每镜 2–3 秒）、角色与底部字幕牌，16:9 输出，分辨率每次先问 1080p/4K。全片连续运镜 + 平滑缓动，可选真实图片/视频抽帧、授权网页抓帧与 macOS 中文旁白（含配乐侧链闪避）。当用户说“帮我做个视频 / 宣传片 / 企业宣传 / 品牌片 / MV / 像素动画 / 叙事短片 / 动态海报 / 产品片 / 功能讲解 / 发布会开场 / 活动预告 / 竖屏短视频 / 口播视频 / 把这段文案做成视频 / 照这个视频做”，或只给一句主题并期待一个 MP4 时使用。流程为 HTML/CSS/JS 时间轴 → Puppeteer 逐帧渲染 → FFmpeg 编码 4K/1080p → 单测/版式/节奏/引擎/画布体检 + 抽帧目检。
---

# Brief to Video

## 这个 Skill 做什么

输入一句需求（或一段文案），输出一条完成度可交付的短片：

- 一条成片（宣传片默认 4K；MV 每次先问 1080p/4K）、一张封面帧 `out/poster.png`、一套 QA 抽帧与体检报告
- 一个可继续改文案、换 look（宣传片）或改镜头（MV）的工程目录

**先分两种类型，语法不共用：**

- **宣传片 `promo`**：编辑排版语法。5 个主题（`letterpress` / `swiss` / `cinema` / `quiet` / `tech`）× 4 个版式（`editorial` / `poster` / `grid` / `split`）× 4 个 motion，内置 15 个 curated look；每个 look 绑定一个确定性视觉引擎（`halftone` / `riso` / `bokeh` / `dust` / `aurora` / `flow` / `scan` / `orbit`）。审美默认由用户选：AI 先按 brief 排序推荐，再用编辑器的选择器把方向交给用户。支持 16:9 与 9:16、真实素材、授权网页抓帧、旁白。
- **MV `mv`**：像素叙事语法。480×270 像素画布、镜头制分镜（60s 约 20–28 镜，每镜 2–3 秒）、角色与底部字幕牌、片尾卡；画面标签按 alpha 阈值二值化保持硬边，字幕牌保留灰度让 12px 密笔汉字也能读，逐帧可复现。MV **没有** look / 主题 / 版式 / 引擎，固定 16:9；引擎层通用，故事层每支片重写。

宣传片的场景与字幕按 60s 基准编写，改 `config.duration` 后运行时自动等比缩放；MV 的分镜是绝对秒数，改片长必须重排 `film.js`。全片可见文案集中在 `js/script.js`，场景文件只负责画。旁白可选：`npm run voice` 用 macOS `say` 按字幕时间轴生成，`encode.js` 自动混音并压低配乐。

## 安装 / 升级

```bash
scripts/install.sh                  # 复制到 ~/.qoder/skills/brief-to-video
scripts/install.sh --dest DIR       # 指定位置
scripts/install.sh --link           # 开发模式：软链当前目录
scripts/install.sh --force          # 覆盖旧版本
```

手动安装：把整个目录复制到 `~/.qoder/skills/`，重启会话或 `/skills reload`，用 `/brief-to-video` 调用。版本见 `VERSION`（2.4.0），许可 MIT，方法来源见 `ATTRIBUTIONS.md`。模板工程首次使用需 `npm install`（puppeteer-core + ffmpeg installer）。

## 先读什么

- **定类型读 `references/genres.md`**：宣传片 vs MV 的决策树、对照表、MV 语法与常见错误。
- **做 MV 读 `references/mv-craft.md`**：引擎/内容/配置三层分离、分镜字段、相机锚点、字幕安全区、坏帧修法与交付检查单。
- 选 look 读 `references/looks.md`：15 个方向、用户选择流程与推荐规则、版式/竖屏/素材。
- 想知道“为什么这样好看、该改哪个文件”读 `references/design-dna.md`：Ground→Content→Moment 三层、8 个引擎、借来的设计方法、签名动作、反套路黑名单。
- 动画面之前读 `references/design-taste.md`：反 AI 俗套、字体/间距/层级/动效/节奏的硬规则。
- 选主题读 `references/styles.md`：5 个主题、令牌契约、如何加第 6 个。
- 拿到 brief 读 `references/brief-to-beats.md`：拆句、定 7 拍、写字幕与文案。
- 改画面读 `references/scene-authoring.md`：场景契约、辅助函数、节奏预算、素材接入、常见坑。
- 构图与插画语言读 `references/art-direction.md`：网格、字号层级、插画、品质线。
- 跑命令、排错、交付读 `references/pipeline.md`：全部 CLI 参数、产物结构、故障排查。

## 工作流

### 0. 先分类型：宣传片还是 MV（必问）

**这是第一道分叉，比时长/画幅都先定。** 两种类型是两套独立的视觉语法，模板、CLI、QA 都不共用；混在一起会同时毁掉两边。

| 类型 | 长什么样 | 工程 |
|---|---|---|
| 宣传片 `promo` | 编辑排版：主题 + 版式 + look + 品牌信息；纸感/暖白/银幕/网格/终端五类气质 | `assets/template` |
| MV `mv` | 像素叙事：480×270 画布、镜头制分镜、角色、底部字幕牌；像一支像素动画短片 | `assets/genres/mv` |

信号明确就不要追问：宣传片/产品片/品牌片/功能讲解/发布会开场/动态海报/口播 → `promo`；MV/像素动画/叙事短片/像这个视频/有角色与歌词 → `mv`。**只给一句主题、没提形式时，必须用编辑器的选择器（同一个问题卡片）问一次**，不要用默认值猜：

```jsonc
{
  "question": "这支片属于哪一种？",
  "header": "影片类型",
  "options": [
    { "label": "宣传片", "description": "编辑排版 + look 系统：品牌、卖点、产品、数据；默认 60s，可竖屏" },
    { "label": "MV", "description": "像素叙事：镜头制分镜、角色、字幕牌，讲一个小故事；16:9，480×270 画布；分辨率可选 1080p/4K" }
  ]
}
```

拿到答案再往下走：promo 走第 1–12 步；MV 直接跳第 M1 步。`new-film.js` 不带 `--genre` 且非终端时会报错，提示先问用户——不要绕过。**MV 里不加 look/主题/版式，宣传片里不塞像素角色与字幕牌。**

### A. 宣传片（promo）

#### 1. 判断交付规格（30 秒内定下来）

| 问题 | 默认决策 |
|---|---|
| 时长 | 没指定 → 60s；社媒口播/开箱 → 30s；极短钩子 → 15s |
| 画幅 | 没指定 → 1920×1080；抖音/Reels/Shorts → 1080×1920（`--vertical`，版式自动重排） |
| 分辨率 | 默认 4K（`--scale 2`）；先出 1080p 审片（`--scale 1`） |
| 语言 | 跟随用户；中文为主时字幕与标题都用中文，英文只做微标签 |
| Look | 没指定 → 用编辑器选择器让用户从 15 个 look 里选；AI 只排序推荐（第 2 步） |
| 主题 | 只在客户指定气质/已有品牌色时强制 `--style`，否则交给 look |
| 音乐 | 默认本地合成（calm）；动作/科技 → tense；温暖叙事 → warm |
| 旁白 | 默认无旁白；用户要求口播、解说或文案较长时跑 `npm run voice` |
| 素材 | 默认代码绘制；用户给照片/视频时才放 `assets/media/` 并 `npm run media` |

时长/画幅/分辨率/语言/音乐/素材按上表默认走；必须问的只有类型（第 0 步）与审美（第 2 步），品牌名缺失且影响结构时再问一次。

#### 2. 选 look（用户选，AI 只推荐）

**审美由用户决定，AI 不自作主张。** 除非用户已指定 look，或明确说“你定 / 随便 / 自动”，否则建工程前必须让用户从 15 个 look 里选。不要先建完再问，也不要用纯文本清单让用户回编号。

1. **算推荐（不建工程）**：

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
node "$SKILL/assets/template/tools/pick-look.js" --root "$SKILL/assets/template" --json "<brief>"
```

推荐只用于排序和默认高亮，不要直接采用。

2. **用编辑器的选择器让用户选**，分两轮。第一轮「气质方向」四个选项：纸感编辑 · 铅印（`ink-*`）、暖白日常 · 静物（`quiet-*`）、银幕影像 · 电影（`cinema-*`）、结构与信号（`swiss-*` / `tech-*`），把推荐 look 所在分组标「推荐」。第二轮只列所选分组的具体 look，每项写 `主题/版式/动效 · 引擎` + 适合 + 一句话气质；分组 ≤3 个时第 4 个给「按 brief 自动（用推荐）」，4–6 个时分两屏，不要一次塞 6 个长选项。选项文案从 `--json` 的 ranking 加 `references/looks.md` 的表格生成。

**没有选择器时**：按四个分组打印编号清单，请用户回一个编号；仍然不要默认 auto。用户授权 AI 代选时（“你定”）才用 `auto`，交付时说明是自动选择。

3. **带用户选的 id 建工程**：`--look <id>`，交付写「look: `<id>`（用户选择）」。

只用于排序的推荐依据（不是替用户拍板）：

| brief 信号 | 首选 | 备选 |
|---|---|---|
| 品牌、工艺、文化、城市 | `ink-editorial` | `ink-grid` |
| 海报、发布、演出、口号 | `ink-poster` | `cinema-poster` |
| 报告、白皮书、年度复盘 | `ink-grid` / `swiss-grid` | `tech-grid` |
| 咖啡、餐饮、民宿、生活方式 | `quiet-editorial` | `quiet-split` |
| 产品功能、SaaS、一屏一个卖点 | `swiss-split` | `tech-split` |
| 影像、故事、高端、预告 | `cinema-editorial` | `cinema-poster` |
| AI、开发者工具、硬件、安全 | `tech-split` | `tech-grid` |
| 大会开场、观点宣言、品牌主张 | `swiss-poster` | `ink-poster` |
| 人物访谈、真实案例、品牌故事 | `cinema-split` | `cinema-editorial` |
| 开源项目、技术发布、开发日志 | `tech-editorial` | `tech-grid` |

**不要为了“高级”强行用 poster**：正文超过两行、信息密度高的片子用 poster 会丢信息；poster 是口号/预告的语法，不是万能模板。引擎绑定（ink → halftone/riso，quiet → bokeh，swiss → orbit，cinema → dust/aurora，tech → flow/scan）见 `references/design-dna.md`；**一帧只允许一个引擎**，引擎不能替代构图。覆盖优先级：URL > CLI > `config` > look 默认。

#### 3. brief → 7 拍分镜

按 `references/brief-to-beats.md` 把一句话拆成：钩子（0–5%）、问题/语境（5–17%）、转折/系统（17–36%）、细节证明（36–55%）、能力/规模（55–74%）、结果/行动（74–92%）、收束（92–100%）。先把 7 拍写成一张表：时间、场景、目的、屏幕文案、画面、转场。**先定文案再动画面**。

#### 4. 建工程

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
node "$SKILL/scripts/new-film.js" ./my-film \
  --genre promo \
  --title "北岸咖啡" \
  --brief "咖啡店，日常温暖，生活方式" \
  --look quiet-editorial \
  --brand "NORTH BANK" \
  --brand-sub "城市烘焙 / SINCE 2019" \
  --slogan "把清晨，烘进一杯里" \
  --duration 60

# 竖屏 + 用户选的 look
node "$SKILL/scripts/new-film.js" ./vertical \
  --genre promo --title "山野来信" --vertical \
  --brief "民宿，自然疗愈，竖屏短视频" --look quiet-editorial --duration 30
```

- 目标目录非空会拒绝；确认覆盖时加 `--force`。
- `--look` 来自第 2 步用户的选择；用户没选时不要直接写 `auto`。
- `--look` 不在 15 个 look 内会报错并列出可用值；`--style` / `--layout` 可单独强制某一层。
- `--brief` 写进 `config.brief`；`--no-install` 跳过依赖安装；`--poster-at` 是成片秒数（内部换算成 60s 基准）。
- 时长只改 `--duration`；竖屏用 `--vertical`（= `--size 1080x1920`），不要用 960×540 这类非标准画布，降分辨率请用 `render.js --scale`。
- 创建后 `cd my-film`，后续命令都在工程根目录执行。

#### 5. 改文案（最快见效）

1. `js/config.js`：`title / brand / brandSub / slogan / disclaimer / brief / look / style / layout`，以及时长、画幅、fps、封面时间。
2. `js/script.js`：全部字幕（`subtitles`）与每个场景的标题、副题、标签、卡片、面板、页脚文字。旁白可加 `narration`，不写则用 `text`。
3. `index.html`：只在新增/删除场景时改脚本引用；字幕容器保持空的 `<ol id="subs">`。

字幕用**场景内定位**，不写全局秒数：

```js
subtitles: [
  { scene: 's1', at: 0.4, dur: 1.8, text: '一句话，先要有画面' },
  { scene: 's1', at: 2.4, dur: 2.0, text: '剩下的，交给时间线' }
]
```

`at` / `dur` 都是 60s 基准的**场景内**秒数；改场景起止或片长时字幕自动跟随，不会跨切点。旧 `{ start, end, text }` 仍兼容，新工程不要再用。

- 大标题 4–8 个汉字，最多两行；副题 12–24 字；英文只做微型标签。
- 字幕每条 8–16 字，60s 基准 1.8–2.4 秒，最短 1.2 秒；阅读速度 ≤ 约 7 字/秒；不跨场景切点。
- 做口播时字幕可以短、旁白可以长：加 `narration`，`voiceover.js` 用旁白文本。
- **做一次全片术语扫描**：`grep -n "素材\|时间线\|字幕\|关键帧\|素材库\|导出" js/script.js`。与主题无关的伪 UI 术语要改写成本行业词或换掉整个场景，只改页眉和主标题会留下“模板感”。

#### 6. 素材与旁白（按需）

默认不需要素材：画面由代码绘制。用户提供照片/视频时：

```bash
mkdir -p assets/media
cp shot-alley.jpg assets/media/s1-alley.jpg      # 文件名前缀 = 场景 id
cp store.mp4      assets/media/s4-store.mp4      # 视频会按 --fps 抽帧
npm run media && npm run check
```

支持 `jpg/png/webp/avif` 与 `mp4/mov/m4v/webm/mkv/avi`；一个场景可放多张，按片内进度切换并做确定性 Ken Burns；素材继承当前 look 的纸张网点、暗角与色调。参数见 `references/pipeline.md`。

**产品/软件类 brief 优先用真实界面。** 用户授权时抓取自己的网页或本地工程：

```bash
node tools/capture-web.js --url https://example.com/app \
  --scene s4 --seconds 4 --fps 12 --size 1440x900 \
  --scroll 0,1200 --cursor "300,420;900,600" --click ".run-button"
npm run media && npm run check
```

**只抓用户自己的页面或已明确授权的页面**，不抓竞品/第三方站点，不绕过登录、付费墙或访问限制；抓帧属于用户素材，交付时注明来源与授权，不要把第三方界面当自有素材再分发。

用户要口播/解说时：

```bash
node tools/voiceover.js --list-voices         # 查看中文语音
npm run voice                                 # 按字幕时间轴生成 assets/voiceover.wav
node encode.js                                # 自动混入旁白 + 配乐侧链闪避
```

macOS 专用，调用系统 `say`，不联网、无 API 费用；默认优先 Tingting / Meijia。每条旁白若超出字幕槽位 0.35s 会提示；削波自动衰减。试听/核对时间用 `npm run voice:dry`，只生成某几句用 `--only 1,2,3`。

#### 7. 需要时重排场景

场景文件在 `js/scenes/`，按 `s0`–`s6` 注册。每个场景必须实现：

```js
const SC = window.FILM_SCRIPT.s3;   // 文案从剧本层取
S.push({
  id: 's3',
  start: 21.5,               // 60s 基准，不是成片秒数
  end: 33,                   // 最后一个场景的 end 固定写 60
  mount(root) { /* 建 DOM，存 this.node；文字来自 SC */ },
  seek(local, duration) { /* 只依赖 local 的纯函数动画 */ }
});
```

规则（详见 `references/scene-authoring.md`）：
- `seek` 里不能读 `Date.now()`、不能用未播种随机数；所有动画写成 `local` 的函数。
- 场景按 60s 基准覆盖 `[0, 60]` 且不重叠；最后一个场景的 `end` 固定为 `60`。
- 文案只从 `window.FILM_SCRIPT` 取；纯装饰编号/时间码可生成。
- 页眉、页脚、裁切标记在切点即出现（入场区间从负值开始）；入场位移留在画面内。
- 给 `style.left/top/width/height` 赋值必须带单位字符串（`'120px'`）。
- 全片连续运镜与切点闪白由 `js/timeline.js` 统一处理，场景内不要另做转场或全局相机。
- **颜色只用 `var(--token)`**；插画用 `--ill-ink/--ill-paper/--warm`。新增/删除场景后同步改 `index.html`。

#### 8. 环境体检 + 静态检查 + 单测

```bash
npm run doctor   # Node/依赖/Chrome/ffmpeg/磁盘/主题/配乐
npm run check
npm test         # look/引擎绑定/config/剧本/CLI 契约，秒级，不需要浏览器
```

`doctor` 把“渲染到一半才发现没 Chrome/磁盘不够”提前暴露：4K 全片按 8.5MB/帧估算。`check` 必须全部通过：配置合法、主题令牌契约、WCAG 对比度（正文 ≥10:1、字幕 ≥7:1）、字幕有序/不重叠/阅读速度/跨切点、场景覆盖、引用齐全、JS 语法、CSS 裸数字、颜色字面量。

#### 9. 自动体检（一条命令）

```bash
npm run qa          # = 静态检查 → 版式 → 节奏 → 引擎 → 抽帧，汇总写 qa/summary.json
npm run qa:layout   # 只量文字：出框、祖先裁切、nowrap 溢出、字幕压字、运行时报错
npm run qa:timing   # 节奏探针：占位符/未解析变量/70% 后残影/字幕/空尾帧
npm run qa:engines  # 15 个 look 的引擎逐一体检：绑定、单层、有内容、可复现、确实在动
npm run qa:motion   # 成片运动连续性：静态帧占比、帧差均值/分位、最长静止段、切点
node tools/qa-regress.js . --update   # 有意改设计后重建 SSIM 基线（仅本机）
node tools/qa-regress.js .            # 与基线比；worst < 0.985 即报警
node tools/qa-all.js . --look ink-poster              # 换 look 回归
node tools/qa-all.js . --look quiet-editorial --layout split
```

`qa-layout` 每场景采样 15/45/75/90% + 每条字幕中点（43 个时刻），报告 `qa/layout.json`。有 ERROR 先修，不要带着出框或占位符抽帧审片。换 look、换版式、竖屏都要重跑；样片墙只用于审美目检，不能替代 QA。**改了引擎或主题质感后必须跑 `qa:engines`**：它直接读 Canvas 像素，确认引擎没有白画、没有变成两层、同刻两次渲染一致、时间推进确实有变化。

`qa:motion` 对成片逐帧算帧差：静态帧占比 >50% 或帧差均值 <0.4 直接报错；>25% 或 <0.6 警告；连续静止 ≥1.2s 也警告。参考片（30fps）静态帧约 7%、帧差均值 2.96；本模板 `ink-editorial / calm` 为静止帧 1%、均值 0.81。帧差绝对值取决于画面密度，**以静止帧与最长静止段为主判据**，实拍素材或 tech/cinema look 应达到均值 1.5 以上。出现大面积静止时依次检查：场景 `seek` 是否整段没动、素材是否单张且无 Ken Burns、导出是否误用低帧率或重复帧。

#### 10. 抽帧目检（不要跳过）

```bash
npm run qa:stills   # 切点前 0.3s、切点、切点后 0.24s + 中点 + 82% 收尾 + 封面
npm run styles                                  # 换主题后：5 个主题 × 3 个时刻
npm run look:gallery                            # 换 look 或提案：15 look × 3 帧 → qa/looks/gallery.html
node tools/contact-sheet.js . --out qa/contact-sheet.jpg   # 15 look 一页总览
```

逐张看：切点前 0.3s / 后 0.24s 的页眉页脚与上一镜退出；切点帧是否双曝光或发灰（查 `timeline.js` 的 `FLASH_*`）；每个场景中点与 **82% 收尾帧**的主标题、正文、插画、字幕与残影；封面能否独立当缩略图；4K 缩到 1080p 后文字是否仍清楚。看样片墙时重点：同一场景在 15 个方向下是否都成立、poster 正文是否太挤、grid 是否真对齐、split 是否一侧过空、引擎是否喧宾夺主。

#### 11. 配乐、旁白与全片渲染

```bash
node synth-music.js --mood calm        # 生成 assets/music.wav
npm run voice                           # 可选：旁白 → assets/voiceover.wav
node render.js --scale 1 --from 0 --to 12   # 低成本试渲前 12 秒
node render.js --scale 1 && node encode.js  # 1080p 全片审片
```

`encode.js` 自动检测 `assets/voiceover.wav`：有旁白时音乐降到 0.40 左右并侧链闪避；无旁白时音乐 0.55、2s 淡入淡出。可调 `--voice-gain` / `--music-gain` / `--no-duck` / `--no-voice` / `--muted`。审片通过后出 4K：

```bash
node render.js            # 默认 --scale 2 → 3840×2160
node encode.js            # out/final.mp4（旁白 + 音乐）
node encode.js --proxy    # 额外 out/final_1080p.mp4
```

渲染中断用 `node render.js --resume`（参数必须一致，风格/look/版式不同会直接拒绝）。开渲前校验主题文件并按分辨率/帧数估算磁盘（<60% 预估直接失败）。`encode.js` 检查帧连续性，缺帧会报错；编码后打印 `volumedetect` 响度，出现“偏响/偏轻/削波”时调增益。编码后先跑 `npm run qa:motion`，不合格不要交付。

#### 12. 验收与交付

```bash
node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)"   # 取 ffmpeg
"$FFMPEG" -hide_banner -i out/final.mp4                            # 看时长/分辨率/音轨
node tools/grab.js out/final.mp4 3.0 15.0 27.0                     # 从成片回抽帧核对
```

交付报告写：成片路径/时长/分辨率/帧率/编码（H.264 / AAC / yuv420p / bt709）；look（用户选择还是自动，自动附置信度/命中词）、主题、版式、封面、QA 抽帧目录；画幅与时长缩放；运动连续性指标与 `qa:motion` 结果；素材来源与授权、旁白语音/语速/增益、音乐来源（本地合成）；工程目录。

### B. MV（pixel-story，像素叙事）

MV 是**代码绘制的像素叙事短片**：480×270 逻辑画布、镜头制分镜、角色与底部字幕牌。不做 AI 生图、不接实拍素材。引擎层通用，故事层每支片整段重写；完整经验与坏帧修法见 `references/mv-craft.md`。

#### M0. 建工程前必须问的三件事（不猜）

| 问题 | 为什么必须问 | 写进哪里 |
|---|---|---|
| 1080p 还是 4K？ | 交付规格，不能默认 | `new-film.js --resolution 1080p` 或 `--resolution 4k` → `config.renderScale` |
| 讲什么故事？ | 决定分镜与字幕，不能套模板 | `js/film.js` + `js/script.js` |
| 要不要配乐 / 旁白？ | 静音片是合法交付 | `npm run music` / `npm run voice`（都可选） |

一次问完，不要边做边问。画幅固定 16:9，不用问。

#### M1. 先给故事弧 + 分镜表，确认后再渲染

把 brief 拆成 7 拍：钩子 → 处境 → 压力 → 转折 → 离开/结果 → 余味 → 收束。再写成分镜表给用户确认：

| 时间 | 场景 | 这一镜发生什么 | 字幕 | 运镜 |
|---|---|---|---|---|
| 0–2.5 | city | 城市夜景，片头卡 | — | pan-r |
| 2.5–5 | platform | 她拖箱子走过站台 | 她拖着箱子，从雨里来 | pan-r |
| 5–7.5 | station | 出站口人流，她停下 | — | in |

规则：60s 片 **20–28 镜**，每镜 **2–3 秒**；每镜都要有动作（走路、雨、灯闪、推近），不能有静帧；同一场景可以多次出现，但必须换 `v` 派生不同构图，**不能出现同一张画面**。分镜表没确认不要开渲。

#### M2. 建工程

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
node "$SKILL/scripts/new-film.js" ./my-mv \
  --genre mv --resolution 1080p \
  --title "夜航" --brief "夜航，像素叙事，怀旧" \
  --brand NIGHTFLIGHT --brand-sub "像素叙事 / PIXEL STORY" \
  --slogan "把夜，拼成一条航线"
```

- `--resolution` 是 MV 必填项；不传会报错，提示先问用户。
- MV 固定 60s 分镜：改片长要改 `js/film.js`（增删镜头、保持每镜 2–3 秒），不要用 `--duration` 缩放。
- MV 拒绝 `--look/--style/--layout/--vertical`；画布尺寸必须是 480×270 的整数倍。
- 模板里的 `film.js` / `script.js` 只是一支示范片（24 镜/60s）；建完工程先整段替换成用户的故事，引擎层不动。

#### M3. 写分镜（js/film.js）

一行一拍，行内等分：

```js
{ t: 0.0, shots: [
  { s: 'city', m: 'pan-r', card: true },
  { s: 'platform', m: 'pan-r', who: false, train: true,
    duo: G(300, 222, 'walk', { case: { x: 316, y: 234, roll: true, ph: 0.6 } }) }
] },
```

- 字段：`s` 手绘场景 / `g` 程序化原型 / `m` 运镜 / `who` / `duo` / `case` / `rain` / `train` / `ins` / `work` / `zoom`（≤2.6）/ `cx` / `cy` / `card` / `end`。
- 最后一镜 `{ …, end: true }`，收在 `config.base`；`film.total` 必须等于 `config.base`。
- 场景名只能用手绘 `S.<name>` 或 `GEN.<name>` 里已有的；要新场景先按 `references/mv-craft.md` 注册。
- 引擎层（sets / shot / timeline / actors / paint）不写任何一支片专属的文字、城市或台词；片名/品牌/标语/标签只从 `config.js` 读。

#### M4. 写字幕（js/script.js）

- 每条 6–18 个汉字、≤7 字/秒、不重叠；全片只能有一个叙事视角。
- 字幕牌覆盖画布 y=232–258；人物脚底 ≤222、行李 ≤234。
- 字幕是独立图层，可以跨切点；但换拍就换句，不要一句话拖满整段。
- 字幕只写听得懂的口语，不写镜头说明或术语。

#### M5. 画面规则（违反会直接坏帧）

- 画布永远 480×270、`imageSmoothingEnabled = false`；1080p 是 ×4，4K 是 ×8，不改 config 尺寸。
- 像素字：标签/HUD 用 alpha 阈值 `cut = 64` 二值化；字幕牌 12px 保留灰度（`K.plate` 已内置），密笔汉字才读得清，别改回二值化。画布中文 ≥11px；标签 13px/700。
- 图层：背景 → 中景 → 角色 → 前景 → `K.vignette()` → `K.tag()`/`K.hud()` → `K.plate()`；标签必须在暗角之后。
- 绘制只依赖 `local` 与 `K.rnd(seed)`；禁 `Math.random()` / `Date.now()`；同刻两次必须逐像素一致。
- 抽帧先看每镜 45%：接近全黑就换场景或换站位，不要只调亮度。

#### M6. QA 与渲染

```bash
npm run doctor
npm test        # 镜头制契约：连续覆盖、2–3 秒、唯一 v、字幕、确定性、图层隔离
npm run qa      # qa-mv（画布/字幕牌/片尾/同刻复现/画面推进）+ 逐镜 30%/78%/切点抽帧
npm run qa:mv   # 只跑浏览器体检，报告 qa/mv.json + qa/mv/*.png
node render.js --scale 1 && node encode.js     # 1080p 审片
node render.js --scale 2 && node encode.js     # 4K，仅当用户这次明确要
npm run music                                   # 可选；不生成则 encode 输出无声片
```

`qa-mv` 判据：480×270、无平滑插值、每镜 45% 帧 ≥8 色且 ≥12% 非背景、同刻复现最大差 ≤2、+0.45s 必有变化、每条字幕中点 alpha ≥0.5、最后 1.2s 片尾卡完成。抽帧必须逐张看，尤其 78% 收尾帧与切点前 0.25s。

#### M7. 与宣传片的边界

- MV 工程里不得出现 `looks.js` / `style.js` / `engines.js` / `themes/` / `layouts.css` / `base.css`；`styles/` 只有 `mv.css`。
- 宣传片工程里不得塞像素画布、角色、字幕牌；两套模板的 timeline、字幕、QA 都不共用。
- 不“先建 promo 再改成 MV”或反过来；类型先定，再建工程。
- 参考片只学方法（镜头长度、切点节奏、字幕安全区、像素字），不复制角色/台词/画面/音乐；第三方视频先确认授权，只提取结构手法。

## 命令速查

### 宣传片（promo）

| 命令 | 作用 |
|---|---|
| `npm run preview` | 本地预览，空格播放/暂停，←/→ 逐秒，`S` 主题 / `L` 版式 / `K` look |
| `node tools/pick-look.js "brief"` | 按一句话推荐 look（含命中词/置信度/备选） |
| `npm run looks` | 列出 15 个 look |
| `npm run look:gallery` | 15 个 look 各出 3 帧 → `qa/looks/gallery.html` |
| `npm run doctor` | 环境体检：Node/依赖/Chrome/ffmpeg/磁盘/主题/配乐 |
| `npm run check` | 配置/look/版式/对比度/剧本/场景/素材/语法/颜色令牌静态检查 |
| `npm test` | look 目录/引擎绑定/config/剧本/CLI 契约单测 |
| `npm run qa` | 静态 → 版式 → 节奏 → 引擎 → 抽帧，汇总 `qa/summary.json` |
| `npm run qa:layout` | 逐场景量版式（43 个时刻），报告 `qa/layout.json` |
| `npm run qa:timing` | 43 个采样点查占位符/残影/字幕/空帧，报告 `qa/timing.json` |
| `npm run qa:engines` | 15 个 look 的引擎像素体检，报告 `qa/engines.json` |
| `npm run qa:motion` | 成片运动连续性体检，报告 `qa/motion.json` |
| `node tools/qa-regress.js .` | SSIM 视觉回归；`--update` 重建本机基线 |
| `node tools/contact-sheet.js . --out qa/sheet.jpg` | 15 look 一页总览（带标签） |
| `npm run qa:stills` | 切点、中点、82% 收尾、封面抽帧到 `qa/stills/` |
| `npm run styles` | 5 个主题各出 3 帧静帧到 `qa/styles/` |
| `npm run media` | 扫描 `assets/media/`，视频抽帧，写 `js/media.generated.js` |
| `npm run capture -- --url … --scene s4` | 抓取自有/授权网页为场景素材 |
| `npm run voice` | 按字幕时间轴生成 macOS 中文旁白 |
| `npm run voice:dry` | 只打印旁白时间与字数，不生成音频 |
| `node render.js --look ink-poster` | 指定 look 渲染 |
| `node render.js --style quiet --layout split` | 只覆盖主题/版式 |
| `node render.js --at 1.5,33,58.3` | 指定时刻抽帧到 `stills/` |
| `node render.js --scale 1 --from 0 --to 12` | 试渲一段 |
| `node render.js --resume` | 断点续渲 |
| `node synth-music.js --mood warm --bpm 92` | 重新配乐 |
| `node encode.js --proxy` | 出 1080p 代理 |
| `npm run clean` | 清掉 frames/out/stills/qa（谨慎） |

### MV（pixel-story）

| 命令 | 作用 |
|---|---|
| `npm test` | 7 项镜头制契约单测（不启浏览器） |
| `npm run qa` | qa-mv → 逐镜 30%/78%/切点抽帧 |
| `npm run qa:mv` | 画布/字幕牌/片尾卡/同刻复现/画面推进 |
| `npm run qa:regress` | qa-mv 不抽帧重跑（MV 无 SSIM 基线） |
| `npm run stills` | 13 个代表帧抽到 `stills/` |
| `node render.js --at 1.2,26.2,58.7` | 指定时刻抽帧 |
| `node render.js --scale 1` | 1080p 全片（480×270 ×4） |
| `node render.js --scale 2` | 4K 全片（480×270 ×8，仅在用户要求时） |
| `npm run music` | 可选：chiptune 配乐 → `assets/music.wav` |
| `npm run voice` | 可选：按字幕时间轴生成旁白 |
| `node encode.js` | 帧 + 音频 → `out/final.mp4`（无音频则无声） |
| `npm run build` / `build:4k` | 1080p / 4K 渲染 + 编码 |

## 硬规则（都是踩过坑换来的）

1. **类型先定，语法不混**：先问宣传片还是 MV；MV 不加 look/主题/版式，宣传片不塞像素角色、画布与字幕牌。
2. **切点头部要“已经在”**：页眉、页脚、裁切标记、MV 的 HUD/标签的入场从负本地时间开始，切点后 50ms 内必须可见。
3. **主体入场不要从画外飞入**：入场位移控制在 ±8–90px，用遮罩上推代替横飞。
4. **单位不能省**：`style.left = 120` 会被浏览器丢弃；必须 `'120px'`。
5. **不要跨切点延续动画**：每个场景的 `seek` 从自己的 `0` 开始，切点前要收干净。
6. **文字优先于动效**：任何时刻暂停，标题都应可读；主动效在场景 65% 前收住。
7. **字幕不压主体**：宣传片字幕固定在底部安全区；MV 字幕牌固定在 y=232 的 26px 高条内，人物脚底 ≤222、行李 ≤234。
8. **结算数字必须落值**：任何时刻不得出现 `—`、`NaN`、`{duration}` 这类占位符（`qa:timing` / `qa-mv` 会抓）。
9. **70% 后不留残影**：退场要么 opacity 0，要么被后续画面遮挡；半透明残影会被判为未完成画面。
10. **音乐只做底**：无旁白 0.55，有旁白约 0.40 并开侧链闪避；不要盖过字幕与口播。
11. **先 1080p 审片再 4K**：4K 渲染约 15–25 分钟，不要用 4K 试错。
12. **默认代码绘制，素材按需接入**：没有用户素材时不要下载图库；有素材时放 `assets/media/` 并 `npm run media`。
13. **交付前必须真跑**：doctor、test、qa、encode、ffmpeg 验证都通过才算完成；MV 没有 check/regress，以 test + qa-mv + 抽帧为准。
14. **转场只在一处调**：宣传片的硬切与纸色闪白只在 `js/timeline.js` 的 `FLASH_*`；场景里不写淡入淡出或 CSS transition。
15. **文案只有一个源**：所有可见文字先进 `js/script.js`；场景里写死文案会在改主题时漏改。
16. **颜色只有一个源**（宣传片）：场景只写 `var(--token)`；改主题只改 `styles/themes/*.css`。
17. **主题不承担布局**（宣传片）：主题 CSS 只改颜色/字体/质感；坐标与结构在 `base.css`/`scenes.css`/`layouts.css`。
18. **版式不靠猜**：auto 只是建议；信息密度高别用 poster，左右都重别用 split；选完必须抽帧看。
19. **竖屏不是横屏缩小**（宣传片）：用 `--vertical` 让 `portrait.css` 重排；MV 竖屏要重写 270×480 场景，不能用参数绕。
20. **旁白在字幕定稿后生成**：改文案后重跑 `npm run voice`；超槽位先改文本，不要盲目提速到听不清。
21. **引擎是背景，不是内容**：一帧只允许一个引擎，永远在内容之下；遮住引擎画面就散，说明版式没做完。
22. **引擎只依赖时间**：禁止 `Math.random()` / `Date.now()`，随机走 `rnd(seed)`；否则断点续渲与 4K 复现都会崩。
23. **改设计必须过回归**：改引擎/主题/版式后跑 `npm run qa:engines`，再跑 `qa-regress` 与基线比对；有意变化用 `--update`，无意变化必须修回。
24. **审美必须由用户选**：建工程前用编辑器选择器让用户从 15 个 look 里选；只有用户明确授权才用 `auto`，交付时写清是谁选的。
25. **运动必须全片连续**（宣传片）：整片一层相机缓慢推近/平移，切点不重置；静态帧占比 >50% 或帧差均值 <0.4 不得交付。
26. **真实素材必须有授权**：抓帧只用于用户自有或已明确授权的页面，不抓竞品/第三方站点，不绕过登录与付费墙；交付注明来源。
27. **MV 画布与像素字不可商量**：480×270、整数放大、标签 `cut = 64`（字幕牌软边例外）、画布中文 ≥11px、标签 13/700；不要用平滑字体或改阈值“优化”清晰度。
28. **MV 标签必须在暗角之后**：`K.vignette()` → `K.tag()`/`K.hud()` → `K.plate()`；顺序反了标签会被遮罩吃掉。
29. **MV 只依赖 local 与 K.rnd(seed)**：同刻两次渲染必须逐像素一致；qa-mv 会比对，不一致就是有未播种随机或时钟依赖。
30. **MV 引擎层保持通用**：sets / shot / timeline / actors / paint 不写任何一支片的城市、台词、品牌字；片名、标语、`kicker`、`endTag` 一律从 `config.js` 读。换片时整段替换 `film.js` 与 `script.js`，引擎不动。
31. **MV 分辨率每次都问**：1080p / 4K 是交付规格，不替用户默认；`new-film.js --genre mv` 不带 `--resolution` 直接报错，这是故意的。

## 资源导航

- `scripts/new-film.js`：从模板建工程；`--genre promo|mv` 是第一道分叉（TTY 里给数字选择，非终端报错要求先问用户），promo 支 `--look/--layout/--style/--vertical`，mv 会拒绝这些参数。
- `scripts/install.sh`：安装到 `~/.qoder/skills/brief-to-video`（或指定目录）。
- `references/genres.md`：宣传片 vs MV 的完整对照、MV 语法与常见错误。
- `references/mv-craft.md`：MV 分镜字段、相机锚点、字幕安全区、确定性、坏帧修法与交付检查单。
- `assets/template/tools/doctor.js`：环境体检（Node/依赖/Chrome/ffmpeg/磁盘/主题/配乐），渲染前先跑。
- `assets/template/tools/check-project.js`：静态检查（look/版式/主题契约/对比度/字幕/素材/引用/语法/颜色令牌）。
- `assets/template/tools/pick-look.js`：按 brief 排序推荐 look（`--list`、`--json`、`--root`）。
- `assets/template/tools/look-gallery.js`：15 个 look 样片墙。
- `assets/template/tools/voiceover.js`：macOS `say` 旁白，按字幕时间轴拼成 WAV。
- `assets/template/tools/prep-media.js`：图片/视频 → 场景素材清单，视频自动抽帧。
- `assets/template/tools/capture-web.js`：抓取自有/授权网页为场景素材，含滚动、合成光标与点击。
- `assets/template/tools/qa-all.js`：check → layout → timing → engines → stills，汇总 `qa/summary.json`。
- `assets/template/tools/qa-layout.js` / `qa-timing.js` / `qa-engines.js` / `qa-motion.js`：版式、节奏、引擎、运动连续性探针。
- `assets/template/tools/qa-regress.js`：SSIM 视觉回归，基线在 `qa/baseline/`（本机资产）。
- `assets/template/tools/contact-sheet.js`：15 look 一页总览，直接产出带标签的 JPEG。
- `assets/template/tools/qa-stills.js` / `style-gallery.js` / `grab.js`：抽帧、主题静帧、成片回抽。
- `assets/template/`：宣传片工程（5 主题 + 4 版式 + 15 look + 8 引擎 + 7 场景 + 剧本层 + 竖屏 + 测试 + 渲染/编码/配乐/旁白/素材/抓帧）。
- `assets/genres/mv/`：MV 工程（480×270 画布 + 24 镜示范分镜 + 角色/场景库 + 像素字/字幕牌 + 片尾卡 + 可选 chiptune/旁白 + QA + 单测）。
- `assets/genres/mv/tools/qa-mv.js`：MV 画布/字幕牌/片尾/同刻复现/画面推进体检。
- `assets/genres/mv/tools/qa-all.js`：qa-mv + 逐镜 30%/78%/切点抽帧。
- `assets/template/js/engines.js`：8 个确定性 Canvas 引擎（halftone/riso/bokeh/dust/aurora/flow/scan/orbit）。
- `references/looks.md`：15 个 look、用户选择流程、版式、竖屏、素材、样片墙。
- `references/design-dna.md`：三层结构、引擎目录、借来的设计方法、签名动作、反套路黑名单。
- `references/design-taste.md`：反俗套、字体/间距/层级/动效/节奏。
- `references/brief-to-beats.md`：一句话 → 7 拍 → 文案/字幕。
- `references/styles.md`：5 个主题、令牌契约、加第 6 个主题。
- `references/scene-authoring.md`：场景写法、辅助函数、素材接入、节奏预算、坑。
- `references/art-direction.md`：构图、字号层级、插画、品质线。
- `references/pipeline.md`：CLI 全参数、产物、故障排查、交付规格。
- `assets/template/test/unit.test.js` / `assets/genres/mv/test/unit.test.js`：不启浏览器的契约单测。
- `.github/workflows/qa.yml`：push/PR 自动跑单测、静态检查、引擎/版式/节奏体检。
- `ATTRIBUTIONS.md`：Taste Skill（MIT）、Impeccable / Anthropic frontend-design（Apache-2.0）的方法来源与落点。
- `VERSION` / `LICENSE`：版本与 MIT 许可证。

## 如果用户只想要“快”

宣传片走 L1 快速复用：只改 `config.js` + `js/script.js`，保留现有版式与插画，30 分钟内出片。适合主题本来就与剪辑/软件/工作流相关的内部汇报、活动开场或概念验证；其他行业至少走 L2（把伪 NLE、素材库、导出单换成本行业界面/插画），需要产品专属画面时做 L3（新增插画/场景）。MV 没有 L1：每个镜头都是叙事画面，至少要先把故事弧与分镜表写清楚，再整段替换 `film.js` 与 `script.js`。
