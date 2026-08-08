import { executeC09DistributionReplayLaneV1 } from "./provider-registry-evidence-binding-distribution-replay-core.mjs";

const input =
  globalThis["__UNDERSTAND_CODE_C09_DISTRIBUTION_REPLAY_INPUT_V1__"];
delete globalThis["__UNDERSTAND_CODE_C09_DISTRIBUTION_REPLAY_INPUT_V1__"];

if (
  input === null ||
  typeof input !== "object" ||
  Array.isArray(input) ||
  input.runtime !== "browser"
) {
  throw new TypeError("C09 packed browser replay input is invalid");
}

export const c09BrowserReplayResult =
  await executeC09DistributionReplayLaneV1(input);
