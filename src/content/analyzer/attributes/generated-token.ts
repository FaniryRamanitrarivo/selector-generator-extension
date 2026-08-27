// Shared detector for tokens/values that look machine-generated rather than
// author-written — css-in-js hashes (styled-components, emotion/MUI "css-"
// classes), bundler-generated ids, raw hex/uuid strings, purely numeric
// segments. These are unstable (regenerate on rebuild) and meaningless to a
// human reading the selector, so both attribute-level scoring
// (SemanticAttributeRule) and fragment-level scoring (FragmentScorer) need to
// agree on what counts as "generated-looking" — duplicating the patterns in
// each file would let them silently drift apart.
const GENERATED_TOKEN_PATTERNS = [
    /^(css|react|chakra|mui|mantine|ember|vue|next)-/i,
    /^([a-f0-9]{6,}|uuid|random|hash|hashes)$/i,
    /^\d+$/,
    /[0-9]{4,}/
];

export function isGeneratedLikeToken(value: string): boolean {
    return GENERATED_TOKEN_PATTERNS.some(pattern => pattern.test(value));
}
