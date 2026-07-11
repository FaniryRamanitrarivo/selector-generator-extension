import {
    MessageType
} from "@/messaging/messages";


console.log(
    "Content script loaded"
);


browser.runtime.onMessage.addListener(
    (
        message
    ) => {


        if(
            message.type === MessageType.START_INSPECTION
        ) {

            console.log(
                "Inspection started"
            );

        }

    }
);