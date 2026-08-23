import { defineConfig } from "vite";
import path from "node:path";


export default defineConfig({

    build: {

        outDir: "dist/chrome",

        emptyOutDir: false,

        rollupOptions: {

            input: path.resolve(
                __dirname,
                "../src/background/background.ts"
            ),

            output: {

                format: "iife",

                entryFileNames: "background.js"

            }

        }

    }

});
