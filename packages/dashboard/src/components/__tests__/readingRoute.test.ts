import { describe, expect, it } from "vitest";
import {
  buildLocalizedReadingRouteSteps,
  DEFAULT_READING_ROUTE_STEPS,
  hasOldGraphCanvasLanguage,
  resolveReadingRouteTourStep,
} from "../readingRoute";

describe("readingRoute", () => {
  it("defines the default route without old graph canvas language", () => {
    expect(DEFAULT_READING_ROUTE_STEPS.map((step) => step.title)).toEqual([
      "Read the project layers",
      "Open a layer",
      "Scan file heat areas",
      "Open the function matrix",
      "Read impact",
    ]);

    const text = DEFAULT_READING_ROUTE_STEPS.map(
      (step) => `${step.title} ${step.description}`
    ).join(" ");

    expect(hasOldGraphCanvasLanguage(text)).toBe(false);
  });

  it("detects old graph canvas language", () => {
    expect(hasOldGraphCanvasLanguage("pan and zoom the graph minimap")).toBe(true);
    expect(hasOldGraphCanvasLanguage("dots and connecting lines")).toBe(true);
  });

  it("builds route steps from localized copy", () => {
    const steps = buildLocalizedReadingRouteSteps({
      step1Title: "层级",
      step1Description: "先读层级。",
      step2Title: "文件",
      step2Description: "再读文件。",
      step3Title: "热区",
      step3Description: "扫描热区。",
      step4Title: "函数",
      step4Description: "打开函数矩阵。",
      step5Title: "影响",
      step5Description: "阅读影响范围。",
    });

    expect(steps).toEqual([
      { order: 1, title: "层级", description: "先读层级。" },
      { order: 2, title: "文件", description: "再读文件。" },
      { order: 3, title: "热区", description: "扫描热区。" },
      { order: 4, title: "函数", description: "打开函数矩阵。" },
      { order: 5, title: "影响", description: "阅读影响范围。" },
    ]);
  });

  it("uses a generic localized fallback when tour title or description uses old graph language", () => {
    const fallbackCopy = {
      legacyFallbackTitle: "本步骤已更新",
      legacyFallbackDescription: "请按新的阅读路线继续。",
    };

    expect(resolveReadingRouteTourStep({
      title: "Pan and zoom",
      description: "Open the file.",
    }, fallbackCopy)).toEqual({
      title: "本步骤已更新",
      description: "请按新的阅读路线继续。",
    });

    expect(resolveReadingRouteTourStep({
      title: "Open the file",
      description: "Look for cluster nodes in the canvas.",
    }, fallbackCopy)).toEqual({
      title: "本步骤已更新",
      description: "请按新的阅读路线继续。",
    });

    expect(resolveReadingRouteTourStep({
      title: "Open the file",
      description: "Read the function matrix.",
    }, fallbackCopy)).toEqual({
      title: "Open the file",
      description: "Read the function matrix.",
    });
  });
});
