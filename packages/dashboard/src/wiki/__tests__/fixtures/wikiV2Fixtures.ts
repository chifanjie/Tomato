import type {
  WikiIndexV2,
  WikiPageV2,
  WikiSearchRecordV2,
} from "@understand-code/core/knowledge-base";

function coverage(total: number) {
  return { covered: total, total, missingIds: [] };
}

export function wikiV2Fixture(): WikiIndexV2 {
  return {
    version: 2,
    generatedAt: "2026-07-11T00:00:00.000Z",
    projectName: "示例项目",
    source: {
      outputLanguage: "zh-CN",
      generationMode: "writer",
      graphDigest: "fixture-digest",
      sourceRootIdentity: "/workspace/example",
    },
    mainReadiness: {
      status: "ready",
      reasons: [],
      routePageIds: ["page:overview", "page:run"],
    },
    referenceCoverage: {
      status: "complete",
      files: { covered: 0, total: 0, missingIds: [] },
      functions: { covered: 1, total: 1, missingIds: [] },
      types: { covered: 0, total: 0, missingIds: [] },
    },
    pages: [
      {
        id: "page:overview",
        title: "项目总览",
        summary: "先理解项目目标，再进入核心运行流程。",
        markdownPath: "knowledge-base/项目总览.md",
        role: "featured",
        category: "overview",
        quality: "needs-review",
        generationStatus: "partial",
        directNodeIds: [],
        contextNodeIds: ["function:src/a.ts:run"],
        evidenceIds: [],
        searchTerms: ["项目", "入口"],
        route: { order: 0, stage: "purpose" },
      },
      {
        id: "page:run",
        title: "运行流程",
        summary: "解释 run 函数的调用与结果。",
        markdownPath: "knowledge-base/核心流程/运行流程.md",
        role: "featured",
        category: "flow",
        quality: "generated",
        generationStatus: "complete",
        directNodeIds: ["function:src/a.ts:run"],
        contextNodeIds: [],
        evidenceIds: ["evidence:run"],
        searchTerms: ["run", "运行"],
        route: { order: 1, stage: "flow" },
      },
      {
        id: "page:file-a",
        title: "a.ts 文件参考",
        summary: "记录 a.ts 中的实现入口。",
        markdownPath: "knowledge-base/参考/文件/src/a.ts.md",
        role: "reference",
        category: "file",
        quality: "generated",
        generationStatus: "complete",
        directNodeIds: ["function:src/a.ts:run"],
        contextNodeIds: [],
        evidenceIds: ["evidence:run"],
        searchTerms: ["src/a.ts"],
      },
    ],
    nodeDocumentation: [
      {
        nodeId: "function:src/a.ts:run",
        relation: "direct",
        quality: "generated",
        evidenceHealth: "source-linked",
        generationStatus: "complete",
        referenceCoverage: "anchored",
        directPageIds: ["page:run", "page:file-a"],
        contextPageIds: ["page:overview"],
        evidenceIds: ["evidence:run"],
        primaryPageId: "page:run",
        anchor: "run",
      },
    ],
    evidence: [
      {
        id: "evidence:run",
        nodeIds: ["function:src/a.ts:run"],
        filePath: "src/a.ts",
        lineRange: [1, 3],
        excerpt: "export function run() {}",
        evidenceType: "production",
      },
    ],
  };
}

export function searchFixture(): WikiSearchRecordV2[] {
  const businessTerms = ["表单校验"];
  return [
    {
      id: "search:overview",
      kind: "page",
      title: "表单校验总览",
      summary: "解释业务目标与入口。",
      content: "正文包含完整的业务背景。",
      pageId: "page:overview",
      role: "featured",
      category: "overview",
      relation: "direct",
      terms: ["项目入口"],
      businessTerms,
    },
    {
      id: "search:flow",
      kind: "page",
      title: "运行流程",
      summary: "表单校验的核心调用流程。",
      pageId: "page:run",
      role: "featured",
      category: "flow",
      relation: "direct",
      terms: ["run", "运行"],
      businessTerms,
    },
    {
      id: "search:file",
      kind: "page",
      title: "a.ts 文件参考",
      summary: "表单校验的实现入口。",
      pageId: "page:file-a",
      role: "reference",
      category: "file",
      relation: "direct",
      terms: ["src/a.ts"],
      businessTerms,
      filePath: "src/a.ts",
    },
    {
      id: "search:run",
      kind: "symbol",
      title: "run",
      summary: "执行核心策略。",
      pageId: "page:file-a",
      anchor: "run",
      nodeId: "function:src/a.ts:run",
      role: "reference",
      category: "file",
      relation: "direct",
      terms: ["run", "src/a.ts", "表单校验"],
      businessTerms: [],
      filePath: "src/a.ts",
    },
    {
      id: "search:context",
      kind: "page",
      title: "背景资料",
      summary: "表单校验的上下文说明。",
      pageId: "page:overview",
      role: "maintenance",
      category: "other",
      relation: "context",
      terms: ["背景"],
      businessTerms,
    },
  ];
}

export function largeWikiFixture(options: {
  files: number;
  symbols: number;
  featured: number;
}): WikiIndexV2 {
  if (!Number.isInteger(options.files) || options.files < 1) {
    throw new RangeError("files must be at least 1");
  }
  if (!Number.isInteger(options.symbols) || options.symbols < 0) {
    throw new RangeError("symbols must be non-negative");
  }
  if (!Number.isInteger(options.featured) || options.featured < 1) {
    throw new RangeError("featured must be at least 1");
  }

  const base = wikiV2Fixture();
  const symbolIdsByFile = Array.from({ length: options.files }, () => [] as string[]);
  for (let index = 0; index < options.symbols; index += 1) {
    const fileIndex = index % options.files;
    symbolIdsByFile[fileIndex]!.push(
      `function:src/module-${fileIndex % 4}/file-${fileIndex}.ts:symbol${index}`,
    );
  }

  const featured: WikiPageV2[] = Array.from(
    { length: options.featured },
    (_, index) => ({
      id: `page:featured-${index}`,
      title: `推荐阅读 ${index + 1}`,
      summary: `第 ${index + 1} 篇主干阅读文档。`,
      markdownPath: `knowledge-base/主干/featured-${index}.md`,
      role: "featured",
      category: index === 0 ? "overview" : "topic",
      quality: "generated",
      generationStatus: "complete",
      directNodeIds: [`module:featured-${index}`],
      contextNodeIds: [],
      evidenceIds: [`evidence:featured-${index}`],
      searchTerms: [],
      route: {
        order: index,
        stage: index === 0 ? "purpose" : "implementation",
      },
    }),
  );

  const references: WikiPageV2[] = Array.from({ length: options.files }, (_, index) => {
    const filePath = `src/module-${index % 4}/file-${index}.ts`;
    return {
      id: `page:file-${index}`,
      title: `file-${index}.ts`,
      summary: `${filePath} 文件说明。`,
      markdownPath: `knowledge-base/文件文档/${filePath}.md`,
      role: "reference",
      category: "file",
      quality: "generated",
      generationStatus: "complete",
      directNodeIds: [`file:${filePath}`, ...symbolIdsByFile[index]!],
      contextNodeIds: [],
      evidenceIds: [`evidence:file-${index}`],
      searchTerms: [
        filePath,
        ...symbolIdsByFile[index]!.map((id) => id.slice(id.lastIndexOf(":") + 1)),
      ],
    };
  });

  const featuredEvidence = featured.map((page, index) => ({
    id: `evidence:featured-${index}`,
    nodeIds: [...page.directNodeIds],
    filePath: `src/module-${index % 4}/file-${index % options.files}.ts`,
    lineRange: [1, 2] as [number, number],
    excerpt: `// 推荐阅读 ${index + 1}`,
    evidenceType: "production" as const,
  }));
  const fileEvidence = references.map((page, index) => ({
    id: `evidence:file-${index}`,
    nodeIds: [...page.directNodeIds],
    filePath: `src/module-${index % 4}/file-${index}.ts`,
    lineRange: [1, Math.max(2, page.directNodeIds.length + 1)] as [number, number],
    excerpt: `export function file${index}() {}`,
    evidenceType: "production" as const,
  }));

  return {
    ...base,
    mainReadiness: {
      status: "ready",
      reasons: [],
      routePageIds: featured.map((page) => page.id),
    },
    referenceCoverage: {
      status: "complete",
      files: coverage(options.files),
      functions: coverage(options.symbols),
      types: coverage(0),
    },
    pages: [...featured, ...references],
    nodeDocumentation: [
      ...featured.map((page, index) => ({
        nodeId: page.directNodeIds[0]!,
        relation: "direct" as const,
        quality: "generated" as const,
        evidenceHealth: "source-linked" as const,
        generationStatus: "complete" as const,
        referenceCoverage: "not-applicable" as const,
        directPageIds: [page.id],
        contextPageIds: [],
        evidenceIds: [`evidence:featured-${index}`],
        primaryPageId: page.id,
      })),
      ...references.map((page, index) => ({
        nodeId: page.directNodeIds[0]!,
        relation: "direct" as const,
        quality: "generated" as const,
        evidenceHealth: "source-linked" as const,
        generationStatus: "complete" as const,
        referenceCoverage: "anchored" as const,
        directPageIds: [page.id],
        contextPageIds: [],
        evidenceIds: [`evidence:file-${index}`],
        primaryPageId: page.id,
      })),
      ...Array.from({ length: options.symbols }, (_, index) => {
        const fileIndex = index % options.files;
        return {
          nodeId: `function:src/module-${fileIndex % 4}/file-${fileIndex}.ts:symbol${index}`,
          relation: "direct" as const,
          quality: "generated" as const,
          evidenceHealth: "source-linked" as const,
          generationStatus: "complete" as const,
          referenceCoverage: "anchored" as const,
          directPageIds: [`page:file-${fileIndex}`],
          contextPageIds: [],
          evidenceIds: [`evidence:file-${fileIndex}`],
          primaryPageId: `page:file-${fileIndex}`,
          anchor: `symbol${index}`,
        };
      }),
    ],
    evidence: [...featuredEvidence, ...fileEvidence],
  };
}
