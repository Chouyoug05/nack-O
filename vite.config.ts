import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

const spa404Plugin = () => {
  let outDir = "dist";
  return {
    name: "spa-404-plugin",
    configResolved(resolved: { build: { outDir: string } }) {
      outDir = resolved.build.outDir;
    },
    closeBundle() {
      try {
        const indexPath = path.resolve(process.cwd(), outDir, "index.html");
        const destPath = path.resolve(process.cwd(), outDir, "404.html");
        if (fs.existsSync(indexPath)) {
          fs.copyFileSync(indexPath, destPath);
        }
      } catch {
        // ignore copy errors
      }
    },
  } as const;
};

// En dev, /light/ et /light (sans index.html) doivent servir le light app statique
// (public/light/index.html) et non le SPA React — sinon les liens publics tombent sur le login.
const lightAppDevPlugin = () => ({
  name: "light-app-dev-serve",
  apply: "serve" as const,
  configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: unknown, next: () => void) => void) => void } }) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/light\/?(?:[#?].*)?$/.test(req.url)) {
        req.url = "/light/index.html";
      }
      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE ?? "/",
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      // Bundle legacy pour les très vieux navigateurs (iPad 3 / iOS 9, etc.)
      // Génère un bundle nomodule transpilé + injecte les polyfills core-js automatiquement
      legacy({
        targets: ["ios >= 9"],
        modernTargets: ["ios >= 12.2", "chrome >= 63"],
        additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
        modernPolyfills: true,
        renderLegacyChunks: true,
      }),
      mode === "development" && componentTagger(),
      spa404Plugin(),
      lightAppDevPlugin(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: "es2015",
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("firebase")) return "firebase";
            if (id.includes("recharts") || id.includes("jspdf")) return "charts-pdf";
            if (id.includes("@radix-ui")) return "radix";
          },
        },
      },
    },
  };
});
