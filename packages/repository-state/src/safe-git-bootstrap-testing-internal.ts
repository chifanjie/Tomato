export interface SafeGitBootstrapTestHooksInternalV1 {
  readonly afterRootObserved?: () => void | Promise<void>;
  readonly afterDotGitObserved?: () => void | Promise<void>;
  readonly afterBindingsOpened?: () => void | Promise<void>;
}

const EMPTY_HOOKS_V1 = Object.freeze({});
const HOOKS_BY_ROOT_V1 = new Map<
  string,
  SafeGitBootstrapTestHooksInternalV1
>();

export function getSafeGitBootstrapTestHooksInternalV1(
  root: string,
): SafeGitBootstrapTestHooksInternalV1 {
  if (process.env.NODE_ENV !== "test") return EMPTY_HOOKS_V1;
  return HOOKS_BY_ROOT_V1.get(root) ?? EMPTY_HOOKS_V1;
}

export async function withSafeGitBootstrapTestHooksInternalV1<T>(
  root: string,
  hooks: SafeGitBootstrapTestHooksInternalV1,
  operation: () => T | Promise<T>,
): Promise<T> {
  if (process.env.NODE_ENV !== "test" || HOOKS_BY_ROOT_V1.has(root)) {
    throw new TypeError("SafeGit bootstrap test hooks are unavailable");
  }
  const frozenHooks = Object.freeze({ ...hooks });
  HOOKS_BY_ROOT_V1.set(root, frozenHooks);
  try {
    return await operation();
  } finally {
    HOOKS_BY_ROOT_V1.delete(root);
  }
}
