# 3D 舞台 / VFX / 长片分块 / 加速

这一层是通用基础设施，三种类型都能用：宣传片与 MV 的画面默认仍是 2D（HTML/Canvas），需要真实景深、体积光、雨雾与 3D 机位时接 Three.js 套件；长片靠并行与分块渲染；编码走 macOS 硬件加速。

## 1. Three.js 3D 舞台（three-kit）

工程里按顺序加载，缺一个都会在控制台报错：

```html
<script src="vendor/three.min.js"></script>
<script src="js/three-kit.js"></script>
<script src="js/three-sets.js"></script>
<script src="js/timeline.js"></script>
```

`three.min.js` 随模板放在 `vendor/`，离线可用，禁止改 CDN 地址。

### createStage

```js
const stage = K.createStage({
  width: 1080, height: 1920, fov: 45, near: 0.05, far: 90,
  exposure: 1.0, background: 0x05070c, fogDensity: 0.02, shadows: true
});
document.getElementById('stage').prepend(stage.canvas);
stage.renderAt(t, { motion: 1 / 60, samples: 3 });   // 唯一的时间入口
```

| 成员 | 用途 |
|---|---|
| `stage.camera` | 透视相机；`position` + `lookAt` 每帧由分镜表驱动 |
| `stage.renderAt(t, opts)` | 按绝对秒数渲染一帧；`samples` 是动态模糊子帧数 |
| `stage.post.bloom / threshold / grain / vignette / contrast / saturation` | 后期开关与强度（0–1 量级，逐片调） |
| `stage.post.focus / aperture / maxBlur` | 景深：对焦距离（相机到主体）、光圈强度、最大模糊半径 |
| `stage.post.fade` | 全片淡入淡出（片头片尾盖黑） |

**确定性**：`renderAt(t)` 是唯一时间源，内部不读 `Date.now()`、不用 `Math.random()`；需要随机分布时用 `K.rng(seed)`（mulberry32）。同一 `t` 渲染两次必须逐像素一致，`qa-mv`/`qa:engines` 的同刻复现探针就是查这个。

### 贴图与材质

- `K.canvasTexture(w, h, draw, opts)`：用 Canvas 画贴图（砖墙、招牌、人物剪纸、屏幕），返回 `THREE.CanvasTexture`；`opts.repeat` / `opts.clamp` / `opts.linear`。
- `K.noiseCanvas` / `K.heightToNormal`：程序化噪声与法线，做湿沥青、粗糙砖面。
- `K.dotTexture / ringTexture / beamTexture / textTexture / verticalTextTexture`：点光、光环、光柱、横排/竖排文字贴图。
- `K.materials.asphalt / concrete / brushedMetal`：三种预设 PBR 材质。
- `K.fx`：`rain / dust / steam / splashes / embers / lightShaft / glowSprite`，全部由 `t` 驱动。
- `K.makeEnvironment({...})`：环境光 + 三点光源骨架。

### 机位与分镜

3D 片的分镜仍是绝对秒数（见 `story-drama.md`）。`three-sets` 的布景返回锚点表，镜头只引用锚点名与推拉量：

```js
const set = window.THREE_SETS.buildNeonAlley(stage, {
  stall: true, characters: true, rain: true, fog: 0.02
});
// set.anchors  机位锚点（wide / close / over 等）
// set.characters.man / her / owner   剪纸人物
// set.phone    手机屏道具（默认隐藏）
// set.update(t)  雨/蒸汽/灯光呼吸
```

镜头字段：`anchor`（锚点名）、`pos/look`（覆盖锚点）、`fov`、`push`（沿视线推近）、`drift`（横移）、`focus/aperture`（景深）、`handheld`（手持微动幅度）、`cast`（人物可见性）。缓动与手持微动由 `timeline.js` 统一算，场景里不要另做相机。

### 成本与边界

- 景深 + 泛光 + 动态模糊是 3D 片最贵的三项；1920×1080 下 `samples: 3` 已够，别用 4K 试错。
- 阴影只开主光；环境物体用 `MeshBasicMaterial` 或烘焙贴图代替实时阴影。
- 3D 只解决“空间、光、雨雾、景深”，构图与叙事仍按 `story-drama.md` / mv-craft 的语法走。

## 2. 2D VFX（vfx-kit）

给 Canvas 场景用的确定性特效层，不需要 Three.js：

```js
<script src="js/vfx-kit.js"></script>
// window.VFX
VFX.rain(ctx, t, w, h, { count: 240, angle: 0.18, speed: 900, alpha: 0.42, splash: true });
VFX.dust(ctx, t, w, h, opts);
VFX.smoke(ctx, t, w, h, opts);
VFX.fire(ctx, t, w, h, opts);
VFX.embers(ctx, t, w, h, opts);
VFX.lightShaft(ctx, t, w, h, opts);
VFX.flare(ctx, t, w, h, opts);
VFX.vignette(ctx, t, w, h, opts);
VFX.grain(ctx, t, w, h, opts);
```

- 全部以 `t`（秒）为唯一输入，内部用 `hash` / 播种 `rng` 生成粒子，不读墙钟、不留跨帧状态。
- 一层画面只挂 1–2 个 VFX；特效是氛围，不替代主体动作与构图。
- 用法示例见 `story-drama.md` 的 2D 变体与 MV 的雨/火场景；引擎层（engines.js）已经做过一层氛围时不要再叠同类 VFX。

## 3. 长片：并行与分块渲染

宣传片的 `render.js` 支持两种提速方式，帧号与全片渲染完全一致，`encode.js` 无需改动。

```bash
node render.js --scale 1 --workers 3        # 并行：3 个页面同时逐帧出图
npm run render:parallel                     # 同上（3 workers）
node tools/render-chunks.js . --chunk 60 --workers 3 --format jpg --encode
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--chunk` | 60 | 每块秒数；块内按顺序调用 render.js |
| `--workers` | 1 | 每块内并行页数，长片建议 3–4，最多 8 |
| `--format` | png | 长片建议 `jpg`：磁盘约为 PNG 的 1/6 |
| `--from` / `--to` | 0 / duration | 只渲一段 |
| `--scale` | 1 | 1080p / 4K |
| `--encode` | 否 | 全部块完成后自动跑 encode.js |

规则：

- 帧名仍是 `0000.png` 连续编号，块与块首尾相接；`encode.js` 的连续性检查会发现缺块。
- 分块只适合绝对时间基的工程（MV / story / 宣传片 `config.shots`）。场景里的动画都以绝对 `t` 求值，块边界不改变画面。
- 60s / 30fps 全片约 1800 帧：1080p PNG 按 2–4MB/帧估磁盘，长片超过约 90s 优先 `--format jpg` + 分块。
- 中途断掉时，块内可加 `--resume` 续渲；换 look/主题/版式必须清空 `frames/` 重渲，不能混片。
- story 只有 40/60/90s，`render.js` 支持 `--from/--to` 与 `--resume` 即可；不接 workers/chunks。

## 4. macOS 加速：VideoToolbox

- 三种类型的 `encode.js` 都支持 `--hw auto|off|h264|hevc`（默认 auto：macOS 有硬件编码器就用 VideoToolbox，否则回退 `libx264`）与 `--hw-quality`（1–100，默认 65）。显式 `--hw h264/hevc` 缺编码器时直接报错，`--hw off` 强制软编。
- 输出规格不变：yuv420p / bt709 / faststart / AAC 48k；HEVC 自动加 `hvc1` 标签。
- `npm run doctor` 会检查 `ffmpeg -encoders`（h264/hevc_videotoolbox）与 `-hwaccels`（videotoolbox）；缺失时给 warn 并提示换一份带 VideoToolbox 的 ffmpeg。
- 加速只作用于编码。Puppeteer 逐帧截图仍受 Chromium 渲染与页面复杂度限制，长片的瓶颈通常在这里，用并行/分块解决。
- 4K 只在用户明确要求时做；1080p 是默认交付档，硬编在 1080p 长片上收益最明显。

## 5. 验收清单

1. 同一时刻渲两次逐像素一致（`qa:engines` 或 `qa-mv` 的同刻探针）。
2. 3D 片跑 `npm run qa:motion`：每镜都在动（雨/呼吸/推镜/手持），没有 ≥1.2s 静止段。
3. 分块/并行渲染后，`encode.js` 帧连续性检查通过，`out/final.mp4` 时长与 `config.duration` 一致。
4. 3D 片抽帧看景深焦点是否落在主体、泛光是否盖字、雨是否穿模。
5. 交付报告注明：是否用 3D（套件名与布景）、渲染方式（并行/分块及块大小）、编码器（VideoToolbox 或回退 x264）。
