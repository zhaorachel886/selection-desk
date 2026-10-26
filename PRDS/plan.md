# 拾句：开发计划

日期：2026-10-23；进度更新：2026-10-25。Demo、UI 规范与开发计划已确认，桌面试用实现已存在，当前处于开发联调与真实应用验收阶段。以下复选框为待逐项核对的验收条件，不代表对应功能均未实现。

当前证据：Chrome 公开测试页取词曾通过；隔离原生窗口中的翻译、解释、润色真实回答与正文显示已验证；用户反馈当前可以回答，等待约 10 秒。微信/WPS、双窗后台任务、真实停止与追问、重启恢复和 Codex 长期聊天行为仍须完成对应验收。现有 release 包不包含 2026-10-25 的源码修复，不作为当前源码的验收产物。

目标：在 Windows 的 Chrome、微信可选文本与 WPS 文字中完成「选词 → 翻译或问 AI → 浮窗查看 → 追问或复制」，同时保证后台任务独立和本地最近 100 条记录规则。

架构：Electron 主进程负责选区、窗口、Codex 任务与本机存储；React 界面只通过受限 preload 接口使用这些能力。窗口展示与任务执行分离，所有请求与增量均关联独立问答和请求标识。

技术栈：Electron、React、TypeScript、手写 CSS 变量、Codex App Server；取词模块优先验证旧版 selection-hook。具体版本以当前环境兼容性验证和锁文件为准。

依据：`requirements.md`、`PRD.md`、`tech.md`、`UI.md`、`UI-spec.md` 与 `../demo/index.html`。

## 执行约定

- 先读项目根目录 `AGENTS.md` 与上述需求文件。按九个步骤执行，每步交付一个能验证的结果，报告通过项与未通过项。
- 先完成取词与 Codex 的真实验证，再投入完整界面集成。自动取词失败与备用复制入口成功必须分别报告。
- 单元测试优先覆盖任务隔离、竞态、清理与写盘恢复；页面外观以截图和交互检查验证，不编写只重复 CSS 数值的测试。
- Demo 保持独立、可打开，作为视觉基准；生产代码不携带预设回答或模拟连接成功逻辑。
- 本文列出的 `src/`、`tests/`、`scripts/` 文件为拟新建或择优重建路径，不能因为 Git 索引有同名旧文件就认定新版实现已存在。
- 旧索引中 `src/providers/codex.ts`、`src/main/desktop.ts`、`src/core/selection.ts` 和构建脚本可只读检查后择优复用。原有 MCP 桥接与多 Agent 连接不恢复；可选模型 API 使用当前独立实现，并验证流式、停止、错误及 Windows 密钥加密。
- 不整套恢复旧索引，不使用 `git add .` 或提交全部已有暂存内容。每步记录变更范围；需要 Git 存档时先核对索引，再只提交明确属于本次步骤的内容。
- 凭据交给已有 Codex 登录管理。选择的正文、回答与设置写入应用数据目录，不写入源码、测试日志或仓库；不向渲染端暴露文件系统、进程执行或任意 IPC 通道。

## 文件职责与公共契约

| 路径 | 职责 |
|---|---|
| `src/main/index.ts` | 启动、单实例、服务装配与退出 |
| `src/main/selection.ts` | 原生选区监听与用户主动复制后的快捷键入口 |
| `src/main/windows.ts` | 工具条、固定窗、临时窗及设置窗口管理 |
| `src/main/tasks.ts` | 问答任务生命周期、请求身份与事件路由 |
| `src/main/history.ts` | 版本化记录读取、原子保存及恢复 |
| `src/main/preferences.ts` | 设置、快捷键与开机启动偏好 |
| `src/main/preload.ts` | 渲染进程可调用的受限接口 |
| `src/providers/codex.ts` | 本机 Codex 协议适配与连接管理 |
| `src/shared/types.ts` | 选区、问答、请求、事件及设置的公共类型 |
| `src/renderer/components/` | 工具条、问答、原文、语言选择、历史、设置组件 |
| `src/renderer/styles/tokens.css` | 已确认的字号、间距、圆角与颜色 |
| `tests/` | 任务、记录、协议异常与界面集成验证 |
| `scripts/` | 构建、真实链路探测与打包脚本 |

身份字段统一采用 `selectionId`、`conversationId`、`requestId`，分别表示一次选区、一次独立问答和一次具体生成请求。旧请求事件只能更新对应请求，不能覆盖重试或另一个问答。

对外业务接口按以下职责命名，内部可根据协议实测细化参数：

```ts
type Action = 'translate' | 'explain' | 'polish' | 'ask';
type TaskState = 'idle' | 'running' | 'done' | 'stopped' | 'error' | 'interrupted';
type SelectionSnapshot = {
  selectionId: string;
  text: string;
  sourceApp: string;
  capturedAt: number;
  bounds?: { x: number; y: number; width: number; height: number };
};
type GenerateRequest = {
  conversationId: string;
  requestId: string;
  selection: SelectionSnapshot;
  action: Action;
  question: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  targetLanguage?: '中文' | '英文';
};
type ProviderEvent = {
  conversationId: string;
  requestId: string;
  type: 'delta' | 'completed' | 'failed';
  text?: string;
  errorCode?: string;
};
interface AnswerProvider {
  check(): Promise<{ connected: boolean; reason?: string }>;
  generate(request: GenerateRequest, signal: AbortSignal,
           emit: (event: ProviderEvent) => void): Promise<void>;
  dispose(): Promise<void>;
}
```

停止由任务管理器中该 `requestId` 对应的 AbortController 发起；隐藏窗口不触发 abort。调用方必须处理 generate 的异常，终态只结算一次。

## 步骤 1：建立可运行桌面骨架

**目标**：能启动一个本机 Electron 程序，显示确认版工具条和结果窗的基本样式。

**依赖**：已确认的 UI 与技术方案。

**涉及文件**：`package.json`、锁文件、`tsconfig.json`、`scripts/build.mjs`、`src/main/index.ts`、`src/main/preload.ts`、`src/shared/types.ts`、`src/renderer/index.html`、`src/renderer/index.tsx`、`src/renderer/styles/tokens.css`、`.gitignore`。

**实现内容**：

- 核对当前 Node、Codex、Electron 与原生模块 ABI，选择能够安装和构建的依赖版本；不照抄旧索引版本作为已验证版本。
- 建立主进程、preload、React 渲染入口；开启上下文隔离，关闭渲染端 Node 集成。
- 将已确认的 CSS 变量和基础组件迁入生产目录；不迁入预览场景侧栏和示例文章。
- 在 `package.json` 定义 `typecheck`、`test`、`build`、`start` 命令；构建产物与本地数据排除出版本控制。

**完成标准**：

- [ ] 执行 `npm run typecheck` 和 `npm run build` 通过。
- [ ] 执行 `npm start` 可看到桌面浮窗，关闭后无多余可见终端。
- [ ] 浮窗字号、间距、圆角与 Demo 一致，渲染端不能直接访问 Node 文件接口。

## 步骤 2：验证并接入真实取词

**目标**：在三个目标应用中获取用户实际选中的文字，并显示工具条。

**依赖**：步骤 1 的桌面入口与公共选区类型。

**涉及文件**：`src/main/selection.ts`、`src/main/index.ts`、`src/shared/types.ts`、`scripts/probe-selection.mjs`、`tests/selection.test.ts`、`notes/reference/selection-validation.md`。

**实现内容**：

- 检查旧 `src/main/desktop.ts` 对 selection-hook 的使用方式；验证当前版本能否提供文本、来源应用、选区或鼠标位置。
- 将原生结果转成 SelectionSnapshot，过滤空选区和工具自身窗口；展示工具条时先保存选区快照，点击按钮后不重新从失去焦点的原应用取词。
- 不因选中相同文字反复弹出多个工具条；取消选区、外部点击或按 Escape 后正确收起。
- 提供“手动复制 → 快捷键唤起”备用路径，仅在用户主动调用时读取剪贴板；不把旧剪贴板内容当成自动取词结果。
- 使用中英混排、多行与较长段落分别测试 Chrome 网页、微信可选消息、WPS 文字。报告应用版本、取词方式与结果，不记录用户私密原文。

**完成标准**：

- [ ] 每个目标应用都能用公开测试文本演示获取结果；自动与备用方式分别标明成功或失败。
- [ ] 工具条显示不清空选区、不抢走正在使用的输入焦点；点击复制能得到本次选区内容。
- [ ] 自动取词失败时有可用备用入口；未覆盖的目标应用保留为兼容性未通过项，不以备用成功替代自动成功。

## 步骤 3：验证 Codex 的真实回答链路

**目标**：不依赖完整 UI，验证登录检查、实际流式回答、停止、追问上下文及临时会话行为。

**依赖**：步骤 1 的运行环境和 AnswerProvider 契约。

**涉及文件**：`src/providers/codex.ts`、`scripts/probe-codex.mjs`、`tests/codex-protocol.test.ts`、`notes/reference/codex-validation.md`。

**实现内容**：

- 检查本机安装版本的 App Server 协议及官方文档，对握手、账户、生成、增量、终态、停止方法逐一验证，未核验字段不直接照搬旧实现。
- 使用公开示例文字执行翻译和一次追问；观察增量到达与终态，验证停止后保留部分回答。
- 核对临时问答在本机 Codex 长期聊天列表与存储中的实际表现。若不能满足独立本地历史的要求，记录阻断条件并调整适配方案，不悄悄改为长期聊天。
- 校验文本用途的权限配置：选区中的命令属于资料，不能执行命令、读取本地文件或启动其他工具；遇到工具请求明确拒绝并结束该次请求。
- 覆盖未安装、未登录、启动失败、协议断开、超时与生成失败。旧代码的每次请求启动进程模式需按实测评估，避免窗口变化牵连其他请求。

**完成标准**：

- [ ] 看到真实流式回复，停止与后续追问都可演示；模拟回答不计入完成。
- [ ] 明确记录“临时问答是否留下 Codex 长期聊天”的实测结论。
- [ ] Codex 未连接时返回可理解原因，不显示假成功，使用已有 Codex 登录。可选 API 另行验证用户输入 Key、加密存储、公开文本测试及真实模型生成，不将登录检查或模拟服务通过当作真实接通。

## 步骤 4：实现独立问答与后台任务

**目标**：切换窗口或处理新选区时，旧问答能继续生成，输出和停止始终作用于正确对象。

**依赖**：步骤 3 的 AnswerProvider 与步骤 1 的公共类型。

**涉及文件**：`src/main/tasks.ts`、`src/core/conversations.ts`、`src/shared/types.ts`、`tests/tasks.test.ts`。

**实现内容**：

- 主进程创建独立 conversationId；同一次问答的追问与重试使用新的 requestId，不新增问答记录。
- 新请求提交前保留输入快照；打开问 AI、查看、复制均不发起生成。
- 以 conversationId 和 requestId 双重过滤增量和完成事件，丢弃已失效请求的迟到事件。
- 每个请求使用独立 AbortController；收起、取消固定和切换展示只改变窗口映射。
- 同一问答生成时允许编辑草稿，但不重复发送；停止、失败与完成后恢复发送。先停止后才收到服务端请求标识的竞态也必须处理。

**完成标准**：

- [ ] 两次问答同时执行，分别收集答案；关闭显示或切换不会取消任何一条。
- [ ] 停止其中一条，另一条继续；已收到内容与输入草稿仍在。
- [ ] 用可控事件序列测试“停止后迟到增量”“重试后旧完成事件”“后台完成时当前窗口显示另一问答”。

## 步骤 5：实现原生窗口行为

**目标**：工具条与结果窗能在实际应用旁使用，并正确管理焦点、固定和拖动。

**依赖**：步骤 2 的选区快照与步骤 4 的独立问答。

**涉及文件**：`src/main/windows.ts`、`src/main/index.ts`、`src/main/preload.ts`、`tests/windows.test.ts`、`scripts/probe-windows.mjs`。

**实现内容**：

- 建立工具条、一个固定窗、一个临时窗和设置窗；工具条不抢焦点，用户点击输入框后才进入输入状态。
- 外部点击收起临时窗，点击语言菜单、历史和设置等本工具内部控件不误判为外部点击。
- 固定新窗口时解除旧固定，旧内容仍保留；关闭窗口不调用任务停止。
- 按显示器工作区、DPI 与选区坐标定位，处理负坐标显示器、屏幕边缘、缩放和拖动；内容滚动时输入框可见。
- 托盘可恢复最近问答、打开历史或设置、退出程序；退出与收起区分处理。

**完成标准**：

- [ ] 在 Chrome 阅读时出现工具条，原应用焦点与选区保持；点击输入框可正常输入中文。
- [ ] 点击外部只收起临时窗，固定窗保留，最多两个结果窗；后台回答不中断。
- [ ] 在当前电脑的可用显示器和缩放配置下验证边缘位置；无多显示器条件时明确记录未实测项。

## 步骤 6：接入确认版 UI 与完整问答操作

**目标**：用真实选区和真实答案替换 Demo 模拟数据，形成可使用的翻译与问 AI 闭环。

**依赖**：步骤 3～5 的回答、任务和窗口模块。

**涉及文件**：`src/renderer/components/SelectionToolbar.tsx`、`Conversation.tsx`、`SourceQuote.tsx`、`LanguagePicker.tsx`、`Composer.tsx`、`src/renderer/index.tsx`、`src/main/preload.ts`、`tests/ui-interaction.spec.ts`。

**实现内容**：

- 工具条只保留翻译、问 AI、复制；翻译立即提交，问 AI 先展示原文和解释/润色快捷按钮。
- 原文按实际排版超过两行才显示展开；自定义问题、追问、重试与语言切换遵循记录身份规则。
- 默认外语译为中文、中文译为英文；解释默认中文，润色保持原意与原文语言。数字、混排等不确定文本不假装精确识别，保留目标语言手动切换。
- 复制按钮复制所对应那一条回答，不总是复制最后一条；生成内容按普通文本安全渲染，不执行原文中的 HTML。
- 发送/停止保持同一位置，正确绑定当前问答；保留草稿、IME 输入行为、键盘操作和图标提示。

**完成标准**：

- [ ] 在真实应用中完成翻译、解释、润色、自定义提问、追问和复制。
- [ ] 快速切换问答，原文、回答、按钮与草稿仍正确对应。
- [ ] 与 Demo 对照检查 14px 工具条标签、18px 工具条图标、14px 正文、单行历史入口、圆角和间距；长回答不会挡住输入框。

## 步骤 7：实现本地最近 100 条记录

**目标**：问答可在重启后回看和继续，自动清理不会误删活跃任务。

**依赖**：步骤 4 的问答数据与步骤 6 的详情 UI。

**涉及文件**：`src/main/history.ts`、`src/core/history-policy.ts`、`src/renderer/components/HistoryList.tsx`、`tests/history-policy.test.ts`、`tests/history-storage.test.ts`。

**实现内容**：

- 第一次实际提交时创建记录，追问和重试只更新同一条；按最后用户主动请求时间排序，查看、复制和增量接收不改排序。
- 写入本机应用数据目录的版本化 JSON：先写临时文件、完成后原子替换，保留可恢复副本；增量节流保存，结束状态立即保存。
- 新增前预留容量。达到 100 条时清理最旧且未显示、未运行的记录；全部受保护则拒绝新增并说明原因，不超限也不取消已有任务。
- 列表显示摘要与相对时间；详情恢复上下文，程序重启后不假定已失效的临时会话仍能复用。
- 删除运行中记录须提示并确认停止；退出后恢复未完成记录为中断，不能自动重发。主记录文件损坏时读取副本并给出恢复结果。

**完成标准**：

- [ ] 同一问答连续追问只计一条，关闭程序再打开可以回看并继续提问。
- [ ] 构造 100 条记录后新增第 101 条，只删除正确的非保护记录；所有记录受保护时明确阻止新增。
- [ ] 验证重试排序、删除运行中记录、写入中断、损坏恢复与重启不重发。

## 步骤 8：完成设置与异常恢复

**目标**：用户遇到连接或环境问题时能理解原因并继续操作。

**依赖**：步骤 3 的连接诊断、步骤 5 的托盘、步骤 7 的持久化。

**涉及文件**：`src/main/preferences.ts`、`src/renderer/components/Settings.tsx`、`ErrorNotice.tsx`、`src/main/index.ts`、`tests/preferences.test.ts`、`tests/recovery.test.ts`。

**实现内容**：

- 设置中提供真实 Codex 连接检查、目标语言、快捷键配置、开机启动；默认手动启动。
- 可选 API 来源提供用户输入 Key 与 Windows 加密保存、公开短句回答测试、来源切换及流式错误处理；测试不保存设置、不进入近期记录。必须补充用户自行填写 Key 后的真实服务与速度验收。
- 快捷键冲突时保留旧配置并显示失败原因，不能保存一个实际上未注册的快捷键。
- 处理未安装、未登录、断网、超时、服务进程退出、存储失败；保留原文和已收到的内容，重试仍属于同一条记录。
- 退出时终止本工具管理的请求并保存已生成内容，不关闭用户独立启动的 Codex 应用或其他进程。
- 日志只记录必要诊断信息；检查正文、凭据、用户本地路径是否被不必要地写入日志。

**完成标准**：

- [ ] 修改设置并重启后仍生效；快捷键冲突能看懂并恢复原设置。
- [ ] 断开连接后可看见原因，恢复连接重试无需重新选词。
- [ ] 退出整个工具后没有遗留任务；再次打开保留记录，不自动发送未完成问题。

## 步骤 9：真实兼容性验收与 Windows 打包

**目标**：交付可在本机启动的桌面试用包和可复核验收记录。

**依赖**：步骤 1～8 通过对应验收。

**涉及文件**：`scripts/package.mjs`、`package.json`、打包配置、`tests/e2e.spec.ts`、`docs/acceptance.md`、`docs/first-run.md`、`docs/known-issues.md`。

**实现内容**：

- 回归三个目标应用的中文、英文、混排、多行选区，记录自动与备用入口结果。
- 检查长文本、屏幕边缘、实际缩放、双窗、后台生成、准确停止、历史 100 条、重启恢复和 Codex 长期聊天行为。
- 构建 Windows x64 便携试用包，验证原生取词模块在打包后仍可加载；如当前系统架构不同，先核对架构再调整目标。
- 在项目目录外启动打包产物，检查资源路径、应用数据路径、首次运行引导和退出；不把开发环境启动成功当成打包成功。
- 提供安装/启动说明、Codex 前置条件、支持范围与已知限制。不进行云部署或公开发布。

**完成标准**：

- [ ] `npm run typecheck`、业务测试、构建与打包通过；真实应用检查逐项记录。
- [ ] 用户能打开桌面试用包，并在目标应用里完成一轮翻译和一轮问 AI。
- [ ] 必要兼容性失败项已修复；无法验证的环境单独列出，不标记为通过。

## 技术栈与交付总览

| 类别 | 方案 | 验证重点 |
|---|---|---|
| 桌面框架 | Electron | 原生窗口、托盘、焦点与打包 |
| 界面 | React + TypeScript + 手写 CSS 变量 | 忠实迁移确认版 Demo，不新增 UI 风格 |
| 取词 | 优先评估 selection-hook；主动复制快捷键备用 | 三个目标应用分别实测 |
| AI | 本机 Codex App Server | 流式、停止、上下文、权限及临时历史行为 |
| 存储 | 主进程管理版本化 JSON 与恢复副本 | 100 条上限、原子写入和重启恢复 |
| 测试 | Vitest 业务测试、Playwright 界面测试、真实 Windows 手工验收 | 自动测试与真实兼容性分别报告 |
| 交付 | Windows 本地试用包 | 包内原生模块可加载，项目目录外可启动 |

当前已有桌面试用源码与旧试用包；真实取词、模型调用、存储与更新后的安装包须分别执行对应验收，不能由代码存在或隔离测试代替整体完成。
