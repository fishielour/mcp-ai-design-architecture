import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { McpError } from "./errors.js";
import { slugify } from "./utils.js";

function pascalCase(value) {
  return slugify(value)
    .split("-")
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");
}

function routeComponentName(route) {
  return `${pascalCase(route.name ?? route.path ?? route.id ?? "route")}Route`;
}

function withPx(value, fallback) {
  if (typeof value === "number") {
    return `${value}px`;
  }
  return fallback;
}

function buildCssVariables(session) {
  const tokens = session.designSystem?.tokens ?? {};
  const colors = tokens.colors ?? {};
  const spacing = tokens.spacing ?? {};
  const radius = tokens.radius ?? {};
  const typography = session.designSystem?.typographyPairings?.[0] ?? {};

  return `@import "tailwindcss";

:root {
  --color-background: ${colors.background ?? "#ffffff"};
  --color-foreground: ${colors.foreground ?? "#111111"};
  --color-accent: ${colors.accent ?? "#0f766e"};
  --color-secondary: ${colors.secondary ?? "#475569"};
  --color-surface: color-mix(in srgb, var(--color-background) 88%, white 12%);
  --spacing-base: ${withPx(spacing.base, "8px")};
  --radius-card: ${withPx(radius.card, "24px")};
  --radius-pill: ${withPx(radius.pill, "999px")};
  --font-display: "${typography.display ?? "Georgia"}", serif;
  --font-body: "${typography.body ?? "system-ui"}", sans-serif;
  --shadow-soft: 0 30px 80px color-mix(in srgb, var(--color-foreground) 14%, transparent);
}

* {
  box-sizing: border-box;
}

html, body, #root {
  min-height: 100%;
}

body {
  margin: 0;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 34%),
    linear-gradient(160deg, color-mix(in srgb, var(--color-background) 90%, white 10%), var(--color-background));
  color: var(--color-foreground);
  font-family: var(--font-body);
}

button {
  font: inherit;
}

.display-face {
  font-family: var(--font-display);
}
`;
}

function serializeExportModel(session) {
  return session.siteStructure.routes.map((route) => ({
    ...route,
    componentName: routeComponentName(route),
  }));
}

function designDataModule(session, routes) {
  return `export const designSystem = ${JSON.stringify(session.designSystem, null, 2)};

export const designerVoice = ${JSON.stringify(session.designerVoice, null, 2)};

export const approvedDirection = ${JSON.stringify(session.approvedDirection ?? null, null, 2)};

export const routes = ${JSON.stringify(routes, null, 2)};
`;
}

function motionPresetModule(session) {
  return `export const motionPresets = ${JSON.stringify(session.designSystem?.motionPresets ?? [], null, 2)};

function parseBezier(easing) {
  const match = typeof easing === "string" ? easing.match(/cubic-bezier\\(([^)]+)\\)/) : null;
  if (!match) {
    return [0.22, 1, 0.36, 1];
  }

  return match[1].split(",").map((value) => Number(value.trim()));
}

export function getPrimaryTransition() {
  const preset = motionPresets[0] ?? {};
  return {
    duration: ((preset.durationMs ?? 360) / 1000),
    ease: parseBezier(preset.easing),
    delayChildren: ((preset.staggerMs ?? 90) / 1000),
  };
}
`;
}

function canvasElementComponent() {
  return `import React from "react";
import { motion } from "motion/react";
import { getPrimaryTransition } from "../lib/motion-presets";

function pick(value, fallback) {
  return value ?? fallback;
}

export function CanvasElement({ element }) {
  const transition = getPrimaryTransition();
  const spacingScale = element.layout?.spacingScale ?? [];
  const gap = pick(spacingScale[1], 18);
  const headingSize = pick(element.typography?.scale?.[element.typography?.scale?.length - 1], 42);
  const copySize = pick(element.typography?.scale?.[0], 16);
  const accent = pick(element.palette?.accent, "var(--color-accent)");
  const background = pick(element.palette?.background, "var(--color-surface)");
  const foreground = pick(element.palette?.foreground, "var(--color-foreground)");
  const density = pick(element.layout?.density, 0.58);
  const asymmetry = pick(element.layout?.asymmetry, 0.5);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="relative overflow-hidden border p-6 md:p-8"
      style={{
        borderRadius: "var(--radius-card)",
        borderColor: accent,
        background,
        color: foreground,
        boxShadow: "var(--shadow-soft)",
        display: "grid",
        gap,
        transform: \`translateX(\${asymmetry * 10 - 5}px)\`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-4 h-px"
        style={{
          background: \`linear-gradient(90deg, transparent, \${accent}, transparent)\`,
          opacity: 0.7,
        }}
      />
      <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.32em]" style={{ opacity: 0.75 }}>
        <span>{element.kind ?? "Element"}</span>
        <span>{(element.layout?.zones ?? []).join(" / ") || "structured block"}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.7fr)] md:items-end">
        <div className="grid gap-4">
          <h2
            className="display-face m-0 leading-none"
            style={{ fontSize: headingSize, maxWidth: \`\${58 + density * 22}ch\` }}
          >
            {element.title ?? element.id}
          </h2>
          <p className="m-0 max-w-3xl leading-7" style={{ fontSize: copySize, opacity: 0.82 }}>
            {element.purpose ?? "Generated design element"}
          </p>
        </div>
        <div className="grid gap-3 rounded-3xl border p-4 text-sm" style={{ borderColor: accent, background: "color-mix(in srgb, white 35%, transparent)" }}>
          <span className="uppercase tracking-[0.26em]" style={{ fontSize: 11, opacity: 0.65 }}>Distinctiveness</span>
          <ul className="m-0 grid gap-2 pl-4">
            {(element.distinctiveness?.noveltySignals ?? ["Intentional surprise move"]).slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      {element.interactions?.interactive ? (
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          aria-label={element.interactions.accessibleLabel}
          className="mt-2 inline-flex w-fit items-center justify-center px-5 py-3 text-sm uppercase tracking-[0.22em]"
          style={{
            borderRadius: "var(--radius-pill)",
            border: "1px solid transparent",
            background: accent,
            color: background,
          }}
        >
          {element.interactions.label ?? "Engage"}
        </motion.button>
      ) : null}
    </motion.section>
  );
}
`;
}

function routeComponent(route) {
  return `import React from "react";
import { CanvasElement } from "../components/CanvasElement";

const route = ${JSON.stringify(route, null, 2)};

export default function ${route.componentName}() {
  return (
    <main className="grid gap-6">
      <header className="grid gap-3">
        <p className="m-0 text-xs uppercase tracking-[0.32em]" style={{ color: "var(--color-secondary)" }}>
          {route.path}
        </p>
        <h1 className="display-face m-0 text-5xl md:text-7xl">{route.name}</h1>
        <p className="m-0 max-w-3xl text-sm leading-7" style={{ color: "var(--color-secondary)" }}>
          Regions: {(route.regions ?? []).join(" / ") || "canvas"}
        </p>
      </header>
      <section className="grid gap-5">
        {(route.elements ?? []).length ? (
          route.elements.map((element) => <CanvasElement key={element.id} element={element} />)
        ) : (
          <div className="rounded-[var(--radius-card)] border border-dashed p-10" style={{ borderColor: "var(--color-secondary)" }}>
            No generated elements yet for this route.
          </div>
        )}
      </section>
    </main>
  );
}
`;
}

function routeStory(route) {
  return `import React from "react";
import ${route.componentName} from "../routes/${route.componentName}";

export default {
  title: "Routes/${route.componentName}",
  component: ${route.componentName},
};

export const Default = () => <${route.componentName} />;
`;
}

function appModule(routes) {
  const imports = routes
    .map((route) => `import ${route.componentName} from "./routes/${route.componentName}";`)
    .join("\n");
  const routeMapEntries = routes
    .map((route) => `  "${route.id}": ${route.componentName}`)
    .join(",\n");

  return `import React, { useMemo, useState } from "react";
import { routes as routeData, approvedDirection, designerVoice } from "./lib/design-data";
${imports}

const routeMap = {
${routeMapEntries}
};

export default function App() {
  const [activeRouteId, setActiveRouteId] = useState(routeData[0]?.id ?? "");
  const ActiveRoute = useMemo(() => routeMap[activeRouteId] ?? (() => null), [activeRouteId]);

  return (
    <div className="min-h-screen px-5 py-6 md:px-10 md:py-8">
      <div className="mx-auto grid max-w-7xl gap-8">
        <section className="grid gap-6 rounded-[32px] border p-6 md:grid-cols-[minmax(0,1.3fr)_320px] md:p-8" style={{ borderColor: "color-mix(in srgb, var(--color-accent) 40%, transparent)", background: "color-mix(in srgb, var(--color-background) 88%, white 12%)" }}>
          <div className="grid gap-4">
            <p className="m-0 text-xs uppercase tracking-[0.32em]" style={{ color: "var(--color-secondary)" }}>
              Exported design system
            </p>
            <h1 className="display-face m-0 text-5xl leading-none md:text-7xl">
              {approvedDirection?.name ?? "Session Export"}
            </h1>
            <p className="m-0 max-w-3xl text-sm leading-7" style={{ color: "var(--color-secondary)" }}>
              {(designerVoice?.loves ?? []).slice(0, 3).join(" / ") || "Crafted from the MCP design session."}
            </p>
          </div>
          <div className="grid gap-3 rounded-[28px] border p-5" style={{ borderColor: "var(--color-accent)" }}>
            <span className="text-xs uppercase tracking-[0.32em]" style={{ color: "var(--color-secondary)" }}>Routes</span>
            <div className="flex flex-wrap gap-2">
              {routeData.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => setActiveRouteId(route.id)}
                  className="px-4 py-2 text-xs uppercase tracking-[0.22em]"
                  style={{
                    borderRadius: "var(--radius-pill)",
                    border: activeRouteId === route.id ? "1px solid var(--color-accent)" : "1px solid color-mix(in srgb, var(--color-secondary) 35%, transparent)",
                    background: activeRouteId === route.id ? "var(--color-accent)" : "transparent",
                    color: activeRouteId === route.id ? "var(--color-background)" : "var(--color-foreground)",
                  }}
                >
                  {route.name}
                </button>
              ))}
            </div>
          </div>
        </section>
        <ActiveRoute />
      </div>
    </div>
  );
}
`;
}

function mainModule() {
  return `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
}

function indexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MCP Export</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

function viteConfigModule() {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`;
}

function tailwindConfigModule() {
  return `export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
}

function exportPackageJson() {
  return JSON.stringify(
    {
      name: "mcp-exported-artifacts",
      private: true,
      version: "0.0.1",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        storybook: "storybook dev -p 6006",
      },
      dependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        motion: "^12.0.0",
      },
      devDependencies: {
        vite: "^7.0.0",
        "@vitejs/plugin-react": "^5.0.0",
        tailwindcss: "^4.0.0",
        "@tailwindcss/vite": "^4.0.0",
        storybook: "^9.0.0",
        "@storybook/react-vite": "^9.0.0",
      },
    },
    null,
    2
  );
}

function storybookMainModule() {
  return `export default {
  framework: "@storybook/react-vite",
  stories: ["../src/stories/**/*.stories.@(js|jsx)"],
};
`;
}

function storybookPreviewModule() {
  return `import "../src/index.css";

export default {
  parameters: {
    layout: "fullscreen",
  },
};
`;
}

function readmeModule(session) {
  return `# Exported MCP Design Artifacts

Approved direction: ${session.approvedDirection?.name ?? "Unknown"}

This package was generated by MCP Elite Design Architect Hub and includes:

- React route components
- Tailwind CSS setup
- Motion presets
- Storybook stories
`;
}

function validateContract(session, exportContract) {
  const issues = [];
  const breakpoints = exportContract?.breakpoints ?? ["sm", "md", "lg"];

  if (!session.designSystem) {
    issues.push("Design system is missing.");
  }

  if (!session.siteStructure?.routes?.length) {
    issues.push("Site structure does not define any routes.");
  }

  for (const route of session.siteStructure?.routes ?? []) {
    for (const element of route.elements ?? []) {
      if (element.interactions?.interactive && !element.interactions?.accessibleLabel) {
        issues.push(`Interactive element "${element.id}" in route "${route.id}" is missing an accessible label.`);
      }
    }
  }

  if (!breakpoints.length) {
    issues.push("Export contract must declare at least one breakpoint.");
  }

  return {
    pass: issues.length === 0,
    issues,
  };
}

function buildFiles(session, exportContract) {
  const routes = serializeExportModel(session);
  const files = new Map();

  files.set("package.json", exportPackageJson());
  files.set("README.md", readmeModule(session));
  files.set("index.html", indexHtml());
  files.set("vite.config.js", viteConfigModule());
  files.set("tailwind.config.js", tailwindConfigModule());
  files.set(".storybook/main.js", storybookMainModule());
  files.set(".storybook/preview.js", storybookPreviewModule());
  files.set("src/index.css", buildCssVariables(session));
  files.set("src/main.jsx", mainModule());
  files.set("src/App.jsx", appModule(routes));
  files.set("src/lib/design-data.js", designDataModule(session, routes));
  files.set("src/lib/motion-presets.js", motionPresetModule(session));
  files.set("src/components/CanvasElement.jsx", canvasElementComponent());

  for (const route of routes) {
    files.set(`src/routes/${route.componentName}.jsx`, routeComponent(route));
    files.set(`src/stories/${route.componentName}.stories.jsx`, routeStory(route));
  }

  if (exportContract?.include_contract_snapshot) {
    files.set("export-contract.json", JSON.stringify(exportContract, null, 2));
  }

  return files;
}

export async function exportArtifacts(session, exportContract = {}, outDir) {
  const validation = validateContract(session, exportContract);
  if (!validation.pass) {
    throw new McpError(-32030, "Export contract validation failed.", validation);
  }

  const sessionDir = outDir ? path.resolve(outDir) : path.resolve(process.cwd(), "artifacts", session.id);
  const files = buildFiles(session, exportContract);

  await Promise.all(
    [...files.keys()].map((relativePath) => fs.mkdir(path.join(sessionDir, path.dirname(relativePath)), { recursive: true }))
  );

  await Promise.all(
    [...files.entries()].map(([relativePath, content]) =>
      fs.writeFile(path.join(sessionDir, relativePath), content, "utf8")
    )
  );

  const zip = new JSZip();
  for (const [relativePath, content] of files.entries()) {
    zip.file(relativePath.replace(/\\/g, "/"), content);
  }

  const archiveName = `${slugify(session.id)}-artifacts.zip`;
  const archivePath = path.join(sessionDir, archiveName);
  const archiveBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  await fs.writeFile(archivePath, archiveBuffer);

  return {
    out_dir: sessionDir,
    files: [...files.keys()].map((relativePath) => path.join(sessionDir, relativePath)),
    archive_path: archivePath,
    archive_name: archiveName,
    validation,
  };
}
