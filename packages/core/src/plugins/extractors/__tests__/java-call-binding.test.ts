import { beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { Parser, Language } from "web-tree-sitter";
import { JavaExtractor } from "../java-extractor.js";
import { resolveJavaCalls } from "../java-call-binding.js";
import { GraphBuilder } from "../../../analyzer/graph-builder.js";
const require = createRequire(import.meta.url);
let language: Language;
beforeAll(async () => {
  await Parser.init();
  language = await Language.load(require.resolve("tree-sitter-java/tree-sitter-java.wasm"));
});
function analyze(sources: Record<string, string>) {
  return Object.entries(sources).map(([path, content]) => {
    const parser = new Parser(); parser.setLanguage(language);
    const tree = parser.parse(content)!;
    try { return { path, analysis: new JavaExtractor().extractStructure(tree.rootNode) }; }
    finally { tree.delete(); parser.delete(); }
  });
}
function resolve(sources: Record<string, string>) { return resolveJavaCalls(analyze(sources)); }
const edge = (caller: string, callee: string) => expect.objectContaining({ callerFunc: caller, calleeFunc: callee });

describe("Java source-proven call binding", () => {
  it("binds same-class private/static/final and final-class this calls", () => {
    const result = resolve({ "Main.java": `class Main {
      private void privateWork() {} static void staticWork() {} final void finalWork() {}
      void run() { privateWork(); this.privateWork(); Main.staticWork(); finalWork(); }
    } final class Final { void work() {} void run() { this.work(); } }` });
    expect(result.calls).toHaveLength(5);
    expect(result.calls).toEqual(expect.arrayContaining([edge("Main.run", "Main.privateWork"), edge("Main.run", "Main.staticWork"), edge("Main.run", "Main.finalWork"), edge("Final.run", "Final.work")]));
    expect(result.unresolved).toEqual([]);
  });

  it("binds explicit imports, same-package classes, qualified classes and explicit static imports", () => {
    const result = resolve({
      "app/Main.java": `package app; import lib.Tools; import static lib.Tools.work;
        class Main { static void run() { Tools.work(); work(); Peer.work(); lib.Tools.work(); } }`,
      "lib/Tools.java": `package lib; public class Tools { public static void work() {} }`,
      "app/Peer.java": `package app; class Peer { static void work() {} }`,
    });
    expect(result.calls).toHaveLength(4);
    expect(result.calls.filter((call) => call.calleeFile === "lib/Tools.java")).toHaveLength(3);
    expect(result.calls).toContainEqual(expect.objectContaining({ calleeFile: "app/Peer.java", calleeFunc: "Peer.work" }));
    expect(result.imports).toEqual([{ fromPath: "app/Main.java", toPath: "lib/Tools.java" }]);
    expect(result.unresolved).toEqual([]);
  });

  it("binds only unchanged exact local new receivers and direct new receivers", () => {
    const result = resolve({
      "Main.java": `class Main { void run() { Worker value = new Worker(); value.work(); var inferred = new Worker(); inferred.work(); new Worker().work(); } }`,
      "Worker.java": `class Worker { void work() {} }`,
    });
    expect(result.calls).toHaveLength(3);
    expect(result.calls.every((call) => call.calleeFunc === "Worker.work")).toBe(true);
    expect(result.unresolved.every((call) => call.reason === "java-constructor-resolution-unsupported")).toBe(true);
  });

  it("keeps same-line methods from different classes and overloads as separate graph nodes", () => {
    const [file] = analyze({ "Main.java": "class A { static void work() {} } class B { static void work() {} static void work(int x) {} }" });
    const symbols = file.analysis.functions.map((fn) => fn.symbolName);
    expect(new Set(symbols).size).toBe(3);
    expect(symbols[0]).toBe("A.work");
    const builder = new GraphBuilder("java", "abc");
    builder.addFileWithAnalysis(file.path, file.analysis, { summary: "", fileSummary: "", summaries: {}, tags: [], complexity: "simple" });
    expect(builder.build().nodes.filter((node) => node.type === "function")).toHaveLength(3);
  });

  it.each([
    ["virtual dispatch", "class Main { void work() {} void run() { this.work(); } }", "java-virtual-dispatch-ambiguous"],
    ["overload", "class Main { static void work() {} static void work(int x) {} void run() { work(); } }", "java-overload-resolution-unsupported"],
    ["inheritance", "class Main extends Base { private void work() {} void run() { work(); } }", "java-inheritance-or-interface-resolution-unsupported"],
    ["interface", "interface Main { default void run() { work(); } void work(); }", "java-inheritance-or-interface-resolution-unsupported"],
    ["arity", "class Main { static void work(int x) {} void run() { work(); } }", "java-argument-arity-mismatch"],
    ["lambda", "class Main { private void work() {} void run() { Runnable r = () -> work(); } }", "java-deferred-or-nested-scope"],
  ])("does not guess %s", (_label, source, reason) => {
    const result = resolve({ "Main.java": source });
    expect(result.calls).toEqual([]);
    expect(result.unresolved).toContainEqual(expect.objectContaining({ reason }));
  });

  it.each([
    "void run(Worker value) { value.work(); }",
    "Worker value; void run() { value.work(); }",
    "void run() { Worker value = new Worker(); value = other(); value.work(); }",
    "void run(Worker Worker) { Worker.work(); }",
    "void run() { class Worker { void work() {} } Worker value = new Worker(); value.work(); }",
    "void run() { Worker value = new Worker() { void work() {} }; value.work(); }",
  ])("does not guess a shadowed, mutable, polymorphic or nonlocal receiver: %s", (body) => {
    const result = resolve({ "Main.java": `class Main { ${body} }`, "Worker.java": "class Worker { static void work() {} }" });
    expect(result.calls).toEqual([]);
    expect(result.unresolved.some((call) => call.callee.endsWith(".work"))).toBe(true);
  });

  it("rejects a base declared type with a different constructed runtime type", () => {
    const result = resolve({
      "Main.java": "class Main { void run() { Base value = new Derived(); value.work(); } }",
      "Base.java": "class Base { void work() {} }", "Derived.java": "class Derived extends Base { void work() {} }",
    });
    expect(result.calls).toEqual([]);
    expect(result.unresolved).toContainEqual(expect.objectContaining({ reason: "java-declared-and-constructed-type-differ" }));
  });

  it("does not guess duplicate types, wildcard imports or inaccessible methods", () => {
    const sources = {
      "app/Main.java": "package app; import lib.Tools; class Main { void run() { Tools.work(); } }",
      "lib/Tools.java": "package lib; public class Tools { private static void work() {} }",
    };
    expect(resolve(sources).unresolved).toContainEqual(expect.objectContaining({ reason: "java-method-not-accessible" }));
    sources["lib/Tools.java"] = "package lib; public class Tools { public static void work() {} }";
    expect(resolve({ ...sources, "duplicate/Tools.java": sources["lib/Tools.java"] }).calls).toEqual([]);
    sources["app/Main.java"] = "package app; import lib.*; class Main { void run() { Tools.work(); } }";
    expect(resolve(sources).calls).toEqual([]);
  });

  it("rejects competing static imports and syntax-error targets", () => {
    const sources = {
      "Main.java": "import static one.Tools.work; import static two.Tools.work; class Main { void run() { work(); } }",
      "one/Tools.java": "package one; public class Tools { public static void work() {} }",
      "two/Tools.java": "package two; public class Tools { public static void work() {} }",
    };
    expect(resolve(sources).calls).toEqual([]);
    sources["Main.java"] = "import one.Tools; class Main { void run() { Tools.work(); } }";
    sources["one/Tools.java"] = "package one; public class Tools { public static void work() { ??? } }";
    expect(resolve(sources).calls).toEqual([]);
  });
});
