import { McpError } from "./errors.js";
import { countAxisDifferences } from "./scoring.js";
import { createId, unique } from "./utils.js";

const DIRECTION_LIBRARY = [
  {
    name: "Kinetic Editorial Tension",
    axes: {
      spatial: "overlapping-panels",
      typography: "high-contrast-editorial",
      temperature: "warm-steel",
      motion: "snapped-cinematic",
    },
    description:
      "An asymmetrical editorial system with hard tension lines, warm-metal accents, and fast snap transitions.",
    tokens: {
      colors: {
        background: "#f8f1e7",
        foreground: "#171717",
        accent: "#b45309",
        secondary: "#1f2937",
      },
      spacing: { base: 8, scale: [8, 16, 24, 40, 64] },
      radius: { card: 24, pill: 999 },
    },
    typographyPairing: {
      display: "Instrument Serif",
      body: "Inter Tight",
    },
    motionPreset: {
      name: "snap-drift",
      durationMs: 280,
      easing: "cubic-bezier(0.2, 1, 0.2, 1)",
      staggerMs: 60,
    },
  },
  {
    name: "Precision Neon Grid",
    axes: {
      spatial: "modular-grid",
      typography: "engineered-grotesk",
      temperature: "cool-electric",
      motion: "glide-parallax",
    },
    description:
      "A cool, high-precision layout that uses luminous accents, modular rails, and measured parallax reveals.",
    tokens: {
      colors: {
        background: "#081120",
        foreground: "#e5f0ff",
        accent: "#22d3ee",
        secondary: "#7dd3fc",
      },
      spacing: { base: 6, scale: [6, 12, 18, 30, 48] },
      radius: { card: 18, pill: 999 },
    },
    typographyPairing: {
      display: "Space Grotesk",
      body: "IBM Plex Sans",
    },
    motionPreset: {
      name: "vector-glide",
      durationMs: 360,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      staggerMs: 90,
    },
  },
  {
    name: "Soft Brutalist Pulse",
    axes: {
      spatial: "stacked-blocks",
      typography: "compressed-display",
      temperature: "earth-heat",
      motion: "elastic-pop",
    },
    description:
      "Chunky blocks, compressed display type, and a tactile pulse that feels handcrafted instead of sterile.",
    tokens: {
      colors: {
        background: "#f2e9dc",
        foreground: "#101010",
        accent: "#ea580c",
        secondary: "#14532d",
      },
      spacing: { base: 10, scale: [10, 20, 30, 50, 80] },
      radius: { card: 14, pill: 999 },
    },
    typographyPairing: {
      display: "Archivo Narrow",
      body: "Manrope",
    },
    motionPreset: {
      name: "rubber-stamp",
      durationMs: 420,
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      staggerMs: 110,
    },
  },
  {
    name: "Quiet Monumental",
    axes: {
      spatial: "monolithic-columns",
      typography: "luxury-serif-sans",
      temperature: "stone-cool",
      motion: "slow-fade-lift",
    },
    description:
      "Monumental columns, restrained cool neutrals, and slow ceremonial motion for high-end clarity.",
    tokens: {
      colors: {
        background: "#eef1f4",
        foreground: "#0f172a",
        accent: "#334155",
        secondary: "#94a3b8",
      },
      spacing: { base: 12, scale: [12, 24, 36, 60, 96] },
      radius: { card: 28, pill: 999 },
    },
    typographyPairing: {
      display: "Cormorant Garamond",
      body: "Satoshi",
    },
    motionPreset: {
      name: "ceremony",
      durationMs: 540,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      staggerMs: 120,
    },
  },
];

function referencesSummary(references) {
  const colors = unique(
    references.flatMap((entry) => entry.traits?.colors ?? [])
  ).slice(0, 4);
  const fonts = unique(
    references.flatMap((entry) => entry.traits?.fonts ?? [])
  ).slice(0, 4);
  return { colors, fonts };
}

export function generateDirections({ count, references, designerVoice, creativeDeparture }) {
  if (!designerVoice) {
    throw new McpError(-32011, "define_designer_voice must be completed before generating directions.");
  }

  const requested = Math.max(1, Math.min(6, Number(count) || 3));
  const referenceTraits = referencesSummary(references);
  const selected = [];

  for (const seed of DIRECTION_LIBRARY) {
    const differsEnough = selected.every(
      (existing) => countAxisDifferences(existing.axes, seed.axes) >= 3
    );
    if (!differsEnough) {
      continue;
    }

    selected.push({
      id: createId("direction"),
      name: seed.name,
      axes: seed.axes,
      description: seed.description,
      creative_departure:
        creativeDeparture ??
        "Borrows underlying rhythm and craft cues from references while intentionally breaking their dominant compositions.",
      provenance: {
        reference_colors: referenceTraits.colors,
        reference_fonts: referenceTraits.fonts,
        aligned_with_voice: [
          ...(designerVoice.loves ?? []).slice(0, 2),
          ...(designerVoice.obsessions ?? []).slice(0, 2),
        ],
      },
      tokens: seed.tokens,
      typography_pairing: seed.typographyPairing,
      motion_preset: seed.motionPreset,
    });

    if (selected.length >= requested) {
      break;
    }
  }

  if (selected.length < requested) {
    throw new McpError(
      -32011,
      `Only ${selected.length} radically distinct directions could be generated from the current library.`,
      { requested, available: selected.length }
    );
  }

  return selected;
}
