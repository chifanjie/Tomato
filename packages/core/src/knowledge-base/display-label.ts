/**
 * Wiki page titles are built from a node's bare name, which is not unique in a
 * real repository: this project alone has ten `index.ts` files and nine `main`
 * functions. A sidebar of ten identical "index.ts 文件参考" entries cannot be
 * navigated, and search results for them are indistinguishable.
 *
 * These helpers qualify a name with the shortest trailing path fragment that
 * makes it unique, so unique names stay short and only collisions grow.
 */

export interface LabelEntry {
  /** Stable identity of the thing being labelled (node id, document path…). */
  readonly id: string;
  /** The bare display name, e.g. `index.ts` or `main`. */
  readonly name: string;
  /** Source path used to disambiguate, e.g. `packages/core/src/index.ts`. */
  readonly filePath: string;
}

function segments(filePath: string): string[] {
  return filePath.split("/").filter(Boolean);
}

/**
 * Returns the last `count` path segments, excluding the file name itself when
 * the name already carries it (a file node's name is its basename).
 */
function tail(parts: readonly string[], count: number): string {
  return parts.slice(Math.max(0, parts.length - count)).join("/");
}

/**
 * Builds a lookup from entry id to a display label that is unique across
 * `entries`. Names that already occur once are returned unchanged.
 */
export function buildUniqueLabels(
  entries: readonly LabelEntry[],
): ReadonlyMap<string, string> {
  const byName = new Map<string, LabelEntry[]>();
  for (const entry of entries) {
    byName.set(entry.name, [...(byName.get(entry.name) ?? []), entry]);
  }

  const labels = new Map<string, string>();
  for (const [name, group] of byName) {
    if (group.length === 1) {
      labels.set(group[0].id, name);
      continue;
    }

    // The parent directories are what differ; grow the qualifier one segment at
    // a time until every member of the group is distinguishable.
    const parents = new Map(
      group.map((entry) => {
        const parts = segments(entry.filePath);
        // Drop a trailing segment equal to the name so `a/b/index.ts` qualifies
        // as `b` rather than the redundant `index.ts`.
        return [entry.id, parts[parts.length - 1] === name ? parts.slice(0, -1) : parts];
      }),
    );
    const longest = Math.max(1, ...[...parents.values()].map((parts) => parts.length));

    let resolved = false;
    for (let depth = 1; depth <= longest; depth += 1) {
      const candidates = new Map<string, string>();
      const seen = new Set<string>();
      let unique = true;
      for (const entry of group) {
        const qualifier = tail(parents.get(entry.id) ?? [], depth);
        const label = qualifier ? `${name}（${qualifier}）` : name;
        if (seen.has(label)) {
          unique = false;
          break;
        }
        seen.add(label);
        candidates.set(entry.id, label);
      }
      if (unique) {
        for (const [id, label] of candidates) labels.set(id, label);
        resolved = true;
        break;
      }
    }

    // Identical paths cannot be separated by path; fall back to the full path.
    if (!resolved) {
      for (const entry of group) {
        labels.set(entry.id, `${name}（${entry.filePath}）`);
      }
    }
  }

  return labels;
}

/** Convenience for a single lookup with a safe fallback to the bare name. */
export function labelFor(
  labels: ReadonlyMap<string, string>,
  id: string,
  fallbackName: string,
): string {
  return labels.get(id) ?? fallbackName;
}
