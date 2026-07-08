const nodeTypeLabels: Record<string, string> = {
  file: "文件",
  function: "函数",
  class: "类",
  module: "模块",
  concept: "概念",
  config: "配置",
  document: "文档",
  service: "服务",
  table: "数据表",
  endpoint: "接口",
  pipeline: "管道",
  schema: "Schema",
  resource: "资源",
  domain: "领域",
  flow: "流程",
  step: "步骤",
  article: "文章",
  entity: "实体",
  topic: "主题",
  claim: "断言",
  source: "来源",
};

const complexityLabels: Record<string, string> = {
  simple: "简单",
  moderate: "中等",
  complex: "复杂",
};

export function nodeTypeDisplayLabel(nodeType: string | undefined): string {
  if (!nodeType) return "节点";
  return nodeTypeLabels[nodeType] ?? nodeType;
}

export function complexityDisplayLabel(complexity: string | undefined): string {
  if (!complexity) return "";
  return complexityLabels[complexity] ?? complexity;
}
