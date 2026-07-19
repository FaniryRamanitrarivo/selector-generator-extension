import type { SelectorFragment } from "../selector-fragment";

import type {
    AttributeCandidate
} from "@/content/analyzer/scoring/attribute-candidature";


import {
    generateCSSFragments
} from "../css/css-fragment-generator";


export class ContainerFragmentSelector {


    select(
        candidates: AttributeCandidate[]
    ): SelectorFragment[] {


        const fragments =
            candidates
                .flatMap(candidate =>
                    generateCSSFragments(candidate)
                );


        return fragments
            .map(fragment => {


                const count =
                    document.querySelectorAll(
                        fragment.selector
                    ).length;


                return {

                    ...fragment,

                    count

                };

            })
            .sort(
                (a,b) => {

                    // priorité au moins de résultats
                    if(a.count !== b.count) {
                        return a.count - b.count;
                    }


                    // ensuite score sémantique
                    return b.score - a.score;

                }
            )
            .slice(0,3);

    }

}