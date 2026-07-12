import {
    useEffect,
    useState
} from "react";


import {
    MessageType
} from "@/messaging/messages";


import {
    sendMessage
} from "@/messaging/messenger";


export default function App() {


    const [selector, setSelector] =
        useState<string>("");


    function startInspection() {

        sendMessage({
            type: MessageType.START_INSPECTION
        });

    }


    useEffect(() => {


        browser.runtime.onMessage.addListener(
            (
                message
            ) => {


                if(
                    message.type === MessageType.ELEMENT_SELECTED
                ) {


                    const result =
                        message.payload?.[0];


                    if(result) {

                        setSelector(
                            result.selector
                        );

                    }

                }

            }
        );


    }, []);



    return (
        <main>

            <h1>
                Selector Generator
            </h1>


            <button
                onClick={startInspection}
            >
                Inspect
            </button>


            {
                selector && (

                    <section>

                        <h2>
                            Generated selector
                        </h2>


                        <code>
                            {selector}
                        </code>

                    </section>

                )
            }


        </main>
    );

}