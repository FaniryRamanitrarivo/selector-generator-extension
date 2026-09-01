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

// Tokens shorter than this are dropped rather than turned into selector candidates.
// Utility-CSS frameworks (Tailwind, etc.) pack class lists with short hyphenated
// fragments like "p-4", "mt-2", "sm", "bg" — splitting on "-"/"_" alone (see below)
// turns each one into its own token, and with no length floor those meaningless
// 1-2 character tokens end up scored and validated exactly like real words, which
// is both how unreadable fragments (e.g. [class*="p"]) get generated and a big
// source of the combinatorial blowup in ContainerSelector's fallback pass (each
// extra token is more candidates × more querySelectorAll validations).
const MIN_TOKEN_LENGTH = 3;

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
                .filter(token => token.length >= MIN_TOKEN_LENGTH)
        )
    ];

}