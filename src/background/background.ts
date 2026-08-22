import {
    MessageType
} from "@/messaging/messages";


console.log(
    "Background loaded"
);


async function relayToActiveTab(
    message: unknown
) {

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

}


browser.runtime.onMessage.addListener(
    async (
        message
    ) => {

        switch(message.type) {


            case MessageType.START_INSPECTION:

                await relayToActiveTab(message);

                break;


            case MessageType.SET_SELECTION_INDEX:

                await relayToActiveTab(message);

                break;


            case MessageType.ELEMENT_SELECTED:

                await browser.runtime.sendMessage(
                    message
                );

                break;


            case MessageType.SELECTION_CHANGED:

                await browser.runtime.sendMessage(
                    message
                );

                break;


            case MessageType.INSPECTION_CANCELLED:

                await browser.runtime.sendMessage(
                    message
                );

                break;


            case MessageType.INSPECTION_ERROR:

                await browser.runtime.sendMessage(
                    message
                );

                break;

        }

    }
);