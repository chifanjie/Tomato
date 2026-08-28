import {
  openProviderAcceptanceAuthorityStoreWithLayoutCoreInternalV1,
  type ProviderAcceptanceAuthorityAdmissionInputInternalV1,
  type ProviderAcceptanceAuthorityAdmissionResultInternalV1,
  type ProviderAcceptanceAuthorityCurrentReadResultInternalV1,
  type ProviderAcceptanceAuthorityDoctorResultInternalV1,
  type ProviderAcceptanceAuthorityStoreInternalV1,
} from "./acceptance-store-core-internal.js";
import { resolveProviderAcceptanceAuthorityProductionLayoutInternalV1 } from "./platform-layout.js";
import {
  assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1,
  assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1,
  bindNativeSafeGitEmptyHooksDirectoryV1,
  bindNativeSafeGitExecutableV1,
  closeNativeSafeGitDescriptorBootstrapV1,
  createNativeSafeGitTaskBaselineLeaseV1,
  recoverNativeSafeGitTaskBaselineLeaseV1,
  rollbackNativeSafeGitTaskBaselineLeaseV1,
  deriveNativeSafeGitPathIdentityV1,
  executeNativeSafeGitReadProfileV1,
  executeNativeSafeGitVersionV1,
  type NativeSafeGitDescriptorBindingV1,
  type NativeSafeGitEmptyHooksDirectoryBindingV1,
  type NativeSafeGitExecutableBindingInspectionV1,
  type NativeSafeGitPathIdentityV1,
  type NativeSafeGitReadExecutionResultV1,
  type NativeSafeGitReadRequestV1,
  type NativeSafeGitTaskBaselineLeaseCreateRequestV1,
  type NativeSafeGitTaskBaselineLeaseV1,
  type NativeSafeGitVersionV1,
} from "@understand-code/native-kernel-bridge";
import { openOrInitializeProviderAcceptanceInstallationIdentityInternalV1 } from "./key-custody-internal.js";
import { ProviderAcceptanceAuthorityErrorV1 } from "./errors.js";

export type {
  ProviderAcceptanceAuthorityAdmissionInputInternalV1,
  ProviderAcceptanceAuthorityAdmissionResultInternalV1,
  ProviderAcceptanceAuthorityCurrentReadResultInternalV1,
  ProviderAcceptanceAuthorityDoctorResultInternalV1,
  ProviderAcceptanceAuthorityStoreInternalV1,
};

/** Production opener: its root is fixed by trusted OS account information. */
export async function openProviderAcceptanceAuthorityStoreCandidateInternalV1(): Promise<ProviderAcceptanceAuthorityStoreInternalV1> {
  const layout = resolveProviderAcceptanceAuthorityProductionLayoutInternalV1();
  await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(layout);
  return openProviderAcceptanceAuthorityStoreWithLayoutCoreInternalV1(layout);
}

/**
 * Installation-owner identity derivation facade. Raw key bytes remain inside
 * key custody and are zeroed immediately after the native derivation returns.
 */
export async function deriveProviderAcceptanceSafeGitPathIdentityInternalV1(
  binding: NativeSafeGitDescriptorBindingV1,
): Promise<NativeSafeGitPathIdentityV1> {
  assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1(binding);
  const identity =
    await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
      resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(),
      {
        authorizeNativeAuthority(opened) {
          assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
            opened.authority,
            binding,
          );
        },
      },
    );
  return identity.withKey(async (key) =>
    deriveNativeSafeGitPathIdentityV1(binding, key)
  );
}

/**
 * Installation-owner empty-hooks custody facade. The native authority and key
 * remain callback-scoped, and the native binding must exactly reproduce the
 * authenticated identity-state pin.
 */
export async function bindProviderAcceptanceSafeGitEmptyHooksDirectoryInternalV1(
  binding: NativeSafeGitDescriptorBindingV1,
): Promise<NativeSafeGitEmptyHooksDirectoryBindingV1> {
  try {
    assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1(binding);
    const identity =
      await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
        resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(),
        {
          authorizeNativeAuthority(opened) {
            assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
              opened.authority,
              binding,
            );
          },
        },
      );
    return await identity.withKey(async (key, authority, expected) => {
      if (expected === undefined) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      const actual = bindNativeSafeGitEmptyHooksDirectoryV1(
        binding,
        authority,
        key,
      );
      if (
        actual.profile !== "native_safe_git_empty_hooks_binding_v1" ||
        actual.directoryIdentity.platform !==
          expected.directoryIdentity.platform ||
        actual.directoryIdentity.device !== expected.directoryIdentity.device ||
        actual.directoryIdentity.inode !== expected.directoryIdentity.inode ||
        actual.emptyHooksDirectoryToken !== expected.emptyHooksDirectoryToken
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      return actual;
    });
  } catch {
    try {
      closeNativeSafeGitDescriptorBootstrapV1(binding);
    } catch {
      // The redacted custody failure remains authoritative.
    }
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
}

/**
 * Installation-owner executable custody facade. The absolute executable path
 * enters only the native descriptor authority; key bytes and the authenticated
 * installation authority remain callback-scoped and the result is redacted.
 */
export async function bindProviderAcceptanceSafeGitExecutableInternalV1(
  binding: NativeSafeGitDescriptorBindingV1,
  absoluteExecutablePath: string,
): Promise<NativeSafeGitExecutableBindingInspectionV1> {
  try {
    assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1(binding);
    const identity =
      await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
        resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(),
        {
          authorizeNativeAuthority(opened) {
            assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
              opened.authority,
              binding,
            );
          },
        },
      );
    return await identity.withKey(async (key, authority, expected) => {
      if (expected === undefined) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      const actual = bindNativeSafeGitExecutableV1(
        binding,
        authority,
        key,
        absoluteExecutablePath,
      );
      const keys = Object.keys(actual).sort();
      if (
        keys.length !== 2 ||
        keys[0] !== "executableBinding" ||
        keys[1] !== "profile" ||
        actual.profile !== "native_safe_git_executable_binding_v1" ||
        actual.executableBinding !== "verified" ||
        !Object.isFrozen(actual)
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      return actual;
    });
  } catch {
    try {
      closeNativeSafeGitDescriptorBootstrapV1(binding);
    } catch {
      // The fixed, path-redacted custody failure remains authoritative.
    }
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
}

/**
 * Runs the only bootstrap probe while the installation identity key and
 * authority remain callback-scoped. Native code recomputes the executable
 * binding token before and after the contained execution.
 */
export async function executeProviderAcceptanceSafeGitVersionInternalV1(
  binding: NativeSafeGitDescriptorBindingV1,
): Promise<NativeSafeGitVersionV1> {
  try {
    assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1(binding);
    const identity =
      await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
        resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(),
        {
          authorizeNativeAuthority(opened) {
            assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
              opened.authority,
              binding,
            );
          },
        },
      );
    return await identity.withKey(async (key, authority, expected) => {
      if (expected === undefined) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      return executeNativeSafeGitVersionV1(binding, authority, key);
    });
  } catch {
    try {
      closeNativeSafeGitDescriptorBootstrapV1(binding);
    } catch {
      // The fixed, path-redacted custody failure remains authoritative.
    }
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
}

/**
 * Executes one frozen repository-read profile under the same installation
 * authority and opaque descriptor binding that completed the version probe.
 * No raw argv, environment, cwd, authority object, or key bytes escape this
 * callback-scoped custody boundary.
 */
export async function executeProviderAcceptanceSafeGitReadInternalV1(
  binding: NativeSafeGitDescriptorBindingV1,
  request: NativeSafeGitReadRequestV1,
  stdoutLimitBytes: number,
): Promise<NativeSafeGitReadExecutionResultV1> {
  try {
    assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1(binding);
    const identity =
      await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
        resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(),
        {
          authorizeNativeAuthority(opened) {
            assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
              opened.authority,
              binding,
            );
          },
        },
      );
    return await identity.withKey(async (key, authority, expected) => {
      if (expected === undefined) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      return executeNativeSafeGitReadProfileV1(
        binding,
        authority,
        key,
        request,
        stdoutLimitBytes,
      );
    });
  } catch {
    try {
      closeNativeSafeGitDescriptorBootstrapV1(binding);
    } catch {
      // The fixed, path-redacted custody failure remains authoritative.
    }
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
}

/**
 * Creates one fixed Task-baseline ref while installation key/authority custody
 * and the already version-probed descriptor binding remain in this callback.
 */
export async function createProviderAcceptanceSafeGitTaskBaselineLeaseInternalV1(
  binding: NativeSafeGitDescriptorBindingV1,
  request: NativeSafeGitTaskBaselineLeaseCreateRequestV1,
): Promise<NativeSafeGitTaskBaselineLeaseV1> {
  try {
    assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1(binding);
    const identity =
      await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
        resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(),
        {
          authorizeNativeAuthority(opened) {
            assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
              opened.authority,
              binding,
            );
          },
        },
      );
    return await identity.withKey(async (key, authority, expected) => {
      if (expected === undefined) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      return createNativeSafeGitTaskBaselineLeaseV1(
        binding,
        authority,
        key,
        request,
      );
    });
  } catch {
    try {
      closeNativeSafeGitDescriptorBootstrapV1(binding);
    } catch {
      // The fixed, path-redacted custody failure remains authoritative.
    }
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
}

/**
 * Crash recovery facade. The marker is the sole durable transaction proof;
 * native revalidates its descriptor-relative chain and exact ref/OID before
 * returning a replay or attempting the create-only CAS.
 */
export async function recoverProviderAcceptanceSafeGitTaskBaselineLeaseInternalV1(
  binding: NativeSafeGitDescriptorBindingV1,
  request: NativeSafeGitTaskBaselineLeaseCreateRequestV1,
): Promise<NativeSafeGitTaskBaselineLeaseV1> {
  try {
    assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1(binding);
    const identity =
      await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
        resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(),
        {
          authorizeNativeAuthority(opened) {
            assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
              opened.authority,
              binding,
            );
          },
        },
      );
    return await identity.withKey(async (key, authority, expected) => {
      if (expected === undefined) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      return recoverNativeSafeGitTaskBaselineLeaseV1(
        binding,
        authority,
        key,
        request,
      );
    });
  } catch {
    try {
      closeNativeSafeGitDescriptorBootstrapV1(binding);
    } catch {
      // Keep the path-redacted custody failure authoritative.
    }
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
}

/**
 * Recovery cleanup facade. Native performs an expected-OID, no-deref delete
 * and refuses pre-existing/foreign refs or any marker drift.
 */
export async function rollbackProviderAcceptanceSafeGitTaskBaselineLeaseInternalV1(
  binding: NativeSafeGitDescriptorBindingV1,
  request: NativeSafeGitTaskBaselineLeaseCreateRequestV1,
): Promise<NativeSafeGitTaskBaselineLeaseV1> {
  try {
    assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1(binding);
    const identity =
      await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
        resolveProviderAcceptanceAuthorityProductionLayoutInternalV1(),
        {
          authorizeNativeAuthority(opened) {
            assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
              opened.authority,
              binding,
            );
          },
        },
      );
    return await identity.withKey(async (key, authority, expected) => {
      if (expected === undefined) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      return rollbackNativeSafeGitTaskBaselineLeaseV1(
        binding,
        authority,
        key,
        request,
      );
    });
  } catch {
    try {
      closeNativeSafeGitDescriptorBootstrapV1(binding);
    } catch {
      // Keep the path-redacted custody failure authoritative.
    }
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
}
