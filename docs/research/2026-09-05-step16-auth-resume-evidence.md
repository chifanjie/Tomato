# Step16 当前任务续跑证据（2026-09-05）

记录时间：2026-09-05 04:35:51 UTC。当前任务：`01a06f5a-3520-74c3-a0f1-99b946eb021a`。
基线 HEAD：`0035d2376085dcd46d3ef13fb90b7dfa2370f998`。下述修复仍在工作树，尚未提交或发布。

## 范围与断点

完整的 17 步目标已写入当前任务的 active Goal；保持 Step16 进行中、Step17 未完成。
沿用原 Provider、Task、Snapshot、Check、Verification 和知识发布链路。
本轮曾添加的本地 `analyze` Graph/Wiki 探针已经撤销；它不参与 Provider active generation，且直接写入路径缺少 symlink/原子写入保护，不能作为最终产品成果。
用户原有脏文档、site、缓存、拓扑证明和未跟踪 Provider 源码/测试未被清理。

## Codex 登录预检修复与纠正

`test/step16-root-fixed-workflow-linux.mjs` 原先仅检查 Codex `login status` 退出码。
第一次修改只检查 stdout，随后真实 CLI 的独立流捕获证明该修改有误：退出码为 0，stdout 为空，stderr 包含已登录状态。
最终修复接收 `execFile` 的 stdout/stderr，要求明确已登录行，并拒绝任一流中的 `Not logged in`、空输出或无已登录行。
保留 `preflightOnly` 在 auth 调用前返回的原行为；没有增加模型调用、凭据读取或 Provider 权威。

最终修改的验证：

- `pnpm --filter @understand-code/durable-object-provider-runtime typecheck`：exit 0，含源代码和测试类型检查。
- `pnpm --filter @understand-code/durable-object-provider-runtime exec vitest run test/provider-production-strong-object-three-principal-linux.test.ts`：21 passed / 14 skipped，exit 0。跳过项仍受 Linux/root 等条件限制，不计作通过。
- 8 个双流回归使用真实 Node 子进程和 `execFile`，覆盖两种单流成功、两种未登录输出、两方向互相矛盾输出、空输出和未知状态。
- 使用真实本机 Codex CLI 的只读 `login status` 调用并交给最终解析器：`loginStatusAccepted:true`、`stdoutEmpty:true`、`modelInvoked:false`。未保存原始账号信息。
- 精确两文件 `git diff --check`：exit 0。

较早的 147 passed / 16 skipped 全包结果发生在双流纠正之前，不冒充最终修改后的全包运行结果；最终修改的相关验证如上。

## 当前授权与真实阻塞

本机默认环境 Codex CLI 的状态为已登录；Claude `auth status --json` 仍返回 `loggedIn:false`、`authMethod:none`，exit 1。
本任务已启动官方 `claude auth login`，Chrome 的 `Sign in - Claude` 页面已打开；session `69613` 经工具轮询仍存活，没有成功输出，等待用户认证。没有重复启动、代填凭据或调用模型。

以上仅证明本机默认环境状态，不证明原隔离 Linux/root Host profile 已认证或可执行。即使本机登录成功，仍须核对原隔离 Host 的实际授权与安装绑定；不得复制本机凭据或据此设置模型授权开关。

Host Adapter 只读审计未发现可安全推进 16-B/16-E 的新实现缺口。已有安装/升级/卸载和手动 MCP 子进程测试不能代替已认证 Host 的模型选择工具调用。
真实双 Host Task 修改、Check、Verification、Provider verified、待审知识发布仍未运行。
24 Gold Task 的版本化/复核、Alpha-B owner 授权、CI 有效凭据及正式发行的签名/SBOM/provenance 等原阻塞未被本轮解除。
本轮不声明 G2/G3、CI green、Step16 完成或正式 Release。

## 恢复条件

如果用户之后选择完成官方登录，先只读复核认证状态及原隔离 Host profile，再执行原授权范围内的真实流程。
完整目标保持不变；本证据不降低任何发行要求。

## 用户后续指示：暂缓 Claude 登录

用户随后明确要求「claude先不要登陆，我这好象登陆不上去」。本任务已向自己启动的 session `69613` 发送 Ctrl-C，确认 exit 130；不再保留等待中的登录流程，也不再尝试 Claude 认证。
前述存活状态是取消前的历史观察。后续仅推进不依赖 Claude 的工作，双 Host 目标保留为未完成，不将本机 Codex 登录外推为原隔离 Host 的成功。

## 不依赖 Claude 的生产索引切片

在 Claude 登录暂停后，生产 `repository-indexer` 已从简化 TypeScript 正则解析切换到固定的 Tree-sitter 解析 profile。
现有 TypeScript、JavaScript、Python、Go、Rust、Java、Ruby、PHP、C/C++、C# 语法资产由 CLI 构建器读取并以 Brotli 压缩的固定 bytes 嵌入完整 CLI；安装后不再查找可变的外部 WASM 路径。
解析器初始化对 runtime、grammar 缺失、摘要不匹配和解压越界均失败关闭；Provider 的 Snapshot、Task、Check、Verification 和发布边界未改变。

`repository-indexer-security.test.ts` 新增实际 TS/Go 结构、import edge、稳定 digest 和模板字符串误识别回归；仓外单文件解析测试在无 `node_modules`、空 `NODE_PATH` 的临时目录中通过，stderr 为空。
当前 CLI 构建文件大小为 3,865,380 bytes，仍低于原 4 MiB 单文件上限。新的 Preview tgz 为 6,174,224 bytes、解包 16,947,422 bytes；只将旧的聚合 tgz 预算调整到 8 MiB，单文件、插件总量和解包总量限制保持不变。
调整后冷打包 Alpha 测试通过；插件生命周期测试为 7 passed / 2 skipped，真实 Codex/Claude lifecycle 子项通过。它们仍只是安装与锁门证据，不是已认证模型任务或 Gold 证据。
