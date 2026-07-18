import type { SelectorPart } from "@/content/selector/selector-part";
import type { ScoringRule } from "../scoring-rule";


export class ContainerUniquenessRule
    implements ScoringRule<SelectorPart> {


    apply(
        part: SelectorPart
    ): number {

        if (!part.fragments?.length) {
            return 0;
        }


        const selector =
            `${part.tagName}${part.fragments[0].selector}`;


        const count =
            document.querySelectorAll(selector).length;


        if (count === 1) {
            return 1;
        }


        if (count < 5) {
            return 0.8;
        }


        if (count < 20) {
            return 0.5;
        }


        return 0.1;

    }

}