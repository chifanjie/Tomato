import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  openOrInitializeProviderAcceptanceAuthorityForTestInternalV1,
} from "../dist/test-seam-internal.js";

try {
  const capability =
    createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(
      process.argv[2],
    );
  const identity =
    await openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
      capability,
    );
  process.send?.({
    type: "result",
    installationIdentityGenerationId:
      identity.installationIdentityGenerationId,
  });
} catch (error) {
  process.send?.({
    type: "error",
    name: error instanceof Error ? error.name : "unknown",
    code: typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined,
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exitCode = 1;
}
