---
name: brief-to-video
description: 把一句话的视频需求做成可交付成片：宣传片、产品片、品牌短片、功能讲解、开场/结尾、动态海报或社媒短视频，支持 16:9 横屏与 9:16 竖屏。内置 12 个 curated look（5 主题 × 4 版式 × 4 动效气质），按 brief 自动选择，也可手动指定；可选真实图片/视频抽帧与 macOS 中文旁白（含配乐侧链闪避）。当用户说“帮我做个视频 / 宣传片 / 企业宣传 / 品牌片 / 短片 / 动效 / 动态海报 / 产品片 / 功能讲解 / 发布会开场 / 活动预告 / 竖屏短视频 / 口播视频 / 把这段文案做成视频 / 剪个片”，或只给一句主题并期待一个 MP4 时使用。流程为 HTML/CSS/JS 时间轴 → Puppeteer 逐帧渲染 → FFmpeg 编码 4K/1080p → 自动版式/节奏体检 + 抽帧目检。
---

# Brief to Video

## 这个 Skill 做什么

输入一句需求（或一段文案），输出一条完成度可交付的短片：

- 一条 16:9 横屏或 9:16 竖屏、默认 60 秒、30fps 的成片（默认 4K，可 1080p）
- 一张封面帧 `out/poster.png`
- 一套切点/收尾 QA 抽帧 `qa/stills/*.jpg`（`npm run qa` 一条命令产出并汇总）
- 一个可继续改文案、换 look、改镜头的工程目录

审美不是单一风格：5 个主题（`letterpress` / `swiss` / `cinema` / `quiet` / `tech`）× 4 个版式（`editorial` / `poster` / `grid` / `split`）× 4 个 motion，内置 12 个 curated look。**AI 默认按 brief 自动选择**，日志会说明命中了哪些词、置信度和备选；想换方向时可用 `--look`、`?look=` 或预览键 `K` 覆盖。默认画面由 HTML/CSS/SVG 绘制，可复现、无版权风险；用户提供素材时才接入图片/视频，并继承主题的纸张质感与版式。

全片可见文案集中在 `js/script.js`（字幕 + 各场景文字），场景文件只负责画。场景与字幕按 60s 基准编写，改 `config.duration` 后**运行时自动等比缩放**，不需要手改时间码。旁白可选：`npm run voice` 用 macOS `say` 按字幕时间轴生成，`encode.js` 自动混音并压低配乐。

## 安装 / 升级

推荐用自带脚本（默认装到 `~/.qoder/skills/brief-to-video`）：

```bash
scripts/install.sh                  # 复制安装
scripts/install.sh --dest DIR       # 指定位置
scripts/install.sh --link           # 开发模式：软链当前目录
scripts/install.sh --force          # 覆盖旧版本
```

手动安装也可以：把整个 `brief-to-video/` 目录复制到 `~/.qoder/skills/`。安装后重启会话或 `/skills reload`，用 `/brief-to-video` 调用。版本见 `VERSION`，许可为 MIT（`LICENSE`）。模板工程首次使用需 `npm install`（puppeteer-core + ffmpeg installer）。

## 先读什么

- 选 look 读 `references/looks.md`：12 个方向、自动选择规则、版式/竖屏/素材。
- 动画面之前读 `references/design-taste.md`：反 AI 俗套、字体/间距/层级/动效/节奏的硬规则。
- 选主题读 `references/styles.md`：5 个主题、令牌契约、如何加第 6 个。
- 拿到 brief 读 `references/brief-to-beats.md`：拆句、定 7 拍、写字幕与文案。
- 改画面读 `references/scene-authoring.md`：场景契约、辅助函数、节奏预算、素材接入、常见坑。
- 构图与插画语言读 `references/art-direction.md`：网格、字号层级、插画、品质线。
- 跑命令、排错、交付读 `references/pipeline.md`：全部 CLI 参数、产物结构、故障排查。

## 工作流

### 0. 判断交付规格（30 秒内定下来）

| 问题 | 默认决策 |
|---|---|
| 时长 | 没指定 → 60s；社媒口播/开箱 → 30s；极短钩子 → 15s |
| 画幅 | 没指定 → 1920×1080；抖音/Reels/Shorts → 1080×1920（`--vertical`，版式自动重排） |
| 分辨率 | 默认 4K（`--scale 2`）；先出 1080p 审片（`--scale 1`） |
| 语言 | 跟随用户；中文为主时字幕与标题都用中文，英文只做微标签 |
| Look | 没指定 → `look: 'auto'` 按 brief 选；见 `references/looks.md` 的 12 个方向 |
| 主题 | 只在客户指定气质/已有品牌色时强制 `--style`，否则交给 look |
| 音乐 | 默认本地合成（calm）；动作/科技 → tense；温暖叙事 → warm |
| 旁白 | 默认无旁白，靠字幕与音乐；用户要求口播、解说或文案较长时跑 `npm run voice` |
| 素材 | 默认代码绘制；用户给照片/视频时才放 `assets/media/` 并 `npm run media` |

不要为了这几个默认值反复追问。只有「画幅/时长/品牌名」缺失且影响结构时才问一次。

### 1. 选 look（先定气质，再定版式）

不要一上来把风格写死。先让 look 目录根据 brief 推荐，再决定是否覆盖：

```bash
node tools/pick-look.js "成都，城市宣传片，文化"
# → ink-editorial（high）· 命中：城市/文化 · 备选：ink-grid, cinema-editorial
```

12 个 curated look 的完整表、关键词与自动计分规则见 `references/looks.md`。常用判断：

| brief 信号 | 首选 | 备选 |
|---|---|---|
| 品牌、工艺、文化、城市 | `ink-editorial` | `ink-grid` |
| 海报、发布、演出、口号 | `ink-poster` | `cinema-poster` |
| 报告、白皮书、年度复盘 | `ink-grid` / `swiss-grid` | `tech-grid` |
| 咖啡、餐饮、民宿、生活方式 | `quiet-editorial` | `quiet-split` |
| 产品功能、SaaS、一屏一个卖点 | `swiss-split` | `tech-split` |
| 影像、故事、高端、预告 | `cinema-editorial` | `cinema-poster` |
| AI、开发者工具、硬件、安全 | `tech-split` | `tech-grid` |

拿不准就用 `auto`，并在交付时报告自动选择结果。**不要为了“高级”强行用 poster**：正文超过两行、信息密度高的片子用 poster 会丢信息；poster 是口号/预告的语法，不是万能模板。

覆盖方式：建工程 `--look`，渲染 `--look`，预览按 `K`；`?look=` / `?style=` / `?layout=` 可单独覆盖。优先级 URL > CLI > `config` > look 默认。

### 2. brief → 7 拍分镜

按 `references/brief-to-beats.md` 把一句话拆成：

1. **钩子**（0–5%）：片名/主张，建立气质
2. **问题/语境**（5–17%）：为什么需要这件事
3. **转折/系统**（17–36%）：核心做法、结构、流程
4. **细节证明**（36–55%）：对齐、精度、参数、真实感
5. **能力/规模**（55–74%）：功能、库存、速度、覆盖面
6. **结果/行动**（74–92%）：付印、导出、交付、CTA
7. **收束**（92–100%）：片名回落、slogan、版权

先把 7 拍写成一张表：时间、场景、目的、屏幕文案、画面、转场。**先定文案再动画面**，避免边写边改布局。

### 3. 建工程

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
node "$SKILL/scripts/new-film.js" ./my-film \
  --title "北岸咖啡" \
  --brief "咖啡店，日常温暖，生活方式" \
  --look quiet-editorial \
  --brand "NORTH BANK" \
  --brand-sub "城市烘焙 / SINCE 2019" \
  --slogan "把清晨，烘进一杯里" \
  --duration 60

# 竖屏 + 自动 look
node "$SKILL/scripts/new-film.js" ./vertical \
  --title "山野来信" --vertical \
  --brief "民宿，自然疗愈，竖屏短视频" --duration 30
```

- 目标目录非空会拒绝；确认要覆盖时加 `--force`。
- `--look` 不在 12 个 look 内会报错并列出可用值；`--style` / `--layout` 可单独强制某一层。
- `--brief` 会写进 `config.brief`，是自动选 look 的主要依据；不填则用标题/标语/副标兜底。
- `--no-install` 跳过依赖安装；`--poster-at` 是成片中的秒数（内部会换算成 60s 基准）。
- 时长只改 `--duration`：场景起止与字幕时间按 60s 基准编写，运行时自动缩放。
- 竖屏用 `--vertical`（= `--size 1080x1920`）；不要用 960×540 这类非标准画布，场景坐标按 1920×1080 编写，降分辨率请用 `render.js --scale`。
- 创建后 `cd my-film`，后续命令都在工程根目录执行。

### 4. 改文案（最快见效）

1. `js/config.js`：`title / brand / brandSub / slogan / disclaimer / brief / look / style / layout`，以及时长、画幅、fps、封面时间。`look: 'auto'` 是默认；`style/layout: 'auto'` 表示跟随 look。
2. `js/script.js`：全部字幕（`subtitles`）与每个场景的标题、副题、标签、卡片、面板、页脚文字。旁白可在字幕对象里加 `narration`，不写则用 `text`。
3. `index.html`：只在新增/删除场景时改脚本引用；字幕容器保持空的 `<ol id="subs">`。

字幕用**场景内定位**，不写全局秒数：

```js
subtitles: [
  { scene: 's1', at: 0.4, dur: 1.8, text: '一句话，先要有画面' },
  { scene: 's1', at: 2.4, dur: 2.0, text: '剩下的，交给时间线' }
]
```

`at` / `dur` 都是 60s 基准的**场景内**秒数；改场景起止或片长时字幕自动跟随，不会跨切点。旧的 `{ start, end, text }` 仍兼容，但新工程不要再用。

改文案时保持：
- 大标题 4–8 个汉字，最多两行；一行只放一个动作或判断。
- 副题 12–24 字，补足“是什么/为什么”，不要重复标题。
- 英文只做微型标签（全大写、加字距），不与中文抢主视觉。
- 字幕每条 8–16 字，60s 基准 1.8–2.4 秒，最短 1.2 秒；阅读速度 ≤ 约 7 字/秒；不跨场景切点。
- 做口播时，字幕可以短、旁白可以长：给字幕对象加 `narration: '…'`，`voiceover.js` 会用旁白文本，字幕仍显示短句。
- **做一次全片术语扫描**：`grep -n "素材\|时间线\|字幕\|关键帧\|素材库\|导出" js/script.js`。与主题无关的伪 UI 术语、数字、卡片名要么改写成本行业词，要么换掉整个场景；只改页眉和主标题会留下“模板感”。

### 4.5 素材与旁白（按需）

默认不需要素材：画面由代码绘制。用户提供照片/视频时：

```bash
mkdir -p assets/media
cp shot-alley.jpg assets/media/s1-alley.jpg      # 文件名前缀 = 场景 id
cp store.mp4      assets/media/s4-store.mp4      # 视频会按 --fps 抽帧
npm run media                                    # → js/media.generated.js
npm run check
```

- 支持的图片：`jpg/png/webp/avif`；视频：`mp4/mov/m4v/webm/mkv/avi`。
- 一个场景可放多张，按片内进度切换，并自动做确定性 Ken Burns（预览/逐帧渲染一致）。
- 素材会继承当前 look 的纸张网点、暗角与色调，不会变成“贴图感”。
- 抽帧参数：`node tools/prep-media.js . --fps 2 --max-frames 12 --width 1920`。

用户要口播/解说时：

```bash
node tools/voiceover.js --list-voices         # 查看中文语音
npm run voice                                 # 按字幕时间轴生成 assets/voiceover.wav
node encode.js                                # 自动混入旁白 + 配乐侧链闪避
```

- macOS 专用，调用系统 `say`，不联网、不产生 API 费用。
- 默认优先 Tingting / Meijia；可用 `--voice`、`--rate 180`、`--gain 0.9` 调整。
- 每条旁白若超出字幕槽位 0.35s，会提示缩短文本或提高语速；削波会自动衰减。
- 只想试听/核对时间：`npm run voice:dry`；只生成某几句：`--only 1,2,3`。

### 5. 需要时重排场景

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
- 页眉、页脚、裁切标记在切点即出现（入场区间从负值开始）。
- 入场位移留在画面内；宁可 24px 也不要从画外 120px 飞入。
- 给 `style.left/top/width/height` 赋值必须带单位字符串（`'120px'`）。
- 连续运镜与切点闪白由 `js/timeline.js` 统一处理，场景内不要另做转场。
- **颜色只用 `var(--token)`**，不写 `#hex`/`rgba()`；插画用 `--ill-ink/--ill-paper/--warm`。
- 新增/删除场景后同步改 `index.html` 的脚本顺序。

### 6. 环境体检 + 静态检查

```bash
npm run doctor   # Node/依赖/Chrome/ffmpeg/磁盘/主题/配乐
npm run check
```

`doctor` 把“渲染到一半才发现没 Chrome/磁盘不够”提前暴露：4K 全片按 8.5MB/帧估算，空间不足会直接标红。`check` 必须全部通过。检查内容：配置合法（含 `style` 指向存在的主题、`tcFps`）、主题令牌契约（必需令牌、`html[data-style]` 选择器、花括号平衡）、WCAG 对比度（正文 ≥10:1、字幕 ≥7:1、强调色 ≥3:1、弱化字 ≥4.5:1）、字幕有序/不重叠/阅读速度/跨切点告警、场景覆盖、剧本节、引用齐全、JS 语法、CSS 裸数字、颜色字面量（CSS 报错、JS 警告）。

### 7. 自动体检（一条命令）

```bash
npm run qa          # = 静态检查 → 版式 → 节奏 → 抽帧，汇总写 qa/summary.json
npm run qa:layout   # 只量文字：出框、祖先裁切、nowrap 溢出、字幕压字、运行时报错
npm run qa:timing   # 只跑节奏探针：占位符/未解析变量/70% 后残影/字幕是否该出现/空尾帧
node tools/qa-all.js . --look ink-poster              # 换 look 回归
node tools/qa-all.js . --look quiet-editorial --layout split
```

`qa-layout` 每场景采样 15/45/75/90% + 每条字幕中点（43 个时刻），报告 `qa/layout.json`。有 ERROR 先修，不要带着出框或占位符抽帧审片。`qa:all` 在静态检查失败时会停下并指向具体文件。换 look、换版式、竖屏都要重跑；样片墙只用于审美目检，不能替代 QA。

### 8. 抽帧目检（不要跳过）

```bash
npm run qa:stills   # 每个切点前 0.3s、切点、切点后 0.24s + 中点 + 82% 收尾 + 封面
```

逐张看，重点：

- 切点前 0.3s 与切点后 0.24s：页眉/页脚是否在、上一镜是否干净退出、下一镜是否已有内容。
- 切点帧：应是干净纸面 + 清晰字幕；若出现双曝光或整帧发灰，检查 `timeline.js` 的 `FLASH_*`。
- 每个场景中点与 **82% 收尾帧**：主标题是否完整、正文是否出框、插画是否被裁、字幕是否压主体、是否只剩残影。
- 封面帧：能否独立当缩略图（片名完整、无动画中间态）。
- 文字是否可读：4K 缩到 1080p 后仍要清楚；不要用细过 1px 的线做正文。

换主题后额外跑一次风格抽帧：

```bash
npm run styles                                  # 5 个主题 × 3 个时刻
node tools/style-gallery.js . --themes cinema    # 只出一套
```

换 look 或给客户做风格提案：

```bash
npm run look:gallery                            # 12 个 look × 3 帧 → qa/looks/gallery.html
node tools/look-gallery.js . --looks ink-poster,swiss-split
```

看样片墙时重点：同一场景在 12 个方向下是否都成立；poster 的正文是否太挤；grid 的信息是否真的对齐；split 的左右两侧是否有一侧过空。选定后再跑该 look 的 `qa` 和抽帧。

### 9. 配乐、旁白与全片渲染

```bash
node synth-music.js --mood calm        # 生成 assets/music.wav
npm run voice                           # 可选：旁白 → assets/voiceover.wav
node render.js --scale 1 --from 0 --to 12   # 低成本试渲前 12 秒
node render.js --scale 1 && node encode.js  # 1080p 全片审片
```

`encode.js` 自动检测 `assets/voiceover.wav`：有旁白时把音乐降到 0.40 左右，并用侧链闪避在说话时压低音乐；无旁白时音乐 0.55、2s 淡入淡出。可调：

```bash
node encode.js --voice-gain 0.9 --music-gain 0.42
node encode.js --no-duck        # 关掉闪避
node encode.js --no-voice       # 忽略旁白，只混音乐
node encode.js --muted          # 全静音
```

审片通过后出 4K：

```bash
node render.js            # 默认 --scale 2 → 3840×2160
node encode.js            # out/final.mp4（旁白 + 音乐）
node encode.js --proxy    # 额外 out/final_1080p.mp4
```

渲染中断用 `node render.js --resume`（参数需与首次一致，风格/look/版式不同会直接拒绝）。开渲前会校验主题文件存在，并按分辨率/帧数估算磁盘（<60% 预估直接失败）。`encode.js` 会检查帧连续性，缺帧会直接报错并提示补齐；编码后会打印 `volumedetect` 响度，出现“偏响/偏轻/削波”警告时调 `--music-gain` / `--voice-gain`。

### 10. 验收与交付

```bash
node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)"   # 取 ffmpeg
"$FFMPEG" -hide_banner -i out/final.mp4                            # 看时长/分辨率/音轨
node tools/grab.js out/final.mp4 3.0 15.0 27.0                     # 从成片回抽帧核对
```

`grab.js` 直接对成片按时间点抽帧（一个时间点一次 ffmpeg，避免重复帧），用于确认“渲染出来的就是审片看到的”。

交付时报告：

- 成片路径、时长、分辨率、帧率、编码（H.264 / AAC / yuv420p / bt709）
- look（含自动选择的置信度/命中词）、主题、版式、封面路径、QA 抽帧目录
- 画幅（16:9 / 9:16）与时长缩放是否符合平台要求
- 是否使用外部素材、旁白（语音/语速/增益）与音乐来源（本地合成，无外部版权素材）
- 工程目录（可继续改文案/换 look/重渲）

## 命令速查

| 命令 | 作用 |
|---|---|
| `npm run preview` | 本地预览，空格播放/暂停，←/→ 逐秒，`S` 主题 / `L` 版式 / `K` look |
| `node tools/pick-look.js "brief"` | 按一句话推荐 look（含命中词/置信度/备选） |
| `npm run looks` | 列出 12 个 look |
| `npm run look:gallery` | 12 个 look 各出 3 帧，生成样片墙 `qa/looks/gallery.html` |
| `npm run doctor` | 环境体检：Node/依赖/Chrome/ffmpeg/磁盘/主题/配乐 |
| `npm run check` | 配置/look/版式/对比度/剧本/场景/素材/语法/颜色令牌静态检查 |
| `npm run qa` | 一条命令跑完：静态 → 版式 → 节奏 → 抽帧，汇总 `qa/summary.json` |
| `npm run qa:layout` | 逐场景量版式（43 个时刻），报告 `qa/layout.json` |
| `npm run qa:timing` | 43 个采样点查占位符/残影/字幕/空帧，报告 `qa/timing.json` |
| `npm run qa:stills` | 切点、中点、82% 收尾、封面抽帧到 `qa/stills/` |
| `npm run styles` | 5 个主题各出 3 帧静帧到 `qa/styles/` |
| `npm run media` | 扫描 `assets/media/`，视频抽帧，写 `js/media.generated.js` |
| `npm run voice` | 按字幕时间轴生成 macOS 中文旁白 `assets/voiceover.wav` |
| `npm run voice:dry` | 只打印旁白时间与字数，不生成音频 |
| `node render.js --look ink-poster` | 指定 look 渲染 |
| `node render.js --style quiet --layout split` | 只覆盖主题/版式 |
| `node tools/qa-all.js . --look swiss-grid` | 指定 look 跑全套 QA |
| `node render.js --at 1.5,33,58.3` | 指定时刻抽帧到 `stills/` |
| `node render.js --scale 1 --from 0 --to 12` | 试渲一段 |
| `node render.js --resume` | 断点续渲 |
| `node synth-music.js --mood warm --bpm 92` | 重新配乐 |
| `node encode.js --proxy` | 出 1080p 代理 |
| `node encode.js --no-duck` | 旁白出现时不压低音乐 |
| `node grab.js out/final.mp4 3 15 27` | 从成片回抽帧 |
| `npm run clean` | 清掉 frames/out/stills/qa（谨慎） |

## 硬规则（都是踩过坑换来的）

1. **切点头部要“已经在”**：页眉、页脚、裁切标记的入场从负本地时间开始，切点后 50ms 内必须可见。
2. **主体入场不要从画外飞入**：入场位移控制在 ±8–90px，用遮罩上推代替横飞。
3. **单位不能省**：`style.left = 120` 会被浏览器丢弃；必须 `'120px'`。
4. **不要跨切点延续动画**：每个场景的 `seek` 从自己的 `0` 开始，切点前要收干净。
5. **文字优先于动效**：任何时刻暂停，标题都应可读；主动效在场景 65% 前收住。
6. **字幕不压主体**：字幕固定在底部安全区，正文/卡片不要侵占最后 12% 高度。
7. **结算数字必须落值**：计数器/统计在场景结束前必须显示最终数值；任何时刻不得出现 `—`、`NaN`、`{duration}` 这类占位符（`qa:timing` 会抓）。
8. **70% 后不留残影**：元素退场要么退干净（opacity 0），要么被后续画面遮挡；半透明残影会被判为未完成画面。
9. **音乐只做底**：无旁白时增益 0.55，有旁白时约 0.40 并开侧链闪避；不要盖过字幕与口播。
10. **先 1080p 审片再 4K**：4K 渲染约 15–25 分钟，不要用 4K 试错。
11. **默认代码绘制，素材按需接入**：没有用户素材时不要下载图库；有素材时放 `assets/media/` 并跑 `npm run media`，不要手写图片路径到场景里。
12. **交付前必须真跑**：doctor、check、qa（版式/节奏/抽帧）、encode、ffmpeg 验证都通过，才算完成。
13. **转场只在一处调**：硬切与纸色闪白由 `js/timeline.js` 的 `FLASH_*` 控制，场景里不要再写淡入淡出或 CSS transition。
14. **文案只有一个源**：所有可见文字先进 `js/script.js`；场景里写死文案会在改主题时漏改。
15. **颜色只有一个源**：场景里只写 `var(--token)`；改主题只改 `styles/themes/*.css`，不改布局代码。
16. **主题不承担布局**：主题 CSS 只允许改颜色/字体/质感/局部表现；坐标与结构仍在 `base.css`/`scenes.css`/`layouts.css`。
17. **版式不靠猜**：auto 只是建议；如果 brief 信息密度高，别用 poster；如果左右内容都很重，别用 split。选完必须抽帧看。
18. **竖屏不是横屏缩小**：用 `--vertical` 让 `portrait.css` 重排；不要靠裁切或缩放，字幕必须落在底部安全区。
19. **旁白在字幕定稿后生成**：改文案后重跑 `npm run voice`；旁白超槽位先改文本，不要盲目提速到听不清。

## 资源导航

- `scripts/new-film.js`：从模板建工程（支 `--look`/`--layout`/`--style`/`--vertical`）、改配置、换算封面时间、装依赖、探测 Chrome。
- `scripts/install.sh`：安装到 `~/.qoder/skills/brief-to-video`（或指定目录）。
- `assets/template/tools/doctor.js`：环境体检（Node/依赖/Chrome/ffmpeg/磁盘/主题/配乐），渲染前先跑。
- `assets/template/tools/check-project.js`：静态检查（look/版式/主题契约/对比度/字幕/素材/引用/语法/颜色令牌）。
- `assets/template/tools/pick-look.js`：按 brief 推荐 look，`--list` 看全部。
- `assets/template/tools/look-gallery.js`：12 个 look 样片墙。
- `assets/template/tools/voiceover.js`：macOS `say` 旁白，按字幕时间轴拼成 WAV。
- `assets/template/tools/prep-media.js`：图片/视频 → 场景素材清单，视频自动抽帧。
- `assets/template/tools/qa-all.js`：一条命令跑完 check → layout → timing → stills，汇总 `qa/summary.json`。
- `assets/template/tools/qa-layout.js`：自动量版式与字幕碰撞（每场景 15/45/75/90% + 字幕中点）。
- `assets/template/tools/qa-timing.js`：节奏探针（占位符/残影/字幕/空帧）。
- `assets/template/tools/qa-stills.js`：切点/中点/收尾/封面抽帧。
- `assets/template/tools/style-gallery.js`：按主题批量出静帧。
- `assets/template/tools/grab.js`：从成片回抽帧。
- `assets/template/`：完整可跑的影片工程（5 主题 + 4 版式 + 12 look + 7 场景 + 剧本层 + 竖屏 + 渲染/编码/配乐/旁白/素材）。
- `references/looks.md`：12 个 look、自动选择、版式、竖屏、素材、样片墙。
- `assets/looks-contact-sheet.jpg`：四宫格 look 总览（ink-poster / swiss-grid / cinema-poster / quiet-split）。
- `references/design-taste.md`：反俗套、字体/间距/层级/动效/节奏。
- `references/brief-to-beats.md`：一句话 → 7 拍 → 文案/字幕。
- `references/styles.md`：5 个主题、令牌契约、加第 6 个主题。
- `references/scene-authoring.md`：场景写法、辅助函数、素材接入、节奏预算、坑。
- `references/art-direction.md`：构图、字号层级、插画、品质线。
- `references/pipeline.md`：CLI 全参数、产物、故障排查、交付规格。
- `VERSION` / `LICENSE`：版本与 MIT 许可证。

## 如果用户只想要“快”

走 L1 快速复用：只改 `config.js` + `js/script.js`（字幕与各场景文字），保留现有版式与插画，30 分钟内出片。适合**主题本来就与剪辑/软件/工作流相关**的内部汇报、活动开场或概念验证。其他行业至少走 L2：把伪 NLE、素材库、导出单等画面换成本行业的对应界面或插画，否则观众会以为这是一支剪辑软件广告。需要产品专属画面时做 L3（新增插画/场景）。
