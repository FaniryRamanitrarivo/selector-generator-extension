import type { AttributeCandidate } from "@/content/analyzer/scoring/attribute-candidature";
import type { SelectorFragment } from "@/content/selector/selector-fragment";
import { clampScore, SCORING_WEIGHTS } from "@/content/scoring/scoring-config";

export class FragmentScorer {

    private readonly matchCache = new Map<string, number>();

    score(
        fragment: SelectorFragment,
        candidate: AttributeCandidate,
        tagName?: string
    ): SelectorFragment {

        const resultCount = this.countMatches(fragment.selector);

        const operatorScore = this.getOperatorScore(fragment.operator);
        const uniquenessScore = this.getUniquenessScore(resultCount);
        const tokenQualityScore = this.getTokenQualityScore(candidate, fragment);
        const stabilityScore = this.getStabilityScore(resultCount, fragment.operator, tagName);
        const semanticScore = this.getSemanticScore(candidate, fragment);
        const tagScore = this.getTagScore(tagName);

        const score = clampScore(
            candidate.score * 0.2 +
            operatorScore * 0.22 +
            uniquenessScore * 0.24 +
            tokenQualityScore * 0.14 +
            stabilityScore * 0.12 +
            semanticScore * 0.08 +
            tagScore * 0.06
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

        const count = document.querySelectorAll(selector).length;
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

    private getUniquenessScore(resultCount: number): number {
        if (resultCount === 0) {
            return -0.8;
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
        const importantWords = [
            "product",
            "products",
            "main",
            "content",
            "page",
            "pages",
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
            "menu",
            "navigation",
            "header",
            "footer",
            "sidebar",
            "category",
            "brand",
            "manufacturer",
            "section",
            "summary"
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

    private getStabilityScore(
        resultCount: number,
        operator?: SelectorFragment["operator"],
        tagName?: string
    ): number {
        if (resultCount === 0) {
            return -0.6;
        }

        if (resultCount === 1) {
            return 0.25;
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
