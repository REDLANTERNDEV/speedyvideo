import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    drop: ["console", "debugger"], // Remove console logs and debugger in production
    legalComments: "none", // Remove comments
  },
  build: {
    minify: "esbuild", // Use esbuild (built-in, faster)
    sourcemap: false, // Disable source maps for production
    rollupOptions: {
      input: {
        main: "index.html",
        background: "src/background.ts",
        content: "src/content.ts",
        popup: "src/popup.tsx",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});
