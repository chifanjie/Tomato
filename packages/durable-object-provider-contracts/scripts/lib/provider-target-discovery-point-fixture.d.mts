type JsonRecordV1 = Record<string, any>;

export function buildGoldenTargetDiscoveryPointFixture(
  sourceGolden: JsonRecordV1,
  options?: Readonly<{
    discoveryGeneration?: number;
    emptyObservationManifests?: boolean;
    predecessorDiscoveryContentDigest?: string;
    predecessorReleaseMatrixContentDigest?: string;
    predecessorTaxonomyContentDigest?: string;
    releaseMatrixGeneration?: number;
    targets?: readonly JsonRecordV1[];
    taxonomyGeneration?: number;
  }>,
): JsonRecordV1;
