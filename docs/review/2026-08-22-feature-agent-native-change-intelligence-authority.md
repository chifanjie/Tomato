# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 14:26 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：64fb2b5 test: connect host cache to workbench

## 背景与动机

单一 Preview tgz 已真实证明 Codex/Claude Plugin 安装、active cache MCP、版本切换、pinned-v1 recovery、remove 与 Doctor，但随包 README 只公开了首次安装命令。用户缺少安全的版本切换、恢复与清理路径，容易把 Codex re-add误解为原子升级，或把Claude卸载后保留的inert cache误当成active registration。

本切片把已执行通过的 lifecycle 写入 tgz 自带指南，不新增未经证明的产品声明。

## 改动策略

- 使用显式无效绝对路径占位符，要求每次 `npm install -g` 后先核 `understand-code --version`，避免未展开变量或错误全局包继续执行Host命令。
- 首次安装后用双Host Doctor验证registered/healthy，并要求关闭旧session、从新Host session加载cache。
- Codex新版本使用官方 `plugin add` cache replacement/reinstall；Claude使用marketplace update + plugin update并新开session。
- Pinned recovery要求保留旧tgz，重新安装旧payload，经官方remove/uninstall与re-add/install恢复，并以原Task ID/revision/baseline/current Snapshot为成功条件。
- 清理仅移除目标Plugin/marketplace，保留其他plugins；Doctor用POSIX状态变量精确要求exit 1，并人工核对`hostRegistration: "not_registered"`。
- 明确Codex不是atomic upgrade、recovery不是atomic downgrade/rollback、Claude inert cache不是active registration。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Packaged lifecycle guide | `packages/preview/README.md` | 首次安装、版本切换、pinned recovery、remove/Doctor 四段用户流程与能力边界 |

## Review 重点

1. **命令真实性** — Codex/Claude命令、参数、scope与顺序必须与真实隔离Host E2E一致。
2. **版本/会话边界** — 三次npm安装后都先检查exact CLI version；安装、update和recovery后都要求新Host session。
3. **恢复身份** — pinned recovery必须读取原Task并保持Task ID、revision、baseline/current Snapshot，不能用新Task替代。
4. **清理安全** — 只要求目标Plugin消失，保留其他plugins；Claude inert cache不手动执行或删除。
5. **精确非零状态** — removal Doctor只有exit 1可通过；exit 0和argv error exit 2都必须失败，并检查JSON not_registered。
6. **诚实声明** — 不外推为atomic upgrade/downgrade、hot reload、zero residue、两个真实RC、Gold、model-selected或strongWrites。

## 已识别风险

未发现 P0、P1、current-path executable P2 或 blocking Test Gap。

非阻塞残余：v2 lifecycle fixture仍是同代码的version-distinct test release，不是两份历史RC；credentialed/model-selected Host session、Gold Set、SBOM/provenance/signing、cross-platform、Provider authority和`strongWrites`继续open/locked。

## 测试情况

**已覆盖：**

- Preview typecheck通过。
- Fresh Preview build通过。
- npm pack dry-run与真实临时tgz读取通过。
- tgz entry count：87；allowlist精确为`package/README.md`、`package/package.json`、`package/dist/**`，无unexpected entry。
- 源`packages/preview/README.md`、fresh `dist/README.md`、tgz `package/README.md`与`package/dist/README.md`逐字节一致。
- README SHA-256：`b4614f7556a32ceefeb1e15019a2dc3b10e1aa2438ce0455e198e217bb6573a3`。
- 临时tgz SHA-256：`7794c0e70f584ad2a38e2f3106b64e63833d7e13a038025d63d3b1d808504a4d`。
- 包内四段标题、双Host install/update/pinned/remove命令、exact Doctor status-1断言及model-selected/strongWrites边界均存在。
- `git diff --check`通过。

**重门策略：**

本切片仅修改packaged文档，复用上一提交已经通过的真实双Host+Chrome lifecycle；输入未变，因此没有重复运行Host/browser重门。

## 结论

🟢 Effective。随tgz分发的指南已把真实验证过的双Host安装、版本切换、pinned恢复与目标级清理流程公开，并保持所有Release/authority边界诚实，可以精确提交。
