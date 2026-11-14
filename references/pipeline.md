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
  → js/media.js（场景素材清单、预载、Ken Burns 进度）
  → server.js（本地静态服务，仅 render/preview 时启动）
  → Chrome + Puppeteer（window.pauseAt(t) 逐帧截图）
  → frames/0000.png …（PNG 序列）
  → synth-music.js（纯 Node 合成 assets/music.wav）
  → voiceover.js（macOS say 按字幕时间轴合成 assets/voiceover.wav）
  → encode.js（FFmpeg：H.264 + AAC + 侧链闪避 + 响度报告）
  → out/final.mp4 + out/poster.png
```

全部离线：不下载素材、不调用云服务；可选的外部输入只有本地品牌字体、用户素材和 macOS 系统语音。

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
│   ├── looks.js            12 个 look、版式/动效表、自动选择
│   ├── style.js            视觉选择（?look= / ?style= > config）
│   ├── script.js           全片剧本：字幕 + 各场景文案（60s 基准）
│   ├── utils.js            U：clamp/lerp/inv/随机/缩略图
│   ├── easing.js           E：缓动函数
│   ├── fonts.js            可选品牌字体加载
│   ├── scene-kit.js        kit：页眉/插画/遮罩/规格表/素材缩略图
│   ├── subtitle.js         烧录字幕轨（tcFps 可配）
│   ├── timeline.js         场景调度、cue 解析、播放、seek、素材序列
│   ├── media.js            素材清单合并/预载、场景级轮换
│   ├── media.generated.js  视频抽帧清单（prep-media 生成物，默认空）
│   └── scenes/s0…s6.js     七个场景
├── styles/
│   ├── tokens.css          语义令牌（默认 = letterpress）
│   ├── themes/             5 个主题：letterpress/swiss/cinema/quiet/tech
│   ├── base.css            舞台、纸张、字幕、黑边
│   ├── components.css      页眉/标题/卡片/面板/素材框
│   ├── layouts.css         4 个版式骨架（editorial/poster/grid/split）
│   ├── portrait.css        9:16 重排
│   └── scenes.css          各场景专用布局
├── tools/
│   ├── doctor.js           环境体检（Node/依赖/Chrome/ffmpeg/磁盘/主题）
│   ├── check-project.js    静态检查（look/版式/主题契约/对比度/剧本/素材）
│   ├── pick-look.js        按 brief 推荐 look（--list/--json）
│   ├── look-gallery.js     12 个 look × N 帧样片墙
│   ├── voiceover.js        macOS say → 按字幕时间轴合成旁白 WAV
│   ├── prep-media.js       图片/视频 → 场景素材清单（视频自动抽帧）
│   ├── qa-all.js           一条命令跑完 check → layout → timing → stills
│   ├── qa-layout.js        版式体检（出框/裁切/字幕碰撞）
│   ├── qa-timing.js        节奏探针（占位符/残影/字幕/空帧）
│   ├── qa-stills.js        切点/中点/收尾/封面抽帧
│   ├── style-gallery.js    按主题批量出静帧
│   └── grab.js             从成片回抽帧
├── assets/music.wav        合成配乐（生成物）
├── assets/voiceover.wav    旁白（生成物）
├── assets/media/           用户素材（可选）
├── frames/                 渲染帧（生成物）
├── out/                    final.mp4 / video.mp4 / poster.png
├── stills/                 手动抽帧（生成物）
└── qa/                     QA 抽帧、layout.json、timing.json、looks/（生成物）
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
| `look` | `auto` 或 12 个 look id；决定主题+版式+动效 |
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
node "$HOME/.qoder/skills/brief-to-video/scripts/new-film.js" ./my-film \
  --title "北岸咖啡" --brief "咖啡店，日常温暖，生活方式" \
  --brand "NORTH BANK" \
  --brand-sub "城市烘焙 / SINCE 2019" \
  --slogan "把清晨，烘进一杯里" \
  --duration 60

node "$HOME/.qoder/skills/brief-to-video/scripts/new-film.js" ./vertical \
  --title "山野来信" --vertical --brief "民宿，自然疗愈"

node "$HOME/.qoder/skills/brief-to-video/scripts/new-film.js" ./launch \
  --title "2.0 发布" --look swiss-split
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `<target-dir>` | 必填 | 目标目录 |
| `--brief` | 空 | 一句话需求；auto 选 look 的输入 |
| `--look` | auto | 12 个 look id；指定后不再自动选择 |
| `--layout` | 跟随 look | 强制 `editorial` / `poster` / `grid` / `split` |
| `--style` | 跟随 look | 强制 `letterpress` / `swiss` / `cinema` / `quiet` / `tech` |
| `--vertical` | 横屏 | 竖屏 9:16（= `--size 1080x1920`） |
| `--title` | 模板片名 | 同时改 config 与 `<title>` |
| `--brand` / `--brand-sub` | 模板 | 页眉 |
| `--slogan` | 模板 | 片尾 |
| `--duration` | 60 | 场景/字幕按 60s 基准自动缩放 |
| `--width` / `--height` | 1920 / 1080 | 画幅；只接受 1920×1080 / 1080×1920 |
| `--poster-at` | duration − 1.7 | 成片中的封面秒数（内部换算为 60s 基准） |
| `--no-install` | 安装 | 跳过 npm install |
| `--force` | 否 | 允许写入非空目录（谨慎） |

创建时整目录复制模板，`tools/` 里自带 `doctor.js`、`qa-all.js`、`check-project.js`、`qa-stills.js`、`qa-layout.js`、`qa-timing.js`、`grab.js`、`style-gallery.js`、`pick-look.js`、`look-gallery.js`、`voiceover.js`、`prep-media.js`。建完会打印选中的 look 及主题/版式/动效。

### 5.2 渲染 `render.js`

```bash
node render.js                       # 默认 --scale 2 → 3840×2160 全片
node render.js --scale 1             # 1920×1080 全片
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
| `--look` | config.look（默认 auto） | 12 个 look id 或 `auto`；开渲前校验 |
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

### 5.5 检查与 QA

```bash
npm run doctor         # = node tools/doctor.js .（环境体检，渲染前先跑）
npm run check          # = node tools/check-project.js .
npm run qa             # = node tools/qa-all.js . → check → layout → timing → stills
npm run qa:layout      # = node tools/qa-layout.js . → qa/layout.json
npm run qa:timing      # = node tools/qa-timing.js . → qa/timing.json
npm run qa:stills      # = node tools/qa-stills.js . → qa/stills/
npm run styles         # = node tools/style-gallery.js .
npm run look "数据平台发布，仪表盘"   # = node tools/pick-look.js
npm run looks          # = node tools/pick-look.js --list
npm run look:gallery   # = node tools/look-gallery.js . → qa/looks/
npm run media          # = node tools/prep-media.js .
npm run voice          # = node tools/voiceover.js .
node tools/qa-all.js . --look swiss-grid               # 指定 look 跑全套
node tools/qa-all.js . --style cinema --layout poster  # 组合覆盖
node tools/look-gallery.js . --looks ink-poster,tech-split --at 6,26,47
node tools/style-gallery.js . --themes quiet
node tools/grab.js out/final.mp4 3.0 15.0 27.0
```

`doctor.js` 检查 Node ≥ 18、`node_modules`/`puppeteer-core`、Chrome 可执行、ffmpeg（installer → ffmpeg-static → PATH）、工程写入权限、磁盘空间、主题是否齐全、配乐是否存在、以及 `looks.js` / `media.js` / `voiceover.js` / `prep-media.js` 是否齐备。4K 按 8.5MB/帧估算（实测 PNG 约 8MB/帧），可用空间 < 预估 60% 直接失败，< 130% 警告。`--style` 可指定要检查的主题，`--json` 输出报告。

`qa-all.js` 是内容体检的总入口：先跑静态检查（失败即停），再依次跑版式、节奏、抽帧，汇总写入 `qa/summary.json`。`--look` / `--style` / `--layout` 透传给三步浏览器体检；`--skip-stills` 跳过抽帧；`--scale` 透传。单步失败不影响后续步骤，最后统一汇总报错。

`pick-look.js` 用 `brief + title + slogan + brandSub` 计分，输出 look、confidence、命中关键词与 3 个备选；`--theme` 约束主题，`--layout` 约束版式，`--json` 给程序读，`--list` 列全部 12 个 look。

`look-gallery.js` 默认对 12 个 look 各出 12%/42%/78% 三帧到 `qa/looks/<look>/`，并生成 `qa/looks/gallery.html`；`--looks`、`--at`、`--scale` 可调。适合交付前目检所有审美方向。

`check-project.js` 检查：

- config 字段合法、宽高为偶数、`posterAt` 落在 60s 基准内、`look` / `style` / `layout` 指向存在的 look/主题/版式、`tcFps` 合法。
- look 契约：12 个 look 的主题 CSS、版式、动效都存在；keywords 非空；`styles/layouts.css` 含 `html[data-layout="…"]`、`portrait.css` 存在；`brief` 为空时警告（auto 只能靠片名/标语）。
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
| 一条命令 qa（全部） | — | ~20–40s | JSON + 抽帧 |
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

默认交付：

- `out/final.mp4`：H.264 High、yuv420p、bt709、30fps、1920×1080 / 1080×1920 / 3840×2160、AAC 192k 48kHz 立体声、faststart。
- `out/poster.png`：与成片同分辨率的封面帧。
- `qa/`：切点/中点/收尾抽帧 + `layout.json` / `timing.json`，供快速复核；多 look 提案时附 `qa/looks/`。
- 工程目录：可改文案/换 look/换素材/重渲。

交付说明模板：

```
成片：/abs/path/out/final.mp4
规格：3840×2160 · 30fps · 60.00s · H.264 / AAC · 约 78MB
Look：cinema-editorial（自动 · high）· cinema / editorial / cinematic
画幅：16:9（或 9:16）
封面：/abs/path/out/poster.png
工程：/abs/path/my-film（npm run preview 可预览，S 主题 / L 版式 / K look）
素材：assets/media/（可选）· 旁白：assets/voiceover.wav（可选）
QA：check / qa:layout / qa:timing / qa 全通过；grab 回抽帧已核对
音乐：本地合成；旁白：macOS say；均无外部版权素材
```

## 9. 边界与限制

- 画布支持 16:9（1920×1080）与 9:16（1080×1920）两套坐标系；其他比例不做保证，非标准尺寸 `check` 会告警。
- 主题/look 只换表现与骨架，不改变场景里的文案结构；需要全新构图时在 `layouts.css` 增版式或新写场景。
- 画面主体仍是排版 + SVG 插画 + 伪 UI；真实照片/视频通过 `assets/media/` 接入，但不做抠像、跟踪、3D、粒子。
- 旁白依赖 macOS `say`；Linux/Windows 需要自己生成 `assets/voiceover.wav` 或用 `--voice` 指向现成音轨。
- 配乐是程序合成，适合做底；需要真实乐器/歌曲时替换 `assets/music.wav` 即可。
- 4K 渲染时间较长，务必先 1080p 审片。
