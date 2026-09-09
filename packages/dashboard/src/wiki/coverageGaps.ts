import type { CountSummaryV2 } from "@understand-code/core/knowledge-base";
import type { KnowledgeGraph } from "@understand-code/core/types";

export interface CoverageGapEntry {
  nodeId: string;
  /** What the reader looks for first: a symbol name, or a path for file nodes. */
  label: string;
  /** Where that symbol lives, omitted when the label is already the location. */
  location: string | null;
}

export interface CoverageGapList {
  entries: readonly CoverageGapEntry[];
  /** Every missing node, including the ones beyond the listed entries. */
  total: number;
  /** How many the caller must summarize rather than render. */
  remaining: number;
}

/**
 * Reads a node id when the graph cannot name the node.
 *
 * Ids are "<kind>:<path>" or "<kind>:<path>:<symbol>", so the tail is the
 * symbol and the middle is where to find it. A shape we do not recognize is
 * shown verbatim — an opaque id still beats saying nothing.
 */
function entryFromNodeId(nodeId: string): CoverageGapEntry {
  const segments = nodeId.split(":");
  if (segments.length < 2) return { nodeId, label: nodeId, location: null };
  const [, path, ...symbol] = segments;
  const name = symbol.join(":");
  if (name) return { nodeId, label: name, location: path };
  return { nodeId, label: path, location: null };
}

/**
 * Names the nodes a coverage bucket reports as uncovered.
 *
 * The generator already records exactly which nodes were missed, so a reader
 * told "315/325 files" can be told which ten. Entries are capped because a
 * large repository can miss hundreds; the remainder is counted, never dropped
 * silently.
 */
export function describeCoverageGaps(
  summary: CountSummaryV2 | undefined,
  graph: KnowledgeGraph | null,
  limit = 12,
): CoverageGapList {
  const missingIds = summary?.missingIds ?? [];
  const nodesById = new Map((graph?.nodes ?? []).map((node) => [node.id, node]));
  const entries = missingIds.slice(0, Math.max(0, limit)).map((nodeId) => {
    const node = nodesById.get(nodeId);
    if (node === undefined) return entryFromNodeId(nodeId);
    if (node.filePath === undefined) return { nodeId, label: node.name, location: null };
    if (node.filePath === node.name) return { nodeId, label: node.filePath, location: null };
    return { nodeId, label: node.name, location: node.filePath };
  });
  return {
    entries,
    total: missingIds.length,
    remaining: Math.max(0, missingIds.length - entries.length),
  };
}
