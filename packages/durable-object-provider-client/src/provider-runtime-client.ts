import { randomBytes } from "node:crypto";
import { createConnection, type Socket } from "node:net";
import { createInterface } from "node:readline";

import {
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  ProviderRuntimeIpcClientHelloV1Schema,
  ProviderRuntimeIpcCompareCommitResultV1Schema,
  ProviderRuntimeIpcInspectStateResultV1Schema,
  ProviderRuntimeIpcReadObjectResultV1Schema,
  ProviderRuntimeIpcRequestV1Schema,
  ProviderRuntimeIpcResponseV1Schema,
  ProviderRuntimeIpcServerHelloV1Schema,
  ProviderRuntimeIpcWriteObjectResultV1Schema,
  type ProviderRuntimeIpcCompareCommitResultV1,
  type ProviderRuntimeIpcFixedObjectLocatorV1,
  type ProviderRuntimeIpcInspectStateResultV1,
  type ProviderRuntimeIpcJsonValueV1,
  type ProviderRuntimeIpcReadObjectResultV1,
  type ProviderRuntimeIpcRequestV1,
  type ProviderRuntimeIpcSuccessPayloadV1,
  type ProviderRuntimeIpcWriteObjectResultV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  assertProviderRuntimeIpcFrameSizeV1,
  encodeProviderRuntimeIpcFrameV1,
  signProviderRuntimeIpcWireV1,
  verifyProviderRuntimeIpcWireAuthV1,
} from "./ipc-auth.js";

export interface ProviderRuntimeVerifiedSelectionV1 {
  readonly verification: "caller_verified_registry_selection_v1";
  readonly providerId: string;
  readonly capabilityDigest: `sha256:${string}`;
}

function lockVerifiedSelectionV1(
  selection: ProviderRuntimeVerifiedSelectionV1,
): ProviderRuntimeVerifiedSelectionV1 {
  return Object.freeze({ ...selection });
}

export interface DurableObjectProviderRuntimeClientOptionsV1 {
  readonly socketPath: string;
  readonly sharedSecret: Uint8Array;
  readonly verifiedSelection: ProviderRuntimeVerifiedSelectionV1;
  readonly timeoutMs?: number;
  readonly transportRetryCount?: number;
}

export class ProviderRuntimeIpcErrorV1 extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProviderRuntimeIpcErrorV1";
    this.code = code;
  }
}

class ProviderRuntimeTransportErrorV1 extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProviderRuntimeTransportErrorV1";
  }
}

export interface ProviderRuntimeCompareCommitInputV1 {
  readonly expectedRevision: number;
  readonly operationNonce: string;
  readonly phase: string;
  readonly artifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;
}

export interface DurableObjectProviderRuntimeClientV1 {
  inspectState(): Promise<ProviderRuntimeIpcInspectStateResultV1>;
  readObject(
    locator: ProviderRuntimeIpcFixedObjectLocatorV1,
  ): Promise<ProviderRuntimeIpcReadObjectResultV1>;
  writeObject(input: {
    readonly locator: ProviderRuntimeIpcFixedObjectLocatorV1;
    readonly logicalBytes: number;
    readonly bytes: string;
  }): Promise<ProviderRuntimeIpcWriteObjectResultV1>;
  compareCommit(
    input: ProviderRuntimeCompareCommitInputV1,
  ): Promise<ProviderRuntimeIpcCompareCommitResultV1>;
}

function randomLowerHexV1(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function connectSocketV1(socketPath: string, timeoutMs: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: socketPath });
    const onError = (error: Error) => {
      socket.destroy();
      reject(new ProviderRuntimeTransportErrorV1("provider runtime connection failed", { cause: error }));
    };
    socket.once("error", onError);
    socket.once("connect", () => {
      socket.off("error", onError);
      socket.setTimeout(timeoutMs, () => {
        socket.destroy(new ProviderRuntimeTransportErrorV1("provider runtime IPC timed out"));
      });
      resolve(socket);
    });
  });
}

async function exchangeV1(
  options: DurableObjectProviderRuntimeClientOptionsV1,
  operation: ProviderRuntimeIpcRequestV1["operation"],
  payload: ProviderRuntimeIpcJsonValueV1,
): Promise<ProviderRuntimeIpcSuccessPayloadV1> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const socket = await connectSocketV1(options.socketPath, timeoutMs);
  const lines = createInterface({ input: socket, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  const clientNonce = randomLowerHexV1(32);
  try {
    const clientHello = ProviderRuntimeIpcClientHelloV1Schema.parse(
      signProviderRuntimeIpcWireV1(options.sharedSecret, {
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "client_hello",
        clientNonce,
        capabilityDigest: options.verifiedSelection.capabilityDigest,
      }),
    );
    socket.write(encodeProviderRuntimeIpcFrameV1(clientHello));
    const helloLine = await iterator.next();
    if (helloLine.done) {
      throw new ProviderRuntimeTransportErrorV1("provider runtime closed before server hello");
    }
    assertProviderRuntimeIpcFrameSizeV1(helloLine.value);
    const serverHello = ProviderRuntimeIpcServerHelloV1Schema.parse(
      JSON.parse(helloLine.value),
    );
    if (
      serverHello.clientNonce !== clientNonce ||
      !verifyProviderRuntimeIpcWireAuthV1(options.sharedSecret, serverHello)
    ) {
      throw new ProviderRuntimeIpcErrorV1(
        "authentication_failed",
        "provider runtime server hello was not authenticated",
      );
    }
    const requestId = randomLowerHexV1(16);
    const request = ProviderRuntimeIpcRequestV1Schema.parse(
      signProviderRuntimeIpcWireV1(options.sharedSecret, {
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "request",
        sessionId: serverHello.sessionId,
        requestId,
        sequence: 1,
        capabilityDigest: options.verifiedSelection.capabilityDigest,
        operation,
        payload,
      }),
    );
    socket.write(encodeProviderRuntimeIpcFrameV1(request));
    const responseLine = await iterator.next();
    if (responseLine.done) {
      throw new ProviderRuntimeTransportErrorV1("provider runtime closed before response");
    }
    assertProviderRuntimeIpcFrameSizeV1(responseLine.value);
    const response = ProviderRuntimeIpcResponseV1Schema.parse(
      JSON.parse(responseLine.value),
    );
    if (
      response.sessionId !== serverHello.sessionId ||
      response.requestId !== requestId ||
      response.sequence !== 1 ||
      !verifyProviderRuntimeIpcWireAuthV1(options.sharedSecret, response)
    ) {
      throw new ProviderRuntimeIpcErrorV1(
        "authentication_failed",
        "provider runtime response was not authenticated",
      );
    }
    if (!response.ok) {
      throw new ProviderRuntimeIpcErrorV1(response.error.code, response.error.message);
    }
    return response.payload;
  } catch (error) {
    if (error instanceof ProviderRuntimeIpcErrorV1 || error instanceof ProviderRuntimeTransportErrorV1) {
      throw error;
    }
    throw new ProviderRuntimeTransportErrorV1("provider runtime IPC exchange failed", {
      cause: error,
    });
  } finally {
    lines.close();
    socket.destroy();
  }
}

async function callWithTransportRetryV1(
  options: DurableObjectProviderRuntimeClientOptionsV1,
  operation: ProviderRuntimeIpcRequestV1["operation"],
  payload: ProviderRuntimeIpcJsonValueV1,
): Promise<ProviderRuntimeIpcSuccessPayloadV1> {
  const retryCount = options.transportRetryCount ?? 1;
  let attempt = 0;
  for (;;) {
    try {
      return await exchangeV1(options, operation, payload);
    } catch (error) {
      if (!(error instanceof ProviderRuntimeTransportErrorV1) || attempt >= retryCount) {
        throw error;
      }
      attempt += 1;
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
  }
}

export function createDurableObjectProviderRuntimeClientV1(
  options: DurableObjectProviderRuntimeClientOptionsV1,
): DurableObjectProviderRuntimeClientV1 {
  const copiedOptions = {
    ...options,
    sharedSecret: new Uint8Array(options.sharedSecret),
    verifiedSelection: lockVerifiedSelectionV1(options.verifiedSelection),
  };
  return Object.freeze({
    async inspectState() {
      return ProviderRuntimeIpcInspectStateResultV1Schema.parse(
        await callWithTransportRetryV1(copiedOptions, "inspect_state", {}),
      );
    },
    async readObject(locator: ProviderRuntimeIpcFixedObjectLocatorV1) {
      return ProviderRuntimeIpcReadObjectResultV1Schema.parse(
        await callWithTransportRetryV1(copiedOptions, "read_object", { locator }),
      );
    },
    async writeObject(input: {
      readonly locator: ProviderRuntimeIpcFixedObjectLocatorV1;
      readonly logicalBytes: number;
      readonly bytes: string;
    }) {
      return ProviderRuntimeIpcWriteObjectResultV1Schema.parse(
        await callWithTransportRetryV1(copiedOptions, "write_object", input),
      );
    },
    async compareCommit(input: ProviderRuntimeCompareCommitInputV1) {
      return ProviderRuntimeIpcCompareCommitResultV1Schema.parse(
        await callWithTransportRetryV1(copiedOptions, "compare_commit", {
          expectedRevision: input.expectedRevision,
          operationNonce: input.operationNonce,
          phase: input.phase,
          artifacts: input.artifacts,
        }),
      );
    },
  });
}
