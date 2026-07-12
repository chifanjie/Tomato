import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain("nodesFocusable={false}");
    expect(source).toContain("graphCardKeyAction(event.key");
  });

  it("does not fit or relayout merely because selection changed", () => {
    expect(source).not.toContain("SelectedNodeFocus");
    expect(source).not.toContain("<SelectedNodeFocus");
  });

  it("keeps precise raw-node Wiki routing while aggregates use the app route callback", () => {
    expect(explorerSource).toContain('selection?.kind === "raw"');
    expect(explorerSource).toContain("openWikiForGraphNode(selection.id)");
    expect(explorerSource).toContain("onSelectWikiTarget(destination)");
    expect(explorerSource).toContain("onSelectWikiTarget(target)");
  });
});
