# Legacy Brand Removal Design

Date: 2026-07-14

Status: Ready for user review

## 中文摘要

前端不再直接展示历史产物中的 `understand-anything` 品牌。兼容逻辑放在数据加载边界：旧图谱、旧 Wiki 索引、旧 Markdown 正文和旧搜索索引在进入运行时状态前，把用户可见文本中的精确旧品牌词替换为 `Understand Code`。这样不需要重新生成历史知识库，刷新后即可生效，未来加载同类旧产物时也不会重新出现。

这是一项品牌兼容修复，不改变页面布局、图谱样式或知识内容结构，也不改节点 ID、文档 ID、文件路径、Markdown 链接、源码证据坐标和代码标识。除精确旧品牌词外，其他仓库和项目名称保持原样。

## Problem

当前页面没有硬编码 `understand-anything`。旧名称来自历史生成产物：

- 图谱的 `project.name`
- Wiki 索引的 `projectName`
- Wiki Markdown 正文
- 搜索索引的标题、摘要、正文和搜索词

只改 React 标题或默认文案无法解决问题。重新打开旧产物后，旧品牌还会再次进入界面。

## Decision

采用加载边界兼容方案：

```text
远端/本地产物 → 解析与校验 → 旧品牌展示文本归一化 → 运行时索引/状态 → UI
```

定义一个无副作用的品牌归一化模块，只识别精确词 `understand-anything`，输出 `Understand Code`。调用方在数据已经通过原有格式校验后、写入 Dashboard 状态前执行归一化。

## Normalized Surfaces

### Relationship graph

图谱校验通过后，归一化项目展示名称及项目级展示说明，再写入 Dashboard store。节点 ID、边 ID、节点名称、文件路径和源码位置不参与品牌兼容转换。

### Wiki index

Wiki V2 校验通过后，归一化：

- `projectName`
- 页面 `title`
- 页面 `summary`
- 页面 `searchTerms`

归一化后的对象再交给 `buildWikiRuntimeIndex`，因此首页、目录和 Wiki/图谱关联面板会共享同一结果。

### Wiki Markdown

Markdown 请求成功且正文非空后，在返回给渲染器之前归一化叙述性正文中的旧品牌词。转换必须跳过 fenced code、行内代码和 Markdown 链接目标；URL、`markdownPath`、源码片段和链接目标保持不变。

### Search index

搜索索引格式校验通过后，归一化记录的用户可见与检索文本：

- `title`
- `summary`
- `content` 中的叙述性正文
- `terms`
- `businessTerms`

记录 ID、页面 ID、节点 ID、锚点和文件路径保持不变。`content` 与 Wiki Markdown 使用同一套正文转换规则，避免改写代码和链接地址。

## Compatibility Rules

- 只替换精确旧品牌词 `understand-anything`，不做模糊匹配。
- `Understand Anything`、普通英文单词和任意其他项目名不受影响。
- 不修改磁盘上的历史产物；兼容转换仅发生在前端内存中。
- 不修改代码块、行内代码、Markdown 链接目标、原始源码证据摘录、节点标识、路径和关系键，避免破坏可追溯性。
- 新生成产物即使已使用 `Understand Code`，再次经过归一化也保持不变。

## Tests

先添加失败测试，再实现兼容逻辑：

1. 图谱归一化测试：旧项目名变为 `Understand Code`，其他项目名及图谱标识不变。
2. Wiki 加载测试：`projectName`、页面标题、摘要和搜索词被归一化，节点与证据关联保持不变。
3. Markdown 加载测试：叙述正文中的旧品牌被替换，代码块、行内代码、路径解析和链接目标不变。
4. 搜索加载测试：展示与检索文本被归一化，代码片段、ID、锚点和路径保持不变。
5. 回归检查：Dashboard 单测、类型检查和生产构建通过；使用当前旧产物预览时，首页左上角和引导文案均显示 `Understand Code`。

## Non-Goals

- 不调整 Wiki 布局、导航或正文丰富度。
- 不调整图谱节点、连线、动画或配色。
- 不重命名 npm 包、源码目录、技能名或历史文件。
- 不重写或重新生成知识库产物。

## Acceptance

- 当前截图中的左上角品牌显示为 `Understand Code`。
- 首页句子不再出现 `understand-anything`。
- Wiki 正文和搜索结果中的历史品牌展示文本不再出现。
- 加载非历史项目时仍显示该项目自己的真实名称。
- 所有图谱/Wiki 关联标识、文件路径和源码证据保持可用。
