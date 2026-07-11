import {
    buildDOMContext
} from "./dom-context";

import type {
    DOMContext
} from "./dom-context";

export function analyzeElement(
    element: HTMLElement
): DOMContext {

    return buildDOMContext(
        element
    );

}