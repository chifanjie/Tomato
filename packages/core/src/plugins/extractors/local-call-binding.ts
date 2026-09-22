import type { TreeSitterNode } from "./types.js";

/**
 * Deliberately small proof for unqualified calls between top-level functions.
 * Any other use of the name (parameter, assignment, import, nested definition,
 * attribute, captured value) invalidates it for the whole file. This trades
 * recall for avoiding guessed edges in languages without a full scope binder.
 */
export function topLevelCallBinding(root: TreeSitterNode, definitionType: string) {
  const definitions = root.namedChildren.filter((node) => node.type === definitionType);
  const names = new Map<string, number>();
  const declarationIds = new Set<number>();
  const callerIds = new Set(definitions.map((node) => node.id));
  for (const definition of definitions) {
    const name = definition.childForFieldName("name");
    if (!name) continue;
    names.set(name.text, (names.get(name.text) ?? 0) + 1);
    declarationIds.add(name.id);
  }
  const safe = new Set([...names].filter(([, count]) => count === 1).map(([name]) => name));
  const walk = (node: TreeSitterNode): void => {
    // Star imports and generated/conditional module items have no unique
    // inventory-only binding proof in this limited resolver.
    if ((node.type === "call" && ["exec", "eval", "globals", "locals"].includes(node.childForFieldName("function")?.text ?? "")) ||
        node.type === "wildcard_import" || node.type === "use_wildcard" ||
        (node.parent?.id === root.id && node.type === "attribute_item")) safe.clear();
    if (node.type === "identifier" && safe.has(node.text) && !declarationIds.has(node.id)) {
      const parent = node.parent;
      const directCall = parent && ["call", "call_expression"].includes(parent.type) &&
        parent.childForFieldName("function")?.id === node.id;
      if (!directCall) safe.delete(node.text);
    }
    for (const child of node.namedChildren) walk(child);
  };
  walk(root);
  return (caller: TreeSitterNode | undefined, callee: TreeSitterNode | null) => {
    if (!caller || !callerIds.has(caller.id) || callee?.type !== "identifier" || !safe.has(callee.text)) return undefined;
    const body = caller.childForFieldName("body");
    if (!body || callee.startIndex < body.startIndex || callee.endIndex > body.endIndex) return undefined;
    for (let scope = callee.parent; scope && scope.id !== caller.id; scope = scope.parent) {
      if (["lambda", "closure_expression"].includes(scope.type)) return undefined;
    }
    return { kind: "local" as const, name: callee.text };
  };
}
