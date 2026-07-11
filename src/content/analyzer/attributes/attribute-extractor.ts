import {
    ATTRIBUTE_CATEGORIES,
    type AttributeCategory
} from "./attribute-category";
import { shouldTokenize, tokenizeAttribute } from "./attribute-tokenizer";

export interface DOMAttribute {

    name: string;

    category: AttributeCategory;

    rawValue: string;

    values: string[];

    tokens: string[];

}

const IGNORED_ATTRIBUTES = new Set([
    "style",
    "onclick",
    "onchange",
    "onload"
]);

export function extractAttributes(
    element: HTMLElement
): DOMAttribute[] {

    return Array
        .from(element.attributes)
        .filter(attribute =>
            !IGNORED_ATTRIBUTES.has(attribute.name)
        )
        .map(attribute => {

            const values = splitValues(
                attribute.name,
                attribute.value
            );

            const category = getCategory(attribute.name);
            
            const tokens = shouldTokenize(category)
                ? [...new Set(values.flatMap(tokenizeAttribute))]
                : [];

            return {

                name: attribute.name,

                category,

                rawValue: attribute.value,

                values,

                tokens

            };

        });

}

function getCategory(
    name: string
): AttributeCategory {

    if (name === "id")
        return ATTRIBUTE_CATEGORIES.ID;

    if (name === "class")
        return ATTRIBUTE_CATEGORIES.CLASS;

    if (name.startsWith("data-"))
        return ATTRIBUTE_CATEGORIES.DATA;

    if (name.startsWith("aria-"))
        return ATTRIBUTE_CATEGORIES.ARIA;

    if (name === "href")
        return ATTRIBUTE_CATEGORIES.HREF;

    if (name === "src")
        return ATTRIBUTE_CATEGORIES.SRC;

    if (name === "name")
        return ATTRIBUTE_CATEGORIES.NAME;

    if (name === "role")
        return ATTRIBUTE_CATEGORIES.ROLE;

    if (name === "alt")
        return ATTRIBUTE_CATEGORIES.ALT;

    if (name === "title")
        return ATTRIBUTE_CATEGORIES.TITLE;

    return ATTRIBUTE_CATEGORIES.OTHER;

}

function splitValues(
    name: string,
    value: string
): string[] {

    if (name === "class") {

        return value
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    }

    return [value];

}