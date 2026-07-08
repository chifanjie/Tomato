import type { GraphNode, KnowledgeGraph } from "@understand-code/core/types";

export type FunctionGroupKind = "entry" | "filter" | "data" | "model" | "other";

export interface FunctionDot {
  nodeId: string;
  name: string;
  group: FunctionGroupKind;
  size: 1;
  lineRange?: [number, number];
  complexity: GraphNode["complexity"];
  isExported: boolean;
  impactScore: number;
}

export interface FunctionGroup {
  kind: FunctionGroupKind;
  label: string;
  count: number;
  dots: FunctionDot[];
}

export interface ViewFileSummary {
  id: string;
  name: string;
  filePath: string;
  layerId: string | null;
  node: GraphNode;
  functionCount: number;
  classCount: number;
  importOutCount: number;
  importInCount: number;
  functionDots: FunctionDot[];
  functionGroups: FunctionGroup[];
}

export interface ViewLayerSummary {
  id: string;
  name: string;
  description: string;
  fileCount: number;
  functionCount: number;
  classCount: number;
  moduleCount: number;
  topFiles: ViewFileSummary[];
}

export interface FunctionImpact {
  functionId: string;
  source: "calls" | "imports";
  outgoingFunctionIds: string[];
  incomingFunctionIds: string[];
  outgoingFileIds: string[];
  incomingFileIds: string[];
  totalDownstream: number;
  totalUpstream: number;
}

export interface ViewGraph {
  raw: KnowledgeGraph;
  layers: ViewLayerSummary[];
  layersById: Map<string, ViewLayerSummary>;
  filesById: Map<string, ViewFileSummary>;
  functionToFileId: Map<string, string>;
  fileToFunctionIds: Map<string, string[]>;
}
