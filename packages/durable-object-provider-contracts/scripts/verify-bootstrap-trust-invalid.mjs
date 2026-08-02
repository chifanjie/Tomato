import {
  runProviderBootstrapTrustInvalidManifestV1,
} from "./lib/bootstrap-trust-invalid-runner.mjs";

const result =
  await runProviderBootstrapTrustInvalidManifestV1();

process.stdout.write(
  `Executed ${result.caseCount} exact provider bootstrap invalid cases across ${result.witnessCount} deterministic rejection witnesses.\n`,
);
