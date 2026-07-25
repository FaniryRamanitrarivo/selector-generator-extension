import type { SelectorFragment } from "../selector-fragment";
import type { SelectorPart } from "../selector-part";

export type BuildedSelector = {

    selector: string;

    score: number;

    fragmentScores: number[];

};


export class SelectorBuilder {

    build(
        parts: SelectorPart[]
    ): BuildedSelector[] {

        const lastPart = parts.at(-1);

        if (!lastPart) {
            return [];
        }

        const lastFragments = lastPart.fragments?.length
            ? lastPart.fragments
            : [undefined];

        return parts
            .slice(0, -1)
            .flatMap(part => {
                const fragments = part.fragments?.length
                    ? part.fragments
                    : [undefined];

                return fragments.flatMap(fragment => {
                    let selector = "";
                    const fragmentScores: number[] = [];

                    if (part.tagName) {
                        selector += part.tagName;
                    }

                    if (fragment) {
                        selector += fragment.selector;
                        fragmentScores.push(fragment.score);
                    }

                    if (lastPart.tagName) {
                        selector += ` ${lastPart.tagName}`;
                    }

                    return lastFragments.map(lastFragment => {
                        const selectorFragments = [...fragmentScores];

                        if (lastFragment) {
                            selectorFragments.push(lastFragment.score);
                            return {
                                selector: `${selector}${lastFragment.selector}`,
                                score: 0,
                                fragmentScores: selectorFragments
                            };
                        }

                        return {
                            selector,
                            score: 0,
                            fragmentScores: selectorFragments
                        };
                    });
                });
            });
    }

}