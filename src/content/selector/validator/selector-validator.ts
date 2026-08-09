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

        let elements: NodeListOf<Element>;

        try {
            elements = document.querySelectorAll(selector);
        } catch {
            return {
                selector,
                count: 0,
                matchesTarget: false,
                isValid: false
            };
        }

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