import type { SelectorPart } from "../selector-part";

import type { SelectorEvaluation } from "../selector-evaluation";

export type BuildedSelector = {

    selector: string;

    score: number;

    fragmentScores: number[];

    evaluation?: SelectorEvaluation;

    debug?: {
        parentCount?: number;
        targetCount?: number;
        semanticScore?: number;
        uniquenessScore?: number;
        tagScore?: number;
        lengthScore?: number;
        finalScore?: number;
        ruleContribution?: number;
        contributions?: Record<string, number>;
        rawScores?: Record<string, number>;
        rules?: Record<string, {
            rawScore: number;
            weight: number;
            contribution: number;
        }>;
    };

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