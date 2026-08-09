import {
    MessageType
} from "@/messaging/messages";


console.log(
    "Background loaded"
);


browser.runtime.onMessage.addListener(
    async (
        message
    ) => {

        switch(message.type) {


            case MessageType.START_INSPECTION: {

                const tabs =
                    await browser.tabs.query({
                        active: true,
                        currentWindow: true
                    });


                const tab = tabs[0];


                if(!tab.id) {
                    return;
                }


                await browser.tabs.sendMessage(
                    tab.id,
                    message
                );

                break;

            }


            case MessageType.ELEMENT_SELECTED:

                await browser.runtime.sendMessage(
                    message
                );

                break;

        }

    }
);