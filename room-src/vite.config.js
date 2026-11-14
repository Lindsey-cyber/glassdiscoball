import { defineConfig } from "vite";

// Build into ../room so the site can be uploaded as-is; relative paths so it works under any folder.
export default defineConfig({
  base: "./",
  build: {
    outDir: "../room",
    emptyOutDir: true,
    target: "es2022",
    chunkSizeWarningLimit: 4000,
  },
});
