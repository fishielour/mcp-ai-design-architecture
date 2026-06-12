import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SessionManager } from "../src/lib/session-manager.js";
import { PersistentStore } from "../src/lib/store.js";

function createManager() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-elite-design-"));
  const store = new PersistentStore(path.join(tempRoot, "state.json"));
  return {
    tempRoot,
    manager: new SessionManager(store),
  };
}

test("requires get_session_context before mutation", () => {
  const { manager } = createManager();

  assert.throws(
    () =>
      manager.defineDesignerVoice({
        session_id: "demo",
        agent_id: "agent-a",
        context_version: 1,
        loves: ["asymmetry"],
      }),
    /get_session_context/
  );
});

test("supports the full foundation flow and phase progression", async () => {
  const { manager } = createManager();
  const context = await manager.getSessionContext({ session_id: "demo", agent_id: "agent-a" });

  const voice = manager.defineDesignerVoice({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: context.context_version,
    non_negotiables: ["bold hierarchy"],
    loves: ["editorial tension", "asymmetry"],
    obsessions: ["expressive type", "surprising layouts"],
    avoid: ["plain minimal", "generic card grid"],
    brand_traits: ["confident", "precise"],
  });

  const references = await manager.loadDesignReferences({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: voice.context_version,
    creative_departure: "Use the rhythm, but break the composition.",
    references: [
      {
        url: "https://example.com/stripe",
        provided_analysis: {
          colors: ["#635bff", "#0a2540"],
          fonts: ["Inter"],
          rhythm: {
            dominant_spacing_px: 8,
            density: "balanced",
            rhythm_confidence: 0.8,
          },
        },
      },
    ],
  });

  const directions = manager.generateDesignDirections({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: references.context_version,
    n: 3,
  });

  const approved = manager.approveDesignDirection({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: directions.context_version,
    direction_id: directions.directions[0].id,
  });

  const system = manager.applyDesignSystem({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: approved.context_version,
  });

  const structure = manager.defineSiteStructure({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: system.context_version,
    shared_regions: ["header", "footer"],
    routes: [{ id: "home", name: "Home", path: "/", regions: ["hero", "proof", "cta"] }],
  });

  const phase = manager.setDesignPhase({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: structure.context_version,
    pass: 1,
  });

  assert.equal(phase.active_phase.pass, 1);
});

test("rejects low-wow candidates and accepts strong ones", async () => {
  const { manager } = createManager();
  const context = await manager.getSessionContext({ session_id: "demo", agent_id: "agent-a" });
  const voice = manager.defineDesignerVoice({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: context.context_version,
    loves: ["editorial tension", "surprising layouts"],
    obsessions: ["motion", "novelty"],
  });
  const refs = await manager.loadDesignReferences({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: voice.context_version,
    references: [{ url: "https://example.com", provided_analysis: { colors: ["#000000"] } }],
  });
  const directions = manager.generateDesignDirections({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: refs.context_version,
    n: 3,
  });
  const approved = manager.approveDesignDirection({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: directions.context_version,
    direction_id: directions.directions[0].id,
  });
  const system = manager.applyDesignSystem({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: approved.context_version,
  });
  const structure = manager.defineSiteStructure({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: system.context_version,
    routes: [{ id: "home", path: "/", regions: ["hero"] }],
  });
  const phase = manager.setDesignPhase({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: structure.context_version,
    pass: 1,
  });

  assert.throws(
    () =>
      manager.createUiElement({
        session_id: "demo",
        agent_id: "agent-a",
        context_version: phase.context_version,
        route_id: "home",
        kind: "hero",
        purpose: "Generic centered hero",
        axes: {
          spatial: "overlapping-panels",
          typography: "high-contrast-editorial",
          temperature: "warm-steel",
          motion: "snapped-cinematic",
        },
        layout: {
          spacingScale: [10, 20, 30],
          asymmetry: 0.2,
          zones: ["copy"],
          density: 0.5,
        },
        palette: {
          foreground: "#666666",
          background: "#ffffff",
          accent: "#aaaaaa",
        },
        typography: {
          scale: [24, 28],
        },
        motion: {
          moments: ["fade"],
        },
        distinctiveness: {
          noveltySignals: ["minimal"],
          structuralBreaks: [],
        },
        interactions: {
          interactive: true,
        },
      }),
    /Triple validation gate/
  );

  const fresh = await manager.getSessionContext({ session_id: "demo", agent_id: "agent-a" });
  const created = manager.createUiElement({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: fresh.context_version,
    route_id: "home",
    kind: "hero",
    title: "Signal over symmetry",
    purpose: "A theatrical launch surface with layered copy, proof rails, and kinetic framing.",
    axes: {
      spatial: "stacked-blocks",
      typography: "compressed-display",
      temperature: "earth-heat",
      motion: "elastic-pop",
    },
    layout: {
      spacingScale: [10, 20, 30, 50],
      asymmetry: 0.82,
      zones: ["copy", "proof", "artifact", "cta"],
      density: 0.62,
    },
    palette: {
      foreground: "#101010",
      background: "#f2e9dc",
      accent: "#ea580c",
    },
    typography: {
      scale: [20, 32, 56],
    },
    motion: {
      moments: ["stagger-rise", "counter-slide", "pulse-lock"],
    },
    distinctiveness: {
      noveltySignals: ["off-axis proof rail", "compressed heading lockup", "artifact frame", "kinetic underline"],
      structuralBreaks: ["split baseline", "floating proof rail", "offset CTA shelf"],
    },
    interactions: {
      interactive: true,
      accessibleLabel: "Launch project",
    },
  });

  assert.equal(created.gate.pass, true);
});

test("snapshots restore prior state and export writes artifacts", async () => {
  const { manager, tempRoot } = createManager();
  const context = await manager.getSessionContext({ session_id: "demo", agent_id: "agent-a" });
  const voice = manager.defineDesignerVoice({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: context.context_version,
    loves: ["asymmetry"],
  });
  const refs = await manager.loadDesignReferences({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: voice.context_version,
    references: [{ url: "https://example.com", provided_analysis: { colors: ["#000000"] } }],
  });
  const directions = manager.generateDesignDirections({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: refs.context_version,
    n: 3,
  });
  const approved = manager.approveDesignDirection({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: directions.context_version,
    direction_id: directions.directions[0].id,
  });
  const system = manager.applyDesignSystem({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: approved.context_version,
  });
  const structure = manager.defineSiteStructure({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: system.context_version,
    routes: [{ id: "home", path: "/", regions: ["hero"] }],
  });
  const snapshot = manager.snapshotState({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: structure.context_version,
    label: "foundation ready",
  });
  const phase = manager.setDesignPhase({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: snapshot.context_version,
    pass: 1,
  });
  const restored = manager.restoreSnapshot({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: phase.context_version,
    label: snapshot.snapshot.label,
  });

  assert.equal(restored.active_phase.pass, 0);

  const fresh = await manager.getSessionContext({ session_id: "demo", agent_id: "agent-a" });
  const exported = await manager.exportArtifacts({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: fresh.context_version,
    export_contract: {
      breakpoints: ["sm", "md", "lg"],
    },
    out_dir: path.join(tempRoot, "artifacts"),
  });

  assert.equal(exported.export.validation.pass, true);
  assert.ok(fs.existsSync(path.join(tempRoot, "artifacts", "src", "App.jsx")));
  assert.ok(fs.existsSync(path.join(tempRoot, "artifacts", exported.export.archive_name)));
});

test("reads user suggestions including recurring feedback pins", async () => {
  const { manager } = createManager();
  const context = await manager.getSessionContext({ session_id: "demo", agent_id: "agent-a" });
  await manager.getSessionContext({ session_id: "demo", agent_id: "canvas-user" });
  manager.defineDesignerVoice({
    session_id: "demo",
    agent_id: "agent-a",
    context_version: context.context_version,
    loves: ["editorial tension"],
  });

  const fresh = await manager.getSessionContext({ session_id: "demo", agent_id: "canvas-user" });
  manager.pinFeedback({
    session_id: "demo",
    agent_id: "canvas-user",
    context_version: fresh.context_version,
    issue: "Push the hierarchy harder",
    location: { normalized_x: 0.4, normalized_y: 0.3 },
  });

  const fresher = await manager.getSessionContext({ session_id: "demo", agent_id: "canvas-user" });
  manager.pinFeedback({
    session_id: "demo",
    agent_id: "canvas-user",
    context_version: fresher.context_version,
    issue: "Push the hierarchy harder",
    location: { normalized_x: 0.6, normalized_y: 0.5 },
  });

  const suggestions = manager.readUserSuggestions({
    session_id: "demo",
    agent_id: "canvas-user",
  });

  assert.equal(suggestions.open_feedback_pins.length, 2);
  assert.equal(suggestions.recurring_issues.length, 1);
});
