import type { DOMContext, ElementNodeContext } from "@/content/analyzer/dom-context";
import { buildNodeFragmentCandidates, type ScoredFragmentCandidate } from "@/content/analyzer/candidates/node-fragment-candidates";
import type { AttributeCandidate } from "@/content/analyzer/scoring/attribute-candidature";
import type { AttributeScorer } from "@/content/analyzer/scoring/attribute-scorer";
import { SemanticAttributeRule } from "@/content/analyzer/scoring/rules/semantic-attribute-rule";
import { TagNameRule } from "@/content/analyzer/scoring/rules/tagname-rule";
import type { FragmentScorer } from "@/content/selector/scoring/fragment-scorer";
import { SelectorValidator } from "@/content/selector/validator/selector-validator";
import type { SelectorPart } from "@/content/selector/selector-part";

// An ancestor is considered a good semantic section boundary once its combined
// semantic-token + structural-tag score reaches this threshold (see
// SemanticAttributeRule / TagNameRule). Calibrated so a div carrying one strong
// semantic class (e.g. "content", "product") passes, while a bare <section>/
// <article> with no semantic class or id (~0.30) does not and the walk keeps
// going up.
const CONTAINER_SEMANTIC_THRESHOLD = 0.4;

export interface ContainerSelection {

    part: SelectorPart;

    matchCount: number;

    // true: stopped at the nearest ancestor satisfying both uniqueness and the
    // semantic threshold. false: no ancestor cleared the threshold, this is the
    // best-scoring ancestor among the unique ones (fallback).
    isSemanticMatch: boolean;

}

export class ContainerSelector {

    private readonly attributeScorer: AttributeScorer;
    private readonly fragmentScorer: FragmentScorer;
    private readonly validator: SelectorValidator;
    private readonly semanticRule = new SemanticAttributeRule();
    private readonly tagRule = new TagNameRule();

    constructor(
        attributeScorer: AttributeScorer,
        fragmentScorer: FragmentScorer,
        validator: SelectorValidator = new SelectorValidator()
    ) {
        this.attributeScorer = attributeScorer;
        this.fragmentScorer = fragmentScorer;
        this.validator = validator;
    }

    select(context: DOMContext): ContainerSelection | null {

        let bestFallback: ContainerSelection | null = null;
        let bestFallbackScore = -Infinity;

        for (const ancestor of context.ancestors) {

            const scored = buildNodeFragmentCandidates(ancestor, this.attributeScorer, this.fragmentScorer);

            const match = this.findUniqueMatchingFragment(scored, ancestor);

            if (!match) {
                continue;
            }

            const { fragmentCandidate: best, count } = match;

            const part: SelectorPart = {
                tagName: ancestor.tagname,
                fragments: [best.fragment],
                score: 0
            };

            const sectioningScore = this.getSectioningScore(best.candidate);

            if (sectioningScore >= CONTAINER_SEMANTIC_THRESHOLD) {
                return { part, matchCount: count, isSemanticMatch: true };
            }

            if (sectioningScore > bestFallbackScore) {
                bestFallbackScore = sectioningScore;
                bestFallback = { part, matchCount: count, isSemanticMatch: false };
            }

        }

        return bestFallback;

    }

    // A fragment is only a valid container candidate when it's unique on the page
    // *and* that unique match is actually this ancestor — a fragment derived from this
    // ancestor's own attributes should, by construction, resolve back to this node, but
    // a token shared with unrelated markup elsewhere (e.g. a generic "section" class
    // reused site-wide) can coincidentally be unique while resolving to a *different*
    // element entirely (a footer, another widget) — scoping to the wrong part of the
    // page. When the top-ranked fragment fails this, fall through to the next-best
    // fragment for the same ancestor instead of giving up on it and walking further up.
    private findUniqueMatchingFragment(
        scored: ScoredFragmentCandidate[],
        ancestor: ElementNodeContext
    ): { fragmentCandidate: ScoredFragmentCandidate; count: number } | null {

        for (const fragmentCandidate of scored) {

            const selector = `${ancestor.tagname}${fragmentCandidate.fragment.selector}`;
            const { count } = this.validator.validate(selector);

            if (count !== 1) {
                continue;
            }

            if (ancestor.element && document.querySelector(selector) !== ancestor.element) {
                continue;
            }

            return { fragmentCandidate, count };

        }

        return null;

    }

    private getSectioningScore(candidate: AttributeCandidate): number {
        // Deliberately excludes CategoryRule (data-* > id > class), which measures
        // attribute-type stability, not sectioning. Kept at the same 40:20 (2:1)
        // ratio these two rules already carry inside AttributeScorer.
        const semantic = this.semanticRule.apply(candidate);
        const tag = this.tagRule.apply(candidate);
        return semantic * (2 / 3) + tag * (1 / 3);
    }

}
