import { queryAllDeep } from "@/content/analyzer/dom/deep-query";

export interface SelectorValidationResult {

    selector: string;

    count: number;

    matchesTarget: boolean;

    isValid: boolean;

}

export class SelectorValidator {

    // Keyed on the selector string alone (target-independent) — the DOM isn't
    // mutated over the course of a single generate() call, and ContainerSelector's
    // fallback pass in particular re-validates the same handful of selectors many
    // times (see container-selector.ts), so this turns an O(page size) queryAllDeep
    // walk into a cache hit for every repeat.
    private readonly matchCache = new Map<string, Element[]>();

    validate(
        selector: string,
        target: HTMLElement | null = null
    ): SelectorValidationResult {

        const elements = this.getMatches(selector);

        const count = elements.length;

        const matchesTarget = target
            ? elements.includes(target)
            : count > 0;


        return {

            selector,

            count,

            matchesTarget,

            isValid: count > 0

        };

    }

    private getMatches(selector: string): Element[] {
        const cached = this.matchCache.get(selector);

        if (cached !== undefined) {
            return cached;
        }

        const elements = queryAllDeep(selector);

        this.matchCache.set(selector, elements);

        return elements;
    }

}