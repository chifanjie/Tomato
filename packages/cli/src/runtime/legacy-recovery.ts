import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { ArtifactManifestV1Schema } from "@understand-code/contracts";
import { CliOperationErrorV1 } from "../errors/cli-operation-error.js";

/** Valid ArtifactStore state remains upgradeable. Loose/invalid old formats need an explicit archive first. */
export async function assertCompatibleLocalArtifacts(canonicalRoot: string): Promise<void> {
  const managed = path.join(canonicalRoot, ".understand-code");
  const stat = await lstat(managed).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return undefined; throw error; });
  if (!stat) return;
  if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(managed) !== managed) throw new CliOperationErrorV1("recovery_unsafe_path");
  let manifest;
  try { manifest = await open(path.join(managed, "artifact-manifest.json"), constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new CliOperationErrorV1("legacy_state_requires_recovery"); }
  if (manifest) {
    try {
      if (!(await manifest.stat()).isFile() || !ArtifactManifestV1Schema.safeParse(JSON.parse(await manifest.readFile("utf8"))).success) {
        throw new CliOperationErrorV1("legacy_state_requires_recovery");
      }
    } catch { throw new CliOperationErrorV1("legacy_state_requires_recovery"); }
    finally { await manifest.close(); }
    return;
  }
  for (const name of ["knowledge-graph.json", "knowledge-base", "tasks", "knowledge-drafts"]) {
    const candidate = path.join(managed, name);
    const entry = await lstat(candidate).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return undefined; throw error; });
    if (!entry) continue;
    if (entry.isSymbolicLink() || !entry.isDirectory() || (await readdir(candidate)).length > 0) {
      throw new CliOperationErrorV1("legacy_state_requires_recovery");
    }
  }
}
