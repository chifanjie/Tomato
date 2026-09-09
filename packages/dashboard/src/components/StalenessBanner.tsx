import { useEffect, useState } from "react";

import { optionalDataUrl } from "../workbench/knowledgeContextLoader";
import { dashboardFetchInit } from "../workbench/transport";

/** The `staleness` block the dev server attaches to `/meta.json`. */
interface Staleness {
  readonly graphCommit: string | null;
  readonly headCommit: string | null;
  readonly commitsBehind: number | null;
  readonly stale: boolean;
}

function parseStaleness(value: unknown): Staleness | null {
  const block = (value as { staleness?: unknown } | null)?.staleness;
  if (typeof block !== "object" || block === null) return null;
  const candidate = block as Record<string, unknown>;
  if (candidate.stale !== true) return null;
  return {
    graphCommit: typeof candidate.graphCommit === "string" ? candidate.graphCommit : null,
    headCommit: typeof candidate.headCommit === "string" ? candidate.headCommit : null,
    commitsBehind: typeof candidate.commitsBehind === "number" ? candidate.commitsBehind : null,
    stale: true,
  };
}

export function stalenessSummary(staleness: Staleness): string {
  const short = staleness.graphCommit?.slice(0, 7) ?? "未知提交";
  return staleness.commitsBehind === null
    ? `图谱基于提交 ${short}，与当前检出的代码不一致`
    : `图谱落后当前代码 ${staleness.commitsBehind} 个提交（基于 ${short}）`;
}

/**
 * A graph is a snapshot of one commit. Without this banner a graph built
 * hundreds of commits ago renders exactly like a fresh one, and every
 * conclusion drawn from it silently describes code that has since changed.
 */
export default function StalenessBanner({ accessToken }: { readonly accessToken: string | null }) {
  const [staleness, setStaleness] = useState<Staleness | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          optionalDataUrl("meta.json", accessToken),
          dashboardFetchInit(accessToken),
        );
        if (!response.ok) return;
        const parsed = parseStaleness(await response.json());
        if (!cancelled) setStaleness(parsed);
      } catch {
        // Staleness is advisory; never block the reading surfaces on it.
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken]);

  if (staleness === null) return null;

  return (
    <div className="uc-status-banner" data-severity="problem" data-testid="graph-staleness-banner">
      <div className="uc-status-banner-toggle" role="status">
        <span className="uc-status-badge">图谱过期</span>
        <span className="uc-status-summary">{stalenessSummary(staleness)}</span>
        <span className="uc-status-disclosure">运行 /understand 重新生成</span>
      </div>
    </div>
  );
}
