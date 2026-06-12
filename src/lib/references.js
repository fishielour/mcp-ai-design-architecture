import { McpError } from "./errors.js";
import { clamp, unique } from "./utils.js";

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[::1\]$/i,
];

export function assertSafeReferenceUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new McpError(-32020, `Invalid reference URL: ${rawUrl}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new McpError(-32020, "Only http and https reference URLs are allowed.");
  }

  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))) {
    throw new McpError(-32020, `Private or local reference URLs are not allowed: ${rawUrl}`);
  }

  return parsed;
}

function normalizeHex(color) {
  const raw = color.replace("#", "").trim();
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }

  return `#${raw.toLowerCase()}`;
}

function extractHexColors(content) {
  const matches = content.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g) || [];
  return unique(matches.map((color) => normalizeHex(color))).slice(0, 8);
}

function extractFonts(content) {
  const matches = content.match(/font-family\s*:\s*([^;]+)/gi) || [];
  const fonts = matches
    .flatMap((entry) => entry.split(":")[1].split(","))
    .map((entry) => entry.replace(/["']/g, "").trim())
    .filter(Boolean);

  return unique(fonts).slice(0, 6);
}

function inferRhythm(content) {
  const spacingMatches = content.match(/\b(?:margin|padding|gap)\s*:\s*([0-9.]+)(px|rem|em)/gi) || [];
  const values = spacingMatches.map((entry) => {
    const match = entry.match(/([0-9.]+)(px|rem|em)/i);
    if (!match) {
      return 0;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    return unit === "px" ? amount : amount * 16;
  });

  if (!values.length) {
    return {
      dominant_spacing_px: 8,
      density: "balanced",
      rhythm_confidence: 0.15,
    };
  }

  const averageSpacing = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    dominant_spacing_px: Math.round(averageSpacing),
    density: averageSpacing < 12 ? "dense" : averageSpacing > 22 ? "airy" : "balanced",
    rhythm_confidence: clamp(values.length / 20, 0.15, 0.95),
  };
}

export async function analyzeReference(reference) {
  if (reference.provided_analysis) {
    return {
      url: reference.url,
      label: reference.label ?? reference.url,
      traits: reference.provided_analysis,
      source: "provided_analysis",
    };
  }

  const parsed = assertSafeReferenceUrl(reference.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(parsed, {
      headers: {
        "user-agent": "mcp-elite-design-architect-hub/0.1.0",
      },
      signal: controller.signal,
    });

    const content = await response.text();
    return {
      url: reference.url,
      label: reference.label ?? reference.url,
      traits: {
        colors: extractHexColors(content),
        fonts: extractFonts(content),
        rhythm: inferRhythm(content),
      },
      source: "fetched",
    };
  } catch (error) {
    throw new McpError(
      -32021,
      `Unable to analyze reference ${reference.url}. Provide "provided_analysis" to continue offline.`,
      { cause: error instanceof Error ? error.message : String(error) }
    );
  } finally {
    clearTimeout(timeout);
  }
}
