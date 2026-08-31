import { createContext } from "react";

export interface PublishedKnowledgeVersion {
  readonly status: "current" | "historical";
  readonly generationId: string;
  readonly sourceSnapshotId: string;
  readonly currentSnapshotId: string;
  readonly finalizedProviderRevision: number;
}

export const KnowledgeFetchContext = createContext<typeof fetch | undefined>(undefined);
const GENERATION_ID = /^generation-[0-9a-f]{64}$/u;

export function parsePublishedKnowledgeVersion(value: unknown): PublishedKnowledgeVersion {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("知识版本信息无效");
  const version = value as Record<string, unknown>;
  const snapshotId = (id: unknown): id is string => typeof id === "string"
    && id.length > 0 && id.length <= 256 && !/[\s\u0000-\u001f\u007f]/u.test(id);
  if (
    !["current", "historical"].includes(String(version.status))
    || typeof version.generationId !== "string" || !GENERATION_ID.test(version.generationId)
    || !snapshotId(version.sourceSnapshotId) || !snapshotId(version.currentSnapshotId)
    || !Number.isSafeInteger(version.finalizedProviderRevision)
    || (version.finalizedProviderRevision as number) < 1
    || (version.status === "current") !== (version.sourceSnapshotId === version.currentSnapshotId)
  ) throw new Error("知识版本信息无效");
  return Object.freeze({
    status: version.status as PublishedKnowledgeVersion["status"],
    generationId: version.generationId,
    sourceSnapshotId: version.sourceSnapshotId,
    currentSnapshotId: version.currentSnapshotId,
    finalizedProviderRevision: version.finalizedProviderRevision as number,
  });
}

/** Scope only knowledge reads; Task/Evidence requests never use this transport. */
export function createPublishedKnowledgeFetcher(
  generationId: string,
  fetcher: typeof fetch = fetch,
): typeof fetch {
  if (!GENERATION_ID.test(generationId)) throw new Error("知识版本编号无效");
  return (input, init) => {
    if (typeof input !== "string" || !input.startsWith("/") || input.startsWith("//")) {
      return Promise.reject(new Error("已发布知识只支持本地只读路径"));
    }
    const url = new URL(input, "http://knowledge.local");
    if (url.origin !== "http://knowledge.local" || !(
      ["/knowledge-graph.json", "/meta.json"].includes(url.pathname)
      || url.pathname.startsWith("/knowledge-base/")
    )) return Promise.reject(new Error("不是知识库读取路径"));
    url.searchParams.set("indexVersion", "published");
    url.searchParams.set("indexGenerationId", generationId);
    return fetcher(`${url.pathname}${url.search}`, init);
  };
}
