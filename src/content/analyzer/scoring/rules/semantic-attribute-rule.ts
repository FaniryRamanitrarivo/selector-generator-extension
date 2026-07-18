import type { ScoringRule } from "../scoring-rule";

const IMPORTANT_WORDS = new Set([
    "product",
    "title",
    "name",
    "price",
    "image",
    "description",
    "main",
    "content",
    "container",
    "info",
    "detail",
    "composition",
    "care",
    "size",
    "color",
]);

export class SemanticAttributeRule implements ScoringRule {

    apply(candidate): number {

        const score = candidate.tokens.reduce(
            (total, token) => {

                if (IMPORTANT_WORDS.has(token)) {
                    return total + 1;
                }

                const containsImportantWord =
                    [...IMPORTANT_WORDS].some(
                        word => token.includes(word)
                    );

                if (containsImportantWord) {
                    return total + 0.5;
                }

                return total;

            },
            0
        );


        // normalisation
        return Math.min(
            score / 3,
            1
        );

    }

}