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