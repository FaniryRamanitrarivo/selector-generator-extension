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
    "referrerpolicy"
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

    return IGNORED_ATTRIBUTE_NAMES.has(name);
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
