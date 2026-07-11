import {
    SelectorValidator
} from "./validator/selector-validator";


export interface GeneratedSelector {

    selector: string;

    count: number;

}


export class SelectorGenerator {

    private validator

    constructor(
        validator: SelectorValidator
    ){
        this.validator = validator;
    }


    generate(
        selectors: string[]
    ): GeneratedSelector[] {


        return selectors
            .map(selector => {


                const result =
                    this.validator.validate(
                        selector
                    );


                return {

                    selector,

                    count: result.count

                };

            })
            .filter(result =>
                result.count === 1
            );

    }

}