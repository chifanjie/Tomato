import {
  chmod,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const lifecycleMocks = vi.hoisted(() => ({
  install: vi.fn(),
  doctor: vi.fn(),
  upgrade: vi.fn(),
  rollback: vi.fn(),
  uninstall: vi.fn(),
}));

vi.mock(
  "@understand-code/durable-object-provider-runtime",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@understand-code/durable-object-provider-runtime")
      >();
    return {
      ...actual,
      installProviderServiceInstallationV1: lifecycleMocks.install,
      doctorProviderServiceInstallationV1: lifecycleMocks.doctor,
      upgradeProviderServiceInstallationV1: lifecycleMocks.upgrade,
      rollbackProviderServiceInstallationV1: lifecycleMocks.rollback,
      uninstallProviderServiceInstallationV1: lifecycleMocks.uninstall,
    };
  },
);

import {
  PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1,
  createProviderServiceHandoffConfigV1,
  defaultProviderServiceDescriptorPathV1,
  generateProviderServiceSigningKeyPairV1,
  type ProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffPayloadV1,
} from "@understand-code/durable-object-provider-runtime";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  doctorProviderServiceV1,
  installProviderServiceV1,
  ProviderServiceInstallerErrorV1,
  rollbackProviderServiceV1,
  uninstallProviderServiceV1,
  upgradeProviderServiceV1,
} from "../src/provider/provider-service-installer.js";

const INSTALLATION_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"a".repeat(64)}`,
);
const BINARY_DIGEST = ContentDigestV1Schema.parse(`sha256:${"b".repeat(64)}`);
const CAPABILITY_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"c".repeat(64)}`,
);

function principalV1(): {
  kind: "dedicated_os_principal";
  name: string;
  uid: number;
  gid: number;
} {
  const uid = typeof process.getuid === "function" ? process.getuid() : 501;
  const gid = typeof process.getgid === "function" ? process.getgid() : uid;
  return {
    kind: "dedicated_os_principal",
    name: "ucprovider",
    uid: uid > 0 ? uid : 501,
    gid: gid > 0 ? gid : 501,
  };
}

interface FixtureV1 {
  readonly parent: string;
  readonly runtimeRoot: string;
  readonly installationRoot: string;
  readonly manifestPath: string;
  readonly sourceConfigPath: string;
  readonly configDestinationPath: string;
  readonly keyPath: string;
  readonly descriptorPath: string;
  readonly config: ProviderServiceHandoffConfigV1;
}

async function fixtureV1(): Promise<FixtureV1> {
  const parent = await realpath(
    await mkdtemp(join(tmpdir(), "uc-cli-provider-service-")),
  );
  const runtimeRoot = join(parent, "runtime");
  const installationRoot = join(parent, "authority");
  const manifestPath = join(
    installationRoot,
    PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1,
  );
  const sourceConfigPath = join(parent, "staged-provider.json");
  const configDestinationPath = join(parent, "owned", "provider.json");
  const keyPath = join(parent, "staged-provider.key");
  const keyPair = generateProviderServiceSigningKeyPairV1();
  const platform = process.platform === "linux" ? "linux" : "darwin";
  const serviceLabel = "com.openai.understand-code.provider";
  const descriptorPath = defaultProviderServiceDescriptorPathV1(
    platform,
    serviceLabel,
  );
  const payload: ProviderServiceHandoffPayloadV1 = {
    schemaVersion: 1,
    profile: "understand_code_provider_service_handoff_payload_v1",
    platform,
    serviceLabel,
    providerId: DurableObjectIdentityProviderIdV1Schema.parse(
      "durable-object-provider:local-helper",
    ),
    principal: principalV1(),
    runtimeRoot,
    socketPath: join(runtimeRoot, "provider.sock"),
    executablePath: process.execPath,
    configPath: configDestinationPath,
    authKeyPath: join(runtimeRoot, "auth.key"),
    readinessPath: join(runtimeRoot, "readiness.json"),
    signingKeyPath: join(runtimeRoot, "readiness.key"),
    installationIdentityDigest: INSTALLATION_DIGEST,
    binaryDigest: BINARY_DIGEST,
    capabilityDigest: CAPABILITY_DIGEST,
  };
  const config = createProviderServiceHandoffConfigV1({
    payload,
    privateKey: keyPair.privateKey,
  });
  const privateKeyDer = Buffer.from(
    keyPair.privateKey.export({ format: "der", type: "pkcs8" }),
  );
  await writeFile(sourceConfigPath, `${JSON.stringify(config)}\n`, {
    mode: 0o600,
  });
  await writeFile(keyPath, privateKeyDer, { mode: 0o600 });
  await chmod(sourceConfigPath, 0o600);
  await chmod(keyPath, 0o600);
  return {
    parent,
    runtimeRoot,
    installationRoot,
    manifestPath,
    sourceConfigPath,
    configDestinationPath,
    keyPath,
    descriptorPath,
    config,
  };
}

async function withFixtureV1<T>(
  action: (fixture: FixtureV1) => Promise<T>,
): Promise<T> {
  const fixture = await fixtureV1();
  try {
    return await action(fixture);
  } finally {
    await rm(fixture.parent, { recursive: true, force: true });
  }
}

function runtimeBaseV1(fixture: FixtureV1) {
  return {
    authority: "read_only" as const,
    strongWrites: "locked" as const,
    installationRoot: fixture.installationRoot,
    manifestPath: fixture.manifestPath,
    runtimeRoot: fixture.runtimeRoot,
  };
}

async function withUidV1<T>(uid: number, action: () => Promise<T>): Promise<T> {
  const original = process.getuid;
  if (typeof original !== "function") return action();
  Object.defineProperty(process, "getuid", {
    configurable: true,
    value: () => uid,
  });
  try {
    return await action();
  } finally {
    Object.defineProperty(process, "getuid", {
      configurable: true,
      value: original,
    });
  }
}

beforeEach(() => {
  for (const mock of Object.values(lifecycleMocks)) mock.mockReset();
});

describe("Provider Service lifecycle CLI wrappers", () => {
  it("installs from a distinct staging config and exposes only explicit target paths", async () => {
    await withFixtureV1(async (fixture) => {
      lifecycleMocks.install.mockResolvedValue({
        ...runtimeBaseV1(fixture),
        status: "installed",
        configPath: fixture.configDestinationPath,
        descriptorPath: fixture.descriptorPath,
        reason: `sensitive:${fixture.keyPath}`,
      });

      const result = await installProviderServiceV1({
        root: fixture.runtimeRoot,
        serviceManifest: fixture.manifestPath,
        serviceConfig: fixture.sourceConfigPath,
        serviceKey: fixture.keyPath,
        serviceDescriptor: fixture.descriptorPath,
      });

      expect(fixture.sourceConfigPath).not.toBe(fixture.configDestinationPath);
      expect(result).toEqual({
        ok: true,
        status: "installed",
        providerService: true,
        authority: "read_only",
        strongWrites: "locked",
        root: fixture.runtimeRoot,
        installationRoot: fixture.installationRoot,
        manifestPath: fixture.manifestPath,
      });
      expect(lifecycleMocks.install).toHaveBeenCalledOnce();
      expect(lifecycleMocks.install).toHaveBeenCalledWith({
        installationRoot: fixture.installationRoot,
        expectedRuntimeRoot: fixture.runtimeRoot,
        config: fixture.config,
        privateKey: expect.objectContaining({ asymmetricKeyType: "ed25519" }),
        descriptorPath: fixture.descriptorPath,
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(fixture.sourceConfigPath);
      expect(serialized).not.toContain(fixture.configDestinationPath);
      expect(serialized).not.toContain(fixture.keyPath);
      expect(serialized).not.toContain(fixture.descriptorPath);
      expect(serialized).not.toContain("reason");
    });
  });

  it("redacts doctor artifact paths, digests, and runtime reasons", async () => {
    await withFixtureV1(async (fixture) => {
      const secretPath = join(fixture.parent, "owned", "auth.key");
      lifecycleMocks.doctor.mockResolvedValue({
        ...runtimeBaseV1(fixture),
        ok: false,
        status: "tampered",
        artifacts: [
          {
            kind: "runtime_auth_key",
            path: secretPath,
            state: "modified",
            expectedDigest: INSTALLATION_DIGEST,
            actualDigest: BINARY_DIGEST,
          },
        ],
        reason: `tampered:${secretPath}`,
        handoffPayloadDigest: CAPABILITY_DIGEST,
        manifestGeneration: 2,
        rollbackAvailable: true,
      });

      const result = await doctorProviderServiceV1({
        root: fixture.runtimeRoot,
        serviceManifest: fixture.manifestPath,
      });

      expect(result).toEqual({
        providerService: true,
        authority: "read_only",
        strongWrites: "locked",
        root: fixture.runtimeRoot,
        installationRoot: fixture.installationRoot,
        manifestPath: fixture.manifestPath,
        ok: false,
        status: "tampered",
        artifacts: [{ kind: "runtime_auth_key", state: "modified" }],
        manifestGeneration: 2,
        rollbackAvailable: true,
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(secretPath);
      expect(serialized).not.toContain(INSTALLATION_DIGEST);
      expect(serialized).not.toContain(CAPABILITY_DIGEST);
      expect(serialized).not.toContain("reason");
    });
  });

  it("upgrades from a staging config without accepting key or descriptor inputs", async () => {
    await withFixtureV1(async (fixture) => {
      lifecycleMocks.upgrade.mockResolvedValue({
        ...runtimeBaseV1(fixture),
        status: "updated",
        fromPayloadDigest: INSTALLATION_DIGEST,
        payloadDigest: BINARY_DIGEST,
        rollbackAvailable: true,
        reason: `sensitive:${fixture.configDestinationPath}`,
      });

      const result = await upgradeProviderServiceV1({
        root: fixture.runtimeRoot,
        serviceManifest: fixture.manifestPath,
        serviceConfig: fixture.sourceConfigPath,
      });

      expect(result).toEqual({
        providerService: true,
        authority: "read_only",
        strongWrites: "locked",
        root: fixture.runtimeRoot,
        installationRoot: fixture.installationRoot,
        manifestPath: fixture.manifestPath,
        ok: true,
        status: "updated",
        rollbackAvailable: true,
      });
      expect(lifecycleMocks.upgrade).toHaveBeenCalledWith({
        installationRoot: fixture.installationRoot,
        expectedRuntimeRoot: fixture.runtimeRoot,
        config: fixture.config,
      });
      expect(JSON.stringify(result)).not.toContain(INSTALLATION_DIGEST);
      expect(JSON.stringify(result)).not.toContain("reason");
    });
  });

  it("projects rollback paths to counts", async () => {
    await withFixtureV1(async (fixture) => {
      const removedPath = join(fixture.parent, "owned", "old.json");
      const refusedPath = join(fixture.parent, "owned", "blocked.json");
      lifecycleMocks.rollback.mockResolvedValue({
        ...runtimeBaseV1(fixture),
        status: "partial",
        removedPaths: [removedPath],
        refusedPaths: [refusedPath],
        payloadDigest: INSTALLATION_DIGEST,
        reason: `sensitive:${refusedPath}`,
      });

      const result = await rollbackProviderServiceV1({
        root: fixture.runtimeRoot,
        serviceManifest: fixture.manifestPath,
      });

      expect(result).toMatchObject({
        ok: false,
        status: "partial",
        removedArtifactCount: 1,
        refusedArtifactCount: 1,
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(removedPath);
      expect(serialized).not.toContain(refusedPath);
      expect(serialized).not.toContain(INSTALLATION_DIGEST);
      expect(serialized).not.toContain("reason");
    });
  });

  it("treats retained-state uninstall as success without exposing removed paths", async () => {
    await withFixtureV1(async (fixture) => {
      const removedPath = join(fixture.parent, "owned", "provider.json");
      lifecycleMocks.uninstall.mockResolvedValue({
        ...runtimeBaseV1(fixture),
        status: "removed_with_retained_state",
        removedPaths: [removedPath],
        refusedPaths: [],
        retainedState: ["runtime_root", "provider_durable_state"],
        reason: `sensitive:${removedPath}`,
      });

      const result = await uninstallProviderServiceV1({
        root: fixture.runtimeRoot,
        serviceManifest: fixture.manifestPath,
      });

      expect(result).toMatchObject({
        ok: true,
        status: "removed_with_retained_state",
        removedArtifactCount: 1,
        refusedArtifactCount: 0,
        retainedState: ["runtime_root", "provider_durable_state"],
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(removedPath);
      expect(serialized).not.toContain("reason");
    });
  });

  it("rejects a non-fixed manifest basename before calling runtime", async () => {
    await withFixtureV1(async (fixture) => {
      await expect(
        doctorProviderServiceV1({
          root: fixture.runtimeRoot,
          serviceManifest: join(fixture.installationRoot, "manifest.json"),
        }),
      ).rejects.toMatchObject({
        name: "ProviderServiceInstallerErrorV1",
        code: "invalid_manifest",
      } satisfies Partial<ProviderServiceInstallerErrorV1>);
      expect(lifecycleMocks.doctor).not.toHaveBeenCalled();
    });
  });

  it("rejects a relative runtime root without reading the signed config", async () => {
    await withFixtureV1(async (fixture) => {
      await expect(
        installProviderServiceV1({
          root: "relative-runtime",
          serviceManifest: fixture.manifestPath,
          serviceConfig: fixture.sourceConfigPath,
          serviceKey: fixture.keyPath,
        }),
      ).rejects.toMatchObject({
        name: "ProviderServiceInstallerErrorV1",
        code: "invalid_root",
      } satisfies Partial<ProviderServiceInstallerErrorV1>);
      expect(lifecycleMocks.install).not.toHaveBeenCalled();
    });
  });

  it("rejects runtime and manifest roots that traverse symlinks", async () => {
    await withFixtureV1(async (fixture) => {
      const linkParent = join(fixture.parent, "linked-parent");
      await symlink(fixture.parent, linkParent);
      await expect(
        doctorProviderServiceV1({
          root: join(linkParent, "runtime"),
          serviceManifest: fixture.manifestPath,
        }),
      ).rejects.toMatchObject({ code: "invalid_root" });
      await expect(
        doctorProviderServiceV1({
          root: fixture.runtimeRoot,
          serviceManifest: join(
            linkParent,
            "authority",
            PROVIDER_SERVICE_INSTALLATION_MANIFEST_FILE_V1,
          ),
        }),
      ).rejects.toMatchObject({ code: "invalid_manifest" });
      expect(lifecycleMocks.doctor).not.toHaveBeenCalled();
    });
  });

  it("rejects a symlinked staging signed config", async () => {
    await withFixtureV1(async (fixture) => {
      const linkedConfig = join(fixture.parent, "linked-provider.json");
      await symlink(fixture.sourceConfigPath, linkedConfig);
      await expect(
        upgradeProviderServiceV1({
          root: fixture.runtimeRoot,
          serviceManifest: fixture.manifestPath,
          serviceConfig: linkedConfig,
        }),
      ).rejects.toMatchObject({ code: "invalid_config" });
      expect(lifecycleMocks.upgrade).not.toHaveBeenCalled();
    });
  });

  it("rejects a staging signed config larger than one MiB", async () => {
    await withFixtureV1(async (fixture) => {
      await writeFile(
        fixture.sourceConfigPath,
        Buffer.alloc(1024 * 1024 + 1, 0x20),
      );
      await expect(
        upgradeProviderServiceV1({
          root: fixture.runtimeRoot,
          serviceManifest: fixture.manifestPath,
          serviceConfig: fixture.sourceConfigPath,
        }),
      ).rejects.toMatchObject({ code: "invalid_config" });
      expect(lifecycleMocks.upgrade).not.toHaveBeenCalled();
    });
  });

  it("rejects a staging private key not owned by the current authority", async () => {
    await withFixtureV1(async (fixture) => {
      const actualUid =
        typeof process.getuid === "function" ? process.getuid() : 501;
      await expect(
        withUidV1(actualUid + 1, () =>
          installProviderServiceV1({
            root: fixture.runtimeRoot,
            serviceManifest: fixture.manifestPath,
            serviceConfig: fixture.sourceConfigPath,
            serviceKey: fixture.keyPath,
          }),
        ),
      ).rejects.toMatchObject({ code: "invalid_private_key" });
      expect(lifecycleMocks.install).not.toHaveBeenCalled();
    });
  });

  it("rejects a symlinked staging private key", async () => {
    await withFixtureV1(async (fixture) => {
      const linkedKey = join(fixture.parent, "linked-provider.key");
      await symlink(fixture.keyPath, linkedKey);
      await expect(
        installProviderServiceV1({
          root: fixture.runtimeRoot,
          serviceManifest: fixture.manifestPath,
          serviceConfig: fixture.sourceConfigPath,
          serviceKey: linkedKey,
        }),
      ).rejects.toMatchObject({ code: "invalid_private_key" });
      expect(lifecycleMocks.install).not.toHaveBeenCalled();
    });
  });

  it("rejects a non-default production descriptor path", async () => {
    await withFixtureV1(async (fixture) => {
      await expect(
        installProviderServiceV1({
          root: fixture.runtimeRoot,
          serviceManifest: fixture.manifestPath,
          serviceConfig: fixture.sourceConfigPath,
          serviceKey: fixture.keyPath,
          serviceDescriptor: join(fixture.parent, "custom.service"),
        }),
      ).rejects.toMatchObject({ code: "invalid_config" });
      expect(lifecycleMocks.install).not.toHaveBeenCalled();
    });
  });

  it("rejects a private key that does not match the signed config", async () => {
    await withFixtureV1(async (fixture) => {
      const otherKey = generateProviderServiceSigningKeyPairV1().privateKey;
      const otherKeyDer = Buffer.from(
        otherKey.export({ format: "der", type: "pkcs8" }),
      );
      await writeFile(fixture.keyPath, otherKeyDer, { mode: 0o600 });
      await chmod(fixture.keyPath, 0o600);
      await expect(
        installProviderServiceV1({
          root: fixture.runtimeRoot,
          serviceManifest: fixture.manifestPath,
          serviceConfig: fixture.sourceConfigPath,
          serviceKey: fixture.keyPath,
        }),
      ).rejects.toMatchObject({ code: "invalid_private_key" });
      expect(lifecycleMocks.install).not.toHaveBeenCalled();
    });
  });
});
