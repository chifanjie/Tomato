import { describe, expect, it } from "vitest";
import {
  assessChangeRisk,
  classifyRepositoryChanges,
  classifySemanticChange,
  decideGraphRefresh,
  type ClassifiedRepositoryChange,
} from "../src/taxonomy.js";

function classified(
  taxonomy: ClassifiedRepositoryChange["classification"]["taxonomy"],
  path = "src/main.ts",
): ClassifiedRepositoryChange {
  return {
    changeId: `change:${taxonomy}:${path}`,
    path,
    classification: {
      taxonomy,
      detector: "fixture-parser",
      reasons: [`fixture ${taxonomy}`],
    },
  };
}

describe("semantic change taxonomy", () => {
  it("uses all fixed taxonomy categories with detector and reasons", () => {
    const cases = [
      classifySemanticChange({
        path: "src/main.ts",
        oldContent: "same",
        newContent: "same",
      }),
      classifySemanticChange({
        path: "src/main.ts",
        kind: "renamed",
      }),
      classifySemanticChange({
        path: "package.json",
        oldContent: "{}",
        newContent: '{"dependencies":{}}',
      }),
      classifySemanticChange({
        path: "src/main.ts",
        parser: {
          detector: "tree-sitter-typescript-v1",
          supported: true,
          formattingOrCommentOnly: true,
        },
      }),
      classifySemanticChange({
        path: "src/main.ts",
        parser: {
          detector: "tree-sitter-typescript-v1",
          supported: true,
          bodyLogicChanged: true,
        },
      }),
      classifySemanticChange({
        path: "src/main.ts",
        parser: {
          detector: "tree-sitter-typescript-v1",
          supported: true,
          signatureChanged: true,
        },
      }),
      classifySemanticChange({
        path: "src/main.ts",
        oldContent: "return 1",
        newContent: "return 2",
      }),
    ];

    expect(cases.map((item) => item.taxonomy)).toEqual([
      "NONE",
      "TOPOLOGY",
      "DEPENDENCY",
      "FORMATTING_OR_COMMENT",
      "BODY_LOGIC",
      "SIGNATURE",
      "UNKNOWN",
    ]);
    for (const item of cases) {
      expect(item.detector.length).toBeGreaterThan(0);
      expect(item.reasons.length).toBeGreaterThan(0);
    }
  });

  it("uses UNKNOWN when parser support is absent or unsupported", () => {
    expect(
      classifySemanticChange({
        path: "src/main.ts",
        oldContent: "const value = 1;\n",
        newContent: "const value = 2;\n",
      }).taxonomy,
    ).toBe("UNKNOWN");
    expect(
      classifySemanticChange({
        path: "src/main.ts",
        parser: {
          detector: "tree-sitter-typescript-v1",
          supported: false,
        },
      }).taxonomy,
    ).toBe("UNKNOWN");
  });

  it("never turns BODY_LOGIC into a no-refresh decision", () => {
    const decision = decideGraphRefresh([classified("BODY_LOGIC")]);
    expect(decision.level).toBe("incremental");
    expect(decision.filesToReanalyze).toEqual(["src/main.ts"]);
  });

  it("carries parser BODY_LOGIC evidence through repository classification", () => {
    const changes = classifyRepositoryChanges(
      [
        {
          id: "change:body",
          source: "unstaged",
          kind: "modified",
          path: "src/main.ts",
        },
      ],
      {
        "change:body": {
          oldContent: "export const value = 1;\n",
          newContent: "export const value = 2;\n",
          parser: {
            detector: "tree-sitter-typescript-v1",
            supported: true,
            bodyLogicChanged: true,
          },
        },
      },
    );

    expect(changes[0]?.classification.taxonomy).toBe("BODY_LOGIC");
    expect(decideGraphRefresh(changes)).toMatchObject({
      level: "incremental",
      filesToReanalyze: ["src/main.ts"],
    });
  });

  it("allows no refresh only for NONE and parser-proven formatting/comment changes", () => {
    expect(
      decideGraphRefresh([
        classified("NONE"),
        classified("FORMATTING_OR_COMMENT", "src/format.ts"),
      ]),
    ).toMatchObject({ level: "none", filesToReanalyze: [] });
  });

  it("uses a conservative full refresh for UNKNOWN and thresholds", () => {
    expect(decideGraphRefresh([classified("UNKNOWN")]).level).toBe("full");
    expect(
      decideGraphRefresh(
        [
          classified("BODY_LOGIC", "src/a.ts"),
          classified("BODY_LOGIC", "src/b.ts"),
        ],
        { totalFilesInGraph: 3 },
      ).level,
    ).toBe("full");
  });

  it("keeps refresh decisions and risk assessment independent", () => {
    const changes = [classified("TOPOLOGY", "src/new.ts")];
    const refresh = decideGraphRefresh(changes);
    const risk = assessChangeRisk(changes);

    expect(refresh).toMatchObject({
      level: "incremental",
      rerunArchitecture: true,
    });
    expect(risk).toEqual({
      level: "high",
      factors: ["Repository topology changed"],
    });
    expect(refresh).not.toHaveProperty("level", risk.level);
    expect(risk).not.toHaveProperty("filesToReanalyze");
  });
});
