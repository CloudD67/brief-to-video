# 交付前自检修复 · repair loop

> 渲完 ≠ 做完。最后 10 分钟的自检修复，比交付后返工便宜一个数量级。
> 触发时机：**每次快做完时**（编码成功、准备交付之前），以及任何一次改了场景/主题/音乐之后。

---

## 0. 两层门禁：写作门禁与交付门禁

自检修复不是最后一步才开始。工程里有两个入口，任何一层不过都不许往下走：

```bash
npm run gate:pre   # 写作门禁：treatment 结构 + check-project（含 config.shots 分镜契约）/ MV 单测
npm run gate       # 交付门禁：上面的全部 + repair --strict（variety WARN 也按失败处理）
```

- 写作门禁在**开渲前**跑：treatment 缺方向锁/空间/序列/候选镜/色域，或 `config.shots` 与场景不一致，直接失败；这时改稿比改画面便宜。
- 交付门禁在**编码后、交付前**跑：它串起 `repair.js --strict`，把新鲜度、容器、抽帧、运动、色彩一次判完，报告写 `qa/gate.json`（各环状态）与 `qa/repair.json`（细节）。
- `npm run repair` 仍然保留给单轮修复循环；但**最终交付必须以 `npm run gate` 通过为准**，不能只贴一份 repair 报告。

---

## 1. 一条命令

```bash
npm run repair          # = node tools/repair.js .
```

它按顺序查六件事，报告写 `qa/repair.json`，抽帧写 `qa/repair/stills/`：

| 检查 | 判据 | 失败级别 |
|---|---|---|
| **成片新鲜度** | `js/ styles/ index.html assets/media` 的 mtime 不得晚于 `out/final.mp4` | ERROR（stale-render） |
| **音轨新鲜度** | `assets/music.wav` / `voiceover.wav` 晚于成片 | ERROR（stale-audio，重编码即可） |
| **容器** | 时长 = `config.duration`（±0.15s+半帧）、分辨率 = `config.width×height`、有配乐就必须有音轨 | ERROR |
| **危险时刻抽帧** | 每个切点前 0.3s / 后 0.24s、每场 82% 收尾、封面 | 证据 |
| **近空帧** | 抽帧灰度标准差 < 1.5（纯色）或 < 4（接近空白） | ERROR / WARN |
| **触边** | 声明过的时刻（`--border` 或 `config.repair.borderShots`）最外 2px 环里非背景占比 > 30% | WARN（可能裁切，也可能是有意全出血） |

工程里有 `qa-motion.js` / `qa-variety.js` 时，会顺带跑运动和色彩体检，并入同一份报告：

- 运动：静止帧占比 > 50% 或均值 < 0.4 → ERROR；> 25% → WARN；静止段 ≥ 1.2s → WARN；
- 色彩：主色域 > 60% / 色域 < 3 / 明暗跨度 < 0.10 / 饱和度中位 < 0.10 → WARN。

**MV 工程同一命令、换一套采样与清单**：分镜从 `js/film.js` 的 `shots` 读，抽每个切点前 0.25s / 后 0.24s + 每镜 78% 收镜帧 + 封面；清单换成歌词安全区、纸层高光与投影、主动作收束、硬切无残留。`assets/genres/mv` 模板已内置 `tools/repair.js`、`qa-motion.js`、`qa-variety.js`。

退出码：errors > 0 → 1；`--strict` 时 warnings 也 → 1。

---

## 2. 修复循环（固定顺序）

```bash
node render.js --at 3.0,31.8,47.0        # 1. 只渲嫌疑时刻，核对改动
node render.js --scale 1 && node encode.js   # 2. 全片重渲 + 重编码
npm run repair                            # 3. 再自检，errors=0 才交
```

- 只改文案/状态 → 仍要重渲（成片是烧录的）；
- 只换音乐/旁白 → 重编码即可，repair 会精确报 `stale-audio`；
- 修完不跑 repair = 没修完；最后一次有意义的时间戳必须是 `qa/repair.json`。

---

## 3. 缺陷目录（真实病例）

### 3.1 轨迹残影压在新内容上

- 症状：交接镜头的虚线/胶囊在新窗口标题上停了一两帧。
- 原因：路径、线头、胶囊、旧弹窗各自有淡出窗口，但没有对齐到“新内容可读前”。
- 修法：所有退场元素在**新内容可读前 0.2–0.35s** 归零；`screen.wire().seek(local, t0, dur, outAt)` 的第四参数就是这个退场起点。
- 复核：切点后 0.2–0.35s 抽一帧。

### 3.2 空场上孤立的光点

- 症状：连线还没出现，桌上先有一个青色小点。
- 原因：线头的可见窗口没有跟路径同步，路径未出现时头部已经 opacity>0。
- 修法：头部透明度 = 进度 × 退场系数；路径 `opacity=0` 时头部必须为 0。

### 3.3 表面像白板 / 像消失

- 症状：触控板比掌托亮一大截，或调暗后与掌托同色到看不见。
- 修法：目标比掌托暗 8–12 级；嵌套 `color-mix`，加 1px 发丝边；不要大阴影。
- 复核：用 `sips` 或 Python PIL 在成片里取点，多点采样；**不要用 ffmpeg crop 采色下结论**（滤镜链里可能取到缩放后的错误颜色）。

### 3.4 时间线矛盾

- 症状：18:20 的场景一开镜就是 21:05 的完成日志与“已合并”。
- 修法：日志渐进揭示；状态只在一个本地时间点切换（如 `local >= 1.72`）；早晨/傍晚/深夜各用各的日志内容。

### 3.5 场景继承错误内容

- 症状：23:40 的归档镜头显示早晨 09:43 的日志。
- 修法：内容与场景时间绑定；每个时间段有独立的数据源。

### 3.6 键位不像真机

- 症状：空格显示成 `␣`，右上角是 PC 的 `del`。
- 修法：空格用 NBSP（`\u00A0`）；右上角电源/Touch ID 用 `⏻`；15 列布局，F 排 12 键 + esc + 电源。

### 3.7 构图裁切

- 症状：产品镜头推到最大时，上盖顶角被画框切掉。
- 原因：相机 `ty = (cy ?? 540) − fy × s`，最大 scale 时 `ty < 0`。
- 修法：先按最大 scale 算一遍，保证 `ty ≥ 0`（顶部留 ≥8px）；宁可少推 0.03。

### 3.8 成片过期

- 症状：改完场景又改了文案，但没有重渲就交付。
- 修法：repair 的 `stale-render` 会直接判 ERROR；`build` / `build:1080` 已经把 repair 串在编码之后。

### 3.9 画面贫 / 颜色单一

- 症状：全片一个空间、一套颜色，像功能演示；MV 则是全片一种 mood、歌词配空镜。
- 根因不在 repair，在**扩写**：宣传片见 `references/brief-expansion.md` 与 `references/hardware-promo-grammar.md`；MV 见 `references/mv-craft.md` §0（故事弧/歌词段/镜头候选/mood）。
- 机器判据：`qa:variety` 主色域 > 60%、色域 < 3、明暗跨度 < 0.10；`qa:motion` 静止帧 > 25%。
- 修法：回到 treatment 补世界镜头与色彩脚本（MV 补镜头与 mood 段），不是给现有画面调色。

---

## 4. 像素取证

- 颜色：`sips` 取尺寸；取点用 Python PIL（`Image.open(...).getpixel`）或 Canvas，多点采样；
- 亮度/运动/色彩：直接信 `qa:motion.json` / `qa/variety.json` 的数值，不靠肉眼猜；
- 抽帧：`node tools/grab.js out/final.mp4 <秒...>`，一个时间点一次 ffmpeg，避免重复帧；
- 全片一致：抽帧的尺寸必须是成片尺寸（1920×1080），先用 `sips -g pixelWidth -g pixelHeight` 验。

---

## 5. 交付门

1. `npm run gate` 通过，`qa/gate.json` 各环 `ok: true`；
2. `qa/repair.json` 的 `ok: true`，每条 WARN 都被看过并注明“有意/已修”；
3. 修复清单 8 项逐项打勾（轨迹、时间线、状态、硬件、数字、残影、声音、封面）；
4. `qa/repair/` 抽帧逐张看过，尤其是切点前后与 82% 收尾；
5. 成片 mtime 晚于所有源文件。

五项全过，才写交付报告。