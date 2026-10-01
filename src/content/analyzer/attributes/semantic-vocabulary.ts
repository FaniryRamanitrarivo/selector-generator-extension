// Single shared source of "does this word carry business/content meaning" used across
// every scoring stage (SemanticAttributeRule for container sectioning, FragmentScorer
// for individual CSS fragments, SelectorScorer for the final selector's readability).
// Before this module existed each of those three files kept its own hand-written word
// list; they drifted apart (e.g. "header"/"footer"/"menu" counted as a *strong* signal
// in one file and a *generic/structural* one in another, "summary" was "important" in
// one file and merely "structural" in another) — tuning one stage's vocabulary silently
// left the others inconsistent. Consolidating here means there is exactly one place to
// add a new domain word, and every stage agrees on what it means.
//
// Tier meaning (mirrors the ordering a selector should read in, generic -> precise):
// 1 = generic / structural context — says nothing about *what* is inside (page, main,
//     header, a bare "container"/"button" class, ...). Matching one of these alone
//     should not be treated as a strong semantic signal anywhere.
// 2 = contextual information — narrows down to a generic container of information
//     (content, details, gallery, cart, ...) without saying precisely what that
//     information is.
// 3 = target-oriented information — names the exact piece of content being targeted
//     (product, price, title, a specific attribute like size/color/brand, ...).
export type SemanticTier = 1 | 2 | 3;

export const SEMANTIC_VOCABULARY: Readonly<Record<string, SemanticTier>> = {
    // Tier 1 — generic / structural context.
    page: 1, pages: 1, main: 1, header: 1, footer: 1,
    sidebar: 1, navigation: 1, nav: 1, section: 1, menu: 1,
    container: 1, button: 1,

    // Tier 2 — contextual information.
    content: 2, information: 2, info: 2, details: 2, detail: 2,
    gallery: 2, hero: 2, cart: 2, summary: 2, overview: 2,

    // Tier 3 — target-oriented information. Domain-specific descriptors (composition,
    // care, brand, manufacturer, category) belong here too — they're just as precise
    // as price/title.
    product: 3, products: 3, item: 3, items: 3, title: 3, name: 3,
    price: 3, description: 3, category: 3, categories: 3, brand: 3, manufacturer: 3,
    composition: 3, care: 3, size: 3, taille: 3, talla: 3, sku: 3,
    image: 3, images: 3,
    color: 3, colour: 3, couleur: 3
} as const;

export function getSemanticTier(token: string): SemanticTier | undefined {
    return SEMANTIC_VOCABULARY[token.toLowerCase()];
}

const VOCABULARY_WORDS = Object.keys(SEMANTIC_VOCABULARY);

// A string that merely *contains* a vocabulary word (e.g. "product-id" containing
// "product") is a weaker signal than matching one exactly, but still worth crediting —
// e.g. for an attribute value that wasn't already split into tokens. Returns the
// highest tier found among vocabulary words contained in `value` (tier 3 wins over 2).
export function getBestContainedTier(value: string): SemanticTier | undefined {
    const normalized = value.toLowerCase();
    let best: SemanticTier | undefined;

    for (const word of VOCABULARY_WORDS) {
        if (!normalized.includes(word)) continue;

        const tier = SEMANTIC_VOCABULARY[word];

        if (tier === 3) return 3;
        if (!best || tier > best) best = tier;
    }

    return best;
}

// A token is "significant" when it names the target's content directly (tier 3) rather
// than merely a generic wrapper or a contextual-but-vague container — see ContainerSelector,
// which uses this to decide whether a fragment's single token is strong enough on its own
// to not need "borrowing" credit from sibling tokens on the same attribute.
export function isSignificantToken(token: string): boolean {
    return getSemanticTier(token) === 3;
}
