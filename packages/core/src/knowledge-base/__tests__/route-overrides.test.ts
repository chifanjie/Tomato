import { describe, expect, it } from "vitest";
import type { KnowledgeBaseProjectConfig } from "../../types.js";
import { applyRouteOverrides, type RoutePageInput } from "../route-overrides.js";

const pages: RoutePageInput[] = [
  { id: "a", role: "reference" },
  { id: "b", role: "featured", route: { order: 9, stage: "flow" } },
  { id: "c", role: "featured", route: { order: 10, stage: "implementation" } },
];

describe("route overrides", () => {
  it("applies hide before pin and order while preserving hidden pages as references", () => {
    const result = applyRouteOverrides(pages, {
      route: { hide: ["b", "b"], pin: ["a", "b", "missing"], order: ["c", "a", "b", "missing"] },
    });
    expect(result.pages.map((page) => [page.id, page.role, page.route?.order])).toEqual([
      ["c", "featured", 0], ["a", "featured", 1], ["b", "reference", undefined],
    ]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      "页面 b 同时出现在 hide 与 pin 中，已按 hide 处理",
      "路由配置引用了不存在的页面 missing",
    ]));
  });

  it("sorts configured featured pages before existing route order and page ID", () => {
    const result = applyRouteOverrides([
      { id: "z", role: "maintenance" },
      { id: "b", role: "featured", route: { order: 2, stage: "flow" } },
      { id: "a", role: "featured", route: { order: 2, stage: "purpose" } },
      { id: "c", role: "featured", route: { order: 10, stage: "rule" } },
      { id: "d", role: "reference" },
    ], {
      route: { pin: ["d"], order: ["c"] },
    });

    expect(result.pages.map((page) => [page.id, page.role, page.route])).toEqual([
      ["c", "featured", { order: 0, stage: "rule" }],
      ["a", "featured", { order: 1, stage: "purpose" }],
      ["b", "featured", { order: 2, stage: "flow" }],
      ["d", "featured", { order: 3, stage: "implementation" }],
      ["z", "maintenance", undefined],
    ]);
  });

  it("does not mutate the caller's pages or nested routes", () => {
    const input: RoutePageInput[] = [
      { id: "a", role: "featured", route: { order: 5, stage: "flow" } },
      { id: "b", role: "reference" },
    ];
    const snapshot = structuredClone(input);

    const result = applyRouteOverrides(input, { route: { pin: ["b"], order: ["b", "a"] } });

    expect(input).toEqual(snapshot);
    expect(result.pages[0]).not.toBe(input[1]);
    expect(result.pages[1]?.route).not.toBe(input[0]?.route);
  });

  it("cleans malformed route arrays without aborting valid overrides", () => {
    const config = {
      route: {
        pin: [" a ", "", 42, "a"],
        hide: "not-an-array",
        order: [null, " a ", "a"],
      },
    } as unknown as KnowledgeBaseProjectConfig;

    const result = applyRouteOverrides([{ id: "a", role: "reference" }], config);

    expect(result).toEqual({
      pages: [{ id: "a", role: "featured", route: { order: 0, stage: "implementation" } }],
      warnings: [],
    });
  });

  it("warns once for each missing page ID across all route lists", () => {
    const result = applyRouteOverrides([{ id: "a", role: "reference" }], {
      route: { pin: [" missing "], hide: ["missing"], order: ["missing"] },
    });

    expect(result.warnings.filter((warning) => warning === "路由配置引用了不存在的页面 missing")).toHaveLength(1);
  });
});
