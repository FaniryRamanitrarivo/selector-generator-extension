import {
    highlight,
    removeHighlight
} from "./highlighter";

import {
    buildDOMContext
} from "../analyzer/dom-context";


import {
    SelectorGenerationPipeline
} from "../selector/pipeline/selector-generation-pipeline";


import {
    MessageType
} from "@/messaging/messages";


export type InspectionOptions = { multiResultMode?: boolean; devMode?: boolean };

// Lightweight, serializable stand-in for an HTMLElement — the sidebar lives
// in a separate JS context and can't hold a live DOM reference, so this is
// what actually crosses the messaging boundary (see broadcastSelection).
export interface SelectionNode {
    tagName: string;
    id?: string;
    classes: string[];
}

export interface SelectionState {
    // Nearest-first, same order/indexing as selectionPath: path[0] is the
    // originally clicked element, path[path.length - 1] is <body>.
    path: SelectionNode[];
    index: number;
}

let active = false;
let inspectionOptions: InspectionOptions = {};

// Ancestor chain (nearest-first, [0] = the element originally clicked) built
// the moment the user clicks — lets ArrowUp/ArrowDown walk it afterwards to
// adjust the pick (e.g. the click landed on an inner <div> but the user
// actually wants the wrapping <h1>) without any way to express that through
// the mouse alone. Empty while just hovering (mode not yet entered).
let selectionPath: HTMLElement[] = [];
let selectionIndex = 0;

function mouseMove(
    event: MouseEvent
) {

    const target = event.target as HTMLElement;

    if(target) {
        highlight(target);

    }


}

function buildSelectionPath(
    target: HTMLElement
): HTMLElement[] {

    const path: HTMLElement[] = [target];
    let current: HTMLElement | null = target;

    // Stops at <body> (inclusive) — matches DOMContext's own ancestor
    // cutoff, and going further up to <html>/document is never a
    // meaningful selection target.
    while (current && current !== document.body) {

        current = current.parentElement;

        if (current) {
            path.push(current);
        }

    }

    return path;

}

function describeSelection(): string {

    const element = selectionPath[selectionIndex];
    const hints: string[] = [];

    if (selectionIndex < selectionPath.length - 1) {
        hints.push("↑ parent");
    }

    if (selectionIndex > 0) {
        hints.push("↓ enfant");
    }

    hints.push("↵ valider", "esc annuler");

    return `${element.tagName.toLowerCase()} · ${hints.join(" · ")}`;

}

function toSelectionNode(element: HTMLElement): SelectionNode {
    return {
        tagName: element.tagName.toLowerCase(),
        id: element.id || undefined,
        classes: Array.from(element.classList)
    };
}

// Only ever called from the dev-mode adjustment path (updateSelectionHighlight),
// so the sidebar's breadcrumb view naturally stays empty outside dev mode.
function broadcastSelection() {

    browser.runtime.sendMessage({

        type: MessageType.SELECTION_CHANGED,

        payload: {
            path: selectionPath.map(toSelectionNode),
            index: selectionIndex
        } satisfies SelectionState

    });

}

function updateSelectionHighlight() {
    highlight(selectionPath[selectionIndex], describeSelection());
    broadcastSelection();
}

// Invoked when the sidebar's breadcrumb view is clicked — lets the user jump
// straight to an ancestor instead of repeatedly pressing ArrowUp/ArrowDown.
export function setSelectionIndex(index: number) {

    if (!selectionPath.length) {
        return;
    }

    if (index < 0 || index >= selectionPath.length) {
        return;
    }

    selectionIndex = index;
    updateSelectionHighlight();

}

function confirmSelection() {

    const target = selectionPath[selectionIndex];

    removeHighlight();

    const context = buildDOMContext(target);

    const pipeline = new SelectorGenerationPipeline();

    const result = pipeline.generate(context, target, inspectionOptions);

    browser.runtime.sendMessage({

        type: MessageType.ELEMENT_SELECTED,

        payload: result

    });

    stopInspection();

}

function click(
    event: MouseEvent
) {

    event.preventDefault();
    event.stopPropagation();

    if (selectionPath.length > 0) {

        // Already adjusting: the mouse position no longer drives the
        // highlight once arrow-key adjustment has started, so any further
        // click confirms whatever is currently highlighted rather than
        // re-targeting under the cursor.
        confirmSelection();
        return;

    }

    const target =
        event.target as HTMLElement;

    // Arrow-key adjustment requires knowing the DOM well enough to pick a
    // meaningful ancestor over the exact element under the cursor — a
    // non-dev user has no way to make that call, so outside dev mode a
    // click confirms the clicked element immediately, as before.
    if (!inspectionOptions.devMode) {
        selectionPath = [target];
        selectionIndex = 0;
        confirmSelection();
        return;
    }

    selectionPath = buildSelectionPath(target);
    selectionIndex = 0;

    document.removeEventListener(
        "mousemove",
        mouseMove,
        true
    );

    document.addEventListener(
        "keydown",
        keyDown,
        true
    );

    updateSelectionHighlight();

}

function keyDown(
    event: KeyboardEvent
) {

    switch (event.key) {

        case "ArrowUp":
            event.preventDefault();
            if (selectionIndex < selectionPath.length - 1) {
                selectionIndex++;
                updateSelectionHighlight();
            }
            break;

        case "ArrowDown":
            event.preventDefault();
            if (selectionIndex > 0) {
                selectionIndex--;
                updateSelectionHighlight();
            }
            break;

        case "Enter":
            event.preventDefault();
            confirmSelection();
            break;

        case "Escape":
            event.preventDefault();
            // Stopping here is the content script's own initiative, not the
            // sidebar's (that's STOP_INSPECTION) nor a successful pick
            // (that's ELEMENT_SELECTED) — the sidebar has no other way to
            // learn about it, so it must be told explicitly.
            stopInspection(true);
            break;

    }

}

export function startInspection(
    options: InspectionOptions = {}
) {


    if(active)
        return;

    active = true;
    inspectionOptions = options;
    selectionPath = [];
    selectionIndex = 0;

    document.addEventListener(
        "mousemove",
        mouseMove,
        true
    );

    document.addEventListener(
        "click",
        click,
        true
    );

}

export function stopInspection(
    notifyCancelled = false
) {

    const wasActive = active;

    active = false;
    selectionPath = [];
    selectionIndex = 0;

    removeHighlight();

    document.removeEventListener(
        "mousemove",
        mouseMove,
        true
    );

    document.removeEventListener(
        "click",
        click,
        true
    );

    document.removeEventListener(
        "keydown",
        keyDown,
        true
    );

    if (notifyCancelled && wasActive) {
        browser.runtime.sendMessage({
            type: MessageType.INSPECTION_CANCELLED
        });
    }

}
