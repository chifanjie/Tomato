# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-23 CST
> 分支：`feature/agent-native-change-intelligence-authority`
> 基于 commit：`c0c3334 feat(task-engine): surface bounded unstaged deletions in checks`

## 背景与动机

Step17 要求 Alpha candidate 的生成、验证与生命周期证据保持诚实。现有
`alpha-candidate verify` 已按 manifest 记录的 Git commit/tree/lockfile object验证，而不是要求
current `HEAD` 等于候选来源；但回归只在候选刚生成、HEAD尚未前进时执行。若实现以后错误地改成读取
current HEAD/tree/lockfile，旧测试仍会通过。

本切片补一条 source-aware historical verification 回归：从 clean source组装候选 A，随后把 checkout
推进到 tree 与 lockfile都不同的 clean descendant B，再用当前 verifier重新验证 A。候选目录的四个文件
必须逐字不变。README同时明确：候选目录不是自包含的历史证明；成功依赖保留 recorded Git objects与
字节一致的 reviewed v1 schema。

## 改动策略

- 复用现有单一 `alpha-candidate` focused，不新增 production API、schema或第二条重 E2E。
- 候选 A 仍从隔离、clean、detached checkout assemble，并先完成真实 build、pack、cold gate与初次 verify。
- 冻结 A 的 exact-four inventory与每个文件 bytes：唯一 tgz、candidate manifest、reviewed schema、
  `SHA256SUMS`。
- 在同一隔离 checkout创建真实后继 commit B，只修改 package-visible Preview README与
  `pnpm-lock.yaml` 的合法 YAML comment；断言 exact diff只有这两条路径。
- B 的 commit/tree必须不同于 A，A 必须是 direct parent与 ancestor，checkout必须 clean。
- current `HEAD:pnpm-lock.yaml` object ID与 bytes SHA必须同时不同于 A manifest记录的 lock blob；这会
  确定性击穿任何错误读取 current HEAD lockfile的 verifier。
- 明确证明 A recorded commit/tree/lock blob仍可由 object database读取，然后在 B HEAD调用 production
  `verify`；要求 exact success JSON、candidate inventory与四文件 bytes完全不变。
- 原 tgz/manifest/schema/checksum四类 single-bit tamper拒绝循环原样保留，并自然在 historical B HEAD执行。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Focused release evidence | `packages/preview/test/alpha-candidate.test.mjs` | 新增不同HEAD/tree/lockfile下重验旧候选与exact-four不变回归 |
| Packaged operator guidance | `packages/preview/README.md` | 说明source-aware验证前提、current HEAD可前进，以及非自包含/non-provenance边界 |

production verifier、candidate schema、package scripts、CI、Host/Workbench与其他产品代码均未修改。

## Review 重点与结论

1. **不是 current-HEAD 假绿** — B 的 tree与 lock blob均不同；test同时锁 object ID与 SHA差异。若 verifier
   改为读取 current HEAD，历史 A 的 manifest lock binding会失败。
2. **recorded objects真实可用** — test对 A commit、tree与 lock blob分别执行 `git cat-file -e`，再由
   production verifier按 manifest记录对象完成验证。
3. **验证是只读的** — successful historical verify前后 candidate exact-four inventory与四份 bytes逐项相等。
4. **原安全门未弱化** — build/pack/cold、schema、checksum、archive、secret扫描和四类 tamper拒绝全部保留。
5. **文档不夸大** — README明确 object format、retained object DB与 reviewed schema byte equality前提；
   candidate-only copy、对象prune或schema变化不构成portable historical verification。

独立 contract 与 change-intent 终审一致：P0 0、P1 0、current-path executable P2 0、
blocking Test Gap 0；结论为 Effective / SAFE TO COMMIT。

## 测试情况

**已通过：**

- `pnpm --filter @understand-code/preview test:alpha-candidate`
  - 1 passed / 0 failed / 0 skipped，62.18 秒；
  - 真实 isolated clone、assemble/build/pack/cold、historical verify、exact-four与四类 tamper均执行。
- `node --check packages/preview/test/alpha-candidate.test.mjs`
- scoped `git diff --check`
- `pnpm --filter @understand-code/preview typecheck`
- `pnpm --filter @understand-code/preview build`（fresh dist）
- source `packages/preview/README.md` 与 fresh `dist/README.md` 字节完全一致：
  SHA-256 `3b18422c98cbd0658eab082ff09e03287c397a78db1ca2b35376c9c74a61fc00`。

未运行 Browser、Plugin Host、root full或cross-platform矩阵：本切片只改变 focused release evidence与
packaged README；唯一 focused本身已执行真实 build/pack/cold。输入不变时不重复重门。

## 首个 Test Gap 与修复

初版后继 commit只修改 README。这样 current HEAD的 lockfile blob仍与 A相同；即使 verifier错误地从
current HEAD读取 lockfile，测试也可能假绿。终审将其识别为 blocking Test Gap。最终 B commit同时加入
合法 lockfile comment drift，并断言 current lock object ID与 SHA均不同于 A recorded lock；之后唯一
focused从头通过。未修改或放宽 production verifier。

## 可声明与不可声明

**可声明：**

- 当 checkout的 Git object format匹配候选、object database仍保留 manifest记录的 commit/tree/lock
  blob、reviewed v1 schema bytes不变时，current HEAD可以前进到不同 tree与 lockfile，旧 unsigned Alpha
  candidate仍可由 production verifier精确重验。
- historical verify不会改写候选目录；tgz、manifest、schema与checksums保持逐字不变。
- tgz、manifest、schema或checksum任一单bit不一致仍被 fail closed拒绝。
- README的source与fresh dist字节一致，operator能看到上述source-aware前提与限制。

**不可声明：**

- candidate目录不是自包含、portable或独立离线可验的 provenance bundle。
- 不提供 Git object retention/GC lease、history index、latest selection、promotion、anti-rollback或schema
  migration机制；对象被prune或reviewed schema变化后不保证验证。
- metadata/checksums仍unsigned；协调重写artifact与unsigned metadata/checksums仍不可检测或认证。
- 不证明publisher authenticity、signature、SBOM、SLSA/trusted provenance、reproducibility、CI same-SHA、
  cross-platform、RC或正式Release。
- 本切片不改变 Provider Authority、execution fence或strong writes；`strongWrites`继续 locked。

## 结论

🟢 Effective。保留 recorded Git objects与reviewed schema的 source checkout现在有真实回归证明：即使
current HEAD、tree与 lockfile均已前进，production verifier仍按候选 A 的精确历史绑定完成验证，且不修改
candidate exact-four bytes。能力边界已在 packaged README中明确，不被误述为自包含、可信 provenance、
anti-rollback或Release。可以精确提交。
