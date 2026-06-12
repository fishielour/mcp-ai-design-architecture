import fs from "node:fs";
import path from "node:path";
import { deepClone, nowIso } from "./utils.js";

const DEFAULT_PATH = path.resolve(process.cwd(), ".mcp-elite-design-state.json");

function defaultRoot() {
  return {
    sessions: {},
    metadata: {
      version: 1,
      updated_at: nowIso(),
    },
  };
}

export class PersistentStore {
  constructor(filePath = DEFAULT_PATH) {
    this.filePath = filePath;
    this.root = defaultRoot();
    this.load();
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      this.flush();
      return;
    }

    const raw = fs.readFileSync(this.filePath, "utf8");
    this.root = raw.trim() ? JSON.parse(raw) : defaultRoot();
  }

  flush() {
    this.root.metadata.updated_at = nowIso();
    fs.writeFileSync(this.filePath, JSON.stringify(this.root, null, 2));
  }

  getSession(sessionId) {
    return deepClone(this.root.sessions[sessionId]);
  }

  saveSession(session) {
    this.root.sessions[session.id] = deepClone(session);
    this.flush();
  }

  listSessions() {
    return Object.values(this.root.sessions).map((session) => deepClone(session));
  }
}
