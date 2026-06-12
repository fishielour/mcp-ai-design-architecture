# Developer Onboarding Guide: MCP Design Architect

Welcome to the team! This repository contains the **MCP Design Architect**—a custom Model Context Protocol (MCP) server integrated with a live, real-time React visualization canvas. 

When you configure this server in your AI assistant (Claude Desktop, Cursor, Roo Code, etc.), the AI will use this server to make design decisions, define tokens, build responsive routes, and stream the generated UI directly into a browser panel.

---

## Prerequisites

Before starting, make sure you have:
1. **Node.js** (v18 or higher recommended) installed.
2. **An MCP-compatible AI client**:
   - [Claude Desktop App](https://claude.ai/download) (Recommended)
   - **VS Code** with the **Roo Code** or **Cline** extension
   - **Cursor** IDE

---

## Step 1: Clone & Install Dependencies

1. Clone this repository to your local machine.
2. Open your terminal in the project root folder and run:
   ```bash
   npm install
   ```
   *This installs the dependencies for the backend bridge and the frontend canvas workspace.*

---

## Step 2: Start the Live Preview Canvas

You need to run the local development servers so you can watch your AI design components in real time.

### On Windows (One-Click)
Double-click the **`start.bat`** file in the root of the project. This will automatically:
- Start the backend WebSocket server on `http://localhost:3210`
- Start the frontend React app on `http://localhost:5173`
- Open `http://localhost:5173` in your default browser

### On macOS / Linux (Manual commands)
Open two terminal windows:
* **Terminal 1 (Backend Bridge)**:
  ```bash
  npm start
  ```
* **Terminal 2 (Frontend React App)**:
  ```bash
  npm run dev:canvas
  ```
Then open `http://localhost:5173` in your web browser. You should see a screen displaying **"Waiting for the MCP"**.

---

## Step 3: Configure Your AI Client

You must tell your AI assistant where to find the MCP server file. **Choose the setup guide below for your client:**

### Option A: For Claude Desktop App (Recommended)
1. Press `Win + R` (Windows) or `Cmd + Space` (Mac), paste the path below, and press Enter to open your configuration file:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Open the file in a text editor and add the following entry under `"mcpServers"` (be sure to replace the absolute path below with the **actual path** to where you cloned this repository):

```json
{
  "mcpServers": {
    "mcp-design-architect": {
      "command": "node",
      "args": [
        "C:/path/to/your/cloned/repo/src/server-stdio.js"
      ]
    }
  }
}
```
> **Windows Tip**: Use forward slashes (`/`) in the path to avoid JSON formatting errors.
3. Save the file and **restart the Claude Desktop app**.

---

### Option B: For VS Code (Roo Code or Cline Extensions)
1. Open the **Roo Code** or **Cline** sidebar panel in VS Code.
2. Click the **Gear icon ⚙️** (Settings) in the top-right corner of the panel.
3. Scroll down to the **MCP Servers** section and click **Edit MCP Settings** (this opens `cline_mcp_settings.json` or `roo_mcp_settings.json`).
4. Paste this config block into the `"mcpServers"` object (replace with your absolute repository path):

```json
"mcp-design-architect": {
  "command": "node",
  "args": [
    "C:/path/to/your/cloned/repo/src/server-stdio.js"
  ],
  "disabled": false,
  "alwaysAllow": []
}
```
5. Save the file. The extension will automatically reload the new tools.

---

### Option C: For Cursor IDE
1. Open Cursor **Settings** (gear icon in the top-right corner of the window).
2. Click on the **Features** tab on the left menu.
3. Scroll down to **MCP** and click **+ Add New MCP Server**.
4. Configure the fields as follows:
   - **Name**: `mcp-design-architect`
   - **Type**: `command`
   - **Command**: `node "C:/path/to/your/cloned/repo/src/server-stdio.js"`
5. Click **Save**. The status indicator should turn green.

---

## Step 4: How to Use It (Your First Session)

Now that everything is running, here is how you build a UI with the AI assistant:

1. Open your AI client (e.g., Claude Desktop or your IDE chat).
2. Tell the AI to start a design:
   > *"I want to design a SaaS landing page for an app called Nudge. It's a clean productivity tracker. Let's start a new design session."*
3. The AI will automatically connect to the MCP server and execute the design phases behind the scenes:
   - **Phase 1 (Voice Profile)**: It defines preferences, what to obsess over, and what to avoid.
   - **Phase 2 (Design Direction)**: It generates 3 distinct design options (spatial layouts, color themes, font pairings). It will ask you which direction you want to approve.
   - **Phase 3 (Tokens & Structure)**: It defines routes (e.g. `/home`, `/pricing`) and locks in styling variables.
   - **Phase 4 & 5 (UI Creation & Review)**: It writes the components and runs them through quality critiques.
4. **Watch it Build**: Keep your browser open to `http://localhost:5173`. You will watch the placeholder fade away, and your custom SaaS page will render live in the iframe container!
5. **Switch Views**: Use the tabs at the top of the canvas to switch between:
   - **Split**: Look at both the raw design cards and the live preview page.
   - **Preview**: Scale your product design across **Desktop**, **Tablet**, and **Mobile** viewports.
   - **Design System**: Look at your design system's exact colors, typography styles, spacing scales, and click the motion preset cards to preview active transition curves.

---

## Step 5: Exporting the Code to Your Target Project

When you are happy with the preview in the browser:
1. Ask the AI: *"Export the code artifacts for this session."*
2. Or click the **"Export Artifacts"** button in the top-right corner of the browser canvas dashboard.
3. The MCP server compiles the design system, assets, and React routes, saves them to your local directory under `artifacts/[session_id]`, and packages them into a `.zip` file.
4. Extract the ZIP directly into your actual project folder to use the generated components!

---

## Troubleshooting

* **Vite/WebSocket Connection Errors**: Ensure both the backend and frontend are running. If you get a port conflict on `3210` or `5173`, make sure you don't have another instance of the server running in the background.
* **Tools Not Showing in Claude**: Double check the path in `claude_desktop_config.json`. Windows paths must use forward slashes (e.g., `C:/Folder/Subfolder`) and have no trailing slashes.
* **Canvas is Blank**: Ensure the AI has completed the "designer voice" and "approved direction" phases. The iframe won't render components until a design direction is approved.
