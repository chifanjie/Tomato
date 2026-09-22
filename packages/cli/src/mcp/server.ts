import type { Readable, Writable } from "node:stream";
import { OperationCancelledError, operationCheckpoint, runWithOperationControl } from "../runtime/operation-control.js";

import type { WorkspaceBindingReasonV1 } from "@understand-code/contracts/mcp";
import { closeAllWorkbenchSessionsV1 } from "@understand-code/workbench-runtime";

import {
  MAX_FRAME_BYTES,
  MAX_IDENTITY_BYTES,
  PREFERRED_PROTOCOL_VERSION,
  PRODUCT_VERSION,
  ROOTS_REQUEST_TIMEOUT_MS,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "../constants.js";
import { workspaceBindingFailure, internalErrorFailure } from "../errors/tool-errors.js";
import { callImplementedTool } from "../handlers/tools.js";
import { writeDiagnostic } from "../logging/stderr.js";
import { RuntimeBindingError } from "../runtime/context.js";
import {
  RootBindingSession,
  type InitialBinding,
} from "../binding/root-binding.js";
import { IMPLEMENTED_TOOLS, isImplementedToolName } from "./tool-registry.js";

const LOCAL_TASK_WORKFLOW_INSTRUCTIONS = [
  "This server uses the supported local_durable_v1 runtime on macOS/Linux. Tasks are persisted in the bound repository with atomic writes, cross-process locks, revision checks and content hashes. Provider strong writes remain unavailable; this local profile does not claim Provider isolation. The CLI cannot attest whether the current Codex/Claude conversation has connected; successful tools/call proves the current session connection.",
  "For a user goal call build_task_brief with task, expectedRevision:0, actor and idempotencyKey. If the local index is missing it returns immediately with result.status waiting_for_index and a durable jobId; no Task exists yet. Call index_job action status with that jobId after pollAfterMs (never busy-poll). Use at most 10 polls per batch; if still active, report jobId and phase, then yield or wait at least 10 seconds before another batch. If this Host cannot wait, yield with the jobId instead of immediately polling again. After completed, repeat build_task_brief with exactly the original arguments and idempotencyKey to create or replay the Task. On user cancellation call index_job action cancel; transport request cancellation does not stop an already detached job. Jobs survive Host exit; reconnect to the same root and query the saved jobId or omit jobId for latest. Stop polling terminal jobs. Failed, cancelled or interrupted jobs can be retried by repeating build_task_brief after addressing the phase message or an explicit retry request; never automatically restart a failure in a loop. Read get_repo_pulse for the repository snapshot and search_context/get_evidence for the same taskId. Treat static Graph/Wiki results as bounded source context, including unresolved calls and diagnostic Wiki readiness; never infer business rules merely from symbol names. Analyze actual source conditions in the host and persist supported conclusions, assumptions and unknowns using update_task action record_analysis and its sourceSnapshotId/evidenceIds. When resuming a Task, read get_task_brief section analysis to recover persisted conclusions, recommendations, assumptions, risks and unknowns with their reasoning and evidence IDs; this paginated view also includes initial engine analysis, not only host-authored records.",
  "Return open_workbench's private one-time deepLink for that taskId. The Task home discovers recent persisted tasks. Read exact revisions before update_task; confirm goal, acceptance and plan before edits. Host tools edit source and run tests. Then refresh_index captures the actual snapshot, update_task transitions in_progress to check_required at that snapshot, and check_change compares actual repository changes to the task plan, and record_verification records the host's actual command/result with claim and snapshot bindings. The MCP server never executes tests. Use refresh_task_context or rebase_task through update_task to recover a stale local Task. Reuse taskId across Codex/Claude sessions and reuse idempotency keys only for identical requests.",
  "Local knowledge uses refresh_index knowledge.action=stage to persist a reviewed candidate. Publication requires a verified Task, exact candidate/revision/snapshot pins and real writer output passing readiness checks; deterministic diagnostic pages cannot pass the publish gate. A passed verification or generated diagnostic Wiki does not claim formal knowledge publication. On unavailable, stale or invalid evidence, state the reason and rebuild through supported tools rather than editing managed artifacts. Respect user scope and explicit single-call requests.",
].join("\n\n");

const TASK_WORKFLOW_INSTRUCTIONS = [
  "Understand Code provides a Task-first workflow for this server's bound worktree. These instructions do not authorize extra actions: follow the user's scope and any explicit single-call request. Tool availability does not mean strong writes are unlocked. On provider_unavailable, stop the affected operation and report the Doctor/Provider prerequisite; do not edit managed artifacts or fall back to another root or writer.",
  "For a requested change, read get_repo_pulse and create or resume the same Task with build_task_brief/get_task_brief. Use returned stable IDs, context, exact revisions and Snapshot pins; confirm the goal, acceptance and plan through the existing update_task actions before source changes. Repository edits and verification commands run in the Host, never in this MCP server. After changes, refresh_index in incremental mode captures the actual Snapshot; check_change compares it with the Task plan. Resolve blocking findings through the existing Task rules.",
  "To prepare Task knowledge after its current Check, call refresh_index in full mode with knowledge.action=stage, taskId, expectedTaskRevision, and the exact expectedSourceSnapshotId. Keep the returned candidateGenerationId. This saves a pending Graph/Wiki candidate without replacing published knowledge or changing Task status. Pending knowledge is read-only and is not current Task evidence.",
  "Use open_workbench for the same Task to inspect the Task, Graph, Wiki and evidence views. In the Task-first Dashboard, open the planned-changes section and use the KnowledgeCandidateReview card to inspect the exact candidate; its links open read-only pending Graph/Wiki views only when the source Snapshot still matches the current Snapshot. This is a review surface, not a publish control: pending knowledge is never current Task evidence, and a successful stage response is not review or verification. If the candidate is stale or unavailable, report that explicitly and keep it pending.",
  "Run the Task's required verification in the Host, then record_verification with the actual result and exact Snapshot/claim bindings. A passed record does not make the Task verified: update_task must successfully transition that same Task to verified under the Provider gate. Only then call refresh_index in full mode with knowledge.action=publish, the saved candidateGenerationId, current expectedTaskRevision and the same expectedSourceSnapshotId. Publication keeps the candidate's provenance; never replace it with an ordinary full refresh that omits knowledge.",
  "Read exact current Task revisions before mutations. Reuse an idempotency key only for the identical request. If the source Snapshot changed, stop publication, re-check and re-stage against the new Snapshot; never relabel an old candidate. Preserve Task/evidence IDs across Host handoff. Keep one-time Workbench links private, and distinguish pending or historical knowledge from current evidence and a verified Task from a completed release.",
].join("\n\n");

type JsonRpcId = string | number;

interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id?: JsonRpcId;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string };
}

export interface StdioServerOptions {
  readonly initialBinding: InitialBinding;
  readonly canonicalInstallationRoot?: string;
  readonly canonicalHostInstallationRoot?: string;
  readonly runtimeProfile?: "local_durable_v1";
  readonly input?: Readable;
  readonly output?: Writable;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidId(value: unknown): value is JsonRpcId {
  return (
    typeof value === "string" ||
    (typeof value === "number" && Number.isSafeInteger(value))
  );
}

type ClassifiedEnvelope =
  | { readonly kind: "request"; readonly message: JsonRpcRequest }
  | { readonly kind: "response"; readonly message: JsonRpcResponse }
  | { readonly kind: "invalid_request"; readonly id: JsonRpcId | null }
  | { readonly kind: "invalid_response"; readonly id: JsonRpcId | null };

function classifyEnvelope(value: unknown): ClassifiedEnvelope {
  if (!isPlainObject(value)) return { kind: "invalid_request", id: null };
  const hasId = Object.hasOwn(value, "id");
  const id = hasId && isValidId(value.id) ? value.id : null;
  const hasMethod = Object.hasOwn(value, "method");
  const hasResult = Object.hasOwn(value, "result");
  const hasError = Object.hasOwn(value, "error");

  if (hasMethod) {
    const valid =
      value.jsonrpc === "2.0" &&
      typeof value.method === "string" &&
      value.method.length > 0 &&
      (!hasId || isValidId(value.id)) &&
      !hasResult &&
      !hasError &&
      (!Object.hasOwn(value, "params") || isPlainObject(value.params));
    return valid
      ? { kind: "request", message: value as unknown as JsonRpcRequest }
      : { kind: "invalid_request", id };
  }

  if (hasId || hasResult || hasError) {
    const validError =
      !hasError ||
      (isPlainObject(value.error) &&
        Number.isInteger(value.error.code) &&
        typeof value.error.message === "string");
    const valid =
      value.jsonrpc === "2.0" &&
      hasId &&
      isValidId(value.id) &&
      hasResult !== hasError &&
      !Object.hasOwn(value, "params") &&
      validError;
    return valid
      ? { kind: "response", message: value as unknown as JsonRpcResponse }
      : { kind: "invalid_response", id };
  }
  return { kind: "invalid_request", id: null };
}

function safeIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= MAX_IDENTITY_BYTES &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function validClientInfo(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    safeIdentity(value.name) &&
    safeIdentity(value.version) &&
    (!Object.hasOwn(value, "title") ||
      value.title === null ||
      safeIdentity(value.title))
  );
}

function clientRootsCapability(value: unknown): { roots: boolean; listChanged: boolean } | undefined {
  if (!isPlainObject(value)) return undefined;
  if (Object.hasOwn(value, "roots") && !isPlainObject(value.roots)) return undefined;
  for (const key of ["elicitation", "sampling"] as const) {
    if (Object.hasOwn(value, key) && !isPlainObject(value[key])) return undefined;
  }
  const rootsCapability = value.roots;
  const roots = isPlainObject(rootsCapability);
  return {
    roots,
    listChanged: roots && rootsCapability.listChanged === true,
  };
}

export class McpStdioServer {
  readonly #binding: RootBindingSession;
  readonly #output: Writable;
  readonly #canonicalInstallationRoot?: string;
  readonly #canonicalHostInstallationRoot?: string;
  readonly #runtimeProfile?: "local_durable_v1";
  #lifecycle: "pre_initialize" | "initialize_responded" | "initialized" =
    "pre_initialize";
  #rootsListChanged = false;
  #pendingRootsRequestId: number | undefined;
  #pendingRootsTimeout?: NodeJS.Timeout;
  #rootsRefreshPending = false;
  #nextRequestId = 10_000;
  #transportFailed = false;
  #queue = Promise.resolve();
  readonly #toolControllers = new Map<JsonRpcId, AbortController>();

  constructor(
    initialBinding: InitialBinding,
    output: Writable,
    canonicalInstallationRoot?: string,
    canonicalHostInstallationRoot?: string,
    runtimeProfile?: "local_durable_v1",
  ) {
    this.#binding = new RootBindingSession(initialBinding);
    this.#output = output;
    this.#canonicalInstallationRoot = canonicalInstallationRoot;
    this.#canonicalHostInstallationRoot = canonicalHostInstallationRoot;
    this.#runtimeProfile = runtimeProfile;
    this.#output.on("error", () => {
      if (this.#transportFailed) return;
      this.#transportFailed = true;
      writeDiagnostic("transport_error");
    });
  }

  #send(message: unknown): void {
    if (this.#transportFailed) return;
    try {
      this.#output.write(`${JSON.stringify(message)}\n`);
    } catch {
      this.#transportFailed = true;
      writeDiagnostic("transport_error");
    }
  }

  #result(id: JsonRpcId, result: unknown): void {
    this.#send({ jsonrpc: "2.0", id, result });
  }

  #error(id: JsonRpcId | null, code: number, message: string): void {
    this.#send({ jsonrpc: "2.0", id, error: { code, message } });
  }

  #requireInitialized(id: JsonRpcId | undefined): boolean {
    if (this.#lifecycle === "initialized") return true;
    if (id !== undefined) this.#error(id, -32_002, "Server not initialized");
    return false;
  }

  #startRootsRequest(): void {
    if (
      this.#lifecycle !== "initialized" ||
      !this.#binding.rootsAdvertised ||
      this.#pendingRootsRequestId !== undefined ||
      this.#binding.errorReason !== undefined
    ) {
      return;
    }
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;
    this.#binding.beginRootsValidation();
    this.#pendingRootsRequestId = id;
    this.#send({ jsonrpc: "2.0", id, method: "roots/list", params: {} });
    this.#pendingRootsTimeout = setTimeout(() => {
      this.#binding.lockError("root_unavailable");
      this.#pendingRootsRequestId = undefined;
      this.#pendingRootsTimeout = undefined;
    }, ROOTS_REQUEST_TIMEOUT_MS);
    this.#pendingRootsTimeout.unref();
  }

  #requestRoots(): void {
    if (this.#pendingRootsRequestId !== undefined) {
      this.#rootsRefreshPending = true;
      return;
    }
    this.#startRootsRequest();
  }

  async #settleRootsResponse(message: JsonRpcResponse): Promise<void> {
    if (message.id !== this.#pendingRootsRequestId) return;
    if (this.#pendingRootsTimeout !== undefined) {
      clearTimeout(this.#pendingRootsTimeout);
      this.#pendingRootsTimeout = undefined;
    }
    this.#pendingRootsRequestId = undefined;
    if (message.error !== undefined) this.#binding.lockError("root_unavailable");
    else await this.#binding.applyRootsResult(message.result);
    const refresh = this.#rootsRefreshPending;
    this.#rootsRefreshPending = false;
    if (refresh) this.#startRootsRequest();
  }

  #handleInitialize(message: JsonRpcRequest): void {
    if (
      message.id === undefined ||
      this.#lifecycle !== "pre_initialize" ||
      !isPlainObject(message.params) ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(
        typeof message.params.protocolVersion === "string"
          ? message.params.protocolVersion
          : "",
      ) ||
      !validClientInfo(message.params.clientInfo)
    ) {
      if (message.id !== undefined) {
        this.#error(message.id, -32_602, "Invalid initialize parameters");
      }
      return;
    }
    const capabilities = clientRootsCapability(message.params.capabilities);
    if (capabilities === undefined) {
      this.#error(message.id, -32_602, "Invalid initialize parameters");
      return;
    }
    this.#binding.configureClientRoots(capabilities.roots);
    this.#rootsListChanged = capabilities.listChanged;
    const requested = message.params.protocolVersion as string;
    const negotiated = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
      ? requested
      : PREFERRED_PROTOCOL_VERSION;
    this.#lifecycle = "initialize_responded";
    this.#result(message.id, {
      protocolVersion: negotiated,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "understand-code",
        version: PRODUCT_VERSION,
      },
      ...(isImplementedToolName("refresh_index")
        ? { instructions: this.#runtimeProfile === "local_durable_v1" ? LOCAL_TASK_WORKFLOW_INSTRUCTIONS : TASK_WORKFLOW_INSTRUCTIONS }
        : this.#runtimeProfile === "local_durable_v1" && isImplementedToolName("index_job")
          ? { instructions: "This limited local surface supports build_task_brief, get_task_brief, get_repo_pulse and index_job. A first build returns waiting_for_index with a jobId, not a Task. Poll index_job action status after pollAfterMs, at most 10 times per batch. If still active report jobId and phase, then yield or wait at least 10 seconds; if the Host cannot wait, yield. Never immediately busy-poll or automatically restart failed jobs in a loop. After completed repeat build_task_brief with identical original arguments and idempotencyKey. Use index_job action cancel to stop the background job cooperatively. Jobs survive Host exit and are scoped to the bound repository; omit jobId to query the latest. Failed or interrupted jobs can be retried through the original build request after addressing the phase message. Existing-index Task creation remains synchronous. This local profile does not grant Provider strong authority." }
          : {}),
    });
  }

  async #handleToolCall(message: JsonRpcRequest): Promise<void> {
    if (message.id === undefined) return;
    if (
      !isPlainObject(message.params) ||
      !isImplementedToolName(message.params.name) ||
      (Object.hasOwn(message.params, "arguments") &&
        !isPlainObject(message.params.arguments))
    ) {
      this.#error(message.id, -32_602, "Invalid tool arguments");
      return;
    }
    const binding = this.#binding.requireCanonicalRoot();
    if (binding.kind === "binding_error") {
      this.#result(message.id, workspaceBindingFailure(binding.reason));
      return;
    }
    const toolName = message.params.name;
    const toolArguments = message.params.arguments ?? {};
    const controller = this.#toolControllers.get(message.id) ?? new AbortController();
    this.#toolControllers.set(message.id, controller);
    const metadata = message.params._meta;
    const progressToken = isPlainObject(metadata) && isValidId(metadata.progressToken)
      ? metadata.progressToken : undefined;
    let progress = 0;
    try {
      const result = await runWithOperationControl({
        signal: controller.signal,
        ...(progressToken === undefined ? {} : { onProgress: (stage: string) => {
          this.#send({ jsonrpc: "2.0", method: "notifications/progress", params: {
            progressToken, progress: ++progress, message: stage,
          } });
        } }),
      }, async () => {
        await operationCheckpoint("Starting repository operation.");
        return callImplementedTool(
          toolName,
          toolArguments,
          binding.canonicalRoot,
          this.#canonicalInstallationRoot === undefined
            ? (this.#runtimeProfile === undefined ? {} : { runtimeProfile: this.#runtimeProfile, backgroundInitialIndex: true })
            : {
                canonicalInstallationRoot: this.#canonicalInstallationRoot,
                ...(this.#canonicalHostInstallationRoot === undefined ? {} : {
                  canonicalHostInstallationRoot: this.#canonicalHostInstallationRoot,
                }),
              },
        );
      });
      this.#result(message.id, result);
    } catch (error) {
      if (error instanceof OperationCancelledError) {
        this.#error(message.id, -32_800, error.message);
        return;
      }
      if (error instanceof RuntimeBindingError) {
        this.#binding.lockError(error.reason);
        this.#result(message.id, workspaceBindingFailure(error.reason));
        return;
      }
      this.#result(message.id, internalErrorFailure(error, message.params.name));
    } finally {
      this.#toolControllers.delete(message.id);
    }
  }

  async #handleRequest(message: JsonRpcRequest): Promise<void> {
    const notification = message.id === undefined;
    if (message.method === "initialize") {
      this.#handleInitialize(message);
      return;
    }
    if (message.method === "notifications/initialized") {
      if (!notification || this.#lifecycle !== "initialize_responded") {
        if (!notification) this.#error(message.id!, -32_600, "Invalid Request");
        return;
      }
      this.#lifecycle = "initialized";
      this.#requestRoots();
      return;
    }
    if (message.method === "notifications/roots/list_changed") {
      if (
        !notification ||
        this.#lifecycle !== "initialized" ||
        !this.#binding.rootsAdvertised ||
        !this.#rootsListChanged
      ) {
        if (!notification) this.#error(message.id!, -32_600, "Invalid Request");
        return;
      }
      this.#requestRoots();
      return;
    }
    if (message.method === "notifications/cancelled") {
      if (notification && this.#lifecycle === "initialized" && isValidId(message.params?.requestId)) {
        this.#toolControllers.get(message.params!.requestId as JsonRpcId)?.abort();
      }
      return;
    }
    if (message.method === "ping") {
      if (!notification) this.#result(message.id!, {});
      return;
    }
    if (!this.#requireInitialized(message.id)) return;
    if (message.method === "tools/list") {
      if (!notification) this.#result(message.id!, { tools: IMPLEMENTED_TOOLS });
      return;
    }
    if (message.method === "tools/call") {
      await this.#handleToolCall(message);
      return;
    }
    if (!notification) this.#error(message.id!, -32_601, "Method not found");
  }

  async handleValue(value: unknown): Promise<void> {
    const envelope = classifyEnvelope(value);
    if (envelope.kind === "invalid_request") {
      this.#error(envelope.id, -32_600, "Invalid Request");
      return;
    }
    if (envelope.kind === "invalid_response") return;
    if (envelope.kind === "response") {
      await this.#settleRootsResponse(envelope.message);
      return;
    }
    await this.#handleRequest(envelope.message);
  }

  /** Keep tool mutations serialized while transport control remains responsive. */
  enqueueFrame(raw: string): Promise<void> {
    let envelope: ClassifiedEnvelope | undefined;
    try { envelope = classifyEnvelope(JSON.parse(raw)); } catch { /* parsed by processFrame */ }
    if (envelope?.kind === "response" || (envelope?.kind === "request" &&
      (envelope.message.method === "ping" || envelope.message.method === "notifications/cancelled" ||
        (this.#lifecycle === "initialized" && envelope.message.method === "notifications/roots/list_changed")))) {
      return this.processFrame(raw);
    }
    if (envelope?.kind === "request" && envelope.message.method === "tools/call" && envelope.message.id !== undefined) {
      const id = envelope.message.id;
      if (this.#toolControllers.has(id)) {
        this.#error(id, -32_600, "A request with this ID is already running or queued");
        return Promise.resolve();
      }
      this.#toolControllers.set(id, new AbortController());
    }
    if (this.#lifecycle === "initialized" && envelope?.kind === "request" && envelope.message.method === "tools/call" && envelope.message.params?.name === "index_job") {
      return this.processFrame(raw).finally(() => {
        if (envelope.message.id !== undefined) this.#toolControllers.delete(envelope.message.id);
      });
    }
    const pending = this.#queue.then(() => this.processFrame(raw));
    this.#queue = pending.catch(() => { writeDiagnostic("internal_error"); });
    return pending.finally(() => {
      if (envelope?.kind === "request" && envelope.message.method === "tools/call" && envelope.message.id !== undefined) {
        this.#toolControllers.delete(envelope.message.id);
      }
    });
  }

  async processFrame(raw: string): Promise<void> {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      this.#error(null, -32_700, "Parse error");
      return;
    }
    await this.handleValue(value);
  }
}

export async function runStdioServer(options: StdioServerOptions): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const server = new McpStdioServer(
    options.initialBinding,
    output,
    options.canonicalInstallationRoot,
    options.canonicalHostInstallationRoot,
    options.canonicalInstallationRoot === undefined ? (options.runtimeProfile ?? "local_durable_v1") : undefined,
  );
  input.setEncoding("utf8");

  let buffer = "";
  let discardingOversizedFrame = false;
  let queue = Promise.resolve();
  const enqueue = (raw: string): void => {
    const pending = server.enqueueFrame(raw);
    queue = Promise.all([queue, pending]).then(() => undefined).catch(() => {
      writeDiagnostic("internal_error");
    });
  };
  const oversized = (): void => {
    enqueue("{");
  };
  const consume = (): void => {
    while (true) {
      if (discardingOversizedFrame) {
        const newline = buffer.indexOf("\n");
        if (newline < 0) {
          buffer = "";
          return;
        }
        buffer = buffer.slice(newline + 1);
        discardingOversizedFrame = false;
      }
      const newline = buffer.indexOf("\n");
      if (newline < 0) {
        if (Buffer.byteLength(buffer, "utf8") > MAX_FRAME_BYTES) {
          buffer = "";
          discardingOversizedFrame = true;
          oversized();
        }
        return;
      }
      const raw = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (raw.length === 0) continue;
      if (Buffer.byteLength(raw, "utf8") > MAX_FRAME_BYTES) oversized();
      else enqueue(raw);
    }
  };

  await new Promise<void>((resolve) => {
    input.on("data", (chunk: string) => {
      buffer += chunk;
      consume();
    });
    input.on("end", () => {
      const raw = buffer.trim();
      if (!discardingOversizedFrame && raw.length > 0) {
        if (Buffer.byteLength(raw, "utf8") > MAX_FRAME_BYTES) oversized();
        else enqueue(raw);
      }
      void queue.finally(resolve);
    });
  });
  await closeAllWorkbenchSessionsV1();
}

export function bindingReasonFromInitial(initial: InitialBinding): WorkspaceBindingReasonV1 | undefined {
  return initial.kind === "binding_error" ? initial.reason : undefined;
}
