import { baseManifest } from "./base";


export default {
    ...baseManifest,

    manifest_version: 2,

    background: {
        scripts: [
            "background.js"
        ]
    },

    browser_action: {
        default_title: "Selector Generator"
    },

    sidebar_action: {
        default_title: "Selector Generator",
        default_panel: "sidebar.html"
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