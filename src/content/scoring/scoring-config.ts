export const SCORING_WEIGHTS = {
    attribute: {
        category: 0.45,
        semantic: 0.3,
        tagName: 0.25
    },
    fragment: {
        inheritedCandidate: 0.3,
        operator: 0.18,
        uniqueness: 0.18,
        tokenQuality: 0.12,
        stability: 0.1,
        semantic: 0.08,
        tagContext: 0.04
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
        multiResult: 0.25
    }
} as const;

export function clampScore(value: number): number {
    return Math.min(1, Math.max(0, value));
}

export function normalizeWeightedScore(total: number, totalWeight: number): number {
    return totalWeight > 0 ? clampScore(total / totalWeight) : 0;
}
