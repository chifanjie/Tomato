import { describe, expect, it } from "vitest";

import { buildUniqueLabels, labelFor } from "../display-label.js";

describe("buildUniqueLabels", () => {
  it("leaves a unique name unqualified", () => {
    const labels = buildUniqueLabels([
      { id: "a", name: "store.ts", filePath: "src/store.ts" },
      { id: "b", name: "App.tsx", filePath: "src/App.tsx" },
    ]);

    expect(labels.get("a")).toBe("store.ts");
    expect(labels.get("b")).toBe("App.tsx");
  });

  it("qualifies colliding file names by their parent directory", () => {
    const labels = buildUniqueLabels([
      { id: "a", name: "index.ts", filePath: "packages/core/src/index.ts" },
      { id: "b", name: "index.ts", filePath: "packages/dashboard/src/index.ts" },
    ]);

    // One segment is not enough — both parents are `src`.
    expect(labels.get("a")).toBe("index.ts（core/src）");
    expect(labels.get("b")).toBe("index.ts（dashboard/src）");
  });

  it("stops at the shallowest qualifier that separates the group", () => {
    const labels = buildUniqueLabels([
      { id: "a", name: "index.ts", filePath: "packages/core/index.ts" },
      { id: "b", name: "index.ts", filePath: "packages/dashboard/index.ts" },
    ]);

    expect(labels.get("a")).toBe("index.ts（core）");
    expect(labels.get("b")).toBe("index.ts（dashboard）");
  });

  it("qualifies colliding function names by their file", () => {
    const labels = buildUniqueLabels([
      { id: "f1", name: "main", filePath: "skills/understand/compute-batches.mjs" },
      { id: "f2", name: "main", filePath: "skills/understand-kb/generate.mjs" },
    ]);

    // One segment already separates them, so the qualifier stays short.
    expect(labels.get("f1")).toBe("main（compute-batches.mjs）");
    expect(labels.get("f2")).toBe("main（generate.mjs）");
  });

  it("falls back to the full path when two entries share one path", () => {
    const labels = buildUniqueLabels([
      { id: "x", name: "main", filePath: "a/b.mjs" },
      { id: "y", name: "main", filePath: "a/b.mjs" },
    ]);

    expect(labels.get("x")).toBe("main（a/b.mjs）");
    expect(labels.get("y")).toBe("main（a/b.mjs）");
  });

  it("produces a distinct label for every entry in a large collision group", () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      id: `n${index}`,
      name: "index.ts",
      filePath: `packages/p${index}/src/index.ts`,
    }));

    const labels = buildUniqueLabels(entries);

    expect(new Set(labels.values()).size).toBe(10);
  });

  it("falls back to the bare name for an unknown id", () => {
    expect(labelFor(new Map(), "missing", "fallback.ts")).toBe("fallback.ts");
  });
});
