#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import {
  lstatSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18"];
const PREFERRED_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
const MAX_PATH_BYTES = 4_096;
const MAX_IDENTITY_BYTES = 256;
const MAX_ROOTS = 64;
const MAX_FRAME_BYTES = 1024 * 1024;
const ROOTS_REQUEST_TIMEOUT_MS = 2_000;
const SAFE_ENVIRONMENT_KEYS = [
  "PLUGIN_ROOT",
  "PLUGIN_DATA",
  "CLAUDE_PLUGIN_ROOT",
  "CLAUDE_PLUGIN_DATA",
  "CLAUDE_PROJECT_DIR",
];
const RECORDED_METHODS = new Set([
  "initialize",
  "notifications/initialized",
  "notifications/roots/list_changed",
  "ping",
  "tools/list",
  "tools/call",
  "resources/list",
  "resources/templates/list",
  "prompts/list",
]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasUnsafeCharacters(value) {
  return /[\u0000-\u001f\u007f]/u.test(value);
}

function isSafeString(value, maxBytes, { allowEmpty = false } = {}) {
  return (
    typeof value === "string" &&
    (allowEmpty || value.length > 0) &&
    Buffer.byteLength(value, "utf8") <= maxBytes &&
    !hasUnsafeCharacters(value)
  );
}

function parseArguments(values) {
  const parsed = { output: null, root: null };
  const allowedFlags = new Map([
    ["--output", "output"],
    ["--root", "root"],
  ]);

  for (let index = 0; index < values.length; index += 1) {
    const flag = values[index];
    const key = allowedFlags.get(flag);
    if (!key) throw new Error("invalid_arguments");
    if (parsed[key] !== null) throw new Error("invalid_arguments");

    const value = values[index + 1];
    if (!isSafeString(value, MAX_PATH_BYTES) || value.startsWith("--")) {
      throw new Error("invalid_arguments");
    }
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function canonicalPath(value) {
  if (!value) return null;
  const absolute = resolve(value);
  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
}

function sanitizeClientInfo(value) {
  if (!isPlainObject(value)) return null;
  if (
    !isSafeString(value.name, MAX_IDENTITY_BYTES) ||
    !isSafeString(value.version, MAX_IDENTITY_BYTES) ||
    (Object.hasOwn(value, "title") &&
      value.title !== null &&
      !isSafeString(value.title, MAX_IDENTITY_BYTES))
  ) {
    return null;
  }

  return {
    name: value.name,
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    version: value.version,
  };
}

function sanitizeCapabilities(value) {
  if (value === undefined) {
    return {
      roots: false,
      rootsListChanged: false,
      elicitation: false,
      sampling: false,
    };
  }
  if (!isPlainObject(value)) return null;
  for (const capability of ["roots", "elicitation", "sampling"]) {
    if (
      Object.hasOwn(value, capability) &&
      !isPlainObject(value[capability])
    ) {
      return null;
    }
  }

  const roots = isPlainObject(value.roots);
  return {
    roots,
    rootsListChanged: roots && value.roots.listChanged === true,
    elicitation: isPlainObject(value.elicitation),
    sampling: isPlainObject(value.sampling),
  };
}

function sanitizeRoot(value) {
  if (!isPlainObject(value) || !isSafeString(value.uri, MAX_PATH_BYTES)) {
    throw new Error("invalid_roots_result");
  }

  let parsed;
  try {
    parsed = new URL(value.uri);
  } catch {
    throw new Error("invalid_roots_result");
  }
  if (
    parsed.protocol !== "file:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("invalid_roots_result");
  }
  if (
    Object.hasOwn(value, "name") &&
    value.name !== null &&
    !isSafeString(value.name, MAX_IDENTITY_BYTES)
  ) {
    throw new Error("invalid_roots_result");
  }

  return {
    uri: parsed.href,
    ...(typeof value.name === "string" ? { name: value.name } : {}),
  };
}

function sanitizeRootsResult(value) {
  if (
    !isPlainObject(value) ||
    !Array.isArray(value.roots) ||
    value.roots.length > MAX_ROOTS
  ) {
    throw new Error("invalid_roots_result");
  }
  return value.roots.map(sanitizeRoot);
}

function sanitizeRootsError(value) {
  return {
    code:
      isPlainObject(value) && Number.isInteger(value.code)
        ? value.code
        : -32603,
    message: "roots/list failed",
  };
}

function safeConfigurationExit() {
  process.stderr.write("host-binding-probe: configuration error\n");
  process.exit(2);
}

let parsedArguments;
try {
  parsedArguments = parseArguments(process.argv.slice(2));
} catch {
  safeConfigurationExit();
}

const outputPath = parsedArguments.output
  ? resolve(parsedArguments.output)
  : null;
const explicitRoot = canonicalPath(parsedArguments.root);
const startedAt = new Date().toISOString();
let artifactWriteFailed = false;

const state = {
  schemaVersion: 1,
  startedAt,
  pid: process.pid,
  cwd: canonicalPath(process.cwd()),
  explicitRoot,
  invocation: {
    outputConfigured: outputPath !== null,
    explicitRootConfigured: explicitRoot !== null,
  },
  environment: Object.fromEntries(
    SAFE_ENVIRONMENT_KEYS
      .filter((key) => isSafeString(process.env[key], MAX_PATH_BYTES))
      .map((key) => [key, canonicalPath(process.env[key])]),
  ),
  lifecycle: "preInitialize",
  initialize: null,
  roots: {
    advertisedByClient: false,
    listChanged: false,
    requested: false,
    pending: false,
    result: null,
    error: null,
  },
  protocolErrors: [],
  calls: [],
};

function assertSafeOutputTarget() {
  if (!outputPath) return;
  try {
    const metadata = lstatSync(outputPath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error("unsafe_output_target");
    }
  } catch (errorValue) {
    if (errorValue?.code !== "ENOENT") throw errorValue;
  }
  realpathSync(dirname(outputPath));
}

function persist() {
  if (!outputPath || artifactWriteFailed) return !artifactWriteFailed;
  let temporaryPath = null;
  try {
    assertSafeOutputTarget();
    temporaryPath = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temporaryPath, outputPath);
    return true;
  } catch {
    if (temporaryPath) {
      try {
        unlinkSync(temporaryPath);
      } catch {
        // Best effort only; never print a path or OS error.
      }
    }
    artifactWriteFailed = true;
    process.stderr.write("host-binding-probe: artifact error\n");
    process.exitCode = 2;
    return false;
  }
}

function recordCall(method) {
  state.calls.push({
    method: RECORDED_METHODS.has(method) ? method : "unknown",
    at: new Date().toISOString(),
  });
  persist();
}

function recordProtocolError(kind, rawLength = null) {
  state.protocolErrors.push({
    kind,
    ...(rawLength === null ? {} : { rawLength }),
    at: new Date().toISOString(),
  });
  persist();
}

let transportWriteFailed = false;

function handleTransportWriteFailure() {
  if (transportWriteFailed) return;
  transportWriteFailed = true;
  process.exitCode = 1;
  process.stdin.pause();
}

process.stdout.on("error", handleTransportWriteFailure);

function send(message) {
  if (transportWriteFailed) return;
  process.stdout.write(`${JSON.stringify(message)}\n`, (errorValue) => {
    if (errorValue) handleTransportWriteFailure();
  });
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function isValidId(value) {
  return (
    typeof value === "string" ||
    (typeof value === "number" && Number.isSafeInteger(value))
  );
}

function classifyEnvelope(message) {
  if (!isPlainObject(message)) {
    return { kind: "invalidRequest", id: null };
  }

  const hasId = Object.hasOwn(message, "id");
  const validId = !hasId || isValidId(message.id);
  const id = hasId && isValidId(message.id) ? message.id : null;
  const hasMethod = Object.hasOwn(message, "method");
  const hasResult = Object.hasOwn(message, "result");
  const hasError = Object.hasOwn(message, "error");

  if (hasMethod) {
    const valid =
      message.jsonrpc === "2.0" &&
      typeof message.method === "string" &&
      message.method.length > 0 &&
      validId &&
      !hasResult &&
      !hasError &&
      (!Object.hasOwn(message, "params") || isPlainObject(message.params));
    return { kind: valid ? "request" : "invalidRequest", id };
  }

  if (hasId || hasResult || hasError) {
    const validError =
      !hasError ||
      (isPlainObject(message.error) &&
        Number.isInteger(message.error.code) &&
        typeof message.error.message === "string");
    const valid =
      message.jsonrpc === "2.0" &&
      hasId &&
      isValidId(message.id) &&
      hasResult !== hasError &&
      !Object.hasOwn(message, "params") &&
      validError;
    return { kind: valid ? "response" : "invalidResponse", id };
  }

  return { kind: "invalidRequest", id: null };
}

let nextRequestId = 10_000;
let pendingRootsRequestId = null;
let pendingRootsRequestTimeout = null;
let rootsRefreshPending = false;

function startRootsRequest() {
  pendingRootsRequestId = nextRequestId;
  nextRequestId += 1;
  state.roots.requested = true;
  state.roots.pending = true;
  persist();
  send({
    jsonrpc: "2.0",
    id: pendingRootsRequestId,
    method: "roots/list",
    params: {},
  });
  pendingRootsRequestTimeout = setTimeout(() => {
    settleRootsRequest({
      error: { code: -32_001, message: "roots/list timed out" },
    });
  }, ROOTS_REQUEST_TIMEOUT_MS);
  pendingRootsRequestTimeout.unref();
}

function requestRoots() {
  if (
    state.lifecycle !== "initialized" ||
    !state.roots.advertisedByClient
  ) {
    return;
  }
  if (pendingRootsRequestId !== null) {
    rootsRefreshPending = true;
    return;
  }
  startRootsRequest();
}

function settleRootsRequest(update) {
  if (pendingRootsRequestTimeout) {
    clearTimeout(pendingRootsRequestTimeout);
    pendingRootsRequestTimeout = null;
  }
  const refreshAgain = rootsRefreshPending;
  rootsRefreshPending = false;
  state.roots = {
    ...state.roots,
    pending: refreshAgain,
    ...update,
  };
  pendingRootsRequestId = null;
  if (refreshAgain) startRootsRequest();
  else persist();
}

function recordInvalidRootsResult() {
  settleRootsRequest({
    error: { code: -32602, message: "invalid_roots_result" },
  });
}

function report() {
  return {
    schemaVersion: state.schemaVersion,
    cwd: state.cwd,
    explicitRoot: state.explicitRoot,
    environment: state.environment,
    clientInfo: state.initialize?.clientInfo ?? null,
    protocolVersion: state.initialize?.protocolVersion ?? null,
    roots: state.roots,
  };
}

function requireInitialized(id, isNotification) {
  if (state.lifecycle === "initialized") return true;
  if (!isNotification) error(id, -32002, "Server not initialized");
  return false;
}

function handleInitialize(message) {
  const { id, params } = message;
  if (
    !Object.hasOwn(message, "id") ||
    state.lifecycle !== "preInitialize" ||
    !isPlainObject(params) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(params.protocolVersion ?? "") ||
    !sanitizeClientInfo(params.clientInfo)
  ) {
    if (Object.hasOwn(message, "id")) {
      error(id, -32602, "Invalid initialize parameters");
    }
    return;
  }

  const capabilities = sanitizeCapabilities(params.capabilities);
  if (!capabilities) {
    error(id, -32602, "Invalid initialize parameters");
    return;
  }

  const requestedProtocolVersion = params.protocolVersion;
  const negotiatedProtocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(
    requestedProtocolVersion,
  )
    ? requestedProtocolVersion
    : PREFERRED_PROTOCOL_VERSION;
  state.initialize = {
    requestedProtocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(
      requestedProtocolVersion,
    )
      ? requestedProtocolVersion
      : "unsupported",
    protocolVersion: negotiatedProtocolVersion,
    clientInfo: sanitizeClientInfo(params.clientInfo),
    capabilities,
  };
  state.roots.advertisedByClient = capabilities.roots;
  state.roots.listChanged = capabilities.rootsListChanged;
  state.lifecycle = "initializeResponded";
  persist();
  result(id, {
    protocolVersion: negotiatedProtocolVersion,
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
    },
    serverInfo: {
      name: "understand-code-host-binding-probe",
      version: "1.0.0",
    },
  });
}

function handleRequest(message) {
  const { id, method, params } = message;
  const isNotification = !Object.hasOwn(message, "id");

  if (method === "initialize") {
    recordCall(method);
    handleInitialize(message);
    return;
  }

  if (method === "notifications/initialized") {
    if (!isNotification || state.lifecycle !== "initializeResponded") {
      recordProtocolError("invalid_initialized_notification");
      if (!isNotification) error(id, -32600, "Invalid Request");
      return;
    }
    recordCall(method);
    state.lifecycle = "initialized";
    persist();
    requestRoots();
    return;
  }

  if (method === "notifications/roots/list_changed") {
    if (
      !isNotification ||
      state.lifecycle !== "initialized" ||
      !state.roots.advertisedByClient ||
      !state.roots.listChanged
    ) {
      recordProtocolError("invalid_roots_changed_notification");
      if (!isNotification) error(id, -32600, "Invalid Request");
      return;
    }
    recordCall(method);
    requestRoots();
    return;
  }

  recordCall(method);

  if (method === "ping") {
    if (!isNotification) result(id, {});
    return;
  }
  if (!requireInitialized(id, isNotification)) return;

  if (method === "tools/list") {
    if (!isNotification) {
      result(id, {
        tools: [
          {
            name: "report_host_binding",
            description:
              "Report sanitized MCP host binding evidence: process cwd, explicit root, client identity, and MCP roots.",
            inputSchema: {
              type: "object",
              additionalProperties: false,
              properties: {},
            },
          },
        ],
      });
    }
    return;
  }

  if (method === "tools/call") {
    if (isNotification) return;
    const toolArguments = params?.arguments;
    if (
      params?.name !== "report_host_binding" ||
      (toolArguments !== undefined &&
        (!isPlainObject(toolArguments) ||
          Object.keys(toolArguments).length !== 0))
    ) {
      error(id, -32602, "Invalid tool arguments");
      return;
    }
    const payload = report();
    result(id, {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
      isError: false,
    });
    return;
  }

  if (method === "resources/list") {
    if (!isNotification) result(id, { resources: [] });
    return;
  }

  if (method === "resources/templates/list") {
    if (!isNotification) result(id, { resourceTemplates: [] });
    return;
  }

  if (method === "prompts/list") {
    if (!isNotification) result(id, { prompts: [] });
    return;
  }

  if (!isNotification) error(id, -32601, "Method not found");
}

function handleResponse(message) {
  if (message.id !== pendingRootsRequestId) {
    recordProtocolError("unexpected_response");
    return;
  }

  if (message.error) {
    settleRootsRequest({ error: sanitizeRootsError(message.error) });
    return;
  }

  try {
    const roots = sanitizeRootsResult(message.result);
    settleRootsRequest({ result: roots, error: null });
  } catch {
    recordInvalidRootsResult();
  }
}

function handleMessage(message) {
  const envelope = classifyEnvelope(message);
  if (envelope.kind === "invalidRequest") {
    recordProtocolError("invalid_request");
    error(envelope.id, -32600, "Invalid Request");
    return;
  }
  if (envelope.kind === "invalidResponse") {
    recordProtocolError("invalid_response");
    if (envelope.id === pendingRootsRequestId) recordInvalidRootsResult();
    return;
  }
  if (envelope.kind === "response") {
    handleResponse(message);
    return;
  }
  handleRequest(message);
}

function processFrame(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    recordProtocolError("parse_error", Buffer.byteLength(raw, "utf8"));
    error(null, -32700, "Parse error");
    return;
  }

  try {
    handleMessage(message);
  } catch {
    recordProtocolError("internal_error");
    const envelope = classifyEnvelope(message);
    if (envelope.kind === "request" && envelope.id !== null) {
      error(envelope.id, -32603, "Internal error");
    }
  }
}

let buffer = "";
let discardingOversizedFrame = false;

function recordOversizedFrame() {
  recordProtocolError("frame_too_large");
  error(null, -32700, "Parse error");
}

function consumeNewlineFrames() {
  while (true) {
    if (discardingOversizedFrame) {
      const discardedNewline = buffer.indexOf("\n");
      if (discardedNewline < 0) {
        buffer = "";
        return;
      }
      buffer = buffer.slice(discardedNewline + 1);
      discardingOversizedFrame = false;
    }

    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex < 0) {
      if (Buffer.byteLength(buffer, "utf8") > MAX_FRAME_BYTES) {
        buffer = "";
        discardingOversizedFrame = true;
        recordOversizedFrame();
      }
      return;
    }

    const raw = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (!raw) continue;
    if (Buffer.byteLength(raw, "utf8") > MAX_FRAME_BYTES) {
      recordOversizedFrame();
      continue;
    }
    processFrame(raw);
  }
}

if (!persist()) process.exit(2);

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  consumeNewlineFrames();
});
process.stdin.on("end", () => {
  const raw = buffer.trim();
  if (!discardingOversizedFrame && raw) {
    if (Buffer.byteLength(raw, "utf8") > MAX_FRAME_BYTES) {
      recordOversizedFrame();
    } else {
      processFrame(raw);
    }
  }
  persist();
});
