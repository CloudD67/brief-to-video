# brief-to-video

一句话需求 → 一条可交付成片：宣传片、产品片、品牌短片、功能讲解、动态海报、竖屏短视频。

确定性 HTML/CSS/JS 时间轴 → Puppeteer 逐帧渲染 → FFmpeg 编码 4K/1080p。全程离线，不调用云服务；画面默认由代码绘制，可选接入真实图片/视频与 macOS 中文旁白。

## 为什么不是“一套模板”

- **12 个 curated look**：5 主题 × 4 版式 × 4 动效气质，按 brief 自动选择，也可手动覆盖。
- **8 个视觉引擎**：每个 look 绑定一层确定性 Canvas 氛围（网点、双色叠印、散景、尘埃、极光、流线、扫描、轨道），不是换色模板。
- **4 个版式骨架**：editorial / poster / grid / split，换版式不动场景代码。
- **16:9 与 9:16**：竖屏由 `portrait.css` 真正重排，不是裁切缩放。
- **可选旁白**：macOS `say` 按字幕时间轴生成，配乐自动侧链闪避。
- **可选真实素材**：图片直接接入，视频自动抽帧，多图轮换 + 确定性 Ken Burns。
- **可复现**：任意暂停都是正确画面；无随机、无时钟依赖、无外部素材劫持。
- **可回归**：单元测试 + 引擎体检 + 版式/节奏探针 + SSIM 视觉回归，CI 全跑。

| 主题 | 版式能力 | 适合 |
|---|---|---|
| `letterpress` 铅印 | editorial / poster / grid | 品牌、文化、城市、工艺 |
| `quiet` 暖白 | editorial / poster / split | 咖啡、餐饮、民宿、生活方式 |
| `swiss` 瑞士 | grid / split | 科技、软件、数据、产品 |
| `cinema` 银幕 | editorial / poster | 影像、故事、预告、高端品牌 |
| `tech` 终端 | grid / split | AI、开发者工具、硬件、安全 |

引擎与方法的完整映射见 [references/design-dna.md](references/design-dna.md)。

样片总览（12 个 look × 主题/版式/引擎）：[assets/looks-contact-sheet.jpg](assets/looks-contact-sheet.jpg)

## 安装

作为 Qoder Skill 安装：

```bash
scripts/install.sh                 # → ~/.qoder/skills/brief-to-video
scripts/install.sh --dest DIR      # 指定位置
scripts/install.sh --link          # 开发模式软链
```

手动安装：把整个目录复制到 `~/.qoder/skills/brief-to-video`，重启会话或 `/skills reload`。

## 快速开始

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
node "$SKILL/scripts/new-film.js" ./my-film \
  --title "北岸咖啡" \
  --brief "咖啡店，日常温暖，生活方式" \
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

4K 交付：`node render.js`（默认 `--scale 2`）后 `node encode.js`。

## 质量门

```bash
npm test                                      # 秒级，不启浏览器
npm run check                                 # 静态契约
npm run qa                                    # 版式 / 节奏 / 引擎 / 抽帧
npm run qa:engines                            # 12 个 look 的引擎逐一验：绑定、可复现、在动
node tools/qa-regress.js . --update           # 首次：建立 SSIM 基线（仅本机）
node tools/qa-regress.js .                    # 改动后：与基线比，worst < 0.985 即报警
```

`qa/` 产物不进版本库：基线随字体/抗锯齿而变，属于本机资产。`.github/workflows/qa.yml` 会在 push / PR 时跑单测、静态检查、引擎体检、版式与节奏探针。

## 选 look

```bash
node tools/pick-look.js "数据平台发布，仪表盘，监控"
node tools/pick-look.js --list
node render.js --look tech-grid
node render.js --look auto --brief "民宿，自然疗愈"
```

结果带 confidence、命中关键词与备选；`auto` 是建议，不锁死。覆盖优先级：URL > CLI > `config` > look 默认值。

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
```

## 环境要求

- Node.js ≥ 18
- 系统 Chrome / Chromium / Edge
- FFmpeg 由 `@ffmpeg-installer/ffmpeg` 提供
- 旁白仅 macOS（其他平台可放入现成 `assets/voiceover.wav`）

## 目录

- `SKILL.md` — Skill 入口、完整工作流、硬规则
- `references/` — look 目录、主题、版式、场景编写、分镜、设计 DNA、QA、管线
- `scripts/` — 建工程与安装
- `assets/template/` — 可直接运行的影片工程（含 `test/` 与 8 个引擎）
- `assets/looks-contact-sheet.jpg` — 12 look 总览（带主题/版式/引擎标签）
- `ATTRIBUTIONS.md` — 方法参考来源与许可

## License

MIT。视觉方法参考来源见 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)。
