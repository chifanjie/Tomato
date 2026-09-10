import { createHash, randomBytes } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import path from "node:path";
import { sha256CanonicalJson } from "@understand-code/artifact-store";
import { RefreshIndexOutputV1Schema, type RefreshIndexInputV1 } from "@understand-code/contracts";
import { idempotencyConflictFailure, ToolFailure } from "../errors/tool-errors.js";

function location(root: string, key: string) {
  const directory = path.join(root, ".understand-code/local-refresh-receipts-v1");
  return { directory, file: path.join(directory, `${createHash("sha256").update(key).digest("hex")}.json`) };
}
async function checkedDirectory(directory: string) {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(directory) !== directory) throw new Error("local refresh receipt directory is invalid");
}
export async function readLocalRefreshReceiptV1(root: string, input: RefreshIndexInputV1): Promise<unknown | undefined> {
  const { directory, file } = location(root, input.idempotencyKey);
  try { await checkedDirectory(directory); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  let handle;
  try { handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error("local refresh receipt is invalid");
    const receipt = JSON.parse(await handle.readFile("utf8"));
    if (receipt.requestDigest !== sha256CanonicalJson(input)) throw new ToolFailure(idempotencyConflictFailure(input.idempotencyKey, sha256CanonicalJson(input), receipt.requestDigest));
    return RefreshIndexOutputV1Schema.parse(receipt.result);
  } finally { await handle.close(); }
}
export async function writeLocalRefreshReceiptV1(root: string, input: RefreshIndexInputV1, result: unknown): Promise<void> {
  const { directory, file } = location(root, input.idempotencyKey);
  await fs.mkdir(directory, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
  await checkedDirectory(directory);
  const temporary = `${file}.${randomBytes(12).toString("hex")}.tmp`;
  const handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { await handle.writeFile(JSON.stringify({ schemaVersion: 1, requestDigest: sha256CanonicalJson(input), result: RefreshIndexOutputV1Schema.parse(result) })); await handle.sync(); }
  finally { await handle.close(); }
  await fs.rename(temporary, file);
  const parent = await fs.open(directory, constants.O_RDONLY);
  try { await parent.sync(); } finally { await parent.close(); }
}
