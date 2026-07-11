import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

export default defineConfig({
    plugins: [
        react(),
        crx({
            manifest
        })
    ],

    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src")
        }
    }
});