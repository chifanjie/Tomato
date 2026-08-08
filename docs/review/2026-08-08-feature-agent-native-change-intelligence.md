# feature/agent-native-change-intelligence Review Brief

> 生成时间：2026-08-08 20:05（Asia/Shanghai）
> 分支：feature/agent-native-change-intelligence
> 基于 commit：151b106 docs(wp5): freeze registry evidence binding point

## 背景与动机

本切片交付第 15-A 的 C09-1L Provider aggregate：把 production Registry Entry、passed QA/Release Evidence 与调用方提供的完整 Root/Registry 历史闭合为可安装、可回放、但不授予 I/O authority 的结构化验证结果。验收基线要求安全失败关闭、354 条语料完整回放、真实冷打包 Node/Vite/browser 安装验证，以及 600 秒/1536 MiB 的专属发布门禁。

## 改动策略

实现新增 Registry/Evidence binding point、prepared history 内部桥、固定 fixture/Schema/topology proof 和双 adapter verifier；严格 Ed25519 capability 在 KAT 后逐调用与参考实现对照，阻断有状态 Host、异步漂移和超时绕过。分发侧提供 browser-safe Zod 私有 runtime、静态依赖扫描、四逻辑 lane（最多三个同时活跃）的 Node/browser 回放，以及 50ms 同采样进程树 RSS 监控；legacy Node/type/main Vite KAT 仍在专属资源窗外真实执行并失败关闭。

## 改动范围

| 模块/职责 | 文件 | 做了什么 |
|-----------|------|----------|
| Provider aggregate | `packages/durable-object-provider-contracts/src/provider-registry-evidence-binding-point*.ts` | 22 字段 raw admission、prepared closure、24/46 crypto 闭包和 10 字段 none-authority projection |
| 安全与运行时 | `packages/durable-object-provider-contracts/src/strict-ed25519*.ts`、`src/zod-runtime.ts` | Stateful Host 逐调用对照、deadline/Promise hardening、浏览器私有 Zod wrapper |
| 证明与资源 | `fixtures/v1/**`、`schemas/v1/**`、`scripts/generate-provider-registry-evidence-binding-*.mjs` | 354/12 fixture、275 Schema inventory、21 分支 topology proof 与固定锚点 |
| 分发门禁 | `packages/durable-object-provider-contracts/scripts/test-distribution.mjs`、`scripts/lib/provider-registry-evidence-binding-distribution-*.mjs` | cold pack/install、Node/Vite/browser 回放、依赖扫描、进程树资源门禁与 fail-closed 清理 |
| 发布接线 | `packages/durable-object-provider-contracts/package.json`、`README.md`、`pnpm-lock.yaml` | 两个公开 subpath、sideEffects、browser mapping、verifier/prepack 接线和边界说明 |
| 合同记录 | `docs/prd/2026-07-27-agent-native-change-intelligence-rd-plan.md`、`docs/research/**` | 同步最终 caps、资源哈希、不可达诊断与 trusted-realm 边界 |

## Review 重点

1. **安全失败关闭** — capability 不能在有限 KAT 后漂移为恒真/恒假，Host-owned Promise 不得被修改，超时结果不能被接受。
2. **证明与生成固定点** — 21 个 production parser binding、181,122-byte topology resource 及 Schema/文档锚点必须一致。
3. **真实分发兼容** — clean source 必须经过真实 pack/install，再在 Node、主 Vite/browser、minimal Vite 和四逻辑 replay lane 中执行。
4. **资源门禁真实性** — D-37 只归因规范 C09 段，按同一 50ms 样本汇总父进程、monitor 和所有存活 descendants；legacy 回归不得被删除或 mock。

## 已识别风险

未发现 P0、P1 或 blocking P2。非阻塞 P2：根 quality 单测没有单独锁定 `test:distribution` 脚本文本映射，但完整命令链已被结构断言覆盖，并在 standalone distribution 与根 quality 中各真实执行一次；本切片不再新增证明层。

## 测试情况

**已覆盖：**

- Provider：53 files / 488 tests；354 个唯一 case、12 个连续 shard、成功 24/46。
- standalone distribution：exit 0；D-37 324,207.2ms，tree RSS 1,598,750,720B。
- 根 `CI=true pnpm quality`：exit 0，2042.28s；内部 D-37 286,811.3ms，tree RSS 1,538,211,840B。
- Contracts 135、Repository State 67（另 1 skip）、Artifact Store 125、Root 95、Core 923、Task Engine 60、CLI 21（含 cold-pack E2E）、Dashboard 560。
- topology generator `--check`、Schema/fixture generation checks、`git diff --check` 和受保护文件审计均通过。

**缺失：**

- 无阻塞测试缺口；提交后仍需在远端验证同一 commit SHA 的 CI。

## 结论

🟢 Effective。C09-1L 的实现、固定资源、真实分发和资源门禁与已确认意图一致，可以进入精确暂存、提交、推送和同 SHA CI 验证。
