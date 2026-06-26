import type { AppSettings, ThemeTokens } from "@slashslack/shared";

const STORAGE_KEY = "slashslack:theme";

export function applyThemeTokens(tokens: ThemeTokens) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokens)) {
    root.style.setProperty(k, v);
  }
}

export function getStoredThemeChoice(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
export function storeThemeChoice(name: string) {
  localStorage.setItem(STORAGE_KEY, name);
}

/**
 * Resolve which token set to apply. "custom" = the admin-configured live theme;
 * any other name selects one of the shipped presets.
 */
export function resolveTokens(settings: AppSettings, choice: string | null): ThemeTokens {
  const name = choice || "custom";
  if (name === "custom") return settings.theme;
  return settings.presets[name] || settings.theme;
}

export function applyFromSettings(settings: AppSettings) {
  applyThemeTokens(resolveTokens(settings, getStoredThemeChoice()));
}
