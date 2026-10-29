# 拾句开发与发布

## 日常开发

项目根目录是唯一的开发目录，main 跟踪 origin/main。开发前查看 `git status -sb`，确认已有改动的归属；工作区干净时可 `git pull --ff-only` 获取最新代码。不要在首次发布留下的临时副本中继续开发。

完成修改后运行 `npm run typecheck`、`npm test` 和 `npm run build`；涉及桌面行为时增加对应的隔离原生检查。只暂存明确检查过的文件，检查 `git diff --cached`，再提交并推送。归档、运行资料、截图、用户历史和凭据不参与提交。

当前可用的提交认证是 Codex 的 GitHub 连接器，独立于本机 GitHub CLI 登录。连接器应核对远程 main 的预期 SHA，并在提交后同步本地同一提交；遇到 head 改变先核查差异。使用终端推送前，先确认实际认证可用；网页授权页面显示成功不能代替本机登录检查。不要把密码或 Token 发到聊天中。

## 发布一个新 Alpha

1. 确定新版本号，例如 `0.2.0-alpha.3`。运行 `npm version 0.2.0-alpha.3 --no-git-tag-version` 同步 package.json 和锁文件。
2. 创建 `docs/release-notes/0.2.0-alpha.3.md`，列出功能、实际验证和未覆盖范围。已有公开版本不重复使用。
3. 完成必要检查并提交源码到 GitHub main。此时源码已更新，安装包尚未发布。
4. 打开仓库 Actions 中的 `Shiju manual alpha release`，点 Run workflow，选择 main，填写相同版本。默认只检查和构建；决定公开分发时显式勾选 publish。
5. 等待 windows 和 release-alpha 成功，核对 Release 指向预期提交、为非草稿预发布，并有安装版、免安装版和校验文件。流程不会覆盖已有同版本资产；若尚未创建 Release，但版本标签已指向其他提交，流程会拒绝发布。

附件名为 `Shiju-Setup-版本-x64.exe` 与 `Shiju-版本-x64.exe`；产品、窗口、托盘和快捷方式仍叫「拾句」。输出目录是 `release/版本/`，`npm run release:checksums` 要求目录里恰好有这两份 EXE，并生成与实际附件名一致的 SHA256SUMS.txt。

0.2.0-alpha.2 是历史发布，GitHub 自动去除了其附件的中文前缀，文件名分别以 `-Setup` 和 `-0.2.0` 开头；识别安装版时看 Setup。此次流程整理不改写历史包或标签。程序仍未做代码签名，安装卸载及真实应用验收边界以发布说明为准。

## 本地入口与归档

本地日常使用入口必须指向当前版本目录。每次试用交付使用新的 Alpha 版本号，保持 package.json、锁文件和包内版本一致；不要以相同版本号交付多份不同代码。升级时退出旧实例，核对桌面和开始菜单快捷方式、已有开机启动项及实际进程路径，防止单实例机制继续唤起旧版。

历史试用目录保存在 `.local-archive/obsolete-builds-日期/`，保留移动清单，恢复时手动选取。已公开的历史安装包、标签与校验清单保持原样，安装包放 Releases，源码放仓库；不把 `.runtime/`、`release/` 或归档加入 Git。

过程日志和审查保存在本地忽略的 `notes/` 或 `.local-archive/`，正式仓库只保留当前规范、必要验收边界及版本说明。归档不作为当前实现或真实验收的证据。
