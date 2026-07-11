import type { AttributeCandidate } from "./attribute-candidature";
import type { ScoringRule } from "./scoring-rule";

export class AttributeScorer {

    private rules;

    constructor(
        rules: ScoringRule[]
    ) {
        this.rules = rules
    }

    score(
        candidate: AttributeCandidate
    ): AttributeCandidate {

        const score = this.rules.reduce(
            (total, rule) =>
                total + rule.apply(candidate),
            0
        );

        return {
            ...candidate,
            score
        }

    }

}


