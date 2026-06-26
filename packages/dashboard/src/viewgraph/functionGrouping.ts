import type { FunctionDot, FunctionGroup, FunctionGroupKind } from "./types";

const GROUP_LABELS: Record<FunctionGroupKind, string> = {
  entry: "Entry",
  filter: "Filter",
  data: "Data / RPC",
  model: "Model",
  other: "Other",
};

export function classifyFunctionName(name: string): FunctionGroupKind {
  if (/^(main|run|start|handle|handler|serve|process|execute|init)/i.test(name)) return "entry";
  if (/(filter|allow|deny|check|valid|skip|match|guard|limit)/i.test(name)) return "filter";
  if (/(get|fetch|load|query|rpc|data|repo|dao|cache|request|response|build)/i.test(name)) return "data";
  if (/(model|dto|entity|schema|convert|marshal|unmarshal|render|format)/i.test(name)) return "model";
  return "other";
}

export function groupFunctionDots(dots: FunctionDot[]): FunctionGroup[] {
  const buckets = new Map<FunctionGroupKind, FunctionDot[]>();
  const order: FunctionGroupKind[] = [];
  for (const dot of dots) {
    const list = buckets.get(dot.group) ?? [];
    if (list.length === 0) order.push(dot.group);
    list.push(dot);
    buckets.set(dot.group, list);
  }

  return order
    .map((kind) => {
      const groupedDots = buckets.get(kind) ?? [];
      return {
        kind,
        label: GROUP_LABELS[kind],
        count: groupedDots.length,
        dots: groupedDots,
      };
    })
    .filter((group) => group.count > 0);
}
