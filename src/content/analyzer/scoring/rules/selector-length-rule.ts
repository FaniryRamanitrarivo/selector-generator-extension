import type { ScoringRule } from "../scoring-rule";
import type { BuildedSelector } from "@/content/selector/builder/selector-builder";


export class SelectorLengthRule
    implements ScoringRule<BuildedSelector> {


    apply(
        candidate: BuildedSelector
    ): number {

        const length = candidate.selector.length;

        return Math.max(
            0,
            1 - length / 100
        );

    }

}