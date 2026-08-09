import type { DOMContext, ElementNodeContext } from "@/content/analyzer/dom-context";
import { buildNodeFragmentCandidates, type ScoredFragmentCandidate } from "@/content/analyzer/candidates/node-fragment-candidates";
import type { AttributeCandidate } from "@/content/analyzer/scoring/attribute-candidature";
import type { AttributeScorer } from "@/content/analyzer/scoring/attribute-scorer";
import { SemanticAttributeRule } from "@/content/analyzer/scoring/rules/semantic-attribute-rule";
import { TagNameRule } from "@/content/analyzer/scoring/rules/tagname-rule";
import type { FragmentScorer } from "@/content/selector/scoring/fragment-scorer";
import { SelectorValidator } from "@/content/selector/validator/selector-validator";
import type { SelectorPart } from "@/content/selector/selector-part";
import type { SelectorFragment } from "@/content/selector/selector-fragment";

// An ancestor is considered a good semantic section boundary once its combined
// semantic-token + structural-tag score reaches this threshold (see
// SemanticAttributeRule / TagNameRule). Calibrated so a div carrying one strong
// semantic class (e.g. "content", "product") passes, while a bare <section>/
// <article> with no semantic class or id (~0.30) does not and the walk keeps
// going up.
const CONTAINER_SEMANTIC_THRESHOLD = 0.4;

// How many of an ancestor's top-ranked single-attribute fragments are eligible
// to be paired together when falling back to 2-attribute combinations (see
// selectWithCombinedFragments). Kept small and bounded by design: this pass
// only runs when no ancestor at all cleared the threshold with a single
// attribute, so the combinatorial cost (at most C(5,2) = 10 validations per
// ancestor) is only ever paid on that harder, presumably rarer case.
const MAX_COMBINED_FRAGMENT_CANDIDATES = 5;

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

        // Shared across both the mono and combined passes: the best unique-but-
        // not-semantic match seen so far, by sectioning score. A combined match
        // that doesn't clear CONTAINER_SEMANTIC_THRESHOLD is still frequently a
        // *better* (more specific, less accidental) fallback than a mono match
        // that didn't clear it either — e.g. the same ancestor's own single
        // attribute may have been "uniquely" matching only by coincidence (a
        // `$=`/`^=` fragment matching on attribute-value order rather than
        // content). It must compete on score, not be discarded outright just
        // because it came from the second pass.
        const fallback: { selection: ContainerSelection | null; score: number } = {
            selection: null,
            score: -Infinity
        };

        const scoredByAncestor: Array<{ ancestor: ElementNodeContext; scored: ScoredFragmentCandidate[] }> = [];

        for (const ancestor of context.ancestors) {

            const scored = buildNodeFragmentCandidates(ancestor, this.attributeScorer, this.fragmentScorer);
            scoredByAncestor.push({ ancestor, scored });

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
            this.considerFallback(fallback, sectioningScore, { part, matchCount: count, isSemanticMatch: false });

        }

        // No ancestor reached the semantic threshold with a single attribute.
        // Re-walk the same ancestors nearest-first, this time allowing a
        // 2-attribute combination per ancestor, before giving up and falling
        // back to the best non-semantic unique ancestor found across both
        // passes. A closer, semantically-correct ancestor that only needs a
        // second attribute to become unique is still preferable to a farther,
        // structurally-unique one — see findUniqueMatchingFragment's comment on
        // why proximity alone isn't the goal.
        const combinedMatch = this.selectWithCombinedFragments(scoredByAncestor, fallback);

        if (combinedMatch) {
            return combinedMatch;
        }

        return fallback.selection;

    }

    private considerFallback(
        fallback: { selection: ContainerSelection | null; score: number },
        sectioningScore: number,
        selection: ContainerSelection,
        preferOnTie = false
    ): void {
        // preferOnTie lets the combined pass win ties against an already-set mono
        // fallback: getSectioningScore reads off the shared AttributeCandidate, so
        // e.g. a "details"+"title" pair and a lone "title" fragment drawn from the
        // very same class attribute score identically even though the pair is the
        // more robust, less order-dependent selector (a single `$=`/`^=` fragment
        // can be "unique" only because of where its token happens to fall in the
        // attribute string, e.g. class="details title" vs "title details").
        if (sectioningScore > fallback.score || (preferOnTie && sectioningScore === fallback.score)) {
            fallback.score = sectioningScore;
            fallback.selection = selection;
        }
    }

    private selectWithCombinedFragments(
        scoredByAncestor: Array<{ ancestor: ElementNodeContext; scored: ScoredFragmentCandidate[] }>,
        fallback: { selection: ContainerSelection | null; score: number }
    ): ContainerSelection | null {

        for (const { ancestor, scored } of scoredByAncestor) {

            const match = this.findUniqueMatchingCombinedFragment(scored, ancestor);

            if (!match) {
                continue;
            }

            const part: SelectorPart = {
                tagName: ancestor.tagname,
                fragments: [match.fragment],
                score: 0
            };

            if (match.sectioningScore >= CONTAINER_SEMANTIC_THRESHOLD) {
                return { part, matchCount: match.count, isSemanticMatch: true };
            }

            this.considerFallback(fallback, match.sectioningScore, { part, matchCount: match.count, isSemanticMatch: false }, true);

        }

        return null;

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

    // Same idea as findUniqueMatchingFragment, but pairs two of the ancestor's
    // top-ranked fragments into a single compound attribute selector, e.g.
    // [class*="details"][class*="title"]. Only tried by selectWithCombinedFragments,
    // i.e. only for ancestors where no single attribute both uniquely matched and
    // cleared the semantic threshold. Candidate pairs are ranked by their combined
    // fragment score (itself already weighted toward semantic tokens, see
    // FragmentScorer) so the first pair that validates is the most "readable" one
    // available, not just the first one tried.
    private findUniqueMatchingCombinedFragment(
        scored: ScoredFragmentCandidate[],
        ancestor: ElementNodeContext
    ): { fragment: SelectorFragment; sectioningScore: number; count: number } | null {

        const topCandidates = scored.slice(0, MAX_COMBINED_FRAGMENT_CANDIDATES);

        const pairs: Array<{ a: ScoredFragmentCandidate; b: ScoredFragmentCandidate; combinedScore: number }> = [];

        for (let i = 0; i < topCandidates.length; i++) {
            for (let j = i + 1; j < topCandidates.length; j++) {
                const a = topCandidates[i];
                const b = topCandidates[j];

                // Same underlying token adds no distinguishing power (e.g. a
                // "contains" and a "startsWith" fragment for the same word) —
                // skip it rather than spend a validation on a redundant pair.
                if (a.fragment.token && a.fragment.token === b.fragment.token) {
                    continue;
                }

                pairs.push({ a, b, combinedScore: a.fragment.score + b.fragment.score });
            }
        }

        pairs.sort((left, right) => right.combinedScore - left.combinedScore);

        for (const { a, b } of pairs) {

            const selector = `${ancestor.tagname}${a.fragment.selector}${b.fragment.selector}`;
            const { count } = this.validator.validate(selector);

            if (count !== 1) {
                continue;
            }

            if (ancestor.element && document.querySelector(selector) !== ancestor.element) {
                continue;
            }

            return {
                fragment: this.combineFragments(a.fragment, b.fragment),
                sectioningScore: Math.max(
                    this.getSectioningScore(a.candidate),
                    this.getSectioningScore(b.candidate)
                ),
                count
            };

        }

        return null;

    }

    private combineFragments(a: SelectorFragment, b: SelectorFragment): SelectorFragment {
        return {
            selector: `${a.selector}${b.selector}`,
            score: (a.score + b.score) / 2,
            token: a.token && b.token ? `${a.token}+${b.token}` : (a.token ?? b.token)
        };
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
