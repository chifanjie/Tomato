# Wiki 索引恢复：限定范围的 Design QA

日期：2026-08-31。代码基线：`bf50a79`。仅评估此次 Wiki 索引重试修复，不代表第16步、原生 Host、Provider、Gold 或完整无障碍验收通过。

## 视觉证据与比较

证据目录：`/private/tmp/understand-code-ui-fixture.RjlV3LyC/`。生产 WorkbenchRuntime 与真实打包 React UI；数据为明确标记的独立 UI 回归 fixture，未读取或修改用户仓库产物。

| 视口 / 图片像素 | Source visual truth | Implementation screenshot |
| --- | --- | --- |
| 1280×720 | `01-wiki-failure-before.png` | `04-wiki-failure-after.png` |
| 768×1024 | `02-wiki-failure-tablet-before.png` | `05-wiki-failure-tablet-after.png` |
| 390×844 | `03-wiki-failure-mobile-before.png` | `06-wiki-failure-mobile-after.png` |

每对都是相同视口、技术文档2.0主题、Wiki索引503失败态、相同Task上下文；图片像素与CSS视口1:1，无裁剪或密度缩放。每对原图与实现图放入同一比较输入并实际查看。完整截图中按钮、标题、正文清晰可读，无需另裁局部。

比较历史：初次原界面截图确认[P2]提示“请检查服务后重试”却没有重试入口；增加原生按钮并接入原Wiki加载周期后重新截图。三种尺寸均未见本次引入的P0/P1/P2视觉问题；卡片增加按钮后的高度变化为预期，原header、任务横条和导航不变。

- 字体：沿用原有字体、标题/正文层级、字号与行高；移动端正文正常换行。
- 间距：沿用现有居中面板、圆角和边框；按钮使用原应用间距与44px最小高度。桌面与手机DOM测量均为124×44px。
- 颜色：沿用现有accent、surface、text和border tokens，未新增配色。
- 图片：此次没有新增或替换图片、图标、字体资源；不涉及素材近似或占位图。
- 文案：保留原失败原因与恢复指引，新增“重新读取知识库”，与只读行为一致。

## 交互与验证

- 实际点击：索引503失败→服务恢复→页内重试→Wiki首页→项目总览正文→Graph节点→同Wiki正文→原Task，均可操作。恢复点击前后完整URL一致。
- `07-wiki-recovered-reading.png`记录恢复后的正文，`08-graph-after-recovery.png`记录关联Graph。图谱节点`module:knowledge`与Wiki页面`page:overview`互链可见，Task ID保持。
- 本fixture没有伪造Change Check，返回“任务发现”后按既有校验清除未绑定发现的Evidence参数并进入planned_changes；不据此宣称真实finding/evidence全链路验收通过。
- 桌面与手机document scrollWidth等于视口宽度，未见横向溢出；平板截图未见控件遮挡。视口覆盖已恢复默认值。
- 受控浏览器检查期间console error日志为空。工具的locator.press和CUA ENTER均未触发所测原生按钮的默认动作；点击可用、focus-visible可见，但键盘端到端**未确认**，未用脚本模拟事件或修改产品来绕过。
- 定向测试53 passed；Dashboard包完整回归54文件/585 passed，6.05秒。新增回归先因缺按钮而失败，修复后覆盖重试耗尽前/后、双击去重、旧timer取消、loading、正文恢复及Task/Graph请求和URL不变。
- 正常Preview build成功。Dashboard inventory：`sha256:725acfa47d2f69111fb97ce5dd0e2d3d8e17f303786b46a91f1ea98fbeed4bae`。新包已重启会话并在浏览器实际核验，不是只刷新旧内存bundle。
- 一次独立代码审查无可执行P0/P1/P2。未直接新增卸载迟到返回、手动403的组件用例；原取消和forbidden逻辑保持。

## 实现清单与剩余边界

本切片视觉及鼠标恢复已核验；没有新增产品路由、模板、依赖或发布部署。后续仍需真实Provider任务/原生Host证据及完整键盘无障碍检查，不能用此UI fixture替代。

final result: passed
