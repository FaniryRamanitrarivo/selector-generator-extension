export interface SelectorValidationResult {

    selector: string;

    count: number;

    matchesTarget: boolean;

    isValid: boolean;

}

export class SelectorValidator {

    validate(
        selector: string,
        target: HTMLElement = null
    ): SelectorValidationResult {

        const elements = document.querySelectorAll(selector);

        const count = elements.length;

        const matchesTarget = count === 1 && 
                (target ? elements[0] === target: true);


        return {

            selector,

            count,

            matchesTarget,

            isValid: count > 0

        };

    }

}