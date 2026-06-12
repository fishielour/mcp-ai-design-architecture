import { createManagerRuntime, runStdioTransport, shouldStartLiveServer } from "./lib/mcp-runtime.js";

const { manager } = createManagerRuntime({
  enableLiveServer: shouldStartLiveServer(process.env),
});

runStdioTransport(manager);
