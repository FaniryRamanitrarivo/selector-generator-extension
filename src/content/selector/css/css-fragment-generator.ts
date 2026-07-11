import type { AttributeCandidate } from "@/content/analyzer/scoring/attribute-candidature";
import type { SelectorFragment } from "../selector-fragment";

export function generateCSSFragments(
    candidate: AttributeCandidate
): SelectorFragment[] {


    const fragments: SelectorFragment[] = [];


    fragments.push({

        selector:
            `[${candidate.name}="${candidate.value}"]`,

        score:
            candidate.score

    });


    for(const token of candidate.tokens) {

        fragments.push({

            selector:
                `[${candidate.name}*="${token}"]`,

            score:
                candidate.score - 5

        });

    }


    return fragments;

}