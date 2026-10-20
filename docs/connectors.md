# 连接其他 agent

桌面主实例负责安装取词钩子、保留选区与显示确认界面。HTTP 和 stdio 接入共享这个实例；桥接进程不另装钩子。

## 从设置导出

1. 启动 Selection Desk，在设置中选择 Codex、WorkBuddy 或千问办公。
2. 按宿主支持的传输方式选择 HTTP 或 stdio，导出配置。单文件 portable 版仅支持 HTTP；导出 stdio 时会提示安装桌面版。
3. 将导出的连接信息填入宿主的 MCP 配置。宿主版本的字段格式可能不同，以其当前官方说明为准；导出不代表已经通过宿主端到端验证。
4. 选中非敏感测试文字，请宿主调用 `get_selection`，在桌面确认指定客户端的本次请求。

每个客户端有独立 token，以本地加密存储中的配置为准。真实导出含凭据，保留在本机，不提交仓库或上传工单。更换安装位置后重新导出 stdio 配置。

## HTTP 占位示例

默认地址为 `http://127.0.0.1:18765/mcp`，使用 Streamable HTTP 与 Bearer token。此示例仅说明字段，不能直接连接：

```json
{
  "mcpServers": {
    "selection-desk": {
      "url": "http://127.0.0.1:18765/mcp",
      "headers": { "Authorization": "Bearer <CLIENT_TOKEN>" }
    }
  }
}
```

只绑定本机回环地址。端口占用时先处理冲突，不要把服务改为公网监听。

## stdio 占位示例

导出使用当前已安装的可执行文件和打包桥接脚本的绝对路径，通过 Electron 自带的 Node 运行时执行桥接。启动形式为：

```json
{
  "mcpServers": {
    "selection-desk": {
      "command": "C:\\Path\\To\\Selection Desk.exe",
      "args": ["C:\\Path\\To\\resources\\app.asar\\dist\\bridge\\cli.cjs"],
      "env": {
        "ELECTRON_RUN_AS_NODE": "1",
        "SELECTION_DESK_TOKEN": "<CLIENT_TOKEN>"
      }
    }
  }
}
```

三个客户端分别使用自己的导出与 token，客户端身份由服务端 token 映射确定。stdio 配置中的 token 与 HTTP 配置一样是客户端可读取的明文凭据，切勿提交仓库。桥接不安装原生钩子，不创建浏览器窗口，stdout 专用于 MCP 消息。旧的 `--mcp-bridge` 与 `--client` 启动参数不再支持。

## 能力边界与排错

唯一工具为 `get_selection`，不接收任意执行命令，也不提供远程桌面控制。普通选区 60 秒过期；没有新鲜选区、用户拒绝或确认超时时，不返回原文。每个请求单独确认，允许一次不代表持续授权。

Codex App Server 是浮窗中的模型会话来源，与 MCP 取词是两条连接。WorkBuddy、千问办公仅提供 MCP 读取选区接入；反向会话尚未实现，需等官方接口条件明确。

连接失败时依次检查桌面程序是否运行、端口是否被占用、宿主传输支持、安装路径与对应客户端凭据。工具发现成功后若取词失败，重新选择测试文字并检查桌面确认请求。不要把真实配置或原文放入排错截图。

传输格式依据 [MCP 官方传输规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)。宿主真实兼容性见 [验证记录](validation.md)。
