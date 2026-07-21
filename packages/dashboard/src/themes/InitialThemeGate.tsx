import { useEffect, useState, type ReactNode } from "react";
import { applyTheme } from "./theme-engine";
import {
  loadInitialMetaTheme,
  readInitialStoredTheme,
} from "./initialTheme";
import type { ThemeConfig } from "./types";

export interface InitialThemeGateProps {
  metaUrl: string;
  children: (config: ThemeConfig) => ReactNode;
  readStoredTheme?: () => ThemeConfig | null;
  loadMetaTheme?: (
    url: string,
    options: { signal: AbortSignal },
  ) => Promise<ThemeConfig>;
}

export function InitialThemeGate({
  metaUrl,
  children,
  readStoredTheme = readInitialStoredTheme,
  loadMetaTheme = loadInitialMetaTheme,
}: InitialThemeGateProps) {
  const [initialTheme, setInitialTheme] = useState<ThemeConfig | null>(
    () => readStoredTheme(),
  );

  useEffect(() => {
    if (initialTheme) return;
    const controller = new AbortController();
    void loadMetaTheme(metaUrl, { signal: controller.signal }).then((config) => {
      if (controller.signal.aborted) return;
      applyTheme(config);
      setInitialTheme(config);
    });
    return () => controller.abort();
  }, [initialTheme, loadMetaTheme, metaUrl]);

  if (!initialTheme) {
    return (
      <main className="uc-initial-theme-gate" role="status">
        正在准备阅读界面
      </main>
    );
  }
  return <>{children(initialTheme)}</>;
}
