# 设计 DNA：把顶级设计 Skill 的方法折进画面

`design-taste.md` 是**检查表**（什么算俗、什么算好）；本文件是**实现地图**（这些判断落到了哪个文件、哪个参数）。看完只做一件事：知道改哪里，而不是加更多装饰。

## 1. 三层结构：Ground → Content → Moment

顶级设计类 skill 的共识只有一句：**背景先成立，内容才有重量，然后只给一个动作。**

| 层 | 作用 | 本工程落点 | 反例 |
|---|---|---|---|
| Ground 场地 | 纸/底/氛围，占画面 90% | 主题 CSS（`--paper` 等） + 视觉引擎（`js/engines.js`） | 直接上内容，背景是纯白/纯黑 |
| Content 内容 | 标题、正文、图、数据 | 场景模块 + `scene-kit.js` | 内容居中堆满，没有对齐脊 |
| Moment 唯一动作 | 观众记住的那一下 | 每场景一个主动效 + 一个引擎焦点 | 每个元素都在动，等于没有动作 |

改画面先问：**这三层各自成立吗？** 不成立时补 Ground 而不是加 Content。

## 2. 视觉引擎：版式之外的第二层

引擎是 Canvas 2D 画的**确定性氛围层**（种子 PRNG + 时间函数），放在 `.bg` 里、内容之下，不参与布局。同一秒永远画同一帧，所以能逐帧渲染、能断点续渲、能跨机器复现。

```
?engine=halftone | riso | bokeh | dust | aurora | flow | scan | orbit | none
```

`config.engine` 可覆盖；默认由 look 决定（见 `js/looks.js` 的 `ENGINES`）。

| 引擎 | 画面语言 | 默认归属 | 什么时候手选 |
|---|---|---|---|
| `halftone` | 径向网点场 + 朱红套印偏移 | ink-editorial / ink-grid | 印刷、纸媒、纪录片、手作 |
| `riso` | 双色叠印大色块 + 印刷噪点 | ink-poster | 海报、文化、展览，需要“印出来”的质感 |
| `bokeh` | 柔光散景 + 呼吸明暗 | quiet-editorial / quiet-poster / quiet-split | 生活方式、疗愈、人物、清晨 |
| `dust` | 尘埃、斜光束、暖角漏光 | cinema-editorial | 电影感、回忆、夜晚、品牌情绪片 |
| `aurora` | 极光带 + 竖光帘 | cinema-poster | 发布会、愿景、开篇大标题 |
| `flow` | 解析流线场 + 亮节点 | tech-split | 数据、算法、系统、性能 |
| `scan` | 扫描带 + 遥测刻度 + 数据点列 | tech-grid | 控制台、监控、工程发布会 |
| `orbit` | 同心圆弧 + 十字标 + 行进刻度 | swiss-grid / swiss-split | 建筑、年报、极简品牌 |

**用法约束**

- 一帧只能有一个引擎；不要叠加两个氛围层。
- 引擎 alpha 已按 look 调好（`js/looks.js` 的 `engineOpts`），手改时幅度 ≤ ±0.03，改完必须抽帧对比。
- 引擎层永远在内容之下；不要让粒子压过标题笔画。tech/cinema 用 `screen` 混合，其余用 `multiply`。
- 新增引擎：在 `engines.js` 加一个 `drawXxx(t)` 并注册进 `DRAW`，在 `KNOWN` 里登记，再在 `looks.js` 绑定给某个 look。绘制只依赖 `t`，不得读随机数（必须走 `rnd(seed)`）。

## 3. 借来的六个手法（以及它们变成了什么代码）

| 手法 | 来源 | 在本工程中的形态 |
|---|---|---|
| **三令牌场地**：一个底色 + 一个墨色 + 一个强调色，其余全是派生 | Taste Skill · grounds | `tokens.css` 每主题只暴露 `--paper / --ink / --accent`，其他颜色用 `color-mix` 派生 |
| **一页一个 moment**：整页只允许一次“值得记住”的动作 | Taste Skill · moments | 每场景一个主动效；引擎只在整片 1–2 处推到峰值（如 aurora 在片头、scan 在数据场景） |
| **100/300/500 时长梯度**：微交互 100ms、入场 300ms、转场 500ms | Impeccable · motion-design | `easing.js` + 场景入场 0.35–0.6s；超过 600ms 的动画必须删 |
| **ease-out 家族，禁回弹**：`outQuart/outExpo` 收尾，不用 spring/bounce | Impeccable · motion-design | `E.outCubic / E.outExpo` 为标准；`E.backOut` 只用于 ≤3% 的卡片错位 |
| **Bolder 与 Overdrive**：每版只允许一处“过度设计” | Impeccable · bolder / overdrive | 引擎即是 overdrive 层：纸面之外的唯一奢侈；内容层保持克制 |
| **删一件配饰**：完成后再拿掉一个装饰 | Taste Skill · system | 收尾清单第 10 条；`qa-layout.js` 之外的人工判断 |

## 4. 媒体调色：素材不是贴上去，是洗进去

真实图片/视频抽帧进来后先过一层 look 滤镜（`styles/engines.css`），保证素材和纸面同温：

| look 前缀 | 滤镜意图 | 效果 |
|---|---|---|
| `ink-` | 去色偏暖，像印在纸上 | `grayscale(.9) contrast(1.12) sepia(.18)` + 10% 强调色叠印 |
| `quiet-` | 低对比、微暖、呼吸感 | `saturate(.85) contrast(.97) brightness(1.03)` |
| `swiss-` | 中性、锐利、不抢色 | `saturate(.92) contrast(1.08)` |
| `cinema-` | 压暗、去饱和、金调 | `saturate(.7) contrast(1.12) brightness(.88) sepia(.06)` |
| `tech-` | 冷色、单色化、信号感 | `saturate(.45) contrast(1.16) hue-rotate(-6deg)` + 强调色叠印 |

规则：

- 素材亮度必须落回主题的纸/墨区间；过曝的图先降 `brightness`，不要靠蒙版压。
- 一帧最多一个素材主体；两张图并列时必须同滤镜、同高度、同基线。
- 人物面部不要加网点/扫描线；引擎强度在有脸的画面上自动减半（手调 `engineOpts.alpha`）。

## 5. 惊艳度：15 个 look 各自的“那一下”

“有 15 个方向”不等于“每个方向都惊艳”。每个 look 需要一个**签名动作**，写死在一个地方，其它全部让路：

| look | 签名动作 |
|---|---|
| ink-editorial | 标题像滚筒压过纸面推出，网点在字后缓慢呼吸 |
| ink-poster | 双色叠印块在角落缓慢渗开，套印偏移可见 |
| ink-grid | 严格网格上只有一粒朱红在走 |
| quiet-editorial | 散景明暗像呼吸，文字几乎不动 |
| quiet-poster | 大标题居中，散景从背后缓慢聚散 |
| quiet-split | 分栏线是唯一硬边，两侧光影不同步 |
| swiss-grid | 同心圆弧随进度转动，十字标钉住版面 |
| swiss-split | 左栏静止，右栏刻度随数据推进 |
| swiss-poster | 主张压在一角，红色重音块从边线推入，轨道刻度在字后行进 |
| cinema-editorial | 尘埃穿过斜光束，letterbox 压住上下 |
| cinema-poster | 极光带在片名后缓慢翻卷 |
| cinema-split | 左半黑场缓慢呼吸，右半实拍有 Ken Burns，黑边始终在 |
| tech-split | 流线场从中心向边缘解析，节点逐个点亮 |
| tech-grid | 扫描带自上而下扫过遥测，数据点列跟随 |
| tech-editorial | 编辑栏线自上而下推进，扫描带只走一次，代码行像被读出来 |

改一个 look 前先找到它的签名动作；如果改动没有强化它，就不要改。

## 6. 反套路黑名单（2.0 增补）

在 `design-taste.md` 的基础上，新增针对“氛围层”的禁令：

- 禁止用引擎做“满屏粒子雨/星空/烟花”——那是素材库，不是设计。
- 禁止在深色底上用 `multiply` 混合，会得到一片死黑。
- 禁止让氛围层的运动周期短于 8s，观众会开始盯着它看而不是看内容。
- 禁止在同一画面里既有网点又有扫描线（两种“印刷/屏幕”语言互斥）。
- 禁止用引擎替代构图：如果遮住引擎画面就散了，说明版式没做完。

## 7. 参数速查

```js
// js/looks.js
'ink-editorial': { engine: 'halftone', engineOpts: { alpha: 0.13, spacing: 18 } },
'ink-poster':    { engine: 'riso',     engineOpts: { alpha: 0.17 } },
'quiet-*':       { engine: 'bokeh',    engineOpts: { alpha: 0.06 ~ 0.12 } },
'cinema-editorial': { engine: 'dust',  engineOpts: { alpha: 0.85 } },
'cinema-poster':    { engine: 'aurora',engineOpts: { alpha: 0.9 } },
'cinema-split':     { engine: 'dust',  engineOpts: { alpha: 0.6 } },
'tech-split':    { engine: 'flow',     engineOpts: { alpha: 0.9 } },
'tech-grid':     { engine: 'scan',     engineOpts: { alpha: 0.9 } },
'tech-editorial': { engine: 'scan',    engineOpts: { alpha: 0.75 } },
'swiss-*':       { engine: 'orbit',    engineOpts: { alpha: 0.09 ~ 0.13 } },
```

canvas 内部分辨率是 `min(0.6, 1400/画布宽)`，1080p 与 4K 渲染同一张底图再放大，所以引擎不会随分辨率变糊，也不会拖慢 4K 逐帧。

## 8. 运动连续性：参考片为什么更丝滑

对一条 30fps 的参考宣传片（61s，真实界面 + 动态字卡）逐帧算帧差：静态帧 7%、帧差均值 2.96、p90 5.99，切点 10 个；切点之间画面一直在动——滚动、光标、推近、粒子。对比一条二次导出的 30fps 版本：静态帧 62%、均值 0.35，肉眼看就是幻灯片。**丝滑不是帧率，是连续性。**

本工程用三层保证：

| 层 | 落点 | 规则 |
|---|---|---|
| 全片相机 | `timeline.js` 里 `#scenes` 的 transform | 整片 0→1 平移 ±9px、推近 1.8%；切点不重置方向 |
| 场景推轨 | 每个场景元素的 transform + `E.smooth` | 交替方向 28px 横移 / 14px 纵移 / 2.2% 推近；起止速度为 0 |
| 素材运动 | `styles/components.css` 的 `.frame.media img` | Ken Burns 由 `--scene-p` 驱动，暂停也是一帧合法画面 |

硬规则：任何 1 秒窗口内必须有可见变化；不要用“整段静止 + 一次大动画”冒充节奏。`qa:motion` 直接量成片：静态帧 >50% 或均值 <0.4 直接失败；印刷/图形类 look 均值 0.6 以上视为连续，实拍与 tech/cinema look 应到 1.5 以上（模板实测 1% 静态、均值 0.81、无长静止段）。

参考片的另一半优势是**真实界面素材**：终端窗口、光标、时间戳、真实数据，可信度远高于插画。产品/软件类 brief 优先抓自有或已授权页面（`tools/capture-web.js`），再叠加上面的连续运动；真实素材负责可信，连续运动负责丝滑。没有授权就继续用代码绘制，不要搬第三方素材。

## 9. 来源与许可

本工程的引擎绘制、版式规则与动效节奏由以下开源/公开作品**方法启发**，代码为原创实现：

- **Taste Skill**（Leonxlnx，MIT）— grounds / moments / motion / system 的规则框架。MIT 允许改写与再分发，已在 `ATTRIBUTIONS.md` 署名。
- **Impeccable**（Apache-2.0，基于 Anthropic frontend-design）— motion-design、bolder、overdrive 的方法论。仅借用原则，未复制代码。
- **Anthropic Skills · frontend-design** — 把审美判断写成可执行步骤 + 验证门。
- 其余 12 个 2026 热门设计 skill — 见 `design-taste.md` 第 10 节的归纳。

许可全文与逐条对应见仓库根目录 `ATTRIBUTIONS.md`。
