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
                ? 1 / Math.max(1, selector.count)
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

}