# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-20 19:20 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：9622e57 feat: verify locked broker trust
> 审查意图：交付一个单 tarball、可冷安装和完整体验的 Understand Code Alpha 产品纵切

## 背景与动机

当前任务退出条件已从“一次完成长期 17 步正式产品路线”调整为可安装、可启动、可体验的 Alpha 里程碑。用户需要在真实仓库完成安装与 MCP 初始化、Pulse/Brief、Graph/Wiki 理解、一次宿主侧真实修改、Change Check、可追溯 Verification、Doctor 和清理；尚未闭合的 Provider Authority、execution fence、global rollback anchor 与跨平台发行加固必须继续保持 locked，但不再阻塞 Alpha。

## 改动策略

复用已经能够冷安装的 `@understand-code/preview` tgz 作为唯一产物，把其中的三工具 Preview CLI bundle 切换为既有 full CLI profile，并携带当前平台的 exact native tuple。Viewer 继续提供 Demo 和真实 `--root` Graph/Wiki；同一 tgz 的 `understand-code` 提供完整 11-tool MCP 和 managed install/Doctor/uninstall。

产品纵切不引入 shell runner，也不解锁 strong writes。源码修改和验证命令均由宿主在 MCP 外执行；Understand Code 负责生成 Snapshot、执行 Change Check，并把调用方报告的命令、退出码、输出摘要和 Snapshot/Claim 绑定持久化。冷安装 E2E 用公开 MCP 完成状态迁移，并在新进程中精确重放 Verification。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| Alpha 使用说明与安全边界 | `packages/preview/README.md` | 说明单 tgz、full 11-tool MCP、安装/Doctor/uninstall、externally reported Verification，以及继续 locked 的 Authority/strongWrites/fence |
| 单一产物构建 | `packages/preview/scripts/build.mjs` | 构建 full CLI 所需 workspace 依赖，使用 `full` bundle profile，并把 exact current-platform native peer 纳入 tgz |
| 真实仓库 Graph/Wiki | `packages/preview/src/server.mjs` | 用启动 Snapshot 的 opaque `rootIdentity` 校验 full indexer Wiki，替代错误的绝对路径比较 |
| Viewer 回归 | `packages/preview/test/preview.test.mjs` | fixture 使用正式 `rootIdentity`，保留 identity mismatch fail-closed negative |
| 安装到 Verification 纵切 | `packages/preview/test/cold-packed.test.mjs` | 同一 tgz 外部安装；Demo/真实 Graph/Wiki；managed install/Doctor；公开 MCP Pulse/Brief/更新/Check；宿主真实修改与行为测试；Verification/verified/restart replay；EOF/Preview stop；uninstall 清理 |

## Review 重点

1. **单一安装产物** — 冷测必须直接消费最终保留的 tgz，且 tgz 只含一个 current-platform native tuple、无 workspace 运行时依赖。
2. **真实产品闭环** — Task 状态推进只走公开 MCP；源码由宿主真实修改；Verification 前实际执行行为测试，而不是仅做格式检查。
3. **Graph/Wiki 身份绑定** — real `refresh_index full` 生成的 `root-…` identity 必须能被 Preview 读取，同时不同 identity 仍 fail closed。
4. **不误报安全能力** — Verification 是 externally reported evidence；Provider Authority、execution fence、global rollback anchor、production cross-platform hardening 和 `strongWrites` 均未解锁。

## 已识别风险

未发现阻塞问题。

审查期间发现并关闭一个当前路径 P2：最初冷测把 verification method `test` 绑定到 `git diff --check`，行为错误但格式正确的改动也可能被记录为 passed。最终测试改为由独立 Node 进程真实加载修改后的 `src/task.ts` 并断言 `task()` 返回预期结果，持久化 command descriptor 与实际执行一致。

## 测试情况

**已覆盖：**

- Preview typecheck：通过。
- Preview build：通过。
- Preview runtime：8/8 通过。
- Preview package test：通过。
- 最终保留 tgz 的 monorepo-external cold E2E：1/1 通过；测试不会在内部重新打包。
- MCP initialize/list/EOF exit、Preview SIGTERM/port release、Demo 与真实 full-indexed `--root` Graph/Wiki：通过。
- install → Doctor → installed wrapper → Pulse/Brief → 外部真实修改 → Check → 外部行为测试 → Verification → verified → restart exact replay → Doctor → uninstall/owned cleanup：通过。
- `git diff --check`：通过。

**里程碑后置：**

- 不在本 Alpha 提前穷举 Authority/broker crash cuts、corruption mutation、三方竞态和跨平台组合。
- 正式发布前仍需补跨平台分发、真实浏览器 Surface、Provider execution fence、Authority lifecycle、全局 rollback anchor 与独立 Verification 真实性证明。

## 结论

🟢 Effective：改动达成已确认的 Alpha 纵切意图，可以精确提交和推送。它证明的是可安装的本地 Alpha 与 Snapshot-bound Check / durable externally reported Verification，不是正式 Release，也不构成 production strong write 或 Provider Authority 解锁。
