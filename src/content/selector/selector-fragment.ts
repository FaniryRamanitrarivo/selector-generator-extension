export interface SelectorFragment {

    selector: string;

    score: number;

    operator?: "exact" | "contains" | "containsWord" | "startsWith" | "endsWith";

    token?: string;

    resultCount?: number;

}