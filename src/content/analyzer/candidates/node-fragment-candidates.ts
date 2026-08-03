import type { ElementNodeContext } from "@/content/analyzer/dom-context";
import { extractAttributeCandidates } from "@/content/analyzer/candidates/attribute-candidate-extractor";
import type { AttributeCandidate } from "@/content/analyzer/scoring/attribute-candidature";
import type { AttributeScorer } from "@/content/analyzer/scoring/attribute-scorer";
import { generateCSSFragments } from "@/content/selector/css/css-fragment-generator";
import type { FragmentScorer } from "@/content/selector/scoring/fragment-scorer";
import type { SelectorFragment } from "@/content/selector/selector-fragment";

export interface ScoredFragmentCandidate {

    candidate: AttributeCandidate;

    fragment: SelectorFragment;

}

export function buildNodeFragmentCandidates(
    node: ElementNodeContext,
    attributeScorer: AttributeScorer,
    fragmentScorer: FragmentScorer,
    multiResultMode = false
): ScoredFragmentCandidate[] {

    const candidates = extractAttributeCandidates(node.attributes, node.tagname)
        .map(candidate => attributeScorer.score(candidate));

    const bestCandidates = [...candidates]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    return bestCandidates
        .flatMap(candidate =>
            generateCSSFragments(candidate).map(fragment => ({
                candidate,
                fragment: fragmentScorer.score(fragment, candidate, node.tagname, multiResultMode)
            }))
        )
        .sort((a, b) => b.fragment.score - a.fragment.score);

}
