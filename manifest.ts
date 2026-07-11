import { defineManifest } from "@crxjs/vite-plugin";


export default defineManifest({
    manifest_version: 3,

    name: "Selector Generator",

    version: "0.1.0",

    description:
        "Generate robust CSS and XPath selectors.",

    background: {
        service_worker:
            "src/extension/background/background.ts"
    },

    content_scripts: [
        {
            matches: [
                "<all_urls>"
            ],

            js: [
                "src/extension/content/content.ts"
            ],

            run_at:
                "document_idle"
        }
    ],

    permissions: [
        "activeTab",
        "storage",
        "scripting"
    ],

    host_permissions: [
        "<all_urls>"
    ],

    action: {
        default_title:
            "Selector Generator"
    }
});