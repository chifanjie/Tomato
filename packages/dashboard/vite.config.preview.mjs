import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { markdownWorkerSafeAliases } from "./vite.markdown.mjs";

const dashboardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const previewRoot = path.resolve(dashboardRoot, "../preview");
const coreRoot = path.resolve(dashboardRoot, "../core");

export default defineConfig({
  root: dashboardRoot,
  base: "/",
  publicDir: path.join(dashboardRoot, "public"),
  define: { "import.meta.env.VITE_DEMO_MODE": JSON.stringify("false") },
  resolve: {
    alias: {
      ...markdownWorkerSafeAliases,
      "@understand-code/core/schema": path.join(coreRoot, "dist/schema.js"),
      "@understand-code/core/search": path.join(coreRoot, "dist/search.js"),
      "@understand-code/core/types": path.join(coreRoot, "dist/types.js"),
    },
  },
  build: {
    outDir: path.join(previewRoot, "dist/dashboard"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react-vendor";
          if (id.includes("node_modules/@xyflow/")) return "xyflow";
          if (id.includes("node_modules/@dagrejs/")) return "graph-layout";
          if (id.includes("node_modules/react-markdown/") || id.includes("node_modules/unified/")) return "markdown";
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
});
