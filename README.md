# brief-to-video

一句话需求 → 一条可交付成片。先分类型：**宣传片（promo）**、**MV（mv）** 或 **3D 短剧（story）**；三套视觉语法独立，绝不混用。

确定性 HTML/CSS/JS 时间轴 → Puppeteer 逐帧渲染 → FFmpeg 编码 4K/1080p。全程离线，不调用云服务；画面默认由代码绘制，可选接入真实图片/视频与 macOS 中文旁白/多角色配音。

## 三种类型

| 类型 | 语法 | 输出 | 模板 |
|---|---|---|---|
| 宣传片 `promo` | 主题 + 版式 + 15 个 look + 确定性背景引擎；故事与分镜每支片现场写 | 16:9 / 9:16，60s 默认 | `assets/template`（空白起步） |
| MV `mv` | 原生 1920×1080 层叠剪纸画布 + 镜头制分镜（每镜 2–3 秒）+ 剪纸角色与 9 场景库 + 画布底部歌词 | 16:9，60s 默认，1080p 默认、4K 可选 | `assets/genres/mv` |
| 3D 短剧 `story` | 原生 1920×1080 横屏 Three.js 布景（previs）/ 可选 Blender CG 引擎（真实 HDRI/PBR/体积/粒子/景深、程序化角色与口型）+ 绝对秒数分镜（每镜 2–4 秒）+ 多角色对白配音 + 片尾钩子 | 16:9，40/60/90s，只做 1080p 横屏 | `assets/genres/story` |

- **宣传片**回答“它是什么、凭什么、为什么选它”：品牌信息、卖点、产品、数据。可选真实素材、授权网页抓帧、旁白、SSIM 回归。
- **MV** 回答“发生了什么、他经历了什么”：故事弧 + 分镜表先确认，再写 20–28 镜（每镜 2–3 秒）、画布底部歌词与片尾卡。纸边高光 + 柔和投影 + 纸纹的剪纸语言，固定机位硬切，逐帧可复现；没有 look/主题/版式，竖屏需重写场景。引擎层通用，故事层每支片重写，可用 `npm run song` 接入成品歌与 LRC。
- **3D 短剧**回答“这一集到底成没成”：一集一个钩子、2–4 个角色、10–16 句对白，3D 雨夜布景里用对白与反应镜头推进；`npm run voice` 按 `cast` 多声线配音（男声降调）+ 配乐闪避混音，`npm run story:strict` 校验镜头断档/台词越界/未知角色，`npm test` 验证契约与配音时长。只做 1080p **横屏 16:9**，不做竖屏；模板自带 40s 示范集《雨停之前》。
- 类型是建工程的第一道分叉：建工程前先走七问（第 1 问用编辑器选择器定 promo / MV / 3D 短剧，之后每个类型各 6 问），答案写进 `direction.json` 再传 `--intake`；非终端没有 `--intake` 会直接报错，不允许用默认值绕过。题面与选项见 [references/intake.md](references/intake.md)，完整类型对照见 [references/genres.md](references/genres.md)，3D 横屏短剧语法见 [references/story-drama.md](references/story-drama.md)。
- 宣传片和 MV 一样**不套固定骨架**：默认模板只有一个 0–60s 的空白标题卡，主角、拍数、场景与画面按这一支片的 brief 现场写；老的七场编辑排版工程只在 `--demo` 时复制（`assets/demo-editorial`），用于研究契约，不是默认起点。story 模板自带示范集，但换集时整段替换 `script.js` 与 `film.js`，布景/工具/校验层通用。

## 为什么不是“一套模板”

- **15 个 curated look**：5 主题 × 4 版式 × 4 动效气质。默认用编辑器的选择器把方向交给用户（先选气质分组、再选具体 look），AI 只按 brief 排序推荐；用户授权时才自动选择。
- **每支片现场写故事与分镜**：空白起步，不复用上一支片的场景顺序、主角或画面；七拍只是卖点型 brief 的可选节奏，不是所有片子的骨架。
- **8 个视觉引擎**：每个 look 绑定一层确定性 Canvas 氛围（网点、双色叠印、散景、尘埃、极光、流线、扫描、轨道），不是换色模板。
- **4 个版式骨架**：editorial / poster / grid / split，换版式不动场景代码。
- **16:9 与 9:16**：竖屏由 `portrait.css` 真正重排，不是裁切缩放。
- **层叠剪纸叙事 MV**：原生 1920×1080 纸层画布（纸边高光 + 柔和投影 + 纸纹）、镜头制时间轴（每镜 2–3 秒，同场景换 v 不重画）、剪影纸人、画布底部歌词、片尾卡；确定性可复现，同刻两次渲染逐像素一致，4K 为矢量重画。
- **3D 短剧 story**：原生 1920×1080 横屏 Three.js 布景（雨/霓虹/水洼/景深/辉光）+ canvas 剪纸人物 + 机位锚点表 + 绝对秒数分镜 + 对白字幕/手机屏/片尾卡；多角色 TTS 配音与 story 契约校验（断档、越界、未知角色、手机字段），只做 1080p 横屏。
- **CG 引擎（Blender）**：同一套 story 契约换成真实感成片——`cg_kit`（HDRI/PBR/霓虹/体积/雨/机位/合成）、`cg_char`（19 骨程序化角色 + wav 包络口型）、`cg_vfx`（布料/火焰/刚体/水花）、`cg_film`（多镜编排、全局帧号、续渲、封面、跨镜连续性检查）、`cg-voice`（逐句 TTS → wav → 整轨 + ASS/SRT 字幕）；Metal 加速、便携安装，67.5s / 16 镜单集《留一碗》验证整条 AI 漫剧管线。方法见 `references/cg-pipeline.md`。
- **可选旁白**：macOS `say` 按字幕时间轴生成，配乐自动侧链闪避；story 支持按 `cast` 多声线 + `pitch` 降调。
- **可选真实素材**：图片直接接入，视频自动抽帧，多图轮换 + 确定性 Ken Burns；自有/授权网页可抓成界面实录帧（合成光标、平滑滚动、点击）。
- **连续运动**：全片一层相机缓慢推近/平移，切点不重置；场景推轨用 smoothstep。`qa:motion` 量化静态帧占比与帧差。
- **可复现**：任意暂停都是正确画面；无随机、无时钟依赖、无外部素材劫持。
- **可回归**：单元测试 + 引擎体检 + 版式/节奏/运动探针 + SSIM 视觉回归；MV 用画布尺寸、歌词与同刻一致性体检。
- **3D 舞台与 VFX**：可选 Three.js 套件（PBR / 三点光 / 阴影 / 雾 / 景深 / 动态模糊 / 泛光 / ACES / 颗粒 + 雨雾蒸汽火花 + 程序化贴图 + 机位锚点），2D 场景另有确定性 VFX 层；story 的原生 3D 布景建在这层上。
- **长片并行与分块**：`render.js --workers` 并行逐帧；`tools/render-chunks.js` 按秒切块（jpg 省磁盘、`--encode` 一条龙），帧号连续，编码不变。
- **双平台加速（3.8）**：macOS 与 Windows 分成两套独立实现——编码器 macOS 走 VideoToolbox（`darwinEncoder()`），Windows 走 NVENC → QSV → AMF（`windowsEncoder()`，逐项一帧实测）；解码器 macOS `videotoolbox`、Windows `d3d11va`（`prep-media` 抽帧与 `grab.js` 抓帧共用，失败回退软件解码）；Blender CYCLES 设备 macOS 选 Metal、Windows 依次 OptiX → CUDA → HIP；采集用 `--fast`（jpg q92）与 `--workers` 并行。`--hw-quality` 可调，`doctor` 体检，细节见 `references/pipeline.md` §2.1 / §2.2。
- **写作门禁（3.0）**：一句话 brief 先扩写成 `treatment.md`（宣传片：世界/空间/序列/候选镜/色域；MV：人物/母题/歌词/镜头），`npm run gate:pre` 不过不许开渲；交付前 `npm run gate` 再叠 `repair --strict`，结果写 `qa/gate.json`。
- **硬件底子（3.0）**：`js/product-kit.js` 一次给出三层空间、窗光、桌面接触阴影、铝壳/键帽/屏幕与开合光扫；产品片仍然每支现场写故事，不是换色模板。

| 主题 | 版式能力 | 适合 |
|---|---|---|
| `letterpress` 铅印 | editorial / poster / grid | 品牌、文化、城市、工艺 |
| `quiet` 暖白 | editorial / poster / split | 咖啡、餐饮、民宿、生活方式 |
| `swiss` 瑞士 | poster / grid / split | 科技、软件、数据、产品 |
| `cinema` 银幕 | editorial / poster / split | 影像、故事、预告、高端品牌 |
| `tech` 终端 | editorial / grid / split | AI、开发者工具、硬件、安全 |

引擎与方法的完整映射见 [references/design-dna.md](references/design-dna.md)。

样片总览（15 个 look × 主题/版式/引擎）：[assets/looks-contact-sheet.jpg](assets/looks-contact-sheet.jpg)

## 安装

作为 Qoder Skill 安装：

```bash
scripts/install.sh                 # → ~/.qoder/skills/brief-to-video
scripts/install.sh --dest DIR      # 指定位置
scripts/install.sh --link          # 开发模式软链

# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

手动安装：把整个目录复制到 `~/.qoder/skills/brief-to-video`，重启会话或 `/skills reload`。

## 快速开始

宣传片：

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
node "$SKILL/scripts/new-film.js" --intake-template promo > direction.json
# 先问完七问（第 1 问用选择器定 promo / MV），把答案填进 direction.json
node "$SKILL/scripts/new-film.js" ./my-film \
  --intake direction.json \
  --title "北岸咖啡" \
  --brand "NORTH BANK" \
  --slogan "把清晨，烘进一杯里"

cd my-film
npm install
npm run preview               # S 主题 / L 版式 / K look
npm run check                 # 静态检查
npm test                      # 契约单测（look/引擎/剧本/config）
npm run qa                    # 静态 + 版式 + 节奏 + 引擎 + 抽帧
npm run gate:pre              # treatment + 静态检查：写作门禁
npm run music                 # 合成配乐
node render.js --scale 1      # 1080p 审片
node encode.js
npm run gate                  # 交付门禁：treatment + 静态 + repair --strict
# 90s+ 长片：node render.js --scale 1 --workers 3
#        或 npm run render:chunks -- --chunk 60 --format jpg --encode
```

宣传片建出来是**空白起步**：只有一个 0–60s 的占位标题卡。先写故事与分镜（[references/brief-to-beats.md](references/brief-to-beats.md)），再按场拆 `js/scenes/*.js`；想要研究老的七场示例时加 `--demo`，但不要只换颜色就交付。

MV：

```bash
node "$SKILL/scripts/new-film.js" --intake-template mv > direction-mv.json
# 同样先问完七问；MV 的第 2 问是歌 / 声音从哪来
node "$SKILL/scripts/new-film.js" ./my-mv \
  --intake direction-mv.json \
  --title "把灯留着" \
  --brand TIDE HARBOR \
  --brand-sub "潮汐港 / TIDE HARBOR" \
  --slogan "灯亮着，就有人回来"

cd my-mv
npm install
npm test                      # 分镜契约单测
npm run qa                    # qa-mv（画布/歌词/片尾/同刻复现/推进）+ 逐镜抽帧
npm run gate:pre              # treatment + 分镜单测：写作门禁
npm run song -- --audio ~/Music/tide.mp3 --lyrics ~/Music/tide.lrc   # 可选：接入成品歌
npm run music                 # 可选：合成配乐；不做则输出无声片
node render.js --scale 1 && node encode.js   # 1080p 审片（默认）
npm run gate                  # 交付门禁：treatment + 分镜单测 + repair --strict
node render.js --scale 2 && node encode.js   # 4K 矢量重画，仅当用户明确要求
```

3D 短剧（横屏）：

```bash
node "$SKILL/scripts/new-film.js" --intake-template story > direction-story.json
# 七问：这一集回答什么 / 几个人 / 想要什么 / 什么挡着 / 停在哪 / 声音与时长
node "$SKILL/scripts/new-film.js" ./my-story \
  --intake direction-story.json \
  --title "雨停之前"

cd my-story
npm install
npm run story                 # 故事契约校验（strict 交付用）
npm test                      # 契约 + 配音时长单测
npm run voice:dry             # 先核对每句槽位
npm run voice                 # 多角色配音
npm run music                 # 合成配乐
npm run stills                # 10 张关键帧目检
node render.js --scale 1 && node encode.js   # 1920×1080 成片
```

分辨率：宣传片与 MV 默认 1080p（宣传片 `render.js --scale 1`，MV `renderScale 1`），只有用户明确要 4K 才做（宣传片 `--scale 2`，MV `--resolution 4k`）。**3D 短剧只做 1080p 横屏**，没有 4K 与 9:16 档。

## 质量门

宣传片：

```bash
npm test                                      # 秒级，不启浏览器
npm run check                                 # 静态契约
npm run qa                                    # 版式 / 节奏 / 引擎 / 抽帧
npm run qa:engines                            # 15 个 look 的引擎逐一验：绑定、可复现、在动
npm run qa:motion                             # 成片运动连续性：静态帧、帧差、最长静止段
npm run gate:pre                              # treatment 结构 + 静态检查（渲染前必须过）
node tools/qa-regress.js . --update           # 首次：建立 SSIM 基线（仅本机）
node tools/qa-regress.js .                    # 改动后：与基线比，worst < 0.985 即报警
npm run gate                                  # 交付门禁：treatment + 静态 + repair --strict
```

MV：

```bash
npm test                                      # 7 项分镜契约单测
npm run qa                                    # qa-mv → 逐镜 30%/78%/切点抽帧
npm run qa:mv                                 # 画布/歌词/片尾卡/同刻复现/画面推进
npm run gate:pre                              # treatment + 分镜单测（渲染前必须过）
npm run gate                                  # 交付门禁：treatment + 分镜单测 + repair --strict
```

3D 短剧（横屏）：

```bash
npm run story                                 # 契约：镜头连续/台词落点/角色/手机/片尾
npm run story:strict                          # 警告也失败（交付前必须过）
npm test                                      # 8 项单测：契约 + 1920×1080 + 配音时长
npm run voice:dry                             # 每句槽位与字数，不出音频
```

`qa/` 产物不进版本库：基线随字体/抗锯齿而变，属于本机资产。`.github/workflows/qa.yml` 会在 push / PR 时跑单测、静态检查、引擎体检、版式与节奏探针。

## 选 look（用户选，AI 只推荐）

建工程前先算推荐，再用编辑器的选择器让用户选：

```bash
# 1) 排序推荐（可在 Skill 目录直接跑，不建工程）
node "$SKILL/assets/template/tools/pick-look.js" --root "$SKILL/assets/template" --json "数据平台发布，仪表盘"
# 2) 编辑器选择器：第一轮选气质分组，第二轮选具体 look（七问第 5 问）
# 3) 把选定的 id 写进 direction.json 的 look 字段，再建工程
node "$SKILL/scripts/new-film.js" ./film --intake direction.json --title "数据平台"
```

用户已指定 look 或说“你定”时才跳过选择器。`auto` 只是兜底：结果带 confidence、命中关键词与备选，不替用户拍板。

```bash
node tools/pick-look.js "数据平台发布，仪表盘，监控"
node tools/pick-look.js --list
node render.js --look tech-grid
```

覆盖优先级：URL > CLI > `config` > look 默认值。MV 没有 look，`--look/--style/--layout` 会被 `new-film.js` 拒绝。

## 旁白与素材

```bash
# 旁白（macOS）
npm run voice
node encode.js                 # 自动混入旁白，音乐 0.40 + 闪避

# 素材：文件名以场景 id 开头
cp alley.jpg assets/media/s1-alley.jpg
cp store.mp4 assets/media/s4-store.mp4
npm run media
npm run check

# 自有/授权网页抓帧：滚动 + 合成光标 + 点击
npm run capture -- --url https://example.com/app --scene s4 --seconds 4 --fps 12 --size 1440x900 --scroll 0,1200 --cursor "300,420;900,600"
npm run media
```

只抓用户自己的页面或已明确授权的页面；不抓竞品/第三方站点，不绕过登录与付费墙。MV 与 story 默认纯代码绘制，不接实拍素材。

## 环境要求

- Node.js ≥ 18
- 系统 Chrome / Chromium / Edge
- FFmpeg 由 `@ffmpeg-installer/ffmpeg` 提供
- 旁白仅 macOS（其他平台可放入现成 `assets/voiceover.wav`）

## 目录

- `SKILL.md` — Skill 入口、类型分叉、完整工作流、硬规则
- `references/genres.md` — 三种类型的决策树、对照表、MV 语法、story 速览与常见错误
- `references/mv-craft.md` — MV 分镜字段、纸层画法、歌词安全区、坏帧修法与交付检查单
- `references/story-drama.md` — 3D 横屏短剧的剧本/分镜契约、3D 布景与剪纸人物、横屏语法、多角色配音与常见错误
- `references/` — look 目录、主题、版式、场景编写、分镜、设计 DNA、QA、管线
- `references/film-tech.md` — 3D 舞台（three-kit/three-sets）、2D VFX、并行/分块渲染、VideoToolbox 加速
- `scripts/` — 建工程（`--genre` 分叉、promo 默认空白起步、`--demo` 七场示例）与安装
- `assets/template/` — 宣传片空白起步工程（含 `test/` 与 8 个引擎、单个 0–60s 占位场景）
- `assets/demo-editorial/` — 老的七场编辑排版示例，仅 `--demo` 复制，用于研究契约
- `assets/genres/mv/` — MV 工程（原生 1920×1080 剪纸画布、24 镜示范分镜与配套 treatment、剪纸角色/9 场景库、画布歌词、歌曲接入、QA 与单测）
- `assets/genres/story/` — 3D 短剧工程（原生 1920×1080 横屏、15 镜示范集《雨停之前》、3D 雨夜面摊 + 剪纸人物、多角色配音、契约校验与单测；含 Blender CG 管线 `cg/` 与 3 镜演示 `cg/short.py`）
- `assets/looks-contact-sheet.jpg` — 15 look 总览（带主题/版式/引擎标签）
- `ATTRIBUTIONS.md` — 方法参考来源与许可

## License

MIT。视觉方法参考来源见 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)。
