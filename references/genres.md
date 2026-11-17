# 两种类型：宣传片（promo）与 MV（paper-story）

这是 Skill 的第一道分叉。两种类型是两套**独立的视觉语法**：模板、CLI、QA、字体规则都不共用。混用不会得到“结合两者优点”，只会同时毁掉两边——所以每次建工程前先定类型，再往下走。

## 一句话区分

| 类型 | 语法 | 回答的问题 | 模板 |
|---|---|---|---|
| 宣传片 `promo` | 编辑排版：主题 + 版式 + look + 品牌信息；故事与分镜每支片现场写 | “它是什么、凭什么、为什么选它” | `assets/template`（空白起步） |
| MV `mv` | 层叠剪纸叙事：原生 1920×1080 纸层、镜头制分镜、角色、底部歌词 | “发生了什么、他经历了什么” | `assets/genres/mv` |

MV 不是“剪纸风的宣传片”，宣传片也不是“加了排版的 MV”。MV 里没有 look / 主题 / 版式 / 引擎；宣传片里没有纸层场景、角色与画布歌词。

**扩写逻辑也分两套**：宣传片按 `brief-expansion.md` 扩世界、序列、候选镜与色域（30 候选镜删到 20–30）；MV 按 `mv-craft.md` §0 写一份更厚的稿子——方向锁、背景、人物与关系、母题、故事弧、歌词段、镜头候选与 mood（先写 ≥32 候选镜再删到 20–28，mood ≥3 档）。两边都不设字数，写得越详细越好。两种 `treatment.md` 不能互换——宣传片的 6 空间/4 色域表搬进 MV 会毁掉剪纸叙事，MV 的人物小传与歌词段表也撑不起产品片的世界。

宣传片模板是**空白起步**：只有一个 0–60s 的占位标题卡，主角、拍数、场景与画面都按这一支片的 brief 现场写，和 MV 一样不套固定骨架。`new-film.js --demo` 才复制老的七场编辑排版示例（`assets/demo-editorial`），只用于研究场景契约、组件与 QA 写法，不是默认起点。

宣传片里有两条不共用的产品片子路，按主体分：

- **软件/AI/平台** → **真屏语法**：全出血真实界面、屏幕长镜、1.93s 间幕卡、画面内字幕；工程仍是 `assets/template`，用 `js/screen-kit.js` 搭界面，`motion: 'locked'`。方法见 `product-film-grammar.md`。参考片只借技术，配色/字标/CTA 按当次品牌重定。
- **硬件/实体产品（含餐饮、城市、生活方式）** → **世界语法**：产品在真实空间与光里，多空间、多色域、材质微距与人手痕迹；屏幕类镜头 ≤30%。方法见 `hardware-promo-grammar.md`。把实体产品拍成一块屏幕，就是“演示了一个功能”的根源。

宣传片的两条子路都先过 `brief-expansion.md` 的 treatment 配额（≥4 色域、主色域 ≤60%、亮度跨度 ≥0.10），不得混用。

## 怎么判断

按用户的原话走，信号明确就不要追问：

| 用户说 | 类型 |
|---|---|
| 宣传片、产品片、品牌片、企业宣传、功能讲解、发布会开场、活动预告、动态海报、口播视频、社媒短视频 | `promo` |
| MV、叙事短片、故事短片、像这个视频 / 照这个风格做、有角色/剧情/歌词或字幕 | `mv` |
| 只给一句主题，没提形式 | 先问（见下） |
| 拿不准 | 先问，不要猜 |

**必须问的时候，用编辑器的选择器（同一个问题卡片），不要发纯文本让用户回编号。** 两个选项的文案直接写清楚区别：

```jsonc
{
  "question": "这支片属于哪一种？",
  "header": "影片类型",
  "options": [
    { "label": "宣传片", "description": "编辑排版 + look 系统：品牌、卖点、产品、数据；默认 60s，可竖屏 9:16" },
    { "label": "MV", "description": "层叠剪纸叙事：镜头制分镜、角色与底部歌词，讲一个小故事；16:9，原生 1920×1080，默认 1080p，4K 可选" }
  ]
}
```

选完类型只是第 1 问。每个类型还要各问 6 问（主角/声音、观众/人物、记忆点/欲望、气质/结局、禁忌、交付/情绪走向），七问之后先回述再追问细节。完整问题库、选项 id、追问边界与 `direction.json` 格式见 `intake.md`。`new-film.js` 在非终端环境没有 `--intake` 时会直接报错，提示先问完七问——这是故意的，不要用默认值绕过。

## 对照表

| 维度 | 宣传片 promo | MV mv |
|---|---|---|
| 模板 | `assets/template`（空白起步；`--demo` 才是七场示例） | `assets/genres/mv` |
| 画面 | 1920×1080 DOM/CSS/SVG + Canvas 背景引擎 | 原生 1920×1080 Canvas 矢量剪纸：纸边高光 + 柔和投影 + 纸纹 |
| 版式 | 5 主题 × 4 版式 × 15 look；故事与场景每支片现场写 | 固定构图语法（场景库 / 分镜 / 歌词 / 片头片尾卡） |
| 主文案 | `js/script.js` 的标题、副题、卡片、字幕 DOM | `js/script.js` 的歌词（绝对秒数）+ `film.js` 的分镜 |
| 字幕 | DOM 字幕条，样式随主题 | `K.lyric` 画在画布底部；DOM `#subs` 只做预览 |
| 字体 | 主题字体栈，字重/字号自由 | 系统中文字体（PingFang/思源），片头小标用 ASCII 加字距 |
| 动效 | 连续运镜 + look motion + 场景推轨 | 固定机位硬切；浪/雨/火光/雾/船/呼吸在动，每镜 2–3 秒 |
| QA | layout / timing / engines / motion / stills / regress | unit / qa-mv / qa-all（原生画布 + 确定性 + 歌词 + 片尾） |
| 画幅 | 16:9 或 9:16 | 仅 16:9（原生 1920×1080） |
| 分辨率 | 默认 1080p；4K 仅在用户明确要求时 | **默认 1080p**；4K = renderScale 2 矢量重画 |
| 时长缩放 | 60s 基准，运行时等比缩放 | 分镜按绝对秒数手写；改片长要改 `film.js`，不靠缩放 |
| 素材 | 图片/视频/授权网页抓帧 | 默认全代码绘制，不接实拍素材 |
| 音频 | 旁白 `npm run voice` + 配乐 | 合成配乐，或 `npm run song` 接入用户歌曲；静音成片合法 |

## MV 工程结构

```text
assets/genres/mv/
├── index.html              # data-genre="paper-story"，只引 styles/mv.css
├── styles/mv.css           # 舞台、矢量画布、预览字幕层、淡出；无主题/版式
├── js/config.js            # 片名/品牌/标语/kicker/endTag/分辨率/封面；?scale= 覆盖
├── js/film.js              # 分镜：24 镜，场景/情绪/景别/角色/道具
├── js/script.js            # 歌词（绝对秒数；可用 tools/song.js 生成）
├── js/paper-kit.js         # 纸、天空、海、城镇、灯塔、雨、雾、歌词、确定性随机
├── js/paper-figures.js     # 剪影/背面/半身像/手/泪/轮廓光
├── js/paper-sets.js        # 9 个场景：harbor/pier/portrait/tower/lamp/flame/sea/window/end
├── js/shot.js              # 镜头合成：场景 → 纸纹 → 暗角 → 片头片尾卡 → 歌词
├── js/timeline.js          # 单画布调度、硬切、pauseAt / ready
├── tools/song.js           # 歌曲转码 + LRC/txt 歌词 → js/script.js
├── tools/qa-mv.js          # 浏览器：原生画布/歌词/确定性/推进/片尾体检
├── tools/qa-all.js         # qa-mv + 逐镜 30%/78%/切点抽帧
├── tools/doctor.js         # 环境体检
├── test/unit.test.js       # 分镜契约单测，不需要浏览器
├── render.js               # 逐帧截图；--scale 决定设备像素比
└── encode.js               # 帧 → MP4；无音频时输出无声片
```

模板自带一支 24 镜 / 60s 的示范片，只是格式样例；建工程后用用户的故事整段替换 `film.js` 与 `script.js`，引擎层不动。

## MV 的硬语法

### 画布与输出

- 原生画布 **1920×1080**：场景坐标、纸层、字形都按它写，不缩不放。
- 1080p 是默认交付（`renderScale: 1`）；4K = `renderScale: 2` / `render.js --scale 2`，画布后备改成 3840×2160，**矢量按 2 倍设备像素重画**，不是位图放大。
- `?scale=` 会在脚本加载前覆盖 `renderScale`，只给渲染/QA 用；不要在场景里读 `devicePixelRatio` 做布局。
- 竖屏不是缩放：需要重写 1080×1920 的场景与构图。`new-film.js` 会拒绝 `--vertical`，不要绕。
- `config.width/height` 永远保持 1920×1080；改尺寸会让所有场景坐标失效。

### 纸层

```text
天空 K.sky()
  → 远景海 K.ocean()
  → 城镇 K.town()（先画连续岸线，再画楼）
  → 中景海 / 码头 / 灯塔
  → 人物（剪影或 K.paper 纸人）
  → 前景浪 / 雾 / 雨
  → 纸纹 K.grain() → 暗角 K.vignette()
  → 片头/片尾卡 → 底部歌词 K.lyric()
```

- 每块纸必须走 `K.paper(fill, { edge, dy, blur })`：顶部亮边是裁口，下方柔投影是层距。没有边的形状会像矢量图。
- 颜色只从 `K.pal(mood)` 的 `dusk / night / storm / dawn` 四档里取；一帧纸层不超过 6 层。
- 灯室暖光是全片唯一高饱和色；别让别的光源抢。

### 时间与确定性

- 每个镜头只依赖自己的 `local` 时间与 `shot.v`；不读 `Date.now()`，不用 `Math.random()`。
- 需要随机时走 `K.rnd(seed)`，同一 seed 永远同一结果。
- 镜头之间只有硬切；淡入淡出由样式层统一处理，场景里不要再写。
- qa-mv 会在同一时刻渲染两次并逐像素比对，还会检查 +0.45s 后画面必须变化。

### 歌词

- 用绝对秒数：`{ start, end, text }`；每条 8–16 字、≤7 字/秒、不重叠、不越界。
- 歌词是独立图层，可跨切点；但换拍就换句。
- 歌词画在画布底部安全区；主体（人物脚底、船）不要压进歌词带。
- `PAPER_QA.lyric` 暴露当前歌词文本与透明度，qa-mv 逐条核对；`K.cueAt` 用分镜绝对时间查表。

### 片尾卡

- 最后 1.2s 前必须完成：`PAPER_QA.endCard` 为真，且 `__SHOT_INDEX` 停在最后一镜。
- 片尾字段来自 `config.title / slogan / kicker / endTag / disclaimer`。
- 封面 `posterAt` 是分镜绝对秒数；60s 模板不做换算。

### 歌曲接入

```bash
npm run song -- --audio ~/Music/tide.mp3 --lyrics ~/Music/tide.lrc
```

- 音频用 ffmpeg 转成 `assets/music.wav`；encode 自动混入，短于片长会循环。
- LRC 用 `[mm:ss.xx]` 时间码；纯文本按行均分，`--dry-run` 先看时间轴。
- 工具只写 `assets/music.wav` 与 `js/script.js`；**分镜仍要按歌词重排 `film.js`**。

## 建工程与 CLI

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
# 七问答案先写进 direction.json；建工程时传 --intake
node "$SKILL/scripts/new-film.js" ./my-mv \
  --intake direction.json \
  --title "把灯留着" \
  --brand TIDE HARBOR \
  --brand-sub "潮汐港 / TIDE HARBOR" \
  --slogan "灯亮着，就有人回来"
```

- 分辨率默认 1080p，`--resolution 4k` 才写 `renderScale: 2`；render.js 默认读取它。
- 七问第 2 问选「成品歌 + 歌词」时，建完先跑 `npm run song -- --audio … --lyrics …`，再按歌词重排 `film.js`。
- `--title / --brand / --brand-sub / --slogan / --disclaimer` 写进 `config.js`，片头/片尾都从配置读。
- MV 拒绝 `--look` / `--style` / `--layout` / `--vertical`，会说明原因。
- MV 固定 60s 分镜；改片长要改 `film.js`，不能用 `--duration` 缩放（会把每镜压到 2 秒以下）。
- 目标目录非空会拒绝；确认覆盖时加 `--force`。

## 改内容

1. `js/film.js`：按用户故事重写 `SHOTS`。每镜 2–3 秒、只发生一个动作、最后一镜 `end: true` 且 `s: 'end'`。场景只用已有的 `S.<name>`。
2. `js/script.js`：重写歌词；有成品歌时用 `npm run song` 导入 LRC，再按句重排分镜。
3. `js/config.js`：片名/品牌/标语/`kicker`/`endTag`/封面时间；`genre` 保持 `paper-story`，`look/style/layout` 保持 `none`。
4. `index.html`：只在新增/删除脚本文件时改引用顺序（paper-kit → paper-sets → film → shot → timeline）。

文案规则：

- 歌词每条 8–16 字、≤7 字/秒；一句只讲一件事。
- 画面里不塞散文；镜头信息靠构图、动作、道具与光线表达。
- 60s 约 20–28 镜；每镜都要有动作，不能有静帧。
- 同一场景可以重复出现，但必须换 `v` 派生不同构图；不能出现同一张画面。

## QA 与渲染

```bash
npm test           # 分镜契约：连续覆盖、2–3 秒、唯一 v、歌词、确定性、图层隔离
npm run qa         # qa-mv → 逐镜 30%/78%/切点抽帧
npm run qa:mv      # 只跑浏览器体检（qa/mv/*.png + qa/mv.json）
npm run stills     # 13 个代表帧抽到 stills/
node render.js --at 1.2,26.2,58.7
node render.js --scale 1 && node encode.js     # 1080p 审片（默认）
node render.js --scale 2 && node encode.js     # 4K（仅当用户明确要求）
npm run music                                   # 可选；不生成则 encode 输出无声片
```

- `qa-mv` 检查：画布后备 = 1920×scale × 1080×scale；每镜 45% 帧 ≥24 色、≥12% 有内容；同刻两次渲染一致；+0.45s 后画面变化；每条歌词文字一致且 alpha ≥0.5；片尾卡完成。任一失败都会退出 1。
- `qa:regress` 在 MV 里是“qa-mv 不抽帧重跑”，不是 SSIM 基线比对。
- `render.js` 没有 look/style/layout 参数；`--resume` 会校验分辨率、帧率、时间范围、格式一致。
- 配乐默认合成（`npm run music`），也可用用户歌曲（`npm run song`）或静音；旁白可选。

## 常见错误

| 症状 | 原因 | 修法 |
|---|---|---|
| 楼群底下/楼间漏海 | 城镇没有连续地基 | `K.town` 先画一条连续岸线，高度盖住后排下压量 |
| 浪右缘是一条竖直墙 | 浪尾直接 `lineTo(x, H)` | 两段 bezier 把浪尾收进画面底边 |
| 浪花浮空/排成直线 | 浪花没沿浪脊采样 | 沿实际 crest 路径采样，加抬升与相位抖动 |
| 窗雾像肥皂泡网格 | 用规则圆点铺满 | evenodd 整面薄雾 + 径向羽化擦痕 + 小簇霜花 |
| 手印是一圈亮环 | 画了完整圆弧 | 只留一段宽擦痕 + 一条细反光，不闭合 |
| 脸上有划痕状亮线 | 轮廓光沿错误轮廓画长弧 | 轮廓光只贴头发/肩线，短、分段、低 alpha |
| 泪是一条白色小棍 | 泪滴画成长条 | 一颗小水滴（圆 + 短尾），高光只点一下 |
| 整帧近黑 | 主体颜色与背景太接近 / 场景太暗 | 换场景或换站位；抽 45% 帧验证 |
| 人物像贴纸浮在纸上 | 没有投影/纸边 | 人物也走 `K.paper`，投影方向与场景一致 |
| 两次渲染不一致 | 用了 `Math.random()` / `Date.now()` | 改 `K.rnd(seed)` 与 `local` |
| 镜头内没变化 | 场景没有任何 live 层 | 加浪/雨/火光/雾/船晃/呼吸 |
| 画布被拉伸 | 改了 `config.width/height` 或把 4K 当放大 | 保持 1920×1080 + renderScale |
| 竖屏报错 | `--vertical` 被拒 | MV 竖屏要重写 1080×1920 场景，不能靠参数 |

## 从参考片学到的是什么

参考片只能学**方法**：分层构图、纸色搭配、镜头切换节奏、歌词安全区、每镜一个明确动作。不要复制参考片的角色、台词、画面与音乐；参考片只做私有分析，不随 Skill 分发。

如果用户给的是“像这个视频”的第三方链接：先确认授权与用途，只提取结构性手法（构图、节奏、字体层级），不下载、不搬运、不再分发素材。
