# WP5 Change Intelligence Research and Traceability Matrix

记录日期：2026-07-31

范围：WP5 Evidence-backed Change Check、可重建 Task Baseline、Repository
Delta、Diff→Symbol、Planned vs Actual、Verification recording、Context
refresh/rebase，以及 path-safe Snapshot、SafeGit、owner-only request equality、
并发 CAS/quota、OS-isolated durable-object provider、strict Ed25519 bootstrap
trust bundle与 real-FS feasibility
对 Contracts、Artifact Store、Repository State、Core 和 Task Engine 的修订

状态：**Contract Frozen / Implementation In Progress**

历史总计划执行游标：**15/17**。这里的含义是“当前进入原 17 步主线的第 15 步”，
不是“17 个 WP5 Gate 已完成 15 个”，也不是 88% 产品完成率。按本文件第 6 节的
17 个 Commit Gate 逐项计算，截至 2026-08-05 只有前 3 个 Gate closed，第 4 个
WP5-1P aggregate 正在进行，其余 13 个仍 pending/locked。WP5 合同已冻结且实现
正在分层推进，不代表 WP5 功能完成；WP5 只有在第 11 节全部满足后才能改为
Completed。

2026-08-02 D-30 pre-implementation amendment：尚无 WP5 Provider v1 artifact、
golden或兼容 reader对外发布，因此本次终审修订在实现前原位替换未落地的 v1 freeze，
不制造一个虚假 legacy v1。替换范围仅为：real-FS Suite/Fixture Corpus signed source
closure、distribution retained-object accounting、migration quota typed dry-run/
Plan-binding/final-receipt selector、Private Store category correlation及
Admission/Transition full-record digest；后续若任何 bytes发布，再改这些 wire
contract必须显式升版而不能继续原位修改。

2026-08-02 D-31 implementation-safety amendment：首批 Provider foundation
实现与独立安全复审证明，D-30 尚未冻结 `publicKeyDigest` 的 exact preimage，
也没有为 Node/OpenSSL、WebCrypto与未来 provider runtime冻结同一 Ed25519
signature acceptance set。D-31 因此在任何签名 wire bytes发布前原位补齐：
decoded raw 32-byte public-key digest、项目级 strict Ed25519 profile、host
crypto capability/KAT gate，以及固定资源
`provider/ed25519-strict-host-conformance-v1.json`与
`provider/bootstrap-trust-bundle-v1.json`。后者以单一 immutable
`ProviderBootstrapTrustBundleV1`同时封装 bootstrap root、bootstrap Root
Metadata、三把 recovery key、2-of-3 threshold、trust-history policy与验证
profile，并由 signed distribution binding和 Installation Identity exact pin。
这些补充收窄接受集合且消除重复 bootstrap字段，不解锁任何 capability；一旦
相关 v1 bytes发布，后续改变 profile、digest preimage或 bundle shape必须升版。

2026-08-03 D-32 pre-implementation amendment：C09-1G在生成首批 Target
Discovery签名 bytes前冻结为 point closure。Taxonomy、Release Matrix、嵌入式
Input Bundle与 Discovery Result统一由同一 supplied active registry root key使用
各自独立 domain验证；Bundle不是由另一把未定义的 distribution key签名。
Bundle使用 Matrix→Fixture→Runner固定 source顺序，Result unresolved使用
`(observationSource,observationKeyDigest)` UTF-8 tuple排序；相同 target ID的两个
resolved不同完整 bytes直接拒绝，typed `conflicting_target_claims`必须由 source
manifest原生发布。Discovery Runner profile只与其自身 Pin/Envelope闭合，不强加
与 real-FS Suite runner profile的跨类型等式。本层不增加 per-source 4096 cap，且
只能声明 materialized 16 MiB admission；成功 authority固定为
`none_target_discovery_point_structure_only`，不证明 history/current/rollback、
Universe或真实 I/O。

2026-08-03 D-33 pre-implementation amendment：冻结 C09-1H为完整 C09-1G raw
request→unsigned `ProviderRealFilesystemConformanceResultV1` Envelope 的 point
evidence closure。入口对整份 hostile input做一次 immutable snapshot，再组合 C09-1G
diagnostic validator；不接受普通 validation DTO或 caller “verified” boolean。成功
authority唯一为 `none_real_fs_conformance_result_structure_only`，仍精确 1 次 root
point admission与6次签名，Result本身不新增签名；payload aggregate `passed`不授权
真实 I/O。Result target必须按七字段重算 ID并 byte-identical命中 Discovery
`payload.targets[i].target`恰好一次；Discovery Pin、Input Bundle digest、
Bundle→Fixture→signed Suite Pin及
Suite/fixture/runner/crash-cut冗余 digest全部 exact闭合。caseResults按
`{caseId,crashCutId}` UTF-8 tuple sorted+unique exact-cover Suite required set，
outcome/code与 failed→unsupported→passed aggregate为总函数。Result ID/content digest、
Envelope/Pin/payload等式及仅含 `locatorProfile + resultId` 的唯一 installation
locator必须可重算；完整 materialized
Result Envelope受16 MiB cap，不另加 per-case cap。本点不包含真实 runner/文件系统、
history/current、Universe、policy/runtime、Evidence、Catalog/Registry/Acceptance、
持久化或 strong write。

2026-08-03 implementation evidence：C09-1F 已由 `3ca2977` 独立提交并推送。
该层只关闭 root-signed Fixture Corpus→Suite source closure：12 条记录、4 个
case、8 个 crash cut、43 个 materialized negative cases、152 份 Provider JSON
Schema 与 packed Node/browser distribution KAT 全部通过，两轮只读复审无残余
P0/P1。成功 authority 仍严格为
`none_real_fs_source_structure_only`；它不执行 fixture、不触碰真实文件系统，也不
替代 Catalog/Discovery/Universe/Acceptance/Migration 或 WP5-PF。随后同一提交树
叠加 16-A-1 CLI 候选 `0a07e33` 后，根级 `pnpm quality` 为 2,237 passed、1
skipped、0 failed。clean-checkout CI 已成功：C09-1F `30797985994`、CLI
`30799673953`、文档重校树 `30803535321`；这些切片证据不替代 WP5 aggregate
最终同 SHA closeout Gate。

2026-08-03 C09-1G implementation evidence：signed Target Discovery point
closure已由 `70201b4` 独立提交并推送。Provider package冻结 220 份 Schema、
205,053-byte golden、116 个 ordered diagnostic/executable negative cases，29 个
测试文件 / 263 项测试与 clean packed Node/browser KAT全绿；分发面为 13 个显式
public module exports（另有 3 个 wildcard resource exports），成功路径精确执行
1 次 active-root point admission、6 次签名验证并生成
5 个完整 Envelope locator。独立只读复审提出的真实 wrong-signer、resolved-target
conflict、诊断归因与 Fixture locator outer/payload闭合问题均已修复，最终无残余
P0/P1/P2/P3。同一提交树根级 `pnpm quality` 为 2,248 passed、1 skipped、0
failed，clean-checkout CI `30822355769` success。该 candidate仍只有
`none_target_discovery_point_structure_only` authority且不包含后继 Result；
`ProviderRealFilesystemConformanceResultV1` point已由后续 C09-1H 独立关闭，
history/current/anti-rollback、Universe、runtime、Evidence、Catalog、真实 I/O及
WP5 aggregate仍 open/locked。

2026-08-04 C09-1H implementation evidence：unsigned real-FS Conformance Result
point closure已由 `35f9aaf0d348ee67a65edc433bd9efddf87db2a1` 独立提交并
推送。Provider package冻结 233 份 Schema、96,224-byte golden、45,004-byte
invalid resource与50个 ordered executable cases；其中14个非法 outcome/code pair
由完整21-pair matrix（7 valid / 14 invalid）闭合，MAX+1 witness严格为
16,777,217 canonical bytes。31个测试文件 / 299项测试全绿，clean packed Node与
Vite/browser均从已安装 tar按 `mutation.operation` 重放50/50并比较实际
boundary/stage/reason、snapshot projection与 opaque public error；分发面为15个显式
public module exports（另有3个 wildcard resource exports）。成功路径保持1次
active-root point admission、6次签名且无第七签名，Result ID/content、
Envelope/Pin/Locator与 Locator-only path全部闭合。本地 macOS 根级
`pnpm quality`为185个测试文件、2,284 passed、1 skipped、0 failed；Linux
clean-checkout CI `30881809697`为185个测试文件、2,285 passed、0 skipped、
0 failed并成功完成，独立复审无残余 P0/P1/P2。authority仍严格为
`none_real_fs_conformance_result_structure_only`；D-34冻结的后继 C09-1I
Result→Policy→Runtime Attestation point已由后续独立实现关闭，当前 frontier为
QA/Release Evidence；之后仍有 Registry/Catalog与
Discovery history/current/Universe retained closure，真实 runner/I/O与 strong write
继续 locked。

2026-08-04 D-34 pre-implementation amendment：正式冻结 C09-1I为完整 C09-1H
raw request + strict `StoreDurableObjectProviderPolicyV1` + root-signed
`StoreDurableObjectProviderRuntimeAttestationPinV1`的 Result→Policy→Runtime point
closure。入口对16个 exact data-property在首次`await`前一次 snapshot，JSON artifacts
clone+freeze，opaque capability保持已证明引用；只组合一次 C09-1H diagnostic，禁止
接受 validation DTO或复制前六次 signature逻辑。policy按
`store-durable-object-provider-policy-v1`重算 digest，并与 Result/Runtime policy digest、
provider及 Suite exact闭合；Runtime的 provider/policy/implementation/binary、四个
platform字段、由 target三字段按`store-provider-filesystem-profile-v1`重算的 filesystem
digest及完整 Result content digest全部 exact闭合。Runtime unsigned digest排除
registry signature，Pin直接内嵌 signed payload且没有 Envelope/ID/locator；signature
prefix/wrapper/supplied root三方相等。组合成功路径固定1次 root point admission、7次
signature verify，authority唯一为
`none_provider_runtime_attestation_structure_only`。本点不证明 runtime在线、
generation current、真实 volume/IPC、Evidence/Catalog/Registry/Acceptance或 I/O authority。

2026-08-05 C09-1I implementation evidence：Result→Policy→root-signed Runtime
Attestation point closure已由
`60f6582ad7049c87d7c1b6c15bac189c30357eef`独立提交并推送。Provider package
冻结241份 Schema、117,782-byte golden（SHA-256 `cc1aa6b…48ce`）、
256,796-byte invalid resource（SHA-256 `33be13b…8bb`）与122个 ordered
executable cases（50个逐位继承 C09-1H，72个 point-specific）。Case ID保持闭合
字面量 union，Schema把 case ID、case record与 inherited operation按122个位置逐位
冻结；strict Policy、Runtime结构/Pin、generation/timestamp/platform/IPC/signature、
全部重复绑定、合法重签的 mismatch、两组 compound precedence、hostile input与
双 async mutation均有真实负例。33个测试文件 / 310项测试全绿；clean packed Node与
Vite/browser均从已安装 tar导入17个显式 public modules，独立物化122/122并重算
witness digest，比较实际 stage/reason、11字段 snapshot projection、opaque public
error与逐例冻结的 crypto count；golden与成功接纳路径保持1/7。成功 authority严格为
`none_provider_runtime_attestation_structure_only`。

同一提交树本地 macOS根级`pnpm quality`为187 files / 2,295 passed / 1 skipped /
0 failed；Linux clean-checkout CI `30978915713`为187 files / 2,296 passed /
0 skipped / 0 failed并成功完成。core、fixture/distribution与 holistic三路独立只读
终审均无残余 P0/P1/P2。该 candidate不证明 runtime在线、当前 generation、真实
volume/IPC、QA/Release批准或任何 I/O authority；下一实现 frontier为 QA/Release
Evidence，C09 aggregate与 strong write继续 open/locked。

权威决策：

- `docs/prd/2026-07-27-agent-native-change-intelligence-rd-plan.md` D-24～D-34
- `docs/research/2026-07-28-g0-contract-freeze-record.md` 第 4、5 节
- WP1 Contracts、WP2 Repository State、WP3 Artifact Store 与 WP4 Task
  Intelligence 已关闭的 Schema、Snapshot、CAS、Journal 和 Lifecycle 规则

本矩阵是研发追踪与能力锁，不是发布批准。Codex/Claude Surface、Workbench 与
公开发行仍分别属于 WP6、WP7、WP8。

## 1. WP5 最终产品结果

WP5 的结果不是“列出哪些文件变了”，而是：

> 对一个已确认计划和一个精确 actual Snapshot，重建任务开始与结束时的最终
> 可见树，生成可下钻、可判完整性、可跨进程回放的 Change Check；随后只记录
> 外部执行的 Verification，使 Agent 和人能够判断改了什么、是否符合计划、
> 还有什么无法判断，以及为什么。

一条完成的纵向链路应为：

```text
Task Stage 1
  └─ baseline Snapshot + task_baseline + private blobs

context_ready → planned → in_progress
  └─ confirmed obligations + verification plan

in_progress → check_required
  └─ exact actual Snapshot + current Pulse

checkChanges(actualSnapshotId=S)
  ├─ baseline final tree → actual final tree
  ├─ source-layer provenance
  ├─ deterministic hunks
  ├─ old/new symbol mapping
  ├─ Actual Changes + Completeness
  └─ Findings + Evidence + Impact + Boundaries

check_required → verification_required
  └─ blocking Findings fixed or explicitly accepted

recordVerification()
  └─ external result, exact method, attempt/supersedes chain

verification_required → verified
  └─ current Check + required latest Verification all satisfied
```

Host 侧看到的是结构化摘要和稳定 ID；需要细节时按 ID 读取 Diff Evidence、
Impact 或 Boundary。源码正文不是默认大对象，也不能绕过安全策略。

## 2. 实现前审计：当前事实与缺口

### 2.1 可复用的可信底座

| 范围 | 当前可信能力 | WP5 使用方式 |
|---|---|---|
| Repository State | NUL path、五层状态、双采样、stable file read、敏感路径读取前拒绝；旧 argv Git/Snapshot 仍非 strong 安全边界 | 复用 path/TOCTOU primitives；以 path-safe Snapshot、SafeGit 与 filesystem bootstrap resolver 替换旧 publication/discovery |
| Contracts | strict Zod、Envelope/digest、Task/Claim/Evidence/Impact/Check/Verification 基础类型 | 增加 strong profile 和跨 Artifact invariants |
| Artifact Store | legacy atomic rename/fsync、Task→Repository locks、CAS、Manifest commit point、Journal/Receipt、fault recovery | 保持唯一提交者；strong writer改用 provider exact-object no-replace与 immutable Manifest unique-tip commit，并增加 exact Repository Basis 与 baseline blob transaction |
| Task Engine | 两阶段 Task 创建、Lifecycle、authorization context、idempotent replay、真实 Snapshot publication | 增加四类生产 Operation，不另建旁路 writer |
| Core | 多语言 Tree-sitter、Graph/Wiki/Evidence/Impact | 抽取 rich parse/symbol API；Graph 只作二级关联 |

### 2.2 不能直接宣称为 Change Intelligence 的现状

| 缺口 | 直接风险 | 冻结处置 |
|---|---|---|
| `ChangeFinding.actualChangeIds` 只是 opaque string | dangling reference、无法证明实际改动 | strong Check 内嵌 Actual Changes 并做全引用/覆盖校验 |
| Snapshot 只有状态/digest，无基线 bytes | dirty baseline 无法重建；reset/delete 漏检 | Stage 1 原子保存 `task_baseline` + private CAS |
| 无 canonical hunk | 只能文件级猜测，无法下钻 | deterministic in-memory Diff + `diff_hunk` Evidence |
| BODY_LOGIC 依赖调用方注入 parser signal | 不能证明真实函数体变化 | rich old/new parse、signature/body span 与 status |
| legacy diff overlay 与当前 Graph/Task 断链 | stale 结果被误用 | 生产链完全禁用 legacy overlay/analyzer |
| Planned candidate level 混合修改/检查/验证 | omission 语义不成立 | explicit expectation/obligation |
| `verification_gap` 可被理解为尚未执行 | Check 与 execution lifecycle 冲突 | 冻结为计划/覆盖设计缺口 |
| Verification 未校验 method equality | manual 可冒充 required test | exact method invariant |
| refresh/rebase 只有 capability lock | stale Task 无可信恢复 | 保存 contextBuildSpec 并真实重建 |
| Context build 原始预算/scope 未持久化 | refresh 无法忠实重放 | strong Brief 保存 resolved spec |
| Check input Snapshot 可省略 | retry/竞态可能隐式 retarget | actual Snapshot 必填且精确 |
| 同 Snapshot 可换 key 重做 | canonical Check 可被无审计替换 | same-key replay；different-key reject |
| 旧 Snapshot 先落 exact path/raw digest，再由 WP5 扫描 | public Store 已泄露 hard-deny/secret 的低熵 identity；baseline bytes 也可能从未扫描 path 二次读取 | strong writer 在首个 durable write 前完成 universe/path/content scan；同 handle 产出 Snapshot、baseline 与 Hunk bytes |
| 现有 repository/worktree/root ID 由 Host path 派生 | raw SHA 可被常见目录字典反推，linked worktree identity 也可能串扰 | installation-owner-only key 的 domain-separated HMAC identity；公开 Store 不保存 raw locator 或 raw SHA |
| 现有 argv Git 仍可受 config/env/fsmonitor/hook/filter/alternate object 影响 | discovery 可能执行用户程序、访问网络或在返回 path 前读正文 | 唯一 SafeGit adapter、fixed env/argv、no-follow config scanner、local-object-only 与 architecture test |
| private CAS dedupe 无 durable reservation/quota；request raw digest 未分层 | 并发 rollback 可误删 shared blob；资源耗尽和低熵 transient input 可造成不一致或字典泄漏 | marker-first reservation、cycle-free Merkle quota + append-only Transition chain/full audit、公开 safe projection digest + owner-only HMAC equality |

## 3. 冻结数据模型

### 3.1 `task_baseline` 与私有 Blob

`task_baseline` 是 task-scoped Envelope，最小 payload 包含：

- task/repository/worktree/capture Snapshot identity；
- exact baseline HEAD（unborn repository 使用 canonical empty tree）、state
  token 和 capture status；
- dirty overlay 的 final-visible path states；
- captured/absent/binary/oversized/unreadable/conflict 等 path 状态，以及不含
  identity 的 redacted unit aggregate；
- safe content digest、mode、size 和私有 blob locator；
- limitations 与 Boundary identity。

边界：

- strong `TaskManifest.baselineSnapshotId`、Artifact
  `captureSnapshotId/sourceSnapshotId` 必须等于 Stage 1 current/evaluated
  Repository Snapshot；Repo Pulse logical baseline 只作分析 provenance；
- immutable capture Snapshot 先由 repository transaction 提交；Task Stage 1
  只引用其 exact descriptor，并在 Task transaction 中原子提交
  `task_baseline`、private blobs、含 resolved contextBuildSpec 的 Manifest、
  Event、Receipt 与 Journal；durable intent marker 必须先于任何 private
  blob/Git lease 副作用；
- clean tracked path 由 exact Git object 读取，不重复持久化全部仓库；unborn
  repository 从 canonical empty tree 开始；
- 存在的 baseline HEAD 由产品专用 immutable Git object lease/ref pin；lease
  失败时 captureStatus 只能 partial/unpinned；unborn empty tree 无需 lease；
- lease ref 固定
  `refs/understand-code/task-baselines/<lease-hex22>-<marker-nonce-hex32>`；
  逻辑 `GitLeaseId` 含冒号，**不得**直接拼进 Git ref。suffix 只允许
  lowercase hex 与一个连字符，32-hex nonce 由 CSPRNG 在 intent marker durable
  前生成并同时写入 marker；
- ref 只以 argv 形式
  `git -c core.hooksPath=<validated-empty-dir> -c core.logAllRefUpdates=false
  update-ref --no-deref <exact-ref> <oid> <object-format-zero-oid>` 做 create-only
  CAS；空 hooks 目录必须 realpath/owner/0700 验证，禁止 reference hook，命令
  不能写用户 config/Index/Worktree；
- marker 还要预声明 Git common dir 下 exact product reflog path。create 前该 ref
  与 reflog 都必须不存在；create 后 ref 必须 exact 指向目标且 reflog 仍不存在。
  `core.logAllRefUpdates=always`、预置同名 reflog、linked worktree 与 crash phase
  都进入验收；不得删除或修改任何 pre-existing/user reflog；
- staged/unstaged/untracked 的 final-visible bytes 在 Stage 1 进入私有 CAS；
- blob 名称由内容 digest 派生，目录/文件权限为 owner-only；strong path使用
  provider-private staging、exact-object no-replace publish、durable progress
  与 exact-predecessor immutable Manifest generation/unique-tip验证完成 Task
  transaction，普通
  write/rename/fsync只属于 legacy/开发 Fixture；
- sensitive path 在读取前拒绝；普通路径内容在持久化前做高置信 secret scan；
- binary、special、conflict、超预算或不稳定内容只保存 metadata/Boundary；
  hard-deny/secret unit 不进入 path 列表，只保存 aggregate count + Boundary，
  不保存 exact path/excerpt/blob/fingerprint/raw content digest；
- locator 是内部实现细节，不从通用 MCP、Markdown 或 Workbench payload 暴露；
- baseline overlay 的所有 path 必须进入未来 Delta 候选集，避免 baseline-only
  untracked 文件删除后消失。

新 strong Task 缺少该 Artifact 时不允许 Check。legacy Task 继续可读，但只能
走独立显式 migration，或 supersede 后创建新 strong Task；普通 refresh/rebase
不能猜造 baseline/spec。

每个 baseline materialization 与 Git lease 都不可变。rebase 创建新版本；旧
版本与其 blob/lease 由 immutable historical projection 引用。P0 不做年龄 GC，
只由 transaction recovery 删除 marker 明确拥有、从未提交且没有 descriptor
引用的 orphan。

### 3.2 Repository Delta

Delta 同时保存：

1. **source segments**：task baseline final→baseline HEAD、baseline
   HEAD→actual HEAD、actual HEAD→Index、Index→Worktree/Untracked/Conflict
   的 provenance；
2. **effective change**：baseline final-visible state→actual final-visible
   state 的唯一净结果。

固定规则：

- 状态代数为
  `B(final) --baseline_reconciliation→ B0(baseline HEAD)
  --committed→ A0(actual HEAD) --staged→ A1(actual Index)
  --unstaged/untracked/conflict→ A(final)`；effective 直接比较 B→A；
- baseline reconciliation 覆盖全部 baseline overlay，不只 reset/delete；
- committed 是 baseline HEAD 到 actual HEAD 的净差，不逐 Commit 展开；
- staged/unstaged/untracked 不相互覆盖，before/after digest 必须连续；
- conflict 保存 stage 1/2/3 object identity，默认 partial/UNKNOWN；
- source layer 保持既有 committed/staged/unstaged/untracked/conflict；
  `baseline_reconciliation` 是 Delta-only provenance，不修改 Repository
  Snapshot enum；
- Git 以 rename/copy detection **关闭**的模式只提供 canonical add/delete 与
  retained-source 集合；WP5 按已排序全集自行做 exact OID/content identity
  join，不能消费 Git 的 similarity candidate、score、threshold、limit 或
  配置。一个 delete 与一个 add 唯一 exact 配对才是 rename；source 仍存在且
  对某个 add 唯一 exact 配对才是 copy。多个等价 source/target、modified
  rename、case-fold 歧义或 join Budget 用尽都保留 delete+add，并附
  `ambiguous_lineage`/`budget_exhausted` Boundary；
- staged delete + 同路径 untracked add 保留 provenance 两段，effective 可为
  replacement；
- baseline dirty 后原样 commit 的 effective 为 false；
- baseline dirty 后 reset、baseline untracked 后 delete，即使 current Git
  status 为空也必须产生带 `baseline_reconciliation` 的 effective change；
- 同一个 path 可产生多个 symbol/hunk cluster，以识别同文件中的 planned 与
  unplanned 修改，但同一净变化不能因多个 Git layer 重复计数。

Content domain：

- tracked 且无 unstaged 的一侧使用 commit/index canonical blob；
- unstaged/untracked 才读取 raw worktree bytes；
- baseline/actual 的 commit、index、worktree、untracked 与 conflict stage 每一
  侧都必须先在内存执行同一 pinned scanner policy，之后才允许持久化任何
  per-unit path/OID/content or line digest/Hunk/Symbol/parser output；任一侧命中
  hard-deny/secret 时丢弃该 unit 的全部派生身份，只记录 aggregate
  `redacted_path_set` Boundary。scanner error 零写失败；
- 跨 domain 前验证 attributes/config/policy digest；autocrlf/eol、
  working-tree-encoding、LFS/filter、sparse checkout 或未知 transform 产生
  Boundary，不运行 clean/smudge/textconv/external diff；
- conflict 无唯一 final bytes 时只产 metadata/Boundary，Delta 至少 partial；
- raw byte digest 不做 EOL 或 Unicode normalization。

### 3.3 Diff Hunk

canonical 算法标识冻结为版本化的 `diff-lines-v1`：

- raw byte digest 不做换行归一化；
- fatal UTF-8 decode；NUL/invalid UTF-8 走 binary/metadata boundary；
- line token 保留 LF/CRLF/CR/no-final-newline；
- 不做 Unicode normalization；NFC/NFD 保持不同 raw token；
- patience anchor 只使用两侧各唯一的完整 line token，候选按 old line/new line
  升序，LIS 同长度时选 lexicographically smallest pair sequence；
- anchor window 使用 Myers；同 edit distance 时依次选择 diagonal、delete、
  insert，不能依赖实现容器遍历顺序；
- context 固定 3 行；相邻 change group 的 context overlap 时合并；
- old/new span 使用 `{startLine,lineCount}`：count>0 时 start 为 1-based 首行；
  count=0 时 start 是行间位置，文件开头为 0，否则为前一行号。text hunk 两侧
  不能同时 count=0；metadata-only 允许两侧为零；
- symbol mapping 只使用 changed spans，不使用 context line；
- canonical operations 是按顺序的
  `{op:"equal"|"delete"|"insert",lineDigest:sha256(raw line bytes including
  terminator)}` object array；`operationsDigest` 对该 canonical array 哈希，
  `patchDigest` 再覆盖 algorithm、Snapshot、path lineage、before/after
  content identity、spans、ordered source layers 与 operations digest；
- bytes、lines、edit work units、hunk count 或 total budget 超限后停止正文分析，
  保留 digest/size/kind 与 Boundary；
- Hunk ID 只由上述 domain-separated `patchDigest` 派生。

Git patch、external diff、textconv、临时文件绝对路径和时间戳不能成为 canonical
Hunk 或 ID。

`ChangeAnalysisBudgetV1` 持久化 changed files、per-file/total bytes、lines、
edit work units、hunks、parser nodes、matching/impact work units与各类输出对象/
字符/序列化 bytes，并进入 `analysisInputDigest`。baseline materialization
由独立 `BaselineMaterializationBudgetV1` 与 private Store quota 约束。精确
计数规则见 3.8.1；全局额度按 UTF-8 bytewise 已排序 path 分配。到达上限时必须
在执行会使计数越界的下一个 canonical unit **之前**停止，该 unit 与所有后续
unit 生成结构化 Boundary；不能提交半个 Hunk、Symbol、Finding 或 Evidence。
并发完成顺序、locale、CPU 速度不能改变覆盖集合。wall-clock timeout、cancel、
abort 或进程中止必须零写入，不能生成机器相关 partial。

### 3.4 Rich Parse 与 Symbol

Core 新接口必须返回：

- `complete / partial / unsupported / error`；
- language、limitations、error spans；
- function/method/class/constructor/module/type；
- full/signature/body spans；
- qualified name、parent、declaration digest；
- import/export/dependency spans。

公开 `SourceSymbolRefV1` 分 old/new 两侧，绑定 Snapshot、path、
language/parser version、kind、qualified name、parent、full/signature/body
span、declaration digest 与可选 Graph Node。side-local ID 由这些 canonical
anchors 派生；Tree-sitter 0-based byte point 必须显式转换为公开的
1-based line、0-based column、end-exclusive span。

映射规则：

- old changed spans 对 old symbols，new changed spans 对 new symbols；
- 选择相交的最深 leaf，同时保留 enclosing container；
- 跨多个 symbols 的 hunk 保留全部；
- 纯插入点结合前后行判断；边界歧义降级 file-level + partial；
- signature span→`SIGNATURE`，body-only→`BODY_LOGIC`；
- import/export/manifest→`DEPENDENCY`；
- add/delete/rename/copy/type change→`TOPOLOGY`；
- test/config/schema/document role 由可验证 file-role matcher 添加；
- 只有 token 级证明全为注释/空白时才允许
  `FORMATTING_OR_COMMENT`；
- parse error overlap、unsupported、ambiguous pairing→`UNKNOWN`。

Actual Change 使用 `oldSymbolRefs[]`、`newSymbolRefs[]` 与
`exact/renamed/old_only/new_only/ambiguous/file_only` pairing status，不能用
一个无 side 的 `symbolIds[]` 混淆 delete/add/rename。纯插入点前后属于不同
Symbol 时降级 file-level partial。

Graph Node 只能通过 path/name/type/range overlap 关联，不能作为源码解析事实或
Actual Change 的唯一 ID。

### 3.5 Actual Change、Completeness 与 Finding

Actual Change 至少包含：

- deterministic ID、path/oldPath、kind、source layers；
- symbol/hunk/file granularity、old/new Symbol refs 与 pairing status；
- semantic facets；
- Diff Evidence IDs、Boundary Evidence IDs；
- complete/partial/unknown。

Completeness 必须恰好覆盖五维：

1. repository delta；
2. semantic classification；
3. planned matching；
4. impact analysis；
5. verification coverage。

每维 partial/unknown 都引用结构化 Boundary；overall 取最差值。强 invariants：

- 所有 Actual ID、Diff/Boundary Evidence、Planned Change、Verification Plan
  Entry、Claim 和 Impact Path 都存在且属于同 Task/Snapshot；
- 每个 Actual 恰好一个 planned/unplanned/cannot-determine primary
  disposition；
- 每个 confirmed required change 恰好一个 completed/partial/omission/
  cannot-determine primary disposition；
- verification gap 等 secondary Finding 不得与 primary disposition 冲突；
- omission 的 Actual 必须为空，且对应 scope 的 Delta/Semantic/Matching
  complete；
- verification gap subtype：
  `missing_plan_entry` 要求 uncovered Claim 且无 Entry，
  `insufficient_coverage` 要求 Entry+Claim，
  `unsupported_method/ambiguous_coverage` 还要求 Boundary；
- cannot-determine 必须引用结构化 Boundary；
- Impact complete 且无路径时使用 `none_observed`；其他 Finding 有 Impact，或
  有 impact-analysis Boundary；
- complete Actual/dimension 禁止 UNKNOWN facet 与 Boundary；
  redacted/unavailable/metadata-only、ambiguous pairing 或 parser limitation
  必须令相应 Actual/dimension partial/unknown；
- Delta 不 complete 时不能用空 Findings 表示“没有问题”。
- strong Check 的 Findings 只有在零 effective change、零未处置 required
  obligation/verification coverage gap 且五维都 complete 时才可为空。

### 3.6 Planned Change 与 Verification

新 writer expectation：

| candidate level | strong expectation |
|---|---|
| `likely_change` | `required_change` |
| `possible_change` | `optional_change` |
| `must_inspect` | `inspect_only` |
| `context_only` | `inspect_only` |
| `test_or_verify` | `verification_only` |

只有进入 `planned` 前由强类型 Action 确认的 required change 才产生 obligation。
legacy 缺失 expectation 不做追溯映射。

Strong Task 同时保存：

- Manifest 从 `created@1` 起保存 resolved `contextBuildSpec`：scope、token
  budget、max candidates、max impact depth 与只作 provenance 的 baseRef；
- `contextGenerationId`：绑定 Task、baseline/target Snapshot、spec 与 Context
  dependency digests；首次 context_ready 后 Manifest、Brief 与 publication
  Event 必须相等，created 可缺。

`confirm_goal`、`confirm_acceptance_criteria`、`confirm_plan` 的 strong Event
必须携带当前 generation；Transition Gate 只读取同 generation confirmation。
refresh/rebase 即使生成了相同 Claim/PlannedChange ID，也必须产生新 generation
并重新确认，避免 append-only 历史 Event 意外复活旧 Plan。

Verification：

- `record.method === planEntry.method`；
- 首次 attempt=1 且无 supersedes；
- 后续必须 supersede 同 Entry/Snapshot 的最新 Record；
- Record ID、attempt、recordedAt、actor 由 Engine 生成；
- public strong Record 只保存 method/status/attempt/Claim/Snapshot、固定
  `publicResultCode` 与 detail disposition；不保存 owner-only detail locator/
  digest，也不保存调用方 command、
  summary、stdout/stderr、root/path 或任意自由文本。method 非 manual 且
  passed/failed/flaky 的 normalized command descriptor 只可写入内部 detail
  ledger，且 Server 永不执行；
- internal detail 必须在递归 secret/Host-path scanner 后才能保存归一化 command
  descriptor、exit code/duration 与安全 output digest；禁止保存 raw
  stdout/stderr。任何 scanner error 或命中 secret/path 时丢弃对应 detail，
  public Record 仍只写 sorted/unique fixed `redactionCodes`，不得生成或引用
  Boundary；
- required latest result 只有 passed 或 accepted skipped，且 `claimIds` 覆盖
  Plan Entry 全部 `acceptanceClaimIds` 时满足 Gate；子集结果可入账但不满足；
- 不支持 P0 method substitution；不同 method 只能执行原 method、accepted
  skip，或 supersede 后新建 Task，refresh 不能改写 fresh Plan；
- `verification_required → in_progress` Action 必须指向当前
  generation/Snapshot/Entry 的 latest failed/blocked/flaky Record；更早失败在
  后续 passed 后不再授权回退。

### 3.7 Immutable Task Projection History

当前 flat singleton files 不能单独承担历史信任。strong Store 冻结为：

- canonical `task-brief/claims/evidence/impact/change-check/verification` 只表示
  current projection；
- 在新 Snapshot cleanup、refresh 或 rebase 等 destructive reset 前，将旧
  baseline、Brief、Claim、Evidence、Impact、Check、Verification descriptor
  set 按 generation/version 归档到 immutable history；
- historical root 精确 pin artifact ID、content digest、Snapshot、Task revision
  与 dependency closure；同 Task 的 current descriptor set 仍保持单 revision，
  historical set 独立验证，不参与 current-set equality；
- digest-pinned historical Repository Snapshot/task baseline 使用
  `immutable_pin` dependency：not-latest 不传播 freshness stale，缺失/损坏/
  digest mismatch 仍 fail closed；
- Check 直接 pin exact baseline/actual Snapshot、task baseline、Brief、
  Evidence、Impact；rebase 后旧 Check 仍能下钻旧 ledger；
- Task transaction marker 记录本事务新建 blob path/digest/是否 pre-existing；
  rollback 只删除本事务新建、未被 committed current/historical descriptor 引用
  的对象；
- P0 committed history/blob/Git lease 无自动 GC；deterministic baseline budget
  或 private-blob/active/temp logical quota 超限时相应 unit metadata-only +
  Boundary；metadata quota或真实 durable I/O 失败则 transaction 零写。未来
  只有显式审计删除可 mark-and-sweep。

### 3.8 字段级 Schema Appendix（normative）

本节是两个互斥 Gate共用的字段级实现合同，不是示例：C09 provider wire归
WP5-1P，C01～C08 Change Intelligence/Store/Repository wire归 WP5-1；WP1只提供
shared Schema/package foundations，不拥有、重定义或验收本节任一
field/domain/locator/vector。实现可以把类型拆到不同文件，但字段、枚举、条件必填、
排序和 digest domain不得弱化；如需改变，必须新增决策而不能在代码中自行解释。
所有对象使用 strict schema，不做 coercion、default或 parse-time transform；所有
ID使用独立 branded Schema，不继续用无语义的 `OpaqueIdentifierSchema`。

| 唯一 Gate / Owner | 本节规范范围 |
|---|---|
| WP5-1P / C09；Platform/Security Accountable，Contracts/Core + Provider/Systems Responsible，QA/Security + independent Implementability Verify | 全部 `provider-*`、`installation-provider-*`、`store-provider-*`、`store-durable-object-provider-*`，以及 Acceptance、distribution、migration、terminal journal、Store Manifest provider-side compare-append wire、golden与negative vectors |
| WP5-1 / C01～C08；Change Intelligence / Task / Store / Repository Owners | 其余 Analysis、Baseline、Repository、SafeGit、Task、Change、Verification与 Private Store quota wire、fixtures |
| shared machinery | JCS、strict primitive、Envelope与 package runner可以复用，但每个 domain/vector仍按上两行唯一归属，不能借 shared实现把 C09 Gate移回 WP1 |

#### 3.8.0 Strong primitive 与稳定 ID wire format

下文代码块使用以下已有或新增 branded primitive；字段注释中的 `string` 不得
被实现为任意字符串：

| 语义 | 必须使用的 Schema / wire format |
|---|---|
| payload/content/policy/state digest | `ContentDigestSchema`：`sha256:<64 lowercase hex>` |
| Ed25519 raw public-key digest | `Ed25519PublicKeyDigestV1Schema`：wire同为 `sha256:<64 lowercase hex>` 但必须是独立 brand；唯一 preimage 是 canonical base64url 解码后的 exact 32 raw octets |
| Ed25519 verification profile | singleton `ed25519-rfc8032-cofactorless-prime-subgroup-v1`；不得由 runtime 默认行为或“Ed25519”字符串替代 |
| Ed25519 raw public key | `CanonicalPublicKeyBytes32V1Schema`：canonical unpadded base64url，解码后 exact 32 octets；独立于任意长度的 `CanonicalByteStringV1Schema` |
| Git object | `GitObjectIdSchema`：与 `objectFormat` 对应的 40/64 lowercase hex |
| repository path | `RepositoryRelativePathSchema`；POSIX、relative、无 dot/parent/control segment |
| Store descriptor path | `StoreRelativePathV1Schema`；与 repository path 同等 traversal/control 约束，但相对 `.understand-code/` |
| Store filename encoding | `StoreFilenameKeyV1Schema`：short `id-<lowercase unpadded base32hex>` 或 long `idh-<full sha256>` canonical variant；short alphabet 在 case-insensitive filesystem 上仍唯一 |
| Git mode | `GitModeV1Schema`：`040000/100644/100755/120000/160000` |
| Git ref | `GitRefNameV1Schema`：通过 `git check-ref-format` 等价纯函数校验，禁止 leading `-`、control、reflog syntax 与 path traversal |
| 时间 | `IsoTimestampSchema`：真实 RFC 3339 UTC |
| producer/ruleset | `ProducerVersionSchema`：SemVer |
| producer identity | `ProducerIdV1Schema`：`^[a-z0-9][a-z0-9._/-]{0,127}$` |
| durable provider slug | `DurableObjectIdentityProviderSlugV1Schema`：1..64 ASCII bytes，`^(?!.*\.\.)[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$`；禁止连续 `.` 及任何首尾标点 |
| durable provider identity | `DurableObjectIdentityProviderIdV1Schema`：只允许由已通过上行 Schema 的 slug 构造 `durable-object-provider:<slug>`，并 exact-resolve 到 pinned Registry member |
| language identity | `LanguageIdV1Schema`：`^[a-z0-9][a-z0-9+._-]{0,63}$` |
| parser identity/version | `ParserVersionV1Schema`：1–128 个 `[A-Za-z0-9._+@/-]`，禁止 `.`/`..` path segment 与 leading slash |
| graph node identity | `GraphNodeIdV1Schema`：1–1024 UTF-8 bytes、trimmed、无 control/NUL，独立 brand；必须 exact-resolve 到 pinned Graph |
| safe excerpt line | `SafeExcerptLineV1Schema`：最多 4096 Unicode scalar，可含 tab，禁止 NUL/line terminator；另受 scanner/总字符 Budget |
| strong semantic ID | 对应的独立 prefix + `:` + 22 lowercase hex |

`StableSemanticIdV1(prefix, fields)` 的 wire format 冻结为
`<prefix>:<first 22 lowercase hex of sha256(canonical JSON(preimage))>`，其中
preimage 唯一合法容器为：

```ts
type StableIdPreimageV1<D extends string, F extends object> =
  readonly [domain: D, fields: F];
```

不能使用 `[domain, field1, ...]`、`{domain,...fields}`、字符串拼接或只在输出
prefix 区分 domain。`fields` 是下表对应的 strict named object；optional
缺失编码为“key omitted”，绝不编码成 `null/""/undefined`；显式空 set 编码为
`[]`。所有 set-like array 必须先按 3.8.4 排序并拒绝重复，number 必须是 safe
integer；字符串保持解析后的原始 Unicode scalar sequence且不做任何
normalization，唯一 UTF-8 bytes由下述 JCS profile产生。完整 SHA-256 digest 使用同一
`[domain, fields]` 容器，只是不截断。WP5 新增的独立 Schema 至少包括：

本文所有 `canonical JSON`、`canonical preimage/message/payload bytes` 与
`canonicalize` 均唯一指向版本化 profile
`rfc8785-jcs-safe-integer-v1`，不得由语言 runtime 的普通 `JSON.stringify`、map
遍历顺序或 locale comparator 替代。该 profile 以 RFC 8785 / JCS 为基线并冻结为：

1. 输入必须先通过对应的完整 strict Schema：禁止 coercion、default、parse-time
   transform、额外 object key、duplicate JSON member、sparse array、cycle、getter、
   `undefined`、`bigint`、function、symbol 或其他非 JSON value。canonicalizer 不负责
   “修好”非法输入；Schema 或 canonicalization 任一步失败都在 hash/sign 前 fail
   closed；
2. JCS object member name 在每一层按 RFC 8785 的 UTF-16 code-unit lexicographic
   order 排序，不能使用 locale、UTF-8 byte order 或 insertion order。array 保持输入
   顺序；set-like array 必须先按本合同声明的 comparator 排序、拒绝 duplicate，再
   交给 JCS，JCS 本身绝不重排 array；
3. 所有 JSON number 在 Schema 层必须满足 `Number.isSafeInteger(value)` 且
   `!Object.is(value, -0)`；fraction、unsafe integer、`-0`、`NaN`、
   `Infinity/-Infinity` 全部拒绝，不能 round、clamp 或把 `-0`
   改写为 `0`。通过后的 integer 使用 RFC 8785 唯一 number serialization；
4. string 必须是有效 Unicode scalar sequence；invalid UTF-8、lone surrogate 与 NUL
   约束违反按对应 Schema 拒绝。JCS 只执行 RFC 8785 JSON escaping；不做 NFC/NFD、
   大小写、EOL、path 或 locale normalization。因而 canonically equivalent 但
   code-point bytes 不同的字符串仍产生不同 canonical bytes；
5. optional field 缺失时 key 必须 omitted；`undefined` 永远非法。只有字段 Schema
   显式包含 literal `null` 时才编码 JSON `null`，否则用 `null` 代替缺失值必须拒绝。
   empty set/list 仍显式编码 `[]`，不能改成 omitted/null；
6. JCS 输出再编码为严格 UTF-8，**无 BOM、无前后 whitespace、无 trailing newline**；
   这组 octet 是唯一 cryptographic message。`SHA-256` 与 `HMAC-SHA-256` 直接消费
   exact octet，不先 hash 字符串表示、不加入长度/换行/BOM；digest wire 只在运算后
   编码为 lowercase hex。Ed25519 的唯一 message 是
   `JCS([domainLiteral, signerWrapper])` 的 exact octet，并使用 raw Ed25519
   直接签名；禁止 Ed25519ph、额外 prehash、只签 wrapper、
   `[domainLiteral, claims]`、替代 domain wrapper 或重新序列化。

`Ed25519PublicKeyDigestV1`是本节唯一不使用 JCS/domain wrapper的 key digest：
producer先以 `CanonicalPublicKeyBytes32V1Schema`验证 canonical unpadded
base64url，再解码为 exact 32 raw octets，直接计算
`SHA-256(rawPublicKeyBytes)`并编码为 `sha256:<64 lowercase hex>`。对 base64url
文本、UTF-8文本、PEM、SPKI/DER、JWK、长度前缀、JCS string或
`[domain,fields]`求 hash全部错误。root/recovery/provider/approver key ID仍按各自
domain-separated JCS stable-ID preimage从 `publicKeyBytes`重算；key ID绝不是
`publicKeyDigest`的前22位，两者必须分别验证。

所有 C09 Ed25519签名统一使用项目级
`ed25519-rfc8032-cofactorless-prime-subgroup-v1`。这是一项有意收窄、跨 runtime
一致的 PureEd25519 profile，而不是“调用任一名为 Ed25519的 API”：

固定参数为 RFC 8032 Ed25519的
`p = 2^255 - 19`、`L = 2^252 + 27742317777372353535851937790883648493`与标准
base point `B`；不得由 runtime选择其它 curve/order或批量验证变体。

1. public key、signature分别必须是 exact 32/64 octets；signature拆为 exact
   32-byte `R`与32-byte little-endian `S`，且 `0 <= S < L`；
2. `A`与`R`都必须按 RFC 8032 compressed Edwards25519 point严格解码：`y < p`、
   点在曲线上、decode后重新 encode必须 byte-identical；negative-zero与其它
   non-canonical encoding拒绝；
3. `A`与`R`都不得是 identity，且必须在**完整 Edwards25519 群**上对原始 decoded
   point执行不先 `mod L`、不 cofactor-clear 的整数标量乘，并满足
   `[L]P = identity`；不得用会先把 scalar约化 `mod L` 的高层 API，也不得先转换/
   投影到 Ristretto、清除 cofactor后再检查。由此只接受 non-identity prime-order
   subgroup point，small-order、torsion与mixed-order point全部拒绝；
4. `SHA-512(Rraw || Araw || message)`按 little-endian非负整数解释后
   `mod L`得到 `k`；每个签名单独使用未批处理、未乘 cofactor的
   `[S]B = R + [k]A`验证，不得改用扩大接受集合的实现特定等式；
5. `message`就是上文 exact JCS octets，context参数必须 absent且不得提供 empty
   context；禁止 Ed25519ctx、Ed25519ph、caller prehash、streaming重组或
   runtime默认 context。
6. signer必须按 RFC 8032 PureEd25519确定性生成 exact raw64 signature；禁止
   randomized/hedged Ed25519、ctx/ph与额外 prehash。同 key+message必须得到同
   signature bytes；operation retry只回放首次已持久化 signature/receipt，不能
   重新签名制造另一个合法但 byte-different结果。

host-injected crypto必须显式暴露并冻结以下能力；方法名可按语言映射，语义不可
放宽：

```ts
interface ProviderStrictEd25519CryptoHostV1 {
  verificationProfile:
    "ed25519-rfc8032-cofactorless-prime-subgroup-v1";
  validatePrimeSubgroupPoint(
    encodedPoint: Uint8Array
  ): boolean | Promise<boolean>;
  verifyRawEd25519(
    publicKey: Uint8Array,
    message: Uint8Array,
    signature: Uint8Array
  ): boolean | Promise<boolean>;
}
```

该函数接口不是 JSON wire。可序列化的
`ProviderStrictEd25519CryptoCapabilityV1`只声明 profile与 typed adversarial
manifest Pin，并由 bootstrap bundle固定；启动 attestation必须从 fixed package
resource读取 manifest、运行全部 case，然后返回绑定 defensive-copied method
references与 capability bytes的进程内 opaque handle。后续 Trust Verifier只接受该
opaque handle，不能再次接受裸 host或 caller manifest，防止“先通过 KAT再替换
method”。

两个方法都必须消费 defensive copy并执行相同 profile；`verifyRawEd25519`不能把
“底层 API返回 true”当成完整验证。Node/OpenSSL或 WebCrypto只能在 strict
length/canonical/subgroup/S检查之后作为等式 backend使用，且 host必须先通过
signed package所 pin的 immutable adversarial manifest。任一方法缺失、profile
不等、KAT/negative case分歧、异常、timeout或返回非 boolean都在读取任何
Root/Registry/Catalog/Acceptance签名之前 fail closed，映射
`provider_unavailable/attestation_invalid`并保持零 strong write。

Trust Verifier与 host接口始终只接收 exact raw32 public key；若 Node/OpenSSL
adapter内部必须构造 SPKI，只能在 adapter私有边界拼接固定 RFC 8410
`id-Ed25519` OID `1.3.101.112`、**parameters absent**、且 BIT STRING payload恰为
该 raw32。禁止 caller提供 PEM/DER/SPKI/JWK，禁止 X25519/OID替换、NULL parameters
或额外 wrapper。`Ed25519PublicKeyDigestV1`仍只 hash raw32，不 hash adapter内部
临时 SPKI bytes。

本文任何“输入顺序置换后 bytes不变”只描述 producer在 DTO/Schema之前持有的
无序 collection：builder必须先按合同 comparator排序并拒绝 duplicate，因此不同
遍历顺序产生同一合法 wire DTO。它绝不授权 verifier修复 signed wire array；
serialized set-like array一旦乱序必须 reject，JCS仍原样保留 array顺序。
`requiredDimensions/observationSources`等 fixed tuple更不属于 set，任一置换都非法。
golden必须把“pre-schema collection置换后同 bytes”与“wire array置换后拒绝”分成
两个明确命名的 fixture。

跨语言 fixture 也是冻结合同，不是实现生成的临时 snapshot。Contracts/provider
package 必须发布 versioned、immutable golden manifest；TypeScript 与每个 provider
实现读取**同一份 expected bytes**，不能在测试时用被测 canonicalizer 重算 expected
值。每个 stable-ID、digest-only、owner-HMAC、provider/root/QA/Release Ed25519 domain
至少固定：strict typed input、exact JCS UTF-8 hex、完整 SHA-256、截断 ID（如适用）、
固定非生产 HMAC key + token，以及 RFC 8032 固定 test seed/public key + raw signature
（如适用）。manifest 还必须覆盖 nested key ordering、ASCII/非 ASCII member name、
escape/control、empty/omitted/explicit-null、ordered array 与 NFC/NFD distinct bytes。
negative manifest 至少逐项拒绝 duplicate/extra key、BOM/trailing newline、invalid
UTF-8/lone surrogate、float/`-0`/unsafe/non-finite number、undefined/null substitution、
unsorted/duplicate set、domain/prefix/key-ID/signature substitution，以及非法 provider
slug/ID。任一 canonical profile、Schema、comparator 或 cryptographic wrapper bytes
变化必须新增 profile/domain/schema version 与整套新 vectors；不得静默改写既有
golden bytes，旧 reader 必须继续按其 pinned version 验证。

```ts
type AnalysisBoundaryId = `analysis-boundary:${LowerHex22}`;
type RepositoryDeltaSegmentId = `repository-delta-segment:${LowerHex22}`;
type EffectiveRepositoryChangeId =
  `repository-effective-change:${LowerHex22}`;
type RepositoryPathDeltaId = `repository-path-delta:${LowerHex22}`;
type DiffHunkId = `diff-hunk:${LowerHex22}`;
type SourceSymbolRefId = `source-symbol-ref:${LowerHex22}`;
type ActualChangeId = `actual-change:${LowerHex22}`;
type DiffHunkEvidenceId = `diff-evidence:${LowerHex22}`;
type AnalysisBoundaryEvidenceId = `boundary-evidence:${LowerHex22}`;
type StrongFindingId = `change-finding:${LowerHex22}`;
type StrongPlannedChangeId = `planned-change:${LowerHex22}`;
type VerificationPlanEntryId = `verification-plan:${LowerHex22}`;
type TaskBaselineArtifactId = `task-baseline:${LowerHex22}`;
type RepositoryBasisRecordId = `repository-basis-record:${LowerHex22}`;
type ContextGenerationId = `context-generation:${LowerHex22}`;
type TaskProjectionHistoryId = `task-projection-history:${LowerHex22}`;
type StrongVerificationRecordId = `verification-record:${LowerHex22}`;
type VerificationSkipAcceptanceId =
  `verification-skip-acceptance:${LowerHex22}`;
type InternalVerificationDetailId = `verification-detail:${LowerHex22}`;
type RequestEqualityRecordId = `request-equality:${LowerHex22}`;
type GitLeaseId = `git-lease:${LowerHex22}`;
type GitLeaseRefSuffixV1 = `${LowerHex22}-${LowerHex32}`;
type PrivateBlobId = `private-blob:${LowerHex22}`;
type PrivateCasReservationId =
  `private-cas-reservation:${LowerHex22}`;
type PrivateStoreQuotaAdmissionRecordId =
  `private-store-quota-admission:${LowerHex22}`;
type PrivateStoreQuotaTransitionRecordId =
  `private-store-quota-transition:${LowerHex22}`;
type KeyedStateTokenV1 = `hmac-sha256:${LowerHex64}`;
type Ed25519PublicKeyDigestV1 =
  `sha256:${LowerHex64}` & {
    readonly __brand: "Ed25519PublicKeyDigestV1";
  };
type CanonicalPublicKeyBytes32V1 =
  string & { readonly __brand: "CanonicalPublicKeyBytes32V1" };
type ProviderEd25519VerificationProfileV1 =
  "ed25519-rfc8032-cofactorless-prime-subgroup-v1";
type StoreProviderDurableBindingTokenV1 =
  `provider-binding:${LowerHex64}`;
type StoreProviderRegistrySignatureV1 =
  `provider-registry-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderFeasibilitySupportCatalogSignatureV1 =
  `provider-support-catalog-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderPublicSupportTaxonomySignatureV1 =
  `provider-public-support-taxonomy-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderReleaseMatrixSignatureV1 =
  `provider-release-matrix-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderRealFilesystemFixtureCorpusManifestSignatureV1 =
  `provider-real-fs-fixture-corpus-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderRealFilesystemSuiteManifestSignatureV1 =
  `provider-real-fs-suite-manifest-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderTargetDiscoveryInputBundleSignatureV1 =
  `provider-target-discovery-input-bundle-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderTargetDiscoveryResultSignatureV1 =
  `provider-target-discovery-result-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderReleaseTargetUniverseSignatureV1 =
  `provider-release-target-universe-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderRegistryManifestSignatureV1 =
  `provider-registry-manifest-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderRegistryRootCrossSignatureV1 =
  `provider-root-cross-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderRegistryRootSelfSignatureV1 =
  `provider-root-self-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderRegistryRootRecoverySignatureV1 =
  `provider-root-recovery-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type StoreProviderOperationReceiptTokenV1 =
  `provider-operation-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type StoreProviderContainmentProofTokenV1 =
  `provider-containment-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type StoreProviderStateVersionTokenV1 =
  `provider-state-version-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type StoreProviderJournalVersionTokenV1 =
  `provider-journal-version-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type PathSafeRepositoryIdV1 = `repo-hmac-${LowerHex64}`;
type PathSafeWorktreeIdV1 = `worktree-hmac-${LowerHex64}`;
type PathSafeRootIdentityV1 = `root-hmac-${LowerHex64}`;
type PathSafeRepositorySnapshotIdV1 = `snapshot-${LowerHex64}`;
type PathSafeRepositoryChangeIdV1 = `change-${LowerHex64}`;
type PathSafeRepositoryRedactionIdV1 =
  `snapshot-redaction-${LowerHex64}`;
type PathSafeRepositoryUnknownStateIdV1 =
  `snapshot-unknown-state-${LowerHex64}`;
type StoreFilenameKeyV1 =
  | `id-${string}`     // short canonical lowercase unpadded base32hex
  | `idh-${LowerHex64}`; // long-ID SHA-256 key
type InstallationIdentityGenerationIdV1 =
  `installation-identity-generation:${LowerHex22}`;
type StoreManifestGenerationIdV1 =
  `store-manifest-generation:${LowerHex22}`;
type ArtifactManifestGenerationIdV1 =
  `artifact-manifest-generation:${LowerHex22}`;
type RepoPulseVersionKeyV1 =
  `repo-pulse-version:${LowerHex64}`;
type ProviderRegistryManifestGenerationIdV1 =
  `provider-registry-manifest:${LowerHex22}`;
type ProviderAcceptanceStateGenerationIdV1 =
  `provider-acceptance-state:${LowerHex22}`;
type ProviderAcceptanceCurrentVersionTokenV1 =
  `hmac-sha256:${LowerHex64}`;
type ProviderAcceptanceCompareAppendReceiptTokenV1 =
  KeyedStateTokenV1;
type ProviderTargetProfileIdV1 =
  `provider-target-profile:${LowerHex64}`;
type ProviderPublicSupportProfileIdV1 =
  `provider-public-support-profile:${LowerHex64}`;
type ProviderMigrationIdV1 =
  `provider-migration:${LowerHex22}`;
type ProviderMigrationHistoryQuotaReservationIdV1 =
  `provider-migration-history-reservation:${LowerHex22}`;
type ProviderMigrationHistoryQuotaEventIdV1 =
  `provider-migration-history-quota-event:${LowerHex22}`;
type ProviderMigrationHistoryQuotaReservationTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationHistoryQuotaEventTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationHistoryQuotaCurrentVersionTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationHistoryQuotaOperationReceiptTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationHistoryAccountingProofTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationHistoryZeroReferenceProofTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationHistoryDeletionReceiptTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationProgressRecordIdV1 =
  `provider-migration-progress:${LowerHex22}`;
type ProviderMigrationLiveUniverseIdV1 =
  `provider-migration-universe:${LowerHex22}`;
type ProviderMigrationObjectReceiptIdV1 =
  `provider-migration-object-receipt:${LowerHex22}`;
type ProviderMigrationZeroLiveProofIdV1 =
  `provider-migration-zero-live-proof:${LowerHex22}`;
type ProviderMigrationSourceTombstoneIdV1 =
  `provider-migration-source-tombstone:${LowerHex22}`;
type ProviderMigrationReferenceSlotV1 =
  `migration-reference-slot:${LowerHex22}`;
type ProviderMigrationCanonicalReferenceRewritePlanIdV1 =
  `provider-migration-rewrite-plan:${LowerHex22}`;
type ProviderMigrationSemanticEquivalenceProofIdV1 =
  `provider-migration-semantic-equivalence-proof:${LowerHex22}`;
type ProviderMigrationNamespaceTranslationTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationProgressVersionTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationReceiptTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationProofTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationCanonicalReferenceRewritePlanTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationSemanticEquivalenceProofTokenV1 =
  KeyedStateTokenV1;
type ProviderMigrationCanonicalReferenceRewritePlanSignatureV1 =
  `provider-migration-rewrite-plan-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderMigrationSemanticEquivalenceProofSignatureV1 =
  `provider-migration-semantic-proof-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderMigrationSourceTombstoneSignatureV1 =
  `provider-migration-tombstone-ed25519:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type StoreManifestNamespaceVersionTokenV1 =
  StoreProviderStateVersionTokenV1;
type StoreTerminalizationHandoffRecordIdV1 =
  `store-terminalization-handoff:${LowerHex22}`;
type StoreExternalIntentMutationIdV1 =
  `store-external-intent-mutation:${LowerHex22}`;
type StoreProviderCompareDeleteRecordIdV1 =
  `store-provider-compare-delete:${LowerHex22}`;
type ProviderFeasibilityEvidenceIdV1 =
  `provider-feasibility-evidence:${LowerHex22}`;
type ProviderRealFilesystemConformanceResultIdV1 =
  `provider-real-fs-result:${LowerHex22}`;
type ProviderRealFilesystemCaseIdV1 =
  `provider-real-fs-case:${LowerHex22}`;
type ProviderRealFilesystemCrashCutIdV1 =
  | "no-crash"
  | `provider-crash-cut:${LowerHex22}`;
type ProviderRealFilesystemCaseKeyV1 = string;
  // strict ^[a-z0-9][a-z0-9._-]{0,127}$
type ProviderFeasibilityQaSignatureV1 =
  `provider-feasibility-ed25519:qa:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderFeasibilityReleaseSignatureV1 =
  `provider-feasibility-ed25519:release:${LowerHex22}:${LowerHex64}${LowerHex64}`;
type ProviderFilesystemProfileCodeV1 =
  `provider-fs-profile:${LowerHex22}`;
type ProviderOsReleaseFamilyCodeV1 =
  `provider-os-family:${LowerHex22}`;
```

本文所有 fixed Store path template 中的 `<encoded-artifactId>/
<encoded-recordId>/<encoded-eventId>/<encoded-rootId>/<encoded-detailId>/
<encoded-reservationId>/<encoded-blobId>/<encoded-generationId>` 都表示先验证
semantic ID，再使用
`StoreFilenameKeyV1` 映射为单个 component，绝不直接使用含 `:` 的 wire ID。
UTF-8 semantic ID 为 1..137 bytes、其 canonical lowercase unpadded
base32hex body 长度为 2..220 时使用 `id-` short branch；从 138 bytes 起
唯一切换到 hashed branch。wire syntax 还必须约束 RFC 4648 base32hex 的
合法 encoded-length class 与零 trailing bits。decode 后 UTF-8、
重新编码和目标 ID brand 必须 exact-equal。全小写 alphabet 保证默认
case-insensitive 的 macOS/Windows filename 比较不会把两个不同 short key
折叠为同一 component。更长但仍通过 legacy ID Schema 的值使用
`idh-<full lowercase sha256(UTF-8 semantic ID)>`。hashed key 不能自行 decode；
trusted reader 必须从 descriptor/Envelope 取得 semantic ID、重算 key，并拒绝
同 key 不同 semantic ID。short/hashed variant 的选择唯一，禁止 caller 指定或
把可用 short variant 强制改成 hashed。该映射只解决 Windows/POSIX filename
portability，不进入 semantic ID preimage。`<taskId>` 已由 canonical uppercase
ULID Schema 保证为单个安全 component；`<revision>/<materializationVersion>`
只允许 canonical nonnegative/positive decimal，三者不经过该 filename codec。

exact stable-ID fields 冻结如下；表内字段名也是 wire contract：

| domain literal | strict `fields` object |
|---|---|
| `analysis-boundary-v1` | `{stage,code,scope,recovery}` |
| `repository-delta-segment-v1` | `{baselineSnapshotId,actualSnapshotId,path,source,before,after}` |
| `repository-effective-change-v1` | `{baselineSnapshotId,actualSnapshotId,path,oldPath?,kind,before,after,sourceSegmentIds}` |
| `repository-path-delta-v1` | `{baselineSnapshotId,actualSnapshotId,path,oldPath?,segmentIds,effectiveChangeId?}` |
| `diff-hunk-id-v1` | `{patchDigest}` |
| `source-symbol-ref-v1` | `{snapshotId,path,language,parserVersion,kind,qualifiedName,parentId?,fullSpan,signatureSpan,bodySpan?,declarationDigest}` |
| `actual-change-v1` | `{baselineSnapshotId,actualSnapshotId,repositoryPathDeltaId,effectiveChangeId,diffHunkIds,granularity}` |
| `diff-evidence-v1` | `{taskId,observedAtSnapshotId,hunkId,claimIds,nodeIds}` |
| `boundary-evidence-v1` | `{taskId,observedAtSnapshotId,boundaryId,claimIds,nodeIds}` |
| `change-finding-v1` | `{taskId,baselineSnapshotId,actualSnapshotId,type,plannedChangeIds,actualChangeIds,claimIds,evidenceIds,impactPathIds,verificationGap?}` |
| `planned-change-v1` | `{taskId,contextGenerationId,filePath,symbolId?,expectation,intentDigest,claimIds,impactPathIds}` |
| `verification-plan-v1` | `{taskId,contextGenerationId,acceptanceClaimIds,method,required}` |
| `task-baseline-v1` | `{taskId,captureSnapshotId,materializationVersion,baselineSemanticDigest}` |
| `repository-basis-record-v1` | `{taskId,operationEventId,basisDigest}` |
| `context-generation-v1` | `{input: ContextGenerationInputV1}` |
| `task-projection-history-v1` | `{taskId,archivedTaskRevision,contextGenerationId?,baselineSnapshotId,latestSnapshotId,reason,rootArtifactIds,descriptors,dependencyClosureDigest}` |
| `verification-record-v1` | `{taskId,contextGenerationId,snapshotId,changeCheckContentDigest,verificationPlanEntryId,attempt,supersedesVerificationRecordId?,method,status,claimIds,publicResultCode,detail}`；detail 是完整 public commitment/code projection |
| `verification-skip-acceptance-v1` | `{taskId,verificationRecordId,contextGenerationId,snapshotId,verificationPlanEntryId,eventId,reasonCode}` |
| `verification-detail-v1` | `{verificationRecordId}` |
| `request-equality-v1` | `{taskId,eventId,operation,action?,safeRequestDigest,sensitiveRequestScanPolicyDigest,fullInputEqualityTag}` |
| `git-lease-v1` | `{repositoryId,worktreeId,taskId,baselineSnapshotId,objectFormat,commit}` |
| `private-blob-v1` | `{repositoryId,worktreeId,privateContentDigest,size}` |
| `private-cas-reservation-v1` | `{repositoryId,worktreeId,taskId,transactionNonce,privateBlobId,privateContentDigest,size}` |
| `private-store-quota-admission-v1` | `{repositoryId,worktreeId,taskId,eventId,transactionNonce,policyDigest}`；不含 root/delta |
| `private-store-quota-transition-v1` | `{repositoryId,worktreeId,transactionNonce,phaseOrdinal,transitionKind,policyDigest}`；不含 root/delta |
| `store-manifest-generation-id-v1` | `{repositoryId,worktreeId,predecessor,manifest}`；不含 generation ID/time/content digest |
| `repo-pulse-version-v1` | `{artifactId,sourceSnapshotId,contentDigest}`；输出 full lowercase SHA-256 body，不含 provider binding/receipt |
| `artifact-manifest-generation-id-v1` | `{repositoryId,worktreeId,predecessor,manifestContentDigest,canonicalRepoPulse}`；不含 generation ID/time/content digest |
| `provider-registry-root-key-id-v1` | `{publicKeyBytes}`；取 domain-separated JCS preimage的 SHA-256前22个 lowercase hex，key-ID primitive只验证 exact 32 bytes以保持已发布 golden；不得取 raw-key digest前缀。strict prime-subgroup检查在 key进入 trust record/bundle时另行执行 |
| `provider-registry-recovery-key-id-v1` | `{publicKeyBytes}`；取 domain-separated JCS preimage的 SHA-256前22个 lowercase hex，key-ID primitive只验证 exact 32 bytes；不得取 raw-key digest前缀。进入 trust closure时再做 strict point与 material-uniqueness检查 |
| `provider-registry-manifest-id-v1` | `{installationIdentityGenerationId,activeRootMetadata,manifestGeneration,predecessor,members,routing}`；不含 generation ID/signature/issuedAt |
| `provider-acceptance-state-generation-id-v1` | `{installationIdentityGenerationId,acceptanceOrdinal,predecessor,configuration}`；不含 generation ID/time/token |
| `provider-target-profile-id-v1` | `{osPlatform,osReleaseFamilyCode,osBuildDigest,architecture,filesystemProfileCode,filesystemFeatureProfileDigest,mountOptionProfileDigest}`；输出完整64位 lowercase SHA-256，不含自身 ID或物理 volume identity |
| `provider-public-support-profile-id-v1` | `{osPlatform,osReleaseFamilyCode,architecture,filesystemProfileCode}`；输出完整64位 lowercase SHA-256，只覆盖公开四字段，禁止把 owner-only `ProviderTargetProfileIdV1`或 build/feature/mount digest复制进 public DTO |
| `provider-os-release-family-code-v1` | `{descriptor:ProviderPublicOsReleaseFamilyDescriptorV1}`；输出 `provider-os-family:<first22 lowercase hex>`，descriptor只允许下文 strict public union，禁止包含或读取 OS build digest |
| `provider-filesystem-profile-code-v1` | `{descriptor:ProviderPublicFilesystemDescriptorV1}`；输出 `provider-fs-profile:<first22 lowercase hex>`，descriptor只允许下文 strict public union，禁止包含或读取 feature/mount digest |
| `provider-migration-id-v1` | strict mode union：共同 fields 为 `{mode,reason,identityRelationship,sourceNamespace,destinationNamespace,namespaceTranslation,targetProfileId,sourceTrust,destinationTrust,initialSourceStoreManifest,initialDestinationNamespace,journalAuthorityInstallationIdentity,migrationBudgets,migrationHistoryQuotaSizing,migrationHistoryQuotaSizingDigest,migrationHistoryQuotaAdmission,liveReferenceSchemaDigest,migrationProtocolDigest}`；cross branch 另强制包含 `{sourceRecoveryOnlyAcceptance,destinationRebootstrapBundleDigest,sourceIdentityRetirementPolicyDigest}`。只含 pre-plan cycle-free trust/quota sizing+admission closure，其中 sizing传递覆盖完整 typed source dry-run cut；明确排除 `migrationHistoryQuotaReservations`、migration ID/time、candidate Plan digest与后续 migration-only Acceptance；完整 Plan content digest仍覆盖 deterministic reservation descriptors；`sourceRecoveryOnlyAcceptance`必须 byte-identical `sourceTrust.prePlanAcceptance` |
| `provider-migration-history-quota-reservation-id-v1` | `{migrationId,role,installationIdentity,admissionVectorDigest}`；`admissionVectorDigest`必须 exact-equal `SHA256(JCS(["provider-migration-history-quota-admission-v1", migrationHistoryQuotaAdmission]))`，禁止改用单个 charge digest；`role`与 Identity必须精确选择该完整 admission中的对应 charge，排除 reservation ID/token、`candidatePlanContentDigest`、created/resolved time |
| `provider-migration-history-quota-event-id-v1` | 完整 strict `ProviderMigrationHistoryQuotaEventV1`，排除 `eventId/occurredAt/eventToken`；event ordinal、predecessor、operation nonce、post account/set/usage与 transition branch全部进入 ID |
| `provider-migration-progress-record-id-v1` | `{migrationId,recordOrdinal,predecessor,phase,phasePayloadContentDigest}`；phase payload digest按分支 strict projection重算并排除 record ID/time/自身 digest |
| `provider-migration-reference-slot-v1` | 完整 strict `ProviderMigrationReferenceSlotDescriptorV1`；`schemaFieldPath`是 canonical RFC 6901 JSON Pointer bytes，source kind/kind、field path与 occurrence ordinal全部进入 ID |
| `provider-migration-canonical-reference-rewrite-plan-id-v1` | `{migrationId,migrationPlan,sourceUniverse,sourceFreezeStateVersionToken,destinationNamespace,sourceWriter,destinationWriter,rewriteAlgorithm,objectMappings,referenceSlotMappings,sccSchedule,objectCount,objectMappingSetDigest,referenceCount,referenceSlotMappingSetDigest,sccCount,sccSetDigest}`；不含 plan ID/time、canonical byte counters、HMAC token、provider signature或 Envelope digest |
| `provider-migration-semantic-equivalence-proof-id-v1` | `{migrationId,migrationPlan,rewritePlan,objectMappingOrdinal,sccOrdinal,sourceObject,destinationObject,rewriteAlgorithm,sourceContentDigest,destinationContentDigest,sourceNonReferenceCanonicalBytesDigest,destinationNonReferenceCanonicalBytesDigest,rewrittenReferenceCount,rewrittenReferenceSetDigest,sourceRevalidationStateVersionToken,missingReferenceMappings,duplicateReferenceMappings,unexpectedDestinationReferenceSlots,sourceReferenceDigestMismatches,destinationReferenceDigestMismatches,nonReferenceCanonicalByteMismatches,sccRuleViolations}`；不含 proof ID/time、canonical byte counters、HMAC token、provider signature或 Envelope digest；两个 non-reference digest必须 exact-equal |
| `provider-migration-live-universe-id-v1` | `{migrationId,side,endpointTrustContentDigest,storeManifest,providerFreezeStateVersionToken,liveReferenceSchemaDigest,rootSet,objectSet,referenceSet}`；不含 universe ID/time/content digest/token及可重算 count/set digest |
| `provider-migration-object-receipt-id-v1` | `{migrationId,sourceObject,destinationObject,transformation,destinationPublication,sourceRevalidationStateVersionToken}`；不含 receipt ID/time/token；rewrite branch的 transformation必须包含完整 Rewrite Plan Pin与 Semantic Equivalence Proof Pin，禁止只存裸 digest |
| `provider-migration-zero-live-proof-id-v1` | `{migrationId,sourceUniverse,destinationUniverse,sourceStoreCut,destinationStoreCut,sourceFreezeStateVersionToken,receiptCount,receiptSetDigest,canonicalReferenceRewriteClosure,expectedSourceObjectCount,remainingSourceProviderReferences,unmappedSourceObjects,duplicateSourceMappings,unverifiedDestinationObjects,activeTransactions,retainedPhysicalSourceObjectCount,retainedPhysicalSourceObjectSetDigest}`；不含 proof ID/time/token；`expectedSourceObjectCount`必须 exact-equal `sourceUniverse.objectCount` |
| `provider-migration-source-tombstone-id-v1` | `{migrationId,mode,migrationPlan,sourceInstallationIdentity,sourceProviderId,lastEnabledRegistryEntryContentDigest,zeroLiveProof,tombstoneRegistryManifest?,sourceRecoveryOnlyAcceptance?,destinationInstallationIdentity?,destinationActiveRoot?,destinationRebootstrapBundleDigest?,sourceIdentityRetirementPolicyDigest?,reason}`；不含 tombstone ID/time/signature |
| `store-provider-verification-key-id-v1` | `{providerId,usage,publicKeyBytes}`；取 domain-separated JCS preimage的 SHA-256前22个 lowercase hex，key-ID primitive只验证 exact 32 bytes；不得取 raw-key digest前缀。Registry admission另做 strict point检查 |
| `provider-feasibility-approver-key-id-v1` | `{role,publicKeyBytes}`；取 domain-separated JCS preimage的 SHA-256前22个 lowercase hex，key-ID primitive只验证 exact 32 bytes；QA/Release material不得相同且 admission另做 strict point检查；不得取 raw-key digest前缀 |
| `store-terminalization-handoff-record-id-v1` | `{repositoryId,worktreeId,transactionNonce,predecessor,terminalReceiptContentDigest,terminalizationPlanContentDigest,terminalizationWriteProgressContentDigest,terminalizationProgressDeltaContentDigest?,terminalizationProofContentDigest?}`；genesis无 delta/proof，普通 successor只有 delta，proof-only successor两者必有；不含 record ID/time/content digest |
| `store-external-intent-mutation-id-v1` | `{repositoryId,worktreeId,transactionNonce,predecessor,replacementRevision,replacementPayloadContentDigest}`；predecessor包含 expected revision/content digest/provider version token，genesis固定 absent |
| `store-provider-compare-delete-record-id-v1` | `{repositoryId,worktreeId,transactionNonce,operationNonce,predecessor,progressContentDigest}`；不含 record ID/time/content digest |
| `provider-feasibility-evidence-id-v1` | `{providerId,semanticProviderPolicyDigest,runtimeAttestationContentDigest,implementationDigest,binaryAttestationDigest,target,isolationSecurityBoundaryProfileDigest,ipcPeerAuthenticationPolicyDigest,realFilesystemSuiteDigest,realFilesystemConformanceResult,realFilesystemConformanceResultDigest,fixtureManifestDigest,runnerProfileDigest,crashCutCoverageDigest,result,issuedAt}`；不含 evidence ID、两份 signature与 Envelope content digest |
| `provider-real-fs-conformance-result-id-v1` | `{providerId,semanticProviderPolicyDigest,implementationDigest,binaryAttestationDigest,target,targetDiscoveryResult,targetDiscoveryInputBundleContentDigest,realFilesystemSuiteManifest,suiteDigest,fixtureManifestDigest,runnerProfileDigest,crashCutCoverageDigest,caseResults,result,completedAt}`；完整 Discovery Result与 Suite Manifest Pin进入 identity，不含 result ID/Envelope content digest |
| `provider-real-fs-case-id-v1` | `{caseKey,fixtureRecordCount,fixtureRecordSetDigest}`；输出 `provider-real-fs-case:<first22 lowercase hex>`，case key先通过 strict regex |
| `provider-real-fs-crash-cut-id-v1` | hashed branch为 `{caseId,crashCutOrdinal,injection,recoveryAssertionContentDigest}`，输出 `provider-crash-cut:<first22 lowercase hex>`；`no-crash`是唯一 singleton、永不走 hash branch |
| `repository-snapshot-redaction-v1` | `{repositoryId,worktreeId,repositoryStateToken,source,kind,boundaryCode,count}` |
| `repository-snapshot-unknown-state-v1` | `{repositoryId,worktreeId,repositoryStateToken,code,count}` |
| `installation-identity-generation-v1` | `{initializationNonce:LowerHex32}` |

digest-only domain exact fields：

| domain literal | strict `fields` object |
|---|---|
| `diff-operations-v1` | `{operations}` |
| `diff-hunk-patch-v1` | `{algorithm,baselineSnapshotId,actualSnapshotId,path,oldPath?,beforeContent,afterContent,oldSpan,newSpan,sourceLayers,operationsDigest}` |
| `repository-read-set-v1` | `{version,entries}` |
| `task-creation-basis-v1` / `repository-basis-v1` | 对应完整 strict Basis object |
| `security-scan-policy-v1` | `{version,hardDenyPathRulesetDigest,sensitivePathRulesetDigest,contentScannerRulesetDigest,controlTreeExclusionRulesetDigest,maxPathBytes,maxEnumeratedUnitsPerCapture,maxTotalRawPathBytesPerCapture,maxDirectoryDepth,maxStreamingBytesPerUnit,maxStreamingBytesPerCapture}` |
| `safe-git-invocation-policy-v1` | 完整 `SafeGitInvocationPolicyV1`，含 isolation/stdin/record/wall/termination/ref-lock 与 OS-enforced RSS/address-space/CPU/PID/FD caps |
| `safe-git-isolation-policy-v1` | 完整 `SafeGitIsolationPolicyV1` |
| `safe-git-bootstrap-resolver-v1` | `{version,rootBinding,dotGitResolution,gitFileTargetResolution,commonDirResolution,linkedWorktreeBinding,canonicalization}` |
| `safe-git-execution-v1` | `{version,invocationPolicyDigest,bootstrapResolverPolicyDigest,isolationPolicyDigest,gitBinaryDigest,executableBindingToken,bootstrapBindingToken,linkedWorktreeBindingToken,objectDatabaseLayoutToken,refBackendLayoutToken,gitVersion,repositoryConfigToken,worktreeConfigToken,emptyHooksDirectoryToken,platformNullDevice}` |
| `baseline-materialization-budget-v1` | `{version,maxBaselineBlobBytesPerFile,maxBaselineBlobBytesTotal}` |
| `private-store-quota-policy-v1` | 完整 `PrivateStoreQuotaPolicyV1`，包括所有 byte/count 与 quota-index/manifest structural caps |
| `store-durable-object-provider-policy-v1` | 完整 strict `StoreDurableObjectProviderPolicyV1`；只含稳定 semantic protocol、IPC/security-boundary profile、restart staging recovery、atomic root containment、external-intent compare-replace、journal enumeration与 real-FS suite，不含滚动 binary/implementation attestation |
| `store-provider-filesystem-profile-v1` | `{filesystemProfileCode,filesystemFeatureProfileDigest,mountOptionProfileDigest}`；三项均取 Provider Feasibility Evidence target 的 exact值 |
| `store-durable-object-provider-runtime-attestation-v1` | 完整 strict `StoreDurableObjectProviderRuntimeAttestationV1`，排除 `registrySignature`；精确声明当前 binary/IPC endpoint/platform/filesystem conformance evidence实现哪个 semantic policy digest |
| `provider-feasibility-evidence-v1` | 完整 strict `ProviderFeasibilityEvidenceV1`；evidence ID与 QA/Release signatures先按各自 domain重算，payload/Envelope不得含 volume UUID、mount path、username或 raw IPC endpoint |
| `provider-feasibility-support-catalog-v1` | 完整 strict `ProviderFeasibilitySupportCatalogV1`，排除 `catalogSignature`；包含 exact Public Taxonomy与 Release Target Universe pins，targets按 target profile ID、各 candidates按 provider ID UTF-8 bytewise排序且unique并 exact-cover Universe，generation/predecessor连续 |
| `provider-public-support-taxonomy-v1` | 完整 strict `ProviderPublicSupportTaxonomyV1`，排除 `taxonomySignature`；OS-family records按 code、filesystem records按 code UTF-8 bytewise排序且 descriptor/code分别unique，code必须由对应 descriptor stable domain重算 |
| `provider-distribution-history-policy-v1` | 完整 strict `ProviderDistributionHistoryPolicyV1`；reachable closure固定为 Catalog、Taxonomy、Release Matrix、Discovery Result、Release Target Universe五条完整 generation chain、每代 Discovery内嵌 Bundle，以及 Bundle传递 pin到的 Fixture/Runner、Suite、Fixture Corpus source Envelope；single retained object 16 MiB、65,536 unique retained object、unique Envelope累计 canonical bytes 512 MiB、emergency reserve、streaming admission与 exhaustion全部进入 signed package identity |
| `provider-strict-ed25519-adversarial-manifest-v1` | 完整 strict `ProviderStrictEd25519AdversarialManifestV1`；case按 case ID UTF-8 bytewise排序且unique，覆盖 exact raw key/message/signature bytes、category、public-key point admission、signature-R point admission与完整 signature expected result；outer Envelope `contentDigest`不进入 payload digest |
| `provider-bootstrap-trust-bundle-v1` | 完整 strict `ProviderBootstrapTrustBundleV1`；覆盖 typed strict crypto capability/manifest Pin、bootstrap root、完整 bootstrap Root Metadata Envelope、按 recovery key ID排序的三把 recovery key、threshold=2与 trust-history policy；outer Envelope `contentDigest`不进入 payload digest |
| `provider-signed-package-identity-v1` | `{resolverProfile,releaseRevisionDigest,bootstrapTrustBundle,historyPolicy}`；`bootstrapTrustBundle`是 fixed-resource Pin；输出完整 SHA-256并 exact-equal `ProviderSignedDistributionRootBindingV1.signedPackageIdentityDigest`，不包含任一 coverage artifact digest或 physical path |
| `provider-release-target-entry-set-v1` | `{targets:ProviderReleaseTargetUniverseTargetEntryV1[]}`；按 `target.targetProfileId` UTF-8 bytewise排序且unique，同 ID不同完整 target/public projection bytes拒绝，不含 count |
| `provider-release-matrix-v1` | 完整 strict `ProviderReleaseMatrixV1`，排除 `matrixSignature`；generation/predecessor、root/taxonomy pin、target count/set digest与完整有序 target set进入 digest |
| `provider-target-discovery-source-manifest-record-set-v1` | `{observationSource,entries:ProviderTargetDiscoverySourceManifestRecordV1[]}`；按 `sourceRecordOrdinal` exact `0..N-1`，完整 resolved/unresolved outcome进入 digest，允许 canonical empty |
| `provider-real-fs-fixture-program-v1` | `{fixtureProgramProfile,fixtureProgramBytes}`；digest与 decoded logical bytes都必须由 exact canonical byte string重算 |
| `provider-real-fs-fixture-corpus-record-set-v1` | `{records}`；按 `{caseKey UTF-8,fixtureOrdinal}`排序且 unique，每个 case ordinal exact `0..N-1` |
| `provider-real-fs-fixture-case-record-set-v1` | `{caseKey,records}`；只投影该 case的 contiguous records，作为 Case ID输入 |
| `provider-real-fs-fixture-manifest-v1` | `{corpusVersion,recordCount,recordSetDigest,records}`；输出 payload `fixtureManifestDigest`，不含 release/root/signature，因而是 release-independent semantic corpus digest |
| `provider-real-fs-fixture-corpus-manifest-v1` | 完整 strict signed `ProviderRealFilesystemFixtureCorpusManifestV1`，包含已生成的 `corpusSignature`；只排除 outer Envelope `contentDigest`，Envelope content digest只使用本 domain |
| `provider-real-fs-runner-profile-v1` | 完整 strict `ProviderRealFilesystemRunnerProfileV1` |
| `provider-real-fs-recovery-assertion-v1` | `{recoveryAssertionProfile,recoveryAssertionBytes}`；hashed crash cut内的 digest必须重算 |
| `provider-real-fs-suite-case-set-v1` | `{cases}`；按 case ID UTF-8排序且 unique，每个 corpus case key exact出现一次 |
| `provider-real-fs-required-case-cut-set-v1` | `{entries:{caseId,crashCutId}[]}`；由全部 case/cut flatten后按 tuple UTF-8排序且 unique |
| `provider-real-fs-suite-definition-v1` | `{suiteVersion,fixtureManifestDigest,runnerProfileDigest,caseCount,caseSetDigest,requiredCaseCutCount,requiredCaseCutSetDigest,cases}`；其中 `fields.fixtureManifestDigest := payload.fixtureCorpusManifest.fixtureManifestDigest`，输出 payload `suiteDigest`，不含 release/root/signature，因而是 release-independent semantic suite digest |
| `provider-real-fs-suite-manifest-v1` | 完整 strict signed `ProviderRealFilesystemSuiteManifestV1`，包含已生成的 `suiteSignature`；只排除 outer Envelope `contentDigest`，Envelope content digest只使用本 domain |
| `provider-target-discovery-fixture-manifest-v1` | 完整 strict `ProviderTargetDiscoveryFixtureManifestV1`；record count/set digest按 source-manifest domain重算，distribution/release/suite/fixture commitments与 records全部进入 content digest |
| `provider-target-discovery-runner-run-manifest-v1` | 完整 strict `ProviderTargetDiscoveryRunnerRunManifestV1`；producer/version/implementation/binary/profile/release cut、record count/set digest与 records全部进入 content digest |
| `provider-target-discovery-observation-cut-v1` | 完整 strict `ProviderTargetDiscoveryObservationCutV1`；exact绑定 distribution root/release revision、active root、Taxonomy、Matrix、fixture manifest、runner instance、ruleset/dimensions/sources与 freshness rule |
| `provider-target-discovery-source-record-v1` | `{observationSource,sourceArtifactContentDigest,sourceRecordOrdinal,outcome}`；Matrix source固定投影 `matrix.targets[i] -> {sourceRecordOrdinal:i,outcome:{state:"resolved",target}}`，Fixture/Runner source才要求 byte-identical各自 payload `records[i]`；输出 exact-equal `privacySafeObservationClaimsDigest` |
| `provider-target-discovery-observation-key-v1` | `{observationSource,sourceArtifactContentDigest,sourceRecordOrdinal,privacySafeObservationClaimsDigest}`；source ordinal为非负 safe integer；不含 bundle/result ID，因而可在签名前独立重算 |
| `provider-target-discovery-source-observation-set-v1` | `{observationSource,sourceArtifactContentDigest,entries:ProviderTargetDiscoveryInputObservationV1[]}`；按 `sourceRecordOrdinal`升序且 exact `0..N-1`，每个 observation key按上行重算并 strict unique |
| `provider-target-discovery-input-observation-set-v1` | `{entries:ProviderTargetDiscoveryInputObservationV1[]}`；按 `{observationSource fixed-order,sourceRecordOrdinal}`排序且 unique，exact-cover三个 source summary |
| `provider-target-discovery-input-bundle-v1` | 完整 strict `ProviderTargetDiscoveryInputBundleV1`，排除 `bundleSignature`；exact pin Matrix、携带 signed Suite Pin的 fixture manifest、runner instance、release cut与三个 complete observation set |
| `provider-target-discovery-result-v1` | 完整 strict `ProviderTargetDiscoveryResultV1`，排除 `discoverySignature`；exact pin input bundle，ruleset/dimensions/sources、target/unresolved count、target set digest、完整有序 discovered target set与typed unresolved observations进入 digest |
| `provider-release-target-universe-v1` | 完整 strict `ProviderReleaseTargetUniverseV1`，排除 `universeSignature`；coverage basis exact pin签名 Release Matrix与 Target Discovery Result，target entries按 target profile ID、coverage buckets按 public profile ID排序且unique，bucket target IDs组成 target entries的 exact partition |
| `provider-real-fs-conformance-result-v1` | 完整 strict `ProviderRealFilesystemConformanceResultV1`；覆盖 exact signed Suite Manifest Pin，caseResults按 `{caseId,crashCutId}` UTF-8 bytewise排序且unique，aggregate result可由 resolved Suite全部 required case重算 |
| `provider-registry-root-metadata-v1` | 完整 strict `ProviderRegistryRootMetadataV1`，包含按 recoveryKeyId排序的 cross/self/recovery signatures；root generation/predecessor/activation与实际授权 quorum全部进入 full-record digest |
| `store-durable-object-provider-registry-entry-v1` | 完整 strict `StoreDurableObjectProviderRegistryEntryV1`，排除 `registrySignature`；enabled member的 `registryEntryContentDigest`与 per-provider predecessor digest都只按本 domain重算 |
| `provider-registry-manifest-v1` | 完整 strict `ProviderRegistryManifestV1`，排除 `manifestSignature`；members按 provider ID UTF-8 bytewise排序且unique，enabled entry/tombstone不可由 absence表达 |
| `provider-acceptance-state-v1` | 完整 strict `ProviderAcceptanceStateV1`，排除 `acceptanceToken`；`strong_ready/migration_only/recovery_only` configuration及 exact predecessor进入 digest |
| `provider-trust-history-policy-v1` | 完整 strict `ProviderTrustHistoryPolicyV1`；全部 count/byte/emergency reserve与 exhaustion语义进入 immutable Installation Identity trust closure |
| `provider-acceptance-compare-append-request-v1` | 完整 strict `ProviderAcceptanceCompareAppendRequestV1`；包含 `operationNonce`、identity、expected完整版本/set claims与 candidate Envelope，不排除任何字段 |
| `provider-acceptance-compare-append-receipt-v1` | 完整 strict `ProviderAcceptanceCompareAppendReceiptV1`，排除 `receiptToken`；包含完整 request、原始 committed/not_committed outcome与一次性 `resolvedAt` |
| `provider-acceptance-generation-set-v1` | 完整 strict `ProviderAcceptanceGenerationEnumerationV1.entries`；按 acceptance ordinal升序、同 ordinal按 generation ID UTF-8 bytewise排序并 strict unique |
| `provider-acceptance-high-water-v1` | 完整 strict `ProviderAcceptanceHighWaterV1`；current pin、generation count/set digest、三个 accepted generation floor及 exact predecessor全部进入 digest |
| `provider-active-writer-selector-v1` | 完整 strict `ProviderActiveWriterSelectorV1`；selections按 target profile ID排序且unique |
| `provider-migration-endpoint-trust-v1` | 完整 strict `ProviderMigrationEndpointTrustPinV1`，排除 `trustClosureContentDigest`；Identity/Acceptance high-water+token/Root/Registry/Catalog/selector/selected writer全部进入 digest |
| `provider-migration-namespace-translation-v1` | 完整 strict `ProviderMigrationNamespaceTranslationV1`，排除 `translationContentDigest/sourceAuthorizationToken/destinationAuthorizationToken/journalAuthorityToken`；source/destination Identity与各自 repository/worktree HMAC identity进入 digest |
| `provider-migration-plan-v1` | 完整 strict `ProviderMigrationPlanV1`；migration ID按 cycle-free stable preimage重算，双方 pre-plan trust、initial Store cuts、journal authority与 locator进入 digest |
| `provider-migration-history-quota-policy-v1` | 完整 strict `ProviderMigrationHistoryQuotaPolicyV1`；Identity级 logical/provider-allocated/count/category/control/escrow caps、normal/emergency admission与 exhaustion全部进入 digest |
| `provider-migration-budgets-v1` | 完整 strict `ProviderMigrationPlanCommonV1.migrationBudgets`；全部 count/logical/provider-allocated/component/total caps进入 digest |
| `provider-migration-history-quota-source-dry-run-cut-v1` | 完整 strict `ProviderMigrationHistoryQuotaSourceDryRunCutV1`；覆盖 authenticated source trust/Manifest/freeze cut、live root/object/reference complete-set claims、UTF-8顺序 exact-cover全部11种 kind（含显式零项）的 retained-artifact upper-bound tuple与 derived charges，禁止 migration ID、reservation ID/descriptor/token、Plan digest、时间及未来 artifact pin |
| `provider-migration-history-quota-sizing-v1` | 完整 strict `ProviderMigrationHistoryQuotaSizingV1`；覆盖 inline typed source dry-run cut、cut digest、migration budgets digest及唯一 derived journal charge amounts |
| `provider-migration-history-quota-admission-v1` | 完整 strict `ProviderMigrationHistoryQuotaAdmissionV1`；charges按 same journal 或 cross source→destination固定顺序，排除 migration ID、reservation descriptors/IDs与任何 token；本 domain的唯一输出同时就是每个相关 descriptor/record/request projection复用的 `admissionVectorDigest`，禁止另算 per-charge digest |
| `provider-migration-history-quota-reservation-v1` | 完整 strict `ProviderMigrationHistoryQuotaReservationV1`，覆盖单向 `candidatePlanContentDigest`并仅排除 `reservationToken` |
| `provider-migration-history-quota-cancellation-fence-v1` | 完整 strict `ProviderMigrationHistoryQuotaCancellationFenceV1`，排除 `cancellationToken`；只作为 destination cancel event/receipt中的 authenticated permanent fence，不替换 reservation locator |
| `provider-migration-history-quota-event-v1` | 完整 strict `ProviderMigrationHistoryQuotaEventV1`，排除 `eventToken`；event ID已按 stable domain重算 |
| `provider-migration-history-quota-event-set-v1` | `{installationIdentity,entries:ProviderMigrationHistoryQuotaEventEnumerationEntryV1[]}`；按 `eventOrdinal` exact `1..N`，predecessor连续且 event ID/content digest/nonce unique |
| `provider-migration-history-quota-receipt-set-v1` | `{installationIdentity,entries:ProviderMigrationHistoryQuotaReceiptEnumerationEntryV1[]}`；按 `receiptOrdinal` exact `1..N`，operation nonce strict unique |
| `provider-migration-history-quota-account-set-v1` | `{installationIdentity,entries:ProviderMigrationHistoryQuotaAccountV1[]}`；按 reservation ID UTF-8 bytewise排序且 unique，usage必须由完整 set重算；account只保存当前 transition的 cycle-free ordinal/nonce/migration/reservation/type anchor，禁止反向 pin当前 event ID/content digest |
| `provider-migration-history-quota-high-water-v1` | 完整 strict `ProviderMigrationHistoryQuotaHighWaterV1`，排除 `quotaStateVersionToken`；event/receipt/account complete-set pins、usage、control bytes与escrow全部进入 digest |
| `provider-migration-history-quota-operation-request-v1` | 完整 strict `ProviderMigrationHistoryQuotaOperationRequestV1`；包含 operation discriminant、nonce、expected reservation/account state、Plan/proof/counterpart pins，三个 compare-reserve branch都携带完整 candidate Plan，不含 durable outcome |
| `provider-migration-history-quota-operation-receipt-v1` | 完整 strict `ProviderMigrationHistoryQuotaOperationReceiptV1`，排除 `receiptToken`；operation/kind-correlated durable request projection、两个 cross reserve与 destination cancel的 candidate Plan digest、retained release的 published Plan digest、原始 committed/not-committed outcome与一次性 `resolvedAt`全部进入 Envelope content digest |
| `provider-migration-history-artifact-set-v1` | 完整 strict `ProviderMigrationHistoryArtifactSetProjectionV1`；entries按 `{artifactKind,UTF8(JCS(artifact))}` bytewise排序、ordinal exact `0..N-1`且 locator/content digest strict unique，`source_universe↔side=source`、`destination_universe↔side=destination`，canonical/provider-allocated bytes逐项进入 set digest |
| `provider-migration-history-store-cut-set-v1` | `{entries:ProviderMigrationHistoryStoreCutEntryV1[]}`；按 `{repositoryId,worktreeId}` UTF-8 bytewise排序且unique，每项 current Store Manifest pin进入 digest |
| `provider-migration-history-audit-root-cut-set-v1` | `{entries:ProviderMigrationHistoryAuditRootCutEntryV1[]}`；按 `{auditRootKind,rootContentDigest}`排序且unique，version token进入 digest |
| `provider-migration-history-reference-set-v1` | `{migrationId,category,entries:ProviderMigrationHistoryReferenceEntryV1[]}`；按 category-specific完整 strict tuple排序且unique，zero proof只能使用 count 0的 versioned empty golden |
| `provider-migration-history-accounting-proof-v1` | 完整 strict `ProviderMigrationHistoryAccountingProofV1`，排除 `proofToken`；fixed migration namespace complete enumeration的 count/set/actual usage进入 digest |
| `provider-migration-history-zero-reference-proof-v1` | 完整 strict `ProviderMigrationHistoryZeroReferenceProofV1`，排除 `proofToken`；Acceptance high-water、完整 Store/audit cut sets、三类 typed complete reference enumeration与 active-executor empty set进入 digest |
| `provider-migration-history-deletion-receipt-v1` | 完整 strict `ProviderMigrationHistoryDeletionReceiptV1`，排除 `deletionToken`；exact delete count/set/logical/provider-allocated bytes与 postcondition进入 digest |
| `provider-migration-live-root-set-v1` | `{entries:ProviderMigrationLiveReferenceRootEntryV1[]}`；按 `rootOrdinal`升序，ordinal必须 exact `0..N-1`，重复 root ordinal或 canonical root bytes拒绝 |
| `provider-migration-live-object-set-v1` | `{entries:ProviderMigrationLiveObjectEntryV1[]}`；按 `objectOrdinal`升序，ordinal必须 exact `0..N-1`，重复 semantic locator/binding拒绝 |
| `provider-migration-live-reference-set-v1` | `{entries:ProviderMigrationLiveReferenceEdgeV1[]}`；按 `{from.sourceKind,from ordinal,referenceSlot,toObjectOrdinal}` UTF-8 bytewise/number升序并 strict unique |
| `provider-migration-object-receipt-prefix-set-v1` | `{migrationId,sourceUniverseId,entries:ProviderMigrationObjectReceiptSetEntryV1[]}`；允许 canonical empty `entries=[]`；非空时按 `sourceObjectOrdinal`升序且 ordinal 必须 exact `0..entries.length-1`，每 ordinal 恰一 committed receipt。每个 progress record 的 `receiptCount == migratedObjectCount == entries.length`，`receiptPrefixSetDigest/canonicalReceiptPrefixSetBytes`只按本 domain 的 exact canonical bytes重算 |
| `provider-migration-object-receipt-set-v1` | `{migrationId,sourceUniverseId,entries:ProviderMigrationObjectReceiptSetEntryV1[]}`；仅用于 complete closure，按 `sourceObjectOrdinal`升序、exact `0..sourceUniverse.objectCount-1`，`entries.length == sourceUniverse.objectCount`且每 ordinal恰一 committed receipt；禁止拿本 domain 表示 partial prefix |
| `provider-migration-retained-physical-source-object-set-v1` | `{migrationId,sourceUniverseId,entries:ProviderMigrationRetainedPhysicalSourceObjectEntryV1[]}`；按 `sourceObjectOrdinal`升序并 strict unique，entry必须由 source universe exact重建 |
| `provider-migration-progress-record-set-v1` | `{migrationId,entries:ProviderMigrationProgressEnumerationEntryV1[]}`；按 `recordOrdinal`升序、exact `0..N-1`、predecessor逐项 exact，排除 `recordSetDigest`避免自引用 |
| `provider-migration-progress-phase-payload-v1` | `{migrationId,recordOrdinal,phase,payload}`；`payload`是对应 strict phase branch排除 `recordId/phasePayloadContentDigest/createdAt`后的完整 projection |
| `provider-migration-live-object-locator-v1` | 完整 strict `ProviderMigrationLiveObjectLocatorV1`；Store locator与 provider-isolated receipt-ledger locator按 `namespace` strict区分，后者完整绑定 provider/repository/worktree/operation nonce |
| `provider-migration-live-reference-universe-v1` | 完整 strict `ProviderMigrationLiveReferenceUniverseV1`，排除 `universeToken`；root/object/reference complete set与 freeze token进入 digest |
| `provider-migration-canonical-reference-rewrite-object-mapping-set-v1` | `{migrationId,sourceUniverseId,entries:ProviderMigrationCanonicalReferenceRewriteObjectMappingV1[]}`；按 `objectMappingOrdinal`升序且 exact `0..sourceUniverse.objectCount-1`，每项 source ordinal同序、source objects exact-cover universe object set，destination ordinal exact同序且 locator/semantic digest unique |
| `provider-migration-canonical-reference-slot-mapping-set-v1` | `{migrationId,sourceUniverseId,entries:ProviderMigrationCanonicalReferenceSlotMappingV1[]}`；按 `mappingOrdinal`升序且 exact `0..sourceUniverse.referenceCount-1`，每项 source edge byte-identical对应 source universe同序 comparator结果，全部 reference slot exact-cover且 destination target ordinal/locator由 object mapping唯一导出 |
| `provider-migration-canonical-source-object-reference-mapping-set-v1` | `{migrationId,sourceUniverseId,sourceObjectOrdinal,entries:ProviderMigrationCanonicalReferenceSlotMappingV1[]}`；entries只取全局 mapping中 `from.sourceKind="object"`且 ordinal相等的完整子集，按全局 `mappingOrdinal`升序 unique，允许 versioned canonical empty |
| `provider-migration-canonical-reference-rewrite-scc-set-v1` | `{migrationId,sourceUniverseId,entries:ProviderMigrationCanonicalReferenceRewriteSccV1[]}`；SCC按冻结 reverse-condensation topological order编号，members/outgoing ordinals升序 unique，members exact-partition全部 source object ordinals |
| `provider-migration-canonical-reference-rewrite-plan-v1` | 完整 strict `ProviderMigrationCanonicalReferenceRewritePlanV1`，排除 `rewritePlanToken/destinationProviderSignature`；ID、三个 ordered set digest/count/bytes与 source freeze pin均已重算 |
| `provider-migration-canonical-reference-rewrite-plan-size-v1` | 完整 strict Plan projection，排除 `canonicalRewritePlanBytes/rewritePlanToken/destinationProviderSignature`；byte count只等于 `UTF8(JCS([domainLiteral,projection])).byteLength` |
| `provider-migration-non-reference-canonical-bytes-v1` | `{objectKind,canonicalObjectWithEveryMappedReferenceReplacedBy:["provider-migration-reference-slot-sentinel-v1",referenceSlot]}`；只允许在 strict schema已定位的 exact slots替换，保留所有其余 canonical JSON bytes与 key/array order，用于 source/destination non-reference equality |
| `provider-migration-rewritten-reference-set-v1` | `{migrationId,rewritePlanId,sourceObjectOrdinal,entries:ProviderMigrationRewrittenReferenceProofEntryV1[]}`；按 `mappingOrdinal`升序、strict unique，并 exact-cover Rewrite Plan中 `from.sourceKind="object"`且该 source ordinal的 mapping子集 |
| `provider-migration-semantic-equivalence-proof-v1` | 完整 strict `ProviderMigrationSemanticEquivalenceProofV1`，排除 `proofToken/destinationProviderSignature`；ID、source/destination/non-reference/rewrite-set digests与 typed empty failure sets均已重算 |
| `provider-migration-semantic-equivalence-proof-size-v1` | 完整 strict Semantic Proof projection，排除 `canonicalProofBytes/proofToken/destinationProviderSignature`；byte count只等于 `UTF8(JCS([domainLiteral,projection])).byteLength` |
| `provider-migration-semantic-equivalence-proof-set-v1` | `{migrationId,rewritePlanId,sourceUniverseId,entries:ProviderMigrationSemanticEquivalenceProofSetEntryV1[]}`；只收 canonical rewrite receipts所 pin proofs，按 source object ordinal升序且unique，并 exact-cover全部 rewrite object ordinals |
| `provider-migration-rewritten-root-reference-set-v1` | `{migrationId,rewritePlanId,rootOrdinal,entries:ProviderMigrationRewrittenReferenceProofEntryV1[]}`；按 mapping ordinal排序 unique并 exact-cover Plan中对应 `from.sourceKind="root"`子集，允许 canonical empty |
| `provider-migration-root-non-reference-canonical-bytes-v1` | `{rootKind,canonicalRootWithEveryMappedReferenceReplacedBy:["provider-migration-reference-slot-sentinel-v1",referenceSlot]}`；root无 reference时仍 canonicalize完整 strict root |
| `provider-migration-canonical-root-rewrite-proof-set-v1` | `{migrationId,rewritePlan,sourceUniverse,destinationUniverse,entries:ProviderMigrationCanonicalRootRewriteProofEntryV1[]}`；ordinal exact-cover两侧全部 roots，逐根 kind相等、root mapping exact-cover、non-reference digest相等且 failure sets为空 |
| `provider-migration-object-receipt-v1` | 完整 strict `ProviderMigrationObjectReceiptV1`，排除 `receiptToken`；source/destination/publish evidence exact闭合；rewrite receipt单向 pin plan+proof，plan/proof均不得引用 receipt |
| `provider-migration-zero-live-reference-proof-v1` | 完整 strict `ProviderMigrationZeroLiveReferenceProofV1`，排除 `proofToken`；empty failure sets与 retained physical garbage accounting进入 digest |
| `provider-migration-zero-live-reference-proof-size-v1` | 完整 strict Zero-live Proof projection，排除 `canonicalProofBytes/proofToken`；byte count只等于 `UTF8(JCS([domainLiteral,projection])).byteLength` |
| `provider-migration-source-tombstone-v1` | 完整 strict `ProviderMigrationSourceTombstoneV1`，排除 `destinationRootSignature`；same/cross identity strict union |
| `provider-migration-progress-record-v1` | 完整 strict `ProviderMigrationProgressRecordV1`；record ID自身先重算，content digest不含 Envelope |
| `provider-migration-progress-enumeration-v1` | 完整 strict `ProviderMigrationProgressEnumerationV1`；完整有序 entries、count/set digest进入 digest |
| `provider-migration-progress-head-v1` | 完整 strict `ProviderMigrationProgressHeadV1`；open/sealed strict union、complete set pin与 sealed closure进入 digest |
| `provider-migration-progress-operation-request-v1` | 完整 strict `ProviderMigrationProgressOperationRequestV1`；只含 `operation` discriminant与对应 compare-append/seal request，包含 `operationNonce`，排除 durable outcome |
| `provider-migration-strong-ready-core-v1` | 完整 strict `ProviderMigrationStrongReadyCoreV1`；不含 final Acceptance generation，避免与 sealed head成环 |
| `store-provider-atomic-publish-durable-request-v1` | 完整 strict `StoreProviderAtomicPublishDurableRequestProjectionV1`；只含 durable binding/path/policy/nonce/operation claims，不含 transient broker epoch/handle nonce |
| `store-provider-operation-receipt-claims-v1` | 完整 strict `StoreProviderOperationReceiptClaimsV1`；request projection、outcome discriminant、strict failure/final binding/proof optionality按 union固定 |
| `store-provider-atomic-publish-committed-evidence-v1` | 完整 strict `StoreProviderAtomicPublishCommittedEvidenceV1`；request/final binding与收窄到 atomic-publish committed的 receipt/proof signed Envelopes逐字段闭合 |
| `store-manifest-compare-append-request-v1` | 完整 strict `StoreManifestCompareAppendRequestV1`；包含 `operationNonce`、repository/worktree、expected完整 head/set claims、candidate Envelope与 atomic-publish durable request，不排除任何字段 |
| `store-manifest-compare-append-receipt-v1` | 完整 strict `StoreManifestCompareAppendReceiptV1`；包含无 transient authority 的完整 request、原始 durable outcome、一次性 `resolvedAt`与可按 historical operation-receipt key重验的 signed envelope |
| `store-manifest-generation-set-v1` | 完整 strict `StoreManifestNamespaceEnumerationV1.entries`；chain order稳定、generation ID strict unique，包含每代 predecessor与 publication pin |
| `store-manifest-namespace-head-v1` | 完整 strict `StoreManifestNamespaceHeadV1`；unique tip、generation count/set digest、expected predecessor与 namespace revision进入 digest |
| `artifact-manifest-payload-v1` | 完整 strict `ArtifactManifestV1`；generation的 `manifestContentDigest`必须 exact-equal该 digest |
| `artifact-manifest-generation-v1` | 完整 strict `ArtifactManifestGenerationV1`；ID已按 stable preimage重算，Envelope提供 content digest |
| `store-provider-compare-delete-request-content-v1` | 完整 strict `StoreProviderCompareDeleteDurableRequestV1`；`requestToken`已先重算 |
| `store-provider-compare-delete-progress-v1` | 完整 strict `StoreProviderCompareDeleteProgressV1`；planned/resolved outcome union与 durable request token已重算 |
| `store-provider-compare-delete-record-v1` | 完整 strict `StoreProviderCompareDeleteRecordV1`；payload ID按 stable preimage重算，content digest由 Envelope提供 |
| `store-provider-journal-enumeration-v1` | 完整 strict `StoreProviderJournalEnumerationV1`；records按 record ID UTF-8 bytewise排序且unique，每项 pin exact record content digest与provider binding |
| `store-initialization-terminal-sizing-skeleton-v1` | 完整 strict `StoreInitializationTerminalSizingSkeletonV1`；由 revision-0前 zero-side-effect full dry-run生成，future Bundle shape与各 phase count/byte upper bound已冻结 |
| `store-initialization-terminal-state-budget-v1` | 完整 `StoreInitializationTerminalStateBudgetV1`；按固定 Schema/attempt/history caps在首次 Store副作用前计算，四个 worst-case值与 handoff record count都必须不大于各自 cap |
| `private-store-quota-universe-v1` | `{committedBlobs,committedMetadata,reservationMembership,activeBlobEntitlements,activeMetadataPlans,activeTempPlans,controlState}` 的 exact accounting projections |
| `private-store-quota-delta-v1` | `{version,operations}`；operation 按 category/key 排序且每 key 唯一 |
| `private-store-quota-entitlement-owners-v1` | `{privateBlobId,reservationIds}` |
| `private-store-quota-empty-category-v1` | `{category}`；七类各有一个 versioned golden constant |
| `private-store-quota-index-leaf-v1` | 完整 strict `PrivateStoreQuotaIndexLeafV1`；active plan 含 transaction/state，membership 含 transaction/blob，entitlement 含 owners digest；不含 payload/content/root digest |
| `private-store-quota-index-node-v1` | 完整 strict `PrivateStoreQuotaIndexNodeV1`；level-0 leaf page 内嵌 leaf+leafDigest，branch child 含 exact range/count/bytes/digest |
| `private-store-quota-universe-root-v1` | `{treeLayoutVersion,policyDigest,committedBlobs,committedMetadata,reservationMembership,activeBlobEntitlements,activeMetadataPlans,activeTempPlans,controlState,activeTransactionCount}` |
| `private-store-quota-index-root-v1` | `{profile,treeLayoutVersion,policyDigest,committedBlobs,committedMetadata,reservationMembership,activeBlobEntitlements,activeMetadataPlans,activeTempPlans,controlState,activeTransactionCount,universeRootDigest}` |
| `private-store-quota-manifest-pin-v1` | 完整 `PrivateStoreQuotaManifestPinV1`；current root、transition-chain head、absent/generation Artifact Manifest pin与可选 terminal head属于同一 immutable generation |
| `private-store-quota-transition-record-v1` | 完整 strict `PrivateStoreQuotaTransitionRecordV1`；先按 stable-ID domain重算 `id`，再覆盖 previous state/pin、pre/post root、完整 delta及 digest、可选 compare-delete pins与 `createdAt`，不排除任何 payload字段 |
| `private-store-quota-admission-record-v1` | 完整 strict `PrivateStoreQuotaAdmissionRecordV1`；先按 stable-ID domain重算 `id`，再覆盖 exact commit Transition ID/content digest、完整 accepted/rejected集合与 `createdAt`，不排除任何 payload字段 |
| `store-manifest-generation-v1` | 完整 `StoreManifestGenerationV1`；ID/content digest 自身由 Envelope 提供，不在 payload 内自引用 |
| `store-terminalization-handoff-record-v1` | 完整 `StoreIdentityTerminalizationHandoffRecordV1`；payload `id`先按 stable-ID preimage重算并进入 payload/content digest，但 stable-ID preimage排除自身 ID；只有 content digest由 Envelope提供且不在 payload内自引用 |
| `store-bootstrap-write-set-pre-seal-v1` | 完整 write-set skeleton，排除 `preSealBindingDigest/writeSetDigest/planToken/sealedCanonicalBytes/sealAadDigest`，但保留 sealing profile、nonce、plaintext length/check token与所有 path/precondition/directory plan |
| `store-bootstrap-write-set-v1` | 完整 `StoreBootstrapWriteSetPlanV1`，排除 `writeSetDigest/planToken`；包含已重算的 `preSealBindingDigest`、ciphertext与 AAD digest |
| `store-bootstrap-binding-context-v1` | `{transactionNonce,repositoryId,worktreeId,phase,policyDigest?,preQuotaRoot?,postQuotaRoot?,preTransitionHead?,postTransitionHead?,preManifestDigest?,postManifestDigest?}` |
| `store-ownership-initialization-intent-v1` | 完整 strict `StoreOwnershipInitializationIntentV1`，包含 phase、origin、全部 plan/progress/proof 与 sorted/unique quarantine entries；无字段排除、无 parse-time default |
| `store-ownership-initialization-intent-envelope-v1` | 完整 strict `StoreOwnershipInitializationIntentEnvelopeV1`，排除 `contentDigest/providerVersionToken`；payload digest、predecessor与 mutation ID已重算 |
| `store-bootstrap-secret-recovery-salt-v1` | `{installationIdentityGenerationId,transactionNonce}` |
| `store-bootstrap-secret-recovery-aad-v1` | `{transactionNonce,repositoryId,worktreeId,role,stagingBase,stagingProviderId,stagingProviderPolicyDigest,finalPath,preSealBindingDigest,bindingContextDigest}`；不含 final `writeSetDigest`，也不绑定可重试的 provider staging locator |
| `store-bootstrap-quarantine-ledger-v1` | 完整 `StoreBootstrapQuarantineLedgerV1`；entries 按 path/attempt 排序且 unique |
| `store-bootstrap-quarantine-ledger-plan-v1` | 完整 strict `StoreBootstrapQuarantineLedgerPlanV1` |
| `store-bootstrap-write-progress-v1` | 完整 strict `StoreBootstrapWriteSetProgressV1` |
| `store-identity-terminalization-progress-delta-v1` | 完整 strict `StoreIdentityTerminalizationProgressDeltaV1`；before/result progress digest、target与 before/after attempt全部进入 digest |
| `store-bootstrap-quarantine-entry-set-v1` | `{entries}`；与 intent 的 sorted/unique authenticated entries exact-equal |
| `store-bootstrap-quarantine-generation-pin-v1` | 完整 strict `StoreBootstrapQuarantineGenerationPinV1` |
| `store-bootstrap-quarantine-generation-history-v1` | `{transactionNonce,sourceInitializationIntentContentDigest,generationPins}`；零代使用 versioned empty-history golden constant |
| `store-initialization-terminal-receipt-v1` | 完整 strict `StoreInitializationTerminalReceiptV1`；`terminalReceiptToken`已先重算，receipt本身不含 content digest |
| `store-identity-terminalization-plan-v1` | 完整 strict `StoreIdentityTerminalizationPlanV1`；其中 receipt pin与 write-set digest/token已重算 |
| `store-identity-terminalization-proof-v1` | 完整 strict `StoreIdentityTerminalizationProofV1`；只有 terminalization Transition、post root、post Manifest generation与 terminal head全链验证后才可计算 |
| `path-safe-repository-change-v1` | `{path,oldPath?,source,kind,contentDigest?,previousContentDigest?}` |
| `repository-snapshot-path-safe-v1` | `{schemaVersion,profile,repositoryId,worktreeId,rootIdentity,branchState,objectFormat,headState,baseCommit?,mergeBase?,repositoryStateToken,indexToken,worktreeToken,untrackedToken,ignoreToken,securityScanPolicyDigest,safeGitExecutionDigest,captureStatus,accounting,changes,redactedChanges,unknownStates,createdAt}` |
| `repository-snapshot-semantic-equality-v1` | 与 `repository-snapshot-path-safe-v1` 相同但排除 `snapshotId/createdAt` |
| `task-baseline-semantic-v1` | `{taskId,repositoryId,worktreeId,captureSnapshotId,baselineHead:TaskBaselineHeadSemanticV1,repositoryStateToken,attributesDigest,scannerPolicyDigest,repositoryPolicyDigest,safeGitExecutionDigest,baselineMaterializationBudgetDigest,privateStoreQuotaPolicyDigest,captureStatus,paths,redactedUnits,boundaries}`；quota commit proof 不进入 baseline identity/payload |
| `context-build-spec-v1` | `{version,scope,tokenBudget,maxCandidates,maxImpactDepth,baseRef?}` |
| `context-generation-input-v1` | 完整 `ContextGenerationInputV1` |
| `confirmed-obligation-set-v1` | `{contextGenerationId,obligations: ConfirmedObligationProjectionV1[]}` |
| `planned-change-intent-v1` | `{intent}` |
| `verification-plan-set-v1` | `{contextGenerationId,entries: VerificationPlanProjectionV1[]}` |
| `repository-content-state-v1` | `{side,state: RepositoryContentStateV1}` |
| `repository-head-state-v1` | `{objectFormat,headState,baseCommit?,mergeBase?}` |
| `impact-path-semantic-v1` | `{impactPathId,sourceNodeId,targetNodeId,classification,claimIds,steps,truncatedAt?}` |
| `task-projection-descriptor-v1` | `{artifactType,artifactId,contentDigest,sourceSnapshotId,taskRevision,rootRelativePath}` |
| `task-projection-dependency-closure-v1` | `{rootArtifactIds,descriptorDigests,dependencyEdges}` |
| `sensitive-request-scan-policy-v1` | `{version,scannerRulesetDigest,maxNormalizedInputBytes,maxPublicTextBytes,maxCommandArgumentCount,maxCommandExecutableBytes,maxCommandArgumentBytes,maxCommandTotalBytes,maxSummaryBytes,maxRawOutputBytes,maxClaimIds}` |
| `operation-safe-request-v1` | `{sensitiveRequestScanPolicyDigest,operation,action?,actor,expectedRevision,snapshotAssertions,safeInput}` |
| `verification-detail-semantic-v1` | `{command?,exitCode?,durationMs?,safeSummary?,outputDigest?,scannerPolicyDigest}`；排除 ID/link/time |
| `change-analysis-input-v1` | `ChangeAnalysisInputDigestFieldsV1` |
| `change-analysis-semantic-v1` | `ChangeAnalysisSemanticDigestFieldsV1` |

owner-only HMAC token 也使用唯一 `[domain, strictFields]` 容器，exact fields 为：

| HMAC domain literal | strict `fields` object |
|---|---|
| `repository-identity-v1` | `{canonicalCommonGitDir:CanonicalInternalBytesV1}` |
| `worktree-identity-v1` | `{repositoryId,canonicalRoot:CanonicalInternalBytesV1,canonicalGitDir:CanonicalInternalBytesV1}` |
| `root-identity-v1` | `{canonicalRoot:CanonicalInternalBytesV1}` |
| `index-token-v1` | `{objectFormat,entries:InternalIndexStateUnitV1[]}` |
| `worktree-token-v1` | `{entries:InternalFilesystemStateUnitV1[]}` |
| `untracked-token-v1` | `{entries:InternalFilesystemStateUnitV1[]}` |
| `ignore-token-v1` | `{units:InternalIgnoreStateUnitV1[],safeGitExecutionDigest}` |
| `repository-state-token-v1` | `{objectFormat,headState,branchState:InternalBranchStateV1,indexToken,worktreeToken,untrackedToken,ignoreToken}` |
| `repository-git-config-token-v1` | `{units:InternalGitConfigStateUnitV1[]}` |
| `worktree-git-config-token-v1` | `{units:InternalGitConfigStateUnitV1[]}` |
| `empty-hooks-directory-token-v1` | `{directoryIdentity:CanonicalFileIdentityV1,entries:InternalDirectoryEntryStateUnitV1[]}` |
| `safe-git-executable-binding-token-v1` | 完整 `InternalSafeGitExecutableBindingV1` |
| `safe-git-bootstrap-binding-token-v1` | 完整 `InternalSafeGitBootstrapBindingV1` |
| `safe-git-linked-worktree-binding-token-v1` | 完整 `InternalSafeGitLinkedWorktreeBindingV1` |
| `safe-git-object-database-layout-token-v1` | 完整 `InternalSafeGitObjectDatabaseLayoutV1` |
| `safe-git-ref-backend-layout-token-v1` | 完整 `InternalSafeGitRefBackendLayoutV1` |
| `redacted-content-equality-token-v1` | `{pathBytes,kind,rawContentBase64url:CanonicalByteStringV1}`；token 只嵌入内存 state unit |
| `verification-detail-commitment-v1` | `{taskId,contextGenerationId,snapshotId,verificationPlanEntryId,attempt,internalDetailSemanticDigest}`；不含 Record/detail ID |
| `installation-identity-key-check-v1` | `{generationId,initializationNonce}` |
| `installation-state-root-binding-v1` | `{resolverId,canonicalStateRootBytes,ownerIdentity,stateRootFileIdentity}` |
| `provider-acceptance-state-token-v1` | 完整 strict `ProviderAcceptanceStateV1`，排除 `acceptanceToken`；只由 immutable installation identity key签发 |
| `provider-acceptance-current-version-v1` | `{locatorProfile,installationIdentityGenerationId,highWaterRevision,highWaterContentDigest,currentAcceptance,generationCount,generationSetDigest}`；只由 immutable installation identity key签发，provider runtime不得持有该 key |
| `provider-acceptance-compare-append-receipt-token-v1` | 完整 strict `ProviderAcceptanceCompareAppendReceiptV1`，排除 `receiptToken`；只由 immutable installation identity key签发，同 nonce/different request必须拒绝 |
| `provider-migration-same-namespace-translation-token-v1` | `{translationContentDigest,sourceNamespace,destinationNamespace,relationship}`；由 source==destination==journal-authority Installation Identity key签发 |
| `provider-migration-cross-source-namespace-translation-token-v1` | `{translationContentDigest,sourceNamespace,destinationNamespace,relationship,sourceRecoveryOnlyAcceptance,destinationPrePlanAcceptance}`；由 source Installation Identity key签发 |
| `provider-migration-cross-destination-namespace-translation-token-v1` | 与上一行 exact同一 fields；由 destination Installation Identity key独立签发，两个 token不得复用 |
| `provider-migration-live-universe-token-v1` | 完整 strict `ProviderMigrationLiveReferenceUniverseV1`，排除 `universeToken`；由 plan固定的 journal-authority Installation Identity key签发 |
| `provider-migration-object-receipt-token-v1` | 完整 strict `ProviderMigrationObjectReceiptV1`，排除 `receiptToken`；issuer只能从 fixed-locator trusted Migration Plan的 `journalAuthorityInstallationIdentity`恢复（cross必须是 destination），同一 source object ordinal只允许一个 byte-identical committed receipt |
| `provider-migration-zero-live-proof-token-v1` | 完整 strict `ProviderMigrationZeroLiveReferenceProofV1`，排除 `proofToken`；issuer只能是 trusted Migration Plan的 journal-authority identity（cross必须是 destination），所有 failure/active sets必须显式为空 |
| `provider-migration-canonical-reference-rewrite-plan-token-v1` | 完整 strict `ProviderMigrationCanonicalReferenceRewritePlanV1`，排除 `rewritePlanToken/destinationProviderSignature`；由 Plan固定的 journal-authority（cross mode必须是 destination）Installation Identity key签发 |
| `provider-migration-semantic-equivalence-proof-token-v1` | 完整 strict `ProviderMigrationSemanticEquivalenceProofV1`，排除 `proofToken/destinationProviderSignature`；由同一 journal-authority Installation Identity key签发，proof不得包含 object receipt ID/pin/token |
| `provider-migration-progress-version-token-v1` | 完整 strict `ProviderMigrationProgressHeadV1`与 head content digest；issuer只能由 fixed-locator trusted Migration Plan选择且 head重复 authority必须 exact-equal；candidate record、complete enumeration、head advance与 operation receipt同事务提交 |
| `provider-migration-progress-operation-receipt-token-v1` | 完整 strict `ProviderMigrationProgressOperationReceiptV1`，排除 `receiptToken`；issuer只能由 fixed-locator trusted Migration Plan选择（cross必须是 destination），append/seal同 nonce跨 restart返回 byte-identical outcome |
| `provider-migration-history-quota-reservation-token-v1` | 完整 strict reservation record（包括单向 `candidatePlanContentDigest`）或 embedded cancellation-fence payload，分别排除 `reservationToken/cancellationToken`；issuer只能由该 ledger的 immutable Installation Identity决定 |
| `provider-migration-history-quota-event-token-v1` | 完整 strict `ProviderMigrationHistoryQuotaEventV1`，排除 `eventToken`；issuer只能由 event `installationIdentity` fixed ledger决定 |
| `provider-migration-history-quota-current-version-v1` | 完整 strict `ProviderMigrationHistoryQuotaHighWaterV1`加 outer high-water `contentDigest`，排除 `quotaStateVersionToken`；token只认证已原子提交的 current revision |
| `provider-migration-history-quota-operation-receipt-token-v1` | 完整 strict `ProviderMigrationHistoryQuotaOperationReceiptV1`，排除 `receiptToken`；同 nonce/same request byte-identical replay，同 nonce/different request拒绝 |
| `provider-migration-history-accounting-proof-token-v1` | 完整 strict `ProviderMigrationHistoryAccountingProofV1`，排除 `proofToken` |
| `provider-migration-history-zero-reference-proof-token-v1` | 完整 strict `ProviderMigrationHistoryZeroReferenceProofV1`，排除 `proofToken` |
| `provider-migration-history-deletion-receipt-token-v1` | 完整 strict `ProviderMigrationHistoryDeletionReceiptV1`，排除 `deletionToken` |
| `store-ownership-proof-v1` | 完整 `StoreOwnershipMarkerV1`，排除 `ownershipProof` |
| `store-initialization-preflight-token-v1` | 完整 `InternalStoreInitializationPreflightV1` |
| `store-provider-compare-delete-request-v1` | 完整 strict `StoreProviderCompareDeleteDurableRequestV1`，排除 `requestToken`；包含 exact root/parent/ancestor/target binding、target name与 authorization read-set |
| `store-provider-compare-delete-record-token-v1` | 完整 strict `StoreProviderCompareDeleteRecordV1`，排除 `recordToken`；resolved必须 exact pin planned predecessor与 byte-identical request |
| `store-bootstrap-write-set-plan-token-v1` | 完整 `StoreBootstrapWriteSetPlanV1`，排除 `planToken`，且 `writeSetDigest/bindingContextDigest` 已重算 |
| `store-bootstrap-quarantine-entry-token-v1` | 完整 `StoreBootstrapQuarantineEntryV1`，排除 `entryToken` |
| `store-bootstrap-quarantine-ledger-token-v1` | 完整 `StoreBootstrapQuarantineLedgerV1`，排除 `ledgerToken`；每个 entry token 已重算 |
| `store-bootstrap-source-intent-attestation-v1` | `{installationIdentityGenerationId,repositoryId,worktreeId,storeRootBinding,transactionNonce,phase:"binding_activated",sourceInitializationIntentContentDigest}` |
| `store-bootstrap-terminal-receipt-token-v1` | 完整 strict `StoreInitializationTerminalReceiptV1`，排除 `terminalReceiptToken`；source intent、generation pin/history 与 ledger proof 已重算；receipt只保存一次 source preimage，不重复 outer activated fields |
| `store-terminalization-handoff-record-token-v1` | 完整 strict `StoreIdentityTerminalizationHandoffRecordV1`，排除 `handoffToken`；genesis保存完整 plan/current progress，successor只保存可重放的单步 delta与可选 proof |
| `store-initialization-terminal-head-token-v1` | 完整 `StoreInitializationTerminalHeadPinV1`，排除 `terminalHeadToken` |
| `worktree-security-equality-key-check-v1` | `{transactionNonce,repositoryId,worktreeId,keyBytes:CanonicalByteStringV1}`；仅存 installation-keyed token，不保存 `keyBytes` |
| `operation-full-request-equality-v1` | `{sensitiveRequestScanPolicyDigest,input:NormalizedOperationInputForEqualityV1}`；排除 idempotency key |

`store-terminalization-attempt-nonce-v1`与
`store-terminalization-attempt-staging-locator-v1`也使用 owner-only HMAC，
exact fields均为
`{installationIdentityGenerationId,repositoryId,worktreeId,transactionNonce,
terminalizationWriteSetDigest,targetKind,targetOrdinal,attemptOrdinal}`；
`targetKind`仅 `"directory"|"write"`。两者不用完整
`KeyedStateTokenV1` wire，而是分别取 HMAC-SHA-256输出的前32个 lowercase hex，
前者作为 `attemptNonce`，后者作为 `provider-staging:<hex32>` body；domain不同
保证相同 fields不会产生相同 bytes。

上述 migration-history quota HMAC的 issuer不得从 caller、request、Plan内重复字段
或 counterpart receipt选择。same mode只能取共同 Identity；cross source ledger只能取
source Identity，cross destination/journal ledger只能取 destination Identity。读取者必须
先以 ledger所在 immutable Installation Identity固定密钥与 policy重算 token，再接受
任何 Plan或对侧 receipt交叉引用。

provider-private binding/HMAC **不属于** owner-only HMAC表，使用 provider隔离域
内独立密钥与 `JCS([domainLiteral,strictFields])` exact UTF-8 bytes。所有
provider/root/QA/Release Ed25519 proof/version绝不使用该 shape：

所有 Ed25519 canonical message都先包一层不可省略的 signer identity，并且唯一
合法 message shape 是 strict 二元 tuple
`[domainLiteral, signerWrapper]` 经 `rfc8785-jcs-safe-integer-v1`得到的 exact UTF-8
bytes：

- provider proof/version：
  `{providerId,usage,keyId,claims}`，其中 usage只能是
  `operation_receipt/containment_proof/state_version/journal_version/migration_semantic_proof`；
- registry-root签名：`{rootKeyId,domain,claims}`；
- Feasibility批准：`{role,keyId,claims}`。

registry-root wrapper内的 `domain`必须 exact-equal tuple第一项
`domainLiteral`。provider/approver wrapper不增加第二个 domain字段，但同样必须由
tuple第一项完成 domain separation。任何实现只签 `signerWrapper`、只签 `claims`、
签 `[domainLiteral,claims]`，或把 root wrapper中的 `domain`改成另一字面量，即使
raw signature可由同一 key验证也必须拒绝。
wire prefix中的 key ID必须与 signed wrapper的 key ID exact-equal；任何只改
prefix、provider、usage或 role的签名都无效。

| provider domain literal | primitive / key usage / strict `fields` object |
|---|---|
| `store-durable-object-binding-v1` | provider-private binding-derivation key generation上的 HMAC-SHA-256；wire保存 `{authority:"generation_aware_provider",providerId,providerPolicyDigest,bindingDerivationKeyGeneration,observedIdentity,persistedRecoveryAuthority:"provider_revalidation"}`；provider在当前 no-follow opened object上重算未序列化的 `{filesystemInstanceBytes,providerObjectGenerationBytes}`，共同派生 `durableBindingToken`。token本身不授权 I/O，每次使用还要 online revalidation及下列已签名 receipt/proof |
| `store-provider-atomic-containment-proof-v1` | Ed25519 / `containment_proof` wrapper；claims=`{operationNonce,providerPolicyDigest,operation,boundRootBinding,destinationParentBinding,destinationParent,stagingOrTargetBinding,finalOrTargetName,outcome:"committed",finalBinding?}`；只投影 transient authority中的 durable binding，不含 raw handle/epoch/nonce |
| `store-provider-operation-receipt-v1` | Ed25519 / `operation_receipt` wrapper；claims为完整 strict `StoreProviderOperationReceiptClaimsV1`；同 operation nonce跨 restart只能返回 byte-identical durable committed或not_committed result，禁止 unknown |
| `provider-migration-canonical-reference-rewrite-plan-signature-v1` | destination provider Ed25519 / `migration_semantic_proof` wrapper；claims为完整 strict `ProviderMigrationCanonicalReferenceRewritePlanV1`并排除 `destinationProviderSignature`，因此覆盖已重算的 owner-HMAC `rewritePlanToken`；provider/key必须 exact-equal Plan destination writer及其 historical verification-key record |
| `provider-migration-semantic-equivalence-proof-signature-v1` | destination provider Ed25519 / `migration_semantic_proof` wrapper；claims为完整 strict `ProviderMigrationSemanticEquivalenceProofV1`并排除 `destinationProviderSignature`，因此覆盖已重算的 owner-HMAC `proofToken`、source/destination content digest、non-reference equality、rewritten set与 typed empty failures |
| `store-provider-runtime-attestation-signature-v1` | Acceptance选择、且 Root Metadata chain闭合到 immutable installation bootstrap/recovery trust的 active registry-root Ed25519；完整 strict `StoreDurableObjectProviderRuntimeAttestationV1`，排除 `registrySignature`；认证 exact semantic policy、binary/IPC/platform/real-FS evidence与 attestation generation |
| `store-durable-object-provider-verification-public-key-signature-v1` | 同一 verified active registry-root Ed25519；完整 strict `StoreDurableObjectProviderVerificationPublicKeyV1`，排除 `registrySignature` |
| `store-durable-object-provider-binding-derivation-generation-signature-v1` | 同一 verified active registry-root Ed25519；完整 strict `StoreDurableObjectProviderBindingDerivationGenerationV1`，排除 `registrySignature`；只认证 generation/commitment，不导出 provider secret |
| `provider-feasibility-approver-public-key-signature-v1` | 同一 verified active registry-root Ed25519；完整 strict `ProviderFeasibilityApproverPublicKeyV1`，排除 `registrySignature`；role/key ID/public bytes/digest进入签名 |
| `store-durable-object-provider-registry-entry-signature-v1` | 同一 verified active registry-root Ed25519；完整 strict `StoreDurableObjectProviderRegistryEntryV1`，排除 `registrySignature`；runtime attestation、verification-key history、revocation set与 semantic policy digest已重算 |
| `provider-feasibility-evidence-qa-signature-v1` | registry-root签名的 exact role=`qa` approver key；wrapper固定 `{role:"qa",keyId,claims}`，claims为完整 strict `ProviderFeasibilityEvidenceV1`并排除 `qaSignature/releaseSignature` |
| `provider-feasibility-evidence-release-signature-v1` | exact role=`release` approver key；wrapper固定 `{role:"release",keyId,claims}`，与上一行相同 claims；不得复用 QA key |
| `provider-feasibility-support-catalog-signature-v1` | 同一 verified active registry-root Ed25519；完整 strict `ProviderFeasibilitySupportCatalogV1`，排除 `catalogSignature`；签名覆盖 generation、predecessor、完整 approval-key history/revocations及 owner-only Evidence pins |
| `provider-public-support-taxonomy-signature-v1` | 同一 verified active registry-root Ed25519；完整 strict `ProviderPublicSupportTaxonomyV1`，排除 `taxonomySignature`；签名覆盖 generation/predecessor、全部 public descriptor/code records及固定 derivation policy |
| `provider-release-matrix-signature-v1` | 同一 verified active registry-root Ed25519且使用独立 domain；完整 strict `ProviderReleaseMatrixV1`，排除 `matrixSignature`；签名覆盖 generation/predecessor、root/taxonomy pin与完整发行 target set |
| `provider-real-fs-fixture-corpus-manifest-signature-v1` | 同一 verified active registry-root Ed25519且使用独立 domain；完整 strict `ProviderRealFilesystemFixtureCorpusManifestV1`，排除 `corpusSignature`；签名覆盖 exact distribution binding/release cut、semantic corpus digest与全部 fixture program bytes |
| `provider-real-fs-suite-manifest-signature-v1` | 同一 verified active registry-root Ed25519且使用独立 domain；完整 strict `ProviderRealFilesystemSuiteManifestV1`，排除 `suiteSignature`；签名覆盖 exact Corpus Pin、runner profile、全部 case/crash-cut定义与 semantic suite digest |
| `provider-target-discovery-input-bundle-signature-v1` | 与 Taxonomy/Matrix/Result相同的 supplied active registry-root Ed25519、使用独立 domain；完整 strict `ProviderTargetDiscoveryInputBundleV1`，排除 `bundleSignature`；签名覆盖 exact Matrix、含 Suite Pin的 fixture、runner/release cut及 complete observation universe |
| `provider-target-discovery-result-signature-v1` | 同一 verified active registry-root Ed25519且使用独立 domain；完整 strict `ProviderTargetDiscoveryResultV1`，排除 `discoverySignature`；签名覆盖 input bundle pin、ruleset/dimensions/sources、完整 discovered target set与全部 typed unresolved observations |
| `provider-release-target-universe-signature-v1` | 同一 verified active registry-root Ed25519且与 Catalog/两份 coverage input分开签名；完整 strict `ProviderReleaseTargetUniverseV1`，排除 `universeSignature`；签名覆盖 taxonomy/input pins、完整 coverage basis、target set、bucket exact-partition与 coverage state |
| `provider-registry-manifest-signature-v1` | active registry-root Ed25519 wrapper；claims为完整 strict `ProviderRegistryManifestV1`并排除 `manifestSignature` |
| `provider-registry-root-cross-signature-v1` | predecessor root Ed25519 wrapper；claims为新 `ProviderRegistryRootMetadataV1`无签名 projection |
| `provider-registry-root-self-signature-v1` | new root Ed25519 wrapper；同一无签名 claims，证明新 private key possession |
| `provider-registry-root-recovery-signature-v1` | distribution-pinned recovery key；wrapper `{recoveryKeyId,domain,claims}`，planned/compromise rollover都要求 exactly threshold个 distinct有效签名 |
| `provider-migration-source-tombstone-signature-v1` | cross-installation rebootstrap时由 destination active registry-root Ed25519签发；claims为完整 strict cross-identity `ProviderMigrationSourceTombstoneV1`并排除 `destinationRootSignature`，旧 compromised identity/recovery quorum不得参与 |
| `store-terminalization-handoff-sealed-version-v1` | Ed25519 / `journal_version`；完整 strict `StoreProviderJournalVersionClaimsV1` sealed variant；predecessor pin seal前 version token，enumeration digest/count不变，proof tip==unique tip，prospective token不含 external payload/envelope digest |
| `store-provider-journal-version-v1` | Ed25519 / `journal_version`；完整 strict `StoreProviderJournalVersionClaimsV1` open variant；genesis要求 ordinal=0/absent namespace，normal要求 predecessor token、ordinal+1、enumeration exact加一条 record且 unique tip更新 |
| `store-external-initialization-intent-version-token-v1` | Ed25519 / `state_version`；`{locatorProfile,repositoryId,worktreeId,transactionNonce,revision,mutationId,predecessor,payloadContentDigest,contentDigest}`；provider只对已原子提交的 current revision返回 current-valid token |
| `store-manifest-namespace-version-v1` | Ed25519 / `state_version`；完整 strict `StoreManifestNamespaceHeadV1`与 head content digest；provider只在 generation no-replace发布与 unique-head compare-append同一原子提交后签发 token |

所有 Ed25519 token 的 wire prefix都嵌入 exact signer key ID；signature 是上述
`JCS([domainLiteral, signerWrapper])` bytes上的 raw 64-byte signature
（128 lowercase hex），不能
先对另一 domain/provider/usage/role/key ID的 message签名后换 prefix。provider
verifier必须按
`(providerId, usage, keyId)`从 registry-root签名的 immutable historical key
record精确取回 public key，验证 decoded key恰为32 bytes、
`publicKeyDigest=SHA-256(raw 32 bytes)`、strict prime-subgroup admission、
digest与 usage一致、key未被 compromise-revoked，再按冻结 profile验证签名；
不能使用“当前 active key”代替 token所 pin 的 key。key ID必须按对应
`store-provider-verification-key-id-v1{providerId,usage,publicKeyBytes}`或
`provider-feasibility-approver-key-id-v1{role,publicKeyBytes}`重算；root与
recovery key ID也分别按 `provider-registry-root-key-id-v1` /
`provider-registry-recovery-key-id-v1`从 exact 32-byte material重算。
root/recovery signature wire prefix、wrapper中的
`rootKeyId/recoveryKeyId/domain`与所选 historical record必须逐字段
exact-equal。

单个 accepted trust closure内，bootstrap/current/historical root、三把 recovery、
全部 provider usage history与 approver role history的 public key material必须
全域 unique；同 material换 key ID、provider、usage、role或 root/recovery kind
注册均拒绝。已撤销 key不能通过替换 wire prefix或 public-key别名恢复有效；全部
provider usage key也不得交叉使用。binding token同时 pin
`bindingDerivationKeyGeneration`，provider必须按
`(providerId,generation)`重验 exact historical secret generation；普通 runtime
升级不得改变 generation。raw kernel/provider live handle、broker epoch/nonce
只存在于 `TransientStoreObjectAuthorityV1`，绝不持久化、记录、进入 error或
作为 recovery locator。

每个 Schema 必须是独立 `z.string().regex(...)` 后再 brand，不能把一个通用 regex
cast 成多个 ID。现有 legacy `EvidenceId/FindingId/VerificationRecordId` 的
opaque wire format 为保持 bytes 不变而保留；strong writer 只产生上述 strong
Finding/Verification/Evidence ID，Evidence ID 以 kind-specific domain 生成并
由 Bundle invariant 重算。Contracts golden vectors 必须按
`rfc8785-jcs-safe-integer-v1` 固定每个 domain 的 strict input、exact JCS UTF-8
bytes、完整 SHA-256、22-hex 输出、大小写/长度拒绝，并证明相同 payload 跨
domain 得到不同 ID；owner-HMAC 与 Ed25519 domain 还必须分别固定 test key/seed、
wrapper bytes 与完整 token/signature。TypeScript/provider conformance 必须消费同一
immutable golden/negative manifest，不能各自生成 expected bytes。

legacy Evidence 的 `nodeIds/producedBy` 与既有 Graph node bytes 仍按旧 Schema
lossless 读取；strong Evidence/SourceSymbol writer 只使用上表独立 brand，不做
Unicode/大小写/path normalization。`LanguageIdV1` 还必须存在于
ruleset-version pin 的 language registry，grammar 只负责 wire safety；
`ParserVersionV1` 必须精确标识 adapter+grammar version，不能写 `latest`。
新增 language/parser 需 ruleset version bump。Graph node ID 非稳定语义 ID，
不重新 hash；Bundle validator 在 pinned Graph artifact 中 exact lookup，找不到
时省略 optional mapping 或产生 Boundary，不能保存 dangling ID。

#### 3.8.1 Span、Boundary 与 Budget

```ts
type AnalysisStatusV1 = "complete" | "partial" | "unknown";

interface DiffLineSpanV1 {
  startLine: number; // integer；lineCount>0 时 >=1，lineCount=0 时 >=0
  lineCount: number; // integer >=0
}

interface SourcePointV1 {
  line: number;      // 1-based integer >=1
  column: number;    // 0-based UTF-8 byte column
  byteOffset: number;// 0-based byte offset
}

interface SourceSpanV1 {
  start: SourcePointV1;
  endExclusive: SourcePointV1;
}

type AnalysisBoundaryStageV1 =
  | "baseline_capture"
  | "repository_delta"
  | "content_domain"
  | "diff"
  | "parse"
  | "symbol_mapping"
  | "planned_matching"
  | "impact_analysis"
  | "verification_coverage"
  | "security_policy"
  | "integrity";

type AnalysisBoundaryCodeV1 =
  | "sensitive_path"
  | "secret_detected"
  | "binary_content"
  | "invalid_utf8"
  | "invalid_repository_metadata"
  | "unsafe_git_ref"
  | "unrepresentable_path"
  | "security_scan_unit_oversized"
  | "security_scan_capture_limit"
  | "unsupported_transform"
  | "sparse_checkout"
  | "conflict_without_final_bytes"
  | "special_file"
  | "symlink_boundary"
  | "unavailable_content"
  | "unstable_read"
  | "missing_git_object"
  | "unpinned_git_object"
  | "budget_exhausted"
  | "baseline_blob_budget_exhausted"
  | "private_store_blob_quota_exhausted"
  | "parser_unsupported"
  | "parser_error"
  | "ambiguous_symbol"
  | "ambiguous_lineage"
  | "graph_incomplete"
  | "dynamic_dependency"
  | "unsupported_verification_method"
  | "ambiguous_verification_coverage"
  | "policy_error"
  | "artifact_integrity_error";

type AnalysisBoundaryScopeV1 =
  | { kind: "repository" }
  | { kind: "path"; path: RepositoryRelativePath } // 仅非 hard-deny path
  | { kind: "redacted_path_set"; count: number }
  | { kind: "hunk"; hunkId: DiffHunkId }
  | { kind: "symbol"; symbolRefId: SourceSymbolRefId }
  | { kind: "claim"; claimId: ClaimId }
  | {
      kind: "verification_plan_entry";
      verificationPlanEntryId: VerificationPlanEntryId;
    };

type AnalysisBoundaryRecoveryV1 =
  | "retry_after_refresh"
  | "manual_inspection"
  | "restore_artifact"
  | "use_supported_repository_configuration"
  | "reduce_scope"
  | "increase_deterministic_budget"
  | "increase_store_quota_or_cleanup"
  | "supersede_task"
  | "none";

interface AnalysisBoundaryV1 {
  id: AnalysisBoundaryId;
  stage: AnalysisBoundaryStageV1;
  code: AnalysisBoundaryCodeV1;
  scope: AnalysisBoundaryScopeV1;
  recovery: AnalysisBoundaryRecoveryV1;
}

interface ChangeAnalysisBudgetV1 {
  version: "change-analysis-budget-v1";
  maxChangedFiles: number;
  maxBytesPerFile: number;
  maxTotalBytes: number;
  maxLinesPerFile: number;
  maxTotalLines: number;
  maxEditWorkUnits: number;
  maxHunksPerFile: number;
  maxTotalHunks: number;
  maxParserNodesPerFile: number;
  maxTotalParserNodes: number;
  maxMatchingWorkUnits: number;
  maxImpactNodes: number;
  maxImpactEdges: number;
  maxImpactTraversalWorkUnits: number;
  maxImpactPaths: number;
  maxExcerptCharsPerEvidence: number;
  maxTotalExcerptChars: number;
  maxActualChanges: number;
  maxEvidenceItems: number;
  maxSymbolRefs: number;
  maxSerializedArtifactBytes: number;
}

interface BaselineMaterializationBudgetV1 {
  version: "baseline-materialization-budget-v1";
  maxBaselineBlobBytesPerFile: number;
  maxBaselineBlobBytesTotal: number;
}

interface ChangeAnalysisUsageV1 {
  changedFiles: number;
  analyzedFiles: number;
  bytes: number;
  lines: number;
  editWorkUnits: number;
  hunks: number;
  parserNodes: number;
  matchingWorkUnits: number;
  impactNodes: number;
  impactEdges: number;
  impactTraversalWorkUnits: number;
  impactPaths: number;
  excerptChars: number;
  actualChanges: number;
  evidenceItems: number;
  symbolRefs: number;
  serializedArtifactBytes: number;
}

const DEFAULT_CHANGE_ANALYSIS_BUDGET_V1: ChangeAnalysisBudgetV1 = {
  version: "change-analysis-budget-v1",
  maxChangedFiles: 1_000,
  maxBytesPerFile: 1_048_576,
  maxTotalBytes: 33_554_432,
  maxLinesPerFile: 100_000,
  maxTotalLines: 500_000,
  maxEditWorkUnits: 5_000_000,
  maxHunksPerFile: 1_000,
  maxTotalHunks: 10_000,
  maxParserNodesPerFile: 250_000,
  maxTotalParserNodes: 2_000_000,
  maxMatchingWorkUnits: 5_000_000,
  maxImpactNodes: 10_000,
  maxImpactEdges: 100_000,
  maxImpactTraversalWorkUnits: 1_000_000,
  maxImpactPaths: 10_000,
  maxExcerptCharsPerEvidence: 8_192,
  maxTotalExcerptChars: 262_144,
  maxActualChanges: 20_000,
  maxEvidenceItems: 30_000,
  maxSymbolRefs: 50_000,
  maxSerializedArtifactBytes: 33_554_432
};

const DEFAULT_BASELINE_MATERIALIZATION_BUDGET_V1:
  BaselineMaterializationBudgetV1 = {
  version: "baseline-materialization-budget-v1",
  maxBaselineBlobBytesPerFile: 2_097_152,
  maxBaselineBlobBytesTotal: 67_108_864
};
```

所有数值字段必须为非负 safe integer；Budget limit 必须大于 0。Source Span
要求 `start.byteOffset <= endExclusive.byteOffset`，同一行时 column 也单调。
text Hunk 的 old/new `lineCount` 不得同时为 0；metadata-only 变化不伪造成
Hunk。hard-deny/secret 只能使用聚合 `redacted_path_set` Scope，禁止保存或公开
精确路径、正文、excerpt、fingerprint 或 raw-content digest。
P0 不接受每次 Check 临时覆盖 Budget；writer 使用以上版本化默认值。未来如需
workspace policy 调整，必须保存完整 resolved Budget、把 policy digest 纳入
Basis，并保持相同 Budget+input 得到相同 analyzed set。
`BaselineMaterializationBudgetV1` 是 Stage 1/rebase 的独立确定性内容预算，
不属于 Change Analysis usage，也不能限制 3.8.2 的 mandatory security scan；
相同 baseline input + policy 必须选择相同的 private-blob canonical prefix。
Boundary 不持久化调用方 message/cause/details；公开文案只能由受版本控制的
`code → fixed safe message` renderer 表派生，未知 code fail closed。

计数单位也是合同的一部分，不能用 wall time、allocator sample 或实现自报：

- `bytes` 是每个 canonical `(content domain, content identity)` 首次读取的 raw
  octet 数；before/after 身份相同只计一次，无法读取的内容计 0 并产生 Boundary；
- line splitter 只识别原始 `LF / CRLF / CR / no-final-newline` token；每个 token
  计 1 line，空内容计 0。line hash 一次计 1 edit work unit；
- patience 唯一性表的每次 token insert/lookup、LIS 的每次 candidate comparison
  各计 1 edit work unit；Myers 每访问一个 `(d,k)` frontier state、每做一次
  raw line-token equality comparison各计 1。tie-break 与 3.3 一致；改变算法或
  counter 必须改 `diff-lines-v1`；
- `parserNodes` 是 parser result tree 以稳定 preorder 访问的 named 与 unnamed
  node 总数，每个 node 每侧至多计一次；
- `matchingWorkUnits` 是一次 Hunk↔Symbol interval predicate、一次
  Planned↔Actual candidate predicate或一次 required-obligation disposition
  evaluation；exact rename/copy join 的每个 identity bucket insert/lookup 也
  各计一次；
- `impactNodes/impactEdges` 是载入可信图切片的 unique 数；
  `impactTraversalWorkUnits` 每次出队一个 `(node,depth)` 或检查一条 outgoing
  edge 各计 1；`impactPaths` 是 materialize 的 unique canonical path 数；
- excerpt chars 以 Unicode scalar value 计，serialized artifact bytes 以最终
  canonical UTF-8 payload bytes 计；actual/evidence/symbol 数按最终 unique
  object 计，不能先输出再截断；
- 任一 per-file/global/input/output cap 将被下一个 unit 超过时，在该 unit 前
  停止，并按 canonical 顺序把剩余 unit 标为 partial/unknown +
  `budget_exhausted`。不得静默缩短 ID preimage、丢引用或产生无法通过 Bundle
  validator 的“截断成功”Artifact。

输出 Budget 使用两阶段 referential-closure scheduler，而不是按模块完成顺序
抢额度：

1. 先构造 fixed skeleton：Check/Basis/Completeness 五维、现有 Ledger pins、
   一个预留的 aggregate `budget_exhausted` Boundary/Evidence 与事务必备 backlink
   结构；skeleton 自身超过 cap 时整个 Operation 零写 fail closed；
2. 以 Repository path lineage key 排序，把该 path 的 Delta/Hunk/Symbol/
   Actual/Diff Evidence/primary Finding/新增 Claim backlink/所引用新 Impact
   closure 作为一个不可拆原子 contribution；shared object 在第一次引用时计入，
   后续只计引用；
3. path contribution 后再按固定 Finding type/ID 顺序处理不属于单一路径的
   omission、verification-gap 与 task-level Impact contribution；
4. 对每个 candidate 在内存模拟加入后的 **combined resulting canonical payload
   bytes**，只有所有 per-kind cap 与 combined cap 都不越界才接受；首个拒绝后
   不再接受后续 contribution，剩余可信全集由预留 aggregate Boundary/
   Completeness unit 覆盖。

`maxSerializedArtifactBytes` 是同一 `change_checked` transaction 中 resulting
Change Check、Evidence ledger、Impact payload、Finding Claim/backlink payload
的 canonical UTF-8 bytes 合计，不是每个文件各自拥有一份额度；既有 immutable
dependency bytes 与固定 Manifest/Event/Receipt/Journal transaction overhead
不计入该分析输出 cap，但仍受 Store quota。此 schedule、skeleton 字段顺序和
cap accounting 必须有 golden vector；Hunk/Impact/Matching 并发完成顺序不得
改变最大 canonical prefix、Boundary、ID 或 semantic digest。

#### 3.8.2 Baseline、Blob 与 Repository Basis

```ts
type RepositorySnapshotBoundaryCodeV1 =
  | "hard_deny_path"
  | "sensitive_path"
  | "secret_content"
  | "invalid_utf8"
  | "control_character"
  | "branch_value_oversized"
  | "unsafe_git_ref"
  | "scan_unit_oversized"
  | "scan_capture_limit"
  | "unstable_read"
  | "unrepresentable_path"
  | "unsafe_file_kind";

type RepositoryBranchRedactionCodeV1 =
  | "sensitive_path"
  | "secret_content"
  | "invalid_utf8"
  | "control_character"
  | "branch_value_oversized"
  | "unsafe_git_ref";

interface SecurityScanPolicyV1 {
  version: "security-scan-policy-v1";
  hardDenyPathRulesetDigest: ContentDigest;
  sensitivePathRulesetDigest: ContentDigest;
  contentScannerRulesetDigest: ContentDigest;
  controlTreeExclusionRulesetDigest: ContentDigest;
  maxPathBytes: 4_096;
  maxEnumeratedUnitsPerCapture: 1_000_000;
  maxTotalRawPathBytesPerCapture: 67_108_864; // 64 MiB
  maxDirectoryDepth: 256;
  maxStreamingBytesPerUnit: 16_777_216; // 16 MiB
  maxStreamingBytesPerCapture: 268_435_456; // 256 MiB
}

interface SafeGitInvocationPolicyV1 {
  version: "safe-git-invocation-policy-v1";
  commandAllowlist: [
    "cat-file",
    "check-ref-format",
    "diff",
    "for-each-ref",
    "hash-object",
    "ls-files",
    "merge-base",
    "rev-parse",
    "update-ref",
    "version"
  ];
  environmentMode: "fixed_allowlist_v1";
  systemConfig: "disabled";
  globalConfig: "disabled";
  repositoryIncludes: "reject";
  hooks: "validated_empty_directory";
  fsmonitor: "disabled";
  externalDiffAndTextconv: "disabled";
  filters: "never_invoke";
  externalAttributesAndExcludes: "reject";
  replacementObjects: "disabled";
  objectDatabase: "local_only_no_alternates_or_promisor";
  leaseRefStorage: "files_only";
  processIsolation: "handle_bound_exec_and_os_sandbox_v1";
  resourceLimitMode: "os_enforced_fail_closed_v1";
  stdinMode: "closed_except_bounded_hash_object";
  recordCountMode: "strict_incremental_parser_caps_v1";
  terminationMode: "process_group_then_hard_kill_v1";
  refLockTimeoutMode: "zero_wait_v1";
  argvMappingVersion: "safe-git-argv-v1";
  outputGrammarVersion: "safe-git-output-grammar-v1";
  errorMappingVersion: "safe-git-error-map-v1";
  maxStdoutBytesByCommand: {
    version: 128;
    catFile: 67_109_888;
    checkRefFormat: 0;
    diff: 67_108_864;
    forEachRef: 16_777_216;
    hashObject: 128;
    lsFiles: 67_108_864;
    mergeBase: 128;
    revParse: 256;
    updateRef: 0;
  };
  maxStderrBytes: 65_536;
  maxStdinBytesByCommand: {
    hashObjectBlob: 16_777_216;
    hashObjectTree: 67_108_864;
    others: 0;
  };
  maxParsedRecordsByCommand: {
    diff: 1_000_000;
    lsFiles: 1_000_000;
    forEachRef: 1_000_000;
    others: 1;
  };
  maxResidentSetBytes: 536_870_912; // 512 MiB
  maxAddressSpaceBytes: 2_147_483_648; // 2 GiB
  maxProcessCount: 1;
  maxOpenFileDescriptorCount: 256;
  maxCpuTimeSecondsByCommand: {
    version: 2;
    checkRefFormat: 1;
    revParse: 2;
    mergeBase: 5;
    catFile: 5;
    hashObject: 5;
    forEachRef: 5;
    lsFiles: 10;
    diff: 10;
    updateRef: 2;
  };
  wallTimeoutMsByCommand: {
    version: 2_000;
    checkRefFormat: 1_000;
    revParse: 2_000;
    mergeBase: 5_000;
    catFile: 5_000;
    hashObject: 5_000;
    forEachRef: 5_000;
    lsFiles: 10_000;
    diff: 10_000;
    updateRef: 2_000;
  };
  terminationGraceMs: 250;
  filesRefLockTimeoutMs: 0;
  packedRefsLockTimeoutMs: 0;
}

interface SafeGitIsolationPolicyV1 {
  version: "safe-git-isolation-policy-v1";
  runner: "handle_bound_native_runner_v1";
  network: "deny_all";
  childExecution: "pinned_git_and_loader_only";
  readScope: "bound_git_control_and_local_odb_only";
  defaultWriteScope: "deny_all";
  leaseWriteScope: "exact_marker_owned_product_ref_lock_only";
  productReflogWrite: "deny";
  resourceLimits:
    "rlimit_cgroup_mach_or_windows_job_object_required";
  binaryFallback: "os_signed_or_root_admin_owned_immutable_only";
  preAndPostBindingValidation: true;
}

interface SafeGitBootstrapResolverPolicyV1 {
  version: "safe-git-bootstrap-resolver-v1";
  rootBinding: "validated_workspace_root";
  dotGitResolution: "nofollow_directory_or_strict_gitfile";
  gitFileTargetResolution: "component_nofollow_then_bidirectional_binding";
  commonDirResolution: "bounded_parent_then_verified_control_root";
  linkedWorktreeBinding: "admin_gitdir_and_worktree_backpointer";
  canonicalization: "component_by_component_no_symlink";
}

type SafeGitVersionSuffixV1 = string; // `^[A-Za-z0-9][A-Za-z0-9 ._()+-]{0,63}$`

interface SafeGitExecutionProfileV1 {
  version: "safe-git-execution-v1";
  invocationPolicyDigest: ContentDigest;
  bootstrapResolverPolicyDigest: ContentDigest;
  isolationPolicyDigest: ContentDigest;
  gitBinaryDigest: ContentDigest;
  executableBindingToken: KeyedStateTokenV1;
  bootstrapBindingToken: KeyedStateTokenV1;
  linkedWorktreeBindingToken: KeyedStateTokenV1;
  objectDatabaseLayoutToken: KeyedStateTokenV1;
  refBackendLayoutToken: KeyedStateTokenV1;
  gitVersion: {
    major: number; // uint
    minor: number; // uint
    patch: number; // uint
    vendorSuffix?: SafeGitVersionSuffixV1; // 1..64 safe ASCII
  };
  repositoryConfigToken: KeyedStateTokenV1;
  worktreeConfigToken: KeyedStateTokenV1;
  emptyHooksDirectoryToken: KeyedStateTokenV1;
  platformNullDevice: "posix_null" | "windows_nul";
}

interface SafeGitBoundRepositoryV1 {
  // transient-only opaque handles；never serialized/logged
  workspaceRootHandle: OpaqueDirectoryHandle;
  gitDirHandle: OpaqueDirectoryHandle;
  commonGitDirHandle: OpaqueDirectoryHandle;
  objectDirectoryHandle: OpaqueDirectoryHandle;
  bindingDigest: ContentDigest;
}

type SafeGitCommandRequestV1 =
  | { command: "version" }
  | {
      command: "cat-file";
      objectType: "blob" | "tree" | "commit";
      objectId: GitObjectId;
    }
  | { command: "check-ref-format"; refName: GitRefNameV1 }
  | {
      command: "diff";
      view: "commit_to_commit";
      left: GitObjectId;
      right: GitObjectId;
    }
  | {
      command: "diff";
      view: "index_to_commit";
      right: GitObjectId;
    }
  | { command: "for-each-ref"; namespace: GitRefNameV1 }
  | {
      command: "hash-object";
      objectType: "blob" | "tree";
      input: "stdin";
      write: false;
    }
  | {
      command: "ls-files";
      view: "cached_stage" | "unmerged";
    }
  | { command: "merge-base"; left: GitObjectId; right: GitObjectId }
  | { command: "rev-parse"; query: "show_object_format" }
  | {
      command: "rev-parse";
      query: "verify_object";
      objectId: GitObjectId;
    }
  | {
      command: "update-ref";
      action: "create";
      refName: GitRefNameV1;
      newObjectId: GitObjectId;
      expectedOldObjectId: GitObjectId;
    }
  | {
      command: "update-ref";
      action: "delete";
      refName: GitRefNameV1;
      expectedOldObjectId: GitObjectId;
    };

interface SafeGitInvocationV1 {
  profile: "safe_git_invocation_v1";
  request: SafeGitCommandRequestV1;
  cwd: "bound_worktree_root";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  policyDigest: ContentDigest;
}

type RawRepositoryPathBytesV1 = `base64url:${string}`; // no padding；internal only
type CanonicalInternalBytesV1 = `base64url:${string}`; // no padding；internal only
type CanonicalByteStringV1 = `base64url:${string}`; // empty decoded bytes allowed
type CanonicalUnsignedDecimalV1 = `${number}`; // refined canonical uint string

type CanonicalFileIdentityV1 =
  | {
      platform: "posix";
      device: CanonicalUnsignedDecimalV1;
      inode: CanonicalUnsignedDecimalV1;
    }
  | {
      platform: "windows";
      volumeSerial: LowerHex8;
      fileId: LowerHex32;
    };

const DurableObjectIdentityProviderSlugV1Schema = z
  .string()
  .regex(/^(?!.*\.\.)[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/u)
  .brand<"DurableObjectIdentityProviderSlugV1">();
type DurableObjectIdentityProviderSlugV1 =
  z.infer<typeof DurableObjectIdentityProviderSlugV1Schema>;

const DurableObjectIdentityProviderIdV1Schema = z
  .string()
  .regex(
    /^durable-object-provider:(?!.*\.\.)[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/u
  )
  .brand<"DurableObjectIdentityProviderIdV1">();
type DurableObjectIdentityProviderIdV1 =
  z.infer<typeof DurableObjectIdentityProviderIdV1Schema>;
// writer只接受已通过Slug Schema的值并拼接固定prefix，再由ID Schema复验；
// reader除ID Schema外还必须exact-resolve到pinned Registry member。

type ProviderCapabilityFailureReasonV1 =
  | "unavailable"
  | "unsupported_filesystem_profile"
  | "attestation_invalid"
  | "revoked"
  | "migration_required"
  | "initialization_not_terminalized";

interface ProviderUnavailableToolErrorV1 {
  schemaVersion: 1;
  code: "provider_unavailable";
  details: {
    reason: ProviderCapabilityFailureReasonV1;
  };
}

const PROVIDER_CAPABILITY_FAILURE_REASON_PRECEDENCE_V1 = [
  "attestation_invalid",
  "revoked",
  "migration_required",
  "initialization_not_terminalized",
  "unsupported_filesystem_profile",
  "unavailable",
] as const;

type StoreDurableObjectProviderIsolationV1 =
  | {
      kind: "separate_os_principal";
      securityBoundaryProfileDigest: ContentDigest;
    }
  | {
      kind: "kernel_isolated_storage_domain";
      securityBoundaryProfileDigest: ContentDigest;
    };

interface StoreManifestCompareAppendReceiptLedgerPolicyV1 {
  profile:
    "store_manifest_compare_append_receipt_ledger_policy_v1";
  locatorProfile:
    "store_manifest_compare_append_receipt_v1";
  storageBoundary:
    "provider_isolated_non_store_namespace";
  appendSemantics:
    "immutable_no_replace_by_repository_worktree_operation_nonce";
  maxReceiptCountPerRepositoryWorktree: 16_384;
  maxReceiptLogicalBytesPerRepositoryWorktree: 67_108_864; // 64 MiB
  maxSingleReceiptLogicalBytes: 1_048_576; // 1 MiB
  admission:
    "freeze_resolved_at_and_complete_signed_receipt_then_reserve_exact_count_and_canonical_bytes_before_atomic_namespace_commit";
  quotaAccounting:
    "excluded_from_private_store_quota_root";
}

interface StoreDurableObjectProviderPolicyV1 {
  profile: "store_durable_object_provider_policy_v1";
  protocolVersion: 1;
  providerId: DurableObjectIdentityProviderIdV1;
  ipcPeerAuthenticationPolicyDigest: ContentDigest;
  isolation: StoreDurableObjectProviderIsolationV1;
  sourceNamespaceVisibility:
    "inaccessible_to_workspace_writer";
  supportedStagingObjectKinds: ["regular", "directory"];
  stagingRecovery:
    "opaque_locator_idempotent_allocate_or_reopen_exact_unpublished_object_across_restart";
  durableIdentity:
    "same_object_stable_aba_recreate_distinct_across_restart";
  publishSemantics:
    "exact_opened_object_no_replace_with_atomic_bound_root_containment";
  externalIntentStateSemantics:
    "atomic_monotonic_compare_replace_with_restart_receipt_and_handoff_cut";
  handoffJournalSemantics:
    "immutable_no_replace_compare_tip_complete_enumeration_prospective_sealed_version_atomic_seal";
  storeManifestCompareAppendReceiptLedger:
    StoreManifestCompareAppendReceiptLedgerPolicyV1;
  deleteSemantics:
    | "exact_opened_object_atomic_compare_delete_with_containment"
    | "disabled";
  stockSameUidFilesystemFallback: "forbidden";
  realFilesystemConformanceSuiteDigest: ContentDigest;
}

interface StoreDurableObjectProviderRuntimeAttestationV1 {
  profile: "store_durable_object_provider_runtime_attestation_v1";
  providerId: DurableObjectIdentityProviderIdV1;
  semanticProviderPolicyDigest: ContentDigest;
  implementationDigest: ContentDigest;
  binaryAttestationDigest: ContentDigest;
  ipcEndpointAttestationDigest: ContentDigest;
  osPlatform: "darwin" | "linux" | "win32";
  osReleaseFamilyCode: ProviderOsReleaseFamilyCodeV1;
  osBuildDigest: ContentDigest;
  architecture: "arm64" | "x86_64";
  filesystemProfileDigest: ContentDigest;
  realFilesystemConformanceResultDigest: ContentDigest;
  attestationGeneration: number;
  issuedAt: IsoTimestamp;
  registrySignature: StoreProviderRegistrySignatureV1;
}

interface StoreDurableObjectProviderRuntimeAttestationPinV1 {
  profile:
    "store_durable_object_provider_runtime_attestation_pin_v1";
  contentDigest: ContentDigest;
  payload: StoreDurableObjectProviderRuntimeAttestationV1;
}

type StoreDurableObjectProviderVerificationKeyUsageV1 =
  | "operation_receipt"
  | "containment_proof"
  | "state_version"
  | "journal_version"
  | "migration_semantic_proof";

interface StoreDurableObjectProviderVerificationPublicKeyV1 {
  profile:
    "store_durable_object_provider_verification_public_key_v1";
  providerId: DurableObjectIdentityProviderIdV1;
  registryGenerationIntroduced: number; // integer >=1
  keyId: LowerHex22;
  usage: StoreDurableObjectProviderVerificationKeyUsageV1;
  algorithm: "ed25519";
  publicKeyBytes: CanonicalPublicKeyBytes32V1;
  publicKeyDigest: Ed25519PublicKeyDigestV1;
  registrySignature: StoreProviderRegistrySignatureV1;
}

interface StoreDurableObjectProviderBindingDerivationGenerationV1 {
  profile:
    "store_durable_object_provider_binding_derivation_generation_v1";
  providerId: DurableObjectIdentityProviderIdV1;
  registryGenerationIntroduced: number; // integer >=1
  generation: number; // integer >=1
  algorithm: "hmac_sha256_provider_private";
  keyCommitmentDigest: ContentDigest;
  registrySignature: StoreProviderRegistrySignatureV1;
}

interface ProviderFeasibilityApproverPublicKeyV1 {
  profile: "provider_feasibility_approver_public_key_v1";
  distributionRegistryGenerationIntroduced: number; // integer >=1
  role: "qa" | "release";
  keyId: LowerHex22;
  algorithm: "ed25519";
  publicKeyBytes: CanonicalPublicKeyBytes32V1;
  publicKeyDigest: Ed25519PublicKeyDigestV1;
  registrySignature: StoreProviderRegistrySignatureV1;
}

interface ProviderMigrationHistoryQuotaPolicyV1 {
  profile: "provider_migration_history_quota_policy_v1";
  scope: "installation_identity_generation";
  storageBoundary:
    "installation_state_provider_isolated_namespace";
  maxChargedMigrationCountPerInstallationIdentity: 64;
  maxChargedMigrationHistoryLogicalBytesPerInstallationIdentity:
    8_589_934_592; // 8 GiB canonical retained history
  maxChargedMigrationHistoryProviderAllocatedBytesPerInstallationIdentity:
    17_179_869_184; // 16 GiB exact provider allocation
  maxSingleMigrationHistoryReservationLogicalBytes:
    4_294_967_296; // 4 GiB
  maxSingleMigrationHistoryReservationProviderAllocatedBytes:
    8_589_934_592; // 8 GiB
  maxActiveMigrationReservationCountPerInstallationIdentity: 4;
  maxActiveReservedMigrationHistoryLogicalBytesPerInstallationIdentity:
    8_589_934_592; // 8 GiB
  maxActiveReservedMigrationHistoryProviderAllocatedBytesPerInstallationIdentity:
    17_179_869_184; // 16 GiB
  maxReservationRecordCountPerInstallationIdentity: 4_096;
  maxReservationRecordLogicalBytesPerInstallationIdentity:
    67_108_864; // 64 MiB
  maxSingleReservationRecordLogicalBytes:
    1_048_576; // 1 MiB
  maxChargedObjectReceiptCountPerInstallationIdentity: 2_000_000;
  maxChargedObjectReceiptLogicalBytesPerInstallationIdentity:
    2_147_483_648; // 2 GiB
  maxChargedSemanticRootZeroProofCountPerInstallationIdentity:
    4_000_512;
  maxChargedSemanticRootZeroProofLogicalBytesPerInstallationIdentity:
    2_147_483_648; // 2 GiB
  maxChargedProgressRecordCountPerInstallationIdentity: 4_000_032;
  maxChargedProgressRecordLogicalBytesPerInstallationIdentity:
    2_147_483_648; // 2 GiB
  maxChargedProgressOperationReceiptCountPerInstallationIdentity:
    8_000_000;
  maxChargedProgressOperationReceiptLogicalBytesPerInstallationIdentity:
    2_147_483_648; // 2 GiB
  normalUpdateEmergencyMigrationCountReserve: 1;
  normalUpdateEmergencyMigrationHistoryLogicalBytesReserve:
    4_294_967_296; // 4 GiB
  normalUpdateEmergencyMigrationHistoryProviderAllocatedBytesReserve:
    8_589_934_592; // 8 GiB
  maxLedgerEventCountPerInstallationIdentity: 4_096;
  maxLedgerEventLogicalBytesPerInstallationIdentity:
    67_108_864; // 64 MiB
  maxSingleLedgerEventLogicalBytes: 262_144; // 256 KiB
  maxOperationReceiptCountPerInstallationIdentity: 4_096;
  maxOperationReceiptLogicalBytesPerInstallationIdentity:
    268_435_456; // 256 MiB
  maxSingleOperationReceiptLogicalBytes: 1_048_576; // 1 MiB
  maxCurrentHighWaterLogicalBytes: 1_048_576; // 1 MiB
  reservedAccountFutureTerminalTransitionEscrowCount: 3;
  retainedAccountFutureTerminalTransitionEscrowCount: 1;
  admission:
    "reserve_migration_slot_bytes_record_caps_and_terminal_control_escrow_before_first_migration_side_effect";
  exhaustion:
    "zero_write_migration_required_new_installation_identity";
}

interface ProviderTrustHistoryPolicyV1 {
  profile: "provider_trust_history_policy_v1";
  maxRootMetadataGenerationCountPerInstallationIdentity: 256;
  maxRegistryManifestGenerationCountPerInstallationIdentity: 4_096;
  maxSupportCatalogGenerationCountPerInstallationIdentity: 4_096;
  maxAcceptanceGenerationCountPerInstallationIdentity: 4_096;
  maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity:
    4_096;
  maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity:
    67_108_864; // 64 MiB
  maxSingleAcceptanceCompareAppendReceiptLogicalBytes:
    1_048_576; // 1 MiB
  maxProviderVerificationPublicKeyRecordCountPerProvider: 256;
  maxProviderVerificationPublicKeyRecordCountPerUsage: 64;
  maxBindingDerivationGenerationRecordCountPerProvider: 64;
  maxApproverPublicKeyRecordCountPerRole: 64;
  maxCompromisedRevocationRecordCountPerIdentity: 256;
  maxSingleTrustEnvelopeLogicalBytes: 4_194_304; // 4 MiB
  maxTotalTrustHistoryLogicalBytesPerInstallationIdentity:
    268_435_456; // 256 MiB
  normalUpdateEmergencyGenerationReserve: 8;
  normalUpdateEmergencyAcceptanceReceiptReserve: 8;
  normalUpdateEmergencyLogicalBytesReserve: 4_194_304; // 4 MiB
  migrationHistoryQuotaPolicy:
    ProviderMigrationHistoryQuotaPolicyV1;
  admission:
    "canonicalize_complete_successor_and_retained_verification_closure_before_first_side_effect";
  exhaustion: {
    providerScopedHistory:
      "zero_write_same_identity_dual_provider_migration_or_new_identity_rebootstrap";
    installationWideHistory:
      "zero_write_new_installation_identity_rebootstrap_migration_required";
  };
}

type ProviderDistributionSemanticLocatorV1 =
  | {
      locatorProfile:
        "distribution_provider_feasibility_support_catalog_v1";
      catalogGeneration: number;
    }
  | {
      locatorProfile:
        "distribution_provider_public_support_taxonomy_v1";
      taxonomyGeneration: number;
    }
  | {
      locatorProfile: "distribution_provider_release_matrix_v1";
      releaseMatrixGeneration: number;
    }
  | {
      locatorProfile:
        "distribution_provider_target_discovery_result_v1";
      discoveryGeneration: number;
    }
  | {
      locatorProfile:
        "distribution_provider_release_target_universe_v1";
      universeGeneration: number;
    }
  | {
      locatorProfile:
        "distribution_provider_real_fs_fixture_manifest_v1";
      contentDigest: ContentDigest;
    }
  | {
      locatorProfile:
        "distribution_provider_target_discovery_runner_run_v1";
      runManifestContentDigest: ContentDigest;
    }
  | {
      locatorProfile:
        "distribution_provider_real_fs_suite_manifest_v1";
      contentDigest: ContentDigest;
    }
  | {
      locatorProfile:
        "distribution_provider_real_fs_fixture_corpus_manifest_v1";
      contentDigest: ContentDigest;
    };

type ProviderDistributionRetainedObjectKeyV1 =
  | {
      objectKind: "envelope";
      distributionRootBinding:
        ProviderSignedDistributionRootBindingV1;
      locator: ProviderDistributionSemanticLocatorV1;
      contentDigest: ContentDigest;
    }
  | {
      objectKind: "embedded_target_discovery_input_bundle";
      distributionRootBinding:
        ProviderSignedDistributionRootBindingV1;
      parentDiscoveryContentDigest: ContentDigest;
      bundleContentDigest: ContentDigest;
    };

interface ProviderDistributionRetainedObjectUsageV1 {
  key: ProviderDistributionRetainedObjectKeyV1;
  canonicalObjectBytes: number;
  incrementalRetainedHistoryLogicalBytes: number;
}

interface ProviderDistributionHistoryPolicyV1 {
  profile: "provider_distribution_history_policy_v1";
  maxSupportCatalogGenerationCount: 4_096;
  maxPublicTaxonomyGenerationCount: 4_096;
  maxReleaseMatrixGenerationCount: 4_096;
  maxTargetDiscoveryResultGenerationCount: 4_096;
  maxReleaseTargetUniverseGenerationCount: 4_096;
  maxSingleDistributionObjectCanonicalBytes:
    16_777_216; // 16 MiB
  maxTotalRetainedDistributionObjectCount: 65_536;
  maxTotalRetainedDistributionHistoryLogicalBytes:
    536_870_912; // 512 MiB，raw Envelope bytes去重后的完整 closure
  normalUpdateEmergencyGenerationReservePerChain: 8;
  normalUpdateEmergencyLogicalBytesReserve:
    16_777_216; // 16 MiB
  admission:
    "stream_verify_five_chains_embedded_bundles_and_transitive_source_envelopes_before_accepting_distribution";
  exhaustion:
    "reject_candidate_distribution_and_preserve_last_verified_distribution";
}

interface ProviderBootstrapTrustBundlePinV1 {
  locatorProfile:
    "distribution_provider_bootstrap_trust_bundle_v1";
  contentDigest: ContentDigest;
}

interface ProviderStrictEd25519AdversarialManifestPinV1 {
  locatorProfile:
    "distribution_provider_strict_ed25519_adversarial_manifest_v1";
  manifestVersion: 1;
  contentDigest: ContentDigest;
}

interface ProviderStrictEd25519CryptoCapabilityV1 {
  profile: "provider_strict_ed25519_crypto_capability_v1";
  verificationProfile:
    ProviderEd25519VerificationProfileV1;
  adversarialManifest:
    ProviderStrictEd25519AdversarialManifestPinV1;
}

interface ProviderSignedDistributionRootBindingV1 {
  profile: "provider_signed_distribution_root_binding_v1";
  resolverProfile:
    "verified_signed_package_distribution_root_v1";
  signedPackageIdentityDigest: ContentDigest;
  releaseRevisionDigest: ContentDigest;
  bootstrapTrustBundle: ProviderBootstrapTrustBundlePinV1;
  historyPolicy: ProviderDistributionHistoryPolicyV1;
}

interface ProviderFeasibilityApprovalKeysV1 {
  profile: "provider_feasibility_approval_keys_v1";
  activeKeyIds: {
    qa: LowerHex22;
    release: LowerHex22;
  };
  publicKeyRecords: [
    ProviderFeasibilityApproverPublicKeyV1,
    ...ProviderFeasibilityApproverPublicKeyV1[]
  ];
  compromisedRevokedKeyIds: LowerHex22[];
}

interface StoreDurableObjectProviderVerificationKeysV1 {
  profile: "store_durable_object_provider_verification_keys_v1";
  activeKeyIds: {
    operationReceipt: LowerHex22;
    containmentProof: LowerHex22;
    stateVersion: LowerHex22;
    journalVersion: LowerHex22;
  };
  activeBindingDerivationKeyGeneration: number; // integer >=1
  publicKeyRecords: [
    StoreDurableObjectProviderVerificationPublicKeyV1,
    ...StoreDurableObjectProviderVerificationPublicKeyV1[]
  ];
  bindingDerivationGenerationRecords: [
    StoreDurableObjectProviderBindingDerivationGenerationV1,
    ...StoreDurableObjectProviderBindingDerivationGenerationV1[]
  ];
  compromisedRevokedKeyIds: LowerHex22[];
  compromisedRevokedBindingDerivationGenerations: number[];
}

type ProviderPublicLinuxDistributionIdV1 =
  | "almalinux"
  | "amazon-linux"
  | "debian"
  | "fedora"
  | "opensuse-leap"
  | "rhel"
  | "rocky"
  | "sles"
  | "ubuntu";

type ProviderPublicOsReleaseFamilyDescriptorV1 =
  | {
      osPlatform: "darwin";
      resolver: "darwin_product_major_version_v1";
      productMajorVersion: number; // integer 1..999
    }
  | {
      osPlatform: "linux";
      resolver: "linux_os_release_id_major_version_v1";
      distributionId: ProviderPublicLinuxDistributionIdV1;
      distributionMajorVersion: number; // integer 1..999
    };

type ProviderPublicFilesystemDescriptorV1 =
  | {
      osPlatform: "darwin";
      resolver: "darwin_filesystem_type_v1";
      filesystemKind: "apfs";
    }
  | {
      osPlatform: "linux";
      resolver: "linux_statfs_type_v1";
      filesystemKind: "ext4";
    };

interface ProviderPublicOsReleaseFamilyTaxonomyRecordV1 {
  descriptor: ProviderPublicOsReleaseFamilyDescriptorV1;
  osReleaseFamilyCode: ProviderOsReleaseFamilyCodeV1;
}

interface ProviderPublicFilesystemTaxonomyRecordV1 {
  descriptor: ProviderPublicFilesystemDescriptorV1;
  filesystemProfileCode: ProviderFilesystemProfileCodeV1;
}

interface ProviderPublicSupportTaxonomyV1 {
  profile: "provider_public_support_taxonomy_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  registryRootKeyId: LowerHex22;
  taxonomyGeneration: number; // integer >=1
  predecessorTaxonomyContentDigest?: ContentDigest; // absent iff generation=1
  osReleaseFamilies: [
    ProviderPublicOsReleaseFamilyTaxonomyRecordV1,
    ...ProviderPublicOsReleaseFamilyTaxonomyRecordV1[]
  ]; // code UTF-8 bytewise sorted；descriptor/code分别 strict unique
  filesystemProfiles: [
    ProviderPublicFilesystemTaxonomyRecordV1,
    ...ProviderPublicFilesystemTaxonomyRecordV1[]
  ]; // code UTF-8 bytewise sorted；descriptor/code分别 strict unique
  derivationPolicy: {
    osFamilySource:
      "strict_public_platform_release_api_without_build_identifier";
    filesystemSource: "strict_public_filesystem_kind_without_features_or_mount_options";
    excludedPrivateInputs: [
      "osBuildDigest",
      "filesystemFeatureProfileDigest",
      "mountOptionProfileDigest"
    ];
    unknownOrNoncanonicalObservation:
      "public_strong_forbidden";
  };
  taxonomySignature: ProviderPublicSupportTaxonomySignatureV1;
}

interface ProviderPublicSupportTaxonomyEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_public_support_taxonomy";
  taxonomyGeneration: number;
  contentDigest: ContentDigest;
  payload: ProviderPublicSupportTaxonomyV1;
}

interface ProviderPublicSupportTaxonomyPinV1 {
  locatorProfile: "distribution_provider_public_support_taxonomy_v1";
  taxonomyGeneration: number;
  contentDigest: ContentDigest;
}

interface ProviderFeasibilityTargetV1 {
  targetProfileId: ProviderTargetProfileIdV1;
  osPlatform: "darwin" | "linux";
  osReleaseFamilyCode: ProviderOsReleaseFamilyCodeV1;
  osBuildDigest: ContentDigest;
  architecture: "arm64" | "x86_64";
  filesystemProfileCode: ProviderFilesystemProfileCodeV1;
  filesystemFeatureProfileDigest: ContentDigest;
  mountOptionProfileDigest: ContentDigest;
}

interface ProviderReleaseTargetUniverseTargetEntryV1 {
  target: ProviderFeasibilityTargetV1;
  publicProfileId: ProviderPublicSupportProfileIdV1;
}

type ProviderReleaseCoverageIncompleteReasonV1 =
  | "release_matrix_incomplete"
  | "target_discovery_unresolved"
  | "taxonomy_mapping_unresolved";

type ProviderReleaseTargetBucketCoverageV1 =
  | {
      coverageState: "closed_world_complete";
      targetProfileIds: [
        ProviderTargetProfileIdV1,
        ...ProviderTargetProfileIdV1[]
      ];
    }
  | {
      coverageState: "incomplete";
      reason: ProviderReleaseCoverageIncompleteReasonV1;
      targetProfileIds: [
        ProviderTargetProfileIdV1,
        ...ProviderTargetProfileIdV1[]
      ];
    };

interface ProviderReleaseTargetUniverseBucketV1 {
  publicProfileId: ProviderPublicSupportProfileIdV1;
  osPlatform: "darwin" | "linux";
  osReleaseFamilyCode: ProviderOsReleaseFamilyCodeV1;
  architecture: "arm64" | "x86_64";
  filesystemProfileCode: ProviderFilesystemProfileCodeV1;
  coverage: ProviderReleaseTargetBucketCoverageV1;
}

interface ProviderReleaseCoverageArtifactLimitsV1 {
  profile: "provider_release_coverage_artifact_limits_v1";
  maxTargetEntriesPerArtifact: 4_096;
  maxCanonicalUnionTargetEntries: 4_096;
  maxUnresolvedObservationsPerDiscoveryResult: 4_096;
  maxCanonicalEnvelopeBytes: 16_777_216; // 16 MiB
}

interface ProviderReleaseMatrixV1 {
  profile: "provider_release_matrix_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  registryRootKeyId: LowerHex22;
  releaseMatrixGeneration: number; // integer >=1
  predecessorReleaseMatrixContentDigest?: ContentDigest; // absent iff generation=1
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1;
  limits: ProviderReleaseCoverageArtifactLimitsV1;
  targetCount: number; // exact-equal targets.length
  targetSetDigest: ContentDigest;
  targets: [
    ProviderReleaseTargetUniverseTargetEntryV1,
    ...ProviderReleaseTargetUniverseTargetEntryV1[]
  ]; // target.targetProfileId UTF-8 bytewise sorted + unique
  matrixSignature: ProviderReleaseMatrixSignatureV1;
}

interface ProviderReleaseMatrixEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_release_matrix";
  releaseMatrixGeneration: number;
  contentDigest: ContentDigest;
  payload: ProviderReleaseMatrixV1;
}

interface ProviderReleaseMatrixPinV1 {
  locatorProfile: "distribution_provider_release_matrix_v1";
  releaseMatrixGeneration: number;
  contentDigest: ContentDigest;
}

type ProviderTargetDiscoveryObservationSourceV1 =
  | "signed_release_matrix"
  | "real_filesystem_fixture_manifest"
  | "target_discovery_runner";

type ProviderTargetDiscoveryRequiredDimensionsV1 = [
  "osPlatform",
  "osReleaseFamilyCode",
  "osBuildDigest",
  "architecture",
  "filesystemProfileCode",
  "filesystemFeatureProfileDigest",
  "mountOptionProfileDigest"
];

type ProviderTargetDiscoveryObservationSourcesV1 = [
  "signed_release_matrix",
  "real_filesystem_fixture_manifest",
  "target_discovery_runner"
];

type ProviderTargetDiscoveryUnresolvedReasonV1 =
  | "target_dimensions_missing"
  | "taxonomy_mapping_unresolved"
  | "conflicting_target_claims"
  | "observation_source_unavailable";

type ProviderTargetDiscoverySourceRecordOutcomeV1 =
  | {
      state: "resolved";
      target: ProviderReleaseTargetUniverseTargetEntryV1;
    }
  | {
      state: "unresolved";
      reason: ProviderTargetDiscoveryUnresolvedReasonV1;
    };

interface ProviderTargetDiscoverySourceManifestRecordV1 {
  sourceRecordOrdinal: number; // contiguous 0..N-1
  outcome: ProviderTargetDiscoverySourceRecordOutcomeV1;
}

interface ProviderRealFilesystemFixtureCorpusRecordV1 {
  caseKey: ProviderRealFilesystemCaseKeyV1;
  fixtureOrdinal: number; // per case exact 0..N-1
  fixtureRole: "setup" | "operation" | "assertion";
  fixtureProgramProfile:
    "provider_real_fs_fixture_program_v1";
  fixtureProgramBytes: CanonicalByteStringV1;
  fixtureProgramContentDigest: ContentDigest;
  fixtureProgramLogicalBytes: number;
    // exact decoded byte length
}

interface ProviderRealFilesystemFixtureCorpusManifestV1 {
  profile:
    "provider_real_fs_fixture_corpus_manifest_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  registryRootKeyId: LowerHex22;
  releaseRevisionDigest: ContentDigest;
  corpusVersion: ProducerVersion;
  recordCount: number;
  recordSetDigest: ContentDigest;
  records: [
    ProviderRealFilesystemFixtureCorpusRecordV1,
    ...ProviderRealFilesystemFixtureCorpusRecordV1[]
  ];
  fixtureManifestDigest: ContentDigest;
    // release-independent semantic corpus digest
  corpusSignature:
    ProviderRealFilesystemFixtureCorpusManifestSignatureV1;
}

interface ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1 {
  schemaVersion: 1;
  recordType:
    "provider_real_fs_fixture_corpus_manifest";
  contentDigest: ContentDigest;
  payload:
    ProviderRealFilesystemFixtureCorpusManifestV1;
}

interface ProviderRealFilesystemFixtureCorpusManifestPinV1 {
  locatorProfile:
    "distribution_provider_real_fs_fixture_corpus_manifest_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  fixtureManifestDigest: ContentDigest;
  contentDigest: ContentDigest;
}

interface ProviderRealFilesystemRunnerProfileV1 {
  profile: "provider_real_fs_runner_profile_v1";
  protocolVersion: "provider-real-fs-runner-v1";
  canonicalProfileBytes: CanonicalByteStringV1;
}

type ProviderRealFilesystemSuiteCrashCutV1 =
  | {
      crashCutId: "no-crash";
      crashCutOrdinal: 0;
      injection: { state: "none" };
    }
  | {
      crashCutId:
        `provider-crash-cut:${LowerHex22}`;
      crashCutOrdinal: number; // integer >=1
      injection: {
        state: "after_fixture_operation";
        afterFixtureOrdinal: number;
      };
      recoveryAssertionProfile:
        "provider_real_fs_recovery_assertion_v1";
      recoveryAssertionBytes: CanonicalByteStringV1;
      recoveryAssertionContentDigest: ContentDigest;
    };

interface ProviderRealFilesystemSuiteCaseV1 {
  caseId: ProviderRealFilesystemCaseIdV1;
  caseKey: ProviderRealFilesystemCaseKeyV1;
  fixtureRecordCount: number;
  fixtureRecordSetDigest: ContentDigest;
  requiredCrashCuts: [
    ProviderRealFilesystemSuiteCrashCutV1,
    ...ProviderRealFilesystemSuiteCrashCutV1[]
  ];
}

interface ProviderRealFilesystemSuiteManifestV1 {
  profile: "provider_real_fs_suite_manifest_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  registryRootKeyId: LowerHex22;
  releaseRevisionDigest: ContentDigest;
  suiteVersion: ProducerVersion;
  fixtureCorpusManifest:
    ProviderRealFilesystemFixtureCorpusManifestPinV1;
  runnerProfile: ProviderRealFilesystemRunnerProfileV1;
  runnerProfileDigest: ContentDigest;
  caseCount: number;
  caseSetDigest: ContentDigest;
  requiredCaseCutCount: number;
  requiredCaseCutSetDigest: ContentDigest;
  cases: [
    ProviderRealFilesystemSuiteCaseV1,
    ...ProviderRealFilesystemSuiteCaseV1[]
  ];
  suiteDigest: ContentDigest;
    // release-independent semantic suite digest
  suiteSignature:
    ProviderRealFilesystemSuiteManifestSignatureV1;
}

interface ProviderRealFilesystemSuiteManifestEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_real_fs_suite_manifest";
  contentDigest: ContentDigest;
  payload: ProviderRealFilesystemSuiteManifestV1;
}

interface ProviderRealFilesystemSuiteManifestPinV1 {
  locatorProfile:
    "distribution_provider_real_fs_suite_manifest_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  suiteDigest: ContentDigest;
  fixtureManifestDigest: ContentDigest;
  contentDigest: ContentDigest;
}

interface ProviderTargetDiscoveryFixtureManifestPinV1 {
  locatorProfile:
    "distribution_provider_real_fs_fixture_manifest_v1";
  realFilesystemSuiteManifest:
    ProviderRealFilesystemSuiteManifestPinV1;
  realFilesystemSuiteDigest: ContentDigest;
  fixtureManifestDigest: ContentDigest;
  contentDigest: ContentDigest;
}

interface ProviderTargetDiscoveryFixtureManifestV1 {
  profile:
    "provider_target_discovery_fixture_manifest_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  releaseRevisionDigest: ContentDigest;
  realFilesystemSuiteManifest:
    ProviderRealFilesystemSuiteManifestPinV1;
  realFilesystemSuiteDigest: ContentDigest;
  fixtureManifestDigest: ContentDigest;
  targetRecordCount: number;
  targetRecordSetDigest: ContentDigest;
  records: ProviderTargetDiscoverySourceManifestRecordV1[];
  completedAt: IsoTimestamp;
}

interface ProviderTargetDiscoveryFixtureManifestEnvelopeV1 {
  schemaVersion: 1;
  recordType:
    "provider_target_discovery_fixture_manifest";
  fixtureManifestDigest: ContentDigest;
  contentDigest: ContentDigest;
  payload: ProviderTargetDiscoveryFixtureManifestV1;
}

interface ProviderTargetDiscoveryRunnerInstancePinV1 {
  locatorProfile:
    "distribution_provider_target_discovery_runner_run_v1";
  producerName: "understand-code";
  producerVersion: ProducerVersion;
  implementationDigest: ContentDigest;
  binaryAttestationDigest: ContentDigest;
  runnerProfileDigest: ContentDigest;
  runManifestContentDigest: ContentDigest;
  releaseRevisionDigest: ContentDigest;
  executedAt: IsoTimestamp;
}

interface ProviderTargetDiscoveryRunnerRunManifestV1 {
  profile:
    "provider_target_discovery_runner_run_manifest_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  releaseRevisionDigest: ContentDigest;
  producerName: "understand-code";
  producerVersion: ProducerVersion;
  implementationDigest: ContentDigest;
  binaryAttestationDigest: ContentDigest;
  runnerProfileDigest: ContentDigest;
  targetRecordCount: number;
  targetRecordSetDigest: ContentDigest;
  records: ProviderTargetDiscoverySourceManifestRecordV1[];
  executedAt: IsoTimestamp;
}

interface ProviderTargetDiscoveryRunnerRunEnvelopeV1 {
  schemaVersion: 1;
  recordType:
    "provider_target_discovery_runner_run";
  contentDigest: ContentDigest;
  payload: ProviderTargetDiscoveryRunnerRunManifestV1;
}

interface ProviderTargetDiscoveryObservationCutV1 {
  profile: "provider_target_discovery_observation_cut_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1;
  releaseMatrix: ProviderReleaseMatrixPinV1;
  realFilesystemFixtureManifest:
    ProviderTargetDiscoveryFixtureManifestPinV1;
  targetDiscoveryRunner:
    ProviderTargetDiscoveryRunnerInstancePinV1;
  discoveryRulesetVersion:
    "provider_release_target_discovery_v1";
  requiredDimensions:
    ProviderTargetDiscoveryRequiredDimensionsV1;
  observationSources:
    ProviderTargetDiscoveryObservationSourcesV1;
  freshnessRule:
    "exact_release_revision_and_source_digest_cut_v1";
}

interface ProviderTargetDiscoverySourceRecordProjectionV1 {
  observationSource: ProviderTargetDiscoveryObservationSourceV1;
  sourceArtifactContentDigest: ContentDigest;
  sourceRecordOrdinal: number; // nonnegative safe integer
  outcome: ProviderTargetDiscoverySourceRecordOutcomeV1;
}

interface ProviderTargetDiscoveryInputObservationV1
  extends ProviderTargetDiscoverySourceRecordProjectionV1 {
  privacySafeObservationClaimsDigest: ContentDigest;
  observationKeyDigest: ContentDigest;
}

interface ProviderTargetDiscoverySourceObservationSetSummaryV1 {
  observationSource: ProviderTargetDiscoveryObservationSourceV1;
  sourceArtifactContentDigest: ContentDigest;
  observationCount: number;
  observationSetDigest: ContentDigest;
}

interface ProviderTargetDiscoveryInputBundleV1 {
  profile: "provider_target_discovery_input_bundle_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  registryRootKeyId: LowerHex22;
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1;
  releaseMatrix: ProviderReleaseMatrixPinV1;
  realFilesystemFixtureManifest:
    ProviderTargetDiscoveryFixtureManifestPinV1;
  targetDiscoveryRunner:
    ProviderTargetDiscoveryRunnerInstancePinV1;
  discoveryRulesetVersion:
    "provider_release_target_discovery_v1";
  requiredDimensions:
    ProviderTargetDiscoveryRequiredDimensionsV1;
  observationSources:
    ProviderTargetDiscoveryObservationSourcesV1;
  observationCut: ProviderTargetDiscoveryObservationCutV1;
  observationCutDigest: ContentDigest;
  sourceObservationSets: [
    ProviderTargetDiscoverySourceObservationSetSummaryV1 & {
      observationSource: "signed_release_matrix";
    },
    ProviderTargetDiscoverySourceObservationSetSummaryV1 & {
      observationSource: "real_filesystem_fixture_manifest";
    },
    ProviderTargetDiscoverySourceObservationSetSummaryV1 & {
      observationSource: "target_discovery_runner";
    }
  ];
  observationCount: number;
  observationSetDigest: ContentDigest;
  observations: ProviderTargetDiscoveryInputObservationV1[];
  bundleSignature:
    ProviderTargetDiscoveryInputBundleSignatureV1;
}

interface ProviderTargetDiscoveryUnresolvedObservationV1 {
  observationSource: ProviderTargetDiscoveryObservationSourceV1;
  sourceArtifactContentDigest: ContentDigest;
  sourceRecordOrdinal: number;
  privacySafeObservationClaimsDigest: ContentDigest;
  observationKeyDigest: ContentDigest;
  reason: ProviderTargetDiscoveryUnresolvedReasonV1;
}

interface ProviderTargetDiscoveryResultV1 {
  profile: "provider_target_discovery_result_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  registryRootKeyId: LowerHex22;
  discoveryGeneration: number; // integer >=1
  predecessorDiscoveryContentDigest?: ContentDigest; // absent iff generation=1
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1;
  limits: ProviderReleaseCoverageArtifactLimitsV1;
  targetDiscoveryInputBundleContentDigest: ContentDigest;
  targetDiscoveryInputBundle:
    ProviderTargetDiscoveryInputBundleV1;
  observationCutDigest: ContentDigest;
  observationSetDigest: ContentDigest;
  discoveryRulesetVersion:
    "provider_release_target_discovery_v1";
  requiredDimensions:
    ProviderTargetDiscoveryRequiredDimensionsV1;
  observationSources:
    ProviderTargetDiscoveryObservationSourcesV1;
  targetCount: number; // exact-equal targets.length
  targetSetDigest: ContentDigest;
  targets: ProviderReleaseTargetUniverseTargetEntryV1[];
  // targetProfileId sorted+unique；同ID不同完整bytes拒绝
  unresolvedObservationCount: number;
    // exact-equal unresolvedObservations.length
  unresolvedObservations: ProviderTargetDiscoveryUnresolvedObservationV1[];
  // (observationSource,observationKeyDigest) UTF-8 bytewise sorted+unique
  discoverySignature: ProviderTargetDiscoveryResultSignatureV1;
}

interface ProviderTargetDiscoveryResultEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_target_discovery_result";
  discoveryGeneration: number;
  contentDigest: ContentDigest;
  payload: ProviderTargetDiscoveryResultV1;
}

interface ProviderTargetDiscoveryResultPinV1 {
  locatorProfile: "distribution_provider_target_discovery_result_v1";
  discoveryGeneration: number;
  contentDigest: ContentDigest;
}

interface ProviderReleaseTargetCoverageBasisV1 {
  profile: "provider_release_target_coverage_basis_v1";
  releaseMatrix: ProviderReleaseMatrixPinV1;
  targetDiscoveryResult: ProviderTargetDiscoveryResultPinV1;
  targetDiscoveryInputBundleContentDigest: ContentDigest;
  observationCutDigest: ContentDigest;
  observationSetDigest: ContentDigest;
  limits: ProviderReleaseCoverageArtifactLimitsV1;
  discoveryRulesetVersion:
    "provider_release_target_discovery_v1";
  requiredDimensions:
    ProviderTargetDiscoveryRequiredDimensionsV1;
  observationSources:
    ProviderTargetDiscoveryObservationSourcesV1;
  releaseMatrixTargetCount: number; // nonnegative safe integer
  releaseMatrixTargetSetDigest: ContentDigest;
  discoveredTargetCount: number; // nonnegative safe integer
  discoveredTargetSetDigest: ContentDigest;
  unresolvedObservationCount: number; // nonnegative safe integer
  resolution:
    | {
        state: "closed_world_complete";
      }
    | {
        state: "incomplete";
        reason: ProviderReleaseCoverageIncompleteReasonV1;
      };
}

interface ProviderReleaseTargetUniverseV1 {
  profile: "provider_release_target_universe_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  registryRootKeyId: LowerHex22;
  universeGeneration: number; // integer >=1
  predecessorUniverseContentDigest?: ContentDigest; // absent iff generation=1
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1;
  coverageBasis: ProviderReleaseTargetCoverageBasisV1;
  targets: [
    ProviderReleaseTargetUniverseTargetEntryV1,
    ...ProviderReleaseTargetUniverseTargetEntryV1[]
  ]; // target.targetProfileId UTF-8 bytewise sorted + unique
  buckets: [
    ProviderReleaseTargetUniverseBucketV1,
    ...ProviderReleaseTargetUniverseBucketV1[]
  ]; // publicProfileId UTF-8 bytewise sorted + unique；target IDs exact-partition targets
  universeSignature: ProviderReleaseTargetUniverseSignatureV1;
}

interface ProviderReleaseTargetUniverseEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_release_target_universe";
  universeGeneration: number;
  contentDigest: ContentDigest;
  payload: ProviderReleaseTargetUniverseV1;
}

interface ProviderReleaseTargetUniversePinV1 {
  locatorProfile: "distribution_provider_release_target_universe_v1";
  universeGeneration: number;
  contentDigest: ContentDigest;
}

interface ProviderRealFilesystemConformanceCaseResultV1 {
  caseId: ProviderRealFilesystemCaseIdV1;
  crashCutId: ProviderRealFilesystemCrashCutIdV1;
  outcome: "passed" | "failed" | "unsupported";
  resultCode:
    | "passed"
    | "assertion_failed"
    | "provider_rejected"
    | "crash_recovery_failed"
    | "identity_discontinuity"
    | "containment_violation"
    | "unsupported_by_target_profile";
}

interface ProviderRealFilesystemConformanceResultV1 {
  profile: "provider_real_fs_conformance_result_v1";
  resultId: ProviderRealFilesystemConformanceResultIdV1;
  providerId: DurableObjectIdentityProviderIdV1;
  semanticProviderPolicyDigest: ContentDigest;
  implementationDigest: ContentDigest;
  binaryAttestationDigest: ContentDigest;
  target: ProviderFeasibilityTargetV1;
  targetDiscoveryResult:
    ProviderTargetDiscoveryResultPinV1;
  targetDiscoveryInputBundleContentDigest: ContentDigest;
  realFilesystemSuiteManifest:
    ProviderRealFilesystemSuiteManifestPinV1;
  suiteDigest: ContentDigest;
  fixtureManifestDigest: ContentDigest;
  runnerProfileDigest: ContentDigest;
  crashCutCoverageDigest: ContentDigest;
  caseResults: [
    ProviderRealFilesystemConformanceCaseResultV1,
    ...ProviderRealFilesystemConformanceCaseResultV1[]
  ]; // {caseId,crashCutId} UTF-8 bytewise sorted + unique
  result: "passed" | "failed" | "unsupported";
  completedAt: IsoTimestamp;
}

interface ProviderRealFilesystemConformanceResultEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_real_fs_conformance_result";
  resultId: ProviderRealFilesystemConformanceResultIdV1;
  contentDigest: ContentDigest;
  payload: ProviderRealFilesystemConformanceResultV1;
}

interface ProviderRealFilesystemConformanceResultLocatorV1 {
  locatorProfile:
    "installation_provider_real_fs_conformance_result_v1";
  resultId: ProviderRealFilesystemConformanceResultIdV1;
}

interface ProviderRealFilesystemConformanceResultPinV1
  extends ProviderRealFilesystemConformanceResultLocatorV1 {
  contentDigest: ContentDigest;
}

interface ProviderRegistryRootPublicKeyV1 {
  profile: "provider_registry_root_public_key_v1";
  rootKeyId: LowerHex22;
  algorithm: "ed25519";
  publicKeyBytes: CanonicalPublicKeyBytes32V1;
  publicKeyDigest: Ed25519PublicKeyDigestV1;
}

interface ProviderRegistryRecoveryPublicKeyV1 {
  profile: "provider_registry_recovery_public_key_v1";
  recoveryKeyId: LowerHex22;
  algorithm: "ed25519";
  publicKeyBytes: CanonicalPublicKeyBytes32V1;
  publicKeyDigest: Ed25519PublicKeyDigestV1;
}

interface ProviderRegistryRootMetadataCommonV1 {
  profile: "provider_registry_root_metadata_v1";
  rootGeneration: number; // integer >=1
  activeRoot: ProviderRegistryRootPublicKeyV1;
  issuedAt: IsoTimestamp;
  selfSignature: ProviderRegistryRootSelfSignatureV1;
}

type ProviderRegistryRootMetadataV1 =
  | (ProviderRegistryRootMetadataCommonV1 & {
      activation: "bootstrap";
      predecessor: { state: "genesis" };
      recoverySignatures: [];
    })
  | (ProviderRegistryRootMetadataCommonV1 & {
      activation: "planned_rollover";
      predecessor: {
        state: "root_metadata";
        rootGeneration: number;
        rootKeyId: LowerHex22;
        contentDigest: ContentDigest;
      };
      predecessorCrossSignature:
        ProviderRegistryRootCrossSignatureV1;
      recoverySignatures: [
        ProviderRegistryRootRecoverySignatureV1,
        ProviderRegistryRootRecoverySignatureV1
      ];
    })
  | (ProviderRegistryRootMetadataCommonV1 & {
      activation: "compromise_recovery";
      predecessor: {
        state: "root_metadata";
        rootGeneration: number;
        rootKeyId: LowerHex22;
        contentDigest: ContentDigest;
      };
      recoverySignatures: [
        ProviderRegistryRootRecoverySignatureV1,
        ProviderRegistryRootRecoverySignatureV1
      ];
    });

interface ProviderRegistryRootMetadataEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_registry_root_metadata";
  rootGeneration: number;
  rootKeyId: LowerHex22;
  contentDigest: ContentDigest;
  payload: ProviderRegistryRootMetadataV1;
}

interface ProviderRegistryRootMetadataPinV1 {
  locatorProfile:
    "installation_provider_registry_root_metadata_v1";
  rootGeneration: number;
  rootKeyId: LowerHex22;
  contentDigest: ContentDigest;
}

interface ProviderStrictEd25519AdversarialCaseV1 {
  caseId: string; // strict lower kebab-case，UTF-8 bytewise sorted + unique
  category:
    | "rfc8032_valid"
    | "provider_wrapper_valid"
    | "public_key_length"
    | "signature_length"
    | "public_key_noncanonical"
    | "public_key_identity_or_small_order"
    | "public_key_mixed_order"
    | "r_noncanonical"
    | "r_identity_or_small_order"
    | "r_mixed_order"
    | "s_out_of_range"
    | "equation_mismatch"
    | "context_or_prehash_substitution";
  publicKeyBytes: CanonicalByteStringV1;
  messageBytes: CanonicalByteStringV1;
  signatureBytes: CanonicalByteStringV1;
  expectedPublicKeyPointAdmission: "accept" | "reject";
  expectedSignatureRPointAdmission: "accept" | "reject";
  expectedResult: "accept" | "reject";
}

interface ProviderStrictEd25519AdversarialManifestV1 {
  profile:
    "provider_strict_ed25519_adversarial_manifest_v1";
  manifestVersion: 1;
  verificationProfile:
    ProviderEd25519VerificationProfileV1;
  cases: [
    ProviderStrictEd25519AdversarialCaseV1,
    ...ProviderStrictEd25519AdversarialCaseV1[]
  ];
}

interface ProviderStrictEd25519AdversarialManifestEnvelopeV1 {
  schemaVersion: 1;
  recordType:
    "provider_strict_ed25519_adversarial_manifest";
  manifestVersion: 1;
  contentDigest: ContentDigest;
  payload: ProviderStrictEd25519AdversarialManifestV1;
}

`manifestVersion=1`不是开放 case registry。verifier代码与跨语言 conformance
runner必须 hard-code下列 UTF-8 bytewise有序 tuple，并要求 manifest
exact-cover、无 missing/extra/duplicate/reorder；只有名字以 `rfc8032-`及
`provider-wrapper-valid`的5项期望 `accept`，其余全部期望 `reject`，每个 ID的
category与 raw bytes由 immutable golden固定：

```ts
const PROVIDER_STRICT_ED25519_REQUIRED_CASE_IDS_V1 = [
  "caller-prehash-substitution",
  "ed25519ctx-substitution",
  "ed25519ph-substitution",
  "equation-message-bitflip",
  "identity-universal-forgery",
  "provider-wrapper-valid",
  "public-key-31-bytes",
  "public-key-33-bytes",
  "public-key-identity",
  "public-key-mixed-order",
  "public-key-negative-zero",
  "public-key-nonsquare",
  "public-key-small-order",
  "public-key-y-equals-p",
  "r-identity",
  "r-mixed-order",
  "r-noncanonical",
  "r-small-order",
  "rfc8032-empty-valid",
  "rfc8032-one-byte-valid",
  "rfc8032-test-1024-valid",
  "rfc8032-two-byte-valid",
  "s-equals-l",
  "s-l-plus-one",
  "s-max",
  "s-plus-l-malleability",
  "signature-63-bytes",
  "signature-65-bytes",
] as const;
```

`rfc8032-test-1024-valid`沿用 RFC 8032 的 `TEST 1024`标签，其 MESSAGE 实际为
1023 octets；不得按 case ID标签误生成 1024-byte message。

manifest的三个 expected结果彼此独立，不能从整体 `expectedResult`推导 point
结果。每个 v1 case的 decoded `signatureBytes`必须至少32 octets；runner对28项逐项、
不去重且按 tuple顺序：

1. 把完整 decoded `publicKeyBytes`传给
   `validatePrimeSubgroupPoint`，只与
   `expectedPublicKeyPointAdmission`比较；
2. 把 decoded `signatureBytes`的 exact前32 octets `R`传给同一 method，只与
   `expectedSignatureRPointAdmission`比较；63/65-byte signature仍必须测试其
   exact 32-byte `R`；
3. 把完整 key/message/signature传给 `verifyRawEd25519`，只与
   `expectedResult`比较。

因此启动 KAT固定执行56次 point admission与28次完整 signature verification。
`S>=L`、equation/message或 ctx/ph/prehash substitution等 case可以且应当拥有
`expectedResult=reject`但两个 point expected均为 `accept`；不得把整体 reject复用
为 point结果。任一 method始终 true/false、两 method分叉、少调用/去重/重排、输入
mutation或预期字段互换都不能取得 opaque capability。

至少两个 regression bytes必须原样进入该 manifest：`identity-universal-forgery`
使用 public key
`base64url:AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`、message
`base64url:dGVzdA`、signature
`base64url:AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`；
`public-key-mixed-order`使用 public key raw hex `95 || 99*31`、message raw UTF-8
`mixed-0`及 signature
`base64url:WGZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmYFNgrUYD-aM4nc_dUoG9OVFxUNr_IfbNwutPySDWcNBg`。
已观察到 native runtime可宽松接受这类构造；strict profile必须拒绝。首次实现
生成完整 canonical manifest后，package还必须编译固定
`ProviderStrictEd25519AdversarialManifestContentDigestV1`常量；Pin、resource与
常量三方 exact-equal。caller不能删减、替换或自带 manifest来获取 capability。

interface ProviderBootstrapTrustBundleV1 {
  profile: "provider_bootstrap_trust_bundle_v1";
  strictCryptoCapability:
    ProviderStrictEd25519CryptoCapabilityV1;
  bootstrapProviderRegistryRoot:
    ProviderRegistryRootPublicKeyV1;
  bootstrapProviderRegistryRootMetadata:
    ProviderRegistryRootMetadataEnvelopeV1;
  providerRegistryRecoveryKeys: [
    ProviderRegistryRecoveryPublicKeyV1,
    ProviderRegistryRecoveryPublicKeyV1,
    ProviderRegistryRecoveryPublicKeyV1
  ]; // recoveryKeyId UTF-8 bytewise sorted + unique；四把 trust key material全异
  providerRegistryRecoveryThreshold: 2;
  providerTrustHistoryPolicy:
    ProviderTrustHistoryPolicyV1;
}

interface ProviderBootstrapTrustBundleEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_bootstrap_trust_bundle";
  contentDigest: ContentDigest;
  payload: ProviderBootstrapTrustBundleV1;
}

Bundle validator必须逐项关闭下列等式后才可建立 trust：

- `strictCryptoCapability.verificationProfile`、adversarial manifest payload
  `verificationProfile`与 host capability三者 exact-equal；manifest Pin的
  version/content digest与 retained/resolved Envelope outer/payload exact-equal；
- `bootstrapProviderRegistryRoot`必须 byte-identical
  `bootstrapProviderRegistryRootMetadata.payload.activeRoot`；metadata outer
  `rootGeneration/rootKeyId/contentDigest`分别等于 payload generation/active
  root ID及 `provider-registry-root-metadata-v1`重算值；
- metadata必须恰为
  `rootGeneration=1/activation=bootstrap/predecessor={state:"genesis"}/
  recoverySignatures=[]`，self-signature通过同一 strict profile；
- recovery tuple恰有3项，按 recoveryKeyId UTF-8 bytewise严格升序，ID与 raw-key
  digest分别重算、无 duplicate；root+3 recovery raw material两两不同且全部通过
  prime-subgroup point admission；threshold恰为2；
- bundle Envelope `contentDigest`等于
  `provider-bootstrap-trust-bundle-v1`完整 payload digest。现有 C09-0
  key-ID golden只证明“任意 exact 32 bytes的稳定 ID派生”，不因此成为
  trust-admissible key；mixed/small-order key可继续验证旧 key-ID vector，但必须被
  Bundle/Registry admission拒绝。

interface ProviderFeasibilityEvidenceV1 {
  profile: "provider_feasibility_evidence_v1";
  evidenceId: ProviderFeasibilityEvidenceIdV1;
  providerId: DurableObjectIdentityProviderIdV1;
  semanticProviderPolicyDigest: ContentDigest;
  runtimeAttestationContentDigest: ContentDigest;
  implementationDigest: ContentDigest;
  binaryAttestationDigest: ContentDigest;
  target: ProviderFeasibilityTargetV1;
  isolationSecurityBoundaryProfileDigest: ContentDigest;
  ipcPeerAuthenticationPolicyDigest: ContentDigest;
  realFilesystemSuiteDigest: ContentDigest;
  realFilesystemConformanceResult:
    ProviderRealFilesystemConformanceResultPinV1;
  realFilesystemConformanceResultDigest: ContentDigest;
  fixtureManifestDigest: ContentDigest;
  runnerProfileDigest: ContentDigest;
  crashCutCoverageDigest: ContentDigest;
  result: "passed" | "failed" | "unsupported";
  issuedAt: IsoTimestamp;
  qaSignature: ProviderFeasibilityQaSignatureV1;
  releaseSignature: ProviderFeasibilityReleaseSignatureV1;
}

interface ProviderFeasibilityEvidenceEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_feasibility_evidence";
  evidenceId: ProviderFeasibilityEvidenceIdV1;
  contentDigest: ContentDigest;
  payload: ProviderFeasibilityEvidenceV1;
}

interface ProviderFeasibilityEvidencePinV1 {
  locatorProfile:
    "installation_provider_feasibility_evidence_v1";
  evidenceId: ProviderFeasibilityEvidenceIdV1;
  contentDigest: ContentDigest;
}

interface ProviderFeasibilitySupportCandidateV1 {
  providerId: DurableObjectIdentityProviderIdV1;
  providerFeasibilityEvidence: ProviderFeasibilityEvidencePinV1;
  semanticProviderPolicy: StoreDurableObjectProviderPolicyV1;
  runtimeAttestation:
    StoreDurableObjectProviderRuntimeAttestationPinV1;
  releaseDisposition:
    | "strong_read_write"
    | "legacy_redacted_read_only";
}

interface ProviderFeasibilitySupportTargetEntryV1 {
  target: ProviderFeasibilityTargetV1;
  candidates: [
    ProviderFeasibilitySupportCandidateV1,
    ...ProviderFeasibilitySupportCandidateV1[]
  ]; // providerId UTF-8 bytewise sorted + unique
}

interface ProviderFeasibilitySupportCatalogV1 {
  profile: "provider_feasibility_support_catalog_v1";
  distributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  registryRootKeyId: LowerHex22;
  catalogGeneration: number; // integer >=1
  predecessorCatalogContentDigest?: ContentDigest; // absent iff generation=1
  feasibilityApprovalKeys: ProviderFeasibilityApprovalKeysV1;
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1;
  releaseTargetUniverse: ProviderReleaseTargetUniversePinV1;
  targets: [
    ProviderFeasibilitySupportTargetEntryV1,
    ...ProviderFeasibilitySupportTargetEntryV1[]
  ]; // targetProfileId sorted+unique；完整 target bytes exact-cover releaseTargetUniverse.targets
  catalogSignature: ProviderFeasibilitySupportCatalogSignatureV1;
}

interface ProviderFeasibilitySupportCatalogEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_feasibility_support_catalog";
  catalogGeneration: number; // integer >=1
  contentDigest: ContentDigest;
  payload: ProviderFeasibilitySupportCatalogV1;
}

interface ProviderFeasibilityPublicSupportV1 {
  profile: "provider_feasibility_public_support_v1";
  publicProfileId: ProviderPublicSupportProfileIdV1;
  osPlatform: "darwin" | "linux";
  osReleaseFamilyCode: ProviderOsReleaseFamilyCodeV1;
  architecture: "arm64" | "x86_64";
  filesystemProfileCode: ProviderFilesystemProfileCodeV1;
  capability: "strong_read_write" | "legacy_redacted_read_only";
}

interface StoreDurableObjectProviderRegistryEntryV1 {
  profile: "store_durable_object_provider_registry_entry_v1";
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  registryRootKeyId: LowerHex22;
  registryGeneration: number; // integer >=1
  predecessorRegistryEntryContentDigest?: ContentDigest; // absent iff generation=1
  providerId: DurableObjectIdentityProviderIdV1;
  semanticProviderPolicyDigest: ContentDigest;
  providerFeasibilityEvidence: ProviderFeasibilityEvidencePinV1;
  runtimeAttestation:
    StoreDurableObjectProviderRuntimeAttestationPinV1;
  verificationKeys: StoreDurableObjectProviderVerificationKeysV1;
  feasibilityApprovalKeys: ProviderFeasibilityApprovalKeysV1;
  status: "enabled";
  registrySignature: StoreProviderRegistrySignatureV1;
}

type ProviderRegistryManifestMemberV1 =
  | {
      providerId: DurableObjectIdentityProviderIdV1;
      disposition: "enabled";
      registryEntryContentDigest: ContentDigest;
      registryEntry: StoreDurableObjectProviderRegistryEntryV1;
    }
  | {
      providerId: DurableObjectIdentityProviderIdV1;
      disposition: "revoked";
      lastEnabledRegistryEntryContentDigest: ContentDigest;
      revokedAtManifestGeneration: number;
      reason:
        | "provider_compromised"
        | "semantic_policy_retired"
        | "distribution_support_withdrawn"
        | "migration_completed";
    };

interface ProviderRegistryManifestV1 {
  profile: "provider_registry_manifest_v1";
  generationId: ProviderRegistryManifestGenerationIdV1;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  manifestGeneration: number; // integer >=1
  predecessor:
    | { state: "genesis" }
    | {
        state: "manifest";
        generationId: ProviderRegistryManifestGenerationIdV1;
        contentDigest: ContentDigest;
      };
  members: [
    ProviderRegistryManifestMemberV1,
    ...ProviderRegistryManifestMemberV1[]
  ]; // providerId UTF-8 bytewise sorted + unique
  routing:
    | {
        state: "steady";
      }
    | {
        state: "migration";
        migrationId: ProviderMigrationIdV1;
        sourceProviderId: DurableObjectIdentityProviderIdV1;
        destinationProviderId: DurableObjectIdentityProviderIdV1;
        activeForMigrationWrites:
          DurableObjectIdentityProviderIdV1;
        phase:
          | "prepared"
          | "rebinding"
          | "source_drained";
      };
  issuedAt: IsoTimestamp;
  manifestSignature: ProviderRegistryManifestSignatureV1;
}

interface ProviderRegistryManifestEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_registry_manifest";
  generationId: ProviderRegistryManifestGenerationIdV1;
  contentDigest: ContentDigest;
  payload: ProviderRegistryManifestV1;
}

interface ProviderRegistryManifestPinV1 {
  locatorProfile:
    "installation_provider_registry_manifest_v1";
  manifestGeneration: number;
  generationId: ProviderRegistryManifestGenerationIdV1;
  contentDigest: ContentDigest;
}

interface ProviderFeasibilitySupportCatalogPinV1 {
  locatorProfile:
    "distribution_provider_feasibility_support_catalog_v1";
  catalogGeneration: number;
  contentDigest: ContentDigest;
}

interface StoreDurableObjectBindingV1 {
  profile: "store_durable_object_binding_v1";
  authority: "generation_aware_provider";
  providerId: DurableObjectIdentityProviderIdV1;
  providerPolicyDigest: ContentDigest;
  bindingDerivationKeyGeneration: number; // integer >=1
  observedIdentity: CanonicalFileIdentityV1;
  durableBindingToken: StoreProviderDurableBindingTokenV1;
  persistedRecoveryAuthority: "provider_revalidation";
}

interface TransientStoreObjectAuthorityV1 {
  // transient-only；never serialized/logged/hashed
  profile: "transient_store_object_authority_v1";
  brokerEpochId: LowerHex32;
  handleNonce: LowerHex32;
  durableBinding: StoreDurableObjectBindingV1;
  revalidationProofToken: StoreProviderOperationReceiptTokenV1;
  publishAuthority:
    "provider_handle_addressed_no_replace_with_atomic_bound_root_containment";
  deleteAuthority:
    | "provider_handle_addressed_compare_delete_with_atomic_bound_root_containment"
    | "disabled";
}

interface StoreProviderBoundRootContainmentContextV1 {
  profile: "store_provider_bound_root_containment_context_v1";
  boundRootAuthority: TransientStoreObjectAuthorityV1;
  destinationParentAuthority: TransientStoreObjectAuthorityV1;
  destinationParent:
    | { kind: "bound_root" }
    | {
        kind: "descendant";
        relativePath: StoreRelativePathV1;
        relativePathComponents: [
          CanonicalInternalBytesV1,
          ...CanonicalInternalBytesV1[]
        ];
        ancestorBindings: [
          StoreDurableObjectBindingV1,
          ...StoreDurableObjectBindingV1[]
        ];
      };
}

interface StoreProviderJournalEnumerationRecordPinV1 {
  recordId: StoreTerminalizationHandoffRecordIdV1;
  recordContentDigest: ContentDigest;
  recordFileBinding: StoreDurableObjectBindingV1;
}

interface StoreProviderJournalEnumerationV1 {
  profile: "store_provider_journal_enumeration_v1";
  providerId: DurableObjectIdentityProviderIdV1;
  providerPolicyDigest: ContentDigest;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  transactionNonce: LowerHex32;
  records: [
    StoreProviderJournalEnumerationRecordPinV1,
    ...StoreProviderJournalEnumerationRecordPinV1[]
  ]; // recordId UTF-8 bytewise sorted + unique
}

interface StoreProviderJournalVersionClaimsCommonV1 {
  profile: "store_provider_journal_version_claims_v1";
  providerId: DurableObjectIdentityProviderIdV1;
  providerPolicyDigest: ContentDigest;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  transactionNonce: LowerHex32;
  versionOrdinal: number; // integer >=0
  enumerationContentDigest: ContentDigest;
  recordCount: number; // integer >=1
  uniqueTipRecordId: StoreTerminalizationHandoffRecordIdV1;
  uniqueTipRecordContentDigest: ContentDigest;
}

type StoreProviderJournalVersionClaimsV1 =
  | (StoreProviderJournalVersionClaimsCommonV1 & {
      versionState: "open";
      predecessor:
        | {
            state: "genesis";
            expectedNamespaceState: "absent";
          }
        | {
            state: "version";
            token: StoreProviderJournalVersionTokenV1;
          };
    })
  | (StoreProviderJournalVersionClaimsCommonV1 & {
      versionState: "sealed";
      predecessor: {
        state: "version";
        token: StoreProviderJournalVersionTokenV1;
      };
      proofTipRecordId: StoreTerminalizationHandoffRecordIdV1;
      proofTipRecordContentDigest: ContentDigest;
    });

interface StoreProviderJournalEnumerationResultV1 {
  profile: "store_provider_journal_enumeration_result_v1";
  enumeration: StoreProviderJournalEnumerationV1;
  versionClaims: StoreProviderJournalVersionClaimsV1;
  versionToken: StoreProviderJournalVersionTokenV1;
}

interface StoreProviderAtomicPublishRequestV1 {
  profile: "store_provider_atomic_publish_request_v1";
  operationNonce: LowerHex32;
  providerPolicyDigest: ContentDigest;
  stagingObjectAuthority: TransientStoreObjectAuthorityV1;
  containment: StoreProviderBoundRootContainmentContextV1;
  finalName: CanonicalInternalBytesV1; // one nonempty canonical component
  expectedFinalState: "absent";
}

interface StoreProviderAtomicPublishDurableRequestProjectionV1 {
  profile: "store_provider_atomic_publish_durable_request_projection_v1";
  operation: "atomic_publish";
  operationNonce: LowerHex32;
  providerPolicyDigest: ContentDigest;
  stagingObjectBinding: StoreDurableObjectBindingV1;
  boundRootBinding: StoreDurableObjectBindingV1;
  destinationParentBinding: StoreDurableObjectBindingV1;
  destinationParent:
    | { kind: "bound_root" }
    | {
        kind: "descendant";
        relativePath: StoreRelativePathV1;
        relativePathComponents: [
          CanonicalInternalBytesV1,
          ...CanonicalInternalBytesV1[]
        ];
        ancestorBindings: [
          StoreDurableObjectBindingV1,
          ...StoreDurableObjectBindingV1[]
        ];
      };
  finalName: CanonicalInternalBytesV1;
  expectedFinalState: "absent";
}

type StoreProviderAtomicPublishFailureV1 =
  | {
      reason: "final_not_absent";
      recoveryDirective: "fatal_conflict";
      successorPolicy: "terminal_no_successor";
    }
  | {
      reason: "root_or_parent_authority_changed";
      recoveryDirective:
        "retry_after_containment_revalidation";
      successorPolicy: "exactly_one_retry_attempt";
    }
  | {
      reason: "parent_not_contained_by_bound_root";
      recoveryDirective:
        "retry_after_containment_revalidation";
      successorPolicy: "exactly_one_retry_attempt";
    }
  | {
      reason: "parent_path_projection_changed";
      recoveryDirective:
        "retry_after_containment_revalidation";
      successorPolicy: "exactly_one_retry_attempt";
    }
  | {
      reason: "staging_authority_changed";
      recoveryDirective: "retry_new_attempt";
      successorPolicy: "exactly_one_retry_attempt";
    }
  | {
      reason: "provider_policy_changed";
      recoveryDirective: "migration_required";
      successorPolicy: "terminal_no_successor";
    };

type StoreProviderAtomicPublishNotCommittedReasonV1 =
  StoreProviderAtomicPublishFailureV1["reason"];

type StoreProviderOperationReceiptClaimsV1 =
  | {
      profile: "store_provider_operation_receipt_claims_v1";
      operation: "atomic_publish";
      operationNonce: LowerHex32;
      providerPolicyDigest: ContentDigest;
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      outcome: "committed";
      finalBinding: StoreDurableObjectBindingV1;
      atomicContainmentProofToken:
        StoreProviderContainmentProofTokenV1;
    }
  | {
      profile: "store_provider_operation_receipt_claims_v1";
      operation: "atomic_publish";
      operationNonce: LowerHex32;
      providerPolicyDigest: ContentDigest;
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      outcome: "not_committed";
      failure: StoreProviderAtomicPublishFailureV1;
    }
  | {
      profile: "store_provider_operation_receipt_claims_v1";
      operation: "atomic_compare_delete";
      operationNonce: LowerHex32;
      providerPolicyDigest: ContentDigest;
      requestDurableProjection:
        StoreProviderCompareDeleteDurableRequestV1;
      outcome: "committed";
      atomicContainmentProofToken:
        StoreProviderContainmentProofTokenV1;
    }
  | {
      profile: "store_provider_operation_receipt_claims_v1";
      operation: "atomic_compare_delete";
      operationNonce: LowerHex32;
      providerPolicyDigest: ContentDigest;
      requestDurableProjection:
        StoreProviderCompareDeleteDurableRequestV1;
      outcome: "not_committed";
      reason: StoreProviderAtomicCompareDeleteNotCommittedReasonV1;
    }
  | {
      profile: "store_provider_operation_receipt_claims_v1";
      operation: "store_manifest_compare_append";
      operationNonce: LowerHex32;
      providerPolicyDigest: ContentDigest;
      requestContentDigest: ContentDigest;
      requestDurableProjection:
        StoreManifestCompareAppendRequestV1;
      durableOutcome:
        StoreManifestCompareAppendDurableOutcomeV1;
      resolvedAt: IsoTimestamp;
    };

type StoreProviderContainmentProofClaimsV1 =
  | {
      profile: "store_provider_containment_proof_claims_v1";
      operation: "atomic_publish";
      operationNonce: LowerHex32;
      providerPolicyDigest: ContentDigest;
      boundRootBinding: StoreDurableObjectBindingV1;
      destinationParentBinding: StoreDurableObjectBindingV1;
      destinationParent:
        StoreProviderAtomicPublishDurableRequestProjectionV1[
          "destinationParent"
        ];
      stagingOrTargetBinding: StoreDurableObjectBindingV1;
      finalOrTargetName: CanonicalInternalBytesV1;
      outcome: "committed";
      finalBinding: StoreDurableObjectBindingV1;
    }
  | {
      profile: "store_provider_containment_proof_claims_v1";
      operation: "atomic_compare_delete";
      operationNonce: LowerHex32;
      providerPolicyDigest: ContentDigest;
      boundRootBinding: StoreDurableObjectBindingV1;
      destinationParentBinding: StoreDurableObjectBindingV1;
      destinationParent:
        StoreProviderCompareDeleteDurableRequestV1[
          "destinationParent"
        ];
      stagingOrTargetBinding: StoreDurableObjectBindingV1;
      finalOrTargetName: CanonicalInternalBytesV1;
      outcome: "committed";
    };

interface StoreProviderOperationReceiptEnvelopeV1 {
  schemaVersion: 1;
  recordType: "store_provider_operation_receipt";
  providerId: DurableObjectIdentityProviderIdV1;
  usage: "operation_receipt";
  keyId: LowerHex22;
  claims: StoreProviderOperationReceiptClaimsV1;
  token: StoreProviderOperationReceiptTokenV1;
}

interface StoreProviderContainmentProofEnvelopeV1 {
  schemaVersion: 1;
  recordType: "store_provider_containment_proof";
  providerId: DurableObjectIdentityProviderIdV1;
  usage: "containment_proof";
  keyId: LowerHex22;
  claims: StoreProviderContainmentProofClaimsV1;
  token: StoreProviderContainmentProofTokenV1;
}

interface StoreProviderAtomicPublishCommittedEvidenceV1 {
  profile: "store_provider_atomic_publish_committed_evidence_v1";
  requestDurableProjection:
    StoreProviderAtomicPublishDurableRequestProjectionV1;
  finalObjectBinding: StoreDurableObjectBindingV1;
  containmentProof: StoreProviderContainmentProofEnvelopeV1 & {
    claims: Extract<
      StoreProviderContainmentProofClaimsV1,
      { operation: "atomic_publish"; outcome: "committed" }
    >;
  };
  operationReceipt: StoreProviderOperationReceiptEnvelopeV1 & {
    claims: Extract<
      StoreProviderOperationReceiptClaimsV1,
      { operation: "atomic_publish"; outcome: "committed" }
    >;
  };
}

type StoreProviderAtomicPublishResultV1 =
  | {
      outcome: "committed";
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      finalObjectBinding: StoreDurableObjectBindingV1;
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    }
  | {
      outcome: "not_committed";
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      failure: StoreProviderAtomicPublishFailureV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    };

interface StoreProviderAtomicCompareDeleteRequestV1 {
  profile: "store_provider_atomic_compare_delete_request_v1";
  operationNonce: LowerHex32;
  providerPolicyDigest: ContentDigest;
  targetObjectAuthority: TransientStoreObjectAuthorityV1;
  containment: StoreProviderBoundRootContainmentContextV1;
  targetName: CanonicalInternalBytesV1; // one nonempty canonical component
}

type StoreProviderAtomicCompareDeleteNotCommittedReasonV1 =
  | "target_not_exact_object"
  | "root_or_parent_authority_changed"
  | "parent_not_contained_by_bound_root"
  | "parent_path_projection_changed"
  | "provider_policy_changed"
  | "delete_disabled";

type StoreProviderAtomicCompareDeleteResultV1 =
  | {
      outcome: "committed";
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    }
  | {
      outcome: "not_committed";
      reason: StoreProviderAtomicCompareDeleteNotCommittedReasonV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    };

interface StoreProviderCompareDeleteDurableRequestV1 {
  profile: "store_provider_compare_delete_durable_request_v1";
  operationNonce: LowerHex32;
  providerPolicyDigest: ContentDigest;
  boundRootBinding: StoreDurableObjectBindingV1;
  destinationParentBinding: StoreDurableObjectBindingV1;
  destinationParent:
    | { kind: "bound_root" }
    | {
        kind: "descendant";
        relativePath: StoreRelativePathV1;
        relativePathComponents: [
          CanonicalInternalBytesV1,
          ...CanonicalInternalBytesV1[]
        ];
        ancestorBindings: [
          StoreDurableObjectBindingV1,
          ...StoreDurableObjectBindingV1[]
        ];
      };
  targetObjectBinding: StoreDurableObjectBindingV1;
  targetName: CanonicalInternalBytesV1;
  authorizationReadSetDigest: ContentDigest;
  requestToken: KeyedStateTokenV1;
}

type StoreProviderCompareDeleteProgressV1 =
  | {
      state: "planned";
      request: StoreProviderCompareDeleteDurableRequestV1;
    }
  | {
      state: "resolved";
      request: StoreProviderCompareDeleteDurableRequestV1;
      outcome: "committed";
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    }
  | {
      state: "resolved";
      request: StoreProviderCompareDeleteDurableRequestV1;
      outcome: "not_committed";
      reason: StoreProviderAtomicCompareDeleteNotCommittedReasonV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    };

interface StoreProviderCompareDeleteRecordCommonV1 {
  profile: "store_provider_compare_delete_record_v1";
  id: StoreProviderCompareDeleteRecordIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  transactionNonce: LowerHex32;
  operationNonce: LowerHex32;
  progressContentDigest: ContentDigest;
  createdAt: IsoTimestamp;
  recordToken: KeyedStateTokenV1;
}

type StoreProviderCompareDeleteRecordV1 =
  | (StoreProviderCompareDeleteRecordCommonV1 & {
      predecessor: { state: "genesis" };
      progress: Extract<
        StoreProviderCompareDeleteProgressV1,
        { state: "planned" }
      >;
    })
  | (StoreProviderCompareDeleteRecordCommonV1 & {
      predecessor: {
        state: "record";
        recordId: StoreProviderCompareDeleteRecordIdV1;
        recordContentDigest: ContentDigest;
      };
      progress: Extract<
        StoreProviderCompareDeleteProgressV1,
        { state: "resolved" }
      >;
    });

interface StoreProviderCompareDeleteRecordEnvelopeV1 {
  schemaVersion: 1;
  recordType: "store_provider_compare_delete_record";
  recordId: StoreProviderCompareDeleteRecordIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: StoreProviderCompareDeleteRecordV1;
}

interface StoreProviderCompareDeletePlanPinV1 {
  locatorProfile: "store_provider_compare_delete_record_v1";
  plannedRecordId: StoreProviderCompareDeleteRecordIdV1;
  plannedRecordContentDigest: ContentDigest;
  operationNonce: LowerHex32;
  requestContentDigest: ContentDigest;
}

interface StoreProviderCompareDeleteResolutionPinCommonV1
  extends StoreProviderCompareDeletePlanPinV1 {
  resolvedRecordId: StoreProviderCompareDeleteRecordIdV1;
  resolvedRecordContentDigest: ContentDigest;
  providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
}

type StoreProviderCompareDeleteResolutionPinV1 =
  | (StoreProviderCompareDeleteResolutionPinCommonV1 & {
      outcome: "committed";
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
    })
  | (StoreProviderCompareDeleteResolutionPinCommonV1 & {
      outcome: "not_committed";
      reason: StoreProviderAtomicCompareDeleteNotCommittedReasonV1;
    });

interface InternalIndexStateUnitV1 {
  pathBytes: RawRepositoryPathBytesV1;
  stage: 0 | 1 | 2 | 3;
  mode: GitModeV1;
  objectId: GitObjectId;
}

interface InternalFilesystemStateUnitV1 {
  pathBytes: RawRepositoryPathBytesV1;
  kind:
    | "absent"
    | "regular"
    | "directory"
    | "symlink"
    | "gitlink"
    | "special"
    | "unreadable";
  mode?: GitModeV1;
  size?: number;
  fileIdentity?: CanonicalFileIdentityV1;
  mtimeNanoseconds?: CanonicalUnsignedDecimalV1;
  ctimeNanoseconds?: CanonicalUnsignedDecimalV1;
  contentState:
    | { status: "safe_scanned"; contentDigest: ContentDigest }
    | {
        status: "secret_redacted_scanned";
        contentEqualityToken: KeyedStateTokenV1;
      }
    | { status: "git_object"; objectId: GitObjectId }
    | { status: "not_read_hard_deny" }
    | { status: "scan_unit_limit" }
    | { status: "scan_capture_limit" }
    | { status: "unstable" }
    | { status: "unreadable" }
    | { status: "unavailable" };
}

interface InternalIgnoreStateUnitV1 {
  scope: "repository" | "git_info";
  pathBytes: RawRepositoryPathBytesV1;
  status: "present" | "absent" | "unreadable";
  contentDigest?: ContentDigest;
}

type CanonicalBranchBytesV1 = `base64url:${string}`; // decoded 1..1024 bytes

type InternalBranchStateV1 =
  | { status: "detached" }
  | { status: "named"; bytes: CanonicalBranchBytesV1 };

interface InternalGitConfigStateUnitV1 {
  scope: "common" | "worktree";
  section: CanonicalInternalBytesV1;
  subsection?: CanonicalInternalBytesV1;
  name: CanonicalInternalBytesV1;
  normalizedValue: CanonicalInternalBytesV1;
}

interface InternalDirectoryEntryStateUnitV1 {
  name: CanonicalInternalBytesV1;
  kind: "regular" | "directory" | "symlink" | "special";
  fileIdentity: CanonicalFileIdentityV1;
}

interface InternalSafeGitExecutableBindingV1 {
  fileIdentity: CanonicalFileIdentityV1;
  ownerIdentity: CanonicalInternalBytesV1;
  mode: CanonicalUnsignedDecimalV1;
  size: CanonicalUnsignedDecimalV1;
  binaryDigest: ContentDigest;
}

interface InternalSafeGitBootstrapBindingV1 {
  workspaceRootBytes: CanonicalInternalBytesV1;
  workspaceRootIdentity: CanonicalFileIdentityV1;
  gitDirBytes: CanonicalInternalBytesV1;
  gitDirIdentity: CanonicalFileIdentityV1;
  commonGitDirBytes: CanonicalInternalBytesV1;
  commonGitDirIdentity: CanonicalFileIdentityV1;
  dotGitControlIdentity: CanonicalFileIdentityV1;
}

interface InternalSafeGitLinkedWorktreeBindingV1 {
  worktreeGitFileBytes: CanonicalByteStringV1;
  worktreeGitFileIdentity: CanonicalFileIdentityV1;
  adminGitDirFileBytes: CanonicalByteStringV1;
  adminGitDirFileIdentity: CanonicalFileIdentityV1;
  commonDirFileBytes: CanonicalByteStringV1;
  commonDirFileIdentity: CanonicalFileIdentityV1;
}

interface InternalSafeGitObjectDatabaseLayoutV1 {
  objectFormat: "sha1" | "sha256";
  objectDirectoryBytes: CanonicalInternalBytesV1;
  objectDirectoryIdentity: CanonicalFileIdentityV1;
  infoDirectoryIdentity: CanonicalFileIdentityV1;
  packDirectoryIdentity: CanonicalFileIdentityV1;
  layoutEntries: InternalDirectoryEntryStateUnitV1[];
}

interface InternalSafeGitRefBackendLayoutV1 {
  backend: "files";
  refsDirectoryIdentity: CanonicalFileIdentityV1;
  packedRefsState:
    | { status: "absent" }
    | {
        status: "present";
        fileIdentity: CanonicalFileIdentityV1;
        contentDigest: ContentDigest;
      };
  productNamespaceState:
    | { status: "absent" }
    | {
        status: "present";
        directoryIdentity: CanonicalFileIdentityV1;
      };
}

interface InstallationIdentityInitializationMarkerV1 {
  profile: "installation_identity_initialization_marker_v1";
  initializationNonce: LowerHex32;
  phase: "planned" | "key_published" | "state_published";
  keyLogicalName: "installation-identity-v1.key";
  stateLogicalName: "installation-identity-v1.json";
  createdAt: IsoTimestamp;
}

type InstallationStateResolverIdV1 =
  | "macos_user_application_support_api_v1"
  | "linux_effective_uid_passwd_state_v1"
  | "windows_local_app_data_known_folder_v1";

interface InstallationIdentityStateV1 {
  profile: "installation_identity_state_v1";
  generationId: InstallationIdentityGenerationIdV1;
  initializationNonce: LowerHex32;
  resolverId: InstallationStateResolverIdV1;
  bootstrapOriginDistributionRootBinding:
    ProviderSignedDistributionRootBindingV1;
  bootstrapTrustBundle:
    ProviderBootstrapTrustBundlePinV1;
  bootstrapTrustBundleEnvelope:
    ProviderBootstrapTrustBundleEnvelopeV1;
  strictEd25519AdversarialManifestEnvelope:
    ProviderStrictEd25519AdversarialManifestEnvelopeV1;
    // 三者必须与 original verified signed distribution exact闭合，永不升级改写
  providerMigrationHistoryQuotaHighWaterLocatorProfile:
    "installation_provider_migration_history_quota_high_water_v1";
  providerAcceptanceStateLocatorProfile:
    "installation_provider_acceptance_state_v1";
  providerAcceptanceHighWaterLocatorProfile:
    "installation_provider_acceptance_high_water_v1";
  stateRootFileIdentity: CanonicalFileIdentityV1;
  stateRootBindingToken: KeyedStateTokenV1;
  keyCheckToken: KeyedStateTokenV1;
  createdAt: IsoTimestamp;
}

interface InstallationIdentityStateEnvelopeV1 {
  schemaVersion: 1;
  recordType: "installation_identity_state";
  generationId: InstallationIdentityGenerationIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: InstallationIdentityStateV1;
}

interface ProviderActiveWriterSelectionV1 {
  targetProfileId: ProviderTargetProfileIdV1;
  providerId: DurableObjectIdentityProviderIdV1;
  registryEntryContentDigest: ContentDigest;
  semanticProviderPolicyDigest: ContentDigest;
  providerFeasibilityEvidence: ProviderFeasibilityEvidencePinV1;
  runtimeAttestationContentDigest: ContentDigest;
  bindingDerivationKeyGeneration: number; // integer >=1
}

interface ProviderActiveWriterSelectorV1 {
  profile: "provider_active_writer_selector_v1";
  selections: [
    ProviderActiveWriterSelectionV1,
    ...ProviderActiveWriterSelectionV1[]
  ]; // targetProfileId UTF-8 bytewise sorted + unique
}

interface InstallationIdentityStatePinV1 {
  locatorProfile: "installation_identity_state_v1";
  generationId: InstallationIdentityGenerationIdV1;
  contentDigest: ContentDigest;
}

interface ProviderAcceptanceCurrentPinV1 {
  highWaterLocatorProfile:
    "installation_provider_acceptance_high_water_v1";
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  acceptance: ProviderAcceptanceGenerationPinV1;
  highWaterRevision: number;
  highWaterContentDigest: ContentDigest;
  currentVersionToken: ProviderAcceptanceCurrentVersionTokenV1;
  generationCount: number;
  generationSetDigest: ContentDigest;
  acceptedGenerationFloors: {
    rootMetadataGeneration: number;
    registryManifestGeneration: number;
    supportCatalogGeneration: number;
  };
}

interface ProviderMigrationActiveSelectorMembershipV1 {
  selectionOrdinal: number; // integer >=0
  selection: ProviderActiveWriterSelectionV1;
}

interface ProviderMigrationRegistryCatalogMembershipV1 {
  registryManifest: ProviderRegistryManifestPinV1;
  registryMemberOrdinal: number; // integer >=0
  registryMember: Extract<
    ProviderRegistryManifestMemberV1,
    { disposition: "enabled" }
  >;
  supportCatalog: ProviderFeasibilitySupportCatalogPinV1;
  catalogTargetOrdinal: number; // integer >=0
  catalogCandidateOrdinal: number; // integer >=0
  target: ProviderFeasibilityTargetV1;
  candidate: ProviderFeasibilitySupportCandidateV1;
}

interface ProviderMigrationWriterSelectorPinCommonV1 {
  selectorContentDigest: ContentDigest;
  selector: ProviderActiveWriterSelectorV1;
  selectedWriter: ProviderActiveWriterSelectionV1;
}

type ProviderMigrationWriterSelectorPinV1 =
  | (ProviderMigrationWriterSelectorPinCommonV1 & {
      authorization: {
        kind: "current_strong_writer";
        currentAcceptance: ProviderAcceptanceCurrentPinV1;
        selectorMembership:
          ProviderMigrationActiveSelectorMembershipV1;
        executorScope: "migration_executor_only";
      };
    })
  | (ProviderMigrationWriterSelectorPinCommonV1 & {
      authorization: {
        kind: "historical_read_only_source";
        historicalStrongAcceptance:
          ProviderAcceptanceGenerationPinV1;
        retainedByCurrentHighWater:
          ProviderAcceptanceCurrentPinV1;
        selectorMembership:
          ProviderMigrationActiveSelectorMembershipV1;
        executorScope:
          "migration_executor_source_read_revalidate_only";
      };
    })
  | (ProviderMigrationWriterSelectorPinCommonV1 & {
      authorization: {
        kind: "validated_migration_destination";
        currentAcceptance: ProviderAcceptanceCurrentPinV1;
        registryCatalogMembership:
          ProviderMigrationRegistryCatalogMembershipV1;
        selectorDisposition: "not_selected_for_target";
        executorScope:
          "migration_executor_destination_publish_only";
      };
    });

interface ProviderMigrationEndpointTrustPinV1 {
  installationIdentity: InstallationIdentityStatePinV1;
  prePlanAcceptance: ProviderAcceptanceCurrentPinV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  providerRegistryManifest: ProviderRegistryManifestPinV1;
  providerSupportCatalog: ProviderFeasibilitySupportCatalogPinV1;
  writerSelector: ProviderMigrationWriterSelectorPinV1;
  trustClosureContentDigest: ContentDigest;
}

interface StoreManifestCurrentVersionPinV1 {
  locatorProfile: "store_manifest_namespace_head_v1";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  namespaceRevision: number;
  headContentDigest: ContentDigest;
  currentVersionToken: StoreManifestNamespaceVersionTokenV1;
  generationCount: number;
  generationSetDigest: ContentDigest;
  currentGeneration: StoreManifestGenerationPinV1;
}

interface ProviderMigrationNamespaceIdentityV1 {
  installationIdentity: InstallationIdentityStatePinV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
}

interface ProviderMigrationNamespaceTranslationCommonV1 {
  sourceNamespace: ProviderMigrationNamespaceIdentityV1;
  destinationNamespace: ProviderMigrationNamespaceIdentityV1;
  translationContentDigest: ContentDigest;
}

type ProviderMigrationNamespaceTranslationV1 =
  | (ProviderMigrationNamespaceTranslationCommonV1 & {
      mode: "same_installation_identity";
      relationship:
        "same_identity_repository_and_worktree_exact_equal";
      journalAuthorityToken:
        ProviderMigrationNamespaceTranslationTokenV1;
    })
  | (ProviderMigrationNamespaceTranslationCommonV1 & {
      mode: "cross_installation_rebootstrap";
      relationship:
        "same_opened_repository_rederived_under_distinct_identity_keys";
      sourceRecoveryOnlyAcceptance:
        ProviderAcceptanceCurrentPinV1;
      destinationPrePlanAcceptance:
        ProviderAcceptanceCurrentPinV1;
      sourceAuthorizationToken:
        ProviderMigrationNamespaceTranslationTokenV1;
      destinationAuthorizationToken:
        ProviderMigrationNamespaceTranslationTokenV1;
    });

interface ProviderMigrationHistoryQuotaChargeAmountsV1 {
  reservedHistoryLogicalBytes: number;
  reservedHistoryProviderAllocatedBytes: number;
  reservedObjectReceiptCount: number;
  reservedObjectReceiptLogicalBytes: number;
  reservedSemanticRootZeroProofCount: number;
  reservedSemanticRootZeroProofLogicalBytes: number;
  reservedProgressRecordCount: number;
  reservedProgressRecordLogicalBytes: number;
  reservedProgressOperationReceiptCount: number;
  reservedProgressOperationReceiptLogicalBytes: number;
}

interface ProviderMigrationHistoryQuotaZeroChargeAmountsV1 {
  reservedHistoryLogicalBytes: 0;
  reservedHistoryProviderAllocatedBytes: 0;
  reservedObjectReceiptCount: 0;
  reservedObjectReceiptLogicalBytes: 0;
  reservedSemanticRootZeroProofCount: 0;
  reservedSemanticRootZeroProofLogicalBytes: 0;
  reservedProgressRecordCount: 0;
  reservedProgressRecordLogicalBytes: 0;
  reservedProgressOperationReceiptCount: 0;
  reservedProgressOperationReceiptLogicalBytes: 0;
}

type ProviderMigrationHistoryQuotaRoleV1 =
  | "same_identity_journal"
  | "cross_source_anchor"
  | "cross_destination_journal";

interface ProviderMigrationHistoryQuotaChargeCommonV1 {
  installationIdentity: InstallationIdentityStatePinV1;
  policyDigest: ContentDigest;
  migrationSlotCount: 1;
}

type ProviderMigrationHistoryQuotaChargeV1 =
  | (ProviderMigrationHistoryQuotaChargeCommonV1 &
      ProviderMigrationHistoryQuotaChargeAmountsV1 & {
        role: "same_identity_journal";
      })
  | (ProviderMigrationHistoryQuotaChargeCommonV1 &
      ProviderMigrationHistoryQuotaZeroChargeAmountsV1 & {
        role: "cross_source_anchor";
      })
  | (ProviderMigrationHistoryQuotaChargeCommonV1 &
      ProviderMigrationHistoryQuotaChargeAmountsV1 & {
        role: "cross_destination_journal";
      });

interface ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 {
  artifactKind: ProviderMigrationHistoryArtifactKindV1;
  artifactCount: number; // nonnegative safe integer
  canonicalEnvelopeBytesUpperBoundTotal: number;
  providerAllocatedBytesUpperBoundTotal: number;
}

type ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundsV1 = [
  ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 & {
    artifactKind: "canonical_rewrite_plan";
  },
  ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 & {
    artifactKind: "destination_universe";
  },
  ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 & {
    artifactKind: "migration_plan";
  },
  ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 & {
    artifactKind: "object_receipt";
  },
  ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 & {
    artifactKind: "progress_operation_receipt";
  },
  ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 & {
    artifactKind: "progress_record";
  },
  ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 & {
    artifactKind: "sealed_progress_head";
  },
  ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 & {
    artifactKind: "semantic_equivalence_proof";
  },
  ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 & {
    artifactKind: "source_tombstone";
  },
  ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 & {
    artifactKind: "source_universe";
  },
  ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundV1 & {
    artifactKind: "zero_live_proof";
  }
];

interface ProviderMigrationHistoryQuotaSourceDryRunCutV1 {
  profile:
    "provider_migration_history_quota_source_dry_run_cut_v1";
  mode:
    | "same_installation_identity"
    | "cross_installation_rebootstrap";
  sourceInstallationIdentity:
    InstallationIdentityStatePinV1;
  sourceTrustClosureContentDigest: ContentDigest;
  sourceStoreManifest: StoreManifestCurrentVersionPinV1;
  sourceProviderFreezeStateVersionToken:
    StoreProviderStateVersionTokenV1;
  liveReferenceSchemaDigest: ContentDigest;
  migrationBudgetsDigest: ContentDigest;
  rootCount: number;
  rootSetDigest: ContentDigest;
  canonicalRootSetBytes: number;
  objectCount: number;
  objectSetDigest: ContentDigest;
  canonicalObjectSetBytes: number;
  logicalObjectBytesTotal: number;
  referenceCount: number;
  referenceSetDigest: ContentDigest;
  canonicalReferenceSetBytes: number;
  canonicalUniverseBytes: number;
  activeTransactions: [];
  retainedArtifactUpperBounds:
    ProviderMigrationHistoryQuotaDryRunArtifactUpperBoundsV1;
  derivedJournalChargeAmounts:
    ProviderMigrationHistoryQuotaChargeAmountsV1;
}

interface ProviderMigrationHistoryQuotaSizingV1 {
  profile: "provider_migration_history_quota_sizing_v1";
  sizingProfile:
    "zero_side_effect_complete_source_dry_run_v1";
  mode:
    | "same_installation_identity"
    | "cross_installation_rebootstrap";
  migrationBudgetsDigest: ContentDigest;
  sourceDryRunCut:
    ProviderMigrationHistoryQuotaSourceDryRunCutV1;
  sourceDryRunCutContentDigest: ContentDigest;
  journalChargeAmounts:
    ProviderMigrationHistoryQuotaChargeAmountsV1;
}

type ProviderMigrationHistoryQuotaAdmissionV1 =
  | {
      profile: "provider_migration_history_quota_admission_v1";
      mode: "same_installation_identity";
      admissionClass: "normal" | "emergency_recovery";
      sizingDigest: ContentDigest;
      charges: [
        Extract<
          ProviderMigrationHistoryQuotaChargeV1,
          { role: "same_identity_journal" }
        >
      ];
    }
  | {
      profile: "provider_migration_history_quota_admission_v1";
      mode: "cross_installation_rebootstrap";
      admissionClass: "emergency_recovery";
      sizingDigest: ContentDigest;
      charges: [
        Extract<
          ProviderMigrationHistoryQuotaChargeV1,
          { role: "cross_source_anchor" }
        >,
        Extract<
          ProviderMigrationHistoryQuotaChargeV1,
          { role: "cross_destination_journal" }
        >
      ];
    };

interface ProviderMigrationHistoryQuotaReservationDescriptorV1 {
  locatorProfile:
    "installation_provider_migration_history_quota_reservation_v1";
  reservationId:
    ProviderMigrationHistoryQuotaReservationIdV1;
  installationIdentity: InstallationIdentityStatePinV1;
  role: ProviderMigrationHistoryQuotaChargeV1["role"];
  admissionVectorDigest: ContentDigest;
}

interface ProviderMigrationHistoryQuotaReservationPinV1
  extends ProviderMigrationHistoryQuotaReservationDescriptorV1 {
  contentDigest: ContentDigest;
  candidatePlanContentDigest: ContentDigest;
  reservationToken:
    ProviderMigrationHistoryQuotaReservationTokenV1;
}

interface ProviderMigrationPlanCommonV1 {
  profile: "provider_migration_plan_v1";
  migrationId: ProviderMigrationIdV1;
  sourceNamespace: ProviderMigrationNamespaceIdentityV1;
  destinationNamespace: ProviderMigrationNamespaceIdentityV1;
  targetProfileId: ProviderTargetProfileIdV1;
  sourceTrust: ProviderMigrationEndpointTrustPinV1;
  destinationTrust: ProviderMigrationEndpointTrustPinV1;
  initialSourceStoreManifest: StoreManifestCurrentVersionPinV1;
  initialDestinationNamespace:
    | {
        state: "absent";
        expectedNamespaceState: "absent";
      }
    | {
        state: "current";
        current: StoreManifestCurrentVersionPinV1;
      };
  journalAuthorityInstallationIdentity:
    InstallationIdentityStatePinV1;
  progressJournalLocatorProfile:
    "installation_provider_migration_progress_head_v1";
  migrationBudgets: {
    maxRootEntries: number; // integer 1..65_536
    maxLiveObjects: number; // integer 1..1_000_000
    maxReferenceEdges: number; // integer 1..4_000_000
    maxRewriteObjects: number; // integer 1..1_000_000
    maxRewriteReferenceMappings: number;
      // integer 1..4_000_000
    maxRewriteSccs: number; // integer 1..1_000_000
    maxLogicalObjectBytesTotal: number;
      // integer 1..4_398_046_511_104
    maxProgressRecords: number; // integer 1..2_000_016
    maxProgressOperationReceipts: number;
      // integer 1..4_000_000
    maxCanonicalUniverseBytes: number;
      // integer 1..1_073_741_824
    maxCanonicalReferenceSetBytes: number;
      // integer 1..1_073_741_824
    maxCanonicalRewritePlanBytes: number;
      // integer 1..1_073_741_824
    maxCanonicalRewrittenReferenceSetBytesTotal: number;
      // integer 1..1_073_741_824
    maxCanonicalSemanticEquivalenceProofBytesTotal: number;
      // integer 1..1_073_741_824
    maxCanonicalRootRewriteProofSetBytes: number;
      // integer 1..1_073_741_824
    maxCanonicalZeroLiveProofBytes: number;
      // integer 1..1_073_741_824
    maxCanonicalReceiptBytesTotal: number;
      // integer 1..1_073_741_824
    maxCanonicalProgressRecordSetBytes: number;
      // integer 1..1_073_741_824
    maxCanonicalProgressOperationReceiptBytesTotal: number;
      // integer 1..1_073_741_824
    maxCanonicalMigrationBytesTotal: number;
      // integer 1..4_294_967_296
    maxRetainedMigrationHistoryLogicalBytesTotal: number;
      // integer 1..4_294_967_296
    maxRetainedMigrationHistoryProviderAllocatedBytesTotal: number;
      // integer 1..8_589_934_592
    maxSingleRecordBytes: 4_194_304;
  };
  migrationHistoryQuotaSizing:
    ProviderMigrationHistoryQuotaSizingV1;
  migrationHistoryQuotaSizingDigest: ContentDigest;
  migrationHistoryQuotaAdmission:
    ProviderMigrationHistoryQuotaAdmissionV1;
  migrationHistoryQuotaReservations:
    | {
        mode: "same_installation_identity";
        journal:
          ProviderMigrationHistoryQuotaReservationDescriptorV1;
      }
    | {
        mode: "cross_installation_rebootstrap";
        source:
          ProviderMigrationHistoryQuotaReservationDescriptorV1;
        destination:
          ProviderMigrationHistoryQuotaReservationDescriptorV1;
      };
  liveReferenceSchemaDigest: ContentDigest;
  migrationProtocolDigest: ContentDigest;
  createdAt: IsoTimestamp;
}

type ProviderMigrationPlanV1 =
  | (ProviderMigrationPlanCommonV1 & {
      mode: "same_installation_identity";
      reason:
        | "semantic_policy_change"
        | "binding_derivation_secret_compromise"
        | "provider_decommission"
        | "post_root_compromise_rebind";
      identityRelationship: "source_destination_exact_same";
      migrationHistoryQuotaSizing:
        ProviderMigrationHistoryQuotaSizingV1 & {
          mode: "same_installation_identity";
          sourceDryRunCut:
            ProviderMigrationHistoryQuotaSourceDryRunCutV1 & {
              mode: "same_installation_identity";
            };
        };
      migrationHistoryQuotaAdmission: Extract<
        ProviderMigrationHistoryQuotaAdmissionV1,
        { mode: "same_installation_identity" }
      >;
      migrationHistoryQuotaReservations: {
        mode: "same_installation_identity";
        journal:
          ProviderMigrationHistoryQuotaReservationDescriptorV1 & {
            role: "same_identity_journal";
          };
      };
      namespaceTranslation: Extract<
        ProviderMigrationNamespaceTranslationV1,
        { mode: "same_installation_identity" }
      >;
    })
  | (ProviderMigrationPlanCommonV1 & {
      mode: "cross_installation_rebootstrap";
      reason: "recovery_key_compromise_rebootstrap";
      identityRelationship: "source_destination_must_differ";
      migrationHistoryQuotaSizing:
        ProviderMigrationHistoryQuotaSizingV1 & {
          mode: "cross_installation_rebootstrap";
          sourceDryRunCut:
            ProviderMigrationHistoryQuotaSourceDryRunCutV1 & {
              mode: "cross_installation_rebootstrap";
            };
        };
      migrationHistoryQuotaAdmission: Extract<
        ProviderMigrationHistoryQuotaAdmissionV1,
        { mode: "cross_installation_rebootstrap" }
      >;
      migrationHistoryQuotaReservations: {
        mode: "cross_installation_rebootstrap";
        source:
          ProviderMigrationHistoryQuotaReservationDescriptorV1 & {
            role: "cross_source_anchor";
          };
        destination:
          ProviderMigrationHistoryQuotaReservationDescriptorV1 & {
            role: "cross_destination_journal";
          };
      };
      namespaceTranslation: Extract<
        ProviderMigrationNamespaceTranslationV1,
        { mode: "cross_installation_rebootstrap" }
      >;
      sourceRecoveryOnlyAcceptance:
        ProviderAcceptanceCurrentPinV1;
      destinationRebootstrapBundleDigest: ContentDigest;
      sourceIdentityRetirementPolicyDigest: ContentDigest;
    });

interface ProviderMigrationPlanPinV1 {
  locatorProfile: "installation_provider_migration_plan_v1";
  migrationId: ProviderMigrationIdV1;
  mode:
    | "same_installation_identity"
    | "cross_installation_rebootstrap";
  contentDigest: ContentDigest;
}

interface ProviderMigrationPlanEnvelopeCommonV1 {
  schemaVersion: 1;
  recordType: "provider_migration_plan";
  migrationId: ProviderMigrationIdV1;
  sourceRepositoryId: PathSafeRepositoryIdV1;
  sourceWorktreeId: PathSafeWorktreeIdV1;
  destinationRepositoryId: PathSafeRepositoryIdV1;
  destinationWorktreeId: PathSafeWorktreeIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
}

type ProviderMigrationPlanEnvelopeV1 =
  | (ProviderMigrationPlanEnvelopeCommonV1 & {
      mode: "same_installation_identity";
      payload: Extract<
        ProviderMigrationPlanV1,
        { mode: "same_installation_identity" }
      >;
    })
  | (ProviderMigrationPlanEnvelopeCommonV1 & {
      mode: "cross_installation_rebootstrap";
      payload: Extract<
        ProviderMigrationPlanV1,
        { mode: "cross_installation_rebootstrap" }
      >;
    });

type ProviderMigrationSameIdentityPlanEnvelopeV1 = Extract<
  ProviderMigrationPlanEnvelopeV1,
  { mode: "same_installation_identity" }
>;

type ProviderMigrationCrossInstallationPlanEnvelopeV1 = Extract<
  ProviderMigrationPlanEnvelopeV1,
  { mode: "cross_installation_rebootstrap" }
>;

interface ProviderMigrationHistoryQuotaCommittedReceiptBindingV1 {
  migrationId: ProviderMigrationIdV1;
  reservationId:
    ProviderMigrationHistoryQuotaReservationIdV1;
  migrationPlanContentDigest: ContentDigest;
}

interface ProviderMigrationHistoryQuotaCancellationReceiptBindingV1 {
  migrationId: ProviderMigrationIdV1;
  reservationId:
    ProviderMigrationHistoryQuotaReservationIdV1;
  candidatePlanContentDigest: ContentDigest;
}

interface ProviderMigrationHistoryQuotaRetainedReleaseReceiptBindingV1 {
  migrationId: ProviderMigrationIdV1;
  reservationId:
    ProviderMigrationHistoryQuotaReservationIdV1;
  migrationPlanContentDigest: ContentDigest;
}

type ProviderMigrationHistoryQuotaCommittedReceiptSetV1 =
  | {
      mode: "same_installation_identity";
      journalCommit:
        ProviderMigrationHistoryQuotaOperationReceiptPinCommonV1 &
        ProviderMigrationHistoryQuotaCommittedReceiptBindingV1 & {
          role: "same_identity_journal";
          operation: "compare_commit";
          commitKind: "commit_retained_history";
          outcome: "committed";
        };
    }
  | {
      mode: "cross_installation_rebootstrap";
      destinationCommit:
        ProviderMigrationHistoryQuotaOperationReceiptPinCommonV1 &
        ProviderMigrationHistoryQuotaCommittedReceiptBindingV1 & {
          role: "cross_destination_journal";
          operation: "compare_commit";
          commitKind: "commit_retained_history";
          outcome: "committed";
        };
      sourceCommit:
        ProviderMigrationHistoryQuotaOperationReceiptPinCommonV1 &
        ProviderMigrationHistoryQuotaCommittedReceiptBindingV1 & {
          role: "cross_source_anchor";
          operation: "compare_commit";
          commitKind: "commit_cross_source_anchor";
          outcome: "committed";
        };
    };

interface ProviderMigrationStrongReadyCoreV1 {
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  providerRegistryManifest: ProviderRegistryManifestPinV1;
  providerSupportCatalog: ProviderFeasibilitySupportCatalogPinV1;
  activeWriterSelector: ProviderActiveWriterSelectorV1;
}

type ProviderStrongReadyActivationV1 =
  | {
      origin: "bootstrap_or_steady_successor";
    }
  | {
      origin: "completed_provider_migration";
      migrationPlan:
        ProviderMigrationPlanPinV1 & {
          mode: "same_installation_identity";
        };
      sealedProgressHead: ProviderMigrationSealedProgressHeadPinV1;
      migrationHistoryQuotaCommits:
        Extract<
          ProviderMigrationHistoryQuotaCommittedReceiptSetV1,
          { mode: "same_installation_identity" }
        >;
    }
  | {
      origin: "completed_provider_migration";
      migrationPlan:
        ProviderMigrationPlanPinV1 & {
          mode: "cross_installation_rebootstrap";
        };
      sealedProgressHead: ProviderMigrationSealedProgressHeadPinV1;
      migrationHistoryQuotaCommits:
        Extract<
          ProviderMigrationHistoryQuotaCommittedReceiptSetV1,
          { mode: "cross_installation_rebootstrap" }
        >;
    };

type ProviderAcceptedConfigurationV1 =
  | {
      state: "strong_ready";
      core: ProviderMigrationStrongReadyCoreV1;
      activation: ProviderStrongReadyActivationV1;
    }
  | {
      state: "migration_only";
      reason:
        | "semantic_policy_change"
        | "binding_derivation_secret_compromise"
        | "provider_decommission"
        | "post_root_compromise_rebind"
        | "recovery_key_compromise_rebootstrap";
      activeRootMetadata: ProviderRegistryRootMetadataPinV1;
      providerRegistryManifest: ProviderRegistryManifestPinV1;
      providerSupportCatalog: ProviderFeasibilitySupportCatalogPinV1;
      publicStrongWriter: { state: "disabled" };
      migrationPlan: ProviderMigrationPlanPinV1;
      migrationExecutor: {
        state: "enabled_for_plan_only";
        journalAuthorityInstallationIdentity:
          InstallationIdentityStatePinV1;
        sourceWriter: ProviderActiveWriterSelectionV1;
        destinationWriter: ProviderActiveWriterSelectionV1;
      };
    }
  | {
      state: "recovery_only";
      reason:
        | "root_compromise_pending_resign_or_migration"
        | "recovery_key_compromise_requires_new_installation_identity";
      activeRootMetadata: ProviderRegistryRootMetadataPinV1;
      lastAcceptedProviderRegistryManifest:
        ProviderRegistryManifestPinV1;
      lastAcceptedProviderSupportCatalog:
        ProviderFeasibilitySupportCatalogPinV1;
      publicStrongWriter: { state: "disabled" };
    };

interface ProviderAcceptanceStateV1 {
  profile: "provider_acceptance_state_v1";
  generationId: ProviderAcceptanceStateGenerationIdV1;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  acceptanceOrdinal: number; // integer >=1
  predecessor:
    | { state: "genesis" }
    | {
        state: "acceptance";
        generationId: ProviderAcceptanceStateGenerationIdV1;
        contentDigest: ContentDigest;
      };
  configuration: ProviderAcceptedConfigurationV1;
  acceptedAt: IsoTimestamp;
  acceptanceToken: KeyedStateTokenV1;
}

interface ProviderAcceptanceStateEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_acceptance_state";
  generationId: ProviderAcceptanceStateGenerationIdV1;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  acceptedAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderAcceptanceStateV1;
}

interface ProviderAcceptanceGenerationPinV1 {
  locatorProfile: "installation_provider_acceptance_state_v1";
  acceptanceOrdinal: number; // integer >=1
  generationId: ProviderAcceptanceStateGenerationIdV1;
  contentDigest: ContentDigest;
}

interface ProviderAcceptanceGenerationEnumerationEntryV1
  extends ProviderAcceptanceGenerationPinV1 {
  commitOperationNonce: LowerHex32;
  predecessor:
    | { state: "genesis" }
    | {
        state: "acceptance";
        generationId: ProviderAcceptanceStateGenerationIdV1;
        contentDigest: ContentDigest;
      };
}

interface ProviderAcceptanceGenerationEnumerationV1 {
  profile: "provider_acceptance_generation_enumeration_v1";
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  namespaceRevision: number; // integer >=1, exact-equal highWaterRevision
  entries: [
    ProviderAcceptanceGenerationEnumerationEntryV1,
    ...ProviderAcceptanceGenerationEnumerationEntryV1[]
  ]; // acceptanceOrdinal asc, then generationId UTF-8 bytewise; strict unique
  generationCount: number; // integer >=1
  generationSetDigest: ContentDigest;
}

interface ProviderAcceptanceHighWaterV1 {
  profile: "provider_acceptance_high_water_v1";
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  highWaterRevision: number; // integer >=1, exact-equal current ordinal
  operationNonce: LowerHex32;
  predecessor:
    | {
        state: "genesis";
        expectedNamespaceState: "absent";
      }
    | {
        state: "version";
        highWaterRevision: number;
        contentDigest: ContentDigest;
        currentVersionToken:
          ProviderAcceptanceCurrentVersionTokenV1;
      };
  currentAcceptance: ProviderAcceptanceGenerationPinV1;
  generationCount: number;
  generationSetDigest: ContentDigest;
  acceptedGenerationFloors: {
    rootMetadataGeneration: number;
    registryManifestGeneration: number;
    supportCatalogGeneration: number;
  };
}

interface ProviderAcceptanceHighWaterEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_acceptance_high_water";
  locatorProfile: "installation_provider_acceptance_high_water_v1";
  contentDigest: ContentDigest;
  currentVersionToken: ProviderAcceptanceCurrentVersionTokenV1;
  payload: ProviderAcceptanceHighWaterV1;
}

interface ProviderAcceptanceCurrentReadV1 {
  profile: "provider_acceptance_current_read_v1";
  highWater: ProviderAcceptanceHighWaterEnvelopeV1;
  enumeration: ProviderAcceptanceGenerationEnumerationV1;
}

interface ProviderAcceptanceCompareAppendRequestV1 {
  profile: "provider_acceptance_compare_append_request_v1";
  operationNonce: LowerHex32;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  expected:
    | {
        state: "genesis";
        expectedNamespaceState: "absent";
      }
    | {
        state: "current";
        highWaterRevision: number;
        highWaterContentDigest: ContentDigest;
        currentVersionToken:
          ProviderAcceptanceCurrentVersionTokenV1;
        generationCount: number;
        generationSetDigest: ContentDigest;
      };
  candidate: ProviderAcceptanceStateEnvelopeV1;
}

type ProviderAcceptanceObservedHighWaterV1 =
  | { state: "absent" }
  | {
      state: "trusted";
      highWater: ProviderAcceptanceHighWaterEnvelopeV1;
    }
  | {
      state: "integrity_failed";
      evidenceDigest: ContentDigest;
    };

type ProviderAcceptanceCompareAppendDurableOutcomeV1 =
  | {
      outcome: "committed";
      committedHighWater:
        ProviderAcceptanceHighWaterEnvelopeV1;
      appendedGeneration:
        ProviderAcceptanceGenerationEnumerationEntryV1;
    }
  | {
      outcome: "not_committed";
      reason:
        | "expected_current_changed"
        | "candidate_invalid"
        | "generation_floor_regressed"
        | "namespace_integrity_failed";
      observedHighWater:
        ProviderAcceptanceObservedHighWaterV1;
    };

interface ProviderAcceptanceCompareAppendReceiptV1 {
  profile: "provider_acceptance_compare_append_receipt_v1";
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  operationNonce: LowerHex32;
  requestContentDigest: ContentDigest;
  requestDurableProjection:
    ProviderAcceptanceCompareAppendRequestV1;
  durableOutcome:
    ProviderAcceptanceCompareAppendDurableOutcomeV1;
  resolvedAt: IsoTimestamp;
  receiptToken:
    ProviderAcceptanceCompareAppendReceiptTokenV1;
}

interface ProviderAcceptanceCompareAppendReceiptEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_acceptance_compare_append_receipt";
  locatorProfile:
    "installation_provider_acceptance_compare_append_receipt_v1";
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  operationNonce: LowerHex32;
  resolvedAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderAcceptanceCompareAppendReceiptV1;
}

interface ProviderAcceptanceCompareAppendReceiptPinV1 {
  locatorProfile:
    "installation_provider_acceptance_compare_append_receipt_v1";
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  operationNonce: LowerHex32;
  contentDigest: ContentDigest;
  receiptToken:
    ProviderAcceptanceCompareAppendReceiptTokenV1;
}

type ProviderAcceptanceCompareAppendResultV1 =
  | {
      resolution: "resolved";
      receipt:
        ProviderAcceptanceCompareAppendReceiptEnvelopeV1;
    }
  | {
      resolution: "request_rejected";
      reason: "operation_nonce_request_mismatch";
      existingReceipt:
        ProviderAcceptanceCompareAppendReceiptEnvelopeV1;
    };

interface ProviderMigrationHistoryQuotaReservationCommonV1 {
  profile: "provider_migration_history_quota_reservation_v1";
  reservationId:
    ProviderMigrationHistoryQuotaReservationIdV1;
  migrationId: ProviderMigrationIdV1;
  installationIdentity: InstallationIdentityStatePinV1;
  admissionVectorDigest: ContentDigest;
  policyDigest: ContentDigest;
  candidatePlanContentDigest: ContentDigest;
  reservationToken:
    ProviderMigrationHistoryQuotaReservationTokenV1;
}

type ProviderMigrationHistoryQuotaReservationV1 =
  ProviderMigrationHistoryQuotaReservationCommonV1 &
    (
      | {
          role: "same_identity_journal";
          charge: Extract<
            ProviderMigrationHistoryQuotaChargeV1,
            { role: "same_identity_journal" }
          >;
        }
      | {
          role: "cross_source_anchor";
          charge: Extract<
            ProviderMigrationHistoryQuotaChargeV1,
            { role: "cross_source_anchor" }
          >;
        }
      | {
          role: "cross_destination_journal";
          charge: Extract<
            ProviderMigrationHistoryQuotaChargeV1,
            { role: "cross_destination_journal" }
          >;
        }
    );

interface ProviderMigrationHistoryQuotaCancellationFenceV1 {
  profile:
    "provider_migration_history_quota_cancellation_fence_v1";
  reservationId:
    ProviderMigrationHistoryQuotaReservationIdV1;
  migrationId: ProviderMigrationIdV1;
  installationIdentity: InstallationIdentityStatePinV1;
  role: "cross_destination_journal";
  admissionVectorDigest: ContentDigest;
  candidatePlanContentDigest: ContentDigest;
  disposition: "counterpart_plan_permanently_unpublished";
  cancellationToken:
    ProviderMigrationHistoryQuotaReservationTokenV1;
}

interface ProviderMigrationHistoryQuotaReservationEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_migration_history_quota_reservation";
  locatorProfile:
    "installation_provider_migration_history_quota_reservation_v1";
  reservationId:
    ProviderMigrationHistoryQuotaReservationIdV1;
  contentDigest: ContentDigest;
  payload: ProviderMigrationHistoryQuotaReservationV1;
}

interface ProviderMigrationHistoryQuotaRetainedUsageV1 {
  historyLogicalBytes: number;
  historyProviderAllocatedBytes: number;
  objectReceiptCount: number;
  objectReceiptLogicalBytes: number;
  semanticRootZeroProofCount: number;
  semanticRootZeroProofLogicalBytes: number;
  progressRecordCount: number;
  progressRecordLogicalBytes: number;
  progressOperationReceiptCount: number;
  progressOperationReceiptLogicalBytes: number;
}

interface ProviderMigrationHistoryQuotaZeroRetainedUsageV1 {
  historyLogicalBytes: 0;
  historyProviderAllocatedBytes: 0;
  objectReceiptCount: 0;
  objectReceiptLogicalBytes: 0;
  semanticRootZeroProofCount: 0;
  semanticRootZeroProofLogicalBytes: 0;
  progressRecordCount: 0;
  progressRecordLogicalBytes: 0;
  progressOperationReceiptCount: 0;
  progressOperationReceiptLogicalBytes: 0;
}

interface ProviderMigrationHistoryQuotaUsageV1 {
  reservedAccountCount: number;
  reservedHistoryLogicalBytes: number;
  reservedHistoryProviderAllocatedBytes: number;
  reservedObjectReceiptCount: number;
  reservedObjectReceiptLogicalBytes: number;
  reservedSemanticRootZeroProofCount: number;
  reservedSemanticRootZeroProofLogicalBytes: number;
  reservedProgressRecordCount: number;
  reservedProgressRecordLogicalBytes: number;
  reservedProgressOperationReceiptCount: number;
  reservedProgressOperationReceiptLogicalBytes: number;
  retainedAccountCount: number;
  retainedHistoryLogicalBytes: number;
  retainedHistoryProviderAllocatedBytes: number;
  chargedMigrationCount: number;
  chargedHistoryLogicalBytes: number;
  chargedHistoryProviderAllocatedBytes: number;
  chargedObjectReceiptCount: number;
  chargedObjectReceiptLogicalBytes: number;
  chargedSemanticRootZeroProofCount: number;
  chargedSemanticRootZeroProofLogicalBytes: number;
  chargedProgressRecordCount: number;
  chargedProgressRecordLogicalBytes: number;
  chargedProgressOperationReceiptCount: number;
  chargedProgressOperationReceiptLogicalBytes: number;
}

type ProviderMigrationHistoryArtifactKindV1 =
  | "migration_plan"
  | "source_universe"
  | "destination_universe"
  | "canonical_rewrite_plan"
  | "semantic_equivalence_proof"
  | "object_receipt"
  | "progress_record"
  | "progress_operation_receipt"
  | "sealed_progress_head"
  | "zero_live_proof"
  | "source_tombstone";

interface ProviderMigrationHistoryArtifactSetEntryCommonV1 {
  artifactOrdinal: number; // exact 0..N-1
  canonicalEnvelopeBytes: number;
  providerAllocatedBytes: number;
}

type ProviderMigrationHistoryArtifactSetEntryV1 =
  ProviderMigrationHistoryArtifactSetEntryCommonV1 &
    (
      | {
          artifactKind: "migration_plan";
          artifact: ProviderMigrationPlanPinV1;
        }
      | {
          artifactKind: "source_universe";
          artifact:
            ProviderMigrationLiveReferenceUniversePinV1 & {
              side: "source";
            };
        }
      | {
          artifactKind: "destination_universe";
          artifact:
            ProviderMigrationLiveReferenceUniversePinV1 & {
              side: "destination";
            };
        }
      | {
          artifactKind: "canonical_rewrite_plan";
          artifact:
            ProviderMigrationCanonicalReferenceRewritePlanPinV1;
        }
      | {
          artifactKind: "semantic_equivalence_proof";
          artifact:
            ProviderMigrationSemanticEquivalenceProofPinV1;
        }
      | {
          artifactKind: "object_receipt";
          artifact: ProviderMigrationObjectReceiptPinV1;
        }
      | {
          artifactKind: "progress_record";
          artifact: ProviderMigrationProgressRecordPinV1;
        }
      | {
          artifactKind: "progress_operation_receipt";
          artifact:
            ProviderMigrationProgressOperationReceiptPinV1;
        }
      | {
          artifactKind: "sealed_progress_head";
          artifact: ProviderMigrationSealedProgressHeadPinV1;
        }
      | {
          artifactKind: "zero_live_proof";
          artifact:
            ProviderMigrationZeroLiveReferenceProofPinV1;
        }
      | {
          artifactKind: "source_tombstone";
          artifact: ProviderMigrationSourceTombstonePinV1;
        }
    );

interface ProviderMigrationHistoryArtifactSetProjectionV1 {
  migrationId: ProviderMigrationIdV1;
  ledgerInstallationIdentity: InstallationIdentityStatePinV1;
  role:
    | "same_identity_journal"
    | "cross_destination_journal";
  entries: ProviderMigrationHistoryArtifactSetEntryV1[];
}

type ProviderMigrationHistoryReferenceKindV1 =
  | "migration_plan"
  | "sealed_progress_head"
  | "zero_live_proof"
  | "source_tombstone"
  | "migration_artifact";

interface ProviderMigrationHistoryStoreCutEntryV1 {
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  currentStoreManifest: StoreManifestCurrentVersionPinV1;
}

interface ProviderMigrationHistoryAuditRootCutEntryV1 {
  auditRootKind:
    | "quota_event_enumeration"
    | "quota_receipt_enumeration"
    | "external_security_audit_root";
  rootContentDigest: ContentDigest;
  rootVersionToken: KeyedStateTokenV1;
}

type ProviderMigrationHistoryReferenceEntryV1 =
  | {
      category: "acceptance";
      acceptance: ProviderAcceptanceGenerationPinV1;
      referenceKind: ProviderMigrationHistoryReferenceKindV1;
      referencedContentDigest: ContentDigest;
    }
  | {
      category: "store";
      storeCut: ProviderMigrationHistoryStoreCutEntryV1;
      referenceKind: ProviderMigrationHistoryReferenceKindV1;
      referencedContentDigest: ContentDigest;
    }
  | {
      category: "audit";
      auditRoot: ProviderMigrationHistoryAuditRootCutEntryV1;
      referenceKind: ProviderMigrationHistoryReferenceKindV1;
      referencedContentDigest: ContentDigest;
    };

interface ProviderMigrationHistoryReferenceEnumerationCommonV1 {
  profile:
    "provider_migration_history_reference_enumeration_v1";
  migrationId: ProviderMigrationIdV1;
  acceptanceCut: ProviderAcceptanceCurrentPinV1;
  storeCutCount: number;
  storeCutSetDigest: ContentDigest;
  storeCuts: ProviderMigrationHistoryStoreCutEntryV1[];
  auditRootCutCount: number;
  auditRootCutSetDigest: ContentDigest;
  auditRootCuts: ProviderMigrationHistoryAuditRootCutEntryV1[];
  referenceCount: number;
  referenceSetDigest: ContentDigest;
}

type ProviderMigrationHistoryReferenceEnumerationV1 =
  ProviderMigrationHistoryReferenceEnumerationCommonV1 &
    (
      | {
          category: "acceptance";
          entries: Extract<
            ProviderMigrationHistoryReferenceEntryV1,
            { category: "acceptance" }
          >[];
        }
      | {
          category: "store";
          entries: Extract<
            ProviderMigrationHistoryReferenceEntryV1,
            { category: "store" }
          >[];
        }
      | {
          category: "audit";
          entries: Extract<
            ProviderMigrationHistoryReferenceEntryV1,
            { category: "audit" }
          >[];
        }
    );

interface ProviderMigrationHistoryAccountingProofV1 {
  profile: "provider_migration_history_accounting_proof_v1";
  migrationId: ProviderMigrationIdV1;
  migrationPlan: ProviderMigrationPlanPinV1;
  sealedProgressHead:
    ProviderMigrationSealedProgressHeadPinV1;
  retainedHistoryArtifactCount: number;
  retainedHistoryArtifactSetDigest: ContentDigest;
  artifactSetProjectionProfile:
    "provider_migration_history_artifact_set_v1";
  retainedUsage: ProviderMigrationHistoryQuotaRetainedUsageV1;
  accountingProfile:
    "journal_authority_fixed_migration_namespace_v1";
  proofToken:
    ProviderMigrationHistoryAccountingProofTokenV1;
}

interface ProviderMigrationHistoryZeroReferenceProofV1 {
  profile:
    "provider_migration_history_zero_reference_proof_v1";
  migrationId: ProviderMigrationIdV1;
  acceptanceReferences:
    ProviderMigrationHistoryReferenceEnumerationV1 & {
      category: "acceptance";
      referenceCount: 0;
      entries: [];
    };
  storeReferences:
    ProviderMigrationHistoryReferenceEnumerationV1 & {
      category: "store";
      referenceCount: 0;
      entries: [];
    };
  auditReferences:
    ProviderMigrationHistoryReferenceEnumerationV1 & {
      category: "audit";
      referenceCount: 0;
      entries: [];
    };
  activeMigrationExecutors: [];
  proofToken:
    ProviderMigrationHistoryZeroReferenceProofTokenV1;
}

interface ProviderMigrationHistoryDeletionReceiptV1 {
  profile:
    "provider_migration_history_deletion_receipt_v1";
  migrationId: ProviderMigrationIdV1;
  reservationId:
    ProviderMigrationHistoryQuotaReservationIdV1;
  accountingProofContentDigest: ContentDigest;
  deletedArtifactCount: number;
  deletedArtifactSetDigest: ContentDigest;
  deletedArtifactSetProfile:
    "provider_migration_history_artifact_set_v1";
  deletedHistoryLogicalBytes: number;
  deletedHistoryProviderAllocatedBytes: number;
  fixedLocatorPostcondition:
    "all_accounted_history_absent_except_quota_audit_commitments";
  deletedAt: IsoTimestamp;
  deletionToken:
    ProviderMigrationHistoryDeletionReceiptTokenV1;
}

type ProviderMigrationHistoryQuotaEventSelectorV1 =
  | {
      role: "same_identity_journal";
      transition: "reserved";
    }
  | {
      role: "same_identity_journal";
      transition: "committed";
    }
  | {
      role: "same_identity_journal";
      transition: "released_retained";
    }
  | {
      role: "cross_destination_journal";
      transition: "reserved";
    }
  | {
      role: "cross_destination_journal";
      transition: "cross_destination_activated";
    }
  | {
      role: "cross_destination_journal";
      transition: "committed";
    }
  | {
      role: "cross_destination_journal";
      transition: "released_retained";
    }
  | {
      role: "cross_destination_journal";
      transition: "counterpart_cancel_fenced";
    }
  | {
      role: "cross_source_anchor";
      transition: "reserved";
    }
  | {
      role: "cross_source_anchor";
      transition: "committed";
    }
  | {
      role: "cross_source_anchor";
      transition: "cancelled_provisional";
    }
  | {
      role: "cross_source_anchor";
      transition: "released_cross_source_anchor";
    };

type ProviderMigrationHistoryQuotaTransitionV1 =
  ProviderMigrationHistoryQuotaEventSelectorV1["transition"];

type ProviderMigrationHistoryQuotaEventPredecessorV1 =
  | { state: "genesis" }
  | {
      state: "event";
      eventOrdinal: number;
      eventId: ProviderMigrationHistoryQuotaEventIdV1;
      contentDigest: ContentDigest;
    };

interface ProviderMigrationHistoryQuotaEventPinCommonV1 {
  locatorProfile:
    "installation_provider_migration_history_quota_event_v1";
  eventOrdinal: number;
  eventId: ProviderMigrationHistoryQuotaEventIdV1;
  contentDigest: ContentDigest;
}

type ProviderMigrationHistoryQuotaEventPinV1 =
  ProviderMigrationHistoryQuotaEventPinCommonV1 &
    ProviderMigrationHistoryQuotaEventSelectorV1;

interface ProviderMigrationHistoryQuotaTransitionAnchorCommonV1 {
  eventOrdinal: number;
  operationNonce: LowerHex32;
  migrationId: ProviderMigrationIdV1;
  reservationId:
    ProviderMigrationHistoryQuotaReservationIdV1;
  predecessor:
    ProviderMigrationHistoryQuotaEventPredecessorV1;
}

type ProviderMigrationHistoryQuotaTransitionAnchorV1 =
  ProviderMigrationHistoryQuotaTransitionAnchorCommonV1 &
    Extract<
      ProviderMigrationHistoryQuotaEventSelectorV1,
      {
        transition:
          | "reserved"
          | "cross_destination_activated"
          | "committed";
      }
    >;

interface ProviderMigrationHistoryQuotaEventCommonV1 {
  profile: "provider_migration_history_quota_event_v1";
  eventId: ProviderMigrationHistoryQuotaEventIdV1;
  eventOrdinal: number; // exact 1..N
  installationIdentity: InstallationIdentityStatePinV1;
  migrationId: ProviderMigrationIdV1;
  reservationId:
    ProviderMigrationHistoryQuotaReservationIdV1;
  role: ProviderMigrationHistoryQuotaRoleV1;
  operationNonce: LowerHex32;
  predecessor:
    ProviderMigrationHistoryQuotaEventPredecessorV1;
  postAccountCount: number;
  postAccountSetDigest: ContentDigest;
  postUsage: ProviderMigrationHistoryQuotaUsageV1;
  occurredAt: IsoTimestamp;
  eventToken: ProviderMigrationHistoryQuotaEventTokenV1;
}

type ProviderMigrationHistoryQuotaEventV1 =
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "reserved";
      role: "same_identity_journal";
      reservation: Extract<
        ProviderMigrationHistoryQuotaReservationV1,
        { role: "same_identity_journal" }
      >;
      planPublication: {
        state: "published_atomically";
        migrationPlan: ProviderMigrationPlanPinV1;
      };
    })
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "reserved";
      role: "cross_destination_journal";
      reservation: Extract<
        ProviderMigrationHistoryQuotaReservationV1,
        { role: "cross_destination_journal" }
      >;
      planPublication: {
        state: "cross_destination_intent";
      };
    })
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "reserved";
      role: "cross_source_anchor";
      reservation: Extract<
        ProviderMigrationHistoryQuotaReservationV1,
        { role: "cross_source_anchor" }
      >;
      planPublication: {
        state: "cross_source_provisional";
        destinationIntent:
          ProviderMigrationHistoryQuotaReservationPinV1 & {
            role: "cross_destination_journal";
          };
      };
    })
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "cross_destination_activated";
      role: "cross_destination_journal";
      expectedDestinationIntentEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_destination_journal";
          transition: "reserved";
        };
      sourceReservation:
        ProviderMigrationHistoryQuotaReservationPinV1 & {
          role: "cross_source_anchor";
        };
      migrationPlan: ProviderMigrationPlanPinV1;
    })
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "committed";
      role: "same_identity_journal";
      commitKind: "retained_history";
      expectedReservationEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "same_identity_journal";
          transition: "reserved";
        };
      migrationPlan: ProviderMigrationPlanPinV1;
      accountingProof:
        ProviderMigrationHistoryAccountingProofV1;
      reservedHistoryLogicalBytes: number;
      reservedHistoryProviderAllocatedBytes: number;
      actualRetainedUsage:
        ProviderMigrationHistoryQuotaRetainedUsageV1;
      unusedReservationLogicalBytesReleased: number;
      unusedReservationProviderAllocatedBytesReleased: number;
    })
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "committed";
      role: "cross_destination_journal";
      commitKind: "retained_history";
      expectedReservationEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_destination_journal";
          transition: "cross_destination_activated";
        };
      migrationPlan: ProviderMigrationPlanPinV1;
      accountingProof:
        ProviderMigrationHistoryAccountingProofV1;
      reservedHistoryLogicalBytes: number;
      reservedHistoryProviderAllocatedBytes: number;
      actualRetainedUsage:
        ProviderMigrationHistoryQuotaRetainedUsageV1;
      unusedReservationLogicalBytesReleased: number;
      unusedReservationProviderAllocatedBytesReleased: number;
    })
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "committed";
      role: "cross_source_anchor";
      commitKind: "cross_source_anchor";
      expectedReservationEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_source_anchor";
          transition: "reserved";
        };
      migrationPlan: ProviderMigrationPlanPinV1;
      destinationCommitReceipt:
        ProviderMigrationHistoryQuotaOperationReceiptPinV1 &
        ProviderMigrationHistoryQuotaCommittedReceiptBindingV1 & {
          role: "cross_destination_journal";
          operation: "compare_commit";
          commitKind: "commit_retained_history";
          outcome: "committed";
        };
      actualRetainedUsage:
        ProviderMigrationHistoryQuotaZeroRetainedUsageV1;
      unusedReservationLogicalBytesReleased: 0;
      unusedReservationProviderAllocatedBytesReleased: 0;
    })
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "cancelled_provisional";
      role: "cross_source_anchor";
      expectedReservationEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_source_anchor";
          transition: "reserved";
        };
      counterpartCancellationReceipt:
        ProviderMigrationHistoryQuotaOperationReceiptPinV1 &
        ProviderMigrationHistoryQuotaCancellationReceiptBindingV1 & {
          role: "cross_destination_journal";
          operation: "compare_release";
          releaseKind:
            "cancel_unpublished_cross_destination_intent";
          outcome: "committed";
        };
      zeroReferenceProof:
        ProviderMigrationHistoryZeroReferenceProofV1;
      releasedReservationCharge: Extract<
        ProviderMigrationHistoryQuotaChargeV1,
        { role: "cross_source_anchor" }
      >;
    })
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "released_retained";
      role: "same_identity_journal";
      expectedAccountEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "same_identity_journal";
          transition: "committed";
        };
      zeroReferenceProof:
        ProviderMigrationHistoryZeroReferenceProofV1;
      deletionReceipt:
        ProviderMigrationHistoryDeletionReceiptV1;
      releasedMigrationSlotCount: 1;
      releasedUsage:
        ProviderMigrationHistoryQuotaRetainedUsageV1;
    })
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "released_retained";
      role: "cross_destination_journal";
      expectedAccountEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_destination_journal";
          transition: "committed";
        };
      zeroReferenceProof:
        ProviderMigrationHistoryZeroReferenceProofV1;
      deletionReceipt:
        ProviderMigrationHistoryDeletionReceiptV1;
      releasedMigrationSlotCount: 1;
      releasedUsage:
        ProviderMigrationHistoryQuotaRetainedUsageV1;
    })
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "released_cross_source_anchor";
      role: "cross_source_anchor";
      expectedAccountEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_source_anchor";
          transition: "committed";
        };
      destinationReleaseReceipt:
        ProviderMigrationHistoryQuotaOperationReceiptPinV1 &
        ProviderMigrationHistoryQuotaRetainedReleaseReceiptBindingV1 & {
          role: "cross_destination_journal";
          operation: "compare_release";
          releaseKind: "release_retained_history";
          outcome: "committed";
        };
      zeroReferenceProof:
        ProviderMigrationHistoryZeroReferenceProofV1;
      releasedUsage:
        ProviderMigrationHistoryQuotaZeroRetainedUsageV1;
    })
  | (ProviderMigrationHistoryQuotaEventCommonV1 & {
      transition: "counterpart_cancel_fenced";
      role: "cross_destination_journal";
      expectedDestinationIntentEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_destination_journal";
          transition: "reserved";
        };
      cancellationFence:
        ProviderMigrationHistoryQuotaCancellationFenceV1;
    });

interface ProviderMigrationHistoryQuotaEventEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_migration_history_quota_event";
  eventId: ProviderMigrationHistoryQuotaEventIdV1;
  eventOrdinal: number;
  occurredAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderMigrationHistoryQuotaEventV1;
}

type ProviderMigrationHistoryQuotaAccountV1 =
  | {
      state: "reserved";
      reservation: Extract<
        ProviderMigrationHistoryQuotaReservationV1,
        { role: "same_identity_journal" }
      >;
      reserveTransition:
        ProviderMigrationHistoryQuotaTransitionAnchorV1 & {
          role: "same_identity_journal";
          transition: "reserved";
        };
      planState: "published";
    }
  | {
      state: "reserved";
      reservation: Extract<
        ProviderMigrationHistoryQuotaReservationV1,
        { role: "cross_destination_journal" }
      >;
      reserveTransition:
        ProviderMigrationHistoryQuotaTransitionAnchorV1 & {
          role: "cross_destination_journal";
          transition: "reserved";
        };
      planState: "cross_destination_intent_pending_source";
    }
  | {
      state: "reserved";
      reservation: Extract<
        ProviderMigrationHistoryQuotaReservationV1,
        { role: "cross_destination_journal" }
      >;
      activationTransition:
        ProviderMigrationHistoryQuotaTransitionAnchorV1 & {
          role: "cross_destination_journal";
          transition: "cross_destination_activated";
        };
      planState: "published";
    }
  | {
      state: "reserved";
      reservation: Extract<
        ProviderMigrationHistoryQuotaReservationV1,
        { role: "cross_source_anchor" }
      >;
      reserveTransition:
        ProviderMigrationHistoryQuotaTransitionAnchorV1 & {
          role: "cross_source_anchor";
          transition: "reserved";
        };
      planState: "cross_source_provisional";
    }
  | {
      state: "retained";
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      migrationId: ProviderMigrationIdV1;
      role: "same_identity_journal";
      commitTransition:
        ProviderMigrationHistoryQuotaTransitionAnchorV1 & {
          role: "same_identity_journal";
          transition: "committed";
        };
      accountingProofContentDigest: ContentDigest;
      retainedUsage:
        ProviderMigrationHistoryQuotaRetainedUsageV1;
    }
  | {
      state: "retained";
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      migrationId: ProviderMigrationIdV1;
      role: "cross_destination_journal";
      commitTransition:
        ProviderMigrationHistoryQuotaTransitionAnchorV1 & {
          role: "cross_destination_journal";
          transition: "committed";
        };
      accountingProofContentDigest: ContentDigest;
      retainedUsage:
        ProviderMigrationHistoryQuotaRetainedUsageV1;
    }
  | {
      state: "retained";
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      migrationId: ProviderMigrationIdV1;
      role: "cross_source_anchor";
      commitTransition:
        ProviderMigrationHistoryQuotaTransitionAnchorV1 & {
          role: "cross_source_anchor";
          transition: "committed";
      };
      destinationCommitReceipt:
        ProviderMigrationHistoryQuotaOperationReceiptPinV1 &
        ProviderMigrationHistoryQuotaCommittedReceiptBindingV1 & {
          role: "cross_destination_journal";
          operation: "compare_commit";
          commitKind: "commit_retained_history";
          outcome: "committed";
        };
      retainedUsage:
        ProviderMigrationHistoryQuotaZeroRetainedUsageV1;
    };

interface ProviderMigrationHistoryQuotaEventEnumerationEntryCommonV1 {
  eventOrdinal: number;
  eventId: ProviderMigrationHistoryQuotaEventIdV1;
  contentDigest: ContentDigest;
  operationNonce: LowerHex32;
  migrationId: ProviderMigrationIdV1;
  reservationId:
    ProviderMigrationHistoryQuotaReservationIdV1;
  predecessor:
    ProviderMigrationHistoryQuotaEventV1["predecessor"];
}

type ProviderMigrationHistoryQuotaEventEnumerationEntryV1 =
  ProviderMigrationHistoryQuotaEventEnumerationEntryCommonV1 &
    ProviderMigrationHistoryQuotaEventSelectorV1;

type ProviderMigrationHistoryQuotaOperationSelectorV1 =
  | {
      operation: "compare_reserve";
      role: "same_identity_journal";
      publicationKind:
        "publish_same_identity_plan_atomically";
    }
  | {
      operation: "compare_reserve";
      role: "cross_destination_journal";
      publicationKind: "cross_destination_intent";
    }
  | {
      operation: "compare_reserve";
      role: "cross_source_anchor";
      publicationKind: "cross_source_provisional";
    }
  | {
      operation: "compare_activate";
      role: "cross_destination_journal";
    }
  | {
      operation: "compare_commit";
      role: "same_identity_journal";
      commitKind: "commit_retained_history";
    }
  | {
      operation: "compare_commit";
      role: "cross_destination_journal";
      commitKind: "commit_retained_history";
    }
  | {
      operation: "compare_commit";
      role: "cross_source_anchor";
      commitKind: "commit_cross_source_anchor";
    }
  | {
      operation: "compare_release";
      role: "cross_destination_journal";
      releaseKind:
        "cancel_unpublished_cross_destination_intent";
    }
  | {
      operation: "compare_release";
      role: "cross_source_anchor";
      releaseKind: "release_provisional_source";
    }
  | {
      operation: "compare_release";
      role: "same_identity_journal";
      releaseKind: "release_retained_history";
    }
  | {
      operation: "compare_release";
      role: "cross_destination_journal";
      releaseKind: "release_retained_history";
    }
  | {
      operation: "compare_release";
      role: "cross_source_anchor";
      releaseKind: "release_cross_source_anchor";
    };

type ProviderMigrationHistoryQuotaCommittedEventSelectorForOperationV1<
  Selector extends
    ProviderMigrationHistoryQuotaOperationSelectorV1
> =
  Selector extends {
    operation: "compare_reserve";
    role: infer Role extends
      ProviderMigrationHistoryQuotaRoleV1;
  }
    ? Extract<
        ProviderMigrationHistoryQuotaEventSelectorV1,
        { role: Role; transition: "reserved" }
      >
    : Selector extends {
          operation: "compare_activate";
        }
      ? Extract<
          ProviderMigrationHistoryQuotaEventSelectorV1,
          {
            role: "cross_destination_journal";
            transition: "cross_destination_activated";
          }
        >
      : Selector extends {
            operation: "compare_commit";
            role: infer Role extends
              ProviderMigrationHistoryQuotaRoleV1;
          }
        ? Extract<
            ProviderMigrationHistoryQuotaEventSelectorV1,
            { role: Role; transition: "committed" }
          >
        : Selector extends {
              operation: "compare_release";
              releaseKind:
                "cancel_unpublished_cross_destination_intent";
            }
          ? Extract<
              ProviderMigrationHistoryQuotaEventSelectorV1,
              {
                role: "cross_destination_journal";
                transition: "counterpart_cancel_fenced";
              }
            >
          : Selector extends {
                operation: "compare_release";
                releaseKind: "release_provisional_source";
              }
            ? Extract<
                ProviderMigrationHistoryQuotaEventSelectorV1,
                {
                  role: "cross_source_anchor";
                  transition: "cancelled_provisional";
                }
              >
            : Selector extends {
                  operation: "compare_release";
                  releaseKind: "release_retained_history";
                  role: infer Role extends
                    ProviderMigrationHistoryQuotaRoleV1;
                }
              ? Extract<
                  ProviderMigrationHistoryQuotaEventSelectorV1,
                  {
                    role: Role;
                    transition: "released_retained";
                  }
                >
              : Extract<
                  ProviderMigrationHistoryQuotaEventSelectorV1,
                  {
                    role: "cross_source_anchor";
                    transition:
                      "released_cross_source_anchor";
                  }
                >;

interface ProviderMigrationHistoryQuotaReceiptEnumerationEntryCommonV1 {
  receiptOrdinal: number; // exact 1..N
  operationNonce: LowerHex32;
  contentDigest: ContentDigest;
  requestContentDigest: ContentDigest;
}

type ProviderMigrationHistoryQuotaReceiptEnumerationEntryForSelectorV1<
  Selector extends
    ProviderMigrationHistoryQuotaOperationSelectorV1
> = Selector extends
  ProviderMigrationHistoryQuotaOperationSelectorV1
  ? ProviderMigrationHistoryQuotaReceiptEnumerationEntryCommonV1 &
      Selector &
      (
        | {
            outcome: "committed";
            appendedEvent:
              ProviderMigrationHistoryQuotaEventPinCommonV1 &
                ProviderMigrationHistoryQuotaCommittedEventSelectorForOperationV1<
                  Selector
                >;
          }
        | {
            outcome: "not_committed";
            appendedEvent?: never;
          }
      )
  : never;

type ProviderMigrationHistoryQuotaReceiptEnumerationEntryV1 =
  ProviderMigrationHistoryQuotaReceiptEnumerationEntryForSelectorV1<
    ProviderMigrationHistoryQuotaOperationSelectorV1
  >;

interface ProviderMigrationHistoryQuotaEnumerationV1 {
  profile: "provider_migration_history_quota_enumeration_v1";
  installationIdentity: InstallationIdentityStatePinV1;
  events: ProviderMigrationHistoryQuotaEventEnumerationEntryV1[];
  eventCount: number;
  eventSetDigest: ContentDigest;
  receipts:
    ProviderMigrationHistoryQuotaReceiptEnumerationEntryV1[];
  receiptCount: number;
  receiptSetDigest: ContentDigest;
  accounts: ProviderMigrationHistoryQuotaAccountV1[];
  accountCount: number;
  accountSetDigest: ContentDigest;
}

interface ProviderMigrationHistoryQuotaHighWaterV1 {
  profile: "provider_migration_history_quota_high_water_v1";
  installationIdentity: InstallationIdentityStatePinV1;
  stateRevision: number; // committed event count
  ledgerRevision: number; // durable receipt count
  currentEvent:
    | { state: "genesis" }
    | {
        state: "event";
        event: ProviderMigrationHistoryQuotaEventPinV1;
      };
  eventCount: number;
  eventSetDigest: ContentDigest;
  receiptCount: number;
  receiptSetDigest: ContentDigest;
  accountCount: number;
  accountSetDigest: ContentDigest;
  usage: ProviderMigrationHistoryQuotaUsageV1;
  reservationRecordCount: number;
  reservationRecordLogicalBytes: number;
  ledgerEventLogicalBytes: number;
  operationReceiptLogicalBytes: number;
  futureTerminalTransitionEscrowCount: number;
  eventEscrowLogicalBytes: number;
  receiptEscrowLogicalBytes: number;
  quotaStateVersionToken:
    ProviderMigrationHistoryQuotaCurrentVersionTokenV1;
}

interface ProviderMigrationHistoryQuotaHighWaterEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_migration_history_quota_high_water";
  locatorProfile:
    "installation_provider_migration_history_quota_high_water_v1";
  contentDigest: ContentDigest;
  quotaStateVersionToken:
    ProviderMigrationHistoryQuotaCurrentVersionTokenV1;
  payload: ProviderMigrationHistoryQuotaHighWaterV1;
}

interface ProviderMigrationHistoryQuotaCompareReserveRequestCommonV1 {
  profile:
    "provider_migration_history_quota_compare_reserve_request_v1";
  operationNonce: LowerHex32;
  expectedReservationLocatorState: "absent";
}

type ProviderMigrationHistoryQuotaOperationRequestV1 =
  | {
      operation: "compare_reserve";
      role: "same_identity_journal";
      request:
        ProviderMigrationHistoryQuotaCompareReserveRequestCommonV1 & {
          reservation: Extract<
            ProviderMigrationHistoryQuotaReservationV1,
            { role: "same_identity_journal" }
          >;
          publication: {
            kind: "publish_same_identity_plan_atomically";
            candidatePlan:
              ProviderMigrationSameIdentityPlanEnvelopeV1;
          };
        };
    }
  | {
      operation: "compare_reserve";
      role: "cross_destination_journal";
      request:
        ProviderMigrationHistoryQuotaCompareReserveRequestCommonV1 & {
          reservation: Extract<
            ProviderMigrationHistoryQuotaReservationV1,
            { role: "cross_destination_journal" }
          >;
          publication: {
            kind: "cross_destination_intent";
            candidatePlan:
              ProviderMigrationCrossInstallationPlanEnvelopeV1;
          };
        };
    }
  | {
      operation: "compare_reserve";
      role: "cross_source_anchor";
      request:
        ProviderMigrationHistoryQuotaCompareReserveRequestCommonV1 & {
          reservation: Extract<
            ProviderMigrationHistoryQuotaReservationV1,
            { role: "cross_source_anchor" }
          >;
          publication: {
            kind: "cross_source_provisional";
            candidatePlan:
              ProviderMigrationCrossInstallationPlanEnvelopeV1;
            destinationIntent:
              ProviderMigrationHistoryQuotaReservationPinV1 & {
                role: "cross_destination_journal";
              };
          };
        };
    }
  | {
      operation: "compare_activate";
      role: "cross_destination_journal";
      request: {
        profile:
          "provider_migration_history_quota_compare_activate_request_v1";
        operationNonce: LowerHex32;
        expectedDestinationIntentEvent:
          ProviderMigrationHistoryQuotaEventPinV1 & {
            role: "cross_destination_journal";
            transition: "reserved";
          };
        sourceReservation:
          ProviderMigrationHistoryQuotaReservationPinV1 & {
            role: "cross_source_anchor";
          };
        candidatePlan:
          ProviderMigrationCrossInstallationPlanEnvelopeV1;
      };
    }
  | {
      operation: "compare_commit";
      role: "same_identity_journal";
      request: {
        profile:
          "provider_migration_history_quota_compare_commit_request_v1";
        kind: "commit_retained_history";
        operationNonce: LowerHex32;
        expectedReservationEvent:
          ProviderMigrationHistoryQuotaEventPinV1 & {
            role: "same_identity_journal";
            transition: "reserved";
          };
        migrationPlan: ProviderMigrationPlanPinV1;
        accountingProof:
          ProviderMigrationHistoryAccountingProofV1;
      };
    }
  | {
      operation: "compare_commit";
      role: "cross_destination_journal";
      request: {
        profile:
          "provider_migration_history_quota_compare_commit_request_v1";
        kind: "commit_retained_history";
        operationNonce: LowerHex32;
        expectedReservationEvent:
          ProviderMigrationHistoryQuotaEventPinV1 & {
            role: "cross_destination_journal";
            transition: "cross_destination_activated";
          };
        migrationPlan: ProviderMigrationPlanPinV1;
        accountingProof:
          ProviderMigrationHistoryAccountingProofV1;
      };
    }
  | {
      operation: "compare_commit";
      role: "cross_source_anchor";
      request: {
        profile:
          "provider_migration_history_quota_compare_commit_request_v1";
        kind: "commit_cross_source_anchor";
        operationNonce: LowerHex32;
        expectedReservationEvent:
          ProviderMigrationHistoryQuotaEventPinV1 & {
            role: "cross_source_anchor";
            transition: "reserved";
        };
        migrationPlan: ProviderMigrationPlanPinV1;
        destinationCommitReceipt:
          ProviderMigrationHistoryQuotaOperationReceiptPinV1 &
          ProviderMigrationHistoryQuotaCommittedReceiptBindingV1 & {
            role: "cross_destination_journal";
            operation: "compare_commit";
            commitKind: "commit_retained_history";
            outcome: "committed";
          };
        actualRetainedUsage:
          ProviderMigrationHistoryQuotaZeroRetainedUsageV1;
      };
    }
  | {
      operation: "compare_release";
      role: "cross_destination_journal";
      request: {
        profile:
          "provider_migration_history_quota_compare_release_request_v1";
        kind: "cancel_unpublished_cross_destination_intent";
        operationNonce: LowerHex32;
        expectedDestinationIntentEvent:
          ProviderMigrationHistoryQuotaEventPinV1 & {
            role: "cross_destination_journal";
            transition: "reserved";
          };
        expectedPlanLocatorState: "absent";
      };
    }
  | {
      operation: "compare_release";
      role: "cross_source_anchor";
      request: {
        profile:
          "provider_migration_history_quota_compare_release_request_v1";
        kind: "release_provisional_source";
        operationNonce: LowerHex32;
        expectedReservationEvent:
          ProviderMigrationHistoryQuotaEventPinV1 & {
            role: "cross_source_anchor";
            transition: "reserved";
          };
        zeroReferenceProof:
          ProviderMigrationHistoryZeroReferenceProofV1;
        counterpartCancellationReceipt:
          ProviderMigrationHistoryQuotaOperationReceiptPinV1 &
          ProviderMigrationHistoryQuotaCancellationReceiptBindingV1 & {
            role: "cross_destination_journal";
            operation: "compare_release";
            releaseKind:
              "cancel_unpublished_cross_destination_intent";
            outcome: "committed";
          };
      };
    }
  | {
      operation: "compare_release";
      role: "same_identity_journal";
      request: {
        profile:
          "provider_migration_history_quota_compare_release_request_v1";
        kind: "release_retained_history";
        operationNonce: LowerHex32;
        expectedAccountEvent:
          ProviderMigrationHistoryQuotaEventPinV1 & {
            role: "same_identity_journal";
            transition: "committed";
          };
        zeroReferenceProof:
          ProviderMigrationHistoryZeroReferenceProofV1;
      };
    }
  | {
      operation: "compare_release";
      role: "cross_destination_journal";
      request: {
        profile:
          "provider_migration_history_quota_compare_release_request_v1";
        kind: "release_retained_history";
        operationNonce: LowerHex32;
        expectedAccountEvent:
          ProviderMigrationHistoryQuotaEventPinV1 & {
            role: "cross_destination_journal";
            transition: "committed";
          };
        zeroReferenceProof:
          ProviderMigrationHistoryZeroReferenceProofV1;
      };
    }
  | {
      operation: "compare_release";
      role: "cross_source_anchor";
      request: {
        profile:
          "provider_migration_history_quota_compare_release_request_v1";
        kind: "release_cross_source_anchor";
        operationNonce: LowerHex32;
        expectedAccountEvent:
          ProviderMigrationHistoryQuotaEventPinV1 & {
            role: "cross_source_anchor";
            transition: "committed";
          };
        zeroReferenceProof:
          ProviderMigrationHistoryZeroReferenceProofV1;
        destinationReleaseReceipt:
          ProviderMigrationHistoryQuotaOperationReceiptPinV1 &
          ProviderMigrationHistoryQuotaRetainedReleaseReceiptBindingV1 & {
            role: "cross_destination_journal";
            operation: "compare_release";
            releaseKind: "release_retained_history";
            outcome: "committed";
          };
      };
    };

type ProviderMigrationHistoryQuotaOperationRequestProjectionV1 =
  | {
      operation: "compare_reserve";
      role: "cross_destination_journal";
      publicationKind: "cross_destination_intent";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      admissionVectorDigest: ContentDigest;
      reservationContentDigest: ContentDigest;
      candidatePlanContentDigest: ContentDigest;
    }
  | {
      operation: "compare_reserve";
      role: "cross_source_anchor";
      publicationKind: "cross_source_provisional";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      admissionVectorDigest: ContentDigest;
      reservationContentDigest: ContentDigest;
      candidatePlanContentDigest: ContentDigest;
      destinationIntent:
        ProviderMigrationHistoryQuotaReservationPinV1 & {
          role: "cross_destination_journal";
        };
    }
  | {
      operation: "compare_reserve";
      role: "same_identity_journal";
      publicationKind:
        "publish_same_identity_plan_atomically";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      admissionVectorDigest: ContentDigest;
      reservationContentDigest: ContentDigest;
      candidatePlanContentDigest: ContentDigest;
    }
  | {
      operation: "compare_activate";
      role: "cross_destination_journal";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      expectedDestinationIntentEventContentDigest: ContentDigest;
      sourceReservation:
        ProviderMigrationHistoryQuotaReservationPinV1 & {
          role: "cross_source_anchor";
        };
      candidatePlanContentDigest: ContentDigest;
    }
  | {
      operation: "compare_commit";
      role: "same_identity_journal";
      commitKind: "commit_retained_history";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      expectedReservationEventContentDigest: ContentDigest;
      migrationPlanContentDigest: ContentDigest;
      accountingProofContentDigest: ContentDigest;
    }
  | {
      operation: "compare_commit";
      role: "cross_destination_journal";
      commitKind: "commit_retained_history";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      expectedReservationEventContentDigest: ContentDigest;
      migrationPlanContentDigest: ContentDigest;
      accountingProofContentDigest: ContentDigest;
    }
  | {
      operation: "compare_commit";
      role: "cross_source_anchor";
      commitKind: "commit_cross_source_anchor";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      expectedReservationEventContentDigest: ContentDigest;
      migrationPlanContentDigest: ContentDigest;
      destinationCommitReceipt:
        ProviderMigrationHistoryQuotaOperationReceiptPinV1 &
        ProviderMigrationHistoryQuotaCommittedReceiptBindingV1 & {
          role: "cross_destination_journal";
          operation: "compare_commit";
          commitKind: "commit_retained_history";
          outcome: "committed";
        };
    }
  | {
      operation: "compare_release";
      role: "cross_destination_journal";
      releaseKind:
        "cancel_unpublished_cross_destination_intent";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      expectedDestinationIntentEventContentDigest: ContentDigest;
      candidatePlanContentDigest: ContentDigest;
    }
  | {
      operation: "compare_release";
      role: "cross_source_anchor";
      releaseKind: "release_provisional_source";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      expectedReservationEventContentDigest: ContentDigest;
      zeroReferenceProofContentDigest: ContentDigest;
      counterpartReceipt:
        ProviderMigrationHistoryQuotaOperationReceiptPinV1 &
        ProviderMigrationHistoryQuotaCancellationReceiptBindingV1 & {
          role: "cross_destination_journal";
          operation: "compare_release";
          releaseKind:
            "cancel_unpublished_cross_destination_intent";
          outcome: "committed";
        };
    }
  | {
      operation: "compare_release";
      role: "same_identity_journal";
      releaseKind: "release_retained_history";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      expectedAccountEventContentDigest: ContentDigest;
      zeroReferenceProofContentDigest: ContentDigest;
      migrationPlanContentDigest: ContentDigest;
    }
  | {
      operation: "compare_release";
      role: "cross_destination_journal";
      releaseKind: "release_retained_history";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      expectedAccountEventContentDigest: ContentDigest;
      zeroReferenceProofContentDigest: ContentDigest;
      migrationPlanContentDigest: ContentDigest;
    }
  | {
      operation: "compare_release";
      role: "cross_source_anchor";
      releaseKind: "release_cross_source_anchor";
      migrationId: ProviderMigrationIdV1;
      reservationId:
        ProviderMigrationHistoryQuotaReservationIdV1;
      expectedAccountEventContentDigest: ContentDigest;
      zeroReferenceProofContentDigest: ContentDigest;
      counterpartReceipt:
        ProviderMigrationHistoryQuotaOperationReceiptPinV1 &
        ProviderMigrationHistoryQuotaRetainedReleaseReceiptBindingV1 & {
          role: "cross_destination_journal";
          operation: "compare_release";
          releaseKind: "release_retained_history";
          outcome: "committed";
        };
    };

type ProviderMigrationHistoryQuotaObservedStateV1 =
  | { state: "absent" }
  | {
      state: "trusted";
      highWater:
        ProviderMigrationHistoryQuotaHighWaterEnvelopeV1;
    }
  | {
      state: "integrity_failed";
      evidenceDigest: ContentDigest;
    };

type ProviderMigrationHistoryQuotaReceiptObservedStateV1 =
  Exclude<
    ProviderMigrationHistoryQuotaObservedStateV1,
    { state: "integrity_failed" }
  >;

type ProviderMigrationHistoryQuotaDurableOutcomeV1 =
  | {
      operation: "compare_reserve";
      role: "cross_destination_journal";
      publicationKind: "cross_destination_intent";
      outcome: "committed";
      committedTransition: "reserved";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_destination_journal";
          transition: "reserved";
        };
    }
  | {
      operation: "compare_reserve";
      role: "cross_destination_journal";
      publicationKind: "cross_destination_intent";
      outcome: "not_committed";
      reason:
        | "reservation_already_exists"
        | "counterpart_cancelled"
        | "plan_invalid";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    }
  | {
      operation: "compare_reserve";
      role: "cross_source_anchor";
      publicationKind: "cross_source_provisional";
      outcome: "committed";
      committedTransition: "reserved";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_source_anchor";
          transition: "reserved";
        };
    }
  | {
      operation: "compare_reserve";
      role: "cross_source_anchor";
      publicationKind: "cross_source_provisional";
      outcome: "not_committed";
      reason:
        | "reservation_already_exists"
        | "counterpart_cancelled"
        | "destination_intent_not_active"
        | "plan_invalid";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    }
  | {
      operation: "compare_reserve";
      role: "same_identity_journal";
      publicationKind:
        "publish_same_identity_plan_atomically";
      outcome: "committed";
      committedTransition: "reserved";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "same_identity_journal";
          transition: "reserved";
        };
    }
  | {
      operation: "compare_reserve";
      role: "same_identity_journal";
      publicationKind:
        "publish_same_identity_plan_atomically";
      outcome: "not_committed";
      reason:
        | "reservation_already_exists"
        | "plan_invalid";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    }
  | {
      operation: "compare_activate";
      role: "cross_destination_journal";
      outcome: "committed";
      committedTransition: "cross_destination_activated";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_destination_journal";
          transition: "cross_destination_activated";
        };
    }
  | {
      operation: "compare_activate";
      role: "cross_destination_journal";
      outcome: "not_committed";
      reason:
        | "counterpart_cancelled"
        | "source_reservation_not_active"
        | "expected_account_changed"
        | "plan_invalid";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    }
  | {
      operation: "compare_commit";
      role: "same_identity_journal";
      commitKind: "commit_retained_history";
      outcome: "committed";
      committedTransition: "committed";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "same_identity_journal";
          transition: "committed";
        };
    }
  | {
      operation: "compare_commit";
      role: "cross_destination_journal";
      commitKind: "commit_retained_history";
      outcome: "committed";
      committedTransition: "committed";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_destination_journal";
          transition: "committed";
        };
    }
  | {
      operation: "compare_commit";
      role: "same_identity_journal";
      commitKind: "commit_retained_history";
      outcome: "not_committed";
      reason:
        | "expected_account_changed"
        | "closure_incomplete"
        | "actual_exceeds_reservation"
        | "plan_invalid";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    }
  | {
      operation: "compare_commit";
      role: "cross_destination_journal";
      commitKind: "commit_retained_history";
      outcome: "not_committed";
      reason:
        | "expected_account_changed"
        | "closure_incomplete"
        | "actual_exceeds_reservation"
        | "plan_invalid";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    }
  | {
      operation: "compare_commit";
      role: "cross_source_anchor";
      commitKind: "commit_cross_source_anchor";
      outcome: "committed";
      committedTransition: "committed";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_source_anchor";
          transition: "committed";
        };
    }
  | {
      operation: "compare_commit";
      role: "cross_source_anchor";
      commitKind: "commit_cross_source_anchor";
      outcome: "not_committed";
      reason:
        | "expected_account_changed"
        | "counterpart_commit_missing"
        | "plan_invalid";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    }
  | {
      operation: "compare_release";
      role: "cross_destination_journal";
      releaseKind:
        "cancel_unpublished_cross_destination_intent";
      outcome: "committed";
      committedTransition: "counterpart_cancel_fenced";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_destination_journal";
          transition: "counterpart_cancel_fenced";
        };
    }
  | {
      operation: "compare_release";
      role: "cross_source_anchor";
      releaseKind: "release_provisional_source";
      outcome: "committed";
      committedTransition: "cancelled_provisional";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_source_anchor";
          transition: "cancelled_provisional";
        };
    }
  | {
      operation: "compare_release";
      role: "same_identity_journal";
      releaseKind: "release_retained_history";
      outcome: "committed";
      committedTransition: "released_retained";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "same_identity_journal";
          transition: "released_retained";
        };
      deletionReceipt:
        ProviderMigrationHistoryDeletionReceiptV1;
    }
  | {
      operation: "compare_release";
      role: "cross_destination_journal";
      releaseKind: "release_retained_history";
      outcome: "committed";
      committedTransition: "released_retained";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_destination_journal";
          transition: "released_retained";
        };
      deletionReceipt:
        ProviderMigrationHistoryDeletionReceiptV1;
    }
  | {
      operation: "compare_release";
      role: "cross_source_anchor";
      releaseKind: "release_cross_source_anchor";
      outcome: "committed";
      committedTransition: "released_cross_source_anchor";
      appendedEvent:
        ProviderMigrationHistoryQuotaEventPinV1 & {
          role: "cross_source_anchor";
          transition: "released_cross_source_anchor";
        };
    }
  | {
      operation: "compare_release";
      role: "cross_destination_journal";
      releaseKind:
        "cancel_unpublished_cross_destination_intent";
      outcome: "not_committed";
      reason:
        | "expected_account_changed"
        | "plan_invalid";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    }
  | {
      operation: "compare_release";
      role: "cross_source_anchor";
      releaseKind: "release_provisional_source";
      outcome: "not_committed";
      reason:
        | "expected_account_changed"
        | "reference_closure_nonzero"
        | "counterpart_release_missing";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    }
  | {
      operation: "compare_release";
      role: "same_identity_journal";
      releaseKind: "release_retained_history";
      outcome: "not_committed";
      reason:
        | "expected_account_changed"
        | "reference_closure_nonzero"
        | "deletion_not_committed";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    }
  | {
      operation: "compare_release";
      role: "cross_destination_journal";
      releaseKind: "release_retained_history";
      outcome: "not_committed";
      reason:
        | "expected_account_changed"
        | "reference_closure_nonzero"
        | "deletion_not_committed";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    }
  | {
      operation: "compare_release";
      role: "cross_source_anchor";
      releaseKind: "release_cross_source_anchor";
      outcome: "not_committed";
      reason:
        | "expected_account_changed"
        | "reference_closure_nonzero"
        | "counterpart_release_missing";
      observedState:
        ProviderMigrationHistoryQuotaReceiptObservedStateV1;
    };

interface ProviderMigrationHistoryQuotaOperationReceiptCommonV1 {
  profile:
    "provider_migration_history_quota_operation_receipt_v1";
  installationIdentity: InstallationIdentityStatePinV1;
  receiptOrdinal: number;
  operationNonce: LowerHex32;
  requestContentDigest: ContentDigest;
  resolvedAt: IsoTimestamp;
  receiptToken:
    ProviderMigrationHistoryQuotaOperationReceiptTokenV1;
}

type ProviderMigrationHistoryQuotaOperationReceiptBranchV1<
  RequestProjection extends
    ProviderMigrationHistoryQuotaOperationRequestProjectionV1,
  DurableOutcome extends
    ProviderMigrationHistoryQuotaDurableOutcomeV1
> = ProviderMigrationHistoryQuotaOperationReceiptCommonV1 & {
  requestDurableProjection: RequestProjection;
  durableOutcome: DurableOutcome;
};

type ProviderMigrationHistoryQuotaOperationReceiptForSelectorV1<
  Selector extends
    ProviderMigrationHistoryQuotaOperationSelectorV1
> = Selector extends
  ProviderMigrationHistoryQuotaOperationSelectorV1
  ? ProviderMigrationHistoryQuotaOperationReceiptBranchV1<
      Extract<
        ProviderMigrationHistoryQuotaOperationRequestProjectionV1,
        Selector
      >,
      Extract<
        ProviderMigrationHistoryQuotaDurableOutcomeV1,
        Selector
      >
    >
  : never;

type ProviderMigrationHistoryQuotaOperationReceiptV1 =
  ProviderMigrationHistoryQuotaOperationReceiptForSelectorV1<
    ProviderMigrationHistoryQuotaOperationSelectorV1
  >;

interface ProviderMigrationHistoryQuotaOperationReceiptEnvelopeV1 {
  schemaVersion: 1;
  recordType:
    "provider_migration_history_quota_operation_receipt";
  locatorProfile:
    "installation_provider_migration_history_quota_operation_receipt_v1";
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  operationNonce: LowerHex32;
  resolvedAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderMigrationHistoryQuotaOperationReceiptV1;
}

interface ProviderMigrationHistoryQuotaOperationReceiptPinCommonV1 {
  locatorProfile:
    "installation_provider_migration_history_quota_operation_receipt_v1";
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  operationNonce: LowerHex32;
  contentDigest: ContentDigest;
  receiptToken:
    ProviderMigrationHistoryQuotaOperationReceiptTokenV1;
}

type ProviderMigrationHistoryQuotaOperationReceiptPinV1 =
  ProviderMigrationHistoryQuotaOperationReceiptPinCommonV1 &
    ProviderMigrationHistoryQuotaOperationSelectorV1 &
    {
      outcome: "committed" | "not_committed";
    };

type ProviderMigrationHistoryQuotaOperationResultV1 =
  | {
      resolution: "resolved";
      receipt:
        ProviderMigrationHistoryQuotaOperationReceiptEnvelopeV1;
    }
  | {
      resolution: "request_rejected";
      reason: "operation_nonce_request_mismatch";
      existingReceipt:
        ProviderMigrationHistoryQuotaOperationReceiptEnvelopeV1;
    }
  | {
      resolution: "state_unavailable";
      reason:
        | "ledger_integrity_failed"
        | "ledger_capacity_exhausted"
        | "pre_admission_quota_exhausted";
      evidenceDigest?: ContentDigest;
      persistence: "zero_write_no_receipt";
    };

type ProviderMigrationLiveObjectKindV1 =
  | "store_manifest_generation"
  | "quota_index_node"
  | "quota_index_root"
  | "quota_transition_record"
  | "artifact_manifest_generation"
  | "repo_pulse_immutable_version"
  | "committed_private_blob"
  | "committed_private_metadata"
  | "ownership_marker"
  | "initialization_terminal_receipt"
  | "terminalization_handoff_record"
  | "provider_journal_record"
  | "provider_operation_receipt"
  | "store_manifest_compare_append_receipt"
  | "reservation_membership"
  | "active_blob_entitlement"
  | "active_metadata_plan"
  | "active_temp_plan"
  | "control_state";

type ProviderMigrationLiveObjectLocatorV1 =
  | {
      namespace: "store";
      relativePath: StoreRelativePathV1;
    }
  | {
      namespace:
        "provider_isolated_store_manifest_receipt_ledger";
      locatorProfile:
        "store_manifest_compare_append_receipt_v1";
      providerId: DurableObjectIdentityProviderIdV1;
      repositoryId: PathSafeRepositoryIdV1;
      worktreeId: PathSafeWorktreeIdV1;
      operationNonce: LowerHex32;
    };

interface ProviderMigrationLiveObjectEntryV1 {
  objectOrdinal: number; // contiguous 0..N-1
  objectKind: ProviderMigrationLiveObjectKindV1;
  logicalLocator: ProviderMigrationLiveObjectLocatorV1;
  semanticLocatorDigest: ContentDigest;
  contentDigest: ContentDigest;
  logicalBytes: number; // nonnegative safe integer
  providerBinding: StoreDurableObjectBindingV1;
}

type ProviderMigrationLiveReferenceSourceV1 =
  | {
      sourceKind: "root";
      rootOrdinal: number;
    }
  | {
      sourceKind: "object";
      objectOrdinal: number;
      objectContentDigest: ContentDigest;
    };

type ProviderMigrationReferenceSlotDescriptorV1 =
  | {
      sourceKind: "root";
      rootKind:
        ProviderMigrationLiveReferenceRootV1["rootKind"];
      schemaFieldPath: CanonicalByteStringV1;
        // decoded canonical RFC 6901 JSON Pointer, ASCII schema names only
      occurrenceOrdinal: number; // integer >=0
    }
  | {
      sourceKind: "object";
      objectKind: ProviderMigrationLiveObjectKindV1;
      schemaFieldPath: CanonicalByteStringV1;
      occurrenceOrdinal: number; // integer >=0
    };

interface ProviderMigrationLiveReferenceEdgeV1 {
  from: ProviderMigrationLiveReferenceSourceV1;
  referenceSlot: ProviderMigrationReferenceSlotV1;
  referenceSlotDescriptor:
    ProviderMigrationReferenceSlotDescriptorV1;
  toObjectOrdinal: number;
}

type ProviderMigrationLiveReferenceRootV1 =
  | {
      rootKind: "store_manifest_complete_set";
      current: StoreManifestCurrentVersionPinV1;
    }
  | {
      rootKind: "quota_index_and_transition_chain";
      currentQuotaIndexRootContentDigest: ContentDigest;
      transitionHead:
        | { state: "genesis" }
        | {
            state: "transition";
            recordId: PrivateStoreQuotaTransitionRecordId;
            contentDigest: ContentDigest;
          };
    }
  | {
      rootKind: "artifact_descriptor_history_closure";
      rootCount: number;
      rootSetDigest: ContentDigest;
    }
  | {
      rootKind: "initialization_terminal";
      terminalHead: StoreInitializationTerminalHeadPinV1;
    }
  | {
      rootKind:
        "store_manifest_compare_append_receipt_ledger";
      providerId: DurableObjectIdentityProviderIdV1;
      providerPolicyDigest: ContentDigest;
      receiptCount: number;
      receiptSetDigest: ContentDigest;
      receiptLogicalBytes: number;
    }
  | {
      rootKind: "active_recovery_control";
      activeTransactionCount: 0;
      controlUniverseDigest: ContentDigest;
    };

interface ProviderMigrationLiveReferenceRootEntryV1 {
  rootOrdinal: number; // contiguous 0..N-1
  root: ProviderMigrationLiveReferenceRootV1;
}

interface ProviderMigrationLiveRootSetV1 {
  entries: [
    ProviderMigrationLiveReferenceRootEntryV1,
    ...ProviderMigrationLiveReferenceRootEntryV1[]
  ];
}

interface ProviderMigrationLiveObjectSetV1 {
  entries: [
    ProviderMigrationLiveObjectEntryV1,
    ...ProviderMigrationLiveObjectEntryV1[]
  ];
}

interface ProviderMigrationLiveReferenceSetV1 {
  entries: ProviderMigrationLiveReferenceEdgeV1[];
}

interface ProviderMigrationLiveReferenceUniverseV1 {
  profile: "provider_migration_live_reference_universe_v1";
  universeId: ProviderMigrationLiveUniverseIdV1;
  migrationId: ProviderMigrationIdV1;
  migrationPlan: ProviderMigrationPlanPinV1;
  side: "source" | "destination";
  endpointTrustContentDigest: ContentDigest;
  storeManifest: StoreManifestCurrentVersionPinV1;
  providerFreezeStateVersionToken:
    StoreProviderStateVersionTokenV1;
  liveReferenceSchemaDigest: ContentDigest;
  rootSet: ProviderMigrationLiveRootSetV1;
  objectSet: ProviderMigrationLiveObjectSetV1;
  referenceSet: ProviderMigrationLiveReferenceSetV1;
  rootCount: number;
  rootSetDigest: ContentDigest;
  canonicalRootSetBytes: number;
  objectCount: number;
  objectSetDigest: ContentDigest;
  canonicalObjectSetBytes: number;
  logicalObjectBytesTotal: number;
  referenceCount: number;
  referenceSetDigest: ContentDigest;
  canonicalReferenceSetBytes: number;
  canonicalUniverseBytes: number;
  activeTransactions: [];
  createdAt: IsoTimestamp;
  universeToken: KeyedStateTokenV1;
}

interface ProviderMigrationLiveReferenceUniverseEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_migration_live_reference_universe";
  universeId: ProviderMigrationLiveUniverseIdV1;
  migrationId: ProviderMigrationIdV1;
  side: "source" | "destination";
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderMigrationLiveReferenceUniverseV1;
}

interface ProviderMigrationLiveReferenceUniversePinV1 {
  locatorProfile:
    "installation_provider_migration_live_universe_v1";
  universeId: ProviderMigrationLiveUniverseIdV1;
  migrationId: ProviderMigrationIdV1;
  side: "source" | "destination";
  contentDigest: ContentDigest;
  rootCount: number;
  rootSetDigest: ContentDigest;
  objectCount: number;
  objectSetDigest: ContentDigest;
  referenceCount: number;
  referenceSetDigest: ContentDigest;
}

interface ProviderMigrationLiveObjectEntryPinV1 {
  sourceUniverse: ProviderMigrationLiveReferenceUniversePinV1;
  objectOrdinal: number;
  objectKind: ProviderMigrationLiveObjectKindV1;
  semanticLocatorDigest: ContentDigest;
  contentDigest: ContentDigest;
  providerBinding: StoreDurableObjectBindingV1;
}

interface ProviderMigrationDestinationObjectExpectationV1 {
  objectOrdinal: number; // exact-equal source object ordinal
  objectKind: ProviderMigrationLiveObjectKindV1;
  logicalLocator: ProviderMigrationLiveObjectLocatorV1;
  semanticLocatorDigest: ContentDigest;
  expectedContentDigest: ContentDigest;
  expectedLogicalBytes: number; // nonnegative safe integer
  destinationProviderId: DurableObjectIdentityProviderIdV1;
  destinationProviderPolicyDigest: ContentDigest;
}

interface ProviderMigrationDestinationObjectPinV1 {
  objectOrdinal: number;
  objectKind: ProviderMigrationLiveObjectKindV1;
  logicalLocator: ProviderMigrationLiveObjectLocatorV1;
  semanticLocatorDigest: ContentDigest;
  contentDigest: ContentDigest;
  logicalBytes: number;
  providerBinding: StoreDurableObjectBindingV1;
}

interface ProviderMigrationCanonicalReferenceRewriteAlgorithmV1 {
  profile:
    "provider_migration_canonical_reference_rewrite_algorithm_v1";
  strictDecoder: "strict_object_schema_without_coercion_v1";
  canonicalEncoder: "rfc8785-jcs-safe-integer-v1";
  referenceSlotOrder:
    "source_kind_source_ordinal_reference_slot_target_ordinal_v1";
  referenceEncoding:
    "destination_object_kind_and_semantic_locator_v1";
  nonReferenceProjection:
    "replace_exact_reference_slots_with_typed_slot_sentinel_v1";
  sccDiscovery:
    "tarjan_source_ordinal_and_sorted_adjacency_v1";
  sccExecutionOrder:
    "reverse_condensation_topological_min_member_tiebreak_v1";
  cyclicSccRule:
    "precompute_all_member_bytes_then_publish_source_ordinal_ascending_v1";
  destinationCutRule:
    "all_scc_members_proved_before_destination_cut_v1";
}

type ProviderMigrationCanonicalReferenceRewriteObjectMappingV1 =
  | {
      objectMappingOrdinal: number; // contiguous 0..N-1
      sourceObject: ProviderMigrationLiveObjectEntryPinV1;
      destinationObject:
        ProviderMigrationDestinationObjectExpectationV1;
      transformation: "byte_identical_rebind";
      sourceReferenceCount: 0;
      sourceReferenceMappingSetDigest: ContentDigest;
      canonicalSourceReferenceMappingSetBytes: number;
    }
  | {
      objectMappingOrdinal: number; // contiguous 0..N-1
      sourceObject: ProviderMigrationLiveObjectEntryPinV1;
      destinationObject:
        ProviderMigrationDestinationObjectExpectationV1;
      transformation: "canonical_reference_rewrite";
      sourceReferenceCount: number; // integer >=1
      sourceReferenceMappingSetDigest: ContentDigest;
      canonicalSourceReferenceMappingSetBytes: number;
    };

interface ProviderMigrationCanonicalReferenceSlotMappingV1 {
  mappingOrdinal: number; // contiguous 0..referenceCount-1
  sourceEdge: ProviderMigrationLiveReferenceEdgeV1;
  destinationFrom: ProviderMigrationLiveReferenceSourceV1;
  destinationReferenceSlot: ProviderMigrationReferenceSlotV1;
  destinationReferenceSlotDescriptor:
    ProviderMigrationReferenceSlotDescriptorV1;
  destinationToObjectOrdinal: number;
  destinationTargetSemanticLocatorDigest: ContentDigest;
  sourceCanonicalReferenceBytesDigest: ContentDigest;
  destinationCanonicalReferenceBytesDigest: ContentDigest;
  rewriteAction:
    "replace_source_reference_with_destination_reference";
}

interface ProviderMigrationCanonicalReferenceRewriteSccV1 {
  sccOrdinal: number; // contiguous execution order 0..N-1
  memberSourceObjectOrdinals: [number, ...number[]];
    // ascending + unique
  dependencySccOrdinals: number[];
    // ascending + unique；every dependency ordinal < sccOrdinal
  cycleKind:
    | "acyclic_singleton"
    | "self_referential_singleton"
    | "multi_object_cycle";
  publishRule:
    "precompute_all_member_bytes_then_publish_source_ordinal_ascending_v1";
}

interface ProviderMigrationCanonicalReferenceRewritePlanV1 {
  profile:
    "provider_migration_canonical_reference_rewrite_plan_v1";
  rewritePlanId:
    ProviderMigrationCanonicalReferenceRewritePlanIdV1;
  migrationId: ProviderMigrationIdV1;
  migrationPlan: ProviderMigrationPlanPinV1;
  mode: "cross_installation_rebootstrap";
  sourceUniverse:
    ProviderMigrationLiveReferenceUniversePinV1 & {
      side: "source";
    };
  sourceFreezeStateVersionToken:
    StoreProviderStateVersionTokenV1;
  destinationNamespace: ProviderMigrationNamespaceIdentityV1;
  sourceWriter: ProviderActiveWriterSelectionV1;
  destinationWriter: ProviderActiveWriterSelectionV1;
  rewriteAlgorithm:
    ProviderMigrationCanonicalReferenceRewriteAlgorithmV1;
  objectMappings: [
    ProviderMigrationCanonicalReferenceRewriteObjectMappingV1,
    ...ProviderMigrationCanonicalReferenceRewriteObjectMappingV1[]
  ];
  objectCount: number;
  objectMappingSetDigest: ContentDigest;
  canonicalObjectMappingSetBytes: number;
  referenceSlotMappings:
    ProviderMigrationCanonicalReferenceSlotMappingV1[];
  referenceCount: number;
  referenceSlotMappingSetDigest: ContentDigest;
  canonicalReferenceSlotMappingSetBytes: number;
  sccSchedule: [
    ProviderMigrationCanonicalReferenceRewriteSccV1,
    ...ProviderMigrationCanonicalReferenceRewriteSccV1[]
  ];
  sccCount: number;
  sccSetDigest: ContentDigest;
  canonicalSccSetBytes: number;
  canonicalRewritePlanBytes: number;
  createdAt: IsoTimestamp;
  rewritePlanToken:
    ProviderMigrationCanonicalReferenceRewritePlanTokenV1;
  destinationProviderSignature:
    ProviderMigrationCanonicalReferenceRewritePlanSignatureV1;
}

interface ProviderMigrationCanonicalReferenceRewritePlanEnvelopeV1 {
  schemaVersion: 1;
  recordType:
    "provider_migration_canonical_reference_rewrite_plan";
  rewritePlanId:
    ProviderMigrationCanonicalReferenceRewritePlanIdV1;
  migrationId: ProviderMigrationIdV1;
  sourceUniverseId: ProviderMigrationLiveUniverseIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderMigrationCanonicalReferenceRewritePlanV1;
}

interface ProviderMigrationCanonicalReferenceRewritePlanPinV1 {
  locatorProfile:
    "installation_provider_migration_rewrite_plan_v1";
  rewritePlanId:
    ProviderMigrationCanonicalReferenceRewritePlanIdV1;
  migrationId: ProviderMigrationIdV1;
  sourceUniverseId: ProviderMigrationLiveUniverseIdV1;
  sourceUniverseContentDigest: ContentDigest;
  contentDigest: ContentDigest;
  rewritePlanToken:
    ProviderMigrationCanonicalReferenceRewritePlanTokenV1;
  destinationProviderSignature:
    ProviderMigrationCanonicalReferenceRewritePlanSignatureV1;
}

interface ProviderMigrationRewrittenReferenceProofEntryV1 {
  mappingOrdinal: number;
  referenceSlot: ProviderMigrationReferenceSlotV1;
  sourceCanonicalReferenceBytesDigest: ContentDigest;
  destinationCanonicalReferenceBytesDigest: ContentDigest;
}

interface ProviderMigrationSemanticEquivalenceProofV1 {
  profile:
    "provider_migration_semantic_equivalence_proof_v1";
  proofId: ProviderMigrationSemanticEquivalenceProofIdV1;
  migrationId: ProviderMigrationIdV1;
  migrationPlan: ProviderMigrationPlanPinV1;
  rewritePlan:
    ProviderMigrationCanonicalReferenceRewritePlanPinV1;
  objectMappingOrdinal: number;
  sccOrdinal: number;
  sourceObject: ProviderMigrationLiveObjectEntryPinV1;
  destinationObject: ProviderMigrationDestinationObjectPinV1;
  rewriteAlgorithm:
    ProviderMigrationCanonicalReferenceRewriteAlgorithmV1;
  sourceContentDigest: ContentDigest;
    // exact-equal sourceObject.contentDigest
  destinationContentDigest: ContentDigest;
    // exact-equal destinationObject.contentDigest
  sourceNonReferenceCanonicalBytesDigest: ContentDigest;
  destinationNonReferenceCanonicalBytesDigest: ContentDigest;
  rewrittenReferences: [
    ProviderMigrationRewrittenReferenceProofEntryV1,
    ...ProviderMigrationRewrittenReferenceProofEntryV1[]
  ];
  rewrittenReferenceCount: number;
  rewrittenReferenceSetDigest: ContentDigest;
  canonicalRewrittenReferenceSetBytes: number;
  missingReferenceMappings: [];
  duplicateReferenceMappings: [];
  unexpectedDestinationReferenceSlots: [];
  sourceReferenceDigestMismatches: [];
  destinationReferenceDigestMismatches: [];
  nonReferenceCanonicalByteMismatches: [];
  sccRuleViolations: [];
  sourceRevalidationStateVersionToken:
    StoreProviderStateVersionTokenV1;
  canonicalProofBytes: number;
  provedAt: IsoTimestamp;
  proofToken:
    ProviderMigrationSemanticEquivalenceProofTokenV1;
  destinationProviderSignature:
    ProviderMigrationSemanticEquivalenceProofSignatureV1;
}

interface ProviderMigrationSemanticEquivalenceProofEnvelopeV1 {
  schemaVersion: 1;
  recordType:
    "provider_migration_semantic_equivalence_proof";
  proofId: ProviderMigrationSemanticEquivalenceProofIdV1;
  migrationId: ProviderMigrationIdV1;
  rewritePlanId:
    ProviderMigrationCanonicalReferenceRewritePlanIdV1;
  sourceObjectOrdinal: number;
  destinationObjectOrdinal: number;
  provedAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderMigrationSemanticEquivalenceProofV1;
}

interface ProviderMigrationSemanticEquivalenceProofPinV1 {
  locatorProfile:
    "installation_provider_migration_semantic_equivalence_proof_v1";
  proofId: ProviderMigrationSemanticEquivalenceProofIdV1;
  migrationId: ProviderMigrationIdV1;
  rewritePlanId:
    ProviderMigrationCanonicalReferenceRewritePlanIdV1;
  rewritePlanContentDigest: ContentDigest;
  sourceObjectOrdinal: number;
  destinationObjectOrdinal: number;
  sourceContentDigest: ContentDigest;
  destinationContentDigest: ContentDigest;
  contentDigest: ContentDigest;
  proofToken:
    ProviderMigrationSemanticEquivalenceProofTokenV1;
  destinationProviderSignature:
    ProviderMigrationSemanticEquivalenceProofSignatureV1;
}

interface ProviderMigrationSemanticEquivalenceProofSetEntryV1 {
  sourceObjectOrdinal: number;
  rewritePlanId:
    ProviderMigrationCanonicalReferenceRewritePlanIdV1;
  semanticEquivalenceProof:
    ProviderMigrationSemanticEquivalenceProofPinV1;
}

interface ProviderMigrationSemanticEquivalenceProofSetV1 {
  migrationId: ProviderMigrationIdV1;
  rewritePlanId:
    ProviderMigrationCanonicalReferenceRewritePlanIdV1;
  sourceUniverseId: ProviderMigrationLiveUniverseIdV1;
  entries: ProviderMigrationSemanticEquivalenceProofSetEntryV1[];
}

interface ProviderMigrationCanonicalRootRewriteProofEntryV1 {
  rootOrdinal: number; // contiguous 0..rootCount-1
  rootKind:
    ProviderMigrationLiveReferenceRootV1["rootKind"];
  sourceRoot: ProviderMigrationLiveReferenceRootEntryV1;
  destinationRoot: ProviderMigrationLiveReferenceRootEntryV1;
  sourceNonReferenceCanonicalBytesDigest: ContentDigest;
  destinationNonReferenceCanonicalBytesDigest: ContentDigest;
  rewrittenReferences:
    ProviderMigrationRewrittenReferenceProofEntryV1[];
  rewrittenReferenceCount: number;
  rewrittenReferenceSetDigest: ContentDigest;
  canonicalRewrittenReferenceSetBytes: number;
  missingReferenceMappings: [];
  duplicateReferenceMappings: [];
  unexpectedDestinationReferenceSlots: [];
  sourceReferenceDigestMismatches: [];
  destinationReferenceDigestMismatches: [];
  nonReferenceCanonicalByteMismatches: [];
}

interface ProviderMigrationCanonicalRootRewriteProofSetV1 {
  migrationId: ProviderMigrationIdV1;
  rewritePlan:
    ProviderMigrationCanonicalReferenceRewritePlanPinV1;
  sourceUniverse:
    ProviderMigrationLiveReferenceUniversePinV1 & {
      side: "source";
    };
  destinationUniverse:
    ProviderMigrationLiveReferenceUniversePinV1 & {
      side: "destination";
    };
  entries: [
    ProviderMigrationCanonicalRootRewriteProofEntryV1,
    ...ProviderMigrationCanonicalRootRewriteProofEntryV1[]
  ];
}

interface ProviderMigrationObjectReceiptV1 {
  profile: "provider_migration_object_receipt_v1";
  receiptId: ProviderMigrationObjectReceiptIdV1;
  migrationId: ProviderMigrationIdV1;
  migrationPlan: ProviderMigrationPlanPinV1;
  sourceObject: ProviderMigrationLiveObjectEntryPinV1;
  destinationObject: ProviderMigrationDestinationObjectPinV1;
  transformation:
    | { kind: "byte_identical_rebind" }
    | {
        kind: "canonical_reference_rewrite";
        mode: "cross_installation_rebootstrap";
        rewritePlan:
          ProviderMigrationCanonicalReferenceRewritePlanPinV1;
        semanticEquivalenceProof:
          ProviderMigrationSemanticEquivalenceProofPinV1;
      };
  destinationPublication:
    StoreProviderAtomicPublishCommittedEvidenceV1;
  sourceRevalidationStateVersionToken:
    StoreProviderStateVersionTokenV1;
  sourceDisposition:
    "retained_unreferenced_pending_retirement";
  createdAt: IsoTimestamp;
  receiptToken: ProviderMigrationReceiptTokenV1;
}

interface ProviderMigrationObjectReceiptEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_migration_object_receipt";
  receiptId: ProviderMigrationObjectReceiptIdV1;
  migrationId: ProviderMigrationIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderMigrationObjectReceiptV1;
}

interface ProviderMigrationObjectReceiptPinV1 {
  locatorProfile:
    "installation_provider_migration_object_receipt_v1";
  receiptId: ProviderMigrationObjectReceiptIdV1;
  migrationId: ProviderMigrationIdV1;
  contentDigest: ContentDigest;
}

interface ProviderMigrationObjectReceiptSetEntryV1 {
  sourceObjectOrdinal: number; // contiguous 0..N-1
  sourceObjectContentDigest: ContentDigest;
  receipt: ProviderMigrationObjectReceiptPinV1;
}

interface ProviderMigrationObjectReceiptPrefixSetV1 {
  migrationId: ProviderMigrationIdV1;
  sourceUniverseId: ProviderMigrationLiveUniverseIdV1;
  entries: ProviderMigrationObjectReceiptSetEntryV1[];
    // canonical contiguous prefix 0..entries.length-1；empty allowed
}

interface ProviderMigrationObjectReceiptSetV1 {
  migrationId: ProviderMigrationIdV1;
  sourceUniverseId: ProviderMigrationLiveUniverseIdV1;
  entries: [
    ProviderMigrationObjectReceiptSetEntryV1,
    ...ProviderMigrationObjectReceiptSetEntryV1[]
  ];
}

interface ProviderMigrationRetainedPhysicalSourceObjectEntryV1 {
  sourceObjectOrdinal: number; // contiguous 0..N-1
  objectKind: ProviderMigrationLiveObjectKindV1;
  contentDigest: ContentDigest;
  logicalBytes: number;
  providerBinding: StoreDurableObjectBindingV1;
}

interface ProviderMigrationRetainedPhysicalSourceObjectSetV1 {
  migrationId: ProviderMigrationIdV1;
  sourceUniverseId: ProviderMigrationLiveUniverseIdV1;
  entries: ProviderMigrationRetainedPhysicalSourceObjectEntryV1[];
}

type ProviderMigrationCanonicalReferenceRewriteClosureV1 =
  | {
      state: "not_required";
      mode: "same_installation_identity";
      rewritePlan: { state: "absent" };
      canonicalRewriteReceiptCount: 0;
      semanticEquivalenceProofCount: 0;
      semanticEquivalenceProofSetDigest: ContentDigest;
        // versioned empty proof-set golden digest
      canonicalSemanticEquivalenceProofSetBytes: number;
      missingSemanticEquivalenceProofs: [];
      duplicateSemanticEquivalenceProofs: [];
      rewritePlanMismatchProofs: [];
      rootRewriteProofCount: 0;
      rootRewriteProofSetDigest: ContentDigest;
        // versioned empty root-proof-set golden digest
      canonicalRootRewriteProofSetBytes: number;
      missingRootRewriteProofs: [];
      duplicateRootRewriteProofs: [];
      unexpectedDestinationRoots: [];
      rootKindMismatchProofs: [];
      rootReferenceMappingMismatchProofs: [];
      rootNonReferenceCanonicalByteMismatchProofs: [];
    }
  | {
      state: "proved";
      mode: "cross_installation_rebootstrap";
      rewritePlan:
        ProviderMigrationCanonicalReferenceRewritePlanPinV1;
      canonicalRewriteReceiptCount: number; // nonnegative safe integer
      semanticEquivalenceProofCount: number; // exact-equal receipt count
      semanticEquivalenceProofSetDigest: ContentDigest;
      canonicalSemanticEquivalenceProofSetBytes: number;
      missingSemanticEquivalenceProofs: [];
      duplicateSemanticEquivalenceProofs: [];
      rewritePlanMismatchProofs: [];
      rootRewriteProofCount: number;
        // exact-equal source/destination universe root count
      rootRewriteProofSetDigest: ContentDigest;
      canonicalRootRewriteProofSetBytes: number;
      missingRootRewriteProofs: [];
      duplicateRootRewriteProofs: [];
      unexpectedDestinationRoots: [];
      rootKindMismatchProofs: [];
      rootReferenceMappingMismatchProofs: [];
      rootNonReferenceCanonicalByteMismatchProofs: [];
    };

interface ProviderMigrationZeroLiveReferenceProofV1 {
  profile: "provider_migration_zero_live_reference_proof_v1";
  proofId: ProviderMigrationZeroLiveProofIdV1;
  migrationId: ProviderMigrationIdV1;
  migrationPlan: ProviderMigrationPlanPinV1;
  sourceUniverse:
    ProviderMigrationLiveReferenceUniversePinV1;
  destinationUniverse:
    ProviderMigrationLiveReferenceUniversePinV1;
  sourceStoreCut: StoreManifestCurrentVersionPinV1;
  destinationStoreCut: StoreManifestCurrentVersionPinV1;
  sourceFreezeStateVersionToken:
    StoreProviderStateVersionTokenV1;
  receiptCount: number; // exact-equal sourceUniverse.objectCount
  receiptSetDigest: ContentDigest; // complete receipt-set domain only
  canonicalReceiptSetBytes: number; // complete receipt-set canonical bytes
  canonicalReferenceRewriteClosure:
    ProviderMigrationCanonicalReferenceRewriteClosureV1;
  expectedSourceObjectCount: number; // exact-equal sourceUniverse.objectCount
  remainingSourceProviderReferences: [];
  unmappedSourceObjects: [];
  duplicateSourceMappings: [];
  unverifiedDestinationObjects: [];
  activeTransactions: [];
  retainedPhysicalSourceObjectCount: number;
  retainedPhysicalSourceObjectSetDigest: ContentDigest;
  canonicalRetainedPhysicalSourceObjectSetBytes: number;
  canonicalProofBytes: number;
  provedAt: IsoTimestamp;
  proofToken: ProviderMigrationProofTokenV1;
}

interface ProviderMigrationZeroLiveReferenceProofEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_migration_zero_live_reference_proof";
  proofId: ProviderMigrationZeroLiveProofIdV1;
  migrationId: ProviderMigrationIdV1;
  provedAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderMigrationZeroLiveReferenceProofV1;
}

interface ProviderMigrationZeroLiveReferenceProofPinV1 {
  locatorProfile:
    "installation_provider_migration_zero_live_proof_v1";
  proofId: ProviderMigrationZeroLiveProofIdV1;
  migrationId: ProviderMigrationIdV1;
  contentDigest: ContentDigest;
  proofToken: ProviderMigrationProofTokenV1;
}

type ProviderMigrationSourceTombstoneV1 =
  | {
      profile: "provider_migration_source_tombstone_v1";
      tombstoneId: ProviderMigrationSourceTombstoneIdV1;
      migrationId: ProviderMigrationIdV1;
      mode: "same_installation_identity";
      migrationPlan: ProviderMigrationPlanPinV1;
      sourceInstallationIdentity:
        InstallationIdentityStatePinV1;
      sourceProviderId: DurableObjectIdentityProviderIdV1;
      lastEnabledRegistryEntryContentDigest: ContentDigest;
      zeroLiveProof:
        ProviderMigrationZeroLiveReferenceProofPinV1;
      tombstoneRegistryManifest:
        ProviderRegistryManifestPinV1;
      reason: "migration_completed";
      createdAt: IsoTimestamp;
    }
  | {
      profile: "provider_migration_source_tombstone_v1";
      tombstoneId: ProviderMigrationSourceTombstoneIdV1;
      migrationId: ProviderMigrationIdV1;
      mode: "cross_installation_rebootstrap";
      migrationPlan: ProviderMigrationPlanPinV1;
      sourceInstallationIdentity:
        InstallationIdentityStatePinV1;
      sourceRecoveryOnlyAcceptance:
        ProviderAcceptanceCurrentPinV1;
      sourceProviderId: DurableObjectIdentityProviderIdV1;
      lastEnabledRegistryEntryContentDigest: ContentDigest;
      zeroLiveProof:
        ProviderMigrationZeroLiveReferenceProofPinV1;
      destinationInstallationIdentity:
        InstallationIdentityStatePinV1;
      destinationActiveRoot:
        ProviderRegistryRootMetadataPinV1;
      destinationRebootstrapBundleDigest: ContentDigest;
      sourceIdentityRetirementPolicyDigest: ContentDigest;
      reason:
        "recovery_key_compromise_identity_permanently_retired";
      createdAt: IsoTimestamp;
      destinationRootSignature:
        ProviderMigrationSourceTombstoneSignatureV1;
    };

interface ProviderMigrationSourceTombstoneEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_migration_source_tombstone";
  tombstoneId: ProviderMigrationSourceTombstoneIdV1;
  migrationId: ProviderMigrationIdV1;
  mode:
    | "same_installation_identity"
    | "cross_installation_rebootstrap";
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderMigrationSourceTombstoneV1;
}

interface ProviderMigrationSourceTombstonePinV1 {
  locatorProfile:
    "installation_provider_migration_source_tombstone_v1";
  tombstoneId: ProviderMigrationSourceTombstoneIdV1;
  migrationId: ProviderMigrationIdV1;
  mode:
    | "same_installation_identity"
    | "cross_installation_rebootstrap";
  contentDigest: ContentDigest;
}

interface ProviderMigrationProgressRecordPinV1 {
  locatorProfile:
    "installation_provider_migration_progress_record_v1";
  migrationId: ProviderMigrationIdV1;
  recordOrdinal: number;
  recordId: ProviderMigrationProgressRecordIdV1;
  contentDigest: ContentDigest;
}

interface ProviderMigrationProgressRecordCommonV1 {
  profile: "provider_migration_progress_record_v1";
  migrationId: ProviderMigrationIdV1;
  migrationPlan: ProviderMigrationPlanPinV1;
  recordOrdinal: number;
  recordId: ProviderMigrationProgressRecordIdV1;
  phasePayloadContentDigest: ContentDigest;
  migratedObjectCount: number; // exact-equal receiptCount
  receiptCount: number; // exact-equal canonical prefix entries.length
  receiptPrefixSetDigest: ContentDigest;
    // provider-migration-object-receipt-prefix-set-v1；empty allowed
  canonicalReceiptPrefixSetBytes: number;
  createdAt: IsoTimestamp;
}

type ProviderMigrationProgressRecordV1 =
  | (ProviderMigrationProgressRecordCommonV1 & {
      phase: "started";
      predecessor: { state: "genesis" };
      sourceExecutionAcceptance: ProviderAcceptanceCurrentPinV1;
      destinationMigrationOnlyAcceptance:
        ProviderAcceptanceCurrentPinV1;
      sourceUniverse:
        ProviderMigrationLiveReferenceUniversePinV1;
      canonicalReferenceRewritePlan:
        | {
            state: "not_required";
            mode: "same_installation_identity";
          }
        | {
            state: "required";
            mode: "cross_installation_rebootstrap";
            rewritePlan:
              ProviderMigrationCanonicalReferenceRewritePlanPinV1;
          };
      migratedObjectCount: 0;
      receiptCount: 0;
    })
  | (ProviderMigrationProgressRecordCommonV1 & {
      phase: "object_planned";
      predecessor: {
        state: "record";
        record: ProviderMigrationProgressRecordPinV1;
      };
      sourceObject: ProviderMigrationLiveObjectEntryPinV1;
      operationNonce: LowerHex32;
      destinationPublicationRequest:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      transformationPlan:
        | {
            kind: "byte_identical_rebind";
          }
        | {
            kind: "canonical_reference_rewrite";
            mode: "cross_installation_rebootstrap";
            rewritePlan:
              ProviderMigrationCanonicalReferenceRewritePlanPinV1;
            objectMappingOrdinal: number;
            sccOrdinal: number;
            expectedDestinationContentDigest: ContentDigest;
          };
    })
  | (ProviderMigrationProgressRecordCommonV1 & {
      phase: "object_committed";
      predecessor: {
        state: "record";
        record: ProviderMigrationProgressRecordPinV1;
        requiredPhase: "object_planned";
      };
      objectReceipt: ProviderMigrationObjectReceiptPinV1;
    })
  | (ProviderMigrationProgressRecordCommonV1 & {
      phase: "destination_cut_planned";
      predecessor: {
        state: "record";
        record: ProviderMigrationProgressRecordPinV1;
      };
      destinationStoreCompareAppend:
        StoreManifestCompareAppendRequestV1;
    })
  | (ProviderMigrationProgressRecordCommonV1 & {
      phase: "destination_cut_committed";
      predecessor: {
        state: "record";
        record: ProviderMigrationProgressRecordPinV1;
        requiredPhase: "destination_cut_planned";
      };
      destinationStore:
        StoreManifestCurrentVersionPinV1;
      destinationStoreReceipt:
        StoreManifestCompareAppendReceiptPinV1;
      destinationUniverse:
        ProviderMigrationLiveReferenceUniversePinV1;
    })
  | (ProviderMigrationProgressRecordCommonV1 & {
      phase: "source_drained";
      predecessor: {
        state: "record";
        record: ProviderMigrationProgressRecordPinV1;
        requiredPhase: "destination_cut_committed";
      };
      zeroLiveProof:
        ProviderMigrationZeroLiveReferenceProofPinV1;
    })
  | (ProviderMigrationProgressRecordCommonV1 & {
      phase: "source_tombstone_planned";
      predecessor: {
        state: "record";
        record: ProviderMigrationProgressRecordPinV1;
        requiredPhase: "source_drained";
      };
      tombstoneId: ProviderMigrationSourceTombstoneIdV1;
      expectedTombstoneContentDigest: ContentDigest;
    })
  | (ProviderMigrationProgressRecordCommonV1 & {
      phase: "source_tombstone_committed";
      predecessor: {
        state: "record";
        record: ProviderMigrationProgressRecordPinV1;
        requiredPhase: "source_tombstone_planned";
      };
      sourceTombstone: ProviderMigrationSourceTombstonePinV1;
    })
  | (ProviderMigrationProgressRecordCommonV1 & {
      phase: "ready_to_activate";
      predecessor: {
        state: "record";
        record: ProviderMigrationProgressRecordPinV1;
        requiredPhase: "source_tombstone_committed";
      };
      zeroLiveProof:
        ProviderMigrationZeroLiveReferenceProofPinV1;
      sourceTombstone: ProviderMigrationSourceTombstonePinV1;
      destinationUniverse:
        ProviderMigrationLiveReferenceUniversePinV1;
      strongReadyCore: ProviderMigrationStrongReadyCoreV1;
      strongReadyCoreContentDigest: ContentDigest;
    });

interface ProviderMigrationProgressRecordEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_migration_progress_record";
  migrationId: ProviderMigrationIdV1;
  recordOrdinal: number;
  recordId: ProviderMigrationProgressRecordIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderMigrationProgressRecordV1;
}

interface ProviderMigrationProgressEnumerationEntryV1
  extends ProviderMigrationProgressRecordPinV1 {
  commitOperationNonce: LowerHex32;
  phase: ProviderMigrationProgressRecordV1["phase"];
  predecessor:
    | { state: "genesis" }
    | {
        state: "record";
        recordOrdinal: number;
        recordId: ProviderMigrationProgressRecordIdV1;
        contentDigest: ContentDigest;
      };
}

interface ProviderMigrationProgressRecordSetV1 {
  migrationId: ProviderMigrationIdV1;
  entries: [
    ProviderMigrationProgressEnumerationEntryV1,
    ...ProviderMigrationProgressEnumerationEntryV1[]
  ];
}

interface ProviderMigrationProgressEnumerationV1 {
  profile: "provider_migration_progress_enumeration_v1";
  migrationId: ProviderMigrationIdV1;
  entries: [
    ProviderMigrationProgressEnumerationEntryV1,
    ...ProviderMigrationProgressEnumerationEntryV1[]
  ];
  recordCount: number;
  recordSetDigest: ContentDigest;
  canonicalRecordSetBytes: number;
}

interface ProviderMigrationSealedClosureV1 {
  migrationPlan: ProviderMigrationPlanPinV1;
  readyToActivateRecord: ProviderMigrationProgressRecordPinV1;
  sourceUniverse: ProviderMigrationLiveReferenceUniversePinV1;
  destinationUniverse:
    ProviderMigrationLiveReferenceUniversePinV1;
  receiptCount: number; // exact-equal sourceUniverse.objectCount
  receiptSetDigest: ContentDigest; // complete receipt-set domain only
  canonicalReceiptSetBytes: number; // complete receipt-set canonical bytes
  zeroLiveProof:
    ProviderMigrationZeroLiveReferenceProofPinV1;
  sourceTombstone: ProviderMigrationSourceTombstonePinV1;
  strongReadyCoreContentDigest: ContentDigest;
}

interface ProviderMigrationProgressHeadCommonV1 {
  profile: "provider_migration_progress_head_v1";
  migrationId: ProviderMigrationIdV1;
  journalAuthorityInstallationIdentity:
    InstallationIdentityStatePinV1;
  versionOrdinal: number;
  operationNonce: LowerHex32;
  recordCount: number;
  recordSetDigest: ContentDigest;
  canonicalRecordSetBytes: number;
  canonicalProgressBytesTotal: number;
  currentRecord: ProviderMigrationProgressRecordPinV1;
}

type ProviderMigrationProgressHeadV1 =
  | (ProviderMigrationProgressHeadCommonV1 & {
      state: "open";
      predecessor:
        | {
            state: "genesis";
            expectedNamespaceState: "absent";
          }
        | {
            state: "version";
            versionOrdinal: number;
            headContentDigest: ContentDigest;
            currentVersionToken:
              ProviderMigrationProgressVersionTokenV1;
          };
    })
  | (ProviderMigrationProgressHeadCommonV1 & {
      state: "sealed";
      predecessor: {
        state: "version";
        versionOrdinal: number;
        headContentDigest: ContentDigest;
        currentVersionToken:
          ProviderMigrationProgressVersionTokenV1;
      };
      closure: ProviderMigrationSealedClosureV1;
    });

interface ProviderMigrationProgressHeadEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_migration_progress_head";
  locatorProfile:
    "installation_provider_migration_progress_head_v1";
  migrationId: ProviderMigrationIdV1;
  contentDigest: ContentDigest;
  currentVersionToken:
    ProviderMigrationProgressVersionTokenV1;
  payload: ProviderMigrationProgressHeadV1;
}

interface ProviderMigrationSealedProgressHeadPinV1 {
  locatorProfile:
    "installation_provider_migration_progress_head_v1";
  migrationId: ProviderMigrationIdV1;
  versionOrdinal: number;
  headContentDigest: ContentDigest;
  currentVersionToken:
    ProviderMigrationProgressVersionTokenV1;
  readyToActivateRecord:
    ProviderMigrationProgressRecordPinV1;
}

interface ProviderMigrationProgressCurrentReadV1 {
  profile: "provider_migration_progress_current_read_v1";
  head: ProviderMigrationProgressHeadEnvelopeV1;
  enumeration: ProviderMigrationProgressEnumerationV1;
}

interface ProviderMigrationProgressCompareAppendRequestV1 {
  profile: "provider_migration_progress_compare_append_request_v1";
  operationNonce: LowerHex32;
  migrationId: ProviderMigrationIdV1;
  expected:
    | {
        state: "genesis";
        expectedNamespaceState: "absent";
      }
    | {
        state: "current_open";
        versionOrdinal: number;
        headContentDigest: ContentDigest;
        currentVersionToken:
          ProviderMigrationProgressVersionTokenV1;
        recordCount: number;
        recordSetDigest: ContentDigest;
        canonicalRecordSetBytes: number;
        canonicalProgressBytesTotal: number;
      };
  candidateRecord: ProviderMigrationProgressRecordEnvelopeV1;
}

interface ProviderMigrationProgressSealRequestV1 {
  profile: "provider_migration_progress_seal_request_v1";
  operationNonce: LowerHex32;
  migrationId: ProviderMigrationIdV1;
  expectedOpenHead: {
    versionOrdinal: number;
    headContentDigest: ContentDigest;
    currentVersionToken:
      ProviderMigrationProgressVersionTokenV1;
    recordCount: number;
    recordSetDigest: ContentDigest;
    canonicalRecordSetBytes: number;
    canonicalProgressBytesTotal: number;
    currentRecord: ProviderMigrationProgressRecordPinV1;
  };
  closure: ProviderMigrationSealedClosureV1;
}

type ProviderMigrationObservedProgressHeadV1 =
  | { state: "absent" }
  | {
      state: "trusted";
      head: ProviderMigrationProgressHeadEnvelopeV1;
    }
  | {
      state: "integrity_failed";
      evidenceDigest: ContentDigest;
    };

type ProviderMigrationProgressOperationRequestV1 =
  | {
      operation: "compare_append";
      request: ProviderMigrationProgressCompareAppendRequestV1;
    }
  | {
      operation: "seal";
      request: ProviderMigrationProgressSealRequestV1;
    };

type ProviderMigrationProgressOperationV1 =
  | (Extract<
      ProviderMigrationProgressOperationRequestV1,
      { operation: "compare_append" }
    > & {
      durableOutcome:
        | {
            outcome: "committed";
            committedHead: ProviderMigrationProgressHeadEnvelopeV1;
            appendedRecord:
              ProviderMigrationProgressEnumerationEntryV1;
          }
        | {
            outcome: "not_committed";
            reason:
              | "expected_head_changed"
              | "candidate_invalid"
              | "namespace_integrity_failed"
              | "journal_already_sealed";
            observedHead: ProviderMigrationObservedProgressHeadV1;
          };
    })
  | (Extract<
      ProviderMigrationProgressOperationRequestV1,
      { operation: "seal" }
    > & {
      durableOutcome:
        | {
            outcome: "committed";
            sealedHead: ProviderMigrationProgressHeadEnvelopeV1;
          }
        | {
            outcome: "not_committed";
            reason:
              | "expected_head_changed"
              | "closure_invalid"
              | "namespace_integrity_failed"
              | "journal_already_sealed";
            observedHead: ProviderMigrationObservedProgressHeadV1;
          };
    });

interface ProviderMigrationProgressOperationReceiptV1 {
  profile: "provider_migration_progress_operation_receipt_v1";
  migrationId: ProviderMigrationIdV1;
  operationNonce: LowerHex32;
  requestContentDigest: ContentDigest;
  operation: ProviderMigrationProgressOperationV1;
  canonicalReceiptBytes: number;
  resolvedAt: IsoTimestamp;
  receiptToken: ProviderMigrationReceiptTokenV1;
}

interface ProviderMigrationProgressOperationReceiptEnvelopeV1 {
  schemaVersion: 1;
  recordType: "provider_migration_progress_operation_receipt";
  locatorProfile:
    "installation_provider_migration_progress_operation_receipt_v1";
  migrationId: ProviderMigrationIdV1;
  operationNonce: LowerHex32;
  resolvedAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ProviderMigrationProgressOperationReceiptV1;
}

interface ProviderMigrationProgressOperationReceiptPinV1 {
  locatorProfile:
    "installation_provider_migration_progress_operation_receipt_v1";
  migrationId: ProviderMigrationIdV1;
  operationNonce: LowerHex32;
  contentDigest: ContentDigest;
  receiptToken: ProviderMigrationReceiptTokenV1;
}

type ProviderMigrationProgressOperationResultV1 =
  | {
      resolution: "resolved";
      receipt:
        ProviderMigrationProgressOperationReceiptEnvelopeV1;
    }
  | {
      resolution: "request_rejected";
      reason: "operation_nonce_request_mismatch";
      existingReceipt:
        ProviderMigrationProgressOperationReceiptEnvelopeV1;
    };

interface IdentityNamespaceManifestPinV1 {
  manifestId: OpaqueIdentifier;
  contentDigest: ContentDigest;
}

interface IdentityNamespaceBindingIntentV1 {
  profile: "identity_namespace_binding_intent_v1";
  status: "intent";
  transactionNonce: LowerHex32;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  installationIdentityStateContentDigest: ContentDigest;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  rootIdentity: PathSafeRootIdentityV1;
  legacyRepositoryId?: OpaqueIdentifier;
  legacyWorktreeId?: OpaqueIdentifier;
  legacyManifest?: IdentityNamespaceManifestPinV1;
  plannedStrongManifestId: OpaqueIdentifier;
  createdAt: IsoTimestamp;
}

interface IdentityNamespaceBindingV1 {
  profile: "identity_namespace_binding_v1";
  status: "active";
  transactionNonce: LowerHex32;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  installationIdentityStateContentDigest: ContentDigest;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  rootIdentity: PathSafeRootIdentityV1;
  legacyRepositoryId?: OpaqueIdentifier;
  legacyWorktreeId?: OpaqueIdentifier;
  legacyManifest?: IdentityNamespaceManifestPinV1;
  strongManifest: IdentityNamespaceManifestPinV1;
  bootstrapTerminalization: {
    transactionNonce: LowerHex32;
    terminalHeadRequired: true;
    terminalReceiptLocatorProfile:
      "installation_state_terminal_receipt_v1";
    quarantineLedgerPath:
      ".store-bootstrap-quarantine-ledger-v1.json";
  };
  bindingGeneration: 1;
  createdAt: IsoTimestamp;
  activatedAt: IsoTimestamp;
}

interface IdentityNamespaceBindingEnvelopeV1 {
  schemaVersion: 1;
  recordType: "identity_namespace_binding";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: IdentityNamespaceBindingV1;
}

interface StoreOwnershipMarkerV1 {
  profile: "store_ownership_marker_v1";
  storeLayoutVersion: 1;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  installationIdentityStateContentDigest: ContentDigest;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  rootIdentity: PathSafeRootIdentityV1;
  workspaceRootBinding: StoreDurableObjectBindingV1;
  storeRootBinding: StoreDurableObjectBindingV1;
  ownershipNonce: LowerHex32;
  createdAt: IsoTimestamp;
  ownershipProof: KeyedStateTokenV1;
}

interface StoreInitializationTerminalSizingDirectoryV1 {
  ordinal: number;
  finalPath: StoreRelativePathV1;
  finalParentProjectionDigest: ContentDigest;
  maxAttemptCount: 4;
}

interface StoreInitializationTerminalSizingWriteV1 {
  ordinal: number;
  role: StoreBootstrapWriteRoleV1;
  finalPath: StoreRelativePathV1;
  finalParentProjectionDigest: ContentDigest;
  futureSemanticIdBytes?: CanonicalInternalBytesV1;
  canonicalRecoveryPayloadLogicalBytes: number;
  canonicalFinalPayloadLogicalBytes: number;
  sealedPlaintextLogicalBytes: number;
  maxAttemptCount: 4;
}

interface StoreInitializationTerminalSizingPhaseV1 {
  phase:
    | "marker"
    | "genesis"
    | "identity_bootstrap"
    | "identity_activation"
    | "quarantine_ledger_1"
    | "quarantine_ledger_2"
    | "quarantine_ledger_3"
    | "quarantine_ledger_4"
    | "terminalization";
  phaseOrdinal: number;
  phaseNonce: LowerHex32;
  createdAt: IsoTimestamp;
  inputPinsDigest: ContentDigest;
  directories: StoreInitializationTerminalSizingDirectoryV1[];
  writes: [
    StoreInitializationTerminalSizingWriteV1,
    ...StoreInitializationTerminalSizingWriteV1[]
  ];
  canonicalPlanLogicalByteUpperBound: number;
  canonicalProgressLogicalByteUpperBound: number;
}

interface StoreInitializationTerminalSizingSkeletonV1 {
  profile: "store_initialization_terminal_sizing_skeleton_v1";
  providerId: DurableObjectIdentityProviderIdV1;
  providerPolicyDigest: ContentDigest;
  sourceRepositoryStateToken: KeyedStateTokenV1;
  immutableDryRunInputPins: ContentDigest[];
  futureBundleShapeDigest: ContentDigest;
  placeholderProfile: "max_width_wire_placeholders_v1";
  phaseShapes: [
    StoreInitializationTerminalSizingPhaseV1,
    ...StoreInitializationTerminalSizingPhaseV1[]
  ];
}

interface StoreInitializationTerminalStateBudgetV1 {
  profile: "store_initialization_terminal_state_budget_v1";
  sizingSkeleton: StoreInitializationTerminalSizingSkeletonV1;
  sizingSkeletonContentDigest: ContentDigest;
  maxLedgerGenerationCount: 4;
  worstCaseExternalIntentLogicalBytes: number;
  worstCaseTerminalReceiptLogicalBytes: number;
  worstCaseHandoffRecordLogicalBytes: number;
  worstCaseHandoffJournalLogicalBytes: number;
  worstCaseHandoffRecordCount: number;
  maxHandoffRecordCount: 4_096;
  externalIntentLogicalByteCap: 67_108_864; // 64 MiB
  terminalReceiptLogicalByteCap: 67_108_864; // 64 MiB
  handoffRecordLogicalByteCap: 67_108_864; // 64 MiB
  handoffJournalLogicalByteCap: 67_108_864; // 64 MiB
}

interface InternalStoreInitializationPreflightV1 {
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  rootIdentity: PathSafeRootIdentityV1;
  objectFormat: "sha1" | "sha256";
  headState:
    | { kind: "commit"; commit: GitObjectId }
    | { kind: "unborn"; emptyTreeObjectId: GitObjectId };
  rawIndexEntries: InternalIndexStateUnitV1[];
  workspaceRootBinding: StoreDurableObjectBindingV1;
  workspaceRootChangeTime: CanonicalUnsignedDecimalV1;
  reservedStorePathBytes: CanonicalInternalBytesV1;
  reservedStorePathState: "absent";
  terminalStateBudget: StoreInitializationTerminalStateBudgetV1;
}

interface StoreOwnershipInitializationIntentCommonV1 {
  profile: "store_ownership_initialization_intent_v1";
  transactionNonce: LowerHex32;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  rootIdentity: PathSafeRootIdentityV1;
  createdAt: IsoTimestamp;
  quarantineEntries: StoreBootstrapQuarantineEntryV1[]; // sorted/unique；initial=[]
  terminalStateBudget: StoreInitializationTerminalStateBudgetV1;
}

type StoreBootstrapWriteRoleV1 =
  | "ownership_marker"
  | "genesis_quota_node"
  | "genesis_quota_root"
  | "genesis_store_manifest_generation"
  | "security_equality_key"
  | "identity_binding_intent"
  | "bootstrap_quota_node"
  | "bootstrap_quota_root"
  | "bootstrap_transition"
  | "bootstrap_store_manifest_generation"
  | "active_identity_binding"
  | "activation_quota_node"
  | "activation_quota_root"
  | "activation_transition"
  | "activation_store_manifest_generation"
  | "terminalization_quota_node"
  | "terminalization_quota_root"
  | "terminalization_transition"
  | "terminalization_store_manifest_generation"
  | "quarantine_ledger";

type StoreBootstrapRecoveryPayloadV1 =
  | {
      kind: "canonical_bytes";
      canonicalBytes: CanonicalByteStringV1;
      logicalBytes: number;
      contentDigest: ContentDigest;
    }
  | {
      kind: "installation_key_sealed_bytes";
      sealingProfile: "xchacha20-poly1305-hkdf-sha256-v1";
      kdfDomain: "store-bootstrap-secret-recovery-v1";
      nonce: CanonicalByteStringV1; // decoded length exactly 24 bytes
      sealedCanonicalBytes: CanonicalByteStringV1;
      plaintextLogicalBytes: 32;
      plaintextCheckToken: KeyedStateTokenV1;
      sealAadDigest: ContentDigest;
    };

type StoreBootstrapFinalParentV1 =
  | { kind: "store_root" }
  | {
      kind: "planned_directory";
      directoryOrdinal: number;
    }
  | {
      kind: "verified_existing_directory";
      path: StoreRelativePathV1;
      directoryBinding: StoreDurableObjectBindingV1;
      ownerIdentity: CanonicalInternalBytesV1;
      mode: "0700";
      sourceWriteSetDigest: ContentDigest;
      sourcePlanToken: KeyedStateTokenV1;
      sourceDirectoryOrdinal: number;
    };

interface StoreBootstrapDirectoryPlanV1 {
  ordinal: number; // contiguous topological order
  finalPath: StoreRelativePathV1;
  finalParent: StoreBootstrapFinalParentV1;
  finalExpectedState: "absent";
  mode: "0700";
}

interface StoreBootstrapWritePlanV1 {
  ordinal: number; // contiguous nonnegative safe integer
  role: StoreBootstrapWriteRoleV1;
  finalPath: StoreRelativePathV1;
  finalParent: StoreBootstrapFinalParentV1;
  finalPrecondition: { state: "absent" };
  publishMode: "no_replace";
  recoveryPayload: StoreBootstrapRecoveryPayloadV1;
}

interface StoreBootstrapWriteSetPlanV1 {
  profile: "store_bootstrap_write_set_plan_v1";
  transactionNonce: LowerHex32;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  bindingContextDigest: ContentDigest;
  stagingBase: "provider_private";
  stagingProviderId: DurableObjectIdentityProviderIdV1;
  stagingProviderPolicyDigest: ContentDigest;
  directories: StoreBootstrapDirectoryPlanV1[];
  writes: [StoreBootstrapWritePlanV1, ...StoreBootstrapWritePlanV1[]];
  preSealBindingDigest: ContentDigest;
  writeSetDigest: ContentDigest;
  planToken: KeyedStateTokenV1;
}

type StoreBootstrapContentProofV1 =
  | { kind: "content_digest"; contentDigest: ContentDigest }
  | {
      kind: "installation_keyed_check";
      checkToken: KeyedStateTokenV1;
    };

type StoreProviderStagingLocatorV1 =
  `provider-staging:${LowerHex32}`;

type StoreProviderHandlePublicationProgressV1 =
  | {
      state: "allocation_planned";
      operationNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      providerAllocationState: "absent";
    }
  | {
      state: "staged";
      operationNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      stagedObjectBinding: StoreDurableObjectBindingV1;
    }
  | {
      state: "published";
      operationNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      stagedObjectBinding: StoreDurableObjectBindingV1;
      finalObjectBinding: StoreDurableObjectBindingV1;
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      atomicContainmentProofToken:
        StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    }
  | {
      state: "not_committed";
      operationNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      stagedObjectBinding: StoreDurableObjectBindingV1;
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      providerOperationReceiptToken:
        StoreProviderOperationReceiptTokenV1;
      failure: StoreProviderAtomicPublishFailureV1;
    }
  | {
      state: "final_identity_verified";
      operationNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      stagedObjectBinding: StoreDurableObjectBindingV1;
      finalObjectBinding: StoreDurableObjectBindingV1;
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    };

interface StoreRootPublicationContextV1 {
  profile: "store_root_publication_context_v1";
  workspaceRootBinding: StoreDurableObjectBindingV1;
  providerId: DurableObjectIdentityProviderIdV1;
  providerPolicyDigest: ContentDigest;
  finalName: ".understand-code";
  expectedFinalState: "absent";
}

type StoreBootstrapAbandonedAttemptFailureV1 =
  | {
      source: "local_revalidation";
      reason:
        | "provider_staging_authority_lost"
        | "recorded_identity_mismatch"
        | "provider_binding_revalidation_failed";
      recoveryDirective: "retry_new_attempt";
      successorPolicy: "exactly_one_retry_attempt";
    }
  | {
      source: "local_revalidation";
      reason: "final_path_collision";
      recoveryDirective: "fatal_conflict";
      successorPolicy: "terminal_no_successor";
    }
  | {
      source: "provider_atomic_publish";
      outcome: "not_committed";
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      providerOperationReceiptToken:
        StoreProviderOperationReceiptTokenV1;
      failure: StoreProviderAtomicPublishFailureV1;
    };

type StoreBootstrapWriteAttemptV1 =
  | {
      state: "temp_planned";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      providerAllocationState: "absent";
    }
  | {
      state: "temp_identity_recorded";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      tempFileBinding: StoreDurableObjectBindingV1;
      finalParentBinding: StoreDurableObjectBindingV1;
      observedLogicalBytes: 0;
    }
  | {
      state: "temp_payload_verified";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      tempFileBinding: StoreDurableObjectBindingV1;
      finalParentBinding: StoreDurableObjectBindingV1;
      logicalBytes: number;
      contentProof: StoreBootstrapContentProofV1;
    }
  | {
      state: "published";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      tempFileBinding: StoreDurableObjectBindingV1;
      finalParentBinding: StoreDurableObjectBindingV1;
      finalFileBinding: StoreDurableObjectBindingV1;
      logicalBytes: number;
      contentProof: StoreBootstrapContentProofV1;
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    }
  | {
      state: "final_identity_verified";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      tempFileBinding: StoreDurableObjectBindingV1;
      finalParentBinding: StoreDurableObjectBindingV1;
      finalFileBinding: StoreDurableObjectBindingV1;
      logicalBytes: number;
      contentProof: StoreBootstrapContentProofV1;
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    }
  | {
      state: "published_quarantined";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      tempFileBinding: StoreDurableObjectBindingV1;
      finalParentBinding: StoreDurableObjectBindingV1;
      finalFileBinding: StoreDurableObjectBindingV1;
      logicalBytes: number;
      contentProof: StoreBootstrapContentProofV1;
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
      reason:
        | "final_identity_verification_failed"
        | "post_publish_continuity_observation_failed";
      doNotReadModifyRenameOrDelete: true;
    }
  | {
      state: "abandoned_unowned";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      failure: StoreBootstrapAbandonedAttemptFailureV1;
      doNotReadModifyRenameOrDelete: true;
    };

type StoreBootstrapDirectoryAttemptV1 =
  | {
      state: "temp_planned";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      providerAllocationState: "absent";
    }
  | {
      state: "temp_identity_recorded";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      tempDirectoryBinding: StoreDurableObjectBindingV1;
      finalParentBinding: StoreDurableObjectBindingV1;
      observedMode: "0700";
    }
  | {
      state: "published";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      tempDirectoryBinding: StoreDurableObjectBindingV1;
      finalParentBinding: StoreDurableObjectBindingV1;
      finalDirectoryBinding: StoreDurableObjectBindingV1;
      observedMode: "0700";
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    }
  | {
      state: "final_identity_verified";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      tempDirectoryBinding: StoreDurableObjectBindingV1;
      finalParentBinding: StoreDurableObjectBindingV1;
      finalDirectoryBinding: StoreDurableObjectBindingV1;
      observedMode: "0700";
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    }
  | {
      state: "published_quarantined";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      tempDirectoryBinding: StoreDurableObjectBindingV1;
      finalParentBinding: StoreDurableObjectBindingV1;
      finalDirectoryBinding: StoreDurableObjectBindingV1;
      observedMode: "0700";
      requestDurableProjection:
        StoreProviderAtomicPublishDurableRequestProjectionV1;
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
      reason:
        | "final_identity_verification_failed"
        | "post_publish_continuity_observation_failed";
      doNotReadModifyRenameOrDelete: true;
    }
  | {
      state: "abandoned_unowned";
      attemptOrdinal: number;
      attemptNonce: LowerHex32;
      providerStagingLocator: StoreProviderStagingLocatorV1;
      failure: StoreBootstrapAbandonedAttemptFailureV1;
      doNotReadModifyRenameOrDelete: true;
    };

interface StoreBootstrapDirectoryProgressV1 {
  directoryOrdinal: number;
  attempts: [
    StoreBootstrapDirectoryAttemptV1,
    ...StoreBootstrapDirectoryAttemptV1[]
  ];
}

interface StoreBootstrapWriteProgressV1 {
  writeOrdinal: number;
  attempts: [
    StoreBootstrapWriteAttemptV1,
    ...StoreBootstrapWriteAttemptV1[]
  ];
}

interface StoreBootstrapWriteSetProgressV1 {
  writeSetDigest: ContentDigest;
  directories: StoreBootstrapDirectoryProgressV1[];
  writes: [
    StoreBootstrapWriteProgressV1,
    ...StoreBootstrapWriteProgressV1[]
  ];
}

interface StoreBootstrapQuarantineEntryCommonV1 {
  transactionNonce: LowerHex32;
  sourceWriteSetDigest: ContentDigest;
  sourcePlanToken: KeyedStateTokenV1;
  target:
    | { kind: "directory"; ordinal: number }
    | { kind: "file"; ordinal: number };
  attemptOrdinal: number;
  attemptNonce: LowerHex32;
  stagingBase: "provider_private";
  stagingProviderId: DurableObjectIdentityProviderIdV1;
  stagingProviderPolicyDigest: ContentDigest;
  providerStagingLocator: StoreProviderStagingLocatorV1;
  observedNamespacePath?: StoreRelativePathV1;
  doNotReadModifyRenameOrDelete: true;
  entryToken: KeyedStateTokenV1;
}

type StoreBootstrapQuarantineEntryV1 =
  | (StoreBootstrapQuarantineEntryCommonV1 & {
      state: "abandoned_unowned";
      failure: StoreBootstrapAbandonedAttemptFailureV1;
    })
  | (StoreBootstrapQuarantineEntryCommonV1 & {
      state: "published_quarantined";
      reason:
        | "final_identity_verification_failed"
        | "post_publish_continuity_observation_failed";
      finalParentBinding: StoreDurableObjectBindingV1;
      publishedObject:
        | {
            kind: "directory";
            tempDirectoryBinding: StoreDurableObjectBindingV1;
            finalDirectoryBinding: StoreDurableObjectBindingV1;
            observedMode: "0700";
          }
        | {
            kind: "file";
            tempFileBinding: StoreDurableObjectBindingV1;
            finalFileBinding: StoreDurableObjectBindingV1;
            logicalBytes: number;
            contentProof: StoreBootstrapContentProofV1;
          };
      atomicContainmentProofToken: StoreProviderContainmentProofTokenV1;
      providerOperationReceiptToken: StoreProviderOperationReceiptTokenV1;
    });

type StoreBootstrapLedgerGenerationV1 = 1 | 2 | 3 | 4;
type StoreBootstrapQuarantineLedgerPathV1 =
  ".store-bootstrap-quarantine-ledger-v1.json";

interface StoreBootstrapQuarantineLedgerV1 {
  profile: "store_bootstrap_quarantine_ledger_v1";
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  storeRootBinding: StoreDurableObjectBindingV1;
  sourceInitializationIntentContentDigest: ContentDigest;
  ledgerGeneration: StoreBootstrapLedgerGenerationV1;
  entries: StoreBootstrapQuarantineEntryV1[];
  ledgerToken: KeyedStateTokenV1;
}

interface StoreBootstrapQuarantineLedgerEnvelopeV1 {
  schemaVersion: 1;
  recordType: "store_bootstrap_quarantine_ledger";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: StoreBootstrapQuarantineLedgerV1;
}

interface StoreBootstrapQuarantineLedgerPlanV1 {
  profile: "store_bootstrap_quarantine_ledger_plan_v1";
  ledgerGeneration: StoreBootstrapLedgerGenerationV1;
  supersedesLedgerWriteSetDigest?: ContentDigest;
  sourceInitializationIntentContentDigest: ContentDigest;
  ledgerPath: StoreBootstrapQuarantineLedgerPathV1;
  ledgerEnvelopeContentDigest: ContentDigest;
  ledgerToken: KeyedStateTokenV1;
  writeSet: StoreBootstrapWriteSetPlanV1;
}

interface StoreBootstrapQuarantineLedgerProofV1 {
  ledgerGeneration: StoreBootstrapLedgerGenerationV1;
  ledgerWriteSetDigest: ContentDigest;
  ledgerPlanToken: KeyedStateTokenV1;
  ledgerFileBinding: StoreDurableObjectBindingV1;
  ledgerEnvelopeContentDigest: ContentDigest;
  ledgerToken: KeyedStateTokenV1;
}

interface StoreBootstrapQuarantineLedgerGenerationV1 {
  plan: StoreBootstrapQuarantineLedgerPlanV1;
  writeProgress: StoreBootstrapWriteSetProgressV1;
}

interface StoreBootstrapSourceIntentAttestationV1 {
  phase: "binding_activated";
  sourceInitializationIntentContentDigest: ContentDigest;
  sourceIntentToken: KeyedStateTokenV1;
}

interface StoreBootstrapQuarantineGenerationPinV1 {
  ledgerGeneration: StoreBootstrapLedgerGenerationV1;
  supersedesLedgerWriteSetDigest?: ContentDigest;
  ledgerPlanContentDigest: ContentDigest;
  ledgerWriteSetDigest: ContentDigest;
  ledgerPlanToken: KeyedStateTokenV1;
  writeProgressContentDigest: ContentDigest;
  ledgerEntrySetDigest: ContentDigest;
}

type StoreBootstrapTerminalQuarantineV1 =
  | {
      status: "none";
      generationCount: 0;
      generationHistoryDigest: ContentDigest; // versioned empty-history constant
    }
  | {
      status: "published";
      generationCount: StoreBootstrapLedgerGenerationV1;
      generations: [
        StoreBootstrapQuarantineLedgerGenerationV1,
        ...StoreBootstrapQuarantineLedgerGenerationV1[]
      ];
      generationPins: [
        StoreBootstrapQuarantineGenerationPinV1,
        ...StoreBootstrapQuarantineGenerationPinV1[]
      ];
      generationHistoryDigest: ContentDigest;
      quarantineLedgerProof: StoreBootstrapQuarantineLedgerProofV1;
      ledgerPath: StoreBootstrapQuarantineLedgerPathV1;
      ledgerFileBinding: StoreDurableObjectBindingV1;
      ledgerEnvelopeContentDigest: ContentDigest;
      ledgerToken: KeyedStateTokenV1;
    };

interface StoreInitializationTerminalReceiptV1 {
  profile: "store_initialization_terminal_receipt_v1";
  state: "terminal_receipt_ready";
  transactionNonce: LowerHex32;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  rootIdentity: PathSafeRootIdentityV1;
  createdAt: IsoTimestamp;
  terminalStateBudget: StoreInitializationTerminalStateBudgetV1;
  sourceBindingActivatedIntent: StoreOwnershipBindingActivatedIntentV1;
  sourceIntentAttestation: StoreBootstrapSourceIntentAttestationV1;
  quarantine: StoreBootstrapTerminalQuarantineV1;
  terminalReceiptCreatedAt: IsoTimestamp;
  terminalReceiptToken: KeyedStateTokenV1;
}

interface StoreInitializationTerminalHeadPinV1 {
  profile: "store_initialization_terminal_head_v1";
  transactionNonce: LowerHex32;
  sourceInitializationIntentContentDigest: ContentDigest;
  generationCount: 0 | StoreBootstrapLedgerGenerationV1;
  generationHistoryDigest: ContentDigest;
  terminalReceiptLocatorProfile:
    "installation_state_terminal_receipt_v1";
  terminalReceiptBinding: StoreDurableObjectBindingV1;
  terminalReceiptContentDigest: ContentDigest;
  terminalReceiptToken: KeyedStateTokenV1;
  ledger?:
    | {
        path: StoreBootstrapQuarantineLedgerPathV1;
        generation: StoreBootstrapLedgerGenerationV1;
        fileBinding: StoreDurableObjectBindingV1;
        envelopeContentDigest: ContentDigest;
        ledgerToken: KeyedStateTokenV1;
      };
  terminalHeadToken: KeyedStateTokenV1;
}

interface StoreOwnershipMarkerPlanV1 {
  profile: "store_ownership_marker_plan_v1";
  markerContentDigest: ContentDigest;
  writeSet: StoreBootstrapWriteSetPlanV1;
}

interface StoreGenesisBootstrapPlanV1 {
  profile: "store_genesis_bootstrap_plan_v1";
  treeLayoutVersion: "canonical-btree-256-v1";
  policyDigest: ContentDigest;
  typedEmptyCategoryDigests: Record<
    PrivateStoreQuotaIndexCategoryNameV1,
    ContentDigest
  >;
  genesisQuotaIndexRootContentDigest: ContentDigest;
  genesisStoreManifestGenerationContentDigest: ContentDigest;
  writeSet: StoreBootstrapWriteSetPlanV1;
}

interface StoreIdentityBootstrapPlanV1 {
  profile: "store_identity_bootstrap_plan_v1";
  policyDigest: ContentDigest;
  expectedPreChainState: "genesis";
  preQuotaIndexRootContentDigest: ContentDigest;
  phaseOrdinal: 0;
  transitionKind: "identity_bootstrap";
  transitionRecordId: PrivateStoreQuotaTransitionRecordId;
  transitionRecordContentDigest: ContentDigest;
  quotaDeltaDigest: ContentDigest;
  postQuotaIndexRootContentDigest: ContentDigest;
  expectedGenesisStoreManifestGenerationContentDigest: ContentDigest;
  expectedPostStoreManifestGenerationContentDigest: ContentDigest;
  writeSet: StoreBootstrapWriteSetPlanV1;
}

interface StoreIdentityActivationPlanV1 {
  profile: "store_identity_activation_plan_v1";
  policyDigest: ContentDigest;
  strongManifest: IdentityNamespaceManifestPinV1;
  transitionKind: "identity_activation";
  transitionRecordId: PrivateStoreQuotaTransitionRecordId;
  transitionRecordContentDigest: ContentDigest;
  preQuotaIndexRootContentDigest: ContentDigest;
  postQuotaIndexRootContentDigest: ContentDigest;
  quotaDeltaDigest: ContentDigest;
  expectedPreStoreManifestGenerationContentDigest: ContentDigest;
  expectedPostStoreManifestGenerationContentDigest: ContentDigest;
  writeSet: StoreBootstrapWriteSetPlanV1;
}

interface StoreIdentityActivationProofV1 {
  strongManifest: IdentityNamespaceManifestPinV1;
  transitionKind: "identity_activation";
  activationWriteSetDigest: ContentDigest;
  activeBindingFileBinding: StoreDurableObjectBindingV1;
  activeBindingContentDigest: ContentDigest;
  transitionRecordFileBinding: StoreDurableObjectBindingV1;
  transitionRecordId: PrivateStoreQuotaTransitionRecordId;
  transitionRecordContentDigest: ContentDigest;
  preQuotaIndexRootContentDigest: ContentDigest;
  postQuotaIndexRootContentDigest: ContentDigest;
  quotaDeltaDigest: ContentDigest;
  postStoreManifestGenerationFileBinding: StoreDurableObjectBindingV1;
  postStoreManifestGenerationContentDigest: ContentDigest;
}

interface StoreIdentityTerminalizationPlanV1 {
  profile: "store_identity_terminalization_plan_v1";
  policyDigest: ContentDigest;
  sourceTerminalReceiptContentDigest: ContentDigest;
  terminalHead: StoreInitializationTerminalHeadPinV1;
  transitionKind: "store_initialization_terminalize";
  transitionRecordId: PrivateStoreQuotaTransitionRecordId;
  transitionRecordContentDigest: ContentDigest;
  preQuotaIndexRootContentDigest: ContentDigest;
  postQuotaIndexRootContentDigest: ContentDigest;
  quotaDeltaDigest: ContentDigest;
  expectedPreStoreManifestGenerationContentDigest: ContentDigest;
  expectedPostStoreManifestGenerationContentDigest: ContentDigest;
  writeSet: StoreBootstrapWriteSetPlanV1;
}

interface StoreIdentityTerminalizationProofV1 {
  transitionKind: "store_initialization_terminalize";
  terminalHeadToken: KeyedStateTokenV1;
  transitionRecordId: PrivateStoreQuotaTransitionRecordId;
  transitionRecordContentDigest: ContentDigest;
  postQuotaIndexRootContentDigest: ContentDigest;
  postStoreManifestGenerationFileBinding: StoreDurableObjectBindingV1;
  postStoreManifestGenerationContentDigest: ContentDigest;
}

type StoreIdentityTerminalizationProgressDeltaV1 =
  | {
      kind: "directory_attempt_transition";
      predecessorProgressContentDigest: ContentDigest;
      resultingProgressContentDigest: ContentDigest;
      directoryOrdinal: number;
      attemptOrdinal: number;
      before:
        | { state: "absent" }
        | {
            state: "present";
            attempt: StoreBootstrapDirectoryAttemptV1;
          };
      after: StoreBootstrapDirectoryAttemptV1;
    }
  | {
      kind: "write_attempt_transition";
      predecessorProgressContentDigest: ContentDigest;
      resultingProgressContentDigest: ContentDigest;
      writeOrdinal: number;
      attemptOrdinal: number;
      before:
        | { state: "absent" }
        | {
            state: "present";
            attempt: StoreBootstrapWriteAttemptV1;
          };
      after: StoreBootstrapWriteAttemptV1;
    }
  | {
      kind: "proof_only";
      predecessorProgressContentDigest: ContentDigest;
      resultingProgressContentDigest: ContentDigest;
    };

interface StoreIdentityTerminalizationHandoffJournalLocatorV1 {
  profile:
    "installation_state_terminalization_handoff_journal_v1";
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  transactionNonce: LowerHex32;
  recordId: StoreTerminalizationHandoffRecordIdV1;
}

interface StoreIdentityTerminalizationHandoffRecordCommonV1 {
  profile: "store_identity_terminalization_handoff_record_v1";
  id: StoreTerminalizationHandoffRecordIdV1;
  locator: StoreIdentityTerminalizationHandoffJournalLocatorV1;
  recordFileBinding: StoreDurableObjectBindingV1;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  transactionNonce: LowerHex32;
  terminalReceiptContentDigest: ContentDigest;
  terminalizationPlanContentDigest: ContentDigest;
  terminalizationWriteProgressContentDigest: ContentDigest;
  createdAt: IsoTimestamp; // exact-equal terminalization_planned.createdAt
  handoffToken: KeyedStateTokenV1;
}

type StoreIdentityTerminalizationHandoffRecordV1 =
  | (StoreIdentityTerminalizationHandoffRecordCommonV1 & {
      predecessor: { state: "genesis" };
      terminalizationPlan: StoreIdentityTerminalizationPlanV1;
      terminalizationWriteProgress: StoreBootstrapWriteSetProgressV1;
    })
  | (StoreIdentityTerminalizationHandoffRecordCommonV1 & {
      predecessor: {
        state: "record";
        recordId: StoreTerminalizationHandoffRecordIdV1;
        recordContentDigest: ContentDigest;
      };
      terminalizationProgressDeltaContentDigest: ContentDigest;
      progressDelta: Exclude<
        StoreIdentityTerminalizationProgressDeltaV1,
        { kind: "proof_only" }
      >;
    })
  | (StoreIdentityTerminalizationHandoffRecordCommonV1 & {
      predecessor: {
        state: "record";
        recordId: StoreTerminalizationHandoffRecordIdV1;
        recordContentDigest: ContentDigest;
      };
      terminalizationProgressDeltaContentDigest: ContentDigest;
      progressDelta: Extract<
        StoreIdentityTerminalizationProgressDeltaV1,
        { kind: "proof_only" }
      >;
      terminalizationProofContentDigest: ContentDigest;
      terminalizationProof: StoreIdentityTerminalizationProofV1;
    });

interface StoreIdentityTerminalizationHandoffRecordEnvelopeV1 {
  schemaVersion: 1;
  recordType: "store_identity_terminalization_handoff_record";
  recordId: StoreTerminalizationHandoffRecordIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: StoreIdentityTerminalizationHandoffRecordV1;
}

type StoreOwnershipInitializationOriginV1 =
  | {
      mode: "new_store";
      expectedStoreRootState: "absent";
      preflightToken: KeyedStateTokenV1;
    }
  | {
      mode: "legacy_migration";
      expectedStoreRootState: "validated_legacy";
      legacyUniverseToken: KeyedStateTokenV1;
      migrationAuthorizationId: OpaqueIdentifier;
    };

type StoreOwnershipPreMarkerIntentV1 =
  | (StoreOwnershipInitializationIntentCommonV1 &
      Extract<StoreOwnershipInitializationOriginV1, { mode: "new_store" }> &
      (
        | {
            phase: "planned";
            storeRootPublicationContext: StoreRootPublicationContextV1;
            storeRootPublicationProgress: Extract<
              StoreProviderHandlePublicationProgressV1,
              { state: "allocation_planned" }
            >;
          }
        | {
            phase: "store_root_created";
            storeRootBinding: StoreDurableObjectBindingV1;
            storeRootPublicationContext: StoreRootPublicationContextV1;
            storeRootPublicationProgress:
              StoreProviderHandlePublicationProgressV1;
          }
      ))
  | (StoreOwnershipInitializationIntentCommonV1 &
      Extract<
        StoreOwnershipInitializationOriginV1,
        { mode: "legacy_migration" }
      > & {
        phase: "planned";
        storeRootBinding: StoreDurableObjectBindingV1;
      });

type StoreOwnershipStoreRootEvidenceV1 =
  | (Extract<
      StoreOwnershipInitializationOriginV1,
      { mode: "new_store" }
    > & {
      storeRootBinding: StoreDurableObjectBindingV1;
      storeRootPublicationContext: StoreRootPublicationContextV1;
      storeRootPublicationProgress: Extract<
        StoreProviderHandlePublicationProgressV1,
        { state: "final_identity_verified" }
      >;
    })
  | (Extract<
      StoreOwnershipInitializationOriginV1,
      { mode: "legacy_migration" }
    > & {
      storeRootBinding: StoreDurableObjectBindingV1;
    });

type StoreOwnershipMarkerPlannedIntentV1 =
  StoreOwnershipInitializationIntentCommonV1 &
  StoreOwnershipStoreRootEvidenceV1 & {
    phase: "marker_planned";
    markerPlan: StoreOwnershipMarkerPlanV1;
    markerWriteProgress: StoreBootstrapWriteSetProgressV1;
  };

type StoreOwnershipPostMarkerBaseV1 =
  StoreOwnershipInitializationIntentCommonV1 &
  StoreOwnershipStoreRootEvidenceV1 & {
    markerPlan: StoreOwnershipMarkerPlanV1;
    markerWriteProgress: StoreBootstrapWriteSetProgressV1;
    markerFileBinding: StoreDurableObjectBindingV1;
    markerContentDigest: ContentDigest;
  };

interface StoreGenesisPublishedFieldsV1 {
  genesisPlan: StoreGenesisBootstrapPlanV1;
  genesisWriteProgress: StoreBootstrapWriteSetProgressV1;
  genesisQuotaIndexRootContentDigest: ContentDigest;
  genesisStoreManifestGenerationContentDigest: ContentDigest;
}

interface StoreIdentityBootstrapProgressFieldsV1
  extends StoreGenesisPublishedFieldsV1 {
  identityBootstrapPlan: StoreIdentityBootstrapPlanV1;
  identityBootstrapWriteProgress: StoreBootstrapWriteSetProgressV1;
}

interface StoreIdentityActivatedFieldsV1
  extends StoreIdentityBootstrapProgressFieldsV1 {
  activationPlan: StoreIdentityActivationPlanV1;
  activationWriteProgress: StoreBootstrapWriteSetProgressV1;
  activationProof: StoreIdentityActivationProofV1;
}

type StoreOwnershipBindingActivatedIntentV1 =
  StoreOwnershipPostMarkerBaseV1 &
  StoreIdentityActivatedFieldsV1 & {
    phase: "binding_activated";
  };

interface StoreOwnershipTerminalizationAllocationsPlannedIntentV1 {
  profile: "store_ownership_initialization_intent_v1";
  phase: "terminalization_allocations_planned";
  transactionNonce: LowerHex32;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  rootIdentity: PathSafeRootIdentityV1;
  createdAt: IsoTimestamp;
  initializationOrigin: StoreOwnershipInitializationOriginV1;
  terminalStateBudget: StoreInitializationTerminalStateBudgetV1;
  sourceBindingActivatedIntentContentDigest: ContentDigest;
  terminalReceiptLocatorProfile:
    "installation_state_terminal_receipt_v1";
  terminalReceipt: StoreInitializationTerminalReceiptV1;
  terminalReceiptContentDigest: ContentDigest;
  terminalReceiptPublicationProgress: Extract<
    StoreProviderHandlePublicationProgressV1,
    { state: "allocation_planned" | "staged" }
  >;
  handoffGenesisPublicationProgress: Extract<
    StoreProviderHandlePublicationProgressV1,
    { state: "allocation_planned" | "staged" }
  >;
  expectedHandoffJournalState: "absent";
}

interface StoreOwnershipTerminalizationPlannedIntentV1 {
  profile: "store_ownership_initialization_intent_v1";
  phase: "terminalization_planned";
  transactionNonce: LowerHex32;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  rootIdentity: PathSafeRootIdentityV1;
  createdAt: IsoTimestamp;
  initializationOrigin: StoreOwnershipInitializationOriginV1;
  terminalStateBudget: StoreInitializationTerminalStateBudgetV1;
  terminalReceiptLocatorProfile:
    "installation_state_terminal_receipt_v1";
  terminalReceipt: StoreInitializationTerminalReceiptV1;
  terminalReceiptBinding: StoreDurableObjectBindingV1;
  terminalReceiptContentDigest: ContentDigest;
  terminalReceiptPublicationProgress:
    StoreProviderHandlePublicationProgressV1;
  terminalizationPlan: StoreIdentityTerminalizationPlanV1;
  terminalizationWriteProgress: StoreBootstrapWriteSetProgressV1;
  handoffJournal: {
    genesisRecordLocator:
      StoreIdentityTerminalizationHandoffJournalLocatorV1;
    genesisRecordId: StoreTerminalizationHandoffRecordIdV1;
    genesisRecordFileBinding: StoreDurableObjectBindingV1;
    genesisRecordContentDigest: ContentDigest;
    genesisRecordToken: KeyedStateTokenV1;
    genesisPublicationProgress:
      StoreProviderHandlePublicationProgressV1;
  } & (
    | {
        state: "planned";
        expectedJournalState: "absent";
      }
    | {
        state: "durable";
        genesisJournalVersionToken: StoreProviderJournalVersionTokenV1;
      }
  );
}

interface StoreOwnershipTerminalizedIntentV1 {
  profile: "store_ownership_initialization_intent_v1";
  phase: "terminalized";
  transactionNonce: LowerHex32;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  rootIdentity: PathSafeRootIdentityV1;
  createdAt: IsoTimestamp;
  initializationOrigin: StoreOwnershipInitializationOriginV1;
  terminalStateBudget: StoreInitializationTerminalStateBudgetV1;
  terminalReceiptLocatorProfile:
    "installation_state_terminal_receipt_v1";
  terminalReceiptBinding: StoreDurableObjectBindingV1;
  terminalReceiptContentDigest: ContentDigest;
  terminalReceiptToken: KeyedStateTokenV1;
  terminalizationHandoffFinalRecordLocator:
    StoreIdentityTerminalizationHandoffJournalLocatorV1;
  terminalizationHandoffFinalRecordId:
    StoreTerminalizationHandoffRecordIdV1;
  terminalizationHandoffFinalRecordFileBinding:
    StoreDurableObjectBindingV1;
  terminalizationHandoffFinalRecordContentDigest: ContentDigest;
  terminalizationHandoffFinalRecordToken: KeyedStateTokenV1;
  terminalizationHandoffFinalJournalVersionToken: StoreProviderJournalVersionTokenV1;
  terminalizationProof: StoreIdentityTerminalizationProofV1;
  terminalizedAt: IsoTimestamp;
}

type StoreOwnershipPostMarkerProgressV1 =
  | { phase: "marker_published" }
  | {
      phase: "genesis_planned";
      genesisPlan: StoreGenesisBootstrapPlanV1;
      genesisWriteProgress: StoreBootstrapWriteSetProgressV1;
    }
  | ({ phase: "genesis_published" } & StoreGenesisPublishedFieldsV1)
  | ({
      phase:
        | "identity_planned"
        | "key_published"
        | "binding_intent_published"
        | "transition_published"
        | "manifest_committed";
    } & StoreIdentityBootstrapProgressFieldsV1)
  | ({
      phase: "activation_planned";
      activationPlan: StoreIdentityActivationPlanV1;
      activationWriteProgress: StoreBootstrapWriteSetProgressV1;
    } & StoreIdentityBootstrapProgressFieldsV1)
  | ({
      phase: "binding_activated";
    } & StoreIdentityActivatedFieldsV1)
  | ({
      phase: "quarantine_ledger_planned";
      quarantineLedgerGenerations: [
        StoreBootstrapQuarantineLedgerGenerationV1,
        ...StoreBootstrapQuarantineLedgerGenerationV1[]
      ];
    } & StoreIdentityActivatedFieldsV1)
  | ({
      phase: "quarantine_ledger_published";
      quarantineLedgerGenerations: [
        StoreBootstrapQuarantineLedgerGenerationV1,
        ...StoreBootstrapQuarantineLedgerGenerationV1[]
      ];
      quarantineLedgerProof: StoreBootstrapQuarantineLedgerProofV1;
    } & StoreIdentityActivatedFieldsV1);

type StoreOwnershipInitializationIntentV1 =
  | StoreOwnershipPreMarkerIntentV1
  | StoreOwnershipMarkerPlannedIntentV1
  | (StoreOwnershipPostMarkerBaseV1 &
      StoreOwnershipPostMarkerProgressV1)
  | StoreOwnershipTerminalizationAllocationsPlannedIntentV1
  | StoreOwnershipTerminalizationPlannedIntentV1
  | StoreOwnershipTerminalizedIntentV1;

type StoreExternalInitializationIntentPredecessorV1 =
  | { state: "genesis"; expectedLocatorState: "absent" }
  | {
      state: "revision";
      revision: number;
      envelopeContentDigest: ContentDigest;
      providerVersionToken: StoreProviderStateVersionTokenV1;
    };

interface StoreOwnershipInitializationIntentEnvelopeV1 {
  schemaVersion: 1;
  recordType: "store_ownership_initialization_intent";
  locatorProfile:
    "installation_state_store_initialization_intent_v1";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  transactionNonce: LowerHex32;
  revision: number;
  mutationId: StoreExternalIntentMutationIdV1;
  predecessor: StoreExternalInitializationIntentPredecessorV1;
  payloadContentDigest: ContentDigest;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  providerVersionToken: StoreProviderStateVersionTokenV1;
  payload: StoreOwnershipInitializationIntentV1;
}

interface PrivateStoreQuotaPolicyV1 {
  version: "private-store-quota-policy-v1";
  treeLayoutVersion: "canonical-btree-256-v1";
  maxCommittedPrivateBlobLogicalBytesPerWorktree: 1_073_741_824; // 1 GiB
  maxCommittedPrivateBlobCountPerWorktree: 100_000;
  maxCommittedPrivateMetadataLogicalBytesPerWorktree: 268_435_456; // 256 MiB
  maxCommittedPrivateMetadataFileCountPerWorktree: 200_000;
  maxActiveReservationLogicalBytesPerWorktree: 134_217_728; // 128 MiB
  maxActiveMetadataReservationLogicalBytesPerWorktree: 33_554_432; // 32 MiB
  maxActiveMetadataPlanCountPerWorktree: 32_768;
  maxActiveTempLogicalBytesPerWorktree: 201_326_592; // 192 MiB
  maxActiveTempPlanCountPerWorktree: 16_384;
  maxTransactionTempLogicalBytes: 100_663_296; // 96 MiB
  maxReservedMetadataLogicalBytesPerTransaction: 16_777_216; // 16 MiB
  maxActiveTransactionCountPerWorktree: 128;
  maxActiveReservationCountPerWorktree: 4_096;
  maxControlStateLogicalBytesPerWorktree: 67_108_864; // 64 MiB
  maxControlStateFileCountPerWorktree: 16_384;
  maxControlStateFileLogicalBytes: 1_048_576; // 1 MiB
  maxReachableQuotaIndexLogicalBytesPerWorktree: 67_108_864; // 64 MiB
  maxReachableQuotaIndexNodeCountPerWorktree: 65_536;
  maxQuotaIndexNodeLogicalBytes: 1_048_576; // 1 MiB
  maxQuotaIndexRootLogicalBytes: 1_048_576; // 1 MiB
  maxStoreManifestLogicalBytes: 4_194_304; // 4 MiB
  maxBootstrapControlLogicalBytesPerWorktree: 4_194_304; // 4 MiB
  maxBootstrapControlFileCountPerWorktree: 8;
  maxBootstrapControlFileLogicalBytes: 1_048_576; // 1 MiB
  maxBootstrapDirectoryCount: 64;
  maxBootstrapDirectoryAttemptsPerDirectory: 4;
  maxBootstrapWriteSetFileCount: 64;
  maxBootstrapWriteAttemptsPerFile: 4;
  maxBootstrapRecoveryPayloadLogicalBytes: 16_777_216; // 16 MiB
  maxExternalInitializationIntentLogicalBytes: 67_108_864; // 64 MiB
  maxTerminalReceiptLogicalBytes: 67_108_864; // 64 MiB
  maxTerminalizationHandoffRecordLogicalBytes: 67_108_864; // 64 MiB
  maxTerminalizationHandoffJournalLogicalBytes: 67_108_864; // 64 MiB
  maxTerminalizationHandoffRecordCount: 4_096;
  maxBootstrapQuarantineEntryCountPerWorktree: 64;
  maxBootstrapQuarantineLedgerGenerationCount: 4;
  maxBootstrapQuarantineLedgerLogicalBytes: 262_144; // 256 KiB
}

type PrivateStoreCommittedMetadataRecordKindV1 =
  | "managed_envelope"
  | "managed_descriptor"
  | "task_baseline"
  | "context_generation"
  | "task_projection_history"
  | "repository_basis_record"
  | "request_equality"
  | "verification_detail"
  | "quota_admission"
  | "quota_transition"
  | "operation_journal";

type PrivateStoreControlStateRecordKindV1 =
  | "transaction_marker"
  | "cas_reservation"
  | "identity_binding"
  | "security_equality_key";

type PrivateStoreActiveMetadataRecordKindV1 =
  PrivateStoreCommittedMetadataRecordKindV1;

type PrivateStoreActiveTempRecordKindV1 =
  | "private_blob"
  | PrivateStoreCommittedMetadataRecordKindV1;

type PrivateStoreQuotaRecordKindV1 =
  | "private_blob"
  | PrivateStoreCommittedMetadataRecordKindV1
  | PrivateStoreControlStateRecordKindV1;

interface PrivateStoreQuotaBlobAllocationV1 {
  privateBlobId: PrivateBlobId;
  logicalBytes: number;
}

interface PrivateStoreQuotaFileAllocationCommonV1 {
  quotaKey: StoreRelativePathV1;
  logicalBytes: number;
}

type PrivateStoreQuotaFileAllocationV1<
  Category extends
    "committed_metadata" | "control_state"
> = PrivateStoreQuotaFileAllocationCommonV1 &
  (
    Category extends "committed_metadata"
      ? {
          category: "committed_metadata";
          recordKind:
            PrivateStoreCommittedMetadataRecordKindV1;
        }
      : {
          category: "control_state";
          recordKind:
            PrivateStoreControlStateRecordKindV1;
        }
  );

interface PrivateStoreQuotaReservationMembershipV1 {
  reservationId: PrivateCasReservationId;
  transactionNonce: LowerHex32;
  privateBlobId: PrivateBlobId;
}

interface PrivateStoreQuotaActiveBlobEntitlementV1 {
  privateBlobId: PrivateBlobId;
  privateContentDigest: ContentDigest;
  logicalBytes: number;
  reservationIds: [
    PrivateCasReservationId,
    ...PrivateCasReservationId[]
  ];
  ownersDigest: ContentDigest;
}

interface PrivateStoreQuotaPlannedFileCommonV1 {
  transactionNonce: LowerHex32;
  quotaKey: StoreRelativePathV1;
  logicalBytes: number;
  state: "planned" | "created";
}

type PrivateStoreQuotaPlannedFileV1<
  Category extends
    "active_metadata_plans" | "active_temp_plans"
> = PrivateStoreQuotaPlannedFileCommonV1 &
  (
    Category extends "active_metadata_plans"
      ? {
          category: "active_metadata_plans";
          recordKind:
            PrivateStoreActiveMetadataRecordKindV1;
        }
      : {
          category: "active_temp_plans";
          recordKind:
            PrivateStoreActiveTempRecordKindV1;
        }
  );

interface PrivateStoreQuotaUniverseV1 {
  committedBlobs: PrivateStoreQuotaBlobAllocationV1[];
  committedMetadata:
    PrivateStoreQuotaFileAllocationV1<
      "committed_metadata"
    >[];
  reservationMembership: PrivateStoreQuotaReservationMembershipV1[];
  activeBlobEntitlements: PrivateStoreQuotaActiveBlobEntitlementV1[];
  activeMetadataPlans:
    PrivateStoreQuotaPlannedFileV1<
      "active_metadata_plans"
    >[];
  activeTempPlans:
    PrivateStoreQuotaPlannedFileV1<
      "active_temp_plans"
    >[];
  controlState:
    PrivateStoreQuotaFileAllocationV1<
      "control_state"
    >[];
}

type PrivateStoreQuotaIndexCategoryNameV1 =
  | "committed_blobs"
  | "committed_metadata"
  | "reservation_membership"
  | "active_blob_entitlements"
  | "active_metadata_plans"
  | "active_temp_plans"
  | "control_state";

interface PrivateStoreQuotaIndexCategoryV1<
  Category extends PrivateStoreQuotaIndexCategoryNameV1
> {
  category: Category;
  merkleRootDigest: ContentDigest;
  itemCount: number;
  logicalBytes: number;
}

type PrivateStoreQuotaIndexLeafV1 =
  | {
      category: "committed_blobs";
      key: PrivateBlobId;
      recordKind: "private_blob";
      logicalBytes: number;
    }
  | {
      category: "committed_metadata";
      key: StoreRelativePathV1;
      recordKind:
        PrivateStoreCommittedMetadataRecordKindV1;
      logicalBytes: number;
    }
  | {
      category: "control_state";
      key: StoreRelativePathV1;
      recordKind:
        PrivateStoreControlStateRecordKindV1;
      logicalBytes: number;
    }
  | {
      category: "active_metadata_plans";
      key: StoreRelativePathV1;
      recordKind:
        PrivateStoreActiveMetadataRecordKindV1;
      logicalBytes: number;
      transactionNonce: LowerHex32;
      state: "planned" | "created";
    }
  | {
      category: "active_temp_plans";
      key: StoreRelativePathV1;
      recordKind:
        PrivateStoreActiveTempRecordKindV1;
      logicalBytes: number;
      transactionNonce: LowerHex32;
      state: "planned" | "created";
    }
  | {
      category: "reservation_membership";
      key: PrivateCasReservationId;
      recordKind: "cas_reservation";
      logicalBytes: 0;
      transactionNonce: LowerHex32;
      privateBlobId: PrivateBlobId;
    }
  | {
      category: "active_blob_entitlements";
      key: PrivateBlobId;
      recordKind: "private_blob";
      logicalBytes: number;
      ownersDigest: ContentDigest;
    };

type PrivateStoreQuotaIndexLeafForCategoryV1<
  Category extends PrivateStoreQuotaIndexCategoryNameV1
> = Extract<
  PrivateStoreQuotaIndexLeafV1,
  { category: Category }
>;

interface PrivateStoreQuotaIndexChildV1<
  Category extends PrivateStoreQuotaIndexCategoryNameV1
> {
  category: Category;
  firstKey: NonEmptyString;
  lastKey: NonEmptyString;
  itemCount: number;
  logicalBytes: number;
  childDigest: ContentDigest;
}

interface PrivateStoreQuotaIndexLeafEntryV1<
  Category extends PrivateStoreQuotaIndexCategoryNameV1
> {
  leaf: PrivateStoreQuotaIndexLeafForCategoryV1<Category>;
  leafDigest: ContentDigest;
}

interface PrivateStoreQuotaIndexNodeCommonV1<
  Category extends PrivateStoreQuotaIndexCategoryNameV1
> {
  profile: "private_store_quota_index_node_v1";
  category: Category;
  level: number;
  firstKey: NonEmptyString;
  lastKey: NonEmptyString;
  itemCount: number;
  logicalBytes: number;
}

type PrivateStoreQuotaIndexNodeForCategoryV1<
  Category extends PrivateStoreQuotaIndexCategoryNameV1
> =
  | (PrivateStoreQuotaIndexNodeCommonV1<Category> & {
      nodeKind: "leaf_page";
      level: 0;
      leaves: [
        PrivateStoreQuotaIndexLeafEntryV1<Category>,
        ...PrivateStoreQuotaIndexLeafEntryV1<Category>[]
      ];
    })
  | (PrivateStoreQuotaIndexNodeCommonV1<Category> & {
      nodeKind: "branch";
      children: [
        PrivateStoreQuotaIndexChildV1<Category>,
        PrivateStoreQuotaIndexChildV1<Category>,
        ...PrivateStoreQuotaIndexChildV1<Category>[]
      ];
    });

type PrivateStoreQuotaIndexNodeV1 = {
  [Category in PrivateStoreQuotaIndexCategoryNameV1]:
    PrivateStoreQuotaIndexNodeForCategoryV1<Category>;
}[PrivateStoreQuotaIndexCategoryNameV1];

interface PrivateStoreQuotaIndexRootV1 {
  profile: "private_store_quota_index_root_v1";
  treeLayoutVersion: "canonical-btree-256-v1";
  policyDigest: ContentDigest;
  committedBlobs:
    PrivateStoreQuotaIndexCategoryV1<"committed_blobs">;
  committedMetadata:
    PrivateStoreQuotaIndexCategoryV1<"committed_metadata">;
  reservationMembership:
    PrivateStoreQuotaIndexCategoryV1<"reservation_membership">;
  activeBlobEntitlements:
    PrivateStoreQuotaIndexCategoryV1<"active_blob_entitlements">;
  activeMetadataPlans:
    PrivateStoreQuotaIndexCategoryV1<"active_metadata_plans">;
  activeTempPlans:
    PrivateStoreQuotaIndexCategoryV1<"active_temp_plans">;
  controlState:
    PrivateStoreQuotaIndexCategoryV1<"control_state">;
  activeTransactionCount: number;
  universeRootDigest: ContentDigest;
}

interface PrivateStoreQuotaIndexRootEnvelopeV1 {
  schemaVersion: 1;
  recordType: "private_store_quota_index_root";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  contentDigest: ContentDigest;
  payload: PrivateStoreQuotaIndexRootV1;
}

interface PrivateStoreQuotaRejectedCandidateV1 {
  privateBlobId: PrivateBlobId;
  code:
    | "private_store_blob_quota_exhausted"
    | "private_store_active_quota_exhausted";
}

type PrivateStoreQuotaDeltaOperationForCategoryV1<
  Category extends PrivateStoreQuotaIndexCategoryNameV1
> =
  | {
      action: "put";
      expectedPrevious?:
        PrivateStoreQuotaIndexLeafForCategoryV1<Category>;
      resulting:
        PrivateStoreQuotaIndexLeafForCategoryV1<Category>;
    }
  | {
      action: "remove";
      expectedPrevious:
        PrivateStoreQuotaIndexLeafForCategoryV1<Category>;
    };

type PrivateStoreQuotaDeltaOperationV1 = {
  [Category in PrivateStoreQuotaIndexCategoryNameV1]:
    PrivateStoreQuotaDeltaOperationForCategoryV1<Category>;
}[PrivateStoreQuotaIndexCategoryNameV1];

interface PrivateStoreQuotaDeltaV1 {
  version: "private-store-quota-delta-v1";
  operations: PrivateStoreQuotaDeltaOperationV1[];
}

type PrivateStoreQuotaTransitionKindV1 =
  | "identity_bootstrap"
  | "identity_activation"
  | "store_initialization_terminalize"
  | "reservation"
  | "phase_update"
  | "commit"
  | "rollback"
  | "recovery";

interface PrivateStoreQuotaTransitionRecordCommonV1 {
  profile: "private_store_quota_transition_v1";
  id: PrivateStoreQuotaTransitionRecordId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  transactionNonce: LowerHex32;
  phaseOrdinal: number; // nonnegative safe integer；同 transaction 严格递增
  transitionKind: PrivateStoreQuotaTransitionKindV1;
  policyDigest: ContentDigest;
  preQuotaIndexRootDigest: ContentDigest;
  postQuotaIndexRootDigest: ContentDigest;
  delta: PrivateStoreQuotaDeltaV1;
  quotaDeltaDigest: ContentDigest;
  compareDeletePlanPins?: StoreProviderCompareDeletePlanPinV1[];
  compareDeleteResolutionPins?:
    StoreProviderCompareDeleteResolutionPinV1[];
  createdAt: IsoTimestamp;
}

type PrivateStoreQuotaTransitionRecordV1 =
  | (PrivateStoreQuotaTransitionRecordCommonV1 & {
      previousState: "genesis";
    })
  | (PrivateStoreQuotaTransitionRecordCommonV1 & {
      previousState: "transition";
      previousTransitionRecordId: PrivateStoreQuotaTransitionRecordId;
      previousTransitionRecordContentDigest: ContentDigest;
    });

interface PrivateStoreQuotaTransitionRecordEnvelopeV1 {
  schemaVersion: 1;
  recordType: "private_store_quota_transition";
  recordId: PrivateStoreQuotaTransitionRecordId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: PrivateStoreQuotaTransitionRecordV1;
}

interface PrivateStoreQuotaTransitionRecordLocatorV1 {
  locatorProfile:
    "store_private_quota_transition_record_v1";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  recordId: PrivateStoreQuotaTransitionRecordId;
}

interface RepoPulseImmutableVersionPinV1 {
  locatorProfile: "store_repo_pulse_immutable_version_v1";
  versionKey: RepoPulseVersionKeyV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  artifactId: ArtifactId;
  sourceSnapshotId: PathSafeRepositorySnapshotIdV1;
  contentDigest: ContentDigest;
  fileBinding: StoreDurableObjectBindingV1;
  publicationEvidence:
    StoreProviderAtomicPublishCommittedEvidenceV1;
}

interface ArtifactManifestGenerationPinV1 {
  locatorProfile: "store_artifact_manifest_generation_v1";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  generationId: ArtifactManifestGenerationIdV1;
  contentDigest: ContentDigest;
  fileBinding: StoreDurableObjectBindingV1;
  publicationEvidence:
    StoreProviderAtomicPublishCommittedEvidenceV1;
}

interface ArtifactManifestGenerationV1 {
  profile: "artifact_manifest_generation_v1";
  id: ArtifactManifestGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  predecessor:
    | { state: "genesis" }
    | {
        state: "generation";
        generation: ArtifactManifestGenerationPinV1;
      };
  manifestContentDigest: ContentDigest;
  manifest: ArtifactManifestV1;
  canonicalRepoPulse:
    | { state: "absent" }
    | {
        state: "version";
        version: RepoPulseImmutableVersionPinV1;
      };
  createdAt: IsoTimestamp;
}

interface ArtifactManifestGenerationEnvelopeV1 {
  schemaVersion: 1;
  recordType: "artifact_manifest_generation";
  generationId: ArtifactManifestGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ArtifactManifestGenerationV1;
}

interface PrivateStoreQuotaManifestPinCommonV1 {
  profile: "private_store_quota_manifest_pin_v1";
  policyDigest: ContentDigest;
  genesisQuotaIndexRootContentDigest: ContentDigest;
  currentQuotaIndexRootContentDigest: ContentDigest;
  artifactManifest:
    | { state: "absent" }
    | {
        state: "generation";
        generation: ArtifactManifestGenerationPinV1;
      };
  initializationTerminalHead?: StoreInitializationTerminalHeadPinV1;
}

type PrivateStoreQuotaManifestPinV1 =
  | (PrivateStoreQuotaManifestPinCommonV1 & {
      chainState: "genesis";
    })
  | (PrivateStoreQuotaManifestPinCommonV1 & {
      chainState: "transition";
      transitionRecordId: PrivateStoreQuotaTransitionRecordId;
      transitionRecordContentDigest: ContentDigest;
    });

interface StoreManifestGenerationV1 {
  profile: "store_manifest_generation_v1";
  id: StoreManifestGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  predecessor:
    | { state: "genesis" }
    | {
        state: "generation";
        generationId: StoreManifestGenerationIdV1;
        generationContentDigest: ContentDigest;
      };
  manifest: PrivateStoreQuotaManifestPinV1;
  createdAt: IsoTimestamp;
}

interface StoreManifestGenerationEnvelopeV1 {
  schemaVersion: 1;
  recordType: "store_manifest_generation";
  generationId: StoreManifestGenerationIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: StoreManifestGenerationV1;
}

interface StoreManifestGenerationPinV1 {
  locatorProfile: "store_manifest_generation_v1";
  generationId: StoreManifestGenerationIdV1;
  contentDigest: ContentDigest;
  fileBinding: StoreDurableObjectBindingV1;
  publicationEvidence:
    StoreProviderAtomicPublishCommittedEvidenceV1;
}

interface StoreManifestNamespaceEnumerationEntryV1
  extends StoreManifestGenerationPinV1 {
  commitOperationNonce: LowerHex32;
  predecessor:
    | { state: "genesis" }
    | {
        state: "generation";
        generationId: StoreManifestGenerationIdV1;
        generationContentDigest: ContentDigest;
      };
}

interface StoreManifestNamespaceEnumerationV1 {
  profile: "store_manifest_namespace_enumeration_v1";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  namespaceRevision: number; // integer >=1
  entries: [
    StoreManifestNamespaceEnumerationEntryV1,
    ...StoreManifestNamespaceEnumerationEntryV1[]
  ]; // chain order by namespace revision; generationId strict unique
  generationCount: number; // integer >=1
  generationSetDigest: ContentDigest;
}

interface StoreManifestNamespaceHeadV1 {
  profile: "store_manifest_namespace_head_v1";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  namespaceRevision: number; // integer >=1
  operationNonce: LowerHex32;
  predecessor:
    | {
        state: "genesis";
        expectedNamespaceState: "absent";
      }
    | {
        state: "version";
        namespaceRevision: number;
        contentDigest: ContentDigest;
        currentVersionToken: StoreManifestNamespaceVersionTokenV1;
      };
  currentGeneration: StoreManifestGenerationPinV1;
  generationCount: number; // integer >=1
  generationSetDigest: ContentDigest;
}

interface StoreManifestNamespaceHeadEnvelopeV1 {
  schemaVersion: 1;
  recordType: "store_manifest_namespace_head";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  contentDigest: ContentDigest;
  currentVersionToken: StoreManifestNamespaceVersionTokenV1;
  payload: StoreManifestNamespaceHeadV1;
}

interface StoreManifestCurrentReadV1 {
  profile: "store_manifest_current_read_v1";
  head: StoreManifestNamespaceHeadEnvelopeV1;
  enumeration: StoreManifestNamespaceEnumerationV1;
}

interface StoreManifestCompareAppendRequestV1 {
  profile: "store_manifest_compare_append_request_v1";
  operationNonce: LowerHex32;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  expected:
    | {
        state: "genesis";
        expectedNamespaceState: "absent";
      }
    | {
        state: "current";
        namespaceRevision: number;
        headContentDigest: ContentDigest;
        currentVersionToken: StoreManifestNamespaceVersionTokenV1;
        generationCount: number;
        generationSetDigest: ContentDigest;
        currentGeneration: StoreManifestGenerationPinV1;
      };
  candidateGeneration: StoreManifestGenerationEnvelopeV1;
  candidatePublicationRequest:
    StoreProviderAtomicPublishDurableRequestProjectionV1;
}

type StoreManifestObservedHeadV1 =
  | { state: "absent" }
  | {
      state: "trusted";
      head: StoreManifestNamespaceHeadEnvelopeV1;
    }
  | {
      state: "integrity_failed";
      evidenceDigest: ContentDigest;
    };

type StoreManifestCompareAppendFailureV1 =
  | {
      source: "head_compare";
      reason: "expected_head_changed";
      recoveryDirective:
        "retry_from_authenticated_current";
      successorPolicy: "exactly_one_retry_attempt";
    }
  | {
      source: "candidate_validation";
      reason: "candidate_invalid";
      recoveryDirective: "fatal_integrity_failure";
      successorPolicy: "terminal_no_successor";
    }
  | {
      source: "namespace_integrity";
      reason: "namespace_integrity_failed";
      recoveryDirective: "fatal_integrity_failure";
      successorPolicy: "terminal_no_successor";
    }
  | {
      source: "candidate_publication";
      publicationResult:
        StoreProviderAtomicPublishResultV1 & {
          outcome: "not_committed";
        };
    };

type StoreManifestCompareAppendDurableOutcomeV1 =
  | {
      outcome: "committed";
      committedHead:
        StoreManifestNamespaceHeadEnvelopeV1;
      appendedGeneration:
        StoreManifestNamespaceEnumerationEntryV1;
    }
  | {
      outcome: "not_committed";
      failure: StoreManifestCompareAppendFailureV1;
      observedHead: StoreManifestObservedHeadV1;
    };

type StoreManifestCompareAppendOperationReceiptClaimsV1 =
  Extract<
    StoreProviderOperationReceiptClaimsV1,
    { operation: "store_manifest_compare_append" }
  >;

interface StoreManifestCompareAppendReceiptV1 {
  profile: "store_manifest_compare_append_receipt_v1";
  providerId: DurableObjectIdentityProviderIdV1;
  providerPolicyDigest: ContentDigest;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  operationNonce: LowerHex32;
  requestContentDigest: ContentDigest;
  requestDurableProjection:
    StoreManifestCompareAppendRequestV1;
  durableOutcome:
    StoreManifestCompareAppendDurableOutcomeV1;
  resolvedAt: IsoTimestamp;
  operationReceipt: StoreProviderOperationReceiptEnvelopeV1 & {
    claims: StoreManifestCompareAppendOperationReceiptClaimsV1;
  };
}

interface StoreManifestCompareAppendReceiptEnvelopeV1 {
  schemaVersion: 1;
  recordType: "store_manifest_compare_append_receipt";
  locatorProfile:
    "store_manifest_compare_append_receipt_v1";
  providerId: DurableObjectIdentityProviderIdV1;
  providerPolicyDigest: ContentDigest;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  operationNonce: LowerHex32;
  resolvedAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: StoreManifestCompareAppendReceiptV1;
}

interface StoreManifestCompareAppendReceiptPinV1 {
  locatorProfile:
    "store_manifest_compare_append_receipt_v1";
  providerId: DurableObjectIdentityProviderIdV1;
  providerPolicyDigest: ContentDigest;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  operationNonce: LowerHex32;
  contentDigest: ContentDigest;
  operationReceiptToken:
    StoreProviderOperationReceiptTokenV1;
}

type StoreManifestCompareAppendResultV1 =
  | {
      resolution: "resolved";
      receipt: StoreManifestCompareAppendReceiptEnvelopeV1;
    }
  | {
      resolution: "request_rejected";
      reason: "operation_nonce_request_mismatch";
      existingReceipt:
        StoreManifestCompareAppendReceiptEnvelopeV1;
    };

interface PrivateStoreQuotaAdmissionRecordV1 {
  profile: "private_store_quota_admission_v1";
  id: PrivateStoreQuotaAdmissionRecordId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  taskId: TaskId;
  eventId: EventId;
  transactionNonce: LowerHex32;
  policyDigest: ContentDigest;
  transitionRecordId: PrivateStoreQuotaTransitionRecordId;
  transitionRecordContentDigest: ContentDigest;
  acceptedCandidateBlobIds: PrivateBlobId[];
  rejectedCandidates: PrivateStoreQuotaRejectedCandidateV1[];
  createdAt: IsoTimestamp;
}

interface PrivateStoreQuotaAdmissionRecordEnvelopeV1 {
  schemaVersion: 1;
  recordType: "private_store_quota_admission";
  recordId: PrivateStoreQuotaAdmissionRecordId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  taskId: TaskId;
  eventId: EventId;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: PrivateStoreQuotaAdmissionRecordV1;
}

interface PrivateStoreQuotaAdmissionRecordLocatorV1 {
  locatorProfile:
    "store_private_quota_admission_record_v1";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  taskId: TaskId;
  recordId: PrivateStoreQuotaAdmissionRecordId;
}

interface PathSafeRepositoryChangeV1 {
  id: PathSafeRepositoryChangeIdV1;
  path: RepositoryRelativePath;
  oldPath?: RepositoryRelativePath;
  source: RepositoryChangeSourceV1;
  kind: RepositoryChangeKindV1;
  contentDigest?: ContentDigest;
  previousContentDigest?: ContentDigest;
}

interface RedactedRepositoryChangeAggregateV1 {
  id: PathSafeRepositoryRedactionIdV1;
  source: RepositoryChangeSourceV1;
  kind: RepositoryChangeKindV1;
  boundaryCode: RepositorySnapshotBoundaryCodeV1;
  count: number; // positive safe integer
}

type RepositoryStateUncertaintyCodeV1 =
  | "hard_deny_equality_unprovable"
  | "scan_unit_limit_equality_unprovable"
  | "scan_capture_limit_equality_unprovable"
  | "unstable_read"
  | "unreadable"
  | "unrepresentable_path"
  | "unsafe_file_kind";

interface OpaqueRepositoryStateAggregateV1 {
  id: PathSafeRepositoryUnknownStateIdV1;
  code: RepositoryStateUncertaintyCodeV1;
  count: number; // positive safe integer；按 unique logical lineage
}

interface RepositoryCaptureAccountingV1 {
  rawLayerUnitCount: number;
  candidateUnitCount: number;
  safeChangeCount: number;
  redactedKnownChangeCount: number;
  unknownStateCount: number;
}

interface StrongRepositorySnapshotV1 {
  schemaVersion: 1;
  profile: "repository_snapshot_path_safe_v1";
  snapshotId: PathSafeRepositorySnapshotIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  rootIdentity: PathSafeRootIdentityV1;
  branchState:
    | { status: "detached" }
    | { status: "safe"; name: NonEmptyString }
    | {
        status: "redacted";
        boundaryCode: RepositoryBranchRedactionCodeV1;
      };
  objectFormat: "sha1" | "sha256";
  headState:
    | { kind: "commit"; commit: GitObjectId }
    | { kind: "unborn"; emptyTreeObjectId: GitObjectId };
  baseCommit?: GitObjectId;
  mergeBase?: GitObjectId;
  repositoryStateToken: KeyedStateTokenV1;
  indexToken: KeyedStateTokenV1;
  worktreeToken: KeyedStateTokenV1;
  untrackedToken: KeyedStateTokenV1;
  ignoreToken: KeyedStateTokenV1;
  securityScanPolicyDigest: ContentDigest;
  safeGitExecutionDigest: ContentDigest;
  createdAt: IsoTimestamp;
  captureStatus: "complete" | "partial";
  accounting: RepositoryCaptureAccountingV1;
  changes: PathSafeRepositoryChangeV1[];
  redactedChanges: RedactedRepositoryChangeAggregateV1[];
  unknownStates: OpaqueRepositoryStateAggregateV1[];
}

interface StrongRepoPulseSecurityFieldsV1 {
  snapshotProfile: "repository_snapshot_path_safe_v1";
  safeChangeCount: number;
  redactedChangeCount: number;
  unknownStateCount: number;
  redactionBoundaryCodes: RepositorySnapshotBoundaryCodeV1[];
  uncertaintyCodes: RepositoryStateUncertaintyCodeV1[];
}

type RepoPulseDiagnosticCodeV1 =
  | "repository_capture_partial"
  | "repository_branch_redacted"
  | "repository_security_boundary"
  | "artifact_missing"
  | "artifact_stale"
  | "parser_partial"
  | "parser_unsupported"
  | "call_graph_partial"
  | "strong_refresh_required";

interface StrongRepoPulseV1 {
  profile: "repo_pulse_path_safe_v1";
  evaluatedSnapshotId: PathSafeRepositorySnapshotIdV1;
  evaluatedSnapshotContentDigest: ContentDigest;
  baselineSnapshotId?: PathSafeRepositorySnapshotIdV1;
  status:
    | "not_ready"
    | "fresh"
    | "partial"
    | "stale"
    | "unknown"
    | "rebuilding"
    | "error";
  artifactFreshness: {
    graph: "fresh" | "partial" | "stale" | "missing" | "error";
    wiki: "fresh" | "partial" | "stale" | "missing" | "error";
    evidence: "fresh" | "partial" | "stale" | "missing" | "error";
    diff: "fresh" | "partial" | "stale" | "missing" | "error";
    task: "fresh" | "partial" | "stale" | "missing" | "error";
  };
  repositoryState: {
    repositoryId: PathSafeRepositoryIdV1;
    worktreeId: PathSafeWorktreeIdV1;
    rootIdentity: PathSafeRootIdentityV1;
    branchState: StrongRepositorySnapshotV1["branchState"];
    objectFormat: "sha1" | "sha256";
    headState: StrongRepositorySnapshotV1["headState"];
    repositoryStateToken: KeyedStateTokenV1;
    captureStatus: "complete" | "partial";
  };
  changeSummary: {
    total: number;
    bySource: Record<RepositoryChangeSourceV1, number>;
    byKind: Record<RepositoryChangeKindV1, number>;
  };
  security: StrongRepoPulseSecurityFieldsV1;
  securityScanPolicyDigest: ContentDigest;
  safeGitExecutionDigest: ContentDigest;
  completeness: {
    parser: {
      status: "complete" | "partial" | "unknown" | "unsupported";
      coverage?: number;
      reasonCodes: RepoPulseDiagnosticCodeV1[];
    };
    callGraph: {
      status: "complete" | "partial" | "unknown" | "unsupported";
      coverage?: number;
      reasonCodes: RepoPulseDiagnosticCodeV1[];
    };
  };
  recommendedRefresh: "none" | "incremental" | "full";
  diagnosticCodes: RepoPulseDiagnosticCodeV1[];
  evaluatedAt: IsoTimestamp;
}

type RepoPulsePersistedPayloadV1 =
  | LegacyRepoPulseV1
  | StrongRepoPulseV1;

type RepoPulseArtifactV1 =
  ArtifactEnvelopeV1<RepoPulsePersistedPayloadV1> & {
    schemaVersion: 1;
    artifactType: "repo_pulse";
    repositoryId: PathSafeRepositoryIdV1;
    worktreeId: PathSafeWorktreeIdV1;
  };
// immutable file bytes必须以 strict Artifact Envelope保存；artifactId、
// repository/worktree/sourceSnapshot/revision/createdAt/contentDigest各 outer字段
// 均与 Manifest descriptor、version pin和 payload语义逐项验证，payload-only
// content digest重算后才能成为 Artifact Manifest current descriptor。

interface LegacyRepositorySnapshotRedactedViewV1 {
  viewVersion: 1;
  viewKind: "legacy_repository_snapshot_redacted";
  sourceCaptureStatus: "complete" | "partial" | "error";
  aggregateChangeCount: number;
  capturedAt: IsoTimestamp;
  strongOperationSupported: false;
}

interface StrongRepositorySnapshotSurfaceViewV1 {
  viewVersion: 1;
  viewKind: "strong_repository_snapshot";
  snapshotId: PathSafeRepositorySnapshotIdV1;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  branchState: StrongRepositorySnapshotV1["branchState"];
  objectFormat: "sha1" | "sha256";
  headState: StrongRepositorySnapshotV1["headState"];
  captureStatus: "complete" | "partial";
  accounting: RepositoryCaptureAccountingV1;
  changes: PathSafeRepositoryChangeV1[];
  redactedChanges: RedactedRepositoryChangeAggregateV1[];
  unknownStates: OpaqueRepositoryStateAggregateV1[];
  capturedAt: IsoTimestamp;
  strongOperationSupported: true;
}

type RepositorySnapshotSurfaceResponseV1 =
  | LegacyRepositorySnapshotRedactedViewV1
  | StrongRepositorySnapshotSurfaceViewV1;

interface LegacyRepoPulseRedactedViewV1 {
  viewVersion: 1;
  viewKind: "legacy_repo_pulse_redacted";
  status:
    | "not_ready"
    | "fresh"
    | "partial"
    | "stale"
    | "unknown"
    | "rebuilding"
    | "error";
  aggregateChangeCount?: number;
  evaluatedAt: IsoTimestamp;
  strongOperationSupported: false;
}

interface StrongRepoPulseSurfaceViewV1 {
  viewVersion: 1;
  viewKind: "strong_repo_pulse";
  evaluatedSnapshotId: PathSafeRepositorySnapshotIdV1;
  status:
    | "not_ready"
    | "fresh"
    | "partial"
    | "stale"
    | "unknown"
    | "rebuilding"
    | "error";
  branchState: StrongRepositorySnapshotV1["branchState"];
  safeChangeCount: number;
  redactedChangeCount: number;
  unknownStateCount: number;
  redactionBoundaryCodes: RepositorySnapshotBoundaryCodeV1[];
  uncertaintyCodes: RepositoryStateUncertaintyCodeV1[];
  evaluatedAt: IsoTimestamp;
  strongOperationSupported: true;
}

type RepoPulseSurfaceResponseV1 =
  | LegacyRepoPulseRedactedViewV1
  | StrongRepoPulseSurfaceViewV1;

interface PrivateCasReservationV1 {
  profile: "private_cas_reservation_v1";
  id: PrivateCasReservationId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  taskId: TaskId;
  transactionNonce: LowerHex32;
  privateBlobId: PrivateBlobId;
  privateContentDigest: ContentDigest;
  size: number;
  markerPath: StoreRelativePathV1;
  createdAt: IsoTimestamp;
}

interface PrivateCasReservationEnvelopeV1 {
  schemaVersion: 1;
  recordType: "private_cas_reservation";
  recordId: PrivateCasReservationId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  taskId: TaskId;
  producerVersion: ProducerVersion;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: PrivateCasReservationV1;
}

interface PrivateStoreQuotaStateCommonV1 {
  profile: "private_store_quota_state_v1";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  policyDigest: ContentDigest;
  genesisQuotaIndexRootContentDigest: ContentDigest;
  quotaIndexRootContentDigest: ContentDigest;
  universeRootDigest: ContentDigest;
  committedPrivateBlobLogicalBytes: number;
  committedPrivateBlobCount: number;
  committedPrivateMetadataLogicalBytes: number;
  committedPrivateMetadataFileCount: number;
  activeReservationLogicalBytes: number;
  activeMetadataReservationLogicalBytes: number;
  activeMetadataPlanCount: number;
  activeTempReservationLogicalBytes: number;
  activeTempPlanCount: number;
  activeTransactionCount: number;
  activeReservationCount: number;
  controlStateLogicalBytes: number;
  controlStateFileCount: number;
  reachableQuotaIndexLogicalBytes: number;
  reachableQuotaIndexNodeCount: number;
}

type PrivateStoreQuotaStateV1 =
  | (PrivateStoreQuotaStateCommonV1 & {
      chainState: "genesis";
    })
  | (PrivateStoreQuotaStateCommonV1 & {
      chainState: "transition";
      quotaTransitionHeadRecordId: PrivateStoreQuotaTransitionRecordId;
      quotaTransitionHeadRecordContentDigest: ContentDigest;
    });

interface GitConflictStageV1 {
  stage: 1 | 2 | 3;
  objectId: GitObjectId;
  mode: GitModeV1;
}

type BaselinePathCaptureV1 =
  | {
      status: "absent";
    }
  | {
      status: "git_object";
      objectId: GitObjectId;
      mode: GitModeV1;
      size: number;
      contentDigest: ContentDigest;
    }
  | {
      status: "tree_object";
      objectId: GitObjectId;
      mode: "040000";
    }
  | {
      status: "gitlink_object";
      objectId: GitObjectId;
      mode: "160000";
    }
  | {
      status: "private_blob";
      privateBlobId: PrivateBlobId;
      privateContentDigest: ContentDigest;
      mode: GitModeV1;
      size: number;
    }
  | {
      status:
        | "binary"
        | "oversized"
        | "unreadable"
        | "special";
      mode?: GitModeV1;
      size?: number;
      boundaryIds: [AnalysisBoundaryId, ...AnalysisBoundaryId[]];
    }
  | {
      status: "conflict";
      stages: [GitConflictStageV1, ...GitConflictStageV1[]];
      boundaryIds: [AnalysisBoundaryId, ...AnalysisBoundaryId[]];
    };

interface TaskBaselinePathStateV1 {
  path: RepositoryRelativePath; // internal safe path；hard-deny/secret 不进入
  finalKind:
    | "file"
    | "directory"
    | "symlink"
    | "gitlink"
    | "absent"
    | "unknown";
  capture: BaselinePathCaptureV1;
}

type TaskBaselineHeadSemanticV1 =
  | {
      status: "present";
      commit: GitObjectId;
      treeObjectId: GitObjectId;
      gitLease:
        | {
            status: "pinned";
            leaseId: GitLeaseId;
            objectId: GitObjectId;
          }
        | { status: "unpinned"; boundaryId: AnalysisBoundaryId };
    }
  | {
      status: "unborn";
      emptyTreeObjectId: GitObjectId;
    };

interface InternalTaskBaselineV1 {
  profile: "task_baseline_v1";
  artifactId: TaskBaselineArtifactId;
  materializationVersion: number;
  taskId: TaskId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  captureSnapshotId: PathSafeRepositorySnapshotIdV1;
  baselineHead:
    | {
        status: "present";
        commit: GitObjectId;
        treeObjectId: GitObjectId;
        gitLease:
          | {
              status: "pinned";
              leaseId: GitLeaseId;
              refName:
                `refs/understand-code/task-baselines/${GitLeaseRefSuffixV1}`;
              objectId: GitObjectId;
            }
          | { status: "unpinned"; boundaryId: AnalysisBoundaryId };
      }
    | {
        status: "unborn";
        emptyTreeObjectId: GitObjectId;
      };
  repositoryStateToken: KeyedStateTokenV1;
  attributesDigest: ContentDigest;
  scannerPolicyDigest: ContentDigest;
  repositoryPolicyDigest: ContentDigest;
  safeGitExecutionDigest: ContentDigest;
  baselineMaterializationBudgetDigest: ContentDigest;
  privateStoreQuotaPolicyDigest: ContentDigest;
  captureStatus: "complete" | "partial";
  paths: TaskBaselinePathStateV1[];
  redactedUnits: {
    count: number;
    boundaryIds: AnalysisBoundaryId[];
  };
  boundaries: AnalysisBoundaryV1[];
}

interface InternalTaskBaselineEnvelopeV1 {
  schemaVersion: 1;
  artifactType: "task_baseline";
  artifactId: TaskBaselineArtifactId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  sourceSnapshotId: PathSafeRepositorySnapshotIdV1;
  taskId: TaskId;
  taskRevision: number;
  producerVersion: ProducerVersion;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: InternalTaskBaselineV1;
}

interface TaskBaselineSummaryV1 {
  captureSnapshotId: PathSafeRepositorySnapshotIdV1;
  captureStatus: "complete" | "partial";
  reconstructablePathCount: number;
  redactedUnitCount: number;
  boundaryCodes: AnalysisBoundaryCodeV1[];
}

interface ArtifactPinV1 {
  artifactId: ArtifactId;
  contentDigest: ContentDigest;
  sourceSnapshotId: PathSafeRepositorySnapshotIdV1;
}

type RepositoryReadSetEntryV1 =
  | {
      kind: "artifact_descriptor";
      artifactId: ArtifactId;
      artifactType: ArtifactTypeV1 | InternalManagedArtifactTypeV1;
      contentDigest: ContentDigest;
      sourceSnapshotId: PathSafeRepositorySnapshotIdV1;
      state: "current" | "historical";
    }
  | {
      kind: "repository_state";
      snapshotId: PathSafeRepositorySnapshotIdV1;
      stateToken: KeyedStateTokenV1;
      headStateDigest: ContentDigest;
      indexToken: KeyedStateTokenV1;
      worktreeToken: KeyedStateTokenV1;
      untrackedToken: KeyedStateTokenV1;
      ignoreToken: KeyedStateTokenV1;
    }
  | {
      kind: "git_ref";
      refName: GitRefNameV1;
      objectFormat: "sha1" | "sha256";
      objectId: GitObjectId;
    }
  | {
      kind: "git_object";
      objectFormat: "sha1" | "sha256";
      objectType: "commit" | "tree" | "blob";
      objectId: GitObjectId;
    }
  | {
      kind: "index";
      stateToken: KeyedStateTokenV1;
    }
  | {
      kind: "worktree_path";
      path: RepositoryRelativePath; // safe path only
      fileKind: "file" | "absent";
      mode?: GitModeV1;
      size?: number;
      contentDigest?: ContentDigest;
    }
  | {
      kind: "safe_git_control";
      controlKind:
        | "executable"
        | "bootstrap_binding"
        | "linked_worktree_binding"
        | "odb_layout"
        | "ref_backend"
        | "repository_config"
        | "worktree_config"
        | "hooks_directory";
      stateToken: KeyedStateTokenV1;
    }
  | {
      kind: "policy";
      policyKind:
        | "attributes"
        | "scanner"
        | "repository"
        | "safe_git_execution"
        | "safe_git_isolation"
        | "ignore"
        | "baseline_materialization_budget"
        | "private_store_quota";
      digest: ContentDigest;
    };

interface RepositoryReadSetV1 {
  version: "repository-read-set-v1";
  entries: RepositoryReadSetEntryV1[];
  readSetDigest: ContentDigest;
}

interface TaskCreationBasisV1 {
  version: "task-creation-basis-v1";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  sourceSnapshot: ArtifactPinV1 & {
    snapshotId: PathSafeRepositorySnapshotIdV1;
    manifestState: "current";
  };
  repositoryStateToken: KeyedStateTokenV1;
  attributesDigest: ContentDigest;
  scannerPolicyDigest: ContentDigest;
  repositoryPolicyDigest: ContentDigest;
  safeGitExecutionDigest: ContentDigest;
  baselineMaterializationBudgetDigest: ContentDigest;
  privateStoreQuotaPolicyDigest: ContentDigest;
  readSet: RepositoryReadSetV1;
}

interface RepositoryBasisV1 {
  version: "repository-basis-v1";
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  actualSnapshot: ArtifactPinV1 & {
    snapshotId: PathSafeRepositorySnapshotIdV1;
    manifestState: "current";
  };
  pulse: ArtifactPinV1 & {
    evaluatedSnapshotId: PathSafeRepositorySnapshotIdV1;
    manifestState: "current";
  };
  baselineSnapshot: ArtifactPinV1 & {
    snapshotId: PathSafeRepositorySnapshotIdV1;
    dependencySemantics: "immutable_pin";
  };
  priorTaskBaseline: ArtifactPinV1 & {
    captureSnapshotId: PathSafeRepositorySnapshotIdV1;
    dependencySemantics: "immutable_pin";
  };
  attributesDigest: ContentDigest;
  scannerPolicyDigest: ContentDigest;
  repositoryPolicyDigest: ContentDigest;
  safeGitExecutionDigest: ContentDigest;
  baselineMaterializationBudgetDigest: ContentDigest;
  privateStoreQuotaPolicyDigest: ContentDigest;
  readSet: RepositoryReadSetV1;
}

interface RepositoryBasisRecordV1 {
  profile: "repository-basis-record-v1";
  id: RepositoryBasisRecordId;
  taskId: TaskId;
  operationEventId: EventId;
  basis: TaskCreationBasisV1 | RepositoryBasisV1;
  basisDigest: ContentDigest;
}

interface RepositoryBasisRecordEnvelopeV1 {
  schemaVersion: 1;
  recordType: "repository_basis_record";
  recordId: RepositoryBasisRecordId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  taskId: TaskId;
  taskRevision: number;
  operationEventId: EventId;
  producerVersion: ProducerVersion;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: RepositoryBasisRecordV1;
}
```

无 `profile` 的现有 `RepositorySnapshotV1` 是 legacy lossless reader variant；
它的 bytes/digest不迁移，`snapshotId`继续按 generic `SnapshotId`接受既有
opaque wire grammar（包括 `snapshot:actual`），绝不升级/重写为 PathSafe；
但不能作为任何 WP5 strong Task 的 Creation/Repository Basis。raw legacy
Snapshot/Pulse 只允许 owner-only integrity/migration reader
访问；通用 MCP、Resource、Workbench 与日志必须投影为 strict
`LegacyRepositorySnapshotRedactedViewV1` 或
`LegacyRepoPulseRedactedViewV1`，只含各自 strict aggregate status/count/safe
time 与 `strongOperationSupported=false`，禁止返回 legacy snapshot/repository/
worktree/root ID、branch、path/oldPath、OID、content digest 或 diagnostic text。
Snapshot/Pulse 分别使用
`RepositorySnapshotSurfaceResponseV1/RepoPulseSurfaceResponseV1` 完整
discriminated union；所有 variant extra-key reject，不能直接序列化或 object
spread raw legacy/strong Envelope。

P0 新 Snapshot writer 只能生成 `repository_snapshot_path_safe_v1`，且
其 publication 顺序固定为：

1. 在内存中完整枚举 HEAD tree/Index/Worktree/Untracked/conflict 原始 unit；
   filesystem walk 在读取正文前按规则排除 Git control tree 与
   `.understand-code/**` product control tree，且对二者的 file/symlink/reparse
   身份 fail closed；此时不得写 Snapshot、Pulse、临时 JSON、日志或 raw
   digest。若 unit 数、raw path 总 bytes 或目录深度达到 security universe cap，
   因无法证明完整全集而以固定 `security_scan_universe_limit` **零写失败**，
   不能发布 partial；
2. 对 branch、`path/oldPath` 先执行 hard-deny 与敏感文本扫描。hard-deny 命中时
   禁止打开 path、blob 或 symlink target；该 unit 只计入 aggregate；
3. 对准备公开任一 path/OID/content digest 的每个 before/after regular-file
   side 执行完整 streaming scanner。安全扫描使用上面的
   `SecurityScanPolicyV1`，独立于 `ChangeAnalysisBudgetV1`，分析的
   `maxBytesPerFile/maxTotalBytes` 不能缩短或替代安全扫描；
4. 只有 path 与所有需要持久化身份的 side 全部扫描通过，才构造
   `PathSafeRepositoryChangeV1` 并计算其 ID/digest。hard-deny、secret、
   非 UTF-8/unrepresentable、special file、单 unit 超过 16 MiB 或 capture
   累计超过 256 MiB 时，不保存该 unit 的 path/oldPath/OID/raw SHA/size/ID。
   若不读取禁止正文即可从可信 layer transition 证明 source/kind，则只按
   `[source,kind,boundaryCode]` 写 `redactedChanges`；不能证明是否变化时写
   不含 source/kind 的 `unknownStates`，绝不伪造 `modified/committed`；
5. scanner 自身报错、policy/key 无法验证或 aggregate count 无法证明时整个
   capture 零写；只有在第 1 步已证明完整 universe 后，明确达到
   per-unit/per-capture content streaming 上限才可发布
   `captureStatus=partial` 的 aggregate redaction；
6. 扫描、token 和 strict Bundle 校验全部完成后，才以 immutable Snapshot
   transaction 发布；Repo Pulse 只能从已提交的 strong Snapshot 派生。

每个 filesystem regular-file side 必须从 Store-bound root 以一次 no-follow
open 取得 handle，scan 与 content digest 在**同一字节流**中完成；open 前后
`fstat` 必须验证 file-id/inode、regular type、owner、nlink、mode、size、
mtime/ctime 均稳定。需要进入 baseline blob 或后续 Hunk 的 bytes 必须从这次
已扫描 stream 的有界内存 buffer 写出，禁止 close 后按 path 重新打开；超过对应
buffer Budget 的 unit 只保留安全 aggregate/metadata，不做第二次未扫描读取。
Git side 只读 exact OID 的 raw object stream、禁 filter/textconv，并同时验证
object format/type/size/OID。Snapshot/Delta/Baseline 的 content digest 必须等于
scanner 实际消费的同一 stream；任何换 inode、短读、scan 后变更或二次读取需求
都产生 `unstable_read` aggregate，不能落盘旧扫描结论配新 bytes。

出现在 HEAD tree、Index、conflict stage、Worktree 或 Untracked raw layer
universe 中的 hard-deny path 必须无条件成为 security-opaque unit；不得因
size/mtime/file-id
看似未变而推断正文等于 Index/HEAD，因为策略明确禁止读取它。这样即使攻击者
原位改写正文并保留 metadata，也不能产生 false clean。若 layer metadata
本身足以证明 added/deleted/conflict 等变化，它进入 `redactedChanges`；clean
tracked regular file 或其他无法证明 equality 的单位进入 `unknownStates`。
二者按 internal owner-keyed logical-lineage equality 去重，不能重复计数。

`redactedChanges` 按 `[source-order,kind-order,boundaryCode,id]` 排序、tuple
unique、count 为正 safe integer；每项 `id` 都必须由上表
`repository-snapshot-redaction-v1` fields（含 exact repository state token）
重算。`unknownStates` 按 `[code,id]` 排序、tuple unique、count 为正，并按
`repository-snapshot-unknown-state-v1` 重算。`accounting.rawLayerUnitCount`
等于完整 HEAD/Index/Worktree/Untracked/conflict raw layer enumeration；
`candidateUnitCount === changes.length + sum(redactedChanges.count) +
sum(unknownStates.count)`，后三个 count 还必须分别等于
`safeChangeCount/redactedKnownChangeCount/unknownStateCount`。安全 unchanged
单位只进入 raw layer count 与 owner-keyed state token，不伪装成 change。
`captureStatus=complete` 当且仅当两个 aggregate 数组都为空且
`branchState.status !== "redacted"`；否则必须为 partial。不能通过丢 unit
或把 unknown 冒充 clean 伪造完整性。rename/copy 的两个 path 与
before/after side 是同一原子 unit，任一侧不安全则整项 aggregate redacted。
branch 只有通过 UTF-8/control/length/ref grammar 与完整敏感内容扫描才允许
`status=safe`；否则只保留上表固定 redaction code。safe change 按
`[source-order,path,oldPath-or-empty,kind-order,id]` 排序并拒绝 exact duplicate。
其 ID 固定为
`change-<full lowercase sha256(canonical JSON(["path-safe-repository-change-v1",
{path,oldPath?,source,kind,contentDigest?,previousContentDigest?}]))>`，不含 ordinal
或 capture order。Snapshot ID 固定为
`snapshot-<full lowercase sha256(canonical JSON(
["repository-snapshot-path-safe-v1", fields]))>`，`fields` 是表列的完整 safe
payload并明确只排除 `snapshotId`；它包括 Engine 在 final validation cut
生成的 `createdAt`、keyed tokens、accounting、已排序 changes、两类 aggregate
IDs/counts 与 policy digest。同一 state 的两次真实 capture 因 capture time
不同拥有不同 Snapshot ID；`repositoryStateToken` 才是 state equality key，
Store 因而不会出现同一 Artifact ID 对应不同 bytes。四个 path-safe ID 都使用
独立 regex/refine brand、
重算校验与 golden vectors，不得接收 caller opaque ID，也不得沿用 legacy
prefix-outside-preimage 的 `opaqueId()` helper。

避免 clean polling 制造新 capture，publisher 在 Repository lock 的 final cut
先把 candidate 与 current strong Snapshot 投影为排除
`snapshotId/createdAt`、但包含所有其余 safe fields/policy/token/redaction 的
`repository-snapshot-semantic-equality-v1` bytes。exact equal 时必须复用首次
committed Snapshot/createdAt/content digest，零 Artifact/Pulse publication、
零 Task stale/Event；只有语义变化才生成新 `createdAt` 和 Snapshot ID。并发或
restart 后命中同一 semantic projection 也只能有一个 publication。

Snapshot aggregate 到 Change Check Boundary 的映射是 wire contract，不能由
各模块自行猜测：

| Snapshot aggregate code | stage | Analysis code | scope | recovery |
|---|---|---|---|---|
| `hard_deny_path` / `sensitive_path` | `repository_delta` | `sensitive_path` | `redacted_path_set(count)` | `manual_inspection` |
| `secret_content` | `repository_delta` | `secret_detected` | `redacted_path_set(count)` | `manual_inspection` |
| `invalid_utf8` | `repository_delta` | `invalid_utf8` | `redacted_path_set(count)` | `manual_inspection` |
| `control_character` / `branch_value_oversized` | `repository_delta` | `invalid_repository_metadata` | `redacted_path_set(count)` | `manual_inspection` |
| `unsafe_git_ref` | `repository_delta` | `unsafe_git_ref` | `redacted_path_set(count)` | `use_supported_repository_configuration` |
| `scan_unit_oversized` | `repository_delta` | `security_scan_unit_oversized` | `redacted_path_set(count)` | `reduce_scope` |
| `scan_capture_limit` | `repository_delta` | `security_scan_capture_limit` | `redacted_path_set(count)` | `reduce_scope` |
| `unstable_read` | `repository_delta` | `unstable_read` | `redacted_path_set(count)` | `retry_after_refresh` |
| `unrepresentable_path` | `repository_delta` | `unrepresentable_path` | `redacted_path_set(count)` | `manual_inspection` |
| `unsafe_file_kind` | `repository_delta` | `special_file` | `redacted_path_set(count)` | `manual_inspection` |

每个 redacted aggregate 生成一个
`stage=repository_delta/scope=redacted_path_set(count)/recovery` 固定映射的
`AnalysisBoundaryV1` 与 Boundary Evidence，并在 repository-delta completeness
universe 中以 aggregate `id` 覆盖；不得把多个 aggregate 合并后丢失 ID，也
不得保存其隐藏 path/OID/fingerprint。每个 `unknownStates` aggregate 生成
`stage=security_policy/scope=redacted_path_set(count)` Boundary：
`hard_deny_equality_unprovable→sensitive_path/manual_inspection`，
`scan_unit_limit_equality_unprovable→security_scan_unit_oversized/reduce_scope`，
`scan_capture_limit_equality_unprovable→security_scan_capture_limit/reduce_scope`，
`unstable_read→unstable_read/retry_after_refresh`，
`unreadable→unavailable_content/manual_inspection`，
`unrepresentable_path→unrepresentable_path/manual_inspection`，
`unsafe_file_kind→special_file/manual_inspection`。它强制 repository-delta
Completeness 降为 partial/unknown，但不生成 Repository Path Delta、Actual
Change、Hunk 或 source/kind summary。branch redaction 另生成
`stage=security_policy/scope=repository` Boundary，不计作 change unit；
`unsafe_git_ref` 的 recovery 固定为
`use_supported_repository_configuration`，其他 branch redaction code 固定为
`manual_inspection`，Analysis code 复用上表对应行。

三个 public locator identity 不得沿用现有对 absolute Git/common-root/worktree
path 做未加 key SHA 的 `opaqueId()`。强 writer 使用 installation-owner-only
32-byte CSPRNG identity key（逻辑 locator
`runtime-state/private/installation-identity-v1.key`，resolved absolute path
永不公开）分别计算
`HMAC-SHA256(key, ["repository-identity-v1",
{canonicalCommonGitDir:canonicalBase64urlBytes}])`、
`["worktree-identity-v1",{repositoryId,canonicalRoot:canonicalBase64urlBytes,
canonicalGitDir:canonicalBase64urlBytes}]` 与
`["root-identity-v1",{canonicalRoot:canonicalBase64urlBytes}]`，输出严格使用
`repo-hmac-/worktree-hmac-/root-hmac-` + 64 lowercase hex brand。所有 strong
Snapshot/Task/Artifact/Receipt 中的 repository/worktree/root identity 必须使用
这些 bytes 并 exact-equal；raw path 及其 raw SHA 不进入 public Store。该 key
使 linked worktree 共享稳定 repositoryId，同时 worktree/root 仍隔离。

installation key 的 logical locator 由唯一
`InstallationStateResolverIdV1` 提供：macOS 使用 User Domain Application
Support OS API，Linux 使用 `getpwuid_r(geteuid())` 的 trusted account home +
`.local/state/understand-code`，Windows 使用
`SHGetKnownFolderPath(FOLDERID_LocalAppData,current-user-token)`。P0 不读取或
继承 `~/$HOME/$XDG_STATE_HOME/%LOCALAPPDATA%`，OS API 失败即 fail closed，
不得回退 cwd/temp/workspace。app-specific state root 必须 absolute、
owner-safe、逐 component no-follow，且不能等于或位于 workspace/Git/Store
descendant；未知既有目录/文件禁止 adoption/覆盖。

active state 保存 resolver ID、state-root file identity 与
`installation-state-root-binding-v1` HMAC；每次启动重算，resolver 输出、
owner/identity 或 binding token 漂移均 fail closed。resolved locator/
canonical root bytes 永不进入 Artifact、日志或 error。卸载也只允许用户显式
选择后删除这一 exact state root；正常 recovery/cleanup 不得删除。

首次启用 strong identity 不能把 legacy path-SHA namespace 原地改名。流程固定为：

1. 在 installation lock 下初始化（仅全局从未初始化时）或验证 active key/state，
   再在 Repository lock 下进入下述 Store ownership/bootstrap 协议；首个
   `identity_bootstrap` quota Transition 只创建并计费 worktree equality key 与
   owner-only `IdentityNamespaceBindingIntentV1`，绝不发布 active binding；
   legacy artifact 保持只读；
2. 仅凭 validated Store ownership marker、committed bootstrap Transition、
   equality key 与 Binding Intent，在未公开的 staging namespace 为 HMAC
   repository/worktree identity 建立独立 Store manifest namespace，
   重新生成 strong Snapshot/Pulse 以及 Graph/Wiki/Evidence 等 repository-scoped
   dependency；不得把 legacy descriptor 只换 ID 后复用；
3. 只有新 namespace 的 full Bundle、safe dependency 与 fsync 全部通过，才先
   在 external intent durable 写入可重建的
   `StoreIdentityActivationPlanV1` 与 initial `temp_planned` write progress；
   后续 `identity_activation` quota Transition 才原子计费并发布
   `IdentityNamespaceBindingV1`，同时移除 Binding Intent 的 current
   control-state leaf。active binding 必须 pin 已存在的 full strong Manifest；
   activation plan 必须 exact-cover binding、Transition、quota nodes/root 与
   post Manifest generation。失败 rollback只处理 provider durable binding重验
   通过、atomic handle-addressed compare-delete可用且尚未越过
   Manifest-generation commit point的新对象；否则保留并计费，legacy canonical
   pointer/bytes不变；
4. activation后必须生成 retained terminal receipt；可选 quarantine ledger完整
   验证后，由第三个 `store_initialization_terminalize` Transition把 terminal
   head写入新的 append-only Store Manifest generation。只有
   `active binding → unique Manifest tip → terminal head → receipt/ledger`全链
   通过，新 Task才可写 strong namespace；旧 Task 仍绑定 legacy namespace、
   只能经 redacted Surface 读取且不能升级为 strong。两个 namespace 可并存，
   cross-identity descriptor/reference 一律 reject。

State/request equality 另使用一个 worktree-owner-only 32-byte CSPRNG key，固定存放在
`.understand-code/private/security-equality-v1.key`。两类 key 的目录/文件分别
0700/0600，并执行 no-follow、owner UID/SID、`nlink=1`、regular-file、exact
length 与原子 publish/fsync 校验。

installation key 使用 installation-global lock，固定同目录
`installation-identity-v1.init/installation-identity-v1.json` 作为 durable
marker/active state。只有 key、active state、init marker 三者都不存在的
**从未初始化**状态才允许 marker-first exclusive-create；active state 的
generation/nonce/key-check HMAC 与 key exact-equal 后才算初始化完成。crash
recovery 只可按 exact marker inode/nonce finish 或保留报错，不能 adoption/
删除来源不明的 key。active state 一旦存在，key 缺失、损坏或 check mismatch
在所有 repository 上永久 fail closed，绝不能因为“当前仓库没有 strong
object”而生成新全局 key。worktree equality key 只有在该 exact binding 下无
任何 strong Snapshot/Task/request-equality/detail commitment 时可
exclusive-create。初始化的 key bytes 只可在 `identity_planned` 之前生成一次，
并以 installation-key-derived AEAD sealed bytes写入 external plan；raw bytes
不落 intent。plan durable 后禁止 re-plan或重新随机生成，recovery必须解封同一
bytes并校验 check token；任一 planned output已存在但 identity/token不等都
fail closed。一旦存在对应 strong object，key缺失/错误同样 fail closed。
P0 不支持 rotate、export 或多 key fallback。

每个 activated worktree 的
`.understand-code/private/identity-binding-v1.json` 保存 strict
`IdentityNamespaceBindingV1` Envelope/content digest，并由 strong
Snapshot/Basis trusted reader cross-equal generation 与三个 HMAC identity；
intent 固定为
`.understand-code/private/identity-binding-v1.intent.json`，必须先 durable
保存 transaction nonce、installation active-state digest、legacy/strong
manifest plan 与 Engine `createdAt`。它先与 equality key 一起由
`identity_bootstrap` Transition 计费；新 strong manifest 提交并 fsync 后，
external intent 必须先 durable 写 `activation_planned` 与 exact reconstructable
write set，active Envelope 才由 `identity_activation` Transition以
descriptor-relative no-replace发布。Envelope/payload 的
repository/worktree/createdAt与 content digest
exact-equal，`activatedAt>=createdAt`，并 exact pin该 full strong Manifest；
activation commit同时从 current quota root移除 Binding Intent leaf；external
init intent随后先冻结完整
`StoreInitializationTerminalReceiptV1`并进入可恢复
`terminalization_allocations_planned`；两个 deterministic provider allocation
progress按 AA→SA/AS→SS单调持久化，只有 SS 才可进入
`terminalization_planned`。独立 immutable receipt与 handoff genesis都由
provider exact-handle no-replace发布；genesis保存 full plan/progress，后续
handoff record每条只追加一个 delta，最后 proof-only tip与 journal sealed
version在同一 provider final cut中被 retained `terminalized` exact pin。
terminalization Manifest head同时 pin receipt；全链成功前不开放 strong
Surface，成功后 external intent与 receipt均永久保留。active已存在时只能 exact
replay，不得覆盖。crash recovery按 provider current external init intent、
terminalization append-only handoff journal、
每个 write 的 provider staging/final binding progress、intent nonce、Manifest
pins与三条 initialization Transition proof finish/rollback；任一 provider
binding mismatch/final collision都 quarantine而不触碰，intent与 active binding
不一致时保留两者并 fail closed，legacy/new namespace都不自动切换。上述
installation/binding/control files均有各自冻结 cap，raw Host locator不能写入。

`KeyedStateTokenV1` 固定为
`HMAC-SHA256(key, canonical JSON([domainLiteral, strictFields]))` 的 64 位小写
hex，domain 至少区分 `repository-state/index/worktree/untracked/ignore`。
key 永不进入 Artifact、Receipt、日志或 Surface；token 可以公开用于本 worktree
内 equality/freshness，但不能当跨安装内容 digest。总 repository token 覆盖
**所有**原始 unit（包括 redacted unit）的 canonical identity，因此不需要也
禁止为 redacted unit 另存 raw SHA/path fingerprint。

token canonicalization 也是合同：

- `RawRepositoryPathBytesV1/CanonicalInternalBytesV1` 必须匹配
  `^base64url:[A-Za-z0-9_-]+$`，禁止 `=` padding；decoded bytes 非空且分别不
  超过 policy cap，重新 base64url 编码必须与输入 exact-equal。排序比较 decoded
  unsigned byte sequence，不比较编码字符串、不用 locale；
  `CanonicalByteStringV1` 使用同一规则但 regex 为
  `^base64url:[A-Za-z0-9_-]*$` 并允许空 bytes，只用于有独立 byte cap 的
  transient equality input；
- `CanonicalUnsignedDecimalV1` 必须匹配 `^(0|[1-9][0-9]*)$`，禁止 sign、
  leading zero、exponent/decimal；解析后必须在该 platform API 的 unsigned
  range 内。POSIX identity 只允许 `{platform,device,inode}`，Windows 只允许
  exact 8-hex volume serial + 32-hex file ID，不能混合或省略；
- Index units 按 `[decodedPathBytes,stage,mode,objectId]` 排序；同 path+stage
  duplicate 或同 tuple 不同值 reject。Worktree/Untracked 按
  `[decodedPathBytes,kind,mode-or-empty]` 排序，同一个 decoded path 只能出现
  一次；
- `CanonicalBranchBytesV1` 使用 canonical base64url、decoded 1..1024 bytes；
  detached 时 `InternalBranchState={status:"detached"}` 且禁止 bytes，symbolic
  HEAD（包括 unborn）必须用 `{status:"named",bytes}` 覆盖 raw branch bytes。
  public branch 即使 redacted，raw bytes 仍只进入 owner-keyed repository token；
- filesystem `regular` 必须有 mode/size/fileIdentity/mtime/ctime；
  `safe_scanned` 必须且只能携带 public-safe content digest，
  `secret_redacted_scanned` 必须且只能携带 worktree-keyed equality token，
  hard-deny/unit-limit/capture-limit/unstable/unreadable 不得携带任何 raw digest
  或 OID。`git_object` 只在 raw Index/object cross-check 证明该 filesystem side
  无需打开正文时携带 exact OID；`absent` 禁止 metadata 且只能
  `unavailable`。directory/symlink/gitlink/special/unreadable 的允许字段与
  contentState 使用 strict conditional matrix，symlink target 从不进入 token。
  表外组合 reject；
- ignore units 按 `[scope-order,decodedPathBytes]` 排序、tuple unique；
  `contentDigest` 当且仅当 status=`present`。Git config units 按
  `[scope-order,decoded section,decoded subsection-or-empty,decoded name,
  decoded normalizedValue]` 排序、exact duplicate reject；value 先通过
  secret/Host-path scanner，raw config digest 永不公开。pinned config parser
  把 section/name 转为 ASCII lowercase，把 quote/escape/continuation 解码为
  semantic bytes；subsection/value 保持原 bytes、不做 Unicode/路径
  normalization，再 canonical base64url。non-UTF8/control、同
  `[scope,section,subsection,name]` 重复 key 或 parser ambiguity 均
  `unsafe_git_configuration`；
- empty hooks token 必须重验 exact directory identity 且 `entries=[]`；
  repository/worktree config 与 hooks token 分别使用上表三个独立 HMAC domain。
  同一 equality key 不允许跨 domain 复用 preimage。

`InternalFilesystemStateUnitV1` 条件矩阵如下；“required/forbidden”适用于
mode、size、fileIdentity、mtime、ctime 全组，不能用 optional field 自由组合：

| kind | mode | size | identity + mtime/ctime | 唯一允许的 contentState |
|---|---|---|---|---|
| `absent` | forbidden | forbidden | forbidden | `unavailable` |
| `regular` | required `100644/100755` | required | required | `safe_scanned / secret_redacted_scanned / git_object / not_read_hard_deny / scan_unit_limit / scan_capture_limit / unstable / unreadable` |
| `directory` | required `040000` | forbidden | required | `unavailable` |
| `symlink` | required `120000` | required lstat length | required | `unavailable`；target 永不读取 |
| `gitlink` | required `160000` | forbidden | required | `unavailable` |
| `special` | forbidden | forbidden | required | `unavailable` |
| `unreadable` | forbidden | forbidden | forbidden | `unreadable` |

`safe_scanned/secret_redacted_scanned/git_object` 的条件字段仍按上文 exact
presence；任何其他字段、mode 或 state 组合 strict reject。

所有 redacted unit 的 raw canonical unit 只进入 incremental canonical-JSON
HMAC preimage，raw bytes 由 streaming base64url encoder 产生上表字段，不能
进入可持久化 debug buffer，也不先构造无界 JSON。Contracts 必须为 POSIX/Windows identity、
非 UTF-8 path、排序/duplicate、每个 conditional variant 和全部 HMAC domain
保存 golden vectors。

`SafeGitInvocationV1` 的 identity bootstrap 不调用 Git。唯一
`SafeGitBootstrapResolverV1` 从已验证 workspace root 开始，逐 component
no-follow 解析 `.git` directory 或只含单个 `gitdir: <path>` 的 strict
`.git` file。标准 linked worktree 的 gitdir 可以是 absolute，`commondir`
也可以含 bounded `..`；但每个 component 都必须 no-follow canonicalize，目标
必须是 owner-safe common Git control root 下的 `worktrees/<entry>`，并由
admin `gitdir` 文件与 worktree root `.git` file 双向 exact backpointer 证明。
canonical `commondir` 必须回到该已验证 common control root；任意外部 target、
无法证明关联、symlink/reparse、wrong owner/mode、循环或 open 后 race 都
fail closed。resolver 先得到 canonical root/git/common dir 并计算 HMAC
identities，之后才允许构造带 repository/worktree ID 的
`SafeGitInvocationV1`。`rev-parse` 不再承担 locator discovery，只能执行 union
中已绑定 repository 的 object-format/object 验证 query；bootstrap policy
digest 进入 SafeGit profile/read set，从而不存在“先有 ID 才能发现 ID”的循环。
验收必须使用真实 `git worktree add` 生成的 POSIX 与 Windows-form fixture，
不能只测合成相对 gitdir。

所有 Snapshot/Delta/Baseline/Git lease 子进程必须经唯一
`SafeGitAdapterV1.execute(SafeGitInvocationV1)`；生产代码直接调用通用
`executeGit(...process.env)`、shell、PATH lookup 或 caller argv 均由 lint/
architecture test 拒绝。adapter 在 doctor/bootstrap 时 pin 一个 absolute
realpath Git executable（regular file、不位于 worktree，binary digest 与
owner/mode/file identity 进入 binding token）。每次 invocation 必须重新
no-follow open 并通过 `fexecve`/平台等价 handle execution 启动；平台不支持
handle exec 时只接受 OS-signed 或 root/admin-owned、invoking user 不可写的
immutable binary，普通 user-writable binary 使 strong capability fail closed。
每次调用只传以下 fixed env：
`LC_ALL=C`、`LANG=C`、`GIT_CONFIG_NOSYSTEM=1`、
`GIT_CONFIG_SYSTEM=<platform-null>`、`GIT_CONFIG_GLOBAL=<platform-null>`、
`GIT_OPTIONAL_LOCKS=0`、`GIT_TERMINAL_PROMPT=0`、`GIT_PAGER=`。其他
固定项还包括 `GIT_NO_LAZY_FETCH=1`、`GIT_NO_REPLACE_OBJECTS=1`；其他
`GIT_*`（包括 alternate/object/quarantine vars）、`HOME/XDG_CONFIG_HOME`、
`SSH_*`、pager/editor/filter 环境一律不继承。

bootstrap 不只返回 path，而是返回 transient
`SafeGitBoundRepositoryV1` handles。Git/common/worktree dir、双向 backpointer、
local ODB、ref backend、repository/worktree config 与 empty hooks 的 owner-keyed
binding token 在每次 invocation 前后都必须重算；对应八类
`safe_git_control` read-set entry 必须 exact-cover。raw handles/path/file
identities不持久化。read-only object/index/ref discovery 优先使用
descriptor-relative direct reader；确需 Git 时通过 versioned OS sandbox：
network 全拒绝，child exec 只允许 pinned Git/loader，read 只允许 bound
Git/common dir/local ODB 和该命令明确需要的 handle，write 默认全拒绝；
`update-ref` 只允许 marker 预声明的 exact product ref/ref-lock，product reflog
路径始终 write-deny。这样 config/backpointer/alternate 在 precheck 后 race
出现也只能得到 sandbox denial，不能先执行代码或读取 Root 外对象再 post-check。
八类 `safe_git_control` entry 分别 exact-equal execution profile 的
executable/bootstrap/linked-worktree/ODB/ref-backend/repository-config/
worktree-config/hooks token；缺失、重复、映射错位或 pre/post invocation token
drift 一律 `repository_read_set_conflict`。

argv 只能由 `SafeGitCommandRequestV1` discriminated union 生成。`version`
是 filesystem bootstrap identities 已建立后的唯一 probe，argv exact 为
`<pinned-binary> --version`，使用同一 fixed env、128-byte stdout cap 与 strict
Git version grammar，不读 config/repository；不得由 doctor 或通用 spawn 绕过
adapter。其余命令总是显式以 `--no-pager` 开头，绑定 validated
`--git-dir=<git-dir>`、
`--work-tree=<root>` 与固定
`-c core.hooksPath=<validated-empty-dir> -c core.fsmonitor=false
-c core.untrackedCache=false -c core.excludesFile=<platform-null>
-c core.attributesFile=<platform-null> -c diff.external=
-c diff.trustExitCode=false`。`diff` 只允许 commit→commit 或
commit→Index 的 metadata view，固定追加
`--raw --no-abbrev --no-ext-diff --no-textconv --no-renames -z --`；明确禁止
`-p/--patch`、stat/word-diff、submodule log 与任何正文输出，stdout 只解析
mode/OID/status/raw path。正文必须在 path 扫描通过后另以 exact `cat-file`
stream 读取。`hash-object` 只允许
`--no-filters --stdin` 且 `write=false`；`ls-files` 只读 cached stage/unmerged
并使用固定 stage/NUL flags；
`update-ref` 只允许 3.1 的 `--no-deref` create/delete CAS。union 外 flag、
pathspec/stdin-paths、revision string、`--ext-diff/--textconv`、option-like
OID/ref 与缺失 `--` 全部在 spawn 前 reject。

stdin 默认关闭；仅 `hash-object` 接收 adapter 从已验证同一 stream 提供的
bounded stdin，blob 16 MiB、tree 64 MiB。stdout/stderr 之外还必须执行上表
per-command parsed-record 与 wall deadline；实际 deadline 取 command cap 与
Operation remaining budget 较小值。exec 前还必须由 OS 对整个 process
containment 强制执行 policy 中的 RSS、address-space、CPU time、PID 与 open-FD
cap：Unix 使用 rlimit + cgroup/Mach 平台等价 containment，Windows 使用 Job
Object；cap 必须覆盖 Git 及所有 loader/允许的 descendant，不能只靠父进程轮询。
任一平台无法可靠安装或回读这些限制时，strong SafeGit capability fail closed，
不得以 wall/output cap 代替。hostile pack/object/commit-graph 即使在 deadline
前触发资源膨胀，也只能让隔离进程被 OS 拒绝/终止，不能 OOM Agent/Host。
timeout/resource-cap/cancel 先关闭 pipe、终止整个
process group（Windows Job Object），250 ms 后 hard kill。`update-ref` 固定
`-c core.filesRefLockTimeout=0 -c core.packedRefsTimeout=0`；被终止后结果视为
unknown，保留 durable marker并重新探测 exact ref/OID/reflog/ref-lock，只能走
既有 CAS recovery，永不删除任何 reflog 或来源不明 lock。

adapter 还要用 owner/no-follow parser 读取 common/worktree Git config；任何
`include/includeIf`、Root/common Git dir 外的 attributes/excludes、fsmonitor、
hooks、external diff/textconv、filter process/clean/smudge 或 executable-valued
配置都返回 `unsafe_git_configuration` 并使 strong capture 零写。只允许 Root
内 `.gitignore/.gitattributes` 与 common Git dir 内 `info/exclude`，其 exact
bytes 经同一 scanner/policy digest 纳入 ignore/attributes token；不得读取现有
global `core.excludesFile`。stdout 有 per-command byte cap 且按 NUL/raw OID
grammar解析；超 cap、truncated record、missing/final extra NUL、mode/OID
length 或 unknown status 均按 frozen error map fail closed，不能 best-effort
丢 record。stderr 也有固定 cap，raw stderr/command/cwd 永不进入
Artifact/diagnostic，只映射固定 allowlist error code。argv mapper、output
grammar、error map 与 caps 全部进入 invocation policy digest。静态 policy、
pinned Git binary/version、扫描通过的
executable/bootstrap/linked-worktree/ODB/ref-backend binding token、
repository/worktree config HMAC token、empty-hooks directory token、sandbox
policy、OS resource caps 与 null device 先组成 strict
`SafeGitExecutionProfileV1`，其
`safe-git-execution-v1` digest 必须 exact-equal Snapshot、
Pulse、Task baseline、Basis/read-set 的 `safeGitExecutionDigest`；分析期间
任一 binary/config/policy/token 变化都触发 conflict。

在任何 object/ref 调用前，adapter 还必须 no-follow 检查并拒绝
`objects/info/alternates`、grafts、replace refs、promisor remote、
partial-clone/alternate object configuration；P0 只接受本地完整 ODB，缺失
object 返回固定 `missing_local_git_object`/partial 或 unpinned，永不 lazy fetch
或访问 network。Git lease 还只支持 `extensions.refStorage=files`；reftable 或
未知 ref backend 只能产生 partial/unpinned，不调用 `update-ref`。exact product
`<ref>.lock` 在 create 前已存在、create 中 race 出现或 create 后无法证明
ownership 时一律保留用户 lock/marker 并阻断 capability，不能 glob、删除或
覆盖任何 lock。

strong discovery 明确禁止 `git status`、`git diff` 的
worktree-to-index view、`ls-files -m/-o` 或任何可能在返回 path 前打开
worktree content 的 Git 命令。tracked/index universe 由 raw index parser +
`ls-files --stage -z`/raw tree OID 交叉验证；worktree/untracked 由
Store-bound root 的 no-follow directory walk + lstat 枚举，先对 raw path 执行
hard-deny，再由产品 scanner 的同一 handle 读取 safe regular file。ignore
规则由扫描通过的 Root 内 `.gitignore` 与 common Git dir `info/exclude` 在产品
内 matcher 计算，不调用 Git/global exclude/fsmonitor。架构测试必须记录全部
spawn argv，并证明 path discovery 阶段不存在会读取 worktree 正文的 Git
subcommand。Git control tree 永不进入 repository unit universe。
`.understand-code/**` 只有在 raw HEAD tree/Index 已证明不存在 tracked entry，
且 `.understand-code/.store-ownership-v1.json` 通过 strict
`StoreOwnershipMarkerV1`、owner/mode/nlink/file identity、content digest 与
`store-ownership-proof-v1` HMAC 证明为本 installation/repository/worktree/root
绑定的 untracked product control tree 时才排除。任何 tracked collision、
pre-existing non-product directory/file、伪造/foreign marker 或
symlink/reparse 都以
`reserved_control_tree_collision` 零写失败，且不得创建、覆盖、移动或删除该
对象。exclusion ruleset digest 已进入 scan policy，任何正常 Store transaction
不得改变 `repositoryStateToken`。

首次 Store 初始化必须在 first-write scan 证明 raw HEAD/Index/filesystem 中
`.understand-code` 整棵树 absent 后，先在 installation-state provider 的固定
`installation_state_store_initialization_intent_v1` locator，以 no-replace
提交 revision 0 的 strict
`StoreOwnershipInitializationIntentEnvelopeV1`，其 payload为
`mode=new_store/phase=planned` intent；该 payload已保存 deterministic Store-root
operation nonce、provider staging locator、
`providerAllocationState="absent"`与 workspace-root publication context。此时
worktree security-equality key
尚不存在，禁止提前在 Store 写 key或伪造普通 Repository read set；payload
必须保存由 installation-global key 对 exact
`InternalStoreInitializationPreflightV1` 计算的
`store-initialization-preflight-token-v1`。随后在 Repository lock 内重新枚举
HEAD/Index、workspace root identity/change-time 与 reserved path absence并重算
token。preflight还必须按固定 policy、4代 ledger、每项最大 attempt/write-set
计算 `StoreInitializationTerminalStateBudgetV1`；external intent、最终 receipt、
单条 terminalization handoff record或完整 handoff journal任一 worst-case超过
各自64 MiB cap，或 record count超过4096时，在 Store root或任何 provider
staging allocation前零写失败，不能等 active binding发布后再发现无法
terminalize。record worst case取 genesis full-plan/progress、successor
delta与 final proof三类最大值；journal worst case必须按 actual plan的最大合法
attempt/state-transition序列求和，而不是只按 genesis或单条 record估算。
“actual plan”必须来自 **revision 0之前的 zero-side-effect full dry-run**：
在不创建 Store root、provider staging、key、lease或任何 strong object的前提
下，完成 future strong Bundle/identity/activation/terminalization canonical
payload生成，冻结 ID、nonce、Engine timestamp、path/role/count与真实 payload
length，并构造 `StoreInitializationTerminalSizingSkeletonV1`。只有直到物理对象
创建才可知道的 durable binding/file-identity使用
`max_width_wire_placeholders_v1`：provider ID/policy为已选 exact值，所有 regex/
uint/owner/identity字段使用 Schema允许的最大 canonical宽度，digest/HMAC/nonce/
timestamp使用固定 wire宽度。不得把每 write的16 MiB cap简单相乘后冒充 actual
shape，也不得先写 bootstrap再补算未来 Bundle。skeleton必须保存 immutable
dry-run input pins，并逐 phase持久化 phase nonce/time/input digest、每个
directory/write的 ordinal/path/parent projection、role/semantic ID、payload/
sealed length与 attempt cap；`futureBundleShapeDigest`不能代替这些可重建
fields。skeleton全文与 digest进入
revision-0 preflight/budget；后续每个 actual plan在其首次 provider allocation前
必须证明 phase/path/role/count与 skeleton shape exact-equal且 canonical bytes
不超过对应 upper bound。repository/policy/Bundle shape drift或任一实际值超界
都在该 phase新副作用前 conflict/fail closed，绝不能在 active binding发布后才
发现 receipt无法生成。
预算计算不做自引用 fixed point：先把四个 `worstCase*LogicalBytes`字段替换为
各自 cap值（canonical JSON中均为固定8位十进制），并把
`worstCaseHandoffRecordCount`替换为4096，再分别展开 actual plan在
Schema允许的最大 attempt、4代 history、terminal proof与所有 phase variant，
测量 external intent、receipt、单条 handoff record最大值、完整 journal总
bytes与 record count；四个 byte测量值及
`worstCaseHandoffRecordCount`写回预算字段。因为任一合法值不大于 cap且十进制
位数不会更长，写回后的真实 bytes必须小于等于所记录上界；writer还必须对最终
canonical bytes与 journal序列重新测量并断言
`actual <= recordedWorstCase <= cap`、
`actualRecordCount <= worstCaseHandoffRecordCount <= 4096`。禁止迭代到
收敛、按当前 happy path估算或在不同 phase重算预算。

文中所有“external intent durable更新/进入 phase/收缩”都不是普通文件
in-place write或 temp rename-overwrite，而是 provider的原子 monotonic
compare-replace：revision 0要求 locator absent；revision `n+1`必须 pin current
revision `n`的 envelope content digest与 current-valid provider version token，
payload identity/transaction不变。每个 revision还必须先验证
`Envelope.repositoryId/worktreeId/transactionNonce/createdAt`分别
exact-equal payload同名字段，payload content digest由完整 strict payload重算；
outer locator identity不能与另一个 repository/worktree payload混配。计算顺序为
payload digest → deterministic
mutation ID → envelope content digest → provider version token；provider只在
expected current revision/token仍 exact且 replacement canonical bytes已 durable
时原子切换 current version，并让同一 mutation在 broker/process/OS restart后
查询到唯一 `committed`或 `not_committed`结果，禁止 unknown outcome。provider
内部 current-version journal属于受 OS isolation保护的信任根，rollback、revision
gap、同 revision不同 payload、旧 token replay一律 fail closed。调用方确认新
current envelope之前不得执行由该 phase授权的 Store副作用；crash后只从 provider
读取并重验 current envelope，不能扫描普通 filesystem挑选版本。所有 source
`InitializationIntentContentDigest`字段均指 exact payload digest，Envelope
digest/token另行验证。provider缺少该 compare-replace能力时 strong Store在
revision 0之前不可用。

任何首次写之前必须选择 strict registry member 的 durable-object provider。
选择动作由 `durable-object-provider-client`内独立 Trust Verifier执行：先从签名
发行物 bootstrap验证 immutable Installation Identity，再读取 Acceptance
current/high-water，闭合 Root Metadata、Registry Manifest、Catalog/Evidence与
active-writer selector，最后才按已验证 runtime attestation建立 mutual-auth IPC。
Provider Runtime不能提供这些对象的候选 path/bytes，不能自报 active key、
Evidence或 selector，也不能触发 Acceptance更新；installer只可在离线签名验证
成功后调用 atomic compare-append，Artifact Store只消费 verified selection。
其稳定 `StoreDurableObjectProviderPolicyV1`必须由 installation provider
registry当前的 `StoreDurableObjectProviderRuntimeAttestationV1`实现；registry
entry同时验证 mutually authenticated IPC、当前 signed binary及真实文件系统
conformance evidence，
并把 staging/final storage置于 workspace writer不能进入的 OS security
boundary：独立 OS principal或经证明的 kernel-isolated storage domain。仅
0700、随机文件名、普通同 UID broker、advisory lock或进程内抽象都不是安全
边界。

registry 的信任根不是 Store、workspace或可写 installation-state 文件本身，而是
已验证签名发行物内 fixed resource
`provider/bootstrap-trust-bundle-v1.json`。Trust Verifier只能从 verified package
root按该 literal解析 strict canonical
`ProviderBootstrapTrustBundleEnvelopeV1`，不能接受 caller/provider/runtime给出的
path、mirror或 bytes；Pin的 `locatorProfile/contentDigest`、locatorProfile到 fixed
literal的唯一映射、Envelope
recordType/content digest及 payload domain必须逐项闭合。byte-identical mirror只有
在 verified package resolver明确映射同一 signed package identity时才可接受。

bundle是 installation唯一初始 trust anchor，必须同时包含：
`ed25519-rfc8032-cofactorless-prime-subgroup-v1`、immutable adversarial manifest
digest、bootstrap registry-root、完整 bootstrap Root Metadata Envelope、按
recovery key ID排序且 material全异的三把 offline recovery key、固定 threshold=2
及完整 `ProviderTrustHistoryPolicyV1`。bootstrap metadata必须
`rootGeneration=1/activation=bootstrap/predecessor=genesis/recoverySignatures=[]`，
outer root key ID与 payload active root exact-equal；root metadata self-signature
也必须先过 strict host profile。四把 trust public key逐一重算 canonical
raw-key digest与 domain-separated key ID，做 strict point admission并全域
material unique；bundle content digest覆盖完整 payload。

`ProviderSignedDistributionRootBindingV1.bootstrapTrustBundle`与
`InstallationIdentityStateV1.bootstrapTrustBundle`必须 byte-identical pin同一
bundle。初始化事务还要把 original verified
`ProviderSignedDistributionRootBindingV1`、bundle完整 canonical Envelope及其
adversarial manifest完整 canonical Envelope复制进 provider-isolated immutable
Identity state；三份 retained bytes分别与 Pin/content digest/profile exact闭合，
不再重复保存可漂移的 root/recovery/threshold/policy字段。该复制只在 package
signature、fixed-resource resolver、strict Schema/digest与 host KAT全部通过后发生，
并与 Identity publication同一 crash-safe事务提交。

普通 current Identity的 strong read必须同时验证 retained Envelope与当前 verified
package的 bundle Pin相等；普通 root、registry、catalog、binary或 signing-key升级
不得换 bundle。recovery-key compromise后的新发行物必然携带新 bundle：旧
`recovery_only` source Identity不要求与新 package bundle相等，而是只从自己的
immutable retained origin binding/bundle/manifest重建历史 verifier，并要求当前
host按 source bundle所 pin同一 strict profile通过该 retained manifest；
cross-installation Plan必须同时 exact pin source与destination两套 bundle digest。
任一历史 Envelope/manifest缺失或不等都让 source保持
`recovery_only/provider_unavailable`且零写，绝不能采用新 bundle替换；它们在旧
Identity全部 Store/live-reference清零、sealed tombstone和 deletion proof完成前
不得 GC。已有 Store ownership marker继续 pin原 identity generation/content
digest。root private key与 recovery private key离线保管，不存在于 workspace进程或
durable-object provider；provider的 binding derivation secret与四类 signing private
key只存在于上文 OS-isolated provider。host strict profile/KAT未关闭时，甚至
bootstrap self-signature都不得尝试以 runtime默认 API“宽松验证”后继续。

公开失败 reason必须按
`PROVIDER_CAPABILITY_FAILURE_REASON_PRECEDENCE_V1`选唯一结果：package/bundle/
manifest/KAT或 current/retained trust closure任一 malformed、missing、mismatch先
报 `attestation_invalid`；闭包有效且本次操作所需的 exact signer/provider/binding
存在已验证的适用 revocation才报 `revoked`，历史闭包中其它已淘汰 key的 revocation
不产生全局 revoked；闭包有效且 Acceptance/Identity明确为
`migration_only/recovery_only`、policy/binding换代或容量耗尽才报
`migration_required`；再依次是合法但未 terminalized的初始化、
unsupported target和残余 service/IPC不可用。valid old recovery-only Identity面对
different current Bundle的普通 strong调用因此是 `migration_required`，专用
migration source read仍按 retained old trust；若 retained object损坏则升级为
`attestation_invalid`，绝不能借第3项采用 current Bundle。结构合法的 partial init是
`initialization_not_terminalized`，结构损坏仍是 `attestation_invalid`。

可升级游标只存在于独立的 append-only
`ProviderAcceptanceStateEnvelopeV1`，但 generation publication与 current
选择不是两个可分离的文件动作。installation-state provider实现
`ProviderAcceptanceCompareAppendRequestV1`：在同一 OS-isolated 原子提交中
验证 expected high-water version token与完整 generation-set digest/count，
no-replace加入 candidate generation，更新 authenticated complete enumeration，
再更新 `ProviderAcceptanceHighWaterEnvelopeV1`，并以同一事务写入按 operation
nonce固定定位的 immutable
`ProviderAcceptanceCompareAppendReceiptEnvelopeV1`后返回新 current token。
generation已发布但 high-water未前进、或 high-water前进但 enumeration/generation
或 receipt未 durable 的状态均不可观察；semantic not-committed也必须先 durable
receipt再响应，但不得发布 generation。provider不具备该事务时 strong Store
unsupported。同 operation nonce+byte-identical canonical request的
response-lost重试必须返回首次 receipt原始 bytes，不重算 `resolvedAt`；同 nonce
不同 request digest固定
`operation_nonce_request_mismatch`并返回 existing receipt，不能生成第二 receipt。
并发 loser只可留下自己的 bounded receipt，不得留下可枚举 generation sibling。
receipt outer/payload identity/nonce/resolvedAt exact-equal，request digest必须按
`provider-acceptance-compare-append-request-v1`覆盖完整 strict request重算，
owner-HMAC claims覆盖原始 compact outcome；替换 later
high-water、删 observed integrity evidence或只改 Envelope time均拒绝。

`acceptanceOrdinal`从1连续递增并 exact pin predecessor。trusted reader只从固定
high-water locator读取 current，再验证 provider返回的 authenticated complete
enumeration：entries长度、generationCount、highWaterRevision与 current ordinal
全部相等，ordinal恰为 `1..N`，genesis唯一，每项 exact pin上一项，current pin
等于第 N 项；每项 `commitOperationNonce`必须从 fixed receipt locator读回
同 identity、同 candidate/predecessor的 committed receipt，且 receipt中的
`committedHighWater/currentAcceptance`等于该 entry。`generationSetDigest`按完整
排序 entries重算。receipt只保存本次 high-water+appended entry，不嵌完整累计
enumeration，避免 O(n²) history；完整 enumeration由 immutable generations、
连续 predecessor、commit nonce与 retained receipts重建。reader随后按 fixed
generation locator反向/顺序重放全部 Envelope，验证 outer
generation/installation identity/acceptedAt exact-equal payload、owner-HMAC
`acceptanceToken`以及三个 accepted generation floor等于全历史单调最大值。
missing/extra history、ordinal gap、同 ordinal异 bytes、cached pointer误导、
token/enumeration/high-water不等、root/Registry/Catalog floor下降全部 fail
closed。正常 upgrade只 compare-append新 generation；downgrade不得降低任一
ordinal/generation/floor。operation-nonce ledger与全部 committed/semantic
not-committed receipt append-only。新 nonce必须在首个 generation/receipt
副作用前按 `ProviderTrustHistoryPolicyV1` 对 prospective canonical receipt做
single/count/total-byte admission；normal update不得消费最后8条 receipt与对应
emergency bytes reserve。任一 hard cap满时必须在接受请求前返回
`provider_unavailable`，不固化 semantic outcome；existing nonce replay始终
绕过新 admission并返回原 bytes。identity未有 sealed
cross-installation tombstone与零引用证明前不得删除 generation、receipt或 owner
HMAC验证材料。

每个 acceptance tip携带 strict configuration。`strong_ready.core`必须 pin active
Root Metadata、唯一 Provider Registry Manifest、Support Catalog及
`ProviderActiveWriterSelectorV1`；每个完整七字段 target profile恰好选择一个
同时命中 enabled Registry member、Catalog strong candidate、Evidence、runtime
attestation与 binding generation的 writer，零个或多个匹配都零写。runtime无权
自报或自选该 selector。

semantic policy/binding secret/provider decommission等切换必须进入
`migration_only`。进入前 Registry direct successor以 `routing.state=migration`
同时列出 source/destination enabled member，Catalog同一 target group同时列出
old/new candidate，immutable migration plan已验证；随后 Acceptance compare-append
才关闭 public strong create/update/check/verify/refresh/rebase。唯一可写者是独立
授权的 migration executor，每个请求绑定 current Acceptance、migration ID、
source/destination selection与 authenticated progress journal。
`ProviderMigrationWriterSelectorPinV1.authorization`不是自由字符串：current分支的
`selectionOrdinal/selection/selectedWriter`必须 byte-identical selector对应项，且
current Acceptance必须等于 endpoint `prePlanAcceptance`；historical source分支
必须从 authenticated complete Acceptance history读回 exact historical
`strong_ready` generation与 selector membership，并由 current high-water证明仍被
保留，只允许 source read/revalidate；destination分支必须 exact命中 endpoint所 pin
Registry的 enabled member与 Catalog同 target的 strong candidate，并证明当前 selector
没有选择它，只允许 destination publish。三分支都只能在 pin同一 Plan/current
progress的 migration executor内使用，不能放大为 public writer或任意 provider I/O。

`ProviderMigrationPlanV1`是 strict mode union。same-identity要求双方
Installation Identity exact-equal、但 provider/policy/binding generation至少一项
不同；cross-installation rebootstrap要求双方 Identity不同、source
`recovery_only`、journal authority等于新 destination Identity，并 pin新发行物
bundle与 source retirement policy。两种 mode都必须 pin严格早于 Plan的双方
Identity、Acceptance high-water/current token、Root、Registry、Catalog、selector
与 selected writer，以及 source/destination初始 Store cut。Plan绝不反向 pin
后续 `migration_only` Acceptance。quota-aware构造的唯一无环顺序为：

`pre-plan trust/core/budgets → provider-migration-budgets-v1 digest →
authenticated zero-side-effect complete source read cut →
provider-migration-history-quota-source-dry-run-cut-v1 digest →
ProviderMigrationHistoryQuotaSizingV1/sizing digest →
migrationHistoryQuotaAdmission与 provider-migration-history-quota-admission-v1
digest（排除 migrationId、reservation ID/descriptors；该完整 admission digest
就是所有相关对象唯一复用的 `admissionVectorDigest`，不得按单个 charge另算）→
provider-migration-id-v1
（纳入完整 sizing+admission，排除 reservation descriptors）→ reservationId = ID(
["provider-migration-history-quota-reservation-id-v1",
{migrationId,role,installationIdentity,admissionVectorDigest}]) →
deterministic reservation descriptors → 完整 Plan payload/content digest →
单向绑定该 Plan digest的 reservation records/tokens → quota transaction(s) →
migration-only Acceptance → progress journal`。

完整 Plan content digest覆盖 reservation descriptors；任何实现把 Plan digest放回
reservation ID/descriptor/migration ID preimage、把 reservation descriptor纳入
migration ID，或把
`migrationHistoryQuotaSizing/migrationHistoryQuotaAdmission`从 migration ID删掉都会
形成另一 identity，必须拒绝。reservation record可在 Plan digest生成后以
`candidatePlanContentDigest`单向绑定 Plan；Plan只含 descriptor且不反向 pin
reservation content digest/token，因此无环。
每个 descriptor/record/request projection加载完整 admission后必须重算同一
`admissionVectorDigest`，再由 `role + installationIdentity`唯一选择对应 charge；
digest substitution、per-charge digest、role/charge或 cross source/destination
vector交换均在任何 reservation写入前拒绝。
same mode的 source/destination Installation Identity、repositoryId与worktreeId必须
逐字节相等，translation由同一 journal-authority identity HMAC认证。cross mode必须
保存两套独立 source/destination repository/worktree HMAC identity；两个 identity
provider在同一组 online opened canonical common-git-dir/root上分别重算自己的 ID，
再对同一 translation digest各自签发 source/destination token，raw path不落盘。
cross Plan顶层 `sourceRecoveryOnlyAcceptance`、translation中的同名 pin与
`sourceTrust.prePlanAcceptance`必须 byte-identical且 configuration确为
`recovery_only`；translation destination Acceptance必须 byte-identical
`destinationTrust.prePlanAcceptance`。任一单 token、旧 identity token、ID相等、
Store cut中的 repository/worktree ID与对应 namespace不等都拒绝。
Plan在首个 migration-only Acceptance与任何 object allocation前按 source complete
Store read做 zero-side-effect budget dry-run，并按 Identity级
`ProviderMigrationHistoryQuotaPolicyV1`预留 migration slot、retained-history
logical/provider-allocated bytes、四类 record count/bytes与 terminal control escrow；
root/object/reference/rewrite
mapping/SCC/semantic proof/record/receipt count、logical object bytes，以及
root/object/reference/universe/rewrite plan/rewritten-reference set/semantic proof/
receipt/progress canonical bytes与 migration canonical total必须逐项不超过
`migrationBudgets`；所有 per-object source-reference subset bytes之和与 canonical
root rewrite proof set bytes也进入同一 total，不能因嵌在 Plan/zero-live closure中而
漏计。`maxRewriteObjects >= objectCount`、
`maxRewriteReferenceMappings >= referenceCount`、`maxRewriteSccs >= sccCount`，
各 component cap不得大于 total cap，`maxProgressRecords >= 2 * maxLiveObjects + 7`。
`maxRetainedMigrationHistoryLogicalBytesTotal <=
maxCanonicalMigrationBytesTotal <= 4_294_967_296`，且
`maxRetainedMigrationHistoryProviderAllocatedBytesTotal <= 8_589_934_592`。
retained logical budget exact覆盖 journal-authority fixed migration namespace中最终
保留的 Plan、source/destination Universe、cross Rewrite Plan、Semantic Proof、
Object Receipt、Progress Record与 operation receipt、sealed/current Progress Head、
Zero-live Proof及 Tombstone；Store objects、Private Store quota objects、Store Manifest
receipt ledger与 provider atomic-publish receipt不重复计入 retained history，但仍进入
reference closure。reservation的 object receipt、semantic/root/zero proof、progress
record与 progress receipt count/bytes必须由同一 dry-run caps逐类推导，不能把它们只
压进总 byte reservation而逃逸 category hard cap。cross source anchor固定
`migrationSlotCount=1`且全部 history/category count/bytes为0；cross destination charge
与 same journal charge都 exact-equal Plan完整 reservation向量。
typed source cut必须满足：

- cut/sizing/Plan的 mode一致；
- cut source Identity、trust closure、Store Manifest分别 exact-equal Plan
  `sourceTrust.installationIdentity/trustClosureContentDigest/
  initialSourceStoreManifest`；
- cut live-reference schema digest exact-equal Plan同名字段；
- cut/sizing的 migration budgets digest都 exact-equal按完整 Plan budgets重算值；
- cut `derivedJournalChargeAmounts`、sizing `journalChargeAmounts` byte-identical，
  admission `sizingDigest`又 exact-equal完整 sizing digest。

cut的 retained-artifact upper bounds不是稀疏列表，而是按 artifact kind UTF-8
升序固定 exact-cover全部11种 `ProviderMigrationHistoryArtifactKindV1` 的 tuple；
每种 kind恰有一项，不适用的 kind也必须显式写
`artifactCount=0/canonicalEnvelopeBytesUpperBoundTotal=0/
providerAllocatedBytesUpperBoundTotal=0`，禁止省略零项或增加第二项。count、
canonical/provider-allocated upper bound全部进入 cut digest；`migration_plan`使用冻结
static Envelope upper bound/`maxSingleRecordBytes`计费，禁止依赖尚未形成的实际 Plan
bytes求 fixed point。root/object/reference complete-set claims、source Manifest与
freeze token任一不等都必须由 source provider authenticated read-only revalidation
发现；inline cut不是脱离 source provider验证即可自证的 producer声明。
`ProviderMigrationHistoryQuotaSizingV1.journalChargeAmounts`的唯一公式为：

- `reservedHistoryLogicalBytes`等于 dry-run按
  `provider-migration-history-artifact-set-v1`列出的每个 retained Envelope canonical
  upper-bound bytes之和，且 exact-equal Plan
  `maxRetainedMigrationHistoryLogicalBytesTotal`；
- `reservedHistoryProviderAllocatedBytes`等于 provider对同一 ordered artifact set返回的
  allocation upper bounds之和，且 exact-equal Plan allocated total；
- object receipt count/bytes分别 exact-equal `maxLiveObjects`与
  `maxCanonicalReceiptBytesTotal`；
- semantic/root/zero count exact-equal
  `maxRewriteObjects + maxRootEntries + 2`，bytes exact-equal
  `maxCanonicalRewritePlanBytes +
  maxCanonicalSemanticEquivalenceProofBytesTotal +
  maxCanonicalRootRewriteProofSetBytes + maxCanonicalZeroLiveProofBytes`；
- progress record与 progress operation receipt的 count/bytes分别 exact-equal
  `maxProgressRecords/maxCanonicalProgressRecordSetBytes`及
  `maxProgressOperationReceipts/
  maxCanonicalProgressOperationReceiptBytesTotal`。

任一 sizing/migration-budget/source-cut digest不等、inline cut与 resolved source
Manifest/freeze token/trust不等、字段少报/多报1或跨 category交换均在 reservation前
零写拒绝；admission charge不得由 producer自由填写。
canonical byte count
按唯一冻结 `rfc8785-jcs-safe-integer-v1` UTF-8 no-BOM/no-newline bytes计算，读取时先以 Envelope/file byte length和
streaming cap限流再 parse；任一超过即零写拒绝。existing nonce replay与 trusted
historical read不受新记录容量拒绝影响。

Identity-level hard cap固定为64个 charged migration、8 GiB retained logical、16 GiB
provider allocated；active reservation最多4个、同时 reserved logical/allocated最多
8/16 GiB，单 migration最多4/8 GiB。normal admission必须保留最后1个 migration
slot与最后4/8 GiB，仅
`binding_derivation_secret_compromise`、`post_root_compromise_rebind`和
`recovery_key_compromise_rebootstrap`可使用 emergency reserve，hard cap永不可突破。
对每个 prospective operation还必须从 account set重算四类累计 count/bytes，并满足
policy hard cap。terminal control escrow按
`futureTerminalTransitions = 3 * reservedAccountCount + retainedAccountCount`、
`eventEscrowBytes = futureTerminalTransitions * 262_144`、
`receiptEscrowBytes = futureTerminalTransitions * 1_048_576`重算；新 nonce只有在
actual event/receipt count+bytes加 escrow仍分别不超过4,096、64 MiB、4,096、256 MiB
时才 admission。general receipt容量耗尽不得阻断既有 reservation的 commit/release；
existing nonce replay绕过新 admission并返回 immutable receipt。任何账本 hard cap耗尽
都零 migration副作用并进入新 Installation Identity rebootstrap，不能借用 Private
Store quota、删除 audit record或拆小 Plan绕过。
reservation record本身还受每 Identity 4,096条/64 MiB累计与单件1 MiB hard cap，
count/bytes进入 high-water；cancellation fence不另写独立对象，只作为 cancel event与
compact receipt的 strict payload并已由两类 ledger cap计费。
reservation、reserved event、reserved account与 compare-reserve request都必须按同一
判别联合关闭 role/charge/publication/plan-state：
`same_identity_journal ↔ nonzero journal charge ↔
publish_same_identity_plan_atomically/published_atomically ↔ published`、
`cross_destination_journal ↔ nonzero journal charge ↔
cross_destination_intent ↔ cross_destination_intent_pending_source`，随后只允许
`compare_activate ↔ cross_destination_activated ↔ published`、
`cross_source_anchor ↔ typed zero charge ↔ cross_source_provisional ↔
cross_source_provisional`。三个 compare-reserve branch都必须携带完整 candidate
Plan；Plan Envelope本身是 mode↔payload相关的判别联合，same reserve只能携带
`same_installation_identity` Envelope，cross destination/source reserve与
`compare_activate`只能携带 `cross_installation_rebootstrap` Envelope，且 payload
内 sizing/source-cut/admission/reservation mode必须逐层相同。生成的 JSON Schema
必须把两个 Plan Envelope与三个 reserve selector展开为原子 `oneOf`，不能以宽泛
`payload: ProviderMigrationPlanV1`或 `allOf`恢复笛卡尔积。reservation record/token与
durable projection都绑定其 content digest；不能只给 reservation descriptor、raw
sizing digest或后续 activate时才补 Plan。后续
`commit_retained_history/release_retained_history`只允许 same或destination role，
`commit_cross_source_anchor/release_provisional_source/
release_cross_source_anchor`只允许 source role，intent cancel只允许 destination
role。source保存的 destination commit/cancel/release receipt pin必须分别是对应
destination role、operation、kind且 `outcome=committed`；任何跨支组合在 Schema
阶段拒绝，不能等运行时修正。commit pin额外携带
`migrationId/reservationId/migrationPlanContentDigest`；intent cancellation pin额外
携带 `migrationId/reservationId/candidatePlanContentDigest`；retained-history
release pin额外携带
`migrationId/reservationId/migrationPlanContentDigest`。这些 binding字段不是
producer assertion：resolver必须从目标 ledger加载 full receipt及其
`requestDurableProjection`重算，pin的 destination reservation ID、Plan digest与
receipt ledger generation都必须和 loaded projection及目标 reservation/account逐字段
exact-equal。source event/request common中的 `reservationId`仍是 source
reservation；counterpart binding中的同名字段明确是 destination reservation，必须
exact-equal destination intent或 published Plan descriptor，不能拿 source ID填充。

same Identity的 `compare_reserve`必须在单一 installation-state provider事务中同时：
验证 absent reservation locator与 current high-water，写 reservation、发布完整 Plan，
append reserved event，更新 event/receipt/account complete enumeration与 high-water，
并写 immutable operation receipt；外部只能观察全部提交或全部未提交。cross Identity
不宣称跨 provider全局原子，其唯一 saga是：

1. destination先通过 source provider authenticated read-only IPC以 Manifest +
   freeze token重算完整 typed cut，并在首个写前验证 candidate Plan的
   sizing/admission/migration ID/两份 descriptor；随后以
   `cross_destination_intent` reservation占满本次完整 history/category quota与三次
   terminal-transition escrow，record绑定 candidate Plan digest但不发布 Plan；
2. source以同一完整 candidate Plan重复验证上述 closure，要求 destination intent
   full pin/token中的 `candidatePlanContentDigest` exact-equal，再提交零
   bytes/category的 `cross_source_provisional` reservation与自己的 terminal escrow；
3. destination `compare_activate`以 intent account transition为 CAS expected state，
   重验 source reservation、双方 sizing/admission/ID/policy/role及两份 reservation
   的 candidate Plan digest都 exact-equal activate candidate后，在单一事务发布含
   两份 descriptor的同一 Plan，把 pending account原子替换为带
   `cross_destination_activated` transition anchor的 `published` account，append event并
   更新 enumeration/high-water/receipt；
4. 任何 migration-only Acceptance或 migration side effect前重新验证 source
   reservation、destination published account与 Plan全部 active且 exact-equal；
5. progress完成并 seal后，destination先 `commit_retained_history` actual usage；
6. source后 `commit_cross_source_anchor`，必须保存并 pin destination committed
   receipt且 typed actual retained usage全0；
7. final `strong_ready`必须 pin并重验精确 committed quota receipt selector：
   same只接受
   `{role:same_identity_journal,operation:compare_commit,
   commitKind:commit_retained_history,outcome:committed}`；cross destination只接受
   对应 destination retained tuple，cross source只接受
   `{role:cross_source_anchor,operation:compare_commit,
   commitKind:commit_cross_source_anchor,outcome:committed}`。resolver还必须令
   pin selector exact-equal loaded receipt request projection，pin/payload outcome均为
   committed，generation/nonce/content digest/token逐字段闭合；final专用 pin还必须
   携带并验证 `migrationId/reservationId/migrationPlanContentDigest`，三者分别
   exact-equal loaded Plan的 ID/content digest及 Plan中该 role对应 descriptor的
   reservation ID，ledger identity generation又必须对应 descriptor中的 Identity。
   activation被展开为 mode-specific union，Plan pin mode与 receipt-set mode不可互换；
   cross source loaded receipt内保存的 destination commit pin还必须 byte-identical
   final set的 destination receipt。两侧 pin互换、同 tuple的其它 migration receipt、
   同 migration错误 reservation或同 ID不同 Plan digest全部拒绝。

destination intent建立后，即使 source ledger容量不足，destination也已保留本地 cancel
escrow。`compare_activate`与
`cancel_unpublished_cross_destination_intent`必须从同一个 expected intent-account
transition做 CAS：activate赢则 Plan原子发布且 cancel永久失败；cancel赢则 Plan仍 absent，
永久 cancellation fence随 event/receipt持久化，后续 activate永久失败。source
`release_provisional_source`只接受该 full counterpart receipt pin，不接受 transient
absent read或裸 content digest。source resolver必须加载 destination cancellation
receipt并令 pin binding byte-identical其 durable projection；其中
`migrationId`必须 exact-equal source reserved event与 reservation，
destination `reservationId`必须 exact-equal该 event的
`planPublication.destinationIntent.reservationId`，
`candidatePlanContentDigest`必须同时 exact-equal source reservation、destination
intent pin、destination reservation及 cancellation fence中的同名字段，receipt
ledger generation必须对应 destination intent Identity。该 closure只依赖两份已持久化
reservation与 cancellation receipt，不要求重获已丢失的完整 Plan bytes；来自其它
migration、其它 destination reservation或同 migration但不同 candidate Plan的合法
receipt一律拒绝，因此不存在取消与 Plan发布的并发穿越窗口。
V1 reservation/event/operation receipt故意只持久化 candidate Plan digest，不把
未发布的完整 Plan bytes伪装成 provider-owned recovery object；因此 coordinator
崩溃后只能由调用方重新提交 byte-identical完整 Plan继续 activate，若该输入永久
丢失则只能走上述 authenticated cancel/release saga。provider不得从目录扫描、日志
片段或同 digest外部声明重建 Plan，也不得仅凭 digest打开 migration-only/strong；
crash-recovery测试必须覆盖“原 request丢失→保持 pending且零副作用→exact Plan
重传后唯一推进”及“无法重传→只允许 cancel”的可用性边界。

commit恒等式逐 category成立：
`0 <= actualRetained <= reserved`、
`unusedReleased = reserved - actualRetained`；
post usage必须从完整 account set重算为 pre reserved减 reserved、retained加 actual。
unused reservation立即释放，actual retained继续计费，response-lost/restart不得重复
收费。quota event/receipt中的 Plan/artifact digest是
`audit_commitment_non_resolving`，不反向成为待删 closure的 live resolver root。
V1 `compare_release`只允许旧 Identity已通过 cross-rebootstrap退休后的终局清理：
必须以完整 Acceptance/Store/audit enumeration证明零引用与零 active executor，在同一
provider事务 exact compare-delete全部 accounted artifact，签出 deletion receipt，
append released event/receipt并推进 enumeration/high-water；少删、多删、bytes/count/
set不等都不释放 quota。正常同 Identity retained history单调计费，不允许日常 GC；
cross cleanup固定 destination release+deletion receipt先于 source anchor release，
source必须 pin destination release receipt。destination `release_retained_history`
receipt的 durable projection必须从 loaded retained account、commit event、accounting
proof与尚未删除的 published Plan重算
`migrationId/reservationId/migrationPlanContentDigest`，并在删除 Plan/artifact的同一
事务把该 durable receipt持久化。随后 source `release_cross_source_anchor`加载该 full
receipt，但**不得**要求重新解析已被 destination deletion receipt合法删除的 Plan：
release binding的 `migrationId/migrationPlanContentDigest/reservationId`必须分别
exact-equal authenticated source committed event的 `migrationId`、其
`migrationPlan.contentDigest`及该 event已保存并在 source commit时验证过的
`destinationCommitReceipt.reservationId`；release receipt ledger generation还必须
exact-equal该 destination commit pin的 generation。destination commit binding在 Plan
仍可解析时已经与 destination descriptor闭合，source release只继承这条 authenticated
closure。跨 migration、错误 destination reservation或同 migration不同 Plan digest的
release receipt即使签名与 selector合法，也不能释放 source anchor。

account set与 Usage的方程没有自由度：每个 reserved字段等于全部 reserved account
charge对应字段求和；每个 retained字段等于全部 retained account usage对应字段求和；
每个 charged migration/count/bytes字段等于对应 reserved+retained字段。尤其
`chargedMigrationCount == reservedAccountCount + retainedAccountCount`，四类
record count/bytes同样包含 active reservation，cross source account只贡献1个 migration
slot且 typed usage全0。post account只保存 cycle-free
`{eventOrdinal,operationNonce,migrationId,reservationId,role,transition,predecessor}`
anchor，禁止保存
创建当前 post state的 event ID/content digest；anchor必须与 complete event enumeration
同 ordinal entry逐字段 exact-equal。destination activate必须在同一事务把 pending
account替换为 published account，后者 anchor又必须 exact匹配本次 activated event。
计算顺序固定为
`post account set/usage → event ID → event content digest → event enumeration/high-water`，
禁止迭代 hash fixed point。

retained artifact set只能从 Plan fixed locators与 authenticated sealed progress complete
enumeration流式重建，按 `provider-migration-history-artifact-set-v1` comparator形成唯一
entry/count/digest；`artifactKind=source_universe`只接受 `side=source` pin，
`destination_universe`只接受 `side=destination` pin，交换 side即使其余 ID/digest
有效也必须在 Schema/domain阶段拒绝。不能目录扫描、读 mtime或接受 producer自报。
zero-reference proof
必须在同一 read cut内 pin Acceptance high-water、完整 Store Manifest cut set与
authenticated audit-root cut set，并为 Acceptance/Store/audit三类分别构造 complete
typed reference enumeration；三者只在 count为0且使用 versioned empty set digest时
成立。deletion transaction加载原 accounting proof，要求 deleted artifact ordered
set与 retained set逐项 exact-equal后才删除；deletion receipt的 count/set/logical/
allocated bytes必须与二者一致。任何 missing/extra/reorder/duplicate、第二 locator或
cut/version drift都零 quota release。

账本 integrity失败、reservation/event/receipt/control cap已满，或新 reservation的
pre-admission quota不足时，provider必须在首个写入前返回
`state_unavailable`的 `zero_write_no_receipt`结果；不能尝试把
`ledger_integrity_failed/quota_exhausted`再写成一个无法容纳的 receipt。已存在 nonce
仍只按其 fixed receipt locator返回首次 bytes。所有 admitted semantic outcome才写
operation receipt；receipt outer identity/nonce/resolvedAt/content digest/token必须与
payload逐字段 exact-equal；`requestContentDigest`必须按
`provider-migration-history-quota-operation-request-v1`覆盖完整 strict
`ProviderMigrationHistoryQuotaOperationRequestV1`，包括 operation/role/kind、nonce、
expected state、完整 candidate Plan/Plan/proof及 counterpart pin，禁止用 durable
projection、裸 Plan digest或 selector子集替代。同 nonce只有在完整 request digest
byte-identical时 replay首次 receipt；同 nonce但完整 Plan或任一 counterpart binding
不同必须返回 `operation_nonce_request_mismatch`且零写。request projection
operation/kind/role必须与 durable outcome
operation/kind/role一致，committed iff enumeration含 `appendedEvent`，且该 pin的
role/transition必须 exact-equal operation selector唯一映射的 committed event。
JSON Schema生成器必须把 event/operation selector与 distributive receipt helper展开为
逐个 atomic branch的显式 `oneOf`，不能输出 role/kind宽化后的笛卡尔积；无法证明展开
等价的生成器产物不得作为 wire contract发布。
其中 Rewrite Plan、Semantic Equivalence Proof与 Zero-live Proof的
`canonicalRewritePlanBytes/canonicalProofBytes`绝不计算完整对象的 fixed point：
它们分别只等于
`provider-migration-canonical-reference-rewrite-plan-size-v1`、
`provider-migration-semantic-equivalence-proof-size-v1`与
`provider-migration-zero-live-reference-proof-size-v1`二元 tuple的 exact JCS UTF-8
长度。三个 projection都排除自身 byte counter及后续 HMAC/provider signature；
不能把最终 Envelope/file bytes、placeholder、普通 `JSON.stringify`或反复求数字位宽
稳定值当作该 counter。计算顺序固定为
`stable ID → canonical size projection → core/content digest → journal-authority HMAC
→ provider signature（若有）→ Envelope digest`。immutable golden必须覆盖
9/10、99/100、999/1000、UTF-8多字节、cap-1/cap/cap+1及 self-counter/token/
signature inclusion负例。

迁移 executor先在 source freeze token下生成
`ProviderMigrationLiveReferenceUniverseV1`：root/object/reference set必须按冻结
schema complete。`rootCount/objectCount/referenceCount`分别 exact-equal各 set entries
长度，各 set digest按独立 non-self-referential domain重算；root/object ordinal必须
exact `0..N-1`，reference按冻结 tuple comparator排序unique。每个 reference slot ID
必须由同 edge携带的 strict descriptor重算，descriptor source kind/kind必须匹配
from所指 root/object，canonical field path与 occurrence ordinal必须 uniquely定位冻结
Schema中的一个 provider-bound字段。每个 object从至少一个 root可达，每个
provider-bound字段恰有一条 typed edge；所有 reservation/active plan先恢复到
terminal，`activeTransactions`必须显式为空。provider-isolated Store Manifest
receipt ledger必须作为独立 typed root纳入 universe；每个仍被 generation/history
引用的 receipt以 `store_manifest_compare_append_receipt` object kind与 strict
provider-isolated locator进入 object/reference set。它不属于 Private Store quota
root，也不得因不在 Store目录而遗漏。不得以目录扫描补候选。`started` record
之前，same-identity必须显式记录 rewrite plan absent；cross-installation必须按
`source universe → canonical Rewrite Plan → started record`顺序从 fixed locator加载
唯一 `ProviderMigrationCanonicalReferenceRewritePlanEnvelopeV1`。Plan的 migration/
Migration Plan/source universe/freeze token、source/destination namespace与 writer
必须分别 exact-equal已验证 migration closure；source freeze token在 plan、每个 proof、
receipt与 online revalidation间不得变化。

Rewrite Plan的 `objectMappings`按 source object ordinal exact `0..N-1`并一对一
exact-cover source universe object set；destination ordinal保持同序，destination
logical locator/semantic locator/provider/policy必须由 Migration Plan destination
namespace与 writer确定性导出且 strict unique。零 object-reference slot的对象只能
使用 `byte_identical_rebind`且 expected destination content digest等于 source；
存在 object-reference slot的对象必须使用 `canonical_reference_rewrite`。
每项 mapping的 `sourceReferenceCount/sourceReferenceMappingSetDigest/
canonicalSourceReferenceMappingSetBytes`必须从独立
`provider-migration-canonical-source-object-reference-mapping-set-v1`重算：只取全局
mapping中 `from.sourceKind="object"`且 source ordinal相同的 exact子集，保持全局
mapping ordinal升序。byte-identical分支只能使用 count 0的 versioned empty golden，
rewrite分支必须 count大于0；该子集 domain不得包含 Rewrite Plan ID/Pin或 mapping
自身，保证 `started`前 crash仍能由 source universe唯一重建同一 Plan。
`referenceSlotMappings`按 source universe冻结 comparator形成 ordinal
`0..referenceCount-1`，每项 byte-identical pin source edge、slot descriptor、source
reference bytes digest，并唯一导出 destination from/to ordinal、target semantic
locator与 canonical reference bytes digest；它必须 exact-cover root+object全部
reference edges，missing/extra/duplicate/reorder、换 field path/occurrence、把一个
source slot映射两次或把两个 source objects映射到同一 destination locator全部拒绝。

rewrite algorithm固定为 strict schema decode +
`rfc8785-jcs-safe-integer-v1` encode；Algorithm profile的
`canonicalEncoder`必须 exact-equal该字面量，禁止 alias、runtime
`JSON.stringify`或另一 canonical JSON profile。算法只在
mapping指定的 exact RFC 6901 slot把 source reference替换为 destination object
kind+semantic locator encoding。source与 destination分别把所有 mapped slots替换为
`["provider-migration-reference-slot-sentinel-v1", referenceSlot]`后，以
`provider-migration-non-reference-canonical-bytes-v1`重算 digest；两者必须
exact-equal，任何其它 key/value/array order/bytes变化都进入 typed failure set并拒绝。
object graph只取 object→object edges，以 source ordinal升序节点和 target ordinal升序
adjacency运行冻结 Tarjan；SCC members升序，condensation DAG按 dependency-first reverse
topological顺序、最小 member ordinal打破平局。self-loop与多节点 cycle必须先为整组
预计算 destination canonical bytes/content digests，再按 member source ordinal发布；
不得从部分已发布 destination对象反推 bytes，且整组 proofs未闭合前不得提交
destination Store cut。SCC schedule必须 exact-partition全部 source objects，依赖 SCC
ordinal严格小于使用者；错误 partition/order、漏 self-loop或伪造 acyclic均拒绝。

每个 rewrite object发布后生成
`ProviderMigrationSemanticEquivalenceProofEnvelopeV1`：proof exact绑定 Migration
Plan、Rewrite Plan、source/destination object ordinal/locator/binding、source与
destination content digest、相等的 non-reference canonical bytes digest、按 mapping
ordinal exact-cover该 object slots的 rewritten reference set digest，以及 source
online revalidation token。missing/duplicate/unexpected slot、source/destination
reference digest mismatch、non-reference byte mismatch与 SCC rule violation七类 typed
failure sets必须全部显式为空。journal-authority HMAC先签 proof core，destination
provider再以独立 `migration_semantic_proof` Ed25519 usage覆盖该 HMAC token；Plan亦按
同样 HMAC→destination-provider-signature顺序认证。计算顺序固定为
`source universe → rewrite plan ID/core → plan HMAC → plan signature → plan Envelope
digest → destination bytes → semantic proof ID/core → proof HMAC → proof signature →
proof Envelope digest → object receipt ID/token`。Plan/Proof禁止出现 object receipt
ID/pin/token；rewrite receipt必须保存完整 Plan Pin与 Proof Pin，禁止只存 schema/proof
digest，因此 receipt单向 pin proof而无 receipt↔proof cycle。
其中 `proof.sourceObject`必须 byte-identical Rewrite Plan mapping与 source universe
entry，`proof.destinationObject`的 ordinal/kind/logical locator/semantic locator/
provider policy必须 exact-equal destination expectation，provider binding/content
digest/logical bytes必须 exact-equal committed publication；显式
`sourceContentDigest/destinationContentDigest`分别 exact-equal两侧 object pin。
Proof的 `rewrittenReferenceCount/rewrittenReferenceSetDigest/
canonicalRewrittenReferenceSetBytes`还必须与对应 Object Mapping的上述 per-object
count/digest/bytes逐字段 exact-equal；不能由 proof producer另选同元素不同边界或
遗漏 empty golden。

`started` record必须先构造
`ProviderMigrationObjectReceiptPrefixSetV1{migrationId,sourceUniverseId,entries:[]}`，
按 `provider-migration-object-receipt-prefix-set-v1`重算唯一 empty digest/bytes，且
`receiptCount == migratedObjectCount == entries.length == 0`。此后每个 progress
record都只从 authenticated complete progress enumeration重建该 canonical prefix，
并要求 `receiptCount == migratedObjectCount == entries.length`：`object_planned`的
source ordinal必须 exact-equal predecessor `receiptCount`且保持 prefix byte-identical；
紧随其后的 `object_committed`恰好追加该 ordinal的一条 committed receipt；其余 phase
保持完整 prefix byte-identical。每个 object严格经历 journal
`object_planned → provider publish → ProviderMigrationObjectReceiptV1 →
object_committed`；receipt按 source ordinal形成 contiguous prefix并保存 destination
完整 committed publication evidence。partial/empty progress只允许使用 prefix-set
domain，禁止用 complete `provider-migration-object-receipt-set-v1`伪装。
`object_planned.transformationPlan`必须 byte-identical命中对应 object mapping，或
exact pin同一 Rewrite Plan/objectMappingOrdinal/SCC/expected destination digest；
`object_committed` receipt的 source/destination/transformation/Plan Pin/Proof Pin必须与
planned record及实际 provider publication byte-identical。

所有 destination objects与 new Store cut提交后，executor重新构造 destination
complete universe并生成
`ProviderMigrationZeroLiveReferenceProofV1`。进入 zero-live前，progress prefix必须已
complete：它只能从 complete progress enumeration的 `object_committed` records构造，
且 `receiptCount == migratedObjectCount == prefix.entries.length ==
expectedSourceObjectCount == sourceUniverse.objectCount`。同一 ordered entries随后必须
按 complete `provider-migration-object-receipt-set-v1`再次 canonicalize，形成一对一
exact-cover source universe的 `receiptSetDigest/canonicalReceiptSetBytes`；prefix与
complete closure使用不同 domain，禁止比较或复用二者 digest。proof的
`sourceFreezeStateVersionToken`必须同时等于 source universe payload所
pin token与 provider online current freeze token，并进入 proof ID preimage。retained
physical set按 source universe中仍保留的 exact ordinal/binding/bytes构造；tombstone前
固定 exact-cover全部 source objects，count/digest/canonical bytes均重算且仍计费。
remaining source-provider reference、unmapped、duplicate、
unverified destination与 active transaction五个集合必须为 typed empty。
cross mode还必须在 destination universe之后、zero-live ID之前，从唯一 Rewrite
Plan与两侧 complete universe确定性重建
`ProviderMigrationCanonicalRootRewriteProofSetV1`。proof set不是独立 locator
artifact，也不进入 destination universe；其 entries按 root ordinal exact
`0..rootCount-1`并同时 exact-cover source/destination root set，两个 universe的
root count、ordinal与 kind必须逐项相等。每个 root的 rewritten references按
`provider-migration-rewritten-root-reference-set-v1` exact-cover Plan中对应
`sourceKind="root"` mapping子集，也必须 exact-cover destination universe对应 root
edges；子集允许 empty，但 root proof本身不能省略。将两侧 mapped slots替换为同一
typed sentinel后，`provider-migration-root-non-reference-canonical-bytes-v1`
digests必须相等。因此 zero-edge cross migration仍逐根验证完整 non-reference root
projection；missing/extra root、kind/order、slot mapping或 non-reference mismatch
进入 closure的 typed failure set并阻断 zero-live。其 count/digest/canonical bytes
按 `provider-migration-canonical-root-rewrite-proof-set-v1`重算并计入 migration
canonical total budget。
zero-live还必须从 complete receipt set筛出 rewrite receipts，按 source ordinal构造
`ProviderMigrationSemanticEquivalenceProofSetV1`：proof count必须 exact-equal
canonical rewrite receipt count，每项 receipt所 pin Plan/Proof与 fixed-locator Envelope
byte-identical，proof set exact-cover全部 rewrite object ordinals。missing/duplicate
proof、混入另一 migration/
plan/source universe、proof换 destination binding/content或任一 proof failure set非空，
都必须保留在 typed failure set并禁止 zero-live。same-identity只能使用
`mode="same_installation_identity",state="not_required"`、Plan absent及 semantic/root
两个 versioned empty golden；cross-installation则无条件使用
`mode="cross_installation_rebootstrap",state="proved"`并 pin唯一 Rewrite Plan，
即使 canonical rewrite receipt数、object-reference edge数或全局 reference数为0也
不得降级为 `not_required`。此时 Semantic Proof Set可以是 count 0 empty golden，
但 Root Proof Set仍 exact-cover所有 roots。source
物理 bytes可以暂时保留，但只能成为不可达、计费且不可 scan/adopt的 retired
garbage。same-identity tombstone必须是 Registry direct successor并永久不可
re-enable；cross-identity tombstone由 destination active root对新 trust domain
签名，旧 compromised recovery quorum不参与，旧 Identity永久保持
`recovery_only`。

progress record publication、complete enumeration、authenticated open head与
operation receipt由 journal-authority installation-state provider在同一事务
compare-append；`requestContentDigest`必须按
`provider-migration-progress-operation-request-v1`只覆盖 operation+对应 strict
request并包含 nonce。同 nonce同 request返回原 receipt，同 nonce异 request拒绝。record
ordinal连续、只有 `started`为 genesis，loser零 record。complete enumeration的
`recordCount == entries.length`，`recordSetDigest`只按独立
`provider-migration-progress-record-set-v1`对 ordered entries计算，不能使用包含
`recordSetDigest`的 enumeration content digest；head/request/enumeration三处 count、
digest与 canonical bytes必须 exact-equal且总 progress bytes受 Plan cap。每个 phase的
payload digest按独立 phase domain重算，operation request digest按独立 request domain
重算，receipt canonical bytes累计计入 receipt/total cap。`ready_to_activate`必须
exact pin source/destination universes、complete receipt closure、zero-live proof、
tombstone与 `ProviderMigrationStrongReadyCoreV1`；其继承的
`receiptCount/migratedObjectCount/receiptPrefixSetDigest`必须验证为上述 source universe
的 complete prefix。seal只把同一 complete set的 open head原子变为 sealed，不新增
record；`ProviderMigrationSealedClosureV1.receiptCount/receiptSetDigest/
canonicalReceiptSetBytes`必须分别 exact-equal source universe object count与 zero-live
proof的 complete-set fields，并从 ready record的同一 ordered prefix重新构造；seal后
永久禁止 append。
Plan、universe、Rewrite Plan、Semantic Equivalence Proof、object receipts、
zero proof、tombstone、progress records与
operation receipts在 final strong-ready后仍 append-only；只要任一 Store/history/
audit引用 migration closure就不得 GC，正常 Identity/key rotation保留 HMAC/root
verification material。容量耗尽不能通过删除旧 receipt或扫描/adopt对象恢复。
object receipt、zero-live proof、progress head/version与 progress operation receipt的
owner HMAC issuer都只能先按 migration ID fixed locator加载并验证唯一 Migration
Plan，再取其中 `journalAuthorityInstallationIdentity`的 immutable key；same mode
等于共同 identity，cross mode必须 exact-equal destination identity。request、
candidate record、observed head、token prefix或 source identity都无权选择 issuer；
四类 source-key substitution即使其它 bytes与签名有效也必须拒绝。zero-live的尾部
顺序固定为
`destination universe → canonical root rewrite proof set → semantic proof complete
set → zero-live proof ID → zero-live size → journal-authority HMAC → Envelope digest`。

最终 Activation保持无环：
`ready_to_activate → sealed progress head → final strong_ready Acceptance`。
sealed head不反向 pin final Acceptance；final
`strong_ready.activation(completed_provider_migration)`单向 pin sealed head，且
其 `core`必须与 ready record byte-identical。final Acceptance validator还必须重新
加载 ready record、sealed closure、zero-live proof与 source universe，验证
`ready.receiptCount == sealed.closure.receiptCount == zeroLive.receiptCount ==
sourceUniverse.objectCount`，并重算 prefix/complete两个 domain；任一 partial prefix
不得激活 `strong_ready`。seal成功但 Acceptance尚未 append时
仍保持 `migration_only`；只有 final high-water原子提交后才重新开放 Surface。
首个 rebind前取消也只能追加 Registry/Catalog/Acceptance successor，首个 rebind后
只能恢复同一 migration或创建显式 reverse-migration Plan；crash不得 scan/adopt
候选。

`recovery_only`固定关闭所有 strong Surface并返回
`provider_unavailable/migration_required`。root compromise可在新 root重签完整
Registry/Catalog或显式 migration后 append恢复；任一 distribution-pinned
recovery key泄漏则当前不可变 2-of-3 key set永久退休，不允许“就地换一把”或继续
用剩余 quorum恢复写入。产品必须 append
`recovery_key_compromise_requires_new_installation_identity`、由新的签名发行物
bootstrap/recovery trust bundle创建全新 Installation Identity generation，并以
显式、可恢复、可审计 migration把既有 Store逐个迁移；partial migration、
downgrade或旧 identity replay都保持 Surface关闭。这样不存在“新 trust已接受但
旧 Registry/Catalog或泄漏 recovery quorum仍授权写入”的中间态。

Root Metadata按固定 generation locator immutable发布并形成连续 chain。
bootstrap metadata必须为 generation 1、`activation=bootstrap`且与 immutable
identity内的 root/pin exact-equal。planned rollover必须是前代+1，同时具有旧
root cross-signature、新 root self-signature及由三把 recovery key中恰好两把
distinct key生成、按 recoveryKeyId bytewise排序的 signatures；compromise
recovery同样要求新 root self-signature与2-of-3 distinct recovery signatures，
不要求也不接受伪造为必需的旧 root cross-signature。新 root public material不得
复用任意历史 root、recovery、provider或 approver key；仍有 signature引用的
historical Root Metadata不可删除。

Provider Registry的权威 current不是单条 provider entry，而是 active root签名的
完整 `ProviderRegistryManifestV1`。它按固定
`installation_provider_registry_manifest_v1/<encoded-generationId>` locator
immutable no-replace发布，generation连续、exact pin predecessor，并由 current
`ProviderAcceptanceStateV1(strong_ready)` pin generation ID与 content digest。
member按 provider ID bytewise排序且unique：enabled member嵌入 exact entry与重算
`store-durable-object-provider-registry-entry-v1` content digest；撤销必须
显式保留 `revoked` tombstone和 last-enabled entry digest，provider从 successor
中消失不等于撤销。首次撤销的
`revokedAtManifestGeneration`必须 exact-equal当前 Manifest generation，
`lastEnabledRegistryEntryContentDigest`必须 exact-equal前一代该 provider的
enabled digest；后续 successor byte-identical保留整条 tombstone。successor必须保留前代每个
provider为 enabled或 tombstone，tombstone永久且同 provider ID不得重新
enabled。steady Manifest的 `routing.state=steady`；双-provider migration
过渡 Manifest必须同时列出 old/new enabled member，且
`routing.state=migration`的 migration/source/destination/active writer/phase
必须 exact-equal current Acceptance与 Migration Plan，普通两个 enabled
provider不能冒充迁移。两个合法 Manifest sibling、同代异 bytes、缺代、pin不等、revoked
provider缺席或重新启用均 fail closed。

每个 enabled entry内部仍保持 per-provider连续
`predecessorRegistryEntryContentDigest`，且 runtime attestation、verification
public-key record、binding-derivation generation record、feasibility approver
public-key record与 entry各自按 domain由该代 active root签名。verification key
按 `(providerId,usage,keyId)`、binding generation按
`(providerId,generation)`唯一定位；跨 Registry Manifest generation只能 append，
既有 record bytes不可删除或改写。active key IDs必须四个 usage各命中一个未撤销
record，active binding generation也必须命中一个未撤销 record；数组排序且
unique。feasibility approval history按 `(role,keyId)`全局 append-only，
QA/Release active key必须 role正确、互不相同且未撤销，不能与 provider/root/
recovery key复用 material。
所有 Root/Registry/Catalog/Acceptance successor与 key/revocation append必须先按
immutable `ProviderTrustHistoryPolicyV1` canonicalize完整 successor及仍需保留的
verification closure，再同时检查各 generation/record/Acceptance receipt count、
单 Envelope/receipt bytes、Acceptance receipt累计 bytes、identity累计 bytes和
normal-update emergency reserve；任一超限在签名、no-replace或 current
推进前零写拒绝。普通 rotation不得消费 emergency reserve；compromise recovery可用
reserve但仍不得突破 hard cap。per-provider/per-usage/binding/approver history达到上限
时不得删除、压缩或复制别名绕过：尚可由现有 trust安全授权时必须进入显式
dual-provider migration；无法在同 Identity内保留完整 historical verifier，或
identity累计/root/catalog/manifest上限将耗尽时，固定进入
`provider_unavailable/migration_required`并以新签名发行物、新 Installation
Identity执行 cross-installation rebootstrap。existing historical read/replay不受
新 successor admission拒绝影响，旧 verifier在其最后引用清零并有 sealed
zero-live/tombstone前仍不可删除。这样每个 identity的整表复制成本有明确硬上界，
不能形成无界 O(n²) history。
entry predecessor、enabled member digest与所有 golden vectors都只按
`store-durable-object-provider-registry-entry-v1`对排除
`registrySignature`的完整 strict entry重算；Registry signature domain不能代替
content-digest domain。

production registry entry还必须 pin一个 owner-only
`ProviderFeasibilityEvidencePinV1`；reader只按 fixed installation-state locator
profile + evidence ID读取，不扫描目录或外部索引，并验证
`pin.evidenceId == Envelope.evidenceId == payload.evidenceId`、pin/Envelope
content digest重算相等。Evidence中的 real-FS result pin只能解析到 OS-resolved、
owner-pinned installation-state root下
`provider/real-fs-conformance-results/<encoded-resultId>.json`；
`<encoded-resultId>`严格使用 `StoreFilenameKeyV1`，resolver只接收
`locatorProfile + resultId`，禁止 caller path、目录扫描或候选采用。reader必须
验证
`pin.resultId == Envelope.resultId == payload.resultId`，并要求
`pin.contentDigest == Envelope.contentDigest ==`
按 `provider-real-fs-conformance-result-v1`重算的 payload digest。

除 distribution Support Catalog、Public Taxonomy、Release Matrix、Target
Discovery Result与 Release Target Universe外，所有 installation-scoped
trust对象都使用同一 owner-pinned state root；五个 distribution对象只允许从
同一个已验证 `ProviderSignedDistributionRootBindingV1`所绑定的签名发行物只读根
解析；Target Discovery Input Bundle嵌入并由 Discovery Result保留，不新增第六条
generation locator。bootstrap trust bundle同样来自该 verified package root，但它是
signed-package/Installation Identity各自只 pin一次的 bootstrap structural object，
不属于五条 generation history、40,960个 schema可达 retained closure或
512 MiB distribution-history accounting，避免把信任根计入由自身绑定的可升级
history；bundle与 strict manifest两个 bootstrap resource分别受 exact-one、
4 MiB canonical Envelope pre-materialize cap与永久 retention约束，不能借此携带
任一 coverage generation artifact。除 bootstrap
literal外，generation/content-addressed对象使用 `.json`扩展名和
`StoreFilenameKeyV1`；完整 locator映射冻结为：

| locator profile | state-root relative path / semantic component |
|---|---|
| `distribution_provider_bootstrap_trust_bundle_v1` | verified签名发行物只读根的 literal `provider/bootstrap-trust-bundle-v1.json`；禁止编码、alias、第二 path或 caller path |
| `distribution_provider_strict_ed25519_adversarial_manifest_v1` | verified签名发行物只读根的 literal `provider/ed25519-strict-host-conformance-v1.json`；manifestVersion固定1，禁止 alias、第二 path或 caller path |
| `installation_provider_registry_root_metadata_v1` | `provider/root-metadata/<encoded(rootGeneration ":" rootKeyId)>.json` |
| `installation_provider_registry_manifest_v1` | `provider/registry-manifests/<encoded-generationId>.json` |
| `installation_provider_feasibility_evidence_v1` | `provider/feasibility-evidence/<encoded-evidenceId>.json` |
| `distribution_provider_feasibility_support_catalog_v1` | 签名发行物只读根的 `provider/support-catalog/<encoded("catalog-generation:" + catalogGeneration)>.json` |
| `distribution_provider_public_support_taxonomy_v1` | 签名发行物只读根的 `provider/public-support-taxonomy/<encoded("taxonomy-generation:" + taxonomyGeneration)>.json` |
| `distribution_provider_release_matrix_v1` | 签名发行物只读根的 `provider/release-matrix/<encoded("release-matrix-generation:" + releaseMatrixGeneration)>.json` |
| `distribution_provider_target_discovery_result_v1` | 签名发行物只读根的 `provider/target-discovery-results/<encoded("discovery-generation:" + discoveryGeneration)>.json` |
| `distribution_provider_release_target_universe_v1` | 签名发行物只读根的 `provider/release-target-universe/<encoded("universe-generation:" + universeGeneration)>.json` |
| `distribution_provider_real_fs_fixture_manifest_v1` | 签名发行物只读根的 `provider/real-fs-fixture-manifests/<encoded("fixture-envelope:" + contentDigest)>.json` |
| `distribution_provider_target_discovery_runner_run_v1` | 签名发行物只读根的 `provider/target-discovery-runner-runs/<encoded("runner-run:" + runManifestContentDigest)>.json` |
| `distribution_provider_real_fs_suite_manifest_v1` | 签名发行物只读根的 `provider/real-fs-suite-manifests/<encoded("suite-envelope:" + contentDigest)>.json` |
| `distribution_provider_real_fs_fixture_corpus_manifest_v1` | 签名发行物只读根的 `provider/real-fs-fixture-corpus-manifests/<encoded("fixture-corpus-envelope:" + contentDigest)>.json` |
| `installation_provider_acceptance_state_v1` | `provider/acceptance/generations/<encoded-generationId>.json` |
| `installation_provider_acceptance_high_water_v1` | provider隔离域固定 `provider/acceptance/current.json`，caller不能传 path |
| `installation_provider_acceptance_compare_append_receipt_v1` | `provider/acceptance/compare-append-receipts/<encoded-operationNonce>.json` |
| `installation_provider_migration_history_quota_reservation_v1` | `provider/migration-history-quota/reservations/<encoded-reservationId>.json`；只存 immutable reservation，destination intent的 activate/cancel竞争 authenticated account CAS |
| `installation_provider_migration_history_quota_event_v1` | `provider/migration-history-quota/events/<encoded-eventId>.json` |
| `installation_provider_migration_history_quota_operation_receipt_v1` | `provider/migration-history-quota/operation-receipts/<encoded-operationNonce>.json` |
| `installation_provider_migration_history_quota_high_water_v1` | provider隔离域固定 `provider/migration-history-quota/current.json`，caller不能传 path |
| `installation_provider_migration_plan_v1` | `provider/migrations/<encoded-migrationId>.json` |
| `installation_provider_migration_live_universe_v1` | `provider/migrations/<encoded-migrationId>/universes/<encoded-universeId>.json` |
| `installation_provider_migration_rewrite_plan_v1` | `provider/migrations/<encoded-migrationId>/rewrite-plans/<encoded-rewritePlanId>.json` |
| `installation_provider_migration_semantic_equivalence_proof_v1` | `provider/migrations/<encoded-migrationId>/semantic-equivalence-proofs/<encoded-proofId>.json` |
| `installation_provider_migration_object_receipt_v1` | `provider/migrations/<encoded-migrationId>/object-receipts/<encoded-receiptId>.json` |
| `installation_provider_migration_progress_record_v1` | `provider/migrations/<encoded-migrationId>/progress/records/<encoded-recordId>.json` |
| `installation_provider_migration_progress_head_v1` | installation-state provider隔离域固定 `provider/migrations/<encoded-migrationId>/progress/current.json` |
| `installation_provider_migration_progress_operation_receipt_v1` | `provider/migrations/<encoded-migrationId>/progress/receipts/<encoded-operationNonce>.json` |
| `installation_provider_migration_zero_live_proof_v1` | `provider/migrations/<encoded-migrationId>/zero-live/<encoded-proofId>.json` |
| `installation_provider_migration_source_tombstone_v1` | `provider/migrations/<encoded-migrationId>/source-tombstones/<encoded-tombstoneId>.json` |
| `installation_provider_real_fs_conformance_result_v1` | `provider/real-fs-conformance-results/<encoded-resultId>.json` |

Store Manifest compare-append receipt不在上述 installation-state root，也不在
`.understand-code` Store root；其 provider-isolated root-relative locator唯一冻结为：

| locator profile | provider-isolated root relative path / semantic components |
|---|---|
| `store_manifest_compare_append_receipt_v1` | `store-manifest/namespaces/<encoded-repositoryId>/<encoded-worktreeId>/compare-append-receipts/<encoded-operationNonce>.json` |

三个 component都先验证各自 brand/regex，再分别使用 `StoreFilenameKeyV1` canonical
编码。resolver只接受 accepted writer的 provider root以及
`{providerId,repositoryId,worktreeId,operationNonce}`，禁止 caller path、glob、扫描
或跨 provider adoption；provider policy digest必须等于该 writer的 semantic policy。
Receipt pin、Envelope outer、payload、signed operation-receipt claims与 locator中的
provider/repository/worktree/nonce/policy必须逐字段 exact-equal。

resolver只接受 profile与该行声明的 semantic fields，禁止 caller-supplied path、
glob、目录扫描或候选 adoption。Root/Registry/Acceptance/Result/Evidence/Catalog/
Public Taxonomy/Release Matrix/Target Discovery Result/Release Target Universe/
Target Discovery Fixture Manifest/Runner Run Manifest/Real-FS Suite Manifest/
Real-FS Fixture Corpus Manifest/Bootstrap Trust Bundle/
Migration Plan/Universe/Rewrite Plan/
Semantic Equivalence Proof/Object Receipt/Zero-live/Tombstone/Progress
Envelope的重复 outer ID/generation/root key/installation identity/time必须与
payload exact-equal；content digest始终按该对象冻结 domain重算。其中
Migration Plan outer四个 source/destination repository/worktree ID必须分别
exact-equal payload两套 namespace ID，Plan顶层 namespace与 translation内重复
namespace也必须 byte-identical；Plan Pin的 `migrationId/mode/contentDigest`必须
exact-equal resolved Envelope/payload，same/cross relationship或任一 authorization token
不满足 strict branch即拒绝。Universe pin/outer/payload的 migration/side/root/object/
reference count与 set digest必须逐字段相等；Zero-live pin/outer/payload的 proof ID、
migration与 token必须相等。
Migration-history quota resolver只接受 ledger所在 immutable Installation Identity
绑定的 provider隔离根及下列 semantic input：reservation为
`{locatorProfile,reservationId}`，event为 `{locatorProfile,eventId}`，operation
receipt为 `{locatorProfile,operationNonce}`，high-water只接受 locator profile且
固定 `current.json`。所有 ID/nonce先验证 brand再经 `StoreFilenameKeyV1`编码；禁止
caller path、latest alias、glob、scan/adopt、跨 Identity root替换，或以 Plan/request
中的重复 Identity选择 token issuer。reservation与 cancellation fence使用同一
ID，但 reservation locator始终只存首次 immutable reservation；destination
activate与 cancel必须以同一 expected intent-account transition做 CAS，fence随
cancel event/receipt持久化。resolver必须拒绝第二 reservation payload、第二 path及同
locator异 bytes。
Rewrite Plan resolver只接受
`{locatorProfile:"installation_provider_migration_rewrite_plan_v1",migrationId,
rewritePlanId}`；Proof resolver只接受
`{locatorProfile:"installation_provider_migration_semantic_equivalence_proof_v1",
migrationId,proofId}`，全部 semantic ID先验证 brand再经 `StoreFilenameKeyV1`编码。
Rewrite Plan Pin/Envelope/payload的 plan/migration/source-universe ID、source universe
content digest、time/content digest/HMAC/signature必须逐字段闭合；Semantic Proof
Pin/Envelope/payload的 proof/migration/rewrite-plan/source+destination ordinal与
content digest、time/content digest/HMAC/signature必须逐字段闭合。错误目录层级、
caller path、同 ID第二 path、plan/proof跨 migration或跨 source universe substitution
全部 fail closed，且不得扫描其它 rewrite/proof文件补候选。
Acceptance outer `acceptedAt`不得与同一 payload产生第二套 Envelope bytes；
Catalog文件必须解析为 strict
`ProviderFeasibilitySupportCatalogEnvelopeV1`，其 outer
`catalogGeneration == payload.catalogGeneration ==
ProviderFeasibilitySupportCatalogPinV1.catalogGeneration`，且 pin/outer
`contentDigest`均等于按无签名 catalog payload冻结 domain重算的 digest。
缺 Envelope、recordType错误、outer/payload/pin任一不等都不能被 Acceptance
选为 current。
Catalog resolver只接受
`{locatorProfile:"distribution_provider_feasibility_support_catalog_v1",
catalogGeneration}`；generation必须是 `>=1`的 safe integer，resolver先生成
`catalog-generation:<canonicalPositiveDecimal>`再编码为唯一 component。
Taxonomy、Release Matrix、Target Discovery Result与 Target Universe resolver同样
只接受各自 locator profile与正整数
`taxonomyGeneration/releaseMatrixGeneration/discoveryGeneration/
universeGeneration`，分别生成唯一
`taxonomy-generation:<canonicalPositiveDecimal>`、
`release-matrix-generation:<canonicalPositiveDecimal>`、
`discovery-generation:<canonicalPositiveDecimal>`与
`universe-generation:<canonicalPositiveDecimal>` component。四者都必须解析为
strict Envelope，outer generation exact-equal payload与 pin generation，且
pin/outer content digest等于按各自无签名 payload domain重算的 digest。
Fixture Manifest resolver只接受
`{locatorProfile:"distribution_provider_real_fs_fixture_manifest_v1",
contentDigest}`；Runner Run resolver只接受
`{locatorProfile:"distribution_provider_target_discovery_runner_run_v1",
runManifestContentDigest}`。Suite/Corpus resolver分别只接受
`{locatorProfile:"distribution_provider_real_fs_suite_manifest_v1",contentDigest}`与
`{locatorProfile:"distribution_provider_real_fs_fixture_corpus_manifest_v1",
contentDigest}`。四者的 semantic component都只由完整 Envelope content digest单射；
`suiteDigest/fixtureManifestDigest`只是 release-independent semantic commitment，
绝不参与物理或 semantic locator。相同 semantic digest而 release/binding/records或
signature不同的 Envelope必须得到不同 locator；Suite/Corpus的 content digest必须在
独立 root signature生成后，对包含 exact signature的完整 signed payload重算，不能
复用 signature claims digest。使用 semantic digest locator、同
content digest第二 path、caller path、latest alias或目录扫描候选全部拒绝。
Fixture pin与 payload必须携带 byte-identical exact Suite Pin，Suite payload必须携带
exact Corpus Pin；Suite Pin的 `suiteDigest`必须 exact-equal resolved Suite payload，
其 `fixtureManifestDigest`必须 exact-equal Suite payload
`fixtureCorpusManifest.fixtureManifestDigest`，该 Corpus Pin的
`fixtureManifestDigest`又必须 exact-equal resolved Corpus payload同名字段；
四个 source Envelope的 distribution binding/release revision必须闭合，Suite/Corpus
独立 active-root signature、pin/outer content digest与 strict payload digest必须
分别验证，不能借用 Bundle、Fixture或 Result签名替代。Runner的 pin/run content
digest同样必须 exact-equal唯一 path、Envelope与 strict payload重算结果。
Catalog内两个 pin必须 exact指向本次解析的 Taxonomy与 Target Universe；Universe
内 coverage basis的 Matrix/Discovery pins及 taxonomy pin必须 exact指向本次解析
对象，Matrix/Discovery内 taxonomy pin又必须与 Catalog/Universe pin
byte-identical。五者的 `distributionRootBinding/activeRootMetadata/
registryRootKeyId`必须
exact-equal，并分别验证独立 active-root signature，不能用 Catalog或 Universe
签名替代 coverage input签名。五条 generation/predecessor chain均连续；Catalog
successor不得降低 taxonomy/universe generation，Universe successor不得降低
Matrix/Discovery generation。同代异 bytes、fork或 predecessor digest不等全部
fail closed。non-canonical decimal或任一 generation的第二 semantic path一律拒绝。
Trust Verifier必须从 host已验证的只读 package capability取得完整
`ProviderSignedDistributionRootBindingV1`，不能接受 caller/provider/runtime传入的
physical path或候选 digest；binding的 `signedPackageIdentityDigest`只按
`provider-signed-package-identity-v1`重算。binding的 `bootstrapTrustBundle`
必须按 fixed literal解析到 exact Envelope/payload，再由 bundle bootstrap root与
metadata闭合 active Root Metadata chain的 genesis；不能再从 binding中读取已删除的
独立 root-key/content-digest字段。byte-identical physical mirror只有 verified
package resolver明确证明同一 signed package identity时才允许；不同 binding伪装成
mirror、把同 bytes放在第二 semantic component或 path alias均拒绝。

五条 current generation都必须小于等于各自 policy的4096上限，并从 generation 1
验证完整连续 predecessor chain。retained reachable closure恰为五条完整 chain、每代
Discovery内嵌 Bundle，以及每个 Bundle传递 pin到的 Fixture、Runner、Suite与
Fixture Corpus source Envelope。验证器以
`ProviderDistributionRetainedObjectKeyV1`的两个 strict branch建立 streaming
visited-set：raw Envelope key固定为 `{binding,typed locator,contentDigest}`；
embedded Bundle key固定为
`{binding,parentDiscoveryContentDigest,bundleContentDigest}`。共享 exact source
Envelope只计一次；同一 Bundle被两个不同 Discovery parent内嵌时计两个 object，
同 parent+digest只计一次。Envelope与 Bundle都以完整 strict canonical bytes计算
`canonicalObjectBytes`并在 materialize/parse前应用16 MiB cap；Envelope的
`incrementalRetainedHistoryLogicalBytes`等于完整 canonical Envelope bytes，
embedded Bundle固定为0，因为其完整 signed bytes已由 parent Discovery Envelope
物理计费，禁止二次收费。
每接受下一个 key前先检查 retained object count不超过65,536；512 MiB只累加 unique
Envelope的 incremental bytes。semantic locator alias、同 verified locator异 digest/
bytes、pin/outer/payload不等或第二 physical path直接拒绝，禁止先读入/分配 oversized
对象再事后判定。五链各4096、每代一个 Bundle且每 Bundle各一份
Fixture/Runner/Suite/Corpus时，schema可达绝对最大为
`5*4096 + 4096 + 4*4096 = 40,960` objects；65,536/65,537只作为独立
retained-object accumulator的 defense-in-depth synthetic contract boundary，
不得伪装成不可构造的 end-to-end fixture。Catalog的4096上限还必须与 Installation Identity
`ProviderTrustHistoryPolicyV1`同名上限 exact-equal。
candidate distribution只有在保留 emergency reserve并完成全 closure count/bytes
admission后才可接受；4097代、任一 Envelope或 embedded Bundle 16 MiB+1、synthetic
accumulator第65,537个 retained object、schema可达40,960 object E2E边界、仅
transitive source使累计达到512 MiB+1或 cap fork都保持上一个 verified distribution且
零发布。共享 source重复 pin应只计一次；删除仍被 predecessor、Bundle或签名引用的
历史不能恢复容量。

real-FS Fixture Corpus records按 `{caseKey UTF-8,fixtureOrdinal}`排序且 unique，每个
case ordinal必须 exact `0..N-1`；program digest与 decoded byte length逐项重算。
Suite cases按 case ID排序且 unique，每个 distinct corpus case key恰好出现一次，
case的 fixture count/set digest必须 exact filter Corpus。每个 case的 crash cuts按
ordinal连续排序，ordinal 0恰为 `no-crash`；hashed branch ordinal至少1且
`afterFixtureOrdinal`必须命中同 case的 `operation` record。Case ID由
`{caseKey,fixtureRecordCount,fixtureRecordSetDigest}`重算；hashed Crash Cut ID由
`{caseId,crashCutOrdinal,injection,recoveryAssertionContentDigest}`重算，禁止 opaque
producer ID。Suite flatten得到的 required `{caseId,crashCutId}` tuple按 UTF-8排序、
unique并由 count/set digest重算。result的 Suite Pin必须按 full content-digest locator
解析，`caseResults` exact-cover该 required set；missing/extra/duplicate均 reject。
`outcome/resultCode`只允许：`passed↔passed`、
`unsupported↔unsupported_by_target_profile`，其余 allowlist code都必须
`outcome=failed`。aggregate为总函数：任一 failed则 `result=failed`；否则任一
unsupported则 `unsupported`；否则 `passed`。result/case不能含 volume UUID、
mount/root path、username、raw endpoint、raw log或自由文本。

hash构造明确无环：先生成 Corpus program/set/semantic digest与不含签名的 claims，
按独立 signature domain生成 `corpusSignature`，再对包含该 signature的完整 signed
payload计算 Corpus Envelope content digest与 locator；随后生成 Suite case/crash-cut
IDs与 sets、semantic digest及不含签名的 claims，先签出 `suiteSignature`，再对包含
该 signature的完整 signed payload计算 Suite Envelope content digest与 locator。
签名 message从不含 outer content digest，因此不存在回边。Fixture与 Bundle只向前 pin Suite，
Suite只向前 pin Corpus。Discovery Result完成后，校验/sort case results并推导
aggregate；按 exact Discovery Result/Bundle pin与完整 Suite Pin共同进入的 stable
preimage生成 result ID，再生成完整 result payload/content digest并
no-replace发布 fixed locator。runtime只 pin该 result content digest并先计算自身
unsigned canonical content digest；Evidence pin exact `{resultId,contentDigest}`、
复制字段并计算 Evidence ID/双签/content digest；最后 Registry/Catalog才 pin
Evidence与 runtime。Corpus/Suite/Result/runtime不得反向 pin后继 Envelope digest。

reader还必须加载 `semanticProviderPolicyDigest`所指 strict policy并逐字段关闭
Result → Runtime → Evidence → Catalog/Registry等式。result的
`providerId/semanticProviderPolicyDigest/implementationDigest/
binaryAttestationDigest/target/suiteDigest/fixtureManifestDigest/
runnerProfileDigest/crashCutCoverageDigest/result`分别 exact-equal Evidence同义
字段，且 Evidence `issuedAt >= result.completedAt`。Result与 Target Discovery
Fixture payload的 `realFilesystemSuiteManifest`都必须解析到 exact Suite Envelope。
对每个 Catalog candidate，Result的 `targetDiscoveryResult`必须 byte-identical
Catalog所 pin Universe的 `coverageBasis.targetDiscoveryResult`，其
`targetDiscoveryInputBundleContentDigest`必须同时 exact-equal Universe coverage
basis与 resolved Discovery Result同名字段；resolved Discovery Result内嵌 Bundle
所 pin Fixture Envelope payload的完整 `realFilesystemSuiteManifest`，又必须与
Result同名 Suite Pin canonical bytes完全相同。该等式把
Catalog→Evidence→Result路径重新接回
Catalog→Universe→Discovery→Bundle→Fixture→Suite→Corpus的唯一 retained closure；
只让 semantic digest相同而替换为另一份合法签名 Suite/Corpus也必须拒绝，不能绕过
40,960 reachable-object与 byte accounting。
各自 semantic suite digest必须等于 resolved Suite `suiteDigest`，
`fixtureManifestDigest`必须等于 Suite Corpus Pin同名字段，
`runnerProfileDigest`必须等于 Suite runner profile digest，Result
`crashCutCoverageDigest`必须等于 Suite required-case-cut set digest。Result
Suite Pin换成同 semantic digest但不同 signed Envelope、Suite/Corpus pin换
distribution binding、或复制 digest与 resolved payload不等都拒绝。
`result pin.contentDigest == Evidence.realFilesystemConformanceResultDigest ==
runtime.payload.realFilesystemConformanceResultDigest`。registry、catalog与
Evidence的 `providerId/semanticProviderPolicyDigest`三方相等；runtime的
`implementationDigest/binaryAttestationDigest`分别等于 Evidence同名字段，
runtime的
`osPlatform/osReleaseFamilyCode/osBuildDigest/architecture`分别等于 Evidence
target同名字段；runtime的 `filesystemProfileDigest`必须等于
`store-provider-filesystem-profile-v1`对 Evidence target三个 filesystem/mount
字段的重算值。policy的 isolation/IPC/suite digest分别等于 Evidence同名语义
字段。

Catalog candidate与 Registry entry中的
`StoreDurableObjectProviderRuntimeAttestationPinV1`在引用同一 Evidence时必须
byte-identical；分别排除 registry signature、按
`store-durable-object-provider-runtime-attestation-v1`重算其 payload digest，并
要求
`catalog.runtime.contentDigest == registry.runtime.contentDigest ==
Evidence.runtimeAttestationContentDigest`。因此 IPC endpoint attestation
digest、attestation generation或 runtime `issuedAt`任一被改写，即使每个对象
重新合法签名也必须 `attestation_invalid`且零写。任一跨对象字段或 digest不等
都同样拒绝，不能只因各对象自己的签名有效而注册。

Evidence
payload由两个互不相同、root-signed的 QA与 Release Ed25519 signer分别批准；
两份 role-specific wire prefix签名覆盖相同无签名 canonical payload，任一
缺失、role互换、bytes重复、key复用、签名无效、`result!="passed"`或 target
profile与当前物理 volume runtime不 exact-match都不能注册。owner-only payload只保存 OS
platform/family/build/arch、filesystem+mount **profile digest**、isolation/IPC、
suite/fixture/runner/crash-cut digest与结论，明确禁止 volume UUID、mount/root
path、username和 raw IPC endpoint。

公开支持矩阵的唯一权威输入是签名发行物固定 locator中的 owner-only
`ProviderFeasibilitySupportCatalogV1`、`ProviderPublicSupportTaxonomyV1`、
`ProviderReleaseMatrixV1`、`ProviderTargetDiscoveryResultV1`与独立签名的
`ProviderReleaseTargetUniverseV1`闭包，不是 runtime目录扫描、Catalog自行列出的
不完整 target集合或未定义的“registration capability”。五者使用 distribution
registry-root的不同 domain签名并各自形成 generation连续的
predecessor chain；五者完整 `distributionRootBinding`必须与 host verified
package capability byte-identical。catalog的
`activeRootMetadata/registryRootKeyId`、signature wrapper root key与
`ProviderAcceptanceStateV1(strong_ready)`必须 exact闭合，current catalog的
generation/content digest只由 acceptance tip选择，绝不写回 immutable
Installation Identity。catalog rollback、fork、缺代、root不等、签名或
acceptance pin不等均 fail closed。

Public Taxonomy把可公开 code冻结为非敏感 descriptor的确定性投影，而不是允许
producer传任意 hash-like string。V1 OS-family descriptor只允许
`darwin_product_major_version_v1`的 canonical product major，或
`linux_os_release_id_major_version_v1`的固定 distribution allowlist + canonical
major；filesystem descriptor只允许 APFS或 ext4对应的 strict platform resolver。
major必须是1..999 safe integer，descriptor禁止 extra key、自由文本、build ID、
kernel patch、feature或 mount option。reader分别按
`provider-os-release-family-code-v1`与
`provider-filesystem-profile-code-v1`从 descriptor重算 code，并要求 descriptor与
code一一映射、两个 record set各自排序且unique；unknown descriptor/code、同
descriptor异 code、同 code异 descriptor、noncanonical major或 taxonomy fork全部
拒绝公开 strong。

本机 runtime必须先用 taxonomy声明的 public resolver产生 descriptor，再得到 code；
`runtime.osPlatform/osReleaseFamilyCode`、Evidence target的 platform/family code与
Catalog target必须 exact-equal。filesystem resolver只观察 public filesystem kind，
其 code必须 exact-equal Evidence target；完整
`filesystemFeatureProfileDigest/mountOptionProfileDigest`仍只参与 owner-only target
identity与 runtime filesystem profile digest。`osBuildDigest`、feature digest或
mount digest单独变化时，descriptor/code/public profile ID必须保持不变；producer若
随这些 private claims换 code，即使 Taxonomy/Catalog被重新签名也按
`public_taxonomy_code_smuggling` fail closed。未知 public observation只能生成
read-only/no-row，不能由 runtime、Evidence或 Catalog临时创建 code。

Release Target Universe是 Catalog之外的 closed-world release声明。其 `targets`
保存完整 target与按 Taxonomy四字段重算的 public profile ID；`buckets`按 public ID
唯一分组，且所有 `targetProfileIds`必须组成 targets的 exact partition：每个 target
恰出现一次，bucket四字段与 target四字段/public ID exact-equal。
Target Discovery Result必须嵌入一份独立 domain、root-signed
`ProviderTargetDiscoveryInputBundleV1`，并保存其按无签名 bundle domain重算的
content digest。Bundle exact pin本代 Release Matrix、Public Taxonomy、real-FS
fixture manifest与唯一 runner instance/profile/version/implementation/binary/run
manifest；`distributionRootBinding/releaseRevisionDigest/activeRootMetadata/
registryRootKeyId`必须逐字段闭合。fixture与 runner pin只能按上表两个
content-addressed locator解析 strict manifest，不能由 caller path、目录扫描或
“latest runner”替代。Fixture/Runner Pin与各自 Envelope/payload的 distribution
binding、release revision、suite/fixture或 producer/version/implementation/binary/
profile/run digest、time必须逐字段 exact-equal；record count/set digest按
`provider-target-discovery-source-manifest-record-set-v1`从完整 records重算。
三个 source到 observation projection的映射只有下表一套：

| `observationSource` | exact `sourceArtifactContentDigest` | exact ordinal/outcome source |
|---|---|---|
| `signed_release_matrix` | 已验证 `ProviderReleaseMatrixEnvelopeV1.contentDigest` | `matrix.targets[i] -> {sourceRecordOrdinal:i,outcome:{state:"resolved",target:matrix.targets[i]}}` |
| `real_filesystem_fixture_manifest` | 已验证 Fixture Envelope `contentDigest`，并 exact-equal Fixture Pin `contentDigest` | Fixture payload `records[i]` byte-identical projection |
| `target_discovery_runner` | 已验证 Runner Envelope `contentDigest`，并 exact-equal `runManifestContentDigest` | Runner payload `records[i]` byte-identical projection |

`targetSetDigest`、`fixtureManifestDigest`、suite digest、runner implementation/binary/
profile digest都不是 source artifact digest，任何替代即使字节格式合法也必须拒绝。
Matrix没有 source manifest records数组；它只使用上表唯一 projection，故不得套用
Fixture/Runner的“同 ordinal manifest record”规则。三个 source summary、每条
observation、observation cut及 Bundle pin的 digest必须按上表逐项 exact-equal。
`observationCutDigest`按完整 cut domain绑定 exact release
revision及三个 source artifact digest；freshness唯一含义是
`exact_release_revision_and_source_digest_cut_v1`，不允许跨 revision复用旧 Matrix、
fixture或 runner run，也不引入依赖 wall-clock的模糊 TTL。

Bundle的 `sourceObservationSets`必须按 Matrix/fixture/runner固定三项顺序，分别
exact-cover该 source的 `sourceRecordOrdinal=0..N-1`记录。每个
`privacySafeObservationClaimsDigest`必须先按
`provider-target-discovery-source-record-v1`从上表 exact source projection重算，
outcome不能由 Bundle producer自由改写；随后
`observationKeyDigest`只按
`{observationSource,sourceArtifactContentDigest,sourceRecordOrdinal,
privacySafeObservationClaimsDigest}`重算；三个 source set的 union再按
`{source fixed-order,sourceRecordOrdinal}`形成完整 input observation set。
count/digest、missing/extra/duplicate/reorder任一不等都拒绝。Matrix source必须
恰有一条 resolved observation对应每个 Matrix target且不得 unresolved；fixture与
runner manifest声明的 record count/set digest也必须与 Bundle summary exact。
Bundle中三组 observations及其 summary沿用上述 fixed source order；Discovery
Result的 `unresolvedObservations`独立按
`(observationSource,observationKeyDigest)` UTF-8 tuple排序。真实 source不可用必须发布可解析、content-addressed的 strict manifest并以 typed
`observation_source_unavailable` record进入 Bundle；缺 locator/Envelope不能伪装成
合法 incomplete。不同 source对同 target ID给出不同完整 bytes时只能形成
`conflicting_target_claims` unresolved；该 typed outcome必须由 Fixture/Runner
source manifest原生发布，verifier不得改写已签名 outcome。若相同 target ID的不同
完整 target/public projection bytes仍作为两个 resolved outcomes进入 projection，
则整份拒绝。
Discovery Result不是可自由填写的第二份结论：其 `targets`只能是所有 resolved
outcome完整 target的 sorted unique投影，`unresolvedObservations`只能是所有
unresolved outcome的 sorted unique投影，且重复的 bundle/cut/observation set
digest必须 byte-identical。Bundle先签名，Result后签名；二者都不反向 pin后继，
构造顺序无环。

本 point closure中 Taxonomy、Matrix、Input Bundle与 Discovery Result由调用方已
point-admit的同一 active registry root key分别以独立 domain验证；发行物
`distributionRootBinding`不引入另一把隐式 signer。Discovery Runner的
`runnerProfileDigest`只与 Runner Pin/Envelope/payload闭合，不要求等于 real-FS
Suite runner profile digest。Fixture/Runner records允许 canonical empty且本层不
增加 per-source 4096 cap；Matrix/Result既有4096项上限与所有 Envelope/嵌入 Bundle
的16 MiB canonical cap保持不变。本层只做 materialized size admission，不宣称
resolver parse前 streaming gate，也不从 generation字段推导 predecessor history、
current或 anti-rollback authority。

`coverageBasis`不仅复制 discovery ruleset version、七个 required dimensions、
三个固定 observation source及 count/set digest，还必须 exact pin独立签名、
固定 locator的 Release Matrix与 Target Discovery Result，并复制嵌入式 input
bundle content digest、observation cut digest与 observation set digest。reader先验证两份
Envelope的 pin/outer/payload generation与 content digest、各自 predecessor chain、
独立签名 domain、`activeRootMetadata/registryRootKeyId`及 Taxonomy pin都与
Universe byte-identical，再从两份完整 `targets`分别按
`provider-release-target-entry-set-v1`重算 count/set digest，先要求各自
payload的 `targetCount/targetSetDigest` exact-equal，再要求 Universe
coverage basis复制的 `releaseMatrixTarget*`/`discoveredTarget*`字段
byte-identical；Discovery payload与 basis的 `unresolvedObservationCount`都必须
exact-equal完整 typed `unresolvedObservations.length`，并重新验证嵌入式 Bundle
签名与 deterministic projection。Matrix、Discovery payload与 Universe
`coverageBasis`中的 `limits`必须 byte-identical，其中16 MiB必须 exact-equal
distribution root history policy的 single-object canonical-bytes cap，两个4096
target cap必须
分别约束单 artifact与 canonical union；reader在JSON parse前先拒绝超过
16 MiB的 Envelope，再分别执行
target最多4096项、unresolved最多4096项的count admission，不能先分配无界数组后
才检查。

Universe `targets`始终必须等于两份输入 target的canonical streaming sorted
union；merge一旦遇到第4097个 unique target立即 fail closed，即使两份输入各自
不超过4096也不能先分配8192项或签出 oversized Universe。同一 target profile ID
出现不同完整 target/public projection bytes时整份拒绝，不能以 `incomplete`
降级掩盖冲突。coverage resolution是下列唯一总函数，producer无权自选：

1. unresolved中只要出现 `taxonomy_mapping_unresolved`，resolution必须是
   `{state:"incomplete",reason:"taxonomy_mapping_unresolved"}`；
2. 否则 unresolved非空时必须是
   `{state:"incomplete",reason:"target_discovery_unresolved"}`；
3. 否则 Matrix与Discovery target bytes不完全相等时必须是
   `{state:"incomplete",reason:"release_matrix_incomplete"}`；
4. 只有两份 target bytes完全相等且 unresolved empty时才是
   `{state:"closed_world_complete"}`。

complete时所有 bucket都必须 `closed_world_complete`；incomplete时**所有**
bucket都必须 `incomplete`且使用 coverage basis同一个派生 reason，不存在未定义的
“相关 bucket”子集。无 unresolved且两集合相等却声明 incomplete、条件不满足却声明
complete、bucket reason不同或 incomplete bucket漏项都拒绝。missing input、
locator alias、stale generation、签名 domain替换、outer/payload不等或仅提供
不可解析 digest均 fail closed。Universe由 active root使用独立 domain签名，
Catalog无权自行增加完整性声明。

Catalog `targets`必须按完整 target bytes与 Target Universe `targets`一一 exact-cover，
不得 missing/extra/duplicate/substitute；Catalog pin的 Taxonomy必须与 Universe pin
byte-identical。任一 Universe target缺 Catalog group、Catalog多出 target、bucket
partition遗漏/重复、Universe target/public ID不等或 coverage basis无法验证，整份
Catalog fail closed。这样 failed/read-only target不能靠从 Catalog省略而把同一
public bucket抬升为 strong。

`ProviderFeasibilityTargetV1.targetProfileId`只按其余七个 target claim的
`provider-target-profile-id-v1`完整 SHA-256重算；它不含 volume UUID、mount
path、username或 endpoint。catalog按 target profile分组，target groups按
targetProfileId排序且unique，每组 candidates按 provider ID排序且unique；因此
同一真实 profile的 old/new provider可在迁移期并存，不会被错误视为 duplicate。
每个 candidate携带 provider ID、exact Evidence pin、完整 strict semantic
policy、root-signed runtime attestation pin与 root-signed
`releaseDisposition`；candidate的 Evidence target必须与 group target八字段
（ID+七 claims）exact-equal。catalog顶层保存完整
root-signed QA/Release public-key history、active IDs与 compromise revocations。
Evidence signature内 key ID必须按 role命中一个未撤销 historical record，
QA/Release key互异；enabled provider registry的 `feasibilityApprovalKeys`必须
与 current catalog该完整对象 byte-identical。catalog可显式列出
`passed/failed/unsupported` Evidence；reader以 candidate内 policy/runtime关闭
Evidence的 policy/runtime digest和全部跨对象等式，再验证 ID/content、双签及
隐私规则。

每个 owner-only七字段 target group先按下列总函数生成 internal capability，再由
四字段 public bucket保守聚合为唯一 strict
`ProviderFeasibilityPublicSupportV1`：

- 任一 candidate的 `releaseDisposition="strong_read_write"`只允许其 Evidence
  `result="passed"`；
- Evidence为 `failed/unsupported`时 release disposition必须是
  `legacy_redacted_read_only`；passed Evidence也可由 Release显式保守地保持
  read-only；
- Universe内每个 target的 Catalog group有至少一个通过全部闭合验证的 strong candidate时 internal group
  capability为 `strong_read_write`，否则为
  `legacy_redacted_read_only`；Universe没有该 public bucket时不生成公开行，不能
  默认宣称 read-only；Universe已有 target而 Catalog没有 group则整份 Catalog
  无效。Release要保守关闭一个
  target时必须把该 group全部 candidate显式标为 read-only。

公开行只复制四个非敏感 target字段，并按这四项重算
`ProviderPublicSupportProfileIdV1`；不得暴露、截断、加盐复用或以其它别名复制
owner-only七字段 `ProviderTargetProfileIdV1`，也不得从 build/feature/mount
profile digest猜测 family/code。多个内部 target group投影到同一 public profile
时，以 Target Universe bucket为唯一 membership，先按其完整
`targetProfileIds` bytewise排序，再以保守总函数聚合为唯一 public row：只有
`coverageState="closed_world_complete"`且 bucket内**每一个 universe-covered
target**都具备有效 strong candidate才输出 `strong_read_write`；coverage为
`incomplete`或任一 group为 read-only则整行
`legacy_redacted_read_only`；不得用行数或顺序泄漏内部 profile数。公开行不能包含 owner-only catalog/evidence ID/content
digest、attestation、provider ID或 signer key ID。公开 support row只表达发行
支持策略，**不授权 Store I/O**；实际 strong mutation仍必须由当前完整有效的
Acceptance active-writer selector为本机完整七字段 profile选择唯一 enabled
registry entry、exact pin同一 Evidence/policy/runtime并通过所有
revocation/cross-equality Gate。registry缺失或无效时返回
`provider_unavailable`且零写，不能篡改 catalog projection来伪装本机可用。

普通 signing-key rotation只可 append新 public-key record、更新 exact usage的
active key ID并保留旧 key为 historical verification；只要任何 persisted token
仍引用旧 key，provider registry与安装包升级/降级路径都不得删除该 record。
compromise是唯一允许把 key ID加入
`compromisedRevokedKeyIds`的路径；加入后所有引用该 key的 Store立即
fail closed，必须在 Surface关闭状态执行显式 re-sign/migration，不能把
revoked key当 historical-verify-only。binding-derivation generation更严格：
普通 binary/runtime/signing-key upgrade不得改变
`activeBindingDerivationKeyGeneration`，provider必须持续保留并可在线重验所有
仍被 binding引用的 historical secret generation；若该 secret compromise或
必须换代，只能注册新 provider identity/policy并执行双-provider、全对象
rebind migration，旧 generation在引用清零前不能删除。registry entry或 token
只携带 public key/commitment；private material绝不通过 IPC、日志、error或
workspace文件暴露。

provider必须同时证明：

- generation-aware identity在对象存活/rename时稳定，在 unlink/recreate（即使
  device+inode/file ID复用）时变化；固定 final locator可跨 restart no-follow
  重验；已 durable记录且 `allocationState=absent`的 opaque staging locator只
  能幂等 allocate一次，之后跨 broker/process/OS restart query/reopen**同一个
  未发布 object**，同 locator绝不增加 object count/bytes；
- regular file与 directory都可通过 exact opened staging authority发布；公开
  API不接收 source pathname/name。实现若在隔离域内部使用 source entry，必须
  证明 workspace writer无法 enumerate/rename/link/swap该 entry，且操作结果
  exact-equal传入 handle；
- publish在**同一个原子 commit**中验证 held destination parent仍沿 exact
  generation-aware ancestor chain属于 bound Store root，并验证
  `relativePathComponents`与 `ancestorBindings`数量相等、按 root→parent 顺序
  一一对应每个 component/current binding、最后一个 binding exact-equal held
  destination parent；再把 exact object no-replace连接到 absent final entry。
  parent/任一 ancestor在 precheck后被移出 root、在 root内改名/换层、
  rename-exchange或换 binding都必须以
  `parent_path_projection_changed`/containment reason在 namespace mutation前
  not-committed，post-check不能补救；
- external intent fixed locator提供上文 monotonic atomic compare-replace；
  handoff journal的每次 enumerate返回 transaction-scope complete snapshot与
  opaque namespace-version token，每次 append原子 compare expected version +
  unique tip并 no-replace，terminalized compare-replace还能在同一 provider
  transaction中 compare exact proof tip/version并永久 seal journal；delete若
  启用也必须在同一原子操作内完成 exact object compare、bound-root
  containment与 delete，否则固定 disabled。

raw handle有固定编码/上限且永不持久化。每个声明支持的 OS/filesystem必须通过
real-FS crash、restart、directory publish、parent-escape与同 UID hostile
fixtures；mock/unit policy不能注册 production provider。stock
`renameat2/renameatx_np/linkat/unlinkat` 或普通文件系统 adapter若不能证明上述
directory/source isolation与 atomic containment，必须标记 unsupported；此时
macOS/Linux产品仍可提供 legacy/redacted read-only Surface，但 strong Store
write capability在 revision 0之前 fail closed。不得持久化 epoch-only handle，
也不得降级为 pathname、device+inode、file ID、`st_gen`、btime/ctime、size、
digest或HMAC授权。

`providerPolicyDigest`只 pin稳定 semantic protocol，不能包含会随发布变化的
implementation/binary digest；current registry entry必须证明运行时 attestation
仍实现 exact semantic digest。正常 upgrade/downgrade可原子切换到另一份
signed、未撤销且 real-FS conformance通过的 runtime attestation，旧 binding
token保持可重算；切换前后 broker/OS restart E2E必须读取同一对象、staging
locator、external revision与 journal cut。若 semantic policy变化，则必须注册
新 provider ID/policy并在 strong Surface关闭时执行显式双 provider migration，
或 side-by-side保留旧 provider；绝不能把 binary升级伪装成 binding token
rotation。registry signing key custody、entry compare-replace、rollback/revoke、
安装/卸载与 crash recovery必须纳入独立 provider-feasibility Gate，未通过的
签名 target profile，或当前物理 volume runtime不 exact-match该 profile时，
只开放 legacy/redacted read-only；Evidence/Surface不固化物理 volume身份。

该 Gate的公开失败只映射为
`ProviderUnavailableToolErrorV1`：details除一个 allowlist reason外无其他 key，
不得泄漏 provider locator、IPC endpoint、absolute path、owner、key ID或 raw
attestation。legacy/redacted read-only Repository Surface与 WP8 CLI
`understand-code doctor --provider`（不是新增 MCP Tool）可以继续；既有 strong
Store无法重验时的读取，以及 create/update/check/verify/refresh/rebase全部在
私有仓库数据暴露或首个副作用前零写返回 `provider_unavailable`。Host不得自动
重试、自动迁移、自动安装或把结果降级成无证据 Task。

revision-0 external envelope已先 durable保存 Store-root
`allocation_planned`；provider随后只能按该 operation nonce/locator幂等查询或在
provider-private、对普通 filesystem namespace不可见的 staging中创建0700
directory，并取得
`TransientStoreObjectAuthorityV1`与 durable binding；随后 external envelope
compare-replace到 `phase=store_root_created`，持久化
`StoreRootPublicationContextV1`及
`StoreProviderHandlePublicationProgressV1(state="staged")`，且 nonce/locator
必须与 revision 0 byte-identical。crash在 allocation commit与该
compare-replace之间仍可从 revision-0 locator query/claim exact object；重复
recovery不得新分配或形成 unmetered orphan。它以 workspace
root同时作为 bound-root与 destination-parent authority，调用
`StoreProviderAtomicPublishRequestV1` no-replace发布 `.understand-code`；每个
`staged → published → final_identity_verified`结果都通过下一 external
revision保存，最终 state还必须 pin provider operation receipt与 atomic
containment proof。broker/process/OS restart时，staged/published state用记录的
provider staging locator与 deterministic operation nonce查询 exact outcome；
final locator absent则只能重开同一 staging object继续，final present则必须证明
它就是同一 binding，不能重分配。legacy migration planned分支不产生或接受该
publication progress。broker restart后 final-verified root还必须从 final
locator重新 no-follow open并由同一 provider重算 durable token；binding不等即
fail closed，不能 rotate或生成新 token。
marker 任何物理写之前，external intent 必须先 durable 进入
`phase=marker_planned`，保存 exact canonical marker bytes、final absent
precondition、完整 `StoreBootstrapWriteSetPlanV1`，并让每个 write 的首个
attempt durable 处于 `temp_planned`。marker plan的 `directories=[]`、
`stagingBase="provider_private"`，provider ID/policy digest必须等于 preflight
选择；staging locator只是 provider-private opaque ID，不是 Store path或
directory entry。marker 达到
`final_identity_verified`、fsync marker/root/workspace parent并重新验证 HMAC
后，才可进入 `marker_published`；marker 验证前不得创建其他 Store 文件。

所有 marker/genesis/identity-bootstrap/identity-activation write set 统一使用
同一 crash-safe 协议。directory与 file ordinal各自 contiguous；directory按
parent-before-child拓扑排序。`finalParent=store_root`要求 `finalPath`恰为一个
segment；`planned_directory`要求引用 ordinal严格小于当前 directory（file则在
range内）、且 `dirname(finalPath)` exact-equal该 directory plan的
`finalPath`；`verified_existing_directory`要求 `dirname(finalPath)`等于其
`path`，并固定 durable binding、owner、0700 mode、产生它的 historical
write-set digest/plan token与 `sourceDirectoryOrdinal`。current intent中必须
恰好一个严格早于 current write set 的 historical plan匹配 digest/token；
其 `directories[sourceDirectoryOrdinal].finalPath`必须等于 parent path，
对应 progress的最后且唯一 terminal attempt必须
`state=final_identity_verified`，其 `finalDirectoryBinding`、parent wire field
与当前 no-follow handle重算的 binding三方 exact-equal；current/future/self
reference reject。`planned_directory`同样要求 plan/progress ordinal相等，
对应 progress的最后 attempt final-verified，file不得在此之前 durable进入
`temp_planned`。所有 directory/file final path全局 unique，
`(role,finalPath)` tuple unique；`*_quota_node` role允许在不同 final path重复，
不能把 role本身误当 unique。每个 write set固定
`stagingBase="provider_private"`并 pin exact provider ID/policy digest；每个
attempt使用独立 `provider-staging:<nonce>` locator和 transient opened-object
handle。locator只用于 provider内部审计与 retry equality，不能被解析为 Host/
Store path，普通同 UID进程也不能列举、替换或发布该 staging object。

`preSealBindingDigest` 先覆盖完整 write-set skeleton，但排除自身、
`writeSetDigest/planToken/sealedCanonicalBytes/sealAadDigest`；nonce、
plaintext length/check token、directories、path与 precondition仍在 skeleton。
随后才可封装 secret；最终 `writeSetDigest`覆盖除自身与 `planToken`外的完整
strict plan，installation-keyed `planToken`最后绑定 transaction、
repository/worktree、policy、pre/post quota root、Transition head、Manifest
digest及 final write set。顺序唯一为 `bindingContextDigest →
preSealBindingDigest → AEAD seal/AAD digest → writeSetDigest → planToken`，
任何固定点迭代或字段回填都 reject。非 secret输出必须在外部 intent保存 exact
canonical bytes，不得只保存 digest/size；
32-byte equality key 必须保存 HKDF-SHA256 domain
`store-bootstrap-secret-recovery-v1` 派生 key 所封装的
XChaCha20-Poly1305 ciphertext、24-byte nonce、AAD digest与 plaintext check
token，raw key 不落 intent。HKDF salt固定为
`sha256(canonical JSON(["store-bootstrap-secret-recovery-salt-v1",
{installationIdentityGenerationId,transactionNonce}]))`，info为上述 ASCII domain，
输出32 bytes。AAD 必须 exact绑定 transaction、identity、role、provider
ID/policy digest、final path、`preSealBindingDigest`和 pre/post state；它明确
不含 final `writeSetDigest`，也不绑定可重试的 provider staging locator。
recovery只能重放该 sealed/canonical payload，禁止用当前时间、当前 policy或
新随机 key重建。
`bindingContextDigest` 必须由这些 parent semantic fields重算；progress
`writeSetDigest`必须等于 plan，directory/file progress分别按 ordinal
exact-cover每个 plan。每个 attempt ordinal从0连续递增；除最后一个 attempt外
只能是 `abandoned_unowned` 且
`failure.recoveryDirective` 为 `retry_new_attempt` 或
`retry_after_containment_revalidation`。最后一个可以继续、final、
`published_quarantined`，或以 `fatal_conflict/migration_required` 停止；
fatal/migration 分支永久禁止 successor attempt。`published_quarantined`
已证明 publish committed，必须保留全部
temp/parent/final binding、content proof、containment/operation receipt且禁止
新 attempt。canonical payload只能使用
content-digest proof，sealed key只能使用 keyed-check proof，表外组合 reject。
intent common `quarantineEntries`必须与 marker、genesis、bootstrap、
activation及全部 append-only ledger-generation write progress中的、确实对应
全部 `abandoned_unowned.failure`，以及 post-publish
verification/continuity failure的
`published_quarantined` attempt双向 exact-cover；published entry必须原样保留
final binding与两种 provider proof，provider not-committed entry必须原样保留
`outcome/reason/providerOperationReceiptToken/recoveryDirective`。provider-private staging在
identity durable前丢失时没有 namespace pathname且由 provider自动丢弃，不得
伪造 quarantine entry。每个 entry token重算，缺失、多余或
target/ordinal/provider locator/observed final path不等均 fail closed。

每个 directory/file开始前，required parent必须已经
`final_identity_verified`；verified-existing parent还必须按
`sourceDirectoryOrdinal`解析 historical terminal attempt。runtime从已绑定
Store-root handle逐 component no-follow打开 destination parent，由 provider
从这个 live handle重算 durable binding，并持续持有同一
`TransientStoreObjectAuthorityV1`直到 final fsync。禁止 close/reopen、绝对
路径拼接或把后续 pathname解析结果升级为 authority。允许在 create/publish/
final-verify前后从 bound Store-root做**只读 continuity observation**；它只可
发现 mismatch并 fail closed，不能选择新的 parent、授权 publish/final-open/
delete，也不能替代持续持有的 parent handle。held parent本身也不是 containment
证明：每次 publish/delete request必须同时传入 live bound-root authority、
destination-parent authority、canonical relative parent chain及各 ancestor
durable binding；provider在 namespace mutation的同一 atomic commit内验证
exact ancestry并返回 containment proof。parent在最后 observation后移出 root
时必须得到 `not_committed/parent_not_contained_by_bound_root`且零 namespace
side effect。PRD/G0所称“禁止 path fallback”均按此语义解释。

directory attempt固定为：

1. external intent先 fsync `temp_planned`，其中只保存 provider-private staging
   locator；此时 namespace中没有 temp entry；
2. provider分配不可列举的0700 directory staging object并返回 exact live
   handle，writer重算 durable binding，把它与 held parent binding一起 fsync为
   `temp_identity_recorded`；
3. provider API以 `StoreProviderAtomicPublishRequestV1`传 exact opened staging
   authority、live bound-root/parent containment context与 final
   single-component name执行 atomic no-replace publish。API不得接收 source
   pathname/name，底层若只能提供 `renameat2/renameatx_np` source-name语义或
   不能在 commit内验证 ancestry，则 capability unsupported，不能 fallback；
4. committed result必须满足
   `attempt.attemptNonce == result.requestDurableProjection.operationNonce ==
   operationReceipt.claims.operationNonce == containmentProof.claims.operationNonce`；
   final binding、
   containment proof与 operation receipt必须先通过 external intent
   compare-replace durable写为 `published`；crash后按同 nonce查询只能得到同一
   result，缺失/篡改 token不能跳到 final；
5. 经同一 held parent handle no-follow打开 final，由 provider证明 final
   durable binding等于 staging binding，再 fsync final与 destination parent，
   最后 durable写 `final_identity_verified`。

file attempt固定为：

1. durable `temp_planned` 前完成 parent gate；planned/verified-existing mapping、
   provider policy或 binding任一不等时零物理写。recovery必须重新 no-follow
   open并由 provider revalidate，不能复用旧 broker epoch结论；
2. provider-private分配 **0-byte** 0600 regular staging object；payload仍禁止，
   writer在 held handle上验证 owner/type/mode/nlink/size并 durable写
   `temp_identity_recorded`；
3. 只经该 exact handle写 plan bytes、fsync并前后重验 provider binding和 held
   parent authority，再以 digest或 keyed check写 `temp_payload_verified`；
4. 可选只读 continuity observation若 mismatch则在 publish前 fail closed；否则
   provider以 `StoreProviderAtomicPublishRequestV1`把 exact opened staging
   authority、bound-root/parent containment context与 final name作为完整输入，
   执行 contained handle-addressed no-replace publish。所有 Store Manifest
   generation也只走该 provider API的新 absent path；禁止 source-name rename、pathname
   replacement、link-by-name、`RENAME_EXCHANGE/SWAP`后检查或伪装 filesystem
   compare-and-swap；
5. committed result必须满足
   `attempt.attemptNonce == result.requestDurableProjection.operationNonce ==
   operationReceipt.claims.operationNonce == containmentProof.claims.operationNonce`；
   final binding、
   containment proof与 operation receipt必须先 durable写为 `published`；
   recovery只能按同 nonce取回 byte-identical result，不能凭 final bytes猜测；
6. 经同一 held parent handle no-follow打开 final，provider证明 binding等于
   durable staging binding，bytes/proof等于 plan；publish后的 continuity
   observation仍只可报错，不授权路径切换。fsync final与 destination parent后
   才 durable写 `final_identity_verified`。

provider staging在 `temp_identity_recorded` durable前崩溃时从未进入普通
namespace，由 provider按未发布 handle生命周期自动丢弃；它不是 quarantine
pathname。identity durable后若 provider authority丢失或 binding无法重验，原
attempt标成 `abandoned_unowned`并保留 provider locator审计，新 attempt必须先
durable计划；不得按 device+inode/file ID、`st_gen`、btime/ctime、bytes、
digest或HMAC恢复 authority。provider返回 `not_committed`时，attempt必须保存
exact operation receipt及下列唯一总映射：`final_not_absent →
fatal_conflict`；`root_or_parent_authority_changed`、
`parent_not_contained_by_bound_root`、`parent_path_projection_changed →
retry_after_containment_revalidation`；`staging_authority_changed →
retry_new_attempt`；`provider_policy_changed → migration_required`。只有两个
retry directive可追加新 attempt；containment retry前必须把原 frozen bound
root、destination parent、relative components、ancestor bindings、final name
与 provider policy byte-identical重验，任一不等则停止而不能换当前 pathname
继续。final entry collision形成未发布且 terminal 的
`abandoned_unowned/fatal_conflict`；publish committed后 final
identity/continuity失败形成
terminal `published_quarantined`，必须保留 source plan、target、provider
ID/policy/locator、temp/parent/final binding、content proof、operation receipt、
containment proof与 observed final path。provider contract禁止 unknown outcome，
不得用“可能发布”reason代替 committed/not-committed查询。race winner的
bytes/link/mtime从未被移动、覆盖或删除。terminalize前 scanner只接受 live
external intent精确列出的
final collision/tombstone；provider-private staging永不进入 repository scan。
terminalize后只能从 active binding→unique Manifest tip→terminal head定位
receipt与可选 ledger，禁止扫描 Store root挑选任意 token-valid ledger。

每个 atomic-publish result都必须验证 receipt signed claims：
`attempt.attemptNonce == result.requestDurableProjection.operationNonce ==
operationReceipt.claims.operationNonce`，且 committed branch还要求该值
exact-equal `containmentProof.claims.operationNonce`；operation、provider policy、
request durable projection、outcome与 strict `failure`均和 frozen request/result
byte-identical。
`not_committed` claims/union禁止 final binding与 containment proof；
`committed`必须包含并互相绑定两者。同 operation nonce跨 broker/process/OS
restart必须返回 byte-identical result与 receipt token，任何 reason/directive/
successorPolicy
错配、receipt prefix替换或 extra claim都 fail closed。`fatal_conflict`对外固定
映射 `provider_unavailable/initialization_not_terminalized`，
`migration_required`映射 `provider_unavailable/migration_required`，内部
doctor才显示 recovery directive。

这里的 byte-identical result只指
`StoreProviderAtomicPublishResultV1`的**durable projection**：完整 request
projection、final durable binding（committed时）、proof与 receipt；它绝不携带
`TransientStoreObjectAuthorityV1`中的 broker epoch/handle nonce。调用方如需
继续持有 final handle，必须在同一 live call中接收不序列化的 companion
authority，或在 restart后用 final durable binding通过独立
`reopenExactObject` API在线重验并取得新的 transient authority；新
authority允许 epoch/nonce变化，但不得改变 durable result/receipt claims。
所有 post-call progress，包括 published/final/quarantined/provider
not-committed，都保存完整
`StoreProviderAtomicPublishDurableRequestProjectionV1`，因此 restart无需内存
即可重算 receipt message。

`StoreProviderAtomicPublishFailureV1`是六个 `.strict()`分支的唯一权威；reason、
recovery directive与 successor policy不能拆成三个独立 union再组合。
`StoreProviderAtomicPublishCommittedEvidenceV1`中的 receipt/proof claims必须分别
由 `Extract<..., atomic_publish+committed>`收窄；proof/receipt Envelope的
provider/usage/key ID、request的 nonce/policy/root/parent/staging/path/name、
final binding与 canonical pin `fileBinding`逐字段 exact-equal。Pulse、Artifact
Manifest、Store Manifest pin都保存这份完整 evidence，裸 signature token不能作为
可持久 trusted proof。historical operation/containment key正常轮换后继续按 token
所 pin key验证；receipt或 key缺失/撤销使引用它的 strong chain fail closed。

Store root、terminal receipt、handoff genesis、普通 directory/file及每个
Store Manifest candidate统一使用上述六 reason状态机。
`StoreProviderHandlePublicationProgressV1(state="not_committed")`必须 durable
保存完整 request projection、staging binding、receipt与同一个 strict failure；
successor policy；两个 retry directive只能创建一个连续 ordinal的新 attempt，
fatal/migration永久无 successor。每个 publication site、每个 reason都在
provider return前/后与 progress durable前/后注入 crash并做10k restart；不得因
公共 progress union没有 outcome而卡在 staged或重复发布。

rollback/GC/delete不得调用 `unlinkat(parentFd,name)`、pathname remove或“先
fstat再删除”。只有 provider policy明确支持 atomic
handle-addressed compare-delete、调用时 exact live object/parent authority与
durable binding仍一致时才可删除；否则 delete authority为 `disabled`，对象
保留并计入 bounded quarantine/control state，等待显式人工维护。publish后
post-publish parent/final mismatch固定
`store_bootstrap_post_publish_quarantined`并保留 external
intent；`abandoned_unowned`与 `published_quarantined`永不经 name-based
cleanup。
任何启用的 delete在调用 provider前必须先把
`StoreProviderCompareDeleteProgressV1(state="planned")`及 exact durable request
projection写入独立 immutable
`StoreProviderCompareDeleteRecordEnvelopeV1`，并由 owner transaction
marker/operation journal exact pin planned record ID/content digest；
`operationNonce`、root/parent/ancestor/target binding、name、authorization
read-set与 request token均先 fsync。record使用 fixed transaction/target/ID
locator、provider no-replace发布，单条受1 MiB control-file cap、总量进入
control-state count/bytes。planned record发布本身不授权 delete：必须先提交一个
`phase_update` quota Transition，在 `compareDeletePlanPins`中 pin locator、
planned record、request digest/nonce，并把该 plan放入 current control-state
leaf/Manifest tip；只有从 current tip重验该 pin后，runtime才可从这些 fields
重建 transient authority并调用 compare-delete。crash在 record publish与
phase-update之间只留下 unrooted garbage，recovery不得枚举采用或调用 provider。
provider返回 committed/not-committed后，必须追加 exact
predecessor的 immutable resolved record，保存 byte-identical request与 operation
receipt（committed还必须有 containment proof），才可推进 quota Transition、
移除 entitlement/marker或报告 cleanup成功；该 Transition必须保留
`compareDeletePlanPins`并在 `compareDeleteResolutionPins`中 pin
planned/resolved records及 exact outcome。只有 committed分支可携带
containment proof并移除 target ownership；not-committed分支必须保留 target与
active plan，等待显式恢复/人工处理。crash后从 current Manifest/control-state
root枚举 planned pin，再沿 planned→resolved链以同 nonce查询；path
absent但没有 committed receipt不能冒充己方删除，not-committed也不能清除逻辑
ownership。delete capability为 disabled时可在首次建立计划前零 IPC直接保留
对象；若 policy允许调用 provider确认 disabled，则 provider的 signed
`delete_disabled`必须使用 shared
`StoreProviderAtomicCompareDeleteNotCommittedReasonV1`并原样进入 runtime
result、durable progress与 resolution pin，固定 directive为“保留并继续计费”。
两种模式由 policy固定且有 golden test，不能在层间丢失该合法 outcome。
outcome/reason/proof optionality不满足 strict union即 fail closed；resolved
record/Transition pin不得 GC。

marker durable 后，任何 genesis node/root/Manifest-generation temp 创建前，external intent
必须先 fsync `phase=genesis_planned`。`StoreGenesisBootstrapPlanV1` exact-cover
七类 typed empty constants、全部物理 node/root、`chainState=genesis`
Manifest generation canonical bytes及其 initial `temp_planned` progress。只有
root与 generation所有 write 均 `final_identity_verified`，且 genesis generation 已成为
commit point，才进入 `genesis_published`；commit point 可见后只能 finish，
不得回滚 genesis。ownership marker、genesis root/node与 current Manifest
generation 属于独立、
严格有界的 bootstrap/structural store，不进入自身 Merkle universe。

Store Manifest从 genesis起只允许
`.understand-code/private/store-manifests/<encoded-generationId>.json` 的
append-only immutable `StoreManifestGenerationV1`；generation ID/path由 strict
payload重算。它的并发 commit不是“在不同 child path分别 no-replace后再找
unique tip”，而是 provider-side
`StoreManifestCompareAppendRequestV1`：candidate先在 provider-private staging
完成 canonical bytes/fsync，provider在**同一原子事务**中 compare expected
namespace version/head、验证 candidate direct predecessor与完整 quota/Artifact
pins、把 exact candidate no-replace连接到 final locator、更新 authenticated
complete generation set和唯一 head，签发 state-version token，并在同一事务
写入固定 semantic locator的 immutable
`StoreManifestCompareAppendReceiptEnvelopeV1`。receipt保存完整 durable request，
`requestContentDigest`只按 `store-manifest-compare-append-request-v1`覆盖该 strict
request重算；outcome只保存本次 committed head+appended entry或 compact
observed-head failure，不嵌完整累计 enumeration。provider不能
提供 publish+head compare-append单事务时 strong Store unsupported。
receipt outer/payload provider/policy/repository/worktree/nonce/resolvedAt必须 exact-equal，
content digest按冻结 payload domain重算；其中 operation-receipt Envelope的
provider/usage/key ID与 claims request digest/request/outcome/resolvedAt又必须和
payload逐字段相等，禁止只验外层 signature token。

genesis只有 `predecessor.state=genesis`；每个后继必须 exact pin前一 generation
ID/content digest，且其 Manifest transition head与对应 Transition record链
一致。request outer nonce必须与 candidate publication request nonce exact-equal。
同 operation nonce+byte-identical request的 response-lost必须返回首次 receipt
原始 bytes，即使 current head已继续前进也不能换成 later head；同 nonce异 request
固定 `operation_nonce_request_mismatch`并返回 existing receipt，零 namespace/
object/count/bytes变化。每个 enumeration entry的 `commitOperationNonce`必须解析
到 committed receipt，receipt中的 appended entry/head与该 generation exact闭合；
两个 writer从同 head竞争时只有一个 committed，loser在 namespace内不留下
generation，且其 semantic not-committed receipt先 durable再响应。
trusted reader从固定 head locator取得
`StoreManifestNamespaceHeadEnvelopeV1`，验证 authenticated complete set、连续
chain与唯一 current generation；cached pointer、mtime、filename或普通目录扫描
不参与授权。若 provider enumeration出现 sibling/extra/missing generation，
返回 `store_manifest_fork`并关闭 strong Surface，不能挑
赢家或自动 rollback。每次新 transition把 predecessor generation的 exact bytes
作为 committed metadata计入新 quota root；只有当前 tip作为单个 <=4 MiB
structural commit point暂不自计费，所以下一 generation提交后不得遗留无计费
历史 generation。`open/fstat/read → rename`、
`RENAME_EXCHANGE/SWAP`后检查都不是 CAS，库存 Linux/macOS filesystem不再宣称
`exact_manifest_cas`；只有上述 OS-isolated provider事务满足合同。

Store Manifest operation-nonce ledger/receipt位于 semantic provider policy固定的
provider-isolated append-only root，明确**不进入** Private Store quota root，因而
candidate generation无需、也禁止把尚未生成的 receipt bytes回填到
`currentQuotaIndexRootContentDigest`。provider必须在任何 candidate namespace副作用前
冻结一次 `resolvedAt`、构造完整 prospective outcome/head及 signed receipt、生成唯一
canonical bytes，并以该 exact byte length对
`StoreManifestCompareAppendReceiptLedgerPolicyV1`的 count/total/single-receipt三个 hard
cap做原子 reservation；通过后 reservation、receipt no-replace、candidate publish、
complete set/head advance在同一事务提交。新 nonce容量不足时在 nonce accepted、
staging分配或 candidate发布前零写返回 `provider_unavailable`，不生成无法留存的
semantic outcome；existing nonce replay绕过新 admission并始终返回原 bytes。
ledger accounting自身由 provider policy digest、authenticated count/byte state及固定
locator约束，不能借 Private Store quota扩大或缩小。只要任一 Store
generation、Artifact、Pulse、Task、migration journal或历史 descriptor仍引用对应
operation，receipt、generation、state-version/operation-receipt historical key都
不得 GC；receipt ledger root/object/reference必须进入 migration complete live
universe。trusted reader禁止通过扫描目录或 latest head猜测旧 operation outcome。

Repo Pulse / Artifact Manifest / Store Manifest构成单一三层 commit protocol，
固定路径分别为：

- `.understand-code/pulses/<encoded-version-key>.json`；
- `.understand-code/manifests/artifact/<encoded-generation-id>.json`；
- `.understand-code/private/store-manifests/<encoded-generation-id>.json`。

三个 encoded component都严格走 `StoreFilenameKeyV1`；不得把带 `:` 的 semantic
ID直接作为 filename。Pulse version key只按
`repo-pulse-version-v1{artifactId,sourceSnapshotId,contentDigest}`重算。writer
先以 provider exact-object no-replace发布并 final-verify immutable Pulse
`P_(n+1)`，再发布 `ArtifactManifestGenerationV1 A_(n+1)`；A的 predecessor必须是
current Store tip `S_n`所 pin的 A_n（首次为 genesis），manifest payload digest、
repository/worktree及 Envelope字段全部重算相等。A的
`canonicalRepoPulse=version`时，strict Manifest必须恰有一个 current
`repo_pulse` descriptor，artifact/source/digest/path与 Pulse pin逐字段相等；
`absent` iff cold/error/genesis Manifest没有 current Pulse descriptor，禁止伪造
空 Pulse。Artifact generation pin同时保存 exact file binding、atomic containment
proof与 operation receipt，抵抗 pathname ABA。

最后 writer发布 `S_(n+1)`，其 predecessor exact pin S_n并在
`manifest.artifactManifest`中 pin A_(n+1)；**只有新的 Store Manifest unique tip
才切换 canonical Pulse/Artifact Manifest**。quota-only successor可继承同一 A
pin；正常 Artifact更新只能 pin direct successor，禁止回退 ancestor或从 version
退为 absent。S发布前 crash时 S_n仍 canonical；已发布 P/A只是未授权孤儿，
recovery必须按同 deterministic ID/bytes/locator幂等 reopen，不得目录扫描或
adopt另一个候选。S提交后 response lost按同 nonce/head重验；并发 sibling
candidate只允许一个 commit，任何 authenticated namespace sibling都固定
`store_manifest_fork`，cached current pointer、mtime或
filename不能选赢家。
trusted reader从唯一 S tip验证被选 A的完整 ancestry、provider publication
proof与 Pulse Envelope；任一 chosen S/A/P missing/tamper/corrupt都 fail closed，
不得自动回退旧 S/A。未被 Store tip选择的 A sibling本身不 canonical，也不能
被 scan/adopt；旧 Task Manifest仍可 exact pin并读取历史 P/A，活引用清零前禁止
GC。

随后在任何 identity 文件创建前 durable 写 `identity_planned`。完整
`StoreIdentityBootstrapPlanV1.writeSet` 必须覆盖 sealed equality key、
`IdentityNamespaceBindingIntentV1`、首个 Transition、所有新 quota nodes/root
以及 post-bootstrap Manifest generation的 exact canonical payload、path/precondition、
pre/post root/head与 delta，不允许只有三个叶文件的摘要。每个 semantic phase
中的 `identityBootstrapWriteProgress` 仍必须逐 attempt fsync上面的
`temp_identity_recorded → temp_payload_verified → published →
final_identity_verified`；directory则固定
`temp_identity_recorded → published → final_identity_verified`；
`key_published → binding_intent_published →
transition_published → manifest_committed` 只有对应 prefix全部 final-verified
才可推进。首个 `identity_bootstrap` Transition只计费 equality key与
`IdentityNamespaceBindingIntentV1`，不发布 active binding，也不创建 Task
Admission。

bootstrap Manifest generation committed 后，staging writer 才能生成 strong Snapshot/
Pulse/dependency/full strong Manifest；这些对象在 active binding 发布前不进入
任何 public Surface。full Bundle durable 后必须先写
`activation_planned`，其 exact write set 覆盖 active
`IdentityNamespaceBindingV1`、activation Transition、quota nodes/root与
post-activation Manifest generation。该 Transition发布并计费 active binding、移除
Binding Intent current leaf，并把 `strongManifest` pin到该既有 full
Manifest。只有 activation write set全部 `final_identity_verified` 且
active binding、Transition、post-root/head、Manifest-generation
binding/content digest exact-equal，external intent才 durable 写
`binding_activated`。此状态仍是 recovery-only中间态，strong namespace不得对外
服务，external intent也一律不得删除；存在 tombstone时先进入
`quarantine_ledger_planned`。ledger plan的 write set只能含一个
`quarantine_ledger` canonical file、零 directory，temp与 final parent都必须是
已绑定 Store root；
`quarantineLedgerGenerations`必须从1开始按 generation连续、append-only保留
每代完整 plan/progress；当前 plan是数组最后一项，旧代不能被 digest-only
占位替换，wire generation只能是 literal `1|2|3|4`。ledger final path固定为
`.store-bootstrap-quarantine-ledger-v1.json`；旧代未 final-published才允许
下一代复用该 absent path。
该 file的 final path/content digest/token必须分别 exact-equal
`ledgerPath/ledgerEnvelopeContentDigest/ledgerToken`，payload必须 pin进入
ledger流程前最后一个 durable `binding_activated` intent按
`store-ownership-initialization-intent-v1`完整 strict object重算的 content
digest、Store root binding及 sorted/unique authenticated entries。
generation=1禁止
`supersedesLedgerWriteSetDigest`，后续 generation必须 exact pin上一 plan的
write-set digest；最后一代 ledger payload entries必须 exact-equal intent
common `quarantineEntries`。
publish也必须完成 `temp_planned → temp_identity_recorded →
temp_payload_verified → final_identity_verified`。provider staging在 identity
前丢失不产生 pathname或 quarantine entry；identity durable后若 provider
authority丢失，只允许在无 published ledger final时递增
`ledgerGeneration`、以 `supersedesLedgerWriteSetDigest`连接新 plan并保留旧
generation完整 plan/progress。连续两代及更多 crash仍按全部 history双向
exact-cover。第4代允许完成；第4代再发生需重规划的 provider failure时，第5代
在任何新 provider allocation/ledger side effect前固定零写 fail closed并永久
保留 external intent。

无 tombstone时由 `binding_activated`，有 tombstone时由最后一个
`quarantine_ledger_published`，先构造独立
`StoreInitializationTerminalReceiptV1(state="terminal_receipt_ready")`。receipt
永久保存完整 strict `sourceBindingActivatedIntent` preimage、独立 source
attestation、零代 empty golden或最多4代完整 plan/progress、逐代
plan/progress/entry-set digest与 generation pins/history digest以及可选
last-generation ledger proof；source preimage只出现一次，不再在 outer phase
交叉重复 activated fields。receipt的 `terminalReceiptCreatedAt`、完整
canonical bytes、token与 content digest在任何 receipt/genesis provider
allocation前就已冻结；receipt canonical bytes必须满足 preflight冻结的
64 MiB cap，generation count、tuple length、pins与 common quarantine entries
双向 exact-cover，并以 `store-bootstrap-terminal-receipt-token-v1`认证。

在分配 receipt或 handoff genesis staging object之前，external envelope必须先
compare-replace为 `phase="terminalization_allocations_planned"`，保存 source
`binding_activated` payload digest、**完整 frozen terminal receipt preimage**、
receipt content digest、两个 deterministic operation nonce/provider staging
locator、各自 `providerAllocationState="absent"`及
`expectedHandoffJournalState="absent"`。embedded receipt中的
`sourceBindingActivatedIntent`必须按完整 strict payload重算为
`sourceBindingActivatedIntentContentDigest`，且 outer identity/origin/budget
与 receipt byte-identical；因此 crash在该 revision提交后即使尚未分配任何对象，
也能只从 provider current envelope重建 byte-identical receipt，禁止依赖内存、
扫描 Store或读取未冻结 historical revision。provider随后只能按这两个 locator逐个
幂等 allocate/query；每取得一个 exact object/binding，先把该项
`allocation_planned → staged` compare-replace回同 phase，另一项保持原状态。
crash在 allocation commit与 external update之间仍从已 pin locator claim exact
object，不能重新分配或留下无界 orphan。合法组合只允许
`(allocation_planned,allocation_planned) →
(staged,allocation_planned)|(allocation_planned,staged) → (staged,staged)`；
每次只推进一项，operation nonce/locator/receipt bytes不得改变，不允许回退或
同时跳两项；两项未都 staged前不得构造可发布 plan。

receipt staging取得 durable binding后，writer为初始 plan/progress计算
`StoreTerminalizationHandoffRecordIdV1`与确定性
`StoreIdentityTerminalizationHandoffJournalLocatorV1`，并使用 allocations
phase已 staged的 second object/binding构造 genesis record。genesis必须
保存完整 `StoreIdentityTerminalizationPlanV1`与 current
`terminalizationWriteProgress`，`terminalizationProof`及其 digest均 absent；
record自身的 locator/id/file binding、content digest与
`store-terminalization-handoff-record-token-v1`必须互相重算。摘要顺序唯一为
receipt token → receipt content digest → terminalization plan digest →
progress digest → successor delta digest（genesis absent）→ optional proof
digest → record ID → record token → record content digest；不存在的
delta/proof不产生占位 digest，禁止 fixed-point迭代或回填。

两项 staged且 genesis canonical bytes完成后，external intent才可从
`terminalization_allocations_planned` compare-replace进入
`phase=terminalization_planned`：它只嵌入
一次 receipt target/binding/content digest、完整 terminalization
plan/initial progress，并以 `handoffJournal.state="planned"` pin exact genesis
locator/id/file binding/content digest/token。它还必须分别保存 receipt与
genesis的 `StoreProviderHandlePublicationProgressV1`，其中 staged state
durable pin各自的 provider staging locator/binding；因此 broker restart不能把
durable binding误当 locator，也不能重分配不同 object；两项
operationNonce/locator及完整 receipt/content digest必须与 allocations phase
byte-identical，且该转换只能来自 `(staged,staged)`。installation-state
provider再以 exact opened genesis handle no-replace发布 genesis；每次
`staged → published → final_identity_verified`转换都先重验同一 staging
locator/binding并 durable更新 external intent。从固定 final locator重新打开并
验证 binding/content/token后，`handoffJournal.state`才可变成 `durable`，且
必须与 genesis publication的 `final_identity_verified` exact-equal。
provider随后以相同 publication progress协议把 exact opened receipt handle
no-replace发布到独立固定 terminal-receipt locator。**任何 terminalization
Store副作用前，genesis必须 durable且 receipt publication也必须
`final_identity_verified`**。

跨对象 equality不得只靠“能找到”推断：planned outer
identity/origin/terminal budget必须与 receipt及其
`sourceBindingActivatedIntent` byte-identical；plan的
`sourceTerminalReceiptContentDigest`和 terminal-head receipt
binding/content/token必须等于 staged并最终 published的 exact receipt；
initial progress的 `writeSetDigest`及 directory/write ordinal必须 exact-cover
plan write set。genesis embedded plan/progress及 common中的
receipt/plan/progress digest必须与 outer字段逐项相等，locator/id/file
binding/content/token/publication progress也必须与 external genesis pin一致。
任何 identity、origin、budget、receipt pin、plan或 initial progress交叉不等都
在 genesis/receipt publish前 fail closed。

handoff不是可变 marker，而是 installation-state owner-only namespace中的
immutable append-only journal。genesis保存完整 initial progress；每个 normal
successor只保存一个
`StoreIdentityTerminalizationProgressDeltaV1`，pin同一 receipt/plan digest及
exact predecessor record ID/content digest，并分别承诺 predecessor/result
progress digest。record ID preimage还包含 delta digest、result progress digest
与可选 proof digest。replayer必须从 genesis逐条应用 delta：`before`要与
current target byte-identical，`after`只能推进同一个最后 attempt的下一合法
state，或在前一 attempt已 `abandoned_unowned`且 directive属于两个 retry值时，
以连续 ordinal追加一个 `temp_planned`；containment retry在每次生成/append
successor前必须重新 no-follow打开并由 provider在线验证上述 frozen authority/
projection byte-identical，失败时不生成 successor，crash后重新执行而不持久化
伪造的 observation digest。`fatal_conflict/migration_required`没有 successor；
禁止修改旧 attempt、回退/跳步、同时推进多个 target或保持
no-op。应用后完整 progress digest必须等于 record声明的 result。每个会产生
Store副作用的 attempt必须先有一个 durable tip保存其 pre-side-effect planned
state；副作用后取得的新 progress只能以新 record no-replace追加，绝不能替换
旧 record。

新增 attempt的随机性不能悬空在 journal tip之外：
`attemptNonce`与 `providerStagingLocator` body分别使用独立
`store-terminalization-attempt-nonce-v1` /
`store-terminalization-attempt-staging-locator-v1` owner-HMAC domain，从
`{installationIdentityGenerationId,repositoryId,worktreeId,transactionNonce,
terminalizationWriteSetDigest,targetKind,targetOrdinal,attemptOrdinal}`取前32个
lowercase hex确定性派生；相同 tuple跨 restart必须 byte-identical，不得调用
CSPRNG或当前时间，directory/write的 `targetKind`也不得交叉。

“唯一合法 delta”还由固定 scheduler决定，不能由并发 writer任选 target：
先筛出依赖已满足且尚未 `final_identity_verified`的 target，按
`directory < write`、再按 ordinal升序选择唯一最小者；选中 target必须按其
attempt union只推进恰好一个下一状态，当前 attempt为
`abandoned_unowned`时，只有两个 retry directive可追加连续 ordinal的新
`temp_planned`；fatal/migration必须返回对应稳定错误并禁止跳到后一 target。
全部 target final-verified且 terminalization proof已可重算后，唯一下一
步才是 `proof_only`。同一 tip的两个 writer因此必须选择同 target、同 operation
nonce、同 provider result、同 delta与同 record ID；provider对 operation nonce
返回 byte-identical outcome。不同 target/delta是 invariant violation，不能先
各分配对象再让 journal CAS选赢家。

Schema本身也编码该约束：genesis与所有非 proof successor禁止出现
`terminalizationProof*`；`progressDelta.kind="proof_only"`的 successor必须同时
携带完整 proof与 digest，且其
`resultingProgressContentDigest == predecessorProgressContentDigest ==
terminalizationWriteProgressContentDigest`。proof-only只 seal同一完成态，不得
借机改变 progress；缺 proof、提前 proof、optional-field偷渡或 digest不等均在
record allocation前拒绝。

每个 successor在任何 journal-record provider allocation前，必须先从 current
unique tip确定唯一合法 delta、result progress digest、optional proof digest及
record ID；其
`StoreIdentityTerminalizationHandoffJournalLocatorV1(recordId)`本身就是
provider的 idempotent allocation key。provider只能 allocate-or-reopen该
locator对应的 exact unpublished/final record object，取得
`recordFileBinding`后再构造 payload；所有 record的 `createdAt`固定等于
`terminalization_planned.createdAt`，不产生未持久化新 timestamp。crash在
allocation commit、payload durable、no-replace publish或 journal append任一
cut后，recovery都从 unchanged tip重算同 record ID/locator并重开同对象；同
locator不得增加 object/count/bytes。若已有 canonical payload则必须
byte-for-byte复用，空/partial provider state只能由同 operation恢复或 fail
closed，不能换时间、binding、delta或 locator。只有 record final
binding/content/token重验后才可 compare current namespace-version + unique
tip原子 append；10k次 allocate-before-append crash必须仍只有一个对象和一个
最终 successor。

每条 record都从自身 deterministic locator重新打开并重验 provider
binding/content/token；同 ID retry只允许首次 durable canonical bytes。
delta的冗余 ordinal必须唯一解释：`before.state="present"`时 outer
`attemptOrdinal == before.attempt.attemptOrdinal ==
after.attemptOrdinal`；`before.state="absent"`时 outer等于 after ordinal，且
只能为0或同 target前一 `abandoned_unowned`且 directive属于两个 retry值时的
ordinal+1。fatal/migration分支后任何 ordinal都非法。directory/write ordinal
必须在 plan与 current progress双向 exact-cover范围内，target kind不得交叉。
任一等式不满足即 schema invariant reject，不能由 reader任选一个字段。
journal reader从 external intent pin的 genesis出发，只接受同
installation/repository/worktree/transaction、同 receipt/plan的 exact
predecessor链，并对该 transaction namespace做完整枚举；必须恰有一个 maximal
tip，missing predecessor、同 predecessor sibling、同 ID不同 bytes或多 tip均
fail closed。path re-resolution只能观察，不能授权 record publish/read/delete。
enumeration还必须返回 current journal namespace-version token；normal append
必须在一个 provider transaction内 compare该 token与 exact unique tip，成功后
返回不同的新 token，失败者重新枚举而不能生成 sibling。genesis publish从
`expectedJournalState="absent"`创建首个 version，external durable state pin
其 `genesisJournalVersionToken`。

enumeration/version wire只能是
`StoreProviderJournalEnumerationResultV1`，不能返回无法重算的 opaque token。
`enumeration.records`按 record ID UTF-8 bytes排序且unique，必须 exact-cover
transaction namespace内全部 records；每项 ID/content digest/binding都从 fixed
locator重验后进入 `store-provider-journal-enumeration-v1` digest。claims与
enumeration的 provider/policy/installation/repository/worktree/transaction必须
逐字段相等，`enumerationContentDigest`重算相等，
`recordCount===records.length`，unique tip ID/content必须恰好命中 records并由
完整 predecessor链证明唯一。

genesis open claims固定 `versionOrdinal=0`、predecessor
`{state:"genesis",expectedNamespaceState:"absent"}`、record count=1且 tip为
genesis。每次 normal append固定 predecessor为前一 current token、
`versionOrdinal=previous+1`，enumeration只在前一 sorted set上增加刚提交的一条
record且 tip更新为它；漏项、重排后未 canonicalize、重复、替换旧 pin、跨
namespace token或 previous mismatch均 not-committed。seal不增加 record：
sealed claims固定 predecessor为 seal前 open token、ordinal+1、
enumeration digest/count/unique tip不变，并要求 unique tip就是 exact
proof-bearing record；它使用 sealed domain签名。`versionToken`中的 key ID按
journal-version historical key验证，open/sealed domain不可互换；sealed claims
之后 append或第二次 seal永久 not-committed。

每条 handoff Envelope还必须满足
`Envelope.recordId == payload.id == payload.locator.recordId`；
Envelope repository/worktree/createdAt与 payload exact-equal，locator的
installation/repository/worktree/transaction与 payload exact-equal，Envelope
content digest由 exact payload重算。successor不能依赖 external genesis pin来
掩盖任一重复 identity字段不等。

只有 terminalization Transition与含 terminal head的新 Manifest generation已
从 unique Manifest tip完整验证，且 predecessor replayed progress满足
`writeSetDigest==plan.writeSet.writeSetDigest`、directory/write ordinal与 plan
双向 exact-cover、每个 target最后且唯一 terminal attempt均为
`final_identity_verified`后，tip successor才可同时带
`terminalizationProofContentDigest`与 exact proof；两字段必须同 absent或同
present。每个 final attempt的 parent/final binding、content proof、
containment/operation receipt还必须与 plan、Transition、quota root及 committed
Manifest generation逐项相等；`published`、`published_quarantined`、
`abandoned_unowned`或任何 partial target都禁止 proof/final cut。
proof-bearing successor的 delta必须是 `proof_only`，其 predecessor
与 resulting progress digest exact-equal；normal successor禁止
`proof_only`，proof record必须是 journal terminal tip且禁止再有 successor。
crash在 allocation或 genesis/receipt publish前由 external
`terminalization_allocations_planned/terminalization_planned` intent中
各自的 provider staging locator恢复 exact opened object；任一 locator丢失或
binding变化都 fail closed，不能重分配后改写已 pin的 plan/head。两者 final
verified后由 external pin加 append-only journal恢复，二者
plan/receipt/progress digest不等即 fail closed。receipt发布后永久 immutable，
后续 attempt/progress/proof只追加 journal record并写 Transition/Manifest链，
不修改 receipt。这样
`StoreIdentityTerminalizationPlanV1/WriteProgress/ProofV1`均有可验证的持久化
位置，且 terminalization write使用 provider-private staging，不会在冻结
receipt后产生新的 pre-identity namespace tombstone。

receipt durable且从固定 locator重验 provider binding/content/token后，必须执行
第三个专用 `store_initialization_terminalize` quota Transition。它把
`StoreInitializationTerminalHeadPinV1`写入新的 append-only Store Manifest
generation；head exact pin transaction、source digest、generation count/history、
retained receipt locator/binding/content/token及可选 fixed ledger
binding/content/token，且自身使用独立 terminal-head token。terminal head不含
terminalization Transition ID、post root或post Manifest digest，避免反向 hash
cycle；Transition/root/new Manifest单向包含 head。commit后从 current Manifest
唯一 tip沿
`active binding → terminal head → retained receipt → exact optional ledger`
完整重验，后续所有 Manifest generation必须 byte-for-byte继承同一 head。
只有该链验证通过且 proof-bearing handoff record已成为唯一 journal tip，
provider先按
`store-terminalization-handoff-sealed-version-v1`从 seal前 exact open
`StoreProviderJournalEnumerationResultV1`构造 ordinal+1的 sealed claims：
predecessor为 current token、enumeration digest/count/tip不变、proof tip等于
unique tip，再无环签出 prospective sealed token；
该 token不依赖 terminalized payload/envelope digest，因此可先写入 replacement
payload。provider随后才可在**同一个原子 final cut**中 compare current
external intent revision/token、exact proof tip、seal前 current journal
namespace-version token及该 prospective token，seal transaction journal并把
external intent由
`terminalization_planned` compare-replace为永久 retained
`phase=terminalized`（保存 receipt pin、final handoff locator/id/file
binding/content/token、prospective sealed journal-version token与
terminalization proof）。commit后 provider必须返回并持续报告 payload中
同一个 sealed token，不能事后生成另一 token，
且 strong namespace才可服务；head缺失、receipt/ledger
missing/tamper/rollback、旧 intent replay、额外 token-valid ledger或 Manifest
fork一律 `initialization_not_terminalized`/fail closed且零写。
每次 strong Surface授权都必须重新从 provider读取 current terminalized
envelope，并证明 sealed journal仍返回同 version token与 proof tip；不能只缓存
启动时的 unique-tip结果。`terminalizationHandoffFinalJournalVersionToken`
只能保存上述 prospective/committed sealed token，不能保存 seal前 expected
token；recovery查询必须得到 `sealed=true`、同 token/tip且 append永久返回
not-committed。任何 token变化或 provider无法证明 sealed均立即关闭 Surface。

token重验后到 Store root provider publish之间若 final entry出现，no-replace
必须零覆盖失败且 race winner byte-identical保留。Store root staging在 durable
binding前对 namespace不可见；publish前 binding已 durable，因此 crash不再产生
“可见但无 identity”的 Store-root窗口。provider若不能提供该顺序，初始化必须在
首个 allocation前拒绝，而不是事后 adoption或猜测删除。

legacy Store 只能走 `mode=legacy_migration`：必须由显式
`migrationAuthorizationId` 授权，完整 no-follow 枚举并证明全部 entry 属于
allowlisted legacy layout，保存 owner-keyed `legacyUniverseToken`，final cut
重验后才可计划 marker。其 `legacyUniverseToken/migrationAuthorizationId`
必须由 `StoreOwnershipInitializationOriginV1` 带入 marker 后每一个
genesis/bootstrap/activation/terminalization phase，并在每次 temp create、
publish、Manifest-generation no-replace与 final cut前重验；legacy并非在
`marker_published` 终止。migration 使用
与 new Store 完全相同的 `genesis_planned → genesis_published →
identity_planned → manifest_committed → activation_planned →
binding_activated → quarantine_ledger_planned/published（有 tombstone 时）→
terminalization_allocations_planned → terminalization_planned → handoff genesis
durable → terminal receipt
final-verified → handoff progress successors →
store_initialization_terminalize → proof-bearing handoff tip → terminalized`
后缀，新 strong
namespace必须 absent，旧 universe bytes
始终 immutable/read-only且不得移动、覆盖或冒充 strong quota。未知 entry、
tracked collision、自动 migration、超 migration cap均零写拒绝。Store
ownership marker/intent/quarantine ledger只属于 owner-only control state，
不进入任何 Surface。

`terminalization_planned`与 `terminalized`中的 `initializationOrigin`必须与
receipt所 pin的 `sourceBindingActivatedIntent`顶层 origin byte-identical；
planned→terminalized禁止切换 mode、preflight token、legacy universe token或
migration authorization。两阶段 identity/budget/receipt pin也必须与 receipt
逐字段 exact-equal；terminalized的 final locator/id/binding/content/token/
journal-version/proof必须分别等于 provider sealed unique proof tip及 current
Manifest terminalization proof，任一间接或外层字段不等都 fail closed。

persisted Pulse 使用整包
`LegacyRepoPulseV1 | StrongRepoPulseV1` discriminated reader；新 writer 只写
`profile=repo_pulse_path_safe_v1`。strong Pulse 的 evaluated Snapshot
ID/content digest、三个 HMAC locator、branch/head/state token、scan/SafeGit
digest 必须与 exact committed strong Snapshot 相等。
`changeSummary.total/bySource/byKind` 只包含 safe 与 source/kind 已证明的
redacted change；`security.safeChangeCount/redactedChangeCount/
unknownStateCount` 与两组 fixed-code arrays 必须与 Snapshot exact-equal，
total 只等于前两个 change count，unknown state 不伪装成 change。accounting
五个计数也必须 exact-equal。reason/error/unknown 等自由文本字段在 strong
payload 中不存在，只允许 sorted/unique versioned diagnostic code。raw legacy
Pulse 只给 owner-only integrity/migration reader，非 owner Surface 使用上面的
strict redacted DTO。Repo Pulse、MCP Resource、Workbench 和日志都不得从 HMAC
token 反推、枚举或显示被 redacted 的单位。

`InternalTaskBaselineV1` 使用上面的独立 internal-only Envelope/descriptor type
`task_baseline`，通过 `sourceSnapshotId` 再次绑定 `captureSnapshotId`；它不加入
公开 `ArtifactTypeV1Schema`、MCP Artifact union 或通用 `read_artifact`。
Task/Host 只能读取由 trusted projector 生成的 `TaskBaselineSummaryV1`，其中不含
path、locator、content/private digest、object/lease ID 或任意正文。
`materializationVersion` 是正整数：initial=1，每次成功 rebase 严格 +1，
refresh 不变。Envelope `artifactId === payload.artifactId`，repository/worktree/
task/source Snapshot 分别 exact-equal payload，`taskRevision` 等于创建该
materialization 的 Event revision，contentDigest 重算 payload。固定路径为
`.understand-code/tasks/<taskId>/baselines/<materializationVersion>-<encoded-artifactId>/baseline.json`；
internal managed descriptor 的 path/ID/digest/Snapshot/revision 必须与 Envelope
相等。Artifact ID 使用 `task-baseline-v1` preimage，baselineSemanticDigest 使用
表中 exact projection并明确排除 createdAt、Envelope metadata 与 Git ref
marker nonce；逻辑 lease ID/OID 仍包含。rebase 将旧 descriptor 降为
historical 并由 History root pin，不能覆盖 version/path。
`privateBlobId/privateContentDigest` 只允许 Store 内部 Schema 和 owner-only
ledger 读取。hard-deny/secret unit 不进入 `paths/private_blob`，只增加
`redactedUnits.count` 并引用内部结构化 Boundary；Boundary scope 必须是
`redacted_path_set`。`captureStatus=complete` 要求 pinned
lease（unborn empty tree 除外）、所有候选 path 可重建且
`redactedUnits.count=0/boundaries=[]`；partial 必须至少一个 Boundary。
`capture.status=absent` 只允许且要求 `finalKind=absent`，不携带 Boundary；
其他 capture status 禁止 `finalKind=absent`。`finalKind/capture/mode/object`
组合固定如下，表外组合全部 reject：

| finalKind | 合法 capture | mode / object 语义 |
|---|---|---|
| file | `git_object` | `100644/100755`，OID 必须是 blob；size/digest 验证 raw blob |
| file | `private_blob` | 仅 `100644/100755`；raw regular-file bytes |
| file | `binary/oversized/unreadable` | mode 如存在仅 `100644/100755`，必须 Boundary |
| symlink | `git_object` | 仅 `120000` blob；只读 Git blob 中的 link-target bytes，绝不 follow filesystem link |
| symlink | `special` | 仅 `120000`；dirty/untracked filesystem symlink 不读 target，必须 `symlink_boundary` |
| gitlink | `gitlink_object` | 仅 `160000`，OID 必须解析为 commit；无 size/content digest |
| gitlink | `special` | 仅 `160000` 且必须 Boundary |
| directory | `tree_object` | 仅 `040000`，OID 必须解析为 tree；无 size/content digest |
| directory | `special` | 仅 `040000` 且必须 Boundary |
| unknown | `special/conflict` | mode 缺失、异构 conflict modes 或无法安全分类；必须 Boundary |

`private_blob` 禁止 040000/120000/160000；gitlink/tree 禁止伪装 blob
size/content digest。任何 `capture.status=conflict` 的 `finalKind` 一律为
`unknown`，即使 stages mode 同类也不猜造 final-visible kind；它永远不能
complete。
`GitConflictStageV1` 按 stage 升序、stage unique，OID 长度必须匹配
objectFormat。Repository Snapshot 为
error 且无法确定 HEAD/empty tree、scanner/policy/integrity fatal error 或
Store durable write failure 时不得提交 error baseline，而是整个 Stage 1 零写
失败。Basis 中两个
  baseline pin 的 Snapshot 必须相等，并等于 strong Manifest baseline；Pulse
的 logical baseline 不进入这个 equality invariant。

baseline HEAD 还有以下不可省略的交叉不变量：

- `InternalTaskBaseline.taskId/repositoryId/worktreeId/captureSnapshotId` 必须分别
  等于 Task/`TaskCreationBasisV1` identity/source Snapshot；
  `repositoryStateToken/attributesDigest/scannerPolicyDigest/
  repositoryPolicyDigest/safeGitExecutionDigest/
  baselineMaterializationBudgetDigest/
  privateStoreQuotaPolicyDigest` 与 Creation Basis 精确相等，并分别等于 read set
  中唯一对应的 repository-state/index、八类 `safe_git_control` 与
  attributes/scanner/repository/safe-git-execution/safe-git-isolation/
  baseline-budget/private-store-quota policy entry；isolation policy digest 必须
  再 exact-equal execution profile 内的 `isolationPolicyDigest`。缺失、重复或
  同名不同 digest 全部 fail closed；
- baseline payload/semantic ID **不得**反向保存 Admission ID/content digest 或
  post quota root。quota commit proof 只由同 revision Receipt/Journal/Task
  Manifest pin；Store Manifest pin current root、Transition chain head与已经
  完成初始化时 byte-identical继承的 terminal head；trusted
  Bundle validator 通过 Receipt 指向的 commit Transition delta、Admission
  accepted blob 与 baseline private-blob/Boundary exact-equal，避免 charged
  baseline path 依赖尚未构造的 post root；
- `InternalTaskBaseline.captureSnapshotId` 对应 source Snapshot；
  `baselineHead.present.commit === sourceSnapshot.headState.commit`，object format
  相同，且 `treeObjectId` 必须由该 exact commit 的 tree header 解析得到；
- pinned 时
  `gitLease.objectId === baselineHead.present.commit`，lease ref 解析出的 OID
  也必须相等；unpinned 时 capture 一定 partial；
- unborn 时 source Snapshot 必须同为 unborn，两个 `emptyTreeObjectId` 精确
  相等，并等于 Git 对应 object format 的 canonical empty tree OID；即使该
  object 最初未写入 ODB，也要按 canonical empty-tree bytes 验证，不能从当前
  HEAD 猜造；
- SHA-1 OID 只能出现在 `objectFormat=sha1`，SHA-256 OID 只能出现在
  `objectFormat=sha256`；mixed-length tree/commit/conflict stage/lease 全部
  fail closed。

Stage 1 只使用 `TaskCreationBasisV1`：Pulse 可以缺失，candidate baseline/
lease/blob 是事务输出，不能反向作为前置 pin。Stage 2 与四个 WP5 Operation
使用 full `RepositoryBasisV1`；rebase 的 `priorTaskBaseline` 指向旧版本，
resulting baseline 是 transaction candidate，不进入 pre-commit Basis。
`RepositoryReadSetV1.entries` 的 kind order 固定为
`artifact_descriptor < repository_state < git_ref < git_object < index <
worktree_path < safe_git_control < policy`。同 kind identity key 固定为：

| kind | identity key tuple |
|---|---|
| artifact_descriptor | `[artifactType,artifactId,state]` |
| repository_state | `[snapshotId]` |
| git_ref | `[refName]` |
| git_object | `[objectFormat,objectType,objectId]` |
| index | `["index"]`（每个 read set 最多一个） |
| worktree_path | `[path]` |
| safe_git_control | `[controlKind]` |
| policy | `[policyKind]` |

entries 先按 kind order、再按 identity key UTF-8 bytewise 排序；相同 identity
key 无论 observed value 是否相等都 reject，不能 last-write-wins/dedupe。
digest preimage 覆盖完整 entry values 并排除 `readSetDigest` 自身。
`repository_state.headStateDigest` 必须按
`repository-head-state-v1 + {objectFormat,headState,baseCommit?,mergeBase?}`
从 exact Snapshot 重算，不能使用 undefined provider hash。
Store 在 Task→Repository
锁内、写 marker 前调用 trusted Provider 的
`validateRepositoryReadSet(readSet)` 逐项重读；返回成功的瞬间是 final cut，
false/throw 均零写。`repository_state` 必须重采 HEAD、完整 Index、Worktree、
Untracked 与 ignore enumeration，因此分析后新增、删除或 rename 一个此前未读
path 也会冲突；只比较 opaque token 或只重读已知 path 不算验证。
`worktree_path.fileKind=file` 要求 mode/size/contentDigest 全部存在；
`fileKind=absent` 禁止三者。

read set 与 Basis/真实读取必须双向 exact-cover：

- Creation/full Basis 的每个 ArtifactPin 都有且只有一个 exact-equal
  `artifact_descriptor` entry；source/actual Snapshot 另有唯一
  `repository_state` entry，Snapshot ID/state token/HEAD/Index/Worktree/
  Untracked/ignore digests 全等；
- Basis 的 attributes/scanner/repository/safe-git/baseline-budget/private-store-quota
  policy（以及实际使用的 ignore）各有唯一 policy entry；Creation Basis
  `repositoryStateToken` 等于 source
  repository-state entry，不能只等于另一个 opaque Index token；
- Provider 实际读取的每个 Git ref/object、Index 与 safe worktree path 恰有一
  entry，entry 不能多报未读 unit；hard-deny/secret unit 不生成逐项 entry，但
  完整 repository-state enumeration 的 owner-only keyed state token 与
  aggregate Boundary 必须覆盖它；
- baseline/actual/dirty reconstruction 所依赖但由 Artifact pin 间接到达的 Git
  object 仍须显式列入 git_object entries。missing/duplicate/extra/mismatch
  一律 `repository_read_set_conflict`。

六类 strong repository-reading transaction——`buildTaskBrief` Stage 1、
Stage 2，以及 `checkChanges/recordVerification/refreshTaskContext/rebaseTask`——
每次成功都把对应 Creation/full Basis 写成 owner-only immutable
`RepositoryBasisRecordEnvelopeV1`。它属于独立 private
`repository_basis_ledger`，**不**进入公开 `task_operation_journal` payload、
Artifact Type/MCP/read_artifact union。固定路径为
`.understand-code/tasks/<taskId>/private/repository-basis/<encoded-recordId>.json`；
目录/文件、trusted read、marker/rollback 使用本节 no-follow 规则。
公开 Receipt/Check 只保存
`basisRecordId/basisRecordContentDigest/basisDigest/readSetDigest`。trusted read
从 validated ID 推导固定路径，验证 Envelope content digest、payload ID/event/
Task/revision 与四个 public pin 后重算 Basis/read set；调用方不能提供。
strong Check descriptor 还必须 direct-pin 构建时的 exact Pulse、Basis Record
与对应 immutable public Receipt/Event。
`operationEventId` 必须等于同 revision Event ID 与现有 Receipt `eventId`；
strong Receipt 实现 `StrongRepositoryBasisReceiptFieldsV1`，四个字段分别等于
record ID、record content digest、record basis digest 与
`basis.readSet.readSetDigest`，并实现 `StrongQuotaReceiptFieldsV1`。
`privateStoreQuotaCommitProof` 七个字段必须与 Admission Envelope、其 commit
Transition Envelope、delta digest及 predecessor/new Manifest-generation
root/head
exact-equal。Event ID 先由
Operation kernel 生成，不依赖 Basis Record；Receipt/result digest 可以覆盖
Basis Record ID，反向不能把 Receipt result digest 放进 Record preimage，避免
引用环。Basis Record stable ID/完整 payload 只覆盖 pre-commit Basis；Baseline、
Basis Record 与其 IDs 都不包含 Admission/post-root backlink。Store Manifest
的 transition-chain head 是所有 quota transition 的 retention/audit root；
Receipt/Journal/Task Manifest 另外 pin 同 revision commit 的 Admission 与
Transition proof。
Basis Record 由 append-only public Receipt/Event/Check 的 ID+digest 作为
owner-only closure edge，projection cleanup 不删；P0 不自动 GC，只回收 marker
拥有且从未被 committed pin 引用的 uncommitted record。

private CAS 的并发 ownership 不能只靠 blob 是否 pre-existing。每个准备写入或
dedupe 的 blob，在释放 Repository lock 前都必须先 durable-create 一个
`PrivateCasReservationEnvelopeV1`，固定路径为
`.understand-code/private/cas-reservations/<encoded-reservationId>.json`，并把 exact
ID/path/blob/digest/size/transaction nonce 写入已 fsync 的 transaction marker。
reservation 的 ID/Envelope/payload identity 必须重算且 exact-equal；不同
transaction 对同 blob 各有独立 reservation。

任何会改变 quota root 的 reservation create/remove、phase update、commit、
rollback 与 recovery 都必须生成一条 append-only
`PrivateStoreQuotaTransitionRecordV1`，并在同一 Repository lock 下按下列顺序
执行：

1. trusted-read Store Manifest唯一 maximal generation pin 的 current
   quota-index root、全部 active
   `reservationMembership`、`activeBlobEntitlements` 与 candidate CAS
   destination；wrong owner/mode/link/digest 立即 fail closed。membership 以
   reservation ID 唯一计 ownership/count，entitlement 以 blob ID 唯一计 bytes
   并 pin sorted owner IDs digest。先用 exact hypothetical marker/control
   bytes 做**无副作用 preflight**；blob/active quota 拒绝的候选直接成为
   metadata-only Boundary，该 candidate 永不创建 reservation/temp/blob；若
   Operation 仍可提交，随后创建的 transaction marker 必须显式声明这一固定
   rejection 与 Boundary metadata plan。metadata/control quota拒绝则整个
   Operation 零写失败；
2. preflight 通过后才 marker-first durable-create 本 transaction intent 与每个
   reservation。preflight 必须把当前 reservation Transition 以及下一 ordinal
   的 rollback、recovery 两个互斥候选 path 的 worst-case metadata bytes/count
   计入 `activeMetadataPlans`；否则不允许开始 transaction。每个非 terminal
   Transition 消费自己的 plan 时，必须在同一 delta 继续预留下一 ordinal 的
   rollback/recovery 两个候选；terminal Transition 则移除未采用的互斥 plan。
   writer 为当前 root change
   分配 transaction-local `phaseOrdinal`，固定 Transition ID/path/delta/size，
   fsync Transition、reservation 与新 Merkle nodes 后，生成 exact pin当前唯一
   tip的下一 immutable Manifest generation，并以同-parent-handle no-replace
   publish新增独立 membership、unique blob entitlement owner、该 Transition
   committed-metadata leaf并推进 chain head。existing valid blob
   dedupe 也必须先取得 entitlement，不能“因为已经存在”跳过；
3. 完成 temp/materialization 后重取 Repository lock，trusted-read **最新**
   quota root 与 transition-chain head，并从该 root 重新 admission。本
   transaction 只允许 marker 预声明的
   `planned→created→committed/removed` exact path/size transition；其他合法
   transaction 导致的 root/head 变化允许存在。writer 验证全局 caps、own
   entitlement 与 touched Merkle proofs 后，先完全固定所有 candidate Artifact、
   Admission、Receipt 与 commit Transition 的 semantic ID、physical key、
   cycle-free accounting projection 与 exact logical size，再生成 sorted/unique
   `PrivateStoreQuotaDeltaV1`。允许固定长度 root/content-digest field 使用等长
   placeholder；full payload content digest 绝不进入 quota leaf。不能要求整份
   preflight universe digest byte-identical，也不能沿用旧 cached counter；
4. Admission ID 只由 repository/worktree/task/event/transaction/policy identity
   生成，commit Transition ID 只由
   repository/worktree/transaction/phaseOrdinal/kind/policy identity 生成；两者
   path 都在 post root 前已知。delta 必须包含本 transaction 最终
   baseline/Basis/Admission/Receipt/equality/detail/history、commit Transition
   等 metadata allocation，以及 reservation/temp/control phase transition。
   对所有把自身 logical size 放入 delta 的记录，以固定长度 digest/root
   placeholder 迭代到唯一最小稳定 byte length（最多 8 次 digit-width
   transition）；随后填入真实值时 byte length 必须不变，否则零写。该迭代只是
   size 求稳，不把 payload/content digest 放入 leaf，因此不存在 hash fixed
   point；
5. writer 从 latest root + exact delta 单遍构造 post root，再完成 commit
   Transition：其 previous pair 必须 exact-equal 当前 Manifest-generation
   tip的 head，pre/post
   root 与 delta/digest 必须 exact-equal。计算顺序唯一为
   `semantic IDs/size commitments → quota delta/post root →
   private-store-quota-transition-record-v1 full payload content digest →
   private-store-quota-admission-record-v1 full payload content digest →
   next Store Manifest generation`：Transition先按
   `private-store-quota-transition-v1`重算 cycle-free ID，再以不同的
   `private-store-quota-transition-record-v1`覆盖完整 strict payload；随后把该
   Transition ID/content digest写入 Admission，Admission先按
   `private-store-quota-admission-v1`重算 cycle-free ID，再以不同的
   `private-store-quota-admission-record-v1`覆盖完整 strict payload。
   `PrivateStoreQuotaTransitionRecordEnvelopeV1.contentDigest`与
   `PrivateStoreQuotaAdmissionRecordEnvelopeV1.contentDigest`必须分别
   exact-equal上述 payload digest；Envelope outer的 record/repository/worktree/
   task/event/time又必须 exact-equal payload同义字段。stable-ID domain与
   full-record content domain不得替换、互认或复用 digest。Admission 只保存
   accepted/rejected audit 信息与该 Transition pin，不重复保存 root/delta，也
   不反向引用 Receipt/Basis。所有 canonical bytes/time 在首次 attempt 写入
   marker，retry 必须复用，不能重新生成；
6. Store Manifest generation与 Task Manifest分别是 quota commit point与 Task
   projection commit point。writer先 fsync candidate Artifact、Admission、
   commit Transition、new Merkle nodes及完整 next Manifest generation，再用
   exact predecessor的 absent generation path做一次 provider
   handle-addressed no-replace publish，原子提交 `PrivateStoreQuotaCommitProofV1`、
   post-root pointer与新 Transition head，并从 logical universe移除本
   transaction membership/entitlement/marker；随后只可 finish Task Manifest
   publication，不能回滚已提交 quota generation。generation commit后残留的
   exact marker/reservation/provider staging只是不再 reachable的 marker-owned
   garbage；provider-private未发布 object可按 provider生命周期丢弃，已发布
   namespace object只能走 atomic handle-addressed compare-delete或保留。crash时
   不得回滚已发布 descriptor。Receipt/Journal/Task Manifest pin Admission
   与 commit Transition ID/content digest、两个 roots 和 delta digest；
7. 成功后 committed/historical descriptor 必须 pin exact blob，Transition
   delta、Receipt proof、Manifest root/head transition 与实际 allocation
   exact-equal。rollback/recovery 也必须先写各自 Transition 并推进 root/head；
   rollback 只移除自己的 membership，同 blob 仍有 owner时只更新 entitlement
   owners digest，不能减去 unique blob bytes；
8. 只有 exact blob 没有任何
   current/historical descriptor pin，且没有其他 valid active reservation/
   durable marker 声明它，provider从 exact live handle重算 binding相等且明确
   支持 atomic handle-addressed compare-delete时，才允许删除；否则保留并计入
   control/quarantine。`unlinkat(parent,name)`、device+inode/file ID、同
   digest/OID或“本 transaction曾创建”都不足以授权删除；
9. crash recovery 在 Repository lock 下完成同一判断。committed descriptor
   存在时保留 blob、清理已完成 transaction 的 reservation；未提交但仍有其他
   active reservation 时保留 blob；marker/reservation 矛盾时报告 recovery
   conflict，绝不猜测删除。任何 recovery-induced root change 也必须消费预留
   terminal slot、生成 `transitionKind="recovery"` 的下一 ordinal record 并
   发布 exact predecessor的下一 append-only Manifest generation，禁止“直接修
   root”或替换 current pathname。

因此 T1 创建 blob、T2 dedupe 后 T1 rollback 的 interleaving 中，T2 的 durable
reservation 是 GC root，T1 不能删除该 blob。Reservation 是短生命周期
owner-only transaction state，不进入 public History；但所有 active reservation
必须被 History/GC/recovery enumerator 视为临时 root。

`PrivateStoreQuotaPolicyV1` 使用本节固定默认值，P0 不接受 caller override。
`PrivateStoreQuotaStateV1` 是从 validated immutable quota-index root 即时计算的
**内存 derived view**，从不把 caller/self-reported counter 当权威。quota index
是固定 fanout=256 的 content-addressed Merkle set：leaf 按
`[category-order,UTF-8 key bytes]` 排序且每 category/key unique；leaf 只保存
category/key/recordKind/logicalBytes 与 entitlement owners digest 等
**cycle-free accounting projection**，明确不保存 payload/content/post-root
digest。node 的 child range、digest、itemCount、logicalBytes 必须重算且
non-overlap，空 category 使用版本化 empty-leaf root golden constant。root 保存
七类 category root/itemCount/logicalBytes 与 active transaction count；
`universeRootDigest` 按
`private-store-quota-universe-root-v1` 排除自身重算，root Envelope content
digest 再覆盖完整 payload，因此没有 self-hash。每个 node/leaf/root 使用上表
独立 digest domain。existing
Artifact Store repository/worktree manifest 是唯一 current-root commit point，
不再另设可覆盖 quota singleton 或扫描 revision directory。
七个 empty category digest 分别按
`private-store-quota-empty-category-v1 + {category}` 生成 tracked golden
constant，禁止共用一个无类型空 hash。versioned genesis root 是
`treeLayoutVersion + policyDigest + 七个对应 typed empty
digest/count=0/logicalBytes=0 +
activeTransactionCount=0` 构造出的唯一
`PrivateStoreQuotaIndexRootEnvelopeV1.contentDigest`；Manifest 的
`genesisQuotaIndexRootContentDigest` 必须等于该值，policy 变化必须走显式
upgrade/new genesis，不能原地替换。

category order 固定为
`committed_blobs < committed_metadata < reservation_membership <
active_blob_entitlements < active_metadata_plans < active_temp_plans <
control_state`。root named slot到 wire category literal的唯一双射固定为
`committedBlobs→committed_blobs`、
`committedMetadata→committed_metadata`、
`reservationMembership→reservation_membership`、
`activeBlobEntitlements→active_blob_entitlements`、
`activeMetadataPlans→active_metadata_plans`、
`activeTempPlans→active_temp_plans`、
`controlState→control_state`；所谓 slot/category exact equality均指
**exact-equal该映射后的 snake_case literal**，绝不把 camelCase slot bytes当作
category值。JSON Schema必须把七个 root property分别展开为带对应单一 category
`const`的对象分支，不得生成一个可在七个 slot间互换的宽
`PrivateStoreQuotaIndexCategoryV1`；Node/child/leaf/delta也必须展开七个
category-correlated显式 `oneOf`，不得把 enum与全局 leaf union交叉组合。
blob/entitlement key 是 validated
`PrivateBlobId`，membership
key 是 validated reservation ID，其余 key 是 fixed
`StoreRelativePathV1`；全部按 UTF-8 unsigned bytes 比较。entitlement 的
category与 recordKind同时由 strict判别联合冻结：
`committed_metadata`只接受 managed envelope/descriptor、baseline、context、
projection history、repository basis、request equality、verification detail、
quota admission/transition与 operation journal；
`control_state`只接受 transaction marker、CAS reservation、identity binding与
security equality key；`active_metadata_plans`只接受 committed-metadata kind，
`active_temp_plans`只接受 private blob或 committed-metadata kind。valid key与
valid size不能让 private blob进入 metadata/control，不能让 control-only kind进入
active plan，也不能让 transaction marker消费 metadata quota；错误交叉组合必须在
Schema阶段拒绝，不能靠后续 path扫描纠正。
对应 JSON Schema同样必须按四个 category输出显式 `oneOf` record-kind enum，不能把
共享 TypeScript alias降级为全局 `PrivateStoreQuotaRecordKindV1`。
entitlement 的
`ownersDigest=sha256(canonical JSON(["private-store-quota-entitlement-owners-v1",
{privateBlobId,reservationIds}]))`，reservation IDs sorted/unique/nonempty，
membership 与 owners 双向 exact-cover。node `firstKey/lastKey` 等于 children
或 leaves 覆盖边界。root 的七个 named slot 必须分别令 category 字段
exact-equal上文 camelCase→snake_case映射后的 literal；slot、root node、每层
parent/child 与所有 leaf 的
category 必须全链相等。任何 cross-category node/root substitution 即使 digest、
range/count/bytes 其他字段合法也 reject。
`nodeKind=leaf_page` 当且仅当 `level=0`，内嵌 1..256 个按 key 排序的
same-category leaf entry；每个 `leafDigest` 必须按 leaf domain 重算，
itemCount 等于 leaves 长度，logicalBytes 精确求和。
`nodeKind=branch` 必须 `level>=1`，包含 2..256 个按 range 排序、互不重叠的
children，每个 child digest 必须解析为 `level-1` node，aggregates 精确相加；
禁止 mixed level、单 child branch 或未折叠 root。非空 category 的
`merkleRootDigest` 必须解析为这一 category 的 exact node，空 category 只能使用
版本化 empty-root constant，不存在独立 leaf file。

`treeLayoutVersion=canonical-btree-256-v1` 冻结唯一 persistent update
state machine。每条 Transition 先按 `[category-order,key]` 排序 delta，逐条在
上一步 resulting root 上执行；同 key 只有一个 operation。查找 present key
必须命中唯一覆盖其 key 的 child；查找或 put absent key 时，每层 branch 固定
选择按 range 排序后首个满足 `child.lastKey >= key` 的 child，若不存在则选择
最右 child；进入 leaf 后按 unsigned UTF-8 key 的 lower-bound位置插入。因此
range gap 中的
absent key 也只有一个 target leaf，禁止按最近距离、左右空闲度或实现遍历顺序
选择。leaf 或 branch 暂时达到 257 项时固定 split 为左 128/右 129，
并向 parent 传播，root overflow 同样生成唯一新 root。remove 后，非 root
leaf/branch 的最小 occupancy 为 128：达到 127 时先向存在且 occupancy>128 的
同-parent 左 sibling borrow，否则向同-parent 右 sibling borrow；两边均不可借
时，有同-parent 左 sibling 就向左 merge，否则向右 merge，并递归修复 parent。
root 只剩一个 child 时必须
折叠；最后一项删除后切到 typed empty-root constant。replacement put 不改变
key occupancy。所有 copy-on-write nodes 都由该顺序产生，禁止批量 rebuild、
实现自选 split point、右侧优先 borrow 或延迟 root collapse。因此相同
genesis + Transition delta chain 必须得到 byte-identical node/root；
正常 touched proof 路径为 `O(k log n)`，`k` 是本 Transition 的 unique key
数，不在 Repository lock 内重建全树。
`activeTransactionCount` 必须等于 reservation-membership、active-metadata-plan
和 active-temp-plan leaves 中 transactionNonce 的 sorted/unique union
cardinality；每个 active transaction 因强制保留下一 terminal Transition plan，
至少在其中一类可见，禁止另存 caller counter。
delta operation 以 resulting/expected leaf 的 category+key 排序，每 key 最多一
operation；put 的 expectedPrevious 如存在必须同 key，remove 必须提供 exact
previous。empty category/node/root canonical bytes、每种 leaf、split/merge 与
duplicate/malformed range 均保存 golden vectors；至少覆盖
255/256/257、跨页连续插删、左/右 borrow、merge、multi-level split/root
collapse、cross-category substitution reject，以及
`put k0001…k0257 → remove k0129 → put k0129` 从同 genesis重放得到
byte-identical
node/root（最后一次 put 必须按 upper-bound rule 路由到原右页）。

immutable node/root 固定存放在
`.understand-code/private/quota-index/nodes/<encoded-contentDigest>.json` 与
`roots/<encoded-contentDigest>.json`；Admission 固定在
`.understand-code/tasks/<taskId>/private/quota-admissions/
<encoded-recordId>.json`；Transition 固定在
`.understand-code/private/quota-transitions/<encoded-transitionRecordId>.json`。
全部 filename 使用唯一 `StoreFilenameKeyV1`。物理文件 no-follow/0600，
trusted reader 从 pinned digest 推导路径并重算 bytes；uncommitted
node/Transition 只由 durable marker回收。两类 resolver只接受已验证 Store root与
对应 typed locator的 repository/worktree/task/record ID，禁止 caller path、
latest alias、glob、scan/adopt或第二 semantic path；locator/Envelope/payload重复
identity与 time必须闭合，same ID不同 bytes或 stable-ID digest冒充 full-record
content digest都 fail closed。

Store ownership marker、quota-index node/root 与唯一 current Store Manifest
generation 属于 **bootstrap/quota-control structural store**，明确排除自身
Merkle universe，避免 bootstrapping/root 自计费。ownership marker 还必须满足
policy 中 bootstrap control 的 file-count/total/single-file cap；超出时初始化
零写失败；P0 的 bootstrap control universe 只允许该 marker，其他 bootstrap
文件必须经版本升级显式加入 allowlist。每次 transition 直接验证 policy 中
node count/total bytes、单 node、root 与 Manifest caps；Transition Record
本身不是 structural node，而是
quota-counted、append-only committed metadata。每个 Store Manifest generation
必须实现 `PrivateStoreQuotaManifestPinV1`，并把 current root、chain head与
可选 initialization terminal head作为一个 immutable unit。初始化时
`chainState="genesis"`，current root 必须 exact-equal
`genesisQuotaIndexRootContentDigest`；首个 Transition 必须
`previousState="genesis"` 且其 pre-root 等于该 genesis root。此后必须
`previousState="transition"`，previous ID/content-digest 成对存在并
exact-equal predecessor Manifest-generation head；next generation head必须等于本
Transition。每个 transaction 的 ordinal 从 0 开始严格递增且不可复用，但全局
chain 可交错不同 transaction。same ID retry 只能复用首次 durable canonical
bytes；同 ID 不同 bytes fail closed。

new Store 的首个 Transition 还必须
`transitionKind="identity_bootstrap"/phaseOrdinal=0`，transaction nonce 与
external init intent 相等，delta exact put 已预声明的 equality-key、
Binding Intent、Transition committed-metadata allocation，并与
`StoreIdentityBootstrapPlanV1.writeSet` 中 sealed/canonical bytes、file
precondition、delta/root/head与所有 quota nodes全等；digest-only plan必须
reject。它没有 Task/Event，
禁止 Admission。`identity_activation` 只能发生在该 bootstrap Transition
之后且 `StoreIdentityActivationPlanV1` 已 durable，必须解析 Binding Intent 与
已 durable 的 full strong Manifest，delta exact remove Intent current leaf、
put active binding/activation Transition allocation，active binding必须 pin该
Manifest；plan write set还必须 exact-cover activation quota nodes/root与
next Manifest generation，每个 attempt最终 `final_identity_verified`。它同样没有 Task
Admission。
第三个 `store_initialization_terminalize` 只能消费 retained
`terminalization_planned`、从 pinned genesis到唯一 maximal tip的 durable
append-only handoff journal与独立
`StoreInitializationTerminalReceiptV1`；其 source/ledger/history/token、plan、
每代完整 progress与 predecessor必须全部重算。delta exact计费 terminalization
Transition与 predecessor generation，next Manifest必须首次设置 exact terminal
head。此 Transition committed且从唯一 Manifest tip反向验证成功前，active
binding不授权任何 strong Surface；成功后必须追加唯一 proof-bearing terminal
handoff record，external intent才可变成 pin该 final record的 retained
`terminalized`，以后每代 Manifest必须原样继承 head。其他 kind不得伪装这三个
初始化状态转换。

next Manifest generation发布后，旧 node/root 不因历史 Transition 的 root digest 自动
成为 GC pin。无 active marker 且不再被 current root reachable 的 generation
由 exact node graph + marker ownership 回收；但 retained Transition Record
及其 committed-metadata leaf 在 P0 禁止自动 GC/压缩。历史审计从 Manifest
head 沿 previous ID/content-digest 反向读取全部 Transition，直到唯一 genesis，
反转后从 genesis root 顺序重放每条 exact delta，逐条重算
ID/content/delta/pre/post root 与 next backlink；reservation、phase、commit、
rollback、recovery 任一缺口、重复 ordinal、断链或不同 root 都 fail closed。
因此旧物理 Merkle node/root 可回收而完整 root 历史仍可重建。

正常 admission/commit/rollback 在锁内只 trusted-read current root、transaction
marker 和 touched leaf proof，以 `O(k log n)` 构造 post root；
所有 category count/bytes 必须由 child aggregates 重算，不能只信 payload。
`PrivateStoreQuotaTransitionRecordV1` 是每次 root change 的 owner-only
immutable审计记录，保存 policy、previous head、pre/post root 与完整
delta/delta digest；`PrivateStoreQuotaAdmissionRecordV1` 只存在于 accepted
Operation commit，保存 sorted/unique accepted/rejected candidate 和 exact
commit Transition pin。pre/post `PrivateStoreQuotaStateV1` 只从对应 root
derived，不重复持久化；Admission/Transition ID 均不含 root/delta。所有
Transition 由 Store Manifest chain head retention；同 revision Receipt/Journal/
Task Manifest 再 pin commit Admission/Transition proof。Internal baseline 与
Repository Basis Record 不反向 pin quota proof。
Admission 的 `acceptedCandidateBlobIds` 按 PrivateBlobId UTF-8 bytes
sorted/unique；`rejectedCandidates` 按 `[privateBlobId,code]` 排序且每 blob
最多一项。两组 disjoint，并必须 exact-cover durable marker 中本次声明的
candidate blob set；accepted blob 的 final committed leaf、rejected blob 的
metadata-only Boundary 与 Transition delta 三方 exact-equal。

完整 `PrivateStoreQuotaUniverseV1` 枚举只在 workspace 首次打开（任何 strong
Operation 前）、crash/recovery 检测到 marker/index 不一致、显式 audit 和版本
upgrade 时执行。scanner 第一阶段在锁外 no-follow 枚举：

- 所有 strict/trusted-read 且被 current/historical descriptor closure pin 的
  committed private blob 与 managed private metadata，以及由当前 Manifest
  transition-chain head exact-cover 的全部 quota Transition Record；
- 所有 exact-equal durable marker、CAS reservation、planned final metadata 与
  planned/created temp file；
- 每个 path 的 file identity、owner/mode/nlink、logical `stat.size`、
  mtime/ctime（或平台 change-time）、payload content digest 与 marker ownership。

第二阶段取得 Repository lock + exclusive Store maintenance lock 后，必须重验
Manifest generation/current root/transition head，重新枚举全部 scanned
directory entry，并对
每个文件重验 identity/size/change-time；任一变化释放锁后从头重试。不能可靠
提供 identity/change-time 的 filesystem 必须使用只读 filesystem snapshot，
否则 audit fail closed。content digest 用于原 Envelope/descriptor integrity，
但不进入 quota leaf；同尺寸内容篡改仍由 trusted content validator拒绝。

稳定后从
`{committedBlobs,committedMetadata,reservationMembership,
activeBlobEntitlements,activeMetadataPlans,activeTempPlans,controlState}`
的 exact accounting projection重建同一套 leaves/nodes/root，并比较 rebuilt
root **content digest** 与 Manifest pin；`private-store-quota-universe-v1`
可另存本次 audit evidence digest，但绝不与不同 domain 的
`private-store-quota-universe-root-v1` 直接比较。mismatch fail closed，只能
依据 exact durable marker 做 recovery，不能后台“修正”计数或删除来源不明
对象。maintenance final cut 之后的外部同用户进程篡改视为新的 tamper，后续
trusted read/next audit仍 fail closed；Store lock 只宣称协调产品 writer。
这样 near-quota 大 Store 不需要在每次正常事务锁内重扫 1 GiB blob/100k
metadata，同时 startup/recovery 审计有明确 final cut。

列表按 fixed path/ID UTF-8 bytes排序，重复 ID/path、同 ID 不同 size/digest、
悬空 marker/reservation 或 ownership 不一致都 fail closed。
所有计数使用 logical raw bytes，不用 filesystem blocks、compression 或 sparse
allocation；所有 byte/count/ordinal/aggregate 必须是 nonnegative safe integer，
要求正数的 array count 另按对应 Schema 检查，overflow/NaN/fraction/negative
一律 fail closed：

- `committedPrivateBlobLogicalBytes`：被 validated current/history descriptor
  closure pin 的 final CAS regular blob，按 unique `PrivateBlobId` 的 exact
  logical size 只计一次；
- `committedPrivateMetadataLogicalBytes`：已提交 baseline/history/Basis/
  request-equality/verification-detail/quota Admission/quota Transition/managed
  descriptor 等 owner-only canonical JSON，按 unique fixed Store path 只计一次；
  transaction marker、reservation、key 与本 derived view 是 control state，不
  混入 product payload 计数；
- `activeReservationLogicalBytes`：valid reservation/marker 声明、尚未被
  committed closure pin 的 candidate blob，严格取
  `activeBlobEntitlements` category bytes，按 unique `PrivateBlobId` 只计一次；
  多 transaction 对同 blob 的 reservation 只增加 membership/owners digest，
  不倍增 bytes；
- `activeMetadataReservationLogicalBytes`：active durable marker 预声明的全部
  planned final metadata canonical bytes，按 final fixed path 去重；不含 marker/
  reservation 文件自身；
- `activeTempReservationLogicalBytes`：active marker 预声明且已验证
  planned/created 的 peak provider-staging logical bytes，按 transaction +
  exact provider staging locator去重；
- `activeTransactionCount/activeReservationCount/controlStateLogicalBytes`：
  transaction 按 unique nonce，reservation count 严格取
  `reservationMembership.itemCount`，control state 按 marker/reservation/
  worktree key/binding 等 exact path 计数；Store ownership marker 按独立
  bootstrap structural cap 计数，不进入 Merkle control-state leaf。每个
  Merkle control file
  都按 canonical raw bytes计 logical size，且单文件不得超过 1 MiB。derived
  view 本身不持久化、计 0。
  control state 与 product payload 分账，但两者都必须 admission，不能用零字节
  blob 或大量 transaction 绕过磁盘上限。

每个 transaction 在任何 blob/temp 副作用前必须先把 candidate metadata exact
bytes（最多 16 MiB）与 planned peak temp bytes（最多 96 MiB）纳入无副作用
preflight；通过后再写 durable marker/reservation并发布 active entitlement
root。原子 admission 与 final re-admission 都必须同时满足：

```text
committed unique blob bytes + unique uncommitted candidate blob bytes <= 1 GiB
committed blob count + unique uncommitted candidate blob count       <= 100000
active unique reservation bytes                                    <= 128 MiB
committed metadata bytes + active planned metadata bytes            <= 256 MiB
committed metadata file count + active planned final metadata count  <= 200000
active planned metadata bytes                                       <= 32 MiB
active planned metadata file count                                  <= 32768
candidate metadata bytes per transaction                            <= 16 MiB
candidate peak temp bytes per transaction                           <= 96 MiB
all active peak temp bytes                                           <= 192 MiB
active temp plan count                                               <= 16384
active transaction count                                            <= 128
active reservation count                                            <= 4096
control-state logical bytes                                         <= 64 MiB
control-state file count                                             <= 16384
each control-state file                                             <= 1 MiB
reachable quota-index nodes                                         <= 65536
reachable quota-index structural bytes                              <= 64 MiB
each quota-index node/root                                           <= 1 MiB
Store Manifest                                                       <= 4 MiB
bootstrap-control logical bytes                                      <= 4 MiB
bootstrap-control file count                                         <= 8
each bootstrap-control file                                          <= 1 MiB
bootstrap planned directory count                                   <= 64
bootstrap directory attempts per directory                           <= 4
bootstrap write-set file count                                       <= 64
bootstrap write attempts per file                                    <= 4
bootstrap recovery-payload bytes                                     <= 16 MiB
external initialization-intent bytes                                 <= 64 MiB
terminal receipt bytes                                                <= 64 MiB
each terminalization handoff record                                  <= 64 MiB
terminalization handoff journal bytes                                <= 64 MiB
terminalization handoff record count                                 <= 4096
bootstrap quarantine entries                                         <= 64
bootstrap quarantine-ledger generations                              <= 4
bootstrap quarantine-ledger bytes                                    <= 256 KiB
```

成功、rollback 与 recovery 只按 ownership 对 current Merkle root 应用本
transaction delta并移除本 transaction 的 marker/reservation/temp；若发布前
唯一 Manifest tip/predecessor 已推进，必须基于最新 root/head重新 admission并
生成新的 exact-predecessor generation，不能 patch旧 root、替换 pathname或把
失败伪装成 filesystem CAS。任何 cached view 或调用方提供的 counter 都不得
参与授权。

- deterministic `BaselineMaterializationBudgetV1` 先按 path canonical order
  选择最多 2 MiB/file、64 MiB/transaction 的候选；超过者写
  `baseline_blob_budget_exhausted` metadata-only Boundary。其后若 worktree
  committed blob 1 GiB quota 或 active/temp quota 拒绝某个候选，则同样不创建
  temp/reservation，写 `private_store_blob_quota_exhausted` metadata-only
  Boundary；两者都可提交 partial baseline；
- metadata candidate 超过 per-transaction reserve、committed metadata
  256 MiB quota无法预留，或真实 provider allocate/write/durable-publish/CAS
  失败（legacy/开发 Fixture才可能表现为 `ENOSPC/EDQUOT/fsync/rename`）时不能
  可靠提交 recovery metadata，整个 Operation 回滚并以固定
  `private_store_metadata_quota_exceeded` 或 `private_store_durable_write_failed`
  error 零 Task revision。不得把真实 I/O 失败伪造成 metadata-only success。

quota policy 与 baseline budget 的完整 resolved digest 必须进入
TaskCreation/Repository Basis、read set、Internal baseline semantic digest；
任何中途 policy drift 触发 conflict；quota root 合法变化按上述 latest-root
re-admission 处理，own entitlement/touched proof 不等才 conflict。P0 committed
history/blob/lease/detail/Basis/equality record 不做年龄 GC；提高 quota 或未来
显式审计 cleanup 才能恢复容量，不能后台删除用户仍可验证的历史。

历史 Repository Snapshot 可以无 `objectFormat/headState` 且保持 bytes 不变；
strong writer 必须写二者。commit state 要求旧 `headCommit` 与
`headState.commit` 相等；unborn 要求 `headCommit/baseCommit/mergeBase` 缺失并
使用对应 object format 的 canonical empty tree。Repo Pulse 的
repositoryState 必须做同样 equality。

private blob、intent marker、Basis Record、Verification detail 与 history 的 trusted I/O
统一冻结为：

- 每级目录 component 均从已绑定 Store root 使用 no-follow handle/openat 解析，
  拒绝 symlink/reparse point；目录必须是 owner UID（Windows 为绑定 owner
  SID）且权限等价 0700；provider从 live handle重算 durable binding后持续持有
  同一 destination-parent authority，所有 final precondition、publish、final
  open与 parent fsync都相对它执行。禁止 check/use之间 close/reopen或把
  pathname重解析作为 authority；允许的只读 continuity observation只能发现
  mismatch并拒绝，绝不能选择/授权 replacement parent。每个 publish/delete
  还必须把 live bound-root authority、parent authority、relative ancestor
  chain及 durable bindings放入 provider request，由 provider在 namespace
  mutation同一 atomic commit内证明 parent仍被 exact root包含；
- 新文件必须先在 owner-only durable marker/intent 中记录 final precondition、
  provider staging locator/nonce与 `temp_planned`，再在 provider-private
  namespace创建不可列举的0600 **空** staging object；仍打开的 handle先验证
  regular file、owner、mode、`nlink==1`、size=0，把 exact durable binding与
  held parent binding
  fsync 为 `temp_identity_recorded` 后才可写 payload。write/fsync后再次
  重验 provider binding及 expected size/digest，再写
  `temp_payload_verified`；publish通过 `StoreProviderAtomicPublishRequestV1`
  同时提交 exact opened staging authority、bound-root/parent containment
  context与 final name。API不得接收 source path/name；unsupported fail closed，不得用
  普通 rename、source-name `renameat*`、create-link或 close/reopen fallback。
  Store Manifest只在 provider expected-head compare-append事务中发布 absent
  append-only generation并推进 unique head，绝不 replacement；
  committed provider result的 final binding、containment proof与 operation
  receipt必须先 durable写为 `published`，随后才经同一 parent authority重开/
  验证 final并 fsync file与 destination parent，最后写
  `final_identity_verified`；
- marker-first与 provider-private staging共同消除“可见 pathname但 identity尚未
  durable”的窗口；publish 后 final binding必须与 durable staging binding
  exact-equal，再写 `final_identity_verified`。provider staging authority丢失
  时原 attempt标为 `abandoned_unowned`并换新 durable plan；final collision
  保留未发布 attempt，publish后 binding/continuity mismatch则保留完整
  `published_quarantined` evidence并进入 bounded do-not-touch quarantine，即使
  bytes/digest/token/device+inode/file ID exact-equal也禁止 adoption、overwrite、
  rename或 name-based delete。validated
  pre-existing CAS blob 永远标记 `dedupe_only`，任何 rollback 都不得删除；
- CAS destination 已存在时只能 no-follow open 后按同一 trusted-read 校验并在
  exact digest/size 相等时 dedupe；wrong owner/mode/type/link count、hardlink、
  corrupt bytes 或 digest mismatch 一律 fail closed，不能 chmod/修复/覆盖
  调用方预置文件；
- 每次 trusted read 都先 no-follow open，再 `fstat` regular/owner/mode/
  `nlink==1`，读取有界 bytes 后再次 `fstat` 确认 identity/size 未变，并重算
  size + private/content digest；任一竞态或差异使整个读取/Operation fail
  closed；
- rollback只处理 marker精确列出、provider从当前 no-follow handle重算 durable
  binding相等、且 provider提供 atomic handle-addressed compare-delete的对象；
  调用前必须先 durable写
  `StoreProviderCompareDeleteProgressV1(state="planned")`，调用后先保存同
  operation nonce的 resolved receipt/proof再推进 quota/marker；restart不能把
  path absent当己方成功。delete capability disabled时不得产生 plan，对象保留并计入 control/quarantine。禁止
  `unlinkat(parent,name)`、pathname remove，也不能按 device+inode/file ID、
  目录年龄、glob、OID、time、bytes、digest或HMAC猜测 ownership。

#### 3.8.3 Diff、Symbol、Actual Change 与 Completeness

```ts
type RepositoryDeltaSourceV1 =
  | "baseline_reconciliation"
  | "committed"
  | "staged"
  | "unstaged"
  | "untracked"
  | "conflict";

type RepositoryContentStateV1 =
  | {
      status: "absent";
      path: RepositoryRelativePath;
    }
  | {
      status: "content";
      path: RepositoryRelativePath;
      domain:
        | "git_object"
        | "index_blob"
        | "worktree_raw"
        | "baseline_private_blob";
      objectId?: GitObjectId;
      contentDigest: ContentDigest;
      mode: GitModeV1;
      size: number;
    }
  | {
      status: "metadata_only";
      path: RepositoryRelativePath; // hard-deny unit 不进入 paths
      kind: "binary" | "special" | "unavailable";
      mode?: GitModeV1;
      size?: number;
      boundaryIds: [AnalysisBoundaryId, ...AnalysisBoundaryId[]];
    }
  | {
      status: "conflict";
      path: RepositoryRelativePath;
      stages: [GitConflictStageV1, ...GitConflictStageV1[]];
      boundaryIds: [AnalysisBoundaryId, ...AnalysisBoundaryId[]];
    };

interface RepositoryDeltaSegmentV1 {
  id: RepositoryDeltaSegmentId;
  source: RepositoryDeltaSourceV1;
  before: RepositoryContentStateV1;
  after: RepositoryContentStateV1;
  status: AnalysisStatusV1;
  boundaryIds: AnalysisBoundaryId[];
}

interface EffectiveRepositoryChangeV1 {
  id: EffectiveRepositoryChangeId;
  kind: "added" | "modified" | "deleted" | "renamed" | "copied" | "type_changed";
  before: RepositoryContentStateV1;
  after: RepositoryContentStateV1;
  sourceSegmentIds: [RepositoryDeltaSegmentId, ...RepositoryDeltaSegmentId[]];
  status: AnalysisStatusV1;
  boundaryIds: AnalysisBoundaryId[];
}

interface RepositoryPathDeltaV1 {
  id: RepositoryPathDeltaId;
  path: RepositoryRelativePath;
  oldPath?: RepositoryRelativePath;
  segments: [RepositoryDeltaSegmentV1, ...RepositoryDeltaSegmentV1[]];
  effectiveChange?: EffectiveRepositoryChangeV1;
}

interface RedactedRepositoryDeltaAggregateV1 {
  sourceSnapshotId: PathSafeRepositorySnapshotIdV1;
  snapshotRedactionId: PathSafeRepositoryRedactionIdV1;
  source: RepositoryChangeSourceV1;
  kind: RepositoryChangeKindV1;
  count: number;
  boundaryId: AnalysisBoundaryId;
}

interface RepositoryDeltaV1 {
  profile: "final-tree-delta-v1";
  taskId: TaskId;
  baselineSnapshotId: PathSafeRepositorySnapshotIdV1;
  actualSnapshotId: PathSafeRepositorySnapshotIdV1;
  paths: RepositoryPathDeltaV1[];
  redactedAggregates: RedactedRepositoryDeltaAggregateV1[];
  status: AnalysisStatusV1;
  boundaryIds: AnalysisBoundaryId[];
}

interface DiffOperationV1 {
  op: "equal" | "delete" | "insert";
  lineDigest: ContentDigest; // sha256(raw line bytes including terminator)
}

type DiffContentIdentityV1 =
  | { status: "absent" }
  | { status: "content"; contentDigest: ContentDigest };

interface DiffHunkV1 {
  id: DiffHunkId;
  algorithm: "diff-lines-v1";
  baselineSnapshotId: PathSafeRepositorySnapshotIdV1;
  actualSnapshotId: PathSafeRepositorySnapshotIdV1;
  path: RepositoryRelativePath;
  oldPath?: RepositoryRelativePath;
  beforeContent: DiffContentIdentityV1;
  afterContent: DiffContentIdentityV1;
  oldSpan: DiffLineSpanV1;
  newSpan: DiffLineSpanV1;
  sourceLayers: [RepositoryDeltaSourceV1, ...RepositoryDeltaSourceV1[]];
  operations: [DiffOperationV1, ...DiffOperationV1[]];
  operationsDigest: ContentDigest;
  patchDigest: ContentDigest;
}

interface SourceSymbolRefV1 {
  id: SourceSymbolRefId;
  snapshotId: PathSafeRepositorySnapshotIdV1;
  path: RepositoryRelativePath;
  language: LanguageIdV1;
  parserVersion: ParserVersionV1;
  kind:
    | "function"
    | "method"
    | "class"
    | "constructor"
    | "module"
    | "type";
  qualifiedName: NonEmptyString;
  parentId?: SourceSymbolRefId;
  fullSpan: SourceSpanV1;
  signatureSpan: SourceSpanV1;
  bodySpan?: SourceSpanV1;
  declarationDigest: ContentDigest;
  graphNodeId?: GraphNodeIdV1;
}

type SemanticFacetV1 =
  | "BODY_LOGIC"
  | "SIGNATURE"
  | "DEPENDENCY"
  | "TOPOLOGY"
  | "TEST"
  | "CONFIG"
  | "SCHEMA"
  | "DOCUMENTATION"
  | "FORMATTING_OR_COMMENT"
  | "UNKNOWN";

interface ActualChangeV1 {
  id: ActualChangeId;
  repositoryPathDeltaId: RepositoryPathDeltaId;
  effectiveChangeId: EffectiveRepositoryChangeId;
  path: RepositoryRelativePath;
  oldPath?: RepositoryRelativePath;
  kind: "added" | "modified" | "deleted" | "renamed" | "copied" | "type_changed";
  sourceLayers: [RepositoryDeltaSourceV1, ...RepositoryDeltaSourceV1[]];
  granularity: "symbol" | "hunk" | "file";
  oldSymbolRefs: SourceSymbolRefV1[];
  newSymbolRefs: SourceSymbolRefV1[];
  pairingStatus:
    | "exact"
    | "renamed"
    | "old_only"
    | "new_only"
    | "ambiguous"
    | "file_only";
  semanticFacets: [SemanticFacetV1, ...SemanticFacetV1[]];
  diffEvidenceIds: DiffHunkEvidenceId[];
  boundaryEvidenceIds: AnalysisBoundaryEvidenceId[];
  analysisStatus: AnalysisStatusV1;
}

type CompletenessDimensionNameV1 =
  | "repository_delta"
  | "semantic_classification"
  | "planned_matching"
  | "impact_analysis"
  | "verification_coverage";

interface CompletenessUnitV1 {
  unitKind:
    | "repository_path_delta"
    | "redacted_repository_aggregate"
    | "actual_change"
    | "required_planned_change"
    | "acceptance_claim";
  unitId:
    | RepositoryPathDeltaId
    | PathSafeRepositoryRedactionIdV1
    | ActualChangeId
    | StrongPlannedChangeId
    | ClaimId;
  status: AnalysisStatusV1;
  boundaryEvidenceIds: AnalysisBoundaryEvidenceId[];
}

interface CompletenessDimensionV1 {
  dimension: CompletenessDimensionNameV1;
  status: AnalysisStatusV1;
  units: CompletenessUnitV1[];
  boundaryEvidenceIds: AnalysisBoundaryEvidenceId[];
}

interface ChangeCheckAnalysisV1 {
  profile: "evidence_backed_v1";
  rulesetVersion: ProducerVersion;
  budget: ChangeAnalysisBudgetV1;
  usage: ChangeAnalysisUsageV1;
  basisRecordId: RepositoryBasisRecordId;
  basisRecordContentDigest: ContentDigest;
  repositoryBasisDigest: ContentDigest;
  repositoryReadSetDigest: ContentDigest;
  analysisInputDigest: ContentDigest;
  semanticDigest: ContentDigest;
  repositoryDelta: RepositoryDeltaV1;
  actualChanges: ActualChangeV1[];
  completeness: {
    overall: AnalysisStatusV1;
    dimensions: [
      CompletenessDimensionV1,
      CompletenessDimensionV1,
      CompletenessDimensionV1,
      CompletenessDimensionV1,
      CompletenessDimensionV1
    ];
  };
}

interface ConfirmedObligationProjectionV1 {
  plannedChangeId: StrongPlannedChangeId;
  contextGenerationId: ContextGenerationId;
  expectation: PlannedChangeExpectationV1;
  filePath: RepositoryRelativePath;
  symbolId?: GraphNodeIdV1;
  intentDigest: ContentDigest;
  claimIds: ClaimId[];
  impactPathIds: ImpactPathId[];
  confirmationEventId: EventId;
}

interface VerificationPlanProjectionV1 {
  verificationPlanEntryId: VerificationPlanEntryId;
  acceptanceClaimIds: ClaimId[];
  method: VerificationMethodV1;
  required: boolean;
}

type ChangeAnalysisContentIdentityV1 =
  | {
      kind: "path_side";
      repositoryPathDeltaId: RepositoryPathDeltaId;
      side: "baseline" | "actual";
      path: RepositoryRelativePath;
      stateDigest: ContentDigest;
    }
  | {
      kind: "redacted_aggregate";
      side: "baseline" | "actual" | "both";
      count: number;
      boundaryIds: [AnalysisBoundaryId, ...AnalysisBoundaryId[]];
    };

interface FindingSemanticProjectionV1 {
  id: StrongFindingId;
  type: ChangeFindingTypeV1;
  severity: ChangeFindingSeverityV1;
  blocking: boolean;
  claimIds: ClaimId[];
  plannedChangeIds: StrongPlannedChangeId[];
  actualChangeIds: ActualChangeId[];
  evidenceIds: StrongFindingEvidenceIdV1[];
  impactPathIds: ImpactPathId[];
  verificationGap?: VerificationGapV1;
}

interface ImpactSemanticProjectionV1 {
  impactArtifactId: ArtifactId;
  conclusion: StrongImpactConclusionV1;
  pathSemanticDigests: ContentDigest[];
}

interface ChangeAnalysisInputDigestFieldsV1 {
  repositoryBasis: RepositoryBasisV1;
  rulesetVersion: ProducerVersion;
  budget: ChangeAnalysisBudgetV1;
  confirmedObligationDigest: ContentDigest;
  verificationPlanDigest: ContentDigest;
  contentIdentities: ChangeAnalysisContentIdentityV1[];
}

interface ChangeAnalysisSemanticDigestFieldsV1 {
  repositoryDelta: RepositoryDeltaV1;
  actualChanges: ActualChangeV1[];
  completeness: ChangeCheckAnalysisV1["completeness"];
  findingSemanticRecords: FindingSemanticProjectionV1[];
  impactConclusions: ImpactSemanticProjectionV1[];
}
```

`confirmedObligationDigest` 使用
`["confirmed-obligation-set-v1",{contextGenerationId,obligations}]`，obligations
是当前 generation 已被 Plan confirmation Event 覆盖的
`ConfirmedObligationProjectionV1[]`，按 plannedChangeId 排序；`intentDigest`
使用 `["planned-change-intent-v1",{intent}]`，避免把自由文本直接拼 hash。
`verificationPlanDigest` 使用
`["verification-plan-set-v1",{contextGenerationId,entries}]`，entries 按 branded
Entry ID 排序且显式 required。legacy missing expectation/required 不进入 strong
digest，而是 Boundary/cannot-determine。

每个 safe RepositoryContentState 使用
`["repository-content-state-v1",{side,state}]` 产生 `stateDigest`；secret/
hard-deny unit 禁止逐项 state digest，只能进入 redacted aggregate。content
identities 按
`[kind,repositoryPathDeltaId-or-empty,side,path-or-empty,stateDigest-or-empty]`
排序。Finding projection 明确包含 severity/blocking，因为它们影响 review/
Lifecycle；排除 summary/resolution/acceptance/actor/time。Impact projection
包含 conclusion 与按 Impact Path ID 排序的完整 path semantic payload digest，
排除 renderer text/time。Finding/Impact arrays 分别按 3.8.4 Finding order 与
artifact ID 排序。`analysisInputDigest/semanticDigest` 只能对以上两个 exact
Fields interface 使用统一 `[domain,fields]` 编码，不能对任意运行时对象
`JSON.stringify`。

Strong Evidence 使用独立 strict variants；现有 Evidence shape 原样保留为
`LegacyEvidenceV1Schema`：

```ts
interface EvidenceBackedCommonV1 {
  id: DiffHunkEvidenceId | AnalysisBoundaryEvidenceId;
  profile: "evidence_backed_v1";
  freshness: "current";
  claimIds: ClaimId[];
  nodeIds: GraphNodeIdV1[];
  producedBy: ProducerIdV1;
  createdAt: IsoTimestamp;
  observedAtSnapshotId: PathSafeRepositorySnapshotIdV1;
}

interface DiffHunkEvidenceV1 extends EvidenceBackedCommonV1 {
  id: DiffHunkEvidenceId;
  kind: "diff_hunk";
  epistemicStatus: "observed";
  filePath: RepositoryRelativePath;
  hunk: DiffHunkV1;
}

interface DiffHunkEvidenceViewV1 {
  viewVersion: 1;
  viewKind: "diff_hunk_evidence";
  evidence: DiffHunkEvidenceV1;
  excerpt?: {
    oldLines: SafeExcerptLineV1[];
    newLines: SafeExcerptLineV1[];
    truncated: boolean;
  };
}

interface StructuredAnalysisBoundaryEvidenceV1
  extends EvidenceBackedCommonV1 {
  id: AnalysisBoundaryEvidenceId;
  kind: "analysis_boundary";
  epistemicStatus: "unknown";
  boundary: AnalysisBoundaryV1;
}
```

reader 是
`LegacyEvidenceV1Schema | DiffHunkEvidenceV1 |
StructuredAnalysisBoundaryEvidenceV1`，不得把旧
`analysis_boundary.boundaryReason/relationPath` transform 成 structured
Boundary。新 Change writer 的 `diff_hunk/analysis_boundary` 只写 strong
variant；两者禁止 legacy excerpt/derivation/confirmation/invalidation/free-text
reason 字段。Diff Evidence 的 Envelope/Evidence `observedAtSnapshotId` 等于
Hunk actual Snapshot，`filePath=hunk.path`；Boundary Evidence 的 scope 引用
必须解析。P0 strong persisted Evidence **一律没有 excerpt 字段**；这样同一个
Evidence ID 只有一组 canonical bytes。MCP/Workbench 如需正文，trusted reader
按 Hunk 固定 3 行 context、Evidence ID bytewise 顺序与 resolved
per-evidence/total excerpt Budget 生成 strict `DiffHunkEvidenceViewV1`，逐侧
重新 scanner/Host-path redaction；命中 secret 或读取漂移时省略 excerpt并返回
Boundary view。derived view 不落盘、不进入 Artifact/content/semantic digest，
也不能被写回 Evidence ledger。P0 `ChangeAnalysisUsage.excerptChars` 固定为 0；
两个 excerpt limit 只约束该版本化 read projection，WP6 若要持久化必须新增
Amendment。

Impact payload 增加兼容可选、strong writer 必填的结论：

```ts
type StrongImpactConclusionV1 =
  | {
      status: "paths_observed";
      impactPathIds: [ImpactPathId, ...ImpactPathId[]];
      boundaryEvidenceIds: [];
    }
  | {
      status: "none_observed";
      impactPathIds: [];
      boundaryEvidenceIds: [];
    }
  | {
      status: "partial";
      impactPathIds: ImpactPathId[];
      boundaryEvidenceIds: [
        AnalysisBoundaryEvidenceId,
        ...AnalysisBoundaryEvidenceId[]
      ];
    }
  | {
      status: "unknown";
      impactPathIds: [];
      boundaryEvidenceIds: [
        AnalysisBoundaryEvidenceId,
        ...AnalysisBoundaryEvidenceId[]
      ];
    };
```

legacy Impact 缺少 conclusion 时只按旧语义读取，不能据此宣称
`none_observed`。strong `paths_observed` 的 IDs 必须 exact-equal payload paths；
`none_observed` 当且仅当 paths 为空且 impact completeness dimension complete；
partial/unknown 与 completeness/Boundary 交叉一致。

Delta segment 必须按固定 source 顺序且 source unique；前一段 after 与后一段
before 必须 canonical-equal。`git_object/index_blob` 要求 objectId，
`worktree_raw/baseline_private_blob` 禁止 objectId；metadata-only 不允许
contentDigest。只有 before/after 不相等时才存在 effectiveChange，其
`sourceSegmentIds` 必须精确等于本 path chain 中全部
`canonical(before) !== canonical(after)` 的 segment ID，按固定 source 顺序
排列；不能由实现自行做“贡献”消去。若最终 B=A 则不生成 effectiveChange，
即使仍保留多个 non-noop provenance segment（如 dirty 原样 commit）；若 B≠A，
所有 non-noop segment 均进入 lineage 与 ID。每个非 hard-deny
effectiveChange 至少被一个 Actual 引用，
同一路径的多个 Actual 以 Hunk/Symbol cluster 分区并共享
`effectiveChangeId`；hard-deny unit 只计入 redacted Boundary 和 completeness，
不生成泄露路径的 Actual。Delta/segment/effective status=complete 要求
Boundary 为空且两侧不是 metadata-only/conflict；partial/unknown 必须有
Boundary。
conflict state 的 stage 必须 unique/升序且 OID/mode 完整；含 conflict 的
segment/effective/Delta 一律至少 partial，不生成普通 Hunk/Symbol。

`RepositoryPathDeltaV1` 与 effective kind 的条件矩阵：

| kind | `oldPath` | effective before/after |
|---|---|---|
| added | 禁止 | before=`absent(path)`；after 非 absent 且 `after.path=path` |
| deleted | 禁止 | before 非 absent 且 `before.path=path`；after=`absent(path)` |
| modified | 禁止 | 双侧非 absent、双侧 path 相同且等于 parent path；mode 映射的 final kind 相同 |
| type_changed | 禁止 | 双侧非 absent、双侧 path 相同且等于 parent path；mode 映射的 final kind 不同 |
| renamed | 必填且 `oldPath!=path` | `before.path=oldPath/after.path=path`；exact source 在 actual tree 不再存在 |
| copied | 必填且 `oldPath!=path` | `before.path=oldPath/after.path=path`；exact source 在 actual tree 仍存在 |

parent `path` 是 target/final path，`oldPath` 仅 renamed/copied 合法。segment/
effective stable-ID preimage 中的 path/oldPath **从 enclosing PathDelta 取**，
不是从任一 side 任意选择。第一段 before.path 必须等于
`oldPath ?? path`，最后一段 after.path 必须等于 path；相邻段做包含 path 的
完整 state equality。parent `effectiveChange` 的 before/after 必须分别等于
第一段 before/最后一段 after，sourceSegmentIds 按上文 exact non-noop rule；
无 effective 时 B 与 A canonical-equal。rename/copy 的 retained-source 条件
由同一个完整 Delta tree exact lookup 验证，不能由 Git candidate 自报。

每个 `ActualChangeV1.repositoryPathDeltaId` 必须解析到唯一 parent，且
`effectiveChangeId` 等于该 parent 的唯一 effective ID；Actual 的
`path/oldPath/kind` 与 parent/effective 规范值 exact-equal，`sourceLayers`
精确等于 effective sourceSegmentIds 对应的 source 去重后固定顺序全集。
Hunk cluster 只决定 Actual granularity/ID 中的 Hunk IDs，不能缩小 provenance
layers。任一不等都 Bundle reject。

`diff_hunk` Evidence 必须内嵌一个 `DiffHunkV1`，且 Envelope/Evidence
Snapshot、path 和 Hunk Snapshot/path 相等；安全 excerpt 是可选投影，不进入
Hunk ID。`analysis_boundary` Evidence 必须内嵌一个
`AnalysisBoundaryV1`，不再只保存自由文本 `boundaryReason`。
text Hunk 的 operations 至少包含一个 delete/insert，source layers 非空、
unique、按固定 layer 顺序排列且不能含 conflict。content-resolved Actual
只要包含可解码的正文增删，就至少引用一个 Diff Evidence；纯 exact
rename/copy/type-change 或 empty-file add/delete 可以只由 embedded effective
Delta 证明且保持 complete。conflict、binary 或其他无法分析的 content edit
没有 Hunk时必须有 Boundary 且为 partial/unknown。
old/new span 覆盖 canonical edit window，不含仅用于展示的首尾 3 行 context；
因邻近 change group 合并而位于中间的 equal lines 仍进入 operations。Symbol
映射通过顺序回放 operations，只使用 delete/insert 对应的 changed ranges；
excerpt 的首尾 context 不参与 operations/patch digest 或 Hunk ID。
`oldSpan.lineCount` 必须等于 operations 中 equal+delete 数，
`newSpan.lineCount` 必须等于 equal+insert 数。before absent 要求 old span
`{0,0}` 且 operations 不含 equal/delete；after absent 对称地要求 new span
`{0,0}` 且不含 equal/insert；两侧不能同时 absent。
`pairingStatus=exact/renamed` 要求 old/new refs 都非空；`old_only` 只允许
old refs，`new_only` 只允许 new refs，`file_only` 两侧都为空；ambiguous
至少一侧非空且必须有 Boundary。added/deleted/renamed/copied 与 old/new refs、
`oldPath` 的组合由 Bundle validator 交叉校验；Source signature/body span 必须
包含在 full span 内，且所有 byte/line anchors 都落在对应侧 content 中。

Completeness 的五个 tuple 元素按上面的枚举顺序且每维恰好一次。
每维 unit universe 固定为：

| Dimension | canonical units |
|---|---|
| repository_delta | 全部 `RepositoryPathDelta.id` + `RedactedRepositoryDeltaAggregate.snapshotRedactionId`；每个 redaction ID 必有唯一 mapped Boundary |
| semantic_classification | 全部 Actual Change ID + redacted aggregate Boundary ID |
| planned_matching | 全部 Actual Change ID + 当前 generation 已确认的 required Planned Change ID |
| impact_analysis | 全部 Actual Change ID + 当前 generation 已确认的 required Planned Change ID |
| verification_coverage | 当前 generation 的全部 Acceptance Claim ID |

unit ID 必须与上述可信集合 exact-equal，不能由 writer 自报更小 total。每个 unit
complete 要求 Boundary 为空；partial/unknown 要求 Boundary 非空；
`status=unknown` 用于零可判定事实，已有部分可判定事实但未覆盖完整时为
partial。dimension status 是 units 与 dimension-level Boundary 的最差值；
repository_delta dimension 还必须等于 `repositoryDelta.status`。空 universe
只有在没有 dimension Boundary 时才 complete。overall 使用
`unknown > partial > complete` 的最差值。展示用 analyzed/total count 由 unit
status 派生，不持久化调用方数字。Actual complete 同样禁止 `UNKNOWN` 和
Boundary。所有 ID 引用由 Bundle validator 验证同 Task、同 baseline/actual
Snapshot 和正确 Artifact kind。

Finding 新增可选的强字段：

```ts
type VerificationGapV1 =
  | {
      subtype: "missing_plan_entry";
      uncoveredClaimIds: [ClaimId, ...ClaimId[]];
      verificationPlanEntryIds: [];
      boundaryEvidenceIds: [];
    }
  | {
      subtype: "insufficient_coverage";
      uncoveredClaimIds: [ClaimId, ...ClaimId[]];
      verificationPlanEntryIds: [
        VerificationPlanEntryId,
        ...VerificationPlanEntryId[]
      ];
      boundaryEvidenceIds: [];
    }
  | {
      subtype: "unsupported_method" | "ambiguous_coverage";
      uncoveredClaimIds: [ClaimId, ...ClaimId[]];
      verificationPlanEntryIds: [
        VerificationPlanEntryId,
        ...VerificationPlanEntryId[]
      ];
      boundaryEvidenceIds: [
        AnalysisBoundaryEvidenceId,
        ...AnalysisBoundaryEvidenceId[]
      ];
    };

type ExistingContextEvidenceIdV1 =
  EvidenceId & z.core.$brand<"ExistingContextEvidenceIdV1">;

const ExistingContextEvidenceIdV1Schema =
  EvidenceIdSchema.brand<"ExistingContextEvidenceIdV1">();

type StrongFindingEvidenceIdV1 =
  | DiffHunkEvidenceId
  | AnalysisBoundaryEvidenceId
  | ExistingContextEvidenceIdV1;

interface StrongChangeFindingV1 {
  profile: "evidence_backed_v1";
  id: StrongFindingId;
  type: ChangeFindingTypeV1;
  severity: ChangeFindingSeverityV1;
  blocking: boolean;
  summary: NonEmptyString;
  claimIds: [ClaimId, ...ClaimId[]];
  plannedChangeIds: StrongPlannedChangeId[];
  actualChangeIds: ActualChangeId[];
  evidenceIds: StrongFindingEvidenceIdV1[];
  impactPathIds: ImpactPathId[];
  verificationGap?: VerificationGapV1;
  resolution?: ChangeFindingResolutionV1;
}
```

`ExistingContextEvidenceIdV1` 是对当前 generation 已有 Evidence ID 的独立
refine brand：wire bytes 为 lossless existing `EvidenceId`，structural Schema
只负责 wire grammar/brand；Bundle 必须 exact-resolve 到当前 Task/current
generation 的 Evidence ledger，kind 只能是
`source/config/test/git/graph_path/document/human`，且
`observedAtSnapshotId` 必须等于该 generation pin 的 baseline 或 target
Snapshot。`analysis_boundary` 必须使用新的 `AnalysisBoundaryEvidenceId`，
diff 必须使用 `DiffHunkEvidenceId`；foreign generation/Snapshot、wrong kind、
dangling 或 generic `EvidenceIdSchema` cast 全部 reject，并有 invalid fixture。
`StrongChangeFindingV1Schema` 是独立 strict variant，不从 legacy
`ChangeFindingV1Schema.extend()` 继承 opaque Actual/Evidence arrays。summary
与 accepted resolution reason 在写入/公开前仍走 secret/Host-path scanner，
且均不进入 Finding ID/semantic projection的自由文本部分。

只有 `type=verification_gap` 允许且必须携带 `verificationGap`；其他类型禁止。
Finding 条件矩阵：

| type | plannedChangeIds | actualChangeIds | 额外条件 |
|---|---|---|---|
| planned_completed / planned_partial | 非空；只引用 current-generation confirmed required/optional | 非空 | 每个 Actual 的 planned primary |
| unplanned_change | 必须空 | 非空 | 每个 Actual 的 unplanned primary |
| possible_omission | 非空且全部 confirmed required | 必须空 | Delta/Semantic/Matching 对该 obligation complete |
| cannot_determine | 可空，但非空时只允许 confirmed required | 可空，但与 planned 不得同时为空 | 至少一个 structured Boundary Evidence |
| verification_gap | 必须空 | 必须空 | nested gap 按 subtype 验证，是 secondary Finding |

`verificationGap.uncoveredClaimIds` 必须非空且是顶层 `claimIds` 子集；
`boundaryEvidenceIds` 必须是顶层 `evidenceIds` 中 structured Boundary 的子集。
primary disposition 的“恰好一个”在 Bundle 层按 Actual/required obligation
全集验证；verification gap 不能计入或替代 primary。

Actual 条件矩阵：

- `granularity=symbol` 要求至少一侧 Symbol Ref 非空；`granularity=hunk` 要求
  Diff Evidence 非空；`granularity=file` 要求两侧 Symbol Ref 为空；
- added 只允许 `new_only/file_only`，deleted 只允许
  `old_only/file_only`，两者禁止 `oldPath`；
- renamed/copied 要求 `oldPath` 且与 path 不同，只允许
  `exact/renamed/old_only/new_only/ambiguous/file_only`；
- modified/type_changed 禁止 `oldPath`，只允许
  `exact/renamed/old_only/new_only/ambiguous/file_only`；
- complete 要求 Boundary 为空且无 UNKNOWN；partial/unknown 要求至少一个
  structured Boundary Evidence。所有 side-ref presence 还必须满足前述
  pairingStatus 规则。

#### 3.8.4 Strong Task、History、Digest 与排序

```ts
type InternalManagedArtifactTypeV1 =
  | "task_baseline"
  | "context_generation"
  | "task_projection_history";

interface StrongArtifactDependencyFieldsV1 {
  freshnessSemantics?: "propagate_latest" | "immutable_pin";
}

interface ResolvedContextBuildSpecV1 {
  version: "context-build-spec-v1";
  scope: RepositoryRelativePath[]; // sort/unique；空数组表示全仓
  tokenBudget: number;      // resolved value，不保存 undefined
  maxCandidates: number;
  maxImpactDepth: number;
  baseRef?: GitRefNameV1;   // provenance only，refresh/rebase 不重新解析
}

const DEFAULT_CONTEXT_BUILD_SPEC_V1 = {
  version: "context-build-spec-v1",
  scope: [],
  tokenBudget: 8_000,
  maxCandidates: 20,
  maxImpactDepth: 4
} as const;

type ContextGenerationDependencyPinV1 =
  | {
      pinKind: "artifact";
      role: "repository_snapshot";
      artifactId: PathSafeRepositorySnapshotIdV1;
      contentDigest: ContentDigest;
      sourceSnapshotId: PathSafeRepositorySnapshotIdV1;
    }
  | {
      pinKind: "artifact";
      role: "repo_pulse" | "graph" | "wiki" | "source_evidence";
      artifactId: ArtifactId;
      contentDigest: ContentDigest;
      sourceSnapshotId: PathSafeRepositorySnapshotIdV1;
    }
  | {
      pinKind: "artifact_absence";
      role: "graph" | "wiki" | "source_evidence";
      reasonCode:
        | "not_generated"
        | "not_available"
        | "policy_excluded"
        | "integrity_unavailable";
    }
  | {
      pinKind: "policy";
      role: "policy";
      policyKind:
        | "context_build"
        | "repository"
        | "scanner"
        | "safe_git_execution";
      contentDigest: ContentDigest;
    };

interface ContextGenerationInputV1 {
  version: "context-generation-input-v1";
  taskId: TaskId;
  resultingRevision: number;
  previousContextGenerationId?: ContextGenerationId;
  baselineSnapshotId: PathSafeRepositorySnapshotIdV1;
  targetSnapshotId: PathSafeRepositorySnapshotIdV1;
  contextBuildSpecDigest: ContentDigest;
  upstreamDependencyPins: ContextGenerationDependencyPinV1[];
}

interface ContextGenerationRecordV1 {
  profile: "context_generation_record_v1";
  id: ContextGenerationId;
  input: ContextGenerationInputV1;
  inputDigest: ContentDigest;
  createdAt: IsoTimestamp;
}

interface ContextGenerationRecordEnvelopeV1 {
  schemaVersion: 1;
  artifactType: "context_generation";
  artifactId: ContextGenerationId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  taskId: TaskId;
  sourceSnapshotId: PathSafeRepositorySnapshotIdV1;
  revision: number;
  producerVersion: ProducerVersion;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: ContextGenerationRecordV1;
}

interface StrongTaskManifestFieldsV1 {
  taskProfile: "agent_task_v1";
  taskBaselineArtifactId: TaskBaselineArtifactId;
  contextBuildSpec: ResolvedContextBuildSpecV1;
  contextGenerationId?: ContextGenerationId;
  privateStoreQuotaCommitProof: PrivateStoreQuotaCommitProofV1;
}

interface StrongTaskBriefFieldsV1 {
  contextGenerationId: ContextGenerationId;
}

type PlannedChangeExpectationV1 =
  | "required_change"
  | "optional_change"
  | "inspect_only"
  | "verification_only";

interface StrongPlannedChangeFieldsV1 {
  id: StrongPlannedChangeId;
  expectation: PlannedChangeExpectationV1;
}

interface StrongVerificationPlanEntryFieldsV1 {
  id: VerificationPlanEntryId;
  acceptanceClaimIds: [ClaimId, ...ClaimId[]];
  method: VerificationMethodV1;
  description: NonEmptyString;
  required: boolean; // explicit；no default
}

interface StrongConfirmationActionFieldsV1 {
  contextGenerationId: ContextGenerationId;
}

interface StrongTransitionStatusActionFieldsV1 {
  verificationRecordId?: StrongVerificationRecordId;
}

interface StrongTaskEventGenerationFieldsV1 {
  previousContextGenerationId?: ContextGenerationId;
  resultingContextGenerationId?: ContextGenerationId;
}

interface StrongRepositoryBasisReceiptFieldsV1 {
  repositoryBasisRecordId: RepositoryBasisRecordId;
  repositoryBasisRecordContentDigest: ContentDigest;
  repositoryBasisDigest: ContentDigest;
  repositoryReadSetDigest: ContentDigest;
}

interface PrivateStoreQuotaCommitProofV1 {
  admissionRecordId: PrivateStoreQuotaAdmissionRecordId;
  admissionRecordContentDigest: ContentDigest;
  transitionRecordId: PrivateStoreQuotaTransitionRecordId;
  transitionRecordContentDigest: ContentDigest;
  preQuotaIndexRootDigest: ContentDigest;
  postQuotaIndexRootDigest: ContentDigest;
  quotaDeltaDigest: ContentDigest;
}

interface StrongQuotaReceiptFieldsV1 {
  privateStoreQuotaCommitProof: PrivateStoreQuotaCommitProofV1;
}

type VerificationPublicResultCodeV1 =
  | "verification_passed"
  | "verification_failed"
  | "verification_blocked"
  | "verification_flaky"
  | "verification_skipped";

interface LegacyVerificationRedactedViewV1 {
  viewVersion: 1;
  viewKind: "legacy_verification_redacted";
  sourceArtifactId: ArtifactId;
  sourceRecordId: VerificationRecordId;
  taskId: TaskId;
  verificationPlanEntryId: OpaqueIdentifier;
  attempt: number;
  supersedesVerificationRecordId?: VerificationRecordId;
  method: VerificationMethodV1;
  status: VerificationStatusV1;
  claimIds: ClaimId[];
  snapshotId: SnapshotId;
  recordedAt: IsoTimestamp;
  detailStatus: "legacy_redacted";
}

type VerificationDetailRedactionCodeV1 =
  | "secret_detected"
  | "host_path_detected"
  | "control_character"
  | "invalid_utf8";

type StrongVerificationDetailStateV1 =
  | {
      status: "none";
    }
  | {
      status: "stored";
      detailCommitment: KeyedStateTokenV1;
    }
  | {
      status: "redacted";
      redactionCodes: [
        VerificationDetailRedactionCodeV1,
        ...VerificationDetailRedactionCodeV1[]
      ];
    };

interface VerificationSkipAcceptanceRecordV1 {
  profile: "verification_skip_acceptance_v1";
  id: VerificationSkipAcceptanceId;
  taskId: TaskId;
  verificationRecordId: StrongVerificationRecordId;
  contextGenerationId: ContextGenerationId;
  snapshotId: PathSafeRepositorySnapshotIdV1;
  verificationPlanEntryId: VerificationPlanEntryId;
  actor: Actor;
  reasonCode:
    | "not_applicable"
    | "environment_unavailable"
    | "risk_accepted"
    | "superseded_requirement";
  acceptedAt: IsoTimestamp;
  eventId: EventId;
}

interface StrongVerificationRecordV1 {
  profile: "verification_record_strong_v1";
  id: StrongVerificationRecordId;
  taskId: TaskId;
  verificationPlanEntryId: VerificationPlanEntryId;
  contextGenerationId: ContextGenerationId;
  attempt: number;
  supersedesVerificationRecordId?: StrongVerificationRecordId;
  method: VerificationMethodV1;
  status: VerificationStatusV1;
  publicResultCode: VerificationPublicResultCodeV1;
  claimIds: ClaimId[];
  snapshotId: PathSafeRepositorySnapshotIdV1;
  changeCheckArtifactId: ArtifactId;
  changeCheckContentDigest: ContentDigest;
  detail: StrongVerificationDetailStateV1;
  recordedAt: IsoTimestamp;
  actor: Actor;
}

interface StrongVerificationPayloadV1 {
  profile: "verification_ledger_strong_v1";
  records: StrongVerificationRecordV1[];
  skipAcceptances: VerificationSkipAcceptanceRecordV1[];
}

interface LegacyVerificationPayloadV1 {
  records: LegacyVerificationRecordV1[];
}

type VerificationArtifactPayloadV1 =
  | LegacyVerificationPayloadV1
  | StrongVerificationPayloadV1;

type VerificationArtifactV1 =
  ArtifactEnvelopeV1<VerificationArtifactPayloadV1>;

type VerificationSurfaceRecordV1 =
  | {
      kind: "strong";
      record: StrongVerificationRecordV1;
    }
  | {
      kind: "legacy_redacted";
      view: LegacyVerificationRedactedViewV1;
    };

interface VerificationSurfaceLedgerV1 {
  viewVersion: 1;
  records: VerificationSurfaceRecordV1[];
  skipAcceptances: VerificationSkipAcceptanceRecordV1[];
}

type VerificationDetailInputFieldV1 =
  | "command"
  | "exit_code"
  | "duration_ms"
  | "summary"
  | "raw_output";

interface SensitiveRequestScanPolicyV1 {
  version: "sensitive-request-scan-policy-v1";
  scannerRulesetDigest: ContentDigest;
  maxNormalizedInputBytes: 16_777_216; // 16 MiB
  maxPublicTextBytes: 65_536; // task/reason, each
  maxCommandArgumentCount: 256;
  maxCommandExecutableBytes: 8_192;
  maxCommandArgumentBytes: 8_192;
  maxCommandTotalBytes: 1_048_576; // 1 MiB
  maxSummaryBytes: 65_536;
  maxRawOutputBytes: 8_388_608; // 8 MiB
  maxClaimIds: 4_096;
}

type StrongSafeRequestProjectionV1 =
  | {
      version: "operation-safe-request-v1";
      sensitiveRequestScanPolicyDigest: ContentDigest;
      operation: "build_task_brief";
      actor: Actor;
      expectedRevision: 0;
      snapshotAssertions: {};
      safeInput: {
        task: NonEmptyString; // public text；完整 scanner 通过
        contextBuildSpec: ResolvedContextBuildSpecV1;
      };
    }
  | {
      version: "operation-safe-request-v1";
      sensitiveRequestScanPolicyDigest: ContentDigest;
      operation: "check_change";
      actor: Actor;
      expectedRevision: number;
      snapshotAssertions: {
        actualSnapshotId: PathSafeRepositorySnapshotIdV1;
      };
      safeInput: {
        taskId: TaskId;
        includeWorktree: true;
      };
    }
  | {
      version: "operation-safe-request-v1";
      sensitiveRequestScanPolicyDigest: ContentDigest;
      operation: "record_verification";
      actor: Actor;
      expectedRevision: number;
      snapshotAssertions: { snapshotId: PathSafeRepositorySnapshotIdV1 };
      safeInput: {
        taskId: TaskId;
        verificationPlanEntryId: VerificationPlanEntryId;
        supersedesVerificationRecordId?: StrongVerificationRecordId;
        method: VerificationMethodV1;
        status: VerificationStatusV1;
        claimIds: ClaimId[];
        detailDisposition: "none" | "stored" | "redacted";
        detailFields: VerificationDetailInputFieldV1[];
      };
    }
  | {
      version: "operation-safe-request-v1";
      sensitiveRequestScanPolicyDigest: ContentDigest;
      operation: "update_task";
      action: "refresh_task_context";
      actor: Actor;
      expectedRevision: number;
      snapshotAssertions: {
        targetSnapshotId: PathSafeRepositorySnapshotIdV1;
      };
      safeInput: { taskId: TaskId };
    }
  | {
      version: "operation-safe-request-v1";
      sensitiveRequestScanPolicyDigest: ContentDigest;
      operation: "update_task";
      action: "rebase_task";
      actor: Actor;
      expectedRevision: number;
      snapshotAssertions: {
        targetSnapshotId: PathSafeRepositorySnapshotIdV1;
        newBaselineSnapshotId: PathSafeRepositorySnapshotIdV1;
      };
      safeInput: {
        taskId: TaskId;
        reason: NonEmptyString; // public Event text；完整 scanner 通过
      };
    };

type NormalizedOperationInputForEqualityV1 =
  | {
      operation: "build_task_brief";
      actor: Actor;
      expectedRevision: 0;
      task: NonEmptyString;
      contextBuildSpec: ResolvedContextBuildSpecV1;
    }
  | {
      operation: "check_change";
      actor: Actor;
      expectedRevision: number;
      taskId: TaskId;
      actualSnapshotId: PathSafeRepositorySnapshotIdV1;
      includeWorktree: true;
    }
  | {
      operation: "record_verification";
      actor: Actor;
      expectedRevision: number;
      taskId: TaskId;
      snapshotId: PathSafeRepositorySnapshotIdV1;
      verificationPlanEntryId: VerificationPlanEntryId;
      supersedesVerificationRecordId?: StrongVerificationRecordId;
      method: VerificationMethodV1;
      status: VerificationStatusV1;
      claimIds: ClaimId[];
      command?: {
        executable: NonEmptyString;
        arguments: NonEmptyString[];
        workingDirectory: "repository_root";
        environmentKeys: NonEmptyString[];
      };
      exitCode?: number;
      durationMs?: number;
      summary?: NonEmptyString;
      rawOutputBase64url?: CanonicalByteStringV1;
    }
  | {
      operation: "update_task";
      action: "refresh_task_context";
      actor: Actor;
      expectedRevision: number;
      taskId: TaskId;
      targetSnapshotId: PathSafeRepositorySnapshotIdV1;
    }
  | {
      operation: "update_task";
      action: "rebase_task";
      actor: Actor;
      expectedRevision: number;
      taskId: TaskId;
      targetSnapshotId: PathSafeRepositorySnapshotIdV1;
      newBaselineSnapshotId: PathSafeRepositorySnapshotIdV1;
      reason: NonEmptyString;
    };

interface RequestEqualityRecordV1 {
  profile: "request_equality_v1";
  id: RequestEqualityRecordId;
  taskId: TaskId;
  eventId: EventId;
  operation:
    | "build_task_brief"
    | "check_change"
    | "record_verification"
    | "update_task";
  action?: "refresh_task_context" | "rebase_task";
  safeRequestDigest: ContentDigest;
  sensitiveRequestScanPolicyDigest: ContentDigest;
  fullInputEqualityTag: KeyedStateTokenV1;
  createdAt: IsoTimestamp;
}

interface RequestEqualityRecordEnvelopeV1 {
  schemaVersion: 1;
  recordType: "request_equality";
  recordId: RequestEqualityRecordId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  taskId: TaskId;
  taskRevision: number;
  eventId: EventId;
  producerVersion: ProducerVersion;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: RequestEqualityRecordV1;
}

interface InternalVerificationDetailV1 {
  profile: "verification_detail_internal_v1";
  id: InternalVerificationDetailId;
  verificationRecordId: StrongVerificationRecordId;
  command?: {
    executable: NonEmptyString;
    arguments: NonEmptyString[];
    workingDirectory: "repository_root";
    environmentKeys: NonEmptyString[]; // names only；never values
  };
  exitCode?: number;
  durationMs?: number;
  safeSummary?: NonEmptyString;
  outputDigest?: ContentDigest;
  scannerPolicyDigest: ContentDigest;
  detailSemanticDigest: ContentDigest;
  createdAt: IsoTimestamp;
}

interface InternalVerificationDetailEnvelopeV1 {
  schemaVersion: 1;
  recordType: "verification_detail";
  recordId: InternalVerificationDetailId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  taskId: TaskId;
  verificationRecordId: StrongVerificationRecordId;
  producerVersion: ProducerVersion;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: InternalVerificationDetailV1;
}

type TaskProjectionArtifactTypeV1 =
  | ArtifactTypeV1
  | "task_baseline"
  | "context_generation";

type TaskProjectionArtifactIdV1 =
  | ArtifactId
  | TaskBaselineArtifactId
  | ContextGenerationId;

type HistoryRootRelativePathV1 =
  `artifacts/${TaskProjectionArtifactTypeV1}/${StoreFilenameKeyV1}.json`;

interface TaskProjectionDescriptorPinV1 {
  artifactType: TaskProjectionArtifactTypeV1;
  artifactId: TaskProjectionArtifactIdV1;
  contentDigest: ContentDigest;
  sourceSnapshotId: PathSafeRepositorySnapshotIdV1;
  taskRevision: number;
  rootRelativePath: HistoryRootRelativePathV1;
  descriptorDigest: ContentDigest;
}

type TaskProjectionDependencyRoleV1 =
  | "derived_from"
  | "requires"
  | "indexes"
  | "projects"
  | "task_baseline";

interface TaskProjectionDependencyEdgeV1 {
  fromArtifactId: TaskProjectionArtifactIdV1;
  role: TaskProjectionDependencyRoleV1;
  toArtifactId: TaskProjectionArtifactIdV1;
  toArtifactType: TaskProjectionArtifactTypeV1;
  requiredDigest: ContentDigest;
  requiredSnapshotId: PathSafeRepositorySnapshotIdV1;
  sourceFreshnessSemantics: "propagate_latest" | "immutable_pin";
  freshnessSemantics: "immutable_pin";
}

interface TaskProjectionHistoryRootV1 {
  profile: "task_projection_history_v1";
  id: TaskProjectionHistoryId;
  taskId: TaskId;
  archivedTaskRevision: number;
  contextGenerationId?: ContextGenerationId;
  baselineSnapshotId: PathSafeRepositorySnapshotIdV1;
  latestSnapshotId: PathSafeRepositorySnapshotIdV1;
  reason: "snapshot_cleanup" | "refresh" | "rebase";
  rootArtifactIds: [
    TaskProjectionArtifactIdV1,
    ...TaskProjectionArtifactIdV1[]
  ];
  descriptors: TaskProjectionDescriptorPinV1[];
  dependencyEdges: TaskProjectionDependencyEdgeV1[];
  dependencyClosureDigest: ContentDigest;
  archivedAt: IsoTimestamp;
}

interface InternalTaskProjectionHistoryEnvelopeV1 {
  schemaVersion: 1;
  artifactType: "task_projection_history";
  artifactId: TaskProjectionHistoryId;
  repositoryId: PathSafeRepositoryIdV1;
  worktreeId: PathSafeWorktreeIdV1;
  sourceSnapshotId: PathSafeRepositorySnapshotIdV1;
  taskId: TaskId;
  revision: number;
  producerVersion: ProducerVersion;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: TaskProjectionHistoryRootV1;
}
```

Verification Artifact 的 payload 是上面的**整包** strict union，而不是
record-level union。缺少 `profile` 的历史 payload 只能包含
`LegacyVerificationRecordV1[]`，`profile=verification_ledger_strong_v1` 的
payload 必须同时显式包含 `records/skipAcceptances` 且只能包含 strong Record；
同一 Envelope 混装 legacy/strong Record、给 legacy payload 注入
`skipAcceptances`，或省略 strong profile/数组均 reject。兼容 reader 先按
payload profile 选择完整 Schema，不逐条猜 variant；生产 writer 只生成 strong
payload。所有非 owner-only Surface 返回 `VerificationSurfaceLedgerV1`：
legacy Record 逐条投影为 redacted view，strong Record 与独立 skip acceptance
按原 strict safe Schema返回，绝不返回 raw legacy Envelope。

strong mutation 的 request identity 不再对完整 raw input 做公开 SHA。顺序固定为
`parse → authorize → sensitive-input scan → safe projection + owner-only equality
tag → safe request digest → trusted Bundle/idempotency lookup → guard/work/commit`；
authorization 必须早于 security key、private equality record 或 Repository
读取。`safeRequestDigest` 精确等于
`sha256(canonical JSON(["operation-safe-request-v1",
{sensitiveRequestScanPolicyDigest,operation,action?,actor,expectedRevision,
snapshotAssertions,safeInput}]))`。
idempotency key、raw detail、Engine 生成的 Task/Event/attempt/time 与 private
equality tag 均排除。
现有 Event/Idempotency Record/Receipt/Journal 的公开字段名仍是
`requestDigest`；strong writer 必须令它 **exact-equal 上述
`safeRequestDigest`**。后者是算法名及 private equality payload 的字段名，不
新增第二个 public digest，也不允许旧 raw-input digest 并存。

`StrongSafeRequestProjectionV1` 是上述五个入口的 exact strict union：

- build intent/rebase reason 会进入公开 Artifact/Event，必须先完整扫描；命中
  secret/Host path/control 时请求零写拒绝，不能 hash 后再 redaction；
- Verification command、summary、raw output 属于 transient/private detail，
  public projection 只记录结构化 `detailDisposition/detailFields`。command token、
  summary bytes、raw output、环境 value、长度和它们的 raw SHA 都不得进入
  `safeRequestDigest`、Journal、Receipt、Event、日志或 Surface；
- `detailFields` 按上表 enum 顺序、unique；Claim/Verification ID 数组 bytewise
  sorted/unique。detail disposition 必须是完整 scanner 结果，而非 caller
  声明；scanner error 整个 Operation 零写；
- Snapshot assertion 只放 caller 的 exact assertion；不把 commit 时选择的
  latest Snapshot 或其他 Engine 输出偷偷并入，从而保证 replay 可重算。

入口先用 `SensitiveRequestScanPolicyV1` 的 incremental parser/scanner 计数。
strict/capped normalization 完成后，由 incremental canonical-JSON encoder 按
冻结 key order 逐 chunk 输出与下式**完全相同**的 UTF-8 bytes 并更新 HMAC；
raw output 先规范为 `CanonicalByteStringV1`，因此不依赖 `Uint8Array` 的运行时
JSON 表示。不能先把任意 caller JSON/raw output materialize 成无界 object 再
stringify/hash。
normalized input 总量、task/reason、command executable/argument count/单项/总量、
summary、raw output 或 Claim 数任何一项超 cap，都在 security key/private file/
Repository 读取前以固定 `sensitive_request_limit_exceeded` 零写拒绝，不能把
oversized 请求降级为 redacted success。strict parsed defaults 必须先 resolve，
再由上面的 `NormalizedOperationInputForEqualityV1` 五分支完整覆盖；字段缺失、
额外键、非 canonical ordering 或 union 外 operation/action 一律 reject。
resolved scan policy digest 同时进入 safe projection、private equality record
与两个 digest/HMAC preimage，replay 不允许跨 policy 偷换。

完整 normalized parsed input（含 transient bytes，但排除 idempotency key）只
用于计算
`HMAC-SHA256(securityEqualityKey, canonical JSON(
["operation-full-request-equality-v1",
{sensitiveRequestScanPolicyDigest,input: fullInput}]))`，结果作为
`fullInputEqualityTag` 保存于 owner-only `RequestEqualityRecordV1`。它不得公开，
也不得替换成未加 key 的 content digest。每个成功 Event 恰好一个 equality
record，固定路径为
`.understand-code/tasks/<taskId>/private/request-equality/<encoded-eventId>.json`，与
Journal/Event/Receipt 在同一 Task transaction 原子提交；Envelope/payload 的
record/task/event/time/scan-policy digest 必须 exact-equal，ID 按
`request-equality-v1` preimage 重算。current 与 History Journal 都是其
closure root，P0 不自动 GC。

授权后的 same-key replay 必须同时满足 public Journal 的 operation/Actor/
`safeRequestDigest` 和 private record 的 `fullInputEqualityTag`；任一缺失、损坏
或不等返回 fail-closed conflict，不返回历史结果，也不追加 revision。这样即使
两个不同 command/raw output 产生相同 public structural projection，也不会被
误判为同请求。首次 key provisioning 与 key 丢失规则复用 3.8.2 的
owner-only security equality key。

strong Manifest 从 `created@1` 起必须包含前三个非可选字段。Event chain 尚未出现
成功 Context publication 时 generation 可缺；一旦出现，Manifest、current
Brief、publication Event 必须相等，之后 blocked/stale/superseded 也保留。
strong Brief 必须写 `contextGenerationId`；strong Planned Change 必须写
`expectation`；strong Verification Plan Entry 必须写独立 branded ID 与显式
`required`，不得依赖 parse-time default。ID 的 generation 来自 enclosing
Brief，并与 Manifest 相等；acceptance IDs sorted/unique/nonempty。
`confirm_goal/confirm_acceptance_criteria/confirm_plan` Action
必须携带当前 generation，并原样进入 Event。Event 的 generation 规则为：
Genesis 两字段都缺；首次 created→context_ready 的 previous 缺失/resulting
等于新 generation；refresh/rebase 的 previous 等于旧 Manifest、resulting
等于新 Manifest；其余 generation 已存在的 Event 两者都等于 current。

generation ID 由 `ContextGenerationInputV1` 的 domain-separated canonical
JSON 派生。`contextBuildSpecDigest` 必须精确等于 Manifest 中完整
`ResolvedContextBuildSpecV1` 按 `context-build-spec-v1` 表列字段重算的
SHA-256；禁止只 hash caller input、默认值注入前对象或省略 provenance
`baseRef`。`upstreamDependencyPins` 只允许本代构建前已经存在的 Snapshot、
Pulse、Graph、Wiki、source Evidence 和 policy input。artifact pin 按
`[pinKind,role,artifactId,contentDigest,sourceSnapshotId]`，policy pin 按
`[pinKind,role,policyKind,contentDigest]`，absence pin 按
`[pinKind,role,reasonCode]` 排序；global pinKind order 为
`artifact < artifact_absence < policy`，并 exact duplicate reject。policy
pin 不伪造 Artifact ID/Snapshot；
严禁放入本代 Manifest/Brief/Claim/Event/Receipt，避免 digest cycle。因此 exact
replay 相同，而新 refresh/rebase 即使内容相同也因 resulting revision 不同而
产生新 generation。

“完整输入”还有以下 cardinality/equality matrix：恰好一个
`repository_snapshot` artifact pin，其 `artifactId/sourceSnapshotId` 都等于
`input.targetSnapshotId`；`context_build/repository/scanner/
safe_git_execution` policy 各恰好一个，且 context-build digest 等于
`contextBuildSpecDigest`。`repo_pulse` 恰好一个 present pin，必须 evaluated
target Snapshot 且 status 不是 `not_ready/unknown`；
`graph/wiki/source_evidence` 每个 role 恰好一个 present 或
`artifact_absence` variant，不能靠省略表达缺失。present pin 的
`sourceSnapshotId` 必须等于 target Snapshot，absence 只允许上表 fixed reason
code。role duplicate、额外 pin、foreign Snapshot、missing policy 均 reject。
首次 generation 禁 `previousContextGenerationId`；refresh/rebase
必须等于旧 Manifest generation。Envelope 必须满足
`sourceSnapshotId===input.targetSnapshotId`、
`revision===input.resultingRevision`。

每次成功 Context publication 必须同事务写 immutable internal-only
`ContextGenerationRecordEnvelopeV1`，固定路径为
`.understand-code/tasks/<taskId>/context-generations/
<encoded-generationId>.json`。`inputDigest` 按
`context-generation-input-v1` 完整重算，generation ID 再按
`context-generation-v1 + {input}` 重算；Envelope/payload 的 Task/Snapshot/
revision/time/ID/content digest exact-equal。Manifest、Brief、publication Event
和 History closure 都必须解析并 pin 该 Record，不能只保存一个不可重算 ID。
archive/retry marker 在首个副作用前固定 `createdAt`；同 semantic ID 已存在时
只能复用首次 exact bytes/time，否则 conflict。

`transition_status` 从 `verification_required` 到 `in_progress` 时
`verificationRecordId` 必填，并原样进入 Event；其他 transition 禁止该字段。
Bundle validator 要求它是当前 generation/Snapshot/Plan Entry supersedes 链的
唯一 leaf，且状态为 failed/blocked/flaky。refresh Action 固定
`targetSnapshotId`；rebase Action 固定
`targetSnapshotId/newBaselineSnapshotId/reason`，两个 Snapshot 必须相等。

现有 `VerificationRecordV1Schema` 原样保留并重命名为
`LegacyVerificationRecordV1Schema`；兼容 reader 只能先选择整包
`LegacyVerificationPayloadV1Schema | StrongVerificationPayloadV1Schema`，
不能在 record 层逐条 union 猜测；
legacy bytes、digest 和历史 ledger 不改写，但任何 Surface 投影 legacy
command/summary 前仍必须执行递归脱敏。通用 `read_artifact`、Receipt replay、
MCP Resource、Markdown 与 Workbench **不得**直出 legacy raw Envelope；它们
只能返回 `LegacyVerificationRedactedViewV1`（ID/Task/Plan/attempt/method/
status/Claim/Snapshot/time + `detailStatus=legacy_redacted`），不含
command/summary/exitCode/duration/outputDigest/skip reason，也不含 source raw
`contentDigest`。该 view 是 strict derived DTO、不是 Artifact Envelope，拒绝
额外键；Surface response 只能是 discriminated
`VerificationSurfaceRecordV1`，不能把 raw/derived object spread 合并。只有
owner-only trusted Store validator/migration reader 可读取 raw bytes。strong
writer 只能写 strong variant。
公开 strong Record Schema **禁止** `command/summary/exitCode/durationMs/
outputDigest/rawOutput` 等字段；`publicResultCode` 与 method/status 的映射是固定
表：`passed→verification_passed`、`failed→verification_failed`、
`blocked→verification_blocked`、`flaky→verification_flaky`、
`skipped→verification_skipped`，method 不改变该映射。
`detail.status=stored` 当且仅当 owner-only detail record 存在，derived ID/
Envelope/content digest 均有效，且
`detailCommitment === HMAC(securityEqualityKey,
["verification-detail-commitment-v1",
{taskId,contextGenerationId,snapshotId,verificationPlanEntryId,attempt,
internalDetailSemanticDigest}])`。`internalDetailSemanticDigest` 按
`verification-detail-semantic-v1` 对 sanitized private fields 重算，排除
Record/detail ID 与时间，因此 commitment 可以在 Record ID 前确定且没有
fixed-point；public Record 不保存 private ID/content digest。redacted 只保存
sorted/unique nonempty `VerificationDetailRedactionCodeV1[]`，不引用不存在的
Boundary ledger，也不保存命中文本。manual 且没有
safeSummary/duration 时为 none；manual 有扫描通过的 safeSummary/duration 时
为 stored，命中 secret/Host path 时同样允许且必须为 redacted。

strong conditional matrix 固定为：

- `attempt` 是正整数；attempt 1 当且仅当无 supersedes，attempt >1 必须
  supersede 同 Task/generation/Snapshot/Plan Entry 的当前唯一 leaf，且恰好
  `attempt=prior.attempt+1`；
- `StrongVerificationRecordV1` 永远不内嵌/后写 `skipAcceptance`，Record bytes、
  ID 与 content digest 创建后不可变。只有 `status=skipped` 的 current leaf
  才允许后续强类型 `accept_verification_skip` 在同一 Verification ledger
  追加一个 `VerificationSkipAcceptanceRecordV1`；其 actor/time/event ID 与
  Action/Event 精确相等。每个 skipped Record 最多一个 acceptance，非 skipped、
  foreign/old generation 或重复 acceptance 全部 reject；
- `method!=manual` 且 status 为 passed/failed/flaky 时，transient input 的
  normalized command 必填；扫描通过后 public detail 必须 stored，命中
  secret/Host path 后必须 redacted，不能是 none；blocked/skipped 没有执行
  detail 时可以 none；
- manual 禁止 command 与 exitCode；可以没有 detail，或只保存扫描通过的
  safeSummary/duration；
- exitCode 如存在，passed 必须为 0，failed 必须非 0；duration 是 nonnegative
  safe integer。stored detail 的 method/status/Record linkage 与 public Record
  交叉验证；
- `changeCheckArtifactId/contentDigest` 必须解析到当前 generation/Snapshot 的
  canonical strong Check；Claim IDs 是该 Plan Entry acceptance Claim 的
  nonempty、sorted、unique 子集。

`accept_verification_skip` 自己是一次普通 strong Task Mutation：CAS +1
revision、追加 `verification_skip_accepted` Event/Receipt，并只向
`skipAcceptances[]` append。Acceptance ID 使用上表 exact preimage；Record、
detail 与既有 acceptance bytes 都不改写。verified Gate 要求 skipped current
leaf 存在唯一、digest-valid、同 generation/Snapshot/Plan Entry 的 acceptance
record；删除/覆盖/把 legacy nested acceptance 注入 strong Record 均 fail
closed。legacy nested `skipAcceptance` 只按历史 schema 读取并通过 redacted
Surface view，不迁移成 strong acceptance。

内部 detail 不是公开 Artifact Type，不进入 MCP union、通用
`read_artifact`、Markdown 或 Receipt replay result。它存于 owner-only
Verification detail ledger，目录/文件分别 0700/0600。command 在内存中先做
token normalization、禁止 shell-string 执行语义、递归 secret/Host absolute
path/control 扫描；environment 只保存 key，不保存 value。raw stdout/stderr
永不持久化；`outputDigest` 仅在完整 raw output 经同一 scanner 明确通过后
计算并保存；`safeSummary` 同样必须完整通过扫描，不能保存 redaction 前文本。
scanner 命中时不写 detail，public Record 使用 `detail.status=redacted` 并只按
fixed mapping 写 `secret_detected/host_path_detected/control_character/
invalid_utf8` code；
scanner 报错则整个 Operation 零写 fail closed。stored 状态的 ID/digest 必须
解析到 exact Envelope，Envelope/Record/Verification ledger/Event/Receipt/
Journal 在同一 Task transaction 原子发布；任一写入/校验失败不得留下 public
Record 或 private orphan。固定路径为
`.understand-code/tasks/<taskId>/private/verification-details/<encoded-detailId>.json`，
不能进入 public descriptor enumeration。current 或 archived historical
Verification Record 的 stored commitment 是 owner-only closure edge；History
root 通过 pinned Verification payload、derived private ID 与 HMAC commitment
间接保留并验证 detail。refresh/rebase/
snapshot cleanup 不删除 committed detail，P0 不自动 GC；只有 durable marker
可回收该 transaction-owned、未被 current/historical Verification pin 的
uncommitted orphan。marker 预声明并恢复该文件。
`recordVerification` 仍只记录，永不 spawn。

现有 `ArtifactDependencyV1` 增加可选 `freshnessSemantics` 只为 lossless
compatibility；legacy 缺失值由 read-view 解释为 `propagate_latest`，不得由
parser 写回。strong writer 每条 dependency 都显式写值；
`immutable_pin` 强制 `requiredDigest/requiredSnapshotId` 同时存在，latest
变化不传播 stale，但 missing/corrupt/digest or Snapshot mismatch 仍 invalid。

`task_baseline/task_projection_history` 只扩展 Store 的
`ManagedArtifactTypeV1Schema`，不扩展公开 `ArtifactTypeV1Schema`。
`task_projection_history_v1`只允许 strong Task生成；descriptor
`sourceSnapshotId`、edge `requiredSnapshotId`、root
`baselineSnapshotId/latestSnapshotId`与 Envelope `sourceSnapshotId`全为
`PathSafeRepositorySnapshotIdV1`，并按下述 closure exact-equal。generic legacy
`SnapshotId`不得进入或通过 History包装升级。
History root 的稳定路径固定为
`.understand-code/tasks/<taskId>/history/<revision>-<encoded-rootId>/root.json`；被覆盖
的 artifact bytes 固定归档到同目录
`artifacts/<artifactType>/<encoded-artifactId>.json`，private CAS/lease/Verification
detail 只保留 owner-only pin。
Manifest 必须保留所有 history-root descriptor 及其 historical dependency
descriptors，不能再按 taskId 删除全部旧 descriptor；newest root 可 current，
更旧 root historical，但均是 Manifest 中**并列、独立**的 immutable GC root；
新 History 不复制、不依赖、不包装旧 History。transaction marker 预声明 history
files、blob/ref ownership 和完整 old/new descriptor set，覆盖 snapshot cleanup、
auto-stale、refresh、rebase 的每个 crash phase。
History Envelope 必须满足 `artifactId===payload.id`、
`taskId===payload.taskId`、`sourceSnapshotId===payload.latestSnapshotId`；
Envelope revision 是 archive transaction resulting revision，必须大于或等于
payload archived revision。路径 `<revision>` 使用 Envelope revision，
`<encoded-rootId>` decode 后同时等于 Envelope artifactId/payload.id；content digest 与 managed
descriptor ID/path/digest/revision 全部 exact-equal。任何一个不等 fail closed。

History closure 的构造与重验使用同一个唯一算法：

1. 在 archive transaction 的旧 revision 视图中，`rootArtifactIds` 必须
   exact-equal 所有 current task-scoped descriptor（明确排除全部
   `task_projection_history` descriptor）与 current `task_baseline`
   descriptor 的 artifact ID；按 bytewise ID 排序、unique、nonempty。
   repository-scoped Snapshot/Pulse 只能作为依赖，不能提升为 root；既有
   History root 继续由 Manifest 独立保留，不进入本 root 的 descriptor/edge
   closure；
2. 从排序后的 roots 依次读取 pinned immutable bytes。每个 descriptor 的
   `descriptorDigest` 必须重算为
   `sha256(canonical JSON(["task-projection-descriptor-v1",
   {artifactType,artifactId,contentDigest,sourceSnapshotId,taskRevision,
   rootRelativePath}]))`。`rootRelativePath` 只能是相对 History root 的
   `artifacts/<artifactType>/<encoded-artifactId>.json`，不含 revision/rootId；
   descriptor 自身的 digest、状态、时间和物理 archive root path 不进入该投影，
   因而不存在 rootId→descriptorDigest→path(rootId) 循环；
3. pinned Store descriptor dependency list 中每一条强 dependency 都必须产生
   恰好一个 edge；
   ordinary edge 的 `role` 必须逐字等于 dependency 的 `relation`，
   Manifest 的 `taskBaselineArtifactId` 另产生 role=`task_baseline` 的 synthetic
   immutable edge。edge target 必须解析到 exact descriptor pin；不得缺边、
   多边或用 latest descriptor 替换 required ID/digest/Snapshot。archive 时
   target 已解析为 exact immutable bytes，因此所有 edge 的
   `freshnessSemantics` 固定写 `immutable_pin`；原 dependency 的
   `propagate_latest/immutable_pin` 只保存在 `sourceFreshnessSemantics` 供审计，
   legacy 缺失值在这里记录为 `propagate_latest`，不能让 archived edge 继续
   随 latest 传播 stale；
4. edge 按
   `[fromArtifactId,role,toArtifactType,toArtifactId,requiredDigest,
   requiredSnapshotId,sourceFreshnessSemantics,freshnessSemantics]` 的 UTF-8
   bytewise tuple 排序并拒绝
   duplicate。按该顺序做 deterministic DFS，三色标记检测 cycle；发现 cycle
   整个 archive fail closed，不能截断或靠 visited 集掩盖；
5. `descriptors` 必须 exact-equal roots 加全部可达 dependency descriptor，
   每个 ID 恰好一个、无 unreachable extra，并按
   `[artifactType-order,artifactId,contentDigest]` 排序。closure digest 必须
   重算为 `sha256(canonical JSON(["task-projection-dependency-closure-v1",
   {rootArtifactIds,descriptorDigests,dependencyEdges}]))`，其中
   `descriptorDigests` 与排序后的 descriptors 一一对应；
6. committed owner-only closure 精确包含 Verification detail、Repository
   Basis Record、Request Equality Record、quota Admission、该 commit quota
   Transition、private blob 与 Git lease；它们不进入 public descriptor/edge
   数组，但必须由该 History reachable 的 public/internal descriptor或
   Journal/Receipt exact ID+digest/HMAC commitment 间接 pin，并逐项解析。其他
   reservation/phase/rollback/recovery Transition 由 Store Manifest 的全局
   transition chain pin；CAS reservation、transaction marker 与 temp file 只是
   Store-global 短生命周期 recovery/GC roots，不由某个 History root pin。
   validator 只要求**本 root 声明的 reachable private closure**无缺失/无多余
   声明；物理 Store 中被其他 current/history/transaction 合法拥有的对象不影响
   本 History。

History ID 的 `descriptors` 字段使用上述排序后的 descriptor pins（含
`descriptorDigest`），`rootArtifactIds/dependencyClosureDigest` 必须与 closure
重算结果相等。Archive writer、trusted reader、recovery 和 GC root enumerator
共享这一算法与 golden vectors，不能各自实现“近似可达”。archive marker 在
首个副作用前生成并固定 `archivedAt`；crash replay 必须复用该时间。若 semantic
History ID 已存在，只能复用首次 committed exact bytes/time，或在 content
digest 不同时报 conflict，不能以同一 ID 发布不同 payload。

Digest domain 固定：

- `safeRequestDigest`：`operation-safe-request-v1` + exact
  `StrongSafeRequestProjectionV1`；排除 idempotency key、transient/private
  bytes、private HMAC tag 和所有 Engine 生成字段。完整输入 equality 只使用
  owner-only domain-separated HMAC；
- `analysisInputDigest`：`change-analysis-input-v1` + exact Repository Basis +
  ruleset + Budget + confirmed obligations/verification plan digests + 按序内容
  identity；排除 Actor、key、时间、摘要和 resolution；
- `semanticDigest`：strong analysis 的 canonical semantic payload；排除
  `semanticDigest` 字段自身、generatedAt、自由摘要、resolution 和 envelope
  metadata；
- Artifact `contentDigest`：继续覆盖完整 canonical payload bytes。

稳定 ID 全部使用 `sha256(canonical JSON)` 与独立 domain：

- Boundary：`analysis-boundary-v1` + stage/code/scope/recovery；
- Diff/Boundary Evidence：分别使用 `diff-evidence-v1 /
  boundary-evidence-v1` + Task + observed Snapshot + Hunk/Boundary ID +
  ordered Claim/Graph Node IDs；producer/createdAt/excerpt/renderer text 不进入 ID；
- Delta segment/effective/path：分别使用
  `repository-delta-segment-v1 / repository-effective-change-v1 /
  repository-path-delta-v1` + 两个 Snapshot + lineage + canonical states +
  ordered child IDs；
- operations digest：`diff-operations-v1` + ordered operations；
- patch digest：`diff-hunk-patch-v1` + algorithm + 两个 Snapshot + lineage +
  before/after `DiffContentIdentityV1` + spans + ordered source layers +
  operationsDigest；
- Hunk ID：`diff-hunk-id-v1` + patchDigest；
- Symbol Ref：`source-symbol-ref-v1` + Snapshot/path/language/parserVersion/kind/
  qualifiedName/parent/span/declarationDigest；
- Actual Change：`actual-change-v1` + 两个 Snapshot +
  repositoryPathDeltaId/effectiveChangeId + ordered Hunk ID array（允许
  canonical empty array）+ granularity。Symbol refs、facets、analysis status、
  Boundary、摘要和时间不进入 Actual identity，因此 pure topology/empty-file
  与补全分析都有唯一可重算身份；同一 effective change + Hunk cluster 不得拆成
  多个相撞 Actual；
- Finding：`change-finding-v1` + Task + baseline/actual Snapshot + finding type +
  ordered Planned/Actual/Claim/Evidence/Impact IDs + canonical
  `verificationGap`（如存在）。severity、自由摘要、resolution、acceptance、
  actor 和时间不进入 ID；strong writer 必须重算并验证
  `StrongFindingId`，不能接受调用方 opaque ID；
- Verification Plan Entry：`verification-plan-v1` + Task + current Context
  generation + ordered acceptance Claim IDs + method + required flag；description
  与生成时间不进入 ID。legacy `verification-plan:*` 仍按旧 opaque reader
  读取，strong writer 必须重算 brand；
- Verification Record：`verification-record-v1` + Task/generation/Snapshot/
  exact Check digest + Plan Entry + attempt/supersedes + method/status +
  ordered Claim IDs + public result code + 完整 canonical public `detail`
  projection；stored commitment 或 redacted fixed codes 都进入 Record ID，
  actor/recordedAt 不进入。这样同 ID 不会对应不同 public detail，同时
  commitment preimage 不含 Record ID，因而无引用环。public Record/Surface
  不含 detail ID/content digest。
  owner-only internal detail ID 只使用独立 `verification-detail-v1` +
  `{verificationRecordId}` 重算，trusted reader 由 Record ID 推导固定 private
  path，再验证 Envelope/payload/content digest 和
  `verification-detail-semantic-v1`；sanitized command/summary/output digest
  仅存在于 private payload，只有 owner-keyed semantic commitment进入 public
  Record ID；
- Repository Basis Record：`repository-basis-record-v1` + Task +
  `operationEventId` + `basisDigest`；`basisDigest` 是完整 canonical
  `TaskCreationBasisV1 | RepositoryBasisV1` 的 SHA-256，read-set digest 自身按
  3.8.2 规则排除；
- Context Generation：`context-generation-v1` +
  `ContextGenerationInputV1`；只能使用本代之前已存在的 upstream pins，不能
  放入 resulting Manifest/Brief/Event/Receipt；
- Git lease：`git-lease-v1` + repository/worktree/task + baseline Snapshot +
  object format + commit OID。逻辑 ID 不含 transaction nonce；实际 ref suffix
  固定为 `<lease-id 末尾 22hex>-<marker nonce 32hex>`，并由 internal baseline
  descriptor 精确 pin。nonce/refName 不进入逻辑 ID，但进入 descriptor
  content digest；
- private blob：`private-blob-v1` + repository/worktree identity +
  `privateContentDigest` + raw byte length；path、mtime 与 capture order 不进入
  ID。digest/ID 只能留在 owner-only baseline ledger；
- History Root：`task-projection-history-v1` + task/revision/generation/
  baseline/latest Snapshot + reason + ordered descriptor pins +
  dependencyClosureDigest；`archivedAt` 不进入 ID。

所有字符串比较使用 UTF-8 bytewise comparator，不调用 locale comparator，也
不做 Unicode normalization。path lineage 排序 key 为
`[path, oldPath-or-empty, kind-order, id]`；Hunk 为
`[path, oldPath-or-empty, oldStart, oldCount, newStart, newCount, id]`；
Symbol 为 `[snapshotId,path,start.byteOffset,end.byteOffset,kind,qualifiedName,id]`；
Finding 为 `[type-order,id]`；source layer 使用
`baseline_reconciliation < committed < staged < unstaged < untracked <
conflict`。kind-order 使用
`added < modified < deleted < renamed < copied < type_changed`；
type-order 使用
`planned_completed < planned_partial < unplanned_change < possible_omission <
verification_gap < cannot_determine`；Symbol kind 使用
`function < method < class < constructor < module < type`。History descriptor
使用 `[artifactType-order,artifactId,contentDigest]`，其中
`repository_snapshot < repo_pulse < task_manifest < task_baseline < task_brief <
context_generation < claim_ledger < evidence_ledger < impact <
task_operation_journal < change_check < verification`。
History golden vectors 必须至少包含一个 `context_generation` descriptor，并
证明其在 `task_brief` 之后、`claim_ledger` 之前参与 descriptor/closure/History
ID 排序；缺失、重复或实现自选插入位置均 reject。
Internal baseline paths 按 path，baseline/analysis Boundaries 按
`[stage,code,canonical(scope),recovery,id]`；Repository Delta paths 按 lineage
key，segments 按 source order；Actual Changes 按
`[path,oldPath-or-empty,effectiveChangeId,joined-sorted-diffEvidenceIds,id]`。
semantic facets 使用
`BODY_LOGIC < SIGNATURE < DEPENDENCY < TOPOLOGY < TEST < CONFIG < SCHEMA <
DOCUMENTATION < FORMATTING_OR_COMMENT < UNKNOWN`。所有 set-like ID array 按
bytewise 排序；Verification records 按
`[verificationPlanEntryId,attempt,id]`，skip acceptances 按
`[verificationRecordId,id]`。重复项一律 reject，不做静默 dedupe。

## 4. 写操作与事务语义

### 4.1 Strong Task Stage 1

`buildTaskBrief` 的 Task 创建阶段也受 baseline transaction 协议约束：

- authorization 后选择并确认已提交的 current/evaluated Snapshot；
- 在无持久副作用的 scan phase 稳定读取 baseline，计算
  `TaskCreationBasisV1`、candidate blob digest/path、lease ref/OID 与完整 write
  plan；Stage 1 不要求 Pulse；
- Store 取得 Task→Repository 锁、逐项验证 Creation Basis，并在创建任何
  private blob/Git lease 前先写入和 fsync intent marker。marker 预声明全部
  temp/final blob、CAS reservation、lease ref/OID、exact reflog path 及
  pre-existing 状态、transaction nonce、quota reservation 与 candidate
  descriptor set；
- Store 可保留 Task lock、释放后重取 Repository lock 来执行有界
  materialization；所有 lease/blob 副作用发生时 durable marker 已可恢复。
  commit 前再次逐项验证 read-set；Manifest 是 commit point；
- basis drift、scan/policy fatal error、metadata quota admission failure 或真实
  durable write/fsync/ENOSPC failure 时零 Task、零可见 blob/lease；确定性
  baseline blob Budget 或 blob/active/temp quota 用尽则按 3.8.2 提交
  metadata-only partial + 对应 Boundary；
- crash replay 使用原 build key；recovery 只删除 marker-owned uncommitted
  orphan。即使 crash 恰好发生在 `update-ref` 成功、marker phase 更新前，
  recovery 也只对 marker 预声明的 exact ref 执行 delete CAS，并同时验证 ref
  suffix 中的 32-hex nonce 等于 durable marker nonce、OID 等于 marker OID、
  没有 current/historical descriptor pin 该 ref。仅“同 OID”绝不足以证明
  ownership。product reflog create 前必须由 marker 证明不存在，create 后仍应
  不存在；若检查与 `update-ref` 之间的 external same-user race 或 Git 异常产生
  了任何 reflog，系统无法证明该文件完全由本 transaction 创建，因此 recovery
  **永不删除或截断 reflog**。它只对 exact ref 做 delete CAS，保留 marker 并
  报 `git_lease_reflog_interference`，阻断 capability 等待人工审计。任何
  pre-existing/user/product reflog 都永不删除或修改。任一条件不满足都保留并报 recovery conflict，不碰
  shared/committed/其他 transaction 的 blob/ref/log；
- 成功 `created@1` 的 Manifest 已保存 resolved contextBuildSpec、strong profile
  与 current baseline artifact ID。

### 4.2 公共 Operation kernel

四个 Operation 使用 D-27 的统一顺序。额外不变量：

- scope 固定 `{kind:"task", taskId}`；
- public request digest 只覆盖 3.8.4 的 strict safe projection；完整 parsed
  input 由 owner-only HMAC equality tag 覆盖，两者都包含 action、Actor、
  expected revision 与 Snapshot assertions；
- authorization 在 Receipt lookup 前，但 lookup 在 revision/lifecycle guard
  前；
- persisted Receipt 永远保存 `idempotentReplay=false`，回放响应才投影为 true；
- CAS/race 后重读，只有 exact key/digest/Actor/operation 可回放；
- Engine 不持有 Store lock；昂贵分析不在锁内；
- `RepositoryBasisV1` 固定 repository/worktree、actual Snapshot artifact/
  digest/current state、Pulse artifact/digest/evaluated Snapshot、baseline
  Snapshot artifact/digest、prior task baseline artifact/digest、
  attributes/scanner/policy digest 与完整 `RepositoryReadSetV1`；
- Store commit 接收该 Basis，在 repository lock 内重验 descriptor pins，并在
  marker 前调用 Provider 逐项重验 read set；成功时同事务追加 owner-only Basis
  Record，Receipt/Check 保存其 ID/digests；
- Provider 在 commit 前设 final validation cut：cut 前 drift 零写入；cut 后
  外部修改不受 Store lock 控制，本次结果仍绑定旧 Snapshot，下一次 Snapshot
  使 Task stale。不得宣称绝对消除外部写窗口。

### 4.3 `checkChanges`

前置条件：

- capability `task:check`；
- Task 为 current `check_required`；
- exact expected revision；
- input actual Snapshot 等于 Task latest 与 Repository Manifest latest；
- current Pulse、baseline Snapshot、actual Snapshot、task baseline 都可读且
  digest-valid；
- 同 Snapshot 尚无 canonical Check。

成功：

- revision `R→R+1`，状态保持 `check_required`；
- 追加一条 `change_checked` Event 与完整 Receipt/Journal；
- Check task revision 为 `R+1`，generatedAt 等于 Event occurredAt；
- 不新增/改写 Verification；
- Finding Claim/Evidence/Impact backlinks 与 Check 同事务发布。

派生 phase：

- 无 exact strong Check descriptor：`awaiting_check`；
- 有唯一 descriptor：`check_review`；
- Manifest `currentChangeCheck*` 在 check_required 始终为空；
- `accept_finding`、转回 in_progress 或进入 verification_required 只允许
  check_review；进入 verification_required 时才设置 pointer。

### 4.4 `recordVerification`

前置条件：

- capability `task:verify`；
- Task 为 `verification_required`；
- current Check 与 Task latest Snapshot/baseline 一致；
- Plan Entry 存在，method 精确一致，Claim IDs 是 acceptance IDs 子集；
- supersedes 指向同 Entry/Snapshot 当前最新 Record。

成功：

- revision `R→R+1`，状态保持 `verification_required`；
- 追加一条 `verification_recorded` Event 与完整 Receipt/Journal；
- Verification ledger 只 append 新 Record；
- 同 key replay；并发 retry 不自动追随赢家生成的新 supersedes。

回到 in_progress 的 Action 必须携带触发 Record ID；Store/Engine 验证它是当前
generation/Snapshot/Plan Entry 的 latest failed/blocked/flaky attempt。

### 4.5 `refreshTaskContext`

- capability `task:context:refresh`；
- 只允许 `stale`；
- exact target Snapshot 必须是提交时 Repository Manifest current；
- baseline 与 Manifest contextBuildSpec 保持不变；
- 基于 original intent、spec、baseline/target 重建 Brief/Claims/Evidence/Impact；
- 生成新的 `contextGenerationId`；Goal/Acceptance/Plan confirmation Event
  必须绑定 generation，旧 confirmation 不能满足新 Brief；
- 成功到 `context_ready@R+1`；
- Check/Verification current projection 与 backlinks 必须全部删除；
- reset 前归档旧 immutable projection；Event 记录 previous/resulting
  generation；
- Provider failure、basis drift、CAS conflict 均零写入。

### 4.6 `rebaseTask`

- capability `task:context:rebase`；
- 只允许 `stale`；
- action 同时带 exact live target Snapshot、与 target 相等的
  new baseline Snapshot 和 reason；
- 不允许任意 historical dirty Snapshot；只有 live capture 可新建
  materialization，已有 digest-valid materialization 仅供历史读取；
- 不重新解析可移动 `baseRef`，它只保留 provenance；
- 新 immutable baseline/lease、historical projection 与新 context generation
  同事务发布；
- 其余 rebuild/reset/zero-write 规则与 refresh 相同。

refresh/rebase 公共方法使用独立 capability，但 Receipt 保持
`operation=update_task`；request digest 包含 action type，Receipt operation、
Event action、capability 必须交叉一致。

## 5. Contract-to-implementation 追踪

状态枚举：

- `frozen`：D-24～D-34 已在 PRD/G0/本矩阵一致；
- `pending implementation`：代码或 focused tests 尚未提交；
- `capability locked`：生产入口必须在任何仓库读取/写入前 fail closed；
- `verified locally/remotely`：只在对应 source tree 的 focused/root/CI 证据通过
  后使用。

| ID | 冻结目标 | 目标实现位置 | 当前状态 |
|---|---|---|---|
| WP5-C01 | Actual Change、Diff Span/Hunk、Completeness strong Schema | `packages/contracts/src/change.ts`、`evidence.ts`、`primitives.ts` | frozen / pending implementation |
| WP5-C02 | strong Task baseline semantics、Planned expectation、Artifact/Store Manifest descriptor/generation、exact rebase target | contracts descriptor schemas + `packages/artifact-store` immutable Manifest modules；Task/MCP只引用 public pins | frozen / pending implementation |
| WP5-C03 | internal task baseline managed descriptor/Envelope（非公开 Artifact Type） | Store managed descriptor dispatcher + internal baseline module | frozen / pending implementation |
| WP5-C04 | strong cross-bundle reference/coverage/method invariants | `packages/contracts/src/invariants.ts` | frozen / pending implementation |
| WP5-C05 | legacy reader + strong writer/schema/fixture split | contracts JSON Schema/fixtures | frozen / pending implementation |
| WP5-C06 | path-safe Snapshot/Pulse、legacy redacted Surface 与 HMAC locator brands | Repository/Surface contracts + fixtures | frozen / pending implementation |
| WP5-C07 | SafeGit/bootstrap/state-token/request-equality/quota-index strict schemas + seven-way category correlation + Admission/Transition full-record digest golden bytes | contracts security/internal schemas | frozen / pending implementation |
| WP5-C08 | Context Generation Record、root-relative History closure、Store filename codec | contracts + Store internal schemas | frozen / pending implementation |
| WP5-C09 | RFC 8785/JCS exact bytes与strict provider ID；raw-key digest/strict Ed25519 host capability+exact hostile manifest；fixed Bootstrap Trust Bundle/retained historical source closure；provider registry root/key history、Catalog strict Envelope、signed Public Taxonomy/Release Matrix/Target Discovery Result/real-FS Suite+Corpus、closed-world Release Target Universe与 typed retained-object/保守 public privacy projection、Acceptance compact receipt、same/cross Identity migration typed dry-run/Plan-bound reservation/exact final receipt/universe-side/receipt prefix/versioned canonical Rewrite Plan/Semantic Equivalence Proof/zero-live/sealed head、signed proof/version Envelope、binding generation、atomic path containment、Store Manifest compact compare-append receipt与 terminal journal contracts | `packages/durable-object-provider-contracts` + cross-language golden/negative vectors（含 strict crypto/KAT/bootstrap bundle、coverage input、rewrite mapping/SCC/JCS/proof-token/locator/budget） | C09-1B～1I 分层 candidate 已推进至 Result→Policy→root-signed Runtime Attestation point closure；下一 frontier为 QA/Release Evidence，aggregate 仍 in progress，capability locked |
| WP5-S01 | private baseline blob/Git lease layout、permissions、Stage 1 transaction | `packages/artifact-store` | frozen / pending implementation |
| WP5-S02 | exact Repository Basis lock-time guard | `packages/artifact-store/src/store.ts` | frozen / pending implementation |
| WP5-S03 | duplicate Check and direct Snapshot dependencies | Artifact Store semantic guards | frozen / pending implementation |
| WP5-S04 | immutable projection history、immutable-pin freshness、refresh/rebase reset | Artifact Store layout/descriptors/semantic guards | frozen / pending implementation |
| WP5-S05 | CAS reservation、Merkle quota root/admission、near-quota recovery | Artifact Store private CAS/quota modules | frozen / pending implementation |
| WP5-S06 | installation key lifecycle、identity namespace cutover/coexistence | runtime state + Artifact Store binding | frozen / pending implementation |
| WP5-S07 | OS-isolated durable-object provider、trust verifier/client、external state CAS、Acceptance/Store Manifest atomic compare-append、handoff journal、compare-delete与 upgrade/migration | `packages/durable-object-provider-client` + signed provider runtime/installer + `packages/artifact-store` adapter | capability locked / provider-feasibility gate |
| WP5-R01 | final-tree Delta + Git source segments | `packages/repository-state` | frozen / pending implementation |
| WP5-R02 | deterministic text hunks/content domain/budget/security/read-set | `packages/repository-state` | frozen / pending implementation |
| WP5-R03 | path-safe capture/Pulse、SafeGit adapter/bootstrap/local ODB | `packages/repository-state` | frozen / pending implementation |
| WP5-P01 | rich parser/symbol API | `packages/core` | frozen / pending implementation |
| WP5-A01 | Hunk→Symbol + semantic facets | new `packages/change-intelligence` | frozen / pending implementation |
| WP5-A02 | Planned vs Actual + Finding/Completeness builder | new `packages/change-intelligence` | frozen / pending implementation |
| WP5-E01 | shared Operation kernel | `packages/task-engine` | frozen / pending implementation |
| WP5-E02 | `recordVerification` vertical slice | `packages/task-engine` | capability locked |
| WP5-E03 | `checkChanges` vertical slice | `packages/task-engine` | capability locked |
| WP5-E04 | refresh/rebase rebuild | `packages/task-engine` | capability locked |
| WP5-E05 | safe request projection、private equality replay、Verification detail commitment/skip acceptance | `packages/task-engine` + private Store ledgers | capability locked |
| WP5-I01 | root quality/CI/independent review | workspace CI + evidence | latest slice candidate：`60f6582` tree本地 macOS为187 files / 2,295 passed / 1 skipped / 0 failed，Linux clean CI `30978915713`为187 files / 2,296 passed / 0 skipped / 0 failed并成功完成；C09-1I三路独立终审均无残余 P0/P1/P2；此前 C09-1H/C09-1G/C09-1F/CLI CI `30881809697` / `30822355769` / `30797985994` / `30799673953` 继续保留，WP5 aggregate final closeout pending |
| WP5-I02 | macOS/Linux real-FS provider feasibility、install/upgrade/downgrade/uninstall/crash evidence | signed provider package + target-profile capability registry；当前物理 volume运行时 exact-match profile | mandatory blocking gate |

## 6. 分层实现与 Commit Gate

每一层都必须：

1. 只提交该层明确文件；
2. 先跑 focused tests、package build/typecheck，再跑受影响 workspace tests；
3. `git diff --check`；
4. 独立 commit、push；
5. 等待 clean-checkout CI；失败必须记录根因并修复，不能重跑碰运气；
6. 进入下一热点层前做 P0/P1 read-only review；
7. 不暂存用户未跟踪的 QA、历史 PRD、builder、assets 或 `site/`。

推荐序列：

WP5-1P/C09 的 Accountable 是 Platform / Security Lead；Responsible 是1名
Contracts/Core Engineer加1名 Platform/Provider Security Engineer，Product/QA参与
golden与 negative vectors；Verifier 是 QA/Security加独立 Implementability reviewer，
Release另验签名发行物与 coverage vectors。该 Gate估算3–4 calendar weeks、6–8
person-weeks，包含 Schema、TypeScript types、cross-language golden、negative
manifest、conformance runner及两轮独立复审，不包含 WP3P runtime/installer。

D-31不得藏在一个巨型 WP5-1P commit中，固定按以下三个独立 commit/push/review
边界交付，前一层的 root quality、同 SHA push与 P0/P1 review关闭后才进入下一层：

1. `docs(wp5): freeze strict ed25519 bootstrap trust`：只含 PRD/G0/Matrix；
2. `feat(wp5): add strict ed25519 host conformance`：raw-key digest、strict point/
   signature primitive、host interface/opaque capability、28-case resource与
   56-point/28-signature runner；
3. `feat(wp5): add bootstrap trust bundle contracts`：Bundle Pin/Envelope/resource、
   bootstrap metadata/key closure、signed distribution binding、immutable Identity
   origin retention与 current-vs-historical migration semantics。

任一子层通过只产生 candidate，不解锁 strong capability；WP5-1P aggregate Gate仍须
覆盖此前与后续全部 C09合同。

截至 2026-08-05 的 17 Gate 状态账本如下；这是 Gate closure 计数，与上面的总计划
执行游标是两个不同概念：

| # | Gate | 状态 | 当前证据 / 下一关闭点 |
|---:|---|---|---|
| 1 | WP5-0 | Closed | D-24～D-34 已冻结 |
| 2 | WP5-1P/C09-1B | Closed | strict Ed25519 host conformance 已通过独立复审 |
| 3 | WP5-1P/C09-1C | Closed | Bootstrap Trust Bundle 与 retained trust 已闭环 |
| 4 | WP5-1P aggregate | **In progress** | C09-1D `acc6c9c`、C09-1E `1b182aa`、C09-1F `3ca2977`、C09-1G `70201b4`、C09-1H `35f9aaf` 与 C09-1I `60f6582` 已完成；1I只关闭 Runtime structure point，下一点为 QA/Release Evidence；Catalog/Registry、Discovery history/current、Universe、Acceptance、Migration 等仍需关闭 |
| 5 | WP5-PF | Pending / locked | 尚无真实 OS-isolated Provider 与 real-FS 安装生命周期证据 |
| 6 | WP5-1 | Pending / locked | 其余 strong/legacy/path-safe contracts 与 fixtures 未关闭 |
| 7 | WP5-2A | Pending / locked | SafeGit、path-safe Snapshot/Pulse、identity cutover 未实现 |
| 8 | WP5-2B | Pending / locked | Baseline/Git lease/private CAS/quota admission 未实现 |
| 9 | WP5-2C | Pending / locked | Immutable projection history/Context Generation 未实现 |
| 10 | WP5-3 | Pending / locked | Operation kernel/auth/idempotency/CAS helper 未实现 |
| 11 | WP5-4 | Pending / locked | 生产 `recordVerification()` vertical slice 未实现 |
| 12 | WP5-5 | Pending / locked | Repository Delta 与 deterministic hunk 未实现 |
| 13 | WP5-6 | Pending / locked | Rich symbol API 与 hunk mapper 未实现 |
| 14 | WP5-7 | Pending / locked | Matching/Completeness 与生产 `checkChanges()` 未实现 |
| 15 | WP5-8 | Pending / locked | refresh context rebuild 未实现 |
| 16 | WP5-9 | Pending / locked | rebase context rebuild 未实现 |
| 17 | WP5-10 | Pending / locked | renderer/benchmark/root closeout 与 capability unlock 未完成 |

| Gate | 内容 | 最低本地证据 | Capability |
|---|---|---|---|
| WP5-0 | D-24～D-34 文档冻结 | diff/link/range/术语审查 | locked |
| WP5-1P/C09-1B | raw-key digest + strict Ed25519 host conformance | old C09-0 key-ID golden byte-identical；独立 digest brand/schema/golden；strict point/signature vectors；28-case fixed resource/digest exact-cover；每 runtime恰56次 point + 28次 verify；constant-true/false/divergent/mutating/replaced host negatives；package build/typecheck/test/distribution/root quality与 Security review | locked |
| WP5-1P/C09-1C | fixed Bootstrap Trust Bundle + immutable Identity retained trust | Bundle/manifest Pin/Envelope/payload/fixed-locator/4 MiB Schema与golden；bootstrap metadata、root+3 recovery/threshold/policy/strict profile等式；signed distribution与Identity origin closure；old/new Bundle recovery-only migration、missing retained object、五链 accounting negatives；package build/typecheck/test/distribution/root quality与 Implementability/Security review | locked |
| WP5-1P | C09 Provider contracts prerequisite：RFC 8785/JCS与provider ID、raw-key digest、strict Ed25519 host capability/KAT、fixed Bootstrap Trust Bundle+historical source retention、registry/root/key/runtime/Evidence/Catalog Envelope + signed Distribution Root Binding/Taxonomy/Release Matrix/embedded Discovery Input Bundle/Target Discovery Result/Release Target Universe + signed real-FS Suite/Fixture Corpus与 typed retained-object accounting + bounded five-chain history、deterministic public projection、Acceptance/Store compact receipts、same/cross migration typed dry-run/Plan-bound reservation/exact final receipt/receipt-prefix closure、versioned Rewrite Plan/Object+Root Semantic Proof、exact-object、external CAS、journal与 error wire + golden vectors | provider contract build/schema；old C09-0 vectors byte-identical；strict manifest exact-cover、fixed digest、cross-runtime positive/hostile KAT、bundle/metadata/key/pin/history-source negatives；cross-language golden bytes、coverage provenance/history/union/catalog omission/code-smuggling、nonce mismatch/restart/migration及 rewrite mapping/root/SCC/JCS/size/HMAC issuer/proof-token/locator/budget negative vectors | locked |
| WP5-PF | provider feasibility：独立 OS principal/kernel isolation、registry-root/key custody、exact-object API、external CAS/journal与安装生命周期 | macOS/Linux真实 FS×mount 矩阵、crash/ABA/path-race、签名/权限、upgrade/downgrade/uninstall E2E；任一 target 未过只读 | strong Store write locked |
| WP5-1 | C01～C08及其余 strong/legacy/path-safe/internal schemas + fixtures；C09只允许在兼容前提下增补 | contracts full suite/schema/golden vectors | locked |
| WP5-2A | SafeGit/bootstrap + path-safe Snapshot/Pulse + identity cutover | hostile config/real worktree/legacy Surface/key crash | locked |
| WP5-2B | Baseline Artifact/Git lease/private CAS reservation/quota admission | permissions + every crash phase + concurrency + near-quota Store | locked |
| WP5-2C | Immutable projection history/Context Generation/Store basis | old Check closure + root-relative DAG + crash/recovery | locked |
| WP5-3 | Operation kernel/auth/idempotency/CAS helpers | Engine kernel/replay/race tests | locked |
| WP5-4 | `recordVerification` vertical slice | method/attempt/concurrency/restart/lifecycle | only `task:verify` candidate |
| WP5-5 | Repository Delta + deterministic hunk | Git matrix/security/TOCTOU/determinism/perf | check locked |
| WP5-6 | Core rich symbol API + mapper | language/syntax/ambiguity fixtures | check locked |
| WP5-7 | Matching/Completeness + `checkChanges` | scenarios/store/restart/concurrency | `task:check` candidate |
| WP5-8 | refresh context rebuild | spec fidelity/failure/projection reset | refresh candidate |
| WP5-9 | rebase context rebuild | new baseline/history/no-op/race | rebase candidate |
| WP5-10 | renderer/benchmark/root closeout | root quality + clean CI + independent review | unlock only after all pass |

Capability “candidate” 不等于立即对 Host 宣传可用；WP6 Surface E2E 之前仍不进入
supported tool list。

## 7. Required Acceptance Matrix

### 7.1 Contracts 与兼容

| ID | 场景 | 必须断言 |
|---|---|---|
| AT-C01 | 旧 Change Check fixture | bytes 不改；新 reader 解析为 legacy summary，不是 clean |
| AT-C02 | strong Check fixture | Actual/Hunk/Completeness/Findings 全部解析 |
| AT-C03 | dangling Actual ID | Bundle reject |
| AT-C04 | wrong-kind/dangling Diff Evidence | Bundle reject |
| AT-C05 | Snapshot/Task mismatch | Bundle reject |
| AT-C06 | text hunk 双侧零行 | Schema reject |
| AT-C07 | partial/unknown 无 Boundary | Schema/Bundle reject |
| AT-C08 | incomplete Delta + empty Findings | Bundle reject |
| AT-C09 | omission 指向 optional/inspect/legacy unspecified | Bundle reject |
| AT-C10 | verification gap subtype 引用组合错误 | missing/insufficient/unsupported 各按条件 reject |
| AT-C11 | method mismatch | Bundle reject |
| AT-C12 | new field parse | 不注入 default，不改变 canonical payload/digest |
| AT-C13 | old binary boundary | 文档/doctor 明确 unsupported forward-read，不伪装兼容 |
| AT-C14 | old confirmation Event + new context generation | 不满足 Goal/Acceptance/Plan Gate |
| AT-C15 | 同一 Actual 同时 planned+unplanned，或 required 同时 completed+omission | contradictory primary disposition reject |
| AT-C16 | complete + UNKNOWN/Boundary，或 metadata/redacted/ambiguous + complete | Schema/Bundle reject |
| AT-C17 | historical immutable-pin dependency | P1/A1/S1提交后 Task T exact pin P1；P2/A2/S2提交后 current只为P2而 T仍可按 immutable pin读P1，活引用存在时P1/A1不得 GC。P/A/S三种 canonical pin都保存 atomic-publish committed evidence的完整 request、final binding及收窄后的 receipt/proof signed Envelope；删 claims、换 operation/usage/key、交换 proof/receipt、file/final binding或 fixed final name/path任一不等均 reject。`canonicalRepoPulse absent/version`与 Manifest current descriptor不一致、manifest payload digest/ID/Envelope/repository/worktree错配、version-key或 encoded path错误均 reject；历史 pin missing/corrupt/digest mismatch只使引用它的 Task明确损坏，不污染 current P2，也不得回退/换读其它版本 |
| AT-C18 | strong Task/Pulse baseline 不同 | Task baseline 等于 evaluated Snapshot；Pulse logical baseline 只作 provenance |
| AT-C19 | created/context_ready spec/generation | Manifest spec 从 created 存在；Manifest/Brief/Event generation 相等 |
| AT-C20 | strong Check 的 empty Findings | 仅在零 effective change、零未处置 required/gap 且五维 complete 时合法；其他情况 reject |
| AT-C21 | JCS、strong primitive/stable ID 跨语言 golden vectors | TypeScript/provider读取同一 immutable manifest，并逐 byte断言 `rfc8785-jcs-safe-integer-v1` UTF-8 no-BOM/no-newline preimage、SHA-256/HMAC/raw-Ed25519 wrapper与 signature、exact prefix+22 lowercase hex；raw public-key digest另按 decoded exact32 octets固定且证明不同于文本/JCS/DER hash与 domain-key-ID前缀。nested/non-ASCII key按 JCS UTF-16排序，array保持合同顺序，NFC/NFD bytes不同且跨 domain输出不同。duplicate/extra key、BOM/trailing newline、invalid UTF-8/lone surrogate、float/`-0`/unsafe/non-finite number、undefined/null substitution、unsorted/duplicate set、domain/prefix/key-ID/signature substitution及 path/OID/digest/time/producer 类型错误全部 reject；semantic digest 重算排除自身 |
| AT-C22 | legacy/strong Verification union | legacy fixture bytes 不变；strong public Record 禁止 command/summary/output；完整 detail projection 进入 Record ID；stored semantic commitment无环可重算，redacted fixed codes sorted/unique且无 dangling Boundary |
| AT-C23 | internal managed baseline/history type | Store internal dispatcher 可读；公开 Artifact Type/MCP/read_artifact union 一律 reject |
| AT-C24 | path-safe Snapshot/change/redaction ID + strong Pulse | exact preimage/golden bytes/branch conditions/count equality；generic string、opaque ID、同 ID 不同 payload reject |
| AT-C25 | Snapshot/Pulse/Verification payload-level Surface union | raw legacy Envelope 仅 owner-only；strict redacted DTO/strong view extra-key reject；stored detail 只公开 keyed commitment |
| AT-C26 | state/SafeGit/request/quota internal codecs | base64url/uint/file identity/config/HMAC/isolation/Merkle leaf-node-empty-root/delta/admission golden vectors跨平台一致；七个 root slot/category const、Node/Delta category correlation、Admission/Transition stable-ID与 full-record content domain substitution逐项验证；conditional/duplicate/malformed input reject |
| AT-C27 | Context Generation Record | target Snapshot/Pulse、四 policy恰好一个；Graph/Wiki/Evidence present-or-absence；Envelope target/revision exact；完整 pin union 可重算 ID |
| AT-C28 | History root-relative descriptor closure | path 不含 root ID、archived edge 全 immutable、source semantics 保留；连续两次 refresh+rebase 产生平级 roots，旧 closure 可读且 history 不套 history；legacy fixture `snapshot:actual` 可由 legacy Snapshot/redacted reader读取，但放入任一 strong History descriptor/edge/root/envelope必须 reject，`snapshot-${LowerHex64}` 全链 exact-equal才通过 |
| AT-C29 | Store filename + provider trust/binding/terminal contract | `StoreFilenameKeyV1` short/long/Unicode/hash-collision golden固定；provider slug仅接受1..64-byte lower ASCII `^(?!.*\.\.)[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$`，ID只接受其 `durable-object-provider:<slug>` 构造并 exact-resolve Registry；empty/65-byte/uppercase/non-ASCII/whitespace/control/slash/colon/连续点/首尾 `._-`及 caller拼接 ID全部 reject。Bootstrap Trust Bundle与 strict host manifest只从两个 signed-package literal读取，Pin/Envelope/payload/compiled digest、origin binding与 Installation Identity retained copy exact闭合；alias、第二 path、caller path或 bundle/profile替换拒绝。Pulse/Artifact/Store与其余 installation trust fixed locator、Envelope outer/payload等式可重算。Catalog、Public Taxonomy、Release Matrix、Target Discovery Result与 Release Target Universe只能按 canonical positive generation从同一 signed-distribution root的五个独立 fixed locator读取；real-FS Suite/Fixture Corpus另按 full content digest fixed locator读取并验证独立 root signature，semantic digest locator拒绝。缺 strict Envelope、错误 recordType/path alias、pin/outer/payload generation或 digest不等、五者 root/taxonomy/input pin不等、Suite/Corpus transitive pin或签名 domain替换全部 reject。immutable Identity、Root full-record quorum digest、Registry Entry/Manifest、Acceptance、Catalog/Evidence/runtime无环 pin与 signer key alias防护全部闭合。Result required-case exact-cover、case/crash-cut ID preimage、QA/Release双签、七字段 target及三方 result/runtime/policy等式任一 signed-but-mismatched都 reject。所有 durable binding必须 generation-aware且跨 restart online revalidate；epoch/nonce/raw handle持久化拒绝。atomic publish六个 strict failure分支唯一映射 reason/directive/successor；完整 durable request/receipt、compare-delete outcome、external CAS、journal complete enumeration与 proof-only sealed tip按 strict union验证；missing/extra/sibling/replay/rollback、敏感字段泄漏及预算超限均在首个 strong副作用前 fail closed，legacy/redacted read-only保持可用 |
| AT-C30 | Acceptance/target/migration/receipt amendment | `ProviderAcceptanceCompareAppend`必须原子发布 generation、complete enumeration、high-water与 compact receipt，nonce replay/mismatch、ordinal/predecessor/current/count/set digest/floor/linkage逐项闭合。root self/cross/recovery quorum、provider/approver及所有 historical signature都必须使用 attested strict profile，宽松 native boolean不得授权 successor。`strong_ready`每个完整 target恰选一个 enabled writer；Catalog按 private target分组并 exact-cover独立签名 Universe，public row只按 Taxonomy四字段 bucket聚合。coverage basis、嵌入式 Discovery Input Bundle、typed retained-object accounting、deterministic resolution/reason、union cap与 bucket exact partition全部重算；private claim、unknown descriptor/code、target omission/substitution不得抬升 strong。producer pre-schema collection置换必须经 comparator生成同 bytes；serialized wire array置换必须 reject。`migration_only`只允许 pinned executor；same/cross Plan、typed source dry-run、Plan-bound reservation、exact final committed receipt selector、universe kind↔side、complete universe、receipt prefix/complete set、per-object subset、root/object semantic proof、zero-live、tombstone、ready/seal/final activation单向闭合。recovery compromise、journal-authority HMAC issuer、atomic publish failure union、compare-delete与 handoff proof strict branch按本节详细 acceptance逐项验证 |
| AT-C31 | strict Ed25519 + Bootstrap Trust Bundle | 四类 public-key record按 decoded raw32重算独立 digest，并按原 domain-separated JCS另算 key ID；旧 C09-0 key-ID golden byte-identical但其 mixed-order key在 trust admission拒绝。required hostile manifest exact-cover固定28项且 Pin/resource/compiled digest三方相等；每项分别断言 public-key point admission、signature `R` point admission与完整 signature result，固定执行56次 point + 28次 signature KAT。TypeScript、Node host、browser host与 provider共同接受 PureEd25519/RFC8032正例，并共同拒绝 bad length、`S>=L`/`S+L`、noncanonical/negative-zero、identity/small-order/torsion/mixed-order `A/R`、ctx/ph/prehash及 equation/message substitution；point method恒 true/false、与 verify分叉、去重/少调用/重排都失败。Host KAT产生不可绕过 opaque capability；固定 Bundle Pin/Envelope/Payload、bootstrap metadata、root+3 recovery keys、threshold=2、policy/profile/manifest以及 signed distribution与 Installation Identity retained origin闭合。任一 missing/extra/reorder/alias/第二 path/package/bundle/profile/digest substitution在读取 Root chain及首个 strong副作用前以 `attestation_invalid` fail closed。old recovery-only source必须凭 retained old bundle/manifest可读迁移，新 bundle不得替换旧 trust且只可建立新 Identity |

作为 AT-C29 的不可分割 filename acceptance，golden/negative vectors 必须同时
覆盖 RFC 4648 lowercase unpadded base32hex、137/138 UTF-8-byte 唯一分支边界、
fatal UTF-8 decode 与 exact re-encode，以及 ASCII/Unicode semantic ID 在默认
case-insensitive macOS/Windows filename 比较下不发生 collision；mixed-case
short wire、非法 encoded-length class、非零 trailing bits 与 caller 强制 variant
全部 reject。

作为 AT-C21/AT-C31 的不可分割签名 acceptance，每个 provider/root/approver
domain都必须从
同一 immutable manifest验证 exact
`JCS([domainLiteral, signerWrapper])` bytes。root wrapper内 `domain`必须等于 tuple
第一项；只签 wrapper、只签 claims、签 provider-private/HMAC使用的
`[domainLiteral,strictFields]`、签 `[domainLiteral,claims]`、内外 domain不同、
prefix key与 wrapper key不同都逐项 reject，即使 raw Ed25519 key与 signature本身有效。
这组 domain wrapper fixture只在 strict host capability已经验证 `A/R/S/equation`
之后运行，不能以 wrapper测试替代 point/subgroup acceptance。

作为 AT-C29/AT-C30 的不可分割 rewrite acceptance，same-identity golden必须证明
Rewrite Plan与Semantic Equivalence Proof fixed locator均不存在且 progress显式
`not_required`；cross-identity golden必须按
`sourceUniverse → RewritePlanEnvelope → started → object_planned → destination publish
→ SemanticEquivalenceProofEnvelope → receipt → object_committed → destinationUniverse
→ canonicalRootRewriteProofSet → zero-live`执行。resolver只接受
`installation_provider_migration_rewrite_plan_v1`与
`installation_provider_migration_semantic_equivalence_proof_v1`两条冻结 locator，
Pin/Envelope/payload、Migration Plan、source universe、source/destination object和
writer/policy必须逐字段闭合。Plan必须以 source ordinal完整有序 exact-cover object
set，以冻结 reference comparator完整有序 exact-cover slot set，SCC schedule必须
exact-partition graph；encoder逐 byte等于
`rfc8785-jcs-safe-integer-v1`。每个 Object Mapping还必须由独立 domain冻结自己的
object-reference子集 count/digest/bytes，empty/non-empty golden与全局 mapping
deterministically exact。每个 proof必须绑定 source/destination content digest，
证明 non-reference digest相等、rewritten-reference set exact-cover且所有 typed failure
set为空，并通过 journal-authority HMAC和 destination-provider
`migration_semantic_proof` Ed25519 signature。receipt只允许单向保存完整 Plan Pin+
Proof Pin，Plan/Proof不得含 receipt ID/pin/token。cross mode无论 rewrite object、
object edge或全局 edge是否为0都必须 Plan present + closure `proved`；root proof set
exact-cover两侧全部 root、root mappings与 destination root edges并验证逐根
non-reference equality。same mode才允许 Plan absent +两个 empty golden
`not_required`。

AT-C29/AT-C30 negative vectors必须逐项拒绝：plan/proof错误 fixed path、outer/payload/
pin substitution；object或slot mapping missing/extra/duplicate/reorder、错误
field path/occurrence/source或target ordinal；SCC missing/overlap/order/self-loop/cycle
伪造；canonical encoder alias或普通 runtime JSON bytes；source/destination content
digest、per-object subset、non-reference digest或 rewritten-reference-set
count/digest/bytes不等；root missing/extra/kind/order/slot mapping/non-reference
mismatch；任一 typed failure set非空；object receipt/zero-live/progress HMAC由 source
identity或 request/candidate选择 issuer；HMAC/signature/usage/key错配；三个
canonical size projection包含 self-counter/token/signature、9/10、99/100、
999/1000边界 off-by-one；receipt只存裸 digest、换 Plan/Proof或制造
receipt↔proof cycle；以及 rewrite object/mapping/SCC、plan/proof/rewritten-set canonical
bytes任一预算超限。上述失败都必须发生在首个 destination object副作用前，或在已
publish object之后阻断 receipt、destination cut、zero-live与 activation。

作为 AT-C29/AT-C30 的不可分割 distribution/source acceptance，还必须覆盖：

- 相同 `fixtureManifestDigest`但 release/binding/records/content digest不同的两个
  Fixture Envelope得到两个不同 full-content-digest locator；旧
  `fixtureManifestDigest` locator、latest alias、第二 semantic path与同 locator异
  bytes全部拒绝；Suite/Corpus同样只能按 full Envelope content digest定位，
  semantic suite/corpus digest、binding/signature或两层 pin substitution全部拒绝；
- Matrix observation只能取 Release Matrix Envelope `contentDigest`及
  `targets[i]`唯一 projection；Fixture/Runner只能取各自 Envelope content digest与
  payload `records[i]`。以 target-set、fixture、suite、implementation、binary或
  profile digest替代 source artifact digest全部拒绝；
- transitive Fixture/Runner/Suite/Corpus Envelope与 embedded Bundle在 materialize/
  parse前 16 MiB+1拒绝；五链+Bundle+四类 source的 schema可达40,960 object E2E
  golden通过，独立 accumulator第65,537个 retained object拒绝；embedded Bundle
  object计数但增量 logical bytes为0，只有 source closure把 unique Envelope canonical
  total推到512 MiB+1仍拒绝；多个 Bundle exact pin同一 source Envelope时 visited-set
  只计一次，同 bundle在不同 parent下分别计 object，alias不得借共享规则逃逸。

作为 AT-C29/AT-C30 的不可分割 migration-history quota acceptance，必须逐项拒绝
policy/Identity/role/side/admission-vector/reservation-ID/domain/HMAC/fixed-path替换，
并至少覆盖：

- charged migration `63/64/65`、normal与hard logical/provider-allocated cap
  `cap-1/cap/cap+1`、单 reservation 4/8 GiB边界，以及 object receipt、
  semantic/root/zero proof、progress record与 progress receipt各 category
  count/bytes边界；
- event 64 MiB、receipt 256 MiB、single event 256 KiB、single receipt 1 MiB和
  high-water 1 MiB边界；general容量耗尽时已 reserved account的 terminal escrow仍可
  commit/release，新 reservation被拒绝；
- event/receipt/account enumeration missing/extra/reorder/duplicate、high-water
  rollback、同 ordinal异 bytes、set digest/usage不等与两个 writer同 head竞争；
- same Identity在 reservation、Plan、event、receipt、enumeration、high-water每个
  transaction cut崩溃后只能全有或全无；cross在 destination intent、source
  provisional、destination activate/Plan/event/receipt/high-water每个 cut崩溃均只能
  恢复同一 saga；
- destination activate与 cancel从同一 intent account并发10k次只允许 Plan或 fence一个
  胜者；transient absent proof取消、Plan已存在后 cancel、无 full cancellation receipt
  pin释放 source全部拒绝；另分别把合法 cancellation receipt换成其它 migration、错误
  destination reservation及同 migration但不同 candidate Plan digest，并替换 receipt
  binding、durable projection或 cancellation fence中的任一字段，均须在 source
  provisional release前拒绝；activate必须原子替换 pending→published account且
  activated anchor与 event selector逐字段相等；
- same/cross Plan缺 reservation descriptor、admission digest不等、source charge bytes/
  category count非0、destination charge不等 Plan预算、首个 side effect前缺任一 active
  reservation或任一 compare-reserve缺完整 candidate Plan全部拒绝；同 migration ID但
  candidate Plan digest/createdAt不同、destination/source reservation绑定不同 Plan
  digest、activate Plan不等也拒绝。完整 admission digest替换为单 charge digest、
  descriptor/record/projection使用不同 admission vector、role/Identity未唯一选中
  对应 charge，或 cross source/destination vector互换都必须零写拒绝。Plan Envelope
  outer same+payload cross、outer cross+payload same、same reserve+cross Plan、
  cross reserve+same Plan，以及 outer正确但 sizing/cut/admission mode错误均须
  Schema reject。reservation role与 charge role、reserve request publication、
  reserved event publication或 reserved account plan-state任一交叉拼接必须 Schema
  reject；same/destination/source role与 activate、两类 commit、四类 release的所有
  错误 operation-kind交叉，以及 source使用 role/kind/outcome不匹配的 destination
  counterpart receipt pin也必须 Schema reject；合法 selector下缺少
  cancellation/release binding，或 binding把 destination receipt换成其它 migration、
  错误 reservation、错误 candidate/published Plan digest也必须由 Schema或 resolver
  reject；生成的 JSON Schema必须是 atomic selector `oneOf`且对上述负例逐个拒绝；
- quota sizing的 typed source cut、resolved Manifest/freeze token/trust/schema、
  budgets/sizing/admission digest、各 category count/bytes与 provider allocation逐字段
  `expected-1/expected/expected+1`，以及 cross-category swap全部重算；少报即使 total
  未超也必须在 reservation前拒绝；retained-artifact upper-bound tuple必须 exact-cover
  11种 kind，省略任一零值 kind、把零项改成 absent、重复 kind、调换 UTF-8顺序或
  非零/零字段 substitution全部拒绝；
- post account transition anchor的 ordinal/nonce/migration/reservation/role/transition/
  predecessor逐字段
  substitution、account反向 pin当前 event ID/content digest或尝试迭代 fixed point全部
  拒绝；operation/kind/reason及 forbidden optional field交叉组合 Schema reject；
- commit actual retained取 `0 / reserved-1 / reserved / reserved+1`，前三者按恒等式
  结算、最后一个零写拒绝；response-lost/restart不重复收费；final Acceptance缺任一
  ledger committed receipt保持 `migration_only`，把 final pin换成 release、
  not-committed、错误 role/commit kind或交换 cross两侧同样保持关闭；同 selector但
  来自其它 migration、同 migration错误 reservation、同 migration ID不同 Plan digest、
  receipt-set mode与 Plan mode互换，或 cross source内 destination receipt不等于
  final destination receipt同样保持关闭；
- release在 Acceptance/Store/audit任一引用非空、active executor非空、删除少/多一项、
  deletion receipt identity/domain/HMAC/count/set/bytes不等或 source先于 destination时
  拒绝。destination release receipt另做 cross-migration、wrong destination
  reservation、same-migration/wrong Plan digest、pin↔durable projection与
  destination commit binding不等负例，任何一项都不得释放 source anchor。hard cap
  不得通过删 Plan/event/receipt、换 Identity alias/side、拆小 migration或重签绕过；
  正向 fixture必须在 destination deletion receipt已证明 Plan删除后，仅凭
  authenticated source committed event + destination commit/release receipt推进 source
  release，任何要求实时重载 Plan的实现都判失败。
- retained/deleted artifact set及 Acceptance/Store/audit cut/reference enumeration分别做
  missing/extra/reorder/duplicate、source/destination universe kind↔side互换、第二
  locator与 cut/version drift；ledger已满或 integrity failed必须返回
  zero-write/no-receipt `state_unavailable`，既有 nonce仍 replay原 receipt。

### 7.2 Baseline、Delta 与 Git

| ID | 场景 | 必须断言 |
|---|---|---|
| AT-D01 | clean tracked baseline | 从 exact object 重建，无冗余 blob |
| AT-D02 | staged/unstaged/untracked baseline | final-visible bytes 原子归档并可重建 |
| AT-D03 | dirty 内容原样 commit | effective=false，provenance 保留 |
| AT-D04 | dirty 内容 reset | current status 可空，但 effective change 非空 |
| AT-D05 | baseline untracked 后删除 | 产生 deleted effective change |
| AT-D06 | 同文件 committed+staged+unstaged | source segments 连续，净变化不重复 |
| AT-D07 | staged delete + untracked add | provenance 两段，effective replacement |
| AT-D08 | rename/copy/type change/chain | lineage 正确；歧义显式降级 |
| AT-D09 | conflict stage 1/2/3 | metadata + partial/UNKNOWN，不伪造普通 hunk |
| AT-D10 | symlink/special/submodule | 不越界读取，显式 Boundary |
| AT-D11 | CRLF/CR/no-final-newline/Unicode/空格路径 | deterministic hunk/ID |
| AT-D12 | binary/invalid UTF-8/huge/many hunks | budgeted metadata + Boundary，不 OOM |
| AT-D13 | capture 中 HEAD/Index/Worktree/policy 改变 | retry 后 partial/conflict，绝不 clean |
| AT-D14 | missing/corrupt baseline blob/object | fail closed/cannot-determine |
| AT-D15 | detached baseline + branch rewrite + Git GC | immutable lease 后仍可重建 |
| AT-D16 | Git lease 创建失败 | partial/unpinned + Boundary，不宣称完整 |
| AT-D17 | Stage 1 每个 marker/blob/lease/Manifest crash phase | replay/recovery 无可见半 Task、无误删 shared blob |
| AT-D18 | Pulse logical baseline ≠ evaluated Snapshot | Task baseline 仍精确等于 evaluated Snapshot |
| AT-D19 | autocrlf/eol/working-tree-encoding clean path | 无跨 domain 假 Diff |
| AT-D20 | LFS/custom filter/textconv/sparse checkout | 不执行外部 filter；Boundary 可复现 |
| AT-D21 | empty/repeated/head-tail insert-delete、NFC/NFD | golden span/operation/ID bytes 固定 |
| AT-D22 | deterministic budget + 不同并发完成顺序 | analyzed set/digest 相同；timeout/cancel 零写入 |
| AT-D23 | modified/case-only/ambiguous copy/rename chain | exact-only canonicalization；其余 delete+add/Boundary |
| AT-D24 | rebase 后旧 baseline/blob/lease | current 与 historical dependency 都可读 |
| AT-D25 | baseline quota 超限 | metadata-only partial；committed history 不被年龄 GC |
| AT-D26 | SHA-1/SHA-256 unborn repository、empty tree 尚不在 ODB、首个 commit | canonical empty-tree OID 可验证；首个 commit 前后 baseline 不漂移；对象长度/format 不混用 |
| AT-D27 | exact rename/copy 与 Git 配置/版本/`diff.renames`/threshold/limit 不同 | canonical lineage/ID 相同；Git candidate/score 不进入结果；等价 source 歧义稳定降级 |
| AT-D28 | Stage 1 Creation Basis/read-set + marker-first 每个副作用点 | Pulse 可缺；blob/lease 前 marker durable；final revalidation drift 零 Task；exact-OID recovery 不碰用户/shared ref |
| AT-D29 | baseline HEAD/tree/lease/source Snapshot 交叉篡改 | commit/headState、commit→tree、lease OID、unborn empty tree 任一不等都 fail closed |
| AT-D30 | path-safe capture first-write/same-handle/no-op recapture | scan 前零 durable identity；Snapshot/baseline/Hunk bytes同 stream；100 次同 semantic capture 复用首次 Snapshot且不 stale Task |
| AT-D31 | CAS reservation T1/T2/crash/inode phases | T1 rollback 不删 T2 dedupe root；planned/temp/final 每阶段可恢复；foreign/pre-existing object 永不删 |
| AT-D32 | quota + Pulse/Artifact/Store three-layer commit | reject 候选零 reservation；latest-root/head re-admission允许他人合法 delta；每次 root change都有 Transition且 Admission↔commit Transition↔Receipt/Journal/Store Manifest proof exact。对 plan、Pulse publish、Artifact generation publish、Store generation stage、Store publish response-lost逐点 crash：commit前旧 S tip/Pulse仍 canonical，commit后新 tip canonical；同请求恢复10k次不增加 object/count/bytes。P/A/S pin完整 request+receipt/proof claims可在 restart/offline trusted read按 historical key重验，删除/交换 claims或 token必须 fail closed。Store unique tip exact pin Artifact generation/provider proof，quota-only successor继承同 A pin，Artifact更新只接受 direct successor；两个 Store sibling固定 `store_manifest_fork`，cached pointer/mtime/filename不得选赢家，未选 Artifact sibling不得 scan/adopt。chosen Store/Artifact/Pulse任一 missing/corrupt/tamper都 fail closed且不 rollback。predecessor Store generation在 next root中计费、仅 current tip为有界 structural commit point；self-metered size最多8次收敛且无 hash fixed-point。valid key/size下把 `private_blob`放入 committed metadata/control或 active metadata、把 transaction marker放入 metadata，或把任一 control-only kind放入 active metadata/temp plan都必须 Schema reject；七个 root camelCase slot必须分别只接受映射后的 snake_case category const，任意 slot互换拒绝；Transition/Admission stable-ID digest、full-record payload digest、Envelope digest任意 domain替换或 outer/payload identity/time不等都拒绝；255/256/257、borrow/merge/root-collapse与 cross-category substitution golden全过；`put k0001…k0257→remove k0129→put k0129` 按首个 `lastKey>=key` child路由并回到 byte-identical root；从 genesis重放100次混合 transition后 byte-identical root/head，删除活引用 structural node必须使对应审计显式失败 |
| AT-D33 | SafeGit real linked worktree/local ODB/ref backend | 真实 worktree backpointer通过；alternate/promisor/replace/reftable/missing local object无 network且 partial/fail closed |
| AT-D34 | reserved control tree + hard-deny universe | tracked `.understand-code` collision 零写不覆盖；hard-deny原位改写且保留 metadata 仍 unknown state、绝不 false clean |
| AT-D35 | Store ownership init/migration crash + terminal cut | 在 revision-0 zero-side-effect full dry-run、external intent首次 CAS、Store-root allocation planned/allocate/staged/published/final、marker/genesis/bootstrap/activation、ledger 1..4代、`terminalization_allocations_planned`的 AA/SA/AS/SS每个状态及“provider allocation已提交但 external update未提交”、`terminalization_planned`、genesis journal publish、receipt publish、每个 single-delta successor的 record allocation/payload/publish/append cuts、quota Transition/Manifest terminal head、proof-only tip与 atomic journal-seal+external-terminalized final cut逐点注入 broker/process/OS crash；每次 recovery只读 current provider state及已 pin locator/immutable journal，receipt canonical bytes、deterministic attempt nonce/staging locator、record ID/locator/createdAt/binding与最终 bytes不变；Store-root、receipt、genesis及每个 successor分别做10k次 allocate-before-persist/append recovery，均不增加 object/byte/count且绝不扫描/adopt historical revision或普通 namespace。两个 writer从同 tip对不同 target竞争10k次时，canonical directory<write/ordinal scheduler强制两者导出同 target/delta/record ID，不能产生 loser orphan或 sibling。directory/file状态机按 frozen union推进，provider只接 exact opened authority；同一原子 commit验证 bound root及 component↔ancestor binding exact path projection。parent在 root内 A→B rename、A/B exchange、ancestor换名/换层，或移出 root、source/final swap、collision、ABA、hardlink/symlink均 not-committed且零移动/覆盖/name-delete foreign object。对 atomic publish六种 not-committed reason逐一在 provider resolved→journal append前、append后→successor前注入 crash并各做10k restart：同 nonce仅一个 byte-identical receipt/outcome record；三种 containment reason在 online revalidation不等时零 successor/零新对象，恢复 exact后仅一个新 attempt；staging reason仅一个新 attempt；final collision与policy migration永远零 successor并映射冻结 public error；全部 reason零 namespace副作用、无 object/count/byte增长、无 sibling/orphan。published ambiguity只进入 authenticated bounded quarantine；compare-delete必须先 durable planned record/Transition pin，再 provider call，再 durable resolved record后才移除 ownership，crash/retry只产生一个 outcome；disabled时对象保留计费。allocations phase完整 receipt与 planned phase byte-identical，只有 SS可推进；genesis full plan/progress、successor单 delta、proof-only terminal tip完整重放且唯一，四个64 MiB预算与4096 count重测。receipt/head/ledger/journal/terminalized任一 missing/tamper/replay/fork/seal-token变化都不开 strong Surface；普通 provider upgrade/downgrade跨全部 crash点保持 binding/staging/external revision/journal cut可读，卸载在活引用存在时拒绝；legacy authorization贯穿 terminalized |
| AT-D36 | clean hard-deny / known hidden change | clean tracked secret进 unknown state且不伪造 source/kind；可证明 add/delete进 redacted change且不重复；summary/accounting/completeness exact |
| AT-D37 | Store Manifest provider-side compare-append | 两个 writer从同 S_n以不同 candidate并发10k次，provider原子 bind nonce/request digest + publish generation + update complete set + advance authenticated head + persist compact signed receipt，恰一 committed且 loser零 final generation/object/count/bytes；每个 nonce各有一个 outcome receipt。同 nonce同 request重试10k次原 receipt byte-identical，同 nonce异 request全拒绝；后续 head推进后旧 nonce仍返回旧 head/entry。对 nonce bind、candidate publish、set/head advance、receipt persistence每个 crash cut注入；任一中间态不可见。head complete set、direct predecessor、entry commit nonce、generation count/set digest、publication binding/proof/receipt任一 missing/extra/reorder/tamper均 `store_manifest_fork`且不回退；Pulse/Artifact孤儿仍不得 scan/adopt |
| AT-D38 | all publication sites durable outcome | Store root、terminal receipt、handoff genesis、Store Manifest、每个 directory/file逐一注入六种 atomic-publish not-committed reason，并覆盖 provider return前后、progress compare-replace前后与10k restart。每个 post-call state exact保存 durable request projection、staging/final binding、receipt及允许的 proof；transient authority序列化一律 reject。committed branch逐字段断言 `attempt.attemptNonce == result.requestDurableProjection.operationNonce == operationReceipt.claims.operationNonce == containmentProof.claims.operationNonce`；not-committed branch断言前三者中不含 proof的一组相等。篡改任一路径、把 result 对象上的不存在字段当权威或只比较 token均 reject。六种 reason/directive/successor是单一 strict failure union，任一错配/extra key Schema reject；两个 retry directive各只生成一个连续 attempt，fatal/migration零 successor；同 nonce result/receipt byte-identical，namespace/object/count/bytes无额外副作用 |

### 7.3 Symbol、Semantic 与 Matching

| ID | 场景 | 必须断言 |
|---|---|---|
| AT-S01 | body-only edit | `BODY_LOGIC` + leaf symbol |
| AT-S02 | multiline signature edit | `SIGNATURE` |
| AT-S03 | comment/whitespace only | parser/token 证明后才 cosmetic |
| AT-S04 | “看似 cosmetic”的逻辑编辑 | 不能降级 cosmetic |
| AT-S05 | add/delete/rename/copy | `TOPOLOGY` |
| AT-S06 | import/manifest/config/schema/test/doc | 对应 facet/role |
| AT-S07 | overload/同名嵌套/类方法/constructor | symbol identity 不碰撞 |
| AT-S08 | 一个 hunk 跨多个 symbols | 全部保留 |
| AT-S09 | 函数边界纯插入 | 精确映射或 file-level partial |
| AT-S10 | syntax error 命中/不命中 hunk | 局部 status 与整体 completeness 诚实 |
| AT-S11 | 同文件 planned + extra hunk | completed/partial 与 unplanned 可同时成立 |
| AT-S12 | required 未改且 matching complete | omission |
| AT-S13 | required 未改但任一维不完整 | cannot-determine，不是 omission |
| AT-S14 | Actual/required 全覆盖 | 无悬空或未处置单元 |
| AT-S15 | delete/add/symbol rename/file rename | old/new side refs 与 pairing status 精确 |
| AT-S16 | Impact complete 且零路径 | `none_observed`，不伪造 Path/Boundary |

### 7.4 Operation、并发与 Lifecycle

| ID | 场景 | 必须断言 |
|---|---|---|
| AT-O01 | unauthorized Check/Verify/refresh/rebase | 仓库读取与 Receipt 泄露前拒绝，零写入 |
| AT-O02 | same key same request after later revisions/restart | 返回首次完整 result，revision/Event 不变 |
| AT-O03 | same key different payload/Actor/operation | idempotency conflict |
| AT-O04 | expected revision mismatch | 新 key revision conflict |
| AT-O05 | same Snapshot different Check key | already-current，零 revision |
| AT-O06 | Manifest/Pulse/baseline 在分析后变化 | repository basis conflict，零写入 |
| AT-O07 | live bytes drift but Snapshot 尚未发布 | read-set conflict，零写入 |
| AT-O08 | concurrent identical Check | 一个 commit，其余 exact replay |
| AT-O09 | concurrent different Check | 一个 commit，其余 conflict，不替换 canonical |
| AT-O10 | Check Event/Receipt/time/dependencies | revision、Snapshot、generatedAt 全部一致 |
| AT-O11 | first Verification | attempt 1、无 supersedes、record-only |
| AT-O12 | retry Verification | 显式 supersedes latest；并发 loser 不自动追随 |
| AT-O13 | method mismatch/old Snapshot/foreign claim | fail closed |
| AT-O14 | required passed/accepted skip | verified Gate 正确 |
| AT-O15 | failed/blocked/flaky/unaccepted skip | Gate 不通过 |
| AT-O16 | passed/skipped 只覆盖部分 acceptance claims | 可入账但 Gate 不通过 |
| AT-O17 | refresh success | baseline/spec 保持、Context 重建、projection 清空 |
| AT-O18 | rebase success | target/new baseline 精确且真正改变、Context 重建 |
| AT-O19 | refresh/rebase provider fail or race | 原 bundle byte-identical、零 revision |
| AT-O20 | refresh/rebase 后 ID 恰好相同 | generation 已变化，旧 confirmation 不复活 |
| AT-O21 | Check 前后派生 phase | 无 descriptor=`awaiting_check`；成功后唯一 descriptor=`check_review`；Manifest pointer 仍空 |
| AT-O22 | 从 `check_required` 离开 | awaiting 阶段拒绝；review 后回 in_progress/accept/进 verification 合法；进 verification 时才设置 exact pointer |
| AT-O23 | final validation cut 前/后外部写 | cut 前 conflict 且零写；cut 后结果只绑定旧 Snapshot，下一 Snapshot publication 使 Task stale |
| AT-O24 | attempt1 failed、attempt2 passed 后复用旧失败 | 旧 Record 不能授权回 in_progress；Action 只接受 current latest failed/blocked/flaky ID |
| AT-O25 | refresh/rebase Receipt/Event/capability | Receipt=`update_task`；digest 含 action；三者不一致、同 key 换 action 均 conflict |
| AT-O26 | rebase target 非 current、new baseline 不等 target、historical dirty target | 全部 fail closed；live exact target 才能创建新 materialization |
| AT-O27 | refresh/rebase reset 前后的历史闭包 | 旧 projection 先原子归档；current 清理后旧 Check 及完整 dependency closure 仍可验证 |
| AT-O28 | strong created→stale 后首次 refresh/rebase 与 legacy stale | strong spec 可重放并生成首个 generation；legacy 缺 spec/baseline 明确拒绝 |
| AT-O29 | safe request digest + private full-input HMAC replay | 同 safe projection 不同 command/output 冲突；same full input 重启后 exact replay；scan policy变化不可混用 |
| AT-O30 | request equality/key/detail corruption | equality Record、worktree key、detail commitment 任一缺失/损坏 fail closed且不返回旧 Receipt |
| AT-O31 | immutable Verification skip/detail | skip acceptance只 append、Record bytes不改；stored detail fixed-path/HMAC验证；public无 private ID/digest |
| AT-O32 | Context generation publication/retry | immutable Record 与四方 ID一致；同 semantic retry复用首次 bytes/time；missing input pin不能确认或 refresh |
| AT-O33 | identity namespace activation/recovery | legacy/new coexist不交叉引用；每个 intent/manifest/fsync crash phase只激活完整 strong namespace |

### 7.5 安全、性能与确定性

| ID | 场景 | 必须断言 |
|---|---|---|
| AT-Q01 | `.env`/credential/private key path | 正文从未读取/持久化/返回 |
| AT-Q02 | 普通源码内 secret canary | baseline blob、Check、Evidence、Markdown 无 canary |
| AT-Q03 | root/cwd/temp/absolute Git stderr | 所有公开 JSON/Markdown/diagnostic 无 Host path |
| AT-Q04 | symlink swap/open race | stable read fail closed |
| AT-Q05 | option-like/control/oversized ref/path | argv/path validation 拒绝 |
| AT-Q06 | 打乱 Git/files/Map 输入顺序 | canonical bytes、IDs、semantic digest 相同 |
| AT-Q07 | locale/timezone 重跑 | 除 generatedAt/content envelope 外 semantic result 相同 |
| AT-Q08 | 1000 changed files / 10k graph nodes | 有界内存与明确 budget Boundary |
| AT-Q09 | PRD 中型仓库目标 | warm p95 ≤5s |
| AT-Q10 | 10k graph 节点目标 | complete/partial 结果 ≤15s，不超时伪 clean |
| AT-Q11 | Verification command/summary/output 含 root 或 secret canary | 私有 ledger 可审计，公开 renderer/Surface 必须脱敏；命令从未 spawn |
| AT-Q12 | hard-deny path 含 canary 文件名 | 公开 Actual/Diff/Error 不含精确 path；仅聚合 redacted Boundary，完整性降级 |
| AT-Q13 | parser/Git/scanner error、摘要与 nested cause 含 POSIX/Windows/UNC/`file:` URI 或 secret | 调用方文本不持久化；公开 DTO 只含 allowlist code/stage，文案由 fixed renderer 派生 |
| AT-Q14 | scanner version/policy/attributes/config 在 capture/analysis 中改变或 scanner error | read-set conflict 或 fail closed；零 committed Task revision/blob |
| AT-Q15 | versioned `wp5-change-benchmark-v1`：1000 changed paths / 32 MiB raw content / 10k-node、100k-edge 图；exact fixture manifest 与 runner profile 见下文 | 先 warm-up 5 次，再测量 30 次并报告 p50/p95：baseline capture p95 ≤5s、Check p95 ≤15s；同 30 次 process peak RSS delta p95 ≤512 MiB、Store logical-byte 增量 p95 ≤实际 accepted private-blob bytes + 16 MiB、单次锁持有 max ≤1s 且 p95 ≤250ms；未触发 Budget fixture analyzed coverage=100%，触发 fixture 精确 canonical prefix + 其余 100% Boundary；Artifact bytes 不超 resolved cap |
| AT-Q16 | deterministic budget、wall-clock timeout、AbortSignal/process interruption | 计数预算结果跨机器一致；非计数中止零写入且 replay 可恢复 |
| AT-Q17 | Git lease ref namespace、linked worktree、option-like object/ref 与权限 | 专用 namespace/argv 校验/owner 权限；不能覆盖用户 ref 或执行 hook/filter |
| AT-Q18 | private blob/marker/history/detail 的 symlink/reparse、hardlink、pre-existing wrong owner/mode/type、corrupt/digest mismatch、parent/source-entry/open/publish swap 与公开 Surface | component no-follow；owner UID/SID；目录0700、regular file0600、nlink=1；provider-private staging对普通 namespace不可见，`temp_identity_recorded`/`temp_payload_verified`绑定 exact opened object；publish API只收 staging authority、held destination parent与 final name，architecture spy证明不调用 source-name rename/link。descendant `relativePath` canonical decode/encode必须与 components同数量/顺序/bytes，components与 root→parent bindings一一对应且最后等于 held parent；bound-root分支等价空 chain。原子 commit必须同时验证 root containment与 exact path projection；在最后 observation后把 parent于同一 root内 A→B rename、A/B exchange、reparent，或把任一 ancestor换名/换层，均返回 `parent_path_projection_changed`且 namespace零副作用；移出 root/换 binding同样 not-committed。只读 continuity observation不能授权 replacement；source/final swap或 race winner不得被移动/覆盖/delete。每次 trusted read重算 provider binding/size/digest及所 pin key签名；异常 fail closed，locator/private digest/源码不进入通用 DTO/Markdown |
| AT-Q19 | baseline/actual commit/index/worktree/untracked/conflict 任一 side 含 secret canary | 该 unit 的 path/OID/digest/Hunk/Symbol/Actual 全部不落盘；只保留 aggregate Boundary，scanner error 零写 |
| AT-Q20 | Verification command/args/summary/stdout/stderr 含 secret、POSIX/Windows/UNC/`file:` Host path | raw output 永不持久化；unsafe detail 整体丢弃并 redacted；公开 Artifact/Receipt/Event/Markdown/diagnostic 无 canary/path |
| AT-Q21 | path-safe Snapshot/Pulse/Resource mandatory scan | branch/path/content、same-stream、16 MiB/256 MiB cap、legacy raw Surface canary；无 path/OID/raw digest/legacy locator泄漏 |
| AT-Q22 | locator HMAC + key lifecycle/offline dictionary | common Host paths不可由公开 ID字典验证；global initialization race唯一；active key丢失/损坏全局 fail closed、不重生 |
| AT-Q23 | sensitive request oversized/dictionary fixture | 16 MiB总量、args/summary/output各 cap前零写；公开 request/detail commitment不可离线猜 command/summary |
| AT-Q24 | CAS zero-byte/high-concurrency ownership + object ABA + provider lifecycle | T1/T2 + 10k zero-byte候选受 reservation/control count+bytes cap；10k次 Store-root/receipt/genesis同 locator crash-recovery只产生一个对象。复用相同 device+inode/file ID、btime/ctime、size/digest/HMAC的 unlink/recreate对象仍不相等；long-lived binding在 broker/process/OS restart后按 wire所 pin binding generation在线重验，epoch-only binding reject。macOS/Linux每个签名 OS×filesystem/mount target profile只有 real provider通过 crash/ABA/path-projection/directory publish/journal/external-CAS suite、当前物理 volume runtime exact-match profile并具独立 OS principal或 kernel isolation后才可注册；mock或 stock same-UID adapter禁用 strong write。real-FS result fixed path/ID/digest、required case exact-cover与 aggregate golden固定；逐一篡改 Result/Evidence/runtime/policy重复的 provider、policy、implementation、binary、target七字段、suite/fixture/runner/crash coverage/result，或 Catalog/Registry runtime的 IPC endpoint attestation digest、attestation generation、issuedAt，即使重签各对象也必须 `attestation_invalid`且零写。四类 provider signing key正常轮换后旧 token/Acceptance或Store compare receipt仍按 historical key验证；删除 historical receipt/key或替换 resolvedAt/request digest失败，compromise-revoked key不得以 historical-only继续授权 strong chain。root/recovery/provider/approver prefix substitution、duplicate public-key alias、错误 usage/Registry或Acceptance rollback失败。planned root rollover、compromise 2-of-3 recovery与 `recovery_only`关闭 strong Surface做 upgrade/downgrade/compromise E2E；compromise revocation使引用 Store fail closed并进入显式 migration。普通 provider binary upgrade/downgrade只 append Acceptance，保持 immutable Installation identity、Store marker、binding generation、staging locator、external revision与 sealed journal cut exact；换 binding generation只允许新 provider/policy双-provider migration Manifest，活引用存在时卸载/删除 historical root/key/metadata拒绝。token不变却发生 ABA、仅支持 source-name publish/`unlinkat(name)`或非原子 containment的 provider首副作用前禁用；自动删除只允许先持久化 compare-delete planned record并由 atomic handle-addressed provider执行，disabled时对象保留计费 |
| AT-Q25 | near-quota Store | ≥100k metadata/history、接近1 GiB CAS 下 admission/rollback/recovery root正确；正常锁 p95≤250ms/max≤1s，full audit在锁外 |
| AT-Q26 | hostile SafeGit environment/config/object store | hook/fsmonitor/filter/external diff/include/alternate/promisor/replace/network canary均不执行；malformed NUL/cap按固定 code fail closed |
| AT-Q27 | lease reflog/ref lock races | logAllRefUpdates=always、pre-existing/race reflog、`<ref>.lock`、linked worktree各 phase；只CAS exact ref，永不删改任何 reflog/user lock |
| AT-Q28 | universe/control-tree exhaustion | million-unit/path-byte/depth/symlink-loop超限零写；tracked/pre-existing `.understand-code` collision保持 byte-identical |
| AT-Q29 | hostile installation-state locator/environment drift | `$HOME`/XDG/LOCALAPPDATA/cwd/temp 注入均被忽略；OS resolver、owner、root identity/token 任一失败或漂移即 fail closed，workspace/Git/Store 内 state root 与 unknown app directory 不 adoption/覆盖；active binding只能经 unique current Manifest tip的 terminal head定位同一独立 immutable terminal receipt，并与 retained external `terminalized` pin交叉验证；receipt locator/provider binding/content/token、source intent/history与可选 ledger任一不等或回滚均拒绝，不能扫描 Store root挑选另一个 token-valid receipt/ledger |
| AT-Q30 | SafeGit binary/config/alternate/backpointer TOCTOU | pinned handle/token 在 invocation 前后重验；binary/config/alternate/promisor/replace/worktree backpointer race 只能得到 sandbox denial；网络、Root 外读取与非 allowlist child exec 从未发生 |
| AT-Q31 | SafeGit process/input/output/ref-lock resource exhaustion | 每 command 的 stdin/parsed-record/deadline/zero-lock 与 OS-enforced RSS/address-space/CPU/PID/FD cap 精确生效；hostile pack/object graph 不得 OOM Host；timeout/cap/cancel 终止完整 process containment；`update-ref` unknown outcome 保留 marker并按 exact ref/OID/reflog/lock CAS recovery，不删来源不明 lock/reflog |
| AT-Q32 | provider trust compromise/migration/lifecycle | recovery key泄漏立即 append recovery-only并永久关闭旧 identity写入；新签名发行物建立不同 Installation Identity，partial/crash/restart/downgrade只能恢复同一 cross-installation migration，不能用剩余旧 quorum解锁。same-identity与cross-rebootstrap Plan逐项验证双方 Identity/pre-plan Acceptance/Root/Registry/Catalog/selector/Store cuts；mode关系错误、writer相同、source非 recovery-only或bundle不等均 reject。对 Plan→migration-only→source universe→每对象 planned/publish/receipt/committed→destination cut/universe→zero-live→tombstone→ready→seal→strong-ready每个 cut注入 crash并10k restart；progress并发恰一 record，missing/extra/reorder/sibling/head replay fail closed。每次 restart从 authenticated enumeration重建唯一 receipt prefix：`started` empty golden、planned不增长、committed只追加 next ordinal；注入 partial-as-complete、ordinal gap/duplicate/reorder、count/digest/byte不等均 fail closed，且任一 partial prefix不能产生 zero-live、sealed head或 final Acceptance。删任一 root/object/edge、receipt missing/duplicate/cross-migration replay、任一 destination binding仍指 source、非空 failure/active set均不能出 zero proof；seal后/Acceptance前保持 Surface关闭，final core必须与 ready record exact。same-identity tombstone永久不可 re-enable；cross tombstone由新 root签发且旧 Identity永久 recovery-only。public JSON/Markdown/doctor严格禁止内部 targetProfileId、build/feature/mount digest与内部 group数量/顺序；只改变 private claims时四字段 public ID不变，注入 extra key reject。另逐项注入 signed Catalog omission/extra target、Universe bucket missing/duplicate target、coverage basis ruleset/dimension/source/count/set/unresolved mismatch、incomplete coverage伪 strong、unknown descriptor/code、同 descriptor异 code、同 code异 descriptor及 private build/feature/mount→code smuggling；全部 fail closed或保守 read-only且 public bytes不泄漏内部 membership。所有 trust Envelope outer/payload等式与 fixed locator映射、Store/Acceptance/progress head token、runtime不能自报 Registry/Catalog/selector均做 hostile fixture |
| AT-Q33 | strict crypto host/package/identity lifecycle | 在每个 advertised Node/OpenSSL、WebCrypto/browser及 provider runtime上消费同一 exact manifest；逐项按顺序分别断言 public-key point expected、signature `R` point expected和完整 signature expected，恰为56次 point admission + 28次 verify，不能去重。`identity-universal-forgery`与 mixed-order `A`构造即使 native backend返回 true仍被 strict外围拒绝；合法 `A/R`但因 `S>=L`、equation或 ctx/ph失败的 case证明整体 reject绝不能误作 point expected。缺 method、point validator恒 true/false、point/verify分叉、profile错、throw/rejected promise、非 boolean、输入 buffer mutation、KAT后 method replacement、caller删减/reorder/duplicate manifest、resource/compiled digest不等都不能取得 opaque capability。安装 old bundle/old Identity并进入 recovery-only，再安装 new signed package/new bundle：old Identity只凭 retained origin binding/bundle/manifest验证 read-only source，cross migration完成前新 bundle或剩余旧 quorum都不能授权旧写入；删除任一 retained Envelope使迁移 fail closed而不采用 current bundle。bootstrap bundle/manifest各受独立4 MiB pre-materialize cap且不改变五链40,960/512 MiB history accounting；所有错误只暴露稳定 provider reason，不含 key/message/signature/package path |

AT-Q24还必须证明普通 key rotation后，历史 token/Acceptance/Store receipt继续按其
retained strict profile/bundle/manifest验证；删历史 key、bundle或 manifest都
fail closed。root/recovery/provider/approver的 raw-key digest与 domain key ID互换、
宽松 native signature acceptance、duplicate material alias全部拒绝。普通 binary
upgrade/downgrade保持 Installation Identity bundle Pin；活引用存在时不得卸载或删除
historical Root Metadata/bundle/manifest。

AT-Q32 还必须把 cross-identity crash schedule扩展为
`Plan → migration-only → source universe → Rewrite Plan → started → 每对象 planned
→ SCC group precompute/publish → Semantic Equivalence Proof → receipt → committed
→ destination cut/universe → canonical root rewrite proof set
→ semantic proof complete set → zero-live → tombstone
→ ready → seal → strong-ready`。每个 cut与 HMAC→signature中间点做 crash/restart，
恢复只能从 authenticated fixed locator和 complete journal enumeration重建同一
Plan/Proof/receipt bytes；不得扫描、adopt、重排 mapping/SCC或为失败 proof换一个
candidate。AT-C29/C30列出的每个 rewrite negative vector在 restart、并发 loser和
downgrade下都要复测，并断言预算计数不增长、无 sibling/orphan、source freeze token
不漂移、per-object subset与 root proof count/digest/bytes完全一致、zero-edge cross
不能恢复成 `not_required`、HMAC issuer始终从 trusted Plan恢复且旧 identity持续
`recovery_only`。

AT-Q32 同时执行 quota ledger 10k concurrency/restart schedule：same Identity
`reserve+Plan`全事务、cross destination intent、source provisional、destination
`activate+Plan`或 cancel、destination commit、source commit、destination release、source
release逐 cut恢复；同 reservation/account最多一个 committed event。同 nonce同 request
receipt必须 byte-identical，同 nonce但完整 candidate Plan、proof或 counterpart binding
任一不同都以 `operation_nonce_request_mismatch`零写；destination activate与 cancel只能
一个胜者。destination cancel后/source provisional release前，逐项替换 cancellation
receipt的 migration、destination reservation、candidate Plan digest、ledger generation、
durable projection与 fence；destination release后/source release前，逐项替换 release
receipt的 migration、destination reservation、published Plan digest、ledger generation、
durable projection与 destination commit binding，各做10k restart且 source不得提前释放。
destination commit后/source commit前、destination release后/source release前的合法
路径必须覆盖 destination已按 deletion receipt删除 Plan、source不重载 Plan而从
authenticated commit event继承 descriptor closure的恢复，并令最终
usage、event/receipt/account set与 high-water byte-identical；要求实时 Plan解析的实现
失败。normal pool满仍能执行三种 emergency recovery；hard cap不可通过删除历史、alias、
换 side或拆 Plan绕过，旧 Identity耗尽只能 rebootstrap。historical Acceptance仍 pin
closure时 release必须永久拒绝，deletion receipt任一 token/identity/domain/count/set/
bytes substitution都拒绝。

AT-C29/C30/C31/Q32/Q33 的 release-coverage hostile fixtures还必须先从两个
bootstrap literal读取 strict manifest与 Bootstrap Trust Bundle，再从五个独立 fixed
locator加载 Catalog、Public Taxonomy、Release Matrix、Target Discovery Result与
Release Target Universe，并逐项注入 missing Envelope、recordType/path alias、
stale/fork generation、pin/outer/payload digest不等、root/taxonomy pin不等及五种
generation artifact签名 domain互换。另独立注入 Discovery Input Bundle第六类
签名 domain substitution。两个 bootstrap resource的 typed Pin、compiled manifest
digest、host opaque capability、origin/retained Identity copy及五者
`ProviderSignedDistributionRootBindingV1`必须闭合；bundle再唯一导出 bootstrap root
chain与 strict verification profile。注入 binding/package identity/bundle/profile/
manifest/bootstrap root/release revision substitution或同 semantic artifact的第二
path一律拒绝，byte-identical physical mirror只有 verified package resolver证明同一
signed package identity时允许。

Discovery的嵌入式 Input Bundle还必须逐项测试独立 signature/domain、content digest、
Matrix/fixture/runner pin、runner version/implementation/binary/run manifest、
observation cut freshness、三份 source count/set digest及 observation-key preimage。
stale或漏任一 source record、Matrix source未 exact-cover Matrix targets、Bundle与
Result/Coverage Basis重复 digest不等、Result不是 Bundle outcomes的 deterministic
projection都 fail closed。Matrix或Discovery删/增/substitute target、同 target ID
不同完整 bytes、伪造 artifact自身或 coverage basis复制的 count/set digest、
Discovery漏 unresolved observation、Universe不等于两输入canonical union，或派生
resolution/reason与四级优先总函数不等，全部 fail closed；合法 incomplete输入必须
让**全部** bucket使用同一 reason并保持 read-only。
Suite/Corpus还必须分别注入“signature claims完全相同但 signature bytes替换”并验证
signed-payload content digest与 locator随之改变，旧 locator下替换 signature必须
失败；semantic suite/corpus digest相同但 release/binding/records/signature不同的
另一份合法 signed Envelope不能替代原对象。对每个 Catalog candidate，再以两份都
合法签名且 semantic digest相同、full content digest不同的 Suite/Corpus构造替换：
Result所 pin Discovery Result Pin与 Input Bundle content digest必须 exact回到
Universe coverage basis，
Result Suite Pin必须与该 Bundle→Fixture payload Suite Pin byte-identical，任一
Discovery pin、Bundle digest、Suite/Corpus冗余 digest或 full Pin不等均拒绝且不得
扩大 retained closure之外的对象集合。

还要在 parse/allocation/admission前分别注入超过16 MiB的 chain/Bundle/source
object、任一 chain第4097代、schema可达40,960 retained-object E2E、独立 accumulator
第65,537个 retained object、仅 transitive source使 unique Envelope retained
canonical bytes达到512 MiB+1、4097 target、4097
unresolved，以及两份输入各合法但 union出现第4097项并验证有界拒绝；共享 source在
同 binding/locator/content digest exact-equal时只计一次，任一 alias仍拒绝。两份 target bytes相等、
unresolved typed empty的 golden才允许 complete。producer的 pre-schema无序
collection以多种遍历顺序构造时必须先按 comparator排序并得到同一 bytes/digest/
signature；已经序列化的 set-like wire array调换两项、fixed tuple调换、
duplicate entry或同 key不同 bytes都必须 reject，verifier不得排序后宽容接收。

AT-Q15 的“固定”由 tracked
`packages/change-intelligence/benchmarks/wp5-change-benchmark-v1/manifest.json`
定义，而不是测试临时生成。Manifest strict schema 必须 pin：

- `profile/generatorVersion/seed`，generator source tree SHA-256 与全部 fixture
  file path/content digest/mode/byte/line/language；
- per-file hunk/operation count 分布、rename/copy/conflict/binary/secret/symlink
  分类与期望 Boundary；
- 10k graph 的全部 node/edge digest、in/out-degree histogram、depth/path
  histogram；
- `safe_within_budget` 与 `deterministic_budget_exhausted` 两个 variant 的 exact
  resolved Budget、expected canonical analyzed prefix、expected aggregate
  Boundary/semantic digest；
- benchmark source tree commit、product version 与 fixture manifest
  `ContentDigest`。generator 只负责重建并逐项校验，不能在测量时换 seed。

reference runner profile 固定为
`linux-c7i-2xlarge-node26-v1`：AWS `c7i.2xlarge`（8 vCPU Intel Xeon Scalable、
16 GiB）、Ubuntu 24.04、gp3 3000 IOPS/125 MiB-s ext4 volume、Node 26、
pnpm 11；exact
CPU model/microcode/kernel/filesystem/mount options/Node/pnpm/product commit
全部进入 Evidence。不同 runner 的结果可作诊断，不能关闭 Q15。
每个 measured run 使用新 worktree/Store、同一预热过的 OS page cache与新 Node
process；关闭网络和无关 worker。RSS delta 是完成初始化后的 idle RSS 到
10ms sampling peak；Store delta 是 transaction 前后 owner Store regular files
`stat.size` 总和，不用 filesystem block size；lock duration 用 monotonic clock
记录每次 acquire→release。p50/p95 使用 nearest-rank
`ceil(p*n)`；30 次的 p95 是排序后第 29 个值。原始 30-run JSON、环境清单与
aggregated report 都作为 Commit/CI Evidence 保存。

## 8. 测试与证据政策

每个 Commit 记录：

- exact source tree hash；
- focused command、测试数量与耗时；
- package build/typecheck；
- 受影响 workspace test；
- root `pnpm quality`（合并 Gate 必跑）；
- remote CI run ID、head SHA 与结论；
- failed CI 的可复现根因、修复和防回归断言；
- independent review 的 P0/P1/P2 disposition；
- 用户未跟踪文件保护结果。

禁止：

- 只跑新增测试就提交；
- 用全局放宽 timeout/lock budget 隐藏竞态；
- 将 partial/unknown fixture 改成 clean 让测试通过；
- 删除或改写旧 fixture 来伪造兼容；
- 依赖 ignored `.understand-code/**` 本地产物；
- 重跑失败 CI 直到偶然通过而不定位根因；
- 用 `git add .` 暂存本阶段文件。

## 9. Capability Locks 与 Owner

| 能力 | 当前事实 | Owner | 解锁 Gate |
|---|---|---|---|
| strong Store write / Durable Object Provider | Contract frozen；strict Ed25519 host、Bootstrap/retained trust、Root/Registry History、signed real-FS Corpus→Suite、signed Target Discovery、unsigned Result与 root-signed Runtime Attestation point已形成 reviewed candidate；C09 aggregate 的 QA/Release Evidence、Catalog/Registry、Discovery history/current、Universe、Acceptance、Migration、真实 Provider、client/三层 Manifest writer仍未完整交付 | Platform/Security Lead + Provider/Systems + Artifact Store；QA/Release验证 | **全部同时满足**：WP5-1P/C09 contract+golden；strict Ed25519 raw32/profile/host exact manifest attestation与 opaque capability；固定 Bootstrap Trust Bundle/manifest resource、signed distribution双 Pin、immutable Installation Identity retained origin closure；WP5-PF/WP3P signed real-FS与安装生命周期；WP5-S07 provider client/adapter；D-23 Pulse→Artifact→Store provider-side unique-head compare-append；Acceptance/high-water/compact receipts/root/Registry/Catalog Envelope/public projection/same+cross migration closure及 versioned canonical Rewrite Plan/Semantic Equivalence Proof实现；AT-C17/C29/C30/C31、D35/D37/D38、Q24/Q32/Q33（含 rewrite mapping/SCC/JCS/proof-token/locator/budget/hostile crypto vectors）及 upgrade/downgrade/root/recovery-key compromise/current-vs-historical bundle migration E2E；root `pnpm quality`；同 SHA clean CI；独立 Security/Implementability review无 P0/P1；最后 closeout commit才更新 capability flag/supported tool list |
| `task:verify` | Contract frozen，生产方法未实现 | Task Engine | WP5-4 local/remote + review；WP6 前仍不宣传 |
| `task:check` | Contract frozen，Delta/Symbol/Matching/Operation 未实现 | Change Intelligence + Task Engine | WP5-7/10 全部通过 |
| `task:context:refresh` | capability locked | Task Engine / Context Recovery | WP5-8 full rebuild/failure evidence |
| `task:context:rebase` | capability locked | Task Engine / Context Recovery | WP5-9 baseline/history evidence |
| Diff excerpt | 无生产 Surface | Repository State + Security | secret/path/size canary + WP6 Tool policy |
| Change Workbench | 尚未设计/实现 | Product Design + Frontend | WP7 visual/interaction/accessibility/E2E |
| legacy Task migration | 未实现 | WP8 Migration | explicit backup/digest/Event/Receipt migration Gate |

任一子 Gate通过都只产生 candidate，不得单独解锁。即使 Provider feasibility已
通过，只要 Artifact Store仍使用 mutable/current-file Manifest、尚未实现
WP5-S07 client或三层 provider-side compare-append，strong write继续锁定。

热点文件所有权：

- Contracts owner 独占 `change.ts/task.ts/evidence.ts/invariants.ts/mcp.ts`；
- Provider Contracts owner独占
  `packages/durable-object-provider-contracts/**`及 C09 cross-language
  golden/negative manifest；WP1 shared contract machinery不得重定义这些 domain；
- Store owner 独占 `store.ts`、layout、transaction/recovery tests；
- Repository Delta owner 独占 Git/delta/hunk modules；
- Core Symbol owner 独占 rich parser/symbol adapter；
- Task Engine core owner 独占 `engine.ts` 最终 wiring；
- 其他实现通过新模块导出接口，避免并行改同一热点文件；
- capability 常量和支持文案由最后 closeout commit 修改。

## 10. 主要风险与已冻结处置

| 风险 | 处置 |
|---|---|
| baseline CAS 使 Task 创建变慢/变大 | 只归档 dirty final-visible 内容；预算与 dedupe；Boundary 不伪完整 |
| 普通源码包含 secret | 持久化前内容扫描；命中即 metadata-only；canary gate |
| old/new parser 支持不对称 | 每侧独立 status；局部精确、整体 partial |
| Git rename heuristic 不稳定 | Git rename/copy detection 关闭；WP5 对全量 add/delete 做受预算 exact join；歧义降级 delete+add |
| 分析锁外导致提交竞态 | Store basis guard + Provider read-set validation |
| Strong V1 让旧 binary 失败 | 明确 alpha forward-read boundary；需要时发 V2 |
| 同 Snapshot 重查需要新算法 | P0 禁止换 key 偷换；未来显式 invalidate/recheck Amendment |
| Plan 推断错误导致 omission | 只有 strong expectation + confirmation + complete matching 才成立 |
| Verification 误执行任意命令 | capability 仅记录；无 executor；测试 mock 断言 command 从未 spawn |
| WP5 跨五个 package，回归面大 | 分层 Commit Gate、热点 owner、root quality、clean CI、独立审查 |

## 11. WP5 完成判定

只有以下条件全部满足，本文件状态才能改为 **WP5 Completed**：

- D-24～D-34 在 PRD、G0、Contracts、Store、Engine、Provider host/bundle与 Surface
  DTO 中一致；
- WP5-C/S/R/P/A/E/I 全部从 pending 变为 verified；
- AT-C01～C31、D01～D38、S01～S16、O01～O33、Q01～Q33 全部有可复核
  自动化证据或明确 `not_applicable` 理由；
- legacy fixtures bytes 保持不变，strong fixtures/schema 确定生成；
- 四类 Operation 的 auth/idempotency/CAS/restart/crash/race 均关闭；
- Security canary、determinism 与性能目标通过；
- Contracts、Repository State、Core、Artifact Store、Task Engine、Root、
  Dashboard 全量质量门通过；
- 每个功能层独立 commit/push，对应 clean-checkout CI 成功；
- 至少两轮独立审查无未关闭 P0/P1；
- Capability 锁只按第 9 节 Gate 解锁，未完成能力不进入 Host 支持文案；
- 用户未跟踪的 QA、历史 PRD、assets、builder 和 `site/` 从未被暂存、删除或
  提交；
- 本矩阵补齐最终 commits、tree hashes、commands、CI run IDs、失败修复与
  residual P2 Owner/Gate。

在此之前，对外准确表述是：

> WP5 contract frozen；implementation in progress；production Change Check、
> Verification recording 与 Context recovery 仍 capability-locked。
