import { readFile, realpath } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function exactArgumentsV1(argv) {
  if (argv.length !== 6) {
    throw new TypeError("C09 packed browser worker requires exactly six arguments");
  }
  const [nonce, laneText, bundlePath, goldenPath, invalidPath, strictPath] = argv;
  const laneIndex = Number(laneText);
  if (
    !/^[0-9a-f]{32}$/u.test(nonce) ||
    !Number.isSafeInteger(laneIndex) ||
    laneIndex < 0 ||
    laneIndex > 3
  ) {
    throw new TypeError("C09 packed browser worker arguments are invalid");
  }
  return { nonce, laneIndex, bundlePath, goldenPath, invalidPath, strictPath };
}

async function zeroCopyBytesV1(path, label) {
  const exactPath = await realpath(path);
  const fileBytes = await readFile(exactPath);
  const bytes = new Uint8Array(
    fileBytes.buffer,
    fileBytes.byteOffset,
    fileBytes.byteLength,
  );
  if (
    bytes.buffer !== fileBytes.buffer ||
    bytes.byteOffset !== fileBytes.byteOffset ||
    bytes.byteLength !== fileBytes.byteLength
  ) {
    throw new Error(`C09 packed browser ${label} bytes were copied`);
  }
  return bytes;
}

const input = exactArgumentsV1(process.argv.slice(2));
const [bundlePath, goldenBytes, invalidBytes, strictManifestBytes] =
  await Promise.all([
    realpath(input.bundlePath),
    zeroCopyBytesV1(input.goldenPath, "golden"),
    zeroCopyBytesV1(input.invalidPath, "invalid"),
    zeroCopyBytesV1(input.strictPath, "strict manifest"),
  ]);
Object.defineProperty(
  globalThis,
  "__UNDERSTAND_CODE_C09_DISTRIBUTION_REPLAY_INPUT_V1__",
  {
    configurable: true,
    value: Object.freeze({
      runtime: "browser",
      nonce: input.nonce,
      laneIndex: input.laneIndex,
      goldenBytes,
      invalidBytes,
      strictManifestBytes,
    }),
  },
);
delete globalThis.process;
delete globalThis.Buffer;
const { c09BrowserReplayResult } = await import(pathToFileURL(bundlePath).href);
if (
  Object.hasOwn(
    globalThis,
    "__UNDERSTAND_CODE_C09_DISTRIBUTION_REPLAY_INPUT_V1__",
  )
) {
  throw new Error("C09 packed browser replay input was not deleted");
}
globalThis.console.log(JSON.stringify(c09BrowserReplayResult));
