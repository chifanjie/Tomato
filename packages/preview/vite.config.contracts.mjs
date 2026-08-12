import { fileURLToPath } from "node:url";
import path from "node:path";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default {
  root: packageRoot,
  build: {
    ssr: path.join(packageRoot, "src/contracts.mjs"),
    outDir: path.join(packageRoot, "dist"),
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      output: {
        entryFileNames: "contracts.mjs",
        chunkFileNames: "contracts-[hash].mjs",
        format: "es",
      },
    },
  },
  ssr: {
    noExternal: true,
  },
};
