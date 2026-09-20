import { createContext, useContext, useState } from "react";

export const WikiPathInLink = createContext(false);

export default function WikiFilePath({ path }: { path: string }) {
  const [status, setStatus] = useState("");
  const inLink = useContext(WikiPathInLink);
  if (inLink) return <code className="uc-prose-code-inline">{path}</code>;
  return (
    <span className="uc-wiki-path-chip">
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
      <code className="uc-wiki-file-path" title={path}>{path}</code>
      <button type="button" aria-label={`复制路径 ${path}`} title={status || "复制完整路径"} onClick={async () => {
        try { await navigator.clipboard.writeText(path); setStatus("已复制"); }
        catch { setStatus("复制失败，请选择路径文字复制"); }
      }}>
        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
      </button>
      {status && <span role="status" className="uc-wiki-path-status">{status}</span>}
    </span>
  );
}
