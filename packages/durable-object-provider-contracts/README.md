# Durable Object Provider Contracts

Portable, fail-closed wire contracts for the WP5 durable-object provider boundary.

The `WP5-C09-0` slice freezes the cryptographic format foundation,
`WP5-C09-1A` adds the public provider failure boundary, `WP5-C09-1B`
freezes strict Ed25519 host conformance, and `WP5-C09-1C` closes the
structure-only bootstrap trust bundle. `WP5-C09-1D` adds portable Root
Metadata lookup and retained successor-history verification. `WP5-C09-1E`
now adds the signed supporting records, per-provider Registry Entry, complete
Registry Manifest, fixed Manifest locator, and retained Registry history
validator. `WP5-C09-1F` adds the independently root-signed real-filesystem
Fixture Corpus and Suite source closure. `WP5-C09-1G` closes one signed Target
Discovery point across Taxonomy, Release Matrix, Fixture observations, Runner
observations, embedded Input Bundle, and Discovery Result, again without
promoting any of these records to I/O authority. `WP5-C09-1H` now closes one
unsigned real-filesystem Conformance Result point back to that complete raw
Discovery/Suite source closure, still without granting Provider or Store I/O
authority. `WP5-C09-1I` binds that Result to one strict semantic Provider
Policy and one root-signed Runtime Attestation point. `WP5-C09-1J` adds
dual-role QA/Release Evidence, `WP5-C09-1K` freezes the closed-world Release
Target Universe supplied point, `WP5-C09-1L` binds a production-format
Registry Entry to passed Evidence through the exact supplied trust history,
and `WP5-C09-1M` closes the signed Provider Feasibility Support Catalog over
that closed-world Universe. `WP5-C09-1N` validates a supplied current candidate
across the retained Taxonomy, Release Matrix, Discovery Result, Universe, and
Catalog histories while preserving the none-only authority boundary.
`WP5-C09-1O` revalidates a complete single-target, Registry-exact candidate,
derives exactly one strong-read/write active writer whose Catalog and Registry
Evidence/runtime pins are byte-identical, and constructs a keyed Acceptance
candidate. The signed multi-target Distribution Catalog remains a valid
release-coverage input but is not treated as a local Acceptance success by this
slice. C09-1O remains a structure-only candidate rather than authoritative
current state.
Every slice still returns structure-only, none-authority validation:

- `rfc8785-jcs-safe-integer-v1` canonical JSON and exact canonical-byte parsing;
- independent branded digest, token, provider identity, and key primitives;
- host-injected SHA-256/HMAC with no Node dependency in production source;
- real domain-specific builders for installation identity, registry root key ID,
  and installation key-check token derivation;
- immutable cross-runtime golden and negative manifests;
- versioned generated JSON Schemas and packed-distribution smoke coverage.
- the single-authority `provider_unavailable` error with six ordered reasons,
  strict privacy-minimal fixtures, and a dedicated `./provider-error` export.
- an independent raw32 public-key digest that never hashes base64 text, JCS, or
  SPKI and preserves the existing domain-specific key-ID derivations;
- a browser/worker-portable strict PureEd25519 reference primitive with
  canonical, non-identity, prime-subgroup `A` and `R`, `S < L`, and the
  unbatched cofactorless verification equation;
- one immutable 28-case signed-package resource, an exact 56-point plus
  28-signature startup KAT, and a module-private opaque capability that retains
  captured method references after successful attestation.
- the fixed Bootstrap Trust Bundle Pin/Envelope/Payload, bootstrap root and
  self-signed generation-one Root Metadata, three sorted independent recovery
  keys, the literal 2-of-3 threshold, and frozen trust-history policy;
- a signed-package identity digest and distribution-root binding that pin the
  Bundle outside the five upgradeable distribution-history chains;
- one immutable cross-language bootstrap-structure crypto manifest with eight
  literal cases covering the signed-package identity, Bundle payload, Root
  Metadata, fixed-resource and deterministic root signatures, and all three
  recovery key IDs;
- one exact 51-case bootstrap rejection manifest with 71 deterministic
  witnesses spanning fixed-resource inventory, raw/semantic Pins, domain
  separation, Envelope and key closure, wrong-message Ed25519 signatures,
  recovery ordering, opaque-capability forgery, and deterministic fixtures;
- immutable Installation Identity retained-origin fields and a conservative
  current versus historical-recovery classifier that never substitutes the
  current Bundle for missing or malformed retained trust;
- a canonical `StoreFilenameKeyV1` codec with reversible `id-` keys for short
  semantic IDs, SHA-256-bound `idh-` keys for long IDs, and exact verification
  of either branch against the trusted semantic ID;
- the only allowed Root Metadata state-relative locator,
  `provider/root-metadata/<StoreFilenameKey(rootGeneration ":" rootKeyId)>.json`,
  built from an exact plain-data locator rather than a caller-supplied path;
- immutable Root Metadata history validation for the bootstrap anchor,
  contiguous predecessor Pins, planned rollover, compromise recovery, strict
  Ed25519 point admission, recovery quorum, and historical key-material
  non-reuse;
- one three-generation bootstrap to planned-rollover to compromise-recovery
  golden resource and one exact 31-case executable rejection corpus, each
  independently bound by raw-resource and semantic JCS digests.
- four root-signed supporting record families, signed Registry Entry and
  Registry Manifest records, and six domain-specific signer-wrapper message
  builders with no exported arbitrary-domain signing helper;
- seven retained Registry Manifest generations covering steady operation,
  key/runtime rotation, prepared/rebinding/source-drained migration, permanent
  source tombstoning, historical signer verification, and exact retained-byte
  identity.
- release-independent Fixture Corpus and Suite semantic digests, exact
  full-signed-payload Envelopes and Pins, two content-digest-only fixed
  locators, strict case/crash-cut coverage, and an explicit none-only source
  validation result.
- a public-only support Taxonomy, signed Release Matrix, release-bound Fixture
  and Runner observation manifests, root-signed embedded Input Bundle and
  root-signed deterministic Result, with exactly five complete-Envelope
  locators and `none_target_discovery_point_structure_only` authority.
- one unsigned, content-bound Conformance Result whose target is an exact
  discovered target, whose case results tuple-exact-cover the signed Suite,
  whose aggregate is a total function, and whose only success authority is
  `none_real_fs_conformance_result_structure_only`.
- one strict Provider Policy and filesystem-profile digest, bound transitively
  to that exact Result and to the already-frozen root-signed Runtime
  Attestation DTO/Pin, with a single 16-field hostile-input snapshot, exact
  1-point/7-signature closure, and success authority
  `none_provider_runtime_attestation_structure_only`.

The arbitrary domain/prefix crypto helpers are intentionally package-internal.
Consumers use the exported domain-specific builders so a caller cannot swap a
domain or output prefix.

## C09-1E Registry Entry and Manifest history

The signed supporting records are
`StoreDurableObjectProviderRuntimeAttestationV1`,
`StoreDurableObjectProviderVerificationPublicKeyV1`,
`StoreDurableObjectProviderBindingDerivationGenerationV1`, and
`ProviderFeasibilityApproverPublicKeyV1`. An enabled
`StoreDurableObjectProviderRegistryEntryV1` binds those records to one
Installation Identity generation, active Root Metadata Pin, provider ID,
semantic policy digest, owner-only Feasibility Evidence Pin, and immutable key
histories. `ProviderRegistryManifestV1` is the complete retained generation:
every known provider is represented by either an enabled Entry or a permanent
revocation tombstone, so omission never means revocation.

The six root-signature domains are:

- `store-provider-runtime-attestation-signature-v1`;
- `store-durable-object-provider-verification-public-key-signature-v1`;
- `store-durable-object-provider-binding-derivation-generation-signature-v1`;
- `provider-feasibility-approver-public-key-signature-v1`;
- `store-durable-object-provider-registry-entry-signature-v1`;
- `provider-registry-manifest-signature-v1`.

Each builder produces only
`JCS([domainLiteral,{rootKeyId,domain:domainLiteral,claims}])`. The wrapper's
root key ID, duplicate domain literal, tuple domain, and wire-signature prefix
must agree. The package builds messages and validates retained signatures but
does not expose an arbitrary-domain helper or a general-purpose signing API.

The three Registry projections are intentionally different:

- Entry content digest uses
  `store-durable-object-provider-registry-entry-v1` over the complete strict
  Entry excluding only its own `registrySignature`. Signed nested records and
  their signatures remain inside the digest.
- Manifest stable ID uses `provider-registry-manifest-id-v1` over
  `{installationIdentityGenerationId,activeRootMetadata,manifestGeneration,predecessor,members,routing}`.
  It excludes `generationId`, `issuedAt`, and `manifestSignature`, but includes
  complete enabled Entries and their already-generated signatures.
- Manifest content digest uses `provider-registry-manifest-v1` over the
  complete strict Manifest excluding only `manifestSignature`. It therefore
  includes both `generationId` and `issuedAt`.

`validateProviderRegistryManifestHistoryV1` internally revalidates the entire
retained Root Metadata history; it never accepts a caller assertion that a root
or signer is trusted. A nested record's signature prefix resolves to the exact
retained historical root key, and the original signed record bytes must remain
byte-identical across later Manifest generations. Root rollover does not permit
rewriting or re-signing old records under the current root. Provider
verification keys are append-only by `(providerId,usage,keyId)`, binding
derivation generations by `(providerId,generation)`, and approver keys by
`(role,keyId)`. Revocation ID/generation sets are likewise append-only;
historical records cannot be deleted, compacted, or changed to evade a limit.

There are five verification-key usages:
`operation_receipt`, `containment_proof`, `state_version`, `journal_version`,
and `migration_semantic_proof`. The active-key map deliberately has only four
slots: operation receipt, containment proof, state version, and journal
version. It must not grow an `active migration semantic proof` field. Migration
semantic-proof signer selection remains part of the external proof/Migration
Plan closure rather than mutable Registry-wide active state.

The retained routing state machine is also frozen:

- the genesis Manifest must start in `steady`; v1 cannot bootstrap directly
  into a migration without a retained source-provider history.
- `steady` has exactly one enabled provider; retained tombstones may coexist
  with it but a second enabled provider is invalid.
- `migration` has exactly two distinct enabled providers matching source and
  destination. `prepared` writes through the source,
  `source_drained` writes through the destination, and phases move monotonically
  through `prepared`, `rebinding`, and `source_drained`.
- returning to `steady` requires a `migration_completed` source tombstone whose
  digest points to the last enabled source Entry. Later generations retain that
  tombstone byte-for-byte and can never re-enable the provider ID.

These checks close only Registry-local shape, signatures, history, and routing
transitions. They do not prove equality with a current Migration Plan.

The only Registry Manifest locator input is the exact object
`{locatorProfile:"installation_provider_registry_manifest_v1",generationId}`.
It derives
`provider/registry-manifests/<StoreFilenameKey(generationId)>.json`; callers
cannot provide a path, `latest` alias, directory scan, or alternate filename.
The locator and its generated JSON Schema validate syntax and closed fields;
runtime lookup must still recompute the canonical filename binding.

The immutable trust-history limits include 4,096 Registry Manifest generations
per Installation Identity, 256 provider verification-key records per provider
and 64 per usage, 64 binding-derivation generations per provider, 64 approver
keys per role, and 256 compromised revocations per Identity. A single trust
Envelope is capped at 4 MiB and total retained trust history at 256 MiB. Normal
updates preserve an eight-generation and 4 MiB emergency reserve. Admission
must canonicalize the complete successor and retained verifier closure and
check every count and byte limit before signing, immutable publication, or
advancing current state.
Hostile pre-schema JSON containers are independently capped at 65,536 entries
and snapshotted one data-property descriptor at a time, so a small logical-byte
input cannot force an unbounded descriptor map before the 4 MiB gate.

Successful Registry history validation returns exactly
`authority: "none_registry_structure_and_history_only"`. It is never
`strong_ready`. The owner-only Feasibility Evidence object, signed distribution
Support Catalog, current Acceptance state, and Migration Plan are external to
this validator; their pins, policy/runtime equality, active-writer selection,
and migration identifiers/phases are not yet closed here. A caller must not use
this result to authorize Store reads or writes.

The Registry golden resource is
`fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json`. It
freezes seven Manifest generations, exact Entry and Manifest projection bytes,
signer messages, signatures, Envelopes, Pins, fixed locators, append-only
records, migration transitions, and retained byte identities. Its complete
validation performs exactly 24 strict point admissions and 38 strict signature
checks: 11 point admissions and nine signatures for the retained Root history,
plus 13 point admissions and 29 signatures for the Registry Manifest and unique
nested-record closure. Its expected retained closure contains three Root
Metadata generations, 11 provider verification-key records, two binding
generations, two approver keys, three runtime attestations, four unique Registry
Entries, seven Registry Manifests, and one source tombstone. The canonical-byte
accounting is 3,945 bytes of retained Root Metadata plus 91,351 bytes of
retained Registry Manifests, for 95,296 retained trust-history bytes in total.

The Registry Manifest invalid corpus is
`fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.json`. It is
an exact 89-case `provider_registry_manifest_history_invalid_manifest_v1`
resource with `fixtureAuthority: "none_rejection_only"`. Each ordered mutation
recipe freezes the expected internal stage/reason, privacy-opaque public
failure, independently reviewed point/signature call counts, any independently
verified wrong-domain proof, and a domain-separated semantic digest of the
actual materialized request. A second-source tuple oracle rejects recipe path,
operand, operation, shape, or ordering drift before reading the golden
resource. The generator and verifier bind both the raw resource and
`provider-registry-manifest-history-invalid-manifest-v1` semantic projection;
`verify:provider-registry-manifest-invalid` checks all 89 recipes and request
digests. The already-published Root Metadata invalid corpus remains the exact
31-case resource described below.

The C09-1K inventory contains exactly 268 draft-2020-12 JSON Schemas at this
checkpoint (the C09-1J baseline was 253), including every primitive,
supporting wire and unsigned projection, atomic genesis/successor and
enabled/revoked branch, routing union, Envelope, Pin, fixed locator, the
previously frozen Registry, Target Discovery, Runtime Attestation, and
Feasibility Evidence surface, and their immutable golden/invalid manifests.
The 15 C09-1K additions cover the dedicated Universe signature primitive,
incomplete reason, bucket coverage and bucket, coverage resolution and basis,
unsigned claims, complete Universe, Envelope, Pin, signature wrapper,
point stage/reason, and the two fixture manifests. Consumers should use the
shipped inventory rather than assume 268 is a forever constant. C09-1L adds
seven generated documents for its stage/reason, compatible base, success
projection, golden/invalid manifests, and topology proof. C09-1M adds 15
documents for its Catalog wire, release disposition, candidate and target
entries, public projection, stage/reason, and golden/invalid manifests,
bringing that inventory to 290. C09-1N adds four documents for its point
stage/reason and golden/invalid manifests. C09-1O adds 17 documents for the
active-writer selector, strong-ready configuration, Acceptance predecessor,
generation, Envelope, Pin, validation, stage, and reason surface, bringing the
current inventory to 311.

The production sources remain ES2022 browser/worker portable. The npm/browser
distribution gate must expose the new public API through the root and
`./provider-registry`, `./provider-real-filesystem-source`,
`./provider-target-discovery-point`, and
`./provider-target-discovery-point-fixtures`,
`./provider-real-filesystem-conformance-result`, and
`./provider-real-filesystem-conformance-result-fixtures`,
`./provider-runtime-attestation-point`, and
`./provider-runtime-attestation-point-fixtures`,
`./provider-feasibility-evidence-point`,
`./provider-feasibility-evidence-point-fixtures`,
`./provider-registry-evidence-binding-point`,
`./provider-registry-evidence-binding-point-fixtures`,
`./provider-release-target-universe-point`, and
`./provider-release-target-universe-point-fixtures`,
`./provider-feasibility-support-catalog-point`, and
`./provider-feasibility-support-catalog-point-fixtures`,
`./provider-distribution-history-current-candidate-point`,
`./provider-distribution-history-current-candidate-point-fixtures`, and
`./provider-strong-ready-acceptance-candidate` exports,
pack all
`schemas/`, `fixtures/`, and fixed `provider/` resources, reject private deep
imports, and execute the same Registry, real-filesystem source, and Target
Discovery, Conformance Result, Runtime Attestation, Feasibility Evidence,
Registry/Evidence binding, Release Target Universe, and Feasibility Support
Catalog point validators plus the Distribution History current-candidate
validator and strong-ready Acceptance candidate surface from clean Node and
browser-bundle installs. There are exactly 28
explicit public module exports at this checkpoint.
Node uses the exact official Zod 4.3.6 runtime. The package's browser path uses
its shipped CSP-safe runtime, with dynamic compilation disabled and
`util.createTransparentProxy` failing closed. Consumers should treat the
package Schemas' `parse`, `safeParse`, and issues as the boundary, rather than
depending on cross-runtime `instanceof` against a separately imported Zod.
`test:distribution` enforces exact source-to-packed Schema path-set equality
in addition to that gate; a successful source build alone must not be
presented as npm or browser distribution completion.

## C09-1F signed real-filesystem source closure

The Fixture Corpus is the immutable source program inventory. Each strict
record carries a domain-typed case key, contiguous fixture ordinal, role,
canonical fixture-program bytes, derived program content digest, and decoded
logical byte length. Records must be UTF-8 bytewise sorted by
`{caseKey,fixtureOrdinal}`, unique, and contiguous from ordinal zero within
every case. The release-independent `fixtureManifestDigest` is derived from
the corpus version, record count, record-set digest, and complete records; it
does not absorb distribution binding, active-root metadata, or signatures.

The Suite exact-pins the Corpus by both its semantic fixture-manifest digest
and full signed Envelope content digest. Its runner profile digest, cases,
crash cuts, and required-case-cut set are independently recomputed. Cases are
UTF-8 bytewise sorted by derived case ID and exact-cover every distinct Corpus
case key. Each case ID is derived from
`{caseKey,fixtureRecordCount,fixtureRecordSetDigest}`. Crash-cut ordinal zero
is exactly `no-crash`; hashed cuts start at ordinal one, point only at an
`operation` record in the same case, and derive their ID from the case ID,
ordinal, injection, and recovery-assertion digest. The flattened
`{caseId,crashCutId}` set is UTF-8 tuple-sorted, explicitly checked unique, and
bound by its count and set digest before the Suite semantic digest is accepted.

Corpus and Suite use separate signature domains:

- `provider-real-fs-fixture-corpus-manifest-signature-v1` with wire prefix
  `provider-real-fs-fixture-corpus-ed25519`;
- `provider-real-fs-suite-manifest-signature-v1` with wire prefix
  `provider-real-fs-suite-manifest-ed25519`.

Both signature builders emit only
`JCS([domainLiteral,{rootKeyId,domain:domainLiteral,claims}])`. The strict
validator checks the supplied active-root Pin/key equality, admits the root as
a strict Ed25519 point, verifies both signatures with the opaque attested
capability, and requires the Corpus/Suite release cut and distribution binding
to agree exactly. Signature-prefix, wrapper-domain, signer, message, and Pin
substitution are all rejected. This validator consumes an active root supplied
by a higher trust closure; it does not itself prove the retained Root Metadata
history or signed-package provenance.

The outer Envelope content digest is deliberately different from the semantic
digest: it covers the complete already-signed payload, including the generated
signature. The public path builders accept only a complete strict Corpus or
Suite Envelope and recompute that full signed-payload `contentDigest` before
they derive:

- `provider/real-fs-fixture-corpus-manifests/<StoreFilenameKey("fixture-corpus-envelope:" + contentDigest)>.json`;
- `provider/real-fs-suite-manifests/<StoreFilenameKey("suite-envelope:" + contentDigest)>.json`.

Callers cannot provide a bare digest, physical path, alias, directory scan,
semantic digest, or alternate filename. The lower-level locator DTO schemas
describe verified Pins and inventories but do not establish digest provenance
and are not accepted by the path builders. The validator applies the signed
distribution policy's 16 MiB canonical Envelope ceiling after strict in-memory
materialization; this slice does not claim resolver-level streaming or a
pre-read physical-byte cap.

Successful validation returns exactly
`authority: "none_real_fs_source_structure_only"`, immutable Corpus/Suite Pins,
their two derived relative paths, and the verified record/case/cut counts. The
public failure remains the privacy-opaque
`ProviderRealFilesystemSourceClosureValidationError` with
`provider_unavailable/attestation_invalid`; detailed stage/reason diagnostics
exist for conformance fixtures and must not be surfaced as provider authority.
In particular, this closure does not execute fixture programs, touch a real
filesystem, select a target, or prove a provider conformance result.

The golden resource is
`fixtures/v1/golden/provider-real-filesystem-source-v1.json`. It freezes 12
records, four cases, eight required cuts, both exact signature messages,
complete canonical payload bytes, full-content locators, and a none-only
successful validation. The paired
`fixtures/v1/invalid/provider-real-filesystem-source-v1.json` is an exact
43-case ordered rejection corpus covering closed input shape, record/case/cut
ordering and coverage, every semantic and Envelope digest, distribution/root
binding, Corpus Pin equality, signature bitflips, wrong domains/signers and
prefix substitution. Both resources are independently anchored by raw byte
length/SHA-256 and domain-separated semantic digest; every invalid recipe also
pins the semantic digest of its materialized request.

## C09-1G signed Target Discovery point closure

The public Taxonomy assigns derived codes only to public OS-release families
and filesystem kinds; build identifiers, filesystem feature digests, and mount
option digests remain excluded from the public projection. The signed Release
Matrix carries complete feasibility targets and fixed 4,096-target, 4,096
unresolved-observation, and 16 MiB canonical-Envelope limits. The release-bound
Fixture manifest transitively exact-pins the C09-1F Suite and Corpus closure.
The Runner manifest has its own producer, implementation, binary-attestation,
and runner-profile identity and is deliberately independent from the C09-1F
Suite runner profile.

The embedded signed Input Bundle fixes one observation cut and projects records
in exactly Matrix, Fixture, Runner order. The signed Result is recomputed from
that Bundle: resolved targets are unique and UTF-8 sorted by target ID, while
typed unresolved observations are UTF-8 tuple-sorted by source and observation
key. Missing, extra, duplicate, reordered, semantically substituted, or
conflicting observations fail closed. Canonical empty Fixture and Runner
record lists are valid; the Matrix still produces the point's two resolved
targets.

One successful validation performs exactly one active-root point admission and
six signature verifications: the two transitive C09-1F Corpus/Suite signatures
plus Taxonomy, Matrix, Input Bundle, and Result. It returns only
`authority: "none_target_discovery_point_structure_only"`. It does not read a
filesystem or package path, execute a Runner or fixture, resolve `current`,
verify retained Taxonomy/Matrix/Result history, construct a Target Universe,
prove conformance, publish Evidence or Catalog data, or authorize provider I/O.
All public failures collapse to
`ProviderTargetDiscoveryPointClosureValidationError` with
`provider_unavailable/attestation_invalid`.

The five path builders accept only complete strict, content-bound Envelopes:
Taxonomy, Release Matrix, Fixture manifest, Runner run, and Discovery Result.
They reject bare DTOs or digests, semantic-digest substitutions, extra path
fields, and `latest` aliases. The root and the two dedicated package subpaths
export the named Pins and locator DTOs; packed Node and browser KATs verify the
same resources and exact 1/6 cryptographic closure.

The golden resource is
`fixtures/v1/golden/provider-target-discovery-point-v1.json`: seven
observations project to two targets and two typed unresolved observations. Its
paired invalid resource freezes exactly 116 ordered diagnostic and executable
recipes. Coverage includes distribution/active-root/release binding, every
new signer/domain/prefix/claims substitution, source-artifact digest
substitution, observation coverage/order, 4,097-entry limits, exact 16 MiB+1
boundaries, all five locator families, Proxy/getter/hidden/symbol/sparse/cycle
and alias inputs, and mutation during asynchronous verification. Raw bytes,
semantic manifests, and every materialized-request witness are independently
digest-bound.

## C09-1H unsigned real-filesystem Conformance Result point closure

`validateProviderRealFilesystemConformanceResultClosureV1` accepts the complete
raw C09-1G request plus the Result Envelope, explicit Result Locator DTO, and
Result Pin. It snapshots that whole hostile input exactly once before the first
async verification boundary, then invokes the C09-1G diagnostic validator on
the snapshotted raw artifacts. A successful call therefore still performs
exactly one active-root point admission and six signature verifications. The
Result has no seventh root signature: its `result="passed"` is only the
deterministic aggregate of case details, not evidence that a runner or physical
filesystem executed.

The Result target ID is recomputed from its other seven target claims. Its
complete target bytes must match exactly one discovered target. The Discovery
Pin and Input Bundle digest equal the resolved C09-1G point. The Suite Pin must
simultaneously equal the raw signed Suite Envelope Pin, the C09-1G source Pin,
and the Discovery Bundle-to-Fixture transitive Suite Pin. `suiteDigest`,
`fixtureManifestDigest`, `runnerProfileDigest`, and
`crashCutCoverageDigest` copy the resolved Suite values exactly. In particular,
the Result runner digest comes from the real-filesystem Suite; it is never
connected to the independent Target Discovery Runner profile.

The signed Suite is flattened into required `{caseId,crashCutId}` tuples. The
Result `caseResults` must be UTF-8 bytewise tuple-sorted, unique, and an exact
cover. `passed` only pairs with `passed`, `unsupported` only with
`unsupported_by_target_profile`, and every other allowlisted code pairs with
`failed`. Aggregate precedence is failed, then unsupported, then passed. V1
has no independent case-count limit; Suite exact-cover and the 16 MiB canonical
materialized Result Envelope ceiling are the limits.

The stable ID uses `provider-real-fs-conformance-result-id-v1` over the complete
frozen identity fields; the content digest uses
`provider-real-fs-conformance-result-v1` over the complete strict payload.
Envelope outer ID/content digest, payload ID, explicit Locator, and Pin close
exactly. The pre-read path resolver accepts only
`{locatorProfile:"installation_provider_real_fs_conformance_result_v1",resultId}`.
It rejects an Envelope, a Pin, an extra caller path, or an alias before deriving
`provider/real-fs-conformance-results/<StoreFilenameKey(resultId)>.json`.

Successful validation returns only
`authority: "none_real_fs_conformance_result_structure_only"` and recursively
frozen projections. Public rejection remains
`provider_unavailable/attestation_invalid`; exact stage/reason stays on the
diagnostic/fixture surface. This point does not execute a runner, touch a
filesystem, establish runtime attestation, create QA/Release Evidence, resolve
history/current state, or authorize reads or writes.

The immutable golden resource is
`fixtures/v1/golden/provider-real-filesystem-conformance-result-v1.json`; it
freezes eight case/cut results, ID/payload canonical bytes, Locator/Pin/path,
exact 1/6 crypto counts, and zero Result signatures. The paired invalid resource
contains 50 ordered executable cases covering all 14 invalid outcome/code
pairings, source substitution, target and
transitive Pin equality, tuple/outcome/aggregate semantics, ID/content/Envelope,
Locator-only resolution, 16 MiB+1, hostile containers, and async mutation. Both
resources have independent raw and semantic anchors, and every case pins its
materialized witness digest. Focused core tests exercise the complete 21-pair
outcome/code matrix: seven valid and fourteen invalid combinations.

## C09-1I Result-to-Policy root-signed Runtime Attestation point

`validateProviderRuntimeAttestationPointClosureV1` accepts exactly 16 input
fields: the complete raw C09-1H request, a strict semantic Provider Policy, and
the existing C09-1E Runtime Attestation Pin. It performs one descriptor-safe,
alias/cycle/accessor/Proxy-rejecting snapshot before any asynchronous crypto,
then invokes the C09-1H diagnostic exactly once. A valid point therefore
performs exactly one active-root point admission and seven signature
verifications: the inherited six signed source/discovery records plus the
Runtime Attestation's existing root signature.

The Provider Policy is strict and domain-digested. It freezes the provider ID,
IPC peer-authentication digest, one of two isolation profiles, workspace-writer
namespace exclusion, the exact regular/directory staging tuple, recovery,
identity, publish, external-intent and handoff-journal semantics, one immutable
compare/append receipt-ledger policy, delete semantics, the forbidden stock
same-UID fallback, and the exact real-filesystem Suite digest. The independent
filesystem-profile digest covers the Conformance Result's filesystem code,
filesystem feature profile, and mount-option profile.

The reused Runtime Attestation DTO and Pin must bind the same provider,
semantic policy digest, implementation/binary/OS/architecture claims,
filesystem-profile digest, and exact Conformance Result content digest. Its Pin
must recompute, its active root key must match, and its root signature must
verify under the already-frozen C09-1E message builder. The runtime generation,
issuance time, and IPC endpoint attestation digest remain intentionally
rotatable when the complete Runtime Attestation is re-signed and re-pinned.

Successful validation returns only recursively frozen projections with
`authority: "none_provider_runtime_attestation_structure_only"`. It does not
execute or supervise a provider, open IPC, read or write a filesystem, choose a
current Runtime Attestation, validate Runtime history, create Evidence or
Registry state, or grant Store authority. Public rejection is always the
opaque `provider_unavailable/attestation_invalid`; the frozen ten-stage and
seven-reason first-boundary diagnostic is exposed only for tests and fixtures.

The immutable golden resource is
`fixtures/v1/golden/provider-runtime-attestation-point-v1.json`. Its paired
invalid resource contains 122 ordered executable cases: all 50 C09-1H cases
replayed through the true C09-1I first boundary, plus 72 point-specific Policy,
Runtime structure/generation/timestamp/digest/binding/Pin/root/signature,
compound first-boundary, hostile-container, and asynchronous snapshot cases.
Positional tuples freeze both case-ID and case-record order in the distributed
JSON Schema. Every case freezes the materialized-request digest, diagnostic or
accepted snapshot projection, opaque public failure where applicable, and exact
point/signature call counts. The generator `--check`, standalone verifier,
focused tests, and packed Node/Vite/browser KAT all consume those same resources;
both clean-tar runtimes independently recompute every materialized witness
digest.

## C09-1J QA/Release Provider Feasibility Evidence point

`validateProviderFeasibilityEvidencePointClosureV1` accepts the complete raw
C09-1I request plus one root-signed QA approver key, one distinct root-signed
Release approver key, a dual-signed Feasibility Evidence Envelope, and its Pin.
It snapshots the exact 20-field request before the first asynchronous boundary
and invokes the C09-1I diagnostic exactly once. A successful validation performs
three strict point admissions and 11 signature verifications: the inherited
1/7 Runtime closure, two approver-key admissions, two approver-record root
signatures, and the Evidence QA/Release signatures.

The Evidence ID binds the Provider, semantic Policy, Runtime Attestation,
implementation and binary attestations, complete target, isolation and IPC
policy, real-filesystem Suite and Result, Fixture/Runner/Cut provenance,
aggregate result, and issuance time. QA and Release sign byte-identical claims
under role-separated domains. The complete dual-signed payload then determines
the Envelope content digest and Pin. `issuedAt` ordering is compared at exact
nanosecond precision; this closure deliberately adds no wall clock, TTL,
freshness, or `current` claim.

Success returns only
`authority: "none_provider_feasibility_evidence_structure_only"`. The approver
records are supplied-point facts, not proof of key history, current selection,
revocation state, production approval, or live Provider execution. The immutable
golden resource contains independent `passed`, `failed`, and `unsupported`
positive vectors. Its paired invalid resource replays all 122 Runtime operations
and adds 105 Evidence-specific operations, for 227 ordered executable cases with
fresh request witnesses and exact crypto counts.

## C09-1K closed-world Release Target Universe point

`validateProviderReleaseTargetUniversePointClosureV1` accepts the exact raw
C09-1G request plus a root-signed Release Target Universe Envelope. Before any
Promise or cryptographic work, the non-async wrapper performs identity-first,
descriptor-only bounded admission across the complete 12-field graph, rejects
accessors, Proxy identities, aliases, cycles, sparse containers, and budget
overruns, and trusted-clones one sealed capsule exactly once. The opaque strict
crypto capability keeps its original owner-bound identity. The detached frozen
snapshot is then handed to the C09-1G core without a second clone.

Universe coverage exact-pins the verified Matrix and Discovery Result and
rechecks their limits, ruleset, dimension/source tuples, Bundle and observation
cut, target counts and set digests, and unresolved count. Its target entries are
the canonical full-byte union (therefore the already-verified Discovery target
set), while public-profile buckets are ordered, unique, and an exact partition.
Resolution is the single ordered total function
`taxonomy_mapping_unresolved` → `target_discovery_unresolved` →
`release_matrix_incomplete` → `closed_world_complete`; an incomplete Universe
uses the same derived reason in every bucket.

The dedicated `provider-release-target-universe-signature-v1` signature covers
the complete unsigned Universe claims. The full signed payload determines the
`provider-release-target-universe-v1` content digest, derived Pin, and only valid
relative path under `provider/release-target-universe/`. A successful point
performs exactly one active-root point admission and seven signature
verifications and returns only
`authority: "none_release_target_universe_structure_only"`. The standalone path
builder performs its own single bounded snapshot and remains 0/0 and
authority-free.

Public Promise shells and all derived `then`/`catch`/`finally` chains are native,
recursively frozen, and own-hardened against post-bootstrap Promise prototype or
species poisoning. Fulfilled top-level records are frozen null-prototype records.
These hardening helpers and the C09-1G pre-snapshot sidecars are package-private;
the public C09-1G wire and its original immutable resource bytes remain unchanged.

The immutable golden resource is
`fixtures/v1/golden/provider-release-target-universe-point-v1.json`. It freezes
four genuine resolution vectors, each with the exact 1/7 closure. The paired
invalid resource preserves all 116 C09-1G operations in their original positions
and adds 169 Universe-specific operations, for 285 fresh ordered cases. The
corpus covers the 16-stage/11-reason first-boundary contract, coverage and bucket
precedence, signature/digest/Envelope/path substitution, resource budgets,
hostile containers, Promise pollution, and asynchronous mutation. This point
does not prove retained predecessor history, current selection, Catalog
exact-cover, Registry/Acceptance state, a real Provider, I/O, migration, or
strong-write authority.

## C09-1L Registry Entry/Evidence supplied-history candidate binding

`validateProviderRegistryEvidenceBindingPointClosureV1` closes one
production-format Registry Entry to one passed QA/Release Evidence object while
reusing the exact retained Root and Registry history supplied in the same call.
Its 22-field raw request contains the complete C09-1I request plus the Bootstrap
Trust Bundle, Installation Identity, Evidence Envelope/Pin, Root history, and
Registry history. There is no caller-supplied provider selector, Registry Entry,
approver key, path, `current` flag, validation DTO, or bypass boolean.

The non-async public wrapper performs descriptor-only bounded admission before
the first asynchronous boundary. It rejects aliases, cycles, sparse arrays,
accessors, symbols, custom prototypes, and raw budget overruns before crypto,
then performs one full-capsule trusted clone. Package-internal prepared Registry
and Runtime cores consume two separate identity-bound one-shot witnesses; they
do not call the public snapshotting validators or retain a second full history
graph. The full capsule is bounded at 4,194,304 observed identities and
268,435,456 pre-clone allocation work units, with independent per-object and
aggregate retained-history limits. A generated topology proof covers every one
of the 21 JSON branches, records the constructive lower and finite sound upper,
and proves that the adopted caps contain the latter while the superseded caps
do not.

The Evidence payload is the sole provider selector. The supplied Registry tip
must be steady and contain exactly one enabled matching member. The candidate
Entry must exact-bind the supplied Evidence Pin, Runtime Pin, and semantic
Policy digest. QA and Release signatures resolve from the Entry's already
verified append-only approver history, so an unrevoked historical signer remains
valid after ordinary key rotation; revoked, unknown, or wrong-role signers fail
closed. Only `result="passed"` reaches success. A successful compatible-base
closure performs exactly 24 strict point admissions and 46 signature
verifications and returns the recursively frozen ten-field projection under
`authority: "none_registry_entry_evidence_binding_structure_only"`. It does
not establish authoritative current state, Catalog coverage, Acceptance,
online runtime/volume identity, Store I/O, migration, or strong-write authority.

The immutable fixture set contains all 227 C09-1J cases, all 89 Registry-history
cases, and 38 point-specific cases: 354 ordered fresh executions in 12
continuous shards of at most 32 cases. Node and Vite/browser packed consumers
import the point and fixture subpaths, verify root/subpath symbol identity and
resource realpaths, and replay the complete corpus without sharing a prepared
history or crypto witness across cases.

## C09-1M closed-world Provider Feasibility Support Catalog point

`validateProviderFeasibilitySupportCatalogPointClosureV1` accepts exactly 18
raw fields: `activeRoot`, `activeRootMetadata`, `bootstrapTrustBundle`,
`distributionRootBinding`, `fixtureCorpusManifest`,
`installationIdentityGenerationId`,
`providerFeasibilitySupportCandidateArtifacts`,
`providerFeasibilitySupportCatalog`, `publicSupportTaxonomy`,
`registryManifestHistory`, `releaseMatrix`, `releaseTargetUniverse`,
`rootMetadataHistory`, `strictCryptoCapability`, `suiteManifest`,
`targetDiscoveryFixtureManifest`, `targetDiscoveryResult`, and
`targetDiscoveryRunnerRun`. There is no caller-supplied Catalog Pin, path,
current selector, Acceptance state, or authority flag.

The signed Catalog has exactly one canonically ordered target group for every
Universe target: omission, addition, substitution, duplication, or reordering
fails the exact-cover boundary. Each canonically ordered candidate has one
same-index artifact and must deep-close its Evidence and Result back to the
supplied Registry history, Policy, Runtime, target, and common discovery
sources. Deep closure accepts all three structurally valid Evidence outcomes:
`passed`, `failed`, and `unsupported`. `strong_read_write` is valid only with
`passed`; `legacy_redacted_read_only` is the conservative disposition for any
of the three outcomes.

Projection is deliberately two-level. First, each private owner target is
`strong_read_write` only when at least one of its candidates is both `passed`
and declared `strong_read_write`; otherwise it is
`legacy_redacted_read_only`. Second, a Universe public bucket is strong only
when its coverage is `closed_world_complete` and every private member target
is strong; otherwise the public row is read-only. The public row exposes only
the public profile ID and its four public dimensions: platform, release-family
code, architecture, and filesystem-profile code.

The four positive vectors each contain two private targets, two candidates,
and one public row (`2/2/1`). The targets share one public profile but differ in
their private digests. The vectors cover both candidates passed/strong, a
second passed/read-only candidate, a second failed/read-only candidate, and a
second unsupported/read-only candidate. Each successful closure freezes the
exact 31 point admissions and 64 signature verifications.

The active root signs the complete unsigned Catalog claims. The signed payload
determines the content digest; the Envelope determines the Pin and the only
valid relative path below `provider/support-catalog/`. Success returns only
`authority: "none_provider_feasibility_support_catalog_structure_only"`.
This point does not establish retained Catalog history, authoritative current
Catalog or Registry/Acceptance selection, Acceptance, production Provider or
Store I/O, migration, or strong-write authority.

The first-party validation path captures and binds the primordials it uses, but
this package does not claim a complete same-realm SES boundary for third-party
dependencies. Zod and its own primordial calls are part of the trusted module
realm. Untrusted Provider or host code must run in an isolated realm or,
preferably, out of process; same-realm hostile code must not be treated as an
authority boundary merely because the public Promise shell is hardened.

## C09-1N retained Distribution History current-candidate closure

`validateProviderDistributionHistoryCurrentCandidatePointV1` accepts exactly
16 fields: the Bootstrap Trust Bundle, distribution-root binding, Installation
Identity generation, Root Metadata and Registry Manifest histories, the five
retained Taxonomy/Release Matrix/Discovery Result/Release Target
Universe/Support Catalog histories, the retained Fixture/Runner/Suite/Corpus
source sets, current candidate artifacts, and the opaque strict-crypto
capability. Caller-supplied `activeRoot`, `current`, and `path` fields are not
part of this boundary.

Each of the five signed distribution histories is non-empty, begins at
generation one, advances contiguously, exact-pins its predecessor, and retains
nondecreasing active Root Metadata. Every cross-chain dependency must resolve
by exact generation and digest within the supplied histories. Universe
Matrix/Result pins and Catalog Taxonomy/Universe pins may not roll back across
successive generations. The last element of each supplied chain is only the
candidate tip; this validator does not turn that supplied position into an
Acceptance-selected current record.

Every retained Discovery Input Bundle is counted and must close its transitive
Fixture, Runner, Suite, and Corpus source. The four supplied source sets must
exact-cover all history references by their owned locators and digests:
missing, duplicate, extra, or cross-owned retained objects fail closed.
Retained accounting permits at most 65,536 objects,
512 MiB of logical bytes in aggregate, and 16 MiB per canonical object. Each
chain has a hard 4,096-generation ceiling; normal updates stop at 4,088
generations per chain and 496 MiB so the policy preserves its emergency reserve
of eight generations per chain and 16 MiB.

Only the five tips enter the current C09-1M Catalog deep closure, while every
non-tip generation still receives full signature, source, and semantic
validation. Success returns the five frozen tips, the complete current Catalog
projection, and its full Catalog point closure. The three anchored positives
are genesis at exactly 31 point admissions and 64 signature verifications,
two-generation shared-source history at 31/70, and two-generation
distinct-source history at 31/72; their aggregate is 93/206. The invalid
manifest contains 39 fresh executable cases, including five validly re-signed
and re-anchored non-tip semantic corruptions in addition to signature,
five-chain structure, retained exact-cover, forbidden-input, and cross-pin
failures.

Success is limited to
`authority: "none_provider_distribution_history_current_candidate_structure_only"`.
It establishes neither Acceptance/current selection nor Migration equality,
Provider or Store I/O, or strong-read/write authority.

## Verification

```sh
pnpm --filter @understand-code/durable-object-provider-contracts build
pnpm --filter @understand-code/durable-object-provider-contracts typecheck
pnpm --filter @understand-code/durable-object-provider-contracts verify:bootstrap-trust-invalid
pnpm --filter @understand-code/durable-object-provider-contracts verify:bootstrap-trust
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-root-history
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-registry-manifest-history
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-registry-manifest-history
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-registry-manifest-invalid
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-registry-manifest-invalid
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-real-fs-source
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-real-fs-source
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-target-discovery-point
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-target-discovery-point
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-real-fs-conformance-result
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-real-fs-conformance-result
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-runtime-attestation-point
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-runtime-attestation-point
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-feasibility-evidence-point
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-feasibility-evidence-point
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-registry-evidence-binding-point
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-registry-evidence-binding-topology-proof
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-registry-evidence-binding-point
pnpm --filter @understand-code/durable-object-provider-contracts test:provider-registry-evidence-binding-point-replay
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-release-target-universe-point
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-release-target-universe-point
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-feasibility-support-catalog-point
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-feasibility-support-catalog-point
pnpm --filter @understand-code/durable-object-provider-contracts generate:provider-distribution-history-current-candidate-point
pnpm --filter @understand-code/durable-object-provider-contracts verify:provider-distribution-history-current-candidate-point
pnpm --filter @understand-code/durable-object-provider-contracts generate:schemas
pnpm --filter @understand-code/durable-object-provider-contracts verify:schemas
pnpm --filter @understand-code/durable-object-provider-contracts exec vitest run \
  test/provider-registry-records.test.ts \
  test/provider-registry-manifest-history.test.ts \
  test/provider-registry-manifest-fixtures.test.ts \
  test/provider-real-filesystem-source.test.ts \
  test/provider-real-filesystem-source-fixtures.test.ts \
  test/provider-target-discovery-point.test.ts \
  test/provider-target-discovery-point-fixtures.test.ts \
  test/provider-real-filesystem-conformance-result.test.ts \
  test/provider-real-filesystem-conformance-result-fixtures.test.ts \
  test/provider-runtime-attestation-point.test.ts \
  test/provider-runtime-attestation-point-fixtures.test.ts \
  test/provider-feasibility-evidence-point.test.ts \
  test/provider-feasibility-evidence-point-fixtures.test.ts \
  test/provider-release-target-universe-wire.test.ts \
  test/provider-release-target-universe-point.test.ts \
  test/provider-release-target-universe-point-fixtures.test.ts \
  test/provider-distribution-history-current-candidate-point.test.ts \
  test/provider-distribution-history-current-candidate-point-fixtures.test.ts \
  test/provider-strong-ready-acceptance-candidate-internal.test.ts \
  test/provider-strong-ready-acceptance-candidate.test.ts \
  test/runtime-boundary.test.ts \
  test/json-schema.test.ts
pnpm --filter @understand-code/durable-object-provider-contracts test
pnpm --filter @understand-code/durable-object-provider-contracts test:distribution
```

The numerical contracts above are executable, not prose-only estimates.
`PROVIDER_TRUST_HISTORY_POLICY_V1` is the source for every history and byte
limit. The golden resource's `expected.cryptoClosure`, `expected.uniqueClosure`,
and retained-byte fields are checked by
`verify:provider-registry-manifest-history` and the focused fixture tests. The
invalid resource's `caseCount`, ordered `caseIds`, raw/semantic anchors, exact
diagnostics, and crypto call counts are checked by
`verify:provider-registry-manifest-invalid`. The signed real-filesystem fixture
anchors, exact source closure, and 43 materialized negative diagnostics are
checked by `verify:provider-real-fs-source`. `test/json-schema.test.ts` freezes
the current 311-schema inventory and `verify:schemas` rejects generated-file
drift. `verify:provider-target-discovery-point` checks the exact five locators,
six-signature closure, canonical empty Fixture/Runner success, typed unresolved
projection, and all 116 ordered diagnostic/executable recipes.
`verify:provider-real-fs-conformance-result` checks the exact one-point,
six-signature, no-seventh-signature closure, Locator-only path, eight tuple
results, immutable anchors, and all 50 ordered executable cases.
`verify:provider-runtime-attestation-point` checks the exact one-point,
seven-signature Result-to-Policy-to-Runtime closure, immutable 16-field
snapshot and returned projection, none-only authority, and all 122 ordered
executable cases.
`verify:provider-feasibility-evidence-point` checks the exact three-point,
11-signature Runtime-to-QA/Release Evidence closure, immutable 20-field
snapshot, three structurally valid outcomes, and all 227 ordered executable
cases. `verify:provider-registry-evidence-binding-point` checks the exact 24/46
supplied-history candidate closure, both explicit inherited adapter tables, all
354 ordered cases and 12 fixed shards, and the generated 21-branch topology
proof. The dedicated four-worker replay command executes every case with a
fresh request and one-shot witnesses.
`verify:provider-release-target-universe-point` checks all four 1/7
resolution closures, exact C09-1G replay, fixed coverage/bucket semantics,
hardened Promise and raw-admission behavior, and all 285 fresh ordered cases.
`verify:provider-feasibility-support-catalog-point` checks the exact 18-field
raw boundary, Universe target exact-cover, passed/failed/unsupported candidate
deep closure, two-level conservative projection, four `2/2/1` positive
vectors, exact 31/64 crypto closure, derived Catalog Pin/path, and none-only
authority.
`generate:provider-distribution-history-current-candidate-point` reconstructs
the three anchored history vectors and all 39 fresh invalid diagnose/public
rejection pairs. Its `verify:` counterpart runs the generator in byte-exact
read-only `--check` mode. The focused point and fixture tests additionally
freeze the exact 16-field boundary, five contiguous anti-rollback chains,
retained Bundle/source accounting and exact-cover, full non-tip semantics,
tip-only current Catalog closure and projection, 31/64, 31/70, and 31/72
crypto counts, the five validly re-signed semantic negatives, and none-only
authority.
`test:distribution` is the clean packed Node/browser source for the npm
distribution claims.

The tracked manifests live under `fixtures/v1`. Expected bytes and crypto results
are literal reviewable constants; tests never generate expected values with the
implementation under test.

The separate
`fixtures/v1/golden/ed25519-public-key-digest-v1.json` keeps the original
golden manifest byte-for-byte unchanged while distributing the D-31
`00..1f` raw32 digest and the unchanged legacy root key ID to every language
consumer.

The versioned provider-error reference and invalid fixtures are checked by both
the runtime Zod contract and its generated draft-2020-12 JSON Schema. The public
error deliberately contains only `schemaVersion`, `code`, and `details.reason`.

The strict host resource is fixed at
`provider/ed25519-strict-host-conformance-v1.json`. The portable attestor chooses
that path and its 4 MiB pre-materialization cap; callers provide only a package
resource resolver, not a manifest object or alternate path. The resource is
canonical JCS, exact-covers the compiled case tuple, and must match the compiled
semantic content digest before any KAT method is called.
Packed-distribution verification executes that same 56+28 KAT from the emitted
ES2022 browser bundle with Node-only globals removed, in addition to scanning
the bundle for Node runtime dependencies.

The Bundle resource is fixed at
`provider/bootstrap-trust-bundle-v1.json`, has the compiled content digest
`sha256:a9aad99fd56ce76cf315514f258965e3d77e4da9e6a13897f42a27513a5c1cbc`,
and is byte-identical to
`fixtures/v1/golden/bootstrap-trust-bundle-v1.json`. Bundle and strict-manifest
resources each have their own 4 MiB pre-materialization limit. Verification
runs the 56+28 host KAT, then rejects any otherwise self-consistent Bundle
whose derived digest does not equal the compiled Pin before consulting trust
keys. It next uses the resulting opaque capability for two
golden root-signature point/signature pairs, followed by exactly four
Bundle trust-key point admissions and one bootstrap self-signature
verification. The complete path therefore performs 62 point and 31 signature
calls in total.

The matching cross-language fixture is
`fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json`. It freezes
the exact JCS UTF-8 hex, SHA-256 result, key ID or raw Ed25519 signature for
five domains across eight cases. It also records the fixed Bundle file-byte
length and SHA-256 separately from semantic payload digests. The one published
seed is explicitly non-production, uses key material independent from the
Bundle root and recovery keys, and exists only to let every implementation
reproduce the same signer output. Node and browser distribution probes consume
this same file through the raw-resource verifier rather than copying expected
constants into runtime-specific tests. That boundary requires the exact
41,713-byte resource and its compiled SHA-256 before parsing, then independently
requires the compiled semantic-manifest digest; whitespace/key-order aliases
and fully coherent alternate fixture contents both fail closed.

The matching rejection corpus is
`fixtures/v1/invalid/provider-bootstrap-structure-crypto-v1.json`. Its schema
uses an exact ordered 51-item tuple, while matrix cases freeze 71 total
witnesses and their diagnostic boundary, stage/reason, and exact
post-attestation point/signature call counts. The manifest itself is bound by
independent raw-byte and semantic JCS digests. Every witness also carries a
closed `provider_bootstrap_invalid_recipe_v1` operation/operand tuple and an
explicit deterministic-input source: either no seed, a literal non-production
seed, or a JSON Pointer into the pinned golden resource. A cross-language
consumer can therefore reproduce each mutation from the manifest alone rather
than depending on the Node runner's source code; the prefix-mismatch signature
vector also carries its alternate root key ID as a literal recipe operand,
without hidden cross-case state. The Node reference runner
first proves each coherent-alternate or valid-under-wrong-domain precondition,
then executes the shared production diagnostics or public fail-closed
boundary. Value-returning domain derivations and deterministic fixture
comparisons are explicitly labeled `reference_oracle`, rather than being
presented as production diagnostics. The runner never treats an arbitrary
thrown message as the rejection oracle.
Packed Node and browser consumers validate the same raw manifest and generated
draft-2020-12 JSON Schema.

`StoreFilenameKeyV1` encodes the UTF-8 bytes of an already domain-validated
semantic ID. A canonical lowercase unpadded base32hex body of at most 220
characters (at most 137 UTF-8 bytes) uses the reversible `id-` branch; a
semantic ID of 138 UTF-8 bytes or more uses
`idh-<lowercase sha256(semantic-id UTF-8)>`. Hashed keys are deliberately not
decoded, and either branch must be recomputed against the trusted semantic ID
before use. The generated `short-store-filename-key-syntax` and
`store-filename-key-syntax` JSON Schemas prove only alphabet, length, branch,
and canonical unpadded-base32hex trailing-bit syntax. Full validation must
still perform fatal UTF-8 decode, exact re-encoding, canonical branch
selection, and semantic-ID recomputation; the JSON Schema documents do not
claim that authority. Root Metadata lookup exposes no arbitrary-path API: its
fixed locator derives the filename component from the exact
`rootGeneration:rootKeyId` semantic value. The short alphabet is lowercase
only, so two distinct semantic IDs cannot collapse merely because the host
filesystem compares filename case insensitively.

The retained Root Metadata validator anchors generation one exactly to the
Bootstrap Trust Bundle and requires every successor generation and predecessor
Pin to be contiguous. Planned rollover requires the new-root self-signature,
the predecessor-root cross-signature, and an exact sorted, distinct 2-of-3
recovery quorum. Compromise recovery requires the new-root self-signature and
the same recovery quorum without a predecessor cross-signature. Every active
root is strictly admitted as an Ed25519 point and may reuse neither historical
root material nor recovery material. The Bundle policy caps a retained history
at 256 generations and each canonical trust Envelope at 4 MiB.

The matching cross-language resources are
`fixtures/v1/golden/provider-registry-root-history-v1.json` and
`fixtures/v1/invalid/provider-registry-root-history-v1.json`. The golden
resource freezes bootstrap, planned-rollover, and compromise-recovery
generations, their canonical signature messages, Pins, and fixed locators. The
invalid resource freezes 31 ordered, self-contained mutation recipes together
with their exact rejection stage/reason and post-attestation crypto call
counts; the operation and seed semantics are defined in
`fixtures/v1/invalid/provider-registry-root-history-invalid-recipe-v1.md`.
The invalid resource has only `none_rejection_only` authority. Their semantic
anchors are exactly
`SHA-256(JCS(["provider-registry-root-history-golden-manifest-v1", manifest]))`
and
`SHA-256(JCS(["provider-registry-root-history-invalid-manifest-v1", manifest]))`;
both domain literals are exported so independent implementations need not infer
the preimage. `verify:provider-root-history` first checks the generators and
both raw and semantic resource anchors, then executes the valid chain and every
negative recipe. Packed Node and browser consumers verify these same resources;
the valid chain requires exactly 11 point admissions and 9 strict signatures.

These checked-in trust resources are deliberately pre-release conformance
fixtures. The standalone Bootstrap Trust Bundle's one-time signing keys were
not retained. By contrast, the Root Metadata history corpus intentionally
publishes deterministic, non-production signing seeds so independent
implementations can reproduce signatures and executable rejection recipes;
those fixture keys must never be reused or trusted outside conformance tests.
A successful Bundle validation remains `authority: "none_structure_only"`.
Successful Root Metadata history validation is limited to
`authority: "none_structure_and_history_only"`, and successful Registry
history validation to
`authority: "none_registry_structure_and_history_only"`. Successful Target
Discovery point validation is limited to
`authority: "none_target_discovery_point_structure_only"`. Successful
Conformance Result point validation is limited to
`authority: "none_real_fs_conformance_result_structure_only"`. Successful
Runtime Attestation point validation is likewise limited to
`authority: "none_provider_runtime_attestation_structure_only"`. None is
production Registry or Store I/O authority. C09-1N Distribution History
current-candidate validation is separately limited to
`authority: "none_provider_distribution_history_current_candidate_structure_only"`.
Successful C09-1O construction and validation is limited to
`authority: "none_provider_strong_ready_acceptance_candidate_structure_only"`.
It revalidates the C09-1N source, rejects non-steady routing, and requires one
and only one enabled, policy-equal, Registry/Catalog Evidence- and
runtime-exact passed strong candidate for its single target. A later Trust
Verifier slice must select from a trusted local physical-target observation;
neither a caller-authored target ID nor a provider-runtime claim is authority.
Its caller-supplied 32-byte key signs a deterministic candidate, but this slice
does not independently load or prove the immutable Installation Identity,
key-check token, or installer transaction that owns that key.
A signed-package resolver, offline production key ceremony, crash-safe
installer transaction, verified Evidence/Catalog, and current Acceptance
closure must all establish authority before any strong provider capability can
be exposed.

## Scope boundary

This package establishes the common foundation needed by AT-C21, AT-C29,
AT-C31, and AT-Q33; it does not claim those end-to-end acceptance groups are
complete. Through C09-1O this package covers signed Registry supporting
records, Entries, Manifests, retained history, local migration/tombstone
transitions, the independently signed real-filesystem Fixture Corpus to Suite
source chain, one root-bound Target Discovery point across Taxonomy,
Release Matrix, Fixture/Runner observations, Input Bundle, and Discovery
Result, one unsigned real-filesystem Conformance Result exact-cover point, and
one strict Result-to-Policy root-signed Runtime Attestation structure-only
point. It also covers dual-role Feasibility Evidence, the closed-world Target
Universe, Registry/Evidence supplied-history binding, the signed Support
Catalog, and a supplied five-chain retained Distribution History candidate
with exact retained-source accounting and tip projection. It also covers
deterministic unique active-writer derivation and a keyed strong-ready
Acceptance candidate with exact generation, content digest, token, Envelope,
and Pin checks. It does
not close signed-package provenance authority, atomic Installation Identity
persistence or key binding, Conformance Result history/current selection,
authoritative atomic Acceptance publication/enumeration/high-water/receipt,
real runner/filesystem execution, Migration Plan
equality or migration proofs, Provider runtime supervision, IPC endpoint
authentication, Provider or Store I/O, or strong-read/write authority. Those
later gates must consume these immutable records and return
`provider_unavailable` with zero writes whenever the external closure is
missing or inconsistent.
