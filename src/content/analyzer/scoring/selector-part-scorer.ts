import type { SelectorPart } from "@/content/selector/selector-part";
import type { WeightedScoringRule } from "./weighted-scoring-rule";


export class SelectorPartScorer {

    private rules: WeightedScoringRule<SelectorPart>[];


    constructor(
        rules: WeightedScoringRule<SelectorPart>[]
    ) {
        this.rules = rules;
    }


    score(
        part: SelectorPart
    ): SelectorPart {


        const fragments =
            part.fragments?.map(fragment => {


                const partWithFragment = {
                    ...part,
                    fragments: [
                        fragment
                    ]
                };


                const score =
                    this.rules.reduce(
                        (total, { rule, weight }) =>
                            total + rule.apply(partWithFragment) * weight,
                        0
                    );


                return {
                    ...fragment,
                    score:
                        fragment.score + score
                };

            });


        return {

            ...part,

            fragments

        };

    }

}