import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // IMPORTANT: Refine v5 routerProvider uses `react-router`.
      // Ensure the app does not load a second router context via `react-router-dom` imports.
      "react-router-dom": "react-router",
    },
  },
}));
