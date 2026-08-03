import {
    MessageType
} from "@/messaging/messages";

import {
    startInspection,
    stopInspection
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

                startInspection(message.payload as { multiResultMode?: boolean } | undefined);

                break;


            case MessageType.STOP_INSPECTION:

                stopInspection();

                break;


        }

    }
);