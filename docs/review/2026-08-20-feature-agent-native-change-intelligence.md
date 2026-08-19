# Formal Provider Acceptance ABI Review Brief

> 生成时间：2026-08-20 02:00 CST
> 分支：`feature/agent-native-change-intelligence`
> 基于 commit：`24805ca fix: harden provider service lifecycle recovery`

## 背景与动机

Provider strong mutation 已具备同 socket challenge、签名 grant 与 fail-closed runtime seam，但生产写权限仍缺少可由 Root/OS authority 持久化和比较的正式 Acceptance 合同。现有 D-40 wire、filesystem substrate 与 replay ledger 都明确是 `reference_candidate`、`authority:none` 或独立 replay primitive，不能改名后冒充生产 current authority。

本次改动先冻结完整、独立的 production Provider Acceptance ABI，为后续 Root/OS-owned broker、current/high-water CAS 与 grant 原子消费提供可验证 wire；本切片不接线 broker、不暴露 raw key/token mint，也不解锁 strong writes。

## 改动策略

1. 新增独立 `provider-acceptance` public subpath，覆盖 `strong_ready | migration_only | recovery_only` 三态、state/envelope、generation enumeration、high-water/current、compare-append request/outcome/receipt/result，以及正式 migration/identity pins。
2. 使用不含 `candidate` / `reference_candidate` 的 production domain、profile、record type 与 locator；所有 digest 与 owner-HMAC message preimage 由无 key 的纯投影函数产生，raw Installation Identity key 仍只属于未来 authority capability。
3. 在 schema 层闭合可由单个 wire 本地证明的 outer/payload、ordinal/predecessor、current tip/nonce、genesis set/floors、migration mode/target/identity/quota 等关系；跨历史最大值、CAS、nonce replay 与 crash-atomic publication保留给未来 durable authority machine。
4. 将 28 个正式 JSON Schema、root/subpath exports、packed Node/browser/type consumer 与 distribution inventory 一次性 fan-out，避免 source、schema、package 三份合同漂移。
5. 修正已失真的 packed build heap headroom：TypeScript one-pass 子进程由 640 MiB 调整为经 5 次冷构建验证的 768 MiB；1536 MiB normative aggregate gate不变。Topology `--check` 先完成 fresh-source emit，再物化 heavy parent state，以消除不必要的峰值重叠。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
| --- | --- | --- |
| Formal ABI | `packages/durable-object-provider-contracts/src/provider-acceptance.ts` | 新增三态 Acceptance wire、严格 schemas、digest/token-message projection helpers 与 cross-field refinements |
| Public surface | `src/index.ts`, `package.json`, `test/runtime-boundary.test.ts` | 新增 root 与 `./provider-acceptance` subpath；锁定 51 个 runtime exports 并逐项验证 binding identity |
| JSON Schema | `src/json-schema.ts`, `test/json-schema.test.ts`, `schemas/v1/*.schema.json` | 注册并生成 28 个 formal schemas；总 inventory 368 → 396 |
| Distribution | `scripts/test-distribution.mjs` | public modules 35 → 36、schemas 368 → 396；增加 packed root/subpath、type consumer 与 browser parity smoke；packed build heap headroom 640 → 768 MiB |
| Topology proof | `scripts/generate-provider-registry-evidence-binding-topology-proof.mjs`, proof source/fixture/schema | 重排 check-only 内存相位并更新 raw/semantic anchors；proof bytes保持 exact |
| Contract tests | `test/provider-acceptance.test.ts` | 覆盖三态、successor/genesis、current/receipt、D-40隔离、hostile primordial，并固定 generation ID、5 个 digest 与 3 条完整 token-message hex golden |

## Review 重点

1. **Authority 边界** — public surface 只能投影或验证 wire，不能持有 Installation Identity key、签发 HMAC token、消费 replay 或 mint runtime write capability。
2. **三态与历史闭合** — 独立 schema 必须拒绝 impossible tuples，同时不能把需要 durable enumeration/current store 的跨历史证明伪装成单 wire refinement。
3. **Production 与 D-40 隔离** — 正式 domain/profile/locator 不能沿用 `reference_candidate`，双向解析和 digest domain 必须分离。
4. **发行 fan-out 与资源门** — source、JSON Schema、root/subpath、packed Node/browser/types 必须同步；768 MiB只修复非规范 child headroom，1536 MiB aggregate acceptance gate不得放宽。

## 已识别风险

未发现阻塞问题。独立 review 最初识别的两项 `⚪ Test Gap` 已在提交前关闭：

- crypto ABI 现以固定字面量锁定 generation ID、全部 5 个 digest 与 3 条完整 token-message preimage，不再由同一 canonicalizer 生成 expected；
- runtime boundary 现以排序后的 51-key exact allowlist覆盖全部 formal runtime exports，并逐项验证 root/subpath 同一绑定，任何新增或改名的 raw mint 都会失败。

## 测试情况

**已覆盖：**

- Formal focused：11/11；补齐 review gaps 后 formal + runtime-boundary focused：18/18。
- Contracts full Vitest：94 files / 1000 tests。
- JSON Schema：生成与验证 396 项；focused 26/26。
- TypeScript：contracts source/test checks 与 repository root `pnpm run typecheck` 均通过。
- Topology：官方 1536 MiB `--check` 通过；`--stdout` 与 golden 均为 182,222 bytes，SHA-256 `71823e83d03013fd33c77190081e3c2c4c14de127b4414e374e83a06e4311945`。
- Distribution：36 public modules、396 schemas、4 Node + 4 browser lanes / 354 cases 全保留；wall 224,198 ms，aggregate peak RSS 1,116,160,000 B，低于 1,610,612,736 B gate。
- 768 MiB Node 22 cold build 5/5；重排后的 topology 10 ms monitor 3/3，最坏 1,369,374,720 B，保留 241,238,016 B headroom。
- `git diff --check` 通过。

**缺失：**

- 本机未运行 Linux Node 22 的 768 MiB packed-build/topology profile；Linux CI 仍需覆盖平台资源差异。
- Root/OS-owned production Acceptance store、完整历史 resolver、current/high-water CAS、nonce receipt replay 与 grant 原子消费尚未实现。这是后续 broker 切片的明确前置工作，不是本 ABI 切片宣称完成的能力。

## 结论

🟢 本次改动有效冻结了 production Provider Acceptance ABI，完成 schema/export/distribution 闭合且未越过 authority 边界，适合精确提交。Production strong writes 继续保持 locked，直到 Root/OS authority broker 与 durable transaction E2E 完成。
