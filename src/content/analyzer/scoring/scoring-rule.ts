export interface ScoringRule<T> {

    apply(candidate: T): number;

}