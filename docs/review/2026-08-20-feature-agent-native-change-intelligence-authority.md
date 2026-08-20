# feature/agent-native-change-intelligence-authority Review Brief

> 生成时间：2026-08-20 17:45 CST
> 分支：feature/agent-native-change-intelligence-authority
> 基于 commit：2882f54 feat: add locked strong-mutation broker journal
> 审查意图：交付 package-internal 的 locked trust verification 增量，并最小修复已复现的 authority lock 竞态

## 背景与边界

本切片把既有 locked broker intent 与 Installation-owner 已认证 Acceptance 历史、完整 Root/Registry 历史、active writer/key、grant、principal attestation 和 provider response 做严格密码学闭合。它仍不执行 provider I/O，也没有 authority execution fence、production lifecycle 或 live-socket principal 证明。

因此公开能力保持：

- `strongWrites: "locked"`；
- `executionFence: "not_established"`；
- 无新增 package root/export-map/CLI/runtime/client/contracts Surface；
- 不宣称 Provider Authority production-ready，也不宣称 Provider Gate 已解锁。

完整 package 门禁曾复现一项真实并发故障：loser 读取 canonical lock `nlink=2` 后，winner 正常 unlink deterministic stage，旧实现把 stage 缺失误判为 `authority_busy`。按产品纵切优先策略，本轮只做最小修复并保留一条确定性回归，未继续扩展边缘竞态矩阵。

## 主要改动

| 模块 | 结果 |
|---|---|
| `strong-mutation-trust-verifier-core-internal.ts` | 验证 historical/current strong-ready Acceptance、完整 Root/Registry history、唯一 active writer/key、strict grant signature、principal transcript/self-signature 与 response signature |
| `acceptance-store-core-internal.ts` | 在既有 key-custody/authority lock 内投影完整、已认证 generation envelopes，不泄露 owner key |
| `strong-mutation-broker-core-internal.ts` | `begin`/`resolve` 持久化可重导的 deterministic certificate；每次 load/operation 重读 evidence、重验并 exact compare；G1 pending 可在 G2 后按历史 pin 闭合 |
| `test-seam-internal.ts` | 仅测试环境注入 opaque strict verifier capability/evidence reader；公开入口不变 |
| `cross-process-lock-internal.ts` | stage 消失后重新验证 canonical；同一已认证 inode 收敛到 `nlink=1` 时按 contention 等待，已释放或合法 successor 走 bounded retry，异常 metadata/HMAC/read 仍 fail closed |
| `filesystem-internal.ts` | 只增加一个 package-internal deterministic race hook |
| tests/README | strict trust、历史 pin、零写拒绝、恢复和唯一已复现 lock race 回归；文档继续明确 locked residual |

## 审查结论

独立 change-intent/security 复核未发现 P0、P1、P2，也未发现数据损坏、越权或错误成功路径。

已确认：

1. fresh begin 必须绑定锁内当前 Acceptance；既有 G1 pending 在 G2 后仍按 retained G1 history 验证、resolve 和 restart replay。
2. grant、principal 与 response 的严格验证失败发生在 broker 首写前；invalid evidence 保持零 intent。
3. durable certificate 只含可从 formal inputs/validated history 重导的 pin/material，不保存 raw owner key、private key、路径或 capability identity。
4. 每次 load/operation 都创建短生命周期 validation session；cache 不跨 load，且只复用 exact history pin closure。
5. lock regression 确实命中 `canonical nlink=2 → stage unlink` 窗口，loser 进入正常 contention/retry；winner 提交后旧 begin 返回 `invalid_request`，broker 仍为零 intent，而不是错误 `authority_busy`。
6. public exports、CLI、runtime、client、contracts 未被解锁或扩面。

## 验证证据

- authority package typecheck：通过。
- authority package build：通过。
- authority package test：11 files，219 passed / 3 skipped；skip 仅为非-root环境无法制造的 owner-mismatch negative fixtures。
- lock focused process：23/23；唯一新增 race regression 通过。
- `git diff --check`：通过。
- 独立只读终审：无阻断 finding。

按新的分层门禁策略，本次 package-internal 小切片没有重复运行 root/distribution/cross-platform 重门；这些只在 Alpha 里程碑或发布前运行。

## 明确保留的 backlog

- authority-to-provider execution fence 与 crash-recoverable provider outcome 尚未建立；
- production lifecycle、live-socket kernel peer、target fingerprint 与安装信任来源尚未闭合；
- global Root/Registry/Catalog/Acceptance D-40 admission 与 OS/hardware rollback anchor 尚未建立；
- open-FD、canonical fully released、三方 authenticated turnover 的额外动态矩阵，以及显式 cross-load cache 失效回归，按用户裁定作为非阻断 test backlog；
- 以上能力在真正接入产品路径并进入正式解锁/发布门前补齐，当前不据此宣称 production authority。

## 结论

🟢 Effective within confirmed scope：locked trust verification 与 durable broker binding 已闭合其内部承诺；已复现的 lock 竞态完成最小修复和确定性回归。该增量可以提交，随后应停止扩展内部 candidate，转向可安装、可启动、可体验的 Alpha 产品纵切。
