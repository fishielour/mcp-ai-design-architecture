import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";
import { WebSocketServer } from "ws";
import { toJsonRpcError } from "./errors.js";

const DEFAULT_HOST = process.env.MCP_WEB_HOST ?? "127.0.0.1";
const DEFAULT_PORT = Number.parseInt(process.env.MCP_WEB_PORT ?? "3210", 10);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(payload));
}

function sendWebSocketMessage(socket, message) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(message));
  }
}

function parseDownloadPath(requestUrl) {
  const pathname = new URL(requestUrl, "http://localhost").pathname;
  if (!pathname.startsWith("/downloads/")) {
    return null;
  }

  return decodeURIComponent(pathname.replace("/downloads/", ""));
}

function safeFilePath(relativePath) {
  const root = path.resolve(process.cwd(), "artifacts");
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root)) {
    return null;
  }
  return resolved;
}

async function ensureCanvasContext(manager, sessionId, agentId) {
  const context = await manager.getSessionContext({
    session_id: sessionId,
    agent_id: agentId,
  });

  return context.context_version;
}

export function startLiveServer(manager, options = {}) {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const subscriptions = new Map();

  const server = http.createServer(async (request, response) => {
    if (!request.url) {
      sendJson(response, 400, { error: "Missing URL" });
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      response.end();
      return;
    }

    const { pathname, searchParams } = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        transport: "websocket",
        host,
        port,
      });
      return;
    }

    if (pathname.startsWith("/api/sessions/")) {
      const sessionId = decodeURIComponent(pathname.replace("/api/sessions/", ""));
      const agentId = searchParams.get("agentId") ?? "canvas-reader";
      try {
        await manager.getSessionContext({ session_id: sessionId, agent_id: agentId });
        sendJson(response, 200, manager.getSessionState(sessionId));
      } catch (error) {
        sendJson(response, 500, {
          error: toJsonRpcError(error),
        });
      }
      return;
    }

    const downloadPath = parseDownloadPath(request.url);
    if (downloadPath) {
      const filePath = safeFilePath(downloadPath);
      if (!filePath || !fs.existsSync(filePath)) {
        sendJson(response, 404, { error: "Not found" });
        return;
      }

      response.writeHead(200, {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${path.basename(filePath)}"`,
        "access-control-allow-origin": "*",
      });
      fs.createReadStream(filePath).pipe(response);
      return;
    }

    sendJson(response, 404, { error: "Route not found" });
  });

  const wss = new WebSocketServer({
    server,
    path: "/ws",
  });

  manager.subscribe(({ sessionId, state }) => {
    for (const [socket, subscription] of subscriptions.entries()) {
      if (subscription.sessionId === sessionId) {
        sendWebSocketMessage(socket, {
          type: "session.state",
          state,
        });
      }
    }
  });

  async function handleMessage(socket, rawData) {
    let message;
    try {
      message = JSON.parse(String(rawData));
    } catch {
      sendWebSocketMessage(socket, {
        type: "error",
        error: {
          message: "Invalid JSON payload.",
        },
      });
      return;
    }

    const subscription = subscriptions.get(socket);

    try {
      switch (message.type) {
        case "subscribe": {
          const sessionId = message.sessionId ?? "default-design-session";
          const agentId = message.agentId ?? "canvas-user";
          subscriptions.set(socket, { sessionId, agentId });
          await manager.getSessionContext({ session_id: sessionId, agent_id: agentId });
          sendWebSocketMessage(socket, {
            type: "session.state",
            state: manager.getSessionState(sessionId),
          });
          break;
        }

        case "feedback.pin.create": {
          if (!subscription) {
            throw new Error("Subscribe before creating feedback pins.");
          }
          const contextVersion = await ensureCanvasContext(manager, subscription.sessionId, subscription.agentId);
          const result = manager.pinFeedback({
            session_id: subscription.sessionId,
            agent_id: subscription.agentId,
            context_version: contextVersion,
            issue: message.issue,
            severity: message.severity ?? "medium",
            target_id: message.targetId ?? null,
            location: message.location ?? null,
          });
          sendWebSocketMessage(socket, { type: "feedback.pin.created", result });
          break;
        }

        case "feedback.pin.resolve": {
          if (!subscription) {
            throw new Error("Subscribe before resolving feedback pins.");
          }
          const contextVersion = await ensureCanvasContext(manager, subscription.sessionId, subscription.agentId);
          const result = manager.resolveFeedbackPin({
            session_id: subscription.sessionId,
            agent_id: subscription.agentId,
            context_version: contextVersion,
            pin_id: message.pinId,
          });
          sendWebSocketMessage(socket, { type: "feedback.pin.resolved", result });
          break;
        }

        case "snapshot.restore": {
          if (!subscription) {
            throw new Error("Subscribe before restoring snapshots.");
          }
          const contextVersion = await ensureCanvasContext(manager, subscription.sessionId, subscription.agentId);
          const result = manager.restoreSnapshot({
            session_id: subscription.sessionId,
            agent_id: subscription.agentId,
            context_version: contextVersion,
            snapshot_id: message.snapshotId,
            snapshot_label: message.snapshotLabel,
            label: message.label,
          });
          sendWebSocketMessage(socket, { type: "snapshot.restored", result });
          break;
        }

        case "export.request": {
          if (!subscription) {
            throw new Error("Subscribe before exporting artifacts.");
          }
          const contextVersion = await ensureCanvasContext(manager, subscription.sessionId, subscription.agentId);
          const result = await manager.exportArtifacts({
            session_id: subscription.sessionId,
            agent_id: subscription.agentId,
            context_version: contextVersion,
            export_contract: message.exportContract ?? {
              breakpoints: ["sm", "md", "lg", "xl"],
              include_contract_snapshot: true,
            },
          });
          const relativeArchive = path
            .relative(path.resolve(process.cwd(), "artifacts"), result.export.archive_path)
            .replace(/\\/g, "/");
          sendWebSocketMessage(socket, {
            type: "export.ready",
            result: {
              ...result,
              downloadUrl: `http://${host}:${port}/downloads/${relativeArchive}`,
            },
          });
          break;
        }

        case "session.read": {
          if (!subscription) {
            throw new Error("Subscribe before reading session state.");
          }
          sendWebSocketMessage(socket, {
            type: "session.state",
            state: manager.getSessionState(subscription.sessionId),
          });
          break;
        }

        default:
          sendWebSocketMessage(socket, {
            type: "error",
            error: {
              message: `Unknown message type "${message.type}".`,
            },
          });
      }
    } catch (error) {
      sendWebSocketMessage(socket, {
        type: "error",
        error: toJsonRpcError(error),
      });
    }
  }

  wss.on("connection", (socket) => {
    sendWebSocketMessage(socket, {
      type: "connection.status",
      status: "connected",
      wsUrl: `ws://${host}:${port}/ws`,
    });

    socket.on("message", (rawData) => {
      void handleMessage(socket, rawData);
    });

    socket.on("close", () => {
      subscriptions.delete(socket);
    });
  });

  server.on("error", (error) => {
    if (error.code !== "EADDRINUSE") {
      console.error(`[mcp-live] failed to bind ${host}:${port}:`, error);
    } else {
      console.error(`[mcp-live] port ${port} is already in use; websocket bridge not started.`);
    }
  });

  server.listen(port, host, () => {
    console.error(`[mcp-live] canvas bridge listening on ws://${host}:${port}/ws`);
  });

  return {
    server,
    wss,
    close() {
      wss.close();
      server.close();
    },
  };
}
