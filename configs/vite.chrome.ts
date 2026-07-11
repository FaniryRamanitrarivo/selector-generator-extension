import { mergeConfig } from "vite";

import base from "./vite.base";

export default mergeConfig(base, {
    build: {
        outDir: "dist/chrome"
    }
});