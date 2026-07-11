import type {
    ExtensionMessage
} from "./messages";


export function sendMessage<T>(
    message: ExtensionMessage<T>
) {

    return browser.runtime.sendMessage(
        message
    );

}