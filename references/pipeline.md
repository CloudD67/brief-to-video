# 管线与交付手册

## 1. 架构

```
brief
  → js/config.js（片名/画幅/时长/封面/look/brief/素材）
  → js/looks.js（look = 主题 + 版式 + 动效；auto 按 brief 关键词计分）
  → js/style.js（?style= / ?look= / ?layout= → data-style/data-look/data-layout）
  → js/script.js（全片文案与字幕，60s 基准）
  → index.html + js/scenes/*.js（时间轴与画面）
  → timeline.js（按 duration/60 等比缩放 + 运镜/切点 + 字幕 cue 解析 + 素材序列）
  → styles/tokens.css + styles/themes/*.css（5 套语义令牌）
  → styles/layouts.css + styles/portrait.css（4 版式 / 9:16 重排）
  → js/engines.js（确定性 Canvas 氛围层：8 个引擎，种子 + 时间函数）
  → styles/engines.css（引擎层混合与素材调色）
  → js/media.js（场景素材清单、预载、Ken Burns 进度）
  → server.js（本地静态服务，仅 render/preview 时启动）
  → Chrome + Puppeteer（window.pauseAt(t) 逐帧截图）
  → frames/0000.png …（PNG 序列）
  → synth-music.js（纯 Node 合成 assets/music.wav）
  → voiceover.js（macOS say 按字幕时间轴合成 assets/voiceover.wav）
  → encode.js（FFmpeg：H.264 + AAC + 侧链闪避 + 响度报告）
  → out/final.mp4 + out/poster.png
  → tools/qa-*.js（静态 / 版式 / 节奏 / 引擎 / 运动连续性 / SSIM 回归 / 抽帧）
```

核心流程全部离线：不下载素材、不调用云服务；可选外部输入只有用户素材、用户自有/授权页面的抓帧、本地品牌字体和 macOS 系统语音。

当前为 3.0.0：**先七问定向，再扩写，最后才分镜**——第 1 问用选择器定类型（宣传片 / MV），每类各 6 问，答案落进 `direction.json`，建工程时 `--intake` 预填进 `treatment.md` 方向锁，写稿不得与之矛盾（见 `intake.md`）；**扩写先于分镜，但宣传片与 MV 写两套稿**——宣传片按 `brief-expansion.md` 写 `treatment.md`（方向锁/世界/人物/序列/≥30 候选镜/≥4 色域，不设字数），MV 按 `mv-craft.md` §0 写更厚的 `treatment.md`（方向锁/背景/人物与关系/母题/故事弧/歌词段/≥32 候选镜删到 20–28/mood ≥3 档，不设字数），两种内容不互换；宣传片默认**空白起步**、每支片现场写（`--demo` 才复制七场示例工程）。硬件/实体产品走**世界语法**（`hardware-promo-grammar.md`：多空间、多色域、屏幕 ≤30%，`js/product-kit.js` 提供真实空间里的电脑/桌面道具），软件/AI/平台类产品片走**真屏语法**（全出血真实界面 + `screen-kit` 零件库 + 间幕卡/胶囊字幕时序 + 桌面拼贴结尾，见 `product-film-grammar.md`）。规则不再只写在文档里：`check-treatment.js` 查 treatment 结构配额，`check-project.js` 查 `config.grammar` / `config.shots` 分镜契约（空间数、屏幕占比、微距/人迹、相邻镜重复），MV `test/unit.test.js` 查 20–28 镜/2–3 秒/四段歌词/mood 分布，`tools/gate.js` 把它们串成交付门禁（`--pre` 写作门禁、全门禁再叠 `repair --strict`）。15 个 look、8 个确定性视觉引擎、用户选择器式审美选择、全片连续运镜、运动连续性 + 色彩分布 QA、真实素材抓帧、SSIM 视觉回归、交付前自检修复（`npm run repair`）与 GitHub Actions CI；MV 为原生 1920×1080 层叠剪纸叙事模板（纸层场景、镜头制分镜、画布底部歌词、歌曲/歌词接入、确定性 QA + 同款 repair，默认 1080p、4K 矢量重画）。第三方设计方法的来源与许可见根目录 `ATTRIBUTIONS.md`；设计 DNA 的可实现版本见 `references/design-dna.md`。

## 2. 环境要求

- Node.js ≥ 18（用到 `fs.cpSync`、`node:vm`、现代语法）。
- npm 可安装依赖。
- 系统 Chrome / Chromium / Edge 任选其一：
  - macOS：`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
  - Linux：`/usr/bin/google-chrome` 或 `/usr/bin/chromium`
  - 其他位置：`CHROME_PATH=/path/to/chrome` 或 `node render.js --chrome ...`
- FFmpeg 由 `@ffmpeg-installer/ffmpeg` 提供，无需系统安装。
- `qa-stills.js` / `grab.js` 在 macOS 上用 `sips` 缩图；其他平台保留原尺寸 JPG。

安装：

```bash
npm install --no-audit --no-fund
```

若 npm 提示 `@ffmpeg-installer/darwin-arm64` 的 postinstall 被 `allow-scripts` 拦截，不影响使用：`encode.js` 会在运行时补 `chmod 755`。仍失败时手动：

```bash
chmod +x node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg
```

## 3. 工程结构

```
my-film/
├── index.html              舞台、字幕容器、5 个主题 <link>、脚本加载顺序
├── server.js               本地静态服务器
├── render.js               Puppeteer 逐帧渲染 / 抽帧 / 续渲 / --style
├── encode.js               FFmpeg 编码、混音、响度报告
├── synth-music.js          纯 Node 配乐合成
├── package.json
├── js/
│   ├── config.js           单一配置源（浏览器 + Node 共用）
│   ├── looks.js            15 个 look、版式/动效表、推荐排序
│   ├── style.js            视觉选择（?look= / ?style= > config）
│   ├── script.js           全片剧本：字幕 + 各场景文案（60s 基准）
│   ├── utils.js            U：clamp/lerp/inv/随机/缩略图
│   ├── easing.js           E：缓动函数（smooth/outCubic/inOutCubic/outExpo/backOut）
│   ├── fonts.js            可选品牌字体加载
│   ├── scene-kit.js        kit：页眉/插画/遮罩/规格表/素材缩略图
│   ├── product-kit.js      硬件产品套件：三层空间/窗光/浮尘/铝壳键帽/开合光扫
│   ├── screen-kit.js       真屏零件库：窗口/终端/看板/卡片/间幕卡/拼贴
│   ├── engines.js          8 个 Canvas 视觉引擎（种子 PRNG + 时间函数）
│   ├── subtitle.js         烧录字幕轨（tcFps 可配）
│   ├── timeline.js         场景调度、cue 解析、播放、seek、素材序列
│   ├── media.js            素材清单合并/预载、场景级轮换
│   ├── media.generated.js  视频抽帧清单（prep-media 生成物，默认空）
│   └── scenes/s0.js        空白起步占位场景；故事与分镜写完后按场拆成 scenes/*.js（--demo 才有 s0…s6 七场示例）
├── styles/
│   ├── tokens.css          语义令牌（默认 = letterpress）
│   ├── themes/             5 个主题：letterpress/swiss/cinema/quiet/tech
│   ├── base.css            舞台、纸张、字幕、黑边
│   ├── components.css      页眉/标题/卡片/面板/素材框
│   ├── layouts.css         4 个版式骨架（editorial/poster/grid/split）
│   ├── portrait.css        9:16 重排
│   ├── engines.css         引擎层混合与素材调色
│   ├── product.css         硬件产品套件（空间/材质/屏幕/道具）
│   └── scenes.css          各场景专用布局
├── tools/
│   ├── doctor.js           环境体检（Node/依赖/Chrome/ffmpeg/磁盘/主题）
│   ├── check-treatment.js  treatment 结构验收（方向锁/空间/序列/候选镜/色域）
│   ├── check-project.js    静态检查 + config.grammar / config.shots 分镜契约
│   ├── gate.js             写作门禁（--pre）与交付门禁（叠 repair --strict）
│   ├── pick-look.js        按 brief 排序推荐 look（--list/--json/--root）
│   ├── look-gallery.js     15 个 look × N 帧样片墙
│   ├── contact-sheet.js    带标签的 15-look 总览图
│   ├── voiceover.js        macOS say → 按字幕时间轴合成旁白 WAV
│   ├── prep-media.js       图片/视频 → 场景素材清单（视频自动抽帧）
│   ├── capture-web.js      自有/授权网页 → 场景素材帧（滚动/光标/点击）
│   ├── qa-all.js           一条命令跑完 check → layout → timing → engines → stills
│   ├── qa-layout.js        版式体检（出框/裁切/字幕碰撞）
│   ├── qa-timing.js        节奏探针（占位符/残影/字幕/空帧）
│   ├── qa-engines.js       引擎体检（绑定/层序/复现/有变化/无报错）
│   ├── qa-motion.js        成片运动连续性（静态帧/帧差/静止段/切点）
│   ├── qa-regress.js       SSIM 视觉回归（对比 qa/baseline/）
│   ├── qa-stills.js        切点/中点/收尾/封面抽帧
│   ├── style-gallery.js    按主题批量出静帧
│   └── grab.js             从成片回抽帧
├── test/unit.test.js       Node 单元测试（look/config/剧本/CLI）
├── .github/workflows/qa.yml CI：test + check + 引擎/版式/节奏
├── assets/music.wav        合成配乐（生成物）
├── assets/voiceover.wav    旁白（生成物）
├── assets/media/           用户素材（可选）
├── frames/                 渲染帧（生成物）
├── out/                    final.mp4 / video.mp4 / poster.png
├── stills/                 手动抽帧（生成物）
└── qa/                     QA 抽帧、layout/timing/engines.json、baseline/（生成物）
```

## 4. 配置源

`js/config.js` 是唯一真相，浏览器与 Node 都读它：

| 字段 | 说明 |
|---|---|
| `title` | 片名，用于片头/片尾/日志 |
| `brand` | 页眉品牌字，建议全大写 |
| `brandSub` | 页眉副标 |
| `slogan` | 片尾标语 |
| `disclaimer` | 右下角免责声明 |
| `look` | `auto` 或 15 个 look id；决定主题+版式+动效 |
| `brief` | 一句话需求；`auto` 选 look 的输入 |
| `style` | 单独覆盖主题：`auto` / `letterpress` / `swiss` / `cinema` / `quiet` / `tech` |
| `layout` | 单独覆盖版式：`auto` / `editorial` / `poster` / `grid` / `split` |
| `width/height` | 画布尺寸；1920×1080 或 1080×1920（其他尺寸会告警） |
| `duration` | 总时长（秒）；场景与字幕按 60s 基准自动等比缩放 |
| `fps` | 帧率，默认 30 |
| `tcFps` | 时间码帧率基准，默认 24（装饰用，与 `fps` 独立） |
| `posterAt` | 封面帧的 60s 基准时间；输出时按 `duration/60` 缩放 |
| `mediaFrames` | 场景 id → 图片路径数组；替代内置插画 |
| `fontUrl` | 可选 woff2 路径；空字符串表示用系统字体 |
| `fontFamily` | 品牌字体族名 |

改 `duration` 不需要动场景与字幕；改 `look`/`style` 不需要动场景代码。`title` 变化时 `new-film.js` 会同步改 `index.html`，手改 config 时也顺手改一下 `<title>`。画布只支持 1920×1080 与 1080×1920 两套坐标系；需要更小体积时用 `render.js --scale`，不要改 `width/height`。

## 5. 命令与参数

### 5.1 建工程

```bash
# 七问答案先写进 direction.json（见 references/intake.md）
node "$HOME/.qoder/skills/brief-to-video/scripts/new-film.js" ./my-film \
  --intake direction.json \
  --title "北岸咖啡" \
  --brand "NORTH BANK" \
  --brand-sub "城市烘焙 / SINCE 2019" \
  --slogan "把清晨，烘进一杯里"

node "$HOME/.qoder/skills/brief-to-video/scripts/new-film.js" ./vertical \
  --intake direction-vertical.json --title "山野来信"

node "$HOME/.qoder/skills/brief-to-video/scripts/new-film.js" ./launch \
  --intake direction-launch.json --title "2.0 发布"

# 只用于研究契约：复制老的七场编辑排版示例
node "$HOME/.qoder/skills/brief-to-video/scripts/new-film.js" ./demo \
  --intake direction-demo.json --demo --title "七场示例"

# MV：固定 60s 分镜，工程里会生成 MV 专用的 treatment.md
node "$HOME/.qoder/skills/brief-to-video/scripts/new-film.js" ./my-mv \
  --intake direction-mv.json --title "把灯留着" --brand TIDE HARBOR
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `<target-dir>` | 必填 | 目标目录 |
| `--intake` | 必填 | 七问答案 JSON；非终端缺失会报错。见 `references/intake.md` |
| `--intake-template` | — | `promo` / `mv`：打印空白骨架后退出 |
| `--genre` | 从 intake 读 | `promo` / `mv`；与 intake 冲突会报错。TTY 无 intake 时询问 |
| `--demo` | 否 | 仅 promo：复制七场编辑排版示例（`assets/demo-editorial`），不是默认骨架 |
| `--brief` | 从七问拼 | 一句话需求；auto 选 look 的输入 |
| `--look` | 从 intake 读 | 15 个 look id；七问第 5 问选定，`auto` 仅在用户授权时 |
| `--layout` | 跟随 look | 强制 `editorial` / `poster` / `grid` / `split` |
| `--style` | 跟随 look | 强制 `letterpress` / `swiss` / `cinema` / `quiet` / `tech` |
| `--vertical` | 从 intake 读 | 竖屏 9:16（= `--size 1080x1920`）；与 intake `format` 冲突会报错 |
| `--title` | 模板片名 | 同时改 config 与 `<title>` |
| `--brand` / `--brand-sub` | 模板 | 页眉 |
| `--slogan` | 模板 | 片尾 |
| `--duration` | 从 intake 读 | 场景/字幕按 60s 基准自动缩放；与 intake `format` 冲突会报错 |
| `--width` / `--height` | 从 intake 读 | 画幅；只接受 1920×1080 / 1080×1920 |
| `--poster-at` | duration − 1.7 | 成片中的封面秒数（内部换算为 60s 基准） |
| `--no-install` | 安装 | 跳过 npm install |
| `--force` | 否 | 允许写入非空目录（谨慎） |

创建时整目录复制模板：promo 默认复制**空白起步**（单个 0–60s 占位场景），`--demo` 才复制七场示例；`tools/` 里自带 `doctor.js`、`check-treatment.js`、`check-project.js`、`gate.js`、`qa-all.js`、`qa-stills.js`、`qa-layout.js`、`qa-timing.js`、`qa-engines.js`、`qa-motion.js`、`qa-regress.js`、`contact-sheet.js`、`grab.js`、`style-gallery.js`、`pick-look.js`、`look-gallery.js`、`voiceover.js`、`prep-media.js`、`capture-web.js`，以及 `test/unit.test.js`。七问答案会写成工程根目录的 `direction.json`，并预填进 `treatment.md` 的方向锁；两种 treatment 的其余骨架（promo：世界/序列/候选镜/色域表；MV：背景/人物与关系/母题/故事弧/歌词段/候选镜/mood 表）仍需写透。建完会打印选中的 look 及主题/版式/动效/引擎（MV 打印剪纸叙事与分辨率），并提示先写 treatment 再写分镜。

### 5.2 渲染 `render.js`

```bash
node render.js                       # 默认 --scale 1 → 1920×1080 全片
node render.js --scale 2             # 3840×2160 全片（仅用户明确要求 4K 时）
node render.js --look swiss-grid     # 指定 look（主题+版式+动效）
node render.js --look auto --brief "咖啡店，日常温暖" --style quiet
node render.js --layout split        # 只换版式，保留 look 的主题/动效
node render.js --style cinema        # 只换主题
node render.js --from 0 --to 12      # 只渲前 12 秒
node render.js --at 1.5,33,58.3      # 抽帧到 stills/
node render.js --format jpg --at 58.3
node render.js --resume              # 跳过已存在且参数一致的帧
node render.js --chrome /path/to/chrome --headed
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--scale` | 2 | 设备像素比；2 = 4K，1 = 1080p |
| `--look` | config.look（默认 auto） | 15 个 look id 或 `auto`；开渲前校验 |
| `--layout` | 跟随 look | 单独覆盖版式 `editorial` / `poster` / `grid` / `split` |
| `--style` | 跟随 look | 单独覆盖主题；开渲前校验 `styles/themes/<name>.css` 是否存在 |
| `--brief` | config.brief | 覆盖 brief 文本，供 `--look auto` 计分 |
| `--fps` | config.fps | 与 config.fps 不一致时会警告（encode 默认按 config.fps，需同时传 `--fps`） |
| `--from` / `--to` | 0 / duration | 时间段（秒） |
| `--format` | png | `png` / `jpg` |
| `--at` | — | 逗号分隔秒数，抽帧模式 |
| `--out` | `frames/` / `stills/` | 输出目录 |
| `--resume` | 否 | 断点续渲；参数（含 look/layout/style）不一致会报错 |
| `--chrome` | 自动探测 | Chrome 路径 |
| `--port` | 0 | 本地服务端口，0 = 随机 |
| `--headed` | 否 | 显示浏览器（调试） |
| `--quiet` | 否 | 只输出错误 |

行为细节：

- 启动本地静态服务器，打开 `index.html?render=1&look=<id>&style=<theme>&layout=<name>`。
- 等待 `window.__READY`、字体、主题、素材预载（`__mediaReady`）；然后 `pauseAt(t)`，截图。
- 帧名 `0000.png` 连续编号；`--at` 模式命名为 `still_<秒>.jpg`。
- 全片渲染结束时额外输出 `out/poster.png`（4K 为 4K 封面）；封面时刻 = `posterAt × duration/60`，并夹在片长内。
- 4K 与 1080p 使用同一布局，仅 deviceScaleFactor 不同；不要写分辨率分支。
- 日志会打印 `风格`、`Look`（自动时附 confidence 与命中词）与版式/动效。
- `--resume` 的 manifest 记录 style/look/layout，「已有帧 + 本次」任一参数不一致就报错，避免混主题的帧进同一条成片。
- 开渲前按 `分辨率 × 剩余帧数 × 8.5MB（PNG）/1.5MB（JPG）` 估算磁盘；可用 < 预估 60% 直接失败，< 130% 警告。`--resume` 只算缺失帧。

### 5.3 编码 `encode.js`

```bash
node encode.js
node encode.js --proxy
node encode.js --music assets/music.wav --music-gain 0.55 --crf 18 --preset medium
node encode.js --voice assets/voiceover.wav --voice-gain 1.0
node encode.js --no-voice            # 只混音乐（旁白文件保留但不进片）
node encode.js --no-duck             # 旁白出现时不压低音乐
node encode.js --muted
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--fps` | config.fps | 输入帧率 |
| `--crf` | 18 | x264 质量，越小越清晰、越大文件越大 |
| `--preset` | medium | ultrafast…veryslow |
| `--frames` | `frames/` | 帧目录 |
| `--out` | `out/` | 输出目录 |
| `--music` | `assets/music.wav` | 不存在则输出无声 |
| `--music-gain` | 有旁白 0.40 / 无旁白 0.55 | 音乐作底；显式传入时以传入值为准 |
| `--voice` | `assets/voiceover.wav` | 存在且 >1KB 时自动启用 |
| `--voice-gain` | 1.0 | 旁白增益；削波时 encode 会报响度警告 |
| `--no-voice` | 否 | 忽略旁白 |
| `--no-duck` | 否 | 关闭侧链闪避 |
| `--muted` | 否 | 强制无声（音乐+旁白都忽略） |
| `--proxy` | 否 | 额外输出 1080p 代理 |

编码规格：

- 视频：libx264、yuv420p、bt709、`-movflags +faststart`。
- 音频：AAC 192k、48kHz、立体声；`atrim` 对齐视频时长；2s 淡入淡出（短于 8s 时自动缩短）。音乐与旁白都先 `aformat=channel_layouts=stereo` 再混，避免 `sidechaincompress` 因声道不一致失败。
- 混音：有旁白时音乐默认降到 0.40，并走 `sidechaincompress`（threshold 0.05 / ratio 6 / attack 25ms / release 400ms）闪避；最后 `amix normalize=0`，不二次衰减。
- 帧连续性检查：缺帧直接报错，提示 `--resume`。
- **响度报告**：编码后跑 `volumedetect`，打印 mean/max 音量；出现削波、过轻（< −32dB mean）、过响（> −14dB mean）时警告，按提示调 `--music-gain` / `--voice-gain`。
- 输出：`out/video.mp4`（无音轨）、`out/final.mp4`（含音乐/旁白）、可选 `out/final_1080p.mp4`。

### 5.4 配乐 `synth-music.js`

```bash
node synth-music.js
node synth-music.js --duration 30 --mood warm --bpm 92
node synth-music.js --mood tense --cuts 5,12,20,27
node synth-music.js --help
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--duration` | config.duration | 秒 |
| `--bpm` | 100 | 节拍 |
| `--mood` | calm | `calm` / `warm` / `tense` |
| `--cuts` | 切点比例 × 时长 | 转场音效落点，逗号分隔秒数 |
| `--pulse-from` / `--pulse-to` | 第一个 cut / duration−5 | 脉冲区间 |
| `--out` | `assets/music.wav` | 输出 |

纯 Node 合成：drone + 和弦垫 + 脉冲 + bass + arp + 转场 SFX，tanh 限幅，16-bit 立体声。60s 约 11MB。参数错误会直接报错并给用法，不会静默回退。改场景切点后应同步 `--cuts`。

### 5.4b 旁白 `voiceover.js`（macOS）

```bash
node tools/voiceover.js .                    # 按字幕时间轴合成 assets/voiceover.wav
node tools/voiceover.js . --dry-run          # 只打印每条 cue 的起止与时长，不发声
node tools/voiceover.js . --list-voices      # 查看系统可用中文语音
node tools/voiceover.js . --voice Tingting --rate 175
node tools/voiceover.js . --gain 0.9 --only 1,3,5
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `<project-dir>` | 必填 | 工程目录 |
| `--voice` | 系统默认中文 | `say -v` 的语音名 |
| `--rate` | 180 | 语速（词/分） |
| `--gain` | 1.0 | 合成后增益 |
| `--out` | `assets/voiceover.wav` | 输出 WAV（48kHz 单声道 PCM） |
| `--json` | 同目录 `voiceover.json` | 每条 cue 的实际时长/溢出报告 |
| `--only` | 全部 | 只处理指定句序号（1 起，逗号分隔） |
| `--dry-run` | 否 | 只估算，不调用 `say` |

文本优先级：`cue.narration > cue.text`。每条 cue 单独 `say` → ffmpeg 去静音 → 48k 单声道 PCM，再按 cue 起点混进全长音轨；峰值超过 0.98 时自动衰减到 0.95 并在日志说明。**旁白超槽位先改文本**，不要盲目提速。生成后直接 `node encode.js` 即可，encode 会自动启用旁白与闪避。

### 5.4c 素材 `prep-media.js`

```bash
mkdir -p assets/media
cp alley.jpg assets/media/s1-alley.jpg
cp store.mp4 assets/media/s4-store.mp4
node tools/prep-media.js .                    # 扫描 → 抽帧 → js/media.generated.js
node tools/prep-media.js . --dry-run          # 只打印将写入的清单
node tools/prep-media.js . --fps 2 --max-frames 6 --width 1600
```

- 图片直接登记；视频用 ffmpeg 抽帧到 `assets/media/frames/<basename>/frame_%03d.jpg`。
- 文件名以场景 id 开头：`s1-alley.jpg` / `scene1-alley.jpg` / `01-alley.jpg`；也接受镜头编号 `1-...` 和通配 `*`。
- 生成 `js/media.generated.js`（`window.FILM_MEDIA`），与 `config.mediaFrames` 合并；场景键优先 `场景 id` → `镜头编号` → `*`。
- 一个场景多张图会按片内进度轮换，Ken Burns 由 `--scene-p` 驱动，暂停/逐帧渲染完全一致。

### 5.4d 网页抓帧 `capture-web.js`

产品/软件界面优先用真实页面，而不是插画。抓帧工具用 Chrome 打开页面，按固定帧率输出 JPEG 序列：

```bash
node tools/capture-web.js --url http://localhost:5173 --scene s4 --seconds 6 --fps 12
node tools/capture-web.js --url https://your.site --scene s2 --seconds 4 --size 1440x900 \
  --scroll 0,900 --cursor "320,420;980,520" --click ".run-button" --wait 1500
npm run media && npm run check
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--url` | 必填 | 页面地址；**必须是你拥有或已获授权录制的页面** |
| `--scene` | 必填 | 场景 id（`s1`…），决定文件名前缀 |
| `--seconds` / `--fps` | 6 / 12 | 录制时长与采样帧率；建议 12–30fps |
| `--size` | 1920x1080 | 视口尺寸 |
| `--scroll a,b` | 不滚 | 从 a 滚到 b（px），smoothstep 缓入缓出 |
| `--cursor "x,y;x,y"` | 不画 | 合成光标路径，逐帧移动 |
| `--click <selector>` | — | 加载后先点击一次（展开菜单等） |
| `--wait <ms>` | 1200 | 加载后等待时间 |
| `--out` | `assets/media` | 输出目录 |
| `--chrome` / `--headed` | 自动探测 / 否 | Chrome 路径与可视化调试 |

- 产物：`assets/media/<scene>-cap-0001.jpg …` + `<scene>-cap.json`（录制参数与来源）。
- 注入 `cursor: none` 与固定 SVG 光标，滚动/光标位移都用时间函数，逐帧可复现。
- 抓帧按场景 id 命名，`npm run media` 后自动进素材清单，并继承 look 的调色与 Ken Burns。
- **权利边界**：只抓用户自有或已明确授权的页面；不抓竞品/第三方站点，不绕过登录、付费墙或访问限制。抓帧属于用户素材，交付说明里要写明来源与授权。

### 5.5 检查与 QA

```bash
npm run doctor         # = node tools/doctor.js .（环境体检，渲染前先跑）
npm test               # = node --test test/unit.test.js（look/config/剧本/CLI）
npm run check:treatment # = node tools/check-treatment.js .（treatment 结构）
npm run check          # = node tools/check-project.js .（含 grammar/shots 分镜契约）
npm run gate:pre       # = node tools/gate.js . --pre（treatment + check/单测）
npm run gate           # = node tools/gate.js .（交付门禁：再叠 repair --strict）
npm run qa             # = node tools/qa-all.js . → check → layout → timing → engines → stills
npm run qa:layout      # = node tools/qa-layout.js . → qa/layout.json
npm run qa:timing      # = node tools/qa-timing.js . → qa/timing.json
npm run qa:engines     # = node tools/qa-engines.js . → qa/engines.json
npm run qa:motion      # = node tools/qa-motion.js out/final.mp4 → qa/motion.json
npm run qa:variety     # = node tools/qa-variety.js out/final.mp4 → qa/variety.json
npm run repair         # = node tools/repair.js . → qa/repair.json + qa/repair/stills/
npm run qa:regress     # = node tools/qa-regress.js . → SSIM 对比 qa/baseline/
npm run qa:stills      # = node tools/qa-stills.js . → qa/stills/
npm run styles         # = node tools/style-gallery.js .
npm run look "数据平台发布，仪表盘"   # = node tools/pick-look.js
npm run looks          # = node tools/pick-look.js --list
npm run look:gallery   # = node tools/look-gallery.js . → qa/looks/
npm run media          # = node tools/prep-media.js .
npm run voice          # = node tools/voiceover.js .
node tools/qa-all.js . --look swiss-grid               # 指定 look 跑全套
node tools/qa-all.js . --style cinema --layout poster  # 组合覆盖
node tools/qa-engines.js . --looks ink-poster,tech-split
node tools/qa-regress.js . --update                    # 重建基线（改版后有意为之）
node tools/contact-sheet.js . --at 29.2 --out qa/contact-sheet.jpg
node tools/look-gallery.js . --looks ink-poster,tech-split --at 6,26,47
node tools/style-gallery.js . --themes quiet
node tools/grab.js out/final.mp4 3.0 15.0 27.0
```

`doctor.js` 检查 Node ≥ 18、`node_modules`/`puppeteer-core`、Chrome 可执行、ffmpeg（installer → ffmpeg-static → PATH）、工程写入权限、磁盘空间、主题是否齐全、配乐是否存在、以及 `looks.js` / `media.js` / `voiceover.js` / `prep-media.js` 是否齐备。4K 按 8.5MB/帧估算（实测 PNG 约 8MB/帧），可用空间 < 预估 60% 直接失败，< 130% 警告。`--style` 可指定要检查的主题，`--json` 输出报告。

`qa-all.js` 是内容体检的总入口：先跑静态检查（失败即停），再依次跑版式、节奏、引擎、抽帧，汇总写入 `qa/summary.json`。`--look` / `--style` / `--layout` 透传给四步浏览器体检；`--skip-stills` 跳过抽帧；`--scale` 透传。单步失败不影响后续步骤，最后统一汇总报错。

`qa-engines.js` 逐个 look 检查引擎层：`looks.js` 有绑定、页面只挂一层引擎、位于 `.bg` 内且透明度合理、当前时刻确实画出了像素、同一时刻两次渲染一致、不同时刻有变化、页面无报错。`--looks` 只测指定 look，`--json` 写报告；默认写 `qa/engines.json`。它验证的是「引擎在不在、动不动、稳不稳」，审美仍靠抽帧目检。

`qa-motion.js` 用 ffmpeg 逐帧帧差（`tblend=all_mode=difference` + `signalstats`）统计静态帧占比、均值/p50/p90、最长静止段与切点。静态帧 >50% 或均值 <0.4 报错，>25% 或 <0.6 警告，静止段 ≥1.2s 警告；报告写 `qa/motion.json`。它只量运动量，不判断运动是否好看；参考片（30fps）约 7% 静态、均值 2.96，模板实测 1% 静态、均值 0.81、无长静止段（印刷图形天然低于实拍；实拍/科技 look 应到 1.5 以上）。

`qa-variety.js` 每秒抽一帧压到 32×18，转 HSV 后按 12 个色相加中性色归档，输出色域时间线、主色域占比、色域数（≥8% 占比）、明暗跨度与饱和度中位，报告写 `qa/variety.json`。主色域 >60%、色域 <3、明暗跨度 <0.10、饱和度中位 <0.10 会警告——这是「画面单一、颜色单一」的机器判据。

`repair.js` 是交付前自检闸门：新鲜度（源文件/配乐 vs 成片 mtime）→ 容器（时长/分辨率/帧率/音轨）→ 危险时刻抽帧（切点前后、收尾、封面）→ 近空帧与声明时刻触边探针 → 聚合 `qa-motion` / `qa-variety` → 8 项人工清单；报告写 `qa/repair.json`，退出码 errors>0 为 1。MV 版从 `js/film.js` 的 `shots` 采样，清单换成歌词安全区/纸层/主动作/硬切。修完按 `references/repair-loop.md` 循环到 `ok: true`。

`gate.js` 把三件事串成门禁：`check-treatment.js` → `check-project.js`（或 MV `test/unit.test.js`）→ `repair.js --strict`。`--pre` 只跑前两环，用于开渲前；全门禁用于交付前，报告写 `qa/gate.json`，任一环失败退出码为 1。`repair --strict` 会把 quantity/variety 的 WARN 也当失败，所以“警告都看过”不再靠自觉。

`qa-regress.js` 用 FFmpeg SSIM 对比 15 个 look × 2 个时刻（2.4s / 7.6s）与 `qa/baseline/` 基线，低于 0.985 判为回归，diff 图写 `qa/regress-diff/`。首次或有意改版后跑 `--update` 重建基线；基线只存在本地，不入库。静态检查、引擎体检、回归三件套一起，才能在改主题/引擎/版式后知道有没有弄坏别处。

`contact-sheet.js` 对 15 个 look 各出一帧（默认 `0.48 × duration`），拼成带 look id、主题/版式/引擎标签的总览图，默认写 `qa/contact-sheet.jpg`；`--at` / `--cols` / `--tile` / `--out` 可调。用于交付前目检全部方向，或给客户做风格提案。

`pick-look.js` 用 `brief + title + slogan + brandSub` 计分，输出 look、confidence、命中关键词与 3 个备选；`--theme` 约束主题，`--layout` 约束版式，`--json` 给程序读，`--list` 列全部 15 个 look，`--root <dir>` 可在工程外指向模板/工程目录（建工程前的选择器流程用）。计分只用于排序与选择器默认高亮，审美由用户选。

`look-gallery.js` 默认对 15 个 look 各出 12%/42%/78% 三帧到 `qa/looks/<look>/`，并生成 `qa/looks/gallery.html`；`--looks`、`--at`、`--scale` 可调。适合交付前目检所有审美方向。

`check-project.js` 检查：

- config 字段合法、宽高为偶数、`posterAt` 落在 60s 基准内、`look` / `style` / `layout` 指向存在的 look/主题/版式、`tcFps` 合法。
- 分镜契约：`config.grammar` 为 `screen` / `world` / `auto`；非 auto 时 `config.shots` 必须非空且每镜有 `at/dur/space/frame/subject`；world 查空间数（60s ≥4 / 30s ≥3）、屏幕 ≤30%、微距 ≥2、人迹 ≥2；screen 查屏幕 ≥50%；相邻两镜不得同空间 + 同主体 + 同景别。
- look 契约：15 个 look 的主题 CSS、版式、动效都存在；keywords 非空；`styles/layouts.css` 含 `html[data-layout="…"]`、`portrait.css` 存在；`brief` 为空时警告（auto 只能靠片名/标语）。
- 主题契约：`tokens.css` 必须定义全部根令牌（纸/墨/强调/深色/字体/字幕/插画/18 个帧色）；每个非 letterpress 主题必须覆盖 `--paper/--paper-2/--paper-3/--ink/--ink-2/--mute/--faint/--accent/--dark/--on-dark`；必须有 `html[data-style="<name>"]` 选择器；CSS 花括号必须平衡；只覆盖部分帧色会警告。
- WCAG 对比度（每个主题按继承后的有效色计算）：`--ink/--paper ≥ 10`、`--ink-2/--paper-2 ≥ 7`、`--sub-color/--paper ≥ 7`、`--on-dark/--dark ≥ 10`、`--accent/--paper ≥ 3`、`--mute/--paper ≥ 4.5`；不足直接报错。
- 剧本字幕：非空、有序、不重叠、不跨切点、单条时长与阅读速度（≤ 约 7.2 汉字/秒）、场景内 `at/dur` 越界、条间空档 > 3.5s。
- 场景：id 唯一、有 mount/seek、从 0 开始、无缺口/重叠、末场景 end = 60。
- 每个场景在 `FILM_SCRIPT` 里有对应文案节；没有则报错。
- `index.html` 引用 config、looks、style、script、media、全部主题 CSS、layouts/portrait CSS、所有场景、timeline；字幕容器不再手写 `<li>`。
- 素材清单：合并 `media.generated.js` 与 `config.mediaFrames`，键必须是场景 id/镜头编号/`*`，场景必须存在，文件必须存在且为图片；`assets/media/` 有原始素材但清单为空时警告。
- 每个 JS 通过 `node --check`；`style.left/top/...` 无裸数字。
- 颜色字面量：CSS 中 `#hex`/`rgba()` 报错（选择器 `#fade` 例外）；JS 中给警告。
- 占位符：最终可见文本里的 `{...}`、`NaN`、`undefined` 报错；合法注入令牌（`{duration}` 等）不误报。

`qa-layout.js` 每个场景采样 15%/45%/75%/90%（覆盖入场后段与收尾），加上每条字幕中点；量所有叶子文字：出框、祖先裁切、nowrap 溢出、字号过小、字幕碰撞、运行时报错；`[data-decor]` 装饰元素跳过。`--look` / `--style` / `--layout` 会拼进 URL，报告与控制台都会标注 look/主题/版式。

`qa-timing.js` 每个场景采样 6 个位置（15/35/50/70/85/95%）+ 封面，共 43 个采样点，检查：

- 活动场景数量与身份正确（同一时刻只有一个场景在画）。
- 占位符/未解析变量：`—`、`--`、`…`、`NaN`、`undefined`、`{token}`。
- ≥70% 时可见大字的字号与不透明度；元素 opacity < 0.35 且未被遮挡判为残影。
- 字幕：`window.FILM_CUES` 覆盖该时刻则必须有可见字幕，不覆盖则不应有残留。
- 场景尾帧（95%）是否为空、页面是否报错。报告写 `qa/timing.json`。

`qa-stills.js` 自动生成：每个切点前 0.3s、切点、切点后 0.24s、每个场景中点、**82% 收尾帧**、封面帧（`posterAt × duration/60`）；清掉旧 `still_*` 后调用 `render.js --scale 1 --format jpg`；macOS 上缩到 1440px。`--style` 会透传给 render。

`style-gallery.js` 默认对全部 5 个主题各出 12%/42%/78% 三帧到 `qa/styles/<theme>/`；`--themes` 只出指定主题（逗号分隔），`--at` 自定义时刻。

`grab.js` 对成片按时间点逐个抽帧（每个时间点一次 ffmpeg），用于确认编码后的实际画面，避免一次 ffmpeg 多时间点导致的重复帧。

## 6. 渲染耗时与磁盘

实测（MacBook，Chrome，1920×1080 基准）：

| 任务 | 帧数 | 耗时 | 输出 |
|---|---|---|---|
| QA 抽帧 ~33 张 | 33 | ~5s | ~3MB |
| 版式体检 qa:layout | 43 个采样时刻 | ~4–10s | JSON 报告 |
| 节奏探针 qa:timing | 43 个采样时刻 | ~4–10s | JSON 报告 |
| 引擎体检 qa:engines | 15 look × 2 时刻 | ~8s | JSON 报告 |
| 运动连续性 qa:motion | 成片逐帧 | ~2–5s（60s 片） | JSON 报告 |
| SSIM 回归（15 look × 2 帧） | 30 帧 | ~55s | diff 图 + JSON |
| 一条命令 qa（全部） | — | ~25–45s | JSON + 抽帧 |
| 风格 gallery（5 主题 × 3 帧） | 15 | ~10s | ~2MB |
| 1080p 60s | 1800 | ~6–7 分钟 | frames ~3–4GB |
| 4K 60s | 1800 | ~15–25 分钟 | frames ~14–16GB |
| 编码（1080p） | — | ~1 分钟 | final ~9MB |
| 编码（4K） | — | ~3–6 分钟 | final ~40–90MB |
| 配乐 60s | — | ~2s | 11MB |

磁盘紧张时：先 `--scale 1` 审片；4K 渲完编码成功后可用 `npm run clean` 清 frames（保留 out/）。`render.js` 开渲前会按分辨率、帧数、格式估算空间：可用 < 预估 60% 直接失败，< 130% 打印警告；`--resume` 只按剩余帧估算。

## 7. 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| `未找到 Chrome` | 未安装或路径特殊 | 安装 Chrome，或 `CHROME_PATH=...` / `--chrome` |
| `未知风格` / 主题没生效 | `config.style` 或 `--style` 拼错 | `render.js` 开渲前即失败并列出可用主题；`npm run check` / `doctor` 也会报 |
| 主题对比度报错 | 新主题的 `--mute`/`--accent` 太浅或 `--ink` 不够深 | 按报错调令牌；正文 ≥10:1、字幕 ≥7:1、弱化字 ≥4.5:1 |
| 主题改了不生效 | 缺 `html[data-style="<name>"]` 选择器 | 补选择器；`npm run check` 会报 |
| 引擎看不见/不像预期 | look 未绑定、URL 带了 `?engine=none`，或 alpha 太低 | `npm run qa:engines` 看绑定与覆盖率；强度按抽帧目检 |
| 引擎压过标题 | alpha 过高，或深色底用了 `multiply` | 回到默认 alpha（±0.03 以内）；深色主题必须 `screen` |
| 同一时刻两次渲染不一致 | 引擎读了 `Math.random`/`Date.now` | 只用 `rnd(seed)` 与时间 `t`；`qa:engines` 会抓 |
| 视觉回归突然不过 | 基线过期，或真的改坏了别处 | 先看 `qa/regress-diff/`；确认改动是有意的再 `--update` |
| 成片看起来“静/卡” | 场景整段没动、素材单张无 Ken Burns，或导出误用低帧率/重复帧 | 跑 `npm run qa:motion`；静态帧 >50% 或均值 <0.4 必须修 |
| 抓帧页面空白/登录页 | 页面需要登录或渲染太慢 | 用已登录的本地工程/预览页；加 `--wait 2000` 或 `--headed` 排查 |
| 抓帧内容不合适 | 抓了第三方或敏感页面 | 只抓自有/已授权页面；换回代码绘制或用户提供的素材 |
| 渲染前报磁盘不足 | 4K PNG 帧很占空间（约 8MB/帧） | 清理旧 frames/，或 `--scale 1`，或缩短 `--to` |
| 某场景空白 | `mount` 抛错被 timeline 吞掉 | `npm run preview` 开控制台；或 `node render.js --at <秒> --headed` 看报错 |
| 切点第一帧缺页眉 | 入场从 0 开始 | 改为 `U.inv(-0.3, 0.04, t)` |
| 切点闪白过重/下一镜太空 | `FLASH_*` 不合适 | 调 `timeline.js` 的 `FLASH_OUT`（0.08–0.14）与 `FLASH_PEAK`（0.85–0.96） |
| 文字/卡片出框 | 入场位移过大或旋转叠加 | 位移控制在 ±8–90px，留 40px 余量；先跑 `npm run qa:layout` |
| 元素位置不生效 | CSS 裸数字 | 加 `'px'`；跑 `npm run check` |
| 字幕压住正文 | 底部 12% 被占用 | 上移正文，或该段字幕留空 |
| 字幕没出现/错位 | cue 写的是全局秒数或跨切点 | 用 `{scene,at,dur,text}`；跑 `npm run check` 与 `qa:timing` |
| 画面停在 `—` / `NaN` | 计数器起始太晚或条件没兜底 | 70% 前必须落值；`qa:timing` 会指出场景与时刻 |
| 收尾帧有半透明残影 | 元素没退干净也没被遮挡 | 65% 前退到 0，或让后续面板盖住 |
| 换主题后插画看不清 | 新主题没覆盖 `--ill-*` / `--f*` | 补齐 6 组影调与 `--ill-ink/paper/warm` |
| 字体 404 | `fontUrl` 指向不存在的文件 | 设为 `''` 或放入真实 woff2 |
| `--resume` 报参数不一致 | 分辨率/fps/范围/style 变了 | 清空 frames 或换 `--out` |
| 缺帧报错 | 渲染中断/删帧 | `node render.js --resume` 补齐 |
| ffmpeg EACCES | 安装脚本未 chmod | `chmod +x node_modules/@ffmpeg-installer/*/ffmpeg` |
| 音乐盖过人声 | gain 太高 / 未开闪避 | 用默认 `--music-gain 0.40` 与侧链；看 encode 的响度报告 |
| 旁白没进成片 | 文件不存在/过小，或误加 `--no-voice` | 看 encode 日志的音轨说明；先跑 `npm run voice`，确认 `assets/voiceover.wav` >1KB |
| 旁白被截断/溢出 | 文本超过 cue 槽位 | 看 `voiceover.json` 的溢出报告，先改短文本，再考虑小幅提速 |
| 旁白削波 | `--voice-gain` 太大或 TTS 本身过响 | voiceover 会自动压到 0.95 峰值；仍警告时降 `--voice-gain` |
| `No channel layout for input 1` | 音乐/旁白声道不一致 | 保持模板的 `aformat=channel_layouts=stereo`，不要删 |
| 素材不显示 | 未跑 `npm run media` / 文件名不匹配场景 id | `npm run check` 会报；清单键支持 `s1`、`1`、`*` |
| 竖屏文字压画面 | 画布不是 1080×1920 | 用 `--vertical` 建工程；`check` 对非标准画布告警 |
| auto 选的 look 不对 | `brief` 为空或关键词不命中 | 补 `config.brief`，或 `node tools/pick-look.js "…"` 后 `--look` 指定 |
| 响度警告“过轻/削波” | 合成音轨电平不合适 | 按报告调 `--music-gain` / `--voice-gain`，或重跑 synth-music |
| 4K 渲染内存不足 | 同时开太多应用 | 关掉其他 Chrome/应用；分段 `--from/--to` + `--resume` |
| 时长不对 | 场景里写了成片秒数或 `C.duration` | 场景/字幕统一用 60s 基准，末场景 `end: 60`；只改 config.duration |

## 8. 交付规格

默认交付（1080p；只有用户这次明确要 4K 才交 3840×2160）：

- `out/final.mp4`：H.264 High、yuv420p、bt709、30fps、1920×1080 / 1080×1920（4K 按需 3840×2160）、AAC 192k 48kHz 立体声、faststart。
- `out/poster.png`：与成片同分辨率的封面帧。
- `qa/`：切点/中点/收尾抽帧 + `layout.json` / `timing.json` / `motion.json` / `variety.json` / `repair.json`，供快速复核；多 look 提案时附 `qa/looks/`。
- `treatment.md`：扩写底稿，随工程保留，不设字数、越详细越好。宣传片版是方向锁/世界/序列/候选镜/色域；MV 版是方向锁/背景/人物与关系/母题/故事弧/歌词段/候选镜/mood，两者不能互换。
- 工程目录：可改文案/换 look/换素材/重渲。

**交付闸门**：`npm run gate` 必须通过（treatment + check/单测 + `repair --strict`，`qa/gate.json` 为绿）；`qa/repair.json` 的 8 项清单逐条确认；repair 抽帧的四角看过；`out/final.mp4` 的 mtime 晚于所有源文件与音频。任一条不满足就不算交付。

交付说明模板：

```
成片：/abs/path/out/final.mp4
规格：1920×1080 · 30fps · 60.00s · H.264 / AAC · 约 18MB（4K 按需）
Look：cinema-editorial（用户选择）· cinema / editorial / cinematic
画幅：16:9（或 9:16）
封面：/abs/path/out/poster.png
工程：/abs/path/my-film（npm run preview 可预览，S 主题 / L 版式 / K look）
扩写：treatment.md（宣传片：6 空间 / 10 序列 / 30 候选镜 / 4 色域；MV：背景 / 人物与关系 / 母题 / 4 段歌词 / 32 候选镜 → 24 镜 / 3 mood）
素材：assets/media/（可选）· 抓帧来源与授权：…（可选）
旁白：assets/voiceover.wav（可选）
运动：qa:motion 通过（静态帧 1% · 帧差均值 0.8 · 无 ≥1.2s 静止段）
色彩：qa:variety（主色域 ≤60% · 色域 ≥3 · 明暗跨度 ≥0.10）
交付自检：npm run gate 通过（gate:pre 写作门禁 + repair --strict 交付门禁；qa/gate.json 各环 ok）
QA：npm test / check / qa（含引擎）/ qa:regress / qa:motion / qa:variety 全通过；grab 回抽帧已核对（MV 以 test + qa-mv 为准）
音乐：本地合成；旁白：macOS say；均无外部版权素材
```

MV 交付把 `Look` 行换成 `叙事：paper-story · 24 镜 · mood 3 档 · 歌词 16 条`，不写 look/主题/版式；`qa/` 以 qa-mv 报告与逐镜抽帧为准。

## 9. 边界与限制

- 画布支持 16:9（1920×1080）与 9:16（1080×1920）两套坐标系；其他比例不做保证，非标准尺寸 `check` 会告警。
- 主题/look 只换表现与骨架，不改变场景里的文案结构；需要全新构图时在 `layouts.css` 增版式或新写场景。
- 画面主体仍是排版 + SVG 插画 + 伪 UI + Canvas 氛围引擎（网点/双色叠印/散景/尘埃/极光/流线/扫描/轨道）；真实照片/视频通过 `assets/media/` 接入，但不做抠像、跟踪、3D、粒子模拟。
- 网页抓帧只适用于用户自有或已明确授权的页面；不提供第三方站点采集、登录绕过或反爬规避。交付时需注明素材来源与授权。
- 引擎是确定性背景层：同一时刻永远同一帧，但不能替代构图；遮住引擎画面就散，说明版式没做完。
- 视觉回归基线（`qa/baseline/`）只存在本地；换机器或改版后先目检抽帧，再用 `qa-regress --update` 重建基线。
- 旁白依赖 macOS `say`；Linux/Windows 需要自己生成 `assets/voiceover.wav` 或用 `--voice` 指向现成音轨。
- 配乐是程序合成，适合做底；需要真实乐器/歌曲时替换 `assets/music.wav` 即可。
- 4K 渲染时间较长，务必先 1080p 审片。
