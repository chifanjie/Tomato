import type { WikiPageV2 } from "@understand-code/core/knowledge-base";
import type { WikiRuntimeIndex } from "./wikiIndex";

export interface ReferenceTreeNode {
  id: string;
  kind: "module" | "directory" | "file";
  label: string;
  path: string;
  pageId?: string;
  childIds: readonly string[];
}

export interface WikiNavigationModel {
  featured: {
    pages: readonly WikiPageV2[];
    expandedByDefault: true;
  };
  reference: {
    roots: readonly ReferenceTreeNode[];
    nodesById: ReadonlyMap<string, ReferenceTreeNode>;
    totalFiles: number;
    orphanPageIds: readonly string[];
    expandedByDefault: false;
  };
  maintenance: {
    pages: readonly WikiPageV2[];
    expandedByDefault: false;
  };
}

const collator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});
const FILE_OWNER_PREFIXES = ["file:", "config:", "schema:", "document:"] as const;

function filePathForPage(page: WikiPageV2): string | null {
  const ownerId = page.directNodeIds.find((id) =>
    FILE_OWNER_PREFIXES.some((prefix) => id.startsWith(prefix)),
  );
  if (!ownerId) return null;
  const prefix = FILE_OWNER_PREFIXES.find((item) => ownerId.startsWith(item));
  if (!prefix) return null;
  const path = ownerId
    .slice(prefix.length)
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!path || path.split("/").some((part) => !part || part === "." || part === "..")) {
    return null;
  }
  return path;
}

function nodeId(kind: ReferenceTreeNode["kind"], path: string): string {
  return `reference:${kind}:${encodeURIComponent(path)}`;
}

interface MutableReferenceTreeNode {
  id: string;
  kind: ReferenceTreeNode["kind"];
  label: string;
  path: string;
  pageId?: string;
  childIds: Set<string>;
}

export function buildPathTree(pages: readonly WikiPageV2[]): {
  nodesById: ReadonlyMap<string, ReferenceTreeNode>;
  orphanPageIds: readonly string[];
} {
  const mutable = new Map<string, MutableReferenceTreeNode>();
  const orphanPageIds: string[] = [];
  const ensure = (
    kind: ReferenceTreeNode["kind"],
    path: string,
    label: string,
  ): MutableReferenceTreeNode => {
    const id = nodeId(kind, path);
    const existing = mutable.get(id);
    if (existing) return existing;
    const created: MutableReferenceTreeNode = {
      id,
      kind,
      label,
      path,
      childIds: new Set(),
    };
    mutable.set(id, created);
    return created;
  };

  for (const page of pages) {
    const filePath = filePathForPage(page);
    if (!filePath) {
      orphanPageIds.push(page.id);
      continue;
    }
    const parts = filePath.split("/");
    const modulePath = parts.length > 1 ? parts[0]! : "";
    const module = ensure("module", modulePath, modulePath || "仓库根目录");
    let parent = module;
    for (let depth = 1; depth < parts.length - 1; depth += 1) {
      const path = parts.slice(0, depth + 1).join("/");
      const directory = ensure("directory", path, parts[depth]!);
      parent.childIds.add(directory.id);
      parent = directory;
    }
    const file = ensure("file", filePath, parts.at(-1)!);
    file.pageId = page.id;
    parent.childIds.add(file.id);
  }

  const nodesById = new Map<string, ReferenceTreeNode>();
  for (const item of mutable.values()) {
    nodesById.set(item.id, {
      id: item.id,
      kind: item.kind,
      label: item.label,
      path: item.path,
      ...(item.pageId ? { pageId: item.pageId } : {}),
      childIds: [...item.childIds].sort((left, right) =>
        collator.compare(mutable.get(left)!.label, mutable.get(right)!.label),
      ),
    });
  }
  return {
    nodesById,
    orphanPageIds: orphanPageIds.sort((left, right) => collator.compare(left, right)),
  };
}

export function rootNodes(
  nodesById: ReadonlyMap<string, ReferenceTreeNode>,
): ReferenceTreeNode[] {
  return [...nodesById.values()]
    .filter((node) => node.kind === "module")
    .sort((left, right) => collator.compare(left.label, right.label));
}

export function buildWikiNavigation(index: WikiRuntimeIndex): WikiNavigationModel {
  const referencePages = index.pages.filter(
    (page) => page.role === "reference" && page.category === "file",
  );
  const maintenance = index.pages.filter((page) => page.role === "maintenance");
  const { nodesById, orphanPageIds } = buildPathTree(referencePages);
  return {
    featured: {
      pages: index.routePages,
      expandedByDefault: true,
    },
    reference: {
      roots: rootNodes(nodesById),
      nodesById,
      totalFiles: referencePages.length,
      orphanPageIds,
      expandedByDefault: false,
    },
    maintenance: {
      pages: [...maintenance].sort((left, right) => collator.compare(left.title, right.title)),
      expandedByDefault: false,
    },
  };
}

export function loadReferenceChildren(
  model: WikiNavigationModel,
  parentNodeId: string,
): ReferenceTreeNode[] {
  const node = model.reference.nodesById.get(parentNodeId);
  if (!node) return [];
  return node.childIds.flatMap((childId) => {
    const child = model.reference.nodesById.get(childId);
    return child ? [child] : [];
  });
}

export function visibleReferenceRows(
  model: WikiNavigationModel,
  expandedNodeIds: ReadonlySet<string>,
): Array<{ node: ReferenceTreeNode; depth: number }> {
  const rows: Array<{ node: ReferenceTreeNode; depth: number }> = [];
  const visit = (node: ReferenceTreeNode, depth: number) => {
    rows.push({ node, depth });
    if (!expandedNodeIds.has(node.id)) return;
    for (const child of loadReferenceChildren(model, node.id)) {
      visit(child, depth + 1);
    }
  };
  for (const root of model.reference.roots) visit(root, 0);
  return rows;
}
