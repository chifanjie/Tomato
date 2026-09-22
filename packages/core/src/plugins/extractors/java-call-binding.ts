import type { StructuralAnalysis } from "../../types.js";
import type { ResolveCallsResult } from "../../analyzer/call-resolver.js";
import type { TreeSitterNode } from "./types.js";

interface JavaMethod {
  name: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  isConstructor: boolean;
  isStatic: boolean;
  isFinal: boolean;
  visibility: "public" | "protected" | "private" | "package";
  hasBody: boolean;
  parameterCount: number;
  varargs: boolean;
}
interface JavaType {
  name: string;
  qualifiedName: string;
  isFinal: boolean;
  isPublic: boolean;
  hasSupertypes: boolean;
  isClass: boolean;
  methods: JavaMethod[];
}
interface JavaImport { source: string; isStatic: boolean; wildcard: boolean }
interface JavaCall {
  callerSymbol: string;
  owner: string;
  name: string;
  displayName: string;
  lineNumber: number;
  argumentCount: number;
  receiver: "implicit" | "this" | "type" | "exact" | "unknown";
  receiverType?: string;
  declaredType?: string;
  reason?: string;
}
export interface JavaSourceBindings {
  packageName: string;
  imports: JavaImport[];
  types: JavaType[];
  calls: JavaCall[];
  syntaxError: boolean;
}
export type JavaStructuralAnalysis = StructuralAnalysis & { javaBindings: JavaSourceBindings };

function modifier(node: TreeSitterNode, keyword: string): boolean {
  return node.namedChildren.find((child) => child.type === "modifiers")?.children.some((child) => child.text === keyword) === true;
}
function typeReference(node: TreeSitterNode | null): string | undefined {
  if (!node) return undefined;
  if (node.type === "generic_type") return typeReference(node.namedChildren[0] ?? null);
  return ["identifier", "type_identifier", "scoped_type_identifier", "scoped_identifier"].includes(node.type) &&
    /^[\p{L}_$][\p{L}\p{N}_$]*(?:\.[\p{L}_$][\p{L}\p{N}_$]*)*$/u.test(node.text) ? node.text : undefined;
}
function visit(node: TreeSitterNode, action: (node: TreeSitterNode) => void): void {
  action(node);
  for (const child of node.namedChildren) visit(child, action);
}
function declaredName(node: TreeSitterNode): string | undefined {
  if (["variable_declarator", "formal_parameter", "spread_parameter", "catch_formal_parameter", "enhanced_for_statement",
    "class_declaration", "interface_declaration", "enum_declaration", "record_declaration"].includes(node.type)) {
    return node.childForFieldName("name")?.text;
  }
  return node.type === "type_parameter" ? node.namedChildren[0]?.text : undefined;
}

/** Detached AST facts: no parser nodes, project-global name guesses or source execution. */
export function extractJavaSourceBindings(root: TreeSitterNode): JavaSourceBindings {
  const packageNode = root.namedChildren.find((node) => node.type === "package_declaration");
  const packageName = packageNode?.namedChildren.find((node) => ["identifier", "scoped_identifier"].includes(node.type))?.text ?? "";
  const facts: JavaSourceBindings = { packageName, imports: [], types: [], calls: [], syntaxError: root.hasError };
  for (const node of root.namedChildren.filter((entry) => entry.type === "import_declaration")) {
    const source = node.namedChildren.find((entry) => ["identifier", "scoped_identifier"].includes(entry.type))?.text;
    if (source) facts.imports.push({ source, isStatic: node.children.some((child) => child.type === "static"),
      wildcard: node.namedChildren.some((child) => child.type === "asterisk") });
  }
  for (const typeNode of root.namedChildren.filter((node) => ["class_declaration", "interface_declaration"].includes(node.type))) {
    const name = typeNode.childForFieldName("name")?.text;
    const typeBody = typeNode.childForFieldName("body");
    if (!name || !typeBody) continue;
    const owner: JavaType = { name, qualifiedName: packageName ? `${packageName}.${name}` : name,
      isFinal: modifier(typeNode, "final"), isPublic: modifier(typeNode, "public"),
      hasSupertypes: typeNode.namedChildren.some((node) => ["superclass", "super_interfaces", "extends_interfaces"].includes(node.type)),
      isClass: typeNode.type === "class_declaration", methods: [] };
    const declarations = typeBody.namedChildren.filter((node) => ["method_declaration", "constructor_declaration"].includes(node.type));
    const counts = new Map<string, number>();
    for (const method of declarations) {
      const methodName = method.childForFieldName("name")?.text;
      if (methodName && method.type === "method_declaration") counts.set(methodName, (counts.get(methodName) ?? 0) + 1);
    }
    const typeShadows = new Set<string>();
    for (const declaration of typeBody.namedChildren.filter((node) => ["field_declaration", "class_declaration", "interface_declaration"].includes(node.type))) {
      visit(declaration, (child) => { const value = declaredName(child); if (value) typeShadows.add(value); });
    }
    const typeParameters = typeNode.childForFieldName("type_parameters");
    if (typeParameters) visit(typeParameters, (node) => { const value = declaredName(node); if (value) typeShadows.add(value); });
    for (const methodNode of declarations) {
      const methodName = methodNode.childForFieldName("name")?.text;
      if (!methodName) continue;
      const isConstructor = methodNode.type === "constructor_declaration";
      const parameters = methodNode.childForFieldName("parameters")?.namedChildren.filter((node) => ["formal_parameter", "spread_parameter"].includes(node.type)) ?? [];
      const method: JavaMethod = { name: methodName,
        symbolName: `${name}.${isConstructor ? "<init>" : methodName}${isConstructor || counts.get(methodName)! > 1 ? `@${methodNode.startIndex}` : ""}`,
        startLine: methodNode.startPosition.row + 1, endLine: methodNode.endPosition.row + 1, isConstructor,
        isStatic: modifier(methodNode, "static"), isFinal: modifier(methodNode, "final"),
        visibility: modifier(methodNode, "private") ? "private" : modifier(methodNode, "protected") ? "protected" : modifier(methodNode, "public") ? "public" : "package",
        hasBody: methodNode.childForFieldName("body") !== null, parameterCount: parameters.length,
        varargs: parameters.some((node) => node.type === "spread_parameter") };
      owner.methods.push(method);
      const body = methodNode.childForFieldName("body");
      if (!body) continue;
      const locals = new Map<string, { type: string; declaredType: string; startIndex: number }>();
      const declared = new Map<string, number>();
      const assigned = new Set<string>();
      visit(methodNode, (node) => {
        const value = declaredName(node);
        if (value) declared.set(value, (declared.get(value) ?? 0) + 1);
        const left = node.type === "assignment_expression" ? node.childForFieldName("left") : node.type === "update_expression" ? node.namedChildren[0] : undefined;
        if (left?.type === "identifier") assigned.add(left.text);
      });
      // Only direct method-block declarations with an explicit new expression
      // establish an exact receiver class; fields, parameters and aliases do not.
      for (const declaration of body.namedChildren.filter((node) => node.type === "local_variable_declaration")) {
        const declaredType = typeReference(declaration.childForFieldName("type"));
        for (const variable of declaration.namedChildren.filter((node) => node.type === "variable_declarator")) {
          const variableName = variable.childForFieldName("name")?.text;
          const value = variable.childForFieldName("value");
          const concreteType = value?.type === "object_creation_expression" && !value.namedChildren.some((node) => node.type === "class_body")
            ? typeReference(value.childForFieldName("type")) : undefined;
          if (variableName && declaredType && concreteType && declared.get(variableName) === 1 && !assigned.has(variableName) &&
              !declared.has(concreteType.split(".")[0]) && !typeShadows.has(concreteType.split(".")[0]) &&
              !declared.has(declaredType.split(".")[0]) && !typeShadows.has(declaredType.split(".")[0])) {
            locals.set(variableName, { type: concreteType, declaredType, startIndex: variable.endIndex });
          }
        }
      }
      const walkCalls = (node: TreeSitterNode, nested = false): void => {
        const unsupportedScope = nested || ["lambda_expression", "class_body", "class_declaration", "interface_declaration", "record_declaration", "enum_declaration"].includes(node.type);
        if (node.type === "method_invocation" || node.type === "object_creation_expression") {
          const callName = node.childForFieldName("name")?.text;
          const object = node.childForFieldName("object");
          const isCreation = node.type === "object_creation_expression";
          const call: JavaCall = { callerSymbol: method.symbolName, owner: owner.qualifiedName,
            name: callName ?? "<init>", displayName: isCreation ? `new ${node.childForFieldName("type")?.text ?? "unknown"}` : `${object ? `${object.text}.` : ""}${callName}`,
            lineNumber: node.startPosition.row + 1,
            argumentCount: node.childForFieldName("arguments")?.namedChildCount ?? 0,
            receiver: "unknown" };
          if (unsupportedScope) call.reason = "java-deferred-or-nested-scope";
          else if (isCreation) call.reason = "java-constructor-resolution-unsupported";
          else if (!object) call.receiver = "implicit";
          else if (object.type === "this") call.receiver = "this";
          else if (object.type === "identifier" && locals.has(object.text)) {
            const local = locals.get(object.text)!;
            if (node.startIndex >= local.startIndex) Object.assign(call, { receiver: "exact", receiverType: local.type, declaredType: local.declaredType });
            else call.reason = "java-receiver-not-initialized";
          } else if (object.type === "object_creation_expression" && !object.namedChildren.some((child) => child.type === "class_body")) {
            const type = typeReference(object.childForFieldName("type"));
            if (type && !declared.has(type.split(".")[0]) && !typeShadows.has(type.split(".")[0])) {
              Object.assign(call, { receiver: "exact", receiverType: type, declaredType: type });
            } else call.reason = "java-receiver-type-shadowed";
          } else if (/^[\p{L}_$][\p{L}\p{N}_$]*(?:\.[\p{L}_$][\p{L}\p{N}_$]*)*$/u.test(object.text)) {
            const first = object.text.split(".")[0];
            if (!declared.has(first) && !typeShadows.has(first) && !["this", "super"].includes(first)) {
              Object.assign(call, { receiver: "type", receiverType: object.text });
            } else call.reason = "java-receiver-shadowed-or-not-exact";
          } else call.reason = "java-receiver-type-unknown";
          facts.calls.push(call);
        }
        for (const child of node.namedChildren) walkCalls(child, unsupportedScope);
      };
      walkCalls(body);
    }
    facts.types.push(owner);
  }
  return facts;
}

export function javaBindingsOf(analysis: StructuralAnalysis): JavaSourceBindings | undefined {
  return (analysis as Partial<JavaStructuralAnalysis>).javaBindings;
}

/** Resolve only source-proven methods; virtual dispatch and overload selection remain explicit gaps. */
export function resolveJavaCalls(files: readonly { path: string; analysis: StructuralAnalysis }[]): ResolveCallsResult & {
  imports: Array<{ fromPath: string; toPath: string }>;
} {
  const calls: ResolveCallsResult["calls"] = [];
  const unresolved: ResolveCallsResult["unresolved"] = [];
  const imports: Array<{ fromPath: string; toPath: string }> = [];
  type LocatedType = { file: string; facts: JavaSourceBindings; type: JavaType };
  const byQualifiedName = new Map<string, LocatedType[]>();
  for (const file of files) {
    const facts = javaBindingsOf(file.analysis);
    if (!facts) continue;
    for (const type of facts.types) byQualifiedName.set(type.qualifiedName,
      [...(byQualifiedName.get(type.qualifiedName) ?? []), { file: file.path, facts, type }]);
  }
  const uniqueType = (name: string) => {
    const candidates = byQualifiedName.get(name) ?? [];
    return candidates.length === 1 ? candidates[0] : undefined;
  };
  const resolveType = (file: string, facts: JavaSourceBindings, name: string): LocatedType | undefined => {
    let target: LocatedType | undefined;
    if (name.includes(".")) target = uniqueType(name);
    else {
      const local = facts.types.filter((type) => type.name === name);
      const imported = facts.imports.filter((item) => !item.isStatic && !item.wildcard && item.source.split(".").at(-1) === name);
      if (local.length === 1) target = uniqueType(local[0].qualifiedName);
      else if (local.length > 1) return undefined;
      else if (imported.length > 0) target = imported.length === 1 ? uniqueType(imported[0].source) : undefined;
      else target = uniqueType(facts.packageName ? `${facts.packageName}.${name}` : name);
    }
    if (!target || target.facts.syntaxError || (target.file !== file && !target.type.isPublic && target.facts.packageName !== facts.packageName)) return undefined;
    return target;
  };
  const objectMethods = new Set(["clone", "equals", "finalize", "getClass", "hashCode", "notify", "notifyAll", "toString", "wait"]);
  for (const file of files) {
    const facts = javaBindingsOf(file.analysis);
    if (!facts) continue;
    for (const imported of facts.imports) {
      if (imported.wildcard) continue;
      const target = uniqueType(imported.isStatic ? imported.source.split(".").slice(0, -1).join(".") : imported.source);
      if (target && target.file !== file.path && !target.facts.syntaxError && (target.type.isPublic || target.facts.packageName === facts.packageName)) {
        imports.push({ fromPath: file.path, toPath: target.file });
      }
    }
    for (const call of facts.calls) {
      let reason = call.reason;
      const owner = uniqueType(call.owner);
      const caller = owner?.type.methods.find((method) => method.symbolName === call.callerSymbol);
      let target: LocatedType | undefined;
      let requireStatic = call.receiver === "type";
      if (facts.syntaxError) reason = "java-source-has-syntax-errors";
      else if (!owner || owner.file !== file.path || !caller) reason = "java-caller-type-ambiguous";
      else if (!owner.type.isClass || owner.type.hasSupertypes) reason = "java-inheritance-or-interface-resolution-unsupported";
      if (!reason && owner && caller) {
        if (call.receiver === "implicit" || call.receiver === "this") {
          target = owner;
          const declared = owner.type.methods.some((method) => !method.isConstructor && method.name === call.name);
          if (!declared && call.receiver === "implicit") {
            const statics = facts.imports.filter((item) => item.isStatic && !item.wildcard && item.source.split(".").at(-1) === call.name);
            if (statics.length === 1 && !facts.imports.some((item) => item.isStatic && item.wildcard)) {
              target = uniqueType(statics[0].source.split(".").slice(0, -1).join("."));
              requireStatic = true;
            }
          }
        } else if (call.receiverType) {
          target = resolveType(file.path, facts, call.receiverType);
          if (target && call.receiver === "exact" && call.declaredType !== "var") {
            const declared = call.declaredType && resolveType(file.path, facts, call.declaredType);
            if (!declared || declared.type.qualifiedName !== target.type.qualifiedName) {
              target = undefined; reason = "java-declared-and-constructed-type-differ";
            }
          }
        }
        if (!target) reason ??= "java-target-type-unresolved";
        else if (!target.type.isClass || target.type.hasSupertypes) reason = "java-inheritance-or-interface-resolution-unsupported";
        else if (target.facts.syntaxError) reason = "java-target-has-syntax-errors";
        else {
          const methods = target.type.methods.filter((method) => !method.isConstructor && method.name === call.name);
          const method = methods.length === 1 ? methods[0] : undefined;
          if (!method) reason = methods.length > 1 ? "java-overload-resolution-unsupported" : "java-method-not-declared";
          else if (!method.hasBody || objectMethods.has(call.name)) reason = "java-inherited-or-abstract-method-unsupported";
          else if ((requireStatic && !method.isStatic) || (call.receiver === "this" && caller.isStatic) ||
            (call.receiver === "implicit" && caller.isStatic && !method.isStatic)) reason = "java-static-instance-binding-mismatch";
          else if (method.visibility === "private" && owner.type.qualifiedName !== target.type.qualifiedName ||
            method.visibility !== "public" && method.visibility !== "private" && facts.packageName !== target.facts.packageName ||
            !target.type.isPublic && facts.packageName !== target.facts.packageName) reason = "java-method-not-accessible";
          else if (method.varargs ? call.argumentCount < method.parameterCount - 1 : call.argumentCount !== method.parameterCount) reason = "java-argument-arity-mismatch";
          else if (!method.isStatic && call.receiver !== "exact" && !method.isFinal && method.visibility !== "private" && !target.type.isFinal) reason = "java-virtual-dispatch-ambiguous";
          else {
            calls.push({ callerFile: file.path, callerFunc: call.callerSymbol, calleeFile: target.file, calleeFunc: method.symbolName,
              confidence: file.path === target.file ? "same-file" : "imported-package", lineNumber: call.lineNumber });
            continue;
          }
        }
      }
      unresolved.push({ file: file.path, caller: call.callerSymbol, callee: call.displayName, lineNumber: call.lineNumber,
        reason: reason ?? "java-static-binding-unproven" });
    }
  }
  const distinctImports = new Map(imports.map((item) => [`${item.fromPath}\0${item.toPath}`, item]));
  return { calls, unresolved, imports: [...distinctImports.values()] };
}
