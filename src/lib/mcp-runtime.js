import { toJsonRpcError, McpError } from "./errors.js";
import { startLiveServer } from "./live-server.js";
import { TOOL_DEFINITIONS } from "./schemas.js";
import { SessionManager } from "./session-manager.js";

export function shouldStartLiveServer(env = process.env) {
  const transport = String(env.MCP_TRANSPORT ?? env.MCP_MODE ?? "").toLowerCase();
  const disableFlag = String(env.MCP_DISABLE_LIVE_SERVER ?? "").toLowerCase();

  if (transport === "stdio") {
    return false;
  }

  if (disableFlag === "1" || disableFlag === "true" || disableFlag === "yes") {
    return false;
  }

  return true;
}

export function createManagerRuntime({ enableLiveServer = false } = {}) {
  const manager = new SessionManager();
  const liveServer = enableLiveServer ? startLiveServer(manager) : null;
  return { manager, liveServer };
}

export function createToolCalls(manager) {
  return {
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
}

export function createHandlers(manager) {
  const toolCalls = createToolCalls(manager);

  return {
    initialize: async () => ({
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: "mcp-elite-design-architect-hub",
        version: "0.1.0",
      },
    }),

    "notifications/initialized": async () => null,

    ping: async () => ({ ok: true }),

    "tools/list": async () => ({
      tools: TOOL_DEFINITIONS,
    }),

    "tools/call": async (params) => {
      const name = params?.name;
      const args = params?.arguments ?? {};
      const toolHandler = toolCalls[name];
      if (!toolHandler) {
        throw new McpError(-32601, `Unknown tool: ${name}`);
      }

      const result = await toolHandler(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    },
  };
}

export function runStdioTransport(manager, options = {}) {
  const handlers = createHandlers(manager);
  let buffer = Buffer.alloc(0);
  const keepAlive = setInterval(() => {}, 1 << 30);
  const outputMode = options.outputMode === "json" ? "json" : "mcp";

  function send(message) {
    const payload = JSON.stringify(message);
    if (outputMode === "json") {
      process.stdout.write(`${payload}\n`);
      return;
    }

    const body = Buffer.from(payload, "utf8");
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
    process.stdout.write(Buffer.concat([header, body]));
  }

  function logTransportError(error, prefix = "[mcp-stdio]") {
    const message =
      error instanceof Error ? `${error.name}: ${error.stack ?? error.message}` : String(error);
    process.stderr.write(`${prefix} ${message}\n`);
  }

  async function handleMessage(message) {
    let id;
    try {
      if (!message || typeof message !== "object") {
        throw new McpError(-32600, "Invalid request.");
      }

      id = message.id;
      const { method, params } = message;
      if (!method) {
        throw new McpError(-32600, "Missing JSON-RPC method.");
      }

      const handler = handlers[method];
      if (!handler) {
        throw new McpError(-32601, `Method not found: ${method}`);
      }

      const result = await handler(params);
      if (id !== undefined) {
        send({
          jsonrpc: "2.0",
          id,
          result,
        });
      }
    } catch (error) {
      if (id !== undefined) {
        send({
          jsonrpc: "2.0",
          id,
          error: toJsonRpcError(error),
        });
      }
    }
  }

  function processBuffer() {
    while (true) {
      const separatorIndex = buffer.indexOf("\r\n\r\n");
      if (separatorIndex === -1) {
        const rawPayload = buffer.toString("utf8").trim();
        if (!rawPayload || rawPayload.startsWith("Content-Length:")) {
          return;
        }

        try {
          const payload = JSON.parse(rawPayload);
          buffer = Buffer.alloc(0);
          void handleMessage(payload).catch((error) => {
            logTransportError(error, "[mcp-stdio] unhandled raw message failure");
          });
        } catch {
          return;
        }

        return;
      }

      const headerChunk = buffer.subarray(0, separatorIndex).toString("utf8");
      const match = headerChunk.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        throw new McpError(-32700, "Missing Content-Length header.");
      }

      const contentLength = Number.parseInt(match[1], 10);
      const totalLength = separatorIndex + 4 + contentLength;
      if (buffer.length < totalLength) {
        return;
      }

      const bodyChunk = buffer.subarray(separatorIndex + 4, totalLength).toString("utf8");
      buffer = buffer.subarray(totalLength);
      const payload = JSON.parse(bodyChunk);
      void handleMessage(payload).catch((error) => {
        logTransportError(error, "[mcp-stdio] unhandled message failure");
      });
    }
  }

  process.on("uncaughtException", (error) => {
    logTransportError(error, "[mcp-stdio] uncaught exception");
  });

  process.on("unhandledRejection", (reason) => {
    logTransportError(reason, "[mcp-stdio] unhandled rejection");
  });

  process.stdin.resume();

  process.stdin.on("data", (chunk) => {
    const normalizedChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
    buffer = Buffer.concat([buffer, normalizedChunk]);
    try {
      processBuffer();
    } catch (error) {
      logTransportError(error, "[mcp-stdio] buffer processing error");
      send({
        jsonrpc: "2.0",
        error: toJsonRpcError(error),
      });
    }
  });

  process.stdin.on("end", () => {
    logTransportError("stdin ended; keeping stdio server alive for reconnects", "[mcp-stdio]");
  });

  process.on("SIGTERM", () => {
    clearInterval(keepAlive);
    process.exit(0);
  });

  process.on("SIGINT", () => {
    clearInterval(keepAlive);
    process.exit(0);
  });
}
