// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    // VO-28 : regroupe les grosses dépendances tierces dans des chunks vendor
    // stables plutôt que de les laisser fondre dans le bundle d'entrée de
    // l'app. Scopé à l'environnement "client" uniquement (via la clé
    // `environments`, supportée nativement par ce wrapper — voir son usage
    // pour `environments.client.define` en dev) pour ne jamais toucher au
    // build SSR / Nitro (Cloudflare Worker), qui doit rester un bundle unique.
    environments: {
      client: {
        build: {
          rollupOptions: {
            output: {
              manualChunks(id: string) {
                if (!id.includes("node_modules")) return undefined;
                if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
                if (id.includes("@tanstack/react-router") || id.includes("@tanstack/router-core") || id.includes("@tanstack/react-query") || id.includes("@tanstack/query-core") || id.includes("@tanstack/history")) return "vendor-tanstack";
                if (id.includes("@radix-ui")) return "vendor-radix";
                if (id.includes("i18next") || id.includes("react-i18next")) return "vendor-i18n";
                if (id.includes("@supabase")) return "vendor-supabase";
                if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("canvg") || id.includes("dompurify")) return "vendor-pdf";
                if (id.includes("xlsx")) return "vendor-xlsx";
                return undefined;
              },
            },
          },
        },
      },
    },
  },
});
