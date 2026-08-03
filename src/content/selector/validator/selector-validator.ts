export interface SelectorValidationResult {

    selector: string;

    count: number;

    matchesTarget: boolean;

    isValid: boolean;

}

export class SelectorValidator {

    validate(
        selector: string,
        target: HTMLElement | null = null
    ): SelectorValidationResult {

        const elements = document.querySelectorAll(selector);

        const count = elements.length;

        const matchesTarget = target
            ? Array.from(elements).includes(target)
            : count > 0;


        return {

            selector,

            count,

            matchesTarget,

            isValid: count > 0

        };

    }

}