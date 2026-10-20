# Selection Desk 项目说明

## 产品与目标
Windows 11 x64 优先的划词浮窗工具：选区 → 翻译或自定义问答 → 原位流式追问。默认中文、系统主题，可拖动、调整大小、固定。Electron + TypeScript + React + selection-hook。

## GitHub 发布
- 已通过 GitHub 连接确认账号用户名为 `zhaorachel886`。
- 仓库为 https://github.com/zhaorachel886/selection-desk，公开仓库。GitHub 插件可上传源码，无需依赖本机 CLI 登录。
- main 上的新版本通过全部 Windows 检查后，由 GitHub Actions 发布 prerelease；已有同版本发布保持原状，不覆盖资产。PR 只检查和上传临时构建产物。
- 0.1.0-alpha.1 已公开发布，Windows CI 与资产摘要核对通过；真实桌面兼容性和稳定版验收仍待完成。
- 不将私人登录邮箱、密码、令牌或设备授权码写入源码和文档；提交身份优先使用 GitHub 提供的 noreply 地址。

## 确认决策
- 单一桌面主实例安装取词钩子；MCP HTTP / stdio 桥共享此实例。
- 首版 Codex App Server 双向、WorkBuddy 和千问办公 MCP 读取选区；后两者反向对话依赖官方接口条件。
- 默认 Codex，OpenAI 兼容模型 API 为可选来源；不自动切换来源或消费。
- 普通选区只存内存，60 秒过期；外部读取必须确认指定客户端的本次请求。
- 不自动抢焦点。主动作答输入才获取焦点。固定会话不被新选区覆盖。
- 不做 OCR、语音、云同步、原文替换。默认无遥测、无开机自启。

## 执行与验收
- 先真实验证取词和 Codex；已实现、自动测试通过、真实应用验证分别记录。
- 企业微信主链路通过、五工作日试用和干净 Windows 安装验证前，不发布稳定版。
- 当前工作空间原来只有需求文档，没有现有代码或 Git 仓库；在此构建独立项目。
- 工作记录见 docs/implementation.md，兼容性证据见 docs/validation.md。
- 修改后执行 npm test、npm run typecheck、npm run build。接口边界和安全逻辑必须有行为测试。
- 凭据、原文、真实配置和本地日志不能进入 Git；只发布带占位符的示例。
- 用户反馈须转成明确产品规则，文档不混入对话历史。不得把尚未完成的测试记为通过。
