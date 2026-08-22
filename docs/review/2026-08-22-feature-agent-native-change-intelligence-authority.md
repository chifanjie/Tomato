# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 11:39 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：c566933 feat: analyze staged changes across files

## 背景与动机

单一 Preview tgz 已能通过真实 Codex/Claude CLI 安装插件、从 Host cache 启动 MCP、完成 Task 闭环并跨 Host 恢复，
但此前只验证一个版本。Step 16/WP6 仍缺少“版本切换后重新加载 active cache，并恢复同一 repo Task”的用户可观察证据。
本切片只补这条生命周期协议门禁，不把同代码 fixture 误报为两份正式 RC。

## 改动策略

- 从同一冷安装 tgz 精确复制不可变 v1 plugin payload；用现有 `build-bundle.mjs --product-version` 在 temp 中生成
  embedded version 真正不同的 v2 CLI，并同步双 Host plugin manifest、Claude marketplace version 与 Dashboard manifest。
- 使用隔离的 mutable local marketplace facade，所有 Host cache 变更只通过真实 Codex/Claude CLI；测试不直接写 cache。
- Codex 按官方 local-plugin 更新流程再次执行 `plugin add`，称为 cache replacement/reinstall；Claude 执行
  `marketplace update + plugin update`，并以 fresh MCP process 模拟其明确要求的 restart。
- 每个阶段都闭合 Host active metadata/install result → cache bundle SHA → Doctor → MCP `serverInfo.version` → exact
  `taskId/status/revision/baselineSnapshotId/sourceSnapshotId/Verification replay`。
- 回到 v1 时两端都走显式 official reinstall；不称 atomic downgrade、rollback 或 hot reload。Claude retained cache 只作为
  inert residual 观察，执行入口始终来自当前 active registration。

官方 OpenAI 文档说明 local marketplace 用于 authoring/testing/private distribution，Host 从 cache 副本而非 source 运行：
[Package your plugin](https://developers.openai.com/plugins/build/plugins)。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Mandatory Host lifecycle E2E | `packages/preview/test/plugin-clean-install.test.mjs` | v1/v2 version-bound fixtures、Codex cache replacement、Claude update/restart、pinned-v1 reinstall、Task recovery 与 cleanup |

## Review 重点

1. **版本真实性** — v2 必须包含重新构建的 embedded PRODUCT_VERSION；只改 manifest/Doctor metadata 会造成假绿。
2. **active cache authority** — Codex cache path 来自 `plugin add --json`，Claude path 来自 active `plugin list --json`；不得执行 orphan/inert cache。
3. **reload 与恢复** — 旧 MCP 必须 clean-exit，fresh process 必须报告当前版本，并读取完全相同的 Task/Snapshot/revision。
4. **诚实语义** — Codex 是 reinstall/cache replacement；pinned-v1 是显式重装；本切片不是原子升级/降级或 Release migration。

## 已识别风险

未发现 P0、P1、current-path executable P2 或 blocking Test Gap。

残余风险：v2 由同一 workspace 代码生成，只改变版本绑定；没有重新生成完整 release manifest/provenance，也没有跨历史
Schema 差异。因此本证据仅支持 lifecycle routing/recovery，不能支持两个正式 RC、Schema migration、原子 upgrade/downgrade、
Host hot reload 或 Claude zero-residue uninstall 声明。

## 测试情况

**已覆盖：**

- `node --check packages/preview/test/plugin-clean-install.test.mjs`。
- `pnpm --filter @understand-code/preview typecheck`。
- 强制真实 Host gate：`UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS=1 pnpm --filter @understand-code/preview test:plugins`，
  1/1 通过，24.5 秒，0 skipped。
- v1 payload 关键 bytes 与 tgz 精确相等；v1/v2 CLI SHA 不同；同阶段 Codex/Claude active CLI bytes 相等。
- Codex 官方再次 `plugin add` 实际切换 v2 cache；Claude `marketplace update + plugin update` 实际切换 active v2。
- 两 Host v2 fresh MCP、Doctor 与 exact Task recovery 通过；pinned-v1 official reinstall 后再次恢复，idempotent replay 不推进 revision。
- 最终 Codex remove、Claude uninstall/marketplace remove 与双 Host Doctor `not_registered` 通过；`strongWrites` 始终 locked。
- `git diff --check`。

**缺失：**

- 无当前切片 blocking 缺口。两个保留的真实历史 tgz、credentialed/model-selected Host session、RC signing/SBOM/provenance、
  cross-platform 与 Provider execution fence 仍属于后续 mandatory release gates。

## 结论

🟢 Effective。真实 Codex/Claude Host lifecycle 已证明 v1→v2→pinned-v1 的 active cache 切换、fresh MCP 重载与同一
repo Task 精确恢复；能力声明保持在本地 lifecycle protocol 范围内，可以精确提交。
