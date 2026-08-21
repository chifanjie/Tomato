# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-21 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：fbec560 feat: ship installable Codex and Claude plugins

## 背景与动机

前一 Alpha 切片已经从单一 tgz 提供 Preview、完整 MCP、Codex/Claude 可安装 Plugin、
Pulse/Brief/Check/Verification、Workbench 和 managed-install Doctor，但用户在冷安装后直接运行
`understand-code doctor` 仍不能获得产品级 readiness 报告。本切片交付零参数 Alpha Doctor，
同时保持 Provider-backed strong write 和正式 Release 能力诚实 locked。

## 改动策略

CLI 仅在 `doctor` 没有 `--root`、`--home`、Provider 或 Provider-service 选择器时进入新的只读
Release Doctor；既有 managed/provider Doctor 语义保持不变。Doctor 从当前 Git 子目录归一到
canonical worktree，检查 Node、Git、Artifact schema、loopback，以及同一 Preview tgz 内的
package/release manifest、CLI、Server/Contracts、Dashboard、native tuple 和双 Plugin payload。
报告固定脱敏，并以 `readiness: "alpha"`、`releaseReady: false`、
`hostRegistration: "not_checked"`、`strongWrites: "locked"` 避免过度声明。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| Release Doctor | `packages/cli/src/release-doctor.ts` | 新增 13 项只读 readiness 检查、稳定错误码、脱敏结果与 locked residual |
| CLI 路由 | `packages/cli/src/bin.ts`, `packages/cli/src/index.ts` | 接入零参数 Doctor，同时保留旧 Doctor 入口 |
| 单产物元数据 | `packages/preview/scripts/build.mjs` | release manifest 增加 native、Server/Contracts 与最终 Dashboard inventory 绑定 |
| Focused 回归 | `packages/cli/test/release-doctor.test.ts` | 验证缺失 manifest 时 unhealthy、可恢复且不泄漏路径 |
| 仓外真实 E2E | `packages/preview/test/cold-packed.test.mjs` | 在同一冷安装 tgz 上验证 13 项检查、11 项通过与两个 locked 边界 |
| 用户说明 | `packages/preview/README.md` | 记录零参数用法、Alpha readiness 语义与未解锁能力 |

## Review 重点

1. 零参数入口不能改变 `doctor --root/--home/--provider/--provider-service` 的既有行为。
2. `healthy` 只能表示 Alpha 安装/read/check readiness，不能暗示 Host 已注册、正式 Release
   可信或 Provider strong write 已解锁。
3. release manifest 必须在最终 Dashboard 字节生成后写入，并由 Doctor 复算 Server、Contracts、
   Dashboard、native 与 Plugin 内容。
4. 所有失败结果必须固定脱敏，不输出仓库/安装绝对路径、原始 digest 或异常 cause。

## 已识别风险

| Tag | Summary | Location |
|-----|---------|----------|
| 🟡 Risk | Host-adapter manifest/config 目前仅做语义校验，未逐文件 digest；额外未引用字段可能不会令 `bundle_integrity` 失败。严格 digest 的双 Plugin payload 不受影响，按产品纵切策略进入 backlog。 | `packages/cli/src/release-doctor.ts:96` |

未发现阻塞 Alpha 的 P0/P1；上述风险不影响本切片的真实 Codex/Claude Plugin 安装路径，也不
改变 `release_authenticity` 与 `provider_strong_writes` 的 locked 状态。

## 测试情况

**已覆盖：**

- CLI typecheck 与全包测试：12 files / 81 tests 通过。
- Preview typecheck/build：通过。
- Preview runtime：8/8。
- 最终单一 tgz：54 entries，2,375,769 bytes，SHA-256
  `985c7aab56a3c5d54b7dad3897e46c2df0d8daad69a74ca541b33f7b3ed17711`；checksum 通过。
- 同一 tgz 的真实 Codex/Claude Plugin E2E：1/1；完整仓外 Alpha cold E2E：1/1。
- 冷测验证 11 项 required check 通过、两个发布级能力 locked、顶层 Alpha 语义和路径脱敏。
- 缺失 release manifest 的 focused 回归：1/1。
- Git 子目录 healthy 与未初始化仓库 `artifact_not_initialized` 已做真实 smoke。
- `git diff --check`：通过。

**缺失/后置：**

- ⚪ Test Gap：现有 cold E2E 在仓库根运行 Doctor，尚未用同一冷测锁定“从子目录归一到
  canonical top-level”；实现与真实 smoke 已通过，后续可直接调整现有调用 cwd。
- Host-adapter legacy template 的逐文件 digest/严格 exact-key 校验。
- Host 注册状态探测、签名、SBOM、provenance、跨平台与正式 Release gates。
- Provider Authority、execution fence、global rollback anchor 与 Provider-backed
  `strongWrites` 仍 locked。

## 结论

🟢 Effective：零参数 Alpha Doctor 已在最终冷安装字节上可运行、可诊断且不误报正式 Release
或 Provider strong write。上述非阻塞风险与 test gap 进入 backlog；本切片可以精确提交并推送。
