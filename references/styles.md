# 视觉风格系统

> 主题只是 look 的一个轴。完整的 12 个 curated look（主题×版式×动效）、自动选择、版式与竖屏见 `looks.md`；本文只管**主题层**：颜色、字体、质感、字幕处理。

## 1. 五个预设，一套版式

模板内置 5 个主题。**场景布局代码只有一套**，换主题只换语义令牌（颜色、字体、质感、字幕处理、画幅留黑），不重写 `js/scenes/*`。版式由 `styles/layouts.css` 独立控制，不要塞进主题。

| 风格 | 一句话 | 底色 / 墨色 / 强调 | 字体 | 字幕 | 适合 |
|---|---|---|---|---|---|
| `letterpress` | 会动的印刷品，默认 | 米纸 / 墨黑 / 朱红 | 宋体 900 | 左对齐 + 红块 + 时间码 | 品牌片、工作室、文化、活动 |
| `swiss` | 国际主义网格，无质感 | 冷白 / 纯黑 / 正红 | 无衬线 700 | 左对齐粗体 | 科技、软件、数据、建筑、极简 |
| `cinema` | 暗厅放映，金色点缀 | 近黑 / 米白 / 古金 | 宋体 600 | 居中斜体意向 + 上下黑边 | 影像、叙事、高端产品、预告 |
| `quiet` | 暖白纸感，低对比 | 暖白 / 炭灰 / 鼠尾草绿 | 宋体 500 + 无衬线正文 | 左对齐 + 圆点 | 生活方式、餐饮、疗愈、手作 |
| `tech` | 深色仪表盘，青色信号 | 深蓝黑 / 冷白 / 青色 | 无衬线 700 + mono | 左对齐 + `▸` | AI、开发者工具、硬件、安全 |

选风格看三件事：**观众是谁、片子要显得“印刷/现代/电影/安静/技术”中的哪一种、品牌已有色**。拿不准时：企业客户 → `swiss`；消费品牌 → `quiet`；作品/影像 → `cinema`；开发者 → `tech`；讲工艺与编辑判断 → `letterpress`。

## 2. 怎么切换

建工程时：

```bash
node "$SKILL/scripts/new-film.js" ./my-film --style cinema ...
node "$SKILL/scripts/new-film.js" ./my-film --look cinema-editorial ...
```

已有工程：

1. 改 `js/config.js` 的 `style: 'cinema'`（或 `look: 'cinema-editorial'`）。
2. 或预览时在 URL 加 `?style=cinema` / `?look=cinema-editorial`（只影响本次）。
3. `npm run preview` 中按 `S` 轮换主题、`K` 轮换 look，直接看当前场景。

主题与 look 的优先级：URL > CLI（`--look` / `--style`）> `config` > look 默认值。

优先级：URL `?style=` > `config.style` > `letterpress`。未知风格会在控制台告警并回退默认，`npm run check` 会直接报错。

## 3. 令牌契约

全部令牌在 `styles/tokens.css`（默认值 = letterpress），主题在 `styles/themes/<name>.css` 里用 `html[data-style="<name>"]` 覆盖。**场景 CSS 与场景 JS 只准用 `var(--token)`，不准写死颜色**；`npm run check` 会扫十六进制/rgba 字面量。

`check` 会强制：`tokens.css` 定义全部根令牌；每个非 letterpress 主题覆盖 10 个核心令牌（`--paper / --paper-2 / --paper-3 / --ink / --ink-2 / --mute / --faint / --accent / --dark / --on-dark`）；主题文件有 `html[data-style="<name>"]` 选择器；CSS 花括号平衡；并按继承后的有效色计算 6 组 WCAG 对比度。

### 必须提供的令牌

| 组 | 令牌 | 说明 |
|---|---|---|
| 表面 | `--paper` `--paper-2` `--paper-3` `--paper-4` `--paper-hi` | 从底到高光；深色主题是反向亮度 |
| 墨色 | `--ink` `--ink-2` `--mute` `--faint` | 主文字到极弱信息 |
| 强调 | `--accent` `--accent-2` | 唯一强调色；`--red` 是 `--accent` 的别名 |
| 深面板 | `--dark` `--dark-2` `--dark-3` `--edge` `--on-dark` `--on-dark-2..4` | 伪 UI / 编辑器 |
| 字体 | `--font-display` `--font-sans` `--font-mono` `--title-weight` `--title-track` `--h1-size` `--h2-size` `--body-size` | 字号是 1080p 基准 |
| 字幕 | `--sub-font` `--sub-size` `--sub-weight` `--sub-color` `--sub-track` `--sub-marker` `--sub-align` | 决定字幕的长相 |
| 质感 | `--grain` `--fiber` `--vignette` `--halftone` `--scanlines` `--letterbox` `--letterbox-color` | 数值 0 即关闭 |
| 形状 | `--radius` `--shadow-hard/soft/card/panel` `--inset-shade` | 圆角与阴影气质 |
| 插画 | `--ill-ink` `--ill-paper` `--warm` | `kit.frame()` 的双色 + 暖点 |
| 影调 | `--f1-sky/mid/gnd` … `--f6-sky/mid/gnd` | 18 个值，缩略图/照片的六组影调 |

### 透明度

不要写 `rgba(0,0,0,.2)`。统一用：

```css
color-mix(in srgb, var(--ink) 20%, transparent)
```

线条用 `var(--hair)` / `var(--hair-2)`；主题会自动跟随墨色。

### 插画与照片

- SVG 插画：`fill="var(--ill-ink)"`、背景 `var(--ill-paper)`、一个暖点 `var(--warm)`；不要再引入第四种颜色。
- 缩略图/影调块：只用 `--f1…--f6`，深色主题已换成低亮度版本；不要在场景里调亮度滤镜。

### 黑边

`cinema` 用 `--letterbox: 54px` 生成上下黑边（`.letterbox.t/.b`，z-index 70）。黑边存在时，页眉/页脚与字幕会自动让位；其他主题 `--letterbox: 0px` 即无黑边。**布局安全区按有黑边计算**（内容不要贴到 y<54 或 y>1026）。

## 4. 每个主题的专属修饰

主题文件可以写少量结构性覆盖，但只允许改“表现”，不允许改布局坐标：

- `cinema`：`#subs` 居中、隐藏进度条、暗角加重、字幕上方金色细线。
- `swiss`：关闭纸纹/颗粒/暗角、页眉底线加粗、框线变纯黑、栅格可见。
- `tech`：`body::after` 扫描线、`.bg::after` 网格、页眉等宽字体、字幕前 `▸`。
- `quiet`：页眉变细、圆点标记、阴影变软、纸纹极轻。
- `letterpress`：默认，几乎不覆盖，保留裁切标记与纸感。

新增覆盖时选择器必须以 `html[data-style="<name>"]` 开头，避免影响其他主题。

## 5. 新增第 6 个主题

1. 复制 `styles/themes/quiet.css` 为 `styles/themes/<name>.css`，改选择器。
2. 至少覆盖：`--paper*`、`--ink*`（含 `--mute`）、`--accent*`、`--font-display`、`--title-weight`、`--h1/h2-size`、`--sub-*`、`--grain`、`--radius`、`--ill-*`、六组 `--f*` 影调。
3. 在 `index.html` 主题 `<link>` 列表里加一行（必须在 `base.css` 之前）。
4. 在 `js/config.js` 的 `style` 注释里补名字；`check-project` 会自动发现新主题。
5. 验收：

```bash
npm run check
node tools/style-gallery.js . --themes <name>   # 12%/42%/78% 三帧
node tools/qa-all.js . --style <name>           # 版式 + 节奏 + 引擎 + 抽帧 + 汇总
```

主题不算“完成”，直到三帧静帧与整套 QA 都干净。

## 6. 对比度与可读性底线

`npm run check` 会按每个主题继承后的有效色实测，低于阈值直接失败：

| 组合 | 阈值 | 用途 |
|---|---|---|
| `--ink` / `--paper` | ≥ 10:1 | 标题与正文 |
| `--ink-2` / `--paper-2` | ≥ 7:1 | 次级文字 |
| `--sub-color` / `--paper` | ≥ 7:1 | 字幕 |
| `--on-dark` / `--dark` | ≥ 10:1 | 深面板文字 |
| `--mute` / `--paper` | ≥ 4.5:1 | 注释/页脚弱化字 |
| `--accent` / `--paper` | ≥ 3:1 | 强调色、细线 |

- 深色主题（`cinema` / `tech`）：正文不要用纯白 `#fff`，用 `--ink`（略暖/略冷），减少眩光；暗面板上的次级文字不低于 `--on-dark-2`。
- 字幕永远用 `--sub-color`，不要在场景里另设颜色。
- 4K 缩到 1080p 后，正文不小于 20px、细线不小于 1px；`tech` 的扫描线透明度不要超过 0.55，否则影响字幕。

## 7. 风格与内容的匹配错误

- 用 `tech` 讲餐饮、用 `quiet` 讲安全产品，观众会先感到“不对”再读内容。风格是论点的一部分。
- 同一支片只用一个主题；不要在场景之间换 `data-style`。
- 不要为了“高级”把深色主题套在信息密集的画面上：深底 + 多字号 + 多线条会糊成一片，优先 `swiss`/`quiet`。
- 主题不能救文案：标题超过 10 字、字幕超过 18 字，任何主题都会挤。

## 8. 快速对照：brief 关键词 → 风格

| brief 里的词 | 首选 | 备选 |
|---|---|---|
| 克制、编辑、印刷、纸、工艺、文化 | `letterpress` | `quiet` |
| 现代、网格、极简、理性、数据、建筑 | `swiss` | `tech` |
| 电影、叙事、夜、舞台、奢华、预告 | `cinema` | `letterpress` |
| 温暖、日常、手作、咖啡、疗愈、自然 | `quiet` | `letterpress` |
| AI、开发、系统、监控、硬件、未来 | `tech` | `swiss` |
