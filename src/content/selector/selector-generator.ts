import type { BuildedSelector } from "./builder/selector-builder";

import {
    SelectorValidator
} from "./validator/selector-validator";


export interface GeneratedSelector {

    selector: string;

    count: number;

    score: number;

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

                    isValid: result.isValid

                };

            })
            //.filter(result => result.isValid)
            .sort((a, b) =>
                b.score - a.score
            );

    }

}