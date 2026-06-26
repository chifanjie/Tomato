export const KB_PATHS = {
  inventory: "目录.md",
  projectOverview: "项目总览.md",
  architectureMap: "架构地图.md",
  businessFlowMap: "业务流程地图.md",
  coverageReport: "覆盖报告.md",
  pendingItems: "待确认项.md",
  moduleDir: "模块总览",
  fileDir: "文件文档",
  topicDir: "关键函数专题",
  indexDir: "索引",
  intermediateDir: ".intermediate",
} as const;

export function slugPath(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[:/\\]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_.-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "untitled";
}

export function fileDocumentPath(filePath: string): string {
  return `${KB_PATHS.fileDir}/${slugPath(filePath)}.md`;
}

export function topicDocumentPath(filePath: string, nodeName: string): string {
  return `${KB_PATHS.topicDir}/${slugPath(filePath)}-${slugPath(nodeName)}.md`;
}

export function moduleDocumentPath(layerName: string): string {
  return `${KB_PATHS.moduleDir}/${slugPath(layerName)}.md`;
}
