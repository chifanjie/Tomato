# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：2704e8f test: verify installed plugin alpha vertical

## 背景与动机

单一 Preview tgz 已能在 monorepo 外冷安装 CLI/MCP，并通过 Codex 与 Claude 官方 Plugin
缓存完成 Pulse→Brief→修改→Check→externally reported Verification。此前 `open_workbench`
仍由独立的内嵌页面承载，不能在同一安装载荷内复用完整 React Dashboard，也不能把 Change
Finding 的稳定 Evidence 连续下钻到受保护 Source、Graph 与 Wiki。本切片关闭该用户可观察断点，
同时保持 Provider Authority、execution fence 与 `strongWrites` locked。

## 改动策略

`open_workbench` 继续使用一次性 fragment token，并兑换为 HttpOnly、SameSite=Strict 的 loopback
session cookie；认证后的 Workbench 直接服务同一 tgz 内经过 inventory 校验的 React Dashboard。
所有 Task、Graph、Wiki 与 Evidence 读取都由服务端注入 repository/worktree/Snapshot/head 绑定，
浏览器不能提交或替换这些权威字段。Finding 只可打开自身持久化 Evidence；Source 必须通过路径、
digest、敏感文件与稳定读取校验；Snapshot 漂移后保留原 URL 并隐藏 Source/Graph overlay。

主 CLI、Codex Plugin 与 Claude Plugin 携带字节一致的 Dashboard inventory。普通或 Plugin CLI 的
Dashboard 缺失/篡改一律 fail closed；只有健康 managed installation 且 manifest 显式声明 legacy
edition 时，才允许有限的只读内嵌 Workbench，避免误报 React Graph/Wiki 能力。

## 改动范围

| 模块/职责 | 文件范围 | 做了什么 |
|-----------|----------|----------|
| Workbench session/gateway | `packages/workbench-runtime/**` | 校验 Dashboard bundle、cookie session、Task-local SPA 路由、Graph/Wiki/Task/Evidence gateway 与 stale 绑定 |
| CLI read composition | `packages/cli/**` | 注入 snapshot-bound Dashboard/Evidence reader，并把 Dashboard inventory 纳入 Doctor |
| React Task flow | `packages/dashboard/**` | Finding→Evidence/Source→Graph→Wiki→Task 导航、稳定 URL、stale/empty/error 状态 |
| Finding Evidence | `packages/task-engine/src/change-intelligence.ts` | 为 Change Finding 持久化 source Evidence，并只绑定所选 Source 文件对应的 Graph node IDs |
| Distribution | `packages/preview/**` | 主包与双 Host Plugin 携带同一 Dashboard；新增真实浏览器 packed E2E |
| Managed compatibility | `packages/installation-lifecycle/**` | 显式、健康 manifest 才允许 legacy read-only Workbench edition |
| Review 记录 | `docs/review/2026-08-22-feature-agent-native-change-intelligence-authority.md` | 记录本切片意图、审查结论、门禁与 residual |

## Review 重点

1. 同 Task 的 section/finding/evidence 可在 SPA 内导航和 reload；跨 Task、跨 view、未经授权的
   impact/focus 仍必须拒绝。
2. Dashboard reader 必须始终使用 redeemed session 的 repository/worktree/Snapshot/head，不能信任
   浏览器 query/body 提交的路径或身份。
3. Finding Evidence 必须属于当前 Task 与 Snapshot；Source 必须验证 digest，并拒绝敏感、越界、
   symlink、binary、过大或漂移的内容。
4. 每个 Evidence 的 Graph node IDs 只能来自同一个选定 Source 文件，不能在多文件 Finding 中串线。
5. 主包和两个 Plugin cache 必须携带与 release manifest 一致的 Dashboard bytes；缺失/篡改不能回退
   到另一份全局载荷。
6. 本切片不得解锁或暗示 Provider-backed strong write、受信命令执行或正式 Release 完备性。

## 已识别并修复的问题

- 多文件 Finding 曾把所有 actual changes 的 Graph node IDs 聚合到首个 Source Evidence；现已按所选
  `sourceChange.path` 过滤，避免 Evidence→Graph 跳到其他文件。
- Repo Pulse 的 `stale` 曾被误当成 Task Snapshot 漂移，从而隐藏同 Snapshot 的 Source；现仅显式
  Snapshot stale 触发安全隐藏，Pulse 仍独立展示自身状态。
- Task SPA 在同一 Task 中选择 Finding/Evidence 后 reload 曾被 `route_mismatch` 拒绝；现只放宽同
  Task 的 section/finding/evidence，跨 Task/view/impact/focus 仍 fail closed。
- 撤回了与功能无关的 Task-first 中文单语文案改动，恢复既有双语界面。

终审未发现 P0/P1、current-path P2 或 blocking Test Gap。

## 测试情况

**最终单一安装产物：**

- `/tmp/understand-code-workbench-final2.gHVP0G/understand-code-preview-0.1.0-preview.1.tgz`
- SHA-256：`8fac436a394581aa596e9b111136a5a0a3ed4b04790628e63d90f36d9f0045f2`
- 87 entries，3,173,183 bytes；后续门禁均消费该文件，未重新 build/repack。

**通过的门禁：**

- Dashboard typecheck；Task-first focused 4/4。
- Task Engine typecheck；多文件 Finding source/node 绑定 focused 1/1。
- Workbench Runtime package 10/10；CLI package 81/81；Installation Lifecycle 9/9；Dashboard package
  570/570（最终 copy-only 收口后 focused 再通过）。
- Preview typecheck/build 与 `git diff --check`。
- monorepo 外真实浏览器 packed Workbench E2E：1/1，0 skipped。
- 同一 tgz cold install/Doctor/lifecycle E2E：1/1，0 skipped。
- 同一 tgz 强制 Codex/Claude Plugin-cache Alpha E2E：1/1，0 skipped。

## 后置边界

- Verification 仍是外部执行后报告的证据，不是 Workbench 独立执行或 attested 的命令结果。
- Task-local Graph 选择新的 focus 后立即刷新，仍可能因 launch grant 固定原 focus 返回
  `route_mismatch`；已验证的 Graph→Wiki→返回 Task/Finding→stale reload 路径不受影响。
- managed-copy 生命周期尚未把 React Dashboard inventory 纳入 upgrade/rollback，当前只提供 manifest
  明示的 limited legacy read-only Workbench。
- Provider Authority、grant trust、execution fence、global rollback anchor、签名/SBOM/provenance、
  跨平台与完整 Host-mediated browser gates 继续保持 locked/backlog。

## 结论

🟢 Effective：用户从单一冷安装 tgz 或真实 Codex/Claude Plugin cache 启动 MCP 后，可以在同一
React Workbench 中沿 Change Finding 查看自身 Evidence 与受保护 Source，进入关联 Graph/Wiki，
返回原 Task，并在仓库刷新后得到可追溯的 stale 结果。该切片没有扩大或误报安全能力，可精确提交。
