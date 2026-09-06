import type { StructuralAnalysis, CallGraphEntry } from "../../types.js";
import type { LanguageExtractor, TreeSitterNode } from "./types.js";
import { getStringValue } from "./base-extractor.js";

/**
 * Extract parameter names from a formal_parameters node.
 */
function extractParams(paramsNode: TreeSitterNode | null): string[] {
  if (!paramsNode) return [];
  const params: string[] = [];
  for (let i = 0; i < paramsNode.childCount; i++) {
    const child = paramsNode.child(i);
    if (!child) continue;
    if (
      child.type === "required_parameter" ||
      child.type === "optional_parameter"
    ) {
      const ident =
        child.childForFieldName("pattern") ??
        child.childForFieldName("name");
      if (ident) {
        params.push(ident.text);
      } else {
        // Fallback: first identifier child
        for (let j = 0; j < child.childCount; j++) {
          const c = child.child(j);
          if (c && c.type === "identifier") {
            params.push(c.text);
            break;
          }
        }
      }
    } else if (child.type === "identifier") {
      // JavaScript parameters (no type annotation)
      params.push(child.text);
    } else if (
      child.type === "rest_pattern" ||
      child.type === "rest_element"
    ) {
      const ident = child.children.find(
        (c) => c.type === "identifier",
      );
      if (ident) params.push("..." + ident.text);
    }
  }
  return params;
}

/**
 * Extract return type annotation from a function-like node.
 */
function extractReturnType(
  node: TreeSitterNode,
): string | undefined {
  const typeAnnotation = node.childForFieldName("return_type");
  if (typeAnnotation && typeAnnotation.type === "type_annotation") {
    const text = typeAnnotation.text;
    return text.startsWith(":") ? text.slice(1).trim() : text;
  }
  return undefined;
}

/**
 * Extract import specifiers from an import_clause node.
 */
function extractImportSpecifiers(
  importClause: TreeSitterNode,
): string[] {
  const specifiers: string[] = [];

  for (let i = 0; i < importClause.childCount; i++) {
    const child = importClause.child(i);
    if (!child) continue;

    if (child.type === "named_imports") {
      for (let j = 0; j < child.childCount; j++) {
        const spec = child.child(j);
        if (spec && spec.type === "import_specifier") {
          const alias = spec.childForFieldName("alias");
          const name = spec.childForFieldName("name");
          specifiers.push(
            alias ? alias.text : name ? name.text : spec.text,
          );
        }
      }
    } else if (child.type === "namespace_import") {
      const ident = child.children.find(
        (c) => c.type === "identifier",
      );
      if (ident) specifiers.push("* as " + ident.text);
    } else if (child.type === "identifier") {
      // default import: import foo from '...'
      specifiers.push(child.text);
    }
  }

  return specifiers;
}

type StaticBinding =
  | { kind: "local"; name: string }
  | { kind: "import"; source: string; name: string };

interface BindingContext {
  localNames: Set<string>;
  blockedLocalNames: Set<string>;
  imports: Map<string, { source: string; name: string }>;
  callableExports: Array<{ name: string; localName: string }>;
}

function addPatternNames(node: TreeSitterNode | null, names: Set<string>): void {
  if (!node) return;
  if (node.type === "identifier" || node.type === "shorthand_property_identifier_pattern") {
    names.add(node.text);
    return;
  }
  for (const child of node.children) addPatternNames(child, names);
}

function functionName(node: TreeSitterNode): string | undefined {
  if (node.type === "function_declaration") {
    return (node.childForFieldName("name") ?? node.children.find((c) => c.type === "identifier"))?.text;
  }
  if (node.type === "method_definition") {
    return node.children.find((c) => c.type === "property_identifier")?.text;
  }
  if (node.type === "arrow_function" || node.type === "function_expression") {
    const parent = node.parent;
    if (parent?.type === "variable_declarator") return parent.childForFieldName("name")?.text;
  }
  return undefined;
}

function isFunctionLike(node: TreeSitterNode): boolean {
  return node.type === "function_declaration" || node.type === "method_definition" ||
    node.type === "arrow_function" || node.type === "function_expression" || node.type === "function";
}

function directDeclarations(scope: TreeSitterNode): Set<string> {
  const names = new Set<string>();
  const addDeclaration = (node: TreeSitterNode) => {
    for (const child of node.children) {
      if (child.type !== "variable_declarator") continue;
      addPatternNames(child.childForFieldName("name"), names);
    }
  };
  for (const child of scope.children) {
    if (child.type === "lexical_declaration" || child.type === "variable_declaration") addDeclaration(child);
    else if (child.type === "function_declaration" || child.type === "class_declaration") {
      const name = child.childForFieldName("name") ?? child.children.find((c) => c.type === "identifier" || c.type === "type_identifier");
      if (name) names.add(name.text);
    }
  }
  if (scope.type === "for_statement" || scope.type === "for_in_statement" || scope.type === "for_of_statement") {
    for (const field of ["initializer", "left"]) {
      const declaration = scope.childForFieldName(field);
      if (declaration?.type === "lexical_declaration" || declaration?.type === "variable_declaration") addDeclaration(declaration);
      else addPatternNames(declaration, names);
    }
  }
  return names;
}

function hoistedVarNames(node: TreeSitterNode, names: Set<string>): void {
  const visit = (current: TreeSitterNode) => {
    if (current !== node && isFunctionLike(current)) return;
    if (current.type === "variable_declaration") {
      for (const child of current.children) if (child.type === "variable_declarator") addPatternNames(child.childForFieldName("name"), names);
    }
    for (const child of current.children) visit(child);
  };
  visit(node);
}

function mutatedNames(node: TreeSitterNode, names: Set<string>): void {
  const visit = (current: TreeSitterNode) => {
    if (current !== node && isFunctionLike(current)) return;
    if (current.type === "assignment_expression" || current.type === "augmented_assignment_expression") {
      addPatternNames(current.childForFieldName("left") ?? current.childForFieldName("assignee"), names);
    } else if (current.type === "update_expression") {
      addPatternNames(current.childForFieldName("argument"), names);
    }
    for (const child of current.children) visit(child);
  };
  visit(node);
}

/**
 * TypeScript/JavaScript extractor.
 *
 * Handles structural analysis and call-graph extraction for
 * TypeScript and JavaScript ASTs produced by tree-sitter.
 */
export class TypeScriptExtractor implements LanguageExtractor {
  readonly languageIds = ["typescript", "javascript"];

  extractStructure(rootNode: TreeSitterNode): StructuralAnalysis {
    const functions: StructuralAnalysis["functions"] = [];
    const classes: StructuralAnalysis["classes"] = [];
    const imports: StructuralAnalysis["imports"] = [];
    const exports: StructuralAnalysis["exports"] = [];
    const exportedNames = new Set<string>();

    for (let i = 0; i < rootNode.childCount; i++) {
      const node = rootNode.child(i);
      if (!node) continue;
      this.processTopLevelNode(
        node,
        functions,
        classes,
        imports,
        exports,
        exportedNames,
      );
    }

    const context = this.buildBindingContext(rootNode);
    const reExports = this.extractReExports(rootNode, context);
    for (const entry of reExports) {
      if (!imports.some((item) => item.source === entry.source && item.lineNumber === entry.lineNumber)) {
        imports.push({ source: entry.source, specifiers: [], lineNumber: entry.lineNumber });
      }
    }
    return {
      functions,
      classes,
      imports,
      exports,
      callableExports: context.callableExports,
      reExports,
    };
  }

  extractCallGraph(rootNode: TreeSitterNode): CallGraphEntry[] {
    const entries: CallGraphEntry[] = [];
    const context = this.buildBindingContext(rootNode);

    const walkFunction = (node: TreeSitterNode, caller: string, allowBinding: boolean): void => {
      const blocked = new Set<string>();
      addPatternNames(node.childForFieldName("parameters"), blocked);
      const body = node.childForFieldName("body");
      if (!body) return;
      mutatedNames(body, blocked);
      hoistedVarNames(body, blocked);

      const walkScope = (current: TreeSitterNode, scopeBlocked: Set<string>, bindingsAllowed: boolean): void => {
        // A block's lexical declarations shadow outer bindings throughout that block.
        const nextBlocked = new Set(scopeBlocked);
        if (current.type === "statement_block" || current.type === "switch_body" || current.type === "class_body") {
          for (const name of directDeclarations(current)) nextBlocked.add(name);
        } else if (current.type === "catch_clause") {
          addPatternNames(current.childForFieldName("parameter"), nextBlocked);
        }

        if (current.type === "call_expression") {
          const callee = current.childForFieldName("function");
          if (callee) {
            const binding = bindingsAllowed ? this.resolveStaticBinding(callee, context, nextBlocked) : undefined;
            const entry: CallGraphEntry = {
              caller,
              callee: callee.text,
              lineNumber: current.startPosition.row + 1,
            };
            if (binding) entry.binding = binding;
            entries.push(entry);
          }
        }

        for (const child of current.children) {
          if (isFunctionLike(child)) {
            const nestedName = functionName(child);
            if (nestedName) {
              walkFunction(child, nestedName, false);
            } else {
              // Preserve the historical attribution for anonymous callbacks while
              // still honoring their parameter shadowing.
              const callbackBlocked = new Set(nextBlocked);
              addPatternNames(child.childForFieldName("parameters"), callbackBlocked);
              const callbackBody = child.childForFieldName("body");
              if (callbackBody) walkScope(callbackBody, callbackBlocked, false);
            }
            continue;
          }
          walkScope(child, nextBlocked, bindingsAllowed);
        }
      };
      walkScope(body, blocked, allowBinding);
    };

    const visitTopLevel = (node: TreeSitterNode): void => {
      if (isFunctionLike(node)) {
        const name = functionName(node);
        if (name) walkFunction(node, name, true);
        return;
      }
      if (node.type === "class_declaration") {
        const body = node.children.find((child) => child.type === "class_body");
        if (body) {
          for (const member of body.children) {
            if (member.type === "method_definition") {
              const name = functionName(member);
              if (name) walkFunction(member, name, true);
            }
          }
        }
        return;
      }
      for (const child of node.children) {
        if (isFunctionLike(child)) {
          const name = functionName(child);
          if (name) walkFunction(child, name, true);
        } else if (child.type === "export_statement" || child.type === "lexical_declaration" || child.type === "variable_declaration" || child.type === "variable_declarator") {
          visitTopLevel(child);
        }
      }
    };
    for (const child of rootNode.children) visitTopLevel(child);

    return entries;
  }

  // ---- Private extraction helpers ----

  private buildBindingContext(rootNode: TreeSitterNode): BindingContext {
    const localCounts = new Map<string, number>();
    const localNames = new Set<string>();
    const topLevelDeclaredNames = new Set<string>();
    const nonCallableTopLevelNames = new Set<string>();
    const imports = new Map<string, { source: string; name: string }>();
    const ambiguousImports = new Set<string>();
    const topLevelNodes: TreeSitterNode[] = [];

    const addLocal = (name: string | undefined) => {
      if (!name) return;
      topLevelDeclaredNames.add(name);
      localNames.add(name);
      localCounts.set(name, (localCounts.get(name) ?? 0) + 1);
    };
    const addImport = (local: string, binding: { source: string; name: string }) => {
      if (ambiguousImports.has(local)) return;
      const previous = imports.get(local);
      if (previous) {
        imports.delete(local);
        ambiguousImports.add(local);
      } else {
        imports.set(local, binding);
      }
    };

    for (const node of rootNode.children) {
      topLevelNodes.push(node);
      if (node.type === "import_statement") {
        const sourceNode = node.childForFieldName("source") ?? node.children.find((c) => c.type === "string");
        const source = sourceNode ? getStringValue(sourceNode) : undefined;
        const importClause = node.childForFieldName("import") ?? node.children.find((c) => c.type === "import_clause");
        if (!source || !importClause || node.children.some((c) => c.type === "type")) continue;
        for (const spec of importClause.children) {
          if (spec.type === "identifier") addImport(spec.text, { source, name: "default" });
          else if (spec.type === "namespace_import") {
            const ident = spec.children.find((c) => c.type === "identifier");
            // Namespace objects are resolved when their member is called.
            if (ident) addImport(ident.text, { source, name: "*" });
          } else if (spec.type === "named_imports") {
            for (const item of spec.children) {
              if (item.type !== "import_specifier" || item.children.some((c) => c.type === "type")) continue;
              const name = item.childForFieldName("name");
              const alias = item.childForFieldName("alias");
              if (name) addImport((alias ?? name).text, { source, name: name.text });
            }
          }
        }
        continue;
      }
      const declaration = node.type === "export_statement" ? node.childForFieldName("declaration") : node;
      if (!declaration) continue;
      if (declaration.type === "function_declaration") addLocal(functionName(declaration));
      else if (declaration.type === "lexical_declaration" || declaration.type === "variable_declaration") {
        for (const child of declaration.children) {
          if (child.type !== "variable_declarator") continue;
          addPatternNames(child.childForFieldName("name"), topLevelDeclaredNames);
          const value = child.childForFieldName("value");
          const isConst = declaration.children.some((token) => token.type === "const");
          if (isConst && value && (value.type === "arrow_function" || value.type === "function_expression" || value.type === "function")) {
            const name = child.childForFieldName("name");
            if (name?.type === "identifier") addLocal(name.text);
          } else {
            addPatternNames(child.childForFieldName("name"), nonCallableTopLevelNames);
          }
        }
      }
    }

    const blockedLocalNames = new Set<string>();
    for (const [name, count] of localCounts) if (count !== 1 || imports.has(name)) blockedLocalNames.add(name);
    for (const name of topLevelDeclaredNames) if (imports.has(name)) blockedLocalNames.add(name);
    for (const name of nonCallableTopLevelNames) if (localNames.has(name)) blockedLocalNames.add(name);
    for (const name of ambiguousImports) blockedLocalNames.add(name);

    // A top-level assignment can rebind an otherwise static function name.
    for (const node of topLevelNodes) {
      if (node.type === "import_statement") continue;
      if (isFunctionLike(node)) {
        const body = node.childForFieldName("body");
        if (body) mutatedNames(body, blockedLocalNames);
      } else if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
        for (const child of node.children) {
          if (child.type !== "variable_declarator") continue;
          const value = child.childForFieldName("value");
          const body = value && isFunctionLike(value) ? value.childForFieldName("body") : undefined;
          if (body) mutatedNames(body, blockedLocalNames);
        }
      } else if (node.type === "class_declaration") {
        const classBody = node.children.find((child) => child.type === "class_body");
        for (const method of classBody?.children ?? []) {
          if (method.type === "method_definition") {
            const body = method.childForFieldName("body");
            if (body) mutatedNames(body, blockedLocalNames);
          }
        }
      } else {
        mutatedNames(node, blockedLocalNames);
      }
    }

    const callableExports: Array<{ name: string; localName: string }> = [];
    const seenExports = new Set<string>();
    const addCallableExport = (name: string, localName: string) => {
      if (!localNames.has(localName) || blockedLocalNames.has(localName) || seenExports.has(name)) return;
      callableExports.push({ name, localName });
      seenExports.add(name);
    };
    for (const node of topLevelNodes) {
      if (node.type !== "export_statement" || node.children.some((child) => child.type === "type")) continue;
      const declaration = node.childForFieldName("declaration");
      if (declaration?.type === "function_declaration") {
        const localName = functionName(declaration);
        if (localName) addCallableExport(node.children.some((c) => c.type === "default") ? "default" : localName, localName);
      } else if (declaration?.type === "lexical_declaration" && declaration.children.some((token) => token.type === "const")) {
        for (const child of declaration.children) {
          if (child.type !== "variable_declarator") continue;
          const name = child.childForFieldName("name");
          if (name?.type === "identifier") addCallableExport(name.text, name.text);
        }
      }
      const clause = node.children.find((c) => c.type === "export_clause");
      if (clause && !node.childForFieldName("source") && !node.children.some((c) => c.type === "string")) {
        for (const spec of clause.children) {
          if (spec.type !== "export_specifier" || spec.children.some((child) => child.type === "type")) continue;
          const local = spec.childForFieldName("name");
          const alias = spec.childForFieldName("alias");
          if (local) addCallableExport((alias ?? local).text, local.text);
        }
      }
    }
    return { localNames, blockedLocalNames, imports, callableExports };
  }

  private extractReExports(root: TreeSitterNode, context: BindingContext): NonNullable<StructuralAnalysis["reExports"]> {
    const entries: NonNullable<StructuralAnalysis["reExports"]> = [];
    for (const node of root.children) {
      if (node.type !== "export_statement" || node.children.some((child) => child.type === "type")) continue;
      const sourceNode = node.childForFieldName("source");
      const source = sourceNode?.type === "string" ? sourceNode.text.slice(1, -1) : undefined;
      const lineNumber = node.startPosition.row + 1;
      const clause = node.children.find((child) => child.type === "export_clause");
      if (clause) {
        for (const spec of clause.children) {
          if (spec.type !== "export_specifier" || spec.children.some((child) => child.type === "type")) continue;
          const local = spec.childForFieldName("name");
          const alias = spec.childForFieldName("alias");
          if (!local || (local.type !== "identifier" && local.type !== "default")) continue;
          const name = (alias ?? local).text;
          if (source) entries.push({ source, name, importedName: local.text, lineNumber });
          else {
            const imported = context.imports.get(local.text);
            if (imported && !context.blockedLocalNames.has(local.text)) {
              entries.push({ source: imported.source, name, importedName: imported.name, lineNumber });
            }
          }
        }
      } else if (source) {
        const namespace = node.children.find((child) => child.type === "namespace_export");
        const name = namespace?.children.find((child) => child.type === "identifier")?.text;
        if (name) entries.push({ source, name, importedName: "*", lineNumber });
        else if (node.children.some((child) => child.type === "*")) {
          entries.push({ source, name: "*", importedName: "*", lineNumber });
        }
      }
    }
    return entries;
  }

  private resolveStaticBinding(
    callee: TreeSitterNode,
    context: BindingContext,
    blocked: Set<string>,
  ): StaticBinding | undefined {
    if (callee.type === "identifier") {
      if (blocked.has(callee.text)) return undefined;
      if (context.localNames.has(callee.text) && !context.blockedLocalNames.has(callee.text)) {
        return { kind: "local", name: callee.text };
      }
      const imported = context.imports.get(callee.text);
      if (imported && imported.name !== "*" && !context.blockedLocalNames.has(callee.text)) {
        return { kind: "import", source: imported.source, name: imported.name };
      }
      return undefined;
    }
    if (callee.type === "member_expression" && !callee.childForFieldName("optional")) {
      const object = callee.childForFieldName("object");
      const property = callee.childForFieldName("property");
      if (object?.type !== "identifier" || property?.type !== "property_identifier" || blocked.has(object.text)) return undefined;
      const imported = context.imports.get(object.text);
      if (imported?.name === "*" && !context.blockedLocalNames.has(object.text)) {
        return { kind: "import", source: imported.source, name: property.text };
      }
    }
    return undefined;
  }

  private processTopLevelNode(
    node: TreeSitterNode,
    functions: StructuralAnalysis["functions"],
    classes: StructuralAnalysis["classes"],
    imports: StructuralAnalysis["imports"],
    exports: StructuralAnalysis["exports"],
    exportedNames: Set<string>,
  ): void {
    switch (node.type) {
      case "function_declaration":
        this.extractFunction(node, functions);
        break;

      case "class_declaration":
        this.extractClass(node, classes);
        break;

      case "lexical_declaration":
      case "variable_declaration":
        this.extractVariableDeclarations(node, functions);
        break;

      case "import_statement":
        this.extractImport(node, imports);
        break;

      case "export_statement":
        this.processExportStatement(
          node,
          functions,
          classes,
          imports,
          exports,
          exportedNames,
        );
        break;
    }
  }

  private extractFunction(
    node: TreeSitterNode,
    functions: StructuralAnalysis["functions"],
  ): void {
    const nameNode =
      node.childForFieldName("name") ??
      node.children.find((c) => c.type === "identifier");
    if (!nameNode) return;

    const params = extractParams(
      node.childForFieldName("parameters") ??
        node.children.find(
          (c) => c.type === "formal_parameters",
        ) ??
        null,
    );
    const returnType = extractReturnType(node);

    functions.push({
      name: nameNode.text,
      lineRange: [
        node.startPosition.row + 1,
        node.endPosition.row + 1,
      ],
      params,
      returnType,
    });
  }

  private extractClass(
    node: TreeSitterNode,
    classes: StructuralAnalysis["classes"],
  ): void {
    const nameNode = node.children.find(
      (c) =>
        c.type === "type_identifier" || c.type === "identifier",
    );
    if (!nameNode) return;

    const methods: string[] = [];
    const properties: string[] = [];

    const classBody = node.children.find(
      (c) => c.type === "class_body",
    );
    if (classBody) {
      for (let j = 0; j < classBody.childCount; j++) {
        const member = classBody.child(j);
        if (!member) continue;

        if (member.type === "method_definition") {
          const methodName = member.children.find(
            (c) => c.type === "property_identifier",
          );
          if (methodName) methods.push(methodName.text);
        } else if (
          member.type === "public_field_definition" ||
          member.type === "property_definition"
        ) {
          const propName = member.children.find(
            (c) => c.type === "property_identifier",
          );
          if (propName) properties.push(propName.text);
        }
      }
    }

    classes.push({
      name: nameNode.text,
      lineRange: [
        node.startPosition.row + 1,
        node.endPosition.row + 1,
      ],
      methods,
      properties,
    });
  }

  private extractVariableDeclarations(
    node: TreeSitterNode,
    functions: StructuralAnalysis["functions"],
  ): void {
    for (let j = 0; j < node.childCount; j++) {
      const child = node.child(j);
      if (!child || child.type !== "variable_declarator") continue;

      const nameNode = child.childForFieldName("name");
      const valueNode = child.childForFieldName("value");

      if (
        nameNode &&
        valueNode &&
        (valueNode.type === "arrow_function" ||
          valueNode.type === "function_expression" ||
          valueNode.type === "function")
      ) {
        const params = extractParams(
          valueNode.childForFieldName("parameters") ??
            valueNode.children.find(
              (c) => c.type === "formal_parameters",
            ) ??
            null,
        );
        const returnType = extractReturnType(valueNode);

        functions.push({
          name: nameNode.text,
          lineRange: [
            node.startPosition.row + 1,
            node.endPosition.row + 1,
          ],
          params,
          returnType,
        });
      }
    }
  }

  private extractImport(
    node: TreeSitterNode,
    imports: StructuralAnalysis["imports"],
  ): void {
    const sourceNode = node.children.find(
      (c) => c.type === "string",
    );
    if (!sourceNode) return;

    const source = getStringValue(sourceNode);
    const specifiers: string[] = [];

    const importClause = node.children.find(
      (c) => c.type === "import_clause",
    );
    if (importClause) {
      specifiers.push(...extractImportSpecifiers(importClause));
    }

    imports.push({
      source,
      specifiers,
      lineNumber: node.startPosition.row + 1,
    });
  }

  private processExportStatement(
    node: TreeSitterNode,
    functions: StructuralAnalysis["functions"],
    classes: StructuralAnalysis["classes"],
    _imports: StructuralAnalysis["imports"],
    exports: StructuralAnalysis["exports"],
    exportedNames: Set<string>,
  ): void {
    for (let j = 0; j < node.childCount; j++) {
      const child = node.child(j);
      if (!child) continue;

      switch (child.type) {
        case "function_declaration": {
          this.extractFunction(child, functions);
          const nameNode =
            child.childForFieldName("name") ??
            child.children.find((c) => c.type === "identifier");
          const isDefault = node.children.some((c) => c.type === "default");
          if (nameNode && !exportedNames.has(nameNode.text)) {
            exports.push({
              name: nameNode.text,
              lineNumber: node.startPosition.row + 1,
              isDefault,
            });
            exportedNames.add(nameNode.text);
          } else if (!nameNode && isDefault && !exportedNames.has("default")) {
            // `export default function () {}` — anonymous default export
            exports.push({
              name: "default",
              lineNumber: node.startPosition.row + 1,
              isDefault: true,
            });
            exportedNames.add("default");
          }
          break;
        }

        case "class_declaration": {
          this.extractClass(child, classes);
          const nameNode = child.children.find(
            (c) =>
              c.type === "type_identifier" ||
              c.type === "identifier",
          );
          const isDefault = node.children.some(
            (c) => c.type === "default",
          );
          if (nameNode && !exportedNames.has(nameNode.text)) {
            const exportName = isDefault
              ? "default"
              : nameNode.text;
            exports.push({
              name: exportName,
              lineNumber: node.startPosition.row + 1,
              isDefault,
            });
            exportedNames.add(exportName);
          }
          break;
        }

        case "enum_declaration":
        case "internal_module":
        case "module": {
          // Runtime enum/namespace/module bindings shadow a star export just
          // like a non-callable const. Keep them in the explicit export set so
          // the call resolver does not invent a callable target behind them.
          const nameNode =
            child.childForFieldName("name") ??
            child.children.find((c) => c.type === "identifier");
          if (!nameNode) break;
          const isDefault = node.children.some((c) => c.type === "default");
          const exportName = isDefault ? "default" : nameNode.text;
          if (!exportedNames.has(exportName)) {
            exports.push({
              name: exportName,
              lineNumber: node.startPosition.row + 1,
              ...(isDefault ? { isDefault: true } : {}),
            });
            exportedNames.add(exportName);
          }
          break;
        }

        case "lexical_declaration":
        case "variable_declaration": {
          this.extractVariableDeclarations(child, functions);
          for (let k = 0; k < child.childCount; k++) {
            const declarator = child.child(k);
            if (
              declarator &&
              declarator.type === "variable_declarator"
            ) {
              const nameNode =
                declarator.childForFieldName("name");
              if (
                nameNode &&
                !exportedNames.has(nameNode.text)
              ) {
                exports.push({
                  name: nameNode.text,
                  lineNumber: node.startPosition.row + 1,
                });
                exportedNames.add(nameNode.text);
              }
            }
          }
          break;
        }

        case "export_clause": {
          for (let k = 0; k < child.childCount; k++) {
            const spec = child.child(k);
            if (spec && spec.type === "export_specifier") {
              const alias = spec.childForFieldName("alias");
              const name = spec.childForFieldName("name");
              const exportName = alias
                ? alias.text
                : name
                  ? name.text
                  : spec.text;
              const isTypeOnly = node.children.some((c) => c.type === "type") || spec.children.some((c) => c.type === "type");
              // TypeScript permits a type and a value to share an export name.
              // Keep a type-only record for diagnostics, but do not let it mark
              // the runtime name as already exported; a later value export must
              // remain visible to the call resolver.
              if (!exportedNames.has(exportName)) {
                exports.push({
                  name: exportName,
                  lineNumber: node.startPosition.row + 1,
                  ...(isTypeOnly ? { isTypeOnly: true } : {}),
                });
                if (!isTypeOnly) exportedNames.add(exportName);
              }
            }
          }
          break;
        }
      }
    }
  }
}
