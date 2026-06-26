import type { AppSettings, ThemeTokens } from "@slashslack/shared";

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

/** Server-side stored settings = public AppSettings + private SMTP config. */
export type StoredSettings = AppSettings & { smtp?: SmtpConfig };

/**
 * Theme is fully token-driven: every color in the UI is a CSS variable.
 * Admin can override any token live. We ship a few presets.
 */
// Simplified Slack palette: aubergine sidebar, soft tinted (non-white) backgrounds.
export const LIGHT_TOKENS: ThemeTokens = {
  "--bg": "#f4f2f6",
  "--bg-elev": "#ffffff",
  "--sidebar": "#3f0e40",
  "--sidebar-fg": "#d6c9d7",
  "--sidebar-active": "#5c255e",
  "--fg": "#1d1c1d",
  "--fg-muted": "#696769",
  "--border": "#e4dee6",
  "--accent": "#1264a3",
  "--accent-fg": "#ffffff",
  "--danger": "#e01e5a",
  "--success": "#2bac76",
  "--mention": "#f8e6a0",
  "--radius": "8px",
};

export const DARK_TOKENS: ThemeTokens = {
  "--bg": "#0f0f14",
  "--bg-elev": "#17171f",
  "--sidebar": "#0a0a0f",
  "--sidebar-fg": "#b8b3c7",
  "--sidebar-active": "#241b38",
  "--fg": "#ececf1",
  "--fg-muted": "#8b8b99",
  "--border": "#26262f",
  "--accent": "#8b5cf6",
  "--accent-fg": "#ffffff",
  "--danger": "#f87171",
  "--success": "#4ade80",
  "--mention": "#7c5e1a",
  "--radius": "10px",
};

export const OCEAN_TOKENS: ThemeTokens = {
  ...LIGHT_TOKENS,
  "--sidebar": "#0b2a3a",
  "--sidebar-active": "#114156",
  "--accent": "#0891b2",
};

export const PRESETS: Record<string, ThemeTokens> = {
  slack: LIGHT_TOKENS,
  light: LIGHT_TOKENS,
  dark: DARK_TOKENS,
  ocean: OCEAN_TOKENS,
};

export const DEFAULT_SETTINGS: AppSettings = {
  appName: "SlashSlack",
  logoUrl: null,
  theme: LIGHT_TOKENS,
  defaultTheme: "light",
  allowRegistration: true,
  maxUploadMb: 100,
  presets: PRESETS,
};
