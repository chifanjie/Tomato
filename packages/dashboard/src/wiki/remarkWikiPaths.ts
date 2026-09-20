import type { Root, RootContent } from "mdast";

// Keep URLs, API endpoints, and prose such as 输入/输出 unchanged.
const PATH = /(?:[A-Za-z]:[\\/][^\s<>"'`，。；、（）()]+|\/(?:Users|home|var|opt|tmp|workspace|workspaces)\/[^\s<>"'`，。；、（）()]+|(?:\.{1,2}\/)?[\w@.-]+(?:\/[\w@.\-\p{Script=Han}]+)+\.[A-Za-z][\w.-]*(?::\d+(?:-\d+)?)?)/gu;

export function isWikiFilePath(value: string): boolean {
  const matches = [...value.matchAll(PATH)];
  return matches.length === 1 && matches[0]?.[0] === value;
}

export default function remarkWikiPaths() {
  return (tree: Root) => {
    function visit(parent: { children: RootContent[] }) {
      parent.children = parent.children.flatMap((node): RootContent[] => {
        if (["link", "linkReference", "code", "inlineCode", "html"].includes(node.type)) return [node];
        if (node.type !== "text") {
          if ("children" in node) visit(node as unknown as { children: RootContent[] });
          return [node];
        }
        const result: RootContent[] = [];
        let start = 0;
        for (const match of node.value.matchAll(PATH)) {
          const index = match.index!;
          if (index > 0 && !/[\s（(：:，,\[【]/u.test(node.value[index - 1]!)) continue;
          const prefix = node.value.slice(0, index);
          if (/\b(?:https?|file):\/*$/iu.test(prefix) || /\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*$/u.test(prefix)) continue;
          const value = match[0].replace(/[.,;:]+$/u, "");
          if (index > start) result.push({ type: "text", value: node.value.slice(start, index) });
          result.push({ type: "inlineCode", value });
          start = index + value.length;
        }
        if (!result.length) return [node];
        if (start < node.value.length) result.push({ type: "text", value: node.value.slice(start) });
        return result;
      });
    }
    visit(tree as unknown as { children: RootContent[] });
  };
}
