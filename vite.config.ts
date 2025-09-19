import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE ?? "/",
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger(), spa404Plugin()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
