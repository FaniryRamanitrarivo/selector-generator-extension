import type { GeneratedSelector } from "@/content/selector/generated-selector";


export class SelectorCountNormalizer {


    normalize(
        selectors: GeneratedSelector[]
    ): GeneratedSelector[] {


        return selectors.map(selector => {


            const countScore =
                1 / Math.max(
                    1,
                    selector.count
                );


            return {

                ...selector,

                countScore,

                score:
                    selector.score *
                    countScore

            };

        });

    }

}