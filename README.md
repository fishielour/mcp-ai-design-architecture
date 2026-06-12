# MCP Elite Design Architect Hub

An advanced Model Context Protocol server plus a live frontend canvas for multi-agent design sessions.

## What It Implements

- Mandatory `get_session_context` handoff before any agent can mutate session state
- Persistent session state with optimistic concurrency via `context_version`
- Strict staged workflow from voice definition through passes 1-5
- Radically distinct direction generation across spatial, typography, temperature, and motion axes
- Triple validation gate before UI elements are committed:
  - `critique_current_design`
  - `evaluate_design_quality`
  - `wow_factor_audit`
- Snapshot and restore support
- Feedback memory that flags recurring issues
- Token mutation dependency alerts
- `read_session_state` for full canvas state reads
- `read_user_suggestions` so agents can consume live user feedback pins
- React/Tailwind/Motion export with zipped artifacts and Storybook stories
- WebSocket canvas bridge for real-time frontend updates

## Projects

- MCP server: [src/server.js](./src/server.js)
- Frontend canvas app: [mcp-canvas-app](./mcp-canvas-app)

## Install

```bash
npm install
```

## Run The Canvas Server

```bash
node src/server.js
```

This starts:

- stdio MCP transport for tool calls
- WebSocket canvas bridge at `ws://127.0.0.1:3210/ws`
- health endpoint at `http://127.0.0.1:3210/health`

Session state is persisted to `.mcp-elite-design-state.json`.

## Run The MCP Stdio Server

```bash
node src/server-stdio.js
```

This entry point is for MCP clients such as Antigravity. It does not start the WebSocket or HTTP canvas bridge, so it avoids port `3210` entirely.

The canvas/live entry and the stdio entry are intentionally separate:

- Canvas/live server: [src/server.js](./src/server.js)
- MCP stdio server: [src/server-stdio.js](./src/server-stdio.js)

If someone still launches `src/server.js` in stdio mode, it now respects these environment overrides and will skip the live server:

- `MCP_TRANSPORT=stdio`
- `MCP_MODE=stdio`
- `MCP_DISABLE_LIVE_SERVER=1`

## Run The Canvas App

```bash
npm run dev --workspace mcp-canvas-app
```

## One-Click Startup

Double-click [start.bat](./start.bat) from the project root.

It will:

- open the canvas server in one terminal window
- open the frontend dev server in a second terminal window
- wait for both services to respond
- open `http://localhost:5173` in your default browser

Optional frontend env vars:

- `VITE_MCP_WS_URL` default: `ws://127.0.0.1:3210/ws`
- `VITE_SESSION_ID` default: `default-design-session`
- `VITE_CANVAS_AGENT_ID` default: `canvas-user`

You can also open a specific session via query string:

- `http://localhost:5173/?session=my-session-id`

## Tool Flow

1. `get_session_context`
2. `define_designer_voice`
3. `load_design_references`
4. `generate_design_directions`
5. `approve_design_direction`
6. `apply_design_system`
7. `define_site_structure`
8. `set_design_phase`
9. `create_ui_element`
10. `read_user_suggestions`
11. `export_artifacts`

## Antigravity MCP Config

Use the stdio entry point, not `src/server.js`.

Example config: [mcp.antigravity.config.example.json](./mcp.antigravity.config.example.json)

Equivalent `args` change:

```json
{
  "command": "node",
  "args": [
    "/absolute/path/to/cloned/repo/src/server-stdio.js"
  ]
}
```

## Notes

- `load_design_references` supports `provided_analysis` so the workflow can continue in offline or sandboxed environments.
- `mutate_design_tokens` updates tokens and reports which generated elements are likely affected.
- `export_artifacts` writes generated files and a zip archive to `artifacts/<session_id>/` by default.
- The canvas listens for live session updates over WebSocket, so agent mutations appear without a page refresh.

## Deployment Guide

If you are cloning this repository and want to deploy the Design Hub for your own team to use remotely, follow these steps to host the frontend canvas and backend server online.

### 1. Deploy the Frontend Canvas (Vercel)

The easiest way to host the `mcp-canvas-app` is via Vercel:

1. Push your cloned repository to your own GitHub account.
2. Go to [Vercel](https://vercel.com/) and create a **New Project**.
3. Import your GitHub repository.
4. In the Vercel project settings:
   - **Framework Preset**: Select **Vite**.
   - **Root Directory**: Set this to `mcp-canvas-app`.
5. Click **Deploy**. Vercel will generate a public URL for your canvas (e.g., `https://your-canvas.vercel.app`).

### 2. Deploy the Backend MCP Server (Free Options)

The backend must run continuously to process live WebSocket connections and provide the MCP endpoints. Here are completely free options you can use:

- **Adaptable.io (Highly Recommended):** Excellent free tier for Node.js apps. Extremely easy to deploy from GitHub, supports WebSockets, and doesn't require a credit card.
- **Alwaysdata:** Provides a free 100MB environment. Great if you want to avoid credit cards and just need a small space to run the server.
- **Render (Free Tier):** Render offers a free Web Service tier. Note: Free instances will spin down after 15 minutes of inactivity, which can cause a short delay the next time you use it.
- **Glitch:** A great fully free playground that can host Node.js WebSocket servers (also spins down when inactive).
- **Fly.io:** Requires a credit card to prevent abuse (but won't charge you). Their free allowance is very generous for running small, always-on WebSocket servers.

**General Deployment Steps (e.g., on Render):**
1. Create an account and start a new **Web Service**.
2. Connect your GitHub repository.
3. Use the following configurations:
   - **Root Directory**: `.` (the main repository folder)
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
4. Deploy the service. Your provider will give you a backend URL (e.g., `https://my-backend.onrender.com`).

### 3. Connect the Frontend and Backend

Once both are deployed, you must tell your frontend where the backend WebSocket is hosted.

1. Go to your frontend hosting provider (Vercel) > **Settings** > **Environment Variables**.
2. Add a new variable:
   - **Name**: `VITE_MCP_WS_URL`
   - **Value**: Your backend's WebSocket URL. (Change `https://` to `wss://` — e.g., `wss://my-backend.onrender.com/ws`).
3. Trigger a redeploy of your frontend so the environment variables take effect.

Now, anyone with your frontend URL can view the live canvas, and any remote MCP agents connected to your backend will update the interface in real-time!

