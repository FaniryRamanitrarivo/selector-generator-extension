// A plain `document.querySelectorAll` never sees elements encapsulated inside an open
// shadow root — this recurses into every open shadow host found under `root` (shadow
// trees can nest, hence the recursion) so uniqueness scoring/validation isn't blind to
// shadow-DOM content. Closed shadow roots are deliberately invisible (no `.shadowRoot`
// access) — an accepted limitation, not a bug: that's the whole point of "closed".
//
// `root` defaults to `document` at every call site rather than being threaded through
// from the target's own root — this can only ever find *more* matches than the target's
// own tree would (never fewer), so at worst it makes a genuinely-unique fragment look
// non-unique and falls back to a more verbose one; it can never falsely report uniqueness.
export function queryAllDeep(selector: string, root: ParentNode = document): Element[] {

    let matches: Element[];

    try {
        matches = Array.from(root.querySelectorAll(selector));
    } catch {
        return [];
    }

    for (const element of Array.from(root.querySelectorAll("*"))) {

        // Optional chaining is required, not defensive style: some existing test
        // mocks stub querySelectorAll to return placeholder (non-Element) entries
        // for any selector, including "*".
        if (element?.shadowRoot) {
            matches.push(...queryAllDeep(selector, element.shadowRoot));
        }

    }

    return matches;

}
