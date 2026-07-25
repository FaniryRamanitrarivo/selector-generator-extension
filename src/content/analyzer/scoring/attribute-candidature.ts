import type { AttributeCategory } from "../attributes/attribute-category";

export interface AttributeCandidate {

    name: string;

    category: AttributeCategory;

    value: string;

    tokens: string[];

    score: number;

    tagName?: string;

}


