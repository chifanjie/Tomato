import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AlphaGoldTaskDefinitionV1Schema } from "../dist/index.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, "../../..");
const draftPath = join(repositoryRoot, "docs/research/alpha-a-task-review-draft-v1.json");
const frozenCorpusPath = join(repositoryRoot, "packages/contracts/fixtures/v1/golden/alpha-gold-task-corpus-v1.json");
const draft = JSON.parse(readFileSync(draftPath, "utf8"));
const frozenCorpus = JSON.parse(readFileSync(frozenCorpusPath, "utf8"));
const pin = frozenCorpus.sources?.alphaA?.revision;

function git(...args) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

function listPinnedPaths() {
  return new Set(git("ls-tree", "-r", "--name-only", pin).split("\n").filter(Boolean));
}

function contentAt(path) {
  return git("show", `${pin}:${path}`);
}

function resolveAnchorPath(anchor, sourcePaths) {
  const beforeLine = anchor.split(/\s+/u, 1)[0] ?? anchor;
  const pathPart = beforeLine.replace(/:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*/u, "");
  return sourcePaths.find((candidate) => candidate.endsWith(`/${pathPart}`) || candidate === pathPart);
}

function checkAnchor(anchor, sourcePaths, pinnedPaths) {
  const path = resolveAnchorPath(anchor, sourcePaths);
  if (!path || !pinnedPaths.has(path)) return `missing source path for anchor ${anchor}`;
  const content = contentAt(path);
  const lineSpec = anchor.match(/:(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)/u)?.[1];
  if (lineSpec) {
    const lineCount = content.split("\n").length;
    for (const range of lineSpec.split(",")) {
      const [, endText] = range.split("-");
      const end = Number(endText ?? range);
      if (end > lineCount) return `line range ${range} exceeds ${path} (${lineCount} lines)`;
    }
  }
  const label = anchor.match(/\s+(.+)$/u)?.[1];
  if (label) {
    for (const symbol of label.split("/").map((part) => part.trim()).filter(Boolean)) {
      const symbolName = symbol.split("/").at(-1)?.split(".").at(-1);
      if (symbolName && !content.includes(symbolName)) return `symbol ${symbolName} missing in ${path}`;
    }
  }
  return null;
}

const failures = [];
if (draft.profile !== "alpha_a_task_review_draft_v1") failures.push("unexpected draft profile");
if (draft.status !== "draft_pending_review") failures.push("draft must remain draft_pending_review");
if (draft.source?.taskCount !== 18) failures.push("source.taskCount must be 18");
if (draft.source?.revision !== pin) failures.push("source.revision must match the frozen corpus Alpha-A revision");
if (draft.reviewGate?.status !== "pending" || draft.reviewGate?.reviewerIds?.length !== 0) {
  failures.push("reviewGate must remain pending with no reviewer ids");
}
if (draft.alphaB?.status !== "not_provided") failures.push("Alpha-B must remain not_provided");

let pinnedPaths = new Set();
try {
  if (!pin || !/^[0-9a-f]{40}$/u.test(pin)) throw new Error("source revision is not a full commit pin");
  if (git("cat-file", "-t", pin) !== "commit") throw new Error("source revision is not a commit");
  pinnedPaths = listPinnedPaths();
} catch (error) {
  failures.push(`cannot inspect source pin ${pin}: ${error instanceof Error ? error.message : String(error)}`);
}

const seenSlots = new Set();
const seenOrdinals = new Set();
const expectedAlphaATasks = (frozenCorpus.taskSlots ?? []).filter((slot) => slot.corpus === "alpha-a");
const expectedBySlot = new Map(expectedAlphaATasks.map((slot) => [slot.slotId, slot]));
if (expectedAlphaATasks.length !== 18) failures.push("frozen corpus must contain exactly 18 Alpha-A slots");
for (const [index, task] of (draft.tasks ?? []).entries()) {
  const taskFailures = [];
  try {
    AlphaGoldTaskDefinitionV1Schema.parse({
      slotId: task.slotId,
      corpus: task.corpus,
      ordinal: task.ordinal,
      title: task.title,
      intent: task.intent,
      targetPaths: task.targetPaths,
      requiredStages: task.requiredStages,
      coverageTags: task.coverageTags,
      review: task.review,
    });
  } catch (error) {
    taskFailures.push(`task schema: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (task.review?.status !== "pending" || task.review?.reviewerIds?.length !== 0) taskFailures.push("review is not pending");
  if (task.corpus !== "alpha-a") taskFailures.push("task is not Alpha-A");
  const expected = expectedBySlot.get(task.slotId);
  if (!expected) taskFailures.push("slotId is not one of the frozen Alpha-A slots");
  else if (task.ordinal !== expected.ordinal) taskFailures.push(`ordinal must match frozen slot (${expected.ordinal})`);
  if (seenSlots.has(task.slotId)) taskFailures.push("duplicate slotId");
  if (seenOrdinals.has(task.ordinal)) taskFailures.push("duplicate ordinal");
  if (!Array.isArray(task.expectedOutcomes) || task.expectedOutcomes.length === 0) taskFailures.push("expectedOutcomes must be non-empty");
  if (!Array.isArray(task.verificationPaths) || task.verificationPaths.length === 0) taskFailures.push("verificationPaths must be non-empty");
  if (!Array.isArray(task.verificationCommands) || task.verificationCommands.length === 0) taskFailures.push("verificationCommands must be non-empty");
  seenSlots.add(task.slotId);
  seenOrdinals.add(task.ordinal);
  for (const path of [...(task.targetPaths ?? []), ...(task.sourcePaths ?? []), ...(task.verificationPaths ?? [])]) {
    if (!pinnedPaths.has(path)) taskFailures.push(`path unavailable at pin: ${path}`);
  }
  for (const anchor of task.sourceAnchors ?? []) {
    const problem = checkAnchor(anchor, task.sourcePaths ?? [], pinnedPaths);
    if (problem) taskFailures.push(problem);
  }
  const id = task.slotId ?? `index-${index + 1}`;
  if (taskFailures.length) failures.push(`${id}: ${taskFailures.join("; ")}`);
  console.log(`${id} ${taskFailures.length ? "MISMATCH" : "PASS"}${taskFailures.length ? ` — ${taskFailures.join("; ")}` : ""}`);
}

if (!Array.isArray(draft.tasks) || draft.tasks.length !== 18) failures.push("exactly 18 Alpha-A tasks are required");
if (seenSlots.size !== 18 || seenOrdinals.size !== 18) failures.push("Alpha-A slots/ordinals must cover 18 unique entries");
if (seenSlots.size !== expectedBySlot.size || [...expectedBySlot.keys()].some((slotId) => !seenSlots.has(slotId))) {
  failures.push("Alpha-A slots must match the frozen corpus exactly");
}
if ([...expectedBySlot.values()].some((slot) => !seenOrdinals.has(slot.ordinal))) {
  failures.push("Alpha-A ordinals must match the frozen corpus exactly");
}
if (failures.length) {
  console.error(`alpha-a review draft verification failed (${failures.length} issue(s))`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("alpha-a review draft verification passed: 18 pending tasks, fixed pin paths and anchors available");
}
