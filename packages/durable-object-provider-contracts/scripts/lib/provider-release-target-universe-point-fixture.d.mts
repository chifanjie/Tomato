type JsonRecordV1 = Record<string, any>;

export function buildSignedUniverseEnvelope(
  sourceGolden: JsonRecordV1,
  options?: Readonly<{
    predecessorUniverseContentDigest?: string;
    universeGeneration?: number;
  }>,
): JsonRecordV1;

export function resignAndReanchorTargetDiscoveryResultEnvelope(
  rawEnvelope: JsonRecordV1,
  sourceGolden: JsonRecordV1,
): JsonRecordV1;
