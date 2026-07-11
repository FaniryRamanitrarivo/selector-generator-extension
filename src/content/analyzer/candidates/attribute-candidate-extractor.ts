import type { DOMAttribute } from "../attributes/attribute";
import type { AttributeCandidate } from "../scoring/attribute-candidature";



export function extractAttributeCandidates(
    attributes: DOMAttribute[]
): AttributeCandidate[] {


    return attributes.flatMap(attribute => {


        return attribute.values.map(value => {


            const tokens =
                attribute.tokens.filter(token =>
                    value.includes(token)
                );


            return {

                name: attribute.name,

                category: attribute.category,

                value,

                tokens,

                score: 0

            };

        });

    });

}