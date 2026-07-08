export interface ReadingRouteStep {
  order: number;
  title: string;
  description: string;
}

export interface LocalizedReadingRouteCopy {
  step1Title: string;
  step1Description: string;
  step2Title: string;
  step2Description: string;
  step3Title: string;
  step3Description: string;
  step4Title: string;
  step4Description: string;
  step5Title: string;
  step5Description: string;
}

export interface LegacyReadingRouteFallbackCopy {
  legacyFallbackTitle: string;
  legacyFallbackDescription: string;
}

export interface ReadingRouteTourStep {
  title: string;
  description: string;
}

export const DEFAULT_READING_ROUTE_STEPS: ReadingRouteStep[] = [
  {
    order: 1,
    title: "Read the project layers",
    description: "Start from the layer overview to choose which part of the codebase you want to understand first.",
  },
  {
    order: 2,
    title: "Open a layer",
    description: "Use the layer detail page to see files grouped by function density, classes, and imports.",
  },
  {
    order: 3,
    title: "Scan file heat areas",
    description: "Prioritize large or highly connected files, then open the file that matches your reading goal.",
  },
  {
    order: 4,
    title: "Open the function matrix",
    description: "Read one dot per real function and use groups to understand what the file is doing.",
  },
  {
    order: 5,
    title: "Read impact",
    description: "Use downstream and upstream impact to understand dependencies and estimated effect.",
  },
];

const OLD_GRAPH_CANVAS_PATTERNS = [
  /\bdots?\s+and\s+connecting\s+lines?\b/i,
  /\bnode-link\b/i,
  /\bminimap\b/i,
  /\bpan\s+and\s+zoom\b/i,
  /\bcluster\s+nodes?\b/i,
  /\breact\s+flow\b/i,
];

export function hasOldGraphCanvasLanguage(text: string): boolean {
  return OLD_GRAPH_CANVAS_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildLocalizedReadingRouteSteps(
  copy: LocalizedReadingRouteCopy
): ReadingRouteStep[] {
  return [
    {
      order: 1,
      title: copy.step1Title,
      description: copy.step1Description,
    },
    {
      order: 2,
      title: copy.step2Title,
      description: copy.step2Description,
    },
    {
      order: 3,
      title: copy.step3Title,
      description: copy.step3Description,
    },
    {
      order: 4,
      title: copy.step4Title,
      description: copy.step4Description,
    },
    {
      order: 5,
      title: copy.step5Title,
      description: copy.step5Description,
    },
  ];
}

export function resolveReadingRouteTourStep(
  step: ReadingRouteTourStep,
  copy: LegacyReadingRouteFallbackCopy
): ReadingRouteTourStep {
  if (hasOldGraphCanvasLanguage(`${step.title} ${step.description}`)) {
    return {
      title: copy.legacyFallbackTitle,
      description: copy.legacyFallbackDescription,
    };
  }

  return step;
}
