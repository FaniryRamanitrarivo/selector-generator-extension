import type { ManifestBase } from "./types";

export const baseManifest: ManifestBase = {
    name: "Selector Generator",
    version: "0.1.0",
    description: "Generate robust CSS and XPath selectors.",

    permissions: [
        "storage",
        "activeTab"
    ],

    host_permissions: [
        "<all_urls>"
    ]
};