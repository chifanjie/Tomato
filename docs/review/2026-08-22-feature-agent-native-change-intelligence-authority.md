# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：9058be1 feat: manage React Workbench lifecycle

## 背景与目标

Alpha 的 Check 已能在真实仓库中比较 baseline 与 actual Snapshot，但此前只按文件路径匹配计划：计划修改
`foo`、实际只修改同文件的 `bar`，仍可能被错误标为 `planned_completed`；`actualSnapshotId` 还可省略并静默
回落到 latest。这个切片把 Check 固定到调用方明确指定的 actual Snapshot，并为当前可支持的干净、同 HEAD、
单一 unstaged 文本修改生成确定性的行级变化，再映射到当前 Graph symbol 与可下钻 Source Evidence。

## 实现策略

- `check_change.actualSnapshotId` 改为必填，CLI 与 Engine 均不再隐式读取 latest。
- Repository Context Provider 只在 baseline/actual Snapshot 完整、baseline 全局干净、同 repository/worktree/HEAD、
  变更为唯一 unstaged modified、实际字节与 Snapshot digest 一致时分析。
- 使用有界、确定性的行 LCS 生成 raw hunk；相邻变化按每行唯一最窄 Graph owner 拆分 symbol cluster。
- planned symbol 只有命中对应 cluster 才能完成；未计划 cluster 是 blocking `unplanned_change`；legacy 未命中计划
  因缺少 required-change expectation，保守返回 blocking `cannot_determine`，不伪造 omission。
- 不完整、歧义、越界、binary、Graph anchor 不一致或 analyzer coverage 不一致统一 fail closed。
- Workbench Source Evidence 精确绑定 actual Snapshot、content hash、1-based line range 与排序后的 Graph node IDs。

## 改动范围

| 模块 | 主要文件 | 作用 |
|---|---|---|
| Contracts | `packages/contracts/src/change.ts`、generated schemas/tests | actual Snapshot 必填；移除会被静默忽略的 `verificationRecordIds` |
| Diff/analysis | `packages/task-engine/src/change-analysis.ts` | 有界确定性 line diff 与 symbol cluster |
| Task Engine | `change-intelligence.ts`、`engine.ts`、`engine-types.ts` | trusted analyzer、严格一致性校验与 fail-closed findings |
| Repository provider | `repository-context-provider.ts` | exact Git baseline、actual safe read/digest、Graph anchor 重验 |
| Packed CLI | `repository-indexer.ts`、`handlers/tools.ts` | TS/JS Alpha symbol fallback；移除 latest fallback |
| Product E2E | `workbench-browser-packed.test.mjs` | 同一 tgz 验证 wrong-symbol 拒绝与 correct-symbol happy path |

Schema 生成同时收敛了当前源码早已存在、但未落到 generated JSON 的 rebase/guard drift；这些生成文件没有扩展
本切片的产品能力，只是保证仓内 source/schema 一致。

## Review 结论

🟢 Effective。独立终审未发现 P0/P1、current-path P2 或 blocking Test Gap。

重点核验结果：

1. idempotent replay 在任何 analyzer/文件系统读取之前返回。
2. Git 子进程不经 shell，清除 ambient `GIT_*`，禁 system/global config、prompt、replace 与 optional locks。
3. foo/bar 相邻变化会拆成独立 `[1,1]` / `[2,2]` cluster，计划 foo 不会吞掉未计划 bar。
4. analyzer 的 status、boundary、actual change IDs、path、hash 或覆盖关系不一致会整体 fail closed。
5. Evidence ID/Finding ID、输出排序、line range、node IDs、content hash 和 Snapshot 绑定均为确定性。
6. Packed lexical fallback 仅限现有 TS/JS 扩展白名单；复杂、重复、nested 或歧义声明不会冒充可信 symbol。

## 门禁证据

- Contracts package：13 files / 135 tests；52 schemas 与 28 fixtures verify 通过。
- Task Engine package：8 files / 64 tests；Repository Context Provider focused：8/8。
- CLI typecheck；CLI MCP integration：6/6。
- Preview typecheck/build。
- 单一真实 Chrome packed E2E：1/1，0 skipped，覆盖 bar-only 错配、foo-only 正确完成、externally reported
  Verification、Workbench 精确 Source→Graph，以及既有 lifecycle/rollback/Doctor/uninstall。
- 安装产物 SHA-256：`15649d2f924a5e8cf7b94e0a6fe9909f0abf73aeb5b8d916bcfb223304076a33`；87 entries。
- `git diff --check` 通过。

## 明确限制与后续 backlog

- 这是 Alpha snapshot-bound source anchor，不是正式 `diff_hunk` Evidence，也未实现 patience/Myers、old/new refs、
  五维 completeness 或 required-change omission 证明。
- 当前只支持 clean baseline、same HEAD、唯一 unstaged modified、UTF-8 且预算内的 TS/JS 路径；staged、committed、
  add/delete/rename、binary、dirty baseline、`.mts/.cts` 与 rich/nested symbols 均 fail closed。
- `actualSnapshotId` 必填且移除 `verificationRecordIds` 是 Alpha 预发布接口收窄；旧调用方会明确失败而非静默降级。
- Graph、Git object store、本机 Git binary、Snapshot PathSafe identity 尚未建立完整 trust chain 或 execution fence；
  transaction aggregate budget 与 Windows/cross-platform 证明留到后续里程碑。
- Verification 仍是外部执行后报告的记录；Provider Authority 与 `strongWrites` 继续保持 locked。

## 最终判断

用户现在可以在安装后的真实仓库中明确指定 actual Snapshot 运行 Check：同文件的错误 symbol 修改不会再被错误
判为完成；正确 symbol 修改可在 Workbench 下钻到精确源码行并定位 Graph 节点。能力边界保持诚实，适合精确提交。
