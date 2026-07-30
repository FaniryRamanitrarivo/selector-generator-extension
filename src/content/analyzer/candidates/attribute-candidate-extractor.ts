import type { DOMAttribute } from "../attributes/attribute";
import type { AttributeCandidate } from "../scoring/attribute-candidature";
import { isUsefulDataAttribute, shouldIgnoreAttribute, shouldIgnoreAttributeValue } from "../attributes/attribute-policy";


export function extractAttributeCandidates(
    attributes: DOMAttribute[],
    tagName?: string
): AttributeCandidate[] {

    return attributes.flatMap(attribute => {
        if (shouldIgnoreAttribute(attribute.name)) {
            return [];
        }

        if (attribute.name.startsWith("data-") && !isUsefulDataAttribute(attribute.name)) {
            return [];
        }

        return attribute.values.flatMap(value => {
            if (shouldIgnoreAttributeValue(value)) {
                return [];
            }

            const tokens = attribute.tokens.filter(token => value.includes(token));

            return [{
                name: attribute.name,
                category: attribute.category,
                value,
                tokens,
                score: 0,
                tagName
            }];
        });
    });

}