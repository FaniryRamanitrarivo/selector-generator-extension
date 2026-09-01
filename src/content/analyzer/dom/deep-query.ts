// A plain `document.querySelectorAll` never sees elements encapsulated inside an open
// shadow root — this also searches every open shadow root nested (at any depth) under
// `root` so uniqueness scoring/validation isn't blind to shadow-DOM content. Closed
// shadow roots are deliberately invisible (no `.shadowRoot` access) — an accepted
// limitation, not a bug: that's the whole point of "closed".
//
// `root` defaults to `document` at every real call site rather than being threaded
// through from the target's own root — this can only ever find *more* matches than the
// target's own tree would (never fewer), so at worst it makes a genuinely-unique
// fragment look non-unique and falls back to a more verbose one; it can never falsely
// report uniqueness.

// Discovering the shadow tree (walking every element via `querySelectorAll("*")`,
// recursively into each shadow root found) is by far the most expensive part of this
// module — and a single selector-generation run validates hundreds of selector strings
// against the same, unchanged document (see ContainerSelector's combined-fragment
// fallback pass). Re-walking the whole tree for every one of those selectors is what
// made generation visibly stall on large/deep pages. The shape of the shadow tree can't
// change mid-selector-string-comparison, so it's cached here, keyed on the live
// `document` reference — a new page (or a fresh jsdom instance in tests) invalidates it
// for free. `resetDeepQueryCache()` is also called explicitly at the start of every
// `SelectorGenerationPipeline.generate()` run as a safety net against the page's shadow
// DOM changing between two separate inspections of the same page.
let cachedRoots: { doc: ParentNode; roots: ParentNode[] } | null = null;

function collectRoots(root: ParentNode, acc: ParentNode[]): void {

    acc.push(root);

    for (const element of Array.from(root.querySelectorAll("*"))) {

        // Optional chaining is required, not defensive style: some existing test
        // mocks stub querySelectorAll to return placeholder (non-Element) entries
        // for any selector, including "*".
        if (element?.shadowRoot) {
            collectRoots(element.shadowRoot, acc);
        }

    }

}

function getRoots(root: ParentNode): ParentNode[] {

    if (root === document) {

        if (!cachedRoots || cachedRoots.doc !== document) {
            const roots: ParentNode[] = [];
            collectRoots(root, roots);
            cachedRoots = { doc: document, roots };
        }

        return cachedRoots.roots;

    }

    // Not the common (default) case — never cached, always walked fresh.
    const roots: ParentNode[] = [];
    collectRoots(root, roots);
    return roots;

}

// Call once at the start of a selector-generation run, before any queryAllDeep call —
// see the module-level comment for why this exists.
export function resetDeepQueryCache(): void {
    cachedRoots = null;
}

export function queryAllDeep(selector: string, root: ParentNode = document): Element[] {

    const matches: Element[] = [];

    for (const scopedRoot of getRoots(root)) {

        try {
            matches.push(...Array.from(scopedRoot.querySelectorAll(selector)));
        } catch {
            // Invalid selector — skip this scope, same as every other scope.
        }

    }

    return matches;

}
