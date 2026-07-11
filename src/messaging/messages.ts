export const MessageType = {

    START_INSPECTION: "START_INSPECTION",

    STOP_INSPECTION: "STOP_INSPECTION",

    ELEMENT_SELECTED: "ELEMENT_SELECTED"

} as const;


export type MessageType =
    typeof MessageType[keyof typeof MessageType];


export interface ExtensionMessage<T = unknown> {

    type: MessageType;

    payload?: T;

}