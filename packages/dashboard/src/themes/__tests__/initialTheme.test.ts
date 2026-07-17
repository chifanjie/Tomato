import { describe, expect, it, vi } from "vitest";
import {
  loadInitialMetaTheme,
  readInitialStoredTheme,
} from "../initialTheme";

describe("initial theme resolution", () => {
  it("reads v2 storage before meta", () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({
        version: 2,
        presetId: "engineering-workbench",
        accentId: "teal",
      })),
    };
    expect(readInitialStoredTheme(storage)).toEqual({ presetId: "night-ink" });
  });

  it("contains an unavailable storage getter and rejects unknown versions", () => {
    expect(readInitialStoredTheme({ getItem: () => { throw new Error("blocked"); } }))
      .toBeNull();
    expect(readInitialStoredTheme({
      getItem: () => JSON.stringify({ version: 99, presetId: "night-ink" }),
    })).toEqual({ presetId: "technical-document" });
  });

  it("normalizes an unversioned meta theme", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      theme: { presetId: "sage-paper", accentId: "emerald" },
    }), { status: 200 }));
    await expect(loadInitialMetaTheme("/meta.json", { fetcher }))
      .resolves.toEqual({ presetId: "sage-paper" });
  });

  it("falls back after timeout or fetch failure", async () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
    await expect(loadInitialMetaTheme("/meta.json", {
      fetcher,
      timeoutMs: 1,
    })).resolves.toEqual({ presetId: "technical-document" });
  });
});
