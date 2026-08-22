# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-22 10:41 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：f97782f feat: analyze staged changes exactly

## 背景与动机

Alpha Change Check 已能精确分析单一 staged modified 文件，但用户一次暂存两个普通修改文件时会被整体降级为
`cannot_determine`，从而中断 Brief→Check→Verification→Workbench 的常见路径。本切片在不扩大 Provider authority
或强写声明的前提下，把 staged 分析扩展为有界、多路径、整批 fail-closed 的产品能力。

## 改动策略

- 只接受 1–16 个唯一路径且全部为 `staged + modified + contentDigest` 的 actual changes；mixed source、其他 change kind、
  重复路径或第 17 个路径均整次返回 `unknown`。
- 对整批分析只做一次全局 pre/post HEAD 与 relevant Git Index digest fence；每个路径仍要求 stage-0 Index、当前 worktree
  与 Snapshot content digest 三方完全一致。
- 路径按 Unicode code unit 确定性排序；deterministic diff、Graph symbol anchor 与 Evidence `contentHash` 都使用 Index bytes。
- 聚合 baseline+actual 语义字节限制为 32 MiB，总 hunk 限制为 1024；任一路径、预算或 fence 失败都会丢弃已生成 hunk，
  返回一个覆盖全部 actual IDs 的 global boundary。
- pure unstaged 分支保持原行为；不宣称 formal `diff_hunk`、全 worktree execution fence 或 Provider-backed strong writes。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|---|---|---|
| Repository analyzer | `packages/task-engine/src/repository-context-provider.ts` | staged multipath eligibility、确定性逐路径分析、聚合预算与 whole-analysis fail-closed |
| Focused regression | `packages/task-engine/test/repository-context-provider.test.ts` | 逆序双路径 determinism、第二路径 drift 后整批丢弃、Index/HEAD/mixed/17-path 边界 |
| Packed browser path | `packages/preview/test/workbench-browser-packed.test.mjs` | 同一真实 tgz 中两 Graph symbol→两 staged paths→双 Finding/Evidence→双行为 Verification→Workbench |

## Review 重点

1. **整批一致性** — 任一路径失败后不得保留先前成功路径的 hunk 或 `planned_completed`。
2. **Index authority** — 每个成功路径都必须绑定 exact Index/worktree/Snapshot bytes，并共享同一全局 pre/post fence。
3. **确定性与预算** — 路径、hunk 和 actual IDs 的顺序必须稳定；16 paths、32 MiB、1024 hunks 的边界必须 fail closed。
4. **旧路径与能力边界** — pure unstaged 不回归，Provider、execution fence、formal evidence profile 与 strongWrites 继续锁定。

## 已识别风险

未发现 P0、P1、current-path executable P2 或 blocking Test Gap。

残余风险：32 MiB 与 1024 hunk 的数值阈值没有单独构造超限 fixture；实现使用显式单调计数，并由第二路径失败与
17-path focused regression证明 whole-analysis fail-closed，因此不阻塞本 Alpha 切片。尚未建立全 worktree execution fence，
`strongWrites` 继续保持 locked。

## 测试情况

**已覆盖：**

- task-engine focused：9/9。
- task-engine typecheck 与完整 package：8 files / 65 tests。
- 双路径 staged complete、Unicode path 排序、第二路径 worktree drift、独立 Index drift、live HEAD drift、mixed source、
  17-path 上限均按合同通过。
- Preview fresh build。
- 唯一真实 packed-browser E2E：1/1，0 skipped；同一 tgz SHA256
  `a8baa4d4cff780f54c4b0d58657a4e44e615bc3eae49136ddfa32f59018e86d4`，87 entries。
- E2E 的 Brief 硬绑定 `foo`/`extra` 两个 Graph symbol，Check 产生两个 `planned_completed` 与两份 exact `[1,1]`
  Snapshot-bound Evidence；外部 Verification 同时执行并断言两个修改，既有 Workbench Source→Graph→Wiki→Task 路径保留。
- `node --check` 与 `git diff --check`。

**缺失：**

- 无 blocking 缺口。add/delete/rename、committed、mixed layers、binary、formal `diff_hunk`、五维 completeness 与完整
  execution fence 仍是后续能力门禁。

## 结论

🟢 Effective。bounded staged multipath 现在以 exact Index bytes 完成确定性 Check→Evidence→Verification→Workbench
纵切；任一路径不满足支持边界时整批 fail closed，旧 unstaged 路径保持有效，可以精确提交。
