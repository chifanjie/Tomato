# feature/agent-native-change-intelligence Review Brief

> 生成时间：2026-08-16（Asia/Shanghai）
> 分支：feature/agent-native-change-intelligence
> 基线 commit：51a5a8331d4413ab79c0ef2257f7fe2cfa39239a

## 背景与动机

本切片实现 WP5 Decision D-42：在 D-41 的 same-installation-identity、current-strong-source、normal、`provider_decommission` 单一分支上，fresh 重验完整 D-41 候选，将 candidate migration ID 单向映射为 formal Provider Migration ID，并验证一份外部 Root 已签名、以同 cohort retained steady tip 为前驱的 Registry `routing.phase=prepared` direct-successor candidate。操作必须在 Registry/Catalog/Plan/Pin/reservation/Acceptance/execution 的任何写入前停止，输出保持 none-authority，十二类 side-effect sink 全为零。

## 改动策略

D-41 temporary Registry admission 成功后产生 package-private、zero-key、one-shot seed；seed 在 D-41 mint 内绑定 cohort，仅在 D-41 true-finally audit 成功后绑定 exact final candidate identity。D-42 用 registered exact2 public input 打开十二 sink 审计，fresh 执行 D-41，重算 branch-specific formal ID，消费 candidate-bound retained continuation，并验证外部 Root-signed N+1 prepared Manifest。成功只返回结构化 validation candidate 与 locked publication prerequisite，不发布 Registry、不构造 Catalog/formal Plan/Pin、不预约 quota，也不暴露 continuation 或 signing authority。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| D-42 wire/public seam | `packages/durable-object-provider-contracts/src/provider-migration-*-prepared-registry-successor-reference-candidate*.ts` | strict request/final Schema、candidate→formal ID 映射、registered exact2 input、opaque Error 与 runtime exact3 facade |
| Continuation/orchestration | `packages/durable-object-provider-contracts/src/provider-migration-*-prepared-registry-successor-*-internal.ts` | seed→cohort→candidate one-shot lifecycle、nominal signed source、fresh D-41、十二 sink intermediate/true-final audit |
| Registry retained successor | `packages/durable-object-provider-contracts/src/provider-registry-*.ts` | retained scratch direct-successor 验证、N+1/predecessor/member/routing/formal-ID/root-signature/budget闭合，零复制/零发布 |
| Evidence and fixtures | `packages/durable-object-provider-contracts/scripts/lib/provider-migration-*-prepared-registry-successor-*`、相关 tests | 外部 Root-signed fixture、tamper/replay/concurrency/audit/intrinsic/limit matrices |
| Public/distribution wiring | `packages/durable-object-provider-contracts/{package.json,README.md,scripts/test-distribution.mjs,src/index.ts,src/json-schema.ts}` | public module、exact2 JSON Schema、Node/browser private deep-import deny、packed runtime exact3 |
| Normative contract | `docs/prd/2026-07-27-agent-native-change-intelligence-rd-plan.md`、`docs/research/2026-07-28-g0-contract-freeze-record.md`、`docs/research/2026-07-30-wp5-change-intelligence-matrix.md` | D-42 单分支映射、authority lifecycle、prepared successor、stop point、证据与 locks 同步 |

## Review 重点

1. **Authority 与 TOCTOU**：serialized D-41 结果不能充当 authority；foreign tuple 不得误烧 owner；正确 claim 后所有失败永久 burn；final candidate binding 只能发生在 D-41 final audit 通过后。
2. **Identity 与签名闭包**：先从完整 D-41 semantic projection 重验 candidate ID，再用 D-42 domain 和 exact `{candidateMigrationId}` 映射 formal ID；Manifest Pin 绑定 unsigned claims，Root verification 绑定 authenticity，D-42 closure digest 绑定完整 signed Envelope。
3. **Zero-write stop point**：输出只能证明 prepared Registry direct successor 与未来 publication prerequisite；不得声称 current/published Registry、Catalog membership、formal Plan/Pin、reservation、Acceptance 或 Provider authority。
4. **Hostile runtime 与发行边界**：observer failure 必须覆盖原 diagnostic，十二 sink true-finally 检查；captured traversal 不依赖可污染 iterator；public runtime 精确三个导出，内部 continuation/orchestrator/signer 不可 deep import。

## 审计发现与处置

独立审计未留下 P0、P1 或 blocking P2。审计期间发现并修复：D-42 outer/nested/intermediate observer throw 的误分类；D-41 seed 在早期 digest failure 前未转移到 cleanup local；Registry member-successor traversal late-bind `Map`/`Array` iterator；PRD `$id`、formal-ID UTF-8、publication gate `none`、seed lifecycle 与 signature/Pin 语义的文档偏差；以及 expected candidate/Pin、mapping格式和十二 sink 的 focused-evidence缺口。

保留的非阻塞边界：公开 Schema/serialized candidate 本身不携 authority；签名真实性来自 registered runtime capability 链；transport-prelimited nominal source 依赖受信 owner，不是 hostile raw-object parser。

## 测试情况

**当前已通过：**

- D-42/D-41/Registry 合并 focused：4 files / 72 tests，包括真实 Root-signed success、formal mapping、N+1 direct successor、replay/concurrency、invalid signature burn、expected ID/Pin mismatch、完整 tamper matrix、十二 sink逐项 drift、outer/nested/intermediate observer failure 与 captured-intrinsic seam。
- 独立安全复验：2 files / 67 tests；机械 inventory：357 JSON Schemas、D-42 exact2、public runtime exact3、4 条 private subpath deny、`git diff --check` 通过。
- Registry/Evidence topology proof 已按最终源码正式重生成并通过 standalone `--check`：181,122 bytes，raw SHA-256 `b6b437098137c8e6aaac95f6efcac174b4178f091c9a1165122747e258dcd7b1`，aggregate semantic digest `sha256:aad7500705ce1bebe4a311f3c3baddc86f2818530beea128bf83420767272e4e`；357 个生成 Schema 随后再次验证 fresh。
- clean-copy pack 预检：70,005,248-byte gunzip tar stream，低于 68 MiB cap 1,297,920 bytes；D-42 增量 22 entries，未调整安全 cap。
- 完整 Provider distribution：exit 0；32 个 public modules、357 个 Schema、D-42 runtime exact3/root-subpath identity/exact2 Schema、opaque forged failure、四条 private Node/browser deep-import deny 与 cold consumer 全部通过。
- 根 `CI=true pnpm quality`：exit 0；Provider 81 files / 947 tests并再次通过内嵌 distribution；Contracts 135、Repository State 81（另 1 platform skip）、Artifact Store 129、root skill 95、Core 923、Task Engine 60、CLI 21、Dashboard 560、Preview runtime 7 与 cold-pack 1 全部通过。

**提交后仍需：**

- 推送并验证同一 commit SHA 的五项 CI；失败不得用无代码变化的重跑掩盖。

## 结论

🟢 Effective。D-42 实现与冻结意图一致，独立 review 无未解决高优先级 finding；本地 proof/distribution/workspace gate 已完成，可精确暂存、提交并进入 same-SHA CI。该结论只关闭 D-42 none-authority reference candidate，不外推至 actual Registry publication、prepared Catalog、formal Plan/Pin/reservation、Acceptance、Provider I/O、其它 migration branch 或 WP5 aggregate。
