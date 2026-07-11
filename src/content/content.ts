import {
    MessageType
} from "@/messaging/messages";

import {
    startInspection
} from "./inspector/inspector";

import {
    buildDOMContext
} from "./analyzer/dom-context";


import {
    SelectorGenerationPipeline
} from "./selector/pipeline/selector-generation-pipeline";



console.log(
    "Content loaded"
);


browser.runtime.onMessage.addListener(
    (
        message
    ) => {


        switch(message.type) {


            case MessageType.START_INSPECTION:

                startInspection();

                break;


        }

    }
);