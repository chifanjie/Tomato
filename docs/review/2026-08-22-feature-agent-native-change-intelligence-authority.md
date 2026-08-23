# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-23 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：5b4c7d49b07ad4b9317afab9a63bb562a7ffa8c2

## 背景与切片边界

对 D-24～D-26 的实现审计确认：现有 legacy Task/Snapshot 没有 strong task baseline、完整
Actual/Hunk/Completeness，也不能诚实写入 `evidence_backed_v1`。因此本切片不继续扩张 legacy
Change Check，而先关闭一个可独立交付的 D-26 Plan obligation：

- 新 Task Brief writer 为每个 Planned Change 显式写 `expectation`；
- 新 Verification Plan writer 继续显式写 `required: true`；
- legacy reader 允许两字段缺失，但不得注入默认值、追溯推断、改变 canonical bytes 或 digest；
- legacy Verification Entry 缺少 `required` 时，生命周期仍保守地按 required 门禁；
- MCP 返回、Markdown handoff 与安装后的 React Workbench 都可观察显式义务或 legacy 缺失。

本切片不新增 `contextGenerationId`、strong Task baseline、formal Actual/Hunk/Check，也不解锁
strongWrites。

## 冻结合同

### Planned Change

新公开枚举为：

- `required_change`
- `optional_change`
- `inspect_only`
- `verification_only`

字段在 V1 reader 中保持 optional，以便无损读取历史 Brief；新 writer 使用唯一确定映射：

| CandidateLevel | expectation |
|---|---|
| `likely_change` | `required_change` |
| `possible_change` | `optional_change` |
| `must_inspect` | `inspect_only` |
| `context_only` | `inspect_only` |
| `test_or_verify` | `verification_only` |

### Verification Plan

- `required` 从 parse-time `default(true)` 改为 optional、无 default。
- 新 writer 必须显式写 boolean；当前 writer 写 `true`。
- reader 遇到 legacy 缺失时保留字段不存在。
- lifecycle/invariant gate 只把显式 `false` 视为 optional；`true` 与缺失都必须满足当前
  final-Snapshot Verification。

## 改动范围

| 模块 | 文件 | 作用 |
|---|---|---|
| Contracts | `packages/contracts/src/task.ts` | 新增 expectation 枚举；两字段使用 optional/no-default reader |
| Invariants | `packages/contracts/src/invariants.ts` | legacy 缺失 required 保守门禁 |
| Generated schemas | 8 个 Task/MCP JSON Schema | 发布 expectation enum，并移除 required 的 default/required-list 注入 |
| Task writer | `packages/task-engine/src/context-builder.ts` | 五种 CandidateLevel 显式、确定性映射 |
| Lifecycle | `packages/task-engine/src/mutation.ts` | live transition 与 contract invariant 使用同一 `!== false` 规则 |
| Handoff | `packages/task-engine/src/renderer.ts` | 显示显式值；legacy 缺失保持可见且说明按 required 门禁 |
| Workbench | `packages/dashboard/src/components/taskFirst/TaskFirstWorkbench.tsx` | 简体中文显示 candidate/expectation 与 Verification obligation |
| Packed vertical | `packages/preview/test/workbench-browser-packed.test.mjs` | installed MCP writer、字段映射、React 可见性与候选源 overlay fidelity |

对应 contracts、engine、renderer、Dashboard 和 packed gate 均新增回归断言。

## Review 重点

1. **无损兼容**：legacy Brief parse 后仍不拥有 `expectation/required` 自有属性；canonical JSON
   和 SHA-256 digest 与 parse 前相等。
2. **新写入显式**：writer 不依赖 Zod default；五种 CandidateLevel 全部有精确 expectation；
   Verification Entry 全部拥有 boolean `required:true`。
3. **门禁不降级**：contract bundle invariant 与 live Task mutation 都证明缺失 required 仍拒绝
   `verified`；对照用例证明只有显式 false 才跳过该 Entry。
4. **不追溯猜造**：renderer/Workbench 对 legacy expectation 显示“未指定”，不从历史
   candidateLevel 反推 obligation。
5. **公开可观察**：MCP `build_task_brief` 返回显式字段；安装后的 Workbench 显示
   `必须检查 · 仅检查` 等实际计划义务。
6. **候选忠实**：packed gate 从 HEAD clone 后显式 overlay 本切片全部 20 个产品文件；候选不再出现
   “新断言 + 旧 bundle”的伪验证。
7. **不越权宣称**：legacy Change Check 仍是 `legacy_summary`；本切片没有产生 formal omission
   或 semantic correctness 证明。

## 测试证据

通过：

- Contracts focused：1 file / 33 tests。
- Contracts package：52 schemas、28 fixtures、13 files / 137 tests、14 packed entry points。
- Task Engine focused：2 files / 37 tests；typecheck。
- Task Engine package（串行 fresh build）：8 files / 81 tests。
- Artifact Store：typecheck；12 files / 129 tests。
- CLI：typecheck；13 files / 93 tests。
- Dashboard：production build；affected component 1 file / 3 tests。
- Preview：typecheck；runtime 8/8、plugin clean install 1/1、cold packed 1/1。
- `node --check packages/preview/test/workbench-browser-packed.test.mjs`。
- `git diff --check`。
- 唯一真实 packed Browser 路径的最终运行：
  `pnpm --filter @understand-code/preview test:workbench-browser`
  - 终审修复后的最终运行 1 passed / 0 failed / 0 skipped，246.222 秒；
  - v1：87 entries，
    `sha256:a46ff2053b612a56329b42b00695eaf9efdd8d6bb0d850050d535c21050c936d`；
  - v2：87 entries，
    `sha256:60983f327a720ed846db6ae928666d27c970aa564622590aa13b2007fdb39035`。

Dashboard 全包存在一个父提交即可复现的红灯：

- `simplifiedChineseSurface.test.ts` 对
  `TaskFirstWorkbench.tsx` 的 56 条既有英文静态文案报错；
- `git show HEAD:packages/dashboard/src/components/taskFirst/TaskFirstWorkbench.tsx` 可直接看到同一批文案；
- 本切片新增标签已改为简体中文，复跑该门禁仍是同一 56 条；新增标签没有进入违规集合；
- Dashboard build 与本片 affected component tests 均为绿色。

该既有本地化债务不在本切片中伪装为已关闭，需由终审判断是否阻断当前 bounded commit。

## 失败轨迹与最小修复

1. 首轮 Task Engine typecheck 暴露测试夹具把已收窄 bundle 重新注解为联合类型；改为从已收窄
   `current.bundle` 构造，production 未变，随后 typecheck 与 37 个 focused tests 全绿。
2. 四包并发时 Task Engine 有 7 个测试超过既有 5 秒 timeout；未放宽 timeout。待 Artifact Store
   长测试结束后串行重跑，8 files / 81 tests 全绿。
3. 首次 packed Browser 在约 226 秒处发现 candidate clone 未 overlay 新 writer，安装包缺少
   expectation；补齐本片完整 overlay 后不再复现。
4. 第二次 packed Browser 已显示 `必须检查 · 仅检查`，但测试错误固定期待
   `likely_change · required_change`；断言改为按已验证的 Brief candidateLevel 选择冻结 UI
   映射，第三次同路径 1/1 通过。
5. 独立终审指出 optional 正向对照复用了 failed Verification Record，而 fake Store 不执行完整
   bundle invariant，可能让测试证据假绿。对照已改为来自真实 Store 的“尚无 Record”
   verification-required bundle；另补完整 bundle 回归，证明 optional Entry 的 latest failed Record
   仍被全局 unresolved-attempt 规则阻断。修后 Contracts 33/33、Engine integration 35/35 与
   Task Engine typecheck 全绿；同一 packed Browser 路径最终 1/1，且两份 tarball hash 未变化。

没有通过放宽 schema、gate、timeout、预算或跳过断言取得绿色结果。

## 可声明

- 新 Task Brief 对所有 Planned Change 写入显式 D-26 obligation。
- 新 Verification Plan Entry 写入显式 `required:true`。
- legacy Brief 可无损读取缺失字段，且不会因缺失 required 绕过 verified 门禁。
- MCP、Markdown 与安装后的 React Workbench 能区分显式 obligation 和 legacy omission。
- 本片涉及的 Contracts、Store、Engine、CLI、Preview 打包/冷安装和真实 Browser vertical 已通过。

## 不可声明

- 不得称为 strong Task、strong Brief 或 `evidence_backed_v1`。
- 不具备 `contextGenerationId`、strong task baseline、path-safe Snapshot/Pulse、formal
  Actual Change、Diff Span/Hunk 或五维 Completeness。
- legacy 缺失 expectation 不得反推为 required，也不得据此生成 possible omission。
- 本片不证明模型选择、双 Host 凭证链、cross-platform、CI same-SHA、签名、SBOM、provenance 或 Release。
- Provider Authority 与 strongWrites 继续 locked。

## 外部阻塞保持

- Step16 真实 model-selected 双 Host 仍缺隔离凭证；Claude 版本与受审语料/Owner 授权条件未闭合。
- Step17 GitHub Actions 仍被 billing/payment 阻塞，same-SHA CI、signing、SBOM、provenance、
  cross-platform 和正式 RC/Release 均未关闭。

## 终审状态

独立 change-intent review：P0=0、P1=0；唯一 P2 测试语义 finding 已修复并复测。终审结论为
`SAFE TO COMMIT`。可接受残余测试缺口：真实 packed Browser 只走一个 CandidateLevel，其余四级由
focused writer test 覆盖。

Dashboard 的 56 条父提交既有 localization debt 不按 change-intent 归因阻断本 bounded commit，且不得
宣称 Dashboard 全包绿色。目标保持 active；本切片提交后继续推进 path-safe Snapshot 与 strong
task_baseline eligibility，不将总体目标标记 complete。
