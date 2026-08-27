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

            // attribute.tokens is a lowercased pool (see tokenizeAttribute); value keeps
            // its original casing, so this must compare case-insensitively too — otherwise
            // any token that only appears capitalized in this specific value (e.g. "form"
            // from a PascalCase class like "MuiFormGroup-root") is silently dropped from
            // its own candidate, even though it's a perfectly usable, readable fragment.
            const lowerCaseValue = value.toLowerCase();
            const tokens = attribute.tokens.filter(token => lowerCaseValue.includes(token));

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