# brief-to-video

一句话需求 → 一条可交付成片。先分类型：**宣传片（promo）** 或 **MV（mv）**；两套视觉语法独立，绝不混用。

确定性 HTML/CSS/JS 时间轴 → Puppeteer 逐帧渲染 → FFmpeg 编码 4K/1080p。全程离线，不调用云服务；画面默认由代码绘制，可选接入真实图片/视频与 macOS 中文旁白。

## 两种类型

| 类型 | 语法 | 输出 | 模板 |
|---|---|---|---|
| 宣传片 `promo` | 主题 + 版式 + 15 个 look + 确定性背景引擎 | 16:9 / 9:16，60s 默认 | `assets/template` |
| MV `mv` | 480×270 像素画布 + 镜头制分镜（每镜 2–3 秒）+ 角色与场景库 + 字幕牌 | 16:9，60s 默认，分辨率建工程时选 1080p/4K | `assets/genres/mv` |

- **宣传片**回答“它是什么、凭什么、为什么选它”：品牌信息、卖点、产品、数据。可选真实素材、授权网页抓帧、旁白、SSIM 回归。
- **MV** 回答“发生了什么、他经历了什么”：故事弧 + 分镜表先确认，再写 20–28 镜（每镜 2–3 秒）、字幕牌与片尾卡。标签按 alpha 阈值二值化、字幕牌保留灰度，逐帧可复现；没有 look/主题/版式，竖屏需重写场景。引擎层通用，故事层每支片重写。
- 类型是建工程的第一道分叉：`new-film.js --genre promo|mv`；不带 `--genre` 且非终端时会报错，要求先问用户。完整对照与 MV 规则见 [references/genres.md](references/genres.md)。

## 为什么不是“一套模板”

- **15 个 curated look**：5 主题 × 4 版式 × 4 动效气质。默认用编辑器的选择器把方向交给用户（先选气质分组、再选具体 look），AI 只按 brief 排序推荐；用户授权时才自动选择。
- **8 个视觉引擎**：每个 look 绑定一层确定性 Canvas 氛围（网点、双色叠印、散景、尘埃、极光、流线、扫描、轨道），不是换色模板。
- **4 个版式骨架**：editorial / poster / grid / split，换版式不动场景代码。
- **16:9 与 9:16**：竖屏由 `portrait.css` 真正重排，不是裁切缩放。
- **像素叙事 MV**：480×270 画布、整数放大、像素标签阈值 64、字幕牌软边、镜头制时间轴（每镜 2–3 秒，同场景换 v 不重画）、底部字幕牌、片尾卡；确定性可复现，同刻两次渲染逐像素一致。
- **可选旁白**：macOS `say` 按字幕时间轴生成，配乐自动侧链闪避。
- **可选真实素材**：图片直接接入，视频自动抽帧，多图轮换 + 确定性 Ken Burns；自有/授权网页可抓成界面实录帧（合成光标、平滑滚动、点击）。
- **连续运动**：全片一层相机缓慢推近/平移，切点不重置；场景推轨用 smoothstep。`qa:motion` 量化静态帧占比与帧差。
- **可复现**：任意暂停都是正确画面；无随机、无时钟依赖、无外部素材劫持。
- **可回归**：单元测试 + 引擎体检 + 版式/节奏/运动探针 + SSIM 视觉回归；MV 用画布像素与同刻一致性体检。

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
```

手动安装：把整个目录复制到 `~/.qoder/skills/brief-to-video`，重启会话或 `/skills reload`。

## 快速开始

宣传片：

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
node "$SKILL/scripts/new-film.js" ./my-film \
  --genre promo \
  --title "北岸咖啡" \
  --brief "咖啡店，日常温暖，生活方式" \
  --look quiet-editorial \
  --duration 30

cd my-film
npm install
npm run preview               # S 主题 / L 版式 / K look
npm run check                 # 静态检查
npm test                      # 契约单测（look/引擎/剧本/config）
npm run qa                    # 静态 + 版式 + 节奏 + 引擎 + 抽帧
npm run music                 # 合成配乐
node render.js --scale 1      # 1080p 审片
node encode.js
```

MV：

```bash
node "$SKILL/scripts/new-film.js" ./my-mv \
  --genre mv \
  --resolution 1080p \
  --title "夜航" \
  --brand NIGHTFLIGHT \
  --brand-sub "像素叙事 / PIXEL STORY" \
  --slogan "把夜，拼成一条航线"

cd my-mv
npm install
npm test                      # 镜头制契约单测
npm run qa                    # qa-mv（画布/字幕牌/片尾/同刻复现/推进）+ 逐镜抽帧
npm run music                 # 可选：chiptune 配乐；不做则输出无声片
node render.js --scale 1 && node encode.js   # 1080p 审片
node render.js --scale 2 && node encode.js   # 4K，仅当用户明确要求
```

分辨率：MV 建工程时必须先问 1080p / 4K，写进 `config.renderScale`；宣传片默认 4K（`--scale 2`）。

## 质量门

宣传片：

```bash
npm test                                      # 秒级，不启浏览器
npm run check                                 # 静态契约
npm run qa                                    # 版式 / 节奏 / 引擎 / 抽帧
npm run qa:engines                            # 15 个 look 的引擎逐一验：绑定、可复现、在动
npm run qa:motion                             # 成片运动连续性：静态帧、帧差、最长静止段
node tools/qa-regress.js . --update           # 首次：建立 SSIM 基线（仅本机）
node tools/qa-regress.js .                    # 改动后：与基线比，worst < 0.985 即报警
```

MV：

```bash
npm test                                      # 7 项镜头制契约单测
npm run qa                                    # qa-mv → 逐镜 30%/78%/切点抽帧
npm run qa:mv                                 # 画布像素/字幕牌/片尾卡/同刻复现/画面推进
```

`qa/` 产物不进版本库：基线随字体/抗锯齿而变，属于本机资产。`.github/workflows/qa.yml` 会在 push / PR 时跑单测、静态检查、引擎体检、版式与节奏探针。

## 选 look（用户选，AI 只推荐）

建工程前先算推荐，再用编辑器的选择器让用户选：

```bash
# 1) 排序推荐（可在 Skill 目录直接跑，不建工程）
node "$SKILL/assets/template/tools/pick-look.js" --root "$SKILL/assets/template" --json "数据平台发布，仪表盘"
# 2) 编辑器选择器：第一轮选气质分组，第二轮选具体 look
# 3) 带选择的 id 建工程
node "$SKILL/scripts/new-film.js" ./film --genre promo --title "数据平台" --look tech-grid
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

只抓用户自己的页面或已明确授权的页面；不抓竞品/第三方站点，不绕过登录与付费墙。MV 默认纯代码绘制，不接实拍素材。

## 环境要求

- Node.js ≥ 18
- 系统 Chrome / Chromium / Edge
- FFmpeg 由 `@ffmpeg-installer/ffmpeg` 提供
- 旁白仅 macOS（其他平台可放入现成 `assets/voiceover.wav`）

## 目录

- `SKILL.md` — Skill 入口、类型分叉、完整工作流、硬规则
- `references/genres.md` — 宣传片 vs MV 的决策树、对照表、MV 语法与常见错误
- `references/mv-craft.md` — MV 分镜字段、相机锚点、字幕安全区、坏帧修法与交付检查单
- `references/` — look 目录、主题、版式、场景编写、分镜、设计 DNA、QA、管线
- `scripts/` — 建工程（`--genre` 分叉）与安装
- `assets/template/` — 宣传片工程（含 `test/` 与 8 个引擎）
- `assets/genres/mv/` — MV 工程（480×270 画布、24 镜示范分镜、角色/场景库、像素字/字幕牌、QA 与单测）
- `assets/looks-contact-sheet.jpg` — 15 look 总览（带主题/版式/引擎标签）
- `ATTRIBUTIONS.md` — 方法参考来源与许可

## License

MIT。视觉方法参考来源见 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)。
