import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import { getHttpBaseUrl } from "../lib/design";

export function useCanvasSocket({ sessionId, wsUrl }) {
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const connectionIdRef = useRef(0);
  const manualCloseRef = useRef(false);
  const [status, setStatus] = useState("connecting");
  const [sessionState, setSessionState] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [lastExport, setLastExport] = useState(null);

  const sendMessage = useEffectEvent((payload) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
      return true;
    }

    setLastError("WebSocket is not connected.");
    return false;
  });

  const downloadExport = useEffectEvent((downloadUrl) => {
    const anchor = document.createElement("a");
    anchor.href = downloadUrl.startsWith("http") ? downloadUrl : `${getHttpBaseUrl()}${downloadUrl}`;
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  });

  const connect = useEffectEvent(() => {
    connectionIdRef.current += 1;
    const connectionId = connectionIdRef.current;
    manualCloseRef.current = false;
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
      socketRef.current.close();
    }
    setStatus((current) => (current === "connected" ? current : reconnectAttemptRef.current ? "reconnecting" : "connecting"));
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      if (connectionIdRef.current !== connectionId || socketRef.current !== socket) {
        return;
      }

      reconnectAttemptRef.current = 0;
      setStatus("connected");
      setLastError(null);
      socket.send(
        JSON.stringify({
          type: "subscribe",
          sessionId,
          agentId: import.meta.env.VITE_CANVAS_AGENT_ID ?? "canvas-user",
        })
      );
    });

    socket.addEventListener("message", (event) => {
      if (connectionIdRef.current !== connectionId || socketRef.current !== socket) {
        return;
      }

      const message = JSON.parse(event.data);

      if (message.type === "connection.status") {
        setStatus("connected");
        setLastError(null);
      }

      if (message.type === "session.state") {
        startTransition(() => {
          setSessionState(message.state);
        });
        setStatus("connected");
        setLastError(null);
      }

      if (message.type === "error") {
        setLastError(message.error?.message ?? "Unknown server error.");
      }

      if (message.type === "export.ready") {
        setLastExport(message.result);
        if (message.result?.downloadUrl) {
          downloadExport(message.result.downloadUrl);
        }
      }
    });

    socket.addEventListener("close", () => {
      if (connectionIdRef.current !== connectionId || socketRef.current !== socket) {
        return;
      }

      socketRef.current = null;
      if (manualCloseRef.current) {
        setStatus("disconnected");
        return;
      }

      reconnectAttemptRef.current += 1;
      setStatus("reconnecting");
      const delay = Math.min(5000, 400 * reconnectAttemptRef.current);
      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, delay);
    });

    socket.addEventListener("error", () => {
      if (connectionIdRef.current !== connectionId || socketRef.current !== socket) {
        return;
      }

      setLastError("Unable to reach the MCP canvas WebSocket.");
    });
  });

  useEffect(() => {
    connect();

    return () => {
      manualCloseRef.current = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const activeSocket = socketRef.current;
      socketRef.current = null;
      activeSocket?.close();
    };
  }, [connect, sessionId, wsUrl]);

  return {
    status,
    sessionState,
    lastError,
    lastExport,
    refreshSession() {
      sendMessage({ type: "session.read" });
    },
    createFeedbackPin({ issue, severity, targetId, location }) {
      return sendMessage({
        type: "feedback.pin.create",
        issue,
        severity,
        targetId,
        location,
      });
    },
    resolveFeedbackPin(pinId) {
      return sendMessage({
        type: "feedback.pin.resolve",
        pinId,
      });
    },
    restoreSnapshot({ snapshotId, label }) {
      return sendMessage({
        type: "snapshot.restore",
        snapshotId,
        label,
      });
    },
    requestExport(exportContract) {
      return sendMessage({
        type: "export.request",
        exportContract,
      });
    },
  };
}
