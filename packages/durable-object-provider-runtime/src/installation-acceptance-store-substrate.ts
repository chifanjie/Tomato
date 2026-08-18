import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  open,
  readdir,
  realpath,
  type FileHandle,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderAcceptancePredecessorV1,
  type ProviderStrongReadyAcceptanceGenerationPinCandidateV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-reference-candidate";

/**
 * Read-only substrate for a future Root/OS-owned Installation Acceptance
 * source. This module deliberately has no writer and claims no authority:
 * the repository does not yet have a production durable-provider continuation
 * that can safely authorize first publication or compare-append.
 *
 * A production provisioner must place `authorityRoot` outside every directory
 * writable by the service principal. Merely putting this layout below the
 * service-owned runtime root is not sufficient, because the principal could
 * replace the directory entry even when its children are owned by root.
 */

export const PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_PROFILE_V1 =
  "understand_code_provider_installation_acceptance_store_substrate_v1" as const;
export const PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_GENERATION_PROFILE_V1 =
  "understand_code_provider_installation_acceptance_store_generation_v1" as const;
export const PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_HEAD_PROFILE_V1 =
  "understand_code_provider_installation_acceptance_store_head_v1" as const;
export const PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_REQUIRED_NEXT_V1 =
  "root_os_provisioned_exact_acceptance_compare_append_authority" as const;

const GENERATIONS_DIRECTORY_V1 = "generations";
const CURRENT_HEAD_FILE_V1 = "current.json";
const MAX_GENERATION_COUNT_V1 = 4_096;
const MAX_SINGLE_ENVELOPE_BYTES_V1 = 4_194_304;
const MAX_TOTAL_STORE_BYTES_V1 = 268_435_456;
const GENERATION_SET_DOMAIN_V1 =
  "understand-code-provider-installation-acceptance-generation-set-substrate-v1";

type IdentityVerificationCapabilityV1 = Parameters<
  typeof verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1
>[0];

export interface MintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1Input {
  /** Canonical absolute root owned by the independent OS authority. */
  readonly authorityRoot: string;
  readonly expectedAuthorityUid: number;
  readonly expectedAuthorityGid: number;
  /** Opaque capability retained by the Installation Identity owner. */
  readonly identityVerificationCapability: IdentityVerificationCapabilityV1;
}

declare const providerInstallationAcceptanceStoreReaderBrandV1: unique symbol;
export interface ProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1 {
  readonly [providerInstallationAcceptanceStoreReaderBrandV1]: true;
}

export interface ProviderInstallationAcceptanceStoreSubstrateBindingsV1 {
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly highWaterRevision: number;
  readonly generationCount: number;
  readonly generationSetDigest: ContentDigestV1;
  readonly acceptanceOrdinal: number;
  readonly acceptanceGenerationId:
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1["generationId"];
  readonly acceptanceContentDigest: ContentDigestV1;
}

export interface ProviderInstallationAcceptanceStoreSubstrateCurrentCandidateV1 {
  readonly status: "installation_acceptance_store_substrate_candidate";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly durability: "observed_external_filesystem_snapshot";
  /** This is not the keyed D-40 contract HighWater Envelope/Token. */
  readonly headSemantics:
    "filesystem_pointer_not_contract_high_water_envelope";
  readonly rollbackResistance: "process_observed_high_water_only";
  readonly crossRestartRollbackResistance: "not_established";
  readonly completeEnumerationStatus: "verified";
  readonly acceptanceTokenStatus:
    "all_generations_verified_with_installation_identity_capability";
  readonly requiredNext:
    typeof PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_REQUIRED_NEXT_V1;
  readonly bindings:
    ProviderInstallationAcceptanceStoreSubstrateBindingsV1;
}

export type ProviderInstallationAcceptanceStoreSubstrateDiagnosticV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderInstallationAcceptanceStoreSubstrateCurrentCandidateV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
      readonly stage:
        | "reader_capability"
        | "authority_root"
        | "current_head"
        | "complete_enumeration"
        | "acceptance_identity_token"
        | "observed_high_water";
    }>;

export interface VerifyProviderInstallationAcceptanceStoreSubstrateExpectedCurrentV1 {
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly acceptanceOrdinal: number;
  readonly acceptanceGenerationId:
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1["generationId"];
  readonly acceptanceContentDigest: ContentDigestV1;
}

interface CheckedDirectoryV1 {
  readonly path: string;
  readonly dev: number;
  readonly ino: number;
}

interface StoreGenerationRecordV1 {
  readonly schemaVersion: 1;
  readonly profile:
    typeof PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_GENERATION_PROFILE_V1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly envelope: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
}

interface StoreHeadV1 {
  /**
   * Filesystem publication pointer only. It intentionally does not impersonate
   * the D-40 keyed HighWater Envelope because no public identity-capability
   * verifier for that token is available to this runtime slice.
   */
  readonly schemaVersion: 1;
  readonly profile:
    typeof PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_HEAD_PROFILE_V1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly highWaterRevision: number;
  readonly generationCount: number;
  readonly generationSetDigest: ContentDigestV1;
  readonly currentAcceptance:
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1;
}

export interface ProviderInstallationAcceptanceStoreSubstrateEnumerationEntryV1 {
  readonly acceptanceOrdinal: number;
  readonly generationId:
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1["generationId"];
  readonly contentDigest: ContentDigestV1;
  readonly predecessor: ProviderAcceptancePredecessorV1;
}

interface ValidatedSnapshotV1 {
  readonly head: StoreHeadV1;
  readonly enumeration:
    readonly ProviderInstallationAcceptanceStoreSubstrateEnumerationEntryV1[];
  readonly serializedHead: string;
}

interface SharedStoreObservationV1 {
  readonly authorityRoot: string;
  readonly expectedAuthorityUid: number;
  readonly expectedAuthorityGid: number;
  readonly identityVerificationCapability: IdentityVerificationCapabilityV1;
  observed?: ValidatedSnapshotV1;
  tail: Promise<void>;
  pendingMintCount: number;
}

const readerBindingsV1 = new WeakMap<object, ReaderBindingV1>();

/**
 * Process-observed high-water belongs to one canonical physical store, never
 * to a disposable reader or caller-chosen identity partition. The first
 * successful observation fixes the exact owner tuple and opaque Installation
 * Identity capability object. Re-minting an equivalent or foreign capability
 * cannot create a second high-water namespace for the same store path.
 */
const observationsByCanonicalRootV1 = new Map<
  string,
  SharedStoreObservationV1
>();

type ReaderBindingV1 = SharedStoreObservationV1;

class StoreValidationFailureV1 extends Error {
  readonly stage: Extract<
    ProviderInstallationAcceptanceStoreSubstrateDiagnosticV1,
    { readonly ok: false }
  >["stage"];

  constructor(
    stage: Extract<
      ProviderInstallationAcceptanceStoreSubstrateDiagnosticV1,
      { readonly ok: false }
    >["stage"],
  ) {
    super("Installation Acceptance store is unavailable");
    this.name = "StoreValidationFailureV1";
    this.stage = stage;
  }
}

function failV1(
  stage: StoreValidationFailureV1["stage"],
): never {
  throw new StoreValidationFailureV1(stage);
}

function unavailableV1(
  stage: StoreValidationFailureV1["stage"],
): ProviderInstallationAcceptanceStoreSubstrateDiagnosticV1 {
  return Object.freeze({
    ok: false as const,
    code: "provider_unavailable" as const,
    reason: "attestation_invalid" as const,
    stage,
  });
}

function isExactRecordV1(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

function exactModeV1(mode: number): number {
  return mode & 0o777;
}

function validOwnerScalarV1(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

async function checkedDirectoryV1(
  path: string,
  expectedUid: number,
  expectedGid: number,
  expectedMode: number,
): Promise<CheckedDirectoryV1> {
  const metadata = await lstat(path).catch(() => undefined);
  if (
    metadata === undefined ||
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    metadata.uid !== expectedUid ||
    metadata.gid !== expectedGid ||
    exactModeV1(metadata.mode) !== expectedMode ||
    await realpath(path).catch(() => undefined) !== path
  ) failV1("authority_root");
  return Object.freeze({ path, dev: metadata.dev, ino: metadata.ino });
}

async function assertDirectoryUnchangedV1(
  directory: CheckedDirectoryV1,
  expectedUid: number,
  expectedGid: number,
  expectedMode: number,
): Promise<void> {
  const current = await lstat(directory.path).catch(() => undefined);
  if (
    current === undefined ||
    current.isSymbolicLink() ||
    !current.isDirectory() ||
    current.dev !== directory.dev ||
    current.ino !== directory.ino ||
    current.uid !== expectedUid ||
    current.gid !== expectedGid ||
    exactModeV1(current.mode) !== expectedMode ||
    await realpath(directory.path).catch(() => undefined) !== directory.path
  ) failV1("authority_root");
}

function noFollowV1(): number {
  return typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
}

async function checkedRegularFileBytesV1(
  path: string,
  expectedUid: number,
  expectedGid: number,
  expectedMode: number,
  maximumBytes: number,
  stage: StoreValidationFailureV1["stage"],
): Promise<Buffer> {
  let handle: FileHandle | undefined;
  try {
    const before = await lstat(path);
    if (before.isSymbolicLink() || !before.isFile()) failV1(stage);
    handle = await open(path, constants.O_RDONLY | noFollowV1());
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.uid !== expectedUid ||
      opened.gid !== expectedGid ||
      exactModeV1(opened.mode) !== expectedMode ||
      opened.size <= 0 ||
      opened.size > maximumBytes
    ) failV1(stage);
    const bytes = await handle.readFile();
    const after = await lstat(path);
    if (
      after.isSymbolicLink() ||
      !after.isFile() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.uid !== expectedUid ||
      after.gid !== expectedGid ||
      exactModeV1(after.mode) !== expectedMode
    ) failV1(stage);
    return bytes;
  } catch (error) {
    if (error instanceof StoreValidationFailureV1) throw error;
    return failV1(stage);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function parseCanonicalJsonV1(
  bytes: Uint8Array,
  stage: StoreValidationFailureV1["stage"],
): unknown {
  try {
    const serialized = Buffer.from(bytes).toString("utf8");
    if (!serialized.endsWith("\n") || serialized.indexOf("\n") !== serialized.length - 1) {
      return failV1(stage);
    }
    const parsed = JSON.parse(serialized.slice(0, -1)) as unknown;
    if (`${canonicalizeJcsSafeIntegerV1(parsed)}\n` !== serialized) {
      return failV1(stage);
    }
    return parsed;
  } catch (error) {
    if (error instanceof StoreValidationFailureV1) throw error;
    return failV1(stage);
  }
}

function parseHeadV1(value: unknown): StoreHeadV1 {
  if (
    !isExactRecordV1(value, [
      "schemaVersion",
      "profile",
      "installationIdentityGenerationId",
      "highWaterRevision",
      "generationCount",
      "generationSetDigest",
      "currentAcceptance",
    ]) ||
    value.schemaVersion !== 1 ||
    value.profile !==
      PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_HEAD_PROFILE_V1 ||
    !Number.isSafeInteger(value.highWaterRevision) ||
    !Number.isSafeInteger(value.generationCount) ||
    (value.highWaterRevision as number) < 1 ||
    (value.generationCount as number) < 1 ||
    (value.generationCount as number) > MAX_GENERATION_COUNT_V1 ||
    value.highWaterRevision !== value.generationCount
  ) return failV1("current_head");
  try {
    return Object.freeze({
      schemaVersion: 1 as const,
      profile:
        PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_HEAD_PROFILE_V1,
      installationIdentityGenerationId:
        InstallationIdentityGenerationIdV1Schema.parse(
          value.installationIdentityGenerationId,
        ),
      highWaterRevision: value.highWaterRevision as number,
      generationCount: value.generationCount as number,
      generationSetDigest: ContentDigestV1Schema.parse(
        value.generationSetDigest,
      ),
      currentAcceptance:
        ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse(
          value.currentAcceptance,
        ),
    });
  } catch {
    return failV1("current_head");
  }
}

function parseGenerationRecordV1(value: unknown): StoreGenerationRecordV1 {
  if (
    !isExactRecordV1(value, [
      "schemaVersion",
      "profile",
      "installationIdentityGenerationId",
      "envelope",
    ]) ||
    value.schemaVersion !== 1 ||
    value.profile !==
      PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_GENERATION_PROFILE_V1
  ) return failV1("complete_enumeration");
  try {
    return Object.freeze({
      schemaVersion: 1 as const,
      profile:
        PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_GENERATION_PROFILE_V1,
      installationIdentityGenerationId:
        InstallationIdentityGenerationIdV1Schema.parse(
          value.installationIdentityGenerationId,
        ),
      envelope: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse(
        value.envelope,
      ),
    });
  } catch {
    return failV1("complete_enumeration");
  }
}

function generationFileNameV1(ordinal: number): string {
  return `${String(ordinal).padStart(16, "0")}.json`;
}

function pinsEqualV1(
  left: ProviderStrongReadyAcceptanceGenerationPinCandidateV1,
  right: ProviderStrongReadyAcceptanceGenerationPinCandidateV1,
): boolean {
  return left.locatorProfile === right.locatorProfile &&
    left.acceptanceOrdinal === right.acceptanceOrdinal &&
    left.generationId === right.generationId &&
    left.contentDigest === right.contentDigest;
}

function predecessorsEqualV1(
  left: ProviderAcceptancePredecessorV1,
  right: ProviderAcceptancePredecessorV1,
): boolean {
  return left.state === right.state &&
    (left.state === "genesis" ||
      (right.state === "acceptance" &&
        left.generationId === right.generationId &&
        left.contentDigest === right.contentDigest));
}

function pinForEnvelopeV1(
  envelope: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
): ProviderStrongReadyAcceptanceGenerationPinCandidateV1 {
  return ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse({
    locatorProfile: "installation_provider_acceptance_state_v1",
    acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
  });
}

export function deriveProviderInstallationAcceptanceStoreSubstrateGenerationSetDigestV1(
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1,
  enumeration:
    readonly ProviderInstallationAcceptanceStoreSubstrateEnumerationEntryV1[],
): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256")
      .update(canonicalizeJcsSafeIntegerV1([
        GENERATION_SET_DOMAIN_V1,
        {
          installationIdentityGenerationId,
          generationCount: enumeration.length,
          entries: enumeration,
        },
      ]))
      .digest("hex")}`,
  );
}

function serializedHeadV1(head: StoreHeadV1): string {
  return `${canonicalizeJcsSafeIntegerV1(head)}\n`;
}

async function readValidatedSnapshotV1(
  binding: ReaderBindingV1,
): Promise<ValidatedSnapshotV1> {
  const root = await checkedDirectoryV1(
    binding.authorityRoot,
    binding.expectedAuthorityUid,
    binding.expectedAuthorityGid,
    0o700,
  );
  const generationsPath = join(root.path, GENERATIONS_DIRECTORY_V1);
  if (dirname(generationsPath) !== root.path) failV1("authority_root");
  const generationsDirectory = await checkedDirectoryV1(
    generationsPath,
    binding.expectedAuthorityUid,
    binding.expectedAuthorityGid,
    0o700,
  );
  const headPath = join(root.path, CURRENT_HEAD_FILE_V1);
  const firstHeadBytes = await checkedRegularFileBytesV1(
    headPath,
    binding.expectedAuthorityUid,
    binding.expectedAuthorityGid,
    0o600,
    64 * 1024,
    "current_head",
  );
  const head = parseHeadV1(
    parseCanonicalJsonV1(firstHeadBytes, "current_head"),
  );

  const directoryEntries = await readdir(generationsPath, {
    withFileTypes: true,
  }).catch(() => failV1("complete_enumeration"));
  if (directoryEntries.length !== head.generationCount) {
    failV1("complete_enumeration");
  }
  const names = directoryEntries.map((entry) => entry.name).sort();
  for (let index = 0; index < names.length; index += 1) {
    if (names[index] !== generationFileNameV1(index + 1)) {
      failV1("complete_enumeration");
    }
  }

  const enumeration:
    ProviderInstallationAcceptanceStoreSubstrateEnumerationEntryV1[] = [];
  let totalBytes = firstHeadBytes.byteLength;
  let previousEnvelope:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1 | undefined;
  for (let index = 0; index < head.generationCount; index += 1) {
    const ordinal = index + 1;
    const fileName = generationFileNameV1(ordinal);
    if (basename(fileName) !== fileName) failV1("complete_enumeration");
    const bytes = await checkedRegularFileBytesV1(
      join(generationsPath, fileName),
      binding.expectedAuthorityUid,
      binding.expectedAuthorityGid,
      0o400,
      MAX_SINGLE_ENVELOPE_BYTES_V1,
      "complete_enumeration",
    );
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_TOTAL_STORE_BYTES_V1) {
      failV1("complete_enumeration");
    }
    const record = parseGenerationRecordV1(
      parseCanonicalJsonV1(bytes, "complete_enumeration"),
    );
    const envelope = record.envelope;
    const expectedPredecessor: ProviderAcceptancePredecessorV1 =
      previousEnvelope === undefined
        ? Object.freeze({ state: "genesis" as const })
        : Object.freeze({
            state: "acceptance" as const,
            generationId: previousEnvelope.generationId,
            contentDigest: previousEnvelope.contentDigest,
          });
    if (
      record.installationIdentityGenerationId !==
        head.installationIdentityGenerationId ||
      envelope.installationIdentityGenerationId !==
        head.installationIdentityGenerationId ||
      envelope.payload.installationIdentityGenerationId !==
        head.installationIdentityGenerationId ||
      envelope.payload.acceptanceOrdinal !== ordinal ||
      envelope.generationId !== envelope.payload.generationId ||
      envelope.acceptedAt !== envelope.payload.acceptedAt ||
      !predecessorsEqualV1(envelope.payload.predecessor, expectedPredecessor) ||
      envelope.generationId !==
        deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
          installationIdentityGenerationId:
            envelope.payload.installationIdentityGenerationId,
          acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
          predecessor: envelope.payload.predecessor,
          configuration: envelope.payload.configuration,
        }) ||
      envelope.contentDigest !==
        deriveProviderStrongReadyAcceptanceStateContentDigestV1(
          envelope.payload,
        )
    ) failV1("complete_enumeration");
    if (
      !(await verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1(
        binding.identityVerificationCapability,
        envelope,
      ))
    ) failV1("acceptance_identity_token");
    enumeration.push(Object.freeze({
      acceptanceOrdinal: ordinal,
      generationId: envelope.generationId,
      contentDigest: envelope.contentDigest,
      predecessor: envelope.payload.predecessor,
    }));
    previousEnvelope = envelope;
  }

  if (previousEnvelope === undefined) failV1("complete_enumeration");
  const current = pinForEnvelopeV1(previousEnvelope);
  const expectedGenerationSetDigest =
    deriveProviderInstallationAcceptanceStoreSubstrateGenerationSetDigestV1(
    head.installationIdentityGenerationId,
    enumeration,
  );
  if (
    !pinsEqualV1(head.currentAcceptance, current) ||
    head.currentAcceptance.acceptanceOrdinal !== head.generationCount ||
    head.generationSetDigest !== expectedGenerationSetDigest
  ) failV1("current_head");

  const secondHeadBytes = await checkedRegularFileBytesV1(
    headPath,
    binding.expectedAuthorityUid,
    binding.expectedAuthorityGid,
    0o600,
    64 * 1024,
    "current_head",
  );
  if (!firstHeadBytes.equals(secondHeadBytes)) failV1("current_head");
  await assertDirectoryUnchangedV1(
    generationsDirectory,
    binding.expectedAuthorityUid,
    binding.expectedAuthorityGid,
    0o700,
  );
  await assertDirectoryUnchangedV1(
    root,
    binding.expectedAuthorityUid,
    binding.expectedAuthorityGid,
    0o700,
  );
  return Object.freeze({
    head,
    enumeration: Object.freeze(enumeration),
    serializedHead: serializedHeadV1(head),
  });
}

function assertNoObservedRollbackV1(
  previous: ValidatedSnapshotV1 | undefined,
  current: ValidatedSnapshotV1,
): void {
  if (previous === undefined) return;
  if (
    current.head.highWaterRevision < previous.head.highWaterRevision ||
    current.head.generationCount < previous.head.generationCount
  ) failV1("observed_high_water");
  if (current.head.highWaterRevision === previous.head.highWaterRevision) {
    if (
      current.serializedHead !== previous.serializedHead ||
      current.head.generationSetDigest !== previous.head.generationSetDigest
    ) failV1("observed_high_water");
    return;
  }
  const prefix = current.enumeration.slice(
    0,
    previous.head.generationCount,
  );
  if (
    prefix.length !== previous.head.generationCount ||
    deriveProviderInstallationAcceptanceStoreSubstrateGenerationSetDigestV1(
      current.head.installationIdentityGenerationId,
      prefix,
    ) !== previous.head.generationSetDigest
  ) failV1("observed_high_water");
}

function candidateV1(
  snapshot: ValidatedSnapshotV1,
): ProviderInstallationAcceptanceStoreSubstrateCurrentCandidateV1 {
  const current = snapshot.head.currentAcceptance;
  return Object.freeze({
    status: "installation_acceptance_store_substrate_candidate" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    durability: "observed_external_filesystem_snapshot" as const,
    headSemantics:
      "filesystem_pointer_not_contract_high_water_envelope" as const,
    rollbackResistance: "process_observed_high_water_only" as const,
    crossRestartRollbackResistance: "not_established" as const,
    completeEnumerationStatus: "verified" as const,
    acceptanceTokenStatus:
      "all_generations_verified_with_installation_identity_capability" as const,
    requiredNext:
      PROVIDER_INSTALLATION_ACCEPTANCE_STORE_SUBSTRATE_REQUIRED_NEXT_V1,
    bindings: Object.freeze({
      installationIdentityGenerationId:
        snapshot.head.installationIdentityGenerationId,
      highWaterRevision: snapshot.head.highWaterRevision,
      generationCount: snapshot.head.generationCount,
      generationSetDigest: snapshot.head.generationSetDigest,
      acceptanceOrdinal: current.acceptanceOrdinal,
      acceptanceGenerationId: current.generationId,
      acceptanceContentDigest: current.contentDigest,
    }),
  });
}

async function observeCurrentV1(
  binding: ReaderBindingV1,
): Promise<ProviderInstallationAcceptanceStoreSubstrateDiagnosticV1> {
  try {
    const snapshot = await readValidatedSnapshotV1(binding);
    assertNoObservedRollbackV1(binding.observed, snapshot);
    binding.observed = snapshot;
    return Object.freeze({ ok: true as const, value: candidateV1(snapshot) });
  } catch (error) {
    return unavailableV1(
      error instanceof StoreValidationFailureV1
        ? error.stage
        : "current_head",
    );
  }
}

function requireReaderBindingV1(
  capability: ProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1,
): ReaderBindingV1 | undefined {
  if (
    capability === null ||
    (typeof capability !== "object" && typeof capability !== "function")
  ) return undefined;
  return readerBindingsV1.get(capability);
}

function claimSharedStoreObservationV1(
  input: MintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1Input,
): SharedStoreObservationV1 {
  const existing = observationsByCanonicalRootV1.get(input.authorityRoot);
  if (existing !== undefined) {
    if (
      existing.expectedAuthorityUid !== input.expectedAuthorityUid ||
      existing.expectedAuthorityGid !== input.expectedAuthorityGid ||
      existing.identityVerificationCapability !==
        input.identityVerificationCapability
    ) failV1("reader_capability");
    return existing;
  }
  const observation: SharedStoreObservationV1 = {
    authorityRoot: input.authorityRoot,
    expectedAuthorityUid: input.expectedAuthorityUid,
    expectedAuthorityGid: input.expectedAuthorityGid,
    identityVerificationCapability: input.identityVerificationCapability,
    tail: Promise.resolve(),
    pendingMintCount: 0,
  };
  observationsByCanonicalRootV1.set(input.authorityRoot, observation);
  return observation;
}

function observeCurrentQueuedV1(
  binding: SharedStoreObservationV1,
): Promise<ProviderInstallationAcceptanceStoreSubstrateDiagnosticV1> {
  const operation = binding.tail.then(() => observeCurrentV1(binding));
  binding.tail = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

/**
 * Minting performs the first full observation before returning the opaque
 * reader. No caller-supplied DTO can stand in for this capability.
 */
export async function mintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1(
  input: MintProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1Input,
): Promise<ProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1> {
  if (
    !isAbsolute(input.authorityRoot) ||
    resolve(input.authorityRoot) !== input.authorityRoot ||
    input.authorityRoot === dirname(input.authorityRoot) ||
    !validOwnerScalarV1(input.expectedAuthorityUid) ||
    !validOwnerScalarV1(input.expectedAuthorityGid) ||
    input.identityVerificationCapability === null ||
    (typeof input.identityVerificationCapability !== "object" &&
      typeof input.identityVerificationCapability !== "function")
  ) failV1("authority_root");
  const binding = claimSharedStoreObservationV1(input);
  binding.pendingMintCount += 1;
  const first = await observeCurrentQueuedV1(binding).finally(() => {
    binding.pendingMintCount -= 1;
  });
  if (!first.ok) {
    if (
      binding.observed === undefined &&
      binding.pendingMintCount === 0 &&
      observationsByCanonicalRootV1.get(input.authorityRoot) === binding
    ) observationsByCanonicalRootV1.delete(input.authorityRoot);
    failV1(first.stage);
  }
  const capability = Object.freeze(Object.create(null)) as
    ProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1;
  readerBindingsV1.set(capability, binding);
  return capability;
}

/** Queue-linearized full re-observation through the opaque reader. */
export function diagnoseProviderInstallationAcceptanceStoreSubstrateCurrentV1(
  capability: ProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1,
): Promise<ProviderInstallationAcceptanceStoreSubstrateDiagnosticV1> {
  const binding = requireReaderBindingV1(capability);
  if (binding === undefined) {
    return Promise.resolve(unavailableV1("reader_capability"));
  }
  return observeCurrentQueuedV1(binding);
}

/**
 * Future client closeout can bind an expected token/kernel proof to this
 * observer without accepting a serialized current DTO as authority.
 */
export async function diagnoseProviderInstallationAcceptanceStoreSubstrateExpectedCurrentV1(
  capability: ProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1,
  expected: VerifyProviderInstallationAcceptanceStoreSubstrateExpectedCurrentV1,
): Promise<ProviderInstallationAcceptanceStoreSubstrateDiagnosticV1> {
  const current =
    await diagnoseProviderInstallationAcceptanceStoreSubstrateCurrentV1(
      capability,
    );
  if (!current.ok) return current;
  try {
    const identity = InstallationIdentityGenerationIdV1Schema.parse(
      expected.installationIdentityGenerationId,
    );
    const ordinal = Number.isSafeInteger(expected.acceptanceOrdinal) &&
        expected.acceptanceOrdinal > 0
      ? expected.acceptanceOrdinal
      : failV1("current_head");
    const generationId =
      ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.shape
        .generationId.parse(expected.acceptanceGenerationId);
    const contentDigest = ContentDigestV1Schema.parse(
      expected.acceptanceContentDigest,
    );
    const bindings = current.value.bindings;
    if (
      bindings.installationIdentityGenerationId !== identity ||
      bindings.acceptanceOrdinal !== ordinal ||
      bindings.acceptanceGenerationId !== generationId ||
      bindings.acceptanceContentDigest !== contentDigest
    ) return unavailableV1("observed_high_water");
    return current;
  } catch {
    return unavailableV1("current_head");
  }
}
