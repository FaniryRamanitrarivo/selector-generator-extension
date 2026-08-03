import { extractAttributes } from "./attributes/attribute-extractor";

export interface ElementNodeContext {

    tagname: string;

    attributes: ReturnType<
        typeof extractAttributes
    >;

    // The live DOM node this context was built from. Lets consumers (e.g.
    // ContainerSelector) verify that a selector fragment which is unique on the page
    // (count === 1) actually resolves back to *this* node — a token derived from this
    // node's own attributes can coincidentally also be a unique match elsewhere on the
    // page (e.g. the same "section" class reused site-wide), in which case the single
    // match is the wrong element entirely. Optional so hand-built test fixtures that
    // don't need this check (and mock document.querySelectorAll wholesale) still work.
    element?: HTMLElement;

}

export interface DOMContext {

    element: ElementNodeContext;

    ancestors: ElementNodeContext[];

}

function mapElement(
    element: HTMLElement
): ElementNodeContext {

    return {

        tagname: element.tagName.toLowerCase(),

        attributes: extractAttributes(element),

        element

    };

}

export function buildDOMContext(
    element: HTMLElement
): DOMContext {

    const ancestors: ElementNodeContext[] = [];

    let parent = element.parentElement;
    let parentTagName = parent?.tagName?.toLowerCase() ?? "";

    while(parent && parentTagName != "body") {

        ancestors.push(
            mapElement(parent)
        );

        parent = parent.parentElement;
        parentTagName = parent?.tagName?.toLowerCase() ?? "";

    }

    return {
        element: mapElement(element),
        ancestors
    }

}