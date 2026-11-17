---
name: brief-to-video
description: 把一句话的视频需求做成可交付成片，先分类型：宣传片（promo，编辑排版 + look 系统）或 MV（mv，层叠剪纸叙事 + 角色 + 镜头 + 底部歌词），两套语法绝不混用。宣传片默认空白起步、每支片现场写故事与分镜，**一句话 brief 先扩写成 treatment（世界/人物/序列/30 镜候选/4 色域，不设字数、越详细越好）再写分镜**（--demo 才复制七场示范工程，只用于研究契约）；硬件/实体产品片走世界语法（多空间、多色域、屏幕 ≤30%），软件/AI/平台类走“真屏语法”：全出血真实界面 + 屏幕长镜与子节拍 + 主题色间幕卡标点 + 底部胶囊字幕 + 桌面拼贴结尾，界面用授权网页抓帧或 screen-kit 手搭（见 product-film-grammar.md）。参考片只学其动效、转场与真实卡片技术，配色/吉祥物/字标等个性一律按当次品牌重定，支持 16:9 横屏与 9:16 竖屏，内置 15 个 curated look（5 主题 × 4 版式 × 4 动效气质）与 8 个确定性视觉引擎，默认用编辑器的选择器把方向交给用户选（AI 只排序推荐）；MV 用原生 1920×1080 剪纸画布、镜头制分镜（每镜 2–3 秒）、角色与画布底部歌词，**treatment 要写透背景、人物、关系、母题、歌词段与镜头候选**，16:9 输出，默认 1080p、4K 可选（矢量重画）。宣传片全片连续运镜 + 平滑缓动，可选真实图片/视频抽帧、授权网页抓帧与 macOS 中文旁白（含配乐侧链闪避）。当用户说“帮我做个视频 / 宣传片 / 企业宣传 / 品牌片 / MV / 剪纸动画 / 叙事短片 / 动态海报 / 产品片 / 功能讲解 / 真屏演示 / 屏幕录制式 / 发布会开场 / 活动预告 / 竖屏短视频 / 口播视频 / 把这段文案做成视频 / 照这个视频做”，或只给一句主题并期待一个 MP4 时使用。流程为 HTML/CSS/JS 时间轴 → Puppeteer 逐帧渲染 → FFmpeg 编码 1080p（4K 按需） → 单测/版式/节奏/引擎/画布/运动/色彩体检 + 抽帧目检 + 交付前自检修复（npm run repair）。
---

# Brief to Video

## 这个 Skill 做什么

输入一句需求（或一段文案），输出一条完成度可交付的短片：

- 一条成片（默认 1080p；4K 仅在用户这次明确要求时）、一张封面帧 `out/poster.png`、一套 QA 抽帧与体检报告
- 一个可继续改文案、换 look（宣传片）或改镜头（MV）的工程目录

**先分两种类型，语法不共用：**

- **宣传片 `promo`**：编辑排版语法。5 个主题（`letterpress` / `swiss` / `cinema` / `quiet` / `tech`）× 4 个版式（`editorial` / `poster` / `grid` / `split`）× 4 个 motion，内置 15 个 curated look；每个 look 绑定一个确定性视觉引擎（`halftone` / `riso` / `bokeh` / `dust` / `aurora` / `flow` / `scan` / `orbit`）。**每支片现场写故事与分镜**：模板只提供舞台、主题、组件与 QA，主角、拍数、场景、画面都由这一支片的 brief 决定，和 MV 一样不套固定骨架；`--demo` 才复制老的七场编辑排版示例，只用于研究契约。审美默认由用户选：AI 先按 brief 排序推荐，再用编辑器的选择器把方向交给用户。支持 16:9 与 9:16、真实素材、授权网页抓帧、旁白。
- **MV `mv`**：层叠剪纸叙事语法。原生 1920×1080 Canvas 剪纸画布：纸边高光 + 柔和投影 + 纸纹，固定机位、镜头制分镜（60s 约 20–28 镜，每镜 2–3 秒）、剪影纸人角色、画布底部歌词、片尾卡；画面只靠浪/雨/火/雾/呼吸在动，逐帧可复现。MV **没有** look / 主题 / 版式 / 引擎，固定 16:9；引擎层通用，故事层每支片重写。

宣传片的场景与字幕按 60s 基准编写，改 `config.duration` 后运行时自动等比缩放；MV 的分镜是绝对秒数，改片长必须重排 `film.js`。全片可见文案集中在 `js/script.js`，场景文件只负责画。宣传片旁白可选：`npm run voice` 用 macOS `say` 按字幕时间轴生成，`encode.js` 自动混音并压低配乐；MV 的歌词可用 `npm run song` 接入用户成品歌与 LRC。

## 安装 / 升级

```bash
scripts/install.sh                  # 复制到 ~/.qoder/skills/brief-to-video
scripts/install.sh --dest DIR       # 指定位置
scripts/install.sh --link           # 开发模式：软链当前目录
scripts/install.sh --force          # 覆盖旧版本
```

手动安装：把整个目录复制到 `~/.qoder/skills/`，重启会话或 `/skills reload`，用 `/brief-to-video` 调用。版本见 `VERSION`（3.0.0），许可 MIT，方法来源见 `ATTRIBUTIONS.md`。模板工程首次使用需 `npm install`（puppeteer-core + ffmpeg installer）。

## 先读什么

- **定类型读 `references/genres.md`**：宣传片 vs MV 的决策树、对照表、MV 语法与常见错误。
- **拿到宣传片 brief，先读 `references/brief-expansion.md`**：一句话 → treatment 的方向锁、四层扩写、配额（序列/空间/镜头/色域，不设字数）、模板与质量门槛。跳过它直接分镜，片子就会变成功能演示。**MV 不读这份、也不套这些配额**：MV 的扩写单位是背景、人物、关系、母题、故事弧、歌词段与镜头候选，见 M1 与 `references/mv-craft.md` §0。
- **做硬件/实体产品读 `references/hardware-promo-grammar.md`**：世界先行语法（世界 → 仪式 → 细节 → 使用 → 结果 → 收束）、三层空间、材质与光、屏幕 ≤30%、反模式与验收。
- **做软件/AI/平台产品片读 `references/product-film-grammar.md`**：真屏语法（全出血界面 + 一条任务 + 长镜子节拍），只适用于软件产品；硬件片不要套它。
- **做 MV 读 `references/mv-craft.md`**：引擎/内容/配置三层分离、分镜字段、纸层画法、歌词安全区、坏帧修法与交付检查单。
- **交付前读 `references/repair-loop.md`**：自检修复的六项检查、修复循环、缺陷目录（残影/时间线/裁切/过期/单色）与像素取证。
- 选 look 读 `references/looks.md`：15 个方向、用户选择流程与推荐规则、版式/竖屏/素材。
- 想知道“为什么这样好看、该改哪个文件”读 `references/design-dna.md`：Ground→Content→Moment 三层、8 个引擎、借来的设计方法、签名动作、反套路黑名单。
- 动画面之前读 `references/design-taste.md`：反 AI 俗套、字体/间距/层级/动效/节奏的硬规则。
- 选主题读 `references/styles.md`：5 个主题、令牌契约、如何加第 6 个。
- 建工程前读 `references/intake.md`：七问定向、选项 id、追问边界、理解回述与 `direction.json`。
- 拿到 brief 读 `references/brief-to-beats.md`：拆句 → 写微型故事（主角/欲望/阻力/改变）→ 现场分镜 → 文案与字幕；七拍只是卖点型 brief 的可选节奏，不是默认骨架。
- 改画面读 `references/scene-authoring.md`：场景契约、辅助函数、节奏预算、素材接入、常见坑。
- 构图与插画语言读 `references/art-direction.md`：网格、字号层级、插画、品质线。
- 跑命令、排错、交付读 `references/pipeline.md`：全部 CLI 参数、产物结构、故障排查。

## 工作流

### 0. 七问定向：先弄明白制作人的意思（建工程前，必做）

**七问不是让用户替 AI 写片，而是把意图、对象、记忆点、禁忌和交付条件问清楚。** 故事、镜头、颜色、节奏仍由 AI 提案；七问只定方向与边界。第 1 问先用编辑器选择器定类型，之后每个类型各 6 问。完整问题库、选项 id、追问边界、回述模板与 `direction.json` 格式见 `references/intake.md`。

| 类型 | 长什么样 | 工程 |
|---|---|---|
| 宣传片 `promo` | 编辑排版：主题 + 版式 + look + 品牌信息；纸感/暖白/银幕/网格/终端五类气质；故事与分镜现场写；**软件/AI/平台类走真屏语法**（全出血产品界面 + 主题色间幕卡） | `assets/template`（空白起步；`--demo` 才是七场示例） |
| MV `mv` | 层叠剪纸叙事：原生 1920×1080 纸层、镜头制分镜、剪影纸人、画布底部歌词；像一支剪纸定格短片 | `assets/genres/mv` |

第 1 问单独一张选择器卡片（信号明确也要确认一次类型，不要用默认值猜）：

```jsonc
{
  "question": "这支片属于哪一种？",
  "header": "影片类型",
  "options": [
    { "label": "宣传片", "description": "编辑排版 + look 系统：品牌、卖点、产品、数据；默认 60s，可竖屏" },
    { "label": "MV", "description": "层叠剪纸叙事：镜头制分镜、角色与底部歌词，讲一个小故事；16:9，原生 1920×1080，默认 1080p，4K 可选" }
  ]
}
```

拿到类型后，第 2–5 问放一张卡片，第 6–7 问放一张卡片：

| # | 宣传片 promo | MV |
|---|---|---|
| 2 | 主角是什么：软件/AI/平台 · 硬件/实体 · 空间/场所/服务 · 人物/团队/理念 | 歌/声音从哪来：成品歌+歌词 · 纯音乐 · 本地合成 · 静音 |
| 3 | 给谁看、看完做什么：潜在客户 · 专业客户/合作方 · 内部/投资人 · 公众/社媒 | 这是谁的故事：一个人 · 两个人 · 一群人 · 一个地方/物件的视角 |
| 4 | 只记住一个东西：一个具体时刻 · 产品被使用的一瞬 · 一个麻烦被解决 · 一种生活方式 | 最想要什么、什么挡着：等一个人 · 离开 · 守住 · 找回 |
| 5 | 气质：两轮选择器选 look（15 个方向，AI 只排序推荐） | 最后一个镜头停在什么情绪：重逢 · 释然 · 继续上路 · 没有答案但人变了 |
| 6 | 最怕拍成什么：功能演示/只拍屏幕 · 城市空镜集 · 参数目录 · 空洞品牌隐喻诗 | 最怕变成什么：纯空镜风景片 · 歌词配图 · 抽象诗 · 角色走过场 |
| 7 | 交付形态：60s 16:9 · 30s 16:9 · 30s/15s 9:16，含声音与素材 | 情绪走向：黄昏→夜→风暴→黎明 · 白昼→黄昏→深夜 · 冷雨→暖室→雪停 · 其他 |

规则：

- brief 里已经明确回答的，不要再问；在回述里标「已知」。七问只定方向，不要问镜头、景别、颜色值、字体、转场——这些由 AI 提案。
- 七问后先**回述** 5 行（类型 / 给谁看 / 主角与记忆点 / 气质与禁忌 / 交付），再用一句话说出你准备写的故事，等用户确认。确认后最多再问 2 轮细节（每轮 ≤3 问），只问会改变故事、人物关系、空间或格式的事。
- 用户说「你定 / 随便」时不要跳过：给 2–3 个具体方案与取舍，推荐一个，让用户确认；仍授权才记录「AI 提案，用户确认」。
- 七问答案写进 `direction.json`，建工程时用 `--intake direction.json`；`new-film.js` 会把答案预填进 `treatment.md` 的方向锁，后续写作不得与它矛盾。非终端、没给 `--intake` 时 CLI 会直接报错，提示先问完七问——不要绕过。

拿到答案再往下走：promo 走第 1–12 步；MV 直接跳第 M0 步。**MV 里不加 look/主题/版式，宣传片里不塞剪纸场景与画布歌词。** 动笔写稿前，先在 `treatment.md` 第一行写明“类型 + 写作轨道”（宣传片：世界/空间/序列/色域；MV：故事/人物/歌词/镜头），写稿时只读对应那一套方法，不要把两种稿子混在一起。

### A. 宣传片（promo）

#### 1. 判断交付规格（30 秒内定下来）

| 问题 | 默认决策 |
|---|---|
| 时长 | 没指定 → 60s；社媒口播/开箱 → 30s；极短钩子 → 15s |
| 画幅 | 没指定 → 1920×1080；抖音/Reels/Shorts → 1080×1920（`--vertical`，版式自动重排） |
| 分辨率 | 默认 1080p（`--scale 1`）；只有用户这次明确要 4K 才 `--scale 2`，不要主动提 |
| 语言 | 跟随用户；中文为主时字幕与标题都用中文，英文只做微标签 |
| Look | 没指定 → 用编辑器选择器让用户从 15 个 look 里选；AI 只排序推荐（第 2 步） |
| 主题 | 只在客户指定气质/已有品牌色时强制 `--style`，否则交给 look |
| 音乐 | 默认本地合成（calm）；动作/科技 → tense；温暖叙事 → warm |
| 旁白 | 默认无旁白；用户要求口播、解说或文案较长时跑 `npm run voice` |
| 素材 | 默认代码绘制；用户给照片/视频时才放 `assets/media/` 并 `npm run media` |
| 产品画面 | 软件/AI/平台 → 全出血真界面（授权页面抓帧，或 `js/screen-kit.js` 手搭发布级界面）；硬件/实体 → 世界语法：产品在真实空间与光里，屏幕 ≤30%（`references/hardware-promo-grammar.md`） |

七问已经覆盖类型、对象、记忆点、气质、禁忌与交付；这张表只在用户没有偏好或答案含糊时给默认建议，不能替代七问。

#### 2. 选 look（七问第 5 问；用户选，AI 只推荐）

**审美由用户决定，AI 不自作主张。** 这是七问里的第 5 问，不要等建完工程再补问。除非用户已指定 look，或明确说“你定 / 随便 / 自动”，否则必须让用户从 15 个 look 里选。不要用纯文本清单让用户回编号。

1. **算推荐（不建工程）**：

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
node "$SKILL/assets/template/tools/pick-look.js" --root "$SKILL/assets/template" --json "<brief>"
```

推荐只用于排序和默认高亮，不要直接采用。

2. **用编辑器的选择器让用户选**，分两轮。第一轮「气质方向」四个选项：纸感编辑 · 铅印（`ink-*`）、暖白日常 · 静物（`quiet-*`）、银幕影像 · 电影（`cinema-*`）、结构与信号（`swiss-*` / `tech-*`），把推荐 look 所在分组标「推荐」。第二轮只列所选分组的具体 look，每项写 `主题/版式/动效 · 引擎` + 适合 + 一句话气质；分组 ≤3 个时第 4 个给「按 brief 自动（用推荐）」，4–6 个时分两屏，不要一次塞 6 个长选项。选项文案从 `--json` 的 ranking 加 `references/looks.md` 的表格生成。

**没有选择器时**：按四个分组打印编号清单，请用户回一个编号；仍然不要默认 auto。用户授权 AI 代选时（“你定”）才用 `auto`，交付时说明是自动选择。

3. **把用户选的 id 写进 `direction.json` 的 `look` 字段**，随 `--intake` 建工程；交付写「look: `<id>`（用户选择）」。

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

#### 3. 先扩写（treatment），再写故事，再分镜

**本步只属于宣传片。** MV 不写 6 空间 / 30 候选镜 / 4 色域表：它按背景、人物、关系、母题、歌词段与镜头候选扩写（见 M1），两套模板不能互换。

**一句话 brief 直接分镜，片子就会变成功能演示。** 拿到 brief 的第一件事是按 `references/brief-expansion.md` 把它扩写成一个 `treatment.md`，扩写不到位不许写分镜。广告公司接一句“给 MacBook 做支宣传片”，先交的是一份写到能直接拍的方案，不是八行分镜表。**不设字数上下限，写得越详细越好**——但每一句都要能变成画面、动作或镜头；只有形容词的段落不算扩写。

扩写分四层，每层都要落到名词与动词（具体空间、具体物件、具体动作），不许用“高级感、极致、 seamless”这类形容词蒙混：

1. **世界**：产品/主角存在于哪些真实场景？至少 6 个空间（工作室、街面、雨中、桌面、旅途、深夜……），每个空间写清时间、光、材质、声音。
2. **人物与动作**：谁在用它、在什么处境里、手上在做什么；没有人物就用“手 / 背影 / 剪影 / 留下的痕迹”作为人物替代。
3. **序列**：把 brief 拆成 ≥10 个候选序列（世界 → 仪式 → 细节 → 使用 → 结果 → 收束），最后压到 6–8 个进片。
4. **色彩与情绪**：≥4 个色域各自对应一个情绪与一个空间；全片不允许只有一个主色。色域不是滤镜，是叙事段落。

`treatment.md` 必须包含：方向锁（主体锚点 / 观众承诺 / 这不是什么 / wild card）、一句话故事、≥6 空间表、≥10 序列表、**≥30 条候选镜头**（最后留 20–30 条）、≥4 色域表（每个占比 ≥8%，主色域 ≤60%）、声音与文案草案、被删掉的镜头与原因。**不设字数上下限，写得越详细越好**：每个空间、每个动作、每条候选镜都要写到能直接拍。配额按片长缩放（60s / 30s / 15s），见 `brief-expansion.md` 的配额表。文件放在目标工程根目录（工程未建时先写在工作目录，建好后移入），与成片一起保留。

**treatment 先给用户过目**（展示世界表、序列表、色域表和一个 6–10 行的镜头摘要），确认后再写成一张分镜表：时间、场景 id、这一拍发生什么、屏幕文案（主/副）、画面、转场。分镜表也要确认后再开渲。**故事是从 treatment 里长出来的**：口播与字幕最后写，让文案去服务画面，而不是反过来。

**分镜表同时写成机器可读的 `config.shots`。** 定稿分镜后，把每个进片镜头填进 `js/config.js`，并把 `config.grammar` 设为 `'world'`（硬件/实体）或 `'screen'`（软件/AI/平台）：

```js
grammar: 'world',
shots: [
  { id: 's1', at: 0,    dur: 4.2, space: 'loft-dawn', frame: 'wide',  subject: 'desk',   note: '窗光扫过桌面，电脑合着' },
  { id: 's2', at: 4.2,  dur: 2.6, space: 'loft-dawn', frame: 'macro', subject: 'hinge',  macro: true, note: '铰链开合，光沿铝边滑过' },
  { id: 's3', at: 6.8,  dur: 3.0, space: 'cafe-day',  frame: 'mid',   subject: 'hands',  human: true, note: '一只手把电脑推进包里' }
]
```

`at`/`dur` 是**成片秒数**（不是场景内秒数），`space`/`frame`/`subject` 用来查空间数与相邻镜重复；`screen: true` 标屏幕镜、`macro: true` 标微距、`human: true` 标人手/人迹。`npm run check` 按 grammar 判：world 要 ≥4 空间、屏幕 ≤30%、微距 ≥2、人迹 ≥2（30s 以下对半）；screen 要屏幕 ≥50%；相邻两镜不能同空间 + 同主体 + 同景别。改完场景必须同步改 `config.shots`，否则 check 直接失败。

**3.1 按产品类型选语法。** 两种语法不混用：

- **硬件 / 实体产品**（笔记本、耳机、相机、汽车、家电、家具……）走 `references/hardware-promo-grammar.md` 的**世界语法**：产品活在真实空间与光里，人只给手/背影/剪影；屏幕镜头 ≤30%，且每一条屏幕镜头都必须对应一个状态变化（否则它就是功能演示）。六段结构：世界 → 仪式 → 细节 → 使用 → 结果 → 收束。禁止：深色渐变里的悬浮产品、九成屏幕镜头、单色到底、产品静止不动、字幕喊“轻薄/强大”而画面没证据。
- **软件 / AI / 平台**走 `references/product-film-grammar.md` 的**真屏语法**：全出血真实界面 + 一条任务（谁，要完成什么，卡在哪，谁接手）+ 8–16s 屏幕长镜与 1.93s 间幕卡节拍。**没有界面的产品，先做界面（真页面或 screen-kit），再谈拍法。** 界面之外的皮肤按当次品牌重新定，不沿用参考片。

#### 4. 建工程

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
# 七问答案先写进 direction.json（见 references/intake.md）
node "$SKILL/scripts/new-film.js" ./my-film \
  --intake direction.json \
  --title "北岸咖啡" \
  --brand "NORTH BANK" \
  --brand-sub "城市烘焙 / SINCE 2019" \
  --slogan "把清晨，烘进一杯里"

# 竖屏：七问第 7 问选 30s · 9:16，intake 里写 format: "30-9x16"
node "$SKILL/scripts/new-film.js" ./vertical \
  --intake direction-vertical.json \
  --title "山野来信"
```

- **先有七问，再建工程**：`--intake` 是默认入口；时长、画幅、look 都从 intake 派生。非终端没有 `--intake` 会直接报错，不要用 `--genre` + 默认值绕过。
- 目标目录非空会拒绝；确认覆盖时加 `--force`。
- 宣传片默认从**空白起步**：只有一个 0–60s 的标题卡占位场景 `s0`，没有七个示范场景，也没有预置插画。故事与分镜写完之后，按场拆 `js/scenes/*.js`。
- `--demo` 复制老的七场编辑排版示例（`assets/demo-editorial`），只用于研究场景契约、组件与 QA 写法；**不要拿来只换颜色和文案就交付**。
- `--look` 来自七问第 5 问；intake 里写 `auto` 只在用户明确授权代选时使用。
- `--look` 不在 15 个 look 内会报错并列出可用值；`--style` / `--layout` 可单独强制某一层。
- `--brief` 写进 `config.brief`；不传时由七问里的对象/记忆点/补充说明拼成。`--no-install` 跳过依赖安装；`--poster-at` 是成片秒数（内部换算成 60s 基准）。
- 时长/画幅来自 intake 的 `format`；显式传 `--duration` / `--vertical` 且与 intake 冲突会报错。
- 创建后 `cd my-film`，后续命令都在工程根目录执行。

#### 5. 改文案（最快见效）

1. `js/config.js`：`title / brand / brandSub / slogan / disclaimer / brief / look / style / layout`，以及时长、画幅、fps、封面时间。
2. `js/script.js`：全部字幕（`subtitles`）与每个场景的标题、副题、标签、卡片、面板、页脚文字。旁白可加 `narration`，不写则用 `text`。
3. `index.html`：只在新增/删除场景时改脚本引用；字幕容器保持空的 `<ol id="subs">`。

字幕用**场景内定位**，不写全局秒数（场景 id 来自你自己的分镜表）：

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

#### 7. 按分镜写场景

场景文件在 `js/scenes/`，数量与 id 由你的分镜表决定（`s0`、`s1`… 或语义 id 如 `drawer`、`thread`；用 `sN-` 前缀最直观）。每个场景必须实现：

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

**硬件/实体产品片**别从零画桌子：`js/product-kit.js` 已随模板引入，`product.hardwareShot({ place, tone, light, props, device, material, framing, move, screen, open, sweep })` 一次给出三层空间、窗光、浮尘、桌面接触阴影、铝壳/键帽/屏幕渐变与开合/光扫；`shot.seek(local, slot)` 只依赖时间。可用值、机位与验收见 `references/hardware-promo-grammar.md` §3.7。套件只解决“真实世界的底子”，镜头怎么排成故事仍要自己写。

**真屏产品片**额外遵守（详见 `references/product-film-grammar.md`）：

- 用 `js/screen-kit.js` 搭界面：`screen.stage()` → `screen.win()` × N → `screen.term()` / `screen.board()` / `screen.card()` / `screen.dialog()` / `screen.taskbar()` / `screen.chat()` → `screen.caption()`；间幕卡用 `screen.intertitle()`，结尾用 `screen.collage()`。
- **参考片只贡献技术**：动效时序、转场方式、真实卡片种类可以学；配色、胶囊颜色、吉祥物、字标、CTA 排版一律按当次品牌重定。主色只取主题 `--accent`，间幕卡只用 `--paper/--ink/--accent`。
- `js/config.js` 写 `motion: 'locked'`：关掉全片漂移与切点闪白；真屏片必须硬切。
- 字幕轨可以留空（`subtitles: []`），字幕用画面内的 `screen.caption()`，一条只挂一个镜头。
- 界面文字 20–28px；要强调就用 54px 字幕或 104px 间幕卡，**不要放大 UI 字号**。
- 面板允许被画框切掉一半（左栏负坐标、右栏出画），这是真实感来源，不是错误。

#### 8. 环境体检 + 静态检查 + 单测

```bash
npm run doctor            # Node/依赖/Chrome/ffmpeg/磁盘/主题/配乐
npm run check:treatment   # treatment 结构：方向锁/空间/序列/候选镜/色域，缺项直接报
npm run check             # 静态检查 + config.grammar / config.shots 分镜契约
npm test                  # look/引擎绑定/config/剧本/CLI 契约，秒级，不需要浏览器
npm run gate:pre          # 写作门禁：treatment + check（或 MV 单测），渲染前必须过
```

`doctor` 把“渲染到一半才发现没 Chrome/磁盘不够”提前暴露：4K 全片按 8.5MB/帧估算。`check` 必须全部通过：配置合法、主题令牌契约、WCAG 对比度（正文 ≥10:1、字幕 ≥7:1）、字幕有序/不重叠/阅读速度/跨切点、场景覆盖、引用齐全、JS 语法、CSS 裸数字、颜色字面量，以及分镜契约（空间数/屏幕占比/微距/人迹/相邻镜重复）。

#### 9. 自动体检（一条命令）

```bash
npm run qa          # = 静态检查 → 版式 → 节奏 → 引擎 → 抽帧，汇总写 qa/summary.json
npm run qa:layout   # 只量文字：出框、祖先裁切、nowrap 溢出、字幕压字、运行时报错
npm run qa:timing   # 节奏探针：占位符/未解析变量/70% 后残影/字幕/空尾帧
npm run qa:engines  # 15 个 look 的引擎逐一体检：绑定、单层、有内容、可复现、确实在动
npm run qa:motion   # 成片运动连续性：静态帧占比、帧差均值/分位、最长静止段、切点
npm run qa:variety  # 成片色彩体检：色域数、主色域占比、明暗跨度、饱和度，报告 qa/variety.json
node tools/qa-regress.js . --update   # 有意改设计后重建 SSIM 基线（仅本机）
node tools/qa-regress.js .            # 与基线比；worst < 0.985 即报警
node tools/qa-all.js . --look ink-poster              # 换 look 回归
node tools/qa-all.js . --look quiet-editorial --layout split
```

`qa-layout` 每场景采样 15/45/75/90% + 每条字幕中点（43 个时刻），报告 `qa/layout.json`。有 ERROR 先修，不要带着出框或占位符抽帧审片。换 look、换版式、竖屏都要重跑；样片墙只用于审美目检，不能替代 QA。**改了引擎或主题质感后必须跑 `qa:engines`**：它直接读 Canvas 像素，确认引擎没有白画、没有变成两层、同刻两次渲染一致、时间推进确实有变化。

`qa:motion` 对成片逐帧算帧差：静态帧占比 >50% 或帧差均值 <0.4 直接报错；>25% 或 <0.6 警告；连续静止 ≥1.2s 也警告。参考片（30fps）静态帧约 7%、帧差均值 2.96；本模板 `ink-editorial / calm` 为静止帧 1%、均值 0.81。帧差绝对值取决于画面密度，**以静止帧与最长静止段为主判据**，实拍素材或 tech/cinema look 应达到均值 1.5 以上。出现大面积静止时依次检查：场景 `seek` 是否整段没动、素材是否单张且无 Ken Burns、导出是否误用低帧率或重复帧。

`qa:variety` 每秒抽样一帧压到 32×18，转 HSV 后按 12 个色相加中性色归档：主色域 >60%、色域数（占比 ≥8%）<3、明暗跨度 <0.10、饱和度中位 <0.10 都会警告。**这就是「画面单一、颜色单一」的机器判据**——MacBook 那支片实测主色域 82%、色域数 2、明暗跨度 0.10，全中。色彩脚本不达标先改故事板里的色域表，不要靠加滤镜蒙混。

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

`encode.js` 自动检测 `assets/voiceover.wav`：有旁白时音乐降到 0.40 左右并侧链闪避；无旁白时音乐 0.55、2s 淡入淡出。可调 `--voice-gain` / `--music-gain` / `--no-duck` / `--no-voice` / `--muted`。审片通过后按需出 4K（用户这次明确要求时）：

```bash
node render.js --scale 2  # 4K → 3840×2160
node encode.js            # out/final.mp4（旁白 + 音乐）
node encode.js --proxy    # 4K 时额外出 1080p 代理
```

默认交付就是 `node render.js --scale 1 && node encode.js` 的 1080p，不要擅自升 4K。

渲染中断用 `node render.js --resume`（参数必须一致，风格/look/版式不同会直接拒绝）。开渲前校验主题文件并按分辨率/帧数估算磁盘（<60% 预估直接失败）。`encode.js` 检查帧连续性，缺帧会报错；编码后打印 `volumedetect` 响度，出现“偏响/偏轻/削波”时调增益。编码后先跑 `npm run qa:motion` 与 `npm run qa:variety`，不合格不要进入交付。

**快做完时必须跑一遍自检修复**：`npm run repair`（新鲜度 / 容器 / 危险时刻抽帧 / 空帧 / 触边 / 运动 / 色彩一次跑完，报告 `qa/repair.json`）。有问题按 `references/repair-loop.md` 的循环修：`node render.js --at … → 重渲 → node encode.js → npm run repair`，直到 `ok: true` 且警告都看过。

#### 12. 验收与交付

```bash
node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)"   # 取 ffmpeg
"$FFMPEG" -hide_banner -i out/final.mp4                            # 看时长/分辨率/音轨
node tools/grab.js out/final.mp4 3.0 15.0 27.0                     # 从成片回抽帧核对
npm run gate                                                       # 交付门禁：treatment + 静态/单测 + repair --strict
```

**交付门禁**：`npm run gate` 必须通过——它依次跑 treatment 结构、`check-project`（含分镜契约）或 MV 单测、`repair --strict`（警告也算失败），结果写 `qa/gate.json`。`qa/repair.json` 的 8 项清单逐条确认；repair 抽出的静帧四角要看（构图、裁切、残影）；`out/final.mp4` 的修改时间必须是所有源文件里最新的——**旧片子配新源文件是最常见的交付事故**。

交付报告写：成片路径/时长/分辨率/帧率/编码（H.264 / AAC / yuv420p / bt709）；look（用户选择还是自动，自动附置信度/命中词）、主题、版式、封面、QA 抽帧目录；画幅与时长缩放；运动连续性（`qa:motion`）、色彩分布（`qa:variety`：色域数/主色域占比/明暗跨度）与 `repair` 结果；扩写统计（宣传片：几个空间/几条候选镜/几个色域；MV：背景与人物关系是否完整、四段歌词、候选镜数/成片镜数、mood 档数）；素材来源与授权、旁白语音/语速/增益、音乐来源（本地合成）；工程目录。

### B. MV（paper-story，层叠剪纸叙事）

MV 是**代码绘制的层叠剪纸叙事短片**：原生 1920×1080 Canvas、纸边高光 + 柔和投影 + 纸纹、固定机位镜头制分镜、剪影纸人、画布底部歌词。不做 AI 生图、不接实拍素材。引擎层通用，故事层每支片整段重写；完整经验与坏帧修法见 `references/mv-craft.md`。

#### M0. 建工程前必须确认的事（不猜）

| 问题 | 为什么必须确认 | 写进哪里 |
|---|---|---|
| 讲什么故事？ | 决定分镜与歌词，不能套模板 | `js/film.js` + `js/script.js` |
| 1080p 还是 4K？ | 默认 1080p；只有用户明确要 4K 才写 `--resolution 4k` | `config.renderScale` |
| 有成品歌/歌词吗？ | 有就导入并对齐分镜；没有就合成配乐或静音 | `npm run song` / `npm run music` |

画幅固定 16:9，不用问；MV 不接受竖屏参数。

#### M1. 先扩写（背景 + 人物 + 关系 + 母题 + 歌词段 + 镜头候选），确认后再分镜

MV 的稿子要比宣传片厚得多。宣传片只写与画面有关的四层；MV 要把整个故事写透，**不设字数上下限，写得越详细越好**，写到每个镜头都能直接拍。它不套宣传片的 6 空间 / 30 候选镜 / 4 色域模板。方法细则见 `references/mv-craft.md` §0，输出是一份 `treatment.md`（`new-film.js --intake direction.json`，`genre: "mv"`，已在工程里生成骨架）。

1. **方向锁**：主体锚点（这是谁的故事）、情绪落点（最后要让观众感到什么）、这不是什么（纯空镜 MV / 风景明信片 / 抽象诗）、一个 wild card 镜头。后面每写完一段都回来对照。
2. **世界与背景**：地方、时代、社会质感、天气与日常仪式；只保留能改变人物选择的 3–5 件事，落到可拍的名词（灯塔的铜锈、码头木桩上的盐、窗玻璃的霜）。
3. **人物与关系（2–3 人）**：每个人写想要什么、怕什么、不肯说的事、这次必须做的选择、最后的改变；关系写“谁在等谁 / 谁欠谁 / 这次相遇或分离会改变什么”。阻力可以是距离、时间、职责、天气，不一定要有反派。
4. **故事弧**：主角是谁 → 想要什么 → 被什么挡住 → 做了什么选择 → 最后一个镜头和第一个镜头有什么不同。写不出“改变”就先别写镜头。
5. **母题（3–5 个）**：会反复出现的物件、动作或声音；每次出现都要变（点亮 → 熄灭 → 再点亮），它是人物关系的证据，不是装饰。
6. **歌词段**：有成品歌/歌词，先把每句按绝对秒数落进 `verse → chorus → bridge → finale` 四段；没有歌，先写 12–18 句口语歌词（每条 8–16 字、≤7 字/秒）。歌词是人物心里的话，不是剧情说明。
7. **镜头候选**：60s 先写 **≥32 个候选镜**，删到 **20–28 镜**；每镜只发生一个动作，时长按 2–3 秒草拟；主角镜头 ≥50%，`wide / mid / close` 都要有，同场景重复必须换 `v`。
8. **mood 脚本**：`dusk / night / storm / dawn` 至少用 3 档，单一 mood 不超过 60% 的镜头；相邻镜头不要连续同场景同景别。颜色只从 `K.pal(mood)` 取，不写色值。

`treatment.md` 必须包含：方向锁、世界与背景、人物与关系、故事弧、母题、歌词段表、镜头候选表（时间/场景/mood/景别/这一镜发生什么/歌词）、mood 表、片头片尾与声音、删除日志。**先给用户过目方向锁、人物与关系、故事弧、歌词段与镜头候选**，确认后再写分镜表。片长不是 60s 时按 2–3 秒一镜等比增加候选镜。

#### M2. 把 treatment 写成定稿分镜表，确认后再渲染

把确认过的故事弧拆成四段情绪：`verse` → `chorus` → `bridge` → `finale`，再写成分镜表给用户确认：

| 时间 | 场景 | 这一镜发生什么 | 歌词 | 景别 |
|---|---|---|---|---|
| 0–2.5 | harbor | 黄昏港口，片头卡 | — | wide |
| 2.5–5 | pier | 她走到栏杆边，船离岸 | 她没喊，只是站着 | mid |
| 5–7.5 | tower | 灯亮起，光束扫过海面 | — | wide |

规则：60s 片 **20–28 镜**，每镜 **2–3 秒**；每镜只发生一个动作；同一场景可以多次出现，但必须换 `v` 派生不同构图，**不能出现同一张画面**。分镜表没确认不要开渲。

#### M3. 建工程

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
# 七问答案先写进 direction.json（见 references/intake.md）
node "$SKILL/scripts/new-film.js" ./my-mv \
  --intake direction.json --title "把灯留着" \
  --brand TIDE HARBOR --brand-sub "潮汐港 / TIDE HARBOR" \
  --slogan "灯亮着，就有人回来"
# 用户明确要 4K 时才加 --resolution 4k（renderScale 2，矢量重画）
```

- 分辨率默认 1080p；`--resolution 4k` 只改设备像素比，画布坐标不变。
- 七问第 2 问若是「成品歌 + 歌词」，建完工程先跑 `npm run song -- --audio … --lyrics …`，再按歌词重排 `film.js`。
- MV 固定 60s 分镜：改片长要改 `js/film.js`（增删镜头、保持每镜 2–3 秒），不要用 `--duration` 缩放。
- MV 拒绝 `--look/--style/--layout/--vertical`；画布必须是原生 1920×1080，不能改尺寸。
- 模板里的 `film.js` / `script.js` 只是一支示范片（24 镜/60s）；建完工程先整段替换成用户的故事，引擎层不动。

#### M4. 写分镜（js/film.js）

一镜一拍，绝对秒数铺开：

```js
{ s: 'pier', mood: 'dusk', frame: 'mid',
  who: GIRL({ x: 700, y: 930, h: 330, pose: 'stand', dir: -1 }),
  boat: { x: 1230, y: 800, s: 0.44 } }
```

- 字段：`s` 场景（`harbor/pier/portrait/tower/lamp/flame/sea/window/end`）/ `mood`（`dusk/night/storm/dawn`）/ `frame`（`wide/mid/close`）/ `who` / `boat` / `lampOn` / `beam` / `hands` / `wipe` / `card` / `end`。
- 每镜 2–3 秒、只发生一个动作；最后一镜 `end: true` 且 `s: 'end'`，收在 `film.total`。
- 场景名只能用 `paper-sets.js` 里已有的 `S.<name>`；要新场景先按 `references/mv-craft.md` 注册。
- 引擎层（paper-kit / paper-figures / paper-sets / shot / timeline）不写任何一支片专属的文字、地名或台词；片名/品牌/标语/标签只从 `config.js` 读。

#### M5. 写歌词（js/script.js）

- 每条 8–16 个汉字、≤7 字/秒、不重叠；用绝对秒数 `{ start, end, text }`，可以跨切点，但换拍就换句。
- 歌词由 `K.lyric` **画在画布底部安全区**（约 y=940–1010）；DOM `#subs` 只做预览，不参与成片。
- 主体（人物脚底、船）不要压进歌词带；第一条歌词不要压在片头卡上。
- 用户给了成品歌与歌词：`npm run song -- --audio <歌曲> --lyrics <lrc|txt>` 转码并重写 `script.js`，再按句重排 `film.js`。

#### M6. 画面规则（违反会直接坏帧）

- 原生 1920×1080：场景坐标、纸层、字形都按它写；分辨率只走 `renderScale`（1/2），不改 `config.width/height`。
- 图层顺序固定：天空 → 远景海 → 城镇 → 中景 → 人物 → 前景浪/雾/雨 → `K.grain()` → `K.vignette()` → 片头/片尾卡 → `K.lyric()`。
- 每块纸必须走 `K.paper(fill, { edge, dy, blur })`：顶部亮边是裁口，下方柔投影是层距；颜色只从 `K.pal(mood)` 取，一帧不超过 6 层纸。
- 镜间只有硬切；运动只有浪/雨/火光/雾/灯束/船晃/呼吸，**每一帧至少有一层在动**，动作在镜头 70% 前收住。
- 绘制只依赖 `local` 与 `K.rnd(seed)`；禁 `Math.random()` / `Date.now()`；同刻两次必须逐像素一致。
- 抽帧先看每镜 45%：接近全黑就换场景或换站位，不要只调亮度。

#### M7. QA 与渲染

```bash
npm run doctor
npm test        # 分镜契约：连续覆盖、2–3 秒、唯一 v、歌词、确定性、图层隔离
npm run qa      # qa-mv（画布/歌词/片尾/同刻复现/画面推进）+ 逐镜 30%/78%/切点抽帧
npm run qa:mv   # 只跑浏览器体检，报告 qa/mv.json + qa/mv/*.png
npm run qa:motion   # 成片运动连续性（静止帧/最长静止段）
npm run qa:variety  # 成片色彩分布（色域数/主色域占比/明暗跨度）
npm run repair      # 交付闸门：切点与 78% 收镜抽帧 + 容器 + 新鲜度 + 运动/色彩
node render.js --scale 1 && node encode.js     # 1080p 审片（默认）
node render.js --scale 2 && node encode.js     # 4K，仅当用户这次明确要
npm run music                                   # 可选；不生成则 encode 输出无声片
```

`qa-mv` 判据：画布后备 1920×scale × 1080×scale、无宣传片层、每镜 45% 帧 ≥24 色且 ≥12% 有内容、同刻复现最大差 ≤2、+0.45s 必有变化、每条歌词中点画布文字一致且 alpha ≥0.5、最后 1.2s 片尾卡完成。抽帧必须逐张看，尤其 78% 收尾帧与切点前 0.25s。编码后跑 `npm run repair`：`ok: true`、切点与收镜静帧看过、成片新于所有源文件，才交付。

#### M8. 与宣传片的边界

- MV 工程里不得出现 `looks.js` / `style.js` / `engines.js` / `themes/` / `layouts.css` / `base.css`；`styles/` 只有 `mv.css`。
- 宣传片工程里不得塞剪纸画布、纸人、画布歌词；两套模板的 timeline、字幕、QA 都不共用。
- 不“先建 promo 再改成 MV”或反过来；类型先定，再建工程。
- 参考片只学方法（镜头长度、切点节奏、纸层构图、歌词安全区），不复制角色/台词/画面/音乐；第三方视频先确认授权，只提取结构手法。

## 命令速查

### 宣传片（promo）

| 命令 | 作用 |
|---|---|
| `npm run preview` | 本地预览，空格播放/暂停，←/→ 逐秒，`S` 主题 / `L` 版式 / `K` look |
| `node tools/pick-look.js "brief"` | 按一句话推荐 look（含命中词/置信度/备选） |
| `npm run looks` | 列出 15 个 look |
| `npm run look:gallery` | 15 个 look 各出 3 帧 → `qa/looks/gallery.html` |
| `npm run doctor` | 环境体检：Node/依赖/Chrome/ffmpeg/磁盘/主题/配乐 |
| `npm run check` | 配置/look/版式/对比度/剧本/场景/素材/语法/颜色令牌 + 分镜契约 |
| `npm run check:treatment` | treatment 结构验收：方向锁/空间/序列/候选镜/色域 |
| `npm run gate:pre` | 写作门禁：treatment + check，渲染前必须过 |
| `npm run gate` | 交付门禁：treatment + check + repair --strict（警告也失败） |
| `npm test` | look 目录/引擎绑定/config/剧本/CLI 契约单测 |
| `npm run qa` | 静态 → 版式 → 节奏 → 引擎 → 抽帧，汇总 `qa/summary.json` |
| `npm run qa:layout` | 逐场景量版式（43 个时刻），报告 `qa/layout.json` |
| `npm run qa:timing` | 43 个采样点查占位符/残影/字幕/空帧，报告 `qa/timing.json` |
| `npm run qa:engines` | 15 个 look 的引擎像素体检，报告 `qa/engines.json` |
| `npm run qa:motion` | 成片运动连续性体检，报告 `qa/motion.json` |
| `npm run qa:variety` | 成片色彩分布体检（色域数/主色占比/明暗跨度），报告 `qa/variety.json` |
| `npm run repair` | 交付前自检修复：新鲜度/容器/抽帧/空帧/触边/运动/色彩，报告 `qa/repair.json` |
| `node tools/repair.js . --strict` | 严格模式：警告也按失败处理 |
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

### MV（paper-story）

| 命令 | 作用 |
|---|---|
| `npm test` | 7 项分镜契约单测（不启浏览器） |
| `npm run check:treatment` | MV treatment 结构验收（人物/母题/四段歌词/≥32 候选镜/mood） |
| `npm run gate:pre` | 写作门禁：treatment + 单测，渲染前必须过 |
| `npm run gate` | 交付门禁：treatment + 单测 + repair --strict（警告也失败） |
| `npm run qa` | qa-mv → 逐镜 30%/78%/切点抽帧 |
| `npm run qa:mv` | 画布/歌词/片尾卡/同刻复现/画面推进 |
| `npm run qa:regress` | qa-mv 不抽帧重跑（MV 无 SSIM 基线） |
| `npm run stills` | 13 个代表帧抽到 `stills/` |
| `node render.js --at 1.2,26.2,58.7` | 指定时刻抽帧 |
| `node render.js --scale 1` | 1080p 全片（1920×1080，默认） |
| `node render.js --scale 2` | 4K 全片（3840×2160 矢量重画，仅在用户要求时） |
| `npm run song -- --audio … --lyrics …` | 成品歌 + LRC/txt → `assets/music.wav` + 歌词时间轴 |
| `npm run music` | 可选：合成配乐 → `assets/music.wav` |
| `node encode.js` | 帧 + 音频 → `out/final.mp4`（无音频则无声） |
| `npm run repair` | 交付前自检：新鲜度/容器/抽帧/运动，报告 `qa/repair.json` |
| `npm run build` / `build:4k` | 1080p / 4K 渲染 + 编码 + repair |

## 硬规则（都是踩过坑换来的）

1. **类型先定，语法不混**：先问宣传片还是 MV；MV 不加 look/主题/版式，宣传片不塞剪纸场景与画布歌词。
2. **故事先于分镜，分镜先于版式**：每支宣传片先写主角/欲望/阻力/改变，再写分镜表；禁止直接套 `--demo` 的七场骨架、只换颜色与文案。判断标准：把品牌名换掉后，故事是否仍然成立且只属于这支片。
3. **切点头部要“已经在”**：页眉、页脚、裁切标记的入场从负本地时间开始，切点后 50ms 内必须可见；MV 是硬切，切点瞬间场景层就要完整就位。
4. **主体入场不要从画外飞入**：入场位移控制在 ±8–90px，用遮罩上推代替横飞。
5. **单位不能省**：`style.left = 120` 会被浏览器丢弃；必须 `'120px'`。
6. **不要跨切点延续动画**：每个场景的 `seek` 从自己的 `0` 开始，切点前要收干净。
7. **文字优先于动效**：任何时刻暂停，标题都应可读；主动效在场景 65% 前收住。
8. **字幕不压主体**：宣传片字幕固定在底部安全区；MV 歌词固定在画布底部安全区（约 y=940–1010），人物脚底与船不要压进歌词带。
9. **结算数字必须落值**：任何时刻不得出现 `—`、`NaN`、`{duration}` 这类占位符（`qa:timing` / `qa-mv` 会抓）。
10. **70% 后不留残影**：退场要么 opacity 0，要么被后续画面遮挡；半透明残影会被判为未完成画面。
11. **音乐只做底**：无旁白 0.55，有旁白约 0.40 并开侧链闪避；不要盖过字幕与口播。
12. **分辨率默认 1080p**：只有用户这次明确要 4K 才 `--scale 2`；不要主动提 4K，更不要用 4K 试错（4K 渲染约 15–25 分钟）。
13. **默认代码绘制，素材按需接入**：没有用户素材时不要下载图库；有素材时放 `assets/media/` 并 `npm run media`。
14. **交付前必须真跑**：doctor、test、qa、encode、ffmpeg 验证都通过才算完成；MV 没有 check/regress，以 test + qa-mv + 抽帧为准。
15. **转场只在一处调**：宣传片的硬切与纸色闪白只在 `js/timeline.js` 的 `FLASH_*`；场景里不写淡入淡出或 CSS transition。
16. **文案只有一个源**：所有可见文字先进 `js/script.js`；场景里写死文案会在改主题时漏改。
17. **颜色只有一个源**（宣传片）：场景只写 `var(--token)`；改主题只改 `styles/themes/*.css`。
18. **主题不承担布局**（宣传片）：主题 CSS 只改颜色/字体/质感；坐标与结构在 `base.css`/`scenes.css`/`layouts.css`。
19. **版式不靠猜**：auto 只是建议；信息密度高别用 poster，左右都重别用 split；选完必须抽帧看。
20. **竖屏不是横屏缩小**（宣传片）：用 `--vertical` 让 `portrait.css` 重排；MV 竖屏要重写 1080×1920 场景，不能用参数绕。
21. **旁白在字幕定稿后生成**：改文案后重跑 `npm run voice`；超槽位先改文本，不要盲目提速到听不清。
22. **引擎是背景，不是内容**：一帧只允许一个引擎，永远在内容之下；遮住引擎画面就散，说明版式没做完。
23. **引擎只依赖时间**：禁止 `Math.random()` / `Date.now()`，随机走 `rnd(seed)`；否则断点续渲与 4K 复现都会崩。
24. **改设计必须过回归**：改引擎/主题/版式后跑 `npm run qa:engines`，再跑 `qa-regress` 与基线比对；有意变化用 `--update`，无意变化必须修回。
25. **审美必须由用户选**：建工程前用编辑器选择器让用户从 15 个 look 里选；只有用户明确授权才用 `auto`，交付时写清是谁选的。
26. **运动必须全片连续**（宣传片）：整片一层相机缓慢推近/平移，切点不重置；静态帧占比 >50% 或帧差均值 <0.4 不得交付。
27. **真实素材必须有授权**：抓帧只用于用户自有或已明确授权的页面，不抓竞品/第三方站点，不绕过登录与付费墙；交付注明来源。
28. **MV 分辨率只走 renderScale**：原生 1920×1080，1080p = `renderScale 1`（默认），4K = `renderScale 2` 矢量重画；不改 `config.width/height`，不把 4K 当位图放大。
29. **MV 合成顺序不可换**：场景 → `K.grain()` → `K.vignette()` → 片头/片尾卡 → `K.lyric()`；顺序反了歌词会被暗角吃掉。
30. **MV 只依赖 local 与 K.rnd(seed)**：同刻两次渲染必须逐像素一致；qa-mv 会比对，不一致就是有未播种随机或时钟依赖。
31. **MV 引擎层保持通用**：paper-kit / paper-figures / paper-sets / shot / timeline 不写任何一支片的地名、台词、品牌字；片名、标语、`kicker`、`endTag` 一律从 `config.js` 读。换片时整段替换 `film.js` 与 `script.js`，引擎不动。
32. **MV 默认 1080p**：只有用户明确要 4K 才用 `--resolution 4k`；不要主动提 4K，更不要用 4K 试错。
33. **产品片必须拍屏幕**：软件/AI/平台类 brief 默认全出血真实界面（授权页面抓帧，或 `screen-kit` 手搭发布级界面）；禁止用抽象纸片、漂浮线条、几何隐喻替代界面。观众要看到产品在干活。
34. **真屏片关掉纸色转场**：`motion: 'locked'`，切点硬切、无闪白、无全片漂移；间幕卡与结尾卡的底色跟主题 `--paper`，不继承参考片肤色。
35. **一条任务贯穿全片**：开渲前先写出“谁，要完成什么任务，卡在哪，谁接手”；屏幕镜头只为这条任务服务，禁止功能清单式逐屏切换。
36. **屏幕长镜按拍数切**：屏幕镜头 8–16s，每 1.5s 必须有变化；切点长度量化到 1.93s（4 拍 @124BPM）的整数倍，间幕卡正好一拍。
37. **参考片只学技术，不学皮肤**：可学的是动效时序、转场方式、真实卡片种类与真实数据；颜色、胶囊、吉祥物、字标、CTA 排版、镜序都属对方个性，必须按当次 brief 重做。做换名测试：换个品牌画面仍完全成立，就是抄错了层。
38. **扩写先于分镜，但两种类型写两套稿**：宣传片先写 `treatment.md`（方向锁 + 一句话故事 + ≥6 空间 + ≥10 序列 + ≥30 候选镜 + ≥4 色域，配额查 `references/brief-expansion.md`）；MV 写得更厚（方向锁 + 背景 + 人物与关系 + 母题 + 故事弧 + 四段歌词 + ≥32 候选镜删到 20–28 + mood ≥3 档，见 M1 与 `references/mv-craft.md` §0）。两边都不设字数上下限，写得越详细越好；两种 treatment 与分镜表都确认后才开渲。跳过扩写直接画，宣传片会变成功能演示，MV 会变成歌词配空镜。
39. **硬件产品不套真屏语法**：硬件/实体产品走 `references/hardware-promo-grammar.md` 的世界语法，屏幕镜头 ≤30% 且只用于状态变化；≥4 色域、主色域 ≤60%、明暗跨度 ≥0.10、材质/微距 ≥3 镜、人物痕迹 ≥2 处。软件/AI/平台才用全出血真屏语法，两者不许混。
40. **交付闸门是 `npm run gate`**：它 = treatment 结构 + `check-project`（含分镜契约）或 MV 单测 + `repair --strict`；全通过、`qa/gate.json` 为绿、8 项清单确认、静帧四角看过、`final.mp4` 比所有源文件新，才算交付。有缺陷按 `references/repair-loop.md` 修完重跑，不允许“应该没问题”式交付。
41. **七问先于建工程**：第 1 问用选择器定类型，之后各 6 问；答案落进 `direction.json`，`--intake` 建工程并预填 treatment 方向锁。非终端没有 `--intake` 会被 CLI 拒绝；不要用 `--genre` + 默认值绕过，也不要把七问当成用户替你写片。
42. **写作门禁是 `npm run gate:pre`**：treatment 结构 + 静态检查/单测不过，不许开渲。配额是下限不是处方；写得越详细越好，但不许写只有形容词、落不到画面的段落。

## 资源导航

- `scripts/new-film.js`：从模板建工程；七问答案用 `--intake direction.json` 传入（`--intake-template promo|mv` 生成骨架），非终端缺 intake 会报错要求先问完七问；promo 默认空白起步、`--demo` 才复制七场示例；mv 会拒绝 `--look/--style/--layout/--vertical`。
- `references/intake.md`：七问定向的问题库（宣传片 / MV 各 7 问）、选项 id、细节追问边界、回述模板与 `direction.json` 格式。
- `scripts/install.sh`：安装到 `~/.qoder/skills/brief-to-video`（或指定目录）。
- `references/genres.md`：宣传片 vs MV 的完整对照、MV 语法与常见错误。
- `references/brief-expansion.md`：宣传片的一句话 → treatment：方向锁、四层扩写、配额表（序列/空间/镜头/色域，不设字数）、`treatment.md` 模板、压缩规则、工作示例与反模式（含回访案例）。
- `references/hardware-promo-grammar.md`：硬件/实体产品片的世界语法：六段结构、三层空间、光与材质、屏幕 ≤30%、镜头语言、色彩脚本、反模式与验收（3 秒世界测试 / 6 帧 3 空间 / 去色 / 静音 / qa:motion / qa:variety / 换名测试）。
- `references/product-film-grammar.md`：真屏产品片语法（技术层/零件层/个性层）：九条语法、三种转场、间幕卡/字幕时序、真实卡片清单、真实度清单、60s 装配表、反模式。
- `references/repair-loop.md`：交付前自检修复：六项检查、修复循环、九类缺陷目录（残影/孤立亮点/板块面/时间线矛盾/错继承/键盘字形/相机裁切/过期交付/画面单调）、像素取证与交付闸门。
- `assets/template/js/product-kit.js`：硬件/实体产品视觉套件（三层空间/窗光/浮尘/桌面接触阴影/铝壳键帽/开合光扫），`product.hardwareShot()` 一次成镜；`styles/product.css` 配套。
- `assets/template/js/screen-kit.js`：真屏零件库（窗口/分栏/终端/看板/卡片/交接弹窗/任务条/对话记录/字幕/间幕卡/拼贴/连线/光标），全部 `seek(local)` 确定性驱动。
- `assets/template/styles/screen.css`：真屏样式；色板在 `tokens.css` 的 `--scr-*`，不写死颜色。
- `references/mv-craft.md`：MV 的扩写方法（方向锁/背景/人物与关系/母题/故事弧/歌词段/≥32 候选镜/mood 脚本，§0）、分镜字段、纸层画法、歌词安全区、确定性、坏帧修法与交付检查单。
- `assets/template/tools/doctor.js`：环境体检（Node/依赖/Chrome/ffmpeg/磁盘/主题/配乐），渲染前先跑。
- `assets/template/tools/check-treatment.js`：treatment 结构验收（方向锁/空间/序列/候选镜/色域，按片长缩放配额），`npm run check:treatment`。
- `assets/template/tools/gate.js`：交付门禁，`--pre` 只跑 treatment + 静态/单测，全门禁叠 `repair --strict`，报告 `qa/gate.json`。
- `assets/template/tools/check-project.js`：静态检查（look/版式/主题契约/对比度/字幕/素材/引用/语法/颜色令牌 + `config.grammar`/`config.shots` 分镜契约）。
- `assets/template/tools/pick-look.js`：按 brief 排序推荐 look（`--list`、`--json`、`--root`）。
- `assets/template/tools/look-gallery.js`：15 个 look 样片墙。
- `assets/template/tools/voiceover.js`：macOS `say` 旁白，按字幕时间轴拼成 WAV。
- `assets/template/tools/prep-media.js`：图片/视频 → 场景素材清单，视频自动抽帧。
- `assets/template/tools/capture-web.js`：抓取自有/授权网页为场景素材，含滚动、合成光标与点击。
- `assets/template/tools/qa-all.js`：check → layout → timing → engines → stills，汇总 `qa/summary.json`。
- `assets/template/tools/qa-layout.js` / `qa-timing.js` / `qa-engines.js` / `qa-motion.js`：版式、节奏、引擎、运动连续性探针。
- `assets/template/tools/qa-variety.js`：成片色彩分布探针（1fps 采样 → HSV 色域时间线；主色占比/色域数/明暗跨度/饱和度四道阈值）。
- `assets/template/tools/repair.js`：交付前自检修复（新鲜度对比源文件、容器校验、危险时刻抽帧、空帧与触边探针、聚合 qa:motion / qa:variety、8 项清单、`qa/repair.json`；`--strict` 警告即失败）。
- `assets/template/tools/qa-regress.js`：SSIM 视觉回归，基线在 `qa/baseline/`（本机资产）。
- `assets/template/tools/contact-sheet.js`：15 look 一页总览，直接产出带标签的 JPEG。
- `assets/template/tools/qa-stills.js` / `style-gallery.js` / `grab.js`：抽帧、主题静帧、成片回抽。
- `assets/template/`：宣传片**空白起步**工程（5 主题 + 4 版式 + 15 look + 8 引擎 + 单个 0–60s 占位场景 + 剧本层 + 竖屏 + 通用契约单测 + 渲染/编码/配乐/旁白/素材/抓帧）；故事、场景与画面每支片现场写。
- `assets/demo-editorial/`：老的七场编辑排版示例，只有 `new-film.js --demo` 才复制；用于研究场景契约、组件与 QA 写法，不作为默认骨架，更不要只换颜色交付。
- `assets/genres/mv/`：MV 工程（原生 1920×1080 剪纸画布 + 24 镜示范分镜 + 剪纸角色/9 场景库 + 画布歌词 + 片尾卡 + 可选配乐/歌曲接入 + QA + 单测）。
- `assets/genres/mv/tools/qa-mv.js`：MV 画布/歌词/片尾/同刻复现/画面推进体检。
- `assets/genres/mv/tools/song.js`：成品歌 + LRC/txt → `assets/music.wav` 与 `js/script.js` 歌词时间轴。
- `assets/genres/mv/tools/qa-all.js`：qa-mv + 逐镜 30%/78%/切点抽帧。
- `assets/template/js/engines.js`：8 个确定性 Canvas 引擎（halftone/riso/bokeh/dust/aurora/flow/scan/orbit）。
- `references/looks.md`：15 个 look、用户选择流程、版式、竖屏、素材、样片墙。
- `references/design-dna.md`：三层结构、引擎目录、借来的设计方法、签名动作、反套路黑名单。
- `references/design-taste.md`：反俗套、字体/间距/层级/动效/节奏。
- `references/brief-to-beats.md`：一句话 → 微型故事 → 现场分镜 → 文案/字幕；七拍只是可选的卖点型节奏，附反模板自检。**拆拍之前先做 `brief-expansion.md` 的 treatment 扩写**。
- `references/styles.md`：5 个主题、令牌契约、加第 6 个主题。
- `references/scene-authoring.md`：场景写法、辅助函数、素材接入、节奏预算、坑。
- `references/art-direction.md`：构图、字号层级、插画、品质线。
- `references/pipeline.md`：CLI 全参数、产物、故障排查、交付规格。
- `assets/template/test/unit.test.js` / `assets/genres/mv/test/unit.test.js`：不启浏览器的契约单测。
- `.github/workflows/qa.yml`：push/PR 自动跑单测、静态检查、引擎/版式/节奏体检。
- `ATTRIBUTIONS.md`：Taste Skill（MIT）、Impeccable / Anthropic frontend-design（Apache-2.0）的方法来源与落点。
- `VERSION` / `LICENSE`：版本与 MIT 许可证。

## 如果用户只想要“快”

“快”不等于套模板，可以压缩但不能跳过。最小流程：按 `brief-expansion.md` 的压缩档做一页 treatment（空间/序列/候选镜/色域都不能低于该档下限；不设字数，但每个镜头都要写到能拍）→ 一句话故事（主角 + 想要什么 + 卡在哪 + 最后怎样）→ 4–6 拍分镜表 → 4–6 个现场写的场景 → 只复用引擎、主题、组件与 QA 这些基础设施 → `npm run repair`。`--demo` 的七场示例可以用来读契约、抄辅助函数用法，但**不要只换颜色和文案就交付**——那正是“每支片都长一样”的原因。 MV 没有快速档，也不套上面这组宣传片数字：按 M1 压缩到“方向锁 + 人物关系 + 故事弧 + 20 镜候选 + 四段歌词”即可开工，但每个镜头都必须是叙事画面，确认后再整段替换 `film.js` 与 `script.js`。
