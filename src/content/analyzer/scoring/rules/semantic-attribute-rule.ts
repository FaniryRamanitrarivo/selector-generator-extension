import type { ScoringRule } from "../scoring-rule";

import type {
    AttributeCandidate
} from "../attribute-candidature";


const IMPORTANT_WORDS = new Set([
    "sku",
    "size",
    "color",
    "product",
    "products",
    "title",
    "name",
    "price",
    "image",
    "images",
    "description",
    "details",
    "detail",
    "information",
    "info",
    "content",
    "main",
    "page",
    "pages",
    "container",
    "composition",
    "care",
    "button",
    "menu",
    "cart",
    "gallery",
    "hero",
    "item",
    "items",
    "category",
    "categories",
    "brand",
    "manufacturer",
    "navigation",
    "header",
    "footer",
    "sidebar",
    "section",
    "summary",
    "overview"
]);

const GENERATED_ID_PATTERNS = [
    /^(css|react|chakra|mui|mantine|ember|vue|next)-/i,
    /^([a-f0-9]{6,}|uuid|random|hash|hashes)$/i,
    /^\d+$/,
    /[0-9]{4,}/
];


export class SemanticAttributeRule
    implements ScoringRule<AttributeCandidate> {


    apply(
        candidate: AttributeCandidate
    ): number {
        const value = candidate.value?.toLowerCase() ?? "";
        const tokens = candidate.tokens ?? [];

        if (!value && !tokens.length) {
            return 0;
        }

        const normalizedTokens = tokens.map(token => token.toLowerCase());
        const score = normalizedTokens.reduce((total, token) => {
            if (GENERATED_ID_PATTERNS.some(pattern => pattern.test(token))) {
                return total - 0.8;
            }

            if (IMPORTANT_WORDS.has(token)) {
                return total + 1.1;
            }

            const containsImportantWord = [...IMPORTANT_WORDS].some(word => token.includes(word));

            if (containsImportantWord) {
                return total + 0.55;
            }

            return total;
        }, 0);

        const valueScore = this.evaluateValue(value);
        const combinedScore = score + valueScore;

        return Math.min(Math.max(combinedScore / 4, 0), 1);
    }

    private evaluateValue(value: string): number {
        if (!value) {
            return 0;
        }

        const normalizedValue = value.toLowerCase();

        if (GENERATED_ID_PATTERNS.some(pattern => pattern.test(normalizedValue))) {
            return -0.8;
        }

        const words = normalizedValue
            .split(/[^a-z0-9]+/)
            .filter(Boolean);

        if (!words.length) {
            return 0;
        }

        let semanticScore = 0;

        for (const word of words) {
            if (IMPORTANT_WORDS.has(word)) {
                semanticScore += 0.75;
                continue;
            }

            const containsImportantWord = [...IMPORTANT_WORDS].some(important => word.includes(important));
            if (containsImportantWord) {
                semanticScore += 0.35;
            }
        }

        return Math.min(semanticScore, 2);
    }

}