import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptRoot, "..");
const workspaceRoot = path.resolve(packageRoot, "../..");
const dashboardRoot = path.resolve(packageRoot, "../dashboard");
const schemaSourcePath = path.join(
  packageRoot,
  "schemas/alpha-candidate-v1.schema.json",
);
const CANDIDATE_SCHEMA_VERSION = "understand-code-alpha-candidate-v1";
const RELEASE_SCHEMA_VERSION = "understand-code-alpha-release-v1";
const CANDIDATE_MANIFEST_FILE = "understand-code-alpha-candidate.json";
const CANDIDATE_SCHEMA_FILE = "understand-code-alpha-candidate-v1.schema.json";
const CHECKSUM_FILE = "SHA256SUMS";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const MAX_COMMAND_OUTPUT_BYTES = 64 * 1024 * 1024;
const MAX_METADATA_BYTES = 1024 * 1024;
const MAX_TARBALL_BYTES = 32 * 1024 * 1024;
const MAX_EXPANDED_TAR_BYTES = 20 * 1024 * 1024;
const MAX_TAR_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TAR_ENTRY_COUNT = 128;
const MAX_PAX_BYTES = 16 * 1024;
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
const GIT_TIMEOUT_MS = 30 * 1000;
const OBJECT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SAFE_TARBALL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.tgz$/u;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/u;

class UsageError extends Error {}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function compareUnicodeCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPathWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

async function pathDoesNotExist(target) {
  try {
    await lstat(target);
    return false;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

function boundedText(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength > MAX_COMMAND_OUTPUT_BYTES) {
    throw new Error(`${label} output is invalid`);
  }
  const text = bytes.toString("utf8");
  if (Buffer.byteLength(text, "utf8") !== bytes.byteLength || text.includes("\u0000")) {
    throw new Error(`${label} output is invalid`);
  }
  return text;
}

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    env: options.env ?? process.env,
    encoding: "buffer",
    timeout: options.timeout ?? COMMAND_TIMEOUT_MS,
    maxBuffer: options.maxBuffer ?? MAX_COMMAND_OUTPUT_BYTES,
    windowsHide: true,
  });
  return {
    stdout: Buffer.from(result.stdout),
    stderr: Buffer.from(result.stderr),
  };
}

function gitEnvironment() {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  return {
    ...environment,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_COUNT: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
  };
}

async function runGit(args, maxBuffer = MAX_COMMAND_OUTPUT_BYTES) {
  return run(
    "git",
    ["--no-pager", "-c", "core.fsmonitor=false", ...args],
    {
      cwd: workspaceRoot,
      env: gitEnvironment(),
      timeout: GIT_TIMEOUT_MS,
      maxBuffer,
    },
  );
}

function objectIdLengthForFormat(objectFormat) {
  return objectFormat === "sha1" ? 40 : objectFormat === "sha256" ? 64 : 0;
}

function assertObjectId(value, objectFormat, label) {
  const expectedLength = objectIdLengthForFormat(objectFormat);
  if (
    expectedLength === 0 ||
    !OBJECT_ID_PATTERN.test(value) ||
    value.length !== expectedLength
  ) {
    throw new Error(`${label} is invalid`);
  }
}

function singleLine(bytes, label) {
  const value = boundedText(bytes, label).trimEnd();
  if (value === "" || value.includes("\n") || value.includes("\r")) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

async function captureSourceState() {
  const topLevel = singleLine(
    (await runGit(["rev-parse", "--show-toplevel"], 4096)).stdout,
    "Git root",
  );
  const [workspaceReal, gitRootReal] = await Promise.all([
    realpath(workspaceRoot),
    realpath(topLevel),
  ]);
  if (workspaceReal !== gitRootReal) {
    throw new Error("Git root does not match the workspace");
  }
  const [objectFormatResult, commitResult, treeResult, statusResult, flagsResult] =
    await Promise.all([
      runGit(["rev-parse", "--show-object-format"], 64),
      runGit(["rev-parse", "--verify", "HEAD^{commit}"], 128),
      runGit(["rev-parse", "--verify", "HEAD^{tree}"], 128),
      runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
      runGit(["ls-files", "-v", "-z"]),
    ]);
  const objectFormat = singleLine(objectFormatResult.stdout, "Git object format");
  const commit = singleLine(commitResult.stdout, "Git commit");
  const tree = singleLine(treeResult.stdout, "Git tree");
  assertObjectId(commit, objectFormat, "Git commit");
  assertObjectId(tree, objectFormat, "Git tree");
  if (statusResult.stdout.byteLength !== 0) {
    throw new Error("Git tracked or untracked source is not clean");
  }
  const flagBytes = flagsResult.stdout;
  if (flagBytes.byteLength === 0 || flagBytes[flagBytes.byteLength - 1] !== 0) {
    throw new Error("Git index flags are not NUL terminated");
  }
  let flagOffset = 0;
  while (flagOffset < flagBytes.byteLength) {
    const end = flagBytes.indexOf(0, flagOffset);
    if (end < flagOffset + 3 || flagBytes[flagOffset + 1] !== 0x20) {
      throw new Error("Git index flag record is invalid");
    }
    const flag = flagBytes[flagOffset];
    const uppercase = flag >= 0x41 && flag <= 0x5a;
    const lowercase = flag >= 0x61 && flag <= 0x7a;
    if (!uppercase && !lowercase) throw new Error("Git index flag tag is invalid");
    if (flag === 0x53 || lowercase) {
      throw new Error("Git skip-worktree or assume-unchanged flags are forbidden");
    }
    flagOffset = end + 1;
  }
  const lockfile = await readCommittedLockfile(commit, objectFormat);
  const workingLockfile = await readRegularFile(
    path.join(workspaceRoot, LOCKFILE_PATH),
    8 * 1024 * 1024,
    "Working lockfile",
  );
  if (sha256(workingLockfile.bytes) !== lockfile.sha256) {
    throw new Error("Working lockfile differs from its committed blob");
  }
  return Object.freeze({
    vcs: "git",
    objectFormat,
    commit,
    tree,
    clean: true,
    lockfile,
  });
}

async function readCommittedLockfile(commit, objectFormat) {
  const lockTreeResult = await runGit(
    [
      "--literal-pathspecs",
      "ls-tree",
      "-z",
      "--full-tree",
      commit,
      "--",
      LOCKFILE_PATH,
    ],
    4096,
  );
  const lockTreeBytes = lockTreeResult.stdout;
  if (
    lockTreeBytes.byteLength === 0 ||
    lockTreeBytes[lockTreeBytes.byteLength - 1] !== 0 ||
    lockTreeBytes.subarray(0, -1).includes(0)
  ) {
    throw new Error("Committed lockfile tree entry is not one NUL-terminated record");
  }
  const lockTreeRecord = lockTreeBytes.subarray(0, -1);
  const lockTree = lockTreeRecord.toString("utf8");
  if (!Buffer.from(lockTree, "utf8").equals(lockTreeRecord)) {
    throw new Error("Committed lockfile tree entry is not canonical UTF-8");
  }
  const lockMatch = /^100644 blob ([0-9a-f]+)\tpnpm-lock\.yaml$/u.exec(lockTree);
  if (lockMatch === null) {
    throw new Error("Committed lockfile is missing or invalid");
  }
  const objectId = lockMatch[1];
  assertObjectId(objectId, objectFormat, "Committed lockfile object");
  const lockBytes = (await runGit(["cat-file", "blob", objectId])).stdout;
  return Object.freeze({
    path: LOCKFILE_PATH,
    objectId,
    sha256: sha256(lockBytes),
  });
}

async function verifyRecordedSourceState(source) {
  const topLevel = singleLine(
    (await runGit(["rev-parse", "--show-toplevel"], 4096)).stdout,
    "Git root",
  );
  const [workspaceReal, gitRootReal] = await Promise.all([
    realpath(workspaceRoot),
    realpath(topLevel),
  ]);
  if (workspaceReal !== gitRootReal) {
    throw new Error("Git root does not match the workspace");
  }
  const objectFormat = singleLine(
    (await runGit(["rev-parse", "--show-object-format"], 64)).stdout,
    "Git object format",
  );
  if (objectFormat !== source.objectFormat) {
    throw new Error("Candidate Git object format does not match the repository");
  }
  assertObjectId(source.commit, objectFormat, "Candidate Git commit");
  assertObjectId(source.tree, objectFormat, "Candidate Git tree");
  const [commit, tree] = await Promise.all([
    runGit(["rev-parse", "--verify", `${source.commit}^{commit}`], 128),
    runGit(["rev-parse", "--verify", `${source.commit}^{tree}`], 128),
  ]);
  if (
    singleLine(commit.stdout, "Candidate Git commit") !== source.commit ||
    singleLine(tree.stdout, "Candidate Git tree") !== source.tree
  ) {
    throw new Error("Candidate Git commit or tree binding is invalid");
  }
  const lockfile = await readCommittedLockfile(source.commit, objectFormat);
  if (
    lockfile.path !== source.lockfile.path ||
    lockfile.objectId !== source.lockfile.objectId ||
    lockfile.sha256 !== source.lockfile.sha256
  ) {
    throw new Error("Candidate committed lockfile binding is invalid");
  }
}

function sourceStatesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function assertNoViteEnvironmentFiles() {
  for (const root of [dashboardRoot, packageRoot]) {
    const entries = await readdir(root);
    if (entries.some((name) => name === ".env" || name.startsWith(".env."))) {
      throw new Error("Vite environment files are forbidden during candidate assembly");
    }
  }
}

function candidateChildEnvironment(toolRoot) {
  const environment = {
    PATH: process.env.PATH ?? "",
    CI: "true",
    HOME: toolRoot,
    USERPROFILE: toolRoot,
    TMPDIR: path.join(toolRoot, "tmp"),
    TMP: path.join(toolRoot, "tmp"),
    TEMP: path.join(toolRoot, "tmp"),
    XDG_CACHE_HOME: path.join(toolRoot, "cache"),
    XDG_CONFIG_HOME: path.join(toolRoot, "config"),
    XDG_STATE_HOME: path.join(toolRoot, "state"),
    COREPACK_HOME: path.join(toolRoot, "corepack"),
    npm_config_cache: path.join(toolRoot, "npm-cache"),
    npm_config_userconfig: path.join(toolRoot, "npm-userconfig"),
    npm_config_globalconfig: path.join(toolRoot, "npm-globalconfig"),
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
    LC_ALL: "C",
    LANG: "C",
    TZ: "UTC",
    NO_COLOR: "1",
  };
  for (const key of ["SystemRoot", "SYSTEMROOT", "COMSPEC", "PATHEXT"]) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  return environment;
}

function parseArguments(argv) {
  if (argv.length === 0) throw new UsageError("missing command");
  const [operation, ...rest] = argv;
  const expectedFlag = operation === "assemble"
    ? "--output"
    : operation === "verify"
      ? "--candidate"
      : null;
  if (expectedFlag === null || rest.length !== 2 || rest[0] !== expectedFlag) {
    throw new UsageError("invalid arguments");
  }
  const candidatePath = rest[1];
  if (
    typeof candidatePath !== "string" ||
    candidatePath === "" ||
    !path.isAbsolute(candidatePath) ||
    path.normalize(candidatePath) !== candidatePath
  ) {
    throw new UsageError("candidate path must be canonical and absolute");
  }
  return Object.freeze({ operation, candidatePath });
}

async function resolveNewCandidatePath(requestedPath) {
  const workspaceReal = await realpath(workspaceRoot);
  const parentRequested = path.dirname(requestedPath);
  const parentReal = await realpath(parentRequested);
  const parentMetadata = await lstat(parentReal);
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) {
    throw new Error("Candidate parent is not a real directory");
  }
  const candidate = path.join(parentReal, path.basename(requestedPath));
  if (isPathWithin(workspaceReal, candidate) || !(await pathDoesNotExist(candidate))) {
    throw new Error("Candidate output is unsafe or already exists");
  }
  return candidate;
}

async function resolveExistingCandidatePath(requestedPath) {
  const [workspaceReal, candidateReal] = await Promise.all([
    realpath(workspaceRoot),
    realpath(requestedPath),
  ]);
  const metadata = await lstat(requestedPath);
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    isPathWithin(workspaceReal, candidateReal)
  ) {
    throw new Error("Candidate directory is unsafe");
  }
  return candidateReal;
}

function assertPlainObject(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(value, keys, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort(compareUnicodeCodeUnits);
  const expected = [...keys].sort(compareUnicodeCodeUnits);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} has invalid fields`);
  }
}

function assertString(value, label, pattern = null) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    (pattern !== null && !pattern.test(value))
  ) {
    throw new Error(`${label} is invalid`);
  }
}

function validateCandidateManifest(candidate) {
  assertExactKeys(
    candidate,
    [
      "schemaVersion",
      "disposition",
      "releaseReady",
      "package",
      "subject",
      "embeddedReleaseManifest",
      "source",
      "build",
      "gates",
      "limitations",
    ],
    "Candidate manifest",
  );
  if (
    candidate.schemaVersion !== CANDIDATE_SCHEMA_VERSION ||
    candidate.disposition !== "unsigned_alpha_candidate" ||
    candidate.releaseReady !== false
  ) {
    throw new Error("Candidate disposition is invalid");
  }
  assertExactKeys(candidate.package, ["name", "version"], "Candidate package");
  assertString(candidate.package.name, "Candidate package name");
  assertString(candidate.package.version, "Candidate package version", VERSION_PATTERN);
  assertExactKeys(
    candidate.subject,
    ["file", "mediaType", "bytes", "sha256"],
    "Candidate subject",
  );
  assertString(candidate.subject.file, "Candidate subject file", SAFE_TARBALL_NAME_PATTERN);
  if (
    candidate.subject.mediaType !== "application/vnd.npm.package+gzip" ||
    !Number.isSafeInteger(candidate.subject.bytes) ||
    candidate.subject.bytes < 1 ||
    candidate.subject.bytes > MAX_TARBALL_BYTES ||
    !SHA256_PATTERN.test(candidate.subject.sha256)
  ) {
    throw new Error("Candidate subject is invalid");
  }
  assertExactKeys(
    candidate.embeddedReleaseManifest,
    ["path", "schemaVersion", "sha256"],
    "Embedded release manifest reference",
  );
  if (
    candidate.embeddedReleaseManifest.path !== "package/dist/release-manifest.json" ||
    candidate.embeddedReleaseManifest.schemaVersion !== RELEASE_SCHEMA_VERSION ||
    !SHA256_PATTERN.test(candidate.embeddedReleaseManifest.sha256)
  ) {
    throw new Error("Embedded release manifest reference is invalid");
  }
  assertExactKeys(
    candidate.source,
    ["vcs", "objectFormat", "commit", "tree", "clean", "lockfile"],
    "Candidate source",
  );
  const objectIdLength = candidate.source.objectFormat === "sha1"
    ? 40
    : candidate.source.objectFormat === "sha256"
      ? 64
      : 0;
  if (
    candidate.source.vcs !== "git" ||
    candidate.source.clean !== true ||
    objectIdLength === 0 ||
    !OBJECT_ID_PATTERN.test(candidate.source.commit) ||
    !OBJECT_ID_PATTERN.test(candidate.source.tree) ||
    candidate.source.commit.length !== objectIdLength ||
    candidate.source.tree.length !== objectIdLength
  ) {
    throw new Error("Candidate source is invalid");
  }
  assertExactKeys(
    candidate.source.lockfile,
    ["path", "objectId", "sha256"],
    "Candidate lockfile",
  );
  if (
    candidate.source.lockfile.path !== LOCKFILE_PATH ||
    !OBJECT_ID_PATTERN.test(candidate.source.lockfile.objectId) ||
    candidate.source.lockfile.objectId.length !== objectIdLength ||
    !SHA256_PATTERN.test(candidate.source.lockfile.sha256)
  ) {
    throw new Error("Candidate lockfile is invalid");
  }
  assertExactKeys(
    candidate.build,
    ["platform", "arch", "nativeTuple", "node", "npm", "pnpm"],
    "Candidate build",
  );
  for (const key of ["platform", "arch", "nativeTuple", "node", "npm", "pnpm"]) {
    assertString(candidate.build[key], `Candidate build ${key}`, VERSION_PATTERN);
  }
  if (candidate.build.nativeTuple !== `${candidate.build.platform}-${candidate.build.arch}`) {
    throw new Error("Candidate native tuple is invalid");
  }
  assertExactKeys(candidate.gates, ["coldPacked", "checksum"], "Candidate gates");
  if (candidate.gates.coldPacked !== "passed" || candidate.gates.checksum !== "passed") {
    throw new Error("Candidate gates are invalid");
  }
  assertExactKeys(
    candidate.limitations,
    ["signature", "sbom", "trustedProvenance", "crossPlatform"],
    "Candidate limitations",
  );
  if (
    candidate.limitations.signature !== "unavailable" ||
    candidate.limitations.sbom !== "unavailable" ||
    candidate.limitations.trustedProvenance !== "unavailable" ||
    candidate.limitations.crossPlatform !== "not_evaluated"
  ) {
    throw new Error("Candidate limitations are invalid");
  }
  return candidate;
}

function parseJson(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength === 0 || bytes.byteLength > MAX_METADATA_BYTES) {
    throw new Error(`${label} is invalid`);
  }
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`${label} is invalid`);
  }
}

async function readRegularFile(filePath, maximumBytes, label) {
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > maximumBytes) {
    throw new Error(`${label} is invalid`);
  }
  const bytes = await readFile(filePath);
  if (bytes.byteLength !== metadata.size) throw new Error(`${label} changed while reading`);
  return Object.freeze({ bytes, metadata });
}

function tarText(header, offset, length, label) {
  const field = header.subarray(offset, offset + length);
  const terminator = field.indexOf(0);
  const content = field.subarray(0, terminator === -1 ? field.length : terminator);
  const value = content.toString("utf8");
  if (!Buffer.from(value, "utf8").equals(content)) {
    throw new Error(`${label} is not canonical UTF-8`);
  }
  return value;
}

function tarOctal(header, offset, length, label) {
  const raw = tarText(header, offset, length, label).trim();
  if (!/^[0-7]+$/u.test(raw)) throw new Error(`${label} is not portable octal`);
  const value = Number.parseInt(raw, 8);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} is invalid`);
  return value;
}

function assertSafeArchivePath(entryPath, label) {
  if (
    entryPath === "" ||
    entryPath.startsWith("/") ||
    entryPath.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(entryPath) ||
    entryPath.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${label} is unsafe`);
  }
}

function parsePaxRecords(payload) {
  if (payload.byteLength === 0 || payload.byteLength > MAX_PAX_BYTES) {
    throw new Error("PAX payload is invalid");
  }
  const records = Object.create(null);
  let offset = 0;
  while (offset < payload.byteLength) {
    const separator = payload.indexOf(0x20, offset);
    if (separator <= offset) throw new Error("PAX record length is missing");
    const lengthText = payload.subarray(offset, separator).toString("ascii");
    if (!/^[1-9][0-9]*$/u.test(lengthText)) throw new Error("PAX record length is invalid");
    const length = Number.parseInt(lengthText, 10);
    const end = offset + length;
    if (
      !Number.isSafeInteger(length) ||
      end > payload.byteLength ||
      payload[end - 1] !== 0x0a
    ) {
      throw new Error("PAX record is not exactly bounded");
    }
    const recordBytes = payload.subarray(separator + 1, end - 1);
    const record = recordBytes.toString("utf8");
    if (!Buffer.from(record, "utf8").equals(recordBytes)) {
      throw new Error("PAX record is not canonical UTF-8");
    }
    const equals = record.indexOf("=");
    if (equals <= 0) throw new Error("PAX key is invalid");
    const key = record.slice(0, equals);
    if (!new Set(["path", "size", "mtime"]).has(key) || Object.hasOwn(records, key)) {
      throw new Error("PAX key is unsupported or duplicated");
    }
    records[key] = record.slice(equals + 1);
    offset = end;
  }
  if (
    Object.keys(records).sort(compareUnicodeCodeUnits).join(",") !== "mtime,path,size" ||
    !/^[0-9]+$/u.test(records.mtime) ||
    !/^(?:0|[1-9][0-9]*)$/u.test(records.size)
  ) {
    throw new Error("PAX records are incomplete or invalid");
  }
  assertSafeArchivePath(records.path, "PAX path");
  const size = Number.parseInt(records.size, 10);
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_TAR_FILE_BYTES) {
    throw new Error("PAX size is invalid");
  }
  return Object.freeze({ path: records.path, size });
}

function parseBoundedTarball(tarballBytes) {
  if (
    !Buffer.isBuffer(tarballBytes) ||
    tarballBytes.byteLength === 0 ||
    tarballBytes.byteLength > MAX_TARBALL_BYTES
  ) {
    throw new Error("Packed tgz exceeds its compressed bound");
  }
  const archive = gunzipSync(tarballBytes, { maxOutputLength: MAX_EXPANDED_TAR_BYTES });
  if (archive.byteLength === 0 || archive.byteLength > MAX_EXPANDED_TAR_BYTES) {
    throw new Error("Packed tar exceeds its expanded bound");
  }
  const rawEntries = [];
  let offset = 0;
  let terminated = false;
  let declaredPayloadBytes = 0;
  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      if (
        offset + 1024 > archive.byteLength ||
        !archive.subarray(offset).every((byte) => byte === 0)
      ) {
        throw new Error("Tar terminator is invalid");
      }
      terminated = true;
      break;
    }
    if (rawEntries.length >= MAX_TAR_ENTRY_COUNT) throw new Error("Tar has too many raw entries");
    const declaredChecksum = tarOctal(header, 148, 8, "Tar checksum");
    let checksum = 0;
    for (let index = 0; index < header.byteLength; index += 1) {
      checksum += index >= 148 && index < 156 ? 0x20 : header[index];
    }
    if (checksum !== declaredChecksum) throw new Error("Tar header checksum is invalid");
    if (!tarText(header, 257, 6, "Tar magic").startsWith("ustar")) {
      throw new Error("Tar format is unsupported");
    }
    const name = tarText(header, 0, 100, "Tar name");
    const prefix = tarText(header, 345, 155, "Tar prefix");
    const entryPath = prefix === "" ? name : `${prefix}/${name}`;
    assertSafeArchivePath(entryPath, "Tar path");
    const size = tarOctal(header, 124, 12, "Tar size");
    const typeByte = header[156];
    const type = typeByte === 0 ? "0" : String.fromCharCode(typeByte);
    if (type !== "0" && type !== "x") throw new Error("Tar entry type is forbidden");
    if (tarText(header, 157, 100, "Tar link target") !== "") {
      throw new Error("Tar link target is forbidden");
    }
    const maximumSize = type === "x" ? MAX_PAX_BYTES : MAX_TAR_FILE_BYTES;
    if (size > maximumSize) throw new Error("Tar entry exceeds its size bound");
    declaredPayloadBytes += size;
    if (declaredPayloadBytes > MAX_EXPANDED_TAR_BYTES) {
      throw new Error("Tar declared payload exceeds its aggregate bound");
    }
    const payloadStart = offset + 512;
    const payloadEnd = payloadStart + size;
    const paddedEnd = payloadStart + Math.ceil(size / 512) * 512;
    if (
      payloadEnd > archive.byteLength ||
      paddedEnd > archive.byteLength ||
      !archive.subarray(payloadEnd, paddedEnd).every((byte) => byte === 0)
    ) {
      throw new Error("Tar entry payload or padding is invalid");
    }
    rawEntries.push(Object.freeze({
      path: entryPath,
      size,
      type,
      payload: archive.subarray(payloadStart, payloadEnd),
    }));
    offset = paddedEnd;
  }
  if (!terminated) throw new Error("Tar is missing its canonical terminator");
  const files = new Map();
  const rawPaths = new Set();
  let pendingPax = null;
  let logicalBytes = 0;
  for (const entry of rawEntries) {
    if (rawPaths.has(entry.path)) throw new Error("Tar raw path is duplicated");
    rawPaths.add(entry.path);
    if (entry.type === "x") {
      if (pendingPax !== null) throw new Error("PAX headers cannot be chained");
      pendingPax = parsePaxRecords(entry.payload);
      continue;
    }
    const logicalPath = pendingPax?.path ?? entry.path;
    if (pendingPax !== null && (entry.path !== logicalPath || entry.size !== pendingPax.size)) {
      throw new Error("PAX alias does not exactly match its regular entry");
    }
    pendingPax = null;
    assertSafeArchivePath(logicalPath, "Tar logical path");
    if (files.has(logicalPath) || files.size >= MAX_TAR_ENTRY_COUNT) {
      throw new Error("Tar logical path is duplicated or over budget");
    }
    logicalBytes += entry.size;
    if (logicalBytes > MAX_EXPANDED_TAR_BYTES) {
      throw new Error("Tar logical payload exceeds its aggregate bound");
    }
    files.set(logicalPath, Buffer.from(entry.payload));
  }
  if (pendingPax !== null || files.size === 0) throw new Error("Tar PAX state is incomplete");
  return files;
}

async function verifyArchive(candidateRoot, candidate) {
  const tarballPath = path.join(candidateRoot, candidate.subject.file);
  const tarball = await readRegularFile(
    tarballPath,
    MAX_TARBALL_BYTES,
    "Candidate tarball",
  );
  if (
    tarball.metadata.size !== candidate.subject.bytes ||
    sha256(tarball.bytes) !== candidate.subject.sha256
  ) {
    throw new Error("Candidate tarball does not match its subject");
  }
  const files = parseBoundedTarball(tarball.bytes);
  for (const required of ["package/package.json", candidate.embeddedReleaseManifest.path]) {
    if (!files.has(required)) {
      throw new Error("Tar inventory is missing required metadata");
    }
  }
  const packageBytes = files.get("package/package.json");
  const releaseBytes = files.get(candidate.embeddedReleaseManifest.path);
  if (sha256(releaseBytes) !== candidate.embeddedReleaseManifest.sha256) {
    throw new Error("Embedded release manifest digest is invalid");
  }
  const packageManifest = parseJson(packageBytes, "Packed package metadata");
  const releaseManifest = parseJson(releaseBytes, "Packed release manifest");
  assertPlainObject(packageManifest, "Packed package metadata");
  assertPlainObject(releaseManifest, "Packed release manifest");
  assertPlainObject(releaseManifest.package, "Packed release package");
  assertPlainObject(releaseManifest.native, "Packed release native entry");
  if (
    packageManifest.name !== candidate.package.name ||
    packageManifest.version !== candidate.package.version ||
    releaseManifest.schemaVersion !== candidate.embeddedReleaseManifest.schemaVersion ||
    releaseManifest.product !== "understand-code" ||
    releaseManifest.package.name !== candidate.package.name ||
    releaseManifest.package.version !== candidate.package.version ||
    releaseManifest.native.tuple !== candidate.build.nativeTuple ||
    releaseManifest.native.path !== `dist/native/${candidate.build.nativeTuple}/provider_kernel_peer.node` ||
    !SHA256_PATTERN.test(releaseManifest.native.sha256)
  ) {
    throw new Error("Packed release identity is invalid");
  }
  const nativeEntry = `package/${releaseManifest.native.path}`;
  const nativeEntries = [...files.keys()].filter((entry) =>
    entry.includes("/dist/native/") || entry.endsWith("provider_kernel_peer.node"),
  );
  if (nativeEntries.length !== 1 || nativeEntries[0] !== nativeEntry) {
    throw new Error("Packed native tuple inventory is invalid");
  }
  const nativeBytes = files.get(nativeEntry);
  if (nativeBytes === undefined) throw new Error("Packed native tuple is missing");
  if (sha256(nativeBytes) !== releaseManifest.native.sha256) {
    throw new Error("Packed native tuple digest is invalid");
  }
}

function checksumBytes(records) {
  const lines = [...records]
    .sort(([left], [right]) => compareUnicodeCodeUnits(left, right))
    .map(([file, digest]) => `${digest.slice("sha256:".length)}  ${file}`);
  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

async function verifyCandidate(candidatePath) {
  const candidateRoot = await resolveExistingCandidatePath(candidatePath);
  const entries = await readdir(candidateRoot, { withFileTypes: true });
  const names = entries.map((entry) => entry.name).sort(compareUnicodeCodeUnits);
  const tarballs = names.filter((name) => SAFE_TARBALL_NAME_PATTERN.test(name));
  const expectedFixed = [CANDIDATE_MANIFEST_FILE, CANDIDATE_SCHEMA_FILE, CHECKSUM_FILE];
  if (
    entries.some((entry) => !entry.isFile() || entry.isSymbolicLink()) ||
    names.length !== 4 ||
    tarballs.length !== 1 ||
    expectedFixed.some((name) => !names.includes(name))
  ) {
    throw new Error("Candidate directory must contain exactly four regular files");
  }
  const [sourceSchemaBytes, candidateSchema, candidateManifest, checksum] =
    await Promise.all([
      readFile(schemaSourcePath),
      readRegularFile(
        path.join(candidateRoot, CANDIDATE_SCHEMA_FILE),
        MAX_METADATA_BYTES,
        "Candidate schema",
      ),
      readRegularFile(
        path.join(candidateRoot, CANDIDATE_MANIFEST_FILE),
        MAX_METADATA_BYTES,
        "Candidate manifest",
      ),
      readRegularFile(
        path.join(candidateRoot, CHECKSUM_FILE),
        MAX_METADATA_BYTES,
        "Candidate checksums",
      ),
    ]);
  if (!candidateSchema.bytes.equals(sourceSchemaBytes)) {
    throw new Error("Candidate schema differs from its reviewed source");
  }
  const candidate = validateCandidateManifest(
    parseJson(candidateManifest.bytes, "Candidate manifest"),
  );
  if (candidate.subject.file !== tarballs[0]) {
    throw new Error("Candidate subject is not the unique tarball");
  }
  const tarball = await readRegularFile(
    path.join(candidateRoot, candidate.subject.file),
    MAX_TARBALL_BYTES,
    "Candidate tarball",
  );
  const expectedChecksums = checksumBytes([
    [candidate.subject.file, sha256(tarball.bytes)],
    [CANDIDATE_MANIFEST_FILE, sha256(candidateManifest.bytes)],
    [CANDIDATE_SCHEMA_FILE, sha256(candidateSchema.bytes)],
  ]);
  if (!checksum.bytes.equals(expectedChecksums)) {
    throw new Error("Candidate checksums are invalid");
  }
  await verifyArchive(candidateRoot, candidate);
  await verifyRecordedSourceState(candidate.source);
  return candidate;
}

async function commandVersion(command, environment) {
  const result = await run(command, ["--version"], {
    cwd: workspaceRoot,
    env: environment,
    maxBuffer: 4096,
    timeout: GIT_TIMEOUT_MS,
  });
  const version = singleLine(result.stdout, `${command} version`);
  if (!VERSION_PATTERN.test(version)) throw new Error(`${command} version is invalid`);
  return version;
}

async function assembleCandidate(requestedPath) {
  const outputPath = await resolveNewCandidatePath(requestedPath);
  await assertNoViteEnvironmentFiles();
  const sourceBefore = await captureSourceState();
  let temporaryRoot = null;
  let toolRoot = null;
  try {
    temporaryRoot = await mkdtemp(
      path.join(path.dirname(outputPath), ".understand-code-alpha-candidate-"),
    );
    toolRoot = await mkdtemp(
      path.join(path.dirname(outputPath), ".understand-code-alpha-tools-"),
    );
    await mkdir(path.join(toolRoot, "tmp"));
    await Promise.all([
      writeFile(path.join(toolRoot, "npm-userconfig"), "", { flag: "wx" }),
      writeFile(path.join(toolRoot, "npm-globalconfig"), "", { flag: "wx" }),
    ]);
    const childEnvironment = candidateChildEnvironment(toolRoot);
    const [npmVersion, pnpmVersion] = await Promise.all([
      commandVersion("npm", childEnvironment),
      commandVersion("pnpm", childEnvironment),
    ]);
    await run("npm", ["run", "build"], {
      cwd: packageRoot,
      env: childEnvironment,
    });
    const packed = await run(
      "npm",
      ["pack", ".", "--ignore-scripts", "--json", "--pack-destination", temporaryRoot],
      {
        cwd: packageRoot,
        env: childEnvironment,
      },
    );
    const packRecords = parseJson(packed.stdout, "npm pack result");
    if (!Array.isArray(packRecords) || packRecords.length !== 1) {
      throw new Error("npm pack did not produce exactly one record");
    }
    const packRecord = packRecords[0];
    assertPlainObject(packRecord, "npm pack record");
    assertString(packRecord.filename, "npm pack filename", SAFE_TARBALL_NAME_PATTERN);
    const packedNames = await readdir(temporaryRoot);
    if (packedNames.length !== 1 || packedNames[0] !== packRecord.filename) {
      throw new Error("npm pack did not produce exactly one tarball");
    }
    const tarballPath = path.join(temporaryRoot, packRecord.filename);
    const tarball = await readRegularFile(tarballPath, MAX_TARBALL_BYTES, "Packed tarball");
    await run("npm", ["run", "test:cold"], {
      cwd: packageRoot,
      env: {
        ...childEnvironment,
        UNDERSTAND_CODE_PREVIEW_TARBALL: tarballPath,
      },
    });
    const sourceAfter = await captureSourceState();
    if (!sourceStatesEqual(sourceBefore, sourceAfter)) {
      throw new Error("Source changed during candidate assembly");
    }
    const schemaBytes = await readFile(schemaSourcePath);
    const packedFiles = parseBoundedTarball(tarball.bytes);
    const packageBytes = packedFiles.get("package/package.json");
    const releaseBytes = packedFiles.get("package/dist/release-manifest.json");
    if (packageBytes === undefined || releaseBytes === undefined) {
      throw new Error("Packed release metadata is missing");
    }
    const packageManifest = parseJson(packageBytes, "Packed package metadata");
    const releaseManifest = parseJson(releaseBytes, "Packed release manifest");
    assertPlainObject(packageManifest, "Packed package metadata");
    assertPlainObject(releaseManifest, "Packed release manifest");
    if (
      typeof packageManifest.name !== "string" ||
      typeof packageManifest.version !== "string" ||
      releaseManifest.schemaVersion !== RELEASE_SCHEMA_VERSION
    ) {
      throw new Error("Packed release metadata is invalid");
    }
    const candidate = validateCandidateManifest({
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
      disposition: "unsigned_alpha_candidate",
      releaseReady: false,
      package: {
        name: packageManifest.name,
        version: packageManifest.version,
      },
      subject: {
        file: packRecord.filename,
        mediaType: "application/vnd.npm.package+gzip",
        bytes: tarball.metadata.size,
        sha256: sha256(tarball.bytes),
      },
      embeddedReleaseManifest: {
        path: "package/dist/release-manifest.json",
        schemaVersion: releaseManifest.schemaVersion,
        sha256: sha256(releaseBytes),
      },
      source: sourceAfter,
      build: {
        platform: process.platform,
        arch: process.arch,
        nativeTuple: `${process.platform}-${process.arch}`,
        node: process.version,
        npm: npmVersion,
        pnpm: pnpmVersion,
      },
      gates: {
        coldPacked: "passed",
        checksum: "passed",
      },
      limitations: {
        signature: "unavailable",
        sbom: "unavailable",
        trustedProvenance: "unavailable",
        crossPlatform: "not_evaluated",
      },
    });
    const manifestBytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    await writeFile(path.join(temporaryRoot, CANDIDATE_SCHEMA_FILE), schemaBytes, { flag: "wx" });
    await writeFile(path.join(temporaryRoot, CANDIDATE_MANIFEST_FILE), manifestBytes, { flag: "wx" });
    await writeFile(
      path.join(temporaryRoot, CHECKSUM_FILE),
      checksumBytes([
        [packRecord.filename, sha256(tarball.bytes)],
        [CANDIDATE_MANIFEST_FILE, sha256(manifestBytes)],
        [CANDIDATE_SCHEMA_FILE, sha256(schemaBytes)],
      ]),
      { flag: "wx" },
    );
    await verifyCandidate(temporaryRoot);
    if (!(await pathDoesNotExist(outputPath))) {
      throw new Error("Candidate output appeared during assembly");
    }
    await rm(toolRoot, { recursive: true, force: true });
    toolRoot = null;
    await assertNoViteEnvironmentFiles();
    const sourceAtPublish = await captureSourceState();
    if (!sourceStatesEqual(sourceBefore, sourceAtPublish)) {
      throw new Error("Source changed before candidate publication");
    }
    await rename(temporaryRoot, outputPath);
    temporaryRoot = null;
    return candidate;
  } finally {
    const cleanupResults = await Promise.allSettled(
      [temporaryRoot, toolRoot]
        .filter((root) => root !== null)
        .map((root) => rm(root, { recursive: true, force: true })),
    );
    const cleanupFailure = cleanupResults.find((result) => result.status === "rejected");
    if (cleanupFailure?.status === "rejected") {
      throw cleanupFailure.reason;
    }
  }
}

async function main() {
  try {
    const { operation, candidatePath } = parseArguments(process.argv.slice(2));
    const candidate = operation === "assemble"
      ? await assembleCandidate(candidatePath)
      : await verifyCandidate(candidatePath);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      operation,
      disposition: candidate.disposition,
      releaseReady: candidate.releaseReady,
    })}\n`);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write("alpha-candidate: configuration_error\n");
      process.exitCode = 2;
      return;
    }
    process.stderr.write("alpha-candidate: verification_failed\n");
    process.exitCode = 1;
  }
}

await main();
