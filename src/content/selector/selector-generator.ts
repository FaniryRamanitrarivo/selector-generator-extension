import type { BuildedSelector } from "./builder/selector-builder";

import {
    SelectorValidator
} from "./validator/selector-validator";

import type {
    GeneratedSelector
} from "./generated-selector";

export interface SelectorGenerationOptions {
    multiResultMode?: boolean;
}

export class SelectorGenerator {

    private validator: SelectorValidator;


    constructor(
        validator: SelectorValidator
    ) {
        this.validator = validator;
    }


    generate(
        selectors: BuildedSelector[],
        target: HTMLElement
    ): GeneratedSelector[] {

        return selectors
            .map(selector => {

                const result =
                    this.validator.validate(
                        selector.selector,
                        target
                    );


                return {

                    selector: selector.selector,

                    count: result.count,

                    score: selector.score,

                    countScore: 0,
                    matchesTarget: result.matchesTarget,
                    debug: selector.debug

                };

            })
            // A non-unique selector (count > 1) outside multiResultMode is no longer dropped
            // outright — SelectorCountNormalizer already penalizes it (0.25x) so unique
            // alternatives still outrank it, but surfacing it lets the sidebar show a "best
            // effort" selector with a robustness warning instead of an empty result set when
            // no attribute on the page disambiguates the target at all.
            .filter(result =>
                result.count > 0 &&
                result.matchesTarget
            );

    }

}