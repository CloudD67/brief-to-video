# 两种类型：宣传片（promo）与 MV（pixel-story）

这是 Skill 的第一道分叉。两种类型是两套**独立的视觉语法**：模板、CLI、QA、字体规则都不共用。混用不会得到“结合两者优点”，只会同时毁掉两边——所以每次建工程前先定类型，再往下走。

## 一句话区分

| 类型 | 语法 | 回答的问题 | 模板 |
|---|---|---|---|
| 宣传片 `promo` | 编辑排版：主题 + 版式 + look + 品牌信息 | “它是什么、凭什么、为什么选它” | `assets/template` |
| MV `mv` | 像素叙事：480×270 画布、镜头制分镜、角色、字幕牌 | “发生了什么、他经历了什么” | `assets/genres/mv` |

MV 不是“像素风的宣传片”，宣传片也不是“加了排版的 MV”。MV 里没有 look / 主题 / 版式 / 引擎；宣传片里没有像素画布、角色与字幕牌。

## 怎么判断

按用户的原话走，信号明确就不要追问：

| 用户说 | 类型 |
|---|---|
| 宣传片、产品片、品牌片、企业宣传、功能讲解、发布会开场、活动预告、动态海报、口播视频、社媒短视频 | `promo` |
| MV、像素动画、像素短片、叙事短片、像这个视频 / 照这个风格做、有角色/剧情/歌词或字幕 | `mv` |
| 只给一句主题，没提形式 | 先问（见下） |
| 拿不准 | 先问，不要猜 |

**必须问的时候，用编辑器的选择器（同一个问题卡片），不要发纯文本让用户回编号。** 两个选项的文案直接写清楚区别：

```jsonc
{
  "question": "这支片属于哪一种？",
  "header": "影片类型",
  "options": [
    { "label": "宣传片", "description": "编辑排版 + look 系统：品牌、卖点、产品、数据；默认 60s，可竖屏 9:16" },
    { "label": "MV", "description": "像素叙事：镜头制分镜、角色、字幕牌，讲一个小故事；16:9，480×270 像素画布；分辨率可选 1080p/4K" }
  ]
}
```

选完再问时长/画幅（MV 固定 16:9，不用问画幅）。`new-film.js` 在不带 `--genre` 且非终端环境时会直接报错，提示先问用户——这是故意的，不要用默认值绕过。

## 对照表

| 维度 | 宣传片 promo | MV mv |
|---|---|---|
| 模板 | `assets/template` | `assets/genres/mv` |
| 画面 | 1920×1080 DOM/CSS/SVG + Canvas 背景引擎 | 480×270 Canvas 像素画，整数放大 ×4 |
| 版式 | 5 主题 × 4 版式 × 15 look | 固定构图语法（镜头制分镜 / 标签 / 字幕牌 / 片尾卡） |
| 主文案 | `js/script.js` 的标题、副题、卡片、字幕 DOM | `js/script.js` 的字幕（绝对秒数）+ `film.js` 的分镜 |
| 字幕 | DOM 字幕条，样式随主题 | `K.plate` 像素字幕牌，画在画布上 |
| 字体 | 主题字体栈，字重/字号自由 | 像素字：标签二值化（阈值 64），字幕牌软边；画布 CJK ≥11px |
| 动效 | 连续运镜 + look motion + 场景推轨 | 逐帧像素动画 + 镜头内运镜；每镜 2–3 秒、每帧都在动 |
| QA | layout / timing / engines / motion / stills / regress | unit / qa-mv / qa-all（画布像素 + 确定性 + 字幕牌 + 片尾） |
| 画幅 | 16:9 或 9:16 | 仅 16:9（480×270） |
| 时长缩放 | 60s 基准，运行时等比缩放 | 分镜按绝对秒数手写；改片长要改 `film.js`，不靠缩放 |
| 素材 | 图片/视频/授权网页抓帧 | 默认全代码绘制；用像素画，不接实拍素材 |
| 旁白 | `npm run voice`，字幕时间轴 | 配乐与旁白都可选；静音成片合法 |

## MV 工程结构

```text
assets/genres/mv/
├── index.html              # data-genre="pixel-story"，只引 styles/mv.css
├── styles/mv.css           # 舞台、画布像素化、字幕层、淡出；无主题/版式
├── js/config.js            # 片名/品牌/标语/kicker/endTag/时长/分辨率/封面
├── js/film.js              # 分镜：一行一拍，镜头字段与段落切换
├── js/script.js            # 字幕（绝对秒数）
├── js/pixel-kit.js         # 像素字、标签、字幕牌、暗角、确定性随机
├── js/actors.js            # 女孩/男孩/路人/箱子/伞
├── js/sets-a..e.js         # 手绘场景库
├── js/sets-gen.js          # 程序化地点原型
├── js/shot.js              # 镜头合成：世界层 → 相机取样 → 角色 → 标签 → 字幕牌
├── js/timeline.js          # 镜头调度、转场、pauseAt / ready
├── tools/qa-mv.js          # 浏览器画布/确定性/字幕牌/片尾体检
├── tools/qa-all.js         # qa-mv + 逐镜 30%/78%/切点抽帧
├── tools/doctor.js         # 环境体检
├── test/unit.test.js       # 镜头制契约单测，不需要浏览器
├── render.js               # 逐帧截图；无 --look/--style/--layout
└── encode.js               # 帧 → MP4；无音频时输出无声片
```

模板自带一支 24 镜 / 60s 的示范片，只是格式样例；建工程后用用户的故事整段替换 `film.js` 与 `script.js`，引擎层不动。

## MV 的硬语法

### 画布与输出

- 画布永远 480×270，`imageSmoothingEnabled = false`，CSS `image-rendering: pixelated`。
- 1080p = ×4（1920×1080），4K = ×8（3840×2160）；由 `config.renderScale` 或 `render.js --scale` 决定，**不要**改 `config.width/height`。
- 分辨率建工程前必须问用户，`new-film.js --genre mv` 缺少 `--resolution` 会报错。
- 竖屏不是缩放：需要重写 270×480 的场景与构图。`new-film.js` 会拒绝 `--vertical`，不要绕。

### 像素字

| 用途 | 规则 |
|---|---|
| 画布中文 | ≥ 11px；低于 11px 在 480×270 上会糊成一团 |
| 标签 `K.tag` | 13px、字重 700；必须画在 `K.vignette()` **之后** |
| 字幕牌 `K.plate` | 12px 软边字，位于 y=232、高 26px 的底部安全区 |
| 片尾卡 | 主标 28px / 副标 14px / 标签 13px / 注脚 11px |
| 字形 | 标签/HUD 先按字体渲染，再用 `cut = 64` 二值化；字幕牌保留灰度，阈值不可随手改 |
| 片头/片尾标签 | `config.kicker` / `config.endTag`，ASCII，可留空 |

### 图层顺序

```text
背景（天空/地面/远景）
  → 中景（建筑/家具/道具）
  → 角色（主角、路人）
  → 前景（窗框/桌面边缘）
  → 暗角 K.vignette()
  → 标签 K.tag() / HUD K.hud()
  → 字幕牌 K.plate()
```

`K.tag` / `K.hud` 必须在 `K.vignette()` 之后：暗角是一层 Bayer 遮罩，画在后面会把标签像素吃掉。

### 时间与确定性

- 每个镜头只依赖自己的 `local` 时间与 `shot.v`；不读 `Date.now()`，不用 `Math.random()`。
- 需要随机时走 `K.rnd(seed)`，同一 seed 永远同一结果。
- 段落转场只由 `SECTIONS` 决定：主歌溶解、副歌硬切、桥段/尾声慢溶。
- qa-mv 会在同一时刻渲染两次并逐像素比对，还会检查 +0.45s 后画面必须变化。

### 字幕

- 用绝对秒数：`{ start, end, text }`；每条 6–18 个汉字、≤7 字/秒、不重叠。
- 字幕是独立图层，可跨切点；但换拍就换句。
- 字幕牌覆盖 y=232–258：人物脚底 ≤222、行李 ≤234，否则会被压住。
- `PIXEL_QA.plate` 暴露当前字幕文本与透明度，qa-mv 逐条核对。

### 片尾卡

- 最后 1.2s 前必须完成：`PIXEL_QA.endCard` 为真。
- 片尾字段来自 `config.title / slogan / kicker / endTag / disclaimer`。
- 封面 `posterAt` 是分镜绝对秒数；60s 模板不做换算。

## 建工程与 CLI

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
node "$SKILL/scripts/new-film.js" ./my-mv \
  --genre mv \
  --resolution 1080p \
  --title "夜航" \
  --brief "夜航，像素叙事，怀旧" \
  --brand NIGHTFLIGHT \
  --brand-sub "像素叙事 / PIXEL STORY" \
  --slogan "把夜，拼成一条航线"
```

- `--resolution 1080p|4k` 必填，写进 `config.renderScale`；render.js 默认读取它。
- `--title / --brand / --brand-sub / --slogan / --disclaimer` 写进 `config.js`，片头/片尾都从配置读。
- MV 拒绝 `--look` / `--style` / `--layout` / `--vertical`，会说明原因。
- MV 固定 60s 分镜；改片长要改 `film.js`，不能用 `--duration` 缩放（会把每镜压到 2 秒以下）。
- 目标目录非空会拒绝；确认覆盖时加 `--force`。

## 改内容

1. `js/film.js`：按用户故事重写 `LINES`。一行一拍、行内等分、每镜 2–3 秒、最后一镜 `end: true`。场景只用已有的 `S.<name>` 或 `GEN.<name>`。
2. `js/script.js`：重写字幕。绝对秒数、单一叙事视角、每条 6–18 字。
3. `js/config.js`：片名/品牌/标语/`kicker`/`endTag`/封面时间；`genre` 保持 `pixel-story`，`look/style/layout` 保持 `none`。
4. `index.html`：只在新增/删除脚本文件时改引用顺序（film → shot → timeline）。

文案规则：

- 字幕每条 6–18 字、≤7 字/秒；不跨拍讲完一整段。
- 画面里不塞散文；镜头信息靠构图、动作、道具与光线表达。
- 60s 约 20–28 镜；每镜都要有动作，不能有静帧。
- 同一场景可以重复出现，但必须换 `v` 派生不同构图；不能出现同一张画面。

## QA 与渲染

```bash
npm test           # 镜头制契约：连续覆盖、2–3 秒、唯一 v、字幕、确定性、图层隔离
npm run qa         # qa-mv → 逐镜 30%/78%/切点抽帧
npm run qa:mv      # 只跑浏览器体检（qa/mv/*.png + qa/mv.json）
npm run stills     # 13 个代表帧抽到 stills/
node render.js --at 1.2,26.2,58.7
node render.js --scale 1 && node encode.js     # 1080p 审片
node render.js --scale 2 && node encode.js     # 4K（仅当用户明确要求）
npm run music                                   # 可选；不生成则 encode 输出无声片
```

- `qa-mv` 检查：每镜 45% 画布 ≥8 色、≥12% 非背景、无平滑插值；同刻两次渲染一致；+0.45s 后画面变化；每条字幕牌 alpha ≥0.5；片尾卡完成。任一失败都会退出 1。
- `qa:regress` 在 MV 里是“qa-mv 不抽帧重跑”，不是 SSIM 基线比对。
- `render.js` 没有 look/style/layout 参数；`--resume` 会校验分辨率、帧率、时间范围、格式一致。
- 配乐默认 chiptune（`npm run music`），也可静音；旁白可选，像素 MV 通常只留配乐或纯声。

## 常见错误

| 症状 | 原因 | 修法 |
|---|---|---|
| 整帧近黑 | 主体颜色与背景太接近 / 场景本身太暗 | 换场景或换站位；抽 45% 帧验证 |
| 人物被字幕牌切脚 | 人物 `y > 222` | 上移到 222；行李 234 |
| 只露出一个头 | 室内镜头的坐标尺度与角色不匹配 | 这类镜头用空镜 + 雨/灯做情绪，不硬塞角色 |
| 标牌文字反写 | `variant.flip` 整幅镜像 | 关 flip 或去掉画面文字 |
| 特写糊成色块 | `zoom > 2.6` | 降到 2.6 以内或换更近的场景原型 |
| 标签缺一块/被咬掉 | `K.tag` 画在 `K.vignette` 之前 | 把暗角移到标签之前 |
| 中文糊成噪点 | 字号 <11px、字幕牌被改回二值化、或改了 alpha 阈值 | 恢复 ≥11px；标签用 `cut = 64`，字幕牌保持软边 |
| 两次渲染不一致 | 用了 `Math.random()` / `Date.now()` | 改 `K.rnd(seed)` 与 `local` |
| 镜头内没变化 | 纯 `hold` 且没有环境动画 | 加雨/雾/灯闪/人物呼吸，或换运镜 |
| 70% 后仍有残影 | 元素退场没退干净 | 退场到 `opacity 0` 或被下一层完全遮挡 |
| 画布被拉伸 | 改了 `config.width/height` 或非整数缩放 | 保持 480×270 + 整数倍 |
| 竖屏报错 | `--vertical` 被拒 | MV 竖屏要重新写 270×480 场景，不能靠参数 |

## 从参考片学到的是什么

参考片只能学**方法**：像素字阈值、HUD/标签常驻、镜头切换节奏、字幕牌安全区、每镜一个明确动作。不要复制参考片的角色、台词、画面与音乐；参考片只做私有分析，不随 Skill 分发。

如果用户给的是“像这个视频”的第三方链接：先确认授权与用途，只提取结构性手法（构图、节奏、字体层级），不下载、不搬运、不再分发素材。
