import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDirections } from "./directions.js";
import { McpError } from "./errors.js";
import { exportArtifacts } from "./exporter.js";
import { assertSequentialPass, phaseSummary } from "./phases.js";
import { analyzeReference } from "./references.js";
import { critiqueDesign, evaluateQuality, auditWowFactor } from "./scoring.js";
import { PersistentStore } from "./store.js";
import { createId, deepClone, ensureArray, nowIso, slugify } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANVAS_PUBLIC_DIR = path.resolve(__dirname, "../../mcp-canvas-app/public");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function buildDesignJson(session) {
  const ds = session.designSystem;
  if (!ds) return null;
  return {
    theme: session.approvedDirectionId ? "approved" : "draft",
    palette: ds.tokens?.colors ?? {},
    fonts: ds.typographyPairings?.[0] ?? {},
    spacing: ds.tokens?.spacing ?? {},
    radius: ds.tokens?.radius ?? {},
    motion: ds.motionPresets?.[0] ?? {},
    locked: ds.locked ?? false,
    version: session.version,
    session_id: session.id,
    updated_at: session.updatedAt,
  };
}

function buildProductHtml(session) {
  const ds = session.designSystem;
  if (!ds) return null;

  const colors = ds.tokens?.colors ?? {};
  const spacing = ds.tokens?.spacing ?? {};
  const radius = ds.tokens?.radius ?? {};
  const typo = ds.typographyPairings?.[0] ?? {};
  const motion = ds.motionPresets?.[0] ?? {};
  const routes = session.siteStructure?.routes ?? [];
  const displayFont = typo.display ?? "Georgia";
  const bodyFont = typo.body ?? "system-ui";
  const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(displayFont).replace(/%20/g, "+")}:wght@400;700&family=${encodeURIComponent(bodyFont).replace(/%20/g, "+")}:wght@300;400;500;600&display=swap`;
  const durationSec = ((motion.durationMs ?? 360) / 1000).toFixed(2);
  const easing = motion.easing ?? "cubic-bezier(0.16, 1, 0.3, 1)";

  function renderElement(el) {
    if (el.html_code) {
      return `<div class="el-card" style="animation: fadeSlideIn ${durationSec}s ${easing} both;">${el.html_code}</div>`;
    }
    const accent = el.palette?.accent ?? "var(--color-accent)";
    const bg = el.palette?.background ?? "var(--color-surface)";
    const fg = el.palette?.foreground ?? "var(--color-foreground)";
    const novelty = (el.distinctiveness?.noveltySignals ?? []).slice(0, 3);
    const noveltyHtml = novelty.length
      ? novelty.map(s => `<li>${s}</li>`).join("")
      : `<li>Awaiting creative divergence notes</li>`;
    const actionHtml = el.interactions?.interactive
      ? `<button class="el-action" style="background:${accent};color:${bg};">${el.interactions.label ?? "Action"}</button>`
      : "";
    return `
      <article class="el-card" style="border-color:${accent};background:${bg};color:${fg};animation: fadeSlideIn ${durationSec}s ${easing} both;">
        <div class="el-accent-line" style="background:linear-gradient(90deg,transparent,${accent},transparent);"></div>
        <div class="el-meta"><span>${el.kind ?? "section"}</span><span>${(el.layout?.zones ?? []).join(" / ") || "live block"}</span></div>
        <div class="el-body">
          <div class="el-text">
            <h2 class="el-title">${el.title ?? el.id ?? "Untitled"}</h2>
            <p class="el-purpose">${el.purpose ?? "Generated design element"}</p>
          </div>
          <div class="el-novelty">
            <span class="el-novelty-label">Distinctiveness</span>
            <ul>${noveltyHtml}</ul>
          </div>
        </div>
        ${actionHtml}
      </article>`;
  }

  const routeTabs = routes.map((r, i) =>
    `<button class="route-tab${i === 0 ? " active" : ""}" data-route="${r.id}">${r.name ?? r.path ?? r.id}</button>`
  ).join("");

  const routeSections = routes.map((r, i) => {
    const elements = (r.elements ?? []).map((el, j) => {
      const delay = (j * (motion.staggerMs ?? 90) / 1000).toFixed(2);
      return `<div style="animation-delay:${delay}s;">${renderElement(el)}</div>`;
    }).join("");
    return `
      <section class="route-section${i === 0 ? " active" : ""}" data-route="${r.id}">
        <div class="route-header">
          <span class="route-path">${r.path ?? "/"}</span>
          <h1 class="route-name">${r.name ?? "Unnamed Route"}</h1>
        </div>
        <div class="route-elements">${elements || '<div class="empty-state"><p class="empty-title">No elements yet</p><p class="empty-sub">Elements will appear as the MCP creates them.</p></div>'}</div>
      </section>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${session.id} — Live Product Preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${googleFontsUrl}" rel="stylesheet">
<style>
  :root {
    --color-background: ${colors.background ?? "#f8f1e7"};
    --color-foreground: ${colors.foreground ?? "#171717"};
    --color-accent: ${colors.accent ?? "#b45309"};
    --color-secondary: ${colors.secondary ?? "#475569"};
    --color-surface: color-mix(in srgb, var(--color-background) 88%, white 12%);
    --spacing-base: ${spacing.base ?? 8}px;
    --radius-card: ${radius.card ?? 24}px;
    --radius-pill: ${radius.pill ?? 999}px;
    --font-display: "${displayFont}", serif;
    --font-body: "${bodyFont}", sans-serif;
    --shadow-soft: 0 30px 80px color-mix(in srgb, var(--color-foreground) 14%, transparent);
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { min-height: 100%; }
  body {
    background: radial-gradient(circle at top left, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 34%),
      linear-gradient(160deg, color-mix(in srgb, var(--color-background) 90%, white 10%), var(--color-background));
    color: var(--color-foreground);
    font-family: var(--font-body);
    padding: 2rem;
  }
  .display-face { font-family: var(--font-display); }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .route-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 2rem; }
  .route-tab {
    border: 1px solid color-mix(in srgb, var(--color-secondary) 28%, transparent);
    background: transparent;
    color: var(--color-foreground);
    padding: 8px 18px;
    border-radius: var(--radius-pill);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    cursor: pointer;
    font-family: var(--font-body);
    transition: all ${durationSec}s ${easing};
  }
  .route-tab:hover { border-color: var(--color-accent); }
  .route-tab.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-background);
  }
  .route-section { display: none; }
  .route-section.active { display: block; animation: fadeSlideIn ${durationSec}s ${easing}; }
  .route-header { margin-bottom: 2rem; }
  .route-path { font-size: 12px; text-transform: uppercase; letter-spacing: 0.32em; color: var(--color-secondary); }
  .route-name { font-family: var(--font-display); font-size: clamp(2.5rem, 6vw, 4.5rem); line-height: 1; margin-top: 12px; }
  .route-elements { display: grid; gap: 1.5rem; }
  .el-card {
    position: relative;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
    border-radius: var(--radius-card);
    padding: 1.5rem;
    background: var(--color-surface);
    box-shadow: var(--shadow-soft);
    display: grid;
    gap: 18px;
  }
  .el-accent-line {
    position: absolute;
    top: 14px;
    left: 1.5rem;
    right: 1.5rem;
    height: 1px;
    opacity: 0.7;
  }
  .el-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.28em;
    color: var(--color-secondary);
  }
  .el-body { display: grid; gap: 1rem; grid-template-columns: 1fr; }
  @media (min-width: 640px) { .el-body { grid-template-columns: 1.5fr 0.8fr; align-items: end; } }
  .el-text { display: grid; gap: 1rem; }
  .el-title { font-family: var(--font-display); font-size: clamp(1.5rem, 4vw, 3rem); line-height: 1.05; }
  .el-purpose { font-size: 14px; line-height: 1.7; opacity: 0.82; max-width: 50ch; }
  .el-novelty {
    border: 1px solid color-mix(in srgb, var(--color-accent) 32%, transparent);
    border-radius: 22px;
    padding: 1rem;
    font-size: 14px;
  }
  .el-novelty-label {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.28em;
    color: var(--color-secondary);
    margin-bottom: 0.75rem;
  }
  .el-novelty ul { padding-left: 1.2rem; display: grid; gap: 6px; }
  .el-action {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    justify-content: center;
    padding: 12px 24px;
    border: none;
    border-radius: var(--radius-pill);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    cursor: pointer;
    font-family: var(--font-body);
    transition: transform ${durationSec}s ${easing};
  }
  .el-action:hover { transform: scale(1.02); }
  .el-action:active { transform: scale(0.98); }
  .empty-state {
    border: 1px dashed color-mix(in srgb, var(--color-secondary) 24%, transparent);
    border-radius: 32px;
    padding: 3rem;
    text-align: center;
  }
  .empty-title { font-family: var(--font-display); font-size: 1.5rem; }
  .empty-sub { font-size: 14px; color: var(--color-secondary); margin-top: 12px; }
</style>
</head>
<body>
  ${routes.length > 1 ? `<nav class="route-tabs">${routeTabs}</nav>` : ""}
  ${routeSections || '<div class="empty-state"><p class="empty-title">Waiting for routes</p><p class="empty-sub">The MCP has not defined any site structure yet.</p></div>'}
  <script>
    document.querySelectorAll(".route-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".route-tab").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".route-section").forEach(s => s.classList.remove("active"));
        btn.classList.add("active");
        const target = document.querySelector('.route-section[data-route="' + btn.dataset.route + '"]');
        if (target) target.classList.add("active");
      });
    });
  </script>
</body>
</html>`;
}

function writeLiveFiles(session) {
  try {
    ensureDir(CANVAS_PUBLIC_DIR);

    const designJson = buildDesignJson(session);
    if (designJson) {
      fs.writeFileSync(
        path.join(CANVAS_PUBLIC_DIR, "design.json"),
        JSON.stringify(designJson, null, 2),
        "utf8"
      );
    }

    const productHtml = buildProductHtml(session);
    if (productHtml) {
      fs.writeFileSync(
        path.join(CANVAS_PUBLIC_DIR, "product.html"),
        productHtml,
        "utf8"
      );
    }
  } catch (err) {
    // Non-fatal: log but don't crash the MCP session
    process.stderr.write(`[mcp-live-files] Error writing live files: ${err.message}\n`);
  }
}

function createSession(sessionId) {
  const timestamp = nowIso();
  return {
    id: sessionId,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    activePass: 0,
    foundationComplete: false,
    designerVoice: null,
    designReferences: [],
    creativeDeparture: null,
    directions: [],
    approvedDirectionId: null,
    designSystem: null,
    siteStructure: {
      routes: [],
      sharedRegions: [],
    },
    uiTree: {},
    feedbackPins: [],
    feedbackMemory: {},
    snapshots: [],
    validationHistory: [],
    agentRegistry: {},
    dependencyAlerts: [],
  };
}

function touch(session) {
  session.updatedAt = nowIso();
  session.version += 1;
  return session;
}

function summarizePins(session) {
  return session.feedbackPins.filter((pin) => pin.status === "open");
}

function approvedDirection(session) {
  return session.directions.find((direction) => direction.id === session.approvedDirectionId) ?? null;
}

function summarizeSnapshot(snapshot) {
  return {
    id: snapshot.id,
    label: snapshot.label,
    created_at: snapshot.created_at,
  };
}

function buildSessionContext(session) {
  return {
    session_id: session.id,
    context_version: session.version,
    active_phase: phaseSummary(session),
    locked_design_system_tokens: session.designSystem?.tokens ?? null,
    approved_design_direction: approvedDirection(session),
    designer_voice_profile: session.designerVoice,
    motion_presets: session.designSystem?.motionPresets ?? [],
    snapshot_history: session.snapshots.map((snapshot) => summarizeSnapshot(snapshot)),
    open_feedback_pins: summarizePins(session),
    dependency_alerts: session.dependencyAlerts,
  };
}

function buildSessionState(session) {
  return {
    session_id: session.id,
    context_version: session.version,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    active_phase: phaseSummary(session),
    foundation_complete: session.foundationComplete,
    creative_departure: session.creativeDeparture,
    approved_design_direction: approvedDirection(session),
    designer_voice_profile: deepClone(session.designerVoice),
    design_references: deepClone(session.designReferences),
    design_system: deepClone(session.designSystem),
    site_structure: {
      shared_regions: deepClone(session.siteStructure.sharedRegions),
      routes: deepClone(session.siteStructure.routes),
    },
    motion_presets: deepClone(session.designSystem?.motionPresets ?? []),
    feedback_pins: deepClone(session.feedbackPins),
    open_feedback_pins: deepClone(summarizePins(session)),
    snapshot_history: session.snapshots.map((snapshot) => summarizeSnapshot(snapshot)),
    dependency_alerts: deepClone(session.dependencyAlerts),
    validation_history: deepClone(session.validationHistory),
    agent_registry: deepClone(session.agentRegistry),
  };
}

function assertAgentHasContext(session, agentId) {
  if (!agentId) {
    throw new McpError(-32001, "agent_id is required.");
  }

  if (!session.agentRegistry[agentId]) {
    throw new McpError(
      -32001,
      "get_session_context must be the first call made by an agent before any design action.",
      { required_tool: "get_session_context", agent_id: agentId }
    );
  }
}

function assertContextVersion(session, providedVersion) {
  if (providedVersion !== session.version) {
    throw new McpError(
      -32002,
      "Context version is stale. Call get_session_context again before mutating session state.",
      { expected: session.version, received: providedVersion }
    );
  }
}

function validateMutationEnvelope(session, args) {
  assertAgentHasContext(session, args.agent_id);
  assertContextVersion(session, args.context_version);
}

function noteAgentMutation(session, agentId) {
  const entry = session.agentRegistry[agentId];
  if (entry) {
    entry.last_mutation_at = nowIso();
    entry.last_seen_context_version = session.version;
  }
}

function requirePass(session, pass, message) {
  if (session.activePass !== pass) {
    throw new McpError(-32010, message ?? `This action requires design pass ${pass}.`, {
      current_pass: session.activePass,
      required_pass: pass,
    });
  }
}

function requirePassRange(session, minPass, message) {
  if (session.activePass < minPass) {
    throw new McpError(-32010, message ?? `This action requires design pass ${minPass} or later.`, {
      current_pass: session.activePass,
      required_pass: minPass,
    });
  }
}

function ensureFoundationReady(session) {
  if (!session.designSystem || !session.siteStructure.routes.length) {
    throw new McpError(
      -32012,
      "Phase 1 foundation is incomplete. apply_design_system and define_site_structure must both be completed first."
    );
  }
}

function computeDependencyAlerts(session, tokenUpdates) {
  const impacted = [];
  for (const route of session.siteStructure.routes) {
    for (const element of route.elements ?? []) {
      const text = JSON.stringify(element).toLowerCase();
      if (JSON.stringify(tokenUpdates).toLowerCase().includes("color") && text.includes("palette")) {
        impacted.push({
          route_id: route.id,
          element_id: element.id,
          reason: "Color tokens changed.",
        });
      }
      if (JSON.stringify(tokenUpdates).toLowerCase().includes("spacing") && text.includes("spacing")) {
        impacted.push({
          route_id: route.id,
          element_id: element.id,
          reason: "Spacing tokens changed.",
        });
      }
    }
  }

  session.dependencyAlerts = impacted;
  return impacted;
}

function routeById(session, routeId) {
  const route = session.siteStructure.routes.find((entry) => entry.id === routeId);
  if (!route) {
    throw new McpError(-32013, `Unknown route_id "${routeId}".`);
  }
  return route;
}

function buildElement(args) {
  return {
    id: args.element_id ?? createId("element"),
    kind: args.kind ?? "section",
    title: args.title ?? args.kind ?? "Untitled Element",
    purpose: args.purpose ?? "No purpose provided.",
    axes: args.axes ?? {},
    layout: args.layout ?? {},
    hierarchy: args.hierarchy ?? {},
    palette: args.palette ?? {},
    typography: args.typography ?? {},
    motion: args.motion ?? {},
    interactions: args.interactions ?? {},
    distinctiveness: args.distinctiveness ?? {},
    exportContract: args.props_contract ?? {},
    html_code: args.html_code ?? "",
    created_at: nowIso(),
  };
}

function resolveSnapshot(session, args) {
  const byId = args.snapshot_id
    ? session.snapshots.find((entry) => entry.id === args.snapshot_id)
    : null;
  if (byId) {
    return byId;
  }

  const label = args.snapshot_label ?? args.label;
  if (label) {
    return session.snapshots.find((entry) => entry.label === label) ?? null;
  }

  return null;
}

export class SessionManager {
  constructor(store = new PersistentStore()) {
    this.store = store;
    this.listeners = new Set();
  }

  load(sessionId) {
    return this.store.getSession(sessionId) ?? createSession(sessionId);
  }

  save(session, options = {}) {
    this.store.saveSession(session);
    writeLiveFiles(session);
    if (options.broadcast !== false) {
      this.emitSessionUpdated(session);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emitSessionUpdated(session) {
    const payload = {
      sessionId: session.id,
      state: buildSessionState(session),
    };
    for (const listener of this.listeners) {
      listener(payload);
    }
  }

  getSessionState(sessionId) {
    const session = this.load(sessionId);
    return buildSessionState(session);
  }

  async getSessionContext(args) {
    const sessionId = args.session_id ?? slugify(args.project ?? "default-design-session");
    const session = this.load(sessionId);
    const agentId = args.agent_id ?? "anonymous-agent";

    session.agentRegistry[agentId] = {
      agent_id: agentId,
      joined_at: session.agentRegistry[agentId]?.joined_at ?? nowIso(),
      last_handoff_at: nowIso(),
      last_seen_context_version: session.version,
      last_mutation_at: session.agentRegistry[agentId]?.last_mutation_at ?? null,
    };

    this.save(session);
    return buildSessionContext(session);
  }

  defineDesignerVoice(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    requirePass(session, 0, "define_designer_voice is only allowed during phase 0.");
    if (session.designSystem) {
      throw new McpError(-32012, "Designer voice cannot be redefined after the design system has been applied.");
    }

    session.designerVoice = {
      non_negotiables: ensureArray(args.non_negotiables),
      loves: ensureArray(args.loves),
      obsessions: ensureArray(args.obsessions),
      avoid: ensureArray(args.avoid),
      brand_traits: ensureArray(args.brand_traits),
    };

    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      designer_voice_profile: session.designerVoice,
    };
  }

  readSessionState(args) {
    const session = this.load(args.session_id);
    assertAgentHasContext(session, args.agent_id);
    return buildSessionState(session);
  }

  async loadDesignReferences(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    requirePass(session, 0, "load_design_references is only allowed during phase 0.");
    if (!session.designerVoice) {
      throw new McpError(-32011, "define_designer_voice must be completed before loading references.");
    }

    const references = await Promise.all(
      ensureArray(args.references).map((reference) => analyzeReference(reference))
    );
    session.designReferences = references;
    session.creativeDeparture = args.creative_departure ?? session.creativeDeparture;

    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      references,
      creative_departure: session.creativeDeparture,
    };
  }

  generateDesignDirections(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    requirePass(session, 0, "generate_design_directions is only allowed during phase 0.");

    session.directions = generateDirections({
      count: args.n,
      references: session.designReferences,
      designerVoice: session.designerVoice,
      creativeDeparture: args.creative_departure ?? session.creativeDeparture,
    });

    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      directions: session.directions,
    };
  }

  approveDesignDirection(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    requirePass(session, 0, "approve_design_direction is only allowed during phase 0.");
    const direction = session.directions.find((entry) => entry.id === args.direction_id);
    if (!direction) {
      throw new McpError(-32013, `Unknown direction_id "${args.direction_id}".`);
    }

    session.approvedDirectionId = direction.id;
    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      approved_design_direction: direction,
    };
  }

  applyDesignSystem(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    requirePass(session, 0, "apply_design_system must happen before staged design passes begin.");
    const direction = approvedDirection(session);
    if (!direction) {
      throw new McpError(-32012, "A design direction must be approved before applying the design system.");
    }

    session.designSystem = {
      tokens: {
        ...deepClone(direction.tokens),
        ...(args.override_tokens ?? {}),
      },
      typographyPairings: [direction.typography_pairing],
      motionPresets: [direction.motion_preset],
      locked: true,
    };

    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      design_system: session.designSystem,
    };
  }

  defineSiteStructure(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    requirePass(session, 0, "define_site_structure must happen before staged design passes begin.");
    if (!session.designSystem) {
      throw new McpError(-32012, "apply_design_system must be completed before defining site structure.");
    }

    session.siteStructure = {
      sharedRegions: ensureArray(args.shared_regions),
      routes: ensureArray(args.routes).map((route) => ({
        id: route.id ?? slugify(route.path ?? route.name ?? createId("route")),
        name: route.name ?? route.path ?? "Untitled Route",
        path: route.path ?? `/${slugify(route.name ?? "route")}`,
        regions: ensureArray(route.regions),
        elements: route.elements ?? [],
      })),
    };

    session.foundationComplete = true;
    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      site_structure: session.siteStructure,
    };
  }

  setDesignPhase(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    ensureFoundationReady(session);
    assertSequentialPass(session.activePass, args.pass);

    session.activePass = args.pass;
    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      active_phase: phaseSummary(session),
    };
  }

  mutateDesignTokens(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    if (!session.designSystem) {
      throw new McpError(-32012, "No active design system to mutate.");
    }

    session.designSystem.tokens = {
      ...session.designSystem.tokens,
      ...(args.token_updates ?? {}),
    };
    const dependencyAlerts = computeDependencyAlerts(session, args.token_updates ?? {});

    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      design_system: session.designSystem,
      dependency_alerts: dependencyAlerts,
    };
  }

  critiqueCurrentDesign(args) {
    const session = this.load(args.session_id);
    assertAgentHasContext(session, args.agent_id);
    const target = args.candidate ?? this.resolveCandidate(session, args);
    return critiqueDesign(target, session.designSystem);
  }

  evaluateDesignQuality(args) {
    const session = this.load(args.session_id);
    assertAgentHasContext(session, args.agent_id);
    const target = args.candidate ?? this.resolveCandidate(session, args);
    return evaluateQuality(target, session);
  }

  wowFactorAudit(args) {
    const session = this.load(args.session_id);
    assertAgentHasContext(session, args.agent_id);
    const target = args.candidate ?? this.resolveCandidate(session, args);
    return auditWowFactor(target, session);
  }

  createUiElement(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    ensureFoundationReady(session);
    requirePassRange(session, 1, "create_ui_element is only available after layout pass 1 begins.");
    const route = routeById(session, args.route_id);
    const candidate = buildElement(args);
    const critique = critiqueDesign(candidate, session.designSystem);
    const quality = evaluateQuality(candidate, session);
    const wow = auditWowFactor(candidate, session);

    const gate = {
      critique,
      quality,
      wow_factor: wow,
      pass: critique.pass && quality.pass && wow.pass,
    };

    session.validationHistory.push({
      id: createId("validation"),
      route_id: route.id,
      element_id: candidate.id,
      created_at: nowIso(),
      gate,
    });

    if (!gate.pass) {
      touch(session);
      noteAgentMutation(session, args.agent_id);
      this.save(session);
      throw new McpError(-32022, "Triple validation gate rejected the candidate element.", gate);
    }

    route.elements.push(candidate);
    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);

    return {
      context_version: session.version,
      route_id: route.id,
      element: candidate,
      gate,
    };
  }

  snapshotState(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    const snapshot = {
      id: createId("snapshot"),
      label: args.label ?? `Snapshot ${session.snapshots.length + 1}`,
      created_at: nowIso(),
      state: deepClone(session),
    };

    session.snapshots.push(snapshot);
    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      snapshot: {
        id: snapshot.id,
        label: snapshot.label,
        created_at: snapshot.created_at,
      },
    };
  }

  restoreSnapshot(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    const snapshot = resolveSnapshot(session, args);
    if (!snapshot) {
      throw new McpError(
        -32013,
        `Unknown snapshot reference "${args.snapshot_id ?? args.snapshot_label ?? args.label ?? "unknown"}".`
      );
    }

    const restored = deepClone(snapshot.state);
    restored.snapshots = session.snapshots;
    restored.agentRegistry = session.agentRegistry;
    touch(restored);
    noteAgentMutation(restored, args.agent_id);
    this.save(restored);
    return {
      context_version: restored.version,
      active_phase: phaseSummary(restored),
    };
  }

  pinFeedback(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    const issue = String(args.issue ?? "").trim();
    if (!issue) {
      throw new McpError(-32014, "Feedback issue text is required.");
    }

    const fingerprint = slugify(issue);
    const count = (session.feedbackMemory[fingerprint]?.count ?? 0) + 1;
    session.feedbackMemory[fingerprint] = {
      issue,
      count,
      last_seen_at: nowIso(),
    };

    const pin = {
      id: createId("pin"),
      target_id: args.target_id ?? null,
      issue,
      severity: args.severity ?? "medium",
      fingerprint,
      recurring: count >= 2,
      location: args.location
        ? {
            x: args.location.x ?? null,
            y: args.location.y ?? null,
            normalized_x: args.location.normalized_x ?? args.location.normalizedX ?? null,
            normalized_y: args.location.normalized_y ?? args.location.normalizedY ?? null,
          }
        : null,
      created_at: nowIso(),
      status: "open",
    };

    session.feedbackPins.push(pin);
    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      feedback_pin: pin,
      recurring_issue: session.feedbackMemory[fingerprint],
    };
  }

  readUserSuggestions(args) {
    const session = this.load(args.session_id);
    assertAgentHasContext(session, args.agent_id);
    return {
      session_id: session.id,
      active_phase: phaseSummary(session),
      open_feedback_pins: deepClone(summarizePins(session)),
      all_feedback_pins: deepClone(session.feedbackPins),
      recurring_issues: deepClone(
        Object.values(session.feedbackMemory).filter((entry) => entry.count >= 2)
      ),
    };
  }

  resolveFeedbackPin(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    const pin = session.feedbackPins.find((entry) => entry.id === args.pin_id);
    if (!pin) {
      throw new McpError(-32013, `Unknown pin_id "${args.pin_id}".`);
    }

    pin.status = "resolved";
    pin.resolved_at = nowIso();
    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      feedback_pin: pin,
    };
  }

  async exportArtifacts(args) {
    const session = this.load(args.session_id);
    validateMutationEnvelope(session, args);
    ensureFoundationReady(session);
    const direction = approvedDirection(session);
    if (!direction) {
      throw new McpError(-32012, "An approved design direction is required before export.");
    }

    session.approvedDirection = direction;
    const result = await exportArtifacts(session, args.export_contract, args.out_dir);
    touch(session);
    noteAgentMutation(session, args.agent_id);
    this.save(session);
    return {
      context_version: session.version,
      export: result,
    };
  }

  resolveCandidate(session, args) {
    if (args.route_id && args.element_id) {
      const route = routeById(session, args.route_id);
      const element = route.elements.find((entry) => entry.id === args.element_id);
      if (!element) {
        throw new McpError(-32013, `Unknown element_id "${args.element_id}" in route "${args.route_id}".`);
      }
      return element;
    }

    throw new McpError(-32014, "Provide either candidate input or both route_id and element_id.");
  }
}
