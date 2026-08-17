import {
  chmod,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createProviderServiceHandoffConfigV1,
  generateProviderServiceSigningKeyPairV1,
  type ProviderServiceHandoffPayloadV1,
} from "@understand-code/durable-object-provider-runtime";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  installProviderServiceV1,
  ProviderServiceInstallerErrorV1,
} from "../src/provider/provider-service-installer.js";

const INSTALLATION_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"a".repeat(64)}`,
);
const BINARY_DIGEST = ContentDigestV1Schema.parse(`sha256:${"b".repeat(64)}`);
const CAPABILITY_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"c".repeat(64)}`,
);

function principalV1(): { kind: "dedicated_os_principal"; name: string; uid: number; gid: number } {
  const uid = typeof process.getuid === "function" ? process.getuid() : 501;
  const gid = typeof process.getgid === "function" ? process.getgid() : uid;
  return {
    kind: "dedicated_os_principal",
    name: "ucprovider",
    uid: uid > 0 ? uid : 501,
    gid: gid > 0 ? gid : 501,
  };
}

async function fixtureV1(): Promise<{
  readonly parent: string;
  readonly runtimeRoot: string;
  readonly configPath: string;
  readonly keyPath: string;
  readonly descriptorPath: string;
}> {
  const parent = await realpath(
    await mkdtemp(join(tmpdir(), "uc-cli-provider-service-")),
  );
  const runtimeRoot = join(parent, "runtime");
  const configPath = join(parent, "provider.json");
  const keyPath = join(parent, "provider.key");
  const descriptorPath = join(parent, "provider.service");
  const keyPair = generateProviderServiceSigningKeyPairV1();
  const payload: ProviderServiceHandoffPayloadV1 = {
    schemaVersion: 1,
    profile: "understand_code_provider_service_handoff_payload_v1",
    platform: process.platform === "linux" ? "linux" : "darwin",
    serviceLabel: "com.openai.understand-code.provider",
    providerId: DurableObjectIdentityProviderIdV1Schema.parse(
      "durable-object-provider:local-helper",
    ),
    principal: principalV1(),
    runtimeRoot,
    socketPath: join(runtimeRoot, "provider.sock"),
    executablePath: process.execPath,
    configPath,
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
  await writeFile(configPath, `${JSON.stringify(config)}\n`, { mode: 0o600 });
  await writeFile(keyPath, privateKeyDer, { mode: 0o600 });
  await chmod(configPath, 0o600);
  await chmod(keyPath, 0o600);
  return {
    parent,
    runtimeRoot,
    configPath,
    keyPath,
    descriptorPath,
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

describe("Provider Service installer", () => {
  it("provisions a signed handoff through the CLI-facing entrypoint", async () => {
    const fixture = await fixtureV1();
    const actualUid = typeof process.getuid === "function" ? process.getuid() : 501;
    const result = await withUidV1(0, () =>
      installProviderServiceV1({
        root: fixture.runtimeRoot,
        serviceConfig: fixture.configPath,
        serviceKey: fixture.keyPath,
        serviceDescriptor: fixture.descriptorPath,
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      status: "provisioned",
      providerService: true,
      authority: "read_only",
      strongWrites: "locked",
      root: fixture.runtimeRoot,
      configPath: fixture.configPath,
      descriptorPath: fixture.descriptorPath,
    });
    const [runtimeMetadata, authMetadata, signingMetadata, authKey] =
      await Promise.all([
        stat(fixture.runtimeRoot),
        stat(join(fixture.runtimeRoot, "auth.key")),
        stat(join(fixture.runtimeRoot, "readiness.key")),
        readFile(join(fixture.runtimeRoot, "auth.key")),
      ]);
    expect(runtimeMetadata.mode & 0o777).toBe(0o700);
    expect(authMetadata.mode & 0o777).toBe(0o600);
    expect(signingMetadata.mode & 0o777).toBe(0o600);
    expect(authKey).toHaveLength(32);
    if (actualUid > 0) {
      expect(runtimeMetadata.uid).toBe(actualUid);
    }
    await rm(fixture.parent, { recursive: true, force: true });
  });

  it("fails closed before side effects when the caller is not root", async () => {
    const fixture = await fixtureV1();
    const actualUid = typeof process.getuid === "function" ? process.getuid() : 501;
    const nonRootUid = actualUid === 0 ? 501 : actualUid;
    await expect(
      withUidV1(nonRootUid, () =>
        installProviderServiceV1({
          root: fixture.runtimeRoot,
          serviceConfig: fixture.configPath,
          serviceKey: fixture.keyPath,
          serviceDescriptor: fixture.descriptorPath,
        }),
      ),
    ).rejects.toMatchObject({
      code: "non_root_provisioning_forbidden",
    });
    await expect(stat(fixture.runtimeRoot)).rejects.toMatchObject({ code: "ENOENT" });
    await rm(fixture.parent, { recursive: true, force: true });
  });

  it("rejects a relative root without reading the signed config", async () => {
    const fixture = await fixtureV1();
    await expect(
      installProviderServiceV1({
        root: "relative-runtime",
        serviceConfig: fixture.configPath,
        serviceKey: fixture.keyPath,
      }),
    ).rejects.toMatchObject({
      name: "ProviderServiceInstallerErrorV1",
      code: "invalid_root",
    } satisfies Partial<ProviderServiceInstallerErrorV1>);
    await rm(fixture.parent, { recursive: true, force: true });
  });

  it("rejects a root nested below a symlinked parent", async () => {
    const fixture = await fixtureV1();
    const linkParent = join(fixture.parent, "linked-parent");
    await symlink(fixture.parent, linkParent);
    await expect(
      installProviderServiceV1({
        root: join(linkParent, "runtime"),
        serviceConfig: fixture.configPath,
        serviceKey: fixture.keyPath,
      }),
    ).rejects.toMatchObject({
      name: "ProviderServiceInstallerErrorV1",
      code: "invalid_root",
    } satisfies Partial<ProviderServiceInstallerErrorV1>);
    await rm(fixture.parent, { recursive: true, force: true });
  });
});
