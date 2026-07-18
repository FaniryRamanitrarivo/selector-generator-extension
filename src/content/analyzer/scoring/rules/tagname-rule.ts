import type { ScoringRule } from "../scoring-rule";

const TAG_SCORES = new Map([
    ["main", 1],
    ["article", 1],
    ["section", 0.9],
    ["aside", 0.8],
    ["nav", 0.8],
    ["header", 0.7],
    ["footer", 0.7],
    ["form", 0.7],
    ["ul", 0.6],
    ["ol", 0.6],
    ["table", 0.6],
    ["li", 0.5],
    ["figure", 0.5],
    ["picture", 0.5],
    ["span", 0.3],
    ["p", 0.2],
    ["a", 0.2],
    ["div", 0.1],
]);

export class TagNameRule implements ScoringRule {

    apply(candidate): number {

        return TAG_SCORES.get(
            candidate.tagName
        ) ?? 0;

    }

}