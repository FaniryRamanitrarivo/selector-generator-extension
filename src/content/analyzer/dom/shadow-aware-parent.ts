// `.parentElement` alone stops dead at the top of a shadow tree (a ShadowRoot is not
// an Element, so its children's `.parentElement` is null) — this crosses that boundary
// by falling back to the shadow root's host, letting a caller keep climbing into the
// light DOM. Only used where climbing out of the shadow root is actually wanted (dev-mode
// ancestor adjustment); buildDOMContext deliberately does NOT use this, since confining
// container candidates to the target's own shadow tree is what makes combined selectors
// valid (CSS combinators can't cross a shadow boundary either).
export function getParentAcrossShadow(element: Element): Element | null {

    const parent = element.parentElement;

    if (parent) {
        return parent;
    }

    const parentNode = element.parentNode;

    // typeof-guarded: ShadowRoot isn't a global in every environment this code runs in
    // (e.g. plain jsdom test setups that never touch shadow DOM) — without the guard,
    // referencing the bare identifier throws a ReferenceError there instead of just
    // correctly reporting "not a shadow boundary".
    return typeof ShadowRoot !== "undefined" && parentNode instanceof ShadowRoot
        ? parentNode.host
        : null;

}
