import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const NATIVE_KERNEL_PEER_FILE_V1 = "provider_kernel_peer.node";

function supportedTupleV1() {
  if (
    (process.platform !== "darwin" && process.platform !== "linux") ||
    (process.arch !== "arm64" && process.arch !== "x64")
  ) {
    throw new Error(
      `The provider kernel-peer native asset does not support ${process.platform}-${process.arch}.`,
    );
  }
  return `${process.platform}-${process.arch}`;
}

function assertNativeBinaryV1(bytes) {
  if (bytes.byteLength < 64) {
    throw new Error("The provider kernel-peer native asset is truncated.");
  }
  if (process.platform === "darwin") {
    if (!bytes.subarray(0, 4).equals(Buffer.from([0xcf, 0xfa, 0xed, 0xfe]))) {
      throw new Error("The provider kernel-peer native asset is not a 64-bit Mach-O binary.");
    }
    const expectedCpu = process.arch === "arm64" ? 0x0100000c : 0x01000007;
    if (bytes.readUInt32LE(4) !== expectedCpu) {
      throw new Error("The provider kernel-peer Mach-O architecture does not match the build tuple.");
    }
    return;
  }
  if (
    !bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) ||
    bytes[4] !== 2 ||
    bytes[5] !== 1
  ) {
    throw new Error("The provider kernel-peer native asset is not a 64-bit little-endian ELF binary.");
  }
  const expectedMachine = process.arch === "arm64" ? 183 : 62;
  if (bytes.readUInt16LE(18) !== expectedMachine) {
    throw new Error("The provider kernel-peer ELF architecture does not match the build tuple.");
  }
}

async function assertExactSourceInventoryV1(sourceNativeRoot, tuple) {
  const tuples = await readdir(sourceNativeRoot);
  if (tuples.length !== 1 || tuples[0] !== tuple) {
    throw new Error(
      `The provider kernel-peer native source must contain exactly tuple ${tuple}.`,
    );
  }
  const tupleRoot = path.join(sourceNativeRoot, tuple);
  const entries = await readdir(tupleRoot);
  if (entries.length !== 1 || entries[0] !== NATIVE_KERNEL_PEER_FILE_V1) {
    throw new Error(
      `The provider kernel-peer tuple ${tuple} must contain exactly ${NATIVE_KERNEL_PEER_FILE_V1}.`,
    );
  }
  const source = path.join(tupleRoot, NATIVE_KERNEL_PEER_FILE_V1);
  const metadata = await lstat(source);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("The provider kernel-peer native source must be a regular non-symlink file.");
  }
  return source;
}

/**
 * Copies the one native addon for this exact build tuple and proves that no
 * stale/cross-architecture asset entered the publishable package.
 */
export async function copyCurrentNativeKernelPeerAssetV1({
  sourceNativeRoot,
  destinationNativeRoot,
}) {
  const tuple = supportedTupleV1();
  const source = await assertExactSourceInventoryV1(sourceNativeRoot, tuple);
  const bytes = await readFile(source);
  assertNativeBinaryV1(bytes);
  const digest = createHash("sha256").update(bytes).digest("hex");

  await rm(destinationNativeRoot, { force: true, recursive: true });
  const destinationTupleRoot = path.join(destinationNativeRoot, tuple);
  await mkdir(destinationTupleRoot, { recursive: true });
  const destination = path.join(
    destinationTupleRoot,
    NATIVE_KERNEL_PEER_FILE_V1,
  );
  await writeFile(destination, bytes, { flag: "wx", mode: 0o644 });
  await chmod(destination, 0o644);

  const copiedMetadata = await lstat(destination);
  const copiedBytes = await readFile(destination);
  if (
    !copiedMetadata.isFile() ||
    copiedMetadata.isSymbolicLink() ||
    (copiedMetadata.mode & 0o777) !== 0o644 ||
    createHash("sha256").update(copiedBytes).digest("hex") !== digest
  ) {
    throw new Error("The copied provider kernel-peer native asset failed continuity validation.");
  }
  assertNativeBinaryV1(copiedBytes);
  return Object.freeze({ destination, digest, tuple });
}
