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
    "detail",
    "composition",
    "care",
    "size",
    "color",
]);

export class SemanticTokenRule implements ScoringRule {

    apply(candidate) {

        return candidate.tokens
            .filter(
                token => 
                    IMPORTANT_WORDS.has(token)
            )
            .length * 10;

    }

}