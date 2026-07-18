import type { ScoringRule } from "./scoring-rule";

export interface WeightedScoringRule<T> {

    rule: ScoringRule<T>;

    weight: number;

}