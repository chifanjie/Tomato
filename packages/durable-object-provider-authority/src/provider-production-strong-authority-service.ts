import { constants as fsConstants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  ProviderTargetProfileIdV1Schema,
  type InstallationIdentityGenerationIdV1,
  type ProviderTargetProfileIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  ProviderAcceptanceGenerationPinV1Schema,
  ProviderAcceptanceStateEnvelopeV1Schema,
  type ProviderAcceptedConfigurationV1,
  type ProviderAcceptanceGenerationPinV1,
  type ProviderAcceptanceStateEnvelopeV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import type {
  ProviderStrictEd25519OpaqueCapabilityV1,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";
import {
  readProviderServiceReadinessV1,
  verifyProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffConfigV1,
} from "@understand-code/durable-object-provider-runtime/service-handoff";

import {
  withProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1,
} from "./acceptance-store-core-internal.js";
import {
  openProviderStrongMutationBrokerStoreWithExecutionFenceAndLayoutCoreInternalV1,
} from "./strong-mutation-broker-core-internal.js";
import {
  ProviderStrongMutationBrokerServerInternalV1,
} from "./strong-mutation-broker-server-internal.js";
import {
  closeProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1,
  openProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1,
  registerProviderStrongMutationLinuxExt4ExecutionFenceInternalV1,
  PROVIDER_STRONG_MUTATION_LINUX_EXT4_FENCE_PROFILE_INTERNAL_V1,
} from "./strong-mutation-execution-fence-internal.js";
import {
  mintProviderStrongMutationTrustVerifierCapabilityInternalV1,
  type ProviderStrongMutationTrustEvidenceQueryInternalV1,
} from "./strong-mutation-trust-verifier-core-internal.js";
import {
  resolveProviderAcceptanceAuthorityProductionLayoutInternalV1,
} from "./platform-layout.js";

const MAX_SERVICE_CONFIG_BYTES_V1 = 1024 * 1024;
const O_CLOEXEC_V1 =
  (fsConstants as Readonly<Record<string, number>>)["O_CLOEXEC"] ?? 0;
const STRONG_MUTATION_BROKER_SOCKET_BASENAME_V1 =
  "strong-mutation-broker-v1.sock" as const;
const STRONG_MUTATION_BROKER_LEASE_SUFFIX_V1 =
  ".strong-mutation-broker.lock" as const;

type ProviderProductionCompletedStrongReadyConfigurationInternalV1 =
  Extract<ProviderAcceptedConfigurationV1, { readonly state: "strong_ready" }> &
  Readonly<{
    activation: Extract<
      Extract<ProviderAcceptedConfigurationV1, {
        readonly state: "strong_ready";
      }>["activation"],
      { readonly origin: "completed_provider_migration" }
    >;
  }>;

export function assertProviderProductionCompletedStrongReadyConfigurationInternalV1(
  configuration: ProviderAcceptedConfigurationV1,
): asserts configuration is ProviderProductionCompletedStrongReadyConfigurationInternalV1 {
  if (
    configuration.state !== "strong_ready" ||
    configuration.activation.origin !== "completed_provider_migration"
  ) {
    throw new TypeError("provider strong authority writer is unavailable");
  }
}

export interface OpenProviderProductionStrongAuthorityServiceV1Input {
  /** Root-owned, signed installer handoff; a caller-supplied object is never authority. */
  readonly serviceConfigPath: string;
  /** Selects one already-current Acceptance writer; it cannot create a writer. */
  readonly targetProfileId: ProviderTargetProfileIdV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  /** Transport only. Every returned byte is detached and cryptographically verified. */
  readonly readTrustEvidence: (
    query: ProviderStrongMutationTrustEvidenceQueryInternalV1,
  ) => unknown | Promise<unknown>;
}

export interface ProviderProductionStrongAuthorityServiceV1 {
  readonly profile: "provider_production_strong_authority_service_v1";
  readonly authority: "verified_current_acceptance";
  readonly executionFence:
    "linux_ext4_exact_object_dedicated_os_principal_v1";
  readonly strongWrites: "unlocked";
  close(): Promise<void>;
}

function exactEffectiveAuthorityPrincipalV1(): Readonly<{
  readonly uid: number;
  readonly gid: number;
}> {
  const uid = typeof process.geteuid === "function"
    ? process.geteuid()
    : process.getuid?.();
  const gid = typeof process.getegid === "function"
    ? process.getegid()
    : process.getgid?.();
  if (
    !Number.isSafeInteger(uid) || uid !== 0 ||
    !Number.isSafeInteger(gid) || gid === undefined || gid < 0
  ) {
    throw new TypeError("provider strong authority root principal is unavailable");
  }
  return Object.freeze({ uid, gid });
}

async function readRootOwnedServiceConfigV1(
  pathInput: string,
): Promise<ProviderServiceHandoffConfigV1> {
  const path = resolve(pathInput);
  if (!isAbsolute(pathInput) || path !== pathInput || path.includes("\0")) {
    throw new TypeError("provider strong authority config is invalid");
  }
  const handle = await open(
    path,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | O_CLOEXEC_V1,
  );
  let raw: string;
  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() || before.uid !== 0n || before.nlink !== 1n ||
      (before.mode & 0o022n) !== 0n || before.size < 1n ||
      before.size > BigInt(MAX_SERVICE_CONFIG_BYTES_V1)
    ) {
      throw new TypeError("provider strong authority config is invalid");
    }
    raw = await handle.readFile("utf8");
    const after = await handle.stat({ bigint: true });
    const projected = await lstat(path, { bigint: true });
    if (
      after.dev !== before.dev || after.ino !== before.ino ||
      after.mode !== before.mode || after.uid !== before.uid ||
      after.gid !== before.gid || after.nlink !== before.nlink ||
      after.size !== before.size || after.mtimeNs !== before.mtimeNs ||
      projected.dev !== before.dev || projected.ino !== before.ino ||
      projected.isSymbolicLink() ||
      Buffer.byteLength(raw, "utf8") !== Number(before.size)
    ) {
      throw new TypeError("provider strong authority config changed during read");
    }
  } finally {
    await handle.close();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new TypeError("provider strong authority config is invalid");
  }
  const config = verifyProviderServiceHandoffConfigV1(parsed);
  if (
    config.payload.platform !== "linux" || process.platform !== "linux" ||
    config.payload.configPath !== path
  ) {
    throw new TypeError("provider strong authority config is invalid");
  }
  // The root authority is intentionally distinct from the signed dedicated
  // runtime principal. A same-UID broker cannot establish the isolation gate.
  exactEffectiveAuthorityPrincipalV1();
  return config;
}

async function readCurrentWriterV1(
  config: ProviderServiceHandoffConfigV1,
  targetProfileIdInput: ProviderTargetProfileIdV1,
): Promise<Readonly<{
  readonly targetProfileId: ProviderTargetProfileIdV1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly envelope: ProviderAcceptanceStateEnvelopeV1;
  readonly pin: ProviderAcceptanceGenerationPinV1;
}>> {
  const targetProfileId = ProviderTargetProfileIdV1Schema.parse(
    targetProfileIdInput,
  );
  const layout = resolveProviderAcceptanceAuthorityProductionLayoutInternalV1();
  return withProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1(
    layout,
    {},
    (view) => {
      const current = view.current;
      if (current === null) {
        throw new TypeError("provider strong authority Acceptance is unavailable");
      }
      const pin = ProviderAcceptanceGenerationPinV1Schema.parse(
        current.highWater.payload.currentAcceptance,
      );
      const matching = view.verifiedGenerationEnvelopes.filter((envelope) =>
        envelope.generationId === pin.generationId &&
        envelope.contentDigest === pin.contentDigest &&
        envelope.payload.acceptanceOrdinal === pin.acceptanceOrdinal
      );
      if (matching.length !== 1) {
        throw new TypeError("provider strong authority Acceptance is invalid");
      }
      const envelope = ProviderAcceptanceStateEnvelopeV1Schema.parse(
        matching[0],
      );
      if (
        envelope.installationIdentityGenerationId !==
          view.installationIdentityGenerationId ||
        config.payload.installationIdentityCustody === undefined ||
        config.payload.installationIdentityCustody
          .installationIdentityGenerationId !==
          view.installationIdentityGenerationId
      ) {
        throw new TypeError("provider strong authority identity is invalid");
      }
      const configuration = envelope.payload.configuration;
      assertProviderProductionCompletedStrongReadyConfigurationInternalV1(
        configuration,
      );
      const selections = configuration.core
        .activeWriterSelector.selections.filter((selection) =>
          selection.targetProfileId === targetProfileId &&
          selection.providerId === config.payload.providerId
        );
      if (selections.length !== 1) {
        throw new TypeError("provider strong authority writer is unavailable");
      }
      return Object.freeze({
        targetProfileId,
        installationIdentityGenerationId:
          InstallationIdentityGenerationIdV1Schema.parse(
            view.installationIdentityGenerationId,
          ),
        envelope,
        pin,
      });
    },
  );
}

/**
 * Start the production broker only after root-owned service config, signed
 * runtime readiness, current Acceptance, strict Registry evidence, and the
 * native exact-object authority have joined to one Linux/ext4 writer.
 */
export async function openProviderProductionStrongAuthorityServiceV1(
  input: OpenProviderProductionStrongAuthorityServiceV1Input,
): Promise<ProviderProductionStrongAuthorityServiceV1> {
  if (typeof input.readTrustEvidence !== "function") {
    throw new TypeError("provider strong authority evidence reader is invalid");
  }
  const config = await readRootOwnedServiceConfigV1(input.serviceConfigPath);
  const readiness = await readProviderServiceReadinessV1({
    config,
    readinessPath: config.payload.readinessPath,
  });
  if (
    readiness.status !== "signed_candidate" ||
    readiness.providerId !== config.payload.providerId ||
    readiness.principalUid !== config.payload.principal.uid
  ) {
    throw new TypeError("provider strong authority readiness is unavailable");
  }
  const current = await readCurrentWriterV1(config, input.targetProfileId);
  const layout = resolveProviderAcceptanceAuthorityProductionLayoutInternalV1();
  const providerObjectsPath = join(
    config.payload.runtimeRoot,
    "objects",
    encodeURIComponent(config.payload.providerId),
  );
  const exactObjectAuthority =
    await openProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1({
      profile: PROVIDER_STRONG_MUTATION_LINUX_EXT4_FENCE_PROFILE_INTERNAL_V1,
      providerId: config.payload.providerId,
      targetProfileId: current.targetProfileId,
      targetFingerprintDigest: ContentDigestV1Schema.parse(
        readiness.targetFingerprintDigest,
      ),
      capabilityDigest: ContentDigestV1Schema.parse(
        config.payload.capabilityDigest,
      ),
      installationIdentityGenerationId:
        current.installationIdentityGenerationId,
      principal: Object.freeze({
        uid: config.payload.principal.uid,
        gid: config.payload.principal.gid,
        handoffPayloadDigest: config.payloadDigest,
      }),
      targetDirectoryPath: providerObjectsPath,
      providerDirectoryPath: providerObjectsPath,
    });
  let server: ProviderStrongMutationBrokerServerInternalV1 | undefined;
  try {
    const executionFence =
      registerProviderStrongMutationLinuxExt4ExecutionFenceInternalV1(
        exactObjectAuthority,
      );
    const trustVerifier =
      mintProviderStrongMutationTrustVerifierCapabilityInternalV1({
        strictCryptoCapability: input.strictCryptoCapability,
        readEvidence: input.readTrustEvidence,
      });
    const broker =
      await openProviderStrongMutationBrokerStoreWithExecutionFenceAndLayoutCoreInternalV1(
        layout,
        trustVerifier,
        executionFence,
      );
    server = new ProviderStrongMutationBrokerServerInternalV1({
      socketPath: join(
        config.payload.runtimeRoot,
        STRONG_MUTATION_BROKER_SOCKET_BASENAME_V1,
      ),
      leasePath: `${input.serviceConfigPath}${STRONG_MUTATION_BROKER_LEASE_SUFFIX_V1}`,
      expectedRuntimeUid: config.payload.principal.uid,
      expectedRuntimeGid: config.payload.principal.gid,
      broker,
      readCurrentFormalAcceptance: async () => {
        const fresh = await readCurrentWriterV1(
          config,
          input.targetProfileId,
        );
        return Object.freeze({
          envelope: fresh.envelope,
          pin: fresh.pin,
        });
      },
    });
    await server.start();
  } catch (error) {
    await server?.close().catch(() => undefined);
    await closeProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1(
      exactObjectAuthority,
    );
    throw error;
  }

  let closed = false;
  return Object.freeze({
    profile: "provider_production_strong_authority_service_v1" as const,
    authority: "verified_current_acceptance" as const,
    executionFence:
      "linux_ext4_exact_object_dedicated_os_principal_v1" as const,
    strongWrites: "unlocked" as const,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      let closeError: unknown;
      try {
        await server!.close();
      } catch (error) {
        closeError = error;
      }
      await closeProviderStrongMutationLinuxExt4ExactObjectAuthorityInternalV1(
        exactObjectAuthority,
      );
      if (closeError !== undefined) throw closeError;
    },
  });
}
