import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Real build identifier — the package.json version alone never changes
// between deploys, so it can't tell you which actual commit is running.
// The git short SHA does. Falls back gracefully if git isn't available
// (e.g. a source-only deploy with no .git directory).
function gitShortSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: __dirname }).toString().trim();
  } catch {
    return "unknown";
  }
}

// PWA per PRD section 7/8: installable, mobile-first, single codebase.
export default defineConfig({
  define: {
    __GIT_SHA__: JSON.stringify(gitShortSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "BOHAN-PETA",
        short_name: "BOHAN-PETA",
        description: "Digital quiz platform for course cohorts",
        theme_color: "#1F5C3F",
        background_color: "#F3F6F2",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
