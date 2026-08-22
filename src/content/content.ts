import {
    MessageType
} from "@/messaging/messages";

import {
    startInspection,
    stopInspection,
    setSelectionIndex,
    type InspectionOptions
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

                startInspection(message.payload as InspectionOptions | undefined);

                break;


            case MessageType.STOP_INSPECTION:

                stopInspection();

                break;


            case MessageType.SET_SELECTION_INDEX:

                setSelectionIndex(message.payload as number);

                break;


        }

    }
);