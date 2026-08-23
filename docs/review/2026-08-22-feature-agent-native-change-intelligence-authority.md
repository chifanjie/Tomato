# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-23 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：0b7f4ee990e1caa0dc5972acfa7a90ecf43842b4 feat(task-engine): analyze live add-delete batches

## 背景与动机

Step15 已分别证明 pure staged、pure live、ITA、deletion 与各自的 bounded 组合，但真实用户也会把不同文件
分层处理：一些文件已完整 staged，另一些 tracked 文件仍在 worktree 修改，还有不同路径的新文件未跟踪。
此前 staged 与 untracked early guard 会把这种不同路径的 heterogeneous batch 整批判为 unsupported。

本切片新增一个内部 bounded profile，允许 staged added|modified 与 live unstaged modified|untracked added
在不同路径组成同一个实际 Snapshot。它不支持同文件 partial staging，也不引入 deletion、ITA、committed
或 conflict；不新增公开 contract、artifact schema、consumer、matcher 或 MCP shape。

## 冻结合同

- baseline/actual必须complete，并绑定同一repository、worktree与HEAD。
- 2–16个unique paths，至少一个staged member，且至少一个live member。
- staged只允许added或modified并携带contentDigest。
- live只允许unstaged/modified或untracked/added并携带contentDigest。
- 明确排除deleted、unstaged/added（ITA）、committed、conflict、rename/copy/type-change与duplicate/same-path
  staged+unstaged。
- 每个staged member读取Index stage-0 bytes，并要求Index = safe worktree = actual Snapshot digest。
- 每个live member读取safe worktree bytes，并要求worktree = actual Snapshot digest。
- modified路径读取baseline HEAD blob；added路径必须由baseline HEAD tree exact absence证明。
- 整批共享validated current Graph、单文件与32 MiB aggregate语义预算、1024 observations上限和pre/post full
  live Snapshot fence。
- 任一path、Git、Index、worktree、Snapshot、Graph、budget或fence失败都whole-analysis unknown：单一global
  boundary覆盖全部actual IDs，hunks与deletedFiles均为空。

旧pure staged/live、ITA与deletion profile的predicate、precedence、reason与稳定ID输入保持不变。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Repository analysis | packages/task-engine/src/repository-context-provider.ts | 新增互斥heterogeneousStagedLiveChanges profile；按每条change选择Index或worktree authority并接入既有fence/budget/whole-unknown |
| Provider regression | packages/task-engine/test/repository-context-provider.test.ts | 真实Git四kind happy、staged+unstaged-only admission、same-path partial-staging拒绝与live drift |
| Engine regression | packages/task-engine/test/engine.integration.test.ts | 锁定1 planned staged modified完成、2个live change各自blocking unplanned与三份current Evidence |
| Packed user vertical | packages/preview/test/workbench-browser-packed.test.mjs | 扩既有wrong-hunk Task为真实staged bar + untracked add，完成Finding接受、外部Verification与verified |

公开contracts、engine-types、change-intelligence、MCP schema、Dashboard production和生命周期实现均未修改。

## Review重点与结论

1. Authority按change选择 — staged member仍走Index并要求Index/worktree/Snapshot三方精确一致；live member仍走
   worktree/Snapshot，不因同批存在staged变化而被错误读取Index。
2. Profile互斥且bounded — requires至少一个staged与一种live，2–16 unique，仅允许四个冻结source/kind；
   delete、ITA和same-path dual records无法进入。
3. 两种live admission均可达 — 同一真实fixture在untracked path尚未创建时先capture，fresh Snapshot仅含
   staged added、staged modified、unstaged modified并complete；随后创建untracked path，再证明四kind complete。
4. Same-path partial staging明确fail closed — stage intermediate bytes后再次改worktree，producer发布同path
   staged/modified与unstaged/modified两条记录，各有exact digest；结果保留旧live-untracked global
   unsupported reason，覆盖全部fresh IDs且无partial output。
5. Drift整批收口 — Index、worktree、untracked inventory与stale Snapshot-ID分别触发单一global
   content_changed，无filePath/hunks/deletedFiles。
6. Planned与Actual不混淆 — Engine只计划已有staged TaskHandler并精确completed；不同路径的unstaged
   modified与untracked added分别成为blocking unplanned，无cannot_determine或possible_omission；三份
   Source Evidence均为observed/current并绑定actual Snapshot、range、node与hash。
7. Wrong-symbol false-success继续关闭 — packed Brief计划foo，但真实staged bytes只改bar，同时加入不同路径
   untracked source。Check绝不completed foo，而是foo cannot_determine、bar unplanned、untracked unplanned。
8. B Task自身完成恢复链 — 三个blocking Findings均显式accept后，真实Node命令验证foo baseline、staged bar
   行为与untracked export；全部required Verification逐项绑定actual Snapshot并passed，Task才进入verified。
9. Candidate authority闭合 — V1 overlay包含provider production与packed gate，clean ephemeral commit经
   assemble/verify/cold install；若tgz仍带旧provider，B Check会global unknown并击穿exact Finding断言。

独立contract审查与change-intent终审一致：P0 0、P1 0、current-path executable P2 0、
blocking Test Gap 0；结论为Effective / SAFE TO COMMIT。

## 测试情况

已通过：

- provider focused：1 file / 16 tests，20.17秒。
- engine focused：1 file / 35 tests，58.97秒。
- pnpm --filter @understand-code/task-engine typecheck。
- pnpm --filter @understand-code/task-engine test：包含fresh build，8 files / 80 tests，60.30秒。
- node --check packages/preview/test/workbench-browser-packed.test.mjs。
- scoped git diff --check。
- pnpm --filter @understand-code/preview typecheck。
- pnpm --filter @understand-code/preview build（fresh dist）。
- 唯一真实packed Browser门禁：
  UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 pnpm --filter @understand-code/preview test:workbench-browser
  - 1 passed / 0 failed / 0 skipped，261.044秒；
  - v1 tgz：87 entries，sha256:98a9ec4b3943b259685b17cc6f1cf4a8cbe6e4fb95a5af01ebca75126afd9588；
  - v2 tgz：87 entries，sha256:5dd617d45dbc084a6ac92b03b43b1ac3fdd5cd46e501c1f1f186727905cfa0d6。

四文件product diff在pre-heavy与post-heavy间无漂移：+854/-12，binary SHA-256为
056c0581498148b48c2bf13447f4db11cf5fac11c28e0b49ac6f1d8a6c6b277c。

未运行Plugin Host、root full、distribution、security或cross-platform矩阵：本切片不修改这些Surface；
唯一packed gate从真实candidate覆盖B的MCP Check/accept/Verification，并继续执行既有Browser、
Graph/Wiki、managed upgrade/rollback与cleanup链。

## 失败轨迹与最小修复

1. 首次测试typecheck暴露两处测试访问笔误和一处Artifact bundle union未判别；只修测试访问与显式
   \"brief\" narrowing，production未改，随后source/test typecheck全绿。
2. Pre-focused审查发现partial-staging negative若只锁source，错误kind/digest也可能因其他原因fail closed。
   最终精确锁定同path staged与unstaged两条modified记录及各自digest，并锁旧global reason。
3. Contract审查发现四kind happy同时含untracked，无法单独证明untracked在B中可选。最终同一fixture在
   untracked path尚未创建时先fresh capture，精确证明staged+unstaged-only complete，再创建它并证明四kind happy。
4. 同轮补齐planned_completed恰好一个Evidence ID，以及packed两份Evidence的source/observed/current，
   未增加Browser矩阵或放宽产品边界。

本轮functional、package与heavy gates均未出现失败；没有放宽timeout、budget或既有验收断言。

## 可声明

- 在same repository/worktree/HEAD与完整pre/post Snapshot fence下，Alpha可bounded分析2–16个不同路径的
  heterogeneous staged+live batch：至少一条staged，至少一种live；允许staged add/modify、unstaged
  modify、untracked add。
- staged与live members分别使用Index-authoritative与worktree-authoritative exact proof，modified绑定
  baseline HEAD blob，added绑定baseline path absence；任一失败整批unknown。
- Planned staged symbol可以精确completed；不同路径live hunks保持独立blocking unplanned，Evidence均绑定
  actual Snapshot/current source。
- 真实安装tgz/MCP链对staged bar + untracked add关闭wrong-plan false-success，显式接受所有blocking
  Findings，执行真实外部命令，将全部required Verification records绑定actual Snapshot后进入verified。
- 同一packed gate后续既有Browser、Graph/Wiki、upgrade/rollback与cleanup链保持通过。

## 不可声明

- 不支持同文件partial staging，也不支持本profile混入deletion或ITA；same-path dual records、rename/copy、
  committed、conflict、binary、mode-only、超过16/预算、Graph歧义继续whole unknown。
- 不声称穷尽所有staged/live排列、跨平台、crash/security或发行矩阵。
- Finding acceptance与externally_reported passed command不构成formal semantic correctness、Provider信任
  或自动命令执行权威。
- 结果仍为legacy_summary，不是evidence_backed_v1、formal diff_hunk、required expectation或五维
  Completeness/omission证明。
- Provider Authority、正式Provider-backed ABA/execution fence与strongWrites继续locked。
- 两个candidate是当前本机tuple的unsigned Alpha测试产物，不证明Release、signature、SBOM、trusted
  provenance、reproducibility、CI same-SHA或cross-platform。

## 外部阻塞保持

- Step16真实model-selected双Host仍缺隔离凭证；Claude 2.1.202低于dynamic Roots冻结下限2.1.203；
  Gold/ALPHA-B缺Owner授权与受审语料。
- Step17 GitHub Actions仍被billing/payment阻塞，latest same-SHA jobs无执行steps；CI assembler exact-four、
  signing、SBOM、provenance、cross-platform与正式RC/Release均未关闭。

这些外部阻塞不由本切片伪装关闭，目标继续保持active。

## 结论

🟢 Effective。B现在能对不同路径的staged与live变化进行bounded Change Check：每条change使用正确的
Index/worktree authority；planned staged symbol可完成，live变化保持独立blocking unplanned；同文件partial
staging、混入本B profile的delete/ITA或任一authority drift继续整批fail closed。可以精确提交。
