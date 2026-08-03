import type { GeneratedSelector } from "@/content/selector/generated-selector";
import type { SelectorGenerationOptions } from "@/content/selector/selector-generator";
import { SCORING_WEIGHTS } from "@/content/scoring/scoring-config";

export class SelectorCountNormalizer {

    normalize(
        selectors: GeneratedSelector[],
        options: SelectorGenerationOptions = {}
    ): GeneratedSelector[] {

        return selectors.map(selector => {
            const countScore = options.multiResultMode
                ? this.getMultiResultCountScore(selector.count)
                : selector.count === 1
                    ? SCORING_WEIGHTS.countNormalization.singleResult
                    : SCORING_WEIGHTS.countNormalization.multiResult;

            return {
                ...selector,
                countScore,
                score: selector.score * countScore
            };
        });
    }

    // Guarantees any count > 1 outscores a count of 1: the multi-match term is strictly
    // positive and added on top of the single-match floor, so it can only push the score
    // above that floor, never below it — while still ranking fewer matches higher than more.
    private getMultiResultCountScore(count: number): number {
        const { multiResultSingleMatchFloor, multiResultMatchRange } = SCORING_WEIGHTS.countNormalization;

        if (count <= 1) {
            return multiResultSingleMatchFloor;
        }

        return multiResultSingleMatchFloor + multiResultMatchRange / count;
    }

}