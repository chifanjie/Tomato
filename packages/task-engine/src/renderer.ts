import type {
  ReadTaskBundleResult,
} from "@understand-code/artifact-store";

const HOST_PATH_REDACTION = "[redacted-host-path]";

function redactAbsoluteHostPaths(value: string): string {
  return value
    .replace(
      /\bfile:\/\/[^\s"'`<>{}\[\]]+/giu,
      HOST_PATH_REDACTION,
    )
    .replace(
      /(^|[^\\])\\\\[^\\\s"'`<>{}\[\]]+\\[^\\\s"'`<>{}\[\]]+(?:\\[^\s"'`<>{}\[\]]+)*/gu,
      `$1${HOST_PATH_REDACTION}`,
    )
    .replace(
      /\b[A-Za-z]:[\\/][^\s"'`<>{}\[\]]+/gu,
      HOST_PATH_REDACTION,
    )
    .replace(
      /(^|[^A-Za-z0-9/])\/(?!\/)[^\s"'`<>{}\[\]]+/gu,
      `$1${HOST_PATH_REDACTION}`,
    );
}

function line(value: string): string {
  return redactAbsoluteHostPaths(value).replace(/\r?\n/gu, " ").trim();
}

function bullet(values: readonly string[], empty: string): string[] {
  return values.length === 0
    ? [`- ${empty}`]
    : values.map((value) => `- ${line(value)}`);
}

/**
 * Produces deterministic, evidence-conscious Markdown for Agent handoffs.
 * Absolute host paths and source excerpts are intentionally omitted.
 */
export function renderTaskBriefMarkdown(
  read: ReadTaskBundleResult,
): string {
  const task = read.bundle.manifest;
  const header = [
    `# ${line(task.title)}`,
    "",
    `- Task: \`${task.taskId}\``,
    `- Status: \`${task.status}\``,
    `- Revision: \`${task.revision}\``,
    `- Snapshot: \`${task.latestSnapshotId}\``,
    `- Freshness: \`${read.freshness}\``,
    `- Recovery state: \`${read.recoveryState}\``,
    "",
    "## Original intent",
    "",
    line(task.originalIntent),
  ];
  if (!("brief" in read.bundle)) {
    return redactAbsoluteHostPaths([
      ...header,
      "",
      "## Context",
      "",
      "Task intent is persisted, but its context has not been built yet.",
      "",
    ].join("\n"));
  }

  const bundle = read.bundle;
  const claims = new Map(bundle.claims.map((claim) => [claim.id, claim]));
  const claimLines = (ids: readonly string[]) =>
    ids.map((id) => {
      const claim = claims.get(id);
      return claim === undefined
        ? `${id} — unavailable`
        : [
            `${claim.statement} _(${claim.epistemicStatus}, ${claim.freshness})_`,
            claim.boundaryReason === undefined
              ? ""
              : ` — Boundary: ${claim.boundaryReason}`,
          ].join("");
    });
  const reading = bundle.brief.readingPath.map((entry) => {
    if (entry.kind === "impact_path") {
      return `${entry.order + 1}. Impact path \`${entry.impactPathId}\``;
    }
    return `${entry.order + 1}. \`${entry.filePath}\`${entry.symbolId === undefined ? "" : ` — \`${entry.symbolId}\``}`;
  });
  const planned = bundle.brief.plannedChanges.map(
    (change) =>
      `\`${change.filePath}\` — ${change.intent} _(${change.candidateLevel}; expectation=${change.expectation ?? "unspecified/legacy"})_`,
  );
  const verification = bundle.brief.verificationPlan.map(
    (entry) =>
      `${entry.description} _(${entry.method}, ${entry.required === true ? "required" : entry.required === false ? "optional" : "unspecified/legacy; gated as required"})_`,
  );
  const impactBoundaries = bundle.impactPaths
    .filter(
      (path) =>
        path.classification === "unknown_boundary" ||
        path.truncatedAt !== undefined,
    )
    .map((path) => {
      const suffix =
        path.truncatedAt === undefined
          ? ""
          : `; truncated=${path.truncatedAt.reason}, hidden=${path.truncatedAt.hiddenCount ?? "unknown"}`;
      return `\`${path.id}\`: ${path.boundaryReason ?? "explicit impact boundary"}${suffix}`;
    });
  const impactClaimBoundaries = bundle.brief.unknownClaimIds
    .map((claimId) => claims.get(claimId))
    .filter(
      (claim) =>
        claim?.statement ===
          "Impact coverage has an explicit analysis boundary." &&
        claim.boundaryReason !== undefined,
    )
    .map((claim) => claim!.boundaryReason!);

  return redactAbsoluteHostPaths([
    ...header,
    "",
    "## Goal and acceptance",
    "",
    ...bullet(
      claimLines([
        bundle.brief.goalClaimId,
        ...bundle.brief.acceptanceClaimIds,
      ]),
      "No goal or acceptance claims.",
    ),
    "",
    "## Recommended reading path",
    "",
    ...(reading.length === 0
      ? ["No source-backed reading path is available."]
      : reading),
    "",
    "## Planned changes",
    "",
    ...bullet(planned, "No file is proposed for modification yet."),
    "",
    "## Risks",
    "",
    ...bullet(
      claimLines(bundle.brief.riskClaimIds),
      "No explicit risk Claim.",
    ),
    "",
    "## Assumptions",
    "",
    ...bullet(
      claimLines(bundle.brief.assumptionClaimIds),
      "No explicit assumption Claim.",
    ),
    "",
    "## Unknowns",
    "",
    ...bullet(
      claimLines(bundle.brief.unknownClaimIds),
      "No explicit unknown Claim.",
    ),
    "",
    "## Impact boundaries",
    "",
    ...bullet(
      [...impactBoundaries, ...impactClaimBoundaries],
      "No impact truncation is recorded.",
    ),
    "",
    "## Verification plan",
    "",
    ...bullet(verification, "No verification plan."),
    "",
  ].join("\n"));
}
