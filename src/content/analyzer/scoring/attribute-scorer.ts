import type { AttributeCandidate } from "./attribute-candidature";
import type { WeightedScoringRule } from "./weighted-scoring-rule";
import { normalizeWeightedScore, SCORING_WEIGHTS } from "@/content/scoring/scoring-config";

export class AttributeScorer {

    private readonly rules: WeightedScoringRule<AttributeCandidate>[];

    constructor(
        rules: WeightedScoringRule<AttributeCandidate>[]
    ) {
        this.rules = rules;
    }

    score(
        candidate: AttributeCandidate
    ): AttributeCandidate {
        const totalWeight = this.rules.reduce((total, { weight }) => total + weight, 0);
        const score = this.rules.reduce(
            (total, { rule, weight }) => total + rule.apply(candidate) * weight,
            0
        );

        return {
            ...candidate,
            score: normalizeWeightedScore(score, totalWeight) * SCORING_WEIGHTS.attribute.category
        };
    }

}