import path from "node:path";
import { readFile } from "node:fs/promises";

import { ArtifactStore } from "../dist/index.js";

const [root, transactionPath, crashTarget] = process.argv.slice(2);
if (
  root === undefined ||
  transactionPath === undefined ||
  crashTarget === undefined
) {
  throw new TypeError(
    "Expected worktree root, transaction JSON path, and crash target.",
  );
}

const transaction = JSON.parse(await readFile(transactionPath, "utf8"));
const store = await ArtifactStore.open(root, transaction.storeOptions);
const exitAfterTargetRename = ({ stage, targetPath }) => {
  if (
    stage === "after_rename" &&
    path.basename(targetPath) === crashTarget
  ) {
    process.exit(86);
  }
};

await store.persistTaskBundle(transaction.input, {
  ...transaction.persistOptions,
  ...(crashTarget === "artifact-manifest.json"
    ? { manifestWrite: { faultInjector: exitAfterTargetRename } }
    : { artifactWrite: { faultInjector: exitAfterTargetRename } }),
});

throw new Error(`Crash target was not reached: ${crashTarget}`);
