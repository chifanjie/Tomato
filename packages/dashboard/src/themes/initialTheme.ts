import type { ThemeConfig } from "./types";
import {
  THEME_STORAGE_KEY,
  normalizeThemePreference,
  parseStoredThemeConfig,
} from "./themeStorage";

export interface ThemeStorageReader {
  getItem(key: string): string | null;
}

export type ThemeFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const INITIAL_THEME_TIMEOUT_MS = 1_500;

export function readInitialStoredTheme(storage?: ThemeStorageReader): ThemeConfig | null {
  try {
    const reader = storage ?? window.localStorage;
    return parseStoredThemeConfig(reader.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export async function loadInitialMetaTheme(
  url: string,
  options: {
    fetcher?: ThemeFetch;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<ThemeConfig> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener("abort", forwardAbort, { once: true });
  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => {
      reject(new DOMException("Theme request aborted", "AbortError"));
    }, { once: true });
  });
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? INITIAL_THEME_TIMEOUT_MS,
  );
  try {
    const response = await Promise.race([
      (options.fetcher ?? fetch)(url, { signal: controller.signal }),
      aborted,
    ]);
    if (!response.ok) return normalizeThemePreference(null);
    const payload = await response.json() as { theme?: unknown };
    return normalizeThemePreference(payload.theme);
  } catch {
    return normalizeThemePreference(null);
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener("abort", forwardAbort);
  }
}
