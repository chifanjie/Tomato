import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";

import {
  OpenWorkbenchInputV1Schema,
  OpenWorkbenchOutputV1Schema,
  ToolSuccessMetaV1Schema,
  WorkbenchRouteV1Schema,
  type OpenWorkbenchInputV1,
  type OpenWorkbenchOutputV1,
  type ToolSuccessMetaV1,
  type WorkbenchRouteV1,
} from "@understand-code/contracts/mcp";
import { IsoTimestampSchema, ProducerVersionSchema } from "@understand-code/contracts/primitives";

const DEFAULT_LAUNCH_TTL_MS = 60_000;
const MAX_LAUNCH_TTL_MS = 60_000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1_000;
const SESSION_IDLE_TTL_MS = 30 * 60 * 1_000;
const LOOPBACK_HOST = "127.0.0.1" as const;

export interface WorkbenchRuntimeBindingV1 {
  /** The already-bound canonical root. It must be absolute and realpath-stable. */
  readonly canonicalRoot: string;
  readonly productVersion: string;
  readonly repositoryId: string;
  readonly worktreeId: string;
  readonly sourceSnapshotId: string;
  readonly headCommit: string | null;
  readonly worktreeFingerprint: `sha256:${string}`;
  readonly freshness: ToolSuccessMetaV1["freshness"];
}

export interface OpenWorkbenchSessionOptionsV1 extends WorkbenchRuntimeBindingV1 {
  /** Defaults to the frozen 60 second launch-token TTL. */
  readonly launchTokenTtlMs?: number;
  /** Injected clock is intentionally kept local/test-only and never serialized. */
  readonly now?: () => number;
  /** Defaults to an ephemeral loopback port. Non-loopback hosts are rejected. */
  readonly host?: typeof LOOPBACK_HOST;
  readonly port?: number;
}

export interface WorkbenchLaunchGrantV1 {
  readonly sessionId: string;
  readonly sessionToken: string;
  readonly route: WorkbenchRouteV1;
  readonly identity: { readonly productVersion: string; readonly worktreeId: string };
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface WorkbenchSessionV1 {
  readonly output: OpenWorkbenchOutputV1;
  readonly canonicalRoot: string;
  readonly identity: { readonly productVersion: string; readonly worktreeId: string };
  readonly port: number;
  readonly server: Server;
  /** Redeem a launch token exactly once and create a short-lived browser session. */
  readonly redeemLaunchToken: (token: string) => WorkbenchLaunchGrantV1;
  /** Read-only projection used by the HTTP task route. */
  readonly readTaskRoute: (sessionToken: string, taskId: string) => WorkbenchRouteV1;
  readonly close: () => Promise<void>;
}

export class WorkbenchSessionError extends Error {
  readonly code:
    | "invalid_root"
    | "invalid_input"
    | "invalid_identity"
    | "launch_token_invalid"
    | "launch_token_expired"
    | "launch_token_replayed"
    | "session_invalid"
    | "session_expired"
    | "server_error";

  constructor(
    code: WorkbenchSessionError["code"],
    message: string = code,
  ) {
    super(message);
    this.name = "WorkbenchSessionError";
    this.code = code;
  }
}

interface PendingLaunchV1 {
  readonly token: string;
  readonly route: WorkbenchRouteV1;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  redeemed: boolean;
}

interface BrowserSessionV1 {
  readonly sessionId: string;
  readonly sessionToken: string;
  readonly route: WorkbenchRouteV1;
  readonly identity: { readonly productVersion: string; readonly worktreeId: string };
  readonly issuedAtMs: number;
  lastSeenAtMs: number;
  readonly expiresAtMs: number;
}

interface StoredSessionV1 {
  readonly session: WorkbenchSessionV1;
  readonly launches: Map<string, PendingLaunchV1>;
}

const sessionsByIdentity = new Map<string, StoredSessionV1>();

function identityKey(binding: WorkbenchRuntimeBindingV1, canonicalRoot: string): string {
  return `${canonicalRoot}\u0000${binding.productVersion}\u0000${binding.worktreeId}`;
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

function timestamp(ms: number): string {
  return IsoTimestampSchema.parse(new Date(ms).toISOString());
}

function assertSafeToken(token: string): void {
  if (
    typeof token !== "string" ||
    token.length < 32 ||
    token.length > 256 ||
    !/^[A-Za-z0-9_-]+$/u.test(token)
  ) {
    throw new WorkbenchSessionError("launch_token_invalid", "unknown launch token");
  }
}

async function canonicalizeRoot(root: string): Promise<string> {
  if (typeof root !== "string" || !path.isAbsolute(root)) {
    throw new WorkbenchSessionError("invalid_root", "canonical root must be absolute");
  }
  let canonical: string;
  try {
    const metadata = await stat(root);
    if (!metadata.isDirectory()) {
      throw new WorkbenchSessionError("invalid_root", "canonical root must be a directory");
    }
    canonical = await realpath(root);
  } catch (error) {
    if (error instanceof WorkbenchSessionError) throw error;
    throw new WorkbenchSessionError("invalid_root", "canonical root is unavailable");
  }
  return canonical;
}

function validateBinding(binding: WorkbenchRuntimeBindingV1): void {
  const parsed = ToolSuccessMetaV1Schema.safeParse({
    repositoryId: binding.repositoryId,
    worktreeId: binding.worktreeId,
    sourceSnapshotId: binding.sourceSnapshotId,
    headCommit: binding.headCommit,
    worktreeFingerprint: binding.worktreeFingerprint,
    freshness: binding.freshness,
    durationMs: 0,
    cacheHit: true,
    truncated: false,
    truncatedCategories: [],
  });
  if (!parsed.success || !ProducerVersionSchema.safeParse(binding.productVersion).success) {
    throw new WorkbenchSessionError("invalid_identity", "runtime identity is invalid");
  }
}

function routePath(route: WorkbenchRouteV1): string {
  const params = new URLSearchParams({ view: route.view });
  if (route.taskId !== undefined) params.set("taskId", route.taskId);
  if (route.section !== undefined) params.set("section", route.section);
  if (route.findingId !== undefined) params.set("findingId", route.findingId);
  if (route.evidenceId !== undefined) params.set("evidenceId", route.evidenceId);
  if (route.impactPathId !== undefined) params.set("impactPathId", route.impactPathId);
  if (route.focus !== undefined) params.set("focus", route.focus);
  return `/workbench?${params.toString()}`;
}

function launchUrl(port: number, route: WorkbenchRouteV1, token: string): string {
  return `http://${LOOPBACK_HOST}:${port}${routePath(route)}#${token}`;
}

function readCookie(request: IncomingMessage, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (cookieHeader === undefined) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

function writeJson(response: ServerResponse, status: number, value: unknown, headers?: Record<string, string>): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(body);
}

function unauthorized(response: ServerResponse): void {
  writeJson(response, 401, { error: "workbench_session_required" });
}

const BOOTSTRAP_SCRIPT = `const token=location.hash.slice(1);if(token){fetch('/__workbench/launch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})}).then(r=>{if(!r.ok)throw new Error('launch failed');return r.json()}).then(()=>{history.replaceState(null,'',location.pathname+location.search);location.reload()}).catch(()=>location.hash='');}`;

function routeFromQuery(query: URLSearchParams): WorkbenchRouteV1 | undefined {
  const candidate: Record<string, string> = {};
  for (const key of ["view", "taskId", "section", "findingId", "evidenceId", "impactPathId", "focus"] as const) {
    const value = query.get(key);
    if (value !== null) candidate[key] = value;
  }
  const parsed = WorkbenchRouteV1Schema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

function createHttpHandler(stored: StoredSessionV1): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response) => {
    if (request.method !== "GET") {
      if (request.method !== "POST") response.setHeader("allow", "GET, POST");
      if (request.method === "POST") {
        let parsedUrl: URL;
        try { parsedUrl = new URL(request.url ?? "/", `http://${LOOPBACK_HOST}`); } catch { writeJson(response, 400, { error: "invalid_request" }); return; }
        if (parsedUrl.pathname === "/__workbench/launch") {
          let body = "";
          request.setEncoding("utf8");
          request.on("data", (chunk) => { body += chunk; });
          request.on("end", () => {
            try {
              const token = JSON.parse(body).token;
              const grant = stored.session.redeemLaunchToken(token);
              writeJson(response, 200, grant, { "set-cookie": `workbench_session=${encodeURIComponent(grant.sessionToken)}; HttpOnly; SameSite=Strict; Path=/` });
            } catch { writeJson(response, 401, { error: "launch_token_invalid" }); }
          });
          return;
        }
      }
      writeJson(response, 405, { error: "method_not_allowed" });
      return;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(request.url ?? "/", `http://${LOOPBACK_HOST}`);
    } catch {
      writeJson(response, 400, { error: "invalid_request" });
      return;
    }

    if (parsedUrl.pathname === "/healthz") {
      writeJson(response, 200, {
        ok: true,
        runtime: stored.session.identity,
        port: stored.session.port,
      });
      return;
    }

    if (parsedUrl.pathname === "/__workbench/bootstrap.js") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
      response.end(BOOTSTRAP_SCRIPT);
      return;
    }

    if (parsedUrl.pathname === "/workbench" && readCookie(request, "workbench_session") === undefined) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'" });
      response.end('<!doctype html><title>Workbench</title><script src="/__workbench/bootstrap.js" defer></script>');
      return;
    }

    const sessionToken = readCookie(request, "workbench_session");
    if (sessionToken === undefined) {
      unauthorized(response);
      return;
    }
    if (parsedUrl.pathname === "/workbench") {
      try {
        const grant = getBrowserSession(stored.session, sessionToken);
        const requested = routeFromQuery(parsedUrl.searchParams);
        if (requested !== undefined && JSON.stringify(requested) !== JSON.stringify(grant.route)) {
          writeJson(response, 409, { error: "route_mismatch" });
          return;
        }
        writeJson(response, 200, { route: grant.route, runtime: grant.identity });
      } catch {
        unauthorized(response);
      }
      return;
    }

    const taskMatch = /^\/tasks\/([^/]+)$/u.exec(parsedUrl.pathname);
    if (taskMatch !== null) {
      try {
        const grant = getBrowserSession(stored.session, sessionToken);
        const taskId = decodeURIComponent(taskMatch[1] ?? "");
        if (grant.route.view !== "tasks" || grant.route.taskId !== taskId) {
          writeJson(response, 404, { error: "task_route_not_found" });
          return;
        }
        writeJson(response, 200, { route: grant.route, runtime: grant.identity });
      } catch {
        unauthorized(response);
      }
      return;
    }
    writeJson(response, 404, { error: "not_found" });
  };
}

function getBrowserSession(session: WorkbenchSessionV1, token: string): BrowserSessionV1 {
  const state = browserSessions.get(session);
  const browser = state?.get(token);
  if (browser === undefined) throw new WorkbenchSessionError("session_invalid");
  const now = Date.now();
  if (now >= browser.expiresAtMs || now - browser.lastSeenAtMs >= SESSION_IDLE_TTL_MS) {
    state?.delete(token);
    throw new WorkbenchSessionError("session_expired");
  }
  browser.lastSeenAtMs = now;
  return browser;
}

const browserSessions = new WeakMap<WorkbenchSessionV1, Map<string, BrowserSessionV1>>();

function redeem(stored: StoredSessionV1, token: string, now: () => number): WorkbenchLaunchGrantV1 {
  assertSafeToken(token);
  const pending = stored.launches.get(token);
  if (pending === undefined) {
    throw new WorkbenchSessionError("launch_token_invalid", "unknown launch token");
  }
  const current = now();
  if (current >= pending.expiresAtMs) {
    pending.redeemed = true;
    stored.launches.delete(token);
    throw new WorkbenchSessionError("launch_token_expired", "launch token expired");
  }
  if (pending.redeemed) {
    throw new WorkbenchSessionError("launch_token_replayed", "launch token already redeemed");
  }
  pending.redeemed = true;
  stored.launches.delete(token);
  const sessionToken = randomToken();
  const sessionId = `wb-${randomUUID()}`;
  const browser: BrowserSessionV1 = {
    sessionId,
    sessionToken,
    route: pending.route,
    identity: stored.session.identity,
    issuedAtMs: current,
    lastSeenAtMs: current,
    expiresAtMs: current + SESSION_TTL_MS,
  };
  let sessions = browserSessions.get(stored.session);
  if (sessions === undefined) {
    sessions = new Map();
    browserSessions.set(stored.session, sessions);
  }
  sessions.set(sessionToken, browser);
  return {
    sessionId,
    sessionToken,
    route: pending.route,
    identity: stored.session.identity,
    issuedAt: timestamp(current),
    expiresAt: timestamp(browser.expiresAtMs),
  };
}

/**
 * Open (or reuse) a read-only local Workbench runtime. The function is kept
 * intentionally local to this package: it binds only an already-canonical
 * root and caller-supplied published metadata; it never executes commands or
 * opens a Task artifact writer.
 */
export async function openWorkbenchSessionV1(
  input: OpenWorkbenchInputV1,
  options: OpenWorkbenchSessionOptionsV1,
): Promise<WorkbenchSessionV1> {
  const parsedInput = OpenWorkbenchInputV1Schema.safeParse(input);
  if (!parsedInput.success) throw new WorkbenchSessionError("invalid_input", "invalid open_workbench input");
  validateBinding(options);
  const canonicalRoot = await canonicalizeRoot(options.canonicalRoot);
  const host = options.host ?? LOOPBACK_HOST;
  if (host !== LOOPBACK_HOST) throw new WorkbenchSessionError("server_error", "Workbench binds only to loopback");
  const requestedTtl = options.launchTokenTtlMs ?? DEFAULT_LAUNCH_TTL_MS;
  if (!Number.isInteger(requestedTtl) || requestedTtl <= 0 || requestedTtl > MAX_LAUNCH_TTL_MS) {
    throw new WorkbenchSessionError("invalid_input", "launch token TTL is invalid");
  }
  const now = options.now ?? Date.now;
  const key = identityKey(options, canonicalRoot);
  const existing = sessionsByIdentity.get(key);
  if (existing !== undefined) {
    const token = randomToken();
    const issuedAtMs = now();
    existing.launches.set(token, {
      token,
      route: parsedInput.data.route,
      issuedAtMs,
      expiresAtMs: issuedAtMs + requestedTtl,
      redeemed: false,
    });
    const output = makeOutput(options, existing.session.port, parsedInput.data.route, token, "reused", issuedAtMs, issuedAtMs + requestedTtl);
    return { ...existing.session, output, redeemLaunchToken: (candidate) => redeem(existing, candidate, now) };
  }

  const launches = new Map<string, PendingLaunchV1>();
  const server = createServer();
  const provisional = {} as WorkbenchSessionV1;
  const stored = { session: provisional, launches } as StoredSessionV1;
  const handler = createHttpHandler(stored);
  server.on("request", handler);
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(new WorkbenchSessionError("server_error", error.message));
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(options.port ?? 0, LOOPBACK_HOST);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new WorkbenchSessionError("server_error", "loopback server did not expose a port");
  }
  const port = address.port;
  const token = randomToken();
  const issuedAtMs = now();
  launches.set(token, {
    token,
    route: parsedInput.data.route,
    issuedAtMs,
    expiresAtMs: issuedAtMs + requestedTtl,
    redeemed: false,
  });

  const identity = { productVersion: options.productVersion, worktreeId: options.worktreeId } as const;
  const session: WorkbenchSessionV1 = {
    output: makeOutput(options, port, parsedInput.data.route, token, "started", issuedAtMs, issuedAtMs + requestedTtl),
    canonicalRoot,
    identity,
    port,
    server,
    redeemLaunchToken: (candidate) => redeem(stored, candidate, now),
    readTaskRoute: (sessionToken, taskId) => {
      const browser = getBrowserSession(session, sessionToken);
      if (browser.route.view !== "tasks" || browser.route.taskId !== taskId) {
        throw new WorkbenchSessionError("session_invalid", "task route does not belong to session");
      }
      return browser.route;
    },
    close: async () => {
      sessionsByIdentity.delete(key);
      launches.clear();
      browserSessions.delete(session);
      if (server.listening) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  };
  // The handler and redeem closure need the final session object, not the
  // provisional reference used while wiring the server listeners.
  (stored as { session: WorkbenchSessionV1 }).session = session;
  sessionsByIdentity.set(key, { session, launches });
  return session;
}

function makeOutput(
  options: WorkbenchRuntimeBindingV1,
  port: number,
  route: WorkbenchRouteV1,
  token: string,
  disposition: "started" | "reused",
  issuedAtMs: number,
  expiresAtMs: number,
): OpenWorkbenchOutputV1 {
  const output = {
    content: [{ type: "text", text: "Workbench is ready." }],
    structuredContent: {
      schemaVersion: 1,
      meta: {
        repositoryId: options.repositoryId,
        worktreeId: options.worktreeId,
        sourceSnapshotId: options.sourceSnapshotId,
        headCommit: options.headCommit,
        worktreeFingerprint: options.worktreeFingerprint,
        freshness: options.freshness,
        durationMs: 0,
        cacheHit: disposition === "reused",
        truncated: false,
        truncatedCategories: [],
      },
      result: {
        route,
        deepLink: launchUrl(port, route, token),
        launchTokenExpiresAt: timestamp(expiresAtMs),
        runtime: {
          identity: {
            productVersion: options.productVersion,
            worktreeId: options.worktreeId,
          },
          disposition,
        },
      },
    },
  };
  return OpenWorkbenchOutputV1Schema.parse(output);
}

export const WORKBENCH_SESSION_DEFAULTS_V1 = Object.freeze({
  launchTokenTtlMs: DEFAULT_LAUNCH_TTL_MS,
  sessionTtlMs: SESSION_TTL_MS,
  sessionIdleTtlMs: SESSION_IDLE_TTL_MS,
  host: LOOPBACK_HOST,
});

/** Close every open runtime, primarily for process shutdown and test cleanup. */
export async function closeAllWorkbenchSessionsV1(): Promise<void> {
  const active = [...sessionsByIdentity.values()];
  await Promise.all(active.map(({ session }) => session.close()));
}
