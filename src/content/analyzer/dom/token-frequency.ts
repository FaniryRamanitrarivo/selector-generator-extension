import { tokenizeAttribute } from "@/content/analyzer/attributes/attribute-tokenizer";
import { queryAllDeep } from "@/content/analyzer/dom/deep-query";

// Page-wide count of how many elements carry each class/id token — a domain-agnostic
// complement to the curated word list in semantic-vocabulary.ts (see FragmentScorer's
// rarity term). A token that appears on only a handful of elements across the whole page
// is structurally more likely to identify a specific section or piece of content than one
// shared by hundreds of elements (e.g. a Tailwind utility class like "flex" or "mt-2") —
// regardless of whether it happens to be an English business word the curated vocabulary
// recognizes. This matters most where that vocabulary has little to say: non-e-commerce
// domains, or utility-CSS-heavy markup with few or no semantic class names at all.
//
// Cached per-document for the duration of one generate() run, mirroring deep-query.ts's
// cachedRoots — walking every element's class/id list is the next most expensive part of
// generation after the shadow-root walk itself, and many fragment candidates across the
// run end up looking up the same handful of tokens repeatedly.
let cached: { doc: Document; counts: Map<string, number>; elementCount: number } | null = null;

function buildFrequency(): { counts: Map<string, number>; elementCount: number } {
    const counts = new Map<string, number>();
    const elements = queryAllDeep("*");

    for (const element of elements) {
        // A token counts once per element even if it's repeated across class *and* id,
        // or appears twice in the class list — this measures how many elements a token
        // could disambiguate against, not how many times it's written.
        const seenOnThisElement = new Set<string>();

        const addToken = (token: string) => {
            if (seenOnThisElement.has(token)) return;
            seenOnThisElement.add(token);
            counts.set(token, (counts.get(token) ?? 0) + 1);
        };

        // Optional chaining is required, not defensive style: some existing test mocks
        // stub querySelectorAll("*") to return placeholder (non-Element, even undefined)
        // entries — see deep-query.ts's collectRoots for the same pattern. className is
        // also SVGAnimatedString (not a plain string) on real SVG elements.
        const className = typeof element?.className === "string" ? element.className : "";
        const id = typeof element?.id === "string" ? element.id : "";

        for (const token of tokenizeAttribute(className)) addToken(token);
        for (const token of tokenizeAttribute(id)) addToken(token);
    }

    return { counts, elementCount: elements.length };
}

function getFrequency(): { counts: Map<string, number>; elementCount: number } {
    if (!cached || cached.doc !== document) {
        const { counts, elementCount } = buildFrequency();
        cached = { doc: document, counts, elementCount };
    }

    return cached;
}

export function getTokenOccurrenceCount(token: string): number {
    return getFrequency().counts.get(token.toLowerCase()) ?? 0;
}

export function getPageElementCount(): number {
    return getFrequency().elementCount;
}

// Call once at the start of a selector-generation run, alongside resetDeepQueryCache() —
// see that module's comment for why this exists.
export function resetTokenFrequencyCache(): void {
    cached = null;
}
