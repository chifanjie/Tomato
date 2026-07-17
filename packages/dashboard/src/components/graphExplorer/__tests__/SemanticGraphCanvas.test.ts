// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HierarchicalSemanticGraph } from "../../../graphExplorer/hierarchicalGraph";
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

const flowHarness = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
  reducedMotion: true,
  selectedNodeId: "scope:src" as string | null,
  selectNodeCalls: [] as Array<string | null>,
}));

vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  const element = (name: string) => ({ children }: Record<string, unknown>) =>
    React.createElement("div", { "data-flow-element": name }, children as React.ReactNode);
  return {
    Background: element("background"),
    BackgroundVariant: { Dots: "dots" },
    ControlButton: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement("button", props, children as React.ReactNode),
    Controls: element("controls"),
    Handle: element("handle"),
    MiniMap: element("minimap"),
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    ReactFlow: (props: Record<string, unknown>) => {
      flowHarness.props = props;
      const nodes = props.nodes as Array<{
        id: string;
        type: string;
        data: Record<string, unknown>;
      }>;
      const nodeTypes = props.nodeTypes as Record<string, React.ComponentType<Record<string, unknown>>>;
      return React.createElement(
        "div",
        { "data-testid": "react-flow" },
        ...nodes.map((node) => React.createElement(
          nodeTypes[node.type]!,
          { key: node.id, id: node.id, data: node.data },
        )),
        props.children as React.ReactNode,
      );
    },
  };
});

vi.mock("../../../hooks/useReducedMotion", () => ({
  useReducedMotion: () => flowHarness.reducedMotion,
}));

vi.mock("../../../store", () => ({
  useDashboardStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    selectedNodeId: flowHarness.selectedNodeId,
    selectNode: (id: string | null) => flowHarness.selectNodeCalls.push(id),
  }),
}));

import SemanticGraphCanvas from "../SemanticGraphCanvas";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const source = readFileSync(resolve(process.cwd(), "src/components/graphExplorer/SemanticGraphCanvas.tsx"), "utf8");
const explorerSource = readFileSync(resolve(process.cwd(), "src/components/graphExplorer/GraphExplorer.tsx"), "utf8");

const emptyDocs: SemanticGraphNode["docs"] = {
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
};

const semanticGraphFixture: HierarchicalSemanticGraph = {
  nodes: [
    {
      id: "scope:src",
      label: "核心模块",
      group: "module",
      category: "module",
      cluster: "module",
      importance: 1,
      rawType: "module",
      summary: "承载核心业务",
      filePath: "src/core",
      docs: emptyDocs,
      kind: "scope",
      scopeId: "src",
      canDrillDown: true,
    },
    {
      id: "scope:test",
      label: "测试模块",
      group: "module",
      category: "module",
      cluster: "module",
      importance: 0.8,
      rawType: "module",
      summary: "验证核心业务",
      docs: emptyDocs,
      kind: "scope",
      scopeId: "test",
      canDrillDown: true,
    },
  ],
  edges: [{
    id: "edge:src-test",
    source: "scope:src",
    target: "scope:test",
    type: "imports",
    direction: "forward",
    edgeTypes: ["imports"],
    directions: ["forward"],
    weight: 1,
    bundledCount: 1,
    members: [{
      id: "raw:src-test",
      source: "scope:src",
      target: "scope:test",
      type: "imports",
      direction: "forward",
      weight: 1,
    }],
  }],
  presentation: {
    displayMode: "architecture",
    level: "overview",
    relationshipSource: "imports",
    scopeId: null,
    clusterId: null,
    fileId: null,
    scopeOptions: [],
    breadcrumbs: [{ level: "overview", label: "全局概览" }],
    totalNodeCount: 2,
    hiddenNodeCount: 0,
    focusApplied: false,
    notice: null,
  },
};

class ImmediateResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(): void {
    this.callback([{
      contentRect: { width: 960, height: 650 } as DOMRectReadOnly,
    } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }

  disconnect(): void {}
  unobserve(): void {}
}

function canvasIntentProps(
  graph: HierarchicalSemanticGraph,
  frame: HTMLDivElement,
  graphRevision: string,
) {
  const presentation = graph.presentation;
  return {
    frameRef: { current: frame },
    baseGraph: graph,
    graphRevision,
    navigation: {
      level: presentation.level,
      ...(presentation.scopeId ? { scopeId: presentation.scopeId } : {}),
      ...(presentation.clusterId ? { clusterId: presentation.clusterId } : {}),
      ...(presentation.fileId ? { fileId: presentation.fileId } : {}),
    },
    explicitFocusRequest: null,
    onBaseLayoutReady: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ImmediateResizeObserver);
});

afterEach(() => {
  document.body.replaceChildren();
  flowHarness.props = null;
  flowHarness.reducedMotion = true;
  flowHarness.selectedNodeId = "scope:src";
  flowHarness.selectNodeCalls.length = 0;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("SemanticGraphCanvas interaction contract", () => {
  it("exports the permanent base/render graph intent API", () => {
    expect(source).toContain("export interface SemanticGraphCanvasIntentProps");
    expect(source).toContain(
      "interface SemanticGraphCanvasProps extends SemanticGraphCanvasIntentProps",
    );
    expect(source).toContain("frameRef: RefObject<HTMLDivElement | null>");
    expect(source).toContain("baseGraph: HierarchicalSemanticGraph");
    expect(source).toContain("semanticGraph: HierarchicalSemanticGraph");
    expect(source).toContain("explicitFocusRequest: GraphExplicitFocusRequest | null");
    expect(source).toContain("onBaseLayoutReady: (ready: GraphBaseLayoutReady) => void");
  });

  it("wires Enter drill, pane clearing, double-click state, and reduced-motion edge data", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onOpenScope = vi.fn();
    await act(async () => root.render(createElement(SemanticGraphCanvas, {
      ...canvasIntentProps(semanticGraphFixture, container, "overview"),
      semanticGraph: semanticGraphFixture,
      displayMode: "architecture",
      emptyNotice: null,
      onOpenScope,
      onOpenCluster: vi.fn(),
      onOpenFile: vi.fn(),
    })));

    const props = flowHarness.props as {
      nodes: Array<{ id: string; data: Record<string, unknown> }>;
      edges: Array<{ data: { animated: boolean; inlineDirection: boolean } }>;
      onNodeClick: (event: { timeStamp: number }, node: { id: string; data: Record<string, unknown> }) => void;
      onNodeDoubleClick: (event: { timeStamp: number }, node: { id: string; data: Record<string, unknown> }) => void;
      onPaneClick: () => void;
      nodeTypes: Record<string, unknown>;
      ariaLabelConfig: unknown;
    };
    expect(props.nodeTypes).toHaveProperty("semantic");
    expect(props.ariaLabelConfig).toBe(REACT_FLOW_ARIA_LABEL_CONFIG);
    expect(props.edges[0]?.data).toMatchObject({ animated: false, inlineDirection: true });

    const card = container.querySelector<HTMLElement>('[role="group"][aria-label^="核心模块"]');
    if (!card) throw new Error("缺少核心模块图谱卡片");
    expect(card.querySelector(".uc-semantic-node__summary")).toBeNull();
    expect(card.querySelector(".uc-semantic-node__path")?.textContent).toBe("src/core");
    const drillButton = card.querySelector<HTMLButtonElement>('button[aria-label^="进入"]');
    expect(drillButton?.className).toContain("min-h-11");
    expect(drillButton?.className).toContain("min-w-11");
    await act(async () => card.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })));
    expect(onOpenScope).toHaveBeenCalledWith("src");

    await act(async () => props.onPaneClick());
    expect(flowHarness.selectNodeCalls.at(-1)).toBeNull();

    onOpenScope.mockClear();
    const flowNode = props.nodes.find((node) => node.id === "scope:src");
    if (!flowNode) throw new Error("缺少核心模块流节点");
    await act(async () => {
      props.onNodeClick({ timeStamp: 1_000 }, flowNode);
      props.onNodeClick({ timeStamp: 1_200 }, flowNode);
      props.onNodeDoubleClick({ timeStamp: 1_200 }, flowNode);
    });
    expect(flowHarness.selectNodeCalls).toContain("scope:src");
    expect(onOpenScope).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it("keeps edge motion enabled when reduced motion is not requested", async () => {
    flowHarness.reducedMotion = false;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(SemanticGraphCanvas, {
      ...canvasIntentProps(semanticGraphFixture, container, "overview"),
      semanticGraph: semanticGraphFixture,
      displayMode: "architecture",
      emptyNotice: null,
      onOpenScope: vi.fn(),
      onOpenCluster: vi.fn(),
      onOpenFile: vi.fn(),
    })));

    const props = flowHarness.props as {
      edges: Array<{ data: { animated: boolean; inlineDirection: boolean } }>;
    };
    expect(props.edges[0]?.data).toMatchObject({ animated: true, inlineDirection: false });

    await act(async () => root.unmount());
  });

  it("reports node, keyboard, and pane selections through the injected callback", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onSelectNode = vi.fn();
    await act(async () => root.render(createElement(SemanticGraphCanvas, {
      ...canvasIntentProps(semanticGraphFixture, container, "overview"),
      semanticGraph: semanticGraphFixture,
      displayMode: "architecture",
      emptyNotice: null,
      onOpenScope: vi.fn(),
      onOpenCluster: vi.fn(),
      onOpenFile: vi.fn(),
      onSelectNode,
    })));

    const props = flowHarness.props as {
      nodes: Array<{ id: string; data: Record<string, unknown> }>;
      onNodeClick: (event: { timeStamp: number }, node: { id: string; data: Record<string, unknown> }) => void;
      onPaneClick: () => void;
    };
    const flowNode = props.nodes.find((node) => node.id === "scope:src");
    if (!flowNode) throw new Error("缺少核心模块流节点");
    await act(async () => props.onNodeClick({ timeStamp: 1_000 }, flowNode));

    const card = container.querySelector<HTMLElement>('[role="group"][aria-label^="测试模块"]');
    if (!card) throw new Error("缺少测试模块图谱卡片");
    await act(async () => card.dispatchEvent(new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    })));
    await act(async () => props.onPaneClick());

    expect(onSelectNode.mock.calls).toEqual([
      ["scope:src"],
      ["scope:test"],
      [null],
    ]);
    expect(flowHarness.selectNodeCalls).toEqual([]);

    await act(async () => root.unmount());
  });

  it("dispatches cluster and file drill callbacks with their full ancestor chain", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onOpenCluster = vi.fn();
    const onOpenFile = vi.fn();
    const drillGraph: HierarchicalSemanticGraph = {
      ...semanticGraphFixture,
      nodes: [{
        ...semanticGraphFixture.nodes[0]!,
        id: "cluster:src",
        kind: "cluster",
        clusterId: "cluster:src",
      }, {
        ...semanticGraphFixture.nodes[0]!,
        id: "file:src/a.ts",
        kind: "node",
        rawType: "file",
        clusterId: "cluster:src",
      }],
      edges: [],
      presentation: {
        ...semanticGraphFixture.presentation,
        scopeId: "src",
        breadcrumbs: [
          { level: "overview", label: "全局概览" },
          { level: "scope", label: "核心模块", scopeId: "src" },
        ],
      },
    };
    await act(async () => root.render(createElement(SemanticGraphCanvas, {
      ...canvasIntentProps(drillGraph, container, "scope"),
      semanticGraph: drillGraph,
      displayMode: "architecture",
      emptyNotice: null,
      onOpenScope: vi.fn(),
      onOpenCluster,
      onOpenFile,
    })));

    const props = flowHarness.props as { nodes: Array<{ id: string; data: { onDrillDown?: () => void } }> };
    await act(async () => props.nodes.find((node) => node.id === "cluster:src")?.data.onDrillDown?.());
    await act(async () => props.nodes.find((node) => node.id === "file:src/a.ts")?.data.onDrillDown?.());
    expect(onOpenCluster).toHaveBeenCalledWith("src", "cluster:src");
    expect(onOpenFile).toHaveBeenCalledWith("src", "cluster:src", "file:src/a.ts");

    await act(async () => root.unmount());
  });

  it("renders the supplied presentation notice as the only empty-graph message", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const exactNotice = "当前目录没有可展示的文件。";
    const emptyGraph: HierarchicalSemanticGraph = {
      ...semanticGraphFixture,
      nodes: [],
      edges: [],
      presentation: { ...semanticGraphFixture.presentation, notice: exactNotice },
    };
    await act(async () => root.render(createElement(SemanticGraphCanvas, {
      ...canvasIntentProps(emptyGraph, container, "empty"),
      semanticGraph: emptyGraph,
      displayMode: "architecture",
      emptyNotice: exactNotice,
      onOpenScope: vi.fn(),
      onOpenCluster: vi.fn(),
      onOpenFile: vi.fn(),
    })));

    expect(container.textContent).toBe(exactNotice);
    expect(container.textContent).not.toContain("当前层级没有可显示的图谱元素");
    expect(container.querySelector('[role="status"][aria-live="polite"]')?.textContent)
      .toBe(exactNotice);
    await act(async () => root.unmount());
  });

  it("selects every graph object, clears from the pane, and keeps drilling explicit", () => {
    expect(source).toContain("onSelectNode?: (nodeId: string | null) => void");
    expect(source).toContain("const selectGraphNode = onSelectNode ?? selectNode");
    expect(source).toContain("selectGraphNode(node.id)");
    expect(source).not.toContain('node.data.kind === "node"');
    expect(source).toContain("onPaneClick={onPaneClick}");
    expect(source).toContain("selectGraphNode(null)");
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

  it("keeps base layout and automatic viewport independent from ordinary selection", () => {
    expect(source).not.toContain("SelectedNodeFocus");
    expect(source).not.toContain("<SelectedNodeFocus");
    expect(source).toContain("placeSelectionExpansion");
    expect(source).toContain("buildGraphStructureKey");
    expect(source).toContain("requestSemanticLayout(input, { signal: controller.signal })");
    expect(source).toContain("const layoutRequestId = useRef(0)");
    expect(source).toContain("const completedPositions");
    expect(source).toContain("正在计算图谱布局");
    expect(source).toContain("Position.Left");
    expect(source).toContain("Position.Right");
    expect(source).not.toContain("fitViewOptions=");
    expect(source).not.toContain("fitView\n");
    expect(source).not.toContain("key={viewKey}");

    const layoutEffectStart = source.indexOf("useEffect(() => {", source.indexOf("const layoutRequestId"));
    const completedPositionsStart = source.indexOf("const completedPositions", layoutEffectStart);
    expect(layoutEffectStart).toBeGreaterThan(-1);
    expect(completedPositionsStart).toBeGreaterThan(layoutEffectStart);
    const layoutEffectSource = source.slice(layoutEffectStart, completedPositionsStart);
    expect(layoutEffectSource).toContain("queueMicrotask");
    expect(layoutEffectSource).toContain("controller.abort()");
    expect(layoutEffectSource).toContain("structureKey");
    expect(layoutEffectSource).toContain("viewportBucket");
    expect(layoutEffectSource).not.toContain("selectedNodeId");
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

  it("records provenance only for currently visible ids and passes it into view rebuilding", () => {
    expect(explorerSource).toContain("const [visibleSelectedNodeId, setVisibleSelectedNodeId]");
    expect(explorerSource).toContain("view?.semanticGraph.nodes.some((node) => node.id === nodeId)");
    expect(explorerSource).toContain("selectedNodeWasVisible");
    expect(explorerSource).toContain("visibleSelectionContextKey === selectionContextKey");
    expect(explorerSource).toContain("graphFocusRevision");
    expect(explorerSource).toContain("graphFocusPageId");
    expect(explorerSource).toContain("shouldClearVisibleSelectionProvenance");
    expect(explorerSource).toContain("onSelectNode={selectVisibleNode}");
    expect(explorerSource).toContain("onSelectObject={selectVisibleNode}");
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
