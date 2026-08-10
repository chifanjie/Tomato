type JsonRecordV1 = Record<string, any>;

export function buildGoldenSourceFixture(input: Readonly<{
  distributionRootBinding: JsonRecordV1;
  rootMetadataEnvelope: JsonRecordV1;
  rootSeedHex: string;
  sourceVersion?: string;
}>): JsonRecordV1;
