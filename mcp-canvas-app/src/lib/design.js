function withPx(value, fallback) {
  return typeof value === "number" ? `${value}px` : fallback;
}

export function buildDesignVars(designSystem) {
  const tokens = designSystem?.tokens ?? {};
  const colors = tokens.colors ?? {};
  const spacing = tokens.spacing ?? {};
  const radius = tokens.radius ?? {};
  const typography = designSystem?.typographyPairings?.[0] ?? {};
  const motion = designSystem?.motionPresets?.[0] ?? {};

  return {
    "--color-background": colors.background ?? "#f8f1e7",
    "--color-foreground": colors.foreground ?? "#171717",
    "--color-accent": colors.accent ?? "#b45309",
    "--color-secondary": colors.secondary ?? "#475569",
    "--color-surface": `color-mix(in srgb, ${colors.background ?? "#f8f1e7"} 88%, white 12%)`,
    "--spacing-base": withPx(spacing.base, "8px"),
    "--radius-card": withPx(radius.card, "28px"),
    "--radius-pill": withPx(radius.pill, "999px"),
    "--font-display": `"${typography.display ?? "Georgia"}", serif`,
    "--font-body": `"${typography.body ?? "system-ui"}", sans-serif`,
    "--motion-duration": `${(motion.durationMs ?? 360) / 1000}s`,
    "--shadow-soft": `0 30px 80px color-mix(in srgb, ${colors.foreground ?? "#171717"} 14%, transparent)`,
  };
}

export function parseMotionPreset(designSystem) {
  const preset = designSystem?.motionPresets?.[0] ?? {};
  const match =
    typeof preset.easing === "string" ? preset.easing.match(/cubic-bezier\(([^)]+)\)/) : null;
  return {
    duration: (preset.durationMs ?? 360) / 1000,
    ease: match ? match[1].split(",").map((value) => Number(value.trim())) : [0.16, 1, 0.3, 1],
    delay: (preset.staggerMs ?? 90) / 1000,
  };
}

export function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("session") ?? import.meta.env.VITE_SESSION_ID ?? "default-design-session";
}

export function getSocketUrl() {
  return import.meta.env.VITE_MCP_WS_URL ?? "ws://127.0.0.1:3210/ws";
}

export function getHttpBaseUrl() {
  const wsUrl = new URL(getSocketUrl());
  const protocol = wsUrl.protocol === "wss:" ? "https:" : "http:";
  return `${protocol}//${wsUrl.host}`;
}
