import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Ajv2020 } from "ajv/dist/2020.js";
import { beforeEach, describe, expect, it } from "vitest";

import { generateProviderContractJsonSchemasV1 } from "../src/json-schema.js";
import {
  PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_AGGREGATE_SEMANTIC_DIGEST_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_SEMANTIC_DOMAIN_V1,
  ProviderRegistryEvidenceBindingTopologyProofError,
  ProviderRegistryEvidenceBindingTopologyProofV1Schema,
  verifyProviderRegistryEvidenceBindingTopologyProofResourceV1,
} from "../src/provider-registry-evidence-binding-topology-proof.js";
// @ts-expect-error Package-internal proof generator helpers intentionally have no declaration output.
import * as topologyProofHelpers from "../scripts/lib/provider-registry-evidence-binding-topology-proof.mjs";

const {
  analyzeJsonSchemaFiniteObjectiveV1,
  analyzeJsonSchemaTopologyV1,
  PARSER_RUNTIME_WORKER_PROFILE_V1,
  PARSER_RUNTIME_WORKER_TIMEOUT_MS_V1,
  assertGeneratedSchemaInventoryFreshV1,
  assertProductionParserAstBindingsV1,
  assertRawAdmissionAccountingAstV1,
  assertRepeatableArraySchemaPathV1,
  boundSharedFiniteObjectiveV1,
  domainSemanticDigestV1,
  exerciseParserRuntimeWorkerTimeoutForTestV1,
  generateProviderRegistryEvidenceBindingTopologyProofV1,
  parseProductionParserRuntimeWorkerResultV1,
  precomputeProviderRegistryEvidenceBindingParserRuntimeTraceTokenV1,
  semanticDigestV1,
  traceProductionParserBindingsV1,
  traceRawAdmissionAccountingV1,
} = topologyProofHelpers;

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const resourcePath = resolve(
  packageRoot,
  PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_PATH_V1,
);
const generatorPath = resolve(
  packageRoot,
  "scripts/generate-provider-registry-evidence-binding-topology-proof.mjs",
);
const rawResource = readFileSync(resourcePath);
const proof = ProviderRegistryEvidenceBindingTopologyProofV1Schema.parse(
  JSON.parse(rawResource.toString("utf8")),
);
const generatedSchemas = generateProviderContractJsonSchemasV1();
const parserRuntimeTraceTestTimeoutMilliseconds =
  PARSER_RUNTIME_WORKER_TIMEOUT_MS_V1 * 2 + 30_000;
// The standalone check runs two parser-runtime workers in sequence. Reuse their
// aggregate authoritative budget, including bounded process-startup headroom,
// so the outer process cannot preempt the second worker on slower CI runners.
const standaloneGeneratorDeadlineMilliseconds =
  parserRuntimeTraceTestTimeoutMilliseconds;
const standaloneGeneratorCleanupFallbackMilliseconds =
  standaloneGeneratorDeadlineMilliseconds + 10_000;
const standaloneGeneratorTestTimeoutMilliseconds =
  standaloneGeneratorCleanupFallbackMilliseconds + 5_000;
const standaloneGeneratorOutputByteLimit = 1024 * 1024;

function sha256Hex(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function leastPowerOfTwoAtLeast(value: number): number {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

function valueAtJsonPointer(root: unknown, pointer: string): unknown {
  let current = root;
  for (const encoded of pointer.slice(1).split("/")) {
    const key = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
    if (current === null || typeof current !== "object") {
      throw new TypeError(`invalid witness JSON pointer ${pointer}`);
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function replaceAtJsonPointer(
  root: unknown,
  pointer: string,
  replacement: unknown,
): void {
  const encodedParts = pointer.slice(1).split("/");
  const finalEncoded = encodedParts.pop();
  if (finalEncoded === undefined) throw new TypeError("empty witness pointer");
  let parent = root;
  for (const encoded of encodedParts) {
    const key = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
    if (parent === null || typeof parent !== "object") {
      throw new TypeError(`invalid witness JSON pointer ${pointer}`);
    }
    parent = (parent as Record<string, unknown>)[key];
  }
  if (parent === null || typeof parent !== "object") {
    throw new TypeError(`invalid witness JSON pointer ${pointer}`);
  }
  const finalKey = finalEncoded.replaceAll("~1", "/").replaceAll("~0", "~");
  (parent as Record<string, unknown>)[finalKey] = replacement;
}

function materializeCanonicalArray(
  exemplarCanonicalJson: string,
  additionalItems: number,
): unknown[] {
  return JSON.parse(
    `[${exemplarCanonicalJson}${`,${exemplarCanonicalJson}`.repeat(additionalItems)}]`,
  ) as unknown[];
}

function measureTopology(value: unknown): {
  identities: number;
  ownKeys: number;
  denseIndices: number;
} {
  if (value === null || typeof value !== "object") {
    return { identities: 0, ownKeys: 0, denseIndices: 0 };
  }
  if (Array.isArray(value)) {
    return value.reduce(
      (total, child) => {
        const measured = measureTopology(child);
        return {
          identities: total.identities + measured.identities,
          ownKeys: total.ownKeys + measured.ownKeys,
          denseIndices: total.denseIndices + measured.denseIndices,
        };
      },
      {
        identities: 1,
        ownKeys: value.length + 1,
        denseIndices: value.length,
      },
    );
  }
  return Object.values(value).reduce(
    (total, child) => {
      const measured = measureTopology(child);
      return {
        identities: total.identities + measured.identities,
        ownKeys: total.ownKeys + measured.ownKeys,
        denseIndices: total.denseIndices + measured.denseIndices,
      };
    },
    {
      identities: 1,
      ownKeys: Object.keys(value).length,
      denseIndices: 0,
    },
  );
}

function runStandaloneTopologyProofCheck(): Promise<string> {
  return new Promise((resolveCheck, rejectCheck) => {
    const child = spawn(
      process.execPath,
      [generatorPath, "--check"],
      {
        cwd: packageRoot,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    let outputByteLength = 0;
    let outputLimitExceeded = false;
    let timedOut = false;
    let settled = false;
    let spawnError: Error | undefined;
    let hardDeadline: ReturnType<typeof setTimeout> | undefined;
    let cleanupFallback: ReturnType<typeof setTimeout> | undefined;

    const clearRunnerTimers = (): void => {
      if (hardDeadline !== undefined) clearTimeout(hardDeadline);
      if (cleanupFallback !== undefined) clearTimeout(cleanupFallback);
    };
    const settleRejected = (error: Error): void => {
      if (settled) return;
      settled = true;
      clearRunnerTimers();
      rejectCheck(error);
    };
    const settleResolved = (value: string): void => {
      if (settled) return;
      settled = true;
      clearRunnerTimers();
      resolveCheck(value);
    };

    const terminateProcessTree = (): void => {
      if (process.platform !== "win32" && child.pid !== undefined) {
        try {
          process.kill(-child.pid, "SIGKILL");
          return;
        } catch {
          // Fall through to the cross-platform direct-child fallback.
        }
      }
      try {
        child.kill("SIGKILL");
      } catch {
        // A concurrent close is handled by the authoritative close listener.
      }
    };
    const appendOutput = (
      stream: "stdout" | "stderr",
      chunk: Buffer,
    ): void => {
      outputByteLength += chunk.byteLength;
      if (outputByteLength > standaloneGeneratorOutputByteLimit) {
        outputLimitExceeded = true;
        terminateProcessTree();
        return;
      }
      if (stream === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };

    child.stdout.on("data", (chunk: Buffer) => appendOutput("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => appendOutput("stderr", chunk));
    child.once("error", (error) => {
      spawnError = error;
    });
    hardDeadline = setTimeout(() => {
      timedOut = true;
      terminateProcessTree();
    }, standaloneGeneratorDeadlineMilliseconds);
    cleanupFallback = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      terminateProcessTree();
      child.stdout.removeAllListeners("data");
      child.stderr.removeAllListeners("data");
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      setImmediate(() => {
        if (settled) return;
        settleRejected(
          spawnError ??
            new Error(
              `standalone topology proof check did not close within ${standaloneGeneratorCleanupFallbackMilliseconds}ms`,
            ),
        );
      });
    }, standaloneGeneratorCleanupFallbackMilliseconds);
    child.once("close", (code, signal) => {
      if (settled) return;
      if (spawnError !== undefined) {
        settleRejected(spawnError);
        return;
      }
      if (timedOut) {
        settleRejected(
          new Error(
            `standalone topology proof check exceeded ${standaloneGeneratorDeadlineMilliseconds}ms`,
          ),
        );
        return;
      }
      if (outputLimitExceeded) {
        settleRejected(
          new Error(
            `standalone topology proof check exceeded ${standaloneGeneratorOutputByteLimit} output bytes`,
          ),
        );
        return;
      }
      if (code !== 0) {
        settleRejected(
          new Error(
            `standalone topology proof check exited code=${String(code)} signal=${String(signal)} stderr=${stderr.slice(0, 4_096)}`,
          ),
        );
        return;
      }
      settleResolved(stdout);
    });
  });
}

describe("provider Registry evidence-binding topology proof", () => {
  beforeEach(async () => {
    await new Promise<void>((resolveYield) => setImmediate(resolveYield));
  });

  it("pins raw bytes, strict structure, semantic digest, and generated schema sources", () => {
    const verified =
      verifyProviderRegistryEvidenceBindingTopologyProofResourceV1(
        new Uint8Array(rawResource),
      );
    expect(verified).toEqual(proof);
    expect(Object.isFrozen(verified)).toBe(true);
    expect(Object.isFrozen(verified.capAssessment)).toBe(true);

    const changedBytes = new Uint8Array(rawResource);
    const changedByteIndex = changedBytes.byteLength - 2;
    changedBytes[changedByteIndex] = changedBytes[changedByteIndex]! ^ 1;
    expect(() =>
      verifyProviderRegistryEvidenceBindingTopologyProofResourceV1(
        changedBytes,
      ),
    ).toThrow(ProviderRegistryEvidenceBindingTopologyProofError);

    expect(rawResource.byteLength).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_BYTE_LENGTH_V1,
    );
    expect(sha256Hex(rawResource)).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_RESOURCE_SHA256_HEX_V1,
    );
    expect(proof.aggregateSemanticDigest).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_AGGREGATE_SEMANTIC_DIGEST_V1,
    );

    const { aggregateSemanticDigest: omittedDigest, ...withoutDigest } = proof;
    expect(omittedDigest).toBe(
      PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_AGGREGATE_SEMANTIC_DIGEST_V1,
    );
    expect(
      domainSemanticDigestV1(
        PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_SEMANTIC_DOMAIN_V1,
        withoutDigest,
      ),
    ).toBe(omittedDigest);

    const topLevelExtra = structuredClone(proof) as Record<string, unknown>;
    topLevelExtra.unexpected = true;
    expect(
      ProviderRegistryEvidenceBindingTopologyProofV1Schema.safeParse(
        topLevelExtra,
      ).success,
    ).toBe(false);

    const nestedExtra = structuredClone(proof) as unknown as {
      limits: Record<string, unknown>;
    };
    nestedExtra.limits.unexpected = true;
    expect(
      ProviderRegistryEvidenceBindingTopologyProofV1Schema.safeParse(
        nestedExtra,
      ).success,
    ).toBe(false);

    const bindingTamper = structuredClone(proof) as unknown as {
      productionParserBindings: Array<{ zodSchemaSymbol: string }>;
    };
    bindingTamper.productionParserBindings[0]!.zodSchemaSymbol =
      "UnrelatedSchema";
    expect(
      ProviderRegistryEvidenceBindingTopologyProofV1Schema.safeParse(
        bindingTamper,
      ).success,
    ).toBe(false);
  }, 30_000);

  it("anchors every JSON branch to a reachable production AST callsite and exact fresh-emit runtime hit", async () => {
    expect(proof.productionParserBindings).toHaveLength(21);
    expect(proof.productionParserBindings.map(({ branch }) => branch)).toEqual(
      proof.jsonBranchKeys,
    );
    expect(
      proof.productionParserBindings.map(({ schemaName }) => schemaName),
    ).toEqual(proof.schemaSources.map(({ schemaName }) => schemaName));
    for (const binding of proof.productionParserBindings) {
      const source = readFileSync(resolve(packageRoot, binding.parserSourcePath));
      expect(`sha256:${sha256Hex(source)}`).toBe(
        binding.parserSourceRawSha256,
      );
      expect(binding.parserAst.astReachable).toBe(true);
      expect(binding.parserAst.runtimeSchemaExportResolved).toBe(true);
      expect(binding.parserAst.astCallChain[0]).toBe(
        "src/provider-registry-evidence-binding-point.ts#validateProviderRegistryEvidenceBindingPointClosureV1",
      );
      expect(binding.runtimeTrace.hitRequiredParser).toBe(true);
      expect(binding.runtimeTrace[binding.runtimeTrace.requiredMethod === "parse" ? "parseHits" : "safeParseHits"]).toBeGreaterThan(0);
      expect(binding.runtimeTrace.schemaMethodHitAuthority).toBe(
        "auxiliary_non_authority",
      );
      expect(binding.runtimeTrace.hitExactCallsite).toBe(true);
      expect(binding.runtimeTrace.exactCallsiteHits).toBeGreaterThan(0);
      expect(binding.runtimeTrace.exactCallsiteId).toContain(
        `exact_ast_callsite_v1:${binding.branch}:sha256:`,
      );
    }
    const freshAst = assertProductionParserAstBindingsV1({ packageRoot });
    expect(freshAst).toEqual(
      proof.productionParserBindings.map(({ branch, parserAst }) => ({
        branch,
        ...parserAst,
      })),
    );
    expect(semanticDigestV1(proof.productionParserBindings)).toBe(
      proof.sourceAnchors.productionParserBindingSemanticDigest,
    );
    const compatibleBaseBytes = readFileSync(
      resolve(packageRoot, proof.sourceAnchors.compatibleBaseResourcePath),
    );
    expect(`sha256:${sha256Hex(compatibleBaseBytes)}`).toBe(
      proof.sourceAnchors.compatibleBaseResourceRawSha256,
    );
    const compatibleBase = (
      JSON.parse(compatibleBaseBytes.toString("utf8")) as {
        compatibleBase: object;
      }
    ).compatibleBase;
    const runtimeTrace = await traceProductionParserBindingsV1({
      packageRoot,
      compatibleBase,
    });
    expect(runtimeTrace).toMatchObject({
      profile: proof.sourceAnchors.productionParserRuntimeTraceProfile,
      instrumentation:
        proof.sourceAnchors.productionParserRuntimeTraceInstrumentation,
      entryExport:
        proof.sourceAnchors.productionParserRuntimeTraceEntryExport,
    });
    expect(runtimeTrace.compatibleBaseAccepted).toBe(true);
    expect(runtimeTrace).toMatchObject({
      uninstrumentedFreshEmitCompatibleBaseAccepted: true,
      instrumentedFreshEmitCompatibleBaseAccepted: true,
      successProjectionFieldCount: 10,
      successProjectionsEquivalent: true,
      uninstrumentedCryptoClosure: {
        pointAdmissionCount: 24,
        signatureVerificationCount: 46,
      },
      instrumentedCryptoClosure: {
        pointAdmissionCount: 24,
        signatureVerificationCount: 46,
      },
      exactAstBindingCount: 21,
      schemaTableConsumerCount: 1,
      hookLifecycle: {
        randomizedNonceGlobalOwnProperty: true,
        nonEnumerable: true,
        configurableForCleanup: true,
        frozenHookValue: true,
        residualPropertyAfterCleanup: false,
      },
    });
    expect({
      uninstrumentedFreshEmitCompatibleBaseAccepted:
        runtimeTrace.uninstrumentedFreshEmitCompatibleBaseAccepted,
      instrumentedFreshEmitCompatibleBaseAccepted:
        runtimeTrace.instrumentedFreshEmitCompatibleBaseAccepted,
      successProjectionFieldCount: runtimeTrace.successProjectionFieldCount,
      successProjectionsEquivalent:
        runtimeTrace.successProjectionsEquivalent,
      successProjectionSemanticDigest:
        runtimeTrace.successProjectionSemanticDigest,
      uninstrumentedCryptoClosure:
        runtimeTrace.uninstrumentedCryptoClosure,
      instrumentedCryptoClosure: runtimeTrace.instrumentedCryptoClosure,
      exactAstBindingCount: runtimeTrace.exactAstBindingCount,
      schemaTableConsumerCount: runtimeTrace.schemaTableConsumerCount,
      hookLifecycle: runtimeTrace.hookLifecycle,
    }).toEqual(proof.sourceAnchors.productionParserRuntimeTraceSummary);
    expect(runtimeTrace.semanticDigest).toBe(
      proof.sourceAnchors.productionParserRuntimeTraceSemanticDigest,
    );
    expect(
      runtimeTrace.rows.map(
        ({
          branch,
          requiredMethod,
          parseHits,
          safeParseHits,
          hitRequiredParser,
          schemaMethodHitAuthority,
          exactCallsiteId,
          exactCallsiteHits,
          hitExactCallsite,
        }: {
          branch: string;
          requiredMethod: string;
          parseHits: number;
          safeParseHits: number;
          hitRequiredParser: boolean;
          schemaMethodHitAuthority: string;
          exactCallsiteId: string;
          exactCallsiteHits: number;
          hitExactCallsite: boolean;
        }) => ({
          branch,
          requiredMethod,
          parseHits,
          safeParseHits,
          hitRequiredParser,
          schemaMethodHitAuthority,
          exactCallsiteId,
          exactCallsiteHits,
          hitExactCallsite,
        }),
      ),
    ).toEqual(
      proof.productionParserBindings.map(({ branch, runtimeTrace: row }) => ({
        branch,
        ...row,
      })),
    );
  }, 60_000);

  describe("literal, optional-chain, and abrupt-control-flow parser matrix", () => {
    const sourcePath = "src/provider-registry-evidence-binding-point.ts";
    const source = readFileSync(resolve(packageRoot, sourcePath), "utf8");
    const activeRootCall =
      "ProviderRegistryRootPublicKeyV1Schema.safeParse(fields.activeRoot)";
    const activeRootFallback = "({ success: true } as const)";
    const insertionAnchor =
      "  if (\n    retainedRootEnvelope === undefined ||";
    const assertRejected = (label: string, mutatedSource: string): void => {
      expect(mutatedSource, label).not.toBe(source);
      expect(() =>
        assertProductionParserAstBindingsV1({
          packageRoot,
          sourceOverrides: { [sourcePath]: mutatedSource },
        }),
      ).toThrow(/parser AST callsite/u);
    };
    const assertAccepted = (label: string, mutatedSource: string): void => {
      expect(mutatedSource, label).not.toBe(source);
      expect(
        assertProductionParserAstBindingsV1({
          packageRoot,
          sourceOverrides: { [sourcePath]: mutatedSource },
        }),
      ).toHaveLength(21);
    };
    const replaceCall = (replacement: string): string =>
      source.replace(activeRootCall, replacement);
    const injectOnlyCandidate = (statement: string): string =>
      replaceCall(activeRootFallback).replace(
        insertionAnchor,
        `${statement}\n${insertionAnchor}`,
      );

    const deadExpressionCases = [
      ["0 &&", `((0 && ${activeRootCall}) || ${activeRootFallback})`],
      ["-0 &&", `((-0 && ${activeRootCall}) || ${activeRootFallback})`],
      ["+0 &&", `((+0 && ${activeRootCall}) || ${activeRootFallback})`],
      ["0n &&", `((0n && ${activeRootCall}) || ${activeRootFallback})`],
      ["empty string &&", `(("" && ${activeRootCall}) || ${activeRootFallback})`],
      ["empty template &&", "((`` && " + activeRootCall + ") || " + activeRootFallback + ")"],
      ["1 ||", `((1 || ${activeRootCall}) && ${activeRootFallback})`],
      ["1n ||", `((1n || ${activeRootCall}) && ${activeRootFallback})`],
      ["nonempty string ||", `(("x" || ${activeRootCall}) && ${activeRootFallback})`],
      ["nonempty template ||", "((`x` || " + activeRootCall + ") && " + activeRootFallback + ")"],
      ["true conditional false arm", `(true ? ${activeRootFallback} : ${activeRootCall})`],
      ["false conditional true arm", `(false ? ${activeRootCall} : ${activeRootFallback})`],
      ["0 ??", `((0 ?? ${activeRootCall}) || ${activeRootFallback})`],
      ["empty string ??", `(("" ?? ${activeRootCall}) || ${activeRootFallback})`],
      ["false ??", `((false ?? ${activeRootCall}) || ${activeRootFallback})`],
      ["!true &&", `((!true && ${activeRootCall}) || ${activeRootFallback})`],
      ["!false ||", `((!false || ${activeRootCall}) && ${activeRootFallback})`],
    ] as const;

    const deadStatementCases = [
      ["if(0)", `  if (0) { ${activeRootCall}; }`, false],
      ["while(0)", `  while (0) { ${activeRootCall}; }`, false],
      ["for(;0;)", `  for (; 0; ) { ${activeRootCall}; }`, false],
      [
        "sequential abrupt block",
        "  { return fields.activeRoot as ProviderRegistryRootPublicKeyV1; void 0; }",
        true,
      ],
      [
        "abrupt try",
        "  try { return fields.activeRoot as ProviderRegistryRootPublicKeyV1; } finally {}",
        true,
      ],
      [
        "abrupt finally",
        "  try {} finally { return fields.activeRoot as ProviderRegistryRootPublicKeyV1; }",
        true,
      ],
    ] as const;

    const liveExpressionCases = [
      ["1 &&", `((1 && ${activeRootCall}) || ${activeRootFallback})`],
      ["0 ||", `((0 || ${activeRootCall}) || ${activeRootFallback})`],
      ["true conditional live arm", `(true ? ${activeRootCall} : ${activeRootFallback})`],
      ["null ??", `((null ?? ${activeRootCall}) || ${activeRootFallback})`],
      ["void 0 ??", `((void 0 ?? ${activeRootCall}) || ${activeRootFallback})`],
    ] as const;

    it("anchors the parser source mutation points", () => {
      expect(source).toContain(activeRootCall);
      expect(source).toContain(insertionAnchor);
    });

    it("rejects a comment-only parser callsite", () => {
      const commentOnly = source.replace(
        activeRootCall,
        `/* ${activeRootCall} */ ({ success: true })`,
      );
      expect(commentOnly).toContain(activeRootCall);
      assertRejected("comment-only", commentOnly);
    }, 30_000);

    it.each(deadExpressionCases)(
      "rejects dead expression %s",
      (label, expression) => {
        assertRejected(label, replaceCall(expression));
      },
      30_000,
    );

    it.each(deadStatementCases)(
      "rejects dead statement %s",
      (label, statement, insertDirectly) => {
        const mutated = insertDirectly
          ? source.replace(insertionAnchor, `${statement}\n${insertionAnchor}`)
          : injectOnlyCandidate(statement);
        assertRejected(label, mutated);
      },
      30_000,
    );

    it("rejects a labeled-break-only parser callsite", () => {
      assertRejected(
        "labeled break",
        injectOnlyCandidate(
          `  parserTraceLabel: { break parserTraceLabel; ${activeRootCall}; }`,
        ),
      );
    }, 30_000);

    it("rejects an optional parser callsite", () => {
      assertRejected(
        "optional callsite",
        replaceCall(
          "ProviderRegistryRootPublicKeyV1Schema.safeParse?.(fields.activeRoot)",
        ),
      );
    }, 30_000);

    it.each(liveExpressionCases)(
      "accepts live expression %s",
      (label, expression) => {
        assertAccepted(label, replaceCall(expression));
      },
      30_000,
    );

    it("rejects a swapped parser schema", () => {
      const swappedSchema = source.replace(
        activeRootCall,
        "ProviderRegistryRootMetadataPinV1Schema.safeParse(fields.activeRoot)",
      );
      assertRejected("swapped schema", swappedSchema);
    }, 30_000);
  });

  const conditionalAliasSourcePath =
    "src/provider-runtime-attestation-point-internal.ts";
  const conditionalAliasSource = readFileSync(
    resolve(packageRoot, conditionalAliasSourcePath),
    "utf8",
  );
  const conditionalAliasBridgeCall =
    "    diagnostic = await preparedRuntimeCoreV1(input, context);";
  const withConditionalAlias = (condition: string): string =>
    conditionalAliasSource.replace(
      conditionalAliasBridgeCall,
      [
        "    const observedPreparedCoreV1 = () => {",
        "      throw new CapturedTypeErrorV1(\"observed-only core\");",
        "    };",
        `    const selectedPreparedCoreV1 = ${condition}`,
        "      ? observedPreparedCoreV1",
        "      : preparedRuntimeCoreV1;",
        "    diagnostic = await selectedPreparedCoreV1(input, context);",
      ].join("\n"),
    );
  const deadConditionalAliasBridge = conditionalAliasSource.replace(
    conditionalAliasBridgeCall,
    [
      "    0 && preparedRuntimeCoreV1(input, context);",
      "    throw new CapturedTypeErrorV1(\"dead prepared bridge\");",
    ].join("\n"),
  );

  it.each([
    [
      "keeps a dynamic conditional alias",
      withConditionalAlias("Boolean(input)"),
      false,
    ],
    ["keeps a false constant alias", withConditionalAlias("false"), false],
    [
      "rejects a true constant observed alias",
      withConditionalAlias("true"),
      true,
    ],
    [
      "rejects a constant-dead registration bridge",
      deadConditionalAliasBridge,
      true,
    ],
  ] as const)(
    "%s",
    (_label, sourceOverride, rejects) => {
      expect(conditionalAliasSource).toContain(conditionalAliasBridgeCall);
      const assertBindings = (): unknown =>
        assertProductionParserAstBindingsV1({
          packageRoot,
          sourceOverrides: {
            [conditionalAliasSourcePath]: sourceOverride,
          },
        });
      if (rejects) {
        expect(assertBindings).toThrow(/unreachable from the exported entry/u);
        return;
      }
      expect(assertBindings()).toHaveLength(21);
    },
    30_000,
  );

  describe("exact runtime callsite bypasses", () => {
    const compatibleBaseBytes = readFileSync(
      resolve(packageRoot, proof.sourceAnchors.compatibleBaseResourcePath),
    );
    const compatibleBase = (
      JSON.parse(compatibleBaseBytes.toString("utf8")) as {
        compatibleBase: object;
      }
    ).compatibleBase;
    const runtimeSourcePath = "src/provider-runtime-attestation-point.ts";
    const runtimeSource = readFileSync(
      resolve(packageRoot, runtimeSourcePath),
      "utf8",
    );
    const runtimeCall = [
      "StoreDurableObjectProviderRuntimeAttestationV1Schema.parse(",
      "      runtimePinOuter.payload,",
      "    )",
    ].join("\n");
    const runtimeType =
      "StoreDurableObjectProviderRuntimeAttestationV1";
    const runtimeExpressionCases = [
      [
        "0 &&",
        `((((0 as number) && ${runtimeCall}) || runtimePinOuter.payload) as ${runtimeType})`,
      ],
      [
        "1 ||",
        `((((1 as number) || ${runtimeCall}) && runtimePinOuter.payload) as ${runtimeType})`,
      ],
      [
        "dead conditional arm",
        `(((true as boolean) ? runtimePinOuter.payload : ${runtimeCall}) as ${runtimeType})`,
      ],
      [
        "non-nullish ??",
        `(((((() => 0 as unknown)() ?? ${runtimeCall}) || runtimePinOuter.payload)) as ${runtimeType})`,
      ],
      [
        "optional-chain skipped argument",
        `((((null as null | { consume(value: unknown): unknown })?.consume(${runtimeCall}) ?? runtimePinOuter.payload)) as ${runtimeType})`,
      ],
    ] as const;

    const declaration = `const parsedRuntime = ${runtimeCall};`;
    const tableSourcePath = "src/provider-target-discovery-point.ts";
    const tableSource = readFileSync(
      resolve(packageRoot, tableSourcePath),
      "utf8",
    );
    const genericConsumer = "const parsed = schema.parse(value);";
    const taxonomyRow =
      `[snapshot.publicSupportTaxonomy, ProviderPublicSupportTaxonomyEnvelopeV1Schema, "taxonomy_structure"]`;
    const assertRuntimeTraceRejected = async (
      label: string,
      sourcePath: string,
      originalSource: string,
      mutatedSource: string,
    ): Promise<void> => {
      expect(mutatedSource, label).not.toBe(originalSource);
      await expect(
        traceProductionParserBindingsV1({
          packageRoot,
          compatibleBase,
          sourceOverrides: { [sourcePath]: mutatedSource },
        }),
      ).rejects.toThrow(/exact AST callsite runtime trace missed required IDs/u);
    };

    it("anchors every runtime bypass mutation point", () => {
      expect(runtimeSource).toContain(runtimeCall);
      expect(runtimeSource).toContain(declaration);
      expect(tableSource).toContain(genericConsumer);
      expect(tableSource).toContain(taxonomyRow);
    });

    it.each(runtimeExpressionCases)(
      "rejects fresh-emitted compatible execution for expression %s",
      async (label, expression) => {
        await assertRuntimeTraceRejected(
          label,
          runtimeSourcePath,
          runtimeSource,
          runtimeSource.replace(runtimeCall, expression),
        );
      },
      parserRuntimeTraceTestTimeoutMilliseconds,
    );

    it("rejects fresh-emitted compatible execution after a labeled break", async () => {
      const labeledBreak = runtimeSource.replace(
        declaration,
        [
          `let parsedRuntime = runtimePinOuter.payload as ${runtimeType};`,
          "    exactParserTraceLabel: {",
          "      break exactParserTraceLabel;",
          `      parsedRuntime = ${runtimeCall};`,
          "    }",
        ].join("\n"),
      );
      await assertRuntimeTraceRejected(
        "labeled break",
        runtimeSourcePath,
        runtimeSource,
        labeledBreak,
      );
    }, parserRuntimeTraceTestTimeoutMilliseconds);

    it("rejects a fresh-emitted compatible generic table consumer bypass", async () => {
      const genericBypass = tableSource.replace(
        genericConsumer,
        [
          "const parsed = (false as boolean)",
          "        ? schema.parse(value)",
          "        : schema[\"parse\"](value);",
        ].join("\n"),
      );
      await assertRuntimeTraceRejected(
        "generic table consumer",
        tableSourcePath,
        tableSource,
        genericBypass,
      );
    }, parserRuntimeTraceTestTimeoutMilliseconds);

    it("rejects a fresh-emitted compatible taxonomy-row bypass", async () => {
      const taxonomyRowBypass = tableSource.replace(
        taxonomyRow,
        [
          "((false as boolean)",
          `      ? ${taxonomyRow} as const`,
          "      : [snapshot.publicSupportTaxonomy, ({ schema: ProviderPublicSupportTaxonomyEnvelopeV1Schema }).schema, \"taxonomy_structure\"] as const)",
        ].join("\n"),
      );
      await assertRuntimeTraceRejected(
        "taxonomy row",
        tableSourcePath,
        tableSource,
        taxonomyRowBypass,
      );
    }, parserRuntimeTraceTestTimeoutMilliseconds);
  });

  it("fails closed on garbled, stale, structurally incomplete, or crashed parser-runtime workers", async () => {
    expect(PARSER_RUNTIME_WORKER_TIMEOUT_MS_V1).toBe(120_000);
    const timeoutStartedAt = performance.now();
    const timeoutResult = await exerciseParserRuntimeWorkerTimeoutForTestV1({
      packageRoot,
      timeoutMilliseconds: 50,
    });
    expect(timeoutResult.error).toMatchObject({
      killed: true,
      signal: "SIGKILL",
    });
    expect(performance.now() - timeoutStartedAt).toBeLessThan(5_000);
    const requestNonce = "1".repeat(48);
    expect(() =>
      parseProductionParserRuntimeWorkerResultV1("{", {
        phase: "instrumented",
        requestNonce,
      }),
    ).toThrow(/result is not valid JSON/u);
    expect(() =>
      parseProductionParserRuntimeWorkerResultV1(
        JSON.stringify({
          profile: PARSER_RUNTIME_WORKER_PROFILE_V1,
          requestNonce: "0".repeat(48),
          phase: "instrumented",
        }),
        { phase: "instrumented", requestNonce },
      ),
    ).toThrow(/nonce is stale or mismatched/u);
    expect(() =>
      parseProductionParserRuntimeWorkerResultV1(
        JSON.stringify({
          profile: PARSER_RUNTIME_WORKER_PROFILE_V1,
          requestNonce,
          phase: "instrumented",
        }),
        { phase: "instrumented", requestNonce },
      ),
    ).toThrow(/result keys drifted/u);

    const compatibleBaseBytes = readFileSync(
      resolve(packageRoot, proof.sourceAnchors.compatibleBaseResourcePath),
    );
    const compatibleBase = (
      JSON.parse(compatibleBaseBytes.toString("utf8")) as {
        compatibleBase: object;
      }
    ).compatibleBase;
    const sourcePath = "src/provider-runtime-attestation-point.ts";
    const source = readFileSync(resolve(packageRoot, sourcePath), "utf8");
    const declaration =
      "export async function validateProviderRuntimeAttestationPointClosureV1(";
    expect(source).toContain(declaration);
    const workerDirectoriesBefore = readdirSync(packageRoot)
      .filter((name) => name.startsWith(".topology-proof-parser-worker-"))
      .sort();
    const syntacticallyInvalidSource = source.replace(
      declaration,
      `${declaration},`,
    );
    await expect(
      traceProductionParserBindingsV1({
        packageRoot,
        compatibleBase,
        sourceOverrides: { [sourcePath]: syntacticallyInvalidSource },
      }),
    ).rejects.toThrow(/parser runtime worker uninstrumented failed closed/u);
    expect(
      readdirSync(packageRoot).filter((name) =>
        name.startsWith(".topology-proof-parser-worker-"),
      ).sort(),
    ).toEqual(workerDirectoriesBefore);
  }, 30_000);

  it("snapshots lifecycle-token source overrides and rejects hidden property forms", async () => {
    const sourcePath = "src/provider-runtime-attestation-point.ts";
    const source = readFileSync(resolve(packageRoot, sourcePath), "utf8");

    await expect(
      generateProviderRegistryEvidenceBindingTopologyProofV1({
        packageRoot,
        generatedSchemas,
        sourceOverrides: { [sourcePath]: source },
        precomputedParserRuntimeTraceToken: Object.freeze({}),
      }),
    ).rejects.toThrow(/precomputed parser runtime trace token context drifted/u);

    const nonEnumerableOverride = {};
    Object.defineProperty(nonEnumerableOverride, sourcePath, {
      value: source,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    await expect(
      generateProviderRegistryEvidenceBindingTopologyProofV1({
        packageRoot,
        generatedSchemas,
        sourceOverrides: nonEnumerableOverride,
      }),
    ).rejects.toThrow(/source override must be an enumerable data property/u);

    const symbolOverride = {};
    Object.defineProperty(symbolOverride, Symbol("hidden-source-override"), {
      value: source,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    await expect(
      generateProviderRegistryEvidenceBindingTopologyProofV1({
        packageRoot,
        generatedSchemas,
        sourceOverrides: symbolOverride,
      }),
    ).rejects.toThrow(/source override keys must be strings/u);

    let accessorGetterHits = 0;
    const accessorOverride = {};
    Object.defineProperty(accessorOverride, sourcePath, {
      get() {
        accessorGetterHits += 1;
        return source;
      },
      enumerable: true,
      configurable: true,
    });
    await expect(
      generateProviderRegistryEvidenceBindingTopologyProofV1({
        packageRoot,
        generatedSchemas,
        sourceOverrides: accessorOverride,
      }),
    ).rejects.toThrow(/source override must be an enumerable data property/u);
    expect(accessorGetterHits).toBe(0);

    const token =
      await precomputeProviderRegistryEvidenceBindingParserRuntimeTraceTokenV1({
        packageRoot,
      });
    expect(token).toBeTypeOf("object");

    const mutableOverrides = {};
    const generatedProofPromise =
      generateProviderRegistryEvidenceBindingTopologyProofV1({
        packageRoot,
        generatedSchemas,
        sourceOverrides: mutableOverrides,
        precomputedParserRuntimeTraceToken: token,
      });
    Object.defineProperty(mutableOverrides, sourcePath, {
      value: "export const afterStartMutation = true;\n",
      enumerable: true,
      configurable: true,
      writable: true,
    });
    expect(Reflect.ownKeys(mutableOverrides)).toEqual([sourcePath]);
    const generatedProof = await generatedProofPromise;
    expect(generatedProof.aggregateSemanticDigest).toBe(
      proof.aggregateSemanticDigest,
    );
    expect(
      generatedProof.sourceAnchors.productionParserRuntimeTraceSemanticDigest,
    ).toBe(proof.sourceAnchors.productionParserRuntimeTraceSemanticDigest);
  }, 90_000);

  it("binds the scalar formulas to the production walker AST and allocation-ledger differential", async () => {
    const accountingAst = assertRawAdmissionAccountingAstV1({ packageRoot });
    expect(accountingAst).toMatchObject({
      fixedSessionWorkUnits: 64,
      identityObservationWorkUnits: 4,
      topLevelWorkUnits: 95,
      ordinaryFormula: proof.sourceAnchors.accountingModel.ordinaryFormula,
      historyFormula: proof.sourceAnchors.accountingModel.historyFormula,
      relevantFunctionCount: 26,
      mutableTestSeamsExcludedFromAccountingAuthority: true,
      controlFlowAstSemanticDigest:
        proof.sourceAnchors.accountingModel.freshAstControlFlow.semanticDigest,
    });
    const runtimeTrace = await traceRawAdmissionAccountingV1({ packageRoot });
    expect(runtimeTrace).toEqual(
      proof.sourceAnchors.accountingModel.runtimeDifferential,
    );
    expect(runtimeTrace.retainedHistory).toMatchObject({
      sharedAggregateBudgetProfile: "B_H",
      observedIdentityDelta: 7,
      expectedIdentityDelta: 7,
      observedWorkDelta: 79,
      expectedWorkDelta: 79,
      exact: true,
    });
    expect(runtimeTrace.testSeamIsolation).toEqual({
      mutableTestSeamsExcludedFromAccountingAuthority: true,
      allocationCapExerciseActivated: false,
      stringBudgetObserverActivated: false,
      allocationLedgerReadCount: 9,
      productionBudgetObserverRejectionCount: 7,
      authority:
        "fresh_ast_and_unmodified_production_walker_differential_only",
    });
    for (const row of runtimeTrace.ordinaryRows as Array<{
      observedWorkDelta: number;
      expectedWorkDelta: number;
      exact: boolean;
    }>) {
      expect(row.observedWorkDelta).toBe(row.expectedWorkDelta);
      expect(row.exact).toBe(true);
    }
  }, 30_000);

  it("rejects allocation-ledger drift in topology generation", async () => {
    const sourcePath = "src/provider-point-raw-admission-internal.ts";
    const source = readFileSync(resolve(packageRoot, sourcePath), "utf8");
    const charge =
      "  reserveProviderPointRawOwnKeyWorkV1(session, keyCount);";
    expect(source.split(charge)).toHaveLength(2);
    const mutatedSource = source.replace(charge, `${charge}\n${charge}`);
    await expect(
      generateProviderRegistryEvidenceBindingTopologyProofV1({
        packageRoot,
        generatedSchemas,
        sourceOverrides: { [sourcePath]: mutatedSource },
      }),
    ).rejects.toThrow(/accounting control-flow AST drifted/u);
  }, 30_000);

  it("keeps the exact 22/21/23 topology order and the explicit relaxation inventory", () => {
    expect(proof.inputKeys).toHaveLength(22);
    expect(proof.jsonBranchKeys).toHaveLength(21);
    expect(proof.schemaSources.map(({ branch }) => branch)).toEqual(
      proof.jsonBranchKeys,
    );
    expect(proof.orderedBounds).toHaveLength(23);
    expect(proof.orderedBounds.map(({ scope }) => scope)).toEqual([
      "topLevel",
      "opaqueCapabilityShell",
      ...proof.jsonBranchKeys,
    ]);
    expect(proof.solver.objectives).toEqual([
      "identities",
      "ordinary_work",
      "history_work",
    ]);
    expect(proof.solver.relaxations.map(({ kind }) => kind)).toEqual([
      "fractional_last_atom",
      "one_of_as_alternative_upper",
      "nested_prerequisite_dropped",
      "cross_branch_semantic_and_crypto_equalities_not_modeled",
    ]);
    expect(proof.solver.pathRelaxations).toEqual(
      [...proof.solver.pathRelaxations].sort(),
    );
  });

  it("recomputes the constructive lower witness and proves both frozen caps fail", () => {
    const lower = proof.capAssessment.constructiveLowerBound;
    let ordinaryIdentities = 0;
    let ordinaryWork = 0;
    for (const row of lower.ordinaryRows) {
      const binding = proof.productionParserBindings.find(
        ({ branch }) => branch === row.branch,
      );
      expect(binding).toBeDefined();
      const branchSchema =
        generatedSchemas[
          binding!.schemaName as keyof typeof generatedSchemas
        ]!;
      const validate = new Ajv2020({
        allErrors: true,
        strict: true,
        validateFormats: false,
      }).compile(branchSchema);
      const fullBranchBase = JSON.parse(
        row.validation.fullBranchBaseCanonicalJson,
      ) as unknown;
      const exemplar = JSON.parse(
        row.validation.exemplarCanonicalJson,
      ) as unknown;
      expect(validate(fullBranchBase)).toBe(true);
      expect(Buffer.byteLength(row.validation.fullBranchBaseCanonicalJson)).toBe(
        row.baseByteAllowance,
      );
      expect(Buffer.byteLength(row.validation.exemplarCanonicalJson)).toBe(
        row.itemCanonicalBytes,
      );
      expect(measureTopology(fullBranchBase)).toEqual(
        row.validation.fullBranchBaseTopology,
      );
      expect(measureTopology(exemplar)).toEqual(
        row.validation.exemplarTopology,
      );
      expect(row.deltaIdentities).toBe(
        row.validation.exemplarTopology.identities,
      );
      expect(row.deltaOwnKeys).toBe(
        row.validation.exemplarTopology.ownKeys + 1,
      );
      expect(row.deltaDenseIndices).toBe(
        row.validation.exemplarTopology.denseIndices + 1,
      );
      const repeatProbe = structuredClone(fullBranchBase);
      const target = valueAtJsonPointer(
        repeatProbe,
        row.targetInstancePointer,
      );
      expect(Array.isArray(target)).toBe(true);
      (target as unknown[]).push(
        structuredClone(exemplar),
        structuredClone(exemplar),
      );
      expect(validate(repeatProbe)).toBe(true);
      expect(row.validation.repeatabilityAudit.auditedSchemaPath.length).toBeGreaterThan(0);
      expect(row.validation.repeatabilityAudit.exactArrayKeywords).toEqual(
        [...row.validation.repeatabilityAudit.exactArrayKeywords].sort(),
      );
      const finalBranch = structuredClone(fullBranchBase);
      const finalItems = materializeCanonicalArray(
        row.validation.exemplarCanonicalJson,
        row.repetitions,
      );
      replaceAtJsonPointer(
        finalBranch,
        row.targetInstancePointer,
        finalItems,
      );
      expect(finalItems).toHaveLength(
        row.validation.finalMaterializedItemCount,
      );
      expect(row.validation.finalMaterializedItemCount).toBe(
        row.repetitions + 1,
      );
      expect(validate(finalBranch)).toBe(true);
      const finalCanonicalJson = JSON.stringify(finalBranch);
      expect(Buffer.byteLength(finalCanonicalJson)).toBe(
        row.validation.finalMaterializedCanonicalBytes,
      );
      expect(row.validation.finalMaterializedCanonicalBytes).toBe(
        row.branchCanonicalBytesAtMost,
      );
      expect(`sha256:${sha256Hex(Buffer.from(finalCanonicalJson))}`).toBe(
        row.validation.finalMaterializedRawSha256,
      );
      expect(row.branchCanonicalBytesAtMost).toBe(
        row.baseByteAllowance +
          row.repetitions *
            (row.itemCanonicalBytes + row.commaBytesPerRepetition),
      );
      expect(row.branchCanonicalBytesAtMost).toBeLessThanOrEqual(
        proof.limits.maxDistributionRawUnits,
      );
      expect(
        row.branchCanonicalBytesAtMost +
          row.itemCanonicalBytes +
          row.commaBytesPerRepetition,
      ).toBeGreaterThan(proof.limits.maxDistributionRawUnits);
      expect(row.identityContribution).toBe(
        row.repetitions * row.deltaIdentities,
      );
      expect(row.workUnitsPerRepetition).toBe(
        6 * row.deltaIdentities + row.deltaOwnKeys + row.deltaDenseIndices,
      );
      expect(row.workContribution).toBe(
        row.repetitions * row.workUnitsPerRepetition,
      );
      ordinaryIdentities += row.identityContribution;
      ordinaryWork += row.workContribution;
    }

    const history = lower.registryHistoryRow;
    expect(history.maxAdditionalMembersPerEnvelope).toBe(
      Math.ceil(history.repetitions / history.registryEnvelopeCount),
    );
    expect(history.maxAdditionalMembersPerEnvelope).toBeLessThanOrEqual(
      proof.policyCardinality.registryManifestJsonContainerEntryHardCap,
    );
    expect(history.maxRegistryEnvelopeCanonicalBytes).toBe(
      history.registryEnvelopeBaseByteAllowance +
        history.maxAdditionalMembersPerEnvelope *
          (history.itemCanonicalBytes + history.commaBytesPerRepetition),
    );
    expect(history.maxRegistryEnvelopeCanonicalBytes).toBeLessThanOrEqual(
      proof.limits.maxTrustEnvelopeRawUnits,
    );
    expect(history.sharedHistoryCanonicalBytesAtMost).toBe(
      history.rootEnvelopeCount * history.rootEnvelopeBaseByteAllowance +
        history.registryEnvelopeCount *
          history.registryEnvelopeBaseByteAllowance +
        history.repetitions *
          (history.itemCanonicalBytes + history.commaBytesPerRepetition),
    );
    expect(history.sharedHistoryCanonicalBytesAtMost).toBeLessThanOrEqual(
      proof.limits.maxRetainedTrustHistoryRawUnits,
    );
    expect(history.identityContribution).toBe(
      history.repetitions * history.deltaIdentities,
    );
    expect(history.workUnitsPerRepetition).toBe(
      7 * history.deltaIdentities +
        history.deltaOwnKeys +
        history.deltaDenseIndices,
    );
    expect(history.workContribution).toBe(
      history.repetitions * history.workUnitsPerRepetition,
    );

    const historyAjv = new Ajv2020({
      allErrors: true,
      strict: true,
      validateFormats: false,
    });
    const validateRoot = historyAjv.compile(
      generatedSchemas["provider-registry-root-metadata-envelope"]!,
    );
    const validateRegistry = historyAjv.compile(
      generatedSchemas["provider-registry-manifest-envelope"]!,
    );
    const rootBase = JSON.parse(
      history.validation.rootEnvelopeBaseCanonicalJson,
    ) as unknown;
    const registryBase = JSON.parse(
      history.validation.registryEnvelopeBaseCanonicalJson,
    ) as unknown;
    const revokedExemplar = JSON.parse(
      history.validation.exemplarCanonicalJson,
    ) as unknown;
    expect(validateRoot(rootBase)).toBe(true);
    expect(validateRegistry(registryBase)).toBe(true);
    expect(measureTopology(rootBase)).toEqual(
      history.validation.rootEnvelopeBaseTopology,
    );
    expect(measureTopology(registryBase)).toEqual(
      history.validation.registryEnvelopeBaseTopology,
    );
    expect(measureTopology(revokedExemplar)).toEqual(
      history.validation.exemplarTopology,
    );
    const maximumEnvelopeProbe = structuredClone(registryBase);
    const members = valueAtJsonPointer(maximumEnvelopeProbe, "/payload/members");
    expect(Array.isArray(members)).toBe(true);
    for (
      let index = 0;
      index < history.maxAdditionalMembersPerEnvelope;
      index += 1
    ) {
      (members as unknown[]).push(structuredClone(revokedExemplar));
    }
    expect(validateRegistry(maximumEnvelopeProbe)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(maximumEnvelopeProbe))).toBe(
      history.maxRegistryEnvelopeCanonicalBytes,
    );
    expect(history.validation.repeatabilityAudit.auditedSchemaPath).toBe(
      "$.properties.payload.anyOf[0].properties.members",
    );
    let profiledAdditionalItems = 0;
    let profiledEnvelopeCount = 0;
    for (const profile of history.validation.finalMaterializedEnvelopeProfiles) {
      const materializedEnvelope = structuredClone(registryBase);
      const materializedMembers = materializeCanonicalArray(
        history.validation.exemplarCanonicalJson,
        profile.additionalItems,
      );
      replaceAtJsonPointer(
        materializedEnvelope,
        "/payload/members",
        materializedMembers,
      );
      expect(materializedMembers).toHaveLength(
        profile.materializedMemberCount,
      );
      expect(validateRegistry(materializedEnvelope)).toBe(true);
      const materializedJson = JSON.stringify(materializedEnvelope);
      expect(Buffer.byteLength(materializedJson)).toBe(profile.canonicalBytes);
      expect(`sha256:${sha256Hex(Buffer.from(materializedJson))}`).toBe(
        profile.rawSha256,
      );
      profiledAdditionalItems +=
        profile.additionalItems * profile.envelopeCount;
      profiledEnvelopeCount += profile.envelopeCount;
    }
    expect(profiledAdditionalItems).toBe(history.repetitions);
    expect(profiledEnvelopeCount).toBe(history.registryEnvelopeCount);

    expect(ordinaryIdentities + history.identityContribution).toBe(
      lower.provenAtLeastObservedIdentities,
    );
    expect(ordinaryWork + history.workContribution).toBe(
      lower.provenAtLeastPrecloneAllocationWorkUnits,
    );
    expect(lower.provenAtLeastObservedIdentities).toBe(2_118_023);
    expect(lower.provenAtLeastPrecloneAllocationWorkUnits).toBe(22_569_542);

    for (const failure of proof.capAssessment.priorFailures) {
      expect(failure.provenAtLeast).toBeGreaterThan(failure.cap);
      expect(failure.exceedsByAtLeast).toBe(
        failure.provenAtLeast - failure.cap,
      );
      expect(failure.soundUpper).toBeGreaterThanOrEqual(
        failure.provenAtLeast,
      );
    }
    expect(proof.capAssessment.priorFailures.map(({ exceedsByAtLeast }) =>
      exceedsByAtLeast)).toEqual([20_871, 5_792_326]);
    expect(proof.capAssessment.adoptedFailures).toEqual([]);
  });

  it("recomposes the sound scalar maxima and the recommended binary caps", () => {
    const witness = proof.symbolicWitness;
    expect(witness.totalMaxIdentities).toBe(
      1 +
        witness.ordinaryBranches.reduce(
          (total, branch) => total + branch.maxIdentities,
          0,
        ) +
        witness.retainedHistories.maxIdentities,
    );

    const historyScopes = new Set([
      "rootMetadataHistory",
      "registryManifestHistory",
    ]);
    const ordinaryBoundWork = proof.orderedBounds
      .filter(({ scope }) => !historyScopes.has(scope))
      .reduce((total, bound) => total + bound.maxWorkUnits, 0);
    expect(witness.totalMaxWorkUnits).toBe(
      ordinaryBoundWork + witness.retainedHistories.maxWorkUnits,
    );
    expect(witness.totalMaxIdentities).toBe(3_126_096);
    expect(witness.totalMaxWorkUnits).toBe(235_725_869);
    expect(proof.capAssessment.soundUpperBounds).toEqual({
      maxObservedIdentities: witness.totalMaxIdentities,
      maxPrecloneAllocationWorkUnits: witness.totalMaxWorkUnits,
    });

    const recommended = proof.capAssessment.recommendedBinaryCaps;
    expect(recommended.maxObservedIdentities).toBe(
      leastPowerOfTwoAtLeast(witness.totalMaxIdentities),
    );
    expect(recommended.maxPrecloneAllocationWorkUnits).toBe(
      leastPowerOfTwoAtLeast(witness.totalMaxWorkUnits),
    );
    expect(recommended.observedIdentityHeadroom).toBe(
      recommended.maxObservedIdentities - witness.totalMaxIdentities,
    );
    expect(recommended.precloneAllocationWorkUnitHeadroom).toBe(
      recommended.maxPrecloneAllocationWorkUnits - witness.totalMaxWorkUnits,
    );
    expect(recommended).toMatchObject({
      maxObservedIdentities: 4_194_304,
      maxPrecloneAllocationWorkUnits: 268_435_456,
    });
    expect(proof.capAssessment.adoptedCaps).toEqual({
      maxObservedIdentities: recommended.maxObservedIdentities,
      maxPrecloneAllocationWorkUnits:
        recommended.maxPrecloneAllocationWorkUnits,
    });
    expect(proof.capAssessment.adoptedAssessment).toEqual({
      withinSoundUpper: true,
      observedIdentityHeadroom:
        recommended.maxObservedIdentities - witness.totalMaxIdentities,
      precloneAllocationWorkUnitHeadroom:
        recommended.maxPrecloneAllocationWorkUnits -
        witness.totalMaxWorkUnits,
    });

    expect(
      witness.ordinaryBranches.some(
        (branch) =>
          branch.maxWorkTopologyObjective !==
          6 * branch.maxIdentities +
            branch.maxOwnKeys +
            branch.maxDenseIndices,
      ),
    ).toBe(true);
  });

  it("bounds high-density arrays by finite count/capacity and records union relaxation", () => {
    const boundedArray = {
      type: "array",
      minItems: 0,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {},
        required: [],
      },
    };
    const atFourBytes = analyzeJsonSchemaFiniteObjectiveV1(boundedArray, {
      byteCeiling: 4,
      weights: { identities: 1, ownKeys: 0, dense: 0 },
    });
    const atSevenBytes = analyzeJsonSchemaFiniteObjectiveV1(boundedArray, {
      byteCeiling: 7,
      weights: { identities: 1, ownKeys: 0, dense: 0 },
    });
    const workAtSevenBytes = analyzeJsonSchemaFiniteObjectiveV1(boundedArray, {
      byteCeiling: 7,
      weights: { identities: 6, ownKeys: 1, dense: 1 },
    });
    expect(atFourBytes.maximum).toBe(2n);
    expect(atSevenBytes.maximum).toBe(3n);
    expect(workAtSevenBytes.maximum).toBe(23n);
    expect(atSevenBytes.maximum).toBeLessThanOrEqual(
      atSevenBytes.structuralMax,
    );

    const union = {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {},
          required: [],
        },
        boundedArray,
      ],
    };
    const unionBound = analyzeJsonSchemaFiniteObjectiveV1(union, {
      byteCeiling: 7,
      weights: { identities: 1, ownKeys: 0, dense: 0 },
    });
    expect(unionBound.maximum).toBeGreaterThanOrEqual(
      atSevenBytes.maximum,
    );
    expect(unionBound.maximum).toBeLessThanOrEqual(unionBound.structuralMax);
    expect(unionBound.relaxations).toContain(
      "$.oneOf: mutually exclusive alternative segment capacities are combined, then clamped by the largest alternative structural objective",
    );
  });

  it("resolves local refs, treats anyOf alternatives as separate productions, and never underbounds either union arm", () => {
    const localRefArray = {
      $defs: {
        cell: {
          type: "object",
          additionalProperties: false,
          properties: {},
          required: [],
        },
      },
      type: "array",
      minItems: 0,
      maxItems: 2,
      items: { $ref: "#/$defs/cell" },
    };
    const refBound = analyzeJsonSchemaFiniteObjectiveV1(localRefArray, {
      byteCeiling: 7,
      weights: { identities: 1, ownKeys: 0, dense: 0 },
    });
    expect(refBound.maximum).toBe(3n);

    const objectArm = {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    };
    const arrayArm = {
      type: "array",
      minItems: 0,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {},
        required: [],
      },
    };
    const objectBound = analyzeJsonSchemaFiniteObjectiveV1(objectArm, {
      byteCeiling: 7,
      weights: { identities: 6, ownKeys: 1, dense: 1 },
    });
    const arrayBound = analyzeJsonSchemaFiniteObjectiveV1(arrayArm, {
      byteCeiling: 7,
      weights: { identities: 6, ownKeys: 1, dense: 1 },
    });
    const anyOfBound = analyzeJsonSchemaFiniteObjectiveV1(
      { anyOf: [objectArm, arrayArm] },
      {
        byteCeiling: 7,
        weights: { identities: 6, ownKeys: 1, dense: 1 },
      },
    );
    expect(anyOfBound.maximum).toBeGreaterThanOrEqual(objectBound.maximum);
    expect(anyOfBound.maximum).toBeGreaterThanOrEqual(arrayBound.maximum);
    expect(anyOfBound.maximum).toBeLessThanOrEqual(anyOfBound.structuralMax);
    expect(anyOfBound.relaxations).toContain(
      "$.anyOf: mutually exclusive alternative segment capacities are combined, then clamped by the largest alternative structural objective",
    );
  });

  it("continues onto the next finite-density segment after the densest capacity is exhausted", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        high: {
          type: "array",
          minItems: 0,
          maxItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {},
            required: [],
          },
        },
        low: {
          type: "array",
          minItems: 0,
          maxItems: 8,
          items: { type: "number" },
        },
      },
      required: [],
    };
    const profile = analyzeJsonSchemaFiniteObjectiveV1(schema, {
      byteCeiling: 40,
      weights: { identities: 6, ownKeys: 1, dense: 1 },
    });
    const densest = [...profile.segments].sort((left, right) => {
      const comparison =
        left.density.numerator * right.density.denominator -
        right.density.numerator * left.density.denominator;
      return comparison > 0n ? -1 : comparison < 0n ? 1 : 0;
    })[0]!;
    expect(profile.maximum - profile.baseMax).toBeGreaterThan(
      densest.maxGain,
    );
    expect(profile.maximum).toBe(profile.structuralMax);
  });

  it("keeps regex escapes conservative and recursively charges container literals", () => {
    const escapedPatternArray = {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: { type: "string", pattern: "^\\u0061$" },
    };
    const escapedBound = analyzeJsonSchemaFiniteObjectiveV1(
      escapedPatternArray,
      {
        byteCeiling: 13,
        weights: { identities: 6, ownKeys: 1, dense: 1 },
      },
    );
    const accepted = ["a", "a", "a"];
    const acceptedTopology = measureTopology(accepted);
    const acceptedWork =
      6 * acceptedTopology.identities +
      acceptedTopology.ownKeys +
      acceptedTopology.denseIndices;
    expect(Buffer.byteLength(JSON.stringify(accepted))).toBe(13);
    expect(escapedBound.maximum).toBeGreaterThanOrEqual(
      BigInt(acceptedWork),
    );

    const constObjectBound = analyzeJsonSchemaFiniteObjectiveV1(
      { const: {} },
      {
        byteCeiling: 2,
        weights: { identities: 1, ownKeys: 0, dense: 0 },
      },
    );
    expect(constObjectBound.maximum).toBeGreaterThanOrEqual(1n);

    const enumArrayWorkBound = analyzeJsonSchemaFiniteObjectiveV1(
      { enum: [[]] },
      {
        byteCeiling: 2,
        weights: { identities: 6, ownKeys: 1, dense: 1 },
      },
    );
    expect(enumArrayWorkBound.maximum).toBeGreaterThanOrEqual(7n);
  });

  it("applies both the per-Envelope ceiling and the shared history ceiling", () => {
    const envelopeSchema = {
      type: "array",
      minItems: 0,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {},
        required: [],
      },
    };
    const profile = analyzeJsonSchemaFiniteObjectiveV1(envelopeSchema, {
      byteCeiling: 7,
      weights: { identities: 1, ownKeys: 0, dense: 0 },
    });
    const groups = [
      {
        count: 3,
        profile,
        extraResource: 0n,
        perEnvelopeByteCeiling: 7,
        source: "synthetic Envelope group",
      },
    ];
    expect(boundSharedFiniteObjectiveV1(groups, 4)).toBe(2n);
    expect(boundSharedFiniteObjectiveV1(groups, 14)).toBe(7n);
    expect(boundSharedFiniteObjectiveV1(groups, 21)).toBe(9n);
    expect(boundSharedFiniteObjectiveV1(groups, 50)).toBe(9n);
    expect(boundSharedFiniteObjectiveV1(groups, 50)).toBe(
      3n * profile.maximum,
    );
  });

  it("fails closed on open objects, unresolved cycles, and unbounded topology arrays", () => {
    expect(() =>
      analyzeJsonSchemaFiniteObjectiveV1(
        { type: "object", properties: {}, required: [] },
        { byteCeiling: 64 },
      ),
    ).toThrow(/strict object/u);

    const cyclic = {
      $defs: {
        node: {
          type: "object",
          additionalProperties: false,
          properties: { next: { $ref: "#/$defs/node" } },
          required: ["next"],
        },
      },
      $ref: "#/$defs/node",
    };
    expect(() =>
      analyzeJsonSchemaFiniteObjectiveV1(cyclic, { byteCeiling: 64 }),
    ).toThrow(/cyclic/u);
    expect(() =>
      analyzeJsonSchemaFiniteObjectiveV1(
        { $ref: "https://example.invalid/schema" },
        { byteCeiling: 64 },
      ),
    ).toThrow(/external or malformed/u);
    expect(() =>
      analyzeJsonSchemaTopologyV1({
        type: "array",
        items: { type: "string" },
      }),
    ).toThrow(/explicit canonical-byte-derived unboundedArrayMaxItems/u);
    expect(() =>
      analyzeJsonSchemaFiniteObjectiveV1(
        { type: "string", pattern: "^(?!)$" },
        { byteCeiling: 64 },
      ),
    ).toThrow(/unsatisfiable regex/u);
    expect(() =>
      analyzeJsonSchemaFiniteObjectiveV1(
        {
          type: "array",
          maxItems: 2,
          contains: { type: "number" },
          items: { type: "number" },
        },
        { byteCeiling: 64 },
      ),
    ).toThrow(/contains/u);
    expect(() =>
      analyzeJsonSchemaFiniteObjectiveV1(
        {
          type: "array",
          maxItems: 2,
          uniqueItems: true,
          items: { type: "number" },
        },
        { byteCeiling: 64 },
      ),
    ).toThrow(/uniqueItems/u);
    expect(() =>
      analyzeJsonSchemaTopologyV1(
        {
          type: "array",
          maxItems: 2,
          uniqueItems: true,
          items: { type: "number" },
        },
        { unboundedArrayMaxItems: 2 },
      ),
    ).toThrow(/uniqueItems/u);

    const delayedNotConstraint = {
      type: "object",
      additionalProperties: false,
      properties: {
        values: {
          type: "array",
          items: { type: "number" },
          not: { minItems: 4 },
        },
      },
      required: ["values"],
    };
    const delayedAjv = new Ajv2020({ strict: true });
    const validateDelayed = delayedAjv.compile(delayedNotConstraint);
    expect(validateDelayed({ values: [0, 0, 0] })).toBe(true);
    expect(validateDelayed({ values: [0, 0, 0, 0] })).toBe(false);
    expect(() =>
      assertRepeatableArraySchemaPathV1(
        delayedNotConstraint,
        ["properties", "values"],
        "delayed not regression",
      ),
    ).toThrow(/unproved cross-value keyword not/u);
  });

  it("rejects a stale or tampered dist schema inventory", () => {
    expect(() =>
      assertGeneratedSchemaInventoryFreshV1(
        generatedSchemas,
        generatedSchemas,
      ),
    ).not.toThrow();
    const tampered = structuredClone(generatedSchemas);
    tampered["provider-registry-root-public-key"]!.$id =
      "urn:tampered:stale-dist";
    expect(() =>
      assertGeneratedSchemaInventoryFreshV1(generatedSchemas, tampered),
    ).toThrow(/stale dist\/json-schema\.js/u);

    const compactSourceInventory = {
      alpha: {
        type: "object",
        required: ["value"],
        properties: { value: { type: "string" } },
      },
      beta: { type: "array", items: { type: "number" } },
    };
    const compactReorderedInventory = {
      beta: { items: { type: "number" }, type: "array" },
      alpha: {
        properties: { value: { type: "string" } },
        required: ["value"],
        type: "object",
      },
    };
    expect(() =>
      assertGeneratedSchemaInventoryFreshV1(
        compactSourceInventory,
        compactReorderedInventory,
      ),
    ).not.toThrow();
    expect(() =>
      assertGeneratedSchemaInventoryFreshV1(compactSourceInventory, {
        alpha: compactReorderedInventory.alpha,
      }),
    ).toThrow(/stale dist\/json-schema\.js/u);
    expect(() =>
      assertGeneratedSchemaInventoryFreshV1(compactSourceInventory, {
        ...compactReorderedInventory,
        gamma: { type: "null" },
      }),
    ).toThrow(/stale dist\/json-schema\.js/u);
  });

  it("passes the standalone source-anchor and regeneration check", async () => {
    await expect(runStandaloneTopologyProofCheck()).resolves.toContain(
      "Verified accepted-after-contract-reopen topology proof",
    );
  }, standaloneGeneratorTestTimeoutMilliseconds);
});
