import {
    MessageType
} from "@/messaging/messages";


console.log(
    "Background loaded"
);


// Chrome (MV3) has no equivalent of Firefox's sidebar_action, which opens
// automatically on toolbar-icon click — chrome.sidePanel requires opting in
// explicitly, or clicking the action does nothing. This API doesn't exist on
// Firefox, so it's guarded at runtime rather than split into a per-browser
// background entry (both browsers currently build from this same file).
if (typeof chrome !== "undefined" && chrome.sidePanel) {

    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch(error => console.error("Failed to set side panel behavior:", error));

}


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