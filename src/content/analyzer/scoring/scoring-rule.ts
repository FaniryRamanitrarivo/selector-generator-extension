import type { AttributeCandidate } from "./attribute-candidature";

export interface ScoringRule {

    apply(
        candidate: AttributeCandidate
    ): number;

}


