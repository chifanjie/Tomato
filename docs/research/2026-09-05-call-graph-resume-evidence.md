# Step16 生产调用与仓内依赖续跑证据（2026-09-05）

本轮在 Claude 登录暂停后继续推进本地代码，未读取凭据、未调用 Claude 模型，也未改变 Provider/Task/Verification 权威边界。

生产 `repository-indexer` 现在在固定 Tree-sitter profile 上建立调用解析输入：TypeScript/JavaScript 只接受语法树能证明的同文件函数或导入绑定；Go 识别 package clause、同目录同包顶层函数和导入别名。无法证明的动态调用、标准库、外部模块、作用域遮蔽和歧义目标保留为 unresolved，不生成调用边。Go 模块导入使用已通过安全源码清单读取的 `go.mod`，精确匹配 module 前缀并拒绝嵌套 module 穿透、路径遍历和 `_test.go`/忽略文件。

调用边保留静态来源、源码文件、行号和解析置信度；重复边会确定性合并。它们仍是静态推断，未被伪装成运行时 Evidence 或 Verified 知识。

验证记录：核心整包 958 项通过；CLI 整包 250 项通过；冻结后重新运行的 TS/Go/call-resolver 61 项通过；生产索引、仓内导入和无 node_modules 的嵌入解析器 16 项通过；Preview 冷包 Alpha 通过（14 秒）。当前仍未声明双 Host 认证任务、24 Gold Task、签名/SBOM/Provenance 或正式 Release 完成。Go 不同 receiver 的同名方法现在使用唯一符号身份保留在图中；动态方法分派仍按 unresolved 处理，不会被当成静态确认调用。
