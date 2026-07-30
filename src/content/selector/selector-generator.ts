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
        target: HTMLElement,
        options: SelectorGenerationOptions = {}
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
            .filter(result => 
                result.count > 0 && (
                    options.multiResultMode || result.matchesTarget
                )
            );

    }

}