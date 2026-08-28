export interface GeneratedSelector {

    selector: string;

    count: number;

    score: number;

    countScore: number;

    matchesTarget?: boolean;

    // True when the target lives inside a shadow root — the selector string is only
    // valid queried against that shadow root's local scope (e.g.
    // `hostElement.shadowRoot.querySelector(...)`), never via plain `document.querySelector`,
    // since CSS combinators can't cross a shadow boundary. Surfaced so the sidebar can warn
    // the user instead of silently handing back something that looks like a normal selector.
    insideShadowRoot?: boolean;

    debug?: {
        parentCount?: number;
        targetCount?: number;
        semanticScore?: number;
        uniquenessScore?: number;
        tagScore?: number;
        lengthScore?: number;
        finalScore?: number;
    };

}