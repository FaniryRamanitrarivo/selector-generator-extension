import {
    highlight,
    removeHighlight
} from "./highlighter";


let active = false;

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

    console.log(
        "Selected element",
        target
    );

    stopInspection();

}

export function startInspection() {

    if(active) 
        return;

    active = true;

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