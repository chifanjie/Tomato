import { useEffect, useId, useState } from "react";

type DiagramState =
  | { source: string; status: "loading"; svg: "" }
  | { source: string; status: "ready"; svg: string }
  | { source: string; status: "error"; svg: "" };

let mermaidLoader: Promise<typeof import("mermaid")["default"]> | undefined;

function loadMermaid() {
  mermaidLoader ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      htmlLabels: false,
      suppressErrorRendering: true,
      theme: "neutral",
      fontFamily: "system-ui, sans-serif",
      maxTextSize: 50_000,
      maxEdges: 500,
      // Diagram directives must not relax the reader's rendering policy.
      secure: [
        "secure", "securityLevel", "startOnLoad", "maxTextSize", "maxEdges",
        "suppressErrorRendering", "htmlLabels", "themeCSS",
      ],
      flowchart: { htmlLabels: false, useMaxWidth: true },
    });
    return mermaid;
  });
  return mermaidLoader;
}

export default function WikiMermaidDiagram({ source }: { source: string }) {
  const reactId = useId();
  const id = `wiki-diagram-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [state, setState] = useState<DiagramState>({ source, status: "loading", svg: "" });

  useEffect(() => {
    let cancelled = false;
    setState({ source, status: "loading", svg: "" });
    void loadMermaid()
      .then((mermaid) => mermaid.render(id, source))
      .then(({ svg }) => {
        if (!svg.trim()) throw new Error("图表未生成有效内容");
        if (!cancelled) setState({ source, status: "ready", svg });
      })
      .catch(() => {
        if (!cancelled) setState({ source, status: "error", svg: "" });
      });
    return () => { cancelled = true; };
  }, [id, source]);

  const current = state.source === source ? state : { source, status: "loading", svg: "" };
  return (
    <figure className="uc-wiki-diagram" aria-label="文档图表">
      <figcaption className="uc-wiki-diagram-header">文档流程图</figcaption>
      {current.status === "loading" && <p role="status">正在绘制图表…</p>}
      {current.status === "error" && (
        <p role="status" className="uc-wiki-diagram-error">
          图表暂时无法渲染，可能存在语法问题或组件加载失败。可展开源码继续阅读。
        </p>
      )}
      {current.status === "ready" && (
        <div
          className="uc-wiki-diagram-canvas"
          role="img"
          aria-label="文档流程图"
          tabIndex={0}
          // Mermaid strict mode sanitizes SVG; do not attach its optional event bindings.
          dangerouslySetInnerHTML={{ __html: current.svg }}
        />
      )}
      <details className="uc-wiki-diagram-source" open={current.status === "error" ? true : undefined}>
        <summary>查看图表源码</summary>
        <pre className="uc-prose-pre"><code className="language-mermaid uc-prose-code-block">{source}</code></pre>
      </details>
    </figure>
  );
}
