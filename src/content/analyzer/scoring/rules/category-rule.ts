import { ATTRIBUTE_CATEGORIES } from "../../attributes/attribute-category";

import type { ScoringRule } from "../scoring-rule";

export class CategoryRule implements ScoringRule {

    apply(candidate) {

        switch(candidate.category) {

            case ATTRIBUTE_CATEGORIES.DATA:
                return 100;

            
            case ATTRIBUTE_CATEGORIES.ID:
                return 90;

            
            case ATTRIBUTE_CATEGORIES.NAME:
                return 80;

            
            case ATTRIBUTE_CATEGORIES.DATA:
                return 70;

            
            case ATTRIBUTE_CATEGORIES.CLASS:
                return 60;

            
            default:
                return 10;            

        }


    }

}


