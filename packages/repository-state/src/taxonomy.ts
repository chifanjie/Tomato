import type {
  RepositoryChangeKindV1,
  RepositoryChangeV1,
} from "@understand-code/contracts";

export const CHANGE_TAXONOMY_V1 = Object.freeze([
  "NONE",
  "FORMATTING_OR_COMMENT",
  "BODY_LOGIC",
  "SIGNATURE",
  "DEPENDENCY",
  "TOPOLOGY",
  "UNKNOWN",
] as const);

export type ChangeTaxonomyV1 = (typeof CHANGE_TAXONOMY_V1)[number];

export interface ParserChangeSignals {
  detector: string;
  supported: boolean;
  formattingOrCommentOnly?: boolean;
  bodyLogicChanged?: boolean;
  signatureChanged?: boolean;
  dependencyChanged?: boolean;
  topologyChanged?: boolean;
  reasons?: readonly string[];
}

export interface SemanticChangeInput {
  path: string;
  kind?: RepositoryChangeKindV1;
  oldContent?: string | Buffer;
  newContent?: string | Buffer;
  parser?: ParserChangeSignals;
}

export interface SemanticChangeClassification {
  taxonomy: ChangeTaxonomyV1;
  detector: string;
  reasons: string[];
}

const TOPOLOGY_KINDS = new Set<RepositoryChangeKindV1>([
  "added",
  "deleted",
  "renamed",
  "copied",
  "type_changed",
]);

const DEPENDENCY_FILE_PATTERN =
  /(?:^|\/)(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|go\.(?:mod|sum|work)|Cargo\.(?:toml|lock)|requirements[^/]*\.txt|Pipfile(?:\.lock)?|poetry\.lock|pyproject\.toml|pom\.xml|build\.gradle(?:\.kts)?|gradle\.properties|Gemfile(?:\.lock)?|composer\.(?:json|lock)|Podfile(?:\.lock)?|Package\.swift|CMakeLists\.txt)$/u;

function contentToText(content: string | Buffer | undefined): string | undefined {
  if (content === undefined) return undefined;
  return typeof content === "string" ? content : content.toString("utf8");
}

function parserClassification(
  parser: ParserChangeSignals,
): SemanticChangeClassification | null {
  const baseReasons = [...(parser.reasons ?? [])];
  if (!parser.supported) {
    return {
      taxonomy: "UNKNOWN",
      detector: parser.detector,
      reasons:
        baseReasons.length > 0
          ? baseReasons
          : ["The configured parser does not support this input"],
    };
  }
  const candidates: Array<{
    active: boolean | undefined;
    taxonomy: ChangeTaxonomyV1;
    reason: string;
  }> = [
    {
      active: parser.topologyChanged,
      taxonomy: "TOPOLOGY",
      reason: "Parser detected a topology change",
    },
    {
      active: parser.dependencyChanged,
      taxonomy: "DEPENDENCY",
      reason: "Parser detected a dependency change",
    },
    {
      active: parser.signatureChanged,
      taxonomy: "SIGNATURE",
      reason: "Parser detected a signature change",
    },
    {
      active: parser.bodyLogicChanged,
      taxonomy: "BODY_LOGIC",
      reason: "Parser detected executable body-logic changes",
    },
    {
      active: parser.formattingOrCommentOnly,
      taxonomy: "FORMATTING_OR_COMMENT",
      reason: "Parser proved that only formatting or comments changed",
    },
  ];
  const selected = candidates.find((candidate) => candidate.active === true);
  if (selected === undefined) return null;
  return {
    taxonomy: selected.taxonomy,
    detector: parser.detector,
    reasons: [...baseReasons, selected.reason],
  };
}

/**
 * Deterministic, conservative change classification.
 *
 * Parser evidence wins. Without parser support, an arbitrary content change
 * is UNKNOWN; byte/text heuristics never claim that a semantic change is
 * cosmetic or body-only.
 */
export function classifySemanticChange(
  input: SemanticChangeInput,
): SemanticChangeClassification {
  if (input.kind !== undefined && TOPOLOGY_KINDS.has(input.kind)) {
    return {
      taxonomy: "TOPOLOGY",
      detector: "repository_change_kind_v1",
      reasons: [`Repository change kind is ${input.kind}`],
    };
  }

  if (input.parser !== undefined) {
    const classified = parserClassification(input.parser);
    if (classified !== null) return classified;
  }

  const oldContent = contentToText(input.oldContent);
  const newContent = contentToText(input.newContent);
  if (oldContent === undefined || newContent === undefined) {
    return {
      taxonomy: "UNKNOWN",
      detector: "content_availability_v1",
      reasons: ["Both old and new content are required for semantic comparison"],
    };
  }
  if (oldContent === newContent) {
    return {
      taxonomy: "NONE",
      detector: "byte_equality_v1",
      reasons: ["Old and new content are byte-for-byte identical"],
    };
  }
  if (oldContent.includes("\0") || newContent.includes("\0")) {
    return {
      taxonomy: "UNKNOWN",
      detector: "binary_guard_v1",
      reasons: ["Binary content is not supported by the text classifier"],
    };
  }
  if (DEPENDENCY_FILE_PATTERN.test(input.path)) {
    return {
      taxonomy: "DEPENDENCY",
      detector: "dependency_manifest_path_v1",
      reasons: ["A dependency manifest or lockfile changed"],
    };
  }

  return {
    taxonomy: "UNKNOWN",
    detector: "parser_required_v1",
    reasons: [
      "Content changed, but no parser supplied proof for formatting, body, signature, or dependency semantics",
    ],
  };
}

export interface ClassifiedRepositoryChange {
  changeId: string;
  path: string;
  classification: SemanticChangeClassification;
}

export function classifyRepositoryChanges(
  changes: readonly RepositoryChangeV1[],
  contentByChangeId: Readonly<
    Record<
      string,
      {
        oldContent?: string | Buffer;
        newContent?: string | Buffer;
        parser?: ParserChangeSignals;
      }
    >
  > = {},
): ClassifiedRepositoryChange[] {
  return changes.map((change) => {
    const content = contentByChangeId[change.id];
    return {
      changeId: change.id,
      path: change.path,
      classification: classifySemanticChange({
        path: change.path,
        kind: change.kind,
        ...(content?.oldContent === undefined
          ? {}
          : { oldContent: content.oldContent }),
        ...(content?.newContent === undefined
          ? {}
          : { newContent: content.newContent }),
        ...(content?.parser === undefined ? {} : { parser: content.parser }),
      }),
    };
  });
}

export type GraphRefreshLevel = "none" | "incremental" | "full";

export interface GraphRefreshDecision {
  level: GraphRefreshLevel;
  filesToReanalyze: string[];
  rerunArchitecture: boolean;
  reasons: string[];
}

export interface GraphRefreshDecisionOptions {
  totalFilesInGraph?: number;
  fullRefreshFileThreshold?: number;
  fullRefreshRatioThreshold?: number;
}

/**
 * Decides graph work only. It intentionally does not contain a risk score.
 */
export function decideGraphRefresh(
  changes: readonly ClassifiedRepositoryChange[],
  options: GraphRefreshDecisionOptions = {},
): GraphRefreshDecision {
  const meaningful = changes.filter(
    (change) =>
      change.classification.taxonomy !== "NONE" &&
      change.classification.taxonomy !== "FORMATTING_OR_COMMENT",
  );
  if (meaningful.length === 0) {
    return {
      level: "none",
      filesToReanalyze: [],
      rerunArchitecture: false,
      reasons: [
        changes.length === 0
          ? "No repository changes were classified"
          : "Every change was proven to be formatting/comment-only or unchanged",
      ],
    };
  }

  const totalFilesInGraph = options.totalFilesInGraph ?? 0;
  const countThreshold = options.fullRefreshFileThreshold ?? 30;
  const ratioThreshold = options.fullRefreshRatioThreshold ?? 0.5;
  const containsUnknown = meaningful.some(
    (change) => change.classification.taxonomy === "UNKNOWN",
  );
  const containsTopology = meaningful.some(
    (change) => change.classification.taxonomy === "TOPOLOGY",
  );
  const exceedsCount = meaningful.length > countThreshold;
  const exceedsRatio =
    totalFilesInGraph > 0 &&
    meaningful.length / totalFilesInGraph > ratioThreshold;
  const full = containsUnknown || exceedsCount || exceedsRatio;
  const filesToReanalyze = [
    ...new Set(meaningful.map((change) => change.path)),
  ].sort();

  const decision: GraphRefreshDecision = {
    level: full ? "full" : "incremental",
    filesToReanalyze,
    rerunArchitecture: full || containsTopology,
    reasons: [
      ...(containsUnknown
        ? ["At least one semantic change is UNKNOWN and requires a conservative rebuild"]
        : []),
      ...(containsTopology ? ["Repository topology changed"] : []),
      ...(exceedsCount
        ? [`Meaningful changes exceed the ${countThreshold}-file threshold`]
        : []),
      ...(exceedsRatio
        ? [`Meaningful changes exceed the ${ratioThreshold} graph ratio threshold`]
        : []),
      ...(!full && !containsTopology
        ? ["Meaningful changes are localized and can be refreshed incrementally"]
        : []),
    ],
  };

  if (
    meaningful.some(
      (change) => change.classification.taxonomy === "BODY_LOGIC",
    ) &&
    decision.level === "none"
  ) {
    throw new Error("BODY_LOGIC must never produce a no-refresh decision");
  }
  return decision;
}

export type ChangeRiskLevel = "low" | "moderate" | "high" | "unknown";

export interface ChangeRiskAssessment {
  level: ChangeRiskLevel;
  factors: string[];
}

/**
 * Assesses review risk independently from graph refresh cost.
 */
export function assessChangeRisk(
  changes: readonly ClassifiedRepositoryChange[],
): ChangeRiskAssessment {
  const taxonomies = new Set(
    changes.map((change) => change.classification.taxonomy),
  );
  if (taxonomies.has("UNKNOWN")) {
    return {
      level: "unknown",
      factors: ["At least one changed file could not be semantically classified"],
    };
  }
  const highFactors = [
    ...(taxonomies.has("SIGNATURE") ? ["Public or internal signatures changed"] : []),
    ...(taxonomies.has("DEPENDENCY") ? ["Dependencies changed"] : []),
    ...(taxonomies.has("TOPOLOGY") ? ["Repository topology changed"] : []),
  ];
  if (highFactors.length > 0) return { level: "high", factors: highFactors };
  if (taxonomies.has("BODY_LOGIC")) {
    return {
      level: "moderate",
      factors: ["Executable body logic changed"],
    };
  }
  return {
    level: "low",
    factors: [
      changes.length === 0
        ? "No changes"
        : "Only formatting/comment-only or unchanged inputs remain",
    ],
  };
}
