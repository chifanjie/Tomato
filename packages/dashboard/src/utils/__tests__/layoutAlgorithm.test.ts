import { describe, expect, it } from "vitest";
import {
  computeLayout,
  computeStableGridLayout,
  isValidLayoutResult,
  quantizeGraphViewport,
  type GraphLayoutNodeKind,
  type LayoutMessage,
  type LayoutResult,
} from "../layoutAlgorithm.js";

const dimensions = {
  scope: { width: 248, height: 124 },
  boundary: { width: 232, height: 112 },
  cluster: { width: 220, height: 104 },
  file: { width: 210, height: 88 },
  symbol: { width: 188, height: 72 },
  raw: { width: 196, height: 80 },
} satisfies Record<GraphLayoutNodeKind, { width: number; height: number }>;

function node(id: string, kind: GraphLayoutNodeKind = "scope"): LayoutMessage["nodes"][number] {
  return { id, kind, ...dimensions[kind] };
}

function edge(
  source: string,
  target: string,
  directions: LayoutMessage["edges"][number]["directions"] = ["forward"],
  relationType: LayoutMessage["edges"][number]["relationType"] = "depends_on",
): LayoutMessage["edges"][number] {
  return { source, target, relationType, directions, weight: 0.8, count: 1 };
}

function input(overrides: Partial<LayoutMessage> = {}): LayoutMessage {
  return {
    requestId: 7,
    structureKey: "structure:alpha",
    level: "overview",
    viewport: quantizeGraphViewport(1360, 780),
    nodes: [node("a"), node("b"), node("c"), node("d")],
    edges: [edge("a", "b"), edge("a", "c"), edge("a", "d")],
    ...overrides,
  };
}

function expectBoundsContainNodes(message: LayoutMessage, result: LayoutResult): void {
  for (const item of message.nodes) {
    const position = result.positions[item.id]!;
    expect(position.x).toBeGreaterThanOrEqual(result.bounds.x + 48);
    expect(position.y).toBeGreaterThanOrEqual(result.bounds.y + 48);
    expect(position.x + item.width).toBeLessThanOrEqual(
      result.bounds.x + result.bounds.width - 48,
    );
    expect(position.y + item.height).toBeLessThanOrEqual(
      result.bounds.y + result.bounds.height - 48,
    );
  }
}

function expectNodeRectanglesDoNotOverlap(message: LayoutMessage, result: LayoutResult): void {
  for (let leftIndex = 0; leftIndex < message.nodes.length; leftIndex += 1) {
    const left = message.nodes[leftIndex]!;
    const leftPosition = result.positions[left.id]!;
    for (let rightIndex = leftIndex + 1; rightIndex < message.nodes.length; rightIndex += 1) {
      const right = message.nodes[rightIndex]!;
      const rightPosition = result.positions[right.id]!;
      const separated = leftPosition.x + left.width <= rightPosition.x
        || rightPosition.x + right.width <= leftPosition.x
        || leftPosition.y + left.height <= rightPosition.y
        || rightPosition.y + right.height <= leftPosition.y;
      expect(separated, `${left.id} overlaps ${right.id}`).toBe(true);
    }
  }
}

describe("graph viewport buckets", () => {
  it.each([
    [390, 740, { width: 320, height: 800, widthBucket: 2, heightBucket: 5, aspectBucket: "portrait" }],
    [960, 650, { width: 960, height: 640, widthBucket: 6, heightBucket: 4, aspectBucket: "landscape" }],
    [1360, 780, { width: 1440, height: 800, widthBucket: 9, heightBucket: 5, aspectBucket: "landscape" }],
    [1840, 720, { width: 1920, height: 800, widthBucket: 12, heightBucket: 5, aspectBucket: "wide" }],
  ] as const)("quantizes %d x %d before layout", (width, height, expected) => {
    expect(quantizeGraphViewport(width, height)).toEqual(expected);
  });

  it("uses inclusive balanced and landscape thresholds", () => {
    expect(quantizeGraphViewport(640, 800).aspectBucket).toBe("balanced");
    expect(quantizeGraphViewport(800, 640).aspectBucket).toBe("balanced");
    expect(quantizeGraphViewport(1440, 800).aspectBucket).toBe("landscape");
  });
});

describe("semantic layout algorithm", () => {
  it("packs a connected overview across both axes while preserving dependency ranks", () => {
    const result = computeLayout(input());
    const root = result.positions.a!;
    const dependants = [result.positions.b!, result.positions.c!, result.positions.d!];

    expect(new Set(Object.values(result.positions).map((position) => position.x)).size)
      .toBeGreaterThan(1);
    expect(new Set(Object.values(result.positions).map((position) => position.y)).size)
      .toBeGreaterThan(1);
    for (const dependant of dependants) expect(dependant.x).toBeGreaterThan(root.x);
    expectBoundsContainNodes(input(), result);
  });

  it("keeps cyclic overview output deterministic for reversed node, edge, and direction order", () => {
    const nodes = [node("a"), node("b"), node("c"), node("d")];
    const edges = [
      edge("a", "b", ["forward", "backward"], "imports"),
      edge("b", "c", ["forward"], "calls"),
      edge("c", "a", ["forward"], "depends_on"),
      edge("a", "b", ["backward"], "calls"),
    ];
    const first = computeLayout(input({ nodes, edges }));
    const second = computeLayout(input({
      nodes: [...nodes].reverse(),
      edges: [...edges].reverse().map((item) => ({
        ...item,
        directions: [...item.directions].reverse(),
      })),
    }));

    expect(second).toEqual(first);
  });

  it("ranks backward relationships from target to source", () => {
    const result = computeLayout(input({
      nodes: [node("source"), node("target")],
      edges: [edge("source", "target", ["backward"])],
    }));

    expect(result.positions.source!.x).toBeGreaterThan(result.positions.target!.x);
  });

  it("places isolates in a stable peripheral band without moving connected scopes", () => {
    const connectedInput = input({
      nodes: [node("a"), node("b"), node("c")],
      edges: [edge("a", "b"), edge("b", "c")],
    });
    const withIsolateInput = input({
      nodes: [...connectedInput.nodes, node("isolated")],
      edges: connectedInput.edges,
    });
    const connected = computeLayout(connectedInput);
    const withIsolate = computeLayout(withIsolateInput);

    expect(Object.fromEntries(Object.entries(withIsolate.positions)
      .filter(([id]) => id !== "isolated"))).toEqual(connected.positions);
    expect(withIsolate.positions.isolated!.y).toBeGreaterThan(
      Math.max(...Object.values(connected.positions).map((position) => position.y)),
    );
  });

  it("wraps many overview isolates in a narrow landscape viewport without rectangle overlap", () => {
    const message = input({
      viewport: quantizeGraphViewport(960, 650),
      nodes: Array.from({ length: 7 }, (_, index) => node(`isolated:${index}`)),
      edges: [],
    });
    const result = computeLayout(message);

    expectNodeRectanglesDoNotOverlap(message, result);
    expectBoundsContainNodes(message, result);
  });

  it.each([
    ["scope", "portrait"],
    ["scope", "wide"],
    ["cluster", "balanced"],
    ["cluster", "landscape"],
    ["file", "portrait"],
    ["file", "wide"],
  ] as const)("is deterministic for %s in a %s viewport", (level, aspectBucket) => {
    const nodes = [node("a", "cluster"), node("b", "file"), node("c", "symbol")];
    const edges = [edge("a", "b"), edge("b", "c")];
    const viewport = {
      ...quantizeGraphViewport(aspectBucket === "portrait" ? 390 : 1360, 780),
      aspectBucket,
    };
    const first = computeLayout(input({ level, viewport, nodes, edges }));
    const second = computeLayout(input({
      level,
      viewport,
      nodes: [...nodes].reverse(),
      edges: [...edges].reverse(),
    }));

    expect(second).toEqual(first);
    expectBoundsContainNodes(input({ level, viewport, nodes, edges }), first);
  });

  it.each([
    ["scope", "portrait", 390, 780, "y"],
    ["cluster", "balanced", 800, 640, "y"],
    ["cluster", "landscape", 1360, 780, "x"],
    ["file", "wide", 1840, 720, "x"],
  ] as const)("ranks %s dependencies on the %s main axis", (level, aspectBucket, width, height, axis) => {
    const viewport = { ...quantizeGraphViewport(width, height), aspectBucket };
    const result = computeLayout(input({
      level,
      viewport,
      nodes: [node("a", "file"), node("b", "file"), node("c", "symbol")],
      edges: [edge("a", "b"), edge("b", "c")],
    }));

    expect(result.positions.a![axis]).toBeLessThan(result.positions.b![axis]);
    expect(result.positions.b![axis]).toBeLessThan(result.positions.c![axis]);
  });

  it("uses quantized viewport dimensions rather than unavailable raw measurements", () => {
    const first = computeLayout(input({ viewport: quantizeGraphViewport(1281, 721) }));
    const second = computeLayout(input({ viewport: quantizeGraphViewport(1359, 779) }));
    expect(second).toEqual(first);
  });

  it("returns a deterministic stable grid with unique positions and valid padded bounds", () => {
    const message = input({
      level: "cluster",
      nodes: [node("z", "symbol"), node("a", "file"), node("m", "cluster"), node("b", "file")],
      edges: [],
    });
    const result = computeStableGridLayout(message);
    const positions = Object.values(result.positions).map(({ x, y }) => `${x}:${y}`);

    expect(new Set(positions).size).toBe(message.nodes.length);
    expect(isValidLayoutResult(message, result)).toBe(true);
    expectBoundsContainNodes(message, result);
    expect(computeStableGridLayout({ ...message, nodes: [...message.nodes].reverse() })).toEqual(result);
  });
});

describe("layout result validation", () => {
  const message = input({ nodes: [node("a"), node("b")] });
  const valid = computeStableGridLayout(message);

  it("accepts a complete finite result", () => {
    expect(isValidLayoutResult(message, valid)).toBe(true);
  });

  it.each([
    ["mismatched request", { ...valid, requestId: 99 }],
    ["missing id", { ...valid, positions: { a: valid.positions.a! } }],
    ["extra id", { ...valid, positions: { ...valid.positions, extra: { x: 1, y: 2 } } }],
    ["non-finite position", { ...valid, positions: { ...valid.positions, a: { x: Number.NaN, y: 2 } } }],
    ["duplicate position", { ...valid, positions: { a: { x: 10, y: 10 }, b: { x: 10, y: 10 } } }],
    ["non-finite bounds", { ...valid, bounds: { ...valid.bounds, width: Number.POSITIVE_INFINITY } }],
  ] as const)("rejects %s", (_label, result) => {
    expect(isValidLayoutResult(message, result)).toBe(false);
  });

  it.each([
    ["null result", null],
    ["missing payload fields", {}],
    ["null bounds", { ...valid, bounds: null }],
    ["null positions", { ...valid, positions: null }],
    ["wrong bounds value types", { ...valid, bounds: { ...valid.bounds, width: "wide" } }],
    ["wrong position value types", {
      ...valid,
      positions: { ...valid.positions, a: { x: "left", y: 2 } },
    }],
  ] as const)("returns false for malformed runtime payload: %s", (_label, result) => {
    expect(() => isValidLayoutResult(message, result)).not.toThrow();
    expect(isValidLayoutResult(message, result)).toBe(false);
  });
});
