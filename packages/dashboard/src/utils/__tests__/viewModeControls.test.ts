import { describe, expect, it } from "vitest";
import { shouldShowGraphControls } from "../viewModeControls";

describe("shouldShowGraphControls", () => {
  it("hides graph-canvas controls in normal structural mode", () => {
    expect(shouldShowGraphControls({ viewMode: "structural", isKnowledgeGraph: false })).toBe(false);
  });

  it("keeps controls for domain mode", () => {
    expect(shouldShowGraphControls({ viewMode: "domain", isKnowledgeGraph: false })).toBe(true);
  });

  it("keeps controls for knowledge graph mode", () => {
    expect(shouldShowGraphControls({ viewMode: "knowledge", isKnowledgeGraph: true })).toBe(true);
  });
});
