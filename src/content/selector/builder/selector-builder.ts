import type { SelectorPart } from "../selector-part";

export type BuildedSelector = {

    selector: string;

    score: number;

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

                    let score = 0;


                    if (part.tagName) {
                        selector += part.tagName;
                    }


                    if (fragment) {
                        selector += fragment.selector;
                        score += fragment.score;
                    }


                    if (lastPart.tagName) {
                        selector += ` ${lastPart.tagName}`;
                    }


                    return lastFragments.map(lastFragment => {

                        if (!lastFragment) {
                            return {
                                selector,
                                score
                            };
                        }


                        return {
                            selector: `${selector}${lastFragment.selector}`,
                            score: score + lastFragment.score
                        };

                    });

                });

            });

    }

}