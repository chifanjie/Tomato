import type { KnowledgeGraph } from "@understand-anything/core/types";
import type { FunctionImpact } from "./types";

function mapFunctionsToFiles(graph: KnowledgeGraph): Map<string, string> {
  const result = new Map<string, string>();
  for (const edge of graph.edges) {
    if (edge.type === "contains" && edge.target.startsWith("function:")) {
      result.set(edge.target, edge.source);
    }
  }
  return result;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function buildFunctionImpact(graph: KnowledgeGraph, functionId: string): FunctionImpact {
  const functionToFile = mapFunctionsToFiles(graph);
  const sourceFileId = functionToFile.get(functionId) ?? null;
  const calls = graph.edges.filter((edge) => edge.type === "calls");

  if (calls.length > 0) {
    const outgoingFunctionIds = uniqueSorted(calls.filter((edge) => edge.source === functionId).map((edge) => edge.target));
    const incomingFunctionIds = uniqueSorted(calls.filter((edge) => edge.target === functionId).map((edge) => edge.source));
    const outgoingFileIds = uniqueSorted(outgoingFunctionIds.map((id) => functionToFile.get(id)).filter((id): id is string => Boolean(id)));
    const incomingFileIds = uniqueSorted(incomingFunctionIds.map((id) => functionToFile.get(id)).filter((id): id is string => Boolean(id)));

    return {
      functionId,
      source: "calls",
      outgoingFunctionIds,
      incomingFunctionIds,
      outgoingFileIds,
      incomingFileIds,
      totalDownstream: outgoingFunctionIds.length + outgoingFileIds.length,
      totalUpstream: incomingFunctionIds.length + incomingFileIds.length,
    };
  }

  const outgoingFileIds = sourceFileId
    ? uniqueSorted(graph.edges.filter((edge) => edge.type === "imports" && edge.source === sourceFileId).map((edge) => edge.target))
    : [];
  const incomingFileIds = sourceFileId
    ? uniqueSorted(graph.edges.filter((edge) => edge.type === "imports" && edge.target === sourceFileId).map((edge) => edge.source))
    : [];

  return {
    functionId,
    source: "imports",
    outgoingFunctionIds: [],
    incomingFunctionIds: [],
    outgoingFileIds,
    incomingFileIds,
    totalDownstream: outgoingFileIds.length,
    totalUpstream: incomingFileIds.length,
  };
}
