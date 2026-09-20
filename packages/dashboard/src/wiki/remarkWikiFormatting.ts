interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

const CHINESE_STRONG_LABEL = /\*\*([^*\n]+[：；，。！？])\*\*(?=\p{L})/gu;

function formatChineseLabels(node: MarkdownNode, source: string): MarkdownNode[] {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  // Escapes and character references change the parsed value; never reinterpret those literals.
  if (node.value === undefined || start === undefined || end === undefined
    || source.slice(start, end) !== node.value) return [node];

  const result: MarkdownNode[] = [];
  let cursor = 0;
  for (const match of node.value.matchAll(CHINESE_STRONG_LABEL)) {
    const index = match.index!;
    if (index > cursor) result.push({ type: "text", value: node.value.slice(cursor, index) });
    result.push({ type: "strong", children: [{ type: "text", value: match[1] }] });
    cursor = index + match[0].length;
  }
  if (!result.length) return [node];
  if (cursor < node.value.length) result.push({ type: "text", value: node.value.slice(cursor) });
  return result;
}

/** Adapt common generated Markdown patterns without enabling arbitrary HTML or rewriting code. */
export function remarkWikiFormatting() {
  return (tree: MarkdownNode, file: { value?: unknown }) => {
    const source = typeof file.value === "string" ? file.value : "";
    const visit = (node: MarkdownNode) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child): MarkdownNode[] => {
        if (child.type === "html" && /^<br\s*\/?\s*>$/iu.test(child.value ?? "")) {
          return [{ ...child, type: "break", value: undefined }];
        }
        if (child.type === "text") return formatChineseLabels(child, source);
        visit(child);
        return [child];
      });
    };
    visit(tree);
  };
}
