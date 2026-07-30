export interface SelectorEvaluation {

    targetMatch: boolean;

    uniquenessScore: number;

    readabilityScore: number;

    concisionScore: number;

    precisionScore: number;

    lengthScore: number;

    ruleScore: number;

    fragmentAverageScore?: number;

}
