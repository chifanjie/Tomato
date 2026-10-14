import { describe, expect, it } from "vitest";
import type { KnowledgeGraph } from "../../types.js";
import {
  buildKnowledgeArtifacts,
  buildBusinessCapabilityProfile,
  buildFileDocPlan,
  buildKnowledgeBaseProfile,
  extractBusinessFactsFromFileTask,
  generateKnowledgeBase,
} from "../index.js";
import { buildCoverageReport } from "../markdown.js";

// Synthetic registration fixture: all names and values below are demonstration data.
function formGraph(): KnowledgeGraph {
  return {
    version: "1.0.0",
    kind: "codebase",
    project: {
      name: "sample-repository",
      languages: ["typescript"],
      frameworks: [],
      description: "注册表单策略",
      analyzedAt: "2026-06-29T00:00:00Z",
      gitCommitHash: "abc123",
    },
    nodes: [
      {
        id: "file:src/formtype.ts",
        type: "file",
        name: "formtype.ts",
        filePath: "src/formtype.ts",
        summary: "表单类型判断逻辑",
        tags: ["formtype", "business"],
        complexity: "complex",
      },
      {
        id: "function:src/formtype.ts:getFormType",
        type: "function",
        name: "getFormType",
        filePath: "src/formtype.ts",
        lineRange: [5, 18],
        summary: "根据注册上下文返回表单类型",
        tags: ["formtype", "business"],
        complexity: "complex",
      },
      {
        id: "file:src/formtype.test.ts",
        type: "file",
        name: "formtype.test.ts",
        filePath: "src/formtype.test.ts",
        summary: "表单类型测试样例",
        tags: ["test", "formtype"],
        complexity: "simple",
      },
      {
        id: "function:src/formtype.test.ts:testRegistrationForm",
        type: "function",
        name: "testRegistrationForm",
        filePath: "src/formtype.test.ts",
        lineRange: [3, 8],
        summary: "验证注册表单命中用户注册",
        tags: ["test", "formtype"],
        complexity: "simple",
      },
      {
        id: "config:data/registration_form.yaml",
        type: "config",
        name: "registration_form.yaml",
        filePath: "data/registration_form.yaml",
        summary: "注册表单用户注册配置",
        tags: ["formtype", "config"],
        complexity: "simple",
      },
      {
        id: "document:docs/guide-formtype-design.md",
        type: "document",
        name: "guide-formtype-design.md",
        filePath: "docs/guide-formtype-design.md",
        summary: "注册表单设计文档，说明用户注册场景",
        tags: ["formtype", "design"],
        complexity: "simple",
      },
    ],
    edges: [
      {
        source: "file:src/formtype.ts",
        target: "function:src/formtype.ts:getFormType",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "file:src/formtype.test.ts",
        target: "function:src/formtype.test.ts:testRegistrationForm",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "function:src/formtype.test.ts:testRegistrationForm",
        target: "function:src/formtype.ts:getFormType",
        type: "tested_by",
        direction: "forward",
        weight: 0.5,
      },
      {
        source: "config:data/registration_form.yaml",
        target: "function:src/formtype.ts:getFormType",
        type: "configures",
        direction: "forward",
        weight: 0.6,
      },
      {
        source: "document:docs/guide-formtype-design.md",
        target: "function:src/formtype.ts:getFormType",
        type: "documents",
        direction: "forward",
        weight: 0.5,
      },
    ],
    layers: [
      {
        id: "layer:business",
        name: "业务逻辑",
        description: "表单业务逻辑",
        nodeIds: [
          "file:src/formtype.ts",
          "function:src/formtype.ts:getFormType",
          "file:src/formtype.test.ts",
          "function:src/formtype.test.ts:testRegistrationForm",
          "config:data/registration_form.yaml",
          "document:docs/guide-formtype-design.md",
        ],
      },
    ],
    tour: [],
  };
}

describe("business fact extraction", () => {
  it("extracts business facts from comments, constants, branches, and tests", () => {
    const profile = buildKnowledgeBaseProfile(formGraph());
    const plan = buildFileDocPlan(profile, {
      sourceFiles: {
        "src/formtype.ts": [
          "export function getFormType(ctx: RegistrationContext): number {",
          "  // 注册表单: 用户注册表单，命中后展示账户确认入口",
          "  const RegistrationFormType = 101;",
          "  switch (ctx.formType) {",
          "    case 101:",
          "      return RegistrationFormType;",
          "    default:",
          "      return 0;",
          "  }",
          "}",
        ].join("\n"),
        "src/formtype.test.ts": [
          "it('注册表单命中用户注册', () => {",
          "  expect(getFormType({ formType: 101 })).toBe(101);",
          "});",
        ].join("\n"),
      },
    });

    const task = plan.tasks.find((item) => item.filePath === "src/formtype.ts");
    expect(task).toBeDefined();

    const facts = extractBusinessFactsFromFileTask(profile, task!);

    expect(facts.map((fact) => fact.kind)).toEqual(expect.arrayContaining([
      "comment",
      "constant",
      "branch",
    ]));
    expect(facts.some((fact) => fact.title.includes("注册表单"))).toBe(true);
    expect(facts.some((fact) => fact.evidence.some((item) => item.lineRange?.[0] === 2))).toBe(true);
    expect(facts.every((fact) => fact.id.startsWith("business-fact:src/formtype.ts:"))).toBe(true);
    expect(facts.every((fact) => fact.evidence.every((item) => (item.excerpt?.length ?? 0) <= 220))).toBe(true);

    const testTask = plan.tasks.find((item) => item.filePath === "src/formtype.test.ts");
    expect(testTask).toBeDefined();

    const testFacts = extractBusinessFactsFromFileTask(profile, testTask!);
    expect(testFacts.map((fact) => fact.kind)).toContain("test");
    expect(testFacts.some((fact) => fact.title.includes("注册表单命中用户注册"))).toBe(true);
  });

  it("grades business evidence by source provenance and keeps domain terms", () => {
    const graph = formGraph();
    graph.nodes.push(
      {
        id: "file:src/strategy.ts",
        type: "file",
        name: "strategy.ts",
        filePath: "src/strategy.ts",
        summary: "表单校验与默认选项策略",
        tags: ["strategy", "business"],
        complexity: "complex",
      },
      {
        id: "function:src/strategy.ts:applyStrategy",
        type: "function",
        name: "applyStrategy",
        filePath: "src/strategy.ts",
        lineRange: [1, 8],
        summary: "命中表单校验后执行默认选项",
        tags: ["strategy", "business"],
        complexity: "complex",
      },
      {
        id: "file:agents/kb-file-writer.md",
        type: "file",
        name: "kb-file-writer.md",
        filePath: "agents/kb-file-writer.md",
        summary: "writer prompt example",
        tags: ["prompt"],
        complexity: "simple",
      },
    );
    graph.edges.push({
      source: "file:src/strategy.ts",
      target: "function:src/strategy.ts:applyStrategy",
      type: "contains",
      direction: "forward",
      weight: 1,
    });

    const profile = buildKnowledgeBaseProfile(graph);
    const plan = buildFileDocPlan(profile, {
      sourceFiles: {
        "src/strategy.ts": [
          "export function applyStrategy(ctx: Ctx): string {",
          "  // 表单校验：默认选项策略命中后默认选中跨品类推荐",
          "  if (ctx.enableMultiCategoryPenetration && ctx.defaultChecked) return '默认选项';",
          "  return 'manual';",
          "}",
        ].join("\n"),
        "src/formtype.test.ts": "it('注册表单命中用户注册', () => {});",
        "agents/kb-file-writer.md": "Example: 注册表单 and 默认选项 should be explained when source evidence supports them.",
      },
    });

    const productionTask = plan.tasks.find((item) => item.filePath === "src/strategy.ts");
    const testTask = plan.tasks.find((item) => item.filePath === "src/formtype.test.ts");
    const promptTask = plan.tasks.find((item) => item.filePath === "agents/kb-file-writer.md");

    expect(productionTask).toBeDefined();
    expect(testTask).toBeDefined();
    expect(promptTask).toBeDefined();

    const productionFacts = extractBusinessFactsFromFileTask(profile, productionTask!);
    const testFacts = extractBusinessFactsFromFileTask(profile, testTask!);
    const promptFacts = extractBusinessFactsFromFileTask(profile, promptTask!);
    const profileFacts = buildBusinessCapabilityProfile(profile, plan).facts;

    expect(productionFacts.some((fact) => fact.sourceKind === "production-logic")).toBe(true);
    expect(productionFacts.some((fact) => fact.evidenceRole === "primary")).toBe(true);
    expect(productionFacts.some((fact) => fact.sourceKind === "production-logic" && fact.confidence === "high")).toBe(true);
    expect(productionFacts.some((fact) => fact.sourceKind === "comment" && fact.confidence === "medium")).toBe(true);
    expect(productionFacts.flatMap((fact) => fact.keywords)).toEqual(expect.arrayContaining(["表单校验", "默认选项"]));
    expect(productionFacts.every((fact) => fact.businessMeaning.length > 8)).toBe(true);

    expect(testFacts.some((fact) => fact.sourceKind === "test")).toBe(true);
    expect(testFacts.every((fact) => fact.evidenceRole === "supporting")).toBe(true);
    expect(testFacts.every((fact) => fact.confidence === "medium")).toBe(true);
    expect(testFacts.some((fact) => fact.riskFlags.includes("test-only"))).toBe(true);

    expect(promptFacts.some((fact) => fact.sourceKind === "prompt-or-tooling-example")).toBe(true);
    expect(promptFacts.every((fact) => fact.evidenceRole === "example-only")).toBe(true);
    expect(promptFacts.every((fact) => fact.confidence === "low")).toBe(true);
    expect(promptFacts.some((fact) => fact.riskFlags.includes("prompt-only"))).toBe(true);

    expect(profileFacts.some((fact) => fact.sourceKind === "configuration" && fact.confidence === "high")).toBe(true);
    expect(profileFacts.some((fact) => fact.sourceKind === "documentation" && fact.confidence === "medium")).toBe(true);
  });

  it("does not classify production filenames ending in test as test evidence", () => {
    const graph = formGraph();
    graph.nodes.push(
      {
        id: "file:src/contest.ts",
        type: "file",
        name: "contest.ts",
        filePath: "src/contest.ts",
        summary: "策略规则命中逻辑",
        tags: ["strategy", "business"],
        complexity: "moderate",
      },
      {
        id: "file:src/latest.ts",
        type: "file",
        name: "latest.ts",
        filePath: "src/latest.ts",
        summary: "最新推荐策略",
        tags: ["strategy", "business"],
        complexity: "moderate",
      },
    );

    const profile = buildKnowledgeBaseProfile(graph);
    const plan = buildFileDocPlan(profile, {
      sourceFiles: {
        "src/contest.ts": "if (ctx.enableContestStrategy) return '策略';",
        "src/latest.ts": "if (ctx.enableLatestRanking) return '推荐';",
      },
    });

    const contestTask = plan.tasks.find((item) => item.filePath === "src/contest.ts");
    const latestTask = plan.tasks.find((item) => item.filePath === "src/latest.ts");

    expect(contestTask).toBeDefined();
    expect(latestTask).toBeDefined();

    const contestFacts = extractBusinessFactsFromFileTask(profile, contestTask!);
    const latestFacts = extractBusinessFactsFromFileTask(profile, latestTask!);

    expect(contestFacts.some((fact) => fact.sourceKind === "production-logic")).toBe(true);
    expect(latestFacts.some((fact) => fact.sourceKind === "production-logic")).toBe(true);
    expect([...contestFacts, ...latestFacts].every((fact) => fact.sourceKind !== "test")).toBe(true);
  });

  it("does not emit generic test or type path segments as business keywords", () => {
    const graph = formGraph();
    graph.nodes.push({
      id: "file:src/type.ts",
      type: "file",
      name: "type.ts",
      filePath: "src/type.ts",
      summary: "策略规则常量",
      tags: ["strategy"],
      complexity: "simple",
    });

    const profile = buildKnowledgeBaseProfile(graph);
    const plan = buildFileDocPlan(profile, {
      sourceFiles: {
        "src/formtype.test.ts": "it('注册表单命中用户注册', () => {});",
        "src/type.ts": "const StrategyRule = '策略';",
      },
    });

    const testTask = plan.tasks.find((item) => item.filePath === "src/formtype.test.ts");
    const typeTask = plan.tasks.find((item) => item.filePath === "src/type.ts");

    expect(testTask).toBeDefined();
    expect(typeTask).toBeDefined();

    const testKeywords = extractBusinessFactsFromFileTask(profile, testTask!).flatMap((fact) => fact.keywords);
    const typeKeywords = extractBusinessFactsFromFileTask(profile, typeTask!).flatMap((fact) => fact.keywords);

    expect(testKeywords).toContain("formtype");
    expect(testKeywords).not.toContain("test");
    expect(typeKeywords).not.toContain("type");
  });

  it("builds capability groups from source facts plus config and document graph nodes", () => {
    const profile = buildKnowledgeBaseProfile(formGraph());
    const fileDocPlan = buildFileDocPlan(profile, {
      sourceFiles: {
        "src/formtype.ts": [
          "// 注册表单: 用户注册表单",
          "const RegistrationFormType = 101;",
          "switch (ctx.formType) { case 101: return RegistrationFormType; }",
        ].join("\n"),
        "src/formtype.test.ts": "it('注册表单命中用户注册', () => {});",
      },
    });

    const capabilityProfile = buildBusinessCapabilityProfile(profile, fileDocPlan);

    expect(capabilityProfile.totalFacts).toBeGreaterThanOrEqual(6);
    expect(capabilityProfile.sourceBackedFacts).toBeGreaterThanOrEqual(4);
    expect(capabilityProfile.capabilities.length).toBeGreaterThanOrEqual(1);

    const formCapability = capabilityProfile.capabilities.find((capability) =>
      capability.title.includes("注册表单") || capability.keywords.includes("formtype")
    );
    expect(formCapability).toBeDefined();
    expect(formCapability?.factIds.length).toBeGreaterThanOrEqual(4);
    expect(formCapability?.relatedNodeIds).toEqual(expect.arrayContaining([
      "config:data/registration_form.yaml",
      "document:docs/guide-formtype-design.md",
      "file:src/formtype.ts",
    ]));
  });

  it("marks prompt-only business terms as example-only capabilities", () => {
    const graph = formGraph();
    graph.nodes = [
      {
        id: "file:agents/kb-file-writer.md",
        type: "file",
        name: "kb-file-writer.md",
        filePath: "agents/kb-file-writer.md",
        summary: "注册表单 writer example",
        tags: ["prompt", "formtype"],
        complexity: "simple",
      },
    ];
    graph.edges = [];
    graph.layers = [{
      id: "layer:prompt",
      name: "Prompt",
      description: "writer examples",
      nodeIds: ["file:agents/kb-file-writer.md"],
    }];

    const profile = buildKnowledgeBaseProfile(graph);
    const fileDocPlan = buildFileDocPlan(profile, {
      sourceFiles: {
        "agents/kb-file-writer.md": "Example: 注册表单 命中后解释表单校验和默认选项。",
      },
    });

    const capabilityProfile = buildBusinessCapabilityProfile(profile, fileDocPlan);
    const capability = capabilityProfile.capabilities.find((item) =>
      item.keywords.includes("注册表单") || item.keywords.includes("默认选项")
    );

    expect(capability).toBeDefined();
    expect(capability?.evidenceRole).toBe("example-only");
    expect(capability?.confidence).toBe("low");
    expect(capability?.primaryFactIds).toEqual([]);
    expect(capability?.exampleOnlyFactIds.length).toBeGreaterThan(0);
  });

  it("promotes capabilities when production or configuration evidence exists", () => {
    const profile = buildKnowledgeBaseProfile(formGraph());
    const fileDocPlan = buildFileDocPlan(profile, {
      sourceFiles: {
        "src/formtype.ts": [
          "// 注册表单: 用户注册表单",
          "const RegistrationFormType = 101;",
          "switch (ctx.formType) { case 101: return RegistrationFormType; }",
        ].join("\n"),
        "src/formtype.test.ts": "it('注册表单命中用户注册', () => {});",
      },
    });

    const capabilityProfile = buildBusinessCapabilityProfile(profile, fileDocPlan);
    const capability = capabilityProfile.capabilities.find((item) =>
      item.title.includes("注册表单") || item.keywords.includes("formtype")
    );

    expect(capability).toBeDefined();
    expect(capability?.evidenceRole).toBe("primary");
    expect(capability?.confidence).toBe("high");
    expect(capability?.primaryFactIds.length).toBeGreaterThan(0);
    expect(capability?.sourceKindCounts["production-logic"]).toBeGreaterThan(0);
  });

  it("ranks primary capabilities ahead of larger example-only groups without dropping examples", () => {
    const graph = formGraph();
    graph.nodes = [
      {
        id: "file:src/strategy.ts",
        type: "file",
        name: "strategy.ts",
        filePath: "src/strategy.ts",
        summary: "production strategy rules",
        tags: ["strategy", "business"],
        complexity: "simple",
      },
      {
        id: "file:agents/kb-file-writer.md",
        type: "file",
        name: "kb-file-writer.md",
        filePath: "agents/kb-file-writer.md",
        summary: "prompt examples",
        tags: ["prompt", "formtype"],
        complexity: "simple",
      },
    ];
    graph.edges = [];
    graph.layers = [{
      id: "layer:capabilities",
      name: "Capabilities",
      description: "mixed evidence strengths",
      nodeIds: ["file:src/strategy.ts", "file:agents/kb-file-writer.md"],
    }];

    const profile = buildKnowledgeBaseProfile(graph);
    const fileDocPlan = buildFileDocPlan(profile, {
      sourceFiles: {
        "src/strategy.ts": "const StrategyRule = 'strategy';",
        "agents/kb-file-writer.md": [
          "Example: 注册表单 命中后解释默认选项。",
          "Example: 注册表单 命中后解释表单校验。",
          "Example: 注册表单 命中后解释导流。",
          "Example: 注册表单 命中后解释策略。",
          "Example: 注册表单 命中后解释召回。",
          "Example: 注册表单 命中后解释配额。",
        ].join("\n"),
      },
    });

    const capabilityProfile = buildBusinessCapabilityProfile(profile, fileDocPlan);
    const primaryCapability = capabilityProfile.capabilities.find((item) => item.evidenceRole === "primary");
    const exampleCapability = capabilityProfile.capabilities.find((item) => item.evidenceRole === "example-only");

    expect(primaryCapability).toBeDefined();
    expect(exampleCapability).toBeDefined();
    expect(exampleCapability!.score).toBeGreaterThan(primaryCapability!.score);
    expect(capabilityProfile.capabilities[0]).toBe(primaryCapability);
    expect(capabilityProfile.capabilities).toContain(exampleCapability);
  });

  it("generates business capability documents and coverage from extracted facts", () => {
    const graph = formGraph();
    const kb = generateKnowledgeBase(graph, {
      sourceFiles: {
        "src/formtype.ts": [
          "// 注册表单: 用户注册表单",
          "const RegistrationFormType = 101;",
          "switch (ctx.formType) { case 101: return RegistrationFormType; }",
        ].join("\n"),
        "src/formtype.test.ts": "it('注册表单命中用户注册', () => {});",
        "data/registration_form.yaml": "formType: 101\nchannel: signup-web\n",
        "docs/guide-formtype-design.md": "# 注册表单\n用户注册场景。\n",
      },
    });

    expect(kb.businessCapabilityProfile.totalFacts).toBeGreaterThanOrEqual(6);
    expect(kb.businessCapabilityProfile.capabilities.length).toBeGreaterThanOrEqual(1);

    const businessCapabilityDocs = kb.documents.filter((document) => document.category === "capability");
    expect(businessCapabilityDocs.length).toBeGreaterThan(0);
    expect(businessCapabilityDocs.length).toBeLessThanOrEqual(6);
    expect(kb.businessCapabilityProfile.facts.flatMap((fact) => fact.evidence).some((evidence) =>
      ["config:data/registration_form.yaml", "document:docs/guide-formtype-design.md"].includes(evidence.nodeId ?? "")
      && evidence.lineRange === undefined
    )).toBe(true);
    expect(businessCapabilityDocs.flatMap((document) => document.sourceEvidence)).not.toHaveLength(0);
    for (const evidence of businessCapabilityDocs.flatMap((document) => document.sourceEvidence)) {
      expect(evidence.nodeId?.trim()).toBeTruthy();
      expect(evidence.filePath.trim()).toBeTruthy();
      expect(evidence.excerpt?.trim()).toBeTruthy();
      expect(evidence.claim).toMatch(/\p{Script=Han}/u);
      expect(evidence.lineRange).toEqual([
        expect.any(Number),
        expect.any(Number),
      ]);
      expect(Number.isInteger(evidence.lineRange?.[0]) && (evidence.lineRange?.[0] ?? 0) > 0).toBe(true);
      expect(Number.isInteger(evidence.lineRange?.[1]) && (evidence.lineRange?.[1] ?? 0) >= (evidence.lineRange?.[0] ?? 0)).toBe(true);
    }
    for (const nodeId of [
      "config:data/registration_form.yaml",
      "document:docs/guide-formtype-design.md",
    ]) {
      expect(businessCapabilityDocs.flatMap((document) => document.sourceEvidence)).toContainEqual(
        expect.objectContaining({
          nodeId,
          claim: expect.stringMatching(/^事实“.+”支持能力“.+”中的/u),
        }),
      );
    }
    expect(() => buildKnowledgeArtifacts({
      projectName: graph.project.name,
      generatedAt: "2026-07-11T00:00:00.000Z",
      outputLanguage: "zh-CN",
      generationMode: "deterministic",
      gitCommitHash: graph.project.gitCommitHash,
      sourceRootIdentity: "/workspace/sample-repository",
      sourceRead: {
        covered: kb.fileDocPlan.tasks.filter((task) => task.sourceSnapshot.exists).length,
        total: kb.fileDocPlan.tasks.length,
        missingIds: kb.fileDocPlan.tasks
          .filter((task) => !task.sourceSnapshot.exists)
          .map((task) => task.fileNodeId),
      },
      requiredRouteStages: kb.plan.requiredRouteStages,
      businessTerms: [],
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        name: node.name,
        ...(node.filePath ? { filePath: node.filePath } : {}),
      })),
      referenceFileNodeIds: kb.fileDocPlan.tasks.map((task) => task.fileNodeId),
      documents: kb.documents,
      warnings: kb.validation.warnings,
      errors: kb.validation.errors,
    })).not.toThrow();
    const publishableCapability = businessCapabilityDocs.find((document) => document.title === "注册表单");
    expect(publishableCapability).toEqual(expect.objectContaining({
      role: "featured",
      quality: "generated",
      qualityIssues: [],
    }));
    const insufficientCapability = businessCapabilityDocs.find((document) => document.title === "FormType / 表单类型");
    expect(insufficientCapability).toBeUndefined();
    expect(kb.coverageReport.businessCapabilityCoverage.total).toBe(businessCapabilityDocs.length);
    expect(kb.coverageReport.businessCapabilityCoverage.covered).toBe(
      businessCapabilityDocs.filter((document) => document.role === "featured").length,
    );
    expect(kb.coverageReport.businessCapabilityCoverage.missing).toEqual([]);

    const unplannedExampleCapability = {
      ...kb.businessCapabilityProfile.capabilities[0]!,
      id: "capability:unplanned-example",
      title: "仅示例能力",
      evidenceRole: "example-only" as const,
    };
    const recalculated = buildCoverageReport(
      kb.profile,
      kb.fileDocPlan,
      kb.topicPlan,
      kb.plan,
      kb.documents.filter((document) => document.role !== "maintenance"),
      kb.validation,
      kb.retryPlan,
      {
        ...kb.businessCapabilityProfile,
        capabilities: [...kb.businessCapabilityProfile.capabilities, unplannedExampleCapability],
      },
      undefined,
    );
    expect(recalculated.businessCapabilityCoverage.total).toBe(businessCapabilityDocs.length);
    expect(recalculated.businessCapabilityCoverage.covered).toBe(
      kb.coverageReport.businessCapabilityCoverage.covered,
    );
    expect(recalculated.businessCapabilityCoverage.missing).toEqual([]);

    const capabilityDoc = kb.documents.find((document) =>
      document.path.startsWith("业务能力/")
      && document.content.includes("注册表单")
    );
    expect(capabilityDoc?.category).toBe("capability");
    expect(capabilityDoc?.content).toContain("## 业务场景与触发");
    expect(capabilityDoc?.content).toContain("## 规则与分支");
    expect(capabilityDoc?.content).toContain("## 输入输出与状态变化");
    expect(capabilityDoc?.content).toContain("## 异常与降级");
    expect(capabilityDoc?.content).toContain("## 模块实现");
    expect(capabilityDoc?.content).toContain("## 源码证据");
    expect(capabilityDoc?.content).not.toContain("## 非技术同学速读");
    expect(capabilityDoc?.content).not.toContain("## 主证据事实");
    expect(capabilityDoc?.content).toContain("production-logic");
    expect(capabilityDoc?.content).toContain("src/formtype.ts");
    expect(capabilityDoc?.content).toContain("docs/guide-formtype-design.md");

    const report = kb.documents.find((document) => document.path === "引用覆盖.md");
    expect(kb.coverageReport.qualityValidation.checked).toBeGreaterThan(0);
    expect(report?.content).toContain("## 业务证据覆盖");
    expect(report?.content).toContain("业务事实：");
    expect(report?.content).toContain("业务能力：");
  });

  it("reports high-signal business files that produced no extracted facts", () => {
    const graph = formGraph();
    graph.nodes.push({
      id: "file:src/business-empty.ts",
      type: "file",
      name: "business-empty.ts",
      filePath: "src/business-empty.ts",
      summary: "导流业务空实现文件",
      tags: ["business", "guide"],
      complexity: "moderate",
    });

    const kb = generateKnowledgeBase(graph, {
      sourceFiles: {
        "src/formtype.ts": "// 注册表单: 用户注册表单",
        "src/formtype.test.ts": "it('注册表单命中用户注册', () => {});",
        "src/business-empty.ts": "export function noop() { return true; }\n",
        "data/registration_form.yaml": "formType: 101\nchannel: signup-web\n",
        "docs/guide-formtype-design.md": "# 注册表单\n用户注册场景。\n",
      },
    });

    expect(kb.coverageReport.businessFactCoverage.missing).toContain("file:src/business-empty.ts");
    const report = kb.documents.find((document) => document.path === "引用覆盖.md");
    expect(report?.content).toContain("file:src/business-empty.ts");
  });
});
