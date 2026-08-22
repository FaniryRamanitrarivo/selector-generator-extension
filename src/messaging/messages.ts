export const MessageType = {

    START_INSPECTION: "START_INSPECTION",

    STOP_INSPECTION: "STOP_INSPECTION",

    ELEMENT_SELECTED: "ELEMENT_SELECTED",

    // Dev-mode only: content script -> sidebar, sent whenever the
    // arrow-key-adjustable selection (see inspector.ts) changes.
    SELECTION_CHANGED: "SELECTION_CHANGED",

    // Dev-mode only: sidebar -> content script, sent when the user clicks a
    // node in the sidebar's breadcrumb view instead of using arrow keys.
    SET_SELECTION_INDEX: "SET_SELECTION_INDEX",

    // content script -> sidebar, sent only when inspection stops on its own
    // initiative (currently: Escape during dev-mode adjustment) rather than
    // because the sidebar asked it to (STOP_INSPECTION) or because it
    // already sent ELEMENT_SELECTED — those two cases keep the sidebar in
    // sync by construction, so re-announcing them here would be redundant.
    INSPECTION_CANCELLED: "INSPECTION_CANCELLED",

    // content script -> sidebar, sent instead of ELEMENT_SELECTED when
    // SelectorGenerationPipeline throws (payload: an error message string) —
    // without this, an exception on some edge-case DOM left the sidebar
    // stuck showing "waiting for a click" forever, with no signal that
    // anything went wrong.
    INSPECTION_ERROR: "INSPECTION_ERROR"

} as const;


export type MessageType =
    typeof MessageType[keyof typeof MessageType];


export interface ExtensionMessage<T = unknown> {

    type: MessageType;

    payload?: T;

}