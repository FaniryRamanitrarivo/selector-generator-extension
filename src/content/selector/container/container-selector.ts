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

// How many of an ancestor's top-ranked *tokens* are eligible to be paired
// together when falling back to 2-attribute combinations (see
// selectWithCombinedFragments and findUniqueMatchingCombinedFragment). Every
// operator variant (~=/*=/^=/$=, up to 4) of each selected token is kept, so
// the actual validation cost is bounded by up to C(5,2) token pairs * 16
// operator combinations = 160 validations per ancestor — kept small and
// bounded by design: this pass only runs when no ancestor at all cleared the
// threshold with a single attribute, so that cost is only ever paid on that
// harder, presumably rarer case.
const MAX_COMBINED_FRAGMENT_CANDIDATES = 5;

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

export interface ContainerSelection {

    part: SelectorPart;

    matchCount: number;

    // true: stopped at the nearest ancestor satisfying both uniqueness and the
    // semantic threshold. false: no ancestor cleared the threshold, this is the
    // best-scoring ancestor among the unique ones (fallback).
    isSemanticMatch: boolean;

}

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

    select(context: DOMContext, multiResultMode = false): ContainerSelection | null {

        console.log("[ContainerSelector] select() start", {
            multiResultMode,
            target: context.element.tagname,
            ancestorCount: context.ancestors.length
        });

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

        // Computed once — every candidate container fragment is checked
        // against the same target, see matchesUniquelyWithTarget.
        const targetContext: TargetMatchContext = {
            tagName: context.element.tagname,
            fragments: buildNodeFragmentCandidates(context.element, this.attributeScorer, this.fragmentScorer)
                .slice(0, MAX_TARGET_FRAGMENT_CANDIDATES),
            element: context.element.element
        };

        const scoredByAncestor: Array<{ ancestor: ElementNodeContext; scored: ScoredFragmentCandidate[] }> = [];

        for (const ancestor of context.ancestors) {

            const scored = buildNodeFragmentCandidates(ancestor, this.attributeScorer, this.fragmentScorer);
            scoredByAncestor.push({ ancestor, scored });

            const match = this.findUniqueMatchingFragment(scored, ancestor, targetContext, multiResultMode);

            console.log("[ContainerSelector] ancestor mono pass", {
                ancestor: ancestor.tagname,
                attrs: ancestor.attributes.map(a => `${a.name}="${a.rawValue}"`).join(" "),
                mono: match ? `${ancestor.tagname}${match.fragmentCandidate.fragment.selector}` : null
            });

            if (match) {

                const { fragmentCandidate: best, count } = match;

                const part: SelectorPart = {
                    tagName: ancestor.tagname,
                    fragments: [best.fragment],
                    score: 0
                };

                const sectioningScore = this.getSectioningScore(best.candidate, best.fragment);

                console.log("[ContainerSelector] mono match found", {
                    selector: `${ancestor.tagname}${best.fragment.selector}`,
                    count,
                    sectioningScore,
                    clearsThreshold: sectioningScore >= CONTAINER_SEMANTIC_THRESHOLD
                });

                // In multi-result mode, scope tightness trumps semantic strength: the
                // target fragment is expected to match several siblings, so a farther
                // ancestor with a stronger sectioning score (e.g. a "product-list"
                // section) can silently sweep in unrelated sibling groups (other
                // products' options) that a nearer, less "semantic" ancestor (e.g. one
                // product card, identified only by a generated id) would have excluded.
                // Ancestors are walked nearest-first, so the first one able to
                // disambiguate the target at all is already the tightest scope
                // available — waiting for CONTAINER_SEMANTIC_THRESHOLD here would only
                // ever pick a *larger* container, never a better one.
                if (multiResultMode) {
                    console.log("[ContainerSelector] select() returning (multiResultMode mono match)", { selector: `${ancestor.tagname}${best.fragment.selector}`, count });
                    return { part, matchCount: count, isSemanticMatch: sectioningScore >= CONTAINER_SEMANTIC_THRESHOLD };
                }

                if (sectioningScore >= CONTAINER_SEMANTIC_THRESHOLD) {
                    console.log("[ContainerSelector] select() returning (semantic mono match)", { selector: `${ancestor.tagname}${best.fragment.selector}`, count });
                    return { part, matchCount: count, isSemanticMatch: true };
                }

                console.log("[ContainerSelector] mono match kept as fallback candidate only (below semantic threshold)", { selector: `${ancestor.tagname}${best.fragment.selector}`, sectioningScore });

                this.considerFallback(fallback, sectioningScore, { part, matchCount: count, isSemanticMatch: false });

                continue;

            }

            // In multi-result mode there's no second global pass over all
            // ancestors (see below) — proximity is what makes a container
            // correct, so a 2-attribute combination has to be tried on *this*
            // ancestor right now, before moving further out. Skipping this
            // and only coming back to combinations in a later pass would let
            // a farther ancestor's single-attribute match (e.g. a page-wide
            // "grid" wrapper) win outright just because it was reached first
            // — even though a nearer ancestor (e.g. one product's attribute
            // widget) was unique too, just not with a single attribute alone.
            // This is exactly the false-positive scenario the container is
            // meant to prevent (see CLAUDE.md's container-semantics section),
            // just triggered by the walk order rather than an accidentally-
            // unique generic class.
            if (multiResultMode) {

                const combined = this.findUniqueMatchingCombinedFragment(scored, ancestor, targetContext, multiResultMode);

                console.log("[ContainerSelector] ancestor combined pass (multiResultMode, no mono match)", {
                    ancestor: ancestor.tagname,
                    combined: combined ? `${ancestor.tagname}${combined.fragment.selector}` : null
                });

                if (combined) {
                    console.log("[ContainerSelector] select() returning (multiResultMode combined match)", {
                        selector: `${ancestor.tagname}${combined.fragment.selector}`,
                        count: combined.count
                    });
                    return {
                        part: { tagName: ancestor.tagname, fragments: [combined.fragment], score: 0 },
                        matchCount: combined.count,
                        isSemanticMatch: combined.sectioningScore >= CONTAINER_SEMANTIC_THRESHOLD
                    };
                }

            }

        }

        // Multi-result mode already tried both single- and 2-attribute
        // fragments per ancestor above (nearest-first) and returned as soon
        // as either worked — nothing unique was found for any ancestor, by
        // either method, so there's no container to fall back to.
        if (multiResultMode) {
            console.log("[ContainerSelector] select() returning null (multiResultMode, no ancestor validated)");
            return null;
        }

        // No ancestor reached the semantic threshold with a single attribute.
        // Re-walk the same ancestors nearest-first, this time allowing a
        // 2-attribute combination per ancestor, before giving up and falling
        // back to the best non-semantic unique ancestor found across both
        // passes. A closer, semantically-correct ancestor that only needs a
        // second attribute to become unique is still preferable to a farther,
        // structurally-unique one — see findUniqueMatchingFragment's comment on
        // why proximity alone isn't the goal.
        const combinedMatch = this.selectWithCombinedFragments(scoredByAncestor, targetContext, fallback, multiResultMode);

        if (combinedMatch) {
            console.log("[ContainerSelector] select() returning (pass 2 combined match)", { selector: `${combinedMatch.part.tagName}${combinedMatch.part.fragments?.[0]?.selector ?? ""}`, matchCount: combinedMatch.matchCount, isSemanticMatch: combinedMatch.isSemanticMatch });
            return combinedMatch;
        }

        console.log("[ContainerSelector] select() returning fallback", fallback.selection
            ? { selector: `${fallback.selection.part.tagName}${fallback.selection.part.fragments?.[0]?.selector ?? ""}`, matchCount: fallback.selection.matchCount }
            : null);

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
        target: TargetMatchContext,
        fallback: { selection: ContainerSelection | null; score: number },
        multiResultMode: boolean
    ): ContainerSelection | null {

        for (const { ancestor, scored } of scoredByAncestor) {

            const match = this.findUniqueMatchingCombinedFragment(scored, ancestor, target, multiResultMode);

            if (!match) {
                continue;
            }

            const part: SelectorPart = {
                tagName: ancestor.tagname,
                fragments: [match.fragment],
                score: 0
            };

            // Same rationale as the mono pass above: in multi-result mode the
            // nearest ancestor able to disambiguate the target wins outright,
            // regardless of sectioning score.
            if (multiResultMode) {
                return { part, matchCount: match.count, isSemanticMatch: match.sectioningScore >= CONTAINER_SEMANTIC_THRESHOLD };
            }

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
    // It also must actually be usable: a container can be unique on its own and still
    // be useless if combining it with the target never produces a unique full selector
    // (see matchesUniquelyWithTarget) — e.g. a unique "product-info" section that
    // contains several same-class ".size-option" elements.
    private findUniqueMatchingFragment(
        scored: ScoredFragmentCandidate[],
        ancestor: ElementNodeContext,
        target: TargetMatchContext,
        multiResultMode: boolean
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

            if (!this.matchesUniquelyWithTarget(selector, target, multiResultMode)) {
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
        target: TargetMatchContext,
        multiResultMode: boolean
    ): boolean {

        const candidates = target.fragments.length ? target.fragments : [undefined];

        for (const candidate of candidates) {

            const selector = candidate
                ? `${containerSelector} ${target.tagName}${candidate.fragment.selector}`
                : `${containerSelector} ${target.tagName}`;

            const { count, matchesTarget } = this.validator.validate(selector, target.element ?? null);

            console.log("[ContainerSelector] matchesUniquelyWithTarget try", { selector, count, matchesTarget });

            if (count === 0) {
                continue;
            }

            // Outside multi-result mode the container+target combo must pin down
            // exactly the target element, same as everywhere else in this file.
            // In multi-result mode the target fragment is expected to match
            // several siblings on purpose (e.g. every ".size-option" inside one
            // product's container) — only membership (matchesTarget) matters,
            // not the count.
            if (!multiResultMode && count !== 1) {
                continue;
            }

            if (target.element && !matchesTarget) {
                continue;
            }

            return true;

        }

        return false;

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
        ancestor: ElementNodeContext,
        target: TargetMatchContext,
        multiResultMode: boolean
    ): { fragment: SelectorFragment; sectioningScore: number; count: number } | null {

        // Group by token *before* cutting to the top N: `scored` holds up to 4
        // operator variants (~=/*=/^=/$=) per token, and a single very common
        // word (e.g. a class token reused site-wide as a layout/utility class)
        // can still out-score every variant of a rarer, more useful token
        // across the board. Without this, the top-N slice can end up holding
        // several operator variants of just one or two tokens — leaving no
        // room for the token that was actually needed to complete a correct
        // pair (see the container-selector-token-diversity test: a widely-
        // reused "container" token loses out to every variant of a rarer "js"
        // token).
        //
        // Only the *token* ranking is collapsed to one entry, though — every
        // operator variant of a token that makes the cut is kept. The
        // variant that scores highest *alone* (FragmentScorer, based on
        // global page uniqueness) isn't necessarily the one whose value
        // actually lines up for the combination — e.g. "container" alone
        // might rank endsWith ($=) highest globally, while only contains
        // (*=) actually appears in this ancestor's own class list combined
        // with the paired token. Discarding those other variants entirely
        // (as an earlier version of this dedup did) meant the one pair that
        // was actually unique — e.g. [class*="attribute"][class*="container"]
        // — could be skipped in favor of a same-token pair using the wrong
        // operator, even though every ranked-lower pair is tried before
        // falling back further out (see the "attribute container" case
        // reported against a live UGG product page).
        const variantsByToken = new Map<string, ScoredFragmentCandidate[]>();

        for (const candidate of scored) {
            const key = candidate.fragment.token ?? candidate.fragment.selector;
            const variants = variantsByToken.get(key);

            if (variants) {
                variants.push(candidate);
            } else {
                variantsByToken.set(key, [candidate]);
            }
        }

        const bestScorePerToken = (variants: ScoredFragmentCandidate[]) =>
            Math.max(...variants.map(variant => variant.fragment.score));

        const topCandidates = [...variantsByToken.values()]
            .sort((a, b) => bestScorePerToken(b) - bestScorePerToken(a))
            .slice(0, MAX_COMBINED_FRAGMENT_CANDIDATES)
            .flat();

        console.log("[ContainerSelector] findUniqueMatchingCombinedFragment topCandidates", {
            ancestor: ancestor.tagname,
            topCandidates: topCandidates.map(c => ({ selector: c.fragment.selector, token: c.fragment.token, score: c.fragment.score }))
        });

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

            console.log("[ContainerSelector] combined pair try", { selector, count });

            if (count !== 1) {
                continue;
            }

            if (ancestor.element && document.querySelector(selector) !== ancestor.element) {
                continue;
            }

            if (!this.matchesUniquelyWithTarget(selector, target, multiResultMode)) {
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
