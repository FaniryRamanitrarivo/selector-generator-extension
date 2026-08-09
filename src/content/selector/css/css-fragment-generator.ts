import type { AttributeCandidate } from "@/content/analyzer/scoring/attribute-candidature";
import type { SelectorFragment } from "../selector-fragment";


// Escapes a value for use inside a double-quoted CSS attribute selector
// string, e.g. [attr="value"]. CSS.escape() is meant for identifiers
// (#id, .class) and doesn't cover this case, so backslashes and double
// quotes are escaped by hand per the CSS syntax spec.
function escapeAttributeValue(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}


export function generateCSSFragments(
    candidate: AttributeCandidate
): SelectorFragment[] {

    if (!candidate.value) {
        return [];
    }

    const fragments: SelectorFragment[] = [];

    if (candidate.name !== "class") {
        fragments.push({
            selector: `[${candidate.name}="${escapeAttributeValue(candidate.value)}"]`,
            score: candidate.score,
            operator: "exact",
            token: candidate.value
        });
    }

    for (const token of candidate.tokens) {
        const escapedToken = escapeAttributeValue(token);

        if (candidate.name === "class") {
            fragments.push({
                selector: `[${candidate.name}~="${escapedToken}"]`,
                score: candidate.score,
                operator: "containsWord",
                token
            });
        }

        fragments.push(
            {
                selector: `[${candidate.name}*="${escapedToken}"]`,
                score: candidate.score,
                operator: "contains",
                token
            },
            {
                selector: `[${candidate.name}^="${escapedToken}"]`,
                score: candidate.score,
                operator: "startsWith",
                token
            },
            {
                selector: `[${candidate.name}$="${escapedToken}"]`,
                score: candidate.score,
                operator: "endsWith",
                token
            }
        );
    }

    return fragments;

}