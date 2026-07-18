import type { AttributeCandidate } from "./attribute-candidature";
import type { WeightedScoringRule } from "./weighted-scoring-rule";

export class AttributeScorer {

    private rules: WeightedScoringRule<AttributeCandidate>[];


    constructor(
        rules: WeightedScoringRule<AttributeCandidate>[]
    ) {
        this.rules = rules;
    }


    score(
        candidate: AttributeCandidate
    ): AttributeCandidate {

        const score = this.rules.reduce(
            (total, { rule, weight }) =>
                total + rule.apply(candidate) * weight,
            0
        );


        return {
            ...candidate,
            score
        };

    }

}