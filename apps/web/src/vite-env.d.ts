/// <reference types="vite/client" />

// Injected at build time by vite.config.ts's `define` — the real build
// identifier (git commit), not just the package.json version.
declare const __GIT_SHA__: string;
declare const __BUILD_TIME__: string;
