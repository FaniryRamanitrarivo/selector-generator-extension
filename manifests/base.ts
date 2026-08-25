import type { ManifestBase } from "./types";

export const baseManifest: ManifestBase = {
    name: "Selector Generator",
    version: "0.1.0",
    description: "Click any element on a page to generate a robust, readable CSS selector for it.",

    icons: {
        "16": "icons/icon-16.png",
        "32": "icons/icon-32.png",
        "48": "icons/icon-48.png",
        "128": "icons/icon-128.png"
    },

    permissions: [
        "storage",
        "activeTab"
    ],

    host_permissions: [
        "<all_urls>"
    ]
};