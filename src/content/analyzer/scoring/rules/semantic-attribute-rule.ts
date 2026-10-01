import type { ScoringRule } from "../scoring-rule";

import type {
    AttributeCandidate
} from "../attribute-candidature";

import { isGeneratedLikeToken } from "@/content/analyzer/attributes/generated-token";
import { getBestContainedTier, getSemanticTier, isSignificantToken } from "@/content/analyzer/attributes/semantic-vocabulary";

export class SemanticAttributeRule
    implements ScoringRule<AttributeCandidate> {

    // Whether a single token is, on its own, a business/content-specific word
    // (tier 3 — as opposed to a generic tier-1 layout term, a vaguer tier-2
    // contextual word, or an unrecognized one). Used by ContainerSelector to
    // decide whether a fragment matching only this token may still borrow
    // semantic credit from sibling tokens on the same attribute that don't
    // actually appear in that fragment's selector text.
    isSignificantToken(token: string): boolean {
        return isSignificantToken(token);
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

            const tier = getSemanticTier(token);

            if (tier === 3) {
                return total + 1.1;
            }

            if (tier === 2) {
                return total + 0.4;
            }

            // tier === 1 (generic/structural) carries no bonus of its own here —
            // see SEMANTIC_VOCABULARY's tier-1 doc comment: matching one alone
            // must not be a strong signal.

            const containedTier = getBestContainedTier(token);

            if (containedTier === 3) {
                return total + 0.55;
            }

            if (containedTier === 2) {
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
            const tier = getSemanticTier(word);

            if (tier === 3) {
                semanticScore += 0.75;
                continue;
            }

            if (tier === 2) {
                semanticScore += 0.25;
                continue;
            }

            const containedTier = getBestContainedTier(word);

            if (containedTier === 3) {
                semanticScore += 0.35;
                continue;
            }

            if (containedTier === 2) {
                semanticScore += 0.12;
            }
        }

        return Math.min(semanticScore, 2);
    }

}