import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS } from "./lib/schemas.js";
import { SessionManager } from "./lib/session-manager.js";
import { McpError } from "./lib/errors.js";

// ── Redirect console.* to stderr so stdout stays clean for JSON-RPC ──
function formatError(value) {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const writeToStderr = (msg) => process.stderr.write(`${msg}\n`);
console.log = (...a) => writeToStderr(a.map(formatError).join(" "));
console.info = (...a) => writeToStderr(a.map(formatError).join(" "));
console.warn = (...a) => writeToStderr(a.map(formatError).join(" "));
console.debug = (...a) => writeToStderr(a.map(formatError).join(" "));

// ── Crash guards ──
process.on("uncaughtException", (err) => {
  process.stderr.write(`[mcp-stdio] uncaughtException: ${formatError(err)}\n`);
});
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`[mcp-stdio] unhandledRejection: ${formatError(reason)}\n`);
});

// ── Session manager (shared across all tool calls) ──
const manager = new SessionManager();

// ── Tool dispatch map ──
const toolHandlers = {
  get_session_context: (args) => manager.getSessionContext(args),
  define_designer_voice: (args) => manager.defineDesignerVoice(args),
  read_session_state: (args) => manager.readSessionState(args),
  load_design_references: (args) => manager.loadDesignReferences(args),
  generate_design_directions: (args) => manager.generateDesignDirections(args),
  approve_design_direction: (args) => manager.approveDesignDirection(args),
  apply_design_system: (args) => manager.applyDesignSystem(args),
  define_site_structure: (args) => manager.defineSiteStructure(args),
  set_design_phase: (args) => manager.setDesignPhase(args),
  mutate_design_tokens: (args) => manager.mutateDesignTokens(args),
  create_ui_element: (args) => manager.createUiElement(args),
  critique_current_design: (args) => manager.critiqueCurrentDesign(args),
  evaluate_design_quality: (args) => manager.evaluateDesignQuality(args),
  wow_factor_audit: (args) => manager.wowFactorAudit(args),
  snapshot_state: (args) => manager.snapshotState(args),
  restore_snapshot: (args) => manager.restoreSnapshot(args),
  pin_feedback: (args) => manager.pinFeedback(args),
  read_user_suggestions: (args) => manager.readUserSuggestions(args),
  resolve_feedback_pin: (args) => manager.resolveFeedbackPin(args),
  export_artifacts: (args) => manager.exportArtifacts(args),
};

// ── Create the MCP server ──
const server = new Server(
  {
    name: "mcp-elite-design-architect-hub",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── tools/list handler ──
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

// ── tools/call handler ──
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  const handler = toolHandlers[name];
  if (!handler) {
    throw new McpError(-32601, `Unknown tool: ${name}`);
  }

  try {
    const result = await handler(args);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    // Return MCP tool errors as isError content so the client can display them
    if (error instanceof McpError) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: error.message, code: error.code, data: error.data },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
    throw error;
  }
});

// ── Start the stdio transport ──
const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write("[mcp-stdio] Server started and listening on stdio transport.\n");
