# Step16 续跑检查点（非需求扩展）

本文件只记录实际实现断点，不新增验收项，不代替真实运行证据。范围仍以 `151b106` 冻结基线及目标附件为准。

## 当前游标

- 第15步已完成；第16步进行中；第17步未完成。不要从旧 goal 元数据中的 Preview/第15步游标重新开始。
- 当前续跑：HTTP 接口已提交推送为 `6b5f12bf72b702f631b27a7399d312e48c89dd5f`，255项受影响完整测试与构建通过，不再重做。双 Host 的共享 MCP 流程指引及固定真实 Host 运行器知识发布接线已通过本轮受影响完整门禁，见下一节。界面源捕获仍被浏览器工具拦截，按 Product Design 暂停前端修改，未以HTTP测试代替视觉验收。
- Task 待审知识/Verified 发布后端闭环已提交推送 `700d204157ef56d1f47cabf2a9c89409522a714d`，本地/远端SHA一致，基线是 `23acd18977e3675a01b1f25916127aab67b85910`。不要重做历史浏览、原生插件生命周期或第15步；未完成的界面接线、真实模型任务和发行门保留在文末。
- 2026-09-01：基于已推送的 `c38ee27` 完成显式已发布知识版本浏览切片，提交 `23acd18`；待审 Task 知识增量及 Verified 后晋级后端已在本切片接续完成，不再重做历史读取入口或已通过的插件生命周期。
- 双插件切片的 21 个文件已精确提交并正常 push 为 `bf50a798055f3f2d5fe288a1f452f1381864ad28`，远端分支 SHA 已逐项核对相同。以下实现与无模型 E2E 证据均保留，不重新打开已关闭的包测试或插件预检。
- 上一代码切片已提交并正常 push 为 `ecc9d3b60252de14a665bbe24e56e601dae7b9a3`，其基线是 `38a70ae`。本轮实现与验证记录如下；不因恢复任务而重跑未改变的完整包测试。
- 默认生产入口仍保持 `providerReceiptBinding: "not_bound"`。内部 root runner 已完成接线，实际 Linux 双插件无模型入口验证已通过；真实模型完整任务尚未执行，不得将以下测试写成 Step16 Gold。

## 双 Host 知识流程接线（6b5f12b 基线）

- 完整 MCP `initialize.instructions` 现在返回两端共享的 Task→Check→待审候选→外部 Verification→Provider verified→知识发布指引；仅已有11工具的完整 profile 包含它。明确指引不授权额外调用、不解锁默认 strong writer、pending 不是当前证据、stage成功不代表已审阅、候选UI尚未接通。实际安装后从两端wrapper读到相同指引，不等同于模型已执行；没有新增Tool或改Schema。
- 原 root-owned 固定真实 Host 运行器接入 `knowledge.stage` 和最后的 `knowledge.publish`，全部业务调用仍由实际 Host CLI 会话执行。stage不进入Provider强写计划且要求Store/Snapshot/Pulse/Provider cut前后不变；publish先读真实Provider verified投影，独立派生候选，再核完整active generation、仅来源晋级的候选字节及原Provider index/refresh绑定。仍为 `verified_not_gold`，不宣称模型流程已执行。
- 私有运行器只读子进程复用原indexer源码和Node原生类型擦除；在读取前清除附加组并降权到实际候选属主，保留owner/no-follow/摘要校验，不增加CLI公开导出或新证明层。worker与authority均独立使用同一固定读取路径，不从Host自报结果获取发布权威。按原Node22 CI核对后改为能力检测，不提高产品Node最低版本、不修改CI；官方Node22.18临时副本已按同版SHASUMS256验证，原生读取定向实际通过且stderr为空，没有警告豁免。
- 最终主线CLI源/测试typecheck、正常Preview build、完整CLI 241 passed/0 failed（含冷安装与双安装wrapper回归）通过；新增两项初始化测试先红后绿。单独构建原 `preview_three_tool_v1` 并实际initialize/tools-list，确认instructions省略、工具仍3项、stderr为空且exit0。主线用官方Node22.18独立运行Runtime源/测试typecheck、build及完整包：146 passed/16平台跳过，17.39秒、exit0；没有重复未改变的CLI门。
- 新增8个owner/UID专属用例只属于原Linux/root运行面，未给普通Node22 workspace CI提权或放宽检测。作者已在原Alpine VM/Node24/root实际运行全部8项：8 passed/19未选中、16.39秒、exit0；包含完整候选/原字节晋级、篡改与symlink拒绝、刻意继承root附加组后的清组降权，以及root直读被拒绝。主线已读取原始命令/完整summary；这补足本地跳过中的8项，不将其它平台skip写成通过，更不计真实Provider/模型任务或Gold。
- 本轮唯一post-fix独立只读复核已完成，10个暂存文件无可执行P0/P1/P2 finding；默认锁、三工具Preview兼容、原候选独立读取、Provider verified后精确晋级、7次强调用/25事件、import前清组降权及Node能力检测均已核对。未扩大审查范围或重复门禁，本切片可提交收口。
- 本轮只检查一次原Codex登录session16592：仍运行、无成功输出；不重启登录、不读取或复制凭证、不调用模型。用户已再次收到本地页 `http://127.0.0.1:62549/` 手动访问确认请求；未恢复源捕获前不改UI。没有重跑已通过的旧双插件preflight/生命周期、Provider或ArtifactStore全包。
- `6b5f12b` 的[Actions run33428815702](https://github.com/chifanjie/Tomato/actions/runs/33428815702)此前已核验：jobs未启动，annotation为账户付款/spending limit；不是代码失败或CI green，无外部变化不重试同一run。

## Task 候选审阅 HTTP 接口已实现（700d204 基线，提交6b5f12b）

- 在现有已兑换 Workbench 会话内，`GET /tasks/:taskId/knowledge-candidates.json` 返回该Task的知识候选；严格复用会话Task绑定，不接受query覆盖Task。列表上限32、逐候选验证完整文件集合与摘要、owner/mode/no-follow，缺目录返回空列表且不创建目录，不清理任何候选。
- 沿用5个知识GET，通过 `indexVersion=pending&indexGenerationId=<候选代际ID>` 读取同一候选的Graph/meta/Wiki索引/搜索/正文；pending连meta也要求精确ID。Task仅来自会话route，跨Task、未来Task revision、不同当前Snapshot、任意页面路径、重复/额外query均拒绝。候选meta明确 `status:"pending", readOnly:true, evidenceEligible:false`，不改变Task/Evidence读取或任何Provider/Store状态。
- pending/list在读取前后复用现有 `inspectStrongRefreshAuthority`，与ArtifactStore已验证Snapshot/Pulse envelope的contentDigest精确匹配，并复核Task revision；无active知识的首次候选可读，但缺Provider refresh绑定不可退回本地。候选自摘要不是来源权威，发布仍必须走 `700d204` 的verified+确定性重建门。
- 已发布meta新增可选来源lineage：Task ID/revision、Snapshot、前驱/候选代际、Check及Verification IDs；只在原Provider五字段pin前后核验后给出，不暴露request/key digest。列表仅凭此认证lineage标记 `publishedGenerationId`：发布后的原候选仍保留，不能把所有候选都称为“未发布”。初次非Task发布保持无lineage兼容。
- 主线真实index build/save/publish文件及真实loopback会话/HTTP集成9项先红后绿；Task、Snapshot/Pulse和Provider权威读端口使用明确fixture，不冒充真实ProviderStore、原生模型或Gold。最终完整门禁：Workbench Runtime 16 passed、CLI 239 passed，共255、零失败；Runtime/CLI类型检查、正常Preview build及精确11个Tool清单通过。没有修改前端或重跑未变化的Provider/TaskEngine/ArtifactStore全包与原生插件预检。
- 一轮独立只读复核完成，无可执行P0/P1/P2。源码与测试已冻结；当前HTTP能力具备精确提交条件，不据此关闭第16步。
- Product Design已盘点App/TaskFirstWorkbench/知识版本与路由，但内置浏览器和Chrome均无法导航原 `http://127.0.0.1:62549/`，报 `net::ERR_BLOCKED_BY_CLIENT`；原自有UI进程PID26156仍在，未重启或改安全配置。已请用户手动确认页面能否打开。当前 `design-qa.md` 明确 `final result: blocked`，三屏/交互/a11y及UI接线均未完成，没有复用旧图冒充当前源捕获。
- 本轮原Codex登录session16592经一次handle轮询确认仍运行、无新输出；没有重启登录、读取/复制凭证或调用模型。基线700d204的[Actions run33424808594](https://github.com/chifanjie/Tomato/actions/runs/33424808594)已核验：steps为空，annotation为账户付款/spending limit，非CI green；没有重试或修改计费。新提交须核验自己的SHA/run。

## Task 待审知识与 Verified 发布后端已实现（23acd18 基线，提交700d204）

- 不新增 Tool：`refresh_index` 的可选 `knowledge.action=stage|publish` 要求 full 模式、明确 Snapshot 和 Task revision；仅读取 Task，不借刷新改变 Task 状态。未验证候选独立存于 `.understand-code/index-pending-v1`，不写 Provider business cut、Snapshot、Pulse 或 active index。默认公开 strong writer 继续锁定。
- 候选记录 Task/Snapshot/前驱知识版本及请求摘要，来源文件进入 generation 摘要。保存/读取校验完整文件集合和摘要、canonical/no-follow/owner/权限；32项满额拒绝、不驱逐待审数据。同key异请求返回既有 `idempotency_conflict`；真实进程退出或SIGKILL后的完整锁仅在PID明确不存在时精确恢复，活进程/残缺锁保持失败关闭。
- 发布要求真实 Provider committed `update_task → verified` 投影，不把本地Task状态或record_verification成功当权威；再按原Snapshot和固定分析器重建候选，完整generation全等后只晋级原候选字节。复用原full prepare/finalize/本地原子发布与重放，已发布Task知识不能通过省略knowledge参数的普通full覆盖。
- Verified 提交复用既有验证计划/claim/Check门禁，新增Provider精确对象/CAS和本地投影恢复；不新增Provider证明体系。root固定真实Host recipe已把verified计为第6个strong调用，尚未运行真实模型，不能写成Gold。legacy接受skip行为保留；strong记录本来没有可接受skip语义，不在本轮扩展。
- 最终完整门禁：Contracts 189 passed、Artifact Store 186 passed、Task Engine 102 passed、CLI 226 passed，共703项、零失败；其中 Task Engine 包含3项真实 ProviderStore 垂直用例，CLI包含冷安装及双Host安装生命周期。Contracts源类型检查及Artifact Store/Task Engine/CLI源与测试类型检查通过，68份Schema/28个fixture及15个打包入口校验通过。正常 Preview build 成功，CLI完整测试在该构建及类型检查后运行。只有两个refresh发行JSON Schema更新。
- 另有候选/刷新/来源认证/安全整合72项、Authority/Task定向60项通过（已被完整包测试覆盖，不重复计数）；root recipe定向5项通过、13未选中，非Linux/root或真实模型E2E。本轮不修改前端、不重复未变化的界面或原生插件预检，不将这些结果写作第16步或Gold通过。
- 一轮独立全范围复核及唯一P2定点复核均完成，无剩余finding。真实strong Task `record passed → block_task → resume_task → verified` 已修复并由真实ProviderStore回归覆盖：仅精确重建认证来源允许的状态后缀，完整比较bundle/artifacts/receipts，拒绝本地篡改验证、证据、claim和计划。崩溃后的精确原intent/nonce重放恢复亦覆盖Provider已提交且另一业务head随后前进的情况。
- 本轮只轮询一次原Codex登录session16592，仍无成功输出，未重启/复制凭证/调用模型；Claude沿用文末用户终端脚本。`23acd18` 的Actions run `33417528367`此前已确认因付款/spending limit未启动，不是代码失败或CI green，无变化不重试。受保护文件仍不动。

## 已发布知识版本浏览已实现（c38ee27 基线，提交23acd18）

- 五类知识 GET 新增显式 `indexVersion=published`；除 meta 首次发现外，必须携带精确 `indexGenerationId`。重复/非法选择器、Task/config越界请求均拒绝。默认 current/MCP/Task/Evidence 的最新 Pulse 与现有会话/Root/Snapshot 绑定未放宽；过期 Workbench 会话仍需重新打开，不能用历史读取绕过。
- 历史只读仍要求当前 Provider 精确 pin 的 active generation：Snapshot、finalized revision、generation ID、manifest digest、inventory digest 五项一致，并在读取后再次复核 Provider 与会话。Graph/meta/Wiki 从同一摘要绑定 generation 互校 commit，不把本地旧 Snapshot 当权威。这里只读上一次有效发布，不是任意历史版本列表；未修改 Provider 合同或默认 strong-writer 锁。
- 沿用现有 Task/Graph/Wiki 页面，显示来源 Snapshot 及“历史知识·只读/不能作为当前任务证据”。Graph、Wiki、搜索、Markdown 共用 generation 固定读取；版本切换同步清缓存并用 epoch 拒绝旧请求回写，取消迟到元信息不重新安装旧版本。Task链接不因版本切换或重试改变。
- 一次独立收口复核及同 finding 定点核对已关闭：旧 Wiki fallback 搜索缓存串代、内部 reader factory 被 barrel 星号导出、Task surface 同步清掉用户主动 Wiki 焦点。另纠正 Graph/Wiki 同时失败时的误导文案，以及手机版本条挤窄；历史模式仍不自动应用当前 Task 证据焦点，保留 Overview/自由探索和主动双向跳转。
- 新回归先红后绿。受影响完整包门禁为 WorkbenchRuntime 12 passed、CLI 191 passed、Dashboard 606 passed，共809；三个包源代码/测试类型检查通过。最后纯响应式 class 修正后正常 Preview build 成功。没有重跑未变化的 Provider/Authority/Host 包或原生插件生命周期，也不把这些结果写为 Step16 Gold。
- Product Design 按既有界面做当前轮 source capture 和1280×720、768×1024、390×844成对比较；最终鼠标切换、搜索、loading、503恢复、Wiki→节点→正文、返回current/Task通过。截图在`/tmp/uc-published-knowledge-NNsX57/`，详细界限见根目录`design-qa.md`。这是生产 HTTP/UI 加隔离数据 fixture，不接 Provider、不调用模型；完整键盘/a11y尚未确认。
- 最终 Dashboard inventory 为 `sha256:ab6a7e0dee304af35e9d110854248c48c57f33c4257efa78f1b37f265eb1cc4e`。自有UI fixture仍在`/private/tmp/understand-code-ui-fixture.RjlV3LyC`；当前launcher `http://127.0.0.1:62549/`，PID26156（session30298），状态文件已恢复historical。仅重启了已核对argv的旧自有UI进程，没有改生产token TTL或凭证；未替换VM等待登录的原生插件包。
- 本轮末只轮询一次既有 Codex 登录 session16592：仍运行、无新输出，未收到成功；未重启登录或读取凭证，Claude未新启动授权。真实模型 workflow、待审知识增量/晋级、原发行门仍未完成；本切片不声明CI green，也未重试此前账单阻塞的同一run。

## 原生插件生命周期已实际通过（a8d6905 构建）

- 2026-08-31 恢复后，主线与远端代码均为 `a8d69054e3eaaa947bc75fde3918f767943b6700`。VM 构建输入及本项测试已核对；仅将仍为上一版的 `packages/dashboard/src/App.tsx` 同步到当前提交，正常 `pnpm --filter @understand-code/preview build` exit 0。未重跑已通过的包全量测试、冷安装测试或 root 双插件预检。
- 在既有 Alpine VM、普通 uid601 和全新 `/var/tmp/uc-plugin-lifecycle.AuBoQT` HOME/TMPDIR 下，用固定官方 Codex 0.151.0、Claude 2.1.202 执行原始单项：`UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS=1 RUN_STEP16_DUAL_HOST_E2E=0 node --test --test-name-pattern="^real Codex and Claude plugin lifecycles preserve the public strong-writer lock$" test/plugin-clean-install.test.mjs`。结果 **1 passed / 0 failed / 0 skipped，14.33秒，exit 0**；补的是此前缺 native CLI 而跳过的实际生命周期验证，不是重复旧绿。
- 两 Host 都实际安装 `0.1.0-preview.1`、升级 `0.1.0-preview.2+codex.lifecycle-v2`、卸载后固定恢复 v1、最终卸载。六次已安装 Doctor 均 `healthy / alpha / releaseReady=false / strongWrites=locked`，最终两端 `not_registered`；实际 MCP 写入锁、中文/空格 detached linked worktree 绑定、Git 环境污染隔离和源码/index 字节保持断言均通过。v2 是生命周期测试产物，不是正式签名发行；本项没有模型调用，不计 Provider/业务 E2E 或 Gold，也不关闭第16步。
- 本次实际 tarball SHA256 `0144c11a56c9ee9e0a30fb6ca418dda1b982d3ba6e4f370127a52d67d4ff89d4`，3,305,593 bytes；由同次 fresh HOME 中精确关联原 pack 路径的 pacote 缓存取得并校验 SHA512，没有重新 pack 冒充原产物。CLI SHA256 `fa2adb3426e2d501241657f5e98ab09db89e40a3476b5d3100ad5689cc038d8e`。主线已读取原始构建/单项输出与实际命令记录，保留于 `/tmp/understand-code-plugin-lifecycle-evidence.kYToxP/`；Node 24 默认 spec reporter，未转换为 TAP。
- 没有使用 mount namespace、修改固定 Git 或访问等待登录的 `step16-hosts-ljFNHp`。测试自行清理其新建的临时仓库、安装和注册；用户仓库、认证配置及受保护内容未动。本项执行进程均已结束，VM 保持运行。没有新失败或输入变化时，不重跑此门。

## 前轮产品断点定位（历史；对应后端现已实现）

- 原目标明确要求未验证 Task 先产生待审知识增量、Verified Task 后晋级 Graph/Wiki，并保留来源；定位时 `refresh_index full` 直接发布、不含 Task 来源或 pending/promotion。现已完成本文件首节的后端闭环，界面接线与完整真实任务仍需继续，不因后端通过而关闭第16步。
- 旧知识的读取耦合：`provider-production-strong-object-client.ts` 的 `createProductionStrongDurableBusinessArtifactsV1` 用 `replacementAuthority ?? currentAuthority`，所以 incremental **保留**旧 index authority；`tools.ts` 的 `openStrongBoundActiveIndexV1` 另要求 index 与最新 Pulse 同 Snapshot。`23acd18` 已保留 current 安全检查并增加明确标记历史/已发布版本的只读入口，继续核对原 Provider 的完整 generation/digest/Snapshot/revision 绑定；不新建 Provider 合同或重审第15步。
- 已落实的边界：待审增量不提前 finalize full，不把会被 finally/GC 清理的 staging 冒充持久候选；复用现有 index generation、Task verified 转换门禁与 full 原子发布链，初次非 Task 扫描仍合法。仅 `record_verification` 成功不等于 Task 已 verified，来源进入 generation 摘要覆盖范围。
- 历史外部状态：当时隔离 Codex 为 `Not logged in`、Claude 为 `loggedIn:false`，`a8d6905` 的 Actions run `33405441604` 因账户付款/spending limit未启动jobs。当前仍未收到登录成功或真实模型任务通过证据；不将旧run或本地测试写为新SHA的CI通过。

## Wiki 恢复切片（以 bf50a79 为基线）

- 按原目标要求使用 Product Design，对现有Task/Graph/Wiki做截图和源码盘点；没有新建展示页、增加步骤或替换原Overview/自由探索。更新后的skill缓存实际为Product Design 0.1.53，旧0.1.52路径已移除；恢复时使用实际路径，不重复失败读取、不修改受保护`.learnings/`。
- 修复Wiki索引失败后无页内恢复入口：沿用现有样式，自动/手动重试共用单请求闸门；手动重试取消旧timer、重置既有有限次数、不刷新整页、不重拉Task或Graph、不改变路由。既有卸载取消与401/403失效逻辑不变。
- 新回归先在缺少按钮处失败；修复后53项定向测试通过，随后仅一次Dashboard完整回归54文件/585 passed（6.05秒）；正常Preview build与一次独立代码审查通过。没有重跑未改变的Authority/Artifact/Host全门禁或双插件预检。
- 实际production WorkbenchRuntime + 新打包React UI，在1280×720、768×1024、390×844三屏对照截图；页内点击恢复、Wiki正文→Graph→Wiki→Task正常，恢复前后URL相同。仅隔离UI fixture，不接Provider、不调用模型、不计Gold。键盘工具未触发默认动作，完整键盘/a11y仍未确认，未伪造通过。详见根目录`design-qa.md`，不得把其中限定范围的passed提升为第16步通过。
- UI fixture保留在`/private/tmp/understand-code-ui-fixture.RjlV3LyC`，当前launcher `http://127.0.0.1:65438/`，自有PID41422；GET时才签发原60秒token，没有延长生产TTL或绕过cookie校验。新Dashboard inventory `sha256:725acfa47d2f69111fb97ce5dd0e2d3d8e17f303786b46a91f1ea98fbeed4bae`。此Mac UI构建尚未替换VM已安装的双插件包。
- 原生Codex登录进程仍在等待用户完成浏览器授权，未收到登录成功；Claude沿用下方用户终端脚本。没有读取/复制凭证，也没有开始真实模型任务。后续先接续这两个登录和原目标，不重开第15步。

## 双插件实现与核验（以 ecc9d3b 为基线）

- 已补 Codex 0.151.0 的内部受限源码修改：默认只读不变；仅一个既有文件 update，最小 flat leaf 目录可写、现有邻接文件只读，root 检查完整文件集合、inode/类型/模式/属主及精确 before/after 内容。不是内核单文件许可。实际 native sandbox + 官方 apply_patch 在 VM 正向通过，受影响 Linux/root executor 专项 18/18 通过；fixture `/var/tmp/step16-codex-native-patch-cBppBe` 保留。`Supervisor.run` 已透传此显式策略。
- 固定 whole-run 计划新增显式 `argumentsDigest: null` 延迟槽。仅 root composition 安装的 resolver 可在 arm 前从 Provider 产物派生精确参数摘要；实际 observer 的摘要通过 `arm_derived` 传入，独立比对后才开 Provider 窗口。固定槽仍拒绝此帧；不更换 runNonce、不按调用重置 4096 预算、不提前 finalize。实际 UDS client/server 正反往返、身份 await 前快照、lease loss、N/N 用例通过。
- Artifact Store 新增非公开 `readCommittedStrongTaskProjectionInternalV1`，由真实 business head 的 descriptor 读取 exact object，核对字节/摘要、Task/request/revision、receipt/event/idempotency 身份及前后 head 一致性；复用原 projection parser，返回深冻结对象。只读 root Provider 端口，不接受 Host 自报结果作权威。
- 主线 typecheck/build/full package：Authority 465 passed / 6 skipped；Host 更新为 116 passed / 33 skipped；Artifact Store 181 passed，合计 762 passed。Host 的 33 个 Linux/root 专项另在 VM 全部通过，含两 Host MCP 参数选择、await 前冻结、注入拒绝及 18 个源码边界用例。没有修改 Client，也未重复其全门禁。
- 内部 `rootMcpServer` 仅 Linux root + 非 root childIdentity 可用：Codex 明确忽略用户配置并重建 MCP selection；Claude 使用 strict MCP JSON 配置；与 sourceMutation 互斥，默认公开入口不变。不是只在预检选择插件、真实会话却仍走旧配置。
- root runner 已串联独立 root worker、实际 Host session/JSONL、durable authority/UDS 和仅 Step16 阶段启用的 gateway operation relay。5 次 strong 调用（包括 Task baseline）共用同一 run/closing plan，最后完整 N/N 才 finalize；update_task action 和规范化 requestDigest 独立核验。一次限定交叉复核无可执行 P0/P1/P2。即使完整内部流程成功仍为 `verified_not_gold`，不套用旧 formal Gold shape。固定 fixture 的 `expectedBlockingFindings=1` 目前仅为失败关闭断言，尚未由同 fixture 的真实 strong Check 验证，不能声称已确认。
- 已修复实际插件 wrapper 保留父进程导致 SafeGit onlySelf 失败的问题：Linux 有原生 execve 时同 PID 接管 CLI；其他平台/旧 Node 保留原 spawn。原参数/env/stdio、固定激活与 root 检查不变，execve 失败不回退。主线独立复核通过；Mac 5 passed / 2 skipped，Linux 6 passed / 1 skipped。
- 新版 Linux 包已实际 build/pack，并以官方 native CLI 命令独立安装两套插件。当前 root profile：`/var/lib/understand-code/step16-hosts-ljFNHp/root-host-profile.json`，root:root/0600/nlink1；环境变量 `UNDERSTAND_CODE_STEP16_ROOT_HOST_PROFILE_PATH` 指向它。不要使用缺 execve 修复的旧 `step16-hosts-APodCm`。新版 tarball SHA256 `10fad2279f2818920e0fe5d063e507d9ca0ed5bea0f6e07e1641dca6ef897790`；两 cache 的 CLI/native/entrypoint 与安装包逐项一致。
- 两 native 的隔离登录仍未完成；原隔离环境实际 `codex login status` 为 Not logged in，Claude 为 loggedIn:false/authMethod:none；新环境也未授权。用户已收到浏览器登录协作请求。没有读取/复制 Mac 凭证，没有模型调用。
- VM 已准备原生 Git/mount/unshare、ext4 目录，以及 `/sys/fs/cgroup/understand-code-step16-caller-v1/{host,safe-git/understand-code-safe-git-supervisor-v1}`。仅本任务新 root worker 进入 Host landing，最终 MCP CLI 自身进入 SafeGit leaf，不迁移 sshd/全局进程。独立降权/迁移/资源约束探针通过。
- 无模型集成入口为原 RUN_STEP15/RUN_STEP16 加 `UNDERSTAND_CODE_STEP16_PREFLIGHT_ONLY=1`：真实插件仅 initialize/tools-list，核对最终 CLI argv 和唯一 PID，不调用业务 tool，不计 G2/G3。9 个 root/recipe 定向用例通过。实际 E2E 已修正旧 native probe 降权后清理顶层目录的问题（由外层 root 统一清理）；并确认 VM 代码快照祖先 0750 阻止服务 UID 懒加载 `.node`，仅纯代码快照根改为 0755 后，42001:42002 的真实 require 和 publisher open/close 均通过。ext4 base 0755、状态/证据 0700 未放宽。
- Alpine musl 不导出旧测试使用的 `libc.renameat2`；测试现以系统 `SYS_renameat2`/`RENAME_EXCHANGE` 宏编译私有 C helper 执行真实原子交换，没有普通 rename 降级或硬编码 syscall 编号。helper 在 publisher 捕获前创建、全部关闭后清理，避免自身改变祖先 ctime 造成 ABA 伪阳性。实际 42001:42002 的交换/回换、内容与 inode、ENOENT 零变更、ctime 不变及独立清理均通过，限定独立复核关闭此 finding。
- 已补 VM 的既有 gateway profile 系统依赖：官方 Alpine flock/setpriv 2.41.4-r0、coreutils 9.8-r1；仅两个原本不存在的 `/usr/bin/setpriv`、`/usr/bin/cat` 从同 VM 官方 `/bin` 原生文件复制，root:root/0755/nlink1、SHA 相等。原样 gateway 命令链的服务身份/空 supplementary groups、排他等待、EOF 释放、再次获取均通过。固定 Git/mount/unshare 未变；没有修改 Client 源码。
- 实际 E2E 已过 native 对象探针、初始业务调用、外部身份拒绝、SIGKILL 重启回放、CAS/nonce 和 live-uninstall/double-start。两次运行分别在 Acceptance B 信任轮换回放和 CAS stale replay 遇到 Socket.fail；随后仅记录事件/字节计数的诊断运行完整通过上述回放，所有日志均无 timeout，并进入 Step16。诊断运行不是正式通过，也没有证明此前间歇断连已修复；未改超时、Client 或安全 guard。诊断材料保留在 VM `/var/tmp/understand-code-step16-gateway-diagnostics.0xfTRHUf`。
- Step16 入口的两个运行器缺口已修复：控制目录改为独立 ext4 子目录，witness root:root/0700、relay root:service/0710，所有祖先保持 root-owned/non-writable，真实两服务启动探针通过；无业务调用的预检不启动要求 N/N 的 witness，会明确返回 `preflight_only/not_started` 就绪状态。正式运行仍要求完整 N/N；两个服务均尝试清理，authority 非零或信号退出不得写成功 evidence。新增 Linux 生命周期专项 8/8，通过真实 unshare exec 保持 PID 检查，主线已复核此 finding。
- 修复后的第一次无诊断原始 E2E 耗时 101.5 秒，已通过回放并进入 Step16，但新 gateway 的 ready 等待超时，未产生 closing evidence。已由实际源码排除 gateway/relay 启动互等：observer 在 startup 仅保存，真实 write/compare 时才连接。没有更改 Client、超时或启动顺序来掩盖失败。
- 随后的最小阶段诊断运行被内核 global OOM 杀掉主进程 PID15084（约 21:13:44，exit255）；原 VM 只有 2GiB/2vCPU、无 swap，OOM 时五个 Node 进程合计接近整机内存。只找到这一次 OOM，不能将前一次 ready 超时直接归为同因。两个孤儿测试服务 PID15215/15230 已核对完整 argv 后停止；故障 fixture 保留在 `/var/tmp/uc-step15-three-principal-IOfhlO`，不计任何通过。仅本任务 Lima 配置 `/Users/example/.lima/understand-code-alpine-proof/lima.yaml` 的内存由 2GiB 改为 4GiB 并重启，CPU/disk/cgroup 限额不变；原四级私有 cgroup、属主/权限和控制器已恢复，未迁移其他进程、未修改根控制器。此环境不等于冻结 Q15 的 8vCPU/16GiB reference runner，不关闭性能门，也不改变任何性能阈值。
- 4GiB VM 上未启用任何诊断的原始 Vitest 入口已通过：`RUN_STEP15_PROVIDER_E2E=1 RUN_STEP16_DUAL_HOST_E2E=1 UNDERSTAND_CODE_STEP16_PREFLIGHT_ONLY=1 ... vitest run test/provider-production-strong-object-three-principal-linux.test.ts -t "production strong object three-principal Linux"`，1 passed / 17 unchanged focused tests skipped，87.31 秒。主线另读实际 closing evidence，确认不是 blocked 分支：`status=preflight_verified`，Codex/Claude 两项均为真实已安装 CLI、singlePid=true、initialize/tools-list、advertisedTools=11；`modelInvoked=false`、`businessToolsInvoked=false`、`countsTowardG2OrG3=false`。文件在 VM `/var/mnt/uc-step15-ext4-root/step16-closing-evidence/step16-closing-evidence-d8a63002acc742489c612245e1a7151e.json`，root:root/0600/nlink1。通过还包含原 native/principal/restart/CAS/信任轮换与 lifecycle 断言，并在 authority 正常退出后落证据。此前 Socket.fail/ready timeout 在这次未复现，不据此宣称其根因已全部修复。
- Preview 的当前 Linux build/typecheck 已通过；runtime 8 passed、plugins 7 passed / 2 skipped，cold-packed 1 passed。cold-packed 在已安装 SafeGit、未进入其 cgroup 的普通进程中会触发安全拒绝；最终通过是在独立 mount namespace 的干净安装环境、uid601/隔离 HOME 下运行原始测试，未修改生产 SafeGit 检查、未改变 VM 全局固定 Git。冷测试与强运行环境分别验证，不能混为同一运行状态。
- 本轮可观察交付是两套实际安装插件通过 root-owned 安全入口预检；模型 workflow 仍为内部入口且受登录/显式运行开关约束，不宣称已执行。此切片具备精确提交条件；提交后继续原目标，不重跑未改变的三个包完整测试，不宣布 Step16 或整个目标完成。

## 上一提交 ecc9d3b 已记录的验证（历史，不是当前待办）

- 内部 root supervisor 串联实际 Host executor、start/complete、operation observer 和 witness client；固定计划校验、逐调用窗口、跨 session/Host 全局顺序、实际 executor 成功后才允许全程 finalize。
- Witness client 使用原生 root peer 身份、严格序列、超时和取消。UDS 已区分合法 Host 思考空闲与未认证/半帧/挂起 RPC 超时，避免 5 秒静默误杀。
- Durable authority composition 在实际 broker lease 内打开 journal；arm 固定运行/计划/会话/调用身份，操作必须先落盘后 ACK，完成时验证真实 broker prefix/suffix。
- Journal 新增 whole-run finalized 状态：跨 Host/session 调用保持全局顺序，只有完整运行结束才能换新 runNonce、重置本运行预算；不完整运行不算完成。
- 关闭和 helper 失锁同步撤销回执能力，等待写入排空后才释放父 fd 持有的真实 flock。complete/finalize 挂起期间撤权不能迟到成功。修复 Alpine BusyBox flock/cat 兼容性。
- Host executor 内部 root 启动必须显式非 root UID/GID，保护并固定 native 入口路径/摘要，实际降权并清除 supplementary groups，外部取消终止子进程。Codex 新支持只读沙箱内精确 verification command；source mutation 仍拒绝，未开放泛化写权限。
- 本切片最终 typecheck/build：Authority、Host 均通过。完整包测试：Authority 453 passed / 6 skipped；Host 111 passed / 12 skipped。Client 未改，未重复其完整门禁，也未纳入受保护的用户未跟踪源码/测试。
- 实际 Linux/root/ext4：既有 Lima `understand-code-alpine-proof` 内，启动隔离 12/12、真实 broker lease 2/2 通过；不是 macOS skip 替代，也不是实际 Codex/Claude Gold session。
- 一轮分工独立复审及同一 lease finding 定向复核已收口；无新失败证据时，不重复全面审计或未变化的长测试。

## 从这里继续

- 共享MCP流程指引和原root-owned真实Host固定运行器的候选/Verified发布接线已完成并通过受影响门禁，不重新设计或重跑。HTTP层已接通真实候选发现、同代Graph/Wiki只读预览与认证发布来源，现有published只读浏览也已完成。下一产品工作是在既有Task/Graph/Wiki内使用这些接口接通审阅和双向来源追溯，不重写接口。先解决浏览器源捕获拦截，再按Product Design采集并实施；保留Overview/自由探索与稳定路由，不新增展示页或重做第15步。当前候选32项满额拒绝、发布后保留来源，不声称已有候选管理界面或已执行真实模型流程。
- 未 verified 的 Task 不得提前 finalize full 或发布 Graph/Wiki；record_verification 成功仍不等于 Task 已 verified。以下原生登录与发行阻点继续保留；本轮受影响后端完整门禁已通过，没有新失败或输入变化不重复运行。

- 下一实际断点是隔离环境的原生登录，以及登录后的完整真实任务；Linux root 双插件 preflight 已实际通过，不重开此门，不回落手工 MCP 冒充 Host。
- 动态 snapshot/context/finding 参数和 Codex 精确源码修改已实现并有上述专项验证；继续真实闭环时使用这些能力，不重复从旧实现缺口重新设计，也不得以笼统 workspace-write 代替。
- Claude 2.1.202 已从官方源验签安装到 VM `/opt/understand-code/hosts/claude/2.1.202/claude`，root:root/0555、nlink1，父目录 root:root/0755；SHA256 `80405fead329dd67d786b2a3d49bb121797a157937c99dedae2e36fcc77b55e6`。官方 key fingerprint、manifest 签名及大小均验证，普通 uid601 的 `--version`/`--help` 成功，尚未登录或调用模型。验签材料在 VM `/var/tmp/step16-claude-2.1.202.eGLLBH`。
- Codex 0.151.0 官方 musl-arm64 完整 bundle 已安装到 VM `/opt/understand-code/hosts/codex/0.151.0/`；native 是 `bin/codex`，SHA256 `56f026015ccc3ebc12895282200d89c216892bf6fa15fa7f228e6e0c6ad6ce76`（包 SHA256 `c64ad6e4f82609552a37069365b50528ef49e986aeab24a538781a18a402773d`）。完整保留 code-mode-host、rg、bwrap、zsh、manifest；11 项路径/类型核验通过，native root:root/0555/nlink1、父目录0755。普通 uid601 的 `--version`、`--help`、`exec --help` 成功，确认当前 executor 参数均支持。原包在 VM `/var/tmp/understand-code-codex-0.151.0.mPiMlA/`。
- 两套真实 CLI 还需配置、登录和完整会话；不复制 Mac 凭证、不以 root 身份运行模型。用户已收到浏览器授权协作询问，尚无登录或模型调用。Codex 支持 `login --device-auth`；Claude `auth login` 支持订阅默认/`--claudeai`、`--console`、`--email`、`--sso`，帮助未承诺无浏览器或非交互模式。准备环境不等于真实 session 通过。
- Linux 工作区 `/var/tmp/understand-code-step16.OlMGFa` 已同步 `ecc9d3b` 归档和本轮功能源码/测试并重新 build；后续产品修复须同步后验证。VM 保持运行，不重复创建。Mac CLI 和用户配置未改，只有上述本任务 Lima 内存配置调整。
- 新 SHA `ecc9d3b` 的 [Actions run 33373972282](https://github.com/chifanjie/Tomato/actions/runs/33373972282) 已单独核验：jobs 未启动，annotation 明确为账户付款失败或 spending limit。与基线 38a70ae/run33355268029 相同外部阻碍；不是代码测试失败，也不是通过，不自行更改计费、无状态变化不重试同一 run。
- 本轮新 SHA `bf50a798055f3f2d5fe288a1f452f1381864ad28` 的 [Actions run 33398668214](https://github.com/chifanjie/Tomato/actions/runs/33398668214) 同 SHA 核验完成：失败 jobs 的 steps 为空，C09 aggregate 与 Workspace quality 两项 annotation 均明确为账户付款失败或 spending limit，未开始代码测试；不是本地通过的替代，也不能写成 CI green。不自行改计费，不重跑未变化的同一 run。
- 原生登录续接：当前隔离 Codex 的 `login --device-auth` 返回 HTTP403，未据此推断具体账户原因；已按官方方式启动普通浏览器登录，VM localhost:1455 经 Lima 转发到 Mac，本机探测已收到该服务 HTTP404。成功登录仍待确认，不记录或复制 auth/token 文件。Claude `auth login` 实际采用浏览器授权后回终端粘贴一次性 code 的方式；为避免聊天传递 code，未完成的代理持有会话已取消，用户可在自己的终端执行 `bash /tmp/step16-plugin-prep.6WCyZO/login-claude.sh`，该脚本仅从当前 root profile 加载隔离 env、清空附加组、降权到42003:42004并运行官方 CLI。两者均未调用模型；登录未完成不计真实任务通过。
- 双 Agent 冷安装/升级、真实任务与恢复、Workbench/Graph/Wiki 的 Product Design 和多屏交互验收、双人 Product/QA、ALPHA-B/owner、发行门仍按原冻结范围推进；没有增加新的步骤或验收项。
- 原有三份脏文档、`site/`、`.learnings/`、`.pnpm-store/`、topology-proof 和用户未跟踪源码/测试继续保持不动。
