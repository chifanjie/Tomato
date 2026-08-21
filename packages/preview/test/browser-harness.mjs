import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, realpath } from "node:fs/promises";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 20_000;

function executableCandidates() {
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  }
  if (process.platform === "win32") {
    return [
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
      process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    ].filter(Boolean);
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
}

async function isExecutable(candidate) {
  if (!candidate) return false;
  try {
    await access(candidate, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveBrowserExecutable(explicit = process.env.UNDERSTAND_CODE_BROWSER_EXECUTABLE) {
  if (explicit !== undefined) {
    const candidate = path.resolve(explicit);
    assert.equal(
      await isExecutable(candidate),
      true,
      "UNDERSTAND_CODE_BROWSER_EXECUTABLE must name an executable Chrome or Chromium binary",
    );
    return realpath(candidate);
  }
  for (const candidate of executableCandidates()) {
    if (await isExecutable(candidate)) return realpath(candidate);
  }
  return null;
}

function withTimeout(promise, label, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function waitForExit(child, label, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve([child.exitCode, child.signalCode]);
  }
  return withTimeout(new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve([code, signal]));
  }), label, timeoutMs);
}

async function connectWebSocket(endpoint, timeoutMs) {
  const socket = new WebSocket(endpoint);
  await withTimeout(new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("Chrome DevTools WebSocket failed to connect")), { once: true });
  }), "Chrome DevTools WebSocket", timeoutMs);
  return socket;
}

function remoteValue(result) {
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description
      ?? result.exceptionDetails.text
      ?? "browser evaluation failed";
    throw new Error(detail);
  }
  return result.result?.value;
}

export async function launchBrowser({ executable, userDataDir, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  assert.ok(path.isAbsolute(executable), "browser executable must be absolute");
  assert.ok(path.isAbsolute(userDataDir), "browser user-data directory must be absolute");
  const browserArguments = [
    "--headless=new",
    "--remote-debugging-port=0",
    "--remote-allow-origins=*",
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-features=MediaRouter,Translate",
    "--disable-gpu",
    "--disable-sync",
    "--enable-automation",
    "--metrics-recording-only",
    "--no-proxy-server",
    "--password-store=basic",
    "--use-mock-keychain",
    "--window-size=1440,1000",
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
    ...(typeof process.getuid === "function" && process.getuid() === 0 ? ["--no-sandbox"] : []),
    "about:blank",
  ];
  const child = spawn(executable, browserArguments, {
    env: {
      PATH: process.env.PATH,
      TMPDIR: process.env.TMPDIR,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      LANG: process.env.LANG ?? "C.UTF-8",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.setEncoding("utf8");
  const stderr = [];
  let startupBuffer = "";
  const endpointPromise = new Promise((resolve, reject) => {
    const onData = (chunk) => {
      stderr.push(chunk);
      startupBuffer = `${startupBuffer}${chunk}`.slice(-16_384);
      const match = startupBuffer.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[A-Za-z0-9-]+)/u);
      if (match) {
        child.stderr.off("data", onData);
        child.stderr.on("data", (laterChunk) => stderr.push(laterChunk));
        resolve(match[1]);
      }
    };
    child.stderr.on("data", onData);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      reject(new Error(`Chrome exited before DevTools was ready (code=${code}, signal=${signal})\n${stderr.join("")}`));
    });
  });

  let socket;
  try {
    const endpoint = await withTimeout(endpointPromise, "Chrome DevTools endpoint", timeoutMs);
    socket = await connectWebSocket(endpoint, timeoutMs);
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await waitForExit(child, "Chrome failed-start cleanup", 5_000).catch(() => undefined);
    throw error;
  }

  let nextCommandId = 0;
  const pending = new Map();
  const listeners = new Map();
  const networkResponses = [];
  const pageErrors = [];
  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8"));
    } catch {
      return;
    }
    if (message.id !== undefined) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`CDP ${waiter.method} failed: ${message.error.message}`));
      else waiter.resolve(message.result ?? {});
      return;
    }
    if (message.method === "Network.responseReceived") {
      networkResponses.push({
        url: message.params.response.url,
        status: message.params.response.status,
        mimeType: message.params.response.mimeType,
        type: message.params.type,
      });
    }
    if (message.method === "Runtime.exceptionThrown") {
      pageErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    }
    for (const listener of listeners.get(message.method) ?? []) listener(message.params, message.sessionId);
  });

  function command(method, params = {}, sessionId) {
    const id = ++nextCommandId;
    return withTimeout(new Promise((resolve, reject) => {
      pending.set(id, { method, resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId === undefined ? {} : { sessionId }) }));
    }), `CDP ${method}`, timeoutMs).finally(() => pending.delete(id));
  }

  function once(method, predicate = () => true) {
    return new Promise((resolve) => {
      const listener = (params, sessionId) => {
        if (!predicate(params, sessionId)) return;
        const entries = listeners.get(method);
        entries?.delete(listener);
        resolve(params);
      };
      const entries = listeners.get(method) ?? new Set();
      entries.add(listener);
      listeners.set(method, entries);
    });
  }

  const { targetId } = await command("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await command("Target.attachToTarget", { targetId, flatten: true });
  await Promise.all([
    command("Page.enable", {}, sessionId),
    command("Runtime.enable", {}, sessionId),
    command("Network.enable", {}, sessionId),
  ]);

  async function evaluate(expression) {
    return remoteValue(await command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    }, sessionId));
  }

  async function waitFor(expression, label, waitTimeoutMs = timeoutMs) {
    const deadline = Date.now() + waitTimeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      try {
        if (await evaluate(expression)) return;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const diagnostics = [
      `URL: ${await evaluate("location.origin + location.pathname + location.search + (location.hash ? '#<redacted>' : '')").catch(() => "unavailable")}`,
      `body: ${String(await evaluate("document.body?.innerText?.slice(0, 2000) ?? ''").catch(() => "unavailable"))}`,
      `page errors: ${pageErrors.join(" | ") || "none"}`,
      `responses: ${networkResponses.slice(-20).map((entry) => `${entry.status} ${entry.url}`).join(" | ")}`,
    ].join("\n");
    throw new Error(`${label} timed out after ${waitTimeoutMs}ms${lastError ? `: ${lastError.message}` : ""}\n${diagnostics}`);
  }

  async function navigate(url) {
    const parsedUrl = new URL(url);
    const safeUrl = `${parsedUrl.origin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash ? "#<redacted>" : ""}`;
    const loaded = once("Page.loadEventFired", (_, eventSessionId) => eventSessionId === sessionId);
    const result = await command("Page.navigate", { url }, sessionId);
    if (result.errorText) throw new Error(`Chrome navigation failed: ${result.errorText}`);
    await withTimeout(loaded, `Chrome load ${safeUrl}`, timeoutMs);
  }

  async function click(selector) {
    return evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!(element instanceof HTMLElement)) throw new Error('missing clickable element: ${selector.replaceAll("'", "\\'")}');
      element.click();
      return true;
    })()`);
  }

  async function clickText(selector, text) {
    return evaluate(`(() => {
      const expected = ${JSON.stringify(text)};
      const element = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find((candidate) => candidate.textContent?.includes(expected));
      if (!(element instanceof HTMLElement)) throw new Error('missing clickable text: ' + expected);
      element.click();
      return true;
    })()`);
  }

  async function close() {
    if (socket.readyState === WebSocket.OPEN) {
      await command("Browser.close").catch(() => undefined);
    }
    if (child.exitCode === null && child.signalCode === null) {
      try {
        await waitForExit(child, "Chrome clean exit", 5_000);
      } catch {
        child.kill("SIGKILL");
        await waitForExit(child, "Chrome forced exit", 5_000);
      }
    }
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
  }

  return {
    child,
    stderr,
    networkResponses,
    pageErrors,
    evaluate,
    waitFor,
    navigate,
    click,
    clickText,
    close,
  };
}
