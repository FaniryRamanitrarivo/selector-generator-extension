import { mergeConfig } from "vite";
import type { PreRenderedChunk } from "rollup";
import path from "node:path";

import base from "./vite.base";


export default mergeConfig(base, {

    build: {

        outDir: "dist/chrome",

        emptyOutDir: false,

        rollupOptions: {

            input: {

                sidebar: path.resolve(
                    __dirname,
                    "../sidebar.html"
                )

            },

            output: {

                entryFileNames: (
                    chunkInfo: PreRenderedChunk
                ) => {

                    if (chunkInfo.name === "background") {
                        return "background.js";
                    }

                    if (chunkInfo.name === "content") {
                        return "content.js";
                    }

                    return "assets/[name].js";
                }

            }

        }

    }

});
