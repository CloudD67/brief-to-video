# CG 渲染管线（story / Blender）

> 适用：story 赛道的 **真实感 CG 镜头**——程序化建模、PBR 材质、HDRI、体积、粒子、景深，Blender 逐帧渲染。Three.js 版 story 保留为 previs（快速分镜与对白节奏），CG 是成片引擎。
> 配套：人物与表演见 `cg-characters.md`；布料/火焰/刚体/水花见 `cg-vfx.md`。
> 铁律：画面仍然由**代码**写出来的。不做 AI 生图，不接实拍素材。AI 写 `cg/film.py`，Blender 执行，逐帧出图。

## 1. 环境（一次性）

```bash
SKILL="$HOME/.qoder/skills/brief-to-video"
"$SKILL/scripts/install-blender.sh"      # 便携版 Blender → ~/.qoder/tools/blender（不装系统路径）
"$SKILL/scripts/fetch-cg-assets.sh"      # HDRI + PBR → ~/.qoder/tools/cg-library（Poly Haven CC0）
# Windows: powershell -ExecutionPolicy Bypass -File "$SKILL\scripts\install-blender.ps1"
#          powershell -ExecutionPolicy Bypass -File "$SKILL\scripts\fetch-cg-assets.ps1"
```

- Blender 5.3+，macOS arm64。渲染走 **Metal**：EEVEE 即 Apple GPU 实时管线，Cycles 用 MetalRT。无需额外配置，`--factory-startup` 下自动选 Metal。
- 换机器只搬两个目录：`~/.qoder/tools/blender`、`~/.qoder/tools/cg-library`。素材换位置时用 `CG_ASSETS` 指根目录。
- Blender 路径优先级：`--blender` 参数 → `BLENDER_BIN` 环境变量 → `config.cg.blender` → `~/.qoder/tools/blender/...` → `/Applications/Blender.app` → `which blender`。

## 2. 工程接入

`js/config.js`：

```js
engine: "cg",                                  // "three" = previs；"cg" = Blender 成片
cg: {
  file: "cg/film.py",                          // 场景脚本（每个镜头/每集一个文件，或一文件多镜头）
  samples: 24,                                 // EEVEE 采样；成片 24–48，草稿 8
  engine: "EEVEE",                             // EEVEE | CYCLES（hero 镜头用 CYCLES）
  blender: ""                                  // 留空走自动查找
}
```

`render.js` 检测到 `engine === "cg"` 时直接转给 `tools/cg-render.js`；`encode.js`、`repair`、`story` 校验不变。帧仍然写 `frames/frame_%04d.png`，从 t=0 起。

```bash
npm run render:cg                       # = node tools/cg-render.js（全片）
node tools/cg-render.js --at 1,3.5      # 抽帧到 stills/，先看画面再全渲
node tools/cg-render.js --samples 8 --at 0.5,2   # 草稿：低采样快出图
node tools/cg-render.js --engine CYCLES --samples 64 --from 0 --to 5
node tools/cg-render.js --engine CYCLES --device gpu      # 强制 GPU；--device cpu 强制 CPU
node tools/cg-render.js --poster 4.2    # 全片渲完追加封面 out/poster.png
node tools/cg-render.js --resume        # 断点续渲（CG_RESUME=1）
node tools/cg-render.js --dry           # 只打印将执行的命令与环境变量
npm run build:cg                        # cg-render + encode
```

桥接层负责：找 Blender、传 `CG_*` 环境变量（OUT/FROM/TO/AT/FPS/WIDTH/HEIGHT/SAMPLES/ENGINE/DEVICE/DURATION/RESUME）、解析 `CG_FRAME`/`CG_SKIP`/`CG_REPORT` 打印进度与 ETA、失败时回显 Blender 日志尾部。

CYCLES 设备按平台自动选择：**macOS 用 Metal，Windows 依次 OptiX → CUDA → HIP**，都没有时回落 CPU；`CG_DEVICE=cpu`（或 `--device cpu`）可强制 CPU。EEVEE 不受影响。选中的设备会打印 `CG_DEVICE ...`，`cg-render.js` 的日志也能看到 `设备` 一栏。

## 3. film.py 的写法

`cg/film.py` 是**这一支片**的场景脚本；`cg/cg_kit.py` 是通用库（不要改它来做创作）。骨架：

```python
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import cg_kit as K

DURATION = 5.0
FPS = int(os.environ.get('CG_FPS', 24))

def asset(rel):        # HDRI / PBR 相对路径 → 绝对路径
    root = os.environ.get('CG_ASSETS') or os.path.expanduser('~/.qoder/tools/cg-library')
    return os.path.join(root, rel)

K.reset()
scene = K.setup_scene(width=1920, height=1080, fps=FPS,
                      frame_end=int(DURATION * FPS), samples=24)
K.hdri_world(asset('hdri/cobblestone_street_night_2k.hdr'))
# … 建模、材质、灯光、镜头、合成器 …
K.render_frames(scene, os.environ['CG_OUT'], from_sec=…, to_sec=…, fps=FPS,
                stills=…, label='night-stand')
```

- 时间只用**秒**写（`DURATION`、镜头表），`render_frames` 负责秒→帧（第 0 帧 = t=0，`frame_0000.png`）。
- 一集多镜头：在同一 `film.py` 里用一个场景 + 多机位动画，或按镜拆 `cg/shot01.py…` 由桥接层逐段调；不要一个镜头开一次 Blender 进程去拼全片——灯光世界要共享。
- 每支片都要重写 film.py 里的**布景与镜头**；cg_kit 只给构件，不给故事。

### 3.1 多镜编排：cg/film.py + cg_film.py

一集超过一两镜就不要再写单个巨型脚本：用导演模块登记镜头表，按镜搭景、按成片帧号出图。示范 `cg/short.py`（3 镜 13s）。

```python
import cg_film as F
film = F.Film('留一碗', samples=16, label='liuyiwan')   # 读 CG_* 环境变量
film.add('s1', 4.5, s1, note='雨夜全景', bake=True,
         cast={'yao': 'apron'}, light='key-left')
film.add('s2', 4.0, s2, note='低头备面')
film.run()                                               # 校验 → 逐镜搭建 → 渲染 → 报告
```

- `add(id, sec, build, note='', bake=False, samples=None, motion_blur=False, shutter=.45, exposure=None, cast=None, light='key-left')`。`build(ctx)` 里拿 `ctx['frames'/'fps'/'sec'/'lines']` 搭景，镜内仍用本地帧（1 起）。
- 成片帧号由导演统一换算，输出仍是连续的 `frame_0000.png`；`--from/--to/--at/--poster/--resume` 全部按**成片秒数**解释。`--resume` 时整镜已完成就不重新搭景。
- 每镜自动 `K.reset()` 重搭，同一 Blender 进程渲完整片；不要一镜开一次进程。
- `validate()` 打印 `CG_CONTINUITY`：`cast` 造型跨镜变化、主光方向变化、`voice.json` 台词落点不在镜头内，都会点名。
- 有雨/烟/水花/刚体的镜头把 `bake=True`：搭完按帧步进一次，给粒子与缓存。

### 3.2 对白与字幕：cg/voice.json + tools/cg-voice.js

台词的文本、角色、镜头、绝对秒数与音色全写在 `cg/voice.json`；一条命令出齐音频与字幕：

```jsonc
{
  "voices": {
    "yao":  {"voice": "Reed (中文（中国大陆）)", "rate": 168, "pitch": 0.95},
    "xiao": {"voice": "Flo (中文（中国大陆）)",  "rate": 178, "pitch": 1.0}
  },
  "lines": [
    {"id": 1, "who": "xiao", "shot": "s3", "at": 10.7, "slot": 2.2, "text": "一碗素面，不要葱。"}
  ]
}
```

```bash
node tools/cg-voice.js .             # say → assets/voice/*.wav + lines.json + voiceover.wav + subs.ass/.srt
node tools/cg-voice.js . --dry-run   # 只报时间轴与槽位，不出声
node tools/cg-voice.js . --only 1,2  # 只重配某几句
```

- `at` 是**成片绝对秒数**；`slot` 是留给这句的时长，实测 `spoken` 超槽位会提示。字幕按实测时长 + 0.25s 出。
- Blender 端：`film.voice_lines(sid)` → `ctx['lines'][who]`，每条带 wav 包络曲线与镜内起始帧，直接喂 `cg_char.speak()`；没有 wav 时退回程序化口型脉冲。
- `encode.js` 自动混入 `assets/voiceover.wav`（音乐侧链闪避），`--subs assets/subs.ass` 烧字幕；`npm run build:cg` 已串好「先配、再渲、带字幕编码」。
- **改台词/时间轴 = 重配 + 重渲**：口型曲线是搭景时从 wav 读的，旧帧全部作废（见 §8 陈旧帧）。

**无声版（用户明确不要 TTS / 不要字幕时）**：不建 `cg/voice.json`，`Film(..., voice_json=None)`、角色不做 `speak()`；编码用 `node encode.js --no-voice`（音乐 0.55、2s 淡入淡出）。故事必须完全落在画面与配乐上：用道具（红包、画、留牌）、动作（推碗、掀盖、点头、留两碗）和光的变化承担信息，让情绪在镜头的先后顺序里成立，而不是靠字。`validate()` 会跳过台词检查，但跨镜造型与主光方向仍然校验。**不要**用「画面里打字」来替代对白——那就是把字幕贴进场景。

## 4. cg_kit API（已验证）

| 函数 | 用途与关键参数 |
|---|---|
| `reset()` | 清空物体与孤儿数据（每次脚本开头调用） |
| `setup_scene(width,height,fps,frame_end,samples,engine='EEVEE',exposure,motion_blur,shutter,view_transform='AgX',look)` | 渲染设置；EEVEE 自动开 raytracing 与体积 |
| `hdri_world(path,strength=.07,rotation_deg=95,saturation=.45,value=.95)` | HDRI 环境；夜景常用低强度 + 去饱和 |
| `material(name,color,metallic,roughness,coat,…)` | Principled 材质，返回 `(mat, nt, bsdf, out)` |
| `emission_material(name,color,strength)` | 自发光（灯牌、雨丝） |
| `pbr_textured(name,diff,rough,normal,ao,uv_scale,roughness_range,coat)` | 贴图 PBR + AO 乘算 + 粗糙度重映射 |
| `noise_detail(nt,bsdf,scale,detail,strength,distance,rough)` | 程序化噪声凹凸（金属、台面） |
| `area_light(name,loc,energy,color,size,target)` / `point_light` | 布光 |
| `neon_text(name,body,size,loc,color,strength,rotation,extrude,bevel,align)` | 中文字牌（自动找系统字体）；配 `flicker(em,base,keys)` 做闪烁 |
| `steam_volume(name,loc,size,density,frames,drift,ramp,fade_z,…)` | 4D 噪声体积（热气）：XY 内收、Z 单向下淡，密度从 `size` 推导 |
| `rain(name,loc,size,count,drop_radius,drop_length,speed,lifetime,frames,emission,color,seed)` | 雨丝粒子；发射面要**在主体之后**，别让雨丝贴镜头 |
| `camera(loc,target,lens,focus,fstop,frames,move,handheld,aperture_blades)` | 机位 + 推拉 + 手持微抖 + DOF |
| `compositor(scene,threshold,strength,size,distortion,dispersion)` | Fog Glow + Lens Distortion（5.3 只有这两种可靠节点） |
| `render_frames(scene,out_dir,from_sec,to_sec,fps,stills,poster,label,extra)` | 逐帧写 PNG、写 `out/<label>.blend` 与 `out/<label>-report.json`、打印 `CG_FRAME`；`poster=<sec>` 时追加 `out/poster.png` |

## 5. 已验证配方（夜面摊镜头）

- **世界观**：真实夜空 HDRI（去饱和、强度 0.07）+ 砖墙 `TexBrick` + 湿沥青 PBR（粗糙度 0.12–0.55、clearcoat 0.35）+ 深色钢台面 + 暗红服务垫。
- **主体**：陶瓷碗（旋转成形 + solidify + subsurf）、汤面（4D 噪声凹凸）、面条曲线、葱花/辣油/筷子。
- **光**：暖主光 15W + 冷轮廓 1.8W + 霓虹补光 1.6W + 洗墙 12W + 蒸汽顶光 16W；灯牌用自发光 + 强度 4.0，配确定性闪烁。
- **氛围**：体积蒸汽（密度 5.0、噪声 scale 9、W 随帧漂移）+ 雨丝粒子（1800 颗、半径 1.5mm、弱自发光）+ Fog Glow（阈值 0.72）+ 轻微 Lens Distortion。
- **镜头**：65mm、f/2.0、7 叶光圈，焦点锁碗，4 帧一关键帧的推近 + 正弦手持。

### 5.1 二轮真实感修正（《留一碗》实测）

- **雨**：`rain(..., brownian_factor=0)`——默认布朗运动会让雨丝走成发光的 S 形曲线；半径 ≈0.8mm、长 ≈6.5cm、自发光 0.09、粗糙度 0.55。镜头前 1–2m 的水滴会投成又粗又亮的竖条，那是透视放大不是 bug，判断雨要看全景而不是特写。
- **蒸汽按碗型选形态**：开盖碗**只用体积**（密度 2.6×steam、`ramp=(0.24,0.50)`），不要叠自发光丝带——丝带在 85mm f/1.8 下就是白色手指；盖盖碗 = 体积（1.2×）+ 短泄漏丝带，`alpha = min(0.30, 0.06 + 0.05*steam)`，丝带只贴碗沿、不立起来。
- **掀盖的「涌」**：lid 抬起时把蒸汽体积 scale 从 `(0.55,0.55,0.30)` 三帧递到 `(1,1,1)`，比单纯加大密度更像热气冲出；lid 本体沿斜上方向出画（x 偏移 −0.45×dz），别在画中悬浮。
- **夜里的脸不靠全局曝光**：先在脸前 1–1.5m 放一盏 7–10W 的小点光（越近越柔，可被碗沿/蒸汽遮挡），再按镜给 `exposure` +0.15–0.45；`exposure` 是场景曝光，0.1 EV 只有约 7%，觉得欠曝就往 0.3–0.5 调。全片一刀的曝光会把日景/霓虹镜一起打爆。
- **悬挂道具必须有可见系留**：纸灯笼的吊绳要和灯体同轴（差 18cm 就变成一颗漂浮的橙色圆盘），绳径 3.5mm、材质近黑但吃灯；灯体 = 自发光球（强度 0.30）+ 3 根深色竖肋 + 上下木盖，强度 1.0 会糊成纯橙圆片。
- **多部件道具要逐件打 key**：红包 + 金箍是两个物体（`red_envelope()` 返回 `(env, band)`），滑入/推入时两件同帧同位移，只动本体会把箍留在原地。
- **湿台面**：钢台面 roughness 0.12–0.2 + clearcoat 0.35，才吃得出霓虹与灯笼的彩色反射；粗糙度 0.4 以上只剩一条灰带。

## 6. 性能与 ETA（M4 / 16GB，1080p）

| 场景 | 引擎/采样 | s/帧 | 60s（24fps） | 90s |
|---|---|---|---|---|
| 简单布景 | EEVEE 24 | ≈2.8 | ≈1.1h | ≈1.7h |
| 复杂镜头（本例：体积+粒子+DOF） | EEVEE 24 | ≈9–12.5 | ≈3.6–4.5h | ≈5.4–6.8h |
| 复杂镜头 | Cycles 32 | ≈19.6 | ≈7.8h | ≈11.8h |

策略：**全片 EEVEE，hero 镜头和特写才切 Cycles**；先 `--samples 8 --at` 抽帧定构图，再全渲。长片用 `cg_film` 在**一个 Blender 进程**里按镜搭建（`--resume` 跳过已完成整镜）。赶时间可开两个 `cg-render.js` 实例渲**不重叠**的 `--from/--to` 段，写同一个 `frames/`（帧号不冲突）；两台并发会各自编译着色器，首镜更慢。`--resume`/`CG_RESUME=1` 会跳过已存在且 >1KB 的帧——**只要搭景、音频或口型动过，就必须清空 frames/ 再渲**，否则陈旧帧会混进成片。

实测（《留一碗》67.5s / 16 镜 / 体积蒸汽 + 雨 + DOF，M 系列 10 核 / 16GB）：单进程 16 采样 ≈20s/帧（9h）；拆成 `--from 0 --to 33` 与 `--from 33 --to 67.5` 两个进程、12 采样，合计 ≈16s/帧（≈4.9h）。并发不是线性的——GPU 已饱和时加进程只是切时间片，**单进程 20s/帧就是这台机器的上限**，要更快只能降采样或删体积。

## 7. macOS 适配

- Blender 便携版自带 Metal 后端；EEVEE 直接吃 Apple GPU，Cycles 用 MetalRT。开渲前确认 `--factory-startup` 下 Preferences 没被改坏。
- 编码链不变：`h264_videotoolbox -allow_sw 1 -realtime 0 -q:v 65`（见 `film-tech.md`）。
- 渲染时不要跑别的重 GPU 任务；EEVEE 体积与粒子最吃显存，1080p 下 16GB 统一内存足够。

## 8. Blender 5.3 的坑（踩过）

- 合成器：`scene.compositing_node_group` + `NodeGroupOutput`；Glare 只能设 `Type='Fog Glow'`、`Quality='High'`、Threshold/Strength/Size 三个输入。没有 FilmGrain / Vignette 节点——做旧另想办法。
- EEVEE：`taa_render_samples`、`use_raytracing`、体积 tile/samples/start/end 都是 scene 属性；`--factory-startup` 下 AgX 的 look 只有 `None`。
- 粒子：`mass` 不能为 0（否则全死）；发射面记得 `hide_render`。
- 字体：系统中文字体用 `/System/Library/Fonts/Hiragino Sans GB.ttc`。
- 体积材质：**密度乘法器的 socket 是 `inputs[1]`**，别把链接写进 `inputs[0]` 再设默认值（会被链接覆盖）。Z 方向渐变不能取绝对值，否则顶部比碗口还浓；底部也要单独切一刀（fade 分两段 mask），否则体积盒底面会露在碗沿下。
- **体积在近景会失效**：碗口 0.3–0.5m 的近距离蒸汽 `steam_volume` 会糊成一整块泛白的大团（froxel 分辨率不够）。近景改用几何蒸汽——BLENDED 的薄丝带网格 + 噪声 alpha + 贴碗沿的小股泄漏白汽；85mm f/1.8 的景深会把大丝带糊成无特征亮块，所以丝带要短、贴rim、朝镜头方向有层次。
- 节点组/数学节点改完参数立刻在 `render_frames` 前抽一帧验证，不要等全片渲完才发现蒸汽是一根柱子。
- 配音：新版 macOS 的中文语音名带语言后缀（`Flo (中文（中国大陆）)`），**必须整名传给 `say -v`**；截掉括号会静默落到英语 Flo，生成 78 字节的空 wav。`cg-voice` 已按整名传递，并对 <0.2s 的合成结果硬报错。
- 插入镜（道具推入画）的起点要落在画框内：rig 从画外 0.5m 开始滑入，85mm 窄视角下前 1s 只有失焦台面，机器检查过得去、人眼一眼是空镜。把首帧放到画面右缘（道具半入画），再用 1.5s 滑到中心；改完 `--at` 低采样抽帧确认首帧有主体。
- 分镜曝光是**逐镜**参数，写进 `film.add(..., exposure=)`；它改的是场景曝光而不是某一盏灯，忘掉就会让相邻镜亮度跳变。夜景里 0.15–0.45 是常用区间。
- 双进程分段渲时切点帧只属于后一段（`--from 33` 从第 33.0s 那帧开始），渲完数一遍 `frames/` 是否正好 1620 张、编号无缺口——两个进程都写同一个 `frames/`，出问题只会在接缝处。
- 片名卡/尾卡的发光第一帧不能是 0：全黑引子（哪怕 0.4s）会被 repair 判成近空帧（灰度 std <1.5），也容易被观众当成丢帧。第一行字从 0.5 起亮、1s 内升到满，既有淡入感又不留纯黑。

## 9. 验收清单

- [ ] `node tools/cg-render.js --at …` 抽帧看构图、光比、材质、DOF、雨/蒸汽方向。
- [ ] 首帧（t=0）无穿模、无贴镜头雨丝；末帧与 `posterAt` 可当封面。
- [ ] 每镜切点后首帧有主体（插入镜道具已入画、片名卡已有微光），不是空台面/纯黑。
- [ ] 帧序列从 `frame_0000.png` 连续，无缺帧；`out/<label>-report.json` 有 s/帧记录。
- [ ] `engine: 'cg'` 时 `node tools/validate-story.js .` 自动改查 `cg/voice.json` + `out/*-manifest.json`（台词落点、槽位、镜头断档），不再要求 `js/film.js` 机位表。
- [ ] `encode.js` 通过并输出 1080p；`volumedetect` 不削波。
- [ ] 交付前删 `frames/` 与中间 `.blend`（保留 `out/final.mp4` 与封面）。

## 10. 阶段状态

- **P2 角色**（已完成）：`cg/cg_char.py` 程序化人体 + 19 骨绑定 + 面部部件 + 包络口型；API 与踩坑见 `cg-characters.md`。
- **P3 VFX**（已完成）：`cg/cg_vfx.py` 布料（构建期 PBD + shape key）、火焰体积、刚体、水花、水洼；用法与 headless 物理限制见 `cg-vfx.md`，示范片 `cg/vfx.py`。
- **P4 长片**（已完成）：`cg/cg_film.py` 多镜编排（镜头表 / 全局帧号 / 续渲 / 封面 / 跨镜连续性检查）+ `tools/cg-voice.js` 定时对白、整轨与字幕；三镜示范 `cg/short.py`（内联台词、程序化口型）。
- **P5 样片**（已完成）：《留一碗》67.5s / 16 镜 CG 单集（项目工程 `cg-liuyiwan/`，`cg/liuyiwan.py` + `cg/voice.json` 9 句对白 + 合成配乐），验证「剧本 → 分镜 → 配音 → 逐镜渲染 → 编码交付」整条 AI 漫剧管线。