# feature-agent-native-change-intelligence Review Brief

> 生成时间：2026-08-17 20:30 +0800
> 分支：feature/agent-native-change-intelligence
> 基于 commit：5b23e84 feat: expose provider conformance candidate from doctor

## 背景与动机

本轮把第 15 步的 Provider 可运行候选和第 16-A-1 双 Host 安装 Alpha 从合同骨架推进到真实进程、文件系统和冷安装行为。目标是提供可演示的安装/Doctor/恢复链，同时明确保留 signed Registry、专用 OS principal 和 strong Store Gate 未关闭的事实。

## 改动策略

- 安装包复制自包含 CLI bundle，Codex/Claude wrapper 只调用安装目录内的 bundle；升级、回滚、Doctor、卸载继续由同一份 owned manifest 管理。
- Provider Doctor 在临时 0700 target 内启动两个 HMAC IPC child，验证 fixed locator、CAS、重启恢复，并额外运行脱敏 real-FS conformance candidate。
- service handoff 使用 signed Ed25519 config、root-only provision、专用 principal ownership、direct-child runtime namespace 和 signed readiness candidate；所有结果仍 read-only/strong locked。

## 改动范围

| 模块/职责 | 提交 | 做了什么 |
|---|---|---|
| Installation lifecycle / dual Host Alpha | `1f0d37e` | 自包含 bundle、Codex/Claude 冷 PATH 安装、Task 共享、upgrade/rollback/uninstall E2E |
| Provider Doctor / runtime CLI | `c9f45d9` | target continuity、HMAC child IPC、CAS/restart、service handoff、real-FS candidate、symlink entrypoint |
| Doctor candidate projection | `5b23e84` | 将 conformance candidate 绑定到同一次 Doctor probe 输出 |

## Review 重点

1. 安装 wrapper 是否脱离源码路径和外部命令，且 owned 文件篡改后 fail-closed。
2. 专用 runtime 的文件权限、locator containment、key ownership、readiness stale binding 和 symlink bin 启动行为。
3. unsigned candidate 是否被错误提升为 Provider authority。

## 已识别风险

修复前曾发现并关闭：

- 🔴 Blocking：provision 未创建 auth key/runtime root，也未把 key 交给 dedicated principal；已改为 root 创建 0700 root、生成 32-byte auth key、signing/auth key 0600 + principal chown。
- 🔴 Blocking：socket/readiness/key path 可位于 runtime root 外；已改为 runtime-owned direct-child 且互异，并同步 fixture。
- 🔴 Blocking：readiness 曾输出 service-principal authority 且未绑定 handoff payload digest；已收敛为 `signed_candidate`、`read_only`、`locked`，并加入 payload digest binding。
- 🟡 Risk：本机 Codex seatbelt 对 Unix socket 的行为依赖环境；Provider focused 在当前环境真实通过，仍保留 Linux/普通 macOS 运行验证。

当前未发现 P0/P1 或可执行 blocking P2。

## 测试情况

**已覆盖：**

- 双 Host Alpha E2E 1/1：冷 PATH、源码删除后运行、Codex refresh→Brief、Claude 续接、upgrade/rollback/uninstall。
- Provider runtime focused 10/10：service handoff、target continuity、real-FS conformance、installed symlink entrypoint。
- Provider Doctor/argv focused 25/25；CLI/runtime source+test typecheck、bundle build/help。
- 现有 final strong-ready lifecycle 2/2（success + invalid steady signature）。

**缺失：**

- ⚪ 正式 signed Registry/Evidence、独立 QA/Release 双签、immutable Installation Identity 和 strong Store authority 尚未关闭；本轮输出明确保持 candidate/read-only。
- ⚪ service readiness 在专用 OS principal 下的非 seatbelt live startup 需在受支持 CI/主机完成。

## 结论

🟢 本轮功能切片有效并已提交推送；Provider Gate 仍按合同保持锁定，不能据此宣布 17 步或总目标完成。
