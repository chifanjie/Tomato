import type { Readable, Writable } from "node:stream";

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
  #lifecycle: "pre_initialize" | "initialize_responded" | "initialized" =
    "pre_initialize";
  #rootsListChanged = false;
  #pendingRootsRequestId: number | undefined;
  #pendingRootsTimeout?: NodeJS.Timeout;
  #rootsRefreshPending = false;
  #nextRequestId = 10_000;
  #transportFailed = false;

  constructor(
    initialBinding: InitialBinding,
    output: Writable,
    canonicalInstallationRoot?: string,
  ) {
    this.#binding = new RootBindingSession(initialBinding);
    this.#output = output;
    this.#canonicalInstallationRoot = canonicalInstallationRoot;
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
    try {
      const result = await callImplementedTool(
        message.params.name,
        message.params.arguments ?? {},
        binding.canonicalRoot,
        this.#canonicalInstallationRoot === undefined
          ? {}
          : { canonicalInstallationRoot: this.#canonicalInstallationRoot },
      );
      this.#result(message.id, result);
    } catch (error) {
      if (error instanceof RuntimeBindingError) {
        this.#binding.lockError(error.reason);
        this.#result(message.id, workspaceBindingFailure(error.reason));
        return;
      }
      writeDiagnostic("internal_error");
      this.#result(message.id, internalErrorFailure());
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
  );
  input.setEncoding("utf8");

  let buffer = "";
  let discardingOversizedFrame = false;
  let queue = Promise.resolve();
  const enqueue = (raw: string): void => {
    queue = queue.then(() => server.processFrame(raw)).catch(() => {
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
