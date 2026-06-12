import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { CanvasSurface } from "./components/CanvasSurface";
import { ContextSidebar } from "./components/ContextSidebar";
import { FeedbackComposer } from "./components/FeedbackComposer";
import { useCanvasSocket } from "./hooks/useCanvasSocket";
import { buildDesignVars, getSessionId, getSocketUrl } from "./lib/design";

function StatusPill({ status }) {
  const theme =
    status === "connected"
      ? { bg: "var(--color-accent)", fg: "var(--color-background)", label: "Connected" }
      : status === "reconnecting"
        ? { bg: "#f59e0b", fg: "#111111", label: "Reconnecting" }
        : status === "connecting"
          ? { bg: "#94a3b8", fg: "#0f172a", label: "Connecting" }
          : { bg: "#ef4444", fg: "#ffffff", label: "Disconnected" };

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em]"
      style={{ background: theme.bg, color: theme.fg }}
    >
      {theme.label}
    </span>
  );
}

function phaseLabel(sessionState) {
  const phase = sessionState?.active_phase;
  if (!phase) {
    return "Phase 0: baseline";
  }
  return `Phase ${phase.pass}: ${phase.label}`;
}

const TABS = [
  { id: "split", label: "Split" },
  { id: "preview", label: "Preview" },
  { id: "design_system", label: "Design System" },
];

const VIEWPORTS = [
  { id: "desktop", label: "Desktop", icon: "🖥", width: "100%" },
  { id: "tablet", label: "Tablet", icon: "📱", width: "768px" },
  { id: "mobile", label: "Mobile", icon: "📲", width: "390px" },
];

export default function App() {
  const sessionId = getSessionId();
  const wsUrl = getSocketUrl();
  const {
    status,
    sessionState,
    lastError,
    lastExport,
    createFeedbackPin,
    resolveFeedbackPin,
    restoreSnapshot,
    requestExport,
  } = useCanvasSocket({ sessionId, wsUrl });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingPinAnchor, setPendingPinAnchor] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [activeTab, setActiveTab] = useState("split");
  const [viewportSize, setViewportSize] = useState("desktop");

  const designVars = useMemo(() => buildDesignVars(sessionState?.design_system), [sessionState?.design_system]);

  useEffect(() => {
    if (!selectedPin) {
      return;
    }

    const nextPin = sessionState?.feedback_pins?.find((pin) => pin.id === selectedPin.id) ?? null;
    setSelectedPin(nextPin);
  }, [selectedPin, sessionState?.feedback_pins]);

  const pendingPin = pendingPinAnchor ? (
    <FeedbackComposer
      anchor={pendingPinAnchor}
      onClose={() => setPendingPinAnchor(null)}
      onSubmit={(issue) => {
        const success = createFeedbackPin({
          issue,
          location: {
            x: pendingPinAnchor.x,
            y: pendingPinAnchor.y,
            normalized_x: pendingPinAnchor.normalizedX,
            normalized_y: pendingPinAnchor.normalizedY,
          },
        });
        if (success) {
          setPendingPinAnchor(null);
        }
      }}
    />
  ) : null;

  return (
    <div
      className="min-h-screen"
      style={designVars}
    >
      <div
        className="min-h-screen px-4 py-5 md:px-6 md:py-6"
        style={{
          background:
            "radial-gradient(circle at top left, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 30%), linear-gradient(160deg, color-mix(in srgb, var(--color-background) 84%, white 16%), var(--color-background))",
          color: "var(--color-foreground)",
          fontFamily: "var(--font-body)",
        }}
      >
        <div className="mx-auto grid max-w-[1680px] gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="grid gap-5">
            <motion.header
              initial={{ opacity: 0, y: -18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="sticky top-4 z-20 grid gap-4 rounded-[30px] border px-5 py-5 backdrop-blur-xl md:px-6"
              style={{
                borderColor: "color-mix(in srgb, var(--color-accent) 28%, transparent)",
                background: "color-mix(in srgb, var(--color-background) 74%, white 26%)",
                boxShadow: "var(--shadow-soft)",
              }}
              data-control="true"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="grid gap-3">
                  <p className="m-0 text-[11px] uppercase tracking-[0.34em]" style={{ color: "var(--color-secondary)" }}>
                    MCP Design Architect
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="display-face m-0 text-4xl leading-none md:text-6xl">Live Design Canvas</h1>
                    <StatusPill status={status} />
                  </div>
                  <p className="m-0 max-w-3xl text-sm leading-7" style={{ color: "var(--color-secondary)" }}>
                    Session <span style={{ color: "var(--color-foreground)" }}>{sessionId}</span> is mirrored live from the MCP server. Agent writes stream straight into this canvas.
                  </p>
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      requestExport({
                        breakpoints: ["sm", "md", "lg", "xl"],
                        include_contract_snapshot: true,
                      })
                    }
                    className="rounded-full px-5 py-3 text-xs uppercase tracking-[0.22em]"
                    style={{ background: "var(--color-accent)", color: "var(--color-background)" }}
                  >
                    Export artifacts
                  </button>
                  {lastExport?.downloadUrl ? (
                    <p className="m-0 text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--color-secondary)" }}>
                      Last export ready
                    </p>
                  ) : null}
                </div>
              </div>

              {/* ── Tab bar + Viewport controls ── */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="tab-bar">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`tab-btn${activeTab === tab.id ? " active" : ""}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {(activeTab === "preview" || activeTab === "split") && (
                  <div className="viewport-bar">
                    {VIEWPORTS.map((vp) => (
                      <button
                        key={vp.id}
                        type="button"
                        className={`viewport-btn${viewportSize === vp.id ? " active" : ""}`}
                        onClick={() => setViewportSize(vp.id)}
                        title={vp.label}
                      >
                        {vp.icon}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                <div className="rounded-[24px] border px-4 py-4" style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 22%, transparent)" }}>
                  <p className="m-0 text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--color-secondary)" }}>
                    Active phase
                  </p>
                  <p className="display-face mt-3 text-3xl">{phaseLabel(sessionState)}</p>
                </div>
                <div className="rounded-[24px] border px-4 py-4" style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 22%, transparent)" }}>
                  <p className="m-0 text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--color-secondary)" }}>
                    Live status
                  </p>
                  <p className="mt-3 text-sm leading-7">
                    {status === "connected"
                      ? "Realtime sync is active."
                      : status === "reconnecting"
                        ? "The canvas is trying to rejoin the MCP session."
                        : "Waiting for the MCP WebSocket."}
                  </p>
                  {lastError ? (
                    <p className="mt-2 m-0 text-xs uppercase tracking-[0.2em]" style={{ color: "#b91c1c" }}>
                      {lastError}
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.header>

            <CanvasSurface
              sessionState={sessionState}
              selectedPin={selectedPin}
              onSelectPin={setSelectedPin}
              pendingPin={pendingPin}
              activeTab={activeTab}
              viewportSize={viewportSize}
              onCanvasClick={(event) => {
                const target = event.target instanceof HTMLElement ? event.target : null;
                if (target?.closest("[data-control='true']")) {
                  return;
                }

                const rect = event.currentTarget.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                setSelectedPin(null);
                setPendingPinAnchor({
                  x,
                  y,
                  normalizedX: rect.width ? x / rect.width : 0.5,
                  normalizedY: rect.height ? y / rect.height : 0.5,
                });
              }}
            />
          </main>

          <ContextSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((value) => !value)}
            sessionState={sessionState}
            onResolvePin={(pinId) => {
              resolveFeedbackPin(pinId);
              if (selectedPin?.id === pinId) {
                setSelectedPin((current) => current ? { ...current, status: "resolved" } : current);
              }
            }}
            onRestoreSnapshot={(snapshot) => {
              restoreSnapshot({ snapshotId: snapshot.id, label: snapshot.label });
              setPendingPinAnchor(null);
              setSelectedPin(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
