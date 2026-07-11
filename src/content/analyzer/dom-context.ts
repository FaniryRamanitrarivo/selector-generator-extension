import { extractAttributes } from "./attributes/attribute-extractor";

export interface ElementNodeContext {

    tagname: string;

    attributes: ReturnType<
        typeof extractAttributes
    >;

}

export interface DOMContext {

    element: ElementNodeContext;

    ancestors: ElementNodeContext[];

}

function mapElement(
    element: HTMLElement
) {

    return {

        tagname: element.tagName.toLowerCase(),

        attributes: extractAttributes(element)

    };

}

export function buildDOMContext(
    element: HTMLElement,
    maxDepth = 5
): DOMContext {

    const ancestors: ElementNodeContext[] = [];

    let parent = element.parentElement;

    let depth = 0;

    while(parent && depth < maxDepth) {

        ancestors.push(
            mapElement(parent)
        );

        parent = parent.parentElement;

        depth++;

    }

    return {
        element: mapElement(element),
        ancestors
    }

}