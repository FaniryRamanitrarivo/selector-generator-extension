import type { WeightedScoringRule } from "@/content/analyzer/scoring/weighted-scoring-rule";
import type { BuildedSelector } from "@/content/selector/builder/selector-builder";
import type { SelectorEvaluation } from "@/content/selector/selector-evaluation";
import { clampScore, SCORING_WEIGHTS } from "@/content/scoring/scoring-config";

type SemanticMatch = {
    token: string;
    position: number;
    fragmentIndex: number;
    attributeType?: "class" | "id";
    operator?: "=" | "~=" | "*=" | "^=" | "$=";
};

type RuleContribution = {
    rawScore: number;
    weight: number;
    contribution: number;
};

// Bonuses/penalties used while computing the readability score.
// Kept as named constants instead of magic numbers scattered in the methods below.
const READABILITY = {
    GENERATED_IDENTIFIER_SCORE: 0.2,
    NO_SEMANTIC_TOKEN_SCORE: 0.7,
    BASE_COUNT_SCORE: 0.6,
    PER_TOKEN_COUNT_SCORE: 0.1,
    REPETITION_BONUS_PER_EXTRA: 0.025,
    ORDER_BONUS_MAX: 0.12,
    DENSITY_BONUS_MAX: 0.05,
    DENSITY_MULTIPLIER: 2,
    COVERAGE_BONUS_MAX: 0.10,
    NON_SEMANTIC_FRAGMENT_PENALTY: 0.025,
    ATTRIBUTE_BONUS: {
        EXACT_IDENTIFIER: 0.06,  // [id="content"]
        EXACT_CLASS_TOKEN: 0.04, // [class~="content"]
        PREFIX_SUFFIX: 0.025,    // [class^="..."] / [class$="..."]
        CONTAINS: 0.01           // [class*="..."]
    }
} as const;

// Generated/framework-hash-like identifiers that should tank readability.
const GENERATED_IDENTIFIER_PATTERN =
    /(?:css|react|chakra|mui|mantine|ember|vue|next|[a-f0-9]{6,}|uuid)/;

const STRUCTURAL_TAG_PATTERN = /\b(main|section|fieldset|article|nav|header|footer|aside)\b/;
const EXPLICIT_IDENTIFIER_PATTERN = /\[(id|class)[^\]]*(=|~|\^|\$|\*)/;

const CONCISION_THRESHOLDS = [
    { maxLength: 24, score: 0.95 },
    { maxLength: 45, score: 0.8 },
    { maxLength: 80, score: 0.65 }
];
const CONCISION_FALLBACK_SCORE = 0.4;

const LENGTH_THRESHOLDS = [
    { maxLength: 30, score: 1 },
    { maxLength: 60, score: 0.9 },
    { maxLength: 100, score: 0.75 },
    { maxLength: 150, score: 0.6 },
    { maxLength: 200, score: 0.45 }
];
const LENGTH_FALLBACK_SCORE = 0.3;

const MATCH_COUNT_THRESHOLDS = [
    { maxCount: 1, score: 1 },
    { maxCount: 2, score: 0.9 },
    { maxCount: 5, score: 0.8 },
    { maxCount: 10, score: 0.65 },
    { maxCount: 25, score: 0.5 },
    { maxCount: 50, score: 0.35 },
    { maxCount: 100, score: 0.2 }
];
const MATCH_COUNT_FALLBACK_SCORE = 0.1;

/**
 * Semantic hierarchy used to score how a selector reads from generic
 * structural context down to the actual target information:
 *
 * 1 = generic / structural context
 * 2 = contextual information
 * 3 = target-oriented information
 */
const SEMANTIC_TOKEN_LEVELS: Record<string, number> = {
    // Generic / structural context — says nothing about what's inside,
    // matching one of these should not be treated as a strong signal.
    page: 1, pages: 1, main: 1, header: 1, footer: 1,
    sidebar: 1, navigation: 1, nav: 1, section: 1, menu: 1,

    // Contextual information — narrows down to a generic container of
    // information, but doesn't say precisely what that information is.
    content: 2, information: 2, info: 2, details: 2, gallery: 2, hero: 2, cart: 2,

    // Target-oriented information — names the exact piece of content being
    // targeted, so it "speaks directly": you know exactly what you get.
    // Domain-specific descriptors (composition, care, brand, manufacturer,
    // category) belong here too — they're just as precise as price/title.
    product: 3, products: 3, item: 3, items: 3, title: 3, name: 3,
    price: 3, description: 3, category: 3, brand: 3, manufacturer: 3,
    composition: 3, care: 3, size: 3, taille: 3, talla: 3,
    color: 3, colour: 3, couleur: 3
};

const SEMANTIC_TOKEN_PATTERN = new RegExp(
    `\\b(${Object.keys(SEMANTIC_TOKEN_LEVELS).join("|")})\\b`,
    "gi"
);

// Matches [class="..."], [id~="..."], etc. Used to find the exact character
// span of an attribute's *value*, so a semantic-token match can be checked
// against a precise position instead of "is this token anywhere in the
// fragment" (which would also match a tag name that happens to share text
// with an unrelated attribute value, e.g. section[class$="section"]).
const ATTRIBUTE_VALUE_PATTERN = /\[(class|id)\s*(=|~=|\*=|\^=|\$=)\s*"([^"]*)"\]/gi;

export class SelectorScorer {

    private readonly rules: WeightedScoringRule<BuildedSelector>[];

    // Memoizes document.querySelectorAll(...).length for a given selector
    // string. getUniquenessScore() re-evaluates every container prefix of a
    // selector, so identical prefixes across many candidate selectors would
    // otherwise trigger the same DOM query repeatedly.
    private readonly matchCountCache = new Map<string, number>();

    constructor(rules: WeightedScoringRule<BuildedSelector>[] = []) {
        this.rules = rules;
    }

    /** Clears the DOM match-count cache. Call this if the DOM changes between scoring runs. */
    resetCache(): void {
        this.matchCountCache.clear();
    }

    score(selector: BuildedSelector): BuildedSelector {
        const fragmentScore = selector.fragmentScores.reduce((total, s) => total + s, 0);
        const ruleBreakdown = this.calculateRuleBreakdown(selector);
        const evaluation = this.buildEvaluation(selector, fragmentScore, ruleBreakdown.score);
        const finalScore = this.computeScore(evaluation);
        const normalizedScores = this.getNormalizedScores(evaluation);

        const debug = {
            parentCount: selector.selector.split(/\s+/).filter(Boolean).length,
            targetCount: selector.fragmentScores.length,
            semanticScore: evaluation.readabilityScore,
            uniquenessScore: evaluation.uniquenessScore,
            tagScore: this.getContextScore(selector),
            lengthScore: evaluation.lengthScore,
            ruleContribution: ruleBreakdown.score,
            finalScore,
            contributions: this.getScoreContributions(normalizedScores),
            rawScores: {
                uniqueness: evaluation.uniquenessScore,
                precision: evaluation.precisionScore,
                readability: evaluation.readabilityScore,
                concision: evaluation.concisionScore,
                length: evaluation.lengthScore,
                fragmentAverage: evaluation.fragmentAverageScore ?? 0,
                rules: evaluation.ruleScore
            },
            rules: ruleBreakdown.rules
        };

        return { ...selector, score: finalScore, evaluation, debug };
    }

    compare(left: BuildedSelector, right: BuildedSelector): number {
        const leftEvaluation = left.evaluation ?? this.buildEvaluation(left, 0, 0);
        const rightEvaluation = right.evaluation ?? this.buildEvaluation(right, 0, 0);

        const leftScore = this.computeScore(leftEvaluation);
        const rightScore = this.computeScore(rightEvaluation);

        if (leftScore > rightScore + 1e-9) return 1;
        if (rightScore > leftScore + 1e-9) return -1;

        // Only fall back to individual criteria when the final weighted
        // scores are effectively identical.
        const tieBreakers: Array<keyof SelectorEvaluation> = [
            "uniquenessScore", "readabilityScore", "precisionScore",
            "concisionScore", "lengthScore", "ruleScore"
        ];

        for (const criterion of tieBreakers) {
            const leftValue = leftEvaluation[criterion] as number;
            const rightValue = rightEvaluation[criterion] as number;

            if (leftValue > rightValue + 1e-9) return 1;
            if (rightValue > leftValue + 1e-9) return -1;
        }

        // Final fallback: shorter selector wins.
        if (left.selector.length === right.selector.length) return 0;
        return left.selector.length < right.selector.length ? -1 : 1;
    }

    private buildEvaluation(
        selector: BuildedSelector,
        fragmentScore: number,
        ruleScore: number
    ): SelectorEvaluation {
        const readabilityScore = this.getReadabilityScore(selector);
        const concisionScore = this.getConcisionScore(selector);
        const precisionScore = this.getPrecisionScore(fragmentScore, selector);
        const uniquenessScore = this.getUniquenessScore(selector);
        const lengthScore = this.getLengthScore(selector);
        const contextScore = this.getContextScore(selector);

        // Context acts as a minimum baseline; it must not erase the
        // semantic score computed above it.
        const effectiveReadability = Math.max(readabilityScore, contextScore * 0.85);
        const effectivePrecision = Math.max(precisionScore, contextScore);

        return {
            targetMatch: true,
            uniquenessScore,
            readabilityScore: effectiveReadability,
            concisionScore,
            precisionScore: effectivePrecision,
            lengthScore,
            ruleScore: clampScore(ruleScore),
            fragmentAverageScore: (uniquenessScore + effectivePrecision + effectiveReadability) / 3
        };
    }

    private computeScore(evaluation: SelectorEvaluation): number {
        const s = this.getNormalizedScores(evaluation);
        const w = SCORING_WEIGHTS.selector;

        // Main selector scoring priority:
        // Uniqueness > Precision > Readability > Concision > Rules > Length
        // Semantic order lives inside readability, so it carries far more
        // weight than raw selector length.
        const score =
            s.uniqueness * w.uniqueness +
            s.precision * w.precision +
            s.readability * w.readability +
            s.concision * w.concision +
            s.rules * w.rules +
            s.length * w.length;

        return clampScore(score);
    }

    private getNormalizedScores(evaluation: SelectorEvaluation): Record<string, number> {
        return {
            uniqueness: this.normalizeCriterion(evaluation.uniquenessScore, "uniqueness"),
            precision: this.normalizeCriterion(evaluation.precisionScore, "precision"),
            readability: this.normalizeCriterion(evaluation.readabilityScore, "readability"),
            concision: this.normalizeCriterion(evaluation.concisionScore, "concision"),
            length: this.normalizeCriterion(evaluation.lengthScore, "length"),
            rules: this.normalizeCriterion(evaluation.ruleScore, "rules")
        };
    }

    private getScoreContributions(normalizedScores: Record<string, number>): Record<string, number> {
        const w = SCORING_WEIGHTS.selector;
        return {
            uniqueness: normalizedScores.uniqueness * w.uniqueness,
            precision: normalizedScores.precision * w.precision,
            readability: normalizedScores.readability * w.readability,
            concision: normalizedScores.concision * w.concision,
            length: normalizedScores.length * w.length,
            rules: normalizedScores.rules * w.rules
        };
    }

    private normalizeCriterion(
        value: number,
        criterion: keyof typeof SCORING_WEIGHTS.selectorScoreRanges
    ): number {
        const range = SCORING_WEIGHTS.selectorScoreRanges[criterion];
        return range > 0 ? clampScore(value / range) : clampScore(value);
    }

    private calculateRuleBreakdown(selector: BuildedSelector): {
        score: number;
        rules: Record<string, RuleContribution>;
    } {
        if (!this.rules.length) {
            return { score: 0, rules: {} };
        }

        // Normalize rule weights so no single rule's absolute weight value
        // can make it dominate the others.
        const totalWeight = this.rules.reduce((total, { weight }) => total + Math.max(0, weight), 0);

        const rules: Record<string, RuleContribution> = {};

        this.rules.forEach(({ rule, weight, name }, index) => {
            const rawScore = clampScore(rule.apply(selector));
            const normalizedWeight = totalWeight > 0 ? Math.max(0, weight) / totalWeight : 0;
            const contribution = rawScore * normalizedWeight;

            rules[name ?? `rule-${index}`] = { rawScore, weight: normalizedWeight, contribution };
        });

        const score = Object.values(rules).reduce((total, entry) => total + entry.contribution, 0);

        return { score: clampScore(score), rules };
    }

    /* ========================================================= *
     * READABILITY
     * ========================================================= */

    private getReadabilityScore(selector: BuildedSelector): number {
        const raw = selector.selector.toLowerCase();

        if (GENERATED_IDENTIFIER_PATTERN.test(raw)) {
            return READABILITY.GENERATED_IDENTIFIER_SCORE;
        }

        const semanticMatches = this.getSemanticMatches(selector.selector);

        if (semanticMatches.length === 0) {
            return READABILITY.NO_SEMANTIC_TOKEN_SCORE;
        }

        const semanticCountScore = this.getSemanticCountScore(semanticMatches.length);
        const repetitionBonus = this.getSemanticRepetitionBonus(semanticMatches);
        const orderBonus = this.getSemanticOrderBonus(semanticMatches);
        const densityBonus = this.getSemanticDensityBonus(semanticMatches.length, raw.length);
        const coverageBonus = this.getSemanticCoverageBonus(selector, semanticMatches);
        const attributeBonus = this.getSemanticAttributeBonus(semanticMatches);
        const nonSemanticPenalty = this.getNonSemanticFragmentPenalty(selector, semanticMatches);

        return (
            semanticCountScore +
            repetitionBonus +
            orderBonus +
            densityBonus +
            coverageBonus +
            attributeBonus -
            nonSemanticPenalty
        );
    }

    private getSemanticMatches(selector: string): SemanticMatch[] {
        const fragments = selector.split(/\s+/).filter(Boolean);
        const matches: SemanticMatch[] = [];

        fragments.forEach((fragment, fragmentIndex) => {
            const attributeSpans = this.getAttributeValueSpans(fragment);

            // Reset lastIndex since the pattern is a shared global regex.
            SEMANTIC_TOKEN_PATTERN.lastIndex = 0;

            for (const match of fragment.matchAll(SEMANTIC_TOKEN_PATTERN)) {
                const token = match[1].toLowerCase();
                const position = match.index ?? 0;

                // Only credit THIS occurrence as an attribute match when it
                // physically sits inside an attribute value, e.g. the
                // "content" in [class="content"]. A tag name that merely
                // shares a fragment with an unrelated attribute selector
                // (e.g. the "section" tag in section[class$="section"])
                // must not inherit that attribute's bonus.
                const enclosingSpan = attributeSpans.find(
                    span => position >= span.start && position + token.length <= span.end
                );

                matches.push({
                    token,
                    position,
                    fragmentIndex,
                    attributeType: enclosingSpan?.attributeType,
                    operator: enclosingSpan?.operator
                });
            }
        });

        return matches;
    }

    /** Finds the character span (in `fragment`) of each attribute value, e.g. [class="content"]. */
    private getAttributeValueSpans(fragment: string): Array<{
        start: number;
        end: number;
        attributeType: "class" | "id";
        operator: "=" | "~=" | "*=" | "^=" | "$=";
    }> {
        const spans: Array<{
            start: number;
            end: number;
            attributeType: "class" | "id";
            operator: "=" | "~=" | "*=" | "^=" | "$=";
        }> = [];

        for (const match of fragment.matchAll(ATTRIBUTE_VALUE_PATTERN)) {
            const fullMatchStart = match.index ?? 0;
            const valueStart = fullMatchStart + match[0].indexOf('"') + 1;
            const valueEnd = valueStart + match[3].length;

            spans.push({
                start: valueStart,
                end: valueEnd,
                attributeType: match[1].toLowerCase() as "class" | "id",
                operator: match[2] as "=" | "~=" | "*=" | "^=" | "$="
            });
        }

        return spans;
    }

    private getNonSemanticFragmentPenalty(
        selector: BuildedSelector,
        semanticMatches: SemanticMatch[]
    ): number {
        const fragments = selector.selector.split(/\s+/).filter(Boolean);
        if (!fragments.length) return 0;

        const semanticFragments = new Set(semanticMatches.map(m => m.fragmentIndex));
        const nonSemanticFragmentCount = fragments.filter((_, i) => !semanticFragments.has(i)).length;

        // Keep this penalty small: it should distinguish selectors like
        // `section[id="content"] div[class*="mt"]`
        // from
        // `section[class$="section"] div[class~="content"]`
        // without overpowering uniqueness.
        return nonSemanticFragmentCount * READABILITY.NON_SEMANTIC_FRAGMENT_PENALTY;
    }

    private getSemanticAttributeBonus(semanticMatches: SemanticMatch[]): number {
        const { EXACT_CLASS_TOKEN, EXACT_IDENTIFIER, PREFIX_SUFFIX, CONTAINS } = READABILITY.ATTRIBUTE_BONUS;
        const MAX_SEMANTIC_LEVEL = 3;

        return semanticMatches.reduce((bonus, match) => {
            if (!match.attributeType) return bonus;

            const baseBonus =
                match.attributeType === "class" && match.operator === "~="
                    // [class~="content"] identifies a complete semantic class token.
                    ? EXACT_CLASS_TOKEN
                    : match.operator === "="
                        ? EXACT_IDENTIFIER
                        // Prefix/suffix matches remain useful but less explicit.
                        : match.operator === "^=" || match.operator === "$="
                            ? PREFIX_SUFFIX
                            // Contains match is weakest: it can match arbitrary/generated values.
                            : match.operator === "*="
                                ? CONTAINS
                                : 0;

            // A target-oriented word (e.g. "composition", "price") found
            // inside an attribute value is a much stronger, more direct
            // signal than a generic structural word (e.g. "section")
            // appearing there — scale the bonus by how specific the token is.
            const specificityScale = this.getSemanticLevel(match.token) / MAX_SEMANTIC_LEVEL;

            return bonus + baseBonus * specificityScale;
        }, 0);
    }

    private getSemanticCoverageBonus(
        selector: BuildedSelector,
        semanticMatches: SemanticMatch[]
    ): number {
        const fragments = selector.selector.split(/\s+/).filter(Boolean);
        if (fragments.length === 0 || semanticMatches.length === 0) return 0;

        const semanticFragments = new Set(semanticMatches.map(m => m.fragmentIndex));
        const coverage = semanticFragments.size / fragments.length;

        // Every fragment carrying semantic information makes the selector
        // easier to understand. Capped low since uniqueness/precision matter more.
        return coverage * READABILITY.COVERAGE_BONUS_MAX;
    }

    private getSemanticCountScore(semanticCount: number): number {
        // No hard cap: 1 token = 0.70, 2 = 0.80, 3 = 0.90, 4 = 1.00, 5 = 1.10...
        // Values above 1 are expected here; they get clamped once normalized
        // against SCORING_WEIGHTS.selectorScoreRanges downstream.
        return READABILITY.BASE_COUNT_SCORE + semanticCount * READABILITY.PER_TOKEN_COUNT_SCORE;
    }

    private getSemanticRepetitionBonus(semanticMatches: SemanticMatch[]): number {
        const occurrences = new Map<string, number>();

        for (const { token } of semanticMatches) {
            occurrences.set(token, (occurrences.get(token) ?? 0) + 1);
        }

        let bonus = 0;
        for (const count of occurrences.values()) {
            if (count > 1) bonus += (count - 1) * READABILITY.REPETITION_BONUS_PER_EXTRA;
        }

        return bonus;
    }

    private getSemanticOrderBonus(semanticMatches: SemanticMatch[]): number {
        if (semanticMatches.length < 2) return 0;

        let totalImprovement = 0;
        let totalPossibleImprovement = 0;

        for (let i = 1; i < semanticMatches.length; i++) {
            const previousLevel = this.getSemanticLevel(semanticMatches[i - 1].token);
            const currentLevel = this.getSemanticLevel(semanticMatches[i].token);

            // Positive: semantic specificity increases toward the target.
            // Negative: semantic specificity decreases toward the target.
            totalImprovement += currentLevel - previousLevel;
            totalPossibleImprovement += Math.max(previousLevel, currentLevel) - 1;
        }

        if (totalPossibleImprovement <= 0) return 0;

        const orderRatio = totalImprovement / totalPossibleImprovement;

        // Intentionally stronger than the length signal (length weight is
        // only 0.05, while semantic order lives inside readability at 0.20),
        // but still weaker than uniqueness and precision.
        return orderRatio * READABILITY.ORDER_BONUS_MAX;
    }

    private getSemanticLevel(token: string): number {
        return SEMANTIC_TOKEN_LEVELS[token] ?? 1;
    }

    private getSemanticDensityBonus(semanticCount: number, selectorLength: number): number {
        const density = semanticCount / Math.max(selectorLength, 1);
        return Math.min(density * READABILITY.DENSITY_MULTIPLIER, READABILITY.DENSITY_BONUS_MAX);
    }

    /* ========================================================= *
     * CONCISION / PRECISION / UNIQUENESS
     * ========================================================= */

    private getConcisionScore(selector: BuildedSelector): number {
        return this.scoreFromThresholds(
            selector.selector.length,
            CONCISION_THRESHOLDS,
            "maxLength",
            CONCISION_FALLBACK_SCORE
        );
    }

    private getPrecisionScore(fragmentScore: number, selector: BuildedSelector): number {
        const fragmentStrength = Math.max(0, fragmentScore / 20);
        const countPenalty =
            selector.selector.includes("[id*") || selector.selector.includes("[class*") ? 0.1 : 0;

        return Math.min(1, 0.35 + fragmentStrength - countPenalty);
    }

    private getUniquenessScore(selector: BuildedSelector): number {
        const parts = selector.selector.split(/\s+/).filter(Boolean);
        if (!parts.length) return 0;

        // Full selector is the main uniqueness signal.
        const fullMatchCount = this.getMatchCount(selector.selector);
        if (fullMatchCount === 0) return 0;

        const fullScore = this.getMatchCountScore(fullMatchCount);
        if (parts.length === 1) return fullScore;

        // Evaluate each container prefix separately. Container selection now happens
        // deterministically upstream (ContainerSelector), so `selector.selector` is
        // always at most 2 space-separated parts and this loop runs 0-or-1 times —
        // still correct, but the averaging below is effectively vestigial and could
        // be simplified in a follow-up.
        let currentSelector = "";
        let containerScore = 0;
        let containerCount = 0;

        for (let i = 0; i < parts.length - 1; i++) {
            currentSelector = currentSelector ? `${currentSelector} ${parts[i]}` : parts[i];

            const matchCount = this.getMatchCount(currentSelector);
            if (matchCount === 0) continue;

            containerScore += this.getMatchCountScore(matchCount);
            containerCount++;
        }

        if (containerCount === 0) return fullScore;

        const averageContainerScore = containerScore / containerCount;

        // Full selector: 90% weight, container average: 10% weight.
        return fullScore * 0.9 + averageContainerScore * 0.1;
    }

    private getMatchCount(selector: string): number {
        const cached = this.matchCountCache.get(selector);
        if (cached !== undefined) return cached;

        let count: number;
        try {
            count = document.querySelectorAll(selector).length;
        } catch {
            count = 0;
        }

        this.matchCountCache.set(selector, count);
        return count;
    }

    private getMatchCountScore(matchCount: number): number {
        if (matchCount <= 0) return 0;
        return this.scoreFromThresholds(matchCount, MATCH_COUNT_THRESHOLDS, "maxCount", MATCH_COUNT_FALLBACK_SCORE);
    }

    /* ========================================================= *
     * CONTEXT / LENGTH
     * ========================================================= */

    private getContextScore(selector: BuildedSelector): number {
        const raw = selector.selector.toLowerCase();
        const hasStructuralTag = STRUCTURAL_TAG_PATTERN.test(raw);
        const hasExplicitIdentifier = EXPLICIT_IDENTIFIER_PATTERN.test(raw);

        if (hasStructuralTag && hasExplicitIdentifier) return 0.95;
        if (hasStructuralTag) return 0.8;
        if (hasExplicitIdentifier) return 0.7;
        return 0.5;
    }

    private getLengthScore(selector: BuildedSelector): number {
        // Length is deliberately a weak criterion: a semantically good
        // selector should not be heavily penalized just for being longer.
        return this.scoreFromThresholds(
            selector.selector.length,
            LENGTH_THRESHOLDS,
            "maxLength",
            LENGTH_FALLBACK_SCORE
        );
    }

    /**
     * Generic helper: returns the score of the first threshold whose bound
     * is >= value, or the fallback score if none match. Threshold lists are
     * expected to be sorted ascending by their bound.
     */
    private scoreFromThresholds<K extends string>(
        value: number,
        thresholds: ReadonlyArray<Record<K, number> & { score: number }>,
        boundKey: K,
        fallback: number
    ): number {
        for (const threshold of thresholds) {
            if (value <= threshold[boundKey]) return threshold.score;
        }
        return fallback;
    }
}