import { rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const BUILD_ARTIFACT_PATHS = Object.freeze([
  "dist",
  "packages/contracts/dist",
  "packages/repository-state/dist",
  "packages/artifact-store/dist",
  "packages/core/dist",
  "packages/dashboard/dist",
  "packages/dashboard/node_modules/.tmp/tsconfig.app.tsBuildInfoFile",
]);

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");

function resolveArtifactPath(root, relativePath) {
  if (isAbsolute(relativePath)) {
    throw new Error(`Build artifact target must be relative: ${relativePath}`);
  }
  const absoluteRoot = resolve(root);
  const target = resolve(absoluteRoot, relativePath);
  const targetFromRoot = relative(absoluteRoot, target);
  if (
    targetFromRoot === ""
    || targetFromRoot === ".."
    || targetFromRoot.startsWith(`..${sep}`)
    || isAbsolute(targetFromRoot)
  ) {
    throw new Error(`Build artifact target escapes repository root: ${relativePath}`);
  }
  return target;
}

export async function cleanBuildArtifacts(root = repositoryRoot) {
  for (const relativePath of BUILD_ARTIFACT_PATHS) {
    await rm(resolveArtifactPath(root, relativePath), {
      recursive: true,
      force: true,
    });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  await cleanBuildArtifacts();
}
