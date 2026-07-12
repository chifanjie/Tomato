import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SemanticGraphNode } from "../../../graphExplorer/semanticGraph";
import {
  extendSemanticNodePositions,
  graphEdgeTypeLabel,
  graphNodeTypeLabel,
  graphPointerAction,
  REACT_FLOW_ARIA_LABEL_CONFIG,
  semanticNodeClusterLabel,
  semanticNodeGroupLabel,
} from "../semanticGraphCanvasModel";

const source = readFileSync(new URL("../SemanticGraphCanvas.tsx", import.meta.url), "utf8");
const explorerSource = readFileSync(new URL("../GraphExplorer.tsx", import.meta.url), "utf8");

describe("SemanticGraphCanvas interaction contract", () => {
  it("selects every graph object, clears from the pane, and keeps drilling explicit", () => {
    expect(source).toContain("selectNode(node.id)");
    expect(source).not.toContain('node.data.kind === "node"');
    expect(source).toContain("onPaneClick={onPaneClick}");
    expect(source).toContain("selectNode(null)");
    expect(source).toContain("onNodeDoubleClick={onNodeDoubleClick}");
    expect(source).toContain("node.data.onDrillDown?.()");
    expect(source).toContain("data.onDrillDown?.()");
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain("graphPointerAction(");
    expect(source).toContain("lastNodeClickRef");
    expect(source).toContain("lastDrillRef");
    expect(source).toContain("drillOnce");
    expect(source).toContain("nodesFocusable={false}");
    expect(source).toContain("nodesDraggable={false}");
    expect(source).toContain("nodesConnectable={false}");
    expect(source).toContain("showInteractive={false}");
    expect(source).toContain("graphCardKeyAction(event.key");
    expect(source).toContain('className={`nodrag ');
    expect(source).toContain('className="nodrag nopan ');

    const cardStart = source.indexOf("function SemanticNodeCard");
    const cardEnd = source.indexOf("const nodeTypes", cardStart);
    expect(cardStart).toBeGreaterThan(-1);
    expect(cardEnd).toBeGreaterThan(cardStart);
    expect(source.slice(cardStart, cardEnd)).not.toContain("onDoubleClick={(event) => {");
  });

  it("does not fit or relayout merely because selection changed", () => {
    expect(source).not.toContain("SelectedNodeFocus");
    expect(source).not.toContain("<SelectedNodeFocus");
    expect(source).toContain("extendSemanticNodePositions");
    expect(source).toContain("layoutCacheRef");
    expect(source).toContain("const cacheForView");
    expect(source).toContain("useEffect(() => {");
    expect(source).toContain("layoutCacheRef.current = { viewKey, positions: positionsById };");

    const renderCacheStart = source.indexOf("const layoutCacheRef");
    const structureKeyStart = source.indexOf("const structureKey", renderCacheStart);
    expect(renderCacheStart).toBeGreaterThan(-1);
    expect(structureKeyStart).toBeGreaterThan(renderCacheStart);
    expect(source.slice(renderCacheStart, structureKeyStart)).not.toContain("layoutCacheRef.current =");

    const positionMemoStart = source.indexOf("const positionsById", structureKeyStart);
    const positionEffectStart = source.indexOf("useEffect(() => {", positionMemoStart);
    expect(positionMemoStart).toBeGreaterThan(structureKeyStart);
    expect(positionEffectStart).toBeGreaterThan(positionMemoStart);
    expect(source.slice(positionMemoStart, positionEffectStart)).not.toContain("layoutCacheRef.current");

    const viewKeyStart = explorerSource.indexOf("const canvasViewKey");
    const viewKeyEnd = explorerSource.indexOf("return (", viewKeyStart);
    expect(viewKeyStart).toBeGreaterThan(-1);
    expect(viewKeyEnd).toBeGreaterThan(viewKeyStart);
    const viewKeySource = explorerSource.slice(viewKeyStart, viewKeyEnd);
    expect(viewKeySource).not.toContain("selectedNodeId");
    expect(viewKeySource).not.toContain("nodes.length");
    expect(viewKeySource).not.toContain("edges.length");
    expect(viewKeySource).toContain("graph.version");
    expect(viewKeySource).toContain("graph.project.name");
    expect(viewKeySource).toContain("graph.project.gitCommitHash");
    expect(viewKeySource).toContain("graph.project.analyzedAt");
  });

  it("renders graph metadata and React Flow controls in Simplified Chinese", () => {
    expect(source).toContain("semanticNodeGroupLabel(data.group)");
    expect(source).toContain("graphNodeTypeLabel(data.rawType)");
    expect(source).toContain("semanticNodeClusterLabel(data.cluster, data.group)");
    expect(source).toContain("graphEdgeTypeLabel(edge.type)");
    expect(source).toContain("ariaLabelConfig={REACT_FLOW_ARIA_LABEL_CONFIG}");
    expect(source).toContain("按回车键进入，按空格键选择");
    expect(source).not.toContain("按 Enter");
    expect(source).not.toContain("function formatLabel");
  });

  it("keeps precise raw-node Wiki routing while aggregates use the app route callback", () => {
    expect(explorerSource).toContain('selection?.kind === "raw"');
    expect(explorerSource).toContain("openWikiForGraphNode(selection.id)");
    expect(explorerSource).toContain("onSelectWikiTarget(destination)");
    expect(explorerSource).toContain("onSelectWikiTarget(target)");
  });
});

describe("semantic graph canvas presentation model", () => {
  it("drills on the second click of the same drillable node within 500 ms", () => {
    const first = graphPointerAction(null, {
      id: "file:markdown.ts",
      at: 1_000,
      canDrillDown: true,
    });
    expect(first).toEqual({
      action: "select",
      nextClick: { id: "file:markdown.ts", at: 1_000 },
    });

    expect(graphPointerAction(first.nextClick, {
      id: "file:markdown.ts",
      at: 1_500,
      canDrillDown: true,
    })).toEqual({ action: "drill", nextClick: null });
  });

  it("starts a new selection for a different or expired node click", () => {
    const previous = { id: "file:markdown.ts", at: 1_000 };
    expect(graphPointerAction(previous, {
      id: "file:other.ts",
      at: 1_200,
      canDrillDown: true,
    })).toEqual({
      action: "select",
      nextClick: { id: "file:other.ts", at: 1_200 },
    });
    expect(graphPointerAction(previous, {
      id: "file:markdown.ts",
      at: 1_501,
      canDrillDown: true,
    })).toEqual({
      action: "select",
      nextClick: { id: "file:markdown.ts", at: 1_501 },
    });
  });

  it("keeps repeated clicks on a non-drillable node as selection", () => {
    expect(graphPointerAction(
      { id: "symbol:read", at: 1_000 },
      { id: "symbol:read", at: 1_200, canDrillDown: false },
    )).toEqual({
      action: "select",
      nextClick: { id: "symbol:read", at: 1_200 },
    });
  });

  it("has an explicit Simplified Chinese label for every semantic group", () => {
    expect([
      ["capability", semanticNodeGroupLabel("capability")],
      ["flow", semanticNodeGroupLabel("flow")],
      ["module", semanticNodeGroupLabel("module")],
      ["infra", semanticNodeGroupLabel("infra")],
      ["data", semanticNodeGroupLabel("data")],
      ["file", semanticNodeGroupLabel("file")],
      ["document", semanticNodeGroupLabel("document")],
      ["symbol", semanticNodeGroupLabel("symbol")],
      ["other", semanticNodeGroupLabel("other")],
    ]).toEqual([
      ["capability", "业务能力"],
      ["flow", "业务流程"],
      ["module", "模块"],
      ["infra", "基础设施"],
      ["data", "数据"],
      ["file", "文件"],
      ["document", "文档"],
      ["symbol", "符号"],
      ["other", "其他"],
    ]);
  });

  it("translates enum fallback clusters without translating paths or identifiers", () => {
    expect(semanticNodeClusterLabel("module", "module")).toBe("模块");
    expect(semanticNodeClusterLabel("src", "file")).toBe("src");
    expect(semanticNodeClusterLabel("业务核心", "module")).toBe("业务核心");
  });

  it("has an explicit Simplified Chinese label for every graph node type", () => {
    const expected = {
      file: "文件",
      function: "函数",
      class: "类",
      module: "模块",
      concept: "概念",
      config: "配置",
      document: "文档",
      service: "服务",
      table: "数据表",
      endpoint: "接口",
      pipeline: "流水线",
      schema: "模式",
      resource: "资源",
      domain: "业务域",
      flow: "流程",
      step: "步骤",
      article: "文章",
      entity: "实体",
      topic: "主题",
      claim: "结论",
      source: "来源",
    } as const;

    expect(Object.fromEntries(
      Object.keys(expected).map((type) => [type, graphNodeTypeLabel(type as keyof typeof expected)]),
    )).toEqual(expected);
  });

  it("has an explicit Simplified Chinese label for every graph edge type", () => {
    const expected = {
      imports: "导入",
      exports: "导出",
      contains: "包含",
      inherits: "继承",
      implements: "实现",
      calls: "调用",
      subscribes: "订阅",
      publishes: "发布",
      middleware: "中间件",
      reads_from: "读取",
      writes_to: "写入",
      transforms: "转换",
      validates: "校验",
      depends_on: "依赖",
      tested_by: "被测试",
      configures: "配置",
      related: "相关",
      similar_to: "相似",
      deploys: "部署",
      serves: "提供服务",
      provisions: "供应",
      triggers: "触发",
      migrates: "迁移",
      documents: "说明",
      routes: "路由",
      defines_schema: "定义模式",
      contains_flow: "包含流程",
      flow_step: "流程步骤",
      cross_domain: "跨业务域",
      cites: "引用",
      contradicts: "矛盾",
      builds_on: "基于",
      exemplifies: "示例",
      categorized_under: "归类于",
      authored_by: "作者",
    } as const;

    expect(Object.fromEntries(
      Object.keys(expected).map((type) => [type, graphEdgeTypeLabel(type as keyof typeof expected)]),
    )).toEqual(expected);
  });

  it("overrides every React Flow accessibility label in Simplified Chinese", () => {
    expect(REACT_FLOW_ARIA_LABEL_CONFIG).toMatchObject({
      "node.a11yDescription.default": "图谱节点；可在节点卡片上选择或进入。",
      "node.a11yDescription.keyboardDisabled": "节点卡片提供选择和进入操作。",
      "edge.a11yDescription.default": "图谱连接线，用于表示元素之间的关系。",
      "controls.ariaLabel": "图谱控制面板",
      "controls.zoomIn.ariaLabel": "放大图谱",
      "controls.zoomOut.ariaLabel": "缩小图谱",
      "controls.fitView.ariaLabel": "适应视图",
      "controls.interactive.ariaLabel": "切换图谱交互",
      "minimap.ariaLabel": "图谱缩略图",
      "handle.ariaLabel": "节点连接点",
    });
    expect(REACT_FLOW_ARIA_LABEL_CONFIG["node.a11yDescription.ariaLiveMessage"]({
      direction: "left",
      x: 10,
      y: 20,
    })).toBe("节点位置已更新到横坐标 10、纵坐标 20。");
  });

  it("preserves existing positions when selection pins another visible node", () => {
    const graphNode = (id: string, label: string): SemanticGraphNode => ({
      id,
      label,
      group: "file",
      category: "file",
      cluster: "src",
      importance: 1,
      rawType: "file",
      summary: label,
      docs: {
        relation: "none",
        quality: "needs-review",
        evidenceHealth: "missing",
        generationStatus: "partial",
        referenceCoverage: "unanchored",
        directPageIds: [],
        contextPageIds: [],
        directPages: [],
        contextPages: [],
        evidenceIds: [],
        evidence: [],
      },
    });
    const beta = graphNode("beta", "Beta");
    const charlie = graphNode("charlie", "Charlie");
    const initial = extendSemanticNodePositions(new Map(), [beta, charlie]);
    const expanded = extendSemanticNodePositions(initial, [graphNode("alpha", "Alpha"), beta, charlie]);

    expect(expanded.get("beta")).toEqual(initial.get("beta"));
    expect(expanded.get("charlie")).toEqual(initial.get("charlie"));
    expect(new Set([...expanded.values()].map(({ x, y }) => `${x}:${y}`))).toHaveLength(3);

    const pruned = extendSemanticNodePositions(expanded, [charlie]);
    expect([...pruned.keys()]).toEqual(["charlie"]);
    expect(pruned.get("charlie")).toEqual(initial.get("charlie"));
  });
});
