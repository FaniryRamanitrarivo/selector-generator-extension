import {
    MessageType
} from "@/messaging/messages";

import {
    startInspection
} from "./inspector/inspector";


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