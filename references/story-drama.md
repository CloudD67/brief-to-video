# 3D 横屏短剧（story）：1920×1080 对白戏的写与拍

第三种类型，和 promo / mv 并列。**promo 是编辑排版，MV 是剪纸歌词画布，story 是横屏 3D 对白戏**：一条 8–180 秒的完整单集，人物在 3D 布景里说话、沉默、错过，靠对白与反应推进。参考形态是横屏叙事短片、电影感情感短片、B 站/YouTube 上的剧情短片。

**3D 赛道只做横屏 16:9，不做竖屏**：模板、脚手架、校验器都只接受 1920×1080；竖屏短剧请用 promo 的 9:16 或另做竖屏模板，不要在这个赛道里缩放。

模板 `assets/genres/story` 自带示范集《雨停之前》：40s / 15 镜 / 13 句台词 / 4 个角色，雨夜面摊，她多要了一碗面，等一个说“马上到”的人。

## 一句话区分

| 类型 | 观众在等什么 | 靠什么推进 | 声音 |
|---|---|---|---|
| `promo` | 记住一个卖点 | 版式、空间、文案节奏 | 旁白可选 |
| `mv` | 跟着歌走完一段情绪 | 纸层画面 + 歌词 | 成品歌或合成配乐 |
| `story` | 这一集到底成没成 | 对白、反应镜头、信息差 | 默认**多角色对白配音 + 配乐**；用户明确不要 TTS / 字幕时走静默版（道具、动作、光、配乐叙事，`encode.js --no-voice`） |

story 里没有 look / 主题 / 版式 / 引擎，也没有歌词与纸张语法。它是第三套时间线与第三套 QA，不要和另外两种混搭。静默版只去掉配音与字幕两样，故事结构与反应镜头不变——**没有台词时，信息必须由镜头先后和道具承担**，不能靠画面里打字。

## 工程结构

```text
assets/genres/story/
├── index.html              # 舞台 + 字幕层 + 手机层 + 片尾卡
├── styles/story.css        # 字幕安全区、手机对话框、片尾卡、HUD
├── js/config.js            # 1920×1080 / 40s / 24fps / 后期参数 / 安全区 / 封面
├── js/script.js            # 剧本层：cast / lines / phone / titleCard
├── js/film.js              # 分镜：绝对秒数 + anchor + fov/push/focus/cast
├── js/three-kit.js         # 舞台、后期（bloom/景深/颗粒/暗角）、fx（雨/溅水/尘）
├── js/three-sets.js        # 布景 + 剪纸人物 + 机位表 anchors + update(t)
├── js/timeline.js          # 分镜调度：相机、人物可见性、字幕、手机、片尾卡
├── tools/validate-story.js # 故事契约校验（断档/越界/角色/手机字段）
├── tools/voiceover.js      # 按角色多声线配音，产出 voiceover.wav + json
├── test/story.test.js      # 契约单测 + 配音时长单测
├── render.js               # 逐帧截图（--scale 1 = 1080p 原生）
├── encode.js               # VideoToolbox 编码 + 人声/配乐混音闪避
├── synth-music.js          # 合成配乐
└── vendor/three.min.js
```

three-kit / three-sets 的通用 API（`createStage`、`renderAt`、后期字段、`fx`、机位锚点）见 `film-tech.md` §1；本节只讲 story 专属契约。

## 剧本契约（js/script.js）

所有可见文字与声音都在这里，`film.js` 只排镜头。

```js
cast: {
  her:  { name: "她", voice: "Tingting", rate: 176, color: "#ffd9b0" },
  him:  { name: "他", voice: "Meijia", rate: 164, pitch: 0.82, color: "#9fc6ff" },
  owner:{ name: "老板", voice: "Meijia", rate: 148, pitch: 0.72, color: "#e8c98f" },
  narrator: { name: "", voice: "Meijia", rate: 180, color: "#cfd8e4" }
},
lines: [
  { at: 0.6, dur: 2.3, who: "narrator", text: "雨下了一整夜，面摊还亮着。" },
  { at: 5.7, dur: 1.2, who: "him", text: "我到了。", screen: true },  // 只出现在手机屏，不挂字幕
  { at: 36.6, dur: 1.3, who: "her", text: "坐吧，还热着。" }
],
phone: { time, contact, incoming, typing, sent, status },
titleCard: { at, to, title, en, hook },
```

规则：

- `at` / `dur` 是**成片绝对秒数**；`dur` 既是字幕槽位，也是配音时长上限。
- `who` 必须在 `cast` 里；`narrator` 的 `name` 留空，字幕只出文字不出名字。
- `screen: true` 的台词只进手机屏（`phone.incoming` 等内容），不挂底部字幕，但照样配音或留作屏幕字。
- `pitch < 1` 用 ffmpeg 降调模拟男声/老人声；基础语速用 `rate`（wpm）区分角色：年轻女性 172–180、男性 160–168、老人 140–150、旁白 176–184。
- `titleCard.at/to` 不要和台词重叠——片尾卡出现时台词应收完；`titleCard.hook` 是下一集钩子，一句话讲清楚“接下来要看什么”。
- `episode` 与 `config.brand / brandSub` 是系列标注，换集只改这里。

## 分镜契约（js/film.js）

```js
{ id: "s05", start: 10.4, end: 13.0, anchor: "herSide",
  fov: 36, push: 0.2, drift: [0.02, 0], focus: 1.9, aperture: 1.3,
  cast: { owner: false }, phone: false,
  note: "她的侧脸藏在伞下，眼睛看向巷口" }
```

- **时间连续**：从 0 到 `config.duration` 首尾相接，不许断档、不许重叠、id 唯一。
- **anchor** 必须存在于 `three-sets.js` 的 `anchorList`；`pos / look / fov` 可覆盖 anchor。
- `push` 是本镜推近米数（0.1–0.6），`drift` 是横向漂移；每镜至少有一个在动，**没有静帧**。
- `focus` 是对焦距离（米），`aperture` 越大景深越浅；近景/特写常用 1.4–1.9。
- `cast: { her: false }` 临时关掉角色（空镜、桌面、对方视角）；不写就是全开。
- `phone: true` 的镜头必须配 `script.phone` 字段；手机层会叠加在画面上。
- 每镜 2–4 秒；一集 8–45 镜（40s 约 15 镜）。`note` 写这一拍发生什么，写不清就是没想好。

## 布景与人物（js/three-sets.js）

模板的 `buildNeonAlley` 是雨夜面摊布景，返回：

```js
{ anchors, characters: { her, man, owner }, stall, phone, update(t) }
```

- 锚点表 `anchorList` 是导演的机位库：`wide` 建立、`herBack / herSide` 过肩与侧脸、`bowl` 桌面插入、`counter` 老板近景、`alley` 空巷、`two` 双人、`end` 收尾。换故事时**先改锚点表，再排分镜**。
- 人物是剪纸风格的 canvas 贴片（`personTexture(kind)`），不是 3D 模型：脸、发、围巾、外套、肩线、胡茬都画在贴图上，贴在立面上。人物比例 `mkPerson(kind, w, h)` 与站位 `position.set` 要一起调——改宽高不改站位会穿模或悬空。**这是 previs 的人物**：定构图、走位、对白节奏够用，但不适合当最终成片的“真实感”。要真实感 CG 时切 `engine: 'cg'`，场景写进 `cg/film.py`，见 `cg-pipeline.md`；程序化角色与口型见 `cg-characters.md`，布料/火焰/刚体/水花见 `cg-vfx.md`。
- 布景的 `update(t)` 只做确定性微动（呼吸、霓虹闪烁、水洼法线滚动）；不许 `Math.random()` / `Date.now()`。
- 示范集里的 `man` 从巷子深处走来是 `timeline.js` 的编排（29.4s 淡入、30.2→34.0s 沿左侧开口巷道走到摊前、33.6→35.2s 横移到她身边）；换故事要同步改 `applyCast`，否则人物会凭空出现或走到一半停住。
- **先算视线，再排机位**：摊子的背板（z≈-4.15、x≥-1.4）会截断“从摊前看向巷子深处”的视线，人物在深处走了整段也看不见。机位与走位要一起改：把来向移到左侧开口巷道（x≈-2.4），机位也移进巷道（x≈-1.6），并用 0.6s 的 `material.opacity` 斜坡让人物从雨雾里淡入。新机位先用「机位→人物」射线在挡板平面算一次交点，交点落进挡板范围就换机位或改走位，不要等渲完才发现。

## 时间线（js/timeline.js）

- `render.js` 只调 `window.pauseAt(t)`，所有状态是 `t` 的纯函数：相机位置、景深、人物可见性、字幕透明度、手机对话框、片尾卡。
- 相机：`ease(local/dur)` 推近 + `drift` + 低频手持微动（`handheld`，默认 0.006）；切镜是硬切，不加转场。
- 字幕：`lines` 自动生成 DOM，按 `at/dur` 淡入淡出；`screen:true` 不生成字幕条。
- 手机：`phone:true` 镜头显示对话框，按镜头内时间推进“对方消息 → 我方回复 → 正在输入”；`s03` 有专门的逐条出现节奏，换镜头 id 要改 `renderPhone`。
- 片尾：`titleCard` 淡入片名、英文名与下集钩子；最后 0.45s 全片淡出。
- 换故事时，`applyCast` 里的人物走位、`renderPhone` 里的镜头 id 分支是仅有的两处“示范集私有代码”，必须改。

## 横屏语法

- **画幅固定 1920×1080**：`new-film.js` 拒绝 9:16 与 4K；story 只做 1080p 横屏。`render.js` 与校验器都会在非 16:9 时直接报错。
- 安全区：`config.safe = { top: 80, bottom: 120, side: 120 }`。字幕在底部 120px 以上、左右各留 16%；片名与钩子不要贴边。
- **16:9 横向视场更宽**：取景要用上左右两侧（环境、反打、双人关系），但主体不要散在三个角上；一帧一个视觉重心。中近景仍是主力，40s 一集里 `wide` 建立不超过 2 镜。
- 横向构图优先“人对人”：双人镜留出两人之间的空隙让情绪流动；单人镜把视线方向的反侧留白，不要把人钉在正中间。
- 统一轴线：她在摊前，老板在灶后，他来向从巷子深处（画面纵深处）入画；越轴会让人瞬间迷路。横屏里左右走位更显眼，越轴代价更大。
- 光线是叙事：面摊暖光、巷口冷雨、手机冷白；同一场戏里不要三种主光抢。
- 每镜都要有人或物在动：雨、蒸汽、霓虹、呼吸、推镜、手机文字。静止画面超过 1 秒就是事故。

## 一集的写法

一集只回答一个问题（“他会来吗？”“这碗面她吃不吃？”）。五拍：

1. **钩子（0–3s）**：一个不完整的动作或一句没头没尾的话，让人想知道下文。
2. **欲望**：主角要什么，用动作说（多下一碗、留一盏灯、拨一个电话），不用旁白解释。
3. **阻力**：什么挡着——迟到、沉默、面子、天气；阻力必须具体到可拍。
4. **转折**：信息差被打破（消息停住、伞出现、碗凉了）。
5. **落点 + 钩子**：给出这一集的答案，同时抛下一集的问题。

对白写法：

- 一句 6–14 字，口语，不写书面句；一屏只有一句。
- 台词必须有落点镜头：谁说的、听的人什么反应、画面里发生什么。
- 允许沉默：老板问“面要坨了”，她只回“再等等”，比解释十句有力。
- 旁白只做时间与气氛（“雨下了一整夜”），不替人物说心事。
- 全片台词 10–16 句；40s 一集超过 18 句会变成广播剧。

## 配音

```bash
npm run voice:list     # 列出系统中文语音
npm run voice:dry      # 只算时间，不出音频：核对每句字数与槽位
npm run voice          # → assets/voiceover.wav + assets/voiceover.json
```

- 只用**已下载**的系统语音。新列出的 Flo/Eddy/Grandpa/Sandy/Reed/Rocko/Shelley 若未在系统设置里下载，`say` 会输出 0.01s 静音——先试听再定角色声线。稳妥组合：Tingting（女）、Meijia（中性，降调演男声/老人）。
- `pitch` 走 ffmpeg：`asetrate=48000*p, aresample=48000, atempo=1/p`，时长不变、音色降低。男声 0.78–0.86，老人 0.68–0.74。
- 每句实测时长写进 `voiceover.json`；超出槽位 0.35s 会警告。修法：先缩文本，再提 `rate`，最后才动 `dur`（动 `dur` 要同步查分镜切点）。
- 台词跨切点是允许的，但**字幕槽位跨切点会被校验器警告**——要么挪切点，要么收短台词。示范集把 s01 收在 2.9s，就是因为第一句旁白 2.58s。
- encode 自动混音：人声增益 1、音乐 0.4、侧链闪避；无 voiceover 时输出纯配乐，但 story 的交付标准是有对白。

## 校验与测试

```bash
npm run story          # 契约校验；有 warning 但仍可渲染
npm run story:strict   # 警告也失败，交付前用
npm test               # 8 项单测：契约、1920×1080、断档、越界、角色、配音时长
```

校验器 `tools/validate-story.js` 检查：

- 画幅必须 1920×1080（16:9 横屏）；时长 8–180s；fps ≥24；`safe.bottom` ≥96。
- 分镜从 0 连续到片长、id 唯一、anchor 存在、fov/push/focus 在合理区间、note 非空。
- 每句台词落在某个镜头内；`who` 在 cast；台词按时间排序；同镜台词不重叠；跨切点警告。
- `phone:true` 镜头必须有 `script.phone` 字段；`titleCard` 必须存在且不与台词重叠；`endHook` 非空。
- `--json` 输出结构化结果，`--strict` 把警告升级为失败。

单测还用临时工程验证校验器**确实能抓到**断档、越界与未知角色——只测“通过”不测“抓错”的契约等于没测。

## 渲染与交付

```bash
npm run stills                          # 10 张关键帧 → stills/，先目检
node render.js --scale 1                # 960 帧（40s × 24fps），原生 1920×1080
node encode.js                          # VideoToolbox → out/final.mp4（人声+配乐闪避）
npm run repair                          # 交付前自检：新鲜度/容器/切点抽帧/空帧/触边
```

- 抽帧重点：建立镜、每个角色的近景、手机插入、空镜、双人镜、片尾卡。
- 人物检查：脸有没有被裁、脖子是不是过长、肩线是否像方块、衣服有没有变成围兜。剪纸人物的通病是“长得像保温杯”——先修比例再谈表演。
- 桌面插入检查：碗不能被画框切掉一半，热气要在画面里，不能只有空台面。
- 编码后核对：`1920x1080`、40.00s、H.264 High / yuv420p / bt709、AAC 48kHz 立体声、响度均值 ≈ −20 dB 不削波。
- 交付只留 `out/final.mp4` 与 `out/poster.png`；`frames/`、`stills/`、`out/video.mp4`、`assets/.voice/` 都是中间产物，交付后清掉。

## 常见错误

| 症状 | 原因 | 修法 |
|---|---|---|
| 人物像保温杯/木乃伊 | 脖子过长、躯干是方块、围裙像围兜 | 加宽脸与颈、斜肩路径、V 领、围裙改肩巾，机位拉近 |
| 老板只露一颗头 | 人物站在台面后但没有抬高 | 人物整体上移（垫苹果箱），或换 `counter` 近景锚点 |
| 桌面镜只有一只碗/碗被切 | 碗位与相机横向不匹配 | 两只碗放 0.95/1.42，相机对准 1.2 俯拍，fov 50 |
| 红块出现在近景背景 | 布景后方穿透/道具过大 | 加宽后墙板（4.6×2.6），检查发光材质 |
| 人物凭空出现/走一半停住 | `applyCast` 的走位时间没跟分镜改 | 人物出现时间、走到位时间与镜头切点对齐 |
| 配音整轨静音 | 选了未下载的新语音 | `voice:list` + `say` 试听，只用 Tingting/Meijia 等已下载声线 |
| 句子比槽位长 | 文本太长或 rate 太低 | 先缩文本，再提 rate；改 dur 要复查切点 |
| 校验器报跨切点 | 台词槽位压在两个镜头之间 | 挪切点或收短台词，不要忽略 strict |
| 全片像广播剧 | 台词太多、镜头不动 | 删到 10–16 句；每镜加推镜/雨/蒸汽/呼吸 |
| 横屏里人物太小 | 机位太远或 fov 太大 | 中近景为主，`wide` 一集不超过 2 镜；必要处收 fov 或推近 |
| 画面两侧空/主体挤在中间 | 沿用竖屏构图习惯 | 用横向关系构图：双人留空隙、单人留视线反侧，环境进两侧 |

## 与另外两种类型的边界

- story 工程里不出现 look / 主题 / 版式 / 引擎 / 纸层 / 歌词。
- 不“先建 promo/MV 再改成 story”，也不把 story 模板拿去拍产品卖点。
- 参考片只学方法（横屏构图、对白节奏、反应镜头、信息差），不复制角色、台词、画面与音乐。
