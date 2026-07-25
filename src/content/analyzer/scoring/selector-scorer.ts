import type { WeightedScoringRule } from "@/content/analyzer/scoring/weighted-scoring-rule";
import type { BuildedSelector } from "@/content/selector/builder/selector-builder";


export class SelectorScorer {

    private readonly rules: WeightedScoringRule<BuildedSelector>[];


    constructor(
        rules: WeightedScoringRule<BuildedSelector>[]
    ) {
        this.rules = rules;
    }

    score(
        selector: BuildedSelector
    ): BuildedSelector {
        const additionalScore = this.rules.reduce(
            (total, { rule, weight }) => total + rule.apply(selector) * weight,
            0
        );

        const fragmentScore = selector.fragmentScores.reduce((total, score) => total + score, 0);
        const lengthPenalty = Math.max(0, 1 - selector.selector.length / 120);
        const structureBonus = selector.selector.split(" ").length > 2 ? 0.1 : 0;
        const totalScore = fragmentScore + additionalScore + lengthPenalty + structureBonus;

        return {
            ...selector,
            score: totalScore
        };
    }

}