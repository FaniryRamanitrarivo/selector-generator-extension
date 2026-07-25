import type { AttributeCandidate } from "@/content/analyzer/scoring/attribute-candidature";
import type { SelectorFragment } from "../selector-fragment";


export function generateCSSFragments(
    candidate: AttributeCandidate
): SelectorFragment[] {

    if (!candidate.value) {
        return [];
    }

    const fragments: SelectorFragment[] = [];

    if (candidate.name !== "class") {
        fragments.push({
            selector: `[${candidate.name}="${candidate.value}"]`,
            score: candidate.score,
            operator: "exact",
            token: candidate.value
        });
    }

    for (const token of candidate.tokens) {
        fragments.push(
            {
                selector: `[${candidate.name}*="${token}"]`,
                score: candidate.score,
                operator: "contains",
                token
            },
            {
                selector: `[${candidate.name}^="${token}"]`,
                score: candidate.score,
                operator: "startsWith",
                token
            },
            {
                selector: `[${candidate.name}$="${token}"]`,
                score: candidate.score,
                operator: "endsWith",
                token
            }
        );

        if (candidate.name === "class") {
            fragments.push({
                selector: `[${candidate.name}~="${token}"]`,
                score: candidate.score,
                operator: "containsWord",
                token
            });
        }
    }

    return fragments;

}