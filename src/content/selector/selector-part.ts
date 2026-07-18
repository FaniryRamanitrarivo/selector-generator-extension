import type { SelectorFragment } from "./selector-fragment";

export interface SelectorPart {

    tagName?: string;

    fragments?: SelectorFragment[];

    score: number;

}