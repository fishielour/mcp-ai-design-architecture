function stringList(description) {
  return {
    type: "array",
    items: { type: "string" },
    description,
  };
}

export const TOOL_DEFINITIONS = [
  {
    name: "get_session_context",
    description:
      "Must be the first call for any agent joining a session. Returns phase, locked tokens, approved direction, designer voice, motion presets, snapshots, and open feedback pins.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        project: { type: "string" },
        agent_id: { type: "string" },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "define_designer_voice",
    description: "Sets hard non-negotiables, loves, obsessions, and avoidances that all design decisions must follow.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        non_negotiables: stringList("Required design traits."),
        loves: stringList("Loved patterns or themes."),
        obsessions: stringList("Strong visual obsessions."),
        avoid: stringList("Patterns to avoid."),
        brand_traits: stringList("Brand adjectives."),
      },
      required: ["session_id", "agent_id", "context_version"],
    },
  },
  {
    name: "read_session_state",
    description:
      "Returns the full live session state for canvases or agents that need the component tree, tokens, pins, and snapshots.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
      },
      required: ["session_id", "agent_id"],
    },
  },
  {
    name: "load_design_references",
    description: "Loads and analyzes design references while enforcing a declared creative departure.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        creative_departure: { type: "string" },
        references: {
          type: "array",
          items: {
            type: "object",
            properties: {
              url: { type: "string" },
              label: { type: "string" },
              provided_analysis: { type: "object" },
            },
            required: ["url"],
          },
        },
      },
      required: ["session_id", "agent_id", "context_version", "references"],
    },
  },
  {
    name: "generate_design_directions",
    description: "Generates radically distinct design directions that differ across at least three key axes.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        n: { type: "number" },
        creative_departure: { type: "string" },
      },
      required: ["session_id", "agent_id", "context_version", "n"],
    },
  },
  {
    name: "approve_design_direction",
    description: "Locks one generated direction as the approved path forward.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        direction_id: { type: "string" },
      },
      required: ["session_id", "agent_id", "context_version", "direction_id"],
    },
  },
  {
    name: "apply_design_system",
    description: "Applies locked design tokens, typography pairing, and motion presets for the approved direction.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        override_tokens: { type: "object" },
      },
      required: ["session_id", "agent_id", "context_version"],
    },
  },
  {
    name: "define_site_structure",
    description: "Defines the route map and shared layout regions.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        shared_regions: {
          type: "array",
          items: { type: "string" },
        },
        routes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              path: { type: "string" },
              regions: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      required: ["session_id", "agent_id", "context_version", "routes"],
    },
  },
  {
    name: "set_design_phase",
    description: "Advances the active design pass in strict linear order from 1 through 5.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        pass: { type: "number" },
      },
      required: ["session_id", "agent_id", "context_version", "pass"],
    },
  },
  {
    name: "mutate_design_tokens",
    description: "Mutates design tokens and reports downstream dependency alerts.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        token_updates: { type: "object" },
      },
      required: ["session_id", "agent_id", "context_version", "token_updates"],
    },
  },
  {
    name: "create_ui_element",
    description: "Creates a UI element only if the triple validation gate passes.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        route_id: { type: "string" },
        element_id: { type: "string" },
        kind: { type: "string" },
        title: { type: "string" },
        purpose: { type: "string" },
        axes: { type: "object" },
        layout: { type: "object" },
        hierarchy: { type: "object" },
        palette: { type: "object" },
        typography: { type: "object" },
        motion: { type: "object" },
        interactions: { type: "object" },
        distinctiveness: { type: "object" },
        props_contract: { type: "object" },
        html_code: { type: "string", description: "Raw HTML string representing the visual preview of the component. Use semantic HTML and inline styles mapped to the design system CSS variables (e.g. var(--color-accent)) to build the real UI." },
      },
      required: ["session_id", "agent_id", "context_version", "route_id", "kind", "purpose"],
    },
  },
  {
    name: "critique_current_design",
    description: "Runs objective compliance checks like contrast, rhythm alignment, and accessibility labeling.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        route_id: { type: "string" },
        element_id: { type: "string" },
        candidate: { type: "object" },
      },
      required: ["session_id", "agent_id"],
    },
  },
  {
    name: "evaluate_design_quality",
    description: "Scores subjective quality such as hierarchy, composition, and voice alignment.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        route_id: { type: "string" },
        element_id: { type: "string" },
        candidate: { type: "object" },
      },
      required: ["session_id", "agent_id"],
    },
  },
  {
    name: "wow_factor_audit",
    description: "Audits distinctiveness and fails safe, predictable, or invisible outcomes.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        route_id: { type: "string" },
        element_id: { type: "string" },
        candidate: { type: "object" },
      },
      required: ["session_id", "agent_id"],
    },
  },
  {
    name: "snapshot_state",
    description: "Captures a full rollback snapshot of the current system state.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        label: { type: "string" },
      },
      required: ["session_id", "agent_id", "context_version"],
    },
  },
  {
    name: "restore_snapshot",
    description: "Restores a previously captured snapshot while preserving session history.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        snapshot_id: { type: "string" },
        snapshot_label: { type: "string" },
        label: { type: "string" },
      },
      required: ["session_id", "agent_id", "context_version"],
    },
  },
  {
    name: "pin_feedback",
    description: "Pins feedback to an element or route and tracks recurring issues across the session.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        target_id: { type: "string" },
        issue: { type: "string" },
        severity: { type: "string" },
        location: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            normalized_x: { type: "number" },
            normalized_y: { type: "number" },
          },
        },
      },
      required: ["session_id", "agent_id", "context_version", "issue"],
    },
  },
  {
    name: "read_user_suggestions",
    description:
      "Returns open and resolved user feedback pins plus recurring issue signals so agents can respond to live canvas feedback.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
      },
      required: ["session_id", "agent_id"],
    },
  },
  {
    name: "resolve_feedback_pin",
    description: "Marks a feedback pin as resolved.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        pin_id: { type: "string" },
      },
      required: ["session_id", "agent_id", "context_version", "pin_id"],
    },
  },
  {
    name: "export_artifacts",
    description: "Validates the export contract and writes React/Tailwind-ready artifacts to disk.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        agent_id: { type: "string" },
        context_version: { type: "number" },
        export_contract: { type: "object" },
        out_dir: { type: "string" },
      },
      required: ["session_id", "agent_id", "context_version"],
    },
  },
];
