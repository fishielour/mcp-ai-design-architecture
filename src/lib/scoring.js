import { clamp, average, unique } from "./utils.js";

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

function hexToRgb(color) {
  const normalized = normalizeHex(color);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function relativeLuminance(color) {
  const { r, g, b } = hexToRgb(color);
  const channels = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground, background) {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function ratioScore(value, target) {
  return clamp(value / target, 0, 1);
}

export function critiqueDesign(candidate, designSystem) {
  const palette = candidate.palette ?? {};
  const foreground = palette.foreground ?? designSystem?.tokens?.colors?.foreground ?? "#111111";
  const background = palette.background ?? designSystem?.tokens?.colors?.background ?? "#ffffff";
  const accent = palette.accent ?? designSystem?.tokens?.colors?.accent ?? "#0f766e";
  const primaryContrast = contrastRatio(foreground, background);
  const accentContrast = contrastRatio(accent, background);
  const spacingBase = designSystem?.tokens?.spacing?.base ?? 8;
  const spacingValues = safeArray(candidate.layout?.spacingScale);
  const rhythmAligned = spacingValues.every((value) => value % spacingBase === 0);

  const issues = [];
  if (primaryContrast < 4.5) {
    issues.push({
      code: "contrast-primary",
      message: `Foreground/background contrast is ${primaryContrast}, below WCAG AA for body text.`,
      severity: "error",
    });
  }

  if (accentContrast < 3) {
    issues.push({
      code: "contrast-accent",
      message: `Accent/background contrast is ${accentContrast}, below the minimum decorative guidance threshold.`,
      severity: "warning",
    });
  }

  if (!rhythmAligned && spacingValues.length) {
    issues.push({
      code: "rhythm-grid",
      message: "Spacing scale is not aligned to the active design system base rhythm.",
      severity: "warning",
    });
  }

  if ((candidate.interactions?.interactive ?? false) && !candidate.interactions?.accessibleLabel) {
    issues.push({
      code: "a11y-label",
      message: "Interactive elements require an accessible label.",
      severity: "error",
    });
  }

  const score = average([
    ratioScore(primaryContrast, 7),
    ratioScore(accentContrast, 4.5),
    rhythmAligned ? 1 : 0.45,
    candidate.interactions?.interactive ? (candidate.interactions?.accessibleLabel ? 1 : 0) : 1,
  ]);

  return {
    score: Number(score.toFixed(3)),
    pass: !issues.some((issue) => issue.severity === "error"),
    ratios: {
      foreground_background: primaryContrast,
      accent_background: accentContrast,
    },
    issues,
  };
}

export function evaluateQuality(candidate, session) {
  const typographyScale = safeArray(candidate.typography?.scale);
  const hierarchySpread =
    typographyScale.length > 1
      ? Math.max(...typographyScale) - Math.min(...typographyScale)
      : 0;
  const spatialLayers = safeArray(candidate.layout?.zones).length;
  const motionLayers = safeArray(candidate.motion?.moments).length;
  const paletteCount = unique(
    Object.values(candidate.palette ?? {}).filter((value) => typeof value === "string")
  ).length;
  const asymmetry = Number(candidate.layout?.asymmetry ?? 0);
  const density = Number(candidate.layout?.density ?? 0.5);
  const voiceMatch = estimateVoiceMatch(candidate, session.designerVoice);

  const hierarchyScore = clamp(hierarchySpread / 36, 0, 1);
  const compositionScore = average([
    clamp(spatialLayers / 4, 0, 1),
    clamp(motionLayers / 3, 0, 1),
    clamp(paletteCount / 4, 0, 1),
    clamp(asymmetry, 0, 1),
    1 - Math.abs(density - 0.58),
  ]);

  const score = average([hierarchyScore, compositionScore, voiceMatch]);

  const observations = [];
  if (hierarchyScore < 0.55) {
    observations.push("Typography scale lacks enough spread to create strong hierarchy.");
  }
  if (compositionScore < 0.6) {
    observations.push("Composition feels too flat or under-layered for a principal-level outcome.");
  }
  if (voiceMatch < 0.6) {
    observations.push("Candidate drifts from the defined designer voice profile.");
  }

  return {
    score: Number(score.toFixed(3)),
    pass: score >= 0.68,
    observations,
    factors: {
      hierarchy: Number(hierarchyScore.toFixed(3)),
      composition: Number(compositionScore.toFixed(3)),
      voice_match: Number(voiceMatch.toFixed(3)),
    },
  };
}

function estimateVoiceMatch(candidate, designerVoice) {
  if (!designerVoice) {
    return 0.5;
  }

  const needle = JSON.stringify(candidate).toLowerCase();
  const desired = [
    ...(designerVoice.loves ?? []),
    ...(designerVoice.obsessions ?? []),
    ...(designerVoice.brand_traits ?? []),
  ];
  const avoid = designerVoice.avoid ?? [];
  const desiredHits = desired.filter((item) => needle.includes(String(item).toLowerCase())).length;
  const avoidHits = avoid.filter((item) => needle.includes(String(item).toLowerCase())).length;
  const desiredScore = desired.length ? desiredHits / desired.length : 0.7;
  return clamp(desiredScore - avoidHits * 0.2, 0, 1);
}

const SAFE_PATTERN_TERMS = [
  "hero-left-copy-right-image",
  "generic-card-grid",
  "centered-saas-hero",
  "plain-minimal",
  "default-dashboard",
];

export function auditWowFactor(candidate, session) {
  const axes = candidate.axes ?? {};
  const direction =
    session.approvedDirection ??
    session.directions?.find((entry) => entry.id === session.approvedDirectionId);
  const noveltyTerms = safeArray(candidate.distinctiveness?.noveltySignals);
  const structuralBreaks = safeArray(candidate.distinctiveness?.structuralBreaks);
  const safeTermsUsed = SAFE_PATTERN_TERMS.filter((term) =>
    JSON.stringify(candidate).toLowerCase().includes(term)
  );
  const divergence = direction ? countAxisDifferences(direction.axes, axes) / 4 : 0.5;
  const motionConfidence = safeArray(candidate.motion?.moments).length >= 2 ? 1 : 0.45;
  const tensionScore = average([
    clamp(Number(candidate.layout?.asymmetry ?? 0), 0, 1),
    clamp(structuralBreaks.length / 3, 0, 1),
    clamp(noveltyTerms.length / 4, 0, 1),
  ]);

  const score = average([
    divergence,
    motionConfidence,
    tensionScore,
    safeTermsUsed.length ? 0.1 : 0.95,
  ]);

  const reasons = [];
  if (safeTermsUsed.length) {
    reasons.push("The concept leans on safe, familiar patterns instead of a surprising compositional move.");
  }
  if (divergence < 0.5) {
    reasons.push("The element does not diverge enough from the chosen design direction across key axes.");
  }
  if (noveltyTerms.length < 2) {
    reasons.push("Distinctiveness signals are too weak; the concept needs a clearer creative departure.");
  }

  return {
    score: Number(score.toFixed(3)),
    pass: score >= 0.7,
    reasons,
    metrics: {
      divergence: Number(divergence.toFixed(3)),
      tension: Number(tensionScore.toFixed(3)),
      motion_confidence: Number(motionConfidence.toFixed(3)),
    },
  };
}

export function countAxisDifferences(left = {}, right = {}) {
  const keys = ["spatial", "typography", "temperature", "motion"];
  return keys.filter((key) => left[key] && right[key] && left[key] !== right[key]).length;
}
