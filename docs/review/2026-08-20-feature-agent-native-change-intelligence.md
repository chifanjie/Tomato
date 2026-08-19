# Provider Acceptance Authority Store Candidate Review Brief

> 生成时间：2026-08-20 06:14 CST
> 分支：`feature/agent-native-change-intelligence`
> 基于 commit：`4cf26f6 feat: add formal provider acceptance contracts`

## 背景与动机

正式 Provider Acceptance ABI 已冻结，但 runtime 现有 filesystem substrate 仍明确是
`authority:none` / read-only candidate，独立 replay ledger 也不能把 current CAS、receipt
和 mutation outcome 组成一个生产事务。本次改动先落一个真正可运行的、Node-only 的
installation-owner authority-store candidate，用来验证正式 current/read/compare-append
合同、跨进程序列化与崩溃恢复；它不是生产 broker，也不解锁 strong writes。

## 改动策略

1. 新增 private workspace package `@understand-code/durable-object-provider-authority`；
   production locator 只由 OS account 信息派生，忽略 `HOME`、XDG、cwd、tmp 和 caller
   path，测试 root 只能通过 `NODE_ENV=test` 下的 opaque capability 使用。
2. 以预置的 32-byte Installation Identity owner key 验证 state/current/receipt HMAC；
   key 每次通过 checked file descriptor 读取，并在 callback 后清零。公开 surface 只提供
   locked status、path-redacted Doctor 和 doctor-only CLI，不导出 key/token mint。
3. 每次 compare-append 将完整 generations、enumeration、high-water、receipts 与 transaction
   chain 写入一个认证 snapshot；独立认证 publication intent/pin 在 snapshot 前持久化，
   只有 exact N→N+1 intent 才能恢复中断的发布。单独回放旧 snapshot 或旧 pin 会 fail closed。
4. 用 HMAC lock envelope、prepare→hard-link publication、dead-owner recovery claim 和
   quarantine 实现跨进程序列化；process-local turn 只允许精确 nonce/dev/ino 的 failed-release
   lock 在原操作结束后恢复。
5. 容量门只声称 Acceptance-local：执行正式 generation/receipt/单 receipt limits，并确保
   local contribution 不越过 total ceiling；缺少 Root/Registry/Catalog authoritative bytes
   时不声称 global D-40 capacity authority。
6. 将新包接入 root build/typecheck/test、clean-build inventory、lockfile 和 CI 显式测试。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
| --- | --- | --- |
| Authority store | `packages/durable-object-provider-authority/src/acceptance-store-core-internal.ts` | 正式 current/read/compare-append、完整历史闭合、nonce replay、容量与双层 publication |
| Key/layout/filesystem | `src/key-custody-internal.ts`, `src/platform-layout.ts`, `src/filesystem-internal.ts`, `src/crypto-internal.ts` | 固定 OS locator、identity 三元组、HMAC、严格 owner/mode/nlink/O_NOFOLLOW/fsync 与脱敏错误 |
| Cross-process lock | `src/cross-process-lock-internal.ts` | prepare/hard-link lock、claim/quarantine recovery、same-process failed-release 恢复 |
| Safe surfaces | `src/index.ts`, `src/acceptance-store-internal.ts`, `src/cli.ts`, `README.md` | locked candidate API、internal store subpath、doctor-only CLI、明确非目标和残余边界 |
| Verification | `packages/durable-object-provider-authority/test/**` | formal closure、独立 HMAC oracle、双进程 CAS、17 个 snapshot/publication/lock SIGKILL cuts、identity/layout tamper、capacity、CLI |
| Workspace integration | `package.json`, `pnpm-lock.yaml`, `scripts/clean-build-artifacts.mjs`, `.github/workflows/ci.yml` | build/typecheck/test 顺序、workspace importer、clean dist 与 CI authority suite |

## Review 重点

1. **双层 durable publication** — 只有先持久化且认证的 intent 可以把 snapshot N+1
   收敛为新 pin；naked old-pin/new-snapshot 组合必须拒绝。
2. **完整历史闭合** — 读取时重算每个 committed prefix 的 enumeration digest、floors、
   current/high-water、receipt nonce、transaction chain 与 per-record byte caps，不能只验证
   snapshot 外层 HMAC。
3. **锁与恢复安全** — partial prepare、nlink=2、dead breaker、quarantine 和 late canonical
   都只能清理被 claim pin 的 inode；release failure 必须脱敏且同 nonce replay 零写。
4. **权限与能力边界** — public/CLI 不得接受 root/key/path，不得泄漏 path/token/cause；
   `strongWrites` 必须一直是 `locked`。

## 已识别风险

未发现剩余可复现 P0/P1/P2。审查过程中识别并在提交前关闭了：旧 pin 无 intent 的错误前推、
CAS loser reason 顺序、lock waiter 提前退出、raw filesystem path 泄漏、same-process failed-release
自锁、identity/layout partial deletion 误报 unprovisioned、load-time per-record cap 漏验、语义
tamper 只命中外层 HMAC、clean/CI 集成缺口。

接受的 locked-candidate residual：

- 整个 authority root 或底层卷一起回放仍不可检测；生产 authority 需要独立 append-only /
  OS-backed monotonic anchor。
- lock owner 当前没有 kernel process-start token；PID 被无关长进程复用时会保守返回
  `authority_busy`，直到该进程退出。不会误回收活锁，但可能阻断可用性。
- global 256 MiB trust-history admission 缺少 Root/Registry/Catalog authoritative byte source；
  当前只做 Acceptance-local 必要门槛。
- broker UDS/kernel-peer、grant/current/mutation outcome 原子 fence、exact-object provider 与
  Artifact Store adapter 均未接线，因此本切片不能授权 provider I/O。

## 测试情况

**已覆盖：**

- Authority package source/test TypeScript、build：通过。
- Full package Vitest：7 files，118 passed / 3 skipped。
- 两个真实 Node process 同 head CAS；一个 committed、一个 durable
  `expected_current_changed`，两者 replay byte-identical。
- 9 个 snapshot/publication 与 8 个 lock/claim/quarantine SIGKILL phases；所有恢复后
  transient private files 清零，并覆盖 late/new canonical 保留。
- 独立 Node JCS/SHA/HMAC oracle 重签外层合法 snapshot+pin，验证 9 类内部历史攻击。
- identity key/state/init、required directory、symlink/hardlink/type/mode/owner/nlink tamper，
  以及 long-lived handle 的每次重验。
- Acceptance-local literal capacity N/N+1、replay bypass、正式 >1 MiB receipt load rejection。
- hostile environment locator、Doctor/CLI exit 0/1/2 与 path/key/token/cause redaction。
- `git diff --check`：通过。

**环境限制：**

- 3 个 owner-mismatch negative tests 需要 root 才能制造 foreign UID，当前非 root 主机按条件
  skip；真实 positive owner/gid/mode/nlink checks 已执行。
- 严格 schema 下 4096-selection 最大合法 generation 仍小于 4 MiB，无法黑盒构造
  “formal-valid 且 >4 MiB”的样本；load guard 已显式重新 canonicalize 并检查该上限。

## 结论

🟢 本次改动有效交付了可运行、可验证、fail-closed 的 installation-owner Acceptance
authority-store candidate，并保持 production strong writes locked。可以精确提交；下一切片
必须实现 Root/OS broker 与跨 provider mutation outcome 的 authority fence，不能把当前
compare-append store 单独升级为生产写权限。
