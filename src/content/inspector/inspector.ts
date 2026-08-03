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


let active = false;
let inspectionOptions: { multiResultMode?: boolean } = {};

function mouseMove(
    event: MouseEvent
) {

    const target = event.target as HTMLElement;

    if(target) {
        highlight(target);

    }


}

function click(
    event: MouseEvent
) {

    event.preventDefault();
    event.stopPropagation();

    const target =
        event.target as HTMLElement;

    removeHighlight();

    const context = buildDOMContext(target);

    const pipeline = new SelectorGenerationPipeline();

    const result = pipeline.generate(context, target, inspectionOptions);

    console.log("result == ", result)

    browser.runtime.sendMessage({

        type: MessageType.ELEMENT_SELECTED,

        payload: result

    });

    stopInspection();

}

export function startInspection(
    options: { multiResultMode?: boolean } = {}
) {


    if(active)
        return;

    active = true;
    inspectionOptions = options;

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

export function stopInspection() {

    active = false;

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

}