export const SCORING_WEIGHTS = {
    // Per-rule weights consumed directly by AttributeScorer's rule list (see
    // SelectorGenerationPipeline's constructor) — these drive how CategoryRule,
    // SemanticAttributeRule and TagNameRule combine into one attribute score.
    attribute: {
        category: 50,
        semantic: 40,
        tagName: 20
    },
    fragment: {
        inheritedCandidate: 0.3,
        operator: 0.18,
        uniqueness: 0.18,
        tokenQuality: 0.12,
        stability: 0.1,
        semantic: 0.08,
        tagContext: 0.04,
        concision: 0.1,
        // Page-wide rarity of the fragment's token (see token-frequency.ts) — a
        // domain-agnostic complement to the curated `semantic` signal above, which
        // only recognizes words in semantic-vocabulary.ts.
        rarity: 0.1
    },
    selector: {
        readability: 0.18,
        concision: 0.12,
        precision: 0.20,
        uniqueness: 0.34,
        length: 0.08,
        rules: 0.08,
    },
    selectorScoreRanges: {
        readability: 1.4,
        concision: 1,
        precision: 1,
        uniqueness: 1,
        length: 1,
        rules: 1
    },
    countNormalization: {
        singleResult: 1,
        multiResult: 0.25,
        // multiResultMode: a selector matching exactly 1 element misses the point (the goal
        // is to select several), so it's floored below every count > 1. Among count > 1
        // selectors, fewer matches is better (tighter, more precise group) — see
        // SelectorCountNormalizer.getMultiResultCountScore for how these combine.
        multiResultSingleMatchFloor: 0.1,
        multiResultMatchRange: 0.9
    }
} as const;

export function clampScore(value: number): number {
    return Math.min(1, Math.max(0, value));
}

export function normalizeWeightedScore(total: number, totalWeight: number): number {
    return totalWeight > 0 ? clampScore(total / totalWeight) : 0;
}
