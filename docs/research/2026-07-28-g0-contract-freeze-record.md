# G0 Contract Freeze Record

记录 ID：`G0-2026-07-28`

状态：**Closed for implementation；WP5 Decision Amendments D-24～D-39 incorporated**

候选基线：`34da354968a6071d914e4e4a4fca738e6c2d8a29`

冻结日期：2026-07-28

WP4 修订日期：2026-07-29

WP5 修订日期：2026-07-30～2026-08-13

C09-1K 实施证据刷新：2026-08-06

编制方式：Codex 汇总版本化证据、独立审查和自动化结果；Codex 不被记录为真人签署人

Surface Release Gate：**Open**

## 1. Gate 结论

Product Mission、P0 Scope、Non-goals、Task Lifecycle V1、Root Binding Contract V1、Workbench Runtime Rendezvous Contract V1、发布逻辑标识和 WP1 入口契约已经冻结。WP1 可以开始实现共享 Schema 与 Artifact Manifest。

本记录关闭的是**工程实现入口的 Contract Freeze Gate**，不是产品发布批准：

- Codex CLI Plugin 与 Claude Code CLI Plugin 仍是 P0 Beta mandatory Surface，但当前都保持 `pending-e2e`。
- Desktop、IDE 与 VS Code Surface 仍是 conditional，未通过各自 Surface Release Gate 前不得写入支持文案。
- npm Scope、Host Marketplace、公开仓库、License、安装包和最低 Host 版本仍由 WP6/WP8 的发布证据关闭。
- 本记录不声称任何组织、公司仓库 Owner 或未具名真人已签署发布许可。

Gate 关闭依据是 `understand-code` 项目 Owner 已明确要求按本研制计划继续实施；这是单项目工程决策授权，不代表 `ALPHA-B` 或其他外部仓库 Owner 授权。未来进入团队 Alpha、外部 Beta 或公开发布时，Product、Tech、Platform/Security 与 QA 仍须在对应 Gate 留下可追踪的真人确认。

2026-07-29 的 D-22 是 WP4 实现过程中发现并关闭的契约歧义：公开
`build_task_brief(expectedRevision=0)` 必须编排 `created@1` 与
`context_ready@2` 两次合法 Mutation，而不能绕过 Genesis 或一次增加两个
revision。该修订不重新打开 G0，也不改变 D-21 的状态集合、允许转移或 Guard；
它冻结公开 Operation 与底层 Mutation 的边界，并将完整 Operation Journal /
Receipt 提升为可信持久化事实。

同日 D-23 关闭了 Persistent Task 与可变 canonical Repo Pulse 之间的存储
冲突：旧 Task 精确 Pin 的 Pulse 必须归档为不可变历史版本，新的 canonical
Pulse 通过 Store Manifest commit point 切换。D-30 后 strong writer将每一版
Pulse发布到 provider管理的不可变 version path，由 immutable Artifact Manifest
generation pin Pulse，再只以唯一 maximal Store Manifest generation所 pin版本
选择 canonical；D-23 早期固定文件 replacement 流程仅
保留为 legacy/read-only projection。该修订不新增 Artifact Type 或 Lifecycle
状态，只冻结 Pulse 版本身份、历史可寻址性和恢复边界。

2026-07-30～2026-08-13 的 D-24～D-39 是 WP5 实现前及分层实现中的证据模型、写入边界与
Provider可行性修订。审计确认：
原 Change Check 没有 Actual Change 实体、Hunk 或完整性证明；Repository
Snapshot 也不能重建任务开始时已经存在的 dirty/untracked 内容。修订因此新增
Evidence-backed strong profile、task-private baseline materialization、明确
Plan obligation、Verification method equality 和 exact Repository Basis/CAS
Operation 协议；D-29 进一步把 path-safe Snapshot/strong Pulse、known-redacted
change 与 equality-unprovable unknown aggregate、OS-resolved installation HMAC
identity、Store ownership marker、handle-bound SafeGit sandbox、private request /
Verification semantic commitment、CAS reservation、cycle-free Merkle quota
Transition chain、exact Context pins 与 flat History 纳入首个 durable write
边界，同时保留旧 V1 为 owner-only/只读
`legacy_summary`；D-30进一步把原先悬空的“理想 provider”提升为带 Owner、
预算、真实文件系统证据、签名/密钥生命周期和安装路径的 P0 阻断 Gate；D-31再
固定 raw32 public-key digest、跨 runtime严格 Ed25519接受集合、host hostile
manifest attestation、signed-package Bootstrap Trust Bundle及 old
recovery-only Identity retained verifier。未通过
Gate的 target只可 legacy/redacted read-only。这些修订不增加 D-21
状态，也不把任何 WP5 capability 提前声明为可用。

## 2. 状态语义

本项目后续 Gate 记录统一使用以下正交状态，避免把“测试通过”“决策接受”和“可以发布”混为一谈：

| 维度 | 枚举 |
|---|---|
| `machineStatus` | `passed` / `failed` / `not_run` / `not_applicable` |
| `decisionStatus` | `accepted` / `deferred` / `rejected` / `superseded` |
| `evidenceStatus` | `observed` / `official` / `provisional` / `pending-e2e` |
| `gateStatus` | `open` / `closed_for_implementation` / `closed_for_release` |

`closed_for_implementation` 只允许下游研发开始；只有各 Surface 的构建产物、安装、真实 Tool Call、Root/Error、升级和清理矩阵全部通过后，才能使用 `closed_for_release`。

## 3. 冻结证据

| 范围 | 版本化证据 | Machine status | 结论 |
|---|---|---|---|
| 总研制计划 | `8eb1f49` 与本次 Contract Freeze 修订 | `passed` | Mission/P0/Non-goals 已定版 |
| Graph Quick Jump | `dfb94ec` | `passed` | 复用索引，避免重复全图构建 |
| Graph 有界性与可达性 | `5468299` | `passed` | 全对象可达，视图保持产品 Cap |
| 根级质量入口 | `b8edfa9` | `passed` | 新鲜工作区一条命令执行 build/typecheck/test |
| CI 基线 | `fdc25ad` | `passed` | Ubuntu、Node 22、pnpm 9 质量门已建立 |
| Plugin metadata 保护 | `240abcb`、`2f0cb75` | `passed` | Claude Skill metadata 保真且缺失 Manifest 会失败 |
| Host Binding | `e6d8ae5` | `passed` | 共享 Root/Error/Rendezvous 契约可冻结；Surface 仍待 E2E |
| 大仓性能 | `34da354` | `passed` | Self-host 与确定性 10k Graph Pipeline Slice 通过 |

### 3.1 质量 Closeout

在 `34da354` 上执行：

| 检查 | 环境 | 结果 |
|---|---|---|
| `pnpm quality` | macOS arm64、Node 26、pnpm 11 | Root 10 files / 94 tests；Core 51 / 920；Dashboard 49 / 558；build 与 typecheck 全部通过 |
| `pnpm benchmark:large-repository` | macOS arm64、固定 Fixture | 两个 Corpus 的预算、Fixture、Frozen Workload、布局与有界性全部 PASS |
| `claude plugin validate --strict .` | Claude Code 2.1.202 | PASS |
| Host Binding Probe tests | Root Vitest | 22 tests PASS |
| `git diff --check` | G0 文档修改前后 | PASS；提交前必须再次执行 |

远端 CI：

- Run ID：`30335147523`
- URL：<https://github.com/chifanjie/Tomato/actions/runs/30335147523>
- Commit：`34da354968a6071d914e4e4a4fca738e6c2d8a29`
- Runner：Ubuntu / Node `22.23.1` / pnpm `9.15.9`
- 结果：Root 94、Core 920、Dashboard 558 tests；workspace quality 与 active surface audit 均成功

这条 CI 是 G0 代码质量证据，不是性能、Plugin 安装或 Surface Release 证据。

### 3.2 Evidence integrity

- Host Capture Manifest SHA-256：`6ccec4488558c8953e135999bdf5695c80bb45db3db92f99b55703dca00cc3af`
- Large Repository Evidence SHA-256：`b6feda0dd98aaa3a5adde2434c90038a1a50f30c3c360cee8e4013fc5757a6ac`
- 性能 Evidence 保存生产源文件 Hash、原始样本、预热/采样数和 expected/actual 完整性字段。
- Host Evidence 保持 Surface 边界；Codex App Server provisional 结果和 Claude 未认证 Tool Call 不被提升为 supported。

## 4. D-13～D-39 冻结结果

### D-13：P0 平台

状态：`accepted`

- P0 Beta 支持 macOS 与 Linux。
- Windows Native、Windows named pipe 与 WSL 不进入 P0 Beta 支持范围。
- 最低 OS、发行版、CPU 架构与 libc 组合由 WP8 RC Evidence 冻结。
- 平台可安装与 strong Store write是两个 Gate：每个 macOS/Linux
  filesystem/mount target profile仍须关闭 D-30 Provider Gate，且当前物理
  volume运行时必须 exact-match该 profile；否则仅 legacy/redacted read-only，
  支持文案不得合并两者。
- 重新打开条件：完成 Windows Runtime lock/control/IPC 设计与 E2E，或 GA 平台评审明确要求。

### D-14：产品、CLI、Package 与 Plugin 标识

状态：`accepted`

| 对象 | 冻结值 |
|---|---|
| Product slug | `understand-code` |
| CLI command | `understand-code` |
| Codex Plugin name | `understand-code` |
| Claude Plugin name | `understand-code` |
| Marketplace logical name | `understand-code` |
| Host install selector | `understand-code@understand-code` |
| Target CLI package | `@understand-code/cli` |
| 首个 Agent-native release train | `3.0.0-alpha.1` |
| npm channel | `alpha` → `beta` → `rc` → `latest` |
| GitHub channel | Internal Alpha prerelease → Beta/Stable release |

`@understand-code/skill@2.7.5` 作为兼容包装保留，不是最终 CLI 安装合同。Alpha 只要求一个带预编译 Runtime 的 CLI 发布物；`contracts/core/mcp-server/local-server/dashboard` 在 API 稳定前可保持 workspace-internal。

公开 Registry 查询未发现上述精确 npm 名称，但本机 npm 未登录，`E404` 不等于已保留名称。`@understand-code` Scope 所有权、Marketplace 坐标和发布权限必须在首次发布前验证；若外部名称冲突，只重开外部坐标，不改变 Product slug、CLI command、Plugin 内部名或 Artifact Schema。

发布物命名：

```text
understand-code-{version}-{os}-{arch}.tar.gz
understand-code-codex-plugin-{version}.tar.gz
understand-code-claude-plugin-{version}.tar.gz
understand-code-codex-ide-{version}.tar.gz
SHA256SUMS
SBOM
```

### D-15：Task Artifact 版本控制

状态：`accepted`

- `.understand-code/tasks/**` 默认是本地私有、被忽略的运行状态。
- P0 不自动提交完整 Task、Evidence 或源码摘录。
- Installer/Doctor 不静默修改用户 `.gitignore`；只可给出建议，或在用户明确确认后维护带 marker 的 ignore block。
- 只有显式 export 且完成绝对路径、源码、凭据与主机元数据脱敏的 Artifact 才允许进入版本控制。

### D-16：Task ID

状态：`accepted`

- Canonical Task ID 使用 ULID。
- ID 不依赖本地递增计数，可跨进程、跨 Agent 与 Worktree 并发生成。
- `UC-xxxxxx` 只可作为 UI 短显示，不是持久化主键或外键。

### D-17：Embedding

状态：`accepted`

- P0 Beta 不发布 Embedding Provider。
- Task Brief 必须依靠 lexical、symbol、graph 与 deterministic evidence 完整工作。
- Embedding 属于 P1，并需要独立的数据外发、Provider 权限与无 Provider 降级评审。

### D-18：空 Task

状态：`accepted`

- P0 Workbench 不允许手工创建无原始意图的空 Task。
- Task 只由 `build_task_brief`、受支持的 resume/migrate/rebase 入口创建。
- `created` 必须已经包含非空 `originalIntent`、repository/worktree identity 和 baseline。

### D-19：Alpha Pilot 与 Gold Set

状态：`accepted`

Activation Gate：`open`

| Pilot | 语言/角色 | 固定基线 | Snapshot policy | Alpha Task |
|---|---|---|---|---:|
| `ALPHA-A` | TypeScript self-host + TS stratum | `34da354968a6071d914e4e4a4fca738e6c2d8a29` | clean commit-only；排除 index/worktree/untracked | 18 |
| `ALPHA-B` | 大型 Go domain stratum | `01aa1dac22db7d30e92818486190cef6b342fc18` | local-only clean commit materialization；排除当前 dirty/untracked | 6 |

限制：

- `ALPHA-A` 的 self-host 与 TypeScript stratum 来自同一仓库，不声称具备独立 TypeScript 仓库多样性。
- `ALPHA-B` 的固定 Commit 当前只存在于本地分支；跨机器 Fixture 在 Owner 发布该 Commit 前必须使用可获取的上游 Commit，或通过 Decision Amendment 更新 Pin。
- 两个 Pilot 都从固定 Commit 创建隔离 clean worktree，当前用户修改不得进入 Gold Set。
- 当前只证明本机可读，不代表长期产品试点、公开披露或代码复制已获仓库 Owner 许可。`ALPHA-B` 激活、Gold Task 标注和任何 Evidence 出库前必须取得 Owner 明确授权。
- 公开报告只使用 Pilot alias、语言/规模档位和聚合指标。

### D-20：Host 最低版本

状态：`deferred`

- 每个 Surface 在 WP6/WP8 通过独立 clean-install E2E 后确定最低版本。
- 当前本机版本不自动成为支持下限。
- Claude dynamic Roots 若进入支持承诺，最低版本不得低于 `2.1.203`。
- Owner：Platform / Integration；关闭 Gate：对应 Surface Release Gate。

### D-21：Task Lifecycle V1

状态：`accepted`

Lifecycle 见第 5 节。WP1 Schema 与 WP4 Task Engine 不得自行引入额外状态或绕过 Guard；如需改变，必须新增 Decision Amendment 和迁移规则。

### D-22：`build_task_brief` 两阶段编排与 Operation Journal

状态：`accepted`（2026-07-29 Decision Amendment）

- 公开 `build_task_brief` 保持 `expectedRevision=0`，并由
  `(worktreeId, createScope, idempotencyKey)` 稳定映射同一个 Task ID。
- Stage 1 原子提交最小 recovery bundle：
  `created@1 + task_created Event + task_created Receipt`。
- Stage 2 只在 Pulse、Context 和所有引用校验通过后，原子提交完整 Context
  bundle：`context_ready@2 + transition Event + build_task_brief Receipt`。
- 每一 Stage 分别且只 `+1 revision/+1 Event`；公开调用可以编排两次
  Mutation，但任何单次 Store commit 仍不得跨 revision。
- `task_operation_journal` 必须保存从 Genesis 开始的完整
  Idempotency Record 与 Operation Receipt；每个 Receipt 保存首次提交的完整
  结构化结果与 canonical result digest。
- 同 key 同 Actor 同 request digest 的重试从 Journal 返回首次结果；Task 即使
  已推进到更高 revision，也不能丢失旧结果。payload 或 Actor 不同则返回
  `idempotency_conflict`。
- Stage 1 后崩溃或 Context Gate 失败时保留 `created@1`；重试同 key 恢复
  Stage 2，不创建第二个 Task。
- `context_ready@2` 是阶段间没有其他 Mutation 的标准结果。若 Stage 1 后合法
  `block_task → resume_task`，Stage 2 从恢复后的 `created@N` 严格 CAS 到
  `context_ready@(N+1)`；不得硬编码 revision 2 或倒退 Event history。
- 旧的无 Journal Task 只允许显式兼容读取或迁移；新 writer 不得静默把最近
  idempotency cache 当成完整历史事实。

本修订解决的是编排边界，不新增状态或转移，因此 D-21 Lifecycle 无迁移；
Journal Schema 作为新的 Task-scoped V1 Artifact 需要由 Contracts、Store 和
Task Engine 同步升级。验收矩阵见
`docs/research/2026-07-29-wp4-task-intelligence-matrix.md`。

### D-23：Repo Pulse 不可变历史与 canonical 切换

状态：`accepted`（2026-07-29 Decision Amendment）

- 逻辑 canonical Pulse 由唯一 maximal Store Manifest generation中的 exact pin
  选择；该 Store generation再 exact pin immutable Artifact Manifest generation，
  后者 pin immutable Pulse version；
  每一版 strong Pulse直接以 exact-object no-replace发布到不可变
  `.understand-code/pulses/<encoded-version-key>.json`，不替换 current pathname。
- `.understand-code/repo-pulse.json` 仅是 legacy reader、迁移输入和开发 Fixture
  的兼容投影，不是 strong authorization、canonical identity 或 commit point；
  strong writer 不得创建、替换或从它恢复 canonical。
- 历史 descriptor 保留原 `artifactId/contentDigest/sourceSnapshotId`，状态为
  `historical/stale`；新 current descriptor 使用不冲突的确定性身份。
- strong 生产写入顺序为
  `durable plan → immutable Pulse version publish → exact-predecessor Artifact
  Manifest generation publish → exact-predecessor Store Manifest generation
  publish`。Artifact与 Store路径分别固定为
  `.understand-code/manifests/artifact/<encoded-generation-id>.json`与 owner-only
  `.understand-code/private/store-manifests/<encoded-generation-id>.json`，所有
  component都走 `StoreFilenameKeyV1`。最后一项才是唯一 commit point；它同时
  pin Artifact generation ID/content、durable binding及 provider proof。
  Store candidate由 provider在同一事务 compare expected head/version、
  no-replace发布 generation并推进 authenticated complete set/unique head；
  commit前失败时旧 tip继续 canonical，同 head并发 loser不留下 generation。
  若 authenticated enumeration仍出现 Store sibling/extra/missing，必须
  `store_manifest_fork` fail closed并进入显式恢复，不能任选时间、文件名或
  “赢家”。D-30 provider
  no-replace/path-projection contract明确取代早期
  `marker → history → canonical-file replacement → Manifest`的物理流程；
  所有 Manifest mutation必须先 drain Pulse/Task transaction。
- `canonicalRepoPulse`是 strict `absent | version`：cold/error/genesis只可
  absent，version必须与 Artifact Manifest中唯一 current Pulse descriptor
  exact-equal。未被 Store tip选择的 Artifact sibling不 canonical且不得扫描
  adopt；chosen Store/Artifact/Pulse任一 missing/corrupt都 fail closed且不得
  rollback。旧 Task pin在活引用期间继续读取历史版本并阻止 GC。
- historical Pulse 的依赖者递归 stale，但历史 bytes 与 exact Pin 继续可信可读。
- canonical 恢复失败只标记精确 committed descriptor；不得按 Artifact Type
  批量标坏历史 Pulse。
- `migrateJson` 的 Repo Pulse 历史统一留给 WP8 Migration Gate；在此之前不得
  用该入口替换已被 Task Pin 的 Pulse。

D-23 是存储与恢复语义修订，不改变 D-21 状态机，也不新增 public Artifact
Schema。新 strong 三层 no-replace + provider-side compare-append合同以
`docs/research/2026-07-30-wp5-change-intelligence-matrix.md` 的
`AT-C17/AT-C29/AT-C30/AT-C31/AT-D35/AT-D37/AT-D38`为验收权威；WP4 Matrix的早期
marker/canonical replacement证据只保留 legacy compatibility意义，不得据此把
strong三层路径标记为已实现。

### D-24：Evidence-backed Change Check

状态：`accepted`（2026-07-30 Decision Amendment）

- 兼容 `ChangeCheckV1` reader 可识别旧 payload；新 writer 只写
  `analysis.profile=evidence_backed_v1` strong profile。旧 Check 由非持久化
  classifier 标为 `legacy_summary`，不得注入字段或改变 digest；其空 Findings
  不构成 clean 证据。
- strong Check 包含确定性 Actual Changes、Diff Hunk Evidence、结构化 Analysis
  Boundary 和 repository delta、semantic classification、planned matching、
  impact analysis、verification coverage 五维 Completeness；Actual 明确
  old/new Symbol refs 与 pairing status。
- 每个 Actual/Planned/Evidence/Impact 引用必须解析且双向覆盖；不完整维度必须
  有 Boundary。每个 Actual 与 confirmed required change 恰好一个互斥 primary
  disposition；只有 confirmed required change 且对应分析完整时才能生成
  `possible_omission`。complete 禁止 UNKNOWN/Boundary，redacted、metadata-only
  或 ambiguous 必须降级。空 Findings 只有在零 effective change、零未处置
  required obligation/verification gap 且五维 complete 时合法。
- ID、顺序和 semantic digest 按 canonical semantic input 确定，不依赖时间、
  摘要、resolution、Map 或文件系统遍历顺序。

### D-25：可重建 Task Baseline 与 final-tree Delta

状态：`accepted`（2026-07-30 Decision Amendment）

- strong `TaskManifest.baselineSnapshotId`、`task_baseline.captureSnapshotId`
  与 source Snapshot 均等于 Stage 1 current/evaluated Snapshot；Repo Pulse 的
  logical baseline 只作分析 provenance。legacy Task 保留旧解释但不能 strong
  Check。
- current Snapshot 先以 repository transaction 单独 immutable 提交；Task
  Stage 1 在 exact `TaskCreationBasisV1` 上原子提交 internal baseline
  descriptor、private blobs、Manifest、Event、Receipt、Journal 与 owner-only
  Basis Record，不把 repository-scoped Snapshot 塞入 Task transaction。
- clean tracked 内容由 exact HEAD object 重建；unborn repository 绑定
  canonical empty tree；dirty/untracked 最终可见内容写入 `0600` 私有 CAS。
  敏感、secret、binary、special、conflict、超预算或不可读内容按策略
  metadata-only；hard-deny/secret unit 不进入 path list，只保存 aggregate
  count + Boundary，不持久化 exact path、正文、fingerprint 或 raw content
  digest。`task_baseline` 为 internal-only Envelope；Host 只读 aggregate
  summary。
- private blob/marker/Basis Record/detail/history 统一 no-follow trusted I/O：owner UID/SID、
  目录0700、regular file0600、nlink=1；从 bound Store root解析并持续持有同一
  destination-parent authority；允许的 bound-root re-resolution只作非授权
  continuity observation。provider-private staging先 durable记录 binding，再
  写入/验证 payload；publish API只接受 exact opened staging handle、held
  parent authority与 final name，不接受 source path/name，并 fsync file与
  destination parent。每次 trusted read重验 provider binding/size/digest。
  symlink/reparse、hardlink、wrong owner/mode/type、corrupt或 parent/open/
  rename swap全部 fail closed，不覆盖/修复预置对象；device+inode/file ID复用
  不提供 rollback/delete authority，epoch-only binding禁止持久化；delete只
  允许 provider atomic handle-addressed compare-delete，否则保留并计费。
- 每个存在的 baseline HEAD 使用 immutable managed Git object lease；unborn
  repository 使用 canonical empty tree。lease 失败只可 partial/unpinned；
  lease 只在固定
  `refs/understand-code/task-baselines/<lease-hex22>-<marker-nonce-hex32>`
  namespace 以 `update-ref --no-deref` + zero-old-OID CAS 创建；逻辑
  `git-lease:<hex22>` 不能直接拼入 ref。nonce 在任何副作用前由 CSPRNG 生成并
  写入 durable marker，Git 显式指向 owner-only 空 hooks 目录，不能运行
  reference hook 或修改用户 ref/config/Index/Worktree。rebase 新建版本。
  committed baseline/blob/lease 与历史 projection 在 P0 永久保留；recovery
  只可在 marker nonce + exact ref/OID + 无 descriptor pin 同时成立时回收该
  transaction-owned uncommitted orphan，仅同 OID 不足以证明 ownership。
- Delta 状态代数固定为
  `B(final) → B0(baseline HEAD) → A0(actual HEAD) → A1(Index) → A(final)`；
  首段是 Delta-only `baseline_reconciliation`，其后为 committed、staged、
  unstaged/untracked/conflict，effective 直接比较 B→A。
- tracked clean 使用 commit/index canonical blob，unstaged/untracked 才读 raw
  worktree；autocrlf/encoding/LFS/filter/sparse 跨 domain 时 Boundary，禁止
  执行 filter/textconv/external diff。预算按确定性 work units 与 bytewise path
  分配，wall-clock/cancel 必须零写入。
- Git rename/copy detection 必须关闭；WP5 对完整 canonical add/delete 与
  retained-source 集合自行做受预算 exact OID/content join。Git score、
  threshold、limit、candidate 或配置不进入 lineage；非唯一/modified 配对稳定
  降级 delete+add + Boundary。
- `actualSnapshotId` 为必填精确断言；同 key replay，同 Snapshot 不同 key 在
  已有 canonical Check 后返回 `change_check_already_current`。Check descriptor
  直接依赖 baseline/actual Snapshot、task baseline、Brief、Evidence 和 Impact。
- digest-pinned historical baseline 使用 immutable-pin dependency，不因不是
  latest 自动传播 stale；缺失、损坏或 digest mismatch 仍失败。destructive
  reset 前归档 immutable Task projection，旧 Check dependency closure 保持可读。
- 旧 Diff Overlay、legacy diff analyzer、吞错 changed-file helper 与旧 cosmetic
  fingerprint 禁止进入生产证据链。

### D-26：Plan obligation 与 Verification execution

状态：`accepted`（2026-07-30 Decision Amendment）

- 新 Planned Change writer 必须保存
  `required_change / optional_change / inspect_only / verification_only`；
  legacy 缺失值不得追溯推断为 required 或产生 omission。
- `verification_gap` 只表示 Plan/Acceptance 覆盖设计：missing entry 只引用
  uncovered Claim，insufficient coverage 引用 Entry+Claim，unsupported/
  ambiguous 另需 Boundary；不表示记录尚未执行。
- P0 Verification Record method 必须精确等于 Plan method，不支持静默
  substitution。不同方法只能执行原 method、显式 accepted skip，或 supersede
  并创建新 Task；refresh 不是计划改写捷径。
- latest passed/accepted skipped Record 必须覆盖 Plan Entry 全部
  `acceptanceClaimIds` 才能满足 verified Gate；子集记录不丢弃，但不算完成。
- `recordVerification` 只记录外部执行结果，不执行调用方命令；attempt 与
  supersedes 必须形成同 Entry、同 Snapshot 的线性链。
- strong public Verification 只保存 method/status/attempt/Claim/Snapshot、
  fixed result code 与 owner-keyed detail commitment；禁止 private detail
  ID/content digest、command、summary、
  exit/duration/output/raw text。内部 detail 经 secret/Host-path scanner 后写入
  0700/0600 私有 ledger，raw output 永不持久化；legacy raw 只供 trusted
  validator/migration reader，所有 Surface/read_artifact/Receipt replay 只能
  返回固定 redacted view。public/private ledger/Event/Receipt/Journal 同事务；
  current/historical Record commitment 是 detail owner-only closure edge，
  committed detail 不随 projection cleanup 删除且 P0 不自动 GC。
- skipped strong Record 永不内嵌或后写 acceptance；授权 Action 只在同一 ledger
  追加独立 immutable `VerificationSkipAcceptanceRecordV1`，其 Actor/time/Event
  与 Action/Event exact-equal。每个 skipped current leaf 最多一个，Record/
  detail/content digest 保持不变；verified Gate 通过 ID join 校验唯一记录。
- `verification_required → in_progress` 只看当前 generation/Snapshot/Entry 的
  latest failed/blocked/flaky Record，并由该 Record ID 触发；旧失败在后续
  passed 后不能再次授权回退。

### D-27：精确 Repository Basis、Journal 与 CAS Operation 协议

状态：`accepted`（2026-07-30 Decision Amendment）

- `checkChanges / recordVerification / refreshTaskContext / rebaseTask` 统一执行
  `parse → authorize → sensitive-input scan + safe projection + owner-only
  equality tag → safe digest → trusted read → idempotency lookup → guard → exact
  basis → out-of-lock work → read-set validation → Store CAS`。
- authorization 先于 security key/private equality record、仓库读取与 Receipt
  返回；idempotency lookup 先于 revision/status guard。公开 `requestDigest`
  exact-equal safe projection digest；完整 input 只写 owner-only HMAC equality
  tag，same key 必须同时匹配两者，different Actor/payload/operation 零写入。
- Stage 1 单独使用 `TaskCreationBasisV1`，只 pin 已提交 current/evaluated
  source Snapshot、repository/worktree、HEAD/Index/Worktree/Untracked/ignore
  state 与 attributes/scanner/repository/baseline-budget/private-store-quota
  policy；Pulse、candidate baseline、
  lease/blob 都不是前置 pin。scan/plan 无副作用；Store 在任何 blob/lease 前
  durable/fsync marker，final commit 前再次验证完整 read set。
- 其余四类 Operation 使用 `RepositoryBasisV1`。Store 保持
  Task→Repository 锁序，在锁内重验 target Snapshot、Pulse、historical
  baseline/materialization 与 policy/read-set pins；read set 是逐项可重读的
  structured entries，不是 opaque token，必须覆盖完整 repository state
  enumeration，能发现此前未读 path 的新增/删除/rename。
- `build_task_brief` Stage 1/Stage 2 与
  `checkChanges/recordVerification/refreshTaskContext/rebaseTask` 六类 strong
  repository-reading transaction 成功时，同事务追加 owner-only
  immutable `RepositoryBasisRecordEnvelopeV1` 到独立 private basis ledger，
  不进入公开 Task Operation Journal/Artifact/read_artifact union；public
  Receipt/Check 只保存 basis record ID、record content digest、basis digest 与
  read-set digest，trusted read 从 fixed path 重算四者。committed Record 由
  append-only Receipt/Event/Check 保留且 P0 不自动 GC。rebase 的 resulting
  baseline 是 transaction output，full Basis 只 pin prior baseline，避免循环。
- Provider 在 commit 前设 final validation cut；cut 前 drift 零写入，cut 后
  外部变化不受 Store lock 控制，本次结果仍只绑定旧 Snapshot，后续 Snapshot
  使 Task stale。契约不声称消除所有外部写窗口，也不静默 retarget。
- Check 成功后保持 `check_required`；Finding 处置后才进入
  `verification_required`。Verification Record 成功后保持
  `verification_required`，直到 frozen verified Gate 满足。
- `check_required` 无 strong descriptor 时派生为 `awaiting_check`，存在唯一
  exact descriptor 时为 `check_review`；Manifest pointer 仍为空，只有
  check_review 可接受 Finding/离开状态，进入 verification_required 时设置。
- strong Manifest 从 created 保存 resolved `contextBuildSpec`；context_ready 后
  Manifest/Brief/Event 绑定同一个 generation。refresh/rebase Event 记录
  previous/resulting generation，confirmation 只对同代有效。
- refresh 保持 Task baseline；rebase 的 new baseline 必须等于 exact live
  target，不能从任意 historical dirty Snapshot 猜造。两者重建 Context，在
  reset 前归档 immutable projection，保留旧 Evidence/Impact/Check/Baseline
  closure 与 append-only Event/Receipt/Journal。
- refresh/rebase 保持 Receipt `operation=update_task`，request digest 包含
  action type 的 safe projection，完整 input 由 private HMAC 覆盖；
  Receipt/Event/capability 交叉一致。
- 新授权能力为 `task:check`、`task:verify`、
  `task:context:refresh`、`task:context:rebase`；WP5 全部验证关闭前维持
  capability lock。

### D-28：Alpha 单向兼容读取与 Strong Writer

状态：`accepted`（2026-07-30 Decision Amendment）

- `3.0.0-alpha.1` 新 reader 继续读取旧 V1；新 writer 只写 strong profile。
  `task_baseline` 是 Store internal-only managed descriptor/Envelope，不扩展
  公开 Artifact Type/MCP/read_artifact union；旧 binary 不保证理解新增
  strong 字段或内部 descriptor，不能声称双向兼容。
- 保留旧 reference fixture bytes，新增 evidence-backed/invalid fixtures；
  不猜造旧 Actual Change，不原地修改历史 digest/Event/Receipt。
- legacy Snapshot/Verification redacted view继续使用 generic `SnapshotId` 并
  原样接受既有 opaque wire value；`task_projection_history_v1`只由 strong Task
  产生，其 descriptor/edge/root/Envelope Snapshot pin全部必须是
  `PathSafeRepositorySnapshotIdV1`且 exact-equal，legacy Task不能用 History
  绕过显式 migration。
- 新 persisted field 禁止 parse-time default；结构 Schema 与跨 Artifact
  reference/coverage/digest/lifecycle invariant 分层校验。
- legacy Task 缺少 baseline 或 context build spec 时，strong
  Check/refresh/rebase fail closed，只能独立显式迁移，或 supersede 后创建新
  strong Task；普通 rebase 不是 migration。
- Beta 若要求旧 binary forward-read、稳定外部分发 `$id` 或跨版本原地升级，
  必须发布 V2 和 Store migration。

### D-29：公开持久化前置安全扫描与可恢复 private ownership

状态：`accepted`（2026-07-31 Decision Amendment）

- strong Repository Snapshot 只允许
  `repository_snapshot_path_safe_v1`：先在内存完成 hard-deny/path/content
  streaming scan，随后才发布。对 trusted source/kind 已能证明变化的隐藏单位，
  只写按 kind/source/boundary 聚合的 `redactedChanges`；不能证明 equality、因而
  也不能证明是否发生变化的单位，只写不含 source/kind 的 `unknownStates`，绝不
  伪造 `modified/committed/clean`。raw、candidate、safe、known-redacted、unknown
  的计数必须精确闭合，并与 Pulse/Completeness 等价。legacy Snapshot/Pulse
  lossless owner-only 可读但不能进入 strong Basis；所有非 owner Surface 只返回
  strict aggregate redacted DTO。new Pulse 只写 `repo_pulse_path_safe_v1`。
- mandatory security scan 与 Change Analysis Budget 分离；16 MiB/unit、
  256 MiB/capture 是版本化安全上限。scanner error 零写，明确超限才允许
  partial aggregate；unit/path-byte/depth cap 无法证明 universe 时必须零写。
  hard-deny candidate 只能按已证明语义进入 known-redacted 或
  equality-unprovable unknown，scan/digest/baseline/Hunk bytes使用同
  handle/stream；tracked/pre-existing `.understand-code` collision不覆盖。
- public repository/worktree/root identity 由 installation-global owner-only
  key 做 domain-separated HMAC。首次启用建立新 strong manifest namespace并
  重建 repository-scoped dependency，legacy namespace只读共存；active global
  state 后 key 丢失/损坏全局 fail closed，不能按当前仓库内容重生。platform
  runtime-state key 与 worktree binding 是冻结的 control-plane 例外。Store
  locator 必须由 OS API 解析：macOS User Domain Application Support；Linux
  `getpwuid_r(geteuid())` 的 account home 下 `.local/state/understand-code`；
  Windows `SHGetKnownFolderPath(FOLDERID_LocalAppData,current-user-token)`。
  不读取 `$HOME`/`XDG_STATE_HOME`/`LOCALAPPDATA`，也不回退到 cwd、temp 或
  workspace；绝对 owner-safe no-follow root、resolver/file identity 与 HMAC
  binding 必须在使用前后重验。
- Store 只有在 strict `.store-ownership-v1.json` 以 HMAC 绑定 installation、
  repository、worktree、root，并同时通过 owner/mode/nlink/durable binding/digest
  校验后才可使用。初始化先在 Store 外保存 durable preflight intent，再重验
  root absence；registry provider在 private staging取得 Store-root/marker
  durable binding后，才以 exact opened handle + held parent authority执行
  no-replace publish并 fsync。provider不能跨 restart重验 generation-aware token、
  不能 handle-publish或只支持 source-name rename时首副作用前拒绝。marker 是
  bootstrap structural state，受独立 total/count/
  single-file cap 且明确排除 quota Merkle universe。external intent必须在
  marker与 genesis的任何物理写前分别 durable保存
  `marker_planned/genesis_planned` exact write set；后续
  `identity_planned/activation_planned/terminalization` 使用同一协议。所有
  staging object位于普通进程不可列举的 provider-private namespace；nested
  parent由 topological directory plan按0700 staging→binding→handle-addressed
  no-replace publish→final binding建立；跨 phase复用必须 pin exact
  path/binding/owner/mode/source-plan/`sourceDirectoryOrdinal` proof并满足
  `dirname(finalPath)===parent.path`。每个 attempt持续持有同一
  destination-parent authority；provider必须在 namespace mutation的同一原子
  commit内验证 bound-root containment，以及 relative components与
  root→parent ancestor bindings逐项 exact-equal；parent/ancestor即使仍在同一
  root内 rename/reparent/exchange也必须 not-committed。bound-root
  re-resolution只作 continuity observation，不能授权 replacement parent。
  not-committed exact signed receipt必须进入 attempt/quarantine并按六 reason总映射：
  final collision→fatal；三个 root/parent/path reason→每次 online
  containment revalidation后 retry；staging authority change→new attempt；
  policy change→migration。只有两个 retry分支可追加 ordinal+1，
  fatal/migration无 successor；同 operation nonce跨 restart结果/receipt
  byte-identical。file先 durable
  `temp_planned` provider locator，创建0-byte private staging object并进入
  `temp_identity_recorded`，写入 exact canonical payload、fsync并验证后进入
  `temp_payload_verified`；publish API只收 exact opened staging handle、held
  parent authority与 final name，不收 source pathname/name，最后进入
  `final_identity_verified`。unsupported时 fail closed，禁止普通
  rename/link/path fallback或 exact-existing Manifest CAS。identity前 provider
  crash不产生 pathname；final collision/provider mismatch才进入 bounded
  quarantine，race winner从不移动/覆盖/name-delete。所有 persisted binding
  必须可跨 restart重验，device+inode/file ID、btime/ctime、bytes、digest或
  HMAC不能降级授权；delete必须先持久化 planned request/record并由 quota
  Transition root，再执行 provider atomic compare-delete，resolved record
  durable后才移除 ownership；否则保留。
  ledger连续重试必须保留全部
  generation plan/progress并 pin独立 domain的 pre-ledger
  `binding_activated` intent digest；generation只允许1～4，第4代可完成，第5代
  在任何新副作用前零写 fail closed。
  identity plan保存 sealed equality key（不保存 raw key）、Binding Intent、
  bootstrap Transition、quota nodes/root与 post Manifest的可重建 canonical
  preimage及 pre/post root/head；摘要按 context→pre-seal skeleton→AEAD→final
  write set→plan token无环生成，digest-only/fixed-point plan reject。首个
  `identity_bootstrap` Transition不发布 active binding；full strong Bundle
  durable后必须先保存 activation plan，再由 `identity_activation`发布 active
  binding、移除 Intent leaf并 exact pin既有 full Manifest。所有 write均
  `final_identity_verified`后只可进入 recovery-only `binding_activated`，不能
  清除 intent或开放 strong Surface。preflight必须在 Store-root/provider
  allocation前执行 zero-side-effect full dry-run；external intent、独立
  receipt、最大单 handoff record、完整 handoff journal四项 worst-case各
  ≤64 MiB且 record count≤4096，否则零写拒绝。external intent先冻结完整
  receipt preimage/content digest及 receipt/handoff-genesis两个 deterministic
  allocation plan，进入 `terminalization_allocations_planned`；两项只允许
  AA→SA/AS→SS，crash后仅从 current provider state按同 locator重开 exact
  object，禁止读取历史 revision或重分配。只有 SS 可进入
  `terminalization_planned`且 receipt bytes不变。provider no-replace发布
  genesis full plan/progress及 receipt，后续 progress只追加一个 single-delta
  immutable handoff record。每条 successor必须从 current unique tip按
  `directory < write`、再按 ordinal的 fixed scheduler唯一导出 target/delta、
  deterministic attempt nonce、staging locator及 record ID/locator；相同 tip的
  并发 writer必须重开同一对象，不能产生 loser orphan或 sibling，且每条
  successor的 allocation/payload/publish/append crash cut均可幂等恢复。
  proof-only record必须为唯一 terminal tip。第三个
  `store_initialization_terminalize` Transition把 terminal head写入新的
  immutable append-only Manifest generation。每代 Manifest只向 absent path
  发布并 exact pin predecessor，reader必须得到 unique maximal tip；sibling
  tips fail closed。provider在同一 atomic final cut中 compare unique proof tip/
  journal version、seal journal并把 external intent永久 retained为
  `terminalized`。只有
  `active binding → unique Manifest tip → terminal head → retained receipt →
  optional exact ledger`全链及 sealed journal token通过才开放 strong
  namespace；每次 Surface授权重验同一 token，后续 generation原样继承 head。
  legacy migration必须显式授权、allowlist enumeration，且
  token/authorization贯穿相同 post-marker、ledger、receipt、handoff、
  terminalization和 terminalized phases；crash、foreign、ambiguous或 unknown
  entry均不得被采用、删除或覆盖。
- Git subprocess 统一由 filesystem-only bootstrap + SafeGit adapter 执行；
  linked worktree 双向 backpointer、fixed env/argv/config parser、local ODB
  only，禁 hook/fsmonitor/filter/external diff/alternate/promisor/replace/lazy
  fetch。Git executable 必须以 pinned no-follow handle/identity 打开并在启动前后
  重验，使用 `fexecve`/平台等价 handle execution；平台无此能力时只允许签名且
  由管理员维护的 immutable binary。sandbox 默认 deny network 与任意 child，
  只放行 pinned Git/loader、预算内 read handle；写入只允许 `update-ref` 的 exact
  product ref/lock，reflog 永久 write-deny。stdin 默认关闭，只有 `hash-object`
  可收 blob 16 MiB/tree 64 MiB；stdout、stderr、parsed-record 数量、wall deadline
  与 zero-lock timeout 均为版本化 cap。RSS/address-space/CPU/PID/FD 也必须由
  rlimit/cgroup/Mach/Windows Job Object 平台等价机制在 exec 前对完整
  containment 强制并进入 profile digest；无法可靠安装/回读限制的平台对 strong
  capability fail closed，hostile pack/object graph 不得 OOM Host。
  timeout/resource-cap/cancel 必须终止完整 process group / Job Object，并在
  250 ms 后 hard-kill；`update-ref` 结果不确定时保留 marker，
  仅按 exact ref/OID/reflog/lock CAS recovery。resolved profile digest 进入
  Snapshot/Pulse/Basis；reftable/缺 local object 只能 partial/unpinned且无网络。
- public `requestDigest` 只等于 strict safe request projection digest；完整
  parsed input 使用 owner-only security key 的 domain-separated HMAC，并与
  Event/Receipt/Journal 原子保存 private equality record。same-key replay 两者
  都必须匹配，transient command/summary/raw output 不得进入 raw SHA。request
  policy caps 超限零写。public Verification stored detail 只保存 semantic
  commitment，绑定 Task/generation/Snapshot/Plan Entry/attempt 与 sanitized private
  detail semantic digest，排除 Record/detail ID、时间、private content digest；
  完整 canonical public detail 进入 Verification Record ID。redacted detail 只能
  保存 sorted/unique 的固定 code：`secret_detected`、`host_path_detected`、
  `control_character`、`invalid_utf8`，不得引用不存在的 Boundary ledger 或保存
  hit text；任何 public Surface 均不得泄露 private ID/digest。
- shared private CAS writer/deduper 在释放 Repository lock 前创建 durable
  reservation；rollback/GC 同时验证 current/history descriptor 与其他 active
  reservation/marker，不能按同 digest/OID 猜测删除。
- deterministic baseline Budget、blob/active/temp logical quota、metadata quota
  与真实 durable I/O failure 使用不同结果：前两类可以 metadata-only partial；
  metadata admission 或 ENOSPC/fsync/write 失败整次零写。quota leaf 只包含
  category/key/record kind/logical size/owners digest，不包含 payload/content digest
  或 post-root digest；reservation membership 按 count 收费，active blob
  entitlement 按 unique bytes 收费，bytes/count/structural caps 独立核算，形成
  cycle-free Merkle accounting。category↔record kind使用 strict判别联合：
  committed metadata只接受 metadata/history/quota-journal类，control只接受
  marker/reservation/binding/security-key类，active metadata排除 blob/control，
  active temp只接受 blob或 metadata类；valid key/size下错误交叉也必须 Schema
  reject，生成的 wire Schema必须展开 category-specific atomic `oneOf`。
  root slot到 wire category的唯一映射固定为
  `committedBlobs→committed_blobs`、`committedMetadata→committed_metadata`、
  `reservationMembership→reservation_membership`、
  `activeBlobEntitlements→active_blob_entitlements`、
  `activeMetadataPlans→active_metadata_plans`、
  `activeTempPlans→active_temp_plans`、`controlState→control_state`；
  root property/node/child/leaf/delta category必须按映射全链 exact-equal并由七个
  category-correlated `oneOf`表达；`canonical-btree-256-v1` 固定 delta顺序，absent key每层选择
  首个 `child.lastKey>=key`（否则最右 child），并固定
  split/borrow/merge/root-collapse；`put k0001…k0257→remove k0129→put
  k0129`必须回到
  byte-identical root，使同 genesis + Transition chain重放唯一。reject前做
  无副作用 preflight，final cut必须以 latest
  root/head 重新 admission。每个 active transaction 还必须预留下一
  ordinal 的 rollback 与 recovery 两个互斥 Transition 候选的 worst-case
  bytes/count；self-metered record
  仅做 bounded fixed-width size 收敛，payload/content/root digest 永不进入自身
  leaf，因此不存在 hash fixed point。
- 每次 quota root change（reservation、phase、commit、rollback、recovery）都在
  同一 Repository lock 内追加 owner-only `PrivateStoreQuotaTransitionRecordV1`。
  Store Manifest 固定保存 genesis、current root 与 Transition head，并由
  provider在一个事务 compare expected-root/head/version、发布 immutable
  generation并推进 authenticated unique head；每条 Transition 的 previous pair、pre/post root
  与 delta 必须连续，审计先从 head 反向到 genesis，再正向 replay。旧且不可达
  的 structural nodes 可以 GC，但 quota-counted Transition chain 在 P0 不可
  删改/压缩。genesis 只由 policy 与七类 typed empty-root constant 构造，所有
  category count/bytes 和 active transaction count 均为零；ownership marker、
  genesis node/root 与 Store Manifest 由独立 bootstrap/structural caps 约束，
  不对自身计费。Admission 只为
  accepted commit 创建，并且只 pin 该 commit Transition 及 accepted/rejected
  结论；Baseline/Basis 不得反向引用 quota。Receipt/Journal/Task Manifest 的 proof
  必须闭合 Admission↔Transition↔roots↔delta。Admission/Transition stable ID分别
  使用 cycle-free identity domain，Envelope content digest则使用不同的完整 strict
  full-record domain；顺序固定为 stable IDs/size收敛→delta/post-root→Transition
  full digest→Admission写入 exact Transition pin→Admission full digest→next
  Manifest，stable-ID digest不得替代 content digest，outer/payload字段必须闭合。
  startup/recovery/audit 做 full audit，
  maintenance 也必须在 final cut 重验 generation/root/head。
- Git lease command 强制关闭 reflog 创建并使用已验证空 hooks 目录；product
  ref/reflog create 前均不存在；任意 reflog 都永不由 recovery 删除或截断，
  race/interference 只回滚 exact ref 并阻断 capability 等待人工审计；
  pre-existing/race ref lock 同样永不删除或覆盖。
- Context generation 使用可重算 immutable Record，并执行 exact cardinality：
  target Snapshot 与 evaluated Pulse 各恰好一个；context-build、repository、
  scanner、safe-git policy 各恰好一个；Graph/Wiki/source Evidence 各自恰好一个
  present pin 或固定 absence。所有 present source snapshot 必须等于 target，
  Envelope source/revision 必须等于 target/resulting revision；首次 generation
  不得有 previous，refresh/rebase 必须 pin 旧 Manifest generation。缺失、重复或
  foreign pin 一律拒绝。
- History 是与 current Task projection 平行的独立 immutable root；new root 不得
  包含、复制、依赖或包裹任何 `task_projection_history` descriptor。每个 History
  root 的 owner-only closure 独立包含 Basis/request equality/detail/quota
  Admission 及其 commit Transition/blob/lease；其余 quota Transition 由 global
  Manifest chain 保留。active reservation/marker 只作 global temporary root。

### D-30：Durable Object Provider Feasibility Gate

状态：`accepted`（2026-07-31 Decision Amendment）

2026-08-02 implementation pre-freeze amendment：尚无 WP5 Provider v1 wire
artifact/golden/reader对外发布，故终审在实现前原位替换未落地的 v1：
real-FS新增独立签名 Suite/Fixture Corpus full-content closure；distribution改用
Envelope+embedded-Bundle typed retained-object accounting；migration quota新增
typed source dry-run/full candidate Plan reservation binding及精确 final receipt/
universe-side selector，并补齐 admission-vector/mode/final Plan binding；Private
Store补齐七项 root-category映射与
Admission/Transition full-record digest domain。严格 type/domain/locator/vector以
WP5 Matrix为准；一旦 wire bytes发布，后续变更必须显式升版。

- Provider不是现有 pathname writer的接口别名。P0必须交付 workspace writer
  无法进入的独立 OS principal或经过证明的 kernel-isolated storage domain，
  exact-object API、atomic root + logical path projection containment、external
  state CAS、Store Manifest generation+unique-head原子 compare-append、
  append-only handoff journal/seal与 compare-delete-or-disabled。所有 C09 stable
  ID/digest/HMAC/signature message使用冻结的 RFC 8785/JCS exact UTF-8 bytes：
  strict Schema、无 BOM、safe integer-only、禁止 float/`-0`/NaN/Infinity，
  字符串不做 Unicode normalization；Provider ID body是1..64 bytes canonical
  lower-ASCII slug，首尾标点、连续点、upper/non-ASCII与超长值均拒绝。
  Ed25519唯一 message是 `JCS([domainLiteral,signerWrapper])`，root wrapper内外
  domain必须相等，只签 wrapper/claims或`[domainLiteral,claims]`拒绝。只有 producer
  的 pre-schema无序 collection可排序后获得 permutation-invariant bytes；signed
  wire array乱序必须 reject，verifier不得修复。
- immutable Installation Identity只从 signed-package fixed locator接受完整
  Bootstrap Trust Bundle：其 exact pin/Envelope/payload固定 strict crypto
  capability/manifest、bootstrap registry-root、bootstrap Root Metadata、三把
  互异 offline recovery key与2-of-3 threshold；Identity同时保留 origin
  distribution binding、Bundle与manifest完整 Envelope，并 pin含
  Root/Registry/Catalog/Acceptance generation、Acceptance
  receipt、provider/approver/binding history与累计 canonical bytes hard cap及
  emergency reserve的 `ProviderTrustHistoryPolicyV1`。可升级 configuration只
  存在于 Provider Acceptance append-only
  chain；installation-state provider在同一事务发布 generation、更新
  authenticated complete enumeration、CAS high-water与按 operation nonce固定
  定位的 compact immutable receipt，原子 pin active Root
  Metadata、完整 root-signed Registry Manifest、Support Catalog与 target active
  writer，不能留下 loser sibling。planned
  rollover要求 old-root cross + new-root self + 2-of-3 recovery；compromise
  recovery要求 new-root self + quorum并进入 `recovery_only`关闭 strong Surface。
  任一 recovery key compromise要求新签名发行物/new Bundle建立新 Installation
  Identity并显式迁移既有 Store，不能原地换 key或用旧剩余 quorum恢复写入；
  old recovery-only source只由 retained old Bundle/manifest验证，new Bundle不得
  替换 historical trust或授权 old write。
  Registry successor必须保留 sorted enabled member或永久 tombstone，双-provider
  migration过渡代同时 enabled old/new，并以 `migration_only` Registry routing、
  Catalog candidates、cycle-free plan与专用 executor闭合。Plan按 same Identity/
  cross-installation rebootstrap strict union pin双方 pre-plan
  Identity/Acceptance/Root/Registry/Catalog/selector/Store cut、source/
  destination双 namespace identity与双方 translation authorization；source
  current/historical和 destination candidate writer使用 executor-only strict
  authorization union。executor通过独立 root/object/reference/receipt set
  domain、bounded complete live-reference universe、per-object receipts、
  zero-live proof、permanent tombstone、ready record与 sealed progress head推进；
  progress receipt set必须能表示empty与partial contiguous prefix，只有
  zero-live/ready/sealed/final closure才要求 exact-cover source object set。
  cross mode无论 reference edge是否为空都必须 exact pin versioned canonical
  Rewrite Plan；每个 Object Mapping的 reference子集以独立 domain固定
  count/digest/bytes，object proof逐 slot exact-cover。destination universe后还必须
  重建 exact-cover全部 root/root edge并验证逐根 non-reference equality的 Root
  Rewrite Proof Set，zero-edge不得退化为 `not_required`。Plan/object proof无反向
  receipt引用；Canonical Rewrite Plan、Semantic Equivalence Proof与 Zero-live
  Proof三个 exact size projection分别使用独立 domain并排除自身及后续 auth。
  Object Receipt、Zero-live Proof、Progress Head/Version与 Progress Operation
  Receipt四类 HMAC issuer只取 trusted Plan journal authority，不能以opaque digest
  或 source key替代。final
  strong-ready Acceptance只单向 pin seal。普通升级不改 Installation Identity/
  Store marker，downgrade不得降低 accepted generation。
- Installation Identity的 immutable `ProviderTrustHistoryPolicyV1`宪法通过独立
  `migrationHistoryQuotaPolicy`字段携带
  `ProviderMigrationHistoryQuotaPolicyV1`，并另行 pin authenticated quota
  high-water fixed locator；migration accounting ledger与 trust/key/Acceptance
  history的计数、bytes和 event/receipt不混用，也不借用 Private Store quota。same
  Identity在首个
  migration副作用前必须形成 typed source dry-run cut，绑定 authenticated source
  trust/Manifest/freeze token、complete-set claims、ordered artifact upper bounds、
  budgets与 derived charges；artifact upper bounds按 UTF-8顺序 exact-cover全部
  11种 kind且零项不可省略。cut→sizing→admission→migration ID→descriptors→Plan
  digest无环；完整 admission digest是所有 descriptor/record/request projection
  唯一复用的 `admissionVectorDigest`，禁止单 charge digest。Plan Envelope是
  mode↔payload strict union，same reserve只接 same Plan，cross reserve/activate只接
  cross Plan，内部 sizing/cut/admission/reservation mode逐层一致。三个 reserve
  branch都携带完整 candidate Plan，reservation record/token
  单向绑定 Plan digest。same Identity以单事务 reserve+发布 Plan；cross Identity不
  宣称跨 provider全局原子，而是 destination在线重验同一 Plan后 intent预留完整
  quota/terminal escrow→source以同一 Plan写 provisional anchor→destination验证两份
  reservation Plan digest相同并以同一 account CAS原子 activate+发布 Plan；
  activate与 cancel竞争同一 expected intent transition，关闭 absent-read
  TOCTOU。V1 pending intent只持久化 Plan digest；崩溃后只允许 exact Plan重传继续，
  无法重传时只允许 authenticated cancel/release，禁止扫描或凭裸 digest重建。
  quota reservation、reserve request、reserved event与 reserved account
  必须以判别联合关闭 role↔charge↔publication↔plan-state，跨支组合在 Schema阶段
  拒绝；activate必须原子替换 destination pending→published account，后续
  commit/release的 role↔operation-kind及 source保存的 destination committed receipt
  selector也必须逐支相关，生成的 wire Schema必须展开为 atomic `oneOf`而非宽化
  union。source保存的 destination commit、intent cancellation与 retained release
  receipt pin必须分别从 loaded full receipt durable projection重算
  `migrationId/destination reservationId/migrationPlanContentDigest`、
  `migrationId/destination reservationId/candidatePlanContentDigest`与
  `migrationId/destination reservationId/migrationPlanContentDigest`，receipt ledger
  generation还必须对应 destination descriptor Identity。source event/request自身的
  reservation ID保持 source role，counterpart binding明确使用 destination
  reservation ID。cancellation binding须与 source reservation、destination
  intent/reservation、permanent fence四方闭合，故完整 Plan丢失仍可安全释放
  provisional；retained release binding须与 source committed event保存的
  destination commit闭合；后者已在 source commit时与当时可解析的 published Plan
  destination descriptor闭合。destination release必须在删除 Plan前把该 closure固化
  进 full receipt，随后 source不得重载已合法删除的 Plan，只能从 authenticated source
  commit event与 destination commit/release receipt继承 closure。cross-migration、
  wrong destination reservation与 same-migration/wrong candidate/published Plan digest
  receipt全部拒绝。quota receipt `requestContentDigest`只覆盖完整 strict
  request；同 nonce但完整 candidate Plan/Plan/proof/counterpart pin任一不同必须
  `operation_nonce_request_mismatch`且零写。commit只结算未用 reservation，actual
  retained在
  同 Identity内单调计费；final Acceptance只接受 mode-specific exact committed
  receipt tuple（same retained commit，或 cross destination retained + source anchor
  commit），pin selector/outcome/nonce/digest/token与 loaded receipt逐字段闭合，
  并携带 exact-equal loaded Plan/对应 descriptor的
  `migrationId/reservationId/migrationPlanContentDigest`；Plan mode与 receipt-set
  mode相关，cross source保存的 destination receipt与 final destination receipt
  byte-identical且两侧不可互换。retained artifact set强制
  `source_universe↔side=source`、`destination_universe↔side=destination`。
  release只允许旧 Identity退休后，在 Acceptance/Store/audit完整零引用 proof与
  provider-authenticated exact deletion receipt同一事务成立时执行；quota event/
  receipt只保存 non-resolving audit commitment，不反向成为待删除 closure的 live
  resolver root。
- runtime attestation、verification public-key和 binding generation records均由
  active root签名。operation/containment/state/journal key按 usage隔离并保留
  historical verifier；root/recovery/provider/approver key ID进入 signed
  wrapper并从 exact public bytes重算，跨 identity/usage/role alias禁止。
  compromise revocation立即 fail closed；binding generation普通升级不得变化，
  换代只允许显式 dual-provider migration。每个 trust successor必须在首个
  signature/no-replace前 canonicalize完整 retained verifier closure并做
  count/byte admission；provider-scoped cap耗尽走 dual-provider migration，
  identity-wide cap耗尽走新签名发行物与 cross-installation rebootstrap，不能删除
  历史 verifier或复制 key alias绕过。
- macOS/Linux每个签名 OS/filesystem/mount target profile必须以真实 APFS/ext4等目标环境
  通过 crash、ABA、directory publish、root内 rename/reparent/exchange、
  external CAS、journal seal和 install/upgrade/downgrade/uninstall E2E后才可
  注册 production capability，且当前物理 volume runtime必须 exact-match该
  profile；Evidence/公开输出不固化 volume UUID/path。mock与 stock same-UID
  rename/link/unlink adapter不足以关闭 Gate。
- Gate以 owner-only strict `ProviderFeasibilityEvidenceV1`关闭：固定
  provider/policy/runtime、脱敏 OS family/build/arch与 filesystem/mount/
  isolation/IPC profile、
  suite/fixture/runner/crash-cut digest与 result，由独立 QA/Release key双签，
  registry以 fixed locator profile pin evidence ID+content digest。real-FS source
  closure必须先生成各自独立 root-signed、只按 full Envelope content digest定位的
  Fixture Corpus与 Suite Manifest；signature先按不含 signature的 claims生成，
  Envelope content digest随后覆盖包含 exact signature的完整 signed payload。
  Suite单向 pin Corpus，Corpus record、Case ID与
  hashed Crash Cut ID都有 strict preimage。随后生成 fixed-locator strict
  `ProviderRealFilesystemConformanceResultV1`：纳入 exact Discovery Result/
  Input Bundle与 Suite Pin，且 Result Suite Pin必须 byte-identical
  Discovery→Bundle→Fixture payload所 pin对象；required
  `{caseId,crashCutId}` exact-cover、outcome/code/aggregate总函数、ID/content
  digest可重算。构造顺序为 Corpus→Suite→Discovery Result→result bundle→runtime
  attestation/content digest→
  Evidence→Catalog/Registry；Evidence exact pin result ID/digest并复制 target/
  suite/fixture/runner/crash/result，runtime只 pin同一 result content digest，
  不反向 pin Evidence。reader按 ID读取并验证 pin/Envelope/payload三方，不扫描目录。
  公开支持矩阵的唯一权威输入是 registry-root按独立 domain签名、
  generation/predecessor连续，并由 current
  `ProviderAcceptanceStateV1(strong_ready)`经 Catalog exact pin的 Public
  Taxonomy、Release Target Universe与 owner-only strict
  `ProviderFeasibilitySupportCatalogEnvelopeV1`闭包；Public Taxonomy、
  Release Matrix、Target Discovery Result、Release Target Universe与 Catalog
  五者只从签名发行物
  canonical generation fixed locator读取，pin/outer/payload generation与 digest
  必须相等，并 exact复制 host verified
  `ProviderSignedDistributionRootBindingV1`。五条 chain各最多4096代，单 object最多
  16 MiB，完整 reachable retained closure累计最多512 MiB且最多65536个 retained
  object；closure必须 streaming遍历五链、每代内嵌 Bundle及其传递 pin的
  Fixture/Runner/Suite/Corpus Envelope。Envelope以
  `{binding,typed locator,contentDigest}`去重并计 object/bytes，embedded Bundle以
  `{binding,parentDiscoveryContentDigest,bundleContentDigest}`计 object但 incremental
  logical bytes为0；所有 object在 materialize前先做16 MiB cap，512 MiB只计 unique
  Envelope。40960是 schema可达 E2E，65536/65537是独立 accumulator synthetic
  boundary；超限保留上一 verified
  distribution。Taxonomy code只能由非敏感 canonical OS-family/filesystem descriptor
  生成，private build/feature/mount变化不得换 code；Universe coverage basis必须
  exact pin同一 distribution root签名的 Release Matrix与 Target Discovery
  Result。Discovery Result必须嵌入独立 root-signed Input Bundle，exact pin本代
  Matrix、fixture manifest、runner instance/profile/version/implementation/run
  manifest及 release observation cut；Matrix observations只能由有序
  `targets[i]`投影为 ordinal `i` resolved record，三个 source artifact digest必须
  exact取对应完整 Envelope content digest，Fixture/Suite/Corpus fixed locator只接受
  包含 signature的完整 content digest而非可跨 release复用的 semantic digest；
  Fixture pin/payload exact pin Suite，Suite exact pin Corpus，Pin冗余 semantic
  digest必须与 resolved payload闭合。Result只能从
  complete observations deterministic projection得到。C09-1G 已证明 Matrix targets
  是 Discovery targets的 exact-byte subset，因此 Universe targets必须 exact-equal最多4096项的
  Discovery targets；supplied Universe自身继续受4096项 strict cap。只有两集合
  相等且 unresolved typed empty才 complete，否则按固定优先级派生单一全局 reason
  并令全部 buckets incomplete/read-only。Catalog必须逐 target exact-cover Universe。
  完整七字段 target先重算
  `ProviderTargetProfileIdV1`，catalog按 target profile分组、组内按 provider列
  candidates，因此 migration期 old/new可同组并存。candidate显式列出
  passed/failed/unsupported Evidence pin、exact policy/runtime与 root-signed
  release disposition；catalog顶层保存完整 root-signed approver-key
  history/revocations，enabled registry必须 exact复制。public capability按同组
  全部有效 candidates确定性聚合；strong只允许至少一个 passed+strong candidate，
  failed/unsupported只允许 read-only，Release保守关闭必须把全组标为
  read-only。Universe target omission/substitution、bucket partition或 coverage
  basis不闭合、unknown/noncanonical code、duplicate target/profile candidate、
  catalog rollback/fork与 entry digest错配均 fail closed；公开 DTO不复制内部
  target ID或 build/feature/mount digest，只按 platform/family/arch/filesystem
  code重算 public ID，只有 coverage complete且同 public bucket全部 covered
  target strong才输出 strong，incomplete或任一 read-only均保守 read-only。
  公开行禁止内部 group数量/顺序、volume UUID/path、username、endpoint、
  provider/catalog/evidence digest或 signer key，且不授权 I/O。本机 registry
  missing/invalid时 mutation仍 `provider_unavailable`零写。
- Result/Evidence重复的 provider/policy/implementation/binary/target七字段/
  suite/fixture/runner/crash/result，runtime/Evidence的 platform/profile，
  policy/Evidence的 isolation/IPC/suite与三方 result digest必须 exact-equal。
  每个 Catalog candidate的 Result Discovery/Input Bundle/Suite Pin必须
  byte-identical回接 Universe→Discovery→Bundle→Fixture retained closure；
  signature替换必须改变 Suite/Corpus signed-payload locator，同 semantic digest的
  另一份合法 signed Suite/Corpus替换也必须拒绝。
  Catalog/Registry runtime pin必须 byte-identical，unsigned runtime digest必须
  exact-equal Evidence runtime digest；IPC endpoint attestation digest、
  attestation generation或 issuedAt任一 signed-but-mismatched组合都按
  `attestation_invalid`在首个 strong副作用前零写拒绝。
  D-38只收窄C09-1O structure-only success输入，不放宽该等式；multi-target
  Distribution Catalog继续是合法release coverage但不能直接充当本机authority。
- atomic publish的六个 not-committed reason必须由 signed receipt exact绑定并
  作为单一 strict failure union总映射为 fatal、containment-revalidate retry、
  new-attempt retry或 migration；reason/directive/successor不能独立组合，
  fatal/migration无 successor，同 nonce跨 restart只返回 byte-identical durable
  result。receipt保存完整 durable request projection/final binding/proof，但
  broker epoch/handle nonce只存在于 transient companion/reopen authority；
  Store-root、receipt、genesis、Manifest及普通 file/directory都使用同一 outcome
  union。Pulse/Artifact/Store canonical pin保存可重建 claims的完整 receipt/proof
  signed Envelope，不能只存裸 token。Acceptance与 Store Manifest compare-append
  同 nonce同 request返回原 receipt，同 nonce异 request结构化拒绝；receipt只保存
  本次 head/high-water+entry而非累计 enumeration。Store receipt固定在
  provider-isolated append-only semantic ledger，policy-bound count/byte
  admission必须在首个 candidate副作用前完成；ledger不进入正在提交的 Private
  Store quota root但必须进入 migration live-reference closure。Acceptance receipt
  与 trust/key history同样受 immutable count/byte/emergency policy约束，existing
  nonce replay不受新 admission拒绝。compare-delete的
  `delete_disabled`不得在 durable progress/pin中丢失。
- WP5-1P由 Platform/Security Lead负责，Contracts/Core + Provider/Systems实现，
  QA/Security与独立 Implementability复核，预算6～8 person-weeks；它独立于
  WP1 shared foundations与 WP3P runtime预算。WP3P由 Platform/Security Lead负责，
  预算10～14 person-weeks，阻塞 WP3 strong
  writer、WP5 strong mutation和 WP8 P0 Release Gate。未通过 target只可
  legacy/redacted read-only，不能创建或更新 strong Task。
- Tool Error固定为 `code=provider_unavailable`，reason只允许
  `unavailable/unsupported_filesystem_profile/attestation_invalid/revoked/
  migration_required/initialization_not_terminalized`。公开 Envelope不得含
  locator、IPC endpoint、path、owner、key ID或 raw attestation；WP8 CLI
  `understand-code doctor --provider`不是新增 MCP Tool。

### D-31：严格 Ed25519 与不可变 Bootstrap Trust Bundle

状态：`accepted`（2026-08-02 Decision Amendment）

- 四类 key record的 `publicKeyDigest`只按 canonical base64url decoded exact
  raw32计算 SHA-256，独立于各用途 domain-separated JCS key ID。既有 C09-0
  `00..1f` root key-ID golden保持 byte-identical；该 material是 mixed-order，
  只可验证旧 ID derivation，在 Bundle/trust admission必须拒绝。
- 所有 C09签名固定为
  `ed25519-rfc8032-cofactorless-prime-subgroup-v1`：exact 32/64 bytes、`S<L`、
  canonical且 non-identity的 `A/R`、完整 Edwards25519群上不先约化 scalar/
  不 clear cofactor的 `[L]P=identity`、PureEd25519与未批处理 cofactorless
  equation。ctx/ph/prehash、small-order/torsion/mixed-order及宽松 native
  acceptance全部拒绝；signer deterministic，retry回放首次 signature。
- host必须从 fixed
  `provider/ed25519-strict-host-conformance-v1.json`运行 exact-cover 28-case
  immutable manifest；每项独立携带 public-key point、signature `R` point与完整
  signature expected结果，runner固定执行56次 point admission + 28次 verify，
  point validator恒 true/false或与 verify分叉都失败。通过后才返回不可替换的
  opaque capability；后续 verifier只接
  raw32，不接受裸 host/caller manifest/PEM/DER/JWK。Node/OpenSSL adapter若内部
  构造 SPKI，只允许 RFC 8410 `id-Ed25519`、parameters absent、BIT STRING exact
  raw32。任一 KAT/profile/method/digest分歧在读取 Root chain前
  `attestation_invalid`且零 strong write。
- fixed `provider/bootstrap-trust-bundle-v1.json`唯一承载 strict capability/
  manifest Pin、bootstrap root、完整 bootstrap Root Metadata、sorted 3 recovery
  keys、2-of-3 threshold与 trust-history policy。两个 fixed resources各 exact-one、
  独立4 MiB pre-materialize、永久保留，且不进入五条 distribution history的
  40960/512 MiB accounting。signed distribution与 Installation Identity都 pin
  Bundle；Identity还保留 origin binding及完整 Bundle/manifest Envelope。
- recovery compromise后的 new package/new Bundle只建立 new Identity。old
  recovery-only Identity迁移只能用 retained old trust做 read-only source；
  missing/mismatch时 fail closed，禁止用 current Bundle回填。

完整 types、digest domains、case IDs、dangerous regression bytes、host启动顺序、
AT-C31与AT-Q33以 WP5 Matrix为唯一规范。D-31不改变 D-21 Lifecycle；它关闭的是
签名接受集合、bootstrap发行物与 historical verifier边界，任何后续放宽必须显式
升版。

### D-32～D-36：Provider point closure 分层冻结

状态：`accepted`（2026-08-03～2026-08-06 Decision Amendments）

- D-32把 C09-1G冻结为 signed Target Discovery point：Taxonomy、Matrix、Input
  Bundle与 Discovery Result使用 supplied active registry root的独立 signature
  domain，成功 authority仅为`none_target_discovery_point_structure_only`，不证明
  history/current、Universe或真实 I/O。
- D-33把 C09-1H冻结为完整 C09-1G raw request→unsigned real-FS Conformance Result
  Envelope point：Result没有第七签名，target membership、Discovery/Bundle/Suite Pin、
  case-cut exact-cover、aggregate、ID/content digest及 Locator等式全部可重算，authority
  仅为`none_real_fs_conformance_result_structure_only`。
- D-34把 C09-1I冻结为16字段 raw input上的 Result→strict semantic Policy→root-signed
  Runtime Attestation Pin point：复用一次 C09-1H diagnostic，重算 Policy/Filesystem/
  Runtime digest，关闭 provider/policy/implementation/binary/target/Result等式；成功
  路径固定1次 active-root point admission与7次 signature verification，authority仅为
  `none_provider_runtime_attestation_structure_only`。它不证明 runtime在线、current
  generation、真实 volume/IPC、QA/Release Evidence、Catalog/Registry/Acceptance或 I/O。
- D-35把 C09-1J冻结为20字段 raw input上的 Runtime→Evidence QA/Release双签结构点：
  只增加 Evidence Envelope/Pin与两条 role-specific root-signed approver record，Pin
  内部投影 fixed locator而不新增第二份 caller Locator；Evidence ID→双签→完整 payload
  digest→Envelope→Pin无环，Result/Runtime/Policy重复字段与
  `Evidence.issuedAt >= Result.completedAt`逐项关闭。成功路径固定3次 point admission与
  11次 signature verification，authority仅为
  `none_provider_feasibility_evidence_structure_only`；不证明 approver history/current/
  revocation、Catalog/Registry/Acceptance、真实 I/O或 strong write。
- D-36把 C09-1K冻结为12字段 raw input上的 Matrix＋Discovery→root-signed Release
  Target Universe结构点：只在完整 C09-1G request上增加 Universe Envelope，不接收
  caller Pin/Locator/path；Pin与 fixed generation path从已验证 Envelope唯一派生。
  coverage basis exact pin Matrix/Discovery并重算 counts/digests；C09-1G前置闭包证明
  Matrix是Discovery的 exact-byte subset，故 targets必须 exact-equal最多4096项的 Discovery
  targets，outer不得伪造不可达 conflict/derived-4097 failure。resolution固定按 taxonomy
  unresolved→discovery unresolved→matrix incomplete→closed-world complete，总体
  resolution与全部 owner-only public-profile-keyed bucket exact-partition一致；bucket中的
  `targetProfileIds`不得进入 public projection或 Surface。成功路径固定1次 point admission与7次 signature
  verification，authority仅为`none_release_target_universe_structure_only`；不证明
  distribution history/current、Catalog/Registry、Acceptance、真实 I/O或 strong write。

### D-37：Registry Entry↔Evidence supplied-history candidate

状态：`accepted`（2026-08-07 topology-proof Decision Amendment）

- D-37把 C09-1L冻结为22字段 raw input上的 production-format Registry Entry↔passed
  Evidence supplied-history candidate：入口以 C09-1I完整16字段为基础，增加 Evidence
  Envelope/Pin、Installation Identity、Bootstrap Bundle、Root history与 Registry Manifest
  history；Entry、provider与 QA/Release key全部从同一次已验证 history tip派生，caller不得
  提供。Evidence signer按 role命中未撤销 historical approver，允许不是 current active key，
  从而不因正常 root/key rotation误废弃旧 Evidence。authoritative current仍只能由后继
  Acceptance选择；成功 authority仅为
  `none_registry_entry_evidence_binding_structure_only`，不证明 Catalog exact-cover、五链
  current、唯一 writer、真实 Provider/I/O或 strong write。shared raw collector固定 depth=64，
  Bundle/Evidence/单 trust Envelope的 budget `B=4,194,304`、C09-1I既有大对象
  `B=16,777,216`，Root/Registry history count=256/4096、retained trust总量=268,435,456；
  node/property-name＋string-value/dense limit由各自`B`规范推导，两条 history另共享 raw
  `B_H=268,435,456`；raw admission对包含 original input与全部 observed
  identity的 capsule恰好做一次 full-input trusted clone；machine topology复核证明原
  2,097,152/16,777,216不是 sound no-narrowing bound：strict production-only构造下界为
  2,118,023/22,569,542，finite-capacity sound upper为3,126,096/235,725,869。D-37重开后按
  最小覆盖二次幂把 full-capsule identity/work cap冻结为4,194,304/268,435,456；proof同时固定
  prior failure、adopted within-bound与 C/C+1、W/W+1 zero-clone fixture。proof资源固定
  181,122 bytes、raw SHA-256
  `0c4c440ce0bc53e212f2bca0f389f196234a40963fed18ad4b44171f4554dc38`与 semantic digest
  `sha256:61e3f97a97d61c2170dfb287dd24cdac49e7c4ec75a04603c2b95f905e9f4714`；21项 production
  parser binding另固定 semantic digest
  `sha256:eb4c6a3f94ddef876adb002b1e4f5e4e43556015a28b5fa24374b360ec532920`。bootstrap及
  request都断言 original/collector shared-child alias在 clone后仍 memoized且 detached。prepared cores随后零 clone，
  prepared Registry input与 verified history witness使用两张 per-invocation WeakMap/两个 one-shot
  handle，不能被同 capability并发调用串用；pre-clone failure ledger=0、抵达唯一 clone boundary=1，
  prepared closure保持 detached history identity且 private copy ledger证明没有第二份 full-history graph；
  Registry→Root及 C09-1I→C09-1H两条 prepared call graph都只能进入 transitive no-snapshot subcore。
  security boundary只覆盖 package first-party path的 module-init primordial capture与 hardened Promise；
  Zod内部 primordial属于 trusted module realm，不能宣称完整 same-realm SES。未受信 Provider/host必须
  运行在隔离 realm或独立进程；broad-poison KAT固定 first-party post-start call=0、Zod trusted-boundary
  call>0且合法闭包24/46，dependency primordial实际破坏只能 opaque fail、不得形成 authority。
  `evidence_id`由 stage-3 prepared payload的 private exact 16-field projection派生，避免 malformed role
  signature被旧 strict public projector提前吞掉；digest/Envelope/Pin分别关闭 payload digest、outer ID与
  Pin ID/digest。diagnostic固定26 stage / 15 reason及逐 stage predicate/
  crypto-prefix表：history前0/0、history source exact prefix、binding为`P_H/S_H`、prepared C09-1I
  为`P_H/(S_H+S_I_prefix)`、其后 non-crypto为`P_H/(S_H+6)`、QA为`+7`、Release及后继为
  `+8`；成功固定`P_L=P_H`、`S_L=S_H+8`，当前 full-history anchor 24/38对应24/46。
  stage 5成功已蕴含 input/closure/Manifest/enabled Entry installation identity相等，故 stage 6
  `identity_mismatch`仅作防御性断言；stage 5与stage 10也已分别闭合 Entry与完整 Runtime policy
  digest，故 stage 11 `binding_mismatch`同样不可诚实构造。fixture必须 machine-readable区分
  traversed success、reachable rejection与带因果 rationale的 unreachable rejection，不得伪造覆盖。
  新 compatible base以 Registry `native-b`拓扑重签全部关联 C09-1I/Evidence/Entry对象，旧 C09-1J
  与 Registry资源只作227+89项 source inventory，不直接拼接。adapter expected使用 diagnostic或
  accepted-snapshot discriminated union；J 227项内固定6个3/11 snapshot case（其中2项仅有 Runtime
  1/7 lineage，禁止重复计数）在 L中映射 detached-snapshot success，并核对固定10字段 projection与
  完整 frozen closure；shard完整性使用 branch-aware expected-outcome digest而非强制 stage/reason。
  执行固定连续32-case shard、最多4 worker；Node22/pnpm9下专属验证≤10分钟/process-tree aggregate
  peak RSS≤1,536 MiB（monotonic spawn→last-child-exit并计入存活 worker/packed/Vite/browser child），
  根 quality≤40分钟且不提高
  45分钟 workflow timeout。完整表以 PRD D-37为唯一 normative定义，Matrix只作追踪镜像。

2026-08-06 implementation evidence：C09-1K code slice
`3e6f516d089aaacaf67984f46ca972d8687a5772`已独立提交并推送；Provider package最新
切片冻结268份 JSON Schema、21个显式 public module + 3个 wildcard resource export、
4份 genuine positive vector，以及116个 inherited + 169个 point-specific = 285个
ordered executable case；其中 inherited accepted-snapshot保持成功结果。internal
diagnostic拒绝分类固定16个 stage / 11个 reason；fixture另含2个 locator-builder stage
`target_discovery_locator`、`universe_locator`与3个无stage/reason的 snapshot-stability
success。成功路径
固定1次 point admission / 7次 signature verification，authority严格为
`none_release_target_universe_structure_only`。该最新切片不追溯改写C09-1J的
253份 Schema / 19个显式 public module / 122+105=227个 ordered executable case /
3次 point admission / 11次 signature verification历史证据。
golden资源固定为585,993 bytes / SHA-256
`4bea094e065951abfcc1f42decca105f5bedc94ee947ddb344365374f4d1a914` /
semantic `sha256:1fa267ecee01d48350708c475365ddc8a3873fef14dbff812cc3c685e27555bc`；
invalid资源固定为694,224 bytes / SHA-256
`ba8d12f558ba8db8534b606340d5b08de6898d2aa11e9d646c5a339a7f3042aa` /
semantic `sha256:b19908bef43443040cf6da82e5c6fa9dd21d406357b0b2048da8baa6af8a701f`。

CI stabilization commit `0c6474df66ce28e4a7caf4006233100194a6e493`保持原
`prepack` 15个 verifier的精确数量、顺序与命令，通过`verify:all`只执行一次；Provider
distribution显式`--ignore-scripts=false`，因此 hostile
`npm_config_ignore_scripts=true`不能静默绕过`prepack`，Contracts clean workspace则在
`--ignore-scripts`打包前显式 build Provider。hostile-env prepack闭环、冷分发完整性与
失败上抛均已由质量守卫固定。同树本地macOS `CI=true pnpm quality`为194个测试文件、
2,367 passed、1个既有skip、0 failed；Linux clean-checkout same-SHA CI run
`31079755984` / job `92545638787`为194个测试文件、2,368 passed、0 skipped、
0 failed，用时19m39s并success；独立复审P0/P1/P2=0。

上述2026-08-06证据只关闭C09-1K supplied-point candidate；其后C09-1L、C09-1M与
C09-1N已分别形成并提交各自none-authority candidate，本记录不把C09-1K旧同SHA
CI数字外推给这些后继提交。C09-1O另有下述commit与same-SHA CI独立证据；该证据同样
不外推到C09 aggregate、真实Provider、strong-write、production或release。上述gates继续
`open/locked`，Surface Release Gate也继续为Open。

### D-38：singleton Acceptance candidate与可信本机 target边界

状态：`frozen / implementation in progress`（2026-08-13 implementation-safety Decision Amendment）

- 实现审计确认：C09-1M/1N允许同一public bucket包含多个private full target，各
  target的Evidence/Runtime按target绑定，而steady Registry只有一个enabled Entry与
  一组Evidence/Runtime Pin。把整份multi-target Distribution Catalog直接解释为
  Acceptance selector会破坏D-30冻结的Registry/Catalog Evidence、policy与Runtime
  exact equality。D-38保留该等式，不修改C09-1M/1N wire、资源、digest或合法接受
  集合；multi-target Catalog/retained history仍是合法distribution-wide release
  coverage与none-authority输入，但不是C09-1O Acceptance success。
- C09-1O只接受已完整重验的C09-1N source中Universe/Catalog exact-cover恰一full
  target；该target须恰有一个passed strong candidate，并与steady Registry唯一
  enabled Entry的provider ID、semantic policy digest、完整Evidence Pin与完整Runtime
  Pin byte-identical。zero/multiple、non-steady或合法重签但cross-object不等均fail
  closed。selector固定一项，authority唯一为
  `none_provider_strong_ready_acceptance_candidate_structure_only`；candidate的
  generation/digest/HMAC token/Envelope/Pin及caller key均不证明authoritative current、
  immutable Identity key ownership或I/O authority。全局selector array wire不缩版。
- 后继production Trust Verifier可消费合法multi-target Distribution closure，但必须
  从trusted client或OS-isolated边界的本机当前opened physical-target observation导出
  完整七字段target；caller target ID、Catalog默认项与provider runtime self-report均
  不得成为authority。verifier须只投影该local target，重验Registry/Catalog exact
  equality、revocation、online binding generation、runtime/IPC endpoint，并闭合
  immutable Installation Identity、owned HMAC key/key-check、signed-package/retained
  trust与versioned mutual-auth IPC。
- candidate只有经installation-state provider原子compare-append no-replace generation、
  authenticated complete enumeration、CAS high-water与operation-nonce compact receipt，
  并由receipt/high-water选中后才成为current。D-38不新增第18个Commit Gate；C09-1O
  已提交并通过下述同SHA CI，但仍只形成none-authority candidate。Trust Verifier、WP5-PF/WP3P、
  atomic current/high-water/receipt、Migration及strong-write/production/release继续
  `open/locked`。PRD D-38是完整normative定义。

C09-1O已在 commit `36588f34899f0e0de36536192841f7f188d3c128`提交；同 SHA
clean-checkout CI run `31625767367`最终`Quality = success`，Provider unit 26m38s、
Provider distribution 36m18s、Workspace 9m51s、Preview 1m27s。该证据只关闭
D-38的singleton Registry-exact structure-only candidate，不外推到C09 aggregate、
authoritative current、Provider/I/O authority或任何capability unlock。

### D-39：可信本机 opened-root physical-target selection candidate

状态：`accepted`（2026-08-13 implementation-safety Decision Amendment）

- D-39位于既有WP5-1P/C09 aggregate Gate内、接续C09-1O；它不命名为C09-1P、
  不新增第18个Commit Gate，也不新增`AT-D39`。它只从同一opened root的可信物理
  observation选择`ProviderFeasibilityTargetV1`及C09-1N中exact匹配的owner target
  capability；read-only capability也可被如实选择。成功不选择active writer、不生成
  Acceptance/current/receipt，也不授权Provider或Store I/O。
- observation只能来自trusted client或OS-isolated adapter对同一
  `openedRootAuthority`的观察；caller ID/JSON、Catalog default/首项、runtime self-report、
  pathname或path reopen都不得成为source。baseline/pre/post三次observation复用并重算
  完整七字段target ID，先比较private 1..4096-byte `Uint8Array` continuity witness，再比较
  target canonical bytes；freshness不使用clock/TTL，postcheck只拒绝本次窗口内drift。
  witness不等为`root_volume_changed`；witness相等而target bytes不等为
  `observation_changed`。witness只在internal `WeakMap`，不可序列化、记录或进入public DTO。
- host唯一method固定为`observeOpenedRootPhysicalTargetV1(authority)`，返回exact两字段
  `{target, rootVolumeContinuityWitness}`；后者是private exact 1..4096-byte
  `Uint8Array`。extra key、错误method/authority或非exact observation fail closed。
- internal mint exact输入为`openedRootAuthority`与`physicalTargetObservationHost`且不export。
  public consume exact输入为`distributionHistoryCandidate`与
  `physicalTargetObservationCapability`；其类型固定为
  `ProviderTrustedLocalPhysicalTargetObservationCapabilityV1`，capability是null-prototype、frozen、zero-own-key
  one-shot handle，consume在任何source读取/await前burn。malformed、wrong source、pre/post
  failure、zero/ambiguous/projection mismatch均不恢复handle；同handle并发最多一胜。
- 成功输出exact四字段：authority、已重验distribution history candidate、
  `selectedOwnerTargetCapability`与Support Catalog Pin；authority唯一为
  `none_provider_trusted_local_physical_target_selection_candidate_only`。Universe、Catalog
  与owner capability必须对可信observation做完整target三层exact unique match，不能只比ID。
  internal stages固定为`input/physical_target_observation_capability/
  physical_target_precheck/distribution_history_candidate/physical_target_postcheck/
  local_target_selection`；reasons固定为`schema_invalid/capability_invalid/
  observation_unavailable/observation_invalid/root_volume_changed/observation_changed/
  source_invalid/target_zero_match/target_ambiguous_match/target_projection_mismatch`；public
  只暴露opaque `provider_unavailable/attestation_invalid`。
- D-39不闭合immutable Identity/key ownership、signed-package/retained current、online
  binding generation、mutual-auth IPC、atomic Acceptance current/high-water/receipt、
  Migration、真实Provider/client/Store writer或strong/release authority；全部继续
  `open/locked`。PRD D-39是完整normative定义。

D-24～D-39 的实现与验收矩阵为
`docs/research/2026-07-30-wp5-change-intelligence-matrix.md`；其中第 3.8 节是
必须逐字段等价实现的 normative Schema Appendix。所有 C09 provider
contract、canonical bytes/golden与 prerequisite conformance归
WP5-1P；C01～C08 Change Intelligence contracts归 WP5-1，WP5-1后续只能增加
与已冻结 C09兼容的补充，不能重定义或推迟 C09 Gate。冻结验收范围为
AT-C01～AT-C31、AT-D01～AT-D38、AT-S01～AT-S16、AT-O01～AT-O33、
AT-Q01～AT-Q33，其中 AT-D35～AT-D38 关闭
Store ownership、Manifest atomic head与 known-redacted/unknown accounting，
AT-Q29～AT-Q33 关闭 OS locator、handle-bound sandbox、SafeGit resource/race caps、
trust compromise/migration及 strict crypto host/identity lifecycle。这些修订不改变
D-21 Lifecycle 状态集合或普通转移。

WP1只提供 shared strict Envelope、Digest/brand primitive、Schema/package
machinery与 Fixture runner；任何 C09 schema、digest/signature domain、locator、
golden/negative vector及 C09 Gate均不得计入 WP1退出条件或预算。

## 5. Task Lifecycle V1

### 5.1 状态

| 状态 | 语义 | 类型 |
|---|---|---|
| `created` | ID、intent、repo/worktree 与 baseline 已保存；Context 尚未成功构建 | 可恢复 |
| `context_ready` | Pulse 可用，Brief/Claim/Evidence 引用有效；Unknown 已显式记录 | 活跃 |
| `planned` | Goal、Acceptance 与 Plan 已通过强类型 Action 确认 | 活跃 |
| `in_progress` | 实施已开始，Worktree Diff 可持续变化 | 活跃 |
| `check_required` | 当前实现切片完成；无 strong Check descriptor 时派生 `awaiting_check`，有 exact descriptor 时派生 `check_review` 等待处置 | 活跃 |
| `verification_required` | 最新 Check 已完成且阻断 Finding 已处理，仍需 Verification 记录 | 活跃 |
| `verified` | Check 与 Verification 均绑定最终 snapshot，验收闭环完成 | 终态 |
| `blocked` | 外部依赖使任务暂停，保存 `resumeStatus` 和结构化原因 | 可恢复异常态 |
| `stale` | 支撑计划/检查的 Snapshot 或 Artifact 失效，禁止继续作可信结论 | 可恢复异常态 |
| `superseded` | 被替代、重复或明确放弃 | 终态 |

P0 不另设 `cancelled`；放弃表示为 `superseded(reason=abandoned)`。P0 不物理删除 Task；隐藏和归档只属于 View concern。

### 5.2 允许转移

| From | To | Guard |
|---|---|---|
| `created` | `context_ready` | Context 构建成功；Pulse 非 `not_ready/unknown`；引用校验通过 |
| `context_ready` | `planned` | Goal、Acceptance、Plan 已确认；Actor 与 revision 已记录 |
| `planned` | `in_progress` | 显式开始；Task/Worktree 绑定仍有效 |
| `in_progress` | `check_required` | 已捕获最新 actual snapshot；Agent 声明本轮修改可检查 |
| `check_required` | `in_progress` | Check 发现需要继续修改或补计划 |
| `check_required` | `verification_required` | Check 绑定当前 revision/snapshot；阻断 Finding 已修复或由授权 Actor 显式接受 |
| `verification_required` | `in_progress` | Action 指向当前 generation/Snapshot/Plan Entry 的 latest failed/blocked/flaky Verification Record |
| `verification_required` | `check_required` | actual snapshot 再次变化，旧 Check 自动失效 |
| `verification_required` | `verified` | Check 仍为最新；所需 Verification 已通过或被授权 Actor 接受 skip；无 unresolved failed/blocked/flaky |
| `created` / `context_ready` / `planned` / `in_progress` / `check_required` / `verification_required` | `blocked` | 使用 `block_task`；记录 `resumeStatus`、blocker、Actor 与时间 |
| `created` / `context_ready` / `planned` / `in_progress` / `check_required` / `verification_required` | `stale` | Snapshot/Artifact 失效；不得静默继续 |
| `created` / `context_ready` / `planned` / `in_progress` / `check_required` / `verification_required` | `superseded` | 使用 `supersede_task`；记录 reason；存在替代 Task 时记录 `replacementTaskId` |
| `blocked` | 原 `resumeStatus` | 使用 `resume_task`；Blocker 已解除且 Context/Check 仍 fresh |
| `blocked` | `stale` | Blocker 解除时 Context/Check 已失效，或等待期间 Snapshot/Artifact 失效 |
| `blocked` | `superseded` | 使用 `supersede_task`；记录 reason 与可选 replacement |
| `stale` | `context_ready` | `refresh_task_context` 或 `rebase_task` 成功；旧 Plan/Check/Verification 显式失效 |
| `stale` | `superseded` | 使用 `supersede_task`；记录 reason 与可选 replacement |
| `verified` / `superseded` | 无 | 终态不可重开；后续工作创建新 Task 并建立 parent/replacement link |

不允许 `created → verified` 等跨阶段跳转，也不允许 `blocked → blocked`、`stale → stale` 或 `stale → blocked`。裸 `transition_status` 不能代替 `block_task`、`resume_task`、`refresh_task_context`、`rebase_task`、`supersede_task` 等强类型 Action。

### 5.3 Revision、幂等与恢复

- `update_task` 的生命周期 Action 固定包含 `transition_status`、`block_task`、`resume_task`、`refresh_task_context`、`rebase_task` 与 `supersede_task`；`transition_status` 只执行表内普通阶段转移。
- 所有 Task Mutation 使用 `(worktreeId, taskId/create-scope, idempotencyKey)` 唯一键，并保存 canonical request digest 与 Actor。
- 普通既有 Mutation 的服务端顺序固定为：binding/auth → idempotency lookup →
  same-key digest check → CAS `expectedRevision` → lifecycle guard → 原子提交
  Artifact/Event/idempotency result。WP5 仓库相关 Operation 还必须在 guard 后
  执行 D-27 的 exact Basis/out-of-lock work/final read-set validation；Stage 1
  使用独立 Creation Basis 与 marker-first 协议，不能被该简写跳过。
- 同 key、同请求重试返回首次持久化结果，不增加 revision、不追加 Event；即使请求携带旧 revision，也先返回 replay。
- 同 key、不同 payload 或 Actor 返回 `idempotency_conflict`，不写入。
- 未见过的 key 且 revision 不匹配返回 `revision_conflict`；调用方读取最新 revision、重新决策并使用新 key。
- 成功 Mutation 恰好增加一次 revision、追加一次 Event；Schema、Guard、CAS、权限或执行失败均不增加 revision。
- Crash 后结果不确定时必须复用原 key；`build_task_brief` 的 key 稳定映射到同一 Task ID。
- `refresh_task_context` 必须显式断言 target Snapshot、保留 baseline、重建
  Context 并删除旧 Check/Verification 投影；`rebase_task` 还必须显式提供且
  真正把 baseline 改为同一个 exact live target Snapshot。二者清理前归档
  immutable historical projection，不能原地保留旧 Plan/Check/Verification
  语义或断开旧 Evidence closure。

### 5.4 `build_task_brief` 编排与可信回放

`build_task_brief` 是唯一允许在一个公开 Tool Call 内顺序执行两次底层 Mutation
的 P0 编排；两次提交仍分别执行第 5.3 节的 authorization、idempotency、CAS、
Guard、Artifact/Event/Journal 原子提交规则。

| 阶段 | 输入 revision | 提交后状态 | 必备持久事实 | 不得出现 |
|---|---:|---|---|---|
| Stage 1 / intent recovery | 0 | `created@1` | 先引用已提交 immutable current Snapshot；无副作用 scan/plan 得到 `TaskCreationBasisV1`；Store 锁内重验后，在任何 blob/lease 前 fsync 含 nonce/ref/OID/ownership/write plan 的 marker，materialize 后 final read-set revalidate；Task transaction 提交含 resolved `contextBuildSpec` 的 Manifest、internal baseline descriptor/private blobs、唯一 `task_created` Event、创建 Record/Receipt/Journal/Basis Record | Pulse/candidate baseline/blob/lease 反向进入 Creation Basis；Brief/Claim/Evidence/Impact/Check/Verification 伪事实；副作用早于 marker；未验证 locator；把 repository Snapshot 塞入 Task transaction |
| Stage 2 / context publication | 当前 `created@N`（标准路径 N=1） | `context_ready@(N+1)`（标准路径 @2） | Brief、Claim、Evidence、Impact、下一条 Event、公开调用 Record/Receipt、完整 Journal；Manifest/Brief/Event 绑定同一新 `contextGenerationId` | 未通过 Pulse/引用校验的 Context；空 Change Check/Verification；硬编码 revision 2；缺失 generation |

可信 Journal 满足：

1. 每个 Idempotency Record 恰好对应一个 Receipt，Task/Event/revision/result
   digest 全部一致；Receipt operation、Task resultingStatus、Snapshot、
   repo/worktree 与对应 Event 逐项一致。
2. Receipt 的完整 result 必须重新计算 canonical digest；只验证结构不足以
   信任历史 replay。
3. Journal、Manifest、Task Artifact 与 Event chain 必须来自同一 CAS
   revision；任一缺失、截断、悬空或 digest mismatch 时整个 Bundle fail
   closed。
4. 幂等 lookup 先于 revision conflict：旧 key 即使携带旧
   `expectedRevision`，仍返回首次结果；未见过的新 key 才执行当前 CAS。
5. `.idempotency.json`、内存 Map 或调用方单文件拼装只能作为非权威缓存/实现
   细节，不能替代 `task_operation_journal`。
6. 新 live writer 每个 revision 都必须提交完整 Journal；无 Journal 仅允许
   显式 legacy history import/migration，且不得被可信 `readTaskBundle` 读取。

WP4 关闭前至少通过以下验收：

- 正常调用固定产生同一 Task 的 `created@1 → context_ready@2` 两条连续 Event。
- Stage 1 后故障、进程退出或 Context 暂不可用，原 key 重试可恢复 Stage 2。
- Stage 1 后合法 block/resume 回到 `created@N` 时，Stage 2 只提交
  `context_ready@(N+1)`，不倒退 revision。
- 已完成调用在后续 Task revision 上仍能 replay revision 2 的首次完整结果。
- 同 key 不同 payload 或 Actor fail closed，且不追加 revision/Event。
- 20 路同 key 并发只产生一个 Task、一个 Genesis 和一个
  `context_ready` Event。
- 进程重启后仅通过可信 Store bundle/journal 继续 Task；非法
  `resume_task` 不能恢复到 `blockedState.resumeStatus` 之外的状态。
- `context_ready@2` 可在没有 Change Check/Verification Artifact 时可信读取。

## 6. Owner Matrix

角色是后续责任边界，不等于本记录声称某个未具名真人已经签字。

| 范围 | Accountable | Implementer | Verifier | Promotion approver |
|---|---|---|---|---|
| Mission/P0/Non-goals | Product Owner | — | QA | Product Owner |
| Shared Contracts / Task lifecycle foundations | Tech Lead / Core | Core | QA | Tech Lead |
| Provider Contracts Prerequisite / C09 | Platform / Security Lead | Contracts/Core + Provider/Systems | QA/Security + independent Implementability | Tech Lead + Product Owner |
| Change Check / Verification | Tech Lead / Core | Change Intelligence + Task Engine | QA/Security | Tech Lead |
| Baseline / Delta trust boundary | Tech Lead + Platform | Repository State + Artifact Store | QA/Security | Tech Lead |
| Durable Object Provider / registry / real-FS Gate | Platform / Security Lead | Provider/Systems + Artifact Store | QA/Security + Release | Tech Lead + Product Owner |
| Root/Error Contract | Tech Lead + Platform | Platform | QA/Security | Tech Lead |
| Runtime Rendezvous | Platform / Integration | Platform + Frontend | QA/Security | Tech Lead |
| Codex CLI mandatory | Platform / Integration | Platform | QA | Product Owner |
| Claude CLI mandatory | Platform / Integration | Platform | QA | Product Owner |
| Conditional Surfaces | Platform / Integration | Platform/Frontend | QA | Product Owner |
| Workbench IA | Frontend | Frontend | Product/QA | Product Owner |
| Performance/Gold Set | Product/QA | Core/Frontend | QA | Tech Lead |
| Packaging/License/SBOM | Platform / Release | Platform | QA/Security | Product Owner |

### 6.1 Surface ownership

| Surface | P0 role | Contract owner | Adapter/Packaging | E2E/Evidence | 当前状态 | 关闭 Gate |
|---|---|---|---|---|---|---|
| Codex CLI Plugin | Mandatory | Tech Lead | Platform | QA | `pending-e2e` | WP6/WP8 Surface Release |
| Claude Code CLI Plugin | Mandatory | Tech Lead | Platform | QA | `pending-e2e` | WP6/WP8 Surface Release |
| Codex Desktop Plugin | Conditional | Tech Lead | Platform + Frontend | QA | `pending-e2e` | 独立 Desktop Release Gate |
| Codex IDE direct MCP + repo Skill | Conditional | Tech Lead | Platform | QA | `pending-e2e` | 独立 IDE Release Gate |
| Claude VS Code | Conditional | Tech Lead | Platform + Frontend | QA | `pending-e2e` | 独立 VS Code Release Gate |
| Claude Desktop local | Conditional | Tech Lead | Platform + Frontend | QA | `pending-e2e` | 独立 Desktop Release Gate |

Support 文案由 Product + QA 联签；任何一行未通过时只能保持 `pending-e2e`。

## 7. G0-01～G0-09 处置

已关闭的底座项保留其证据位置；仍为 partial/open 的项是已知 pre-P0
capability gap，不是 WP0 新引入回归。对应能力在后续 Gate 关闭前保持未支持，
不能进入产品支持文案。

| ID | Contract disposition | 实现状态 | Owner | 必须关闭时间 |
|---|---|---|---|---|
| G0-01 Worktree freshness | staged/unstaged/untracked/rename/delete/error 必须进入 Snapshot；旧 fresh 结论不可信 | WP2 discovery core closed（CI `30366487231`）；D-29 path-safe strong Snapshot/Pulse profile 在 WP5 reopened/pending | Repository State + Security | strong Task Alpha 前关闭 safe profile；Surface 继续验证 |
| G0-02 BODY_LOGIC 被当 cosmetic | 旧 `SKIP` 不得进入 P0；Refresh 与 Behavior Risk 分离 | WP2 conservative taxonomy closed；WP5 rich parser open | Core + Change Intelligence | Change Check Alpha 前关闭 rich mapping |
| G0-03 Edge provenance 丢失 | Edge Evidence V1 进入 WP1；旧边只能显示 unknown provenance | WP1 contract closed；WP4 Evidence/Impact producer closed | Core | Closed for Task Brief；WP5 Actual mapping 另验 |
| G0-04 非原子持久化 | Task Store 必须 atomic/CAS/lock；旧 writer 不得用于多 Agent Task | WP3/WP4 closed；Store/Engine CI `30512901210` | Core + Platform | Closed for Task；WP5 operations 另验 |
| G0-05 Secret hard deny | Hard deny 与内容扫描不可被 ignore negation 取消；首个公开持久化前完成扫描 | WP2 path deny/WP3 owner boundary closed；WP5 safe Snapshot/request HMAC/CAS reservation pending，WP6 Surface open | Platform / Security | 首个 strong Task/源码摘录 MCP Alpha 前 |
| G0-06 Diff Overlay 断链 | 旧 Overlay deprecated，不作为 P0 数据源或完成证据 | WP5/WP7 open | Change Intelligence + Frontend | Change Check Workbench Alpha 前 |
| G0-07 Worktree 重定向 | Task/Store 绑定当前 canonical worktree；共享只限不可变缓存 | WP3/WP4 core binding closed；WP6 Surface open | Core + Platform | Mandatory Host Surface Alpha 前 |
| G0-08 Quality/Release | 根 quality、CI 已关闭；CLI/bin、统一版本、License、SBOM、allowlist、Marketplace 留后续 Gate | Partial | Platform + QA | Mandatory Surface Release / M4 |
| G0-09 Durable Object Provider | strong writer必须使用 OS-isolated exact-object provider、strict Ed25519 host KAT/opaque capability、fixed Bootstrap Trust Bundle + immutable Identity retained historical trust、trust-history caps + append-only Acceptance、root-signed Registry/Taxonomy/Target Universe/Catalog、provider-isolated receipt ledger、atomic path containment、external CAS/journal seal与 bounded dual-namespace migration；未通过或 coverage incomplete target只读 | D-38/C09-1O singleton Registry-exact structure-only candidate已在 `36588f34899f0e0de36536192841f7f188d3c128`提交且同 SHA CI `31625767367` success，仅关闭none-authority candidate。D-39可信本机 opened-root physical-target selection candidate已冻结、implementation in progress；atomic Acceptance current/high-water/receipt、mutual-auth IPC、C09 aggregate与WP3P仍open，全部 strong mutations capability locked | Platform/Security Lead + Provider/Systems；QA/Security/Release验证 | 首个 strong Task Alpha前关闭 AT-C31/AT-Q33、签名开发 target profile并验证当前物理 volume runtime exact-match；P0前关闭全部 advertised profiles |

## 8. 当前发布缺口

这些项不阻塞 WP1，但阻塞外部发布：

1. npm 当前未登录，`@understand-code` Scope 所有权未知。
2. 当前构建仓库为 private，尚无 Tag、Release 或 Release Workflow。
3. 仓库缺少可验证的 `LICENSE`，但 Claude Manifest 声明 MIT；公开发布前必须恢复完整 License 与上游归属。
4. Claude Manifest 的 author/homepage/repository 仍是历史元数据。
5. 缺少 Codex Manifest、两个 Marketplace Manifest、bundled `.mcp.json` 和 CLI `bin`。
6. 根 Package 缺少 `files`、`publishConfig`、`engines`、`packageManager`、repository/homepage/license 的一致配置。
7. 性能 Evidence 使用 Node 26 / pnpm 11，CI 使用 Node 22 / pnpm 9；WP8 必须冻结唯一支持基线并在该环境重采 RC Evidence。
8. macOS code signing/notarization、Linux Artifact 签名以及构建 provenance/attestation 尚未建立。
9. provider OS principal/service、strict crypto host/hostile manifest、fixed
   Bootstrap Trust Bundle、offline registry-root与 key custody、trusted
   physical-target resolver、versioned mutual-auth IPC权限、atomic Acceptance
   complete enumeration/high-water/receipt、retained historical verifier、
   per-target-profile real-FS conformance与当前物理 volume runtime对签名 profile的
   exact-match，以及 provider
   install/upgrade/downgrade/uninstall/rollback证据尚未建立；完成前 strong
   Store write不得出现在 supported capability中。

## 9. 用户工作区处置

提交本记录及后续 Decision Amendment时只允许暂存 G0、权威 PRD与 WP5 Matrix文档：

- 用户所有的 `docs/prd/.qa/` 保持未跟踪、未暂存。
- 用户所有的 Graph Layout PRD `.docx` / `.md`、`assets/`、`__pycache__/` 和生成脚本保持未跟踪、未暂存。
- 用户所有的 `site/` 保持未跟踪、未暂存，不属于 Agent-native 产品研制范围。
- `.learnings/` 被忽略，不进入产品提交。
- `ALPHA-B` 当前 tracked dirty 与 untracked 内容不读取为 Gold Evidence、不复制、不提交。

## 10. Gate 计算

| 条件 | 结果 |
|---|---|
| Mission、P0、Non-goals 已冻结 | PASS |
| D-13～D-19、D-21～D-38 已接受；D-39 frozen / implementation in progress；D-20 有 Owner/Gate | PASS |
| Task Lifecycle、Revision 与幂等语义唯一 | PASS |
| Root/Error/Rendezvous 语义唯一 | PASS |
| Surface mandatory/conditional、Owner、后续 Gate 完整 | PASS |
| G0-01～09 有处置、Owner 和 capability lock | PASS |
| 根质量、CI、Host 与性能证据可复核 | PASS |
| C09-1K supplied-point code / local quality / same-SHA CI / independent review | PASS；不外推到 aggregate |
| Decision D-38 singleton/Registry-exact边界与C09-1O same-SHA evidence | PASS；只关闭none-authority candidate |
| Decision D-39 三文档 trusted opened-root physical-target selection边界 | PASS；implementation in progress，不新增Gate/AT |
| C09 aggregate、真实 Provider、strong-write、production 与 release gates | OPEN / LOCKED |
| 用户未跟踪文件明确排除 | PASS |
| PRD/Host Spike 状态同步 | 由包含本记录的提交完成 |
| Surface Release Evidence | OPEN，不属于 Contract Freeze |

最终结论：

> `G0 Contract Freeze Gate = closed_for_implementation`
>
> `Surface Release Gate = open`
