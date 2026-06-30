import type { EdgeType, GraphEdge, GraphNode, KnowledgeGraph, NodeType } from "../types.js";

export type KnowledgeBaseStatus = "complete" | "complete-with-warnings" | "incomplete";

export interface KnowledgeBaseOptions {
  outputLanguage?: string;
  projectRoot?: string;
  sourceFiles?: Record<string, string>;
  currentGitCommitHash?: string;
  keepIntermediate?: boolean;
  deterministicOnly?: boolean;
}

export interface GraphIndexes {
  nodesById: Map<string, GraphNode>;
  nodeToLayerId: Map<string, string>;
  fileToChildIds: Map<string, string[]>;
  fileToFunctionIds: Map<string, string[]>;
  fileToClassIds: Map<string, string[]>;
  functionToFileId: Map<string, string>;
  classToFileId: Map<string, string>;
  incomingEdgesByNode: Map<string, GraphEdge[]>;
  outgoingEdgesByNode: Map<string, GraphEdge[]>;
  edgesByType: Map<EdgeType, GraphEdge[]>;
}

export interface LayerProfile {
  id: string;
  name: string;
  description: string;
  nodeIds: string[];
  nodeCounts: Partial<Record<NodeType, number>>;
  fileCount: number;
  functionCount: number;
  classCount: number;
  complexityCounts: Record<GraphNode["complexity"], number>;
  inboundLayerIds: string[];
  outboundLayerIds: string[];
}

export interface NodeDegree {
  nodeId: string;
  incoming: number;
  outgoing: number;
  incomingCalls: number;
  outgoingCalls: number;
  total: number;
}

export interface EntryCandidate {
  nodeId: string;
  reason: string;
  entryType: "api" | "job" | "event" | "cli" | "lifecycle" | "generic";
}

export interface TopicCandidate {
  nodeId: string;
  reasons: string[];
  score: number;
}

export type BusinessFactKind =
  | "comment"
  | "constant"
  | "branch"
  | "test"
  | "config"
  | "document"
  | "graph-node";

export type BusinessEvidenceSourceKind =
  | "production-logic"
  | "configuration"
  | "comment"
  | "test"
  | "documentation"
  | "prompt-or-tooling-example"
  | "graph-structure";

export type BusinessEvidenceRole = "primary" | "supporting" | "example-only";
export type BusinessEvidenceConfidence = "high" | "medium" | "low";

export interface BusinessEvidenceSummary {
  sourceKind: BusinessEvidenceSourceKind;
  evidenceRole: BusinessEvidenceRole;
  confidence: BusinessEvidenceConfidence;
  businessMeaning: string;
  riskFlags: string[];
}

export interface BusinessFact {
  id: string;
  kind: BusinessFactKind;
  title: string;
  summary: string;
  keywords: string[];
  relatedNodeIds: string[];
  evidence: SourceEvidence[];
  score: number;
  sourceKind: BusinessEvidenceSourceKind;
  evidenceRole: BusinessEvidenceRole;
  confidence: BusinessEvidenceConfidence;
  businessMeaning: string;
  riskFlags: string[];
}

export interface BusinessCapability {
  id: string;
  title: string;
  keywords: string[];
  factIds: string[];
  relatedNodeIds: string[];
  evidence: SourceEvidence[];
  score: number;
  evidenceRole: BusinessEvidenceRole;
  confidence: BusinessEvidenceConfidence;
  sourceKindCounts: Partial<Record<BusinessEvidenceSourceKind, number>>;
  primaryFactIds: string[];
  supportingFactIds: string[];
  exampleOnlyFactIds: string[];
}

export interface BusinessCapabilityProfile {
  facts: BusinessFact[];
  capabilities: BusinessCapability[];
  totalFacts: number;
  sourceBackedFacts: number;
}

export interface EvidenceGap {
  kind: "missing-summary" | "missing-line-range" | "missing-layer" | "missing-calls";
  nodeId?: string;
  message: string;
}

export interface ProjectProfile {
  graph: KnowledgeGraph;
  indexes: GraphIndexes;
  nodeCounts: Record<NodeType, number>;
  edgeCounts: Record<EdgeType, number>;
  layerProfiles: LayerProfile[];
  nodeDegrees: Map<string, NodeDegree>;
  entryCandidates: EntryCandidate[];
  businessSignalNodeIds: Set<string>;
  externalNodeIds: Set<string>;
  evidenceGaps: EvidenceGap[];
}

export type CoverageLevel = "none" | "index" | "overview" | "topic" | "pending-verification";

export type KnowledgeBaseDocumentCategory =
  | "top-level"
  | "index"
  | "module"
  | "file"
  | "flow"
  | "topic"
  | "business-capability"
  | "report"
  | "intermediate";

export interface SourceSnapshot {
  filePath: string;
  exists: boolean;
  text: string;
  totalLines: number;
  nonEmptyLines: number;
  missingReason?: string;
}

export interface SourceEvidence {
  filePath: string;
  lineRange?: [number, number];
  nodeId?: string;
  excerpt?: string;
}

export interface FileDocTask {
  batchIndex: number;
  taskIndex: number;
  fileNodeId: string;
  filePath: string;
  layerId: string | null;
  documentPath: string;
  functionNodeIds: string[];
  classNodeIds: string[];
  incomingEdgeIds: string[];
  outgoingEdgeIds: string[];
  neighborNodeIds: string[];
  sourceSnapshot: SourceSnapshot;
  sourceReadMode: "full" | "missing";
  batchingReason: string;
}

export interface FileDocBatch {
  batchIndex: number;
  tasks: FileDocTask[];
  estimatedLines: number;
  estimatedGraphItems: number;
  reason: string;
}

export interface FileDocPlan {
  tasks: FileDocTask[];
  batches: FileDocBatch[];
  warnings: string[];
}

export interface FileWriterDocument {
  fileNodeId: string;
  filePath: string;
  documentPath: string;
  title: string;
  coveredFunctionNodeIds: string[];
  coveredClassNodeIds: string[];
  representedEdgeIds: string[];
  sourceEvidence: SourceEvidence[];
  importantNodeIds: string[];
  markdown: string;
}

export interface FileWriterBatchOutput {
  batchIndex: number;
  documents: FileWriterDocument[];
  warnings: string[];
}

export type TopicTier = "required" | "extended";
export type QueueTaskStatus = "pending" | "leased" | "succeeded" | "needs_retry" | "failed_terminal";

export interface QueueEntryBase {
  batchIndex: number;
  status: QueueTaskStatus;
  attempts: number;
  workerId: string | null;
  leasedAt: string | null;
  updatedAt: string;
  lastError: string | null;
}

export interface FileDocQueueEntry extends QueueEntryBase {
  kind: "file-doc";
}

export interface TopicQueueEntry extends QueueEntryBase {
  kind: "topic";
  tier: TopicTier;
}

export interface QueueSummary {
  pending: number;
  leased: number;
  succeeded: number;
  needsRetry: number;
  failedTerminal: number;
}

export interface TopicPlanItem {
  batchIndex: number;
  topicNodeId: string;
  sourceFileNodeId: string;
  documentPath: string;
  title: string;
  reasons: string[];
  coveredNodeIds: string[];
  linkedFileDocumentPath: string;
  tier: TopicTier;
}

export interface TopicBatch {
  batchIndex: number;
  topics: TopicPlanItem[];
  reason: string;
  tier: TopicTier;
}

export interface TopicPlan {
  topics: TopicPlanItem[];
  batches: TopicBatch[];
  warnings: string[];
}

export interface TopicWriterDocument {
  topicNodeId: string;
  sourceFileNodeId: string;
  documentPath: string;
  title: string;
  coveredNodeIds: string[];
  linkedFileDocumentPath: string;
  evidence: SourceEvidence[];
  markdown: string;
}

export interface TopicWriterBatchOutput {
  batchIndex: number;
  topics: TopicWriterDocument[];
  warnings: string[];
}

export interface CoverageRatio {
  covered: number;
  total: number;
  missing: string[];
}

export interface RelationshipCoverage {
  edgeType: string;
  covered: number;
  total: number;
  missingEdgeIds: string[];
}

export interface RetryPlan {
  fileBatchIndexes: number[];
  topicBatchIndexes: number[];
  fileTerminalBatchIndexes: number[];
  topicTerminalBatchIndexes: number[];
  reasons: string[];
}

export interface PlannedDocument {
  path: string;
  title: string;
  category: KnowledgeBaseDocumentCategory;
  coveredNodeIds: string[];
  coverageLevel: CoverageLevel;
  reason: string;
}

export interface DocumentPlan {
  documents: PlannedDocument[];
  topicCandidates: TopicCandidate[];
  nodeCoverage: Map<string, CoverageLevel>;
  coverageReasons: Map<string, string[]>;
}

export interface GeneratedDocument {
  path: string;
  title: string;
  category: KnowledgeBaseDocumentCategory;
  coveredNodeIds: string[];
  representedEdgeIds: string[];
  content: string;
}

export interface CoverageValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface CoverageReport {
  totalDocuments: number;
  documentCounts: Record<KnowledgeBaseDocumentCategory, number>;
  nodeCounts: Record<NodeType, number>;
  edgeCounts: Record<EdgeType, number>;
  fileDocumentCoverage: CoverageRatio;
  functionCardCoverage: CoverageRatio;
  classCardCoverage: CoverageRatio;
  relationshipCoverage: RelationshipCoverage[];
  sourceReadCoverage: CoverageRatio;
  businessFactCoverage: CoverageRatio;
  businessCapabilityCoverage: CoverageRatio;
  layerOverviewCoverage: CoverageRatio;
  entryCoverage: CoverageRatio;
  topicCoverage: CoverageRatio;
  requiredTopicCoverage: CoverageRatio;
  extendedTopicCoverage: CoverageRatio;
  fileWriterBatches: { total: number; passed: number; retry: number };
  topicBatches: { total: number; passed: number; retry: number };
  chineseValidation: { checked: number; failed: string[] };
  placeholderValidation: { checked: number; failed: string[] };
  warnings: string[];
  errors: string[];
  status: KnowledgeBaseStatus;
}

export interface GeneratedKnowledgeBase {
  profile: ProjectProfile;
  businessCapabilityProfile: BusinessCapabilityProfile;
  plan: DocumentPlan;
  fileDocPlan: FileDocPlan;
  topicPlan: TopicPlan;
  documents: GeneratedDocument[];
  validation: CoverageValidationResult;
  coverageReport: CoverageReport;
  retryPlan: RetryPlan;
}
