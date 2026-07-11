export interface SelectorValidationResult {

    selector: string;

    count: number;

    isValid: boolean;

}

export class SelectorValidator {

    validate(
        selector: string
    ): SelectorValidationResult {

        const elements = document.querySelectorAll(selector);

        return {

            selector,

            count: elements.length,

            isValid: elements.length === 1

        };

    }

}