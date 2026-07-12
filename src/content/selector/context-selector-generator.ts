import type { DOMContext } from "../analyzer/dom-context";

import {
    extractAttributeCandidates
} from "../analyzer/candidates/attribute-candidate-extractor";

import {
    generateCSSFragments
} from "./css/css-fragment-generator";


export function generateSelectorParts(
    context: DOMContext
) {

    const nodes = [
        ...[...context.ancestors].reverse(),
        context.element
    ];

    return nodes.map(node => {

        const candidates = extractAttributeCandidates(
            node.attributes
        );

        const bestCandidate = candidates.sort((a,b) => b.score - a.score)[0];

        const fragment = 
            bestCandidate 
            ? generateCSSFragments(bestCandidate)[0]
            : undefined;

        return {

            tagname: node.tagname,

            fragment

        }

    })

}