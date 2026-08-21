import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";

import type { GraphNode } from "@understand-code/core";

import { stableId } from "./ids.js";
import { compareUnicodeCodeUnits } from "./stable-order.js";
import type { TaskChangeHunk } from "./engine-types.js";

const FATAL_UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

export const CHANGE_ANALYSIS_LIMITS = Object.freeze({
  maxFileBytes: 8 * 1024 * 1024,
  maxLinesPerSide: 2_000,
  maxEditCells: 2_000_000,
  maxHunks: 1_024,
});

export type DeterministicDiffFailure =
  | "binary_or_invalid_utf8"
  | "budget_exhausted";

export type DeterministicDiffResult =
  | {
      readonly ok: true;
      readonly hunks: readonly {
        readonly id: string;
        readonly oldLineRange?: readonly [number, number];
        readonly newLineRange?: readonly [number, number];
      }[];
    }
  | { readonly ok: false; readonly code: DeterministicDiffFailure };

function lineTokens(bytes: Buffer): string[] | undefined {
  if (bytes.includes(0)) return undefined;
  let source: string;
  try {
    source = FATAL_UTF8_DECODER.decode(bytes);
  } catch {
    return undefined;
  }
  if (source.length === 0) return [];
  return source.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/gu) ?? [];
}

function lineDigest(line: string): string {
  return createHash("sha256").update(line, "utf8").digest("hex");
}

/**
 * A bounded deterministic line diff for the Alpha Check path. It deliberately
 * uses an explicit LCS table and a fixed delete-before-insert tie break so JS
 * engine/container iteration order cannot alter hunk boundaries or IDs.
 */
export function deterministicLineDiff(input: {
  readonly baselineSnapshotId: string;
  readonly actualSnapshotId: string;
  readonly filePath: string;
  readonly before: Buffer;
  readonly after: Buffer;
}): DeterministicDiffResult {
  if (
    input.before.byteLength > CHANGE_ANALYSIS_LIMITS.maxFileBytes ||
    input.after.byteLength > CHANGE_ANALYSIS_LIMITS.maxFileBytes
  ) {
    return { ok: false, code: "budget_exhausted" };
  }
  const before = lineTokens(input.before);
  const after = lineTokens(input.after);
  if (before === undefined || after === undefined) {
    return { ok: false, code: "binary_or_invalid_utf8" };
  }
  if (
    before.length > CHANGE_ANALYSIS_LIMITS.maxLinesPerSide ||
    after.length > CHANGE_ANALYSIS_LIMITS.maxLinesPerSide ||
    (before.length + 1) * (after.length + 1) >
      CHANGE_ANALYSIS_LIMITS.maxEditCells
  ) {
    return { ok: false, code: "budget_exhausted" };
  }

  const width = after.length + 1;
  const table = new Uint32Array((before.length + 1) * width);
  for (let oldIndex = before.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = after.length - 1; newIndex >= 0; newIndex -= 1) {
      const offset = oldIndex * width + newIndex;
      table[offset] =
        before[oldIndex] === after[newIndex]
          ? table[(oldIndex + 1) * width + newIndex + 1]! + 1
          : Math.max(
              table[(oldIndex + 1) * width + newIndex]!,
              table[oldIndex * width + newIndex + 1]!,
            );
    }
  }

  type Edit = { op: "equal" | "delete" | "insert"; line: string };
  const edits: Edit[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < before.length || newIndex < after.length) {
    if (
      oldIndex < before.length &&
      newIndex < after.length &&
      before[oldIndex] === after[newIndex]
    ) {
      edits.push({ op: "equal", line: before[oldIndex]! });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }
    const deleteScore =
      oldIndex < before.length
        ? table[(oldIndex + 1) * width + newIndex]!
        : -1;
    const insertScore =
      newIndex < after.length
        ? table[oldIndex * width + newIndex + 1]!
        : -1;
    if (oldIndex < before.length && deleteScore >= insertScore) {
      edits.push({ op: "delete", line: before[oldIndex]! });
      oldIndex += 1;
    } else {
      edits.push({ op: "insert", line: after[newIndex]! });
      newIndex += 1;
    }
  }

  const hunks: Array<{
    id: string;
    oldLineRange?: readonly [number, number];
    newLineRange?: readonly [number, number];
  }> = [];
  let editIndex = 0;
  let oldLine = 1;
  let newLine = 1;
  while (editIndex < edits.length) {
    const edit = edits[editIndex]!;
    if (edit.op === "equal") {
      oldLine += 1;
      newLine += 1;
      editIndex += 1;
      continue;
    }
    const oldStart = oldLine;
    const newStart = newLine;
    const operationDigests: Array<{ op: "delete" | "insert"; digest: string }> = [];
    while (editIndex < edits.length && edits[editIndex]!.op !== "equal") {
      const changed = edits[editIndex]!;
      operationDigests.push({
        op: changed.op as "delete" | "insert",
        digest: lineDigest(changed.line),
      });
      if (changed.op === "delete") oldLine += 1;
      if (changed.op === "insert") newLine += 1;
      editIndex += 1;
    }
    const oldCount = oldLine - oldStart;
    const newCount = newLine - newStart;
    hunks.push({
      id: stableId("change-hunk", {
        baselineSnapshotId: input.baselineSnapshotId,
        actualSnapshotId: input.actualSnapshotId,
        filePath: input.filePath,
        oldStart,
        oldCount,
        newStart,
        newCount,
        operationDigests,
      }),
      ...(oldCount === 0
        ? {}
        : { oldLineRange: [oldStart, oldLine - 1] as const }),
      ...(newCount === 0
        ? {}
        : { newLineRange: [newStart, newLine - 1] as const }),
    });
    if (hunks.length > CHANGE_ANALYSIS_LIMITS.maxHunks) {
      return { ok: false, code: "budget_exhausted" };
    }
  }
  return { ok: true, hunks };
}

export interface GraphSymbolCluster {
  readonly id: string;
  readonly lineRange: readonly [number, number];
  readonly nodeIds: readonly string[];
}

/**
 * Splits an actual-side raw hunk into uniquely owned symbol clusters. The
 * narrowest current Graph symbol owns each changed line; equal-width owners
 * are ambiguous and fail closed. Enclosing current symbols remain as anchors,
 * but clustering by the leaf owner prevents a foo plan from consuming an
 * adjacent bar change merely because both appeared in one raw line hunk.
 */
export function graphSymbolClustersForRange(
  rawHunkId: string,
  graphNodes: readonly GraphNode[],
  filePath: string,
  lineRange: readonly [number, number],
  isCurrentSymbolAnchor: (node: GraphNode) => boolean,
): GraphSymbolCluster[] | undefined {
  const candidates = graphNodes
    .filter(
      (node) =>
        node.filePath === filePath &&
        node.type !== "file" &&
        node.lineRange !== undefined &&
        node.lineRange[0] <= lineRange[1] &&
        node.lineRange[1] >= lineRange[0] &&
        isCurrentSymbolAnchor(node),
    )
    .sort((left, right) =>
      compareUnicodeCodeUnits(left.id, right.id),
    );
  const lineOwners: Array<{
    line: number;
    ownerId: string;
    nodeIds: string[];
  }> = [];
  for (let line = lineRange[0]; line <= lineRange[1]; line += 1) {
    const covering = candidates.filter(
      (node) => node.lineRange![0] <= line && node.lineRange![1] >= line,
    );
    if (covering.length === 0) return undefined;
    const minimumSpan = Math.min(
      ...covering.map((node) => node.lineRange![1] - node.lineRange![0]),
    );
    const owners = covering.filter(
      (node) => node.lineRange![1] - node.lineRange![0] === minimumSpan,
    );
    if (owners.length !== 1) return undefined;
    lineOwners.push({
      line,
      ownerId: owners[0]!.id,
      nodeIds: covering.map((node) => node.id).sort(compareUnicodeCodeUnits),
    });
  }
  const clusters: GraphSymbolCluster[] = [];
  for (const current of lineOwners) {
    const previous = clusters.at(-1);
    const signature = current.nodeIds.join("\0");
    if (
      previous !== undefined &&
      previous.lineRange[1] + 1 === current.line &&
      previous.nodeIds[0] === current.ownerId &&
      previous.nodeIds.slice(1).join("\0") ===
        current.nodeIds.filter((id) => id !== current.ownerId).join("\0")
    ) {
      clusters[clusters.length - 1] = {
        ...previous,
        lineRange: [previous.lineRange[0], current.line],
      };
      continue;
    }
    const orderedNodeIds = [
      current.ownerId,
      ...current.nodeIds.filter((id) => id !== current.ownerId),
    ];
    clusters.push({
      id: stableId("change-symbol-cluster", {
        rawHunkId,
        ownerId: current.ownerId,
        line: current.line,
        signature,
      }),
      lineRange: [current.line, current.line],
      nodeIds: orderedNodeIds,
    });
  }
  return clusters.map((cluster) => ({
    ...cluster,
    id: stableId("change-symbol-cluster", {
      rawHunkId,
      ownerId: cluster.nodeIds[0],
      lineRange: cluster.lineRange,
      nodeIds: cluster.nodeIds,
    }),
  }));
}

export function compareTaskChangeHunks(
  left: TaskChangeHunk,
  right: TaskChangeHunk,
): number {
  return (
    compareUnicodeCodeUnits(left.filePath, right.filePath) ||
    left.newLineRange[0] - right.newLineRange[0] ||
    left.newLineRange[1] - right.newLineRange[1] ||
    compareUnicodeCodeUnits(left.id, right.id)
  );
}
