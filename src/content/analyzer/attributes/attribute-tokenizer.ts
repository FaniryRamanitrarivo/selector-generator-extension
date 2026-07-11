import {
    ATTRIBUTE_CATEGORIES,
    type AttributeCategory
} from "./attribute-category";

export function shouldTokenize(
    category: AttributeCategory
): boolean {

    switch (category) {

        case ATTRIBUTE_CATEGORIES.ID:
        case ATTRIBUTE_CATEGORIES.CLASS:
        case ATTRIBUTE_CATEGORIES.DATA:
        case ATTRIBUTE_CATEGORIES.ARIA:
        case ATTRIBUTE_CATEGORIES.NAME:
            return true;

        default:
            return false;

    }

}

export function tokenizeAttribute(
    value: string
): string[] {

    const normalized = value

        // productTitle -> product Title
        .replace(/([a-z])([A-Z])/g, "$1 $2")

        // product123 -> product 123
        .replace(/([a-zA-Z])(\d)/g, "$1 $2")

        // 123Product -> 123 Product
        .replace(/(\d)([a-zA-Z])/g, "$1 $2")

        // -, _, ., : deviennent des espaces
        .replace(/[-_.:]+/g, " ")

        .toLowerCase();

    return [
        ...new Set(
            normalized
                .split(/\s+/)
                .map(token => token.trim())
                .filter(Boolean)
        )
    ];

}