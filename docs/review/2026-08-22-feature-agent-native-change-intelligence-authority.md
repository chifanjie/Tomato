# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：b91c78c feat: ship task-bound React Workbench

## 背景与动机

单一 Preview tgz 已能在 monorepo 外冷安装，并从正式 Codex/Claude Plugin cache 完成
Pulse→Brief→修改→Check→externally reported Verification 与 React Workbench 体验。此前 release-managed
安装仍只拥有 CLI/native/config 五个固定文件，`open_workbench` 因缺少相邻 Dashboard 只能退回有限的
legacy read-only 页面；upgrade、rollback、Doctor 与 uninstall 也无法管理 React Dashboard 的动态 hashed
asset inventory。本切片把完整 React Workbench 纳入同一个 managed 生命周期，同时保持 Provider Authority、
execution fence 与 `strongWrites` locked。

## 改动策略

安装源必须提供与 CLI 同版本的 `dashboard-manifest.json` 和 `dashboard/`。lifecycle 在写入前拒绝 symlink、
非规范路径、半缺载荷、版本或 inventory digest 不匹配，并把 manifest 与全部 Dashboard 文件作为动态 owned
inventory 写入安装 manifest。Doctor 重算实际 inventory；upgrade 删除旧 hashed assets；rollback 恢复前一版
精确文件集合；uninstall 只删除 manifest-owned 文件并保留用户文件。旧 4/5-file manifest 继续可读，只有
Dashboard 和 manifest 同时缺失且 manifest 明示 legacy edition 时才允许有限 fallback。

Workbench session cookie 绑定 loopback host 而不绑定端口。新 runtime 的 `/workbench` HTML 入口遇到上一进程
遗留、对当前 runtime 无效的 cookie 时，会重新提供一次性 fragment-token handoff 页面；所有 Dashboard data、
asset 与 Task/Evidence API 仍要求当前 runtime 的有效 session，不降低认证边界。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| Managed lifecycle | `packages/installation-lifecycle/src/index.ts` | 动态 Dashboard inventory、严格 source validation、Doctor、upgrade/rollback/uninstall |
| Lifecycle regression | `packages/installation-lifecycle/test/installation-lifecycle.test.ts` | v1/v2 不同 hashed asset 集合、升级删除与回滚精确恢复 |
| Workbench handoff | `packages/workbench-runtime/src/index.ts` | 失效旧 cookie 仅在 HTML handoff 入口重新建立当前 runtime session |
| Session regression | `packages/workbench-runtime/test/workbench-runtime.test.ts` | 旧 runtime cookie 下的 fragment handoff 回归 |
| Installed browser E2E | `packages/preview/test/workbench-browser-packed.test.mjs` | 同一 tgz 的 managed install→v2 启动→rollback→Doctor→uninstall |
| 用户边界 | `packages/preview/README.md` | 说明 managed React inventory 与 legacy fallback 边界 |

## Review 重点

1. Dashboard 动态路径只能位于 `lib/dashboard/**`，并须与相邻 manifest 的版本、数量和 inventory digest 精确一致。
2. upgrade 必须移除旧 hashed asset，rollback 必须恢复旧精确集合；任一 foreign/modified/symlink 路径均 fail closed。
3. uninstall 只能删除安装 manifest 声明且 Doctor 再验证通过的文件，不能删除同 root 下用户 sentinel。
4. 无效旧 cookie 只能重开 `/workbench` handoff；Dashboard/data/static 路径不能因此变成未认证可读。
5. 本切片不得解锁或暗示 Provider-backed strong write、受信命令执行或正式 Release 完备性。

## 已识别并修复的问题

- 浏览器 cookie 不含端口，停止旧 Workbench 后启动新 runtime 时，旧 cookie 曾让新 deep link 在 fragment handoff
  前返回 401。现在仅 HTML 入口把无效 cookie 视为未建立 session，并由一次性 token 建立新 cookie。
- 初版 E2E 只比较 v2 bytes 与 Doctor，未实际启动升级后的 React Workbench。最终 E2E 已从 upgraded managed
  wrapper 初始化 v2 MCP、读取原 Task、打开 React，并观察到 v2 meta marker。
- 初版 unit fixture 的 v1/v2 文件名集合相同。最终 fixture 使用 `old.js`→`new.js`，验证 upgrade 删除旧文件、
  rollback 恢复旧文件并删除新文件。

终审未发现 P0/P1、current-path P2 或 blocking Test Gap。

## 测试情况

**最终安装产物：**

- `/var/folders/fx/9nkzyp1x0bqcyrrp6kghgyzw0000ks/T/uc-workbench-browser-pack-XaJzJE/understand-code-preview-0.1.0-preview.1.tgz`
- SHA-256：`f33dc09a58721ebe82e3c0002767ae1eedb996608dfe38dd6ad7c7c43ab8e6ab`
- 87 entries；真实 Chrome E2E 直接消费该 packed artifact。

**通过的门禁：**

- Installation Lifecycle package：9/9；变更 happy path focused：1/1。
- Workbench Runtime package：10/10。
- CLI typecheck/build；Preview typecheck/build。
- managed packed React browser E2E：1/1，0 skipped。
- `git diff --check`。

E2E 从同一 tgz 完成 global cold install、managed install、React Task/Finding/Evidence/Graph/Wiki、v2 upgrade；
升级后的 managed MCP 报告 v2 版本并显示 v2 React marker；rollback 后同一 Chrome profile 恢复 base Task；Doctor
健康；uninstall 删除动态 owned inventory、保留用户 sentinel。

## 后置边界

- 当前真实 Dashboard/CLI/native 远低于 rollback 上限；声明的 96 MiB Dashboard raw 上界与 160 MiB
  base64 rollback snapshot 上界理论上不完全自洽，作为容量策略 backlog 收口，不阻塞本 Alpha 产物。
- directory `fsync` 在 rename 后失败时，best-effort in-process recovery 可能返回 partial 而不是完整恢复；不会
  错误成功，完整 I/O/crash cut 证明留到正式 Release gate。
- Provider Authority、grant trust、execution fence、global rollback anchor、签名/SBOM/provenance、跨平台与
  完整升级/降级矩阵继续保持 locked/backlog。
- Verification 仍是外部执行后报告的证据，不是 Workbench 独立执行或 attested 的命令结果。

## 结论

🟢 Effective：用户从单一安装产物创建 managed installation 后，可以启动完整 React Workbench；升级会切换
到版本绑定的 Dashboard，回滚可恢复原 Task 与原 inventory，Doctor 和 uninstall 对同一动态 owned 集合生效。
改动没有扩大或误报安全能力，可以精确提交。
