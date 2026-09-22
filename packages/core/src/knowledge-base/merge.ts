import type {
  CoverageValidationResult,
  DirectSourceEvidence,
  FileDocPlan,
  FileDocTask,
  FileWriterBatchOutput,
  FileWriterDocument,
  ProjectProfile,
  RetryPlan,
  SymbolAnchor,
  TopicPlan,
  TopicWriterBatchOutput,
  TopicWriterDocument,
} from "./types.js";
import { normalizeKnowledgeSourcePath, slugPath } from "./paths.js";
import { evaluatePublication } from "./publication-quality.js";
import { excerptForLineRange } from "./source-snapshot.js";

export interface MergeKnowledgeBaseWriterOutputsInput {
  profile: ProjectProfile;
  fileDocPlan: FileDocPlan;
  topicPlan?: TopicPlan;
  fileWriterOutputs: FileWriterBatchOutput[];
  topicWriterOutputs?: TopicWriterBatchOutput[];
}

export interface MergeKnowledgeBaseWriterOutputsResult {
  validation: CoverageValidationResult;
  retryPlan: RetryPlan;
  acceptedFileWriterDocuments: FileWriterDocument[];
  maintenanceFileWriterDocuments?: FileWriterDocument[];
  acceptedTopicWriterDocuments: TopicWriterDocument[];
}

interface FileDocumentCandidate {
  batchIndex: number;
  document: FileWriterDocument;
}

interface TopicDocumentCandidate {
  batchIndex: number;
  document: TopicWriterDocument;
}

function sortedNumbers(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function compareByDocumentPath<T extends { documentPath: string; title: string }>(a: T, b: T): number {
  return a.documentPath.localeCompare(b.documentPath) || a.title.localeCompare(b.title);
}

export function stableSymbolAnchors(profile: ProjectProfile, task: FileDocTask): SymbolAnchor[] {
  const counts = new Map<string, number>();
  return [...new Set([...task.functionNodeIds, ...task.classNodeIds])]
    .sort((left, right) => left.localeCompare(right))
    .map((nodeId) => {
      const base = slugPath(profile.indexes.nodesById.get(nodeId)?.name ?? nodeId);
      const count = (counts.get(base) ?? 0) + 1;
      counts.set(base, count);
      return { nodeId, anchor: count === 1 ? base : `${base}-${count}` };
    });
}

function validateFilePublication(
  profile: ProjectProfile,
  task: FileDocTask,
  document: FileWriterDocument,
  errors: string[],
  retryBatchIndexes: Set<number>,
): void {
  const decision = evaluatePublication({
    path: document.documentPath,
    title: document.title,
    category: "file",
    role: "reference",
    referenceKind: task.referenceKind,
    content: document.markdown,
    directNodeIds: [task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds],
    representedEdgeIds: [...document.representedEdgeIds],
    symbolAnchors: stableSymbolAnchors(profile, task),
  }, document.sourceEvidence);
  if (decision.quality !== "failed") return;
  for (const issue of decision.issues) {
    pushError(
      errors,
      retryBatchIndexes,
      [task.batchIndex],
      `file writer document failed publication quality: ${document.documentPath}: ${issue}`,
    );
  }
}

export function validateEvidenceAgainstSource(
  inputs: Pick<MergeKnowledgeBaseWriterOutputsInput, "profile" | "fileDocPlan">,
  evidence: readonly DirectSourceEvidence[],
  writerKind: "file" | "topic" | "featured",
  batchIndex: number,
  errors: string[],
  retryBatchIndexes: Set<number>,
): void {
  for (const item of evidence) {
    const node = inputs.profile.indexes.nodesById.get(item.nodeId);
    const expectedPath = normalizeKnowledgeSourcePath(node?.filePath ?? "");
    const receivedPath = normalizeKnowledgeSourcePath(item.filePath);
    if (!node || !expectedPath || expectedPath !== receivedPath) {
      pushError(
        errors,
        retryBatchIndexes,
        [batchIndex],
        `${writerKind} writer evidence path does not match graph node: ${item.nodeId}`,
      );
      continue;
    }
    const task = inputs.fileDocPlan.tasks.find((candidate) =>
      normalizeKnowledgeSourcePath(candidate.filePath) === receivedPath);
    if (!task?.sourceSnapshot.exists) {
      pushError(
        errors,
        retryBatchIndexes,
        [batchIndex],
        `${writerKind} writer evidence source snapshot is unavailable: ${item.nodeId}`,
      );
      continue;
    }
    const [start, end] = item.lineRange;
    if (
      !Number.isInteger(start)
      || !Number.isInteger(end)
      || start <= 0
      || end < start
      || end > task.sourceSnapshot.totalLines
    ) {
      pushError(
        errors,
        retryBatchIndexes,
        [batchIndex],
        `${writerKind} writer evidence range is outside source snapshot: ${item.nodeId}`,
      );
      continue;
    }
    const exactExcerpt = excerptForLineRange(task.sourceSnapshot, item.lineRange);
    if (item.excerpt !== exactExcerpt) {
      pushError(
        errors,
        retryBatchIndexes,
        [batchIndex],
        `${writerKind} writer evidence excerpt does not match source snapshot: ${item.nodeId}`,
      );
    }
    const graphRange = node.lineRange;
    if (
      graphRange
      && graphRange[0] > 0
      && graphRange[1] >= graphRange[0]
      && graphRange[1] <= task.sourceSnapshot.totalLines
      && (start < graphRange[0] || end > graphRange[1])
    ) {
      pushError(
        errors,
        retryBatchIndexes,
        [batchIndex],
        `${writerKind} writer evidence range does not belong to graph node: ${item.nodeId}`,
      );
    }
  }
}

function pushError(errors: string[], retryBatchIndexes: Set<number>, batchIndexes: Iterable<number>, message: string): void {
  errors.push(message);
  for (const batchIndex of batchIndexes) {
    retryBatchIndexes.add(batchIndex);
  }
}

function validateFileTaskOwnership(
  profile: ProjectProfile,
  task: FileDocTask,
  errors: string[],
  retryBatchIndexes: Set<number>,
): void {
  const expectedPath = normalizeKnowledgeSourcePath(task.filePath);
  const owner = profile.indexes.nodesById.get(task.fileNodeId);
  const allowedOwnerTypes = new Set(["file", "config", "schema", "document"]);

  if (!owner) {
    pushError(errors, retryBatchIndexes, [task.batchIndex], `file task owner does not exist in graph: ${task.fileNodeId}`);
  } else if (!allowedOwnerTypes.has(owner.type)) {
    pushError(errors, retryBatchIndexes, [task.batchIndex], `file task owner has unsupported type: ${task.fileNodeId} (${owner.type})`);
  }

  if (!task.sourceNodeIds.includes(task.fileNodeId)) {
    pushError(errors, retryBatchIndexes, [task.batchIndex], `file task sourceNodeIds must include owner: ${task.fileNodeId}`);
  }

  for (const sourceNodeId of task.sourceNodeIds) {
    const sourceNode = profile.indexes.nodesById.get(sourceNodeId);
    if (!sourceNode) {
      pushError(errors, retryBatchIndexes, [task.batchIndex], `file task sourceNodeId does not exist in graph: ${sourceNodeId}`);
      continue;
    }
    const receivedPath = sourceNode.filePath ? normalizeKnowledgeSourcePath(sourceNode.filePath) : "";
    if (receivedPath !== expectedPath) {
      pushError(
        errors,
        retryBatchIndexes,
        [task.batchIndex],
        `file task sourceNodeId path mismatch: ${sourceNodeId} expected ${expectedPath} received ${receivedPath || "<missing>"}`,
      );
    }
  }

  const fileOwnerIds = task.sourceNodeIds.filter((sourceNodeId) => profile.indexes.nodesById.get(sourceNodeId)?.type === "file");
  for (const [nodeId, expectedType] of [
    ...task.functionNodeIds.map((nodeId) => [nodeId, "function"] as const),
    ...task.classNodeIds.map((nodeId) => [nodeId, "class"] as const),
  ]) {
    const node = profile.indexes.nodesById.get(nodeId);
    const mappedOwner = expectedType === "function"
      ? profile.indexes.functionToFileId.get(nodeId)
      : profile.indexes.classToFileId.get(nodeId);
    const explicitSamePathParent = task.sourceNodeIds.some((sourceNodeId) =>
      (profile.indexes.fileToChildIds.get(sourceNodeId) ?? []).includes(nodeId));
    if (!node || node.type !== expectedType || normalizeKnowledgeSourcePath(node.filePath ?? "") !== expectedPath) {
      pushError(errors, retryBatchIndexes, [task.batchIndex], `${expectedType} node does not belong to task path: ${nodeId} (${expectedPath})`);
    } else if (fileOwnerIds.length > 0 && (!mappedOwner || !fileOwnerIds.includes(mappedOwner))) {
      pushError(errors, retryBatchIndexes, [task.batchIndex], `${expectedType} node is not owned by a file source node: ${nodeId}`);
    } else if (fileOwnerIds.length === 0 && !explicitSamePathParent) {
      pushError(errors, retryBatchIndexes, [task.batchIndex], `${expectedType} node lacks an explicit same-path source mapping: ${nodeId}`);
    }
  }
}

function validateFileWriterIdentity(
  task: FileDocTask,
  document: FileWriterDocument,
  errors: string[],
  retryBatchIndexes: Set<number>,
): void {
  if (normalizeKnowledgeSourcePath(document.filePath) !== normalizeKnowledgeSourcePath(task.filePath)) {
    pushError(errors, retryBatchIndexes, [task.batchIndex], `file writer filePath must match planned task: ${task.fileNodeId}`);
  }
  if (document.documentPath !== task.documentPath) {
    pushError(errors, retryBatchIndexes, [task.batchIndex], `file writer documentPath must match planned task: ${task.fileNodeId}`);
  }
  if (document.referenceKind !== task.referenceKind) {
    pushError(
      errors,
      retryBatchIndexes,
      [task.batchIndex],
      `file writer referenceKind must match planned task: ${task.fileNodeId} expected ${task.referenceKind} received ${document.referenceKind}`,
    );
  }
}

function groupCandidatesByFileNodeId(candidates: FileDocumentCandidate[]): Map<string, FileDocumentCandidate[]> {
  const byFileNodeId = new Map<string, FileDocumentCandidate[]>();
  for (const candidate of candidates) {
    const existing = byFileNodeId.get(candidate.document.fileNodeId) ?? [];
    existing.push(candidate);
    byFileNodeId.set(candidate.document.fileNodeId, existing);
  }
  return byFileNodeId;
}

function groupCandidatesByDocumentPath(candidates: FileDocumentCandidate[]): Map<string, FileDocumentCandidate[]> {
  const byDocumentPath = new Map<string, FileDocumentCandidate[]>();
  for (const candidate of candidates) {
    const existing = byDocumentPath.get(candidate.document.documentPath) ?? [];
    existing.push(candidate);
    byDocumentPath.set(candidate.document.documentPath, existing);
  }
  return byDocumentPath;
}

function groupTopicCandidatesByTopicNodeId(candidates: TopicDocumentCandidate[]): Map<string, TopicDocumentCandidate[]> {
  const byTopicNodeId = new Map<string, TopicDocumentCandidate[]>();
  for (const candidate of candidates) {
    const existing = byTopicNodeId.get(candidate.document.topicNodeId) ?? [];
    existing.push(candidate);
    byTopicNodeId.set(candidate.document.topicNodeId, existing);
  }
  return byTopicNodeId;
}

function groupTopicCandidatesByDocumentPath(candidates: TopicDocumentCandidate[]): Map<string, TopicDocumentCandidate[]> {
  const byDocumentPath = new Map<string, TopicDocumentCandidate[]>();
  for (const candidate of candidates) {
    const existing = byDocumentPath.get(candidate.document.documentPath) ?? [];
    existing.push(candidate);
    byDocumentPath.set(candidate.document.documentPath, existing);
  }
  return byDocumentPath;
}

function validateRequiredNodeCoverage(
  task: FileDocTask,
  document: FileWriterDocument,
  errors: string[],
  retryBatchIndexes: Set<number>,
): void {
  for (const functionNodeId of task.functionNodeIds) {
    if (!document.coveredFunctionNodeIds.includes(functionNodeId)) {
      pushError(
        errors,
        retryBatchIndexes,
        [task.batchIndex],
        `function card missing coveredFunctionNodeIds entry: ${functionNodeId} in file writer document ${document.documentPath}`,
      );
    }
  }

  for (const classNodeId of task.classNodeIds) {
    if (!document.coveredClassNodeIds.includes(classNodeId)) {
      pushError(
        errors,
        retryBatchIndexes,
        [task.batchIndex],
        `class card missing coveredClassNodeIds entry: ${classNodeId} in file writer document ${document.documentPath}`,
      );
    }
  }
}

function validateTopicWriterOutputs(
  inputs: MergeKnowledgeBaseWriterOutputsInput,
  acceptedFileWriterDocuments: FileWriterDocument[],
  errors: string[],
  warnings: string[],
  retryTopicBatchIndexes: Set<number>,
): TopicWriterDocument[] {
  const topicCandidates = (inputs.topicWriterOutputs ?? []).flatMap((output) =>
    output.topics.map((document) => ({ batchIndex: output.batchIndex, document })),
  );
  const invalidTopicNodeIds = new Set<string>();
  const invalidDocumentPaths = new Set<string>();
  const byTopicNodeId = groupTopicCandidatesByTopicNodeId(topicCandidates);
  const byTopicDocumentPath = groupTopicCandidatesByDocumentPath(topicCandidates);

  for (const [topicNodeId, matchingCandidates] of byTopicNodeId) {
    if (matchingCandidates.length > 1) {
      invalidTopicNodeIds.add(topicNodeId);
      pushError(
        errors,
        retryTopicBatchIndexes,
        matchingCandidates.map((candidate) => candidate.batchIndex),
        `duplicate topic writer document for topicNodeId: ${topicNodeId}`,
      );
    }
  }

  for (const [documentPath, matchingCandidates] of byTopicDocumentPath) {
    if (matchingCandidates.length > 1) {
      invalidDocumentPaths.add(documentPath);
      for (const candidate of matchingCandidates) {
        invalidTopicNodeIds.add(candidate.document.topicNodeId);
      }
      pushError(
        errors,
        retryTopicBatchIndexes,
        matchingCandidates.map((candidate) => candidate.batchIndex),
        `duplicate topic writer documentPath: ${documentPath}`,
      );
    }
  }

  const acceptedFileNodeIds = new Set(acceptedFileWriterDocuments.map((document) => document.fileNodeId));
  const acceptedTopicWriterDocuments: TopicWriterDocument[] = [];

  for (const candidate of topicCandidates) {
    const { document } = candidate;
    const errorStart = errors.length;
    const topicNode = inputs.profile.indexes.nodesById.get(document.topicNodeId);
    const topicPlanItem = inputs.topicPlan?.topics.find((item) => item.topicNodeId === document.topicNodeId);

    if (!topicPlanItem) {
      pushError(
        errors,
        retryTopicBatchIndexes,
        [candidate.batchIndex],
        `topic writer document has no planned topic: ${document.topicNodeId}`,
      );
    }

    if (!topicNode) {
      invalidTopicNodeIds.add(document.topicNodeId);
      pushError(
        errors,
        retryTopicBatchIndexes,
        [candidate.batchIndex],
        `topicNodeId does not exist in graph: ${document.topicNodeId}`,
      );
    } else if (topicNode.type === "file") {
      invalidTopicNodeIds.add(document.topicNodeId);
      pushError(
        errors,
        retryTopicBatchIndexes,
        [candidate.batchIndex],
        `topicNodeId must not be a file node: ${document.topicNodeId}`,
      );
    }

    for (const coveredNodeId of document.coveredNodeIds) {
      if (!inputs.profile.indexes.nodesById.has(coveredNodeId)) {
        pushError(
          errors,
          retryTopicBatchIndexes,
          [candidate.batchIndex],
          `topic coveredNodeIds contains unknown graph node: ${coveredNodeId} in ${document.documentPath}`,
        );
      }
    }

    if (document.sourceFileNodeId) {
      const sourceFileNode = inputs.profile.indexes.nodesById.get(document.sourceFileNodeId);
      if (!sourceFileNode) {
        pushError(
          errors,
          retryTopicBatchIndexes,
          [candidate.batchIndex],
          `topic sourceFileNodeId does not exist in graph: ${document.sourceFileNodeId}`,
        );
      } else if (sourceFileNode.type !== "file") {
        pushError(
          errors,
          retryTopicBatchIndexes,
          [candidate.batchIndex],
          `topic sourceFileNodeId must refer to a file node: ${document.sourceFileNodeId}`,
        );
      } else if (!acceptedFileNodeIds.has(document.sourceFileNodeId)) {
        pushError(
          errors,
          retryTopicBatchIndexes,
          [candidate.batchIndex],
          `topic source file document was not accepted: ${document.sourceFileNodeId} for ${document.documentPath}`,
        );
      }
    }

    if (topicPlanItem) {
      validateEvidenceAgainstSource(
        inputs,
        document.evidence,
        "topic",
        candidate.batchIndex,
        errors,
        retryTopicBatchIndexes,
      );
      const decision = evaluatePublication({
        path: document.documentPath,
        title: document.title,
        category: "topic",
        role: topicPlanItem.tier === "required" ? "featured" : "reference",
        content: document.markdown,
        directNodeIds: [document.topicNodeId],
        representedEdgeIds: [],
        symbolAnchors: [],
      }, document.evidence);
      if (decision.quality === "failed") {
        for (const issue of decision.issues) {
          pushError(
            errors,
            retryTopicBatchIndexes,
            [candidate.batchIndex],
            `topic writer document failed publication quality: ${document.documentPath}: ${issue}`,
          );
        }
      }
    }

    const hasDuplicateError =
      invalidTopicNodeIds.has(document.topicNodeId) || invalidDocumentPaths.has(document.documentPath);
    if (errors.length === errorStart && !hasDuplicateError) {
      acceptedTopicWriterDocuments.push(document);
    }
  }

  return acceptedTopicWriterDocuments.sort(compareByDocumentPath);
}

export function mergeKnowledgeBaseWriterOutputs(
  inputs: MergeKnowledgeBaseWriterOutputsInput,
): MergeKnowledgeBaseWriterOutputsResult {
  const errors: string[] = [];
  const warnings = [
    ...inputs.fileDocPlan.warnings,
    ...inputs.fileWriterOutputs.flatMap((output) => output.warnings),
    ...(inputs.topicWriterOutputs ?? []).flatMap((output) => output.warnings),
  ];
  const retryFileBatchIndexes = new Set<number>();
  const retryTopicBatchIndexes = new Set<number>();
  const invalidFileNodeIds = new Set<string>();
  const invalidDocumentPaths = new Set<string>();

  const candidates = inputs.fileWriterOutputs.flatMap((output) =>
    output.documents.map((document) => ({ batchIndex: output.batchIndex, document })),
  );
  const taskByFileNodeId = new Map(inputs.fileDocPlan.tasks.map((task) => [task.fileNodeId, task]));
  const byFileNodeId = groupCandidatesByFileNodeId(candidates);
  const byDocumentPath = groupCandidatesByDocumentPath(candidates);

  for (const [fileNodeId, matchingCandidates] of byFileNodeId) {
    if (matchingCandidates.length > 1) {
      invalidFileNodeIds.add(fileNodeId);
      pushError(
        errors,
        retryFileBatchIndexes,
        matchingCandidates.map((candidate) => candidate.batchIndex),
        `duplicate file writer document for fileNodeId: ${fileNodeId}`,
      );
    }
  }

  for (const [documentPath, matchingCandidates] of byDocumentPath) {
    if (matchingCandidates.length > 1) {
      invalidDocumentPaths.add(documentPath);
      for (const candidate of matchingCandidates) {
        invalidFileNodeIds.add(candidate.document.fileNodeId);
      }
      pushError(
        errors,
        retryFileBatchIndexes,
        matchingCandidates.map((candidate) => candidate.batchIndex),
        `duplicate file writer documentPath: ${documentPath}`,
      );
    }
  }

  for (const candidate of candidates) {
    if (!taskByFileNodeId.has(candidate.document.fileNodeId)) {
      invalidFileNodeIds.add(candidate.document.fileNodeId);
      pushError(
        errors,
        retryFileBatchIndexes,
        [candidate.batchIndex],
        `file writer document has no planned task: ${candidate.document.fileNodeId}`,
      );
    }
  }

  const acceptedFileWriterDocuments: FileWriterDocument[] = [];
  const maintenanceFileWriterDocuments: FileWriterDocument[] = [];

  for (const task of inputs.fileDocPlan.tasks) {
    const matchingCandidates = byFileNodeId.get(task.fileNodeId) ?? [];
    const errorStart = errors.length;
    validateFileTaskOwnership(inputs.profile, task, errors, retryFileBatchIndexes);

    if (matchingCandidates.length === 0) {
      pushError(
        errors,
        retryFileBatchIndexes,
        [task.batchIndex],
        `missing file writer document for planned task: ${task.fileNodeId}`,
      );
    }

    if (task.sourceSnapshot.exists === false) {
      pushError(
        errors,
        retryFileBatchIndexes,
        [task.batchIndex],
        `source file missing for task: ${task.fileNodeId} (${task.filePath})`,
      );
    }

    if (matchingCandidates.length === 1) {
      const [{ document }] = matchingCandidates;
      validateFileWriterIdentity(task, document, errors, retryFileBatchIndexes);
      validateRequiredNodeCoverage(task, document, errors, retryFileBatchIndexes);
      validateEvidenceAgainstSource(
        inputs,
        document.sourceEvidence,
        "file",
        task.batchIndex,
        errors,
        retryFileBatchIndexes,
      );
      validateFilePublication(inputs.profile, task, document, errors, retryFileBatchIndexes);

      if (
        task.sourceSnapshot.exists === false
        && document.fileNodeId === task.fileNodeId
        && normalizeKnowledgeSourcePath(document.filePath) === normalizeKnowledgeSourcePath(task.filePath)
        && document.documentPath === task.documentPath
        && document.referenceKind === task.referenceKind
        && !invalidFileNodeIds.has(document.fileNodeId)
        && !invalidDocumentPaths.has(document.documentPath)
      ) {
        maintenanceFileWriterDocuments.push(document);
      }

      const hasDuplicateError =
        invalidFileNodeIds.has(document.fileNodeId) || invalidDocumentPaths.has(document.documentPath);
      if (errors.length === errorStart && !hasDuplicateError) {
        acceptedFileWriterDocuments.push(document);
      }
    }
  }

  acceptedFileWriterDocuments.sort(compareByDocumentPath);

  const acceptedTopicWriterDocuments = validateTopicWriterOutputs(
    inputs,
    acceptedFileWriterDocuments,
    errors,
    warnings,
    retryTopicBatchIndexes,
  );
  const validation: CoverageValidationResult = {
    ok: errors.length === 0,
    errors,
    warnings,
  };

  return {
    validation,
    retryPlan: {
      fileBatchIndexes: sortedNumbers(retryFileBatchIndexes),
      topicBatchIndexes: sortedNumbers(retryTopicBatchIndexes),
      fileTerminalBatchIndexes: [],
      topicTerminalBatchIndexes: [],
      reasons: [...errors],
    },
    acceptedFileWriterDocuments,
    maintenanceFileWriterDocuments: maintenanceFileWriterDocuments.sort(compareByDocumentPath),
    acceptedTopicWriterDocuments,
  };
}
