import type { WeightedScoringRule } from "@/content/analyzer/scoring/weighted-scoring-rule";
import type { BuildedSelector } from "@/content/selector/builder/selector-builder";


export class SelectorScorer {

    private rules: WeightedScoringRule<BuildedSelector>[];


    constructor(
        rules: WeightedScoringRule<BuildedSelector>[]
    ) {
        this.rules = rules;
    }


    score(
        selector: BuildedSelector
    ): BuildedSelector {

        const additionalScore =
            this.rules.reduce(
                (total, { rule, weight }) =>
                    total + rule.apply(selector) * weight,
                0
            );


        return {
            ...selector,
            score: selector.score + additionalScore
        };

    }

}