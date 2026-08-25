import { baseManifest } from "./base";

export default {
    ...baseManifest,

    manifest_version: 3,

    permissions: [
        ...(baseManifest.permissions ?? []),
        "sidePanel"
    ],

    background: {
        service_worker: "background.js"
    },

    action: {
        default_title: "Selector Generator",
        default_icon: baseManifest.icons
    },

    side_panel: {
        default_path: "sidebar.html"
    },

    content_scripts: [
        {
            matches: [
                "<all_urls>"
            ],

            js: [
                "content.js"
            ],

            run_at: "document_idle"
        }
    ]
};
