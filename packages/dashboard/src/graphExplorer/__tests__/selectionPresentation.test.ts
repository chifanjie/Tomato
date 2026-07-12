import { describe, expect, it } from "vitest";
import {
  buildSelectionPresentation,
  graphCardKeyAction,
  resolveFlowDirection,
} from "../selectionPresentation";
import { semanticSelectionFixture } from "./graphFixtures";

describe("selection presentation", () => {
  it("keeps the selection and one-hop neighborhood while dimming unrelated elements", () => {
    const semantic = semanticSelectionFixture();
    const selectedId = "scope:layer:core";
    const view = buildSelectionPresentation(semantic, selectedId, false);

    expect(view.nodesById.get(selectedId)).toEqual({ selected: true, neighbor: false, dimmed: false, opacity: 1 });
    expect(view.nodesById.get("scope:layer:api")).toEqual({ selected: false, neighbor: true, dimmed: false, opacity: 1 });
    expect(view.nodesById.get("scope:layer:data")).toEqual({ selected: false, neighbor: true, dimmed: false, opacity: 1 });
    expect(view.nodesById.get("scope:layer:unrelated")).toEqual({ selected: false, neighbor: false, dimmed: true, opacity: 0.2 });
    expect(view.edgesById.get("scope:layer:api->scope:layer:core")).toMatchObject({
      connected: true,
      animated: true,
      inlineDirection: false,
      opacity: 0.95,
      flowDirection: "forward",
    });
    expect(view.edgesById.get("scope:layer:core->scope:layer:data")).toMatchObject({
      connected: true,
      animated: true,
      flowDirection: "reverse",
    });
    expect(view.edgesById.get("scope:layer:unrelated->scope:layer:data")).toEqual({
      connected: false,
      animated: false,
      inlineDirection: false,
      opacity: 0.16,
      strokeWidth: 1,
      flowDirection: "both",
    });
  });

  it("replaces connected motion with an inline direction indicator for reduced motion", () => {
    const semantic = semanticSelectionFixture();
    const reduced = buildSelectionPresentation(semantic, "scope:layer:core", true);

    expect(reduced.edgesById.get("scope:layer:api->scope:layer:core")).toMatchObject({
      animated: false,
      inlineDirection: true,
      flowDirection: "forward",
    });
    expect(reduced.edgesById.get("scope:layer:core->scope:layer:data")).toMatchObject({
      animated: false,
      inlineDirection: true,
      flowDirection: "reverse",
    });
  });

  it("resolves bundled reverse and bidirectional semantics deterministically", () => {
    const [forward, reverse, both] = semanticSelectionFixture().edges;
    expect(resolveFlowDirection(forward)).toBe("forward");
    expect(resolveFlowDirection(reverse)).toBe("reverse");
    expect(resolveFlowDirection(both)).toBe("both");
    expect(resolveFlowDirection({ ...forward, directions: ["forward", "backward"] })).toBe("both");
  });

  it("maps card keys to one explicit select-or-drill action", () => {
    expect(graphCardKeyAction("Enter", true)).toBe("drill");
    expect(graphCardKeyAction("Enter", false)).toBe("select");
    expect(graphCardKeyAction(" ", true)).toBe("select");
    expect(graphCardKeyAction("Spacebar", true)).toBe("select");
    expect(graphCardKeyAction("Escape", true)).toBeNull();
  });
});
