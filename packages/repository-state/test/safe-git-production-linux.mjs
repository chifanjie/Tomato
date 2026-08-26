import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import {
  bootstrapSafeGitDescriptorBoundCandidateV1,
  classifySafeGitReadCommandV1,
  createSafeGitTaskBaselineLeaseIntentV1,
  getRepositorySnapshotDetailedWithSafeGitCapabilityV1,
} from "../dist/index.js";
import { canonicalizeJson } from "@understand-code/contracts";

if (process.platform !== "linux") {
  throw new Error("production SafeGit read proof requires Linux");
}

const executable =
  process.env.UNDERSTAND_CODE_SAFE_GIT_EXECUTABLE ?? "/usr/bin/git";
const root = realpathSync(mkdtempSync("/var/tmp/uc-step15-safe-git-read-"));
const repository = `${root}/repository`;
const marker = `${root}/malicious-config-executed`;
const maliciousExecutable = `${root}/malicious-config-surface`;
const maliciousGlobalConfig = `${root}/malicious-global-config`;
const candidates = new Set();

function git(repositoryPath, args, options = {}) {
  return execFileSync("/usr/bin/git", ["-C", repositoryPath, ...args], {
    encoding: options.encoding ?? "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function initializeRepository(repositoryPath, withHistory) {
  mkdirSync(repositoryPath, { mode: 0o700 });
  execFileSync("/usr/bin/git", ["init", "--quiet", repositoryPath], {
    stdio: "pipe",
  });
  if (!withHistory) return;
  writeFileSync(`${repositoryPath}/.gitignore`, "ignored.txt\n", { mode: 0o600 });
  writeFileSync(`${repositoryPath}/base.txt`, "base\n", { mode: 0o600 });
  git(repositoryPath, ["add", "--", ".gitignore", "base.txt"]);
  git(repositoryPath, [
    "-c",
    "user.name=SafeGit Production",
    "-c",
    "user.email=safe-git@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "base",
  ]);
  writeFileSync(`${repositoryPath}/committed.txt`, "committed\n", {
    mode: 0o600,
  });
  git(repositoryPath, ["add", "--", "committed.txt"]);
  git(repositoryPath, [
    "-c",
    "user.name=SafeGit Production",
    "-c",
    "user.email=safe-git@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "head",
  ]);
  writeFileSync(`${repositoryPath}/staged.txt`, "staged\n", { mode: 0o600 });
  git(repositoryPath, ["add", "--", "staged.txt"]);
  appendFileSync(`${repositoryPath}/committed.txt`, "unstaged\n");
  writeFileSync(`${repositoryPath}/untracked.txt`, "untracked\n", {
    mode: 0o600,
  });
  writeFileSync(`${repositoryPath}/ignored.txt`, "ignored\n", { mode: 0o600 });
}

async function bindCandidate(repositoryPath, executeVersion = true) {
  const candidate =
    await bootstrapSafeGitDescriptorBoundCandidateV1(repositoryPath);
  candidates.add(candidate);
  await candidate.capability.bindRepositoryControl();
  await candidate.capability.bindRepositoryIdentity();
  await candidate.capability.bindEmptyHooksDirectory();
  await candidate.capability.bindGitExecutable(executable);
  if (executeVersion) await candidate.capability.executeGitVersion();
  return candidate;
}

function writeTaskBaselineMarker(repositoryPath, identity, commit, taskId, nonce) {
  const baselineSnapshotId = `snapshot-${"a".repeat(64)}`;
  const intent = createSafeGitTaskBaselineLeaseIntentV1({
    repositoryId: identity.repositoryId,
    worktreeId: identity.worktreeId,
    taskId,
    baselineSnapshotId,
    objectFormat: "sha1",
    commit,
    markerNonce: nonce,
  });
  const providerDigest = `sha256:${"b".repeat(64)}`;
  const envelope = {
    gitLease: intent.gitLease,
    profile: "task_baseline_transaction_intent_v1",
    providerPlan: {
      baselineContentDigest: providerDigest,
      baselineLogicalBytes: 1,
      baselineProviderId: "safe-git-production-smoke-v1",
      baselineWriteNonce: nonce,
      baselineLocatorContentDigest: providerDigest,
      idempotencyKeyDigest: providerDigest,
      operation: "capture_task_baseline_v1",
      snapshotArtifactId: "snapshot-artifact-safe-git-production-smoke-v1",
      snapshotContentDigest: providerDigest,
    },
    schemaVersion: 1,
  };
  const markerBytes = Buffer.from(canonicalizeJson(envelope), "utf8");
  const markerContentDigest = `sha256:${createHash("sha256").update(markerBytes).digest("hex")}`;
  const markerPath = `${repositoryPath}/.understand-code/.recovery/task-baseline-transactions/${taskId}-${nonce}.json`;
  mkdirSync(`${repositoryPath}/.understand-code`, { recursive: true, mode: 0o700 });
  mkdirSync(`${repositoryPath}/.understand-code/.recovery`, { recursive: true, mode: 0o700 });
  mkdirSync(`${repositoryPath}/.understand-code/.recovery/task-baseline-transactions`, { recursive: true, mode: 0o700 });
  chmodSync(`${repositoryPath}/.understand-code`, 0o700);
  chmodSync(`${repositoryPath}/.understand-code/.recovery`, 0o700);
  chmodSync(`${repositoryPath}/.understand-code/.recovery/task-baseline-transactions`, 0o700);
  writeFileSync(markerPath, markerBytes, { mode: 0o600 });
  chmodSync(markerPath, 0o600);
  return { intent, request: { taskId, baselineSnapshotId, commit, expectedAbsent: true, markerNonce: nonce, markerContentDigest } };
}

async function expectReadRejection(operation, label) {
  try {
    await operation();
  } catch (error) {
    if (error?.code === "read_execution_invalid") return;
    throw error;
  }
  throw new Error(`${label} was not rejected`);
}

initializeRepository(repository, true);
writeFileSync(
  maliciousExecutable,
  `#!/bin/sh\nprintf executed > ${JSON.stringify(marker)}\n`,
  { mode: 0o700 },
);
chmodSync(maliciousExecutable, 0o700);
writeFileSync(
  maliciousGlobalConfig,
  `[core]\n\tfsmonitor = ${maliciousExecutable}\n\thooksPath = ${root}\n` +
    `[diff]\n\texternal = ${maliciousExecutable}\n`,
  { mode: 0o600 },
);

try {
  const beforeVersionRepository = `${root}/before-version`;
  initializeRepository(beforeVersionRepository, false);
  const beforeVersion = await bindCandidate(beforeVersionRepository, false);
  await expectReadRejection(
    async () => beforeVersion.capability.createReadExecutor(),
    "read before version probe",
  );
  if (!beforeVersion.capability.closed) {
    throw new Error("pre-version read did not poison its binding");
  }

  const getterRepository = `${root}/getter-request`;
  initializeRepository(getterRepository, false);
  const getterCandidate = await bindCandidate(getterRepository);
  let getterExecutions = 0;
  const getterRequest = Object.create(null);
  Object.defineProperty(getterRequest, "profile", {
    enumerable: true,
    get() {
      getterExecutions += 1;
      return "rev_parse_show_toplevel_v1";
    },
  });
  const getterCommand = Object.freeze({
    ...classifySafeGitReadCommandV1(["rev-parse", "--show-toplevel"]),
    request: getterRequest,
  });
  await expectReadRejection(
    () => getterCandidate.capability.createReadExecutor().execute(getterCommand),
    "accessor request DTO",
  );
  if (getterExecutions !== 0 || !getterCandidate.capability.closed) {
    throw new Error("request getter ran or its binding remained usable");
  }

  const proxyRepository = `${root}/proxy-request`;
  initializeRepository(proxyRepository, false);
  const proxyCandidate = await bindCandidate(proxyRepository);
  let proxyTrapExecutions = 0;
  const proxyRequest = new Proxy(
    { profile: "rev_parse_show_toplevel_v1" },
    {
      get(target, property, receiver) {
        proxyTrapExecutions += 1;
        return Reflect.get(target, property, receiver);
      },
    },
  );
  const proxyCommand = Object.freeze({
    ...classifySafeGitReadCommandV1(["rev-parse", "--show-toplevel"]),
    request: proxyRequest,
  });
  await expectReadRejection(
    () => proxyCandidate.capability.createReadExecutor().execute(proxyCommand),
    "Proxy request DTO",
  );
  if (proxyTrapExecutions !== 0 || !proxyCandidate.capability.closed) {
    throw new Error("request Proxy trap ran or its binding remained usable");
  }

  const candidate = await bindCandidate(repository);
  const executor = candidate.capability.createReadExecutor();
  const baseline = git(repository, ["rev-parse", "HEAD~1"]).trim();
  const head = git(repository, ["rev-parse", "HEAD"]).trim();
  const commands = [
    classifySafeGitReadCommandV1(["rev-parse", "--show-toplevel"]),
    classifySafeGitReadCommandV1(["rev-parse", "--absolute-git-dir"]),
    classifySafeGitReadCommandV1([
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]),
    classifySafeGitReadCommandV1([
      "status",
      "--porcelain=v2",
      "--branch",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ]),
    classifySafeGitReadCommandV1(["rev-parse", "--verify", "HEAD^{commit}"]),
    classifySafeGitReadCommandV1(
      ["symbolic-ref", "--quiet", "--short", "HEAD"],
      [0, 1],
    ),
    classifySafeGitReadCommandV1(["ls-files", "--stage", "-z"]),
    classifySafeGitReadCommandV1([
      "rev-parse",
      "--verify",
      "--end-of-options",
      "HEAD~1^{commit}",
    ]),
    classifySafeGitReadCommandV1(["merge-base", baseline, head]),
    classifySafeGitReadCommandV1([
      "rev-list",
      "--left-right",
      "--count",
      `${baseline}...${head}`,
    ]),
    classifySafeGitReadCommandV1([
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--name-status",
      "-z",
      "--no-renames",
      `${baseline}..${head}`,
      "--",
    ]),
    classifySafeGitReadCommandV1([
      "diff",
      "--cached",
      "--no-ext-diff",
      "--no-textconv",
      "--name-status",
      "-z",
      "--no-renames",
      head,
      "--",
    ]),
    classifySafeGitReadCommandV1(["cat-file", "-p", head]),
    classifySafeGitReadCommandV1([
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ".gitignore",
      ":(glob)**/.gitignore",
    ]),
    classifySafeGitReadCommandV1(
      ["config", "--path", "--get", "core.excludesfile"],
      [0, 1],
    ),
  ];

  const priorEnvironment = {
    GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL,
    GIT_CONFIG_SYSTEM: process.env.GIT_CONFIG_SYSTEM,
    GIT_CONFIG_COUNT: process.env.GIT_CONFIG_COUNT,
    GIT_CONFIG_KEY_0: process.env.GIT_CONFIG_KEY_0,
    GIT_CONFIG_VALUE_0: process.env.GIT_CONFIG_VALUE_0,
  };
  process.env.GIT_CONFIG_GLOBAL = maliciousGlobalConfig;
  process.env.GIT_CONFIG_SYSTEM = maliciousGlobalConfig;
  process.env.GIT_CONFIG_COUNT = "1";
  process.env.GIT_CONFIG_KEY_0 = "core.fsmonitor";
  process.env.GIT_CONFIG_VALUE_0 = maliciousExecutable;
  const profiles = [];
  const diagnosticOutputs = [];
  try {
    for (const command of commands) {
      const result = await executor.execute(command);
      if (
        !command.acceptedExitCodes.includes(result.exitCode) ||
        result.stderr.byteLength !== 0 ||
        result.stdout.byteLength > command.stdoutLimitBytes
      ) {
        throw new Error(
          `invalid result for ${command.request.profile}: exit=${result.exitCode} stdout=${result.stdout.byteLength} stderr=${result.stderr.byteLength} prior=${JSON.stringify(diagnosticOutputs)}`,
        );
      }
      profiles.push(command.request.profile);
      if (diagnosticOutputs.length < 3) {
        diagnosticOutputs.push(Buffer.from(result.stdout).toString("utf8"));
      }
    }
  } finally {
    for (const [name, value] of Object.entries(priorEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
  if (new Set(profiles).size !== 15 || existsSync(marker)) {
    throw new Error("all-profile run widened to a caller executable surface");
  }

  const capture = await getRepositorySnapshotDetailedWithSafeGitCapabilityV1(
    repository,
    candidate.capability,
    { baselineRef: "HEAD~1" },
  );
  if (capture.snapshot.captureStatus !== "complete") {
    throw new Error("production snapshot did not complete");
  }

  const identity = await candidate.capability.bindRepositoryIdentity();
  const treeObjectId = git(repository, ["rev-parse", "HEAD^{tree}"]).trim();
  const blobObjectId = git(repository, ["rev-parse", "HEAD:base.txt"]).trim();
  const objectTypes = {
    commit: await candidate.capability.executeGitObjectType(head),
    tree: await candidate.capability.executeGitObjectType(treeObjectId),
    blob: await candidate.capability.executeGitObjectType(blobObjectId),
  };
  if (
    objectTypes.commit !== "commit" ||
    objectTypes.tree !== "tree" ||
    objectTypes.blob !== "blob"
  ) {
    throw new Error(`fixed cat-file type profile mismatch: ${JSON.stringify(objectTypes)}`);
  }
  const maliciousTypeCandidate = await bindCandidate(repository);
  candidates.add(maliciousTypeCandidate);
  const maliciousTypeFixture = writeTaskBaselineMarker(
    repository,
    identity,
    treeObjectId,
    "0123456789ABCDEFGHJKMNPQRT",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  let maliciousTypeRejected = false;
  try {
    await maliciousTypeCandidate.capability.createTaskBaselineLease(
      maliciousTypeFixture.request,
    );
  } catch (error) {
    maliciousTypeRejected = error?.code === "lease_execution_invalid";
  }
  if (
    !maliciousTypeRejected ||
    existsSync(`${repository}/.git/${maliciousTypeFixture.intent.refName}`)
  ) {
    throw new Error("tree object was admitted as a baseline commit");
  }
  const taskId = "0123456789ABCDEFGHJKMNPQRS";
  const markerNonce = "0123456789abcdef0123456789abcdef";
  const headObjectId = head;
  const leaseFixture = writeTaskBaselineMarker(
    repository,
    identity,
    headObjectId,
    taskId,
    markerNonce,
  );
  const createdLease = await candidate.capability.createTaskBaselineLease(
    leaseFixture.request,
  );
  if (createdLease.resolution !== "created" || createdLease.objectId !== headObjectId) {
    throw new Error(`unexpected lease create result: ${JSON.stringify(createdLease)}`);
  }
  const leasePath = `${repository}/.git/${createdLease.refName}`;
  const reflogPath = `${repository}/.git/logs/${createdLease.refName}`;
  if (!existsSync(leasePath) || existsSync(reflogPath)) {
    throw new Error("lease ref/reflog postcondition failed");
  }
  const replayedLease = await candidate.capability.recoverTaskBaselineLease(
    leaseFixture.request,
  );
  if (replayedLease.resolution !== "replayed" || replayedLease.refName !== createdLease.refName) {
    throw new Error(`unexpected lease replay result: ${JSON.stringify(replayedLease)}`);
  }
  const rolledBackLease = await candidate.capability.rollbackTaskBaselineLease(
    leaseFixture.request,
  );
  if (rolledBackLease.resolution !== "rolled_back" || existsSync(leasePath) || existsSync(reflogPath)) {
    throw new Error(`unexpected lease rollback result: ${JSON.stringify(rolledBackLease)}`);
  }

  const driftTaskId = "0123456789ABCDEFGHJKMNPQRT";
  const driftNonce = "fedcba9876543210fedcba9876543210";
  const driftFixture = writeTaskBaselineMarker(
    repository,
    identity,
    headObjectId,
    driftTaskId,
    driftNonce,
  );
  const driftLease = await candidate.capability.createTaskBaselineLease(
    driftFixture.request,
  );
  const driftPath = `${repository}/.git/${driftLease.refName}`;
  const driftMarkerPath = `${repository}/.understand-code/.recovery/task-baseline-transactions/${driftTaskId}-${driftNonce}.json`;
  appendFileSync(driftMarkerPath, "\n");
  const driftCandidate = await bindCandidate(repository);
  candidates.add(driftCandidate);
  let driftRejected = false;
  try {
    await driftCandidate.capability.recoverTaskBaselineLease(driftFixture.request);
  } catch (error) {
    driftRejected = error?.code === "lease_execution_invalid";
  }
  if (!driftRejected || !existsSync(driftPath)) {
    throw new Error("marker drift was not rejected without deleting the owned ref");
  }

  const maliciousRepository = `${root}/malicious-repository-config`;
  initializeRepository(maliciousRepository, false);
  appendFileSync(
    `${maliciousRepository}/.git/config`,
    `\n[core]\n\thooksPath = ${root}\n\tfsmonitor = ${maliciousExecutable}\n`,
  );
  const maliciousCandidate =
    await bootstrapSafeGitDescriptorBoundCandidateV1(maliciousRepository);
  candidates.add(maliciousCandidate);
  let maliciousRejected = false;
  try {
    await maliciousCandidate.capability.bindRepositoryControl();
  } catch (error) {
    maliciousRejected = error?.code === "repository_control_invalid";
  }
  if (!maliciousRejected || existsSync(marker)) {
    throw new Error("malicious repository executable config was admitted");
  }
  const finalInspection = await candidate.capability.revalidate();
  if (finalInspection.gitVersion === undefined) {
    throw new Error("version-probed capability lost its version state");
  }

  process.stdout.write(
    `${JSON.stringify({
      profile: "safe_git_production_linux_all_read_profiles_v1",
      status: "verified",
      gitVersion: `${finalInspection.gitVersion.major}.${finalInspection.gitVersion.minor}.${finalInspection.gitVersion.patch}`,
      profileCount: profiles.length,
      profiles,
      sameBindingVersionGate: "verified",
      requestAccessorExecutions: getterExecutions,
      requestProxyTrapExecutions: proxyTrapExecutions,
      callerEnvironmentExecutableSurfaces: "denied",
      maliciousRepositoryConfig: "rejected_zero_execution",
      productionSnapshot: capture.snapshot.captureStatus,
      baselineLease: "create_replay_rollback_verified",
      markerDrift: driftRejected ? "rejected_without_ref_delete" : "not_rejected",
      fixedObjectTypes: objectTypes,
      maliciousTreeAsCommit: maliciousTypeRejected
        ? "rejected_without_ref"
        : "not_rejected",
    })}\n`,
  );
} finally {
  await Promise.all(
    [...candidates].map((candidate) =>
      candidate.capability.close().catch(() => undefined),
    ),
  );
  rmSync(root, { force: true, recursive: true });
}
