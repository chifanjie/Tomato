# Provider Registry Root History Invalid Recipe V1

This document defines
`provider_registry_root_history_invalid_recipe_v1`. It is an executable,
cross-language mutation dialect for
`provider-registry-root-history-v1.json`; it grants no trust authority.

## Evaluation model

For each case, start from a fresh JSON deep copy of the golden manifest's
`bootstrapTrustBundle` and `rootMetadataHistory`. The candidate root object has
exactly those two fields. Apply one mutation, then validate the resulting
candidate with the golden strict-crypto capability.

`targetJsonPointer`, pointer operands, and deterministic-seed pointers use
RFC 6901 JSON Pointer escaping. Array indices are base-10 canonical indices.
Operands are ordered strings and have the operation-specific meanings below.
Implementations must reject an unknown operation, a missing pointer, an
unexpected operand count, or an unsupported seed source.

`deterministicSeed` has three exact forms:

- `{"source":"none"}`: the operation needs no new signing key.
- `{"source":"literal_non_production","seedHex":"..."}`: use the exact
  32-byte Ed25519 seed. It is test material and must never be trusted or reused.
- `{"source":"golden_json_pointer",...}`: resolve the exact seed string from
  the named golden resource and JSON Pointer.

To `reseal` an Envelope means setting its outer `rootGeneration` and
`rootKeyId` from the payload, then recomputing the full Root Metadata content
digest. Resealing does not create signatures unless the operation says so.
`resign all` means: self-sign with the golden root seed selected by payload
generation; for planned rollover, cross-sign with the predecessor generation's
golden root seed; re-sign each existing recovery signature with the golden
recovery seed whose public key derives the signature key ID; then reseal.

## Operations

| Operation | Exact mutation |
| --- | --- |
| `replace_history_with_empty` | Set `targetJsonPointer` to `[]`; operands empty; seed `none`. |
| `replace_bootstrap_active_root_and_resign_self` | In the target bootstrap Envelope, replace `payload.activeRoot` with a JSON copy of golden pointer `operands[0]`; self-sign with `deterministicSeed`; reseal. |
| `replace_number` | Set target to the base-10 number in `operands[0]`; do not reseal. |
| `replace_number_and_reseal_envelope` | Set target to the base-10 number in `operands[0]`; reseal the history Envelope selected by the target's first array index. |
| `duplicate_history_envelope` | Replace target with a JSON copy of golden pointer `operands[0]`. |
| `replace_number_and_resign_all` | Set target to the base-10 number in `operands[0]`; resign all signatures for its history Envelope. |
| `replace_string_and_resign_all` | Set target to `operands[0]`; resign all signatures for its history Envelope. |
| `flip_signature_last_bit` | Replace the final signature hex nibble with `1` when it is `0`, otherwise with `0`; reseal its Envelope. |
| `resign_with_domain` | Preserve the target signature's key ID, sign the matching self/cross/recovery wrapper using domain `operands[0]` and `deterministicSeed`, replace the target, then reseal. |
| `replace_signature_prefix_key_id` | Replace only the middle key-ID component of the three-component signature wire value with `operands[0]`; reseal. |
| `delete_property` | Delete the target property; operands empty; do not reseal. |
| `copy_property` | Set target to a JSON copy of golden pointer `operands[0]`; do not reseal. |
| `remove_array_item` | Remove one target-array item at base-10 index `operands[0]`; do not reseal. |
| `append_array_item` | Append a JSON copy of golden pointer `operands[0]` to the target array; do not reseal. |
| `resign_recovery_with_key` | Sign the target recovery slot with key ID `operands[0]` and `deterministicSeed`; reseal. |
| `reverse_array` | Reverse the target array in place; reseal its history Envelope. |
| `resign_recovery_with_literal_seed` | Derive a recovery key and key ID from the `literal_non_production` seed, sign the target recovery slot, sort all recovery signatures by UTF-8 key-ID bytes, then reseal; operands empty. |
| `replace_active_root_and_resign_self` | Replace the target Envelope's active root with a JSON copy of golden pointer `operands[0]`; self-sign with `deterministicSeed`; re-sign its existing recovery signatures from the golden recovery-seed registry; reseal. |
| `replace_active_root_from_recovery_and_resign_self` | Build a root-key record from the recovery public-key bytes at golden pointer `operands[0]`; install it as the target active root, self-sign with `deterministicSeed`, re-sign existing recovery signatures, then reseal. |
| `replace_active_root_with_small_order_point` | Build a root-key record from public-key wire value `operands[0]`, install it as the target active root, set a correctly prefixed all-zero self-signature, then reseal. |
| `replace_string` | Set target to `operands[0]`; do not reseal. |
| `replace_timestamp_with_repeated_ascii` | Set target to the character with hexadecimal code point `operands[1]`, repeated the base-10 count in `operands[0]`; do not reseal. |
| `repeat_history_envelope` | Replace target with an array of `operands[0]` JSON copies of the golden Envelope at pointer `operands[1]`. |

The invalid manifest fixes every operation, pointer, operand, seed descriptor,
expected diagnostic, and crypto call count as JSON Schema literals. A conforming
runner must execute all cases in manifest order and observe those exact results.
