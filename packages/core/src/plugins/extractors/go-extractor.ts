import type { StructuralAnalysis, CallGraphEntry } from "../../types.js";
import type { LanguageExtractor, TreeSitterNode } from "./types.js";
import { findChild, findChildren } from "./base-extractor.js";

/**
 * Extract parameter names from a Go `parameter_list` node.
 *
 * Each child `parameter_declaration` has one or more `identifier` name children
 * followed by a type node.  Go allows unnamed params (e.g. in interface method
 * signatures), which we skip since they have no user-visible name.
 */
function extractParams(paramsNode: TreeSitterNode | null): string[] {
  if (!paramsNode) return [];
  const params: string[] = [];

  const declarations = findChildren(paramsNode, "parameter_declaration");
  for (const decl of declarations) {
    // A parameter_declaration can have multiple name identifiers sharing
    // a type, e.g. `a, b int`.  Collect all identifiers.
    for (let i = 0; i < decl.childCount; i++) {
      const child = decl.child(i);
      if (child && child.type === "identifier") {
        params.push(child.text);
      }
    }
  }

  return params;
}

/**
 * Extract the return type text from a function/method declaration's `result` field.
 *
 * Go supports three forms:
 * - single type: `error` -> "error"
 * - pointer type: `*Server` -> "*Server"
 * - multiple returns via parameter_list: `(string, error)` -> "(string, error)"
 */
function extractResultType(node: TreeSitterNode): string | undefined {
  const result = node.childForFieldName("result");
  if (!result) return undefined;
  return result.text;
}

/**
 * Extract the receiver type name from a method_declaration's receiver parameter_list.
 * Returns the base type name (without pointer star), e.g. `(s *Server)` -> "Server".
 */
function extractReceiverType(receiverNode: TreeSitterNode): string | undefined {
  const decl = findChild(receiverNode, "parameter_declaration");
  if (!decl) return undefined;

  // Look for type_identifier directly or inside pointer_type
  for (let i = 0; i < decl.childCount; i++) {
    const child = decl.child(i);
    if (!child) continue;
    if (child.type === "type_identifier") {
      return child.text;
    }
    if (child.type === "pointer_type") {
      const typeId = findChild(child, "type_identifier");
      if (typeId) return typeId.text;
    }
  }
  return undefined;
}

/**
 * Check if a name is exported in Go (starts with an uppercase letter).
 */
function isExported(name: string): boolean {
  if (name.length === 0) return false;
  const first = name.charCodeAt(0);
  return first >= 65 && first <= 90; // A-Z
}

const GO_BUILTINS = new Set(["append", "cap", "clear", "close", "complex", "copy", "delete", "imag", "len", "make", "max", "min", "new", "panic", "print", "println", "real", "recover"]);

interface GoImportBinding {
  source: string;
  qualifier: string;
  isDefault: boolean;
}

function nodeText(node: TreeSitterNode | null): string | undefined {
  return node?.text;
}

function collectDeclarationNames(node: TreeSitterNode | null, output: Set<string>): void {
  if (!node) return;
  if (node.type === "identifier") {
    output.add(node.text);
    return;
  }
  for (let index = 0; index < node.childCount; index += 1) {
    const child = node.child(index);
    if (child) collectDeclarationNames(child, output);
  }
}

function collectPatternNames(node: TreeSitterNode | null, output: Set<string>): void {
  if (!node) return;
  if (node.type === "identifier") {
    output.add(node.text);
    return;
  }
  // A selector/index on the left side is an assignment, not a declaration.
  if (node.type === "selector_expression" || node.type === "index_expression") return;
  for (let index = 0; index < node.childCount; index += 1) {
    const child = node.child(index);
    if (child) collectPatternNames(child, output);
  }
}

function collectDeclarationSpecNames(node: TreeSitterNode, output: Set<string>): void {
  if (node.type === "var_spec" || node.type === "const_spec" || node.type === "type_spec") {
    for (const name of node.childrenForFieldName("name")) {
      if (name.type === "type_identifier") output.add(name.text);
      else collectPatternNames(name, output);
    }
  }
  for (let index = 0; index < node.childCount; index += 1) {
    const child = node.child(index);
    if (child) collectDeclarationSpecNames(child, output);
  }
}

/**
 * Go extractor for tree-sitter structural analysis and call graph extraction.
 *
 * Handles functions, methods, structs, interfaces, imports, exports, and
 * call graphs for Go source code.
 *
 * Go-specific mapping decisions:
 * - Structs and interfaces are mapped to the `classes` array.
 * - Methods (with receivers) are stored as functions and also listed
 *   in the corresponding struct's `methods` array.
 * - Exports are determined by Go's capitalization convention.
 */
export class GoExtractor implements LanguageExtractor {
  readonly languageIds = ["go"];

  extractStructure(rootNode: TreeSitterNode): StructuralAnalysis {
    const functions: StructuralAnalysis["functions"] = [];
    const classes: StructuralAnalysis["classes"] = [];
    const imports: StructuralAnalysis["imports"] = [];
    const exports: StructuralAnalysis["exports"] = [];
    const callableFunctions: string[] = [];
    const callableExports: Array<{ name: string; localName: string }> = [];

    // Track methods per receiver type so we can attach them to structs
    const methodsByReceiver = new Map<string, string[]>();

    for (let i = 0; i < rootNode.childCount; i++) {
      const node = rootNode.child(i);
      if (!node) continue;

      switch (node.type) {
        case "function_declaration":
          this.extractFunction(node, functions, exports);
          {
            const name = nodeText(node.childForFieldName("name"));
            if (name) {
              callableFunctions.push(name);
              if (isExported(name)) callableExports.push({ name, localName: name });
            }
          }
          break;

        case "method_declaration":
          this.extractMethod(node, functions, exports, methodsByReceiver);
          break;

        case "type_declaration":
          this.extractTypeDeclaration(node, classes, exports);
          break;

        case "import_declaration":
          this.extractImportDeclaration(node, imports);
          break;
      }
    }

    // Attach collected methods to their receiver structs/interfaces
    for (const cls of classes) {
      const methods = methodsByReceiver.get(cls.name);
      if (methods) {
        cls.methods.push(...methods);
      }
    }

    const packageClause = findChild(rootNode, "package_clause");
    const packageName = nodeText(packageClause
      ? packageClause.childForFieldName("name") ??
        findChild(packageClause, "package_identifier") ??
        findChild(packageClause, "identifier")
      : null);
    return { functions, classes, imports, exports, packageName, callableFunctions, callableExports };
  }

  extractCallGraph(rootNode: TreeSitterNode): CallGraphEntry[] {
    const entries: CallGraphEntry[] = [];
    const imports = this.collectImportBindings(rootNode);
    const hasDotImport = this.hasDotImport(rootNode);
    const packageScope = this.collectPackageScope(rootNode);
    const visitFunction = (node: TreeSitterNode): void => {
      const caller = nodeText(node.childForFieldName("name"));
      if (!caller) return;
      const shadowed = this.collectShadowedNames(node);
      for (const name of packageScope) shadowed.add(name);
      const body = node.childForFieldName("body");
      if (!body) return;
      const walk = (current: TreeSitterNode): void => {
        // Calls in function literals belong to the literal's closure. Without
        // a separate lexical function node, suppress them rather than attributing
        // them to the enclosing function.
        if (current !== body && current.type === "func_literal") return;
        if (current.type === "call_expression") {
          const calleeNode = current.childForFieldName("function");
          if (calleeNode) {
            const callee = calleeNode.text;
            const entry: CallGraphEntry = {
              caller,
              callee,
              lineNumber: current.startPosition.row + 1,
            };
            const binding = this.resolveCallBinding(calleeNode, callee, shadowed, imports, hasDotImport);
            if (binding) entry.binding = binding;
            entries.push(entry);
          }
        }
        for (let index = 0; index < current.childCount; index += 1) {
          const child = current.child(index);
          if (child) walk(child);
        }
      };
      walk(body);
    };
    for (let index = 0; index < rootNode.childCount; index += 1) {
      const node = rootNode.child(index);
      if (node?.type === "function_declaration" || node?.type === "method_declaration") visitFunction(node);
    }

    return entries;
  }

  private collectImportBindings(rootNode: TreeSitterNode): GoImportBinding[] {
    const bindings: GoImportBinding[] = [];
    for (let index = 0; index < rootNode.childCount; index += 1) {
      const declaration = rootNode.child(index);
      if (!declaration || declaration.type !== "import_declaration") continue;
      const specList = findChild(declaration, "import_spec_list");
      const specs = specList ? findChildren(specList, "import_spec") : [findChild(declaration, "import_spec")].filter((spec): spec is TreeSitterNode => spec !== null);
      for (const spec of specs) {
        const pathNode = spec.childForFieldName("path");
        if (!pathNode) continue;
        const pathContent = findChild(pathNode, "interpreted_string_literal_content");
        const source = pathContent ? pathContent.text : pathNode.text.replace(/^"|"$/g, "");
        const alias = spec.childForFieldName("name")?.text;
        if (alias === undefined) {
          const parts = source.split("/");
          bindings.push({ source, qualifier: parts[parts.length - 1], isDefault: true });
        } else if (alias !== "." && alias !== "_") {
          bindings.push({ source, qualifier: alias, isDefault: false });
        }
      }
    }
    return bindings;
  }

  private collectPackageScope(rootNode: TreeSitterNode): Set<string> {
    const names = new Set<string>();
    for (let index = 0; index < rootNode.childCount; index += 1) {
      const node = rootNode.child(index);
      if (node?.type === "var_declaration" || node?.type === "const_declaration" || node?.type === "type_declaration") {
        collectDeclarationSpecNames(node, names);
      }
    }
    return names;
  }

  private hasDotImport(rootNode: TreeSitterNode): boolean {
    for (let index = 0; index < rootNode.childCount; index += 1) {
      const declaration = rootNode.child(index);
      if (!declaration || declaration.type !== "import_declaration") continue;
      const specList = findChild(declaration, "import_spec_list");
      const specs = specList ? findChildren(specList, "import_spec") : [findChild(declaration, "import_spec")].filter((spec): spec is TreeSitterNode => spec !== null);
      if (specs.some((spec) => spec.childForFieldName("name")?.text === ".")) return true;
    }
    return false;
  }

  private collectShadowedNames(functionNode: TreeSitterNode): Set<string> {
    const names = new Set<string>();
    collectDeclarationNames(functionNode.childForFieldName("parameters"), names);
    collectDeclarationNames(functionNode.childForFieldName("receiver"), names);
    collectDeclarationNames(functionNode.childForFieldName("result"), names);
    const body = functionNode.childForFieldName("body");
    const walk = (node: TreeSitterNode): void => {
      if (node !== body && node.type === "func_literal") return;
      if (node.type === "short_var_declaration" || node.type === "range_clause") {
        collectPatternNames(node.childForFieldName("left"), names);
      } else if (node.type === "var_declaration" || node.type === "const_declaration" || node.type === "type_declaration") {
        collectDeclarationSpecNames(node, names);
      } else if (node.type === "receive_statement") {
        collectPatternNames(node.childForFieldName("left"), names);
      } else if (node.type === "type_switch_statement") {
        // The short declaration in a type switch can bind an alias without
        // exposing a stable field across grammar versions. Collecting its
        // identifiers conservatively prevents package-name guesses.
        collectDeclarationNames(node, names);
      }
      for (let index = 0; index < node.childCount; index += 1) {
        const child = node.child(index);
        if (child) walk(child);
      }
    };
    if (body) walk(body);
    return names;
  }

  private resolveCallBinding(
    calleeNode: TreeSitterNode,
    callee: string,
    shadowed: ReadonlySet<string>,
    imports: readonly GoImportBinding[],
    hasDotImport: boolean,
  ): CallGraphEntry["binding"] {
    if (calleeNode.type === "identifier") {
      if (GO_BUILTINS.has(callee) || shadowed.has(callee) || hasDotImport || imports.some((entry) => entry.qualifier === callee)) return undefined;
      return { kind: "package", name: callee };
    }
    if (calleeNode.type !== "selector_expression") return undefined;
    const object = calleeNode.childForFieldName("operand") ?? calleeNode.child(0);
    const qualifier = object?.type === "identifier" ? object.text : undefined;
    if (!qualifier || shadowed.has(qualifier)) return undefined;
    const imported = imports.filter((entry) => entry.qualifier === qualifier);
    if (imported.length !== 1) return undefined;
    const name = calleeNode.childForFieldName("field")?.text ?? callee.split(".").pop();
    if (!name) return undefined;
    return imported[0].isDefault
      ? { kind: "import", source: imported[0].source, name, packageName: qualifier }
      : { kind: "import", source: imported[0].source, name };
  }

  // ---- Private helpers ----

  private extractFunction(
    node: TreeSitterNode,
    functions: StructuralAnalysis["functions"],
    exports: StructuralAnalysis["exports"],
  ): void {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;

    const paramsNode = node.childForFieldName("parameters");
    const params = extractParams(paramsNode ?? null);
    const returnType = extractResultType(node);

    functions.push({
      name: nameNode.text,
      lineRange: [
        node.startPosition.row + 1,
        node.endPosition.row + 1,
      ],
      params,
      returnType,
    });

    if (isExported(nameNode.text)) {
      exports.push({
        name: nameNode.text,
        lineNumber: node.startPosition.row + 1,
      });
    }
  }

  private extractMethod(
    node: TreeSitterNode,
    functions: StructuralAnalysis["functions"],
    exports: StructuralAnalysis["exports"],
    methodsByReceiver: Map<string, string[]>,
  ): void {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;

    const paramsNode = node.childForFieldName("parameters");
    const params = extractParams(paramsNode ?? null);
    const returnType = extractResultType(node);

    functions.push({
      name: nameNode.text,
      lineRange: [
        node.startPosition.row + 1,
        node.endPosition.row + 1,
      ],
      params,
      returnType,
    });

    // Track receiver type for struct association
    const receiverNode = node.childForFieldName("receiver");
    if (receiverNode) {
      const receiverType = extractReceiverType(receiverNode);
      if (receiverType) {
        if (!methodsByReceiver.has(receiverType)) {
          methodsByReceiver.set(receiverType, []);
        }
        methodsByReceiver.get(receiverType)!.push(nameNode.text);
      }
    }

    if (isExported(nameNode.text)) {
      exports.push({
        name: nameNode.text,
        lineNumber: node.startPosition.row + 1,
      });
    }
  }

  private extractTypeDeclaration(
    node: TreeSitterNode,
    classes: StructuralAnalysis["classes"],
    exports: StructuralAnalysis["exports"],
  ): void {
    const typeSpec = findChild(node, "type_spec");
    if (!typeSpec) return;

    const nameNode = typeSpec.childForFieldName("name");
    const typeNode = typeSpec.childForFieldName("type");
    if (!nameNode || !typeNode) return;

    if (typeNode.type === "struct_type") {
      this.extractStruct(node, nameNode, typeNode, classes, exports);
    } else if (typeNode.type === "interface_type") {
      this.extractInterface(node, nameNode, typeNode, classes, exports);
    }
  }

  private extractStruct(
    declNode: TreeSitterNode,
    nameNode: TreeSitterNode,
    structNode: TreeSitterNode,
    classes: StructuralAnalysis["classes"],
    exports: StructuralAnalysis["exports"],
  ): void {
    const properties: string[] = [];

    const fieldList = findChild(structNode, "field_declaration_list");
    if (fieldList) {
      const fields = findChildren(fieldList, "field_declaration");
      for (const field of fields) {
        // A field_declaration can have multiple names: `X, Y int`
        for (let i = 0; i < field.childCount; i++) {
          const child = field.child(i);
          if (child && child.type === "field_identifier") {
            properties.push(child.text);
          }
        }
      }
    }

    classes.push({
      name: nameNode.text,
      lineRange: [
        declNode.startPosition.row + 1,
        declNode.endPosition.row + 1,
      ],
      methods: [], // Methods are attached later from methodsByReceiver
      properties,
    });

    if (isExported(nameNode.text)) {
      exports.push({
        name: nameNode.text,
        lineNumber: declNode.startPosition.row + 1,
      });
    }
  }

  private extractInterface(
    declNode: TreeSitterNode,
    nameNode: TreeSitterNode,
    interfaceNode: TreeSitterNode,
    classes: StructuralAnalysis["classes"],
    exports: StructuralAnalysis["exports"],
  ): void {
    const methods: string[] = [];

    const methodElems = findChildren(interfaceNode, "method_elem");
    for (const elem of methodElems) {
      const methName = elem.childForFieldName("name");
      if (methName) {
        methods.push(methName.text);
      }
    }

    classes.push({
      name: nameNode.text,
      lineRange: [
        declNode.startPosition.row + 1,
        declNode.endPosition.row + 1,
      ],
      methods,
      properties: [], // Interfaces have no properties
    });

    if (isExported(nameNode.text)) {
      exports.push({
        name: nameNode.text,
        lineNumber: declNode.startPosition.row + 1,
      });
    }
  }

  private extractImportDeclaration(
    node: TreeSitterNode,
    imports: StructuralAnalysis["imports"],
  ): void {
    // Grouped imports: import ( ... )
    const specList = findChild(node, "import_spec_list");
    if (specList) {
      const specs = findChildren(specList, "import_spec");
      for (const spec of specs) {
        this.extractImportSpec(spec, imports);
      }
    } else {
      // Single import: import "fmt"
      const spec = findChild(node, "import_spec");
      if (spec) {
        this.extractImportSpec(spec, imports);
      }
    }
  }

  private extractImportSpec(
    spec: TreeSitterNode,
    imports: StructuralAnalysis["imports"],
  ): void {
    const pathNode = spec.childForFieldName("path");
    if (!pathNode) return;

    // Extract unquoted path
    const pathContent = findChild(pathNode, "interpreted_string_literal_content");
    const source = pathContent ? pathContent.text : pathNode.text.replace(/^"|"$/g, "");

    // Determine the specifier: alias if present, otherwise last path component
    const nameNode = spec.childForFieldName("name");
    let specifier: string;
    if (nameNode) {
      specifier = nameNode.text;
    } else {
      // Use last path component, e.g. "net/http" -> "http"
      const parts = source.split("/");
      specifier = parts[parts.length - 1];
    }

    imports.push({
      source,
      specifiers: [specifier],
      lineNumber: spec.startPosition.row + 1,
    });
  }
}
