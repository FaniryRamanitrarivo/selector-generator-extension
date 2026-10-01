const IGNORED_ATTRIBUTE_NAMES = new Set([
    "href",
    "src",
    "srcset",
    "style",
    "onclick",
    "onchange",
    "onmouseover",
    "onmouseout",
    "integrity",
    "nonce",
    "crossorigin",
    "ping",
    "sizes",
    "fetchpriority",
    "loading",
    "decoding",
    "referrerpolicy",

    // Legacy presentational HTML attributes — the pre-CSS equivalent of `style`,
    // already excluded above. Pure layout/visual noise with zero semantic meaning,
    // and frequently shared identically across many unrelated elements (e.g. every
    // thumbnail on a page carrying the same width="300"), so they add candidates
    // without ever adding distinguishing value.
    "width",
    "height",
    "border",
    "align",
    "valign",
    "bgcolor",
    "color",
    "cellpadding",
    "cellspacing",
    "hspace",
    "vspace",

    // alt text is accessibility/SEO copy tied to this specific piece of content
    // (e.g. a product photo's alt describes *that* product) — selecting on it
    // produces a selector that only works for this one element/page, not a
    // reusable "the product image" selector. See attribute-policy.ts's design
    // goal: selectors should stay valid across minor DOM/content changes.
    "alt",

    // `open` on <details> is a live-toggled state attribute (set/removed by the
    // browser itself when the user expands/collapses it) — see VOLATILE_ARIA_ATTRIBUTES
    // below for the same concern applied to aria-* equivalents.
    "open"
]);

// WAI-ARIA Authoring Practices call for updating these on *every* user interaction
// with accordion/tab/menu/combobox/dialog-style components (aria-expanded when a
// panel opens/closes, aria-selected/aria-checked/aria-pressed on selection, aria-current
// on navigation, aria-hidden/aria-busy/aria-invalid as state changes). A selector built
// from one of these values is only valid for as long as that specific state holds —
// the opposite of "robust to minor DOM changes" (see CLAUDE.md's design goals). Unlike
// a generated-looking value, there's nothing about "true"/"false" that flags it as
// unstable, so this has to be an explicit exclusion rather than something the existing
// generated-token/serialized-value heuristics could ever catch.
const VOLATILE_ARIA_ATTRIBUTES = new Set([
    "aria-expanded",
    "aria-selected",
    "aria-checked",
    "aria-pressed",
    "aria-current",
    "aria-hidden",
    "aria-busy",
    "aria-invalid",
    "aria-activedescendant",
    "aria-valuenow",
    "aria-valuetext",
    "aria-grabbed"
]);

const SERIALIZED_VALUE_PATTERNS = [
    /^\{.*\}$/s,
    /^\[.*\]$/s,
    /"[^"]*"\s*:/,
    /'[^']*'\s*:/,
    /^<[^>]+>$/,
    /^https?:\/\//,
    /\b(json|object|array)\b/i
];

export function shouldIgnoreAttribute(name: string): boolean {
    if (name.startsWith("on")) {
        return true;
    }

    return IGNORED_ATTRIBUTE_NAMES.has(name) || VOLATILE_ARIA_ATTRIBUTES.has(name);
}

export function shouldIgnoreAttributeValue(value: string): boolean {
    if (!value) {
        return true;
    }

    const normalized = value.trim();

    if (!normalized) {
        return true;
    }

    if (normalized.length > 120) {
        return true;
    }

    return SERIALIZED_VALUE_PATTERNS.some(pattern => pattern.test(normalized));
}

export function isUsefulDataAttribute(name: string): boolean {
    if (!name.startsWith("data-")) {
        return false;
    }

    return ["data-testid", "data-cy", "data-role", "data-qa"].includes(name);
}
