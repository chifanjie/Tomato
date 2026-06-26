import type {
  CoverageValidationResult,
  FileDocPlan,
  FileDocTask,
  FileWriterBatchOutput,
  FileWriterDocument,
  GeneratedDocument,
  ProjectProfile,
  RetryPlan,
  TopicWriterBatchOutput,
  TopicWriterDocument,
} from "./types.js";

export interface MergeKnowledgeBaseWriterOutputsInput {
  profile: ProjectProfile;
  fileDocPlan: FileDocPlan;
  fileWriterOutputs: FileWriterBatchOutput[];
  topicWriterOutputs?: TopicWriterBatchOutput[];
}

export interface MergeKnowledgeBaseWriterOutputsResult {
  fileDocuments: GeneratedDocument[];
  topicDocuments: GeneratedDocument[];
  validation: CoverageValidationResult;
  retryPlan: RetryPlan;
  acceptedFileWriterDocuments: FileWriterDocument[];
  acceptedTopicWriterDocuments: TopicWriterDocument[];
}

interface FileDocumentCandidate {
  batchIndex: number;
  document: FileWriterDocument;
}

function sortedNumbers(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function nodeIdsForFileTask(task: FileDocTask): string[] {
  return [task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds];
}

function fileDocumentFromWriter(task: FileDocTask, document: FileWriterDocument): GeneratedDocument {
  return {
    path: document.documentPath,
    title: document.title,
    category: "file",
    coveredNodeIds: nodeIdsForFileTask(task),
    representedEdgeIds: [...document.representedEdgeIds],
    content: document.markdown,
  };
}

function topicDocumentFromWriter(document: TopicWriterDocument): GeneratedDocument {
  return {
    path: document.documentPath,
    title: document.title,
    category: "topic",
    coveredNodeIds: [...document.coveredNodeIds],
    representedEdgeIds: [],
    content: document.markdown,
  };
}

function pushError(errors: string[], retryBatchIndexes: Set<number>, batchIndexes: Iterable<number>, message: string): void {
  errors.push(message);
  for (const batchIndex of batchIndexes) {
    retryBatchIndexes.add(batchIndex);
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
    if (!document.markdown.includes(functionNodeId)) {
      pushError(
        errors,
        retryBatchIndexes,
        [task.batchIndex],
        `function card missing markdown node id: ${functionNodeId} in file writer document ${document.documentPath}`,
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
    if (!document.markdown.includes(classNodeId)) {
      pushError(
        errors,
        retryBatchIndexes,
        [task.batchIndex],
        `class card missing markdown node id: ${classNodeId} in file writer document ${document.documentPath}`,
      );
    }
  }
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
  const fileDocuments: GeneratedDocument[] = [];

  for (const task of inputs.fileDocPlan.tasks) {
    const matchingCandidates = byFileNodeId.get(task.fileNodeId) ?? [];
    const errorStart = errors.length;

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
      validateRequiredNodeCoverage(task, document, errors, retryFileBatchIndexes);

      const hasDuplicateError =
        invalidFileNodeIds.has(document.fileNodeId) || invalidDocumentPaths.has(document.documentPath);
      if (errors.length === errorStart && !hasDuplicateError) {
        acceptedFileWriterDocuments.push(document);
        fileDocuments.push(fileDocumentFromWriter(task, document));
      }
    }
  }

  const acceptedTopicWriterDocuments = (inputs.topicWriterOutputs ?? []).flatMap((output) => output.topics);
  const topicDocuments = acceptedTopicWriterDocuments.map(topicDocumentFromWriter);
  const validation: CoverageValidationResult = {
    ok: errors.length === 0,
    errors,
    warnings,
  };

  return {
    fileDocuments,
    topicDocuments,
    validation,
    retryPlan: {
      fileBatchIndexes: sortedNumbers(retryFileBatchIndexes),
      topicBatchIndexes: [],
      reasons: [...errors],
    },
    acceptedFileWriterDocuments,
    acceptedTopicWriterDocuments,
  };
}
