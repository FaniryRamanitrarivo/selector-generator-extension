import type { AttributeCandidate } from "@/content/analyzer/scoring/attribute-candidature";
import type { SelectorFragment } from "@/content/selector/selector-fragment";

export class FragmentScorer {

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

        return {
            ...fragment,
            resultCount,
            score:
                candidate.score +
                operatorScore +
                uniquenessScore +
                tokenQualityScore +
                stabilityScore
        };
    }

    private countMatches(selector: string): number {
        return document.querySelectorAll(selector).length;
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

        return hasImportantToken ? 0.2 : 0.05;
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
