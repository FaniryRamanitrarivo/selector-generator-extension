import {
    MessageType
} from "@/messaging/messages";

import {
    sendMessage
} from "@/messaging/messenger";


export default function App() {


    function startInspection() {

        sendMessage({
            type: MessageType.START_INSPECTION
        });

    }


    return (
        <main>
            <h1>Here is the start</h1>
            <button
                onClick={startInspection}
            >
                Inspect
            </button>
        </main>
    );
}