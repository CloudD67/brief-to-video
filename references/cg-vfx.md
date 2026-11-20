# CG VFX 与物理（cg_vfx.py）

> 适用：story / CG 镜头里的**动效与物理**——布料、火焰烟、刚体、水花、水洼。库在 `assets/genres/story/cg/cg_vfx.py`；它是通用构件，不改它做创作，布景与参数写在你自己的 `film.py`。
> 铁律：物理在**构建期**解算并烘成关键帧/缓存，渲染逐帧可复现。不依赖交互式模拟，也不靠"多跑几遍碰运气"。
> 示范片：`assets/genres/story/cg/vfx.py`（巷口收摊 5s：门帘 + 炉火 + 两罐滚落 + 水花 + 水洼）。

## 1. 快速上手

```python
import cg_vfx as V

flag = V.cloth_flag('Banner', loc=(0, 1.70, 1.645), size=(1.90, 0.46), mat=cloth_m,
                    frames=(1, FRAMES), fps=FPS, nx=36, ny=16,
                    wind=(4.0, 1.4), seed=4, thickness=0.0018)

fire, flicker = V.flame_volume('Fire', loc=(.82, 1.24, 1.02), size=(.42, .42, 1.05),
                               frames=(1, FRAMES), intensity=8.5, density=3.4,
                               seed=6, drift=4.2, hotspot=0.34)

V.rigid_world(scene, frame_end=FRAMES)
V.rigid_body(ground, kind='PASSIVE')
V.rigid_body(platform, kind='PASSIVE')
V.rigid_body(V.can('CanA', loc, r=.034, h=.11, label=label_m),
             mass=.38, friction=.42, restitution=.34)

V.splash('SplashA', (0.10, 1.00, 0.012), frame_start=26, count=900,
         speed=2.1, spread=0.6, frames=(1, FRAMES), seed=9, radius=0.0045)
V.puddle('Puddle', (0.10, 1.00, 0.0), radius=0.24, rot=0.4)

V.bake(scene, FRAMES, fps=FPS, label='vfx-demo')   # 只步进刚体 + 粒子
```

布料在**创建时**已经解算完，`bake()` 不碰它。

## 2. Blender 5.3 headless 的物理现实（先读这条）

- **Cloth modifier 在 headless 下不步进**：`frame_set` 只推进刚体（Bullet）与粒子缓存。布料/软体/流体挂在 modifier 上的模拟会一直是第一帧。所以布料改成构建期 PBD 解算 + shape key 烘焙（见 §3），这是本库存在的核心原因。
- **刚体没有 velocity API**（5.3 的 RigidBody 结构没有线性/角速度写入）：只能靠**初始位姿**制造运动——把物体放在台面边缘、重心出界，靠自重翻落，不要再想"给一个初速度"。
- 粒子能步进，但仍要逐帧 `frame_set` 填缓存，`bake()` 里一次做完，别留到渲染循环。
- 渲染开运动模糊（`setup_scene` 默认，shutter 0.45）：小水滴和滚落的罐子靠它才有速度感。

## 3. 布料：构建期 PBD + shape key

- 网格是 `nx×ny` 栅格 + 轻微波纹起伏 + Solidify；pins 按 `pin='top'`（顶行）或 `'left'`（左列）。
- 积分：Verlet `vel=(p−prev)×0.985; prev=p; p += vel + acc·hs²`，子步 `hs=1/(fps×2)`。
- 约束：结构 1.0 / 剪切 0.6 / 弯曲 0.16，迭代 5 次。**弯曲刚度是最容易做错的参数**：0.28 以上布料像塑料板，0.1 以下下摆会自缠。
- 风由四层叠加：`−Y` 主风（沿高度加权，顶部不动、下摆吃满）+ 低频阵风 `sin` + 横向摆 + 高频抖动。**只给沿视线的风，正面机位完全看不出在鼓**——要么加横向分量，要么换 3/4 机位（示范片就是因此把机位挪到左前 45°）。
- 烘焙：每帧一个 shape key，`keyframe` 值在 `f−1/f/f+1` 写 `0/1/0`，插值强制 **LINEAR**。默认贝塞尔会在关键帧之间回摆，画面像抽搐。144 帧 = 144 个 key，36×16 的网格足够，别做更密。
- 布料不参与碰撞（不加 Collision 修改器）：解算里没有它，渲染里也不需要。

## 4. 火焰：程序化体积

- `flame_volume` = Principled Volume + 两路 4D 噪声（core scale 10.5 / wisps 20，W 随帧漂移）+ 高度 ramp（火色→烟色）+ 一个被 key 的闪烁 value 节点。返回 `(obj, flicker_node)`。
- **热床比火焰重要**：炉口放一块 emission 圆片（`emission_material`，强度 4–5，橙红），火焰体积就算淡，观众也立刻读到"有火"。只飘烟没有热床 = 烟囱。
- 体积盒别做太高：顶部溢出画面上沿会像失火。5s 镜头里 0.9–1.0m 高、密度 3–4 就够；密度再高会糊成一团橙雾，distortion 0.55 给卷曲。
- 火焰光点（点光）能量要跟火焰同步闪，key 一串 30–55W 的交替值，别用常量。
- 烟色用 `(0.045, 0.034, 0.028)` 这类暖深灰，纯黑会在砖墙上切出硬边。

## 5. 刚体：能做什么、不能做什么

- `rigid_world(scene, frame_end, substeps=12, iterations=20)` 设世界；`rigid_body(obj, kind='ACTIVE'|'PASSIVE', mass, friction, restitution, shape='CONVEX_HULL')`。
- 运动全部来自**初始位姿**：示范片把横躺的罐子放在搁板前缘外 6cm（重心出界）→ 翻落、弹跳、滚动；立着的罐子立在台面上不动。想要"被撞飞"的效果，得靠另一个物体真的撞上去。
- 接地精度是 1cm 级：立放时中心 `z = 台面顶 + h/2`；差一点就穿模或浮空（示范片踩过：`1.257` vs 正确 `1.266`，罐子会陷进板里）。
- 薄板（搁板）加厚到 2cm 以上再用，贴墙的搁板深度要让背面触墙，否则支架看着悬空。
- 静止后还在抖 = 子步/迭代不够，或摩擦太低；先加 `substeps`，再考虑 `friction`。

## 6. 水：水花与水洼

- `splash`：2 帧发射 + 14 帧寿命 + 布朗运动 + 实例化小球。**4m 外的 1.6mm 水滴只有 1px**，看不见；半径 4–5mm、count 700–900，配合运动模糊才有"溅起"。
- 水滴材质要带一点自发光（0.25 级）才在夜景里成立；纯 PBR 水珠在暗巷里等于隐形。
- `puddle`：硬边圆片在地面上读成"贴纸"或"洞"。做法是深色低粗糙 + coat 1.0 + **径向渐变 alpha + 噪声调制**打散边缘，再加一点冷色弱自发光冒充夜空反射（EEVEE 无屏幕空间反射时镜面反射靠不住，纯黑反而像洞）。
- 水花发射点取 puddle 中心高度 +8mm，落点才会全部在水洼里。

## 7. 组合与性能（M4 / 1080p）

- 布料构建（144 帧、36×16）约 20–40s；刚体 + 粒子 bake 几秒；渲染 16 采样 8–10s/帧，24 采样 12s+/帧（和体积、雨叠加时）。
- 全部效果同镜时按代价排序：体积火焰 > 布料 > 雨 > 粒子水花 > 刚体。草稿阶段 `--samples 8` + `--at` 抽 3 个时刻，别全渲。
- 雨丝发射面放在主体之后（`rain(loc y=1.0)` 而机位在 y −2.45），否则贴镜头的雨会糊住画面。
- 水体/火焰都不要开 shadow 采样级的额外开销，EEVEE 默认够用。

## 8. 验收清单

- [ ] 布料：抽 3 帧看下摆是否在动、是否穿杆、是否翻到杆后；风大时中间要鼓、边缘要卷。
- [ ] 火焰：底部亮、有热床；烟柱不顶出画面上沿；点光闪烁与体积变化同步。
- [ ] 刚体：落点有弹跳与滚动，不穿地、不悬空；静止后不抖；两个物体不互相穿模。
- [ ] 水：水花在空中可见（运动模糊成短痕），落点在水洼内；水洼边缘渐隐、不是硬边圆片。
- [ ] 首帧与末帧都无穿模；`--at` 的抽帧覆盖落体前/落体后、爆发前/爆发后。
