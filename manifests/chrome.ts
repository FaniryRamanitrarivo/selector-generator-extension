import { baseManifest } from "./base";

export default {
    ...baseManifest,

    manifest_version: 3,

    background: {
        service_worker: "background.js"
    },

    action: {
        default_title: "Selector Generator"
    }
};