# 参与开发

拾句面向 Windows x64。先阅读 `AGENTS.md` 与 `PRDS/`，按当前产品规则修改。

在 Windows 上运行 `npm ci`、`npm test`、`npm run typecheck`、`npm run build`。桌面启动检查为 `npm run test:desktop`，构建安装版和免安装版为 `npm run package`。

报告实际检查结果和未覆盖场景；浏览器 Demo 验证不能替代 Chrome、微信、WPS 文字的真实应用验收。仅使用公开或合成文字，不提交真实划词、问答历史、日志或凭据。修改生产依赖后运行 `npm run notices` 并核对许可证副本。

GitHub 发布需手动触发且限于已经审核的版本，不自动覆盖已有同版本资产。稳定版发布仍需另外完成应用兼容、安装卸载和人工验收。

公开仓库保留源码、测试、当前有效规范和发布说明。notes/、.runtime/、release/ 和 .local-archive/ 为本地资料，不提交；开发日志和过程审查不作为公共文档。稳定结论并入现有规范，版本变化记入发布说明，避免新增重复的过程报告。
