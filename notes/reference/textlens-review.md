# TextLens 源码对照与拾句二期优化评估

评估日期：2026-10-26。性质：只读源码审查、公开模拟流诊断与下一轮方案。推荐尚未实施。

## 1. 基线、来源与证据口径

- 拾句基线：`1c09d2dc5e8118e72d5ae1c068414d0e4c903319`，`main...origin/main`；开始时工作区干净。类型检查通过，11 个测试文件的 56 项测试通过。没有拉取、提交、推送、发布或安装依赖。
- TextLens 固定审查提交：[77a31585a3f17ddfb5bd09d25bd6b54016db3076](https://github.com/ZH-heng/textlens/tree/77a31585a3f17ddfb5bd09d25bd6b54016db3076)。GitHub 连接器返回完整递归目录索引，200 个文件、`truncated=false`。重点读取 23 个文件，包含 Windows 取词后端、请求与协议、会话队列、窗口、前端事件存储与显示层；逐文件 Git blob SHA-1 校验全部相符。并未声称逐行审完所有 200 个文件。
- 本地参考路径：`.runtime/reference/textlens/`；完整索引 `textlens-tree.json`，来源及仓库元数据 `manifest.json`，校验结果 `blob-verification.json`。参考代码只存于忽略目录，未移入拾句产品。
- TextLens 的 `package.json:4,9` 声明版本 0.4.0、UNLICENSED；`src-tauri/tauri.conf.json:4-5` 为 0.4.0、`com.local.textlens`。本机安装版信息一致来自本轮用户提供的已核对信息；本轮没有检查其二进制、配置、Key 或历史。版本和标识不能证明安装二进制等于该提交。
- **许可证来源冲突**：本轮 GitHub 仓库元数据 `license.spdx_id=MIT`，固定提交的 [README.md:25-31](https://github.com/ZH-heng/textlens/blob/77a31585a3f17ddfb5bd09d25bd6b54016db3076/README.md#L25-L31) 则说明尚无独立开源许可证，并分别说明第三方材料；package 为 UNLICENSED。元数据是读取时的仓库状态，不等于固定提交的授权。本报告仅记录来源差异，不给出可整库复制的结论；不移植其代码、默认提示词或视觉资产。

下文 **S** 指拾句当前基线文件与行号，**T** 指 TextLens 上述固定提交的文件与行号。**代码事实**只证明控制路径存在；**本轮诊断**只证明隔离逻辑；**历史证据**来自项目文档，不能充作本轮复测；**推断/待验证**不作为性能或兼容性通过的结论。

文档时效冲突：`PRDS/plan.md:5` 仍写当时 release 不含修复；当前根目录 AGENTS.md、README.md 和发布流程已记录 alpha.2 的后续发布。本轮不修改这些真源，采用已确认的发布边界；计划中的拟建路径和未勾选验收项也不等于功能尚未实现。

## 2. 拾句已有，无需重做

| 已实现能力（代码事实） | 当前代码证据 | 验证边界 |
|---|---|---|
| 翻译、问 AI、复制；问 AI 打开后不生成；解释、润色、问题和追问 | S `src/main/desktop.ts:189-200`；`src/renderer/index.tsx:60-93,148` | 本轮未做完整桌面操作 |
| API 增量、取消、错误分类、断流与空回答检查 | S `src/providers/api.ts:25-67`；`tests/api.test.ts` | 9 项既有 API 测试通过；模拟不证明真实服务速度 |
| Codex 的代理环境、隐藏原生子进程、临时会话、限制工具、翻译 low 档位 | S `src/providers/codex.ts:13-66,129-188` | 9 项既有 Codex 测试通过；公开请求完整桌面验收仍不足 |
| 在途 API 配置冻结，不自动切换服务 | S `src/providers/router.ts:4-13`；`tests/provider-router.test.ts` | 新建 ApiProvider 对象不等于每次新建 TCP 连接，实际网络层为共享 Electron session |
| 独立问答与请求标识、后台生成、准确停止、防旧事件串入 | S `src/main/tasks.ts:25-77`；`src/main/desktop.ts:110-116,172-176` | 单元检查通过，真实双窗竞态仍需验收 |
| 固定窗与临时窗、边缘缩放、记住尺寸、逐条复制 | S `src/main/desktop.ts:86-116,202-231`；`src/renderer/index.tsx:84-91` | 原生焦点、物理拖边、多屏不能由组件存在推定通过 |
| 最近 100 次独立问答、活跃保护、重启中断与备份恢复 | S `src/main/tasks.ts:31-44,71-77`；`src/main/history.ts:40-80` | 本轮业务与存储测试通过，未完成真实重启全流程 |
| Windows 加密 Key、界面仅获保存状态、跨地址防误送；公开短句测试入口 | S `src/main/api-key.ts:3-17`；`src/main/desktop.ts:49-57,74-77,249-258` | 本轮未读取真实 Key，未发送真实模型请求 |
| 正文直接增量、接近底部才跟随滚动 | S `src/main/tasks.ts:59-60`；`src/main/desktop.ts:80-84`；`src/renderer/index.tsx:77-93,135-140` | 无额外打字机动画；30ms 合并发布是调度设计，不是实测上屏时延保证 |

## 3. AI 请求对照

| 主题 | TextLens 代码事实 | 拾句代码事实与判断 |
|---|---|---|
| 模型与参数 | T [actions.rs:2163-2181](https://github.com/ZH-heng/textlens/blob/77a31585a3f17ddfb5bd09d25bd6b54016db3076/src-tauri/src/actions.rs#L2163-L2181)：基础体只设 model、stream、messages，思考字段另加 | S `api.ts:47-49` 同样不指定 temperature、top_p、max_tokens。没有证据支持“它靠较小温度/输出上限必然更快” |
| 思考开关 | T [thinking.rs:336-386](https://github.com/ZH-heng/textlens/blob/77a31585a3f17ddfb5bd09d25bd6b54016db3076/src-tauri/src/thinking.rs#L336-L386)：依据能力和字段方言选择 reasoning_effort、enable_thinking 或嵌套字段；Off 在不支持时可以不发送字段 | S `api.ts:49` 无思考字段，服务默认生效；`codex.ts:185` 仅翻译指定 low。不能从 UI 的 Off 推断所有服务真正关闭思考，不能猜测 GLM-4-Flash 支持某字段 |
| 上下文 | T `actions.rs:43-45,2080-2099`：追问 20,000 字符，整组上下文 200,000 字符、最多 64 条消息，超限明确拒绝；`models.rs:10-12` 另有限制选区、提示和输出 | S `tasks.ts:43-51`、`api.ts:14-19`、`codex.ts:69-74` 重建全部已有轮次；`command-validation.ts:39-44` 只限制单次输入，未见请求级总上下文预算。长追问可能变慢或服务拒绝是推断，需公开长上下文验证；不建议静默删历史 |
| 连接复用 | T [actions.rs:648-664](https://github.com/ZH-heng/textlens/blob/77a31585a3f17ddfb5bd09d25bd6b54016db3076/src-tauri/src/actions.rs#L648-L664)：共享 reqwest Client，连接超时 15s、池空闲 300s、每主机 8 个空闲连接、TCP_NODELAY | S `desktop.ts:48-52` 复用 Electron defaultSession.fetch；API 包装对象按次新建，不足以证明无连接池。S `codex.ts:120,132-149,188` 则每次生成启动并关闭 App Server 进程，代理解析、握手、读配置与建临时会话是前置成本候选，尚无分段耗时支持改为常驻 |
| 超时 | T `openai_transport.rs:35-49,157-185,287-320,350-385`：请求头、首事件、首内容各 120s，流空闲 60s、总 600s；错误体读取 500ms；有效事件与内容分开 | S `api.ts:25-34,53-67`：空闲 45s、总 120s，任何 read 返回都会续期；请求头和首正文未分开，均显示 API_TIMEOUT。值得学分阶段判定，数值不直接照搬 |
| 重试 | T [actions.rs:1231-1306](https://github.com/ZH-heng/textlens/blob/77a31585a3f17ddfb5bd09d25bd6b54016db3076/src-tauri/src/actions.rs#L1231-L1306)、`thinking.rs:42-65`：仅在启发式 Off 控制被明确拒绝、尚无正文、未取消等条件下去字段再试一次，共用总预算并提示 | S `api.ts:45-67` 无自动网络重试；`tasks.ts:40-46` 用户重试替换末轮；`codex.ts:172-178` 展示 Codex 内部 willRetry 的反馈。TextLens 此逻辑不等于通用自动重试，更不等于切换服务 |
| 取消与限量 | T `openai_transport.rs:303-342,387-400` 每块/每 64KiB 检查取消，限制正文与思考大小；会话 ticket 检查阻止过时回调 | S `api.ts:31-34,41,53-67` AbortController、约 200 万 UTF-16 单元回答/缓冲上限，`tasks.ts:53-72` 请求身份及停止防护已在。取消能力无需重建 |
| 协议容错 | T `openai_protocol.rs:163-227` 分离思考与正文；完整帧 EOF 可标 CleanEofUnverified；T `actions.rs:1422-1479` 接受 JSON 响应并整段发出 | S `api.ts:35-62` 要求 SSE 完成标记，对无完成标记的流报中断，对 JSON 正文不提取。后者可作为兼容扩展候选，前者严格完成判断应保留，不能为了成功率把未知截断当完成 |

设置收益判断：当前服务地址、模型、Key 与公开测试入口已经够用。思考策略只有服务明确支持且同条件实测获益时才值得作为高级项；温度、top_p、连接池数、动画速度和分段超时不宜堆成普通用户必填设置。依据是以上请求构造、现有设置 S `renderer/index.tsx:109-128` 和项目首版范围；这是产品建议，未实施。

## 4. 增量到屏幕：传输快和看起来顺是两件事

**TextLens 当前调用链（代码事实）**

`Response.bytes_stream → SseDecoder → content/reasoning 回调 → session ticket/sequence + 有界队列 → 独立 flusher emit_to → bridge 监听 → actionEventStore 同步累加 → React 正文订阅 → useSmoothStreamText → 显示正文`。

- 网络读取和解码：T `openai_transport.rs:188-215,287-400`；正文即时回调，无等待凑完整答案的正常路径。
- 原生会话层：T `actions/session.rs:623-667` 当前每个 content delta 立即入队，TimerDirective::None；同文件 `:16,1015-1040,1150-1224` 设置 256 个待发事件上限及恢复机制。不能仅因文件保留 pending/flush 名字就认定正常内容被节流。
- IPC 与网络任务分开：T `actions.rs:1050-1099`，每发 16 个事件让出执行，不是等待 16 个才首发。前端就绪快照/ack 与序号恢复见 T `actions/session.rs:953-1013`、`renderer/result/resultSessionBootstrap.ts:78-145`。
- 前端逻辑数据：T [actionEventStore.ts:101-126](https://github.com/ZH-heng/textlens/blob/77a31585a3f17ddfb5bd09d25bd6b54016db3076/src/renderer/result/actionEventStore.ts#L101-L126) 同步追加，不经过 rAF 或字素缓冲；`:183-237,266-285` 检测序号缺口并预先注册监听。`streamPlayback.ts:1-67` 的字素尾部函数不能直接当作该 store 的现行路径。
- 屏幕显示层：T `ResultApp.tsx:174-218,299-328` 分离正文订阅并使用平滑 hook；[streamPlayback.ts:100-112,215-258](https://github.com/ZH-heng/textlens/blob/77a31585a3f17ddfb5bd09d25bd6b54016db3076/src/renderer/result/streamPlayback.ts#L100-L112) 首批最多立即展示 8 个 Unicode scalar，后续按 78～360 scalar/s、自适应积压追赶、单步最多 56；`useSmoothStreamText.ts:52-101` 仅有积压时驱动动画，终态直接返回完整 target。这里的“立即”是显示状态的行为，不是像素时延实测。

**拾句当前调用链（代码事实）**

`Electron session.fetch → TextDecoder + SSE frame → provider delta → TaskManager 对应 turn.answer 追加 → 30ms 合并 publish 全量快照 → preload → React setSnapshot → 普通文本段落`。

证据：S `api.ts:35-62`、`tasks.ts:53-66`、`desktop.ts:74-84`、`preload.ts:4-13`、`renderer/index.tsx:77-93,135-140`。首段与尾段都采用同一合并发布。每个窗口的快照含全部问答，`tasks.list()` 对问答排序和克隆；历史多、长回答或多窗时复制与渲染成本可能增大。**这只是潜在瓶颈，未取得 CPU、IPC 大小及上屏延迟实测，不能认定当前卡顿由此导致。**

可学习“首段优先、正文局部订阅、终态及时可见、事件恢复”这些目标；拾句目前全量快照本身可覆盖丢失的中间增量，未证明需要照搬序号队列。应先测量，再选择首段绕过合并、缩小广播或局部订阅中的必要改动。打字机动画会增加显示与逻辑正文的差距，不作为提速任务。

## 5. 取词、焦点与阅读操作

| 主题 | 对照证据与结论 |
|---|---|
| 不抢焦点的工具条 | T `windows.rs:512-541,2730-2752,2781-2804`：Windows 非激活原生样式与显示；S `desktop.ts:98-101,128-130` 以 showInactive 显示，但 BrowserWindow 默认仍可聚焦。只能确定策略不同，点击是否破坏 Chrome/微信/WPS 选区须实测 |
| 点击后保留原文 | S `desktop.ts:137-154,189-194` 已把取词内容存为 selection 快照，打开问答从快照创建，结果窗会主动 focus；原文高亮是否仍在不是同一件事。T `runtime.rs:2552-2563,2593-2651` 区分复制后的焦点归还与结果窗显示，避免归还源窗口立即触发关闭；值得学交互分支，不整体搬回焦点策略 |
| 失焦关闭 | T [windows.rs:1390-1443](https://github.com/ZH-heng/textlens/blob/77a31585a3f17ddfb5bd09d25bd6b54016db3076/src-tauri/src/windows.rs#L1390-L1443)、`:2257-2315` 用焦点代次与前台窗口归属确认，内部/未知焦点不直接关闭。S `desktop.ts:116,155-162` 用 120ms 后 isFocused 与外部鼠标命中范围。菜单、拖边、双窗间点击是否误关在拾句尚未实测，不宣称已有误关 Bug |
| 再次划同一段 | T `runtime.rs:593-637,2555-2562,2638-2645` 有同文回声抑制、按代次延后清除匹配选区；S `desktop.ts:147-169` 未见同文抑制状态。外部点击是否重新弹出必须用公开页面复现，不能直接引入自动清选区改变用户操作 |
| 取词故障隔离 | T `selection.rs:1-12,430-435` 引入 Windows 后端；`apps/windows/src/selection.rs:1-8,129-136,198-255,1064-1067` 有隔离 UIA/OLE helper、阶段预算、监督与回收。S `desktop.ts:147-169` 使用 selection-hook 并提供复制快捷键；没有故障样本前不替换原生取词库 |
| 置顶与拖边 | T `windows.rs:528-536,1470-1481` 与结果窗口运行状态管理；S `desktop.ts:99-106,202-212` 已有置顶、缩放和尺寸持久化。无需重新开发，补齐真实验收 |
| 读长答案 | T `renderer/result/autoFollowOutput.ts:3-48` 的底部跟随和 ResizeObserver；S `renderer/index.tsx:77-86` 已有底部阈值与手动上滚停止跟随。只有富文本异步改变高度时才需评估更复杂观察器 |
| 翻译方向切换缺口 | S `renderer/index.tsx:57` 发 language，`desktop.ts:201` 只调用 `tasks.setLanguage`，`tasks.ts:24` 只改字段。与 `PRDS/UI.md:57-59` 的切换即重新翻译规则不符。**本轮隔离复现**目标语言字段从中文变英文、模型调用次数仍为 1、旧译文不变。生成期间控件也未按 running 禁用，真实点击体验待桌面验收 |

## 6. 本轮可复现诊断与未取得的证据

运行：在项目根目录执行 `node .runtime/reference/review-diagnostics.mjs`。脚本只把拾句现有 API/TaskManager 模块编译到 `.runtime/reference/diagnostics/bundled/`，注入内存公开模拟流；使用不可访问的测试域名和明确的占位字符串，不发网络、不加载任何已保存凭据、不启动 TextLens，不改既有测试。

原始样本：`.runtime/reference/diagnostics/samples.json`，包含源码 SHA-256、逐次结果和时间；五组各 3 次。

| 场景 | 本轮结果 | 能证明什么 |
|---|---|---|
| 完整公开 SSE | 3/3 成功并输出正文 | 已有增量解析路径可用，耗时不代表模型或桌面速度 |
| 无正文块 | 3/3 API_TIMEOUT，总约 52.9/61.9/62.2ms | 诊断将 idle 改为 50ms、total 改为 180ms，证明 idle 生效；不改生产 45s/120s |
| 每 10ms 一个注释心跳、无正文 | 3/3 到约 187.5/186.2/184.7ms 才 API_TIMEOUT | 心跳续期使 idle 无法代表首正文等待，最终仍由 total 收束；不是无限挂起 |
| 正文后无终态直接 EOF | 3/3 API_STREAM_INTERRUPTED，已收到的公开正文仍发给调用方 | 严格断流检测已有，不要为模仿容错而取消 |
| 完整 JSON 响应 | 3/3 API_STREAM_INTERRUPTED，未输出正文 | 当前不支持 JSON 整段响应；不是已确认的智谱故障 |

独立语言切换诊断：`callsBefore=1, callsAfter=1, targetBefore=中文, targetAfter=英文, answerUnchanged=true`。这是现有 TaskManager 调用链复核，没有冒充真实鼠标或模型测试。

**本轮未执行真实模型测速和完整三应用测试。**已有安全入口 S `desktop.ts:249-258` 只返回公开短句的 provider 首 delta 与总时长；本轮没有建立可核验、无需读取凭据、且两应用请求条件相同的控制通路。TextLens 指定源码与安装二进制也未做对应验证。没有通过读取配置或解密 Key 绕过这些边界。用户历史反馈 GLM-4-Flash 很快只保留为体感证据。

## 7. 下一轮测速方案与验收门槛

### 7.1 时点定义

| 时点 | 定义与观测位置 |
|---|---|
| t0 点击 | 真实点击翻译/发送，公开测试工具记录；问 AI 打开不发请求，不混入请求样本 |
| tw 窗口可见 | 原生 visible + 公开测试录屏/截图确认有可用界面，不能仅以创建窗口返回代替 |
| ts 请求发送 | API fetch 调用前；Codex 另拆代理、进程、initialize、config/read、thread/start、turn/start |
| th / te | 响应头 / 首个有效 SSE；仅作诊断，不叫首字 |
| tr 首正文到达 | 非空且含可见正文的 content delta；思考、空白、role、心跳均单独计，不算正文 |
| tp 正文上屏 | 渲染提交与下一帧观测为代理指标，最终用录屏/截图核实；DOM 有字不等于屏幕已画出 |
| td / tf | 服务完成终态 / 最终完整正文可见；有动画时分别记录 |

输出指标：窗口 `tw-t0`、准备 `ts-t0`、服务首正文 `tr-ts`、本地呈现 `tp-tr`、用户等待 `tp-t0`、服务完成 `td-ts`、视觉完成 `tf-t0`。跨主进程、renderer、测试进程的时钟须校准，以单调时钟计算各进程内区间；不能直接减不同时钟起点的 performance.now，也不能把各段中位数相加当总中位数。

### 7.2 可立即执行的安全采样

1. 在拾句现有设置的“测试回答”使用当前保存服务，不改地址、模型或 Key；按既有入口固定公开短句测试 3 次，记录界面显示的首字/总时长、服务模型名称、成功/失败、冷/热状态与本机代理是否一致。该入口不进历史、不保存表单。保留逐次样本，再报中位数与范围，不以 3 次样本宣称可靠 p95。
2. 这只能形成拾句 provider 口径的参考数据，不能拆窗口和上屏。经下一轮方案确认后增加仅含随机请求号、时间和长度桶的诊断时点，不记录 Key、请求头、正文、原始请求体或用户历史。正常窗口仍不增加等待提示。
3. 两款应用对比必须同服务、同模型、同公开原文、同请求指令/历史及实际有效参数，交替 A/B 各至少 3 次，冷启动/热启动分组。不能搬用 TextLens 默认提示词；若 UI 不能产生等价消息，记录为“各自产品默认体验”，不归因到框架/传输。没有安全等价入口则暂停跨应用量化，只比较各自分段链路。
4. 中性公开材料固定为短句 `The sky is blue.`，段落 `Public parks provide space for walking and rest. Trees offer shade, and clear signs help visitors find their way.`，追问 `Explain the second sentence in plain Chinese.`。每组独立问答，固定追问轮数，失败和取消样本不删除。
5. Chrome 用独立公开测试页，微信仅专门测试会话中的同一公开文本，WPS 仅新建公开文本测试文档。记录应用版本、DPI、显示器与自动/备用取词入口，禁止操作私人聊天或文档。

### 7.3 三个优先任务（建议，待确认）

| 顺序 | 用户收益与具体范围 | 代价估计、风险 | 验收办法 |
|---|---|---|---|
| 1 核心翻译闭环及三应用验收 | 修复切换语言只改标签：在同一记录发起目标语言重译，明确生成中切换策略；随后用三应用公开材料完成翻译、解释、润色、自定义问题、追问、逐条复制，以及固定/临时窗、停止与再次划词 | 约 0.5～1 天实现及针对性回归，另需真实应用验收时间；主要风险是重译串入旧答案、错误取消后台任务。焦点改动仅处理复现问题 | 同语言零新请求；不同语言只新发一次，旧请求不能覆盖新结果，仍为同一记录。三个应用分别记录中文/英文/混排/多行的自动与备用结果；失败不能以备用成功掩盖。两窗内容、后台回答、停止目标、菜单/拖边/外部点击逐项通过 |
| 2 API 等待与上下文边界 | 按请求头、首正文/思考活动、流空闲、总预算区分超时；心跳不能无限续期首正文，保留停止、部分回答、用户重试与严格断流。发送前增加可解释的总上下文预算，超限明确提示，不静默截断 | 约 1～2 天；预算取值需用当前模型公开文本校准，不能照搬 TextLens 的 120/600s 或字符数；误判正常思考/慢请求是主要风险 | 注释心跳、role-only、thinking-only、首正文慢、正文中断、429、空回答、取消、长上下文边界有确定结果；任务相互独立，部分正文保留，重试无重复计数；用真实已配服务补充至少 3 个正常样本，公开诊断无凭据或私文 |
| 3 首段等待量化后做最小优化 | 建立 t0～tf 诊断；先测冷/热窗口、Codex 前置步骤及 1/100 条合成记录下的本地呈现，再决定是否首段立即发布、缩小快照广播或局部正文订阅。常驻进程和窗口复用不预先承诺 | 约 1 天诊断，条件成立再约 0.5～1 天小改；进程复用会增加并发、取消、临时会话与配置更新风险；时间均为估算 | 每组至少 3 次完整原始样本；先给瓶颈证据再选改动。候选本地目标 tp-tr 中位数≤50ms、单次≤100ms仅为待校准目标；同条件 A/B 的窗口、首正文与视觉完成均不退化，停止和双窗仍通过；模拟成绩不得写为模型提速 |

上述任务顺序遵循“当前闭环与真实稳定性 → 等待可解释与可靠 → 有证据的提速”。不能用第 3 项的漂亮数字抵消前两项失败。

## 8. 暂缓与仍缺证据

- Tauri 重写、原生取词后端替换：已有 Electron 实现可工作，缺 CPU/内存/取词挂死与分段耗时证据；框架名称不能解释模型响应差异。
- 打字机动画、Markdown/公式、更多动作、OCR、语音、多固定窗：暂不进入三个优先任务。动画只平滑显示；现有纯文本和两窗规则优先，新增展示/功能需明确阅读收益及安全、选字复制、终态一致性验收。证据为 S `renderer/index.tsx:77-93`、项目首版范围与 T 显示层调用链。
- 通用自动重试、自动故障切换：存在重复计费、重复内容与设置语义风险；当前用户主动选来源不变。TextLens 的受限参数回退不能作为全局重试授权。
- JSON 降级与更多模型思考开关：只有真实已配服务出现兼容需求才做；本轮 JSON 模拟失败不是智谱故障证据，服务默认参数效果也尚未测量。
- 原生焦点保护、同文抑制：先复现菜单误关、外部点击回声或选区丢失，再独立实现机制；不自动清除用户源选区。
- 仍缺：完整 Chrome/微信/WPS 实际问答矩阵、真实模型的 tr/tp/td、Codex 长期聊天行为、物理拖边/多屏、安装与卸载；本轮没有把这些项目标为通过。

实施入口：先确认上述优先任务与生成中语言切换策略，再另开实现范围。本报告不更新产品真源、不改变任何默认模型或发布行为。
