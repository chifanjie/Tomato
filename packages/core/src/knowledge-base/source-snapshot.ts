import type { SourceEvidence, SourceSnapshot } from "./types.js";

export function buildSourceSnapshot(filePath: string, sourceFiles: Record<string, string>): SourceSnapshot {
  const text = sourceFiles[filePath];
  if (text === undefined) {
    return {
      filePath,
      exists: false,
      text: "",
      totalLines: 0,
      nonEmptyLines: 0,
      missingReason: "source file was not provided to knowledge-base generation",
    };
  }
  const lines = text.split(/\r?\n/);
  return {
    filePath,
    exists: true,
    text,
    totalLines: lines.length,
    nonEmptyLines: lines.filter((line) => line.trim().length > 0).length,
  };
}

export function excerptForLineRange(snapshot: SourceSnapshot, lineRange?: [number, number]): string {
  if (!snapshot.exists || !lineRange) return "";
  const [start, end] = lineRange;
  const lines = snapshot.text.split(/\r?\n/);
  return lines.slice(Math.max(0, start - 1), Math.min(lines.length, end)).join("\n");
}

export function sourceEvidenceForNode(
  snapshot: SourceSnapshot,
  nodeId: string,
  lineRange?: [number, number],
): SourceEvidence {
  return {
    filePath: snapshot.filePath,
    lineRange,
    nodeId,
    excerpt: excerptForLineRange(snapshot, lineRange),
  };
}
