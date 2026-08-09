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
// to be paired together when falling back to a 2-attribute combination (see
// findUniqueMatchingCombinedFragment). Kept small and bounded by design: this
// is only ever tried for an ancestor whose own single attributes already
// failed to uniquely match, so the combinatorial cost (at most C(5,2) = 10
// validations) is only paid on that harder, presumably rarer, per-ancestor case.
const MAX_COMBINED_FRAGMENT_CANDIDATES = 5;

export interface ContainerSelection {

    part: SelectorPart;

    matchCount: number;

    // true: stopped at the nearest ancestor satisfying both uniqueness and the
    // semantic threshold. false: no ancestor cleared the threshold, this is the
    // best-scoring ancestor among the unique ones (fallback).
    isSemanticMatch: boolean;

}

// How many of the target's own top-ranked fragments are tried when checking
// whether a candidate container can actually be combined into a unique full
// selector (see matchesUniquelyWithTarget). A container being unique *alone*
// doesn't guarantee "container target" is unique too — e.g. a unique
// "product-info" section can still contain several ".size-option" elements,
// so div[class="product-info"] .size-option would match more than one node
// even though the container itself is fine. Bounded like
// MAX_COMBINED_FRAGMENT_CANDIDATES: this only adds cost per container
// candidate actually being validated, not per ancestor.
const MAX_TARGET_FRAGMENT_CANDIDATES = 3;

interface TargetMatchContext {

    tagName: string;

    fragments: ScoredFragmentCandidate[];

    element?: HTMLElement;

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

        // The best unique-but-not-semantic match seen so far (mono or
        // combined), by sectioning score — used only if the walk finishes
        // without any ancestor clearing CONTAINER_SEMANTIC_THRESHOLD.
        const fallback: { selection: ContainerSelection | null; score: number } = {
            selection: null,
            score: -Infinity
        };

        // Computed once — every candidate container fragment is checked
        // against the same target, see matchesUniquelyWithTarget.
        const targetContext: TargetMatchContext = {
            tagName: context.element.tagname,
            fragments: buildNodeFragmentCandidates(context.element, this.attributeScorer, this.fragmentScorer)
                .slice(0, MAX_TARGET_FRAGMENT_CANDIDATES),
            element: context.element.element
        };

        // Nearest-first, and for each ancestor: try a single attribute
        // first, only reaching for a 2-attribute combination *for that same
        // ancestor* when no single attribute uniquely identifies it. This
        // interleaving matters both ways — a close ancestor that only needs
        // combining must get that chance before a farther ancestor's
        // unrelated, merely-coincidental mono match can win by default; and
        // an ancestor whose mono attribute is already unique should never
        // pay for (or be overridden by) a combined lookup it doesn't need.
        for (const ancestor of context.ancestors) {

            const scored = buildNodeFragmentCandidates(ancestor, this.attributeScorer, this.fragmentScorer);

            const monoMatch = this.findUniqueMatchingFragment(scored, ancestor, targetContext);

            if (monoMatch) {

                const { fragmentCandidate: best, count } = monoMatch;

                const part: SelectorPart = {
                    tagName: ancestor.tagname,
                    fragments: [best.fragment],
                    score: 0
                };

                const sectioningScore = this.getSectioningScore(best.candidate, best.fragment);

                if (sectioningScore >= CONTAINER_SEMANTIC_THRESHOLD) {
                    return { part, matchCount: count, isSemanticMatch: true };
                }

                this.considerFallback(fallback, sectioningScore, { part, matchCount: count, isSemanticMatch: false });

                continue;

            }

            const combinedMatch = this.findUniqueMatchingCombinedFragment(scored, ancestor, targetContext);

            if (!combinedMatch) {
                continue;
            }

            const part: SelectorPart = {
                tagName: ancestor.tagname,
                fragments: [combinedMatch.fragment],
                score: 0
            };

            if (combinedMatch.sectioningScore >= CONTAINER_SEMANTIC_THRESHOLD) {
                return { part, matchCount: combinedMatch.count, isSemanticMatch: true };
            }

            this.considerFallback(fallback, combinedMatch.sectioningScore, { part, matchCount: combinedMatch.count, isSemanticMatch: false }, true);

        }

        return fallback.selection;

    }

    private considerFallback(
        fallback: { selection: ContainerSelection | null; score: number },
        sectioningScore: number,
        selection: ContainerSelection,
        preferOnTie = false
    ): void {
        // preferOnTie lets a combined match win ties against an earlier mono
        // fallback recorded for a different (farther) ancestor — e.g. a
        // "details"+"title" pair and a lone "title" fragment can score
        // identically even though the pair is the more robust, less
        // order-dependent selector (a single `$=`/`^=` fragment can be
        // "unique" only because of where its token happens to fall in the
        // attribute string, e.g. class="details title" vs "title details").
        if (sectioningScore > fallback.score || (preferOnTie && sectioningScore === fallback.score)) {
            fallback.score = sectioningScore;
            fallback.selection = selection;
        }
    }

    // A fragment is only a valid container candidate when it's unique on the page
    // *and* that unique match is actually this ancestor — a fragment derived from this
    // ancestor's own attributes should, by construction, resolve back to this node, but
    // a token shared with unrelated markup elsewhere (e.g. a generic "section" class
    // reused site-wide) can coincidentally be unique while resolving to a *different*
    // element entirely (a footer, another widget) — scoping to the wrong part of the
    // page. When the top-ranked fragment fails this, fall through to the next-best
    // fragment for the same ancestor instead of giving up on it and walking further up.
    // It also must actually be usable: a container can be unique on its own and still
    // be useless if combining it with the target never produces a unique full selector
    // (see matchesUniquelyWithTarget) — e.g. a unique "product-info" section that
    // contains several same-class ".size-option" elements.
    private findUniqueMatchingFragment(
        scored: ScoredFragmentCandidate[],
        ancestor: ElementNodeContext,
        target: TargetMatchContext
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

            if (!this.matchesUniquelyWithTarget(selector, target)) {
                continue;
            }

            return { fragmentCandidate, count };

        }

        return null;

    }

    // Verifies "containerSelector targetTag[fragment]" is unique (and resolves
    // to the real target element) for at least one of the target's own
    // top-ranked fragments. A container matching exactly 1 element on its own
    // doesn't guarantee that — the container's single match can still have
    // several descendants sharing whatever attribute the target selector ends
    // up using, e.g. multiple ".size-option" siblings inside one unique
    // "product-info" wrapper. Tries several target fragments (not just the
    // best-scored one) because a fragment that's ambiguous within this
    // specific container might not be the one the pipeline ultimately picks
    // either — see buildTargetPart, which offers several target fragment
    // options downstream for the same reason.
    private matchesUniquelyWithTarget(
        containerSelector: string,
        target: TargetMatchContext
    ): boolean {

        const candidates = target.fragments.length ? target.fragments : [undefined];

        for (const candidate of candidates) {

            const selector = candidate
                ? `${containerSelector} ${target.tagName}${candidate.fragment.selector}`
                : `${containerSelector} ${target.tagName}`;

            const { count } = this.validator.validate(selector);

            if (count !== 1) {
                continue;
            }

            if (target.element && document.querySelector(selector) !== target.element) {
                continue;
            }

            return true;

        }

        return false;

    }

    // Same idea as findUniqueMatchingFragment, but pairs two of the ancestor's
    // top-ranked fragments into a single compound attribute selector, e.g.
    // [class*="details"][class*="title"]. Only reached from select() when
    // this same ancestor has no single attribute that uniquely matches on
    // its own. Candidate pairs are ranked by their combined fragment score
    // (itself already weighted toward semantic tokens, see FragmentScorer)
    // so the first pair that validates is the most "readable" one available,
    // not just the first one tried.
    private findUniqueMatchingCombinedFragment(
        scored: ScoredFragmentCandidate[],
        ancestor: ElementNodeContext,
        target: TargetMatchContext
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

                // Pairing an "exact" fragment with a partial fragment of that
                // very same attribute occurrence is redundant: the exact
                // match already pins the whole value, so a substring of it
                // adds nothing — e.g.
                // [id="navigation-target-specifications"][id*="specifications"]
                // matches exactly what [id="navigation-target-specifications"]
                // matches alone.
                if (a.candidate === b.candidate && (a.fragment.operator === "exact" || b.fragment.operator === "exact")) {
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

            if (!this.matchesUniquelyWithTarget(selector, target)) {
                continue;
            }

            return {
                fragment: this.combineFragments(a.fragment, b.fragment),
                sectioningScore: Math.max(
                    this.getSectioningScore(a.candidate, a.fragment),
                    this.getSectioningScore(b.candidate, b.fragment)
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

    // Scores only what the fragment's actual selector text captures, not the
    // whole source attribute. A candidate's `value`/`tokens` cover every word
    // in e.g. class="product page wrapper", but a single-token fragment like
    // [class$="page"] only ever puts "page" on the page — crediting it with
    // "product"'s semantic weight (which never appears in that selector)
    // would let an unrelated strong word on the same attribute inflate an
    // otherwise generic fragment past CONTAINER_SEMANTIC_THRESHOLD.
    //
    // Only narrows down to the fragment's own token when that token, on its
    // own, isn't already a significant (business/content-specific) word —
    // see SemanticAttributeRule.isSignificantToken. Two genuinely meaningful
    // sibling tokens on the same attribute (e.g. class="product-info": either
    // "product" or "info" alone should count) are still allowed to reinforce
    // each other. And "exact" fragments (non-class attributes, e.g.
    // [id="product-details"]) already consume the attribute's entire value —
    // there's nothing to narrow, unlike a class fragment that only isolates
    // one of several tokens.
    private getSectioningScore(candidate: AttributeCandidate, fragment: SelectorFragment): number {
        // Deliberately excludes CategoryRule (data-* > id > class), which measures
        // attribute-type stability, not sectioning. Kept at the same 40:20 (2:1)
        // ratio these two rules already carry inside AttributeScorer.
        const isPartialTokenFragment = fragment.operator !== "exact" && !!fragment.token;
        const shouldNarrow = isPartialTokenFragment
            && candidate.tokens.length > 1
            && !this.semanticRule.isSignificantToken(fragment.token!);

        const scoredCandidate: AttributeCandidate = shouldNarrow
            ? { ...candidate, value: fragment.token!, tokens: [fragment.token!] }
            : candidate;

        const semantic = this.semanticRule.apply(scoredCandidate);
        const tag = this.tagRule.apply(scoredCandidate);
        return semantic * (2 / 3) + tag * (1 / 3);
    }

}
