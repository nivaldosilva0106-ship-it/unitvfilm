import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Cache bust: v8-2026-01-15-final
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/comandoplay': {
        target: 'https://comandoplay.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/comandoplay/, ''),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
  optimizeDeps: {
    force: true,
    esbuildOptions: {
      target: "esnext",
    },
  },
}));
