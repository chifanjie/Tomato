/** A page body can be inline (legacy) or an ordered sequence of shared raw lines. */
export interface WikiSearchContentRecord {
  readonly content?: string;
  readonly contentLineIds?: readonly number[];
}

export interface WikiSearchContentOptions {
  readonly normalizeLine: (line: string) => string;
  readonly separator: "\n" | " ";
  readonly skipEmptyLines?: boolean;
}

/**
 * Search shared Markdown without expanding every page's body. Normalization and
 * per-line query results are shared; bounded boundary windows preserve phrases
 * across any number of lines, including empty lines and repeated references.
 */
export function createWikiSearchContentMatcher(
  contentLines: readonly string[] = [],
  options: WikiSearchContentOptions,
): {
  lines(record: WikiSearchContentRecord): Iterable<string>;
  includes(record: WikiSearchContentRecord, normalizedQuery: string): boolean;
} {
  const normalizedLines = new Map<number, string>();
  const inlineLines = new WeakMap<WikiSearchContentRecord, string[]>();
  const queryResults = new Map<string, Uint8Array>();
  const queryCacheCapacity = contentLines.length === 0 ? 128
    : Math.min(128, Math.max(1, Math.floor(64 * 1024 * 1024 / contentLines.length)));

  function rawLine(id: number): string {
    const line = contentLines[id];
    if (!Number.isInteger(id) || id < 0 || line === undefined) throw new RangeError(`Missing search content line ${id}`);
    return line;
  }

  function normalizedLine(id: number): string {
    let normalized = normalizedLines.get(id);
    if (normalized === undefined) {
      normalized = options.normalizeLine(rawLine(id));
      normalizedLines.set(id, normalized);
    }
    return normalized;
  }

  function* lines(record: WikiSearchContentRecord): Iterable<string> {
    if (record.contentLineIds !== undefined) {
      for (const id of record.contentLineIds) yield rawLine(id);
    } else if (record.content !== undefined) {
      yield* record.content.split("\n");
    }
  }

  function includes(record: WikiSearchContentRecord, query: string): boolean {
    if (query.length === 0) return true;
    let lineMatches = queryResults.get(query);
    if (lineMatches === undefined) {
      if (queryResults.size >= queryCacheCapacity) queryResults.delete(queryResults.keys().next().value!);
      lineMatches = new Uint8Array(contentLines.length);
      queryResults.set(query, lineMatches);
    }
    let tail = "";
    let hasLine = false;
    const tailLength = query.length - 1;
    const visit = (line: string, matched: boolean): boolean => {
      if (options.skipEmptyLines === true && line.length === 0) return false;
      if (matched) return true;
      if (hasLine && (tail + options.separator + line.slice(0, tailLength)).includes(query)) return true;
      tail = tailLength === 0 ? "" : (line.length >= tailLength
        ? line.slice(-tailLength)
        : (tail + (hasLine ? options.separator : "") + line).slice(-tailLength));
      hasLine = true;
      return false;
    };
    if (record.contentLineIds !== undefined) {
      for (const id of record.contentLineIds) {
        const line = normalizedLine(id);
        let matched = lineMatches[id];
        if (matched === 0) {
          matched = line.includes(query) ? 2 : 1;
          lineMatches[id] = matched;
        }
        if (visit(line, matched === 2)) return true;
      }
    } else {
      let normalized = inlineLines.get(record);
      if (normalized === undefined) {
        normalized = record.content === undefined ? [] : record.content.split("\n").map(options.normalizeLine);
        inlineLines.set(record, normalized);
      }
      for (const line of normalized) if (visit(line, line.includes(query))) return true;
    }
    return false;
  }

  return { lines, includes };
}
