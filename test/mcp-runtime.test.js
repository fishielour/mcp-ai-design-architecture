import test from "node:test";
import assert from "node:assert/strict";
import { shouldStartLiveServer } from "../src/lib/mcp-runtime.js";

test("starts live server by default", () => {
  assert.equal(shouldStartLiveServer({}), true);
});

test("disables live server in stdio transport mode", () => {
  assert.equal(shouldStartLiveServer({ MCP_TRANSPORT: "stdio" }), false);
  assert.equal(shouldStartLiveServer({ MCP_MODE: "stdio" }), false);
});

test("disables live server when explicit disable flag is set", () => {
  assert.equal(shouldStartLiveServer({ MCP_DISABLE_LIVE_SERVER: "1" }), false);
  assert.equal(shouldStartLiveServer({ MCP_DISABLE_LIVE_SERVER: "true" }), false);
});
