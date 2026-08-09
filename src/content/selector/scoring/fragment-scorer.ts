import type { AttributeCandidate } from "@/content/analyzer/scoring/attribute-candidature";
import type { SelectorFragment } from "@/content/selector/selector-fragment";
import { clampScore } from "@/content/scoring/scoring-config";

export class FragmentScorer {

    private readonly matchCache = new Map<string, number>();

    score(
        fragment: SelectorFragment,
        candidate: AttributeCandidate,
        tagName?: string,
        multiResultMode = false
    ): SelectorFragment {

        const resultCount = this.countMatches(fragment.selector);

        const operatorScore = this.getOperatorScore(fragment.operator);
        const uniquenessScore = this.getUniquenessScore(resultCount, multiResultMode);
        const tokenQualityScore = this.getTokenQualityScore(candidate, fragment);
        const stabilityScore = this.getStabilityScore(resultCount, fragment.operator, tagName, multiResultMode);
        const semanticScore = this.getSemanticScore(candidate, fragment);
        const tagScore = this.getTagScore(tagName);
        const concisionScore = this.getConcisionScore(fragment);

        const score = clampScore(
            candidate.score * 0.2 +
            operatorScore * 0.22 +
            uniquenessScore * 0.24 +
            tokenQualityScore * 0.14 +
            stabilityScore * 0.12 +
            semanticScore * 0.08 +
            tagScore * 0.06 +
            concisionScore * 0.1
        );

        return {
            ...fragment,
            resultCount,
            score
        };
    }

    private countMatches(selector: string): number {
        const cached = this.matchCache.get(selector);

        if (cached !== undefined) {
            return cached;
        }

        let count: number;
        try {
            count = document.querySelectorAll(selector).length;
        } catch {
            count = 0;
        }

        this.matchCache.set(selector, count);

        return count;
    }

    private getOperatorScore(operator?: SelectorFragment["operator"]): number {
        switch (operator) {
            case "exact":
                return 1.2;
            case "contains":
                return 0.9;
            case "containsWord":
                return 0.8;
            case "startsWith":
                return 0.7;
            case "endsWith":
                return 0.6;
            default:
                return 0.4;
        }
    }

    private getUniquenessScore(resultCount: number, multiResultMode: boolean): number {
        if (resultCount === 0) {
            return -0.8;
        }

        // In multi-result mode the goal is to match *several* elements, so this is the
        // mirror image of the single-target scoring below: count === 1 is the worst
        // outcome (it defeats the point), and among count > 1, a tighter group (fewer
        // matches) beats an overly broad one. Without this, the fragment-candidate cut
        // that happens here — before SelectorCountNormalizer ever runs — would keep
        // discarding the shared, multi-matching fragments a "select all X" selector
        // actually needs, in favor of accidentally-unique ones.
        if (multiResultMode) {
            if (resultCount === 1) {
                return 0.1;
            }

            if (resultCount < 20) {
                return 0.85;
            }

            if (resultCount < 50) {
                return 0.5;
            }

            return 0.25;
        }

        if (resultCount === 1) {
            return 0.9;
        }

        if (resultCount < 5) {
            return 0.5;
        }

        if (resultCount < 20) {
            return 0.2;
        }

        return 0.05;
    }

    private getTokenQualityScore(
        candidate: AttributeCandidate,
        fragment: SelectorFragment
    ): number {
        if (!candidate.tokens.length || !fragment.token) {
            return 0;
        }

        const token = fragment.token.toLowerCase();

        const hasImportantToken = candidate.tokens.some(currentToken => {
            const normalized = currentToken.toLowerCase();
            return normalized === token || normalized.includes(token);
        });

        return hasImportantToken ? 0.3 : 0.05;
    }

    private getSemanticScore(
        candidate: AttributeCandidate,
        fragment: SelectorFragment
    ): number {
        if (!fragment.token) {
            return 0;
        }

        const token = fragment.token.toLowerCase();
        // Deliberately excludes generic/structural words (page, main, section,
        // header, footer, sidebar, navigation, menu, ...) — those describe DOM
        // structure, not business meaning, and already get their own bonus via
        // getTagScore() when the element's actual tag is structural. Keeping them
        // out here means a genuinely descriptive-but-longer token (e.g.
        // "informations") isn't out-scored by a same-weight generic-but-shorter
        // one (e.g. "page") once getConcisionScore() favors brevity.
        const importantWords = [
            "product",
            "products",
            "content",
            "title",
            "description",
            "detail",
            "details",
            "information",
            "info",
            "price",
            "image",
            "images",
            "gallery",
            "composition",
            "cart",
            "category",
            "brand",
            "manufacturer",
            "summary",
            "size",
            "taille",
            "talla",
            "color",
            "colour",
            "couleur"
        ];

        if (importantWords.some(word => token === word || token.includes(word))) {
            return 0.35;
        }

        if (candidate.value?.toLowerCase().includes(token)) {
            return 0.15;
        }

        return 0;
    }

    private getTagScore(tagName?: string): number {
        if (!tagName) {
            return 0;
        }

        switch (tagName.toLowerCase()) {
            case "main":
            case "section":
            case "article":
            case "nav":
            case "header":
            case "footer":
            case "aside":
                return 0.15;
            default:
                return 0;
        }
    }

    private getConcisionScore(fragment: SelectorFragment): number {
        // Rewards shorter CSS fragment strings so that, between two fragments
        // reaching the same uniqueness/precision (e.g. an exact-value match vs a
        // shorter per-token contains match), the shorter one wins on tie-break.
        const MIN_LENGTH = 12;
        const MAX_LENGTH = 40;
        const length = fragment.selector.length;

        if (length <= MIN_LENGTH) return 1;
        if (length >= MAX_LENGTH) return 0;

        return 1 - (length - MIN_LENGTH) / (MAX_LENGTH - MIN_LENGTH);
    }

    private getStabilityScore(
        resultCount: number,
        operator?: SelectorFragment["operator"],
        tagName?: string,
        multiResultMode = false
    ): number {
        if (resultCount === 0) {
            return -0.6;
        }

        // Same flip as getUniquenessScore: a count-of-1 fragment isn't inherently more
        // "stable" than a shared one when the goal is matching a group.
        if (resultCount === 1) {
            return multiResultMode ? 0.05 : 0.25;
        }

        if (operator === "exact") {
            return 0.1;
        }

        if (tagName && ["main", "article", "section"].includes(tagName.toLowerCase())) {
            return 0.15;
        }

        return 0.05;
    }
}
