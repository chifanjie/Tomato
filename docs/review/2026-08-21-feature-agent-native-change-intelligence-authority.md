# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-21 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：98299ce feat: ship single-artifact dual-host alpha

## 背景与动机

前一 Alpha 切片已经从一个 tgz 提供 Preview、完整 MCP、managed Host wrapper、
Pulse/Brief/Check/Verification、Workbench、Doctor 与清理路径，但还没有可由 Codex 和
Claude Code 官方插件 CLI 安装的自包含 Plugin。这个切片把两套 marketplace/plugin
payload 纳入同一产物，并从真实 Host 安装缓存启动 MCP。

## 改动策略

Preview 构建从受版本约束的模板生成 Codex 与 Claude Code marketplace/plugin 根；每个
插件 payload 都携带与主发行 CLI 字节一致的 MCP bundle，安装缓存不依赖 monorepo、全局
Understand Code 命令或原始 tgz 路径。Codex 由 Host cwd、Claude 由
`CLAUDE_PROJECT_DIR` 选择仓库，两者都归一化到真实 Git worktree top-level。包装器在
仓库探测和 MCP 子进程前清除 ambient `GIT_*` authority，防止 Root 被环境重定向。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| Plugin 模板 | `packages/host-adapters/plugin-roots/**` | 新增 Codex/Claude marketplace、plugin manifest 与 direct MCP map |
| Plugin 入口 | `packages/preview/src/codex-plugin-bin.mjs` | 从 Host 信号解析真实 worktree、清理 ambient Git authority、启动同缓存 MCP |
| 单产物构建 | `packages/preview/scripts/build.mjs`, `packages/preview/package.json` | 复制两套自包含 payload，校验版本/schema/CLI parity，并写逐文件与聚合 digest |
| 仓外真实 E2E | `packages/preview/test/plugin-clean-install.test.mjs` | 隔离 Host home，真实 add/install/list/remove，并从安装缓存调用 MCP |
| 发行冷门 | `packages/preview/test/cold-packed.test.mjs` | 精确锁定 54 个 tgz 文件、mode、分区体积预算、payload bytes 与 release manifest |
| 用户说明 | `packages/preview/README.md` | 记录安装命令、Root 语义、已验证能力与未闭合边界 |

## Review 重点

1. Codex 使用官方 `.codex-plugin/plugin.json`、repo marketplace 与 direct `.mcp.json`；
   Claude marketplace 必须通过真实 `plugin validate --strict`。
2. Host 缓存必须携带同版本 CLI，不能引用 workspace、全局 Understand Code 命令或已搬走的 tgz。
3. Root 必须由真实 Host 信号导出，ambient `GIT_*` 不能把读写重定向到另一仓库。
4. 单一 tgz 必须同时通过现有 Alpha 冷安装链与真实双 Host 插件生命周期。
5. 本切片不得被误报为 credentialed/model-selected Host 调用、正式 Release 或 Provider strong write。

## 已识别风险

终审中发现并关闭两项当前路径问题：

- 包装器最初继承 `GIT_DIR/GIT_WORK_TREE`，可把 Host Root 重定向到另一仓库；现已统一清除
  ambient `GIT_*`，并由第二个真实仓库的确定性回归证明产物只落目标 Root。
- Codex manifest 最初用可选 `Read` capability 低报本地 `.understand-code` Artifact 写入；
  该误导字段已删除，Provider-backed `strongWrites` 边界仍明确 locked。

修复后未发现 P0、P1 或当前产品路径 P2。

## 测试情况

**已覆盖：**

- Preview typecheck 与 build：通过。
- Preview runtime：8/8。
- 真实插件 E2E：1/1。Codex 0.148.0-alpha.15 与 Claude 2.1.202 在隔离 home 中完成
  marketplace add、plugin install/list/remove；Codex MCP registration 也经 `mcp list/get` 复核。
- 两个真实安装缓存分别完成 MCP initialize、tools/list、refresh_index 与 get_repo_pulse。
- Codex cwd 与 Claude `CLAUDE_PROJECT_DIR` Root 绑定、非仓库/缺失 Root 脱敏失败，以及
  ambient 第二仓库 `GIT_DIR/GIT_WORK_TREE` 无法重定向 Artifact。
- 最终单一 tgz：54 entries，2,354,728 bytes，SHA-256
  `9cb03654f7a9571d173521bd5daf41a481d95967684bd9210c58bceeeb41624b`。
- 该精确 tgz 的完整 Alpha monorepo 外 cold E2E：1/1；checksum 校验通过。
- release-manifest 的 marketplace/manifest/MCP/entrypoint/CLI/aggregate digest 已独立复算。
- `git diff --check` 与独立只读审查：通过。

**缺失/后置：**

- 未运行需要真实凭证的 model-selected Codex/Claude chat 内 Tool 调用；本切片证明的是官方
  插件 CLI 生命周期、注册和安装缓存 MCP 调用。
- Claude 2.1.202 uninstall 会保留 inert 下载缓存；active plugin/marketplace 已清空，测试
  隔离目录最终删除。
- 两个真实版本 tgz 的 upgrade/downgrade/reload、真实 Host UI harness 与完整 Doctor。
- 签名、SBOM、provenance、跨平台与完整 release/security gates。
- Provider Authority、execution fence、global rollback anchor 与 Provider-backed
  `strongWrites` 仍 locked。

## 结论

🟢 Effective：改动达成“单一 Alpha tgz 的 Codex/Claude 可安装 Plugin”意图，可以精确
提交并推送。它提供真实插件 CLI 安装生命周期和缓存态 MCP 产品路径，但不构成正式
Release，也不宣称 credentialed Host 会话或 Provider-backed strong write 已解锁。
