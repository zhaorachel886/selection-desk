# Selection Desk

[English](README.en.md) · Windows 11 x64 · 0.1.0-alpha.1 · MIT

[下载测试版](https://github.com/zhaorachel886/selection-desk/releases) · [自动检查](https://github.com/zhaorachel886/selection-desk/actions)

选中文字，在桌面浮窗中翻译、自定义提问并流式追问。基于 Electron、TypeScript、React 和 selection-hook，默认中文与系统主题，支持拖动、调整大小和固定会话。

**当前为 alpha 测试版。** 自动检查、打包和真实应用兼容性是不同的验收项，请查看 [验证记录](docs/validation.md)。企业微信主链路、五个工作日试用及干净 Windows 安装验收完成前，不作为稳定版发布。

## 开始使用

1. 在 Windows 11 x64 上安装测试版，或运行 portable 版本。首次启动进入设置；保存设置后，再次启动驻留托盘。托盘可打开设置，也可使用 `--settings`；`--background` 支持后台启动。
2. 默认使用 Codex；在设置中确认本机 Codex 可执行文件路径和登录状态，并检查连接。也可主动选择 OpenAI 兼容 API，填写地址、模型与密钥。程序不会自动切换来源或产生另一来源的消费。
3. 在其他应用选中文字，使用浮窗中的翻译或问答。输入问题时才获取焦点；固定会话保留当前内容。
4. 自动取词不可用时，手动复制文字，再按 `Ctrl+Shift+Space`。自动剪贴板兜底默认关闭，需完成剪贴板格式恢复兼容性验证后再评估启用。

当前不提供 OCR、语音、云同步或原文替换。开机自启默认关闭。

## 接入其他 agent

在设置中选择 Codex、WorkBuddy 或千问办公，导出该客户端的连接配置。安装版支持 HTTP 和 stdio，单文件 portable 版支持 HTTP。每个客户端使用独立凭据；导出的真实配置只保留在本机。操作与占位示例见 [连接说明](docs/connectors.md)。

MCP 仅提供 `get_selection`。每次读取都需要用户确认指定客户端的本次请求，普通选区保留在内存中并在 60 秒后过期。Codex App Server 用于浮窗模型会话；WorkBuddy、千问办公反向对话尚未实现，取决于官方接口条件。

## 数据与安装

默认无遥测，应用不主动持久化本地会话原文。发起模型请求会把相关选区与对话发送给所选服务，其保留规则以服务方政策为准。API 密钥与客户端 token 使用系统加密存储；同一 Windows 用户下运行的软件仍可能访问这些数据，见 [安全说明](SECURITY.md)。

测试安装包暂未代码签名，Windows 可能显示未知发布者。请核对下载来源与构建提供的校验信息，再决定安装。安装版可通过 Windows 设置 → 应用 → 已安装的应用卸载。portable 版本退出后可删除可执行文件。卸载后检查本机导出的连接配置并从各客户端移除；配置和凭据的清理范围需按 [安装验收](docs/validation.md) 核实。

## 本地开发

使用 Windows x64、Node.js 22.12 或更新的兼容版本与 npm，在项目根目录依次执行：

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run package
```

运行开发构建使用 `npm start`。打包输出位于 `release/`，包含 NSIS 安装版与 portable 版本。构建依赖下载需要网络。CI 检查 PR；main 上的新版本通过全部检查后自动发布为 prerelease，已有同版本发布不覆盖。

阅读 [架构](docs/architecture.md)、[贡献指南](CONTRIBUTING.md) 与 [MIT 许可](LICENSE)。

测试包的第一次使用按 [首轮试用](docs/first-run.md) 操作；阶段完成情况见 [实施记录](docs/implementation.md)。
