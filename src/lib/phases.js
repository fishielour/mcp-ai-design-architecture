import { McpError } from "./errors.js";

export const PASSES = [
  { id: 0, name: "baseline" },
  { id: 1, name: "rough-structure" },
  { id: 2, name: "visual-hierarchy" },
  { id: 3, name: "color-and-typography" },
  { id: 4, name: "motion-integration" },
  { id: 5, name: "micro-interactions" },
];

export function phaseLabel(pass) {
  const phase = PASSES.find((entry) => entry.id === pass);
  return phase ? phase.name : `unknown-${pass}`;
}

export function assertSequentialPass(currentPass, nextPass) {
  if (typeof nextPass !== "number" || nextPass < 1 || nextPass > 5) {
    throw new McpError(-32010, "Design pass must be an integer between 1 and 5.");
  }

  if (nextPass !== currentPass + 1) {
    throw new McpError(
      -32010,
      `Invalid pass transition. Current pass is ${currentPass}; next pass must be ${currentPass + 1}.`,
      { current_pass: currentPass, attempted_pass: nextPass }
    );
  }
}

export function phaseSummary(state) {
  return {
    pass: state.activePass,
    label: phaseLabel(state.activePass),
    foundation_complete: state.foundationComplete,
  };
}
