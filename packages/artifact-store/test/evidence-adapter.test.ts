import { describe, expect, it } from "vitest";

import {
  adaptWikiV2EvidenceAndClaims,
  invalidateEvidenceForSourceChanges,
  propagateEvidenceFreshnessToClaims,
  sanitizeEvidenceExcerpt,
  sha256Bytes,
  validateClaimEvidenceLinks,
  type WikiDocumentTracesV2Input,
  type WikiIndexV2EvidenceInput,
  type WikiV2EvidenceAdapterOptions,
} from "../src/index.js";
import { FIXTURE_TASK_ID } from "./helpers.js";
import { loadContractFixture } from "./helpers.js";

const createdAt = "2026-07-28T08:00:00Z";
const source = [
  "export function authenticate() {",
  '  const apiKey = "sk-secret-value"; // Authorization: Bearer abc.def.ghi',
  "  return true;",
  "}",
].join("\n");

function fixtures(): {
  index: WikiIndexV2EvidenceInput;
  traces: WikiDocumentTracesV2Input;
} {
  return {
    index: {
      version: 2,
      generatedAt: createdAt,
      pages: [
        {
          id: "page:auth",
          directNodeIds: ["symbol:auth"],
          contextNodeIds: [],
          evidenceIds: ["wiki-evidence-auth"],
          quality: "generated",
          generationStatus: "complete",
        },
      ],
      nodeDocumentation: [
        {
          nodeId: "symbol:auth",
          directPageIds: ["page:auth"],
          contextPageIds: [],
          evidenceIds: ["wiki-evidence-auth"],
        },
      ],
      evidence: [
        {
          id: "wiki-evidence-auth",
          nodeIds: ["symbol:auth"],
          filePath: "src/认证 auth.ts",
          lineRange: [2, 2],
          excerpt:
            '  const apiKey = "sk-secret-value"; // Authorization: Bearer abc.def.ghi',
          evidenceType: "production",
        },
      ],
    },
    traces: {
      version: 2,
      generatedAt: createdAt,
      traces: [
        {
          pageId: "page:auth",
          directNodeIds: ["symbol:auth"],
          contextNodeIds: [],
          evidenceIds: ["wiki-evidence-auth"],
          quality: "generated",
          generationStatus: "complete",
          claims: [
            {
              id: "claim:auth",
              text: "Authentication is implemented by the source function.",
              nodeIds: ["symbol:auth"],
              evidenceIds: ["wiki-evidence-auth"],
            },
          ],
        },
      ],
    },
  };
}

const options = {
  taskId: FIXTURE_TASK_ID,
  sourceSnapshotId: "snapshot:wiki",
  producedBy: "wiki-v2-adapter",
  createdAt,
  sourceContents: { "src/认证 auth.ts": source },
};

describe("Wiki V2 Evidence adapter", () => {
  it("adapts the repository's real legacy Wiki V2 fixtures", async () => {
    const index = await loadContractFixture<WikiIndexV2EvidenceInput>(
      "legacy/wiki-index-v2.json",
    );
    const traces = await loadContractFixture<WikiDocumentTracesV2Input>(
      "legacy/wiki-document-traces-v2.json",
    );
    const adapted = adaptWikiV2EvidenceAndClaims(index, traces, {
      taskId: FIXTURE_TASK_ID,
      sourceSnapshotId: "snapshot:wiki-fixture",
      producedBy: "wiki-v2-adapter",
      createdAt,
      sourceContents: {
        "src/task.ts": "export const task = true;",
      },
    });
    expect(adapted).toMatchObject({
      claims: [{ statement: "Task fixture documents the task implementation." }],
      evidence: [{ filePath: "src/task.ts" }],
    });
  });

  it("creates stable, symmetric Claim/Evidence links and redacts sensitive excerpts", () => {
    const { index, traces } = fixtures();
    const adapted = adaptWikiV2EvidenceAndClaims(index, traces, options);
    expect(adapted.claims).toHaveLength(1);
    expect(adapted.evidence).toHaveLength(1);
    const claim = adapted.claims[0]!;
    const evidence = adapted.evidence[0]!;
    expect(claim).toMatchObject({
      epistemicStatus: "inferred",
      lifecycleStatus: "supported",
      evidenceIds: [evidence.id],
    });
    expect(evidence).toMatchObject({
      kind: "source",
      epistemicStatus: "observed",
      claimIds: [claim.id],
      contentHash: sha256Bytes(source),
    });
    expect("excerpt" in evidence ? evidence.excerpt : undefined).toContain(
      "[REDACTED]",
    );
    expect("excerpt" in evidence ? evidence.excerpt : undefined).not.toContain(
      "sk-secret-value",
    );
    expect(() =>
      validateClaimEvidenceLinks(adapted.claims, adapted.evidence),
    ).not.toThrow();
  });

  it("marks changed source Evidence and its Claims stale, and missing source invalid", () => {
    const { index, traces } = fixtures();
    const adapted = adaptWikiV2EvidenceAndClaims(index, traces, options);
    const staleEvidence = invalidateEvidenceForSourceChanges(
      adapted.evidence,
      {
        checkedAt: "2026-07-28T09:00:00Z",
        currentContentDigests: {
          "src/认证 auth.ts": sha256Bytes("changed source"),
        },
      },
    );
    expect(staleEvidence[0]).toMatchObject({
      freshness: "stale",
    });
    const staleClaims = propagateEvidenceFreshnessToClaims(
      adapted.claims,
      staleEvidence,
      "2026-07-28T09:00:00Z",
    );
    expect(staleClaims[0]).toMatchObject({ freshness: "stale" });

    const invalidEvidence = invalidateEvidenceForSourceChanges(
      adapted.evidence,
      {
        checkedAt: "2026-07-28T10:00:00Z",
        currentContentDigests: { "src/认证 auth.ts": null },
      },
    );
    expect(invalidEvidence[0]).toMatchObject({
      freshness: "invalid",
      invalidationReason: "source_missing",
    });
    const invalidClaims = propagateEvidenceFreshnessToClaims(
      adapted.claims,
      invalidEvidence,
      "2026-07-28T10:00:00Z",
    );
    expect(invalidClaims[0]).toMatchObject({
      freshness: "invalid",
      lifecycleStatus: "invalidated",
    });

    const restoredSameEvidence = invalidateEvidenceForSourceChanges(
      invalidEvidence,
      {
        checkedAt: "2026-07-28T11:00:00Z",
        currentContentDigests: {
          "src/认证 auth.ts": sha256Bytes(source),
        },
      },
    );
    expect(restoredSameEvidence[0]).toMatchObject({ freshness: "current" });
    expect(restoredSameEvidence[0]).not.toHaveProperty("freshnessReason");
    expect(restoredSameEvidence[0]).not.toHaveProperty("invalidatedAt");
    expect(restoredSameEvidence[0]).not.toHaveProperty("invalidationReason");
    // Evidence restoration alone cannot prove why a Claim was invalidated.
    // Keep the Claim fail-closed until an explicit lifecycle event replaces it.
    expect(
      propagateEvidenceFreshnessToClaims(
        invalidClaims,
        restoredSameEvidence,
        "2026-07-28T11:00:00Z",
      )[0],
    ).toEqual(invalidClaims[0]);

    const restoredChangedEvidence = invalidateEvidenceForSourceChanges(
      invalidEvidence,
      {
        checkedAt: "2026-07-28T11:00:00Z",
        currentContentDigests: {
          "src/认证 auth.ts": sha256Bytes("restored with different content"),
        },
      },
    );
    expect(restoredChangedEvidence[0]).toMatchObject({ freshness: "stale" });
    expect(restoredChangedEvidence[0]).toHaveProperty("freshnessReason");
    expect(restoredChangedEvidence[0]).not.toHaveProperty("invalidatedAt");
    expect(restoredChangedEvidence[0]).not.toHaveProperty(
      "invalidationReason",
    );
  });

  it("rejects dangling references, duplicate IDs, invalid ranges, and conflicting source digests", () => {
    const cases: Array<() => void> = [];

    {
      const { index, traces } = fixtures();
      traces.traces[0]!.claims[0]!.evidenceIds = ["missing"];
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      index.evidence.push(structuredClone(index.evidence[0]!));
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      index.evidence[0]!.lineRange = [1, 99];
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, {
          ...options,
          sourceContentDigests: {
            "src/认证 auth.ts": sha256Bytes("conflicting bytes"),
          },
        }),
      );
    }
    for (const execute of cases) {
      expect(execute).toThrow();
    }
  });

  it("rejects incomplete or inconsistent Wiki page, trace, Evidence, and node relationships", () => {
    const cases: Array<() => void> = [];

    {
      const { index, traces } = fixtures();
      traces.generatedAt = "2026-07-28T08:00:01Z";
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      delete (index as { pages?: WikiIndexV2EvidenceInput["pages"] }).pages;
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      delete (
        index.pages[0] as {
          directNodeIds?: string[];
        }
      ).directNodeIds;
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      traces.traces.push(structuredClone(traces.traces[0]!));
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      traces.traces[0]!.evidenceIds = [];
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      traces.traces[0]!.claims[0]!.nodeIds = ["symbol:unrelated"];
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      delete (
        index as {
          nodeDocumentation?: WikiIndexV2EvidenceInput["nodeDocumentation"];
        }
      ).nodeDocumentation;
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      index.nodeDocumentation![0]!.directPageIds = [];
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }

    for (const execute of cases) {
      expect(execute).toThrowError(
        expect.objectContaining({ code: "reference_integrity_failed" }),
      );
    }
  });

  it("mirrors Wiki V2 coverage and reciprocal node/evidence invariants", () => {
    const cases: Array<() => void> = [];

    {
      const { index, traces } = fixtures();
      index.nodeDocumentation[0]!.evidenceIds = [];
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      index.pages[0]!.directNodeIds.push("symbol:helper");
      traces.traces[0]!.directNodeIds.push("symbol:helper");
      index.nodeDocumentation.push({
        nodeId: "symbol:helper",
        directPageIds: ["page:auth"],
        contextPageIds: [],
        evidenceIds: [],
      });
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      traces.traces[0]!.claims = [];
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      index.evidence[0]!.nodeIds.push("symbol:missing-documentation");
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }
    {
      const { index, traces } = fixtures();
      const unrelatedEvidence = {
        ...structuredClone(index.evidence[0]!),
        id: "wiki-evidence-unrelated",
        nodeIds: ["symbol:unrelated"],
      };
      index.evidence.push(unrelatedEvidence);
      index.pages[0]!.evidenceIds.push(unrelatedEvidence.id);
      traces.traces[0]!.evidenceIds.push(unrelatedEvidence.id);
      index.nodeDocumentation.push({
        nodeId: "symbol:unrelated",
        directPageIds: [],
        contextPageIds: [],
        evidenceIds: [unrelatedEvidence.id],
      });
      cases.push(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      );
    }

    for (const execute of cases) {
      expect(execute).toThrowError(
        expect.objectContaining({ code: "reference_integrity_failed" }),
      );
    }

    const { index, traces } = fixtures();
    index.pages[0]!.quality = "needs-review";
    index.pages[0]!.generationStatus = "partial";
    traces.traces[0]!.quality = "needs-review";
    traces.traces[0]!.generationStatus = "partial";
    traces.traces[0]!.claims = [];
    expect(
      adaptWikiV2EvidenceAndClaims(index, traces, options),
    ).toMatchObject({
      claims: [],
      evidence: [{ nodeIds: ["symbol:auth"] }],
    });
  });

  it("verifies string and Uint8Array source anchors before sanitizing excerpts", () => {
    {
      const { index, traces } = fixtures();
      index.evidence[0]!.excerpt = "invented source excerpt";
      expect(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, options),
      ).toThrowError(
        expect.objectContaining({ code: "reference_integrity_failed" }),
      );
    }
    {
      const { index, traces } = fixtures();
      index.evidence[0]!.lineRange = [99, 99];
      delete index.evidence[0]!.excerpt;
      expect(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, {
          ...options,
          sourceContents: {
            "src/认证 auth.ts": new TextEncoder().encode(source),
          },
        }),
      ).toThrowError(
        expect.objectContaining({ code: "reference_integrity_failed" }),
      );
    }
    {
      const { index, traces } = fixtures();
      const adapted = adaptWikiV2EvidenceAndClaims(index, traces, {
        ...options,
        sourceContents: {
          "src/认证 auth.ts": new TextEncoder().encode(source),
        },
      });
      expect(adapted.evidence[0]).toMatchObject({
        lineRange: [2, 2],
        contentHash: sha256Bytes(new TextEncoder().encode(source)),
      });
    }
    {
      const { index, traces } = fixtures();
      index.evidence[0]!.lineRange = [999, 999];
      delete index.evidence[0]!.excerpt;
      const digestOnlyOptions = {
        ...options,
        sourceContents: undefined,
        sourceContentDigests: {
          "src/认证 auth.ts": sha256Bytes(source),
        },
      } as unknown as WikiV2EvidenceAdapterOptions;
      expect(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, digestOnlyOptions),
      ).toThrowError(
        expect.objectContaining({ code: "reference_integrity_failed" }),
      );
    }
  });

  it("hard-denies sensitive source paths before adapting Evidence", () => {
    for (const filePath of [
      ".env",
      ".env.production",
      ".npmrc",
      ".netrc",
      ".pypirc",
      ".aws/credentials",
      ".ssh/id_rsa",
      "backups/id_rsa.bak",
      "backups/id_ed25519.old",
      "config/client.key",
      "certificates/client.pem",
      "certificates/client.p12",
      "certificates/client.pfx",
      "config/application_default_credentials.json",
    ]) {
      const { index, traces } = fixtures();
      index.evidence[0]!.filePath = filePath;
      expect(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, {
          ...options,
          sourceContents: { [filePath]: source },
        }),
      ).toThrowError(expect.objectContaining({ code: "sensitive_path" }));
    }

    for (const filePath of [
      ".aws/config",
      ".ssh/config",
      "src/credentials.go",
      "src/tokenizer.ts",
      "src/TokenGate.tsx",
      "src/secrets/runtime.ts",
    ]) {
      const { index, traces } = fixtures();
      index.evidence[0]!.filePath = filePath;
      expect(() =>
        adaptWikiV2EvidenceAndClaims(index, traces, {
          ...options,
          sourceContents: { [filePath]: source },
        }),
      ).not.toThrow();
    }
  });

  it("sanitizes persisted legacy Claim statements", () => {
    const { index, traces } = fixtures();
    const highEntropyToken = "Qx7mV2pL9sK4dF8hJ3nR6tY1wC5bN0zA";
    traces.traces[0]!.claims[0]!.text = [
      "Cookie: session=claim-cookie-secret",
      "aws_secret_access_key=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCD",
      `opaque=${highEntropyToken}`,
      "Authentication still uses the source function.",
    ].join("\n");
    const statement = adaptWikiV2EvidenceAndClaims(
      index,
      traces,
      options,
    ).claims[0]!.statement;
    expect(statement).toContain("Authentication still uses the source function.");
    expect(statement).toContain("[REDACTED]");
    expect(statement).not.toContain("claim-cookie-secret");
    expect(statement).not.toContain("AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCD");
    expect(statement).not.toContain(highEntropyToken);
  });

  it("sanitizes common credentials without removing ordinary source text", () => {
    const highEntropyToken = "Qx7mV2pL9sK4dF8hJ3nR6tY1wC5bN0zA";
    const ordinaryDigest =
      "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const sanitized = sanitizeEvidenceExcerpt(
      [
        "user=alice",
        'password="hello world"',
        "client_secret=s3cr3t",
        "Authorization: Basic dXNlcjpwYXNz",
        "bearer lower.case.token",
        "github_token=ghp_abcdefghijklmnopqrstuvwxyz123456",
        "AKIAABCDEFGHIJKLMNOP",
        "Cookie: session=cookie-secret; csrftoken=csrf-secret",
        "prefix Cookie: session=inline-cookie-secret",
        "cookie=sessionid=assignment-cookie-secret",
        "Set-Cookie: session=set-cookie-secret; HttpOnly",
        "aws_secret_access_key=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCD",
        "DATABASE_URL=postgres://alice:database-password@example.test/app",
        `opaque=${highEntropyToken}`,
        ordinaryDigest,
        "ordinary=true",
      ].join("\n"),
    );
    expect(sanitized).toContain("user=alice");
    expect(sanitized).toContain("ordinary=true");
    expect(sanitized).toContain(ordinaryDigest);
    expect(sanitized).toContain('password="[REDACTED]"');
    expect(sanitized).not.toContain("hello");
    expect(sanitized).not.toContain("world");
    expect(sanitized).not.toContain("s3cr3t");
    expect(sanitized).not.toContain("dXNlcjpwYXNz");
    expect(sanitized).not.toContain("lower.case.token");
    expect(sanitized).not.toContain(
      "ghp_abcdefghijklmnopqrstuvwxyz123456",
    );
    expect(sanitized).not.toContain("AKIAABCDEFGHIJKLMNOP");
    expect(sanitized).not.toContain("cookie-secret");
    expect(sanitized).not.toContain("inline-cookie-secret");
    expect(sanitized).not.toContain("assignment-cookie-secret");
    expect(sanitized).not.toContain("set-cookie-secret");
    expect(sanitized).not.toContain(
      "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCD",
    );
    expect(sanitized).not.toContain("database-password");
    expect(sanitized).not.toContain(highEntropyToken);
  });
});
