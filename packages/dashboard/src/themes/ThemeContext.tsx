import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_THEME_CONFIG, type PresetId, type ThemeConfig, type ThemePreset } from "./types";
import { getPreset } from "./presets";
import { applyTheme } from "./theme-engine";
import { serializeThemeConfig, THEME_STORAGE_KEY } from "./themeStorage";

export {
  normalizeThemePreference,
  parseStoredThemeConfig,
  serializeThemeConfig,
  THEME_STORAGE_KEY,
  THEME_STORAGE_VERSION,
} from "./themeStorage";

interface ThemeContextValue {
  config: ThemeConfig;
  preset: ThemePreset;
  setPreset: (presetId: PresetId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialConfig = DEFAULT_THEME_CONFIG,
  children,
}: {
  initialConfig?: ThemeConfig;
  children?: ReactNode;
}) {
  const [config, setConfig] = useState(initialConfig);

  useLayoutEffect(() => {
    applyTheme(config);
  }, [config]);

  const setPreset = useCallback((presetId: PresetId) => {
    const nextConfig = { presetId } satisfies ThemeConfig;
    setConfig(nextConfig);
    try {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        serializeThemeConfig(nextConfig),
      );
    } catch {
      // The selected theme remains active for this session.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ config, preset: getPreset(config.presetId), setPreset }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
