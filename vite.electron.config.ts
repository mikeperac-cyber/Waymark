import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  appType: "spa",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    target: "esnext",
    minify: "esbuild",
    cssMinify: true,
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./electron.html", import.meta.url)),
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("lucide-react")) return "vendor-icons";
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
});
