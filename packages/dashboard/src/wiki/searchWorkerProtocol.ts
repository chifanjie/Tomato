import type { WikiSearchResults } from "./searchIndex";

interface RequestIdentity { generation: number; requestId: number }
export type SearchWorkerRequest = RequestIdentity & (
  | { kind: "initialize"; bytes: ArrayBuffer; pageIds: string[] }
  | { kind: "query"; query: string; page: number; pageSize: number }
);
export type SearchWorkerResponse = RequestIdentity & (
  | { kind: "initialized"; status: "ready" | "invalid" }
  | { kind: "results"; results: WikiSearchResults }
  | { kind: "error" }
);
