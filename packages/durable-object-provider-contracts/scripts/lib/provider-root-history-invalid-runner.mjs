import {
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../../dist/jcs.js";
import {
  deriveProviderEd25519PublicKeyDigestInternalV1,
  deriveProviderRegistryRecoveryKeyIdInternalV1,
  deriveProviderRegistryRootKeyIdInternalV1,
  deriveProviderRegistryRootMetadataContentDigestV1,
} from "../../dist/provider-registry-trust.js";

const ROOT_SELF_DOMAIN =
  "provider-registry-root-self-signature-v1";
const ROOT_CROSS_DOMAIN =
  "provider-registry-root-cross-signature-v1";
const ROOT_RECOVERY_DOMAIN =
  "provider-registry-root-recovery-signature-v1";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function decodePointerToken(token) {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function pointerTokens(pointer) {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) {
    throw new TypeError("invalid JSON Pointer");
  }
  return pointer
    .slice(1)
    .split("/")
    .map(decodePointerToken);
}

function getPointer(root, pointer) {
  let current = root;
  for (const token of pointerTokens(pointer)) {
    if (
      current === null ||
      typeof current !== "object" ||
      !(token in current)
    ) {
      throw new TypeError(`missing JSON Pointer: ${pointer}`);
    }
    current = current[token];
  }
  return current;
}

function parentPointer(root, pointer) {
  const tokens = pointerTokens(pointer);
  const property = tokens.pop();
  if (property === undefined) {
    throw new TypeError("cannot mutate the JSON root");
  }
  let parent = root;
  for (const token of tokens) {
    if (
      parent === null ||
      typeof parent !== "object" ||
      !(token in parent)
    ) {
      throw new TypeError(`missing JSON Pointer: ${pointer}`);
    }
    parent = parent[token];
  }
  return { parent, property };
}

function setPointer(root, pointer, value) {
  const { parent, property } = parentPointer(root, pointer);
  parent[property] = value;
}

function deletePointer(root, pointer) {
  const { parent, property } = parentPointer(root, pointer);
  delete parent[property];
}

function deterministicKey(seedHex) {
  const seed = Buffer.from(seedHex, "hex");
  if (seed.byteLength !== 32) {
    throw new TypeError("fixture signing seed must be 32 bytes");
  }
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      seed,
    ]),
    format: "der",
    type: "pkcs8",
  });
  const spki = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  const rawPublicKey = Buffer.from(
    spki.subarray(spki.byteLength - 32),
  );
  return {
    privateKey,
    publicKeyBytes: `base64url:${rawPublicKey.toString("base64url")}`,
  };
}

function signatureHex(privateKey, message) {
  return sign(null, Buffer.from(message), privateKey).toString("hex");
}

function unsignedClaims(metadata) {
  return {
    profile: metadata.profile,
    rootGeneration: metadata.rootGeneration,
    activeRoot: metadata.activeRoot,
    issuedAt: metadata.issuedAt,
    activation: metadata.activation,
    predecessor: metadata.predecessor,
  };
}

function rootMessage(domain, keyField, keyId, metadata) {
  return canonicalizeJcsSafeIntegerUtf8V1([
    domain,
    {
      [keyField]: keyId,
      domain,
      claims: unsignedClaims(metadata),
    },
  ]);
}

function selfWire(metadata, key, domain = ROOT_SELF_DOMAIN) {
  const keyId = metadata.activeRoot.rootKeyId;
  return (
    `provider-root-self-ed25519:${keyId}:` +
    signatureHex(
      key.privateKey,
      rootMessage(domain, "rootKeyId", keyId, metadata),
    )
  );
}

function crossWire(
  metadata,
  keyId,
  key,
  domain = ROOT_CROSS_DOMAIN,
) {
  return (
    `provider-root-cross-ed25519:${keyId}:` +
    signatureHex(
      key.privateKey,
      rootMessage(domain, "rootKeyId", keyId, metadata),
    )
  );
}

function recoveryWire(
  metadata,
  keyId,
  key,
  domain = ROOT_RECOVERY_DOMAIN,
) {
  return (
    `provider-root-recovery-ed25519:${keyId}:` +
    signatureHex(
      key.privateKey,
      rootMessage(
        domain,
        "recoveryKeyId",
        keyId,
        metadata,
      ),
    )
  );
}

function resealEnvelope(envelope, options = {}) {
  if (options.closeOuter !== false) {
    envelope.rootGeneration = envelope.payload.rootGeneration;
    envelope.rootKeyId = envelope.payload.activeRoot.rootKeyId;
  }
  envelope.contentDigest =
    deriveProviderRegistryRootMetadataContentDigestV1(
      envelope.payload,
    );
}

function keyIdFromSignature(signature) {
  const components = signature.split(":");
  if (components.length !== 3 || components[1] === undefined) {
    throw new TypeError("invalid fixture signature wire");
  }
  return components[1];
}

function seedAtPointer(golden, seedDescriptor) {
  if (seedDescriptor.source === "none") return undefined;
  if (seedDescriptor.source === "literal_non_production") {
    return seedDescriptor.seedHex;
  }
  if (
    seedDescriptor.source !== "golden_json_pointer" ||
    seedDescriptor.resourcePath !==
      "fixtures/v1/golden/provider-registry-root-history-v1.json"
  ) {
    throw new TypeError("unsupported deterministic seed source");
  }
  const seed = getPointer(golden, seedDescriptor.jsonPointer);
  if (typeof seed !== "string") {
    throw new TypeError("fixture seed pointer did not resolve to a string");
  }
  return seed;
}

function seedForRootGeneration(golden, generation) {
  const field = {
    1: "bootstrapRootSeedHex",
    2: "plannedRootSeedHex",
    3: "compromiseRootSeedHex",
  }[generation];
  if (field === undefined) {
    throw new TypeError("fixture has no root seed for generation");
  }
  return golden.deterministicSeeds[field];
}

function recoverySeedByKeyId(golden, keyId) {
  const records =
    golden.bootstrapTrustBundle.providerRegistryRecoveryKeys;
  const recordIndex = records.findIndex(
    (record) => record.recoveryKeyId === keyId,
  );
  if (recordIndex < 0) return undefined;
  const targetPublicKey = records[recordIndex].publicKeyBytes;
  for (
    let seedIndex = 0;
    seedIndex <
    golden.deterministicSeeds.recoverySeedHexes.length;
    seedIndex += 1
  ) {
    const seed =
      golden.deterministicSeeds.recoverySeedHexes[seedIndex];
    if (
      deterministicKey(seed).publicKeyBytes === targetPublicKey
    ) {
      return seed;
    }
  }
  throw new TypeError("fixture recovery seed closure mismatch");
}

function resignAll(golden, envelope) {
  const metadata = envelope.payload;
  metadata.selfSignature = selfWire(
    metadata,
    deterministicKey(
      seedForRootGeneration(golden, metadata.rootGeneration),
    ),
  );
  if (metadata.activation === "planned_rollover") {
    const predecessorGeneration =
      metadata.predecessor.rootGeneration;
    const predecessorKey = deterministicKey(
      seedForRootGeneration(golden, predecessorGeneration),
    );
    metadata.predecessorCrossSignature = crossWire(
      metadata,
      metadata.predecessor.rootKeyId,
      predecessorKey,
    );
  }
  if (metadata.activation !== "bootstrap") {
    metadata.recoverySignatures =
      metadata.recoverySignatures.map((signature) => {
        const keyId = keyIdFromSignature(signature);
        const seed = recoverySeedByKeyId(golden, keyId);
        if (seed === undefined) {
          throw new TypeError(
            "cannot resign an unknown recovery fixture key",
          );
        }
        return recoveryWire(
          metadata,
          keyId,
          deterministicKey(seed),
        );
      });
  }
  resealEnvelope(envelope);
}

function rootRecordForPublicKeyBytes(publicKeyBytes) {
  return {
    profile: "provider_registry_root_public_key_v1",
    rootKeyId: deriveProviderRegistryRootKeyIdInternalV1({
      publicKeyBytes,
    }),
    algorithm: "ed25519",
    publicKeyBytes,
    publicKeyDigest:
      deriveProviderEd25519PublicKeyDigestInternalV1(
        publicKeyBytes,
      ),
  };
}

function mutationSeed(golden, recipe) {
  const seed = seedAtPointer(golden, recipe.deterministicSeed);
  return seed === undefined ? undefined : deterministicKey(seed);
}

function mutateSignatureBit(signature) {
  return `${signature.slice(0, -1)}${
    signature.endsWith("0") ? "1" : "0"
  }`;
}

function replaceSignaturePrefix(signature, replacementKeyId) {
  const parts = signature.split(":");
  if (parts.length !== 3) {
    throw new TypeError("invalid fixture signature");
  }
  return `${parts[0]}:${replacementKeyId}:${parts[2]}`;
}

function applyRecipe(golden, candidate, recipe) {
  const target = recipe.targetJsonPointer;
  const operands = recipe.operands;
  switch (recipe.operation) {
    case "replace_history_with_empty": {
      setPointer(candidate, target, []);
      break;
    }
    case "replace_bootstrap_active_root_and_resign_self": {
      const replacementKey = mutationSeed(golden, recipe);
      if (replacementKey === undefined) {
        throw new TypeError(
          "bootstrap substitution recipe lacks its signer",
        );
      }
      const envelope = getPointer(candidate, target);
      envelope.payload.activeRoot = cloneJson(
        getPointer(golden, operands[0]),
      );
      envelope.payload.selfSignature = selfWire(
        envelope.payload,
        replacementKey,
      );
      resealEnvelope(envelope);
      break;
    }
    case "replace_number": {
      setPointer(candidate, target, Number(operands[0]));
      break;
    }
    case "replace_number_and_reseal_envelope": {
      setPointer(candidate, target, Number(operands[0]));
      const envelopeIndex = Number(pointerTokens(target)[1]);
      resealEnvelope(candidate.rootMetadataHistory[envelopeIndex]);
      break;
    }
    case "duplicate_history_envelope": {
      setPointer(
        candidate,
        target,
        cloneJson(getPointer(golden, operands[0])),
      );
      break;
    }
    case "replace_number_and_resign_all": {
      setPointer(candidate, target, Number(operands[0]));
      const envelopeIndex = Number(pointerTokens(target)[1]);
      resignAll(
        golden,
        candidate.rootMetadataHistory[envelopeIndex],
      );
      break;
    }
    case "replace_string_and_resign_all": {
      setPointer(candidate, target, operands[0]);
      const envelopeIndex = Number(pointerTokens(target)[1]);
      resignAll(
        golden,
        candidate.rootMetadataHistory[envelopeIndex],
      );
      break;
    }
    case "flip_signature_last_bit": {
      setPointer(
        candidate,
        target,
        mutateSignatureBit(getPointer(candidate, target)),
      );
      const envelopeIndex = Number(pointerTokens(target)[1]);
      resealEnvelope(candidate.rootMetadataHistory[envelopeIndex]);
      break;
    }
    case "resign_with_domain": {
      const key = mutationSeed(golden, recipe);
      if (key === undefined) {
        throw new TypeError("wrong-domain recipe lacks its signer");
      }
      const tokens = pointerTokens(target);
      const envelope = candidate.rootMetadataHistory[Number(tokens[1])];
      const oldWire = getPointer(candidate, target);
      const keyId = keyIdFromSignature(oldWire);
      const alternateDomain = operands[0];
      let wire;
      if (target.endsWith("/selfSignature")) {
        wire = selfWire(envelope.payload, key, alternateDomain);
      } else if (
        target.endsWith("/predecessorCrossSignature")
      ) {
        wire = crossWire(
          envelope.payload,
          keyId,
          key,
          alternateDomain,
        );
      } else {
        wire = recoveryWire(
          envelope.payload,
          keyId,
          key,
          alternateDomain,
        );
      }
      setPointer(candidate, target, wire);
      resealEnvelope(envelope);
      break;
    }
    case "replace_signature_prefix_key_id": {
      setPointer(
        candidate,
        target,
        replaceSignaturePrefix(
          getPointer(candidate, target),
          operands[0],
        ),
      );
      const envelopeIndex = Number(pointerTokens(target)[1]);
      resealEnvelope(candidate.rootMetadataHistory[envelopeIndex]);
      break;
    }
    case "delete_property": {
      deletePointer(candidate, target);
      break;
    }
    case "copy_property": {
      setPointer(
        candidate,
        target,
        cloneJson(getPointer(golden, operands[0])),
      );
      break;
    }
    case "remove_array_item": {
      getPointer(candidate, target).splice(Number(operands[0]), 1);
      break;
    }
    case "append_array_item": {
      getPointer(candidate, target).push(
        cloneJson(getPointer(golden, operands[0])),
      );
      break;
    }
    case "resign_recovery_with_key": {
      const key = mutationSeed(golden, recipe);
      if (key === undefined) {
        throw new TypeError("recovery signer recipe lacks its seed");
      }
      const envelopeIndex = Number(pointerTokens(target)[1]);
      const envelope = candidate.rootMetadataHistory[envelopeIndex];
      const keyId = operands[0];
      setPointer(
        candidate,
        target,
        recoveryWire(envelope.payload, keyId, key),
      );
      resealEnvelope(envelope);
      break;
    }
    case "reverse_array": {
      getPointer(candidate, target).reverse();
      const envelopeIndex = Number(pointerTokens(target)[1]);
      resealEnvelope(candidate.rootMetadataHistory[envelopeIndex]);
      break;
    }
    case "resign_recovery_with_literal_seed": {
      const key = mutationSeed(golden, recipe);
      if (key === undefined) {
        throw new TypeError(
          "literal recovery signer recipe lacks its seed",
        );
      }
      const keyId = deriveProviderRegistryRecoveryKeyIdInternalV1({
        publicKeyBytes: key.publicKeyBytes,
      });
      const envelopeIndex = Number(pointerTokens(target)[1]);
      const envelope = candidate.rootMetadataHistory[envelopeIndex];
      setPointer(
        candidate,
        target,
        recoveryWire(envelope.payload, keyId, key),
      );
      envelope.payload.recoverySignatures.sort((left, right) =>
        Buffer.from(keyIdFromSignature(left), "utf8").compare(
          Buffer.from(keyIdFromSignature(right), "utf8"),
        ),
      );
      resealEnvelope(envelope);
      break;
    }
    case "replace_active_root_and_resign_self": {
      const envelopeIndex = Number(pointerTokens(target)[1]);
      const envelope = candidate.rootMetadataHistory[envelopeIndex];
      envelope.payload.activeRoot = cloneJson(
        getPointer(golden, operands[0]),
      );
      const key = mutationSeed(golden, recipe);
      if (key === undefined) {
        throw new TypeError("root alias recipe lacks its seed");
      }
      envelope.payload.selfSignature = selfWire(
        envelope.payload,
        key,
      );
      if (envelope.payload.activation !== "bootstrap") {
        envelope.payload.recoverySignatures =
          envelope.payload.recoverySignatures.map((signature) => {
            const keyId = keyIdFromSignature(signature);
            return recoveryWire(
              envelope.payload,
              keyId,
              deterministicKey(
                recoverySeedByKeyId(golden, keyId),
              ),
            );
          });
      }
      resealEnvelope(envelope);
      break;
    }
    case "replace_active_root_from_recovery_and_resign_self": {
      const envelopeIndex = Number(pointerTokens(target)[1]);
      const envelope = candidate.rootMetadataHistory[envelopeIndex];
      const recoveryRecord = getPointer(golden, operands[0]);
      envelope.payload.activeRoot =
        rootRecordForPublicKeyBytes(recoveryRecord.publicKeyBytes);
      const key = mutationSeed(golden, recipe);
      if (key === undefined) {
        throw new TypeError("recovery alias recipe lacks its seed");
      }
      envelope.payload.selfSignature = selfWire(
        envelope.payload,
        key,
      );
      envelope.payload.recoverySignatures =
        envelope.payload.recoverySignatures.map((signature) => {
          const keyId = keyIdFromSignature(signature);
          return recoveryWire(
            envelope.payload,
            keyId,
            deterministicKey(recoverySeedByKeyId(golden, keyId)),
          );
        });
      resealEnvelope(envelope);
      break;
    }
    case "replace_active_root_with_small_order_point": {
      const envelopeIndex = Number(pointerTokens(target)[1]);
      const envelope = candidate.rootMetadataHistory[envelopeIndex];
      const publicKeyBytes = operands[0];
      envelope.payload.activeRoot =
        rootRecordForPublicKeyBytes(publicKeyBytes);
      envelope.payload.selfSignature =
        `provider-root-self-ed25519:${envelope.payload.activeRoot.rootKeyId}:${"0".repeat(128)}`;
      resealEnvelope(envelope);
      break;
    }
    case "replace_string": {
      setPointer(candidate, target, operands[0]);
      break;
    }
    case "replace_timestamp_with_repeated_ascii": {
      setPointer(
        candidate,
        target,
        String.fromCharCode(Number.parseInt(operands[1], 16)).repeat(
          Number(operands[0]),
        ),
      );
      break;
    }
    case "repeat_history_envelope": {
      const count = Number(operands[0]);
      const envelope = cloneJson(getPointer(golden, operands[1]));
      setPointer(
        candidate,
        target,
        Array.from({ length: count }, () => cloneJson(envelope)),
      );
      break;
    }
    default:
      throw new TypeError(
        `unsupported root history mutation: ${recipe.operation}`,
      );
  }
}

export function materializeProviderRootHistoryInvalidCandidateV1(
  goldenManifest,
  invalidCase,
) {
  const candidate = {
    bootstrapTrustBundle: cloneJson(
      goldenManifest.bootstrapTrustBundle,
    ),
    rootMetadataHistory: cloneJson(
      goldenManifest.rootMetadataHistory,
    ),
  };
  applyRecipe(
    goldenManifest,
    candidate,
    invalidCase.mutation,
  );
  return candidate;
}
