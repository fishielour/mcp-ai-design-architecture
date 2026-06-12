import React, { useState } from "react";

export function FeedbackComposer({ anchor, onSubmit, onClose }) {
  const [value, setValue] = useState("");

  return (
    <div
      data-control="true"
      className="absolute z-30 w-72 -translate-x-1/2 rounded-[22px] border p-4 shadow-2xl backdrop-blur-xl"
      style={{
        left: `${anchor.x}px`,
        top: `${anchor.y}px`,
        borderColor: "color-mix(in srgb, var(--color-accent) 38%, transparent)",
        background: "color-mix(in srgb, var(--color-background) 84%, white 16%)",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="grid gap-3">
        <div>
          <p className="m-0 text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--color-secondary)" }}>
            New feedback pin
          </p>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--color-foreground)" }}>
            Leave a note for the agent at this exact canvas spot.
          </p>
        </div>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-28 rounded-2xl border p-3 text-sm outline-none"
          style={{
            borderColor: "color-mix(in srgb, var(--color-secondary) 28%, transparent)",
            background: "color-mix(in srgb, white 42%, transparent)",
          }}
          placeholder="The hierarchy feels too safe here. Push the contrast harder."
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.22em]"
            style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 35%, transparent)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!value.trim()) {
                return;
              }
              onSubmit(value.trim());
              setValue("");
            }}
            className="flex-1 rounded-full px-4 py-2 text-xs uppercase tracking-[0.22em]"
            style={{ background: "var(--color-accent)", color: "var(--color-background)" }}
          >
            Send pin
          </button>
        </div>
      </div>
    </div>
  );
}
