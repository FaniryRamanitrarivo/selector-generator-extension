export interface GeneratedSelector {

    selector: string;

    count: number;

    score: number;

    countScore: number;

    matchesTarget?: boolean;

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