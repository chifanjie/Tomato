import { useEffect, useState, type ReactNode } from "react";
import { WorkbenchRouteV1Schema } from "@understand-code/contracts/mcp";

const launchFragment = () => window.location.pathname === "/workbench" && /^#[A-Za-z0-9_-]{43}$/u.test(window.location.hash)
  ? window.location.hash.slice(1) : null;
const reloadPage = () => window.location.reload();
let redemption: { origin: string; token: string; target: string; promise: Promise<void> } | undefined;
let redemptionQueue = Promise.resolve();

// StrictMode remounts effects. A one-time grant must still be redeemed once.
function redeem(token: string): Promise<void> {
  const target = window.location.pathname + window.location.search;
  if (redemption?.origin === window.location.origin && redemption.token === token && redemption.target === target) return redemption.promise;
  // A slow older response must not overwrite the HttpOnly cookie from a newer grant.
  const promise = redemptionQueue.catch(() => undefined).then(() => fetch("/__workbench/launch", {
    method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }),
  })).then(async (response) => {
    if (response.ok) return;
    if (response.status !== 401) throw new Error("launch_token_invalid");
    // Reopening a consumed launch link may still have an authorized session.
    // A fresh grant always takes precedence, including a newer Snapshot of the same route.
    const expected = WorkbenchRouteV1Schema.safeParse(Object.fromEntries(new URL(target, window.location.origin).searchParams));
    if (!expected.success) throw new Error("launch_token_invalid");
    const session = await fetch(target, { credentials: "same-origin", headers: { accept: "application/json" }, cache: "no-store" });
    if (!session.ok || session.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") throw new Error("launch_token_invalid");
    const existing = WorkbenchRouteV1Schema.safeParse((await session.json()).route);
    if (!existing.success || JSON.stringify(existing.data) !== JSON.stringify(expected.data)) throw new Error("launch_token_invalid");
  });
  redemptionQueue = promise;
  redemption = { origin: window.location.origin, token, target, promise };
  return promise;
}

/** An explicit new launch grant takes precedence over an existing cookie. */
export default function WorkbenchLaunchGate({ children, reload = reloadPage }: { children: ReactNode; reload?: () => void }) {
  const [token, setToken] = useState(launchFragment);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const changed = () => { const next = launchFragment(); if (next !== null) setFailed(false); setToken(next); };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void redeem(token).then(() => {
      if (cancelled || launchFragment() !== token) return;
      history.replaceState(null, "", window.location.pathname + window.location.search);
      setToken(null);
      reload();
    }, () => {
      if (cancelled || launchFragment() !== token) return;
      history.replaceState(null, "", window.location.pathname + window.location.search);
      setFailed(true);
    });
    return () => { cancelled = true; };
  }, [token, reload]);
  if (failed) return <main role="alert" className="flex min-h-screen items-center justify-center bg-root p-6 text-text-primary">工作台链接已失效，请从宿主重新打开任务。</main>;
  if (token) return <main role="status" className="flex min-h-screen items-center justify-center bg-root p-6 text-text-primary">正在连接当前任务会话…</main>;
  return children;
}
