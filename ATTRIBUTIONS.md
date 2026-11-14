# 来源与致谢

`brief-to-video` 的代码、模板与文档为原创实现，许可为 MIT（见 `LICENSE`）。视觉语言、节奏规则与验证方法参考了以下公开作品；**未复制其源码**，只把其中的判断方式改写成适合逐帧视频的实现。

## Taste Skill

- 来源：Leonxlnx/taste-skill（作者 Leon Lin 与 blueemi）
- 许可：MIT
- 地址：https://github.com/leonxlnx/taste-skill
- 借用内容：grounds / moments / 动效与系统的分层检查法、反 AI 俗套清单。
- 落点：`references/design-dna.md` 的三层结构（Ground → Content → Moment），`references/design-taste.md` 的审美检查项，`js/engines.js` 的“每片只允许一处过度设计”约束。

MIT 许可允许修改与再分发；如后续直接引入其代码片段，需在对应文件保留版权与许可声明。

## Impeccable

- 来源：pbakaus/impeccable（作者 Paul Bakaus，源自 Anthropic 的 frontend-design skill）
- 许可：Apache License 2.0
- 地址：https://github.com/pbakaus/impeccable
- 借用内容：motion-design 的 100/300/500ms 时长梯度、ease-out 家族与禁回弹、bolder / overdrive 的“每版一处”原则。
- 落点：`references/design-dna.md` 第 3 节；`js/easing.js` 的缓动选择；场景入场 0.35–0.6s 的节奏预算。

## Anthropic · frontend-design

- 来源：anthropics/skills 的 `frontend-design` 技能
- 许可：Apache License 2.0（该技能目录内 `LICENSE.txt`）
- 地址：https://github.com/anthropics/skills/tree/main/skills/frontend-design
- 借用内容：先定视觉方向再写实现、把审美判断写成可执行步骤与验证门的工作流。
- 落点：`SKILL.md` 的工作流顺序（先 look → 再分镜 → 再画面），以及 `references/design-dna.md` 的“签名动作”检查。

## 其他

- `references/design-taste.md` 第 10 节归纳的 2026 年热门设计类 skill 仅作为清单与思路来源，未复制代码；具体条目以该文件记录为准。
- 模板中的字体使用系统字体（宋体 / 苹方 / Noto 系列），不随包分发字体文件。
- 音乐由 `synth-music.js` 本地合成，不含第三方采样；旁白由 macOS `say` 生成。

如你认为某处引用需要更精确的署名或移除，请提 issue，我们会尽快处理。
