import { ATTRIBUTE_CATEGORIES } from "../../attributes/attribute-category";

import type { AttributeCandidate } from "../attribute-candidature";
import type { ScoringRule } from "../scoring-rule";


export class CategoryRule
    implements ScoringRule<AttributeCandidate> {


    apply(
        candidate: AttributeCandidate
    ): number {

        switch (candidate.category) {

            case ATTRIBUTE_CATEGORIES.DATA:
                return 1;

            case ATTRIBUTE_CATEGORIES.ID:
                return 0.9;

            case ATTRIBUTE_CATEGORIES.NAME:
                return 0.8;

            case ATTRIBUTE_CATEGORIES.ROLE:
                return 0.7;

            case ATTRIBUTE_CATEGORIES.CLASS:
                return 0.6;

            default:
                return 0.1;

        }

    }

}