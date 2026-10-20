# 实施与交付记录

目标：Windows 划词浮窗、自定义追问、Codex 双向与三宿主 MCP 接入，GitHub 测试版就绪。

## 执行任务
- [x] 原生模块启动与 App Server 握手验证；真实生成需要 CLI 登录
- [x] 核心快照、授权、会话管理与 22 项自动测试
- [x] 浮窗、设置、系统保护存储与桌面生命周期；打包程序启动检查通过
- [x] Codex 和可选模型 API 适配；真实服务生成验收仍待完成
- [x] HTTP / MCP / stdio 接入与 SDK 多客户端测试；三个真实宿主仍待联调
- [x] 本地安装包、便携包、文档与代码复审
- [x] GitHub 源码与 Windows Alpha 发布，远程检查通过
- [ ] 真实应用矩阵、五工作日试用与干净环境验证

## 边界与执行决定
- Windows 原生交互必须用真实应用验证。当前工具不能直接控制原生桌面；提供验证程序和验收入口，并记录未验证项。
- 项目从空目录构建，无原仓库分支需要隔离。保留原需求文档。
- 即使真实桌面验收尚未具备条件，也完成独立可验证的软件模块与测试版打包；稳定版发布门槛保持不变。
- 发布目标为用户创建的公开仓库 https://github.com/zhaorachel886/selection-desk；只上传白名单源码与测试版文件。

## 接口契约
共享类型以 src/shared/types.ts 为准。renderer 仅通过受限 preload bridge 与主进程通信；凭据不进入 renderer 状态或日志。外部连接各用独立 token；请求方名称来自本地 token 配置。

## 交付状态（2026-10-20）
- 本地测试版为 0.1.0-alpha.1；安装包、单文件便携版和源码包位于 release/。
- 安装版 stdio 使用 Electron 自带 Node 与独立 CLI，Windows GUI 主进程不承担标准输入输出；单文件便携版使用 HTTP。
- 持久设置存在后启动于托盘；首次设置和显式 --settings 显示窗口，关闭后释放 renderer。
- 系统保护存储、本机接口拒绝未授权调用、真实导出 stdio 握手、打包后的窗口销毁与重建均已检查。
- 两项 P2 审查问题已修复：待处理选区独立过期、授权插入时保留设置草稿。异步窗口显示增加代次检查。
- 本地 Git 仓库已初始化，源码另行提供白名单压缩包。远程仓库已确认创建成功，插件具备写入权限。
- 源码通过 GitHub 插件上传；Windows 自动检查和构建通过后，发布作业为新版本创建 prerelease，无需本机 CLI 认证。
- 源码发布提交为 `c2d632e3920ea79e0670e57c30a975cf240b8cc4`；[Windows 检查与发布作业](https://github.com/zhaorachel886/selection-desk/actions/runs/39354630944)全部通过。
- [0.1.0-alpha.1 测试版](https://github.com/zhaorachel886/selection-desk/releases/tag/v0.1.0-alpha.1)已公开，安装包、便携版、源码包和校验文件均上传成功；下载的校验文件与 GitHub 资产摘要逐项一致。
- 本地发布文件由本机构建，GitHub 发布文件由远程 Windows 构建；校验值分别对应各自构建，不混用。
