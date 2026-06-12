import React from "react";

function Section({ title, children }) {
  return (
    <section className="grid gap-3 rounded-[26px] border p-4" style={{ borderColor: "color-mix(in srgb, var(--color-accent) 24%, transparent)" }}>
      <p className="m-0 text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--color-secondary)" }}>
        {title}
      </p>
      {children}
    </section>
  );
}

function List({ items }) {
  if (!items?.length) {
    return <p className="m-0 text-sm" style={{ color: "var(--color-secondary)" }}>None yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em]"
          style={{
            borderColor: "color-mix(in srgb, var(--color-secondary) 26%, transparent)",
            color: "var(--color-foreground)",
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function ContextSidebar({
  collapsed,
  onToggle,
  sessionState,
  onRestoreSnapshot,
  onResolvePin,
}) {
  const direction = sessionState?.approved_design_direction;
  const voice = sessionState?.designer_voice_profile;
  const motionPresets = sessionState?.motion_presets ?? [];
  const feedbackPins = sessionState?.feedback_pins ?? [];
  const snapshots = sessionState?.snapshot_history ?? [];

  return (
    <aside
      className="sticky top-5 self-start"
      data-control="true"
    >
      <div className="grid gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="w-full rounded-full border px-4 py-3 text-xs uppercase tracking-[0.22em]"
          style={{
            borderColor: "color-mix(in srgb, var(--color-accent) 38%, transparent)",
            background: "color-mix(in srgb, var(--color-background) 82%, white 18%)",
          }}
        >
          {collapsed ? "Open context" : "Close context"}
        </button>
        {!collapsed ? (
          <div className="grid gap-3">
            <Section title="Design Direction">
              <h2 className="display-face m-0 text-2xl">{direction?.name ?? "No direction approved yet"}</h2>
              <p className="m-0 text-sm leading-6" style={{ color: "var(--color-secondary)" }}>
                {direction?.description ?? "Once a design direction is approved, its voice and axes appear here."}
              </p>
            </Section>

            <Section title="Designer Voice">
              <div className="grid gap-3">
                <div>
                  <p className="m-0 mb-2 text-xs uppercase tracking-[0.22em]" style={{ color: "var(--color-secondary)" }}>Loves</p>
                  <List items={voice?.loves} />
                </div>
                <div>
                  <p className="m-0 mb-2 text-xs uppercase tracking-[0.22em]" style={{ color: "var(--color-secondary)" }}>Obsessions</p>
                  <List items={voice?.obsessions} />
                </div>
                <div>
                  <p className="m-0 mb-2 text-xs uppercase tracking-[0.22em]" style={{ color: "var(--color-secondary)" }}>Avoid</p>
                  <List items={voice?.avoid} />
                </div>
              </div>
            </Section>

            <Section title="Motion Presets">
              <div className="grid gap-3">
                {motionPresets.length ? motionPresets.map((preset) => (
                  <div key={preset.name} className="rounded-2xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 25%, transparent)" }}>
                    <p className="m-0 text-sm font-semibold">{preset.name}</p>
                    <p className="mt-2 m-0 text-xs uppercase tracking-[0.22em]" style={{ color: "var(--color-secondary)" }}>
                      {preset.durationMs}ms / {preset.staggerMs}ms stagger
                    </p>
                  </div>
                )) : <p className="m-0 text-sm" style={{ color: "var(--color-secondary)" }}>No locked motion presets yet.</p>}
              </div>
            </Section>

            <Section title="Feedback Queue">
              <div className="grid gap-3">
                {feedbackPins.length ? feedbackPins.map((pin) => (
                  <div
                    key={pin.id}
                    className="rounded-2xl border p-3"
                    style={{
                      borderColor:
                        pin.status === "resolved"
                          ? "color-mix(in srgb, var(--color-secondary) 22%, transparent)"
                          : "color-mix(in srgb, var(--color-accent) 42%, transparent)",
                      opacity: pin.status === "resolved" ? 0.7 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: pin.status === "resolved" ? "var(--color-secondary)" : "var(--color-accent)" }}>
                        {pin.status}
                      </span>
                      {pin.status !== "resolved" ? (
                        <button
                          type="button"
                          onClick={() => onResolvePin(pin.id)}
                          className="rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em]"
                          style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 25%, transparent)" }}
                        >
                          Resolve
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-3 m-0 text-sm leading-6">{pin.issue}</p>
                  </div>
                )) : <p className="m-0 text-sm" style={{ color: "var(--color-secondary)" }}>No feedback pins yet.</p>}
              </div>
            </Section>

            <Section title="Snapshots">
              <div className="grid gap-3">
                {snapshots.length ? snapshots.map((snapshot) => (
                  <div key={snapshot.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 25%, transparent)" }}>
                    <div>
                      <p className="m-0 text-sm font-semibold">{snapshot.label}</p>
                      <p className="mt-1 m-0 text-xs uppercase tracking-[0.22em]" style={{ color: "var(--color-secondary)" }}>
                        {new Date(snapshot.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRestoreSnapshot(snapshot)}
                      className="rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.22em]"
                      style={{ background: "var(--color-accent)", color: "var(--color-background)" }}
                    >
                      Restore
                    </button>
                  </div>
                )) : <p className="m-0 text-sm" style={{ color: "var(--color-secondary)" }}>No snapshots captured.</p>}
              </div>
            </Section>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
