import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { parseMotionPreset } from "../lib/design";

const VIEWPORT_WIDTHS = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

/* ── Pin marker ── */
function PinMarker({ pin, onOpen }) {
  const normalizedX = pin.location?.normalized_x ?? 0.5;
  const normalizedY = pin.location?.normalized_y ?? 0.5;
  return (
    <button
      type="button"
      data-control="true"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(pin);
      }}
      className="absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] uppercase tracking-[0.18em]"
      style={{
        left: `${normalizedX * 100}%`,
        top: `${normalizedY * 100}%`,
        borderColor:
          pin.status === "resolved"
            ? "color-mix(in srgb, var(--color-secondary) 28%, transparent)"
            : "color-mix(in srgb, var(--color-accent) 48%, transparent)",
        background:
          pin.status === "resolved"
            ? "color-mix(in srgb, var(--color-background) 92%, white 8%)"
            : "var(--color-accent)",
        color: pin.status === "resolved" ? "var(--color-secondary)" : "var(--color-background)",
        opacity: pin.status === "resolved" ? 0.75 : 1,
      }}
      title={pin.issue}
    >
      {pin.status === "resolved" ? "OK" : "PIN"}
    </button>
  );
}

/* ── Element card ── */
function ElementCard({ element, transition }) {
  const headingScale = element.typography?.scale ?? [];
  const spacing = element.layout?.spacingScale ?? [];
  const zones = element.layout?.zones ?? [];
  const noveltySignals = element.distinctiveness?.noveltySignals ?? [];

  if (element.html_code) {
    return (
      <motion.article
        layout
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
        dangerouslySetInnerHTML={{ __html: element.html_code }}
      />
    );
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="relative overflow-hidden border p-5 md:p-7"
      style={{
        borderRadius: "var(--radius-card)",
        borderColor: element.palette?.accent ?? "var(--color-accent)",
        background: element.palette?.background ?? "color-mix(in srgb, var(--color-background) 84%, white 16%)",
        color: element.palette?.foreground ?? "var(--color-foreground)",
        boxShadow: "var(--shadow-soft)",
        display: "grid",
        gap: spacing[1] ?? 18,
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-6 top-4 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${element.palette?.accent ?? "var(--color-accent)"}, transparent)`,
          opacity: 0.8,
        }}
      />
      <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--color-secondary)" }}>
        <span>{element.kind}</span>
        <span>{zones.join(" / ") || "live block"}</span>
      </div>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(240px,0.8fr)] md:items-end">
        <div className="grid gap-4">
          <h2
            className="display-face m-0 leading-none"
            style={{ fontSize: headingScale.at(-1) ?? 48 }}
          >
            {element.title}
          </h2>
          <p className="m-0 max-w-3xl text-sm leading-7" style={{ color: "color-mix(in srgb, currentColor 78%, var(--color-secondary) 22%)" }}>
            {element.purpose}
          </p>
        </div>
        <div className="grid gap-3 rounded-[22px] border p-4 text-sm" style={{ borderColor: "color-mix(in srgb, var(--color-accent) 32%, transparent)" }}>
          <p className="m-0 text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--color-secondary)" }}>
            Distinctiveness
          </p>
          <ul className="m-0 grid gap-2 pl-4">
            {noveltySignals.length ? noveltySignals.slice(0, 3).map((signal) => (
              <li key={signal}>{signal}</li>
            )) : <li>Awaiting creative divergence notes</li>}
          </ul>
        </div>
      </div>
      {element.interactions?.interactive ? (
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-2 inline-flex w-fit items-center justify-center px-5 py-3 text-xs uppercase tracking-[0.22em]"
          style={{
            borderRadius: "var(--radius-pill)",
            background: element.palette?.accent ?? "var(--color-accent)",
            color: element.palette?.background ?? "var(--color-background)",
          }}
        >
          {element.interactions.label ?? "Action"}
        </motion.button>
      ) : null}
    </motion.article>
  );
}

/* ── Live Preview pane ── */
function LivePreview({ viewportSize, contextVersion, sessionState }) {
  const iframeSrc = `/product.html?t=${contextVersion ?? 0}`;
  const width = VIEWPORT_WIDTHS[viewportSize] ?? "100%";
  const phase = sessionState?.active_phase;
  const isBuilding = !sessionState?.foundation_complete || (phase?.pass ?? 0) < 1;

  return (
    <div className="preview-frame-wrapper">
      <div className="preview-frame-container" style={{ width, maxWidth: "100%" }}>
        <iframe
          className="preview-iframe"
          src={iframeSrc}
          title="Live Product Preview"
          sandbox="allow-scripts allow-same-origin"
        />
        <div className={`preview-overlay${isBuilding ? "" : " faded"}`}>
          <div className="overlay-spinner" />
          <p className="overlay-label">Building your product</p>
          <p className="overlay-phase">
            {phase ? `Phase ${phase.pass}: ${phase.label}` : "Waiting for MCP decisions…"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Design system showcase ── */
function DesignSystemView({ sessionState }) {
  const ds = sessionState?.design_system;
  const tokens = ds?.tokens ?? {};
  const colors = tokens.colors ?? {};
  const spacing = tokens.spacing ?? {};
  const radius = tokens.radius ?? {};
  const typo = ds?.typographyPairings?.[0] ?? {};
  const motionPresets = ds?.motionPresets ?? [];

  const colorEntries = [
    { name: "Background", value: colors.background },
    { name: "Foreground", value: colors.foreground },
    { name: "Accent", value: colors.accent },
    { name: "Secondary", value: colors.secondary },
  ].filter((c) => c.value);

  const spacingScale = spacing.scale ?? [];
  const spacingBase = spacing.base ?? 8;

  if (!ds) {
    return (
      <div className="ds-grid">
        <div className="ds-section" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <p className="display-face" style={{ fontSize: "1.5rem" }}>No design system yet</p>
          <p style={{ color: "var(--color-secondary)", marginTop: "0.75rem", fontSize: "14px" }}>
            The MCP will populate these tokens once it applies a design system.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-grid">
      {/* Color palette */}
      <div className="ds-section">
        <p className="ds-section-title">Color Palette</p>
        <div className="ds-swatches">
          {colorEntries.map((c) => (
            <div key={c.name} className="ds-swatch">
              <div className="ds-swatch-circle" style={{ background: c.value }} />
              <span className="ds-swatch-label">{c.name}</span>
              <span className="ds-swatch-hex">{c.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className="ds-section">
        <p className="ds-section-title">Typography</p>
        <div className="ds-typo-sample">
          <p className="ds-typo-display" style={{ fontFamily: `"${typo.display ?? "Georgia"}", serif` }}>
            {typo.display ?? "Display Font"}
          </p>
          <p className="ds-swatch-label" style={{ marginTop: 4 }}>
            Display — {typo.display ?? "Georgia"}
          </p>
        </div>
        <div className="ds-typo-sample" style={{ marginTop: "1rem" }}>
          <p className="ds-typo-body" style={{ fontFamily: `"${typo.body ?? "system-ui"}", sans-serif` }}>
            The quick brown fox jumps over the lazy dog. This is the body typeface used across all paragraph text, labels, and UI copy.
          </p>
          <p className="ds-swatch-label" style={{ marginTop: 4 }}>
            Body — {typo.body ?? "system-ui"}
          </p>
        </div>
      </div>

      {/* Spacing & Radius */}
      <div className="ds-section">
        <p className="ds-section-title">Spacing & Radius</p>
        <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <p className="ds-swatch-label" style={{ marginBottom: 12 }}>Spacing scale (base: {spacingBase}px)</p>
            <div className="ds-spacing-blocks">
              {(spacingScale.length ? spacingScale : [spacingBase]).map((val, i) => (
                <div key={i} className="ds-spacing-block">
                  <div className="ds-spacing-visual" style={{ height: val }} />
                  <span className="ds-spacing-label">{val}px</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="ds-swatch-label" style={{ marginBottom: 12 }}>Border radius</p>
            <div className="ds-radius-blocks">
              <div className="ds-radius-sample">
                <div className="ds-radius-visual" style={{ borderRadius: radius.card ?? 24 }} />
                <span className="ds-radius-label">Card: {radius.card ?? 24}px</span>
              </div>
              <div className="ds-radius-sample">
                <div className="ds-radius-visual" style={{ borderRadius: radius.pill ?? 999 }} />
                <span className="ds-radius-label">Pill: {radius.pill ?? 999}px</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Motion presets */}
      <div className="ds-section">
        <p className="ds-section-title">Motion Presets</p>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {motionPresets.length ? motionPresets.map((preset) => {
            const dur = ((preset.durationMs ?? 360) / 1000).toFixed(2);
            const ease = preset.easing ?? "cubic-bezier(0.16, 1, 0.3, 1)";
            return (
              <div key={preset.name} className="ds-motion-card">
                <p className="ds-motion-name">{preset.name}</p>
                <p className="ds-motion-meta">
                  {preset.durationMs}ms · {preset.staggerMs ?? 0}ms stagger · {ease}
                </p>
                <div className="ds-motion-bar">
                  <div
                    className="ds-motion-bar-fill"
                    style={{ transition: `width ${dur}s ${ease}` }}
                  />
                </div>
              </div>
            );
          }) : (
            <p style={{ color: "var(--color-secondary)", fontSize: "14px" }}>
              No motion presets defined yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Canvas elements (original live canvas) ── */
function CanvasElements({
  sessionState,
  onCanvasClick,
  pendingPin,
  selectedPin,
  onSelectPin,
  transition,
}) {
  const routes = sessionState?.site_structure?.routes ?? [];
  const [activeRouteId, setActiveRouteId] = useState(routes[0]?.id ?? "");
  const feedbackPins = sessionState?.feedback_pins ?? [];

  React.useEffect(() => {
    if (!routes.find((route) => route.id === activeRouteId)) {
      setActiveRouteId(routes[0]?.id ?? "");
    }
  }, [activeRouteId, routes]);

  const activeRoute = routes.find((route) => route.id === activeRouteId) ?? routes[0];

  return (
    <section
      className="canvas-grid relative overflow-hidden border px-4 py-5 md:px-7 md:py-8"
      style={{
        minHeight: 680,
        borderRadius: "36px",
        borderColor: "color-mix(in srgb, var(--color-accent) 26%, transparent)",
        background: "linear-gradient(160deg, color-mix(in srgb, var(--color-background) 84%, white 16%), color-mix(in srgb, var(--color-background) 96%, black 4%))",
      }}
      onClick={onCanvasClick}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at top right, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 32%)" }} />

      <div className="relative z-10 grid gap-6">
        {/* Route tabs */}
        <div className="flex flex-wrap gap-2" data-control="true">
          {routes.length ? routes.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => setActiveRouteId(route.id)}
              className="rounded-full border px-4 py-2 text-xs uppercase tracking-[0.22em]"
              style={{
                borderColor: activeRoute?.id === route.id ? "var(--color-accent)" : "color-mix(in srgb, var(--color-secondary) 28%, transparent)",
                background: activeRoute?.id === route.id ? "var(--color-accent)" : "transparent",
                color: activeRoute?.id === route.id ? "var(--color-background)" : "var(--color-foreground)",
              }}
            >
              {route.name}
            </button>
          )) : (
            <p className="m-0 text-sm" style={{ color: "var(--color-secondary)" }}>
              No routes yet. Once the agent defines site structure, the live canvas will populate here.
            </p>
          )}
        </div>

        {/* Route header */}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_240px] md:items-end">
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.32em]" style={{ color: "var(--color-secondary)" }}>
              {activeRoute?.path ?? "/"}
            </p>
            <h1 className="display-face mt-3 text-5xl leading-none md:text-7xl">
              {activeRoute?.name ?? "Waiting for route definitions"}
            </h1>
          </div>
          <div className="rounded-[26px] border p-4" style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 26%, transparent)" }}>
            <p className="m-0 text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--color-secondary)" }}>
              Shared regions
            </p>
            <p className="mt-3 m-0 text-sm leading-6">
              {(sessionState?.site_structure?.shared_regions ?? []).join(" / ") || "Not defined yet"}
            </p>
          </div>
        </div>

        {/* Elements */}
        <div className="grid gap-5">
          {activeRoute?.elements?.length ? activeRoute.elements.map((element) => (
            <ElementCard key={element.id} element={element} transition={transition} />
          )) : (
            <div className="rounded-[32px] border border-dashed p-10" style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 24%, transparent)" }}>
              <p className="display-face m-0 text-3xl">The canvas is live.</p>
              <p className="mt-3 mb-0 max-w-2xl text-sm leading-7" style={{ color: "var(--color-secondary)" }}>
                Agent-generated elements will stream in here as soon as `create_ui_element` commits to the active route.
              </p>
            </div>
          )}
        </div>
      </div>

      {feedbackPins.map((pin) => (
        <PinMarker key={pin.id} pin={pin} onOpen={onSelectPin} />
      ))}

      {selectedPin ? (
        <div
          data-control="true"
          className="absolute bottom-5 right-5 z-20 max-w-sm rounded-[24px] border p-4"
          style={{
            borderColor: "color-mix(in srgb, var(--color-accent) 32%, transparent)",
            background: "color-mix(in srgb, var(--color-background) 86%, white 14%)",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="m-0 text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--color-secondary)" }}>
            Feedback pin
          </p>
          <p className="mt-3 m-0 text-sm leading-6">{selectedPin.issue}</p>
          <p className="mt-3 m-0 text-[11px] uppercase tracking-[0.22em]" style={{ color: selectedPin.status === "resolved" ? "var(--color-secondary)" : "var(--color-accent)" }}>
            {selectedPin.status}
          </p>
        </div>
      ) : null}

      {pendingPin}
    </section>
  );
}

/* ── Main CanvasSurface export ── */
export function CanvasSurface({
  sessionState,
  onCanvasClick,
  pendingPin,
  selectedPin,
  onSelectPin,
  activeTab,
  viewportSize,
}) {
  const transition = useMemo(() => parseMotionPreset(sessionState?.design_system), [sessionState?.design_system]);
  const contextVersion = sessionState?.context_version ?? 0;

  if (activeTab === "design_system") {
    return (
      <motion.div
        key="design_system"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <DesignSystemView sessionState={sessionState} />
      </motion.div>
    );
  }

  if (activeTab === "preview") {
    return (
      <motion.div
        key="preview"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <LivePreview
          viewportSize={viewportSize}
          contextVersion={contextVersion}
          sessionState={sessionState}
        />
      </motion.div>
    );
  }

  // Split view (default)
  return (
    <motion.div
      key="split"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="split-layout"
    >
      <CanvasElements
        sessionState={sessionState}
        onCanvasClick={onCanvasClick}
        pendingPin={pendingPin}
        selectedPin={selectedPin}
        onSelectPin={onSelectPin}
        transition={transition}
      />
      <LivePreview
        viewportSize={viewportSize}
        contextVersion={contextVersion}
        sessionState={sessionState}
      />
    </motion.div>
  );
}
