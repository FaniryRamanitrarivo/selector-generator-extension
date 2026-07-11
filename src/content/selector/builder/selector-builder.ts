import type { SelectorPart } from "../selector-part";

export class SelectorBuilder {

    build(
        parts: SelectorPart[]
    ): string {

        return parts    
            .map(part => {

                let selector = "";

                if(part.tagName)
                    selector += part.tagName;

                if(part.fragment) 
                    selector += part.fragment.selector

                return selector;

            })
            .join(" ");

    }

}