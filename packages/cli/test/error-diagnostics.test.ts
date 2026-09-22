import { describe, expect, it, vi } from "vitest";
import { McpToolErrorResultV1Schema } from "@understand-code/contracts/mcp";
import { internalErrorFailure, revisionConflictFailure } from "../src/errors/tool-errors.js";

describe("redacted correlated error diagnostics", () => {
  it("refuses to project malformed or private revision-conflict details", () => {
    expect(revisionConflictFailure("/private/task-token", 6, 5)).toBeUndefined();
    expect(revisionConflictFailure("01ARZ3NDEKTSV4RRFFQ69G5FAV", 6, -1)).toBeUndefined();
    expect(revisionConflictFailure("01ARZ3NDEKTSV4RRFFQ69G5FAV", 6, "private-source")).toBeUndefined();
  });

  it("correlates a useful recovery step without logging exception content or arbitrary phase values", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    try {
      const error = Object.assign(new Error("/private/repo/password=secret-token\nsource code"), { code: "ENOSPC" });
      const result = McpToolErrorResultV1Schema.parse(internalErrorFailure(error, "refresh_index"));
      const diagnostic = String(stderr.mock.calls[0]?.[0]);
      const body = JSON.parse(diagnostic.slice(diagnostic.indexOf("{")));
      expect(result.structuredContent.error).toMatchObject({ code: "internal_error", details: { errorId: body.errorId } });
      expect(body).toMatchObject({ category: "disk_full", phase: "refresh_index" });
      expect(body.nextStep).toContain("Free disk space");
      expect(JSON.stringify(result)).toContain(body.errorId);
      expect(JSON.stringify(result)).toContain("understand-code doctor");
      expect(diagnostic).not.toMatch(/private|password|secret-token|source code/);
      internalErrorFailure(error, "/private/secret-phase");
      expect(String(stderr.mock.calls[1]?.[0])).toContain('"phase":"unknown"');
      expect(String(stderr.mock.calls[1]?.[0])).not.toContain("secret-phase");
    } finally { stderr.mockRestore(); }
  });
});
