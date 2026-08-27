import type { ScoringRule } from "../scoring-rule";

import type {
    AttributeCandidate
} from "../attribute-candidature";

import { isGeneratedLikeToken } from "@/content/analyzer/attributes/generated-token";


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
    "sidebar"
]);

// Generic layout/wrapper words: they show up on almost any container div
// (class="content-wrapper", class="page-container", ...) without identifying
// a specific logical section, so unlike IMPORTANT_WORDS they must not be
// able to single-handedly clear CONTAINER_SEMANTIC_THRESHOLD on their own —
// otherwise the nearest such wrapper up the ancestor chain hijacks container
// selection before a farther-but-actually-specific ancestor (or a 2-attribute
// combination, see ContainerSelector.selectWithCombinedFragments) is ever
// tried. Kept as a *weaker* signal rather than dropped entirely: paired with
// a real IMPORTANT_WORDS token (e.g. "product content") they still add up to
// a legitimate section boundary.
const STRUCTURAL_WORDS = new Set([
    "content",
    "main",
    "page",
    "pages",
    "container",
    "section",
    "summary",
    "overview"
]);

export class SemanticAttributeRule
    implements ScoringRule<AttributeCandidate> {

    // Whether a single token is, on its own, a business/content-specific word
    // (as opposed to a generic STRUCTURAL_WORDS layout term or an unrecognized
    // one). Used by ContainerSelector to decide whether a fragment matching
    // only this token may still borrow semantic credit from sibling tokens on
    // the same attribute that don't actually appear in that fragment's
    // selector text.
    isSignificantToken(token: string): boolean {
        return IMPORTANT_WORDS.has(token.toLowerCase());
    }

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
            if (isGeneratedLikeToken(token)) {
                return total - 0.8;
            }

            if (IMPORTANT_WORDS.has(token)) {
                return total + 1.1;
            }

            if (STRUCTURAL_WORDS.has(token)) {
                return total + 0.4;
            }

            const containsImportantWord = [...IMPORTANT_WORDS].some(word => token.includes(word));

            if (containsImportantWord) {
                return total + 0.55;
            }

            const containsStructuralWord = [...STRUCTURAL_WORDS].some(word => token.includes(word));

            if (containsStructuralWord) {
                return total + 0.2;
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

        if (isGeneratedLikeToken(normalizedValue)) {
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

            if (STRUCTURAL_WORDS.has(word)) {
                semanticScore += 0.25;
                continue;
            }

            const containsImportantWord = [...IMPORTANT_WORDS].some(important => word.includes(important));
            if (containsImportantWord) {
                semanticScore += 0.35;
                continue;
            }

            const containsStructuralWord = [...STRUCTURAL_WORDS].some(structural => word.includes(structural));
            if (containsStructuralWord) {
                semanticScore += 0.12;
            }
        }

        return Math.min(semanticScore, 2);
    }

}