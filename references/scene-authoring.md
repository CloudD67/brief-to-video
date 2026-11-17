# 场景编写手册

## 1. 运行原理

`index.html?render=1` 打开后：

1. `timeline.js` 读取 `window.FILM_CONFIG`（时长/画幅/fps）、`window.FILM_SCRIPT`（文案/字幕）与 `window.FILM_SCENES`。
2. 场景起止与字幕时间都按 **60s 基准**书写；`scale = config.duration / 60`，运行时统一换算。
3. 按 `start` 排序，为每个场景建一个 `<section class="scene">`，调用一次 `mount(root)`。
4. 任意时刻 `t`，隐藏非活动场景，对活动场景调用 `seek(局部秒, 场景时长)`；传入的始终是 **60s 基准的局部时间**。
5. `render.js` 通过 `window.pauseAt(t)` 逐帧驱动；`encode.js` 把 PNG 序列合成视频。

因此：**画面是时间的纯函数**。任何时刻暂停，画面都必须正确；不能依赖“从上一帧继续”。

## 2. 场景契约

```js
(function () {
  'use strict';
  const C = window.FILM_CONFIG;
  const SC = window.FILM_SCRIPT.s3;   // 这一场的全部可见文案
  const S = window.FILM_SCENES = window.FILM_SCENES || [];

  S.push({
    id: 's3',                 // 唯一；数量与 id 由分镜表决定（s0、s1… 或语义 id）
    start: 21.5,               // 60s 基准的全局时间
    end: 33,                   // 最后一场固定写 60；运行时自动缩放到实际片长
    mount: function (root) {
      // 只在这里建 DOM；把需要每帧改的节点缓存到 this.node
    },
    seek: function (local, duration) {
      // 只改样式/文本；不要建删节点、不要读时钟、不要用 CSS transition
    }
  });
})();
```

硬性要求：

- `id` 唯一；`start < end`；场景按 60s 基准连续，不能有缺口或重叠。
- 第一个场景 `start = 0`；最后一个场景 `end = 60`（不是 `C.duration`）。
- 场景数量与顺序来自你自己的故事分镜表，不要求七个；新增/删减场景时同步改 `script.js` 与 `index.html`。
- 所有可见文字来自 `window.FILM_SCRIPT[id]`；场景文件里只允许生成装饰性时间码、编号、单位。
- `mount` 只调用一次；`seek` 每秒调用 30 次（4K 渲染时也是），必须轻量。
- `seek` 不得使用 `Math.random()`、`Date.now()`、`performance.now()`；需要随机用 `U.mulberry32(seed)`。
- 不要用 CSS `transition` / `animation` / `@keyframes` 做叙事动画；渲染模式会禁用它们。
- 顶层代码（IIFE 内、push 之前）运行在 Node 的 `vm` 里做静态检查，**不能访问 `document` / `window.innerWidth`**；只读 `C`、`SC` 和常量。

## 3. 可用全局

加载顺序：`config.js` → `looks.js` → `style.js` → `script.js` → `utils.js` → `easing.js` → `fonts.js` → `media.generated.js` → `media.js` → `scene-kit.js` → `subtitle.js` → `scenes/*.js` → `timeline.js`。

`looks.js` 提供 15 个 look（主题+版式+动效）和推荐排序；`style.js` 在 `<head>` 里最早执行：读 `?look=` / `?style=` / `?layout=` 或 config，校验 CSS 是否已加载，写 `document.documentElement.dataset.look/style/layout`，并暴露 `window.FILM_LOOK` / `window.FILM_STYLE` / `window.FILM_LAYOUT`。场景不要自己读 URL 或改 data-*。

### `C` — `window.FILM_CONFIG`

`C.title / brand / brandSub / slogan / disclaimer / width / height / duration / fps / posterAt`

### `SC` — `window.FILM_SCRIPT[id]`

全片剧本，结构见 `js/script.js`：

```js
const SC = window.FILM_SCRIPT.s3;
// SC.hdr / SC.kick / SC.headline / SC.voice / SC.stats / …
```

- 字幕统一放在 `FILM_SCRIPT.subtitles`，新写法是**场景内定位**：`{ scene, at, dur, text }`，`at/dur` 是 60s 基准的场景内秒数。`timeline.js` 的 `resolveCues()` 会换算成绝对时间、把跨切点的字幕夹回场景内，并暴露 `window.FILM_CUES`（绝对秒数）供运行时与 QA 使用。旧的 `{ start, end, text }` 仍兼容，但新工程不要再用。
- 场景文案按你的场景 id 分节；新增场景必须同步加一节，`check-project` 会校验。
- `kit.el` / `kit.chars` / `kit.maskLine` 支持 `{duration} {width} {height} {fps}` 占位符，自动从 config 取值；例：`'BRIEF → FILM · {duration} SEC'`。**这些占位符只允许出现在传给 kit 的模板字符串里**，不能留在最终可见文本中。

场景里页眉统一写：

```js
kit.hdr({ brand: C.brand, sub: C.brandSub }, SC.hdr, true)
```

### `E` — 缓动

`linear` `smooth` `outCubic` `inOutCubic` `outQuint` `inOutQuint` `outExpo` `inOutExpo` `backOut`
`cubicPoint(u, p0, p1, p2, p3)` · `cubicBezier(x1, y1, x2, y2)`（返回 `f(x)`）

入场默认 `E.outCubic`；大幅位移用 `E.outExpo`；回弹只用 `E.backOut`，幅度要小。

### `U` — 工具

- `inv(a, b, t)`：把 `t` 映射到 `[0,1]`，用于“在 a–b 秒之间发生”。
- `clamp(v,a,b)` / `lerp(a,b,p)`
- `mulberry32(seed)`：确定性随机数生成器
- `el(tag, cls, style)` / `svg(tag, attrs)` / `set(node, styles)`
- `thumb(rng, w, h, variant)`：生成确定性缩略图数据
- `fmt(n)`：保留两位小数
- `pick(rng, arr)`

### `kit` — DOM 组件

| API | 返回 | 说明 |
|---|---|---|
| `kit.el(tag, cls, text)` | element | 快速建节点 |
| `kit.frame(variant, label)` | element | 有素材时输出真实图片框（自动 Ken Burns/多图轮换），否则 SVG 双色插画；`variant` 1–8，`label` 显示编号 |
| `kit.hdr(left, right, slim)` | header | `left = {brand, sub}`；`.r` 是右侧文本节点 |
| `kit.kick(text)` | div | 红线段 + 小标签 |
| `kit.spec(rows)` | div | `[[k,v],…]` 规格表 |
| `kit.chars(text, cls)` | span | 逐字拆分，用于错峰入场 |
| `kit.maskLine(text, cls)` | `{node, inner}` | 遮罩行；`inner` 上移实现揭示 |
| `kit.setReveal(node, p, dy)` | — | 按进度设透明度 + 位移 |

## 4. 画面坐标与安全区

舞台固定为 `C.width × C.height`（默认 1920×1080），所有场景坐标都用这个基准，不随窗口缩放。

- 页眉：`top: 54px`，左右 `96px`，底线 y≈94。
- 常用左边距：`96px`（页眉）或 `120px`（内容）。
- 右下角免责声明：`right: 96px; bottom: 40px`。
- 字幕带：`left: 120px; bottom: 82px; width: 1560px; height: 118px`，约 y=880–998。
- **字幕开启时，主体内容不要进入 y > 860 的区域**；要放底部大字，先确认该时段字幕为空。
- `cinema` 主题有上下各 54px 黑边（`--letterbox`）：内容安全区再缩 54px，即 y 54–1026；字幕会自动让位到黑边之上。
- 4K 渲染是同一坐标 ×2，不要写 `devicePixelRatio` 相关逻辑。

## 5. 动效写法

### 全片运镜与切点由 timeline 统一处理

`timeline.js` 给每个场景容器叠加一层连续运镜：`scale 1.006→1.016`、±8px 漂移，奇偶场景方向相反；切点是硬切，切点前后 ±0.10s 由纸色闪白（峰值 0.93）遮断，字幕在闪白之上。**场景内部不要另做整场淡入淡出、缩放或切点转场**，否则会和这层运镜叠加成双重动效。

场景要保证的是：`local=0` 时页眉/页脚已在场，主体在 0.2–0.4s 内开始进入；`local=duration` 时画面仍然完整可停。

### 入场：从负本地时间开始

切点后 50ms 的第一帧就要“已经有东西”，不要从空白开始：

```js
const p = E.outCubic(U.inv(-0.30, 0.04, t));   // t=0 时已基本到位
n.hdr.style.opacity = String(p);
n.hdr.style.transform = 'translate3d(0,' + ((1 - p) * -10).toFixed(2) + 'px,0)';
```

### 遮罩揭示标题

```js
const m = kit.maskLine('各归其位');
m.node.classList.add('block');
// mount 里 append m.node；seek 里：
const p = E.outCubic(U.inv(-0.18, 0.46, t));
m.inner.style.transform = 'translate3d(0,' + ((1 - p) * 104).toFixed(2) + '%,0)';
```

百分比位移相对自身高度，适合大标题；不要给外层设固定高度。

### 错峰

```js
for (let i = 0; i < items.length; i++) {
  const p = E.outCubic(U.inv(0.2 + i * 0.06, 0.6 + i * 0.06, t));
  items[i].style.opacity = String(p);
}
```

### 循环/脉冲

用 `Math.sin(t * k)` 或 `((t * fps) % n)`；不要用 CSS keyframes。

### 计数器

```js
const p = E.outCubic(U.inv(2.6, 4.2, t));
node.textContent = Math.round(target * p) + ' %';
```

数字变化要落在字体等宽或固定宽度的容器里，避免抖动。

### 伪 UI

用绝对定位的 div + 细线 + 小字号 mono 字体搭；动画只改进度条宽度、播放头 `left`、行高亮。不要嵌 iframe 或外部截图。

### 真屏场景（screen-kit）

软件/AI/平台类产品片的场景不写普通版式，整屏交给 `window.screen`（`js/screen-kit.js`）：

```js
mount(root) {
  const st = screen.stage();               // 深色；浅色产品用 screen.stage({ light: true })
  root.appendChild(st);
  const left = screen.win({ x: -70, y: 0, w: 1020, h: 1080, title: '任务', icon: screen.icon('T', 'accent') });
  const t = screen.term({ lines: [['cmd', '']] });
  left.body.appendChild(t);
  const board = screen.board({ tabs: [...], filters: [...], cols: 4 });
  const right = screen.win({ x: 950, y: 0, w: 1040, h: 1080 });
  right.body.appendChild(board);
  const cap = screen.caption('协作', '两个人，一块屏');
  st.append(left, right, cap);
  this.n = { left, right, t, board, cap };
},
seek(local) {
  screen.type(this.n.t.lines[0], 'npm test', screen.inv(local, 0.6, 1.4));
  screen.reveal(this.n.t.lines.slice(1), local, 2.0, 0.09, 0.28);
  screen.caret(this.n.t.lines[0], local, local > 3.6);
  this.n.cap.seek(local, 0.4, 8.6);
}
```

契约：

- 组件只由 `seek(local)` 驱动；没有 CSS 动画，不读时钟。
- 界面字号保持 20–28px；强调用 `caption()` / `intertitle()`，不要放大 UI。
- 颜色全部来自 `tokens.css` 的 `--scr-*`；主色跟主题 `--accent`。场景里不要写颜色。
- `win` 的 `x/y/w/h` 允许负值与出画；面板被画框切掉是真实感来源。
- 深色产品默认皮肤；浅色产品加 `stage({ light: true })`，只换灰阶不改结构。
- 间幕卡用 `screen.intertitle([{text,accent,underline}])`；结尾用 `screen.collage([...])`。
- **连线必须给退场时刻**：`screen.wire(...).seek(local, t0, dur, outAt)` 的第 4 参是轨迹开始退场的本地秒数；不给 `outAt` 时路径与线头会一直留在画面上，交接镜头就会把虚线压在新标题上。线头/光晕/路径在 `outAt` 后 0.24s 内一起归零，给下一个可读元素留出干净底。
- 真屏片 `config.motion = 'locked'`：无全片漂移、无切点闪白。
- 组件清单、真实感要点与验收见 `product-film-grammar.md` §8；硬件/实体产品不要套这套语法。

### 节奏预算与收尾

`qa-timing.js` 会在每个场景的 15% / 35% / 50% / 70% / 85% / 95% 采样，按这些规则判：

- **主动效 65% 收住**：标题揭示、卡片入场、曲线绘制在场景时长 65% 前完成；最后 35% 只允许轻微脉冲或静态。
- **数字必须落值**：计数器/统计在 70% 前显示最终值。不要在早期显示 `—`、`--`、`0` 或占位符超过一拍；`qa:timing` 会把 `—`/`NaN`/`{...}` 判为占位符。
  ```js
  const p = E.outCubic(U.inv(1.4, 3.4, t));   // 3.4s 后 = 1
  n.num.textContent = Math.round(target * p) + ' 项';
  ```
- **退场要么干净、要么被遮挡**：70% 之后不得留下 opacity 在 0.01–0.35 的半透明残影。要么在 65% 前退到 0，要么让后续面板/卡片完全盖住它。`qa:timing` 用 `elementFromPoint` 判断是否被遮挡，被盖住不算残影。
- **95% 不空**：场景最后一帧必须仍有标题或主体；只有片尾场景允许留白收束。
- **字幕按 cue 出现**：采样时刻落在某条字幕区间内，就必须有可见字幕；不在区间内则不应有残留字幕。字幕由 `timeline.js` 统一挂载，场景不要自己画字幕。
- **背景/前景同帧不打架**：同一时刻只能有一个 `z-index` 层承载主信息；伪 UI 的行高亮、扫描线、播放头都属于装饰层。

## 6. 布局与出框

- 场景把文案包在 `.copy`、画面包在 `.vis-cluster`，`styles/layouts.css` 才能在 4 个版式间整体移动；包错层会导致换版式时不重排。
- 竖屏由 `styles/portrait.css` 重排：文案在上、画面在中部横带、字幕留底部安全区；场景坐标仍按 1920×1080 写，不要写竖屏分支。
- 4K 下最容易被裁的是**旋转 + 位移**叠加的卡片：给容器留 ≥40px 余量。
- 横向入场位移控制在 ±8–90px；不要从画外 120px 飞入，切点前后会撞边。
- 卡片阵列用固定列宽 + 间距计算，不要依赖 flex 换行后的实际尺寸做动画。
- 文字块用 `max-width` 限定；中文标题两行以内，超过就拆成两个节点。
- 任何绝对定位元素都要有明确的 `left/top` 或 `right/bottom`；不要依赖文档流默认位置做动画。

## 7. 常见坑

1. **裸数字尺寸**：`style.left = 120` 无效。必须 `'120px'`。`check-project.js` 会拦直接赋值和三元表达式两种写法。
2. **每帧建 DOM**：在 `seek` 里 `appendChild` 会越来越慢并导致内存上涨。全部在 `mount` 建好。
3. **在 seek 里读布局**：`offsetWidth` / `getBoundingClientRect` 会强制同步布局，4K 下严重拖慢。用常量或挂载时缓存。
4. **依赖上一帧状态**：例如 `node.style.left = parseInt(node.style.left) + 1`。必须由 `t` 直接算出。
5. **mount 报错被吞**：`timeline.js` 捕获 mount 异常只打 console，场景会空白。**必须跑 `npm run qa` 看画面**。6. **字幕压字**：场景底部内容与 `#subs` 重叠。把内容上移，或让该段字幕留空。
7. **z-index 混乱**：`timeline.js` 按排序给每个场景 `z-index = 10 + i`；场景内部元素自己管层级，不要超过 50（字幕是 50，免责声明 60）。
8. **字体未加载**：自定义 `fontUrl` 加载失败会静默回退系统字体；品牌字体必须实际存在并跑一次 QA。
9. **把成片秒数写进场景**：场景与字幕一律用 60s 基准；只有 `timeline.js` 读 `C.duration` 做缩放。写死 30s/60s 成片秒数，或在场景里用 `C.duration`，都会让改片长后错位。
10. **转场靠 CSS 或场景自己淡出**：渲染模式禁用 transition；硬切与切点闪白只由 `timeline.js` 统一计算，场景里再叠一层会变成双曝光。
11. **写死颜色**：场景里出现 `#hex` / `rgba()` 会让换主题时留下“补丁色”。只用 `var(--token)`；CSS 字面量 `npm run check` 直接报错，JS 字面量会给警告。
12. **给某个主题写特例**：不要在场景 CSS 里写 `html[data-style="cinema"] .xxx`；主题差异只放 `styles/themes/<name>.css`。
13. **结算数字停在占位符**：计数器区间结束太晚或条件没兜底，会停在 `—` / `NaN`。到场景 70% 时必须显示最终值，见上一节的“节奏预算”。
14. **动画结束了但没退场**：元素停在 opacity 0.2 的位置会被判为残影；要退就退到 0，要不就让它被后续内容完全盖住。

## 8. 素材接入（可选）

默认全代码绘制。有真实照片/视频时，只替换 `kit.frame()` 的插画，**不改场景动画**。

```bash
cp alley.jpg assets/media/s1-alley.jpg
cp store.mp4 assets/media/s4-store.mp4
npm run media        # 视频抽帧 + 写 js/media.generated.js
npm run check        # 校验键、场景、文件
```

- 文件名以场景 id 开头：`s1-alley.jpg` / `scene1-alley.jpg` / `01-alley.jpg`；也接受镜头编号 `1-…` 与通配 `*`。
- 场景键优先 `场景 id` → `镜头编号` → `*`；`timeline.js` 在 `mount` 前设置 `window.__KIT_SCENE`，`kit.frame()` 据此取图。
- 一个场景多张图会在片内按进度轮换（`timeline.js` 改 `src`）；Ken Burns 由 `--scene-p` 驱动，暂停/逐帧一致。
- 也可以直接写 `config.mediaFrames`：`{ "s1": "assets/media/a.jpg", "s4": [{ "src": "b.jpg", "focus": "50% 30%", "alt": "店内" }] }`；`focus` 映射到 `object-position`。
- 素材会继承主题的网点/暗角/纸色混合；`styles/components.css` 的 `.frame.media` 已处理 `object-fit: cover` 与缩放，不要在场景里再写图片尺寸。
- 只支持本地相对路径；`check-project` 会拒绝不存在的文件与非图片（除非已抽帧的视频）。

**真实界面抓帧**（产品/软件类首选，比插画更可信）：

```bash
node tools/capture-web.js --url http://localhost:5173 --scene s4 --seconds 4 --fps 12 \
  --scroll 0,900 --cursor "320,420;980,520" --click ".run-button"
npm run media && npm run check
```

- 产物是 `assets/media/s4-cap-0001.jpg …` + 清单，按场景 id 自动接入；Ken Burns 与调色照常生效。
- 滚动/光标用时间函数缓动，预览与逐帧一致；`--click` 在加载后点击一次，适合展开菜单/触发状态。
- **只抓自有或已明确授权的页面**；不抓竞品/第三方站点，不绕过登录、付费墙或访问限制。

## 9. 加场景 / 删场景 / 改时长

### 加一个场景

1. 按分镜表新建 `js/scenes/sX-*.js`（id 与起止来自分镜表），改布局与画面。
2. 在 `js/script.js` 加对应文案节，并在 `subtitles` 里补该段字幕。
3. 在 `index.html` 中、`timeline.js` 之前加入 `<script src="js/scenes/sX-*.js"></script>`。
4. 调整相邻场景的 `end/start`，确保 60s 基准连续无重叠。
5. `npm run check && npm run qa`（qa = 静态 → 版式 → 节奏 → 抽帧）。

### 删一个场景

删文件、删 `script.js` 对应节、删 `index.html` 引用、把时间让给相邻场景；不要留空档。最后一场仍须 `end: 60`。

### 改总时长

只改 `js/config.js` 的 `duration`；场景起止、字幕、配乐、封面都会自动跟随（`posterAt` 保持 60s 基准）。

片长明显缩短时，额外做一次字幕密度检查：30s 片建议 ≤ 12 条，15s 片建议 ≤ 7 条；否则单条会被压到 1 秒以下。`npm run check` 会对过短字幕告警。

## 10. 渲染前自检

- [ ] `npm run doctor` 全绿（Chrome/ffmpeg/磁盘）。
- [ ] `npm run check` 通过（含 look/版式契约、主题契约、对比度、字幕、素材、颜色字面量）。
- [ ] `npm run qa` 通过（版式无出框/裁切/字幕碰撞，节奏无占位符/残影/空尾帧）。
- [ ] 抽帧每张图都看过，切点前后无半截元素，82% 收尾帧不空。
- [ ] 换过主题/look 的话，`npm run styles` 或 `npm run look:gallery` 的静帧都看过。
- [ ] 竖屏工程用 `--vertical` 建，字幕在底部安全区，主体没被 `portrait.css` 挤出。
- [ ] 用了素材：`npm run media` 后 `npm run check` 通过，Ken Burns 不裁掉主体。
- [ ] 用了抓帧：页面为自有/已授权，交付说明写明来源；`--scroll/--cursor` 在成片里不抖。
- [ ] 成片跑过 `npm run qa:motion`：静态帧占比 ≤25%、帧差均值 ≥0.6（实拍/科技 look 应 ≥1.5），没有 ≥1.2s 的静止段。
- [ ] 用了旁白：`npm run voice:dry` 看溢出，`npm run voice` 后 encode 日志有旁白与闪避。
- [ ] 任意暂停，标题完整、正文不出框、字幕不压主体、数字已落值。
- [ ] 场景间页眉/页脚连续，品牌名一致。
- [ ] 没有未使用的 `console.log`、没有外部图片/网络请求、没有写死颜色。
- [ ] 最后一场 `end === 60`（基准时间，不是 `C.duration`）。
