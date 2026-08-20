# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-20 12:03 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：59c9d56 fix: freeze preview candidate surface
> 确认的审查意图：仅交付 source-internal、未接 runtime 的 locked broker transaction/recovery candidate

## 背景与动机

长期目标仍处于第 15 步 Provider Gate/WP5 生产闭环。现有 runtime 的强写顺序是先 durable consume/burn grant，再执行 provider side effect；若进程在两者之间崩溃，会留下“grant 已消费但 mutation outcome 未知”的不可恢复状态。本切片先在 Installation-owner authority 包内建立一个不公开、不授权 I/O 的 transaction substrate，把 fresh Acceptance basis、完整 request/grant、自绑定摘要和 pending/resolved outcome 作为可崩溃恢复的同一持久化状态机。

确认的边界是：本切片只承诺 durable pending/resolved 绑定、exact replay 与冲突零写拒绝；grant/response 签名真实性、provider execution fence、runtime/server/client 接线和公开强写均未建立，所有公开 Surface 继续保持 `strongWrites: "locked"`。

## 改动策略

- `begin` 与 Acceptance compare-append 复用同一跨进程 authority lock，在锁内重读已认证 current；新 grant 只能绑定 exact fresh Acceptance identity。
- full strict request、request content digest、formal request digest、session binding digest 与 grant claims 全量重算并持久化；相同 grant + 相同 canonical request byte-exact replay，不同请求零写拒绝。
- `resolve` 只允许既有 pending intent；common response fields 必须回指原请求，write success 精确绑定 locator/logicalBytes/content digest，compare committed 精确绑定 next revision/phase/nonce/artifacts 且拒绝空 mutation digest。
- broker 使用独立 HMAC snapshot + 独立 publication pin，并以 deterministic prepare/stage/rename/fsync 顺序发布；恢复只接受完整、精确连接的状态。
- load 重新解析所有 intent、重算 accounting/capacity、验证 Acceptance 历史仍在 complete enumeration 中，并要求唯一 revision 公式 `snapshotRevision = intentCount + resolvedCount`。
- broker locator、opener 与 test seam 都保持 package-private；未修改 package export map、root index、CLI、runtime、client、contracts、lockfile 或公开 capability 状态。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| Broker durable core | `packages/durable-object-provider-authority/src/strong-mutation-broker-core-internal.ts` | pending/resolved 状态机、两层 publication、replay/mismatch、load closure 与 local capacity |
| Shared Acceptance serialization | `src/acceptance-store-core-internal.ts` | 在同一 authority lock 内投影最小 current view 与 callback-only key custody |
| Durable filesystem cuts | `src/filesystem-internal.ts` | broker crash phases；大 snapshot stage 的 exact checked cleanup 上限 |
| Fixed internal layout | `src/platform-layout.ts` | 增加不进入 public locator set 的 broker snapshot/pin locators |
| Identity fail-closed classification | `src/key-custody-internal.ts` | broker canonical/stage/prepare 和真实随机 lock/recovery preparation 残留不再误判 unprovisioned |
| Test-only composition | `src/test-seam-internal.ts` | 仅 `NODE_ENV=test` 可取得 broker opener/inspection/admission seam |
| Scope documentation | `README.md` | 明确 locked/not-established、local capacity 和 mutation-digest residual |
| Regression evidence | `test/strong-mutation-broker-*.ts`, `test/strong-mutation-broker-worker.mjs` | bindings、authenticated tamper、capacity、双进程线性化与 SIGKILL recovery |

## Review 重点

1. **Fresh current 与 replay 顺序** — 新 grant 必须先绑定锁内 fresh current；既有 exact intent 在 Acceptance 追加后仍能重放/完成。
2. **没有 standalone burn** — 每个 durable consume candidate 必须至少包含完整 pending request；崩溃后只能恢复为 absent/pending/resolved 完整态。
3. **Outcome 不是只看 common fields** — schema-valid success 也必须与原 write/compare request 的本地可推导语义闭合。
4. **Publication 与 identity residue fail closed** — canonical/stage/pin/revision、随机 lock prepare、nlink=2 与大 snapshot cut 不得被降级为 unprovisioned 或静默采纳。
5. **Surface 不被误解锁** — package root、export map、CLI、runtime 与 public locator set 必须保持无 broker API；状态仍是 locked/not-established。

## 已识别风险

独立审查未发现剩余 P0、P1 或影响当前确认范围的 P2。审查过程中发现并已修复：

- snapshot revision 原先只校验范围，现收紧为 exact `intentCount + resolvedCount`；
- response 原先只绑定 common fields，现加入 write/committed compare 的可推导 success 语义；
- broker/随机 lock preparation 残留原先可能误判 unprovisioned，现均 fail closed；
- compare committed 现拒绝 `mutationDigest: "none"`，并撤销“所有 digest 均已精确验证”的过度声明。

明确保留的 locked residual：

- active Registry grant key/signature、provider response signature和 exact runtime-private mutation-digest derivation尚未验证；
- begin 到 provider execution/resolve 之间没有 authority execution fence；
- 4,096 intent / 8 MiB frame / 256 MiB snapshot 只是 broker-local guard，不代表 Root/Registry/Catalog/Acceptance 全局 D-40 admission；
- PID reuse 保守 false-busy、协调回放整个 root-owned snapshot+pin 的 OS rollback 边界仍未建立硬件/OS monotonic anchor。

非阻塞 Test Gap：没有构造 independently authenticated 的 4,096-intent、8 MiB frame、256 MiB snapshot load-time N/N+1 全量 fixture；已有纯 classifier N/N+1、load-time re-canonicalization、多 intent、正式大 receipt 和大 deterministic stage 覆盖。本候选不据此声称 global capacity authority。

## 测试情况

**已覆盖：**

- authority source + test TypeScript：通过。
- authority 整包：10 files，193 passed / 3 skipped；skip 仅为非-root环境无法制造的 owner-mismatch negative fixtures。
- broker focused：unit 30/30、authenticated integrity 22/22、process/crash 23/23。
- 双真实 Node process：同 G1 的 broker begin 与 G2 Acceptance compare-append 只产生两种合法线性化终态。
- G1 pending 在 Acceptance 推进到 G2 后仍可 resolve，并在重启后 exact replay；`executionFence` 保持 `not_established`。
- begin/resolve 各九个 deterministic publication SIGKILL phase、lock acquisition/recovery preparation SIGKILL、nlink=2 与大 snapshot stage 均完成恢复验证。
- independent Node JCS/SHA/HMAC oracle 重签 semantic tamper，覆盖 duplicate grant、accounting/revision、request/response join 与 Acceptance enumeration closure。
- root `pnpm run build:all`：通过。
- root `pnpm run typecheck`：通过。
- `git diff --check`：通过。
- 独立 change-intent/security 终审：当前冻结快照无未解决 P0/P1/P2。

**未运行/不适用：**

- 未重复运行与本 package 内部改动无直接依赖的全仓长测试；受影响 package 已完整跑完，root build/typecheck 已闭合。
- 未运行 production broker/runtime E2E，因为本切片刻意没有 IPC、signature verification、execution fence 或 runtime wiring；将其伪装成 E2E 会违反确认边界。

## 结论

🟢 Effective within confirmed scope：locked broker transaction/recovery candidate 已建立完整 durable pending/resolved 记录、共享 Acceptance 线性化、exact replay、semantic join 与 crash recovery，且没有扩大公开 Surface。该结论不等同于 production authority、Provider Gate 解锁、Step 15 完成或总 Goal 完成；下一切片仍需在完整 trust closure 下建立 grant/response verification、execution outcome fence 与 exact-object provider I/O。
