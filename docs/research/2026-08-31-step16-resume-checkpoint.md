# Step16 续跑检查点（非需求扩展）

本文件只记录实际实现断点，不新增验收项，不代替真实运行证据。范围仍以 `151b106` 冻结基线及目标附件为准。

## 当前游标

- 第15步已完成；第16步进行中；第17步未完成。不要从旧 goal 元数据中的 Preview/第15步游标重新开始。
- 本切片基于 `4ef39e4`；所属提交用 `git log -1 -- docs/research/2026-08-31-step16-resume-checkpoint.md` 查询。
- 生产链路仍保持 `providerReceiptBinding: "not_bound"`，不得将本地测试写成 Step16 Gold。

## 本轮已实现并验证

- Provider operation-plan 双端 UDS：原生 peer 凭据生产入口、固定 run/plan/sequence、观察完成后才 ACK；并发失败和绝对截止时间均拒绝后续放行。
- Witness UDS：只投影公共绑定，最终结果成功写出后才算完成；挂起回调、断连和关闭均有界失败，迟到结果不 ACK。
- 私有 durable journal：arm 固定运行、计划、会话和调用身份；跨调用累计操作上限；合法状态转移恢复、完整 broker prefix/suffix 核验。
- Host executor：失败先通知 AbortSignal，停止后续观察；销毁失败后的暂停 stdout，修复“Host 已退出但 close 永久等待”。正常成功路径保留。
- 三个包 typecheck/build 均通过。最终包级结果：Host 66/66；Authority 389 通过、5 个既有环境相关跳过；Client 已跟踪测试及本轮新增测试 65/65。
- Client 未纳入受保护的用户未跟踪 `provider-runtime-strong-mutation-client-internal.test.ts`；不修、不删、不暂存该文件来改变结果。
- 本切片独立复审及 finding 定向复核已收口；没有新失败证据时，不再启动同类全面审计或重跑未变化的长测试。

## 从这里继续

- 完成 root supervisor 的真实纵向接线：Host call start/complete、gateway operation-plan relay、authority witness 和 journal。当前内部端点已实现，生产 composition 尚未闭合。
- Journal 目前限定同一 host/run/plan/session 的递增调用；没有下一 run reset。调用方必须持有跨进程 authority lease 并核验 broker ledger；单独 finalize 不是 Gold。
- 不以 root 直接启动普通 Host CLI。正式运行仍需可信可执行文件/依赖闭包及隔离身份，并取得完整真实 Host session 证据。
- 本机已确认 Darwin、uid 601；真实 Linux/root/ext4 验收不能由本轮本机测试替代。真实任务输入、双人 Product/QA 验收、ALPHA-B/owner 输入及同 SHA CI 仍须按原验收记录核对。
- 原有三份脏文档、`site/`、`.learnings/`、`.pnpm-store/`、topology-proof 和用户未跟踪源码/测试继续保持不动。
