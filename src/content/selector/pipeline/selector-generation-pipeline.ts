import type { DOMContext } from "../../analyzer/dom-context";
import { extractAttributeCandidates } from "../../analyzer/candidates/attribute-candidate-extractor";
import { AttributeScorer } from "../../analyzer/scoring/attribute-scorer";
import { CategoryRule } from "@/content/analyzer/scoring/rules/category-rule";
import { SemanticAttributeRule } from "@/content/analyzer/scoring/rules/semantic-attribute-rule";
import { TagNameRule } from "@/content/analyzer/scoring/rules/tagname-rule";
import { generateCSSFragments } from "../css/css-fragment-generator";
import { FragmentScorer } from "../scoring/fragment-scorer";
import { SelectorBuilder } from "../builder/selector-builder";
import { SelectorGenerator } from "../selector-generator";
import { SelectorValidator } from "../validator/selector-validator";
import { SelectorScorer } from "@/content/analyzer/scoring/selector-scorer";
import { SelectorLengthRule } from "@/content/analyzer/scoring/rules/selector-length-rule";
import { SelectorCountNormalizer } from "@/content/analyzer/scoring/selector-count-normalizer";
import type { SelectorPart } from "../selector-part";

export class SelectorGenerationPipeline {

    private readonly attributeScorer: AttributeScorer;
    private readonly fragmentScorer: FragmentScorer;
    private readonly builder: SelectorBuilder;
    private readonly selectorGenerator: SelectorGenerator;
    private readonly selectorScorer: SelectorScorer;
    private readonly countNormalizer: SelectorCountNormalizer;

    constructor() {
        this.attributeScorer = new AttributeScorer([
            { rule: new CategoryRule(), weight: 50 },
            { rule: new SemanticAttributeRule(), weight: 30 },
            { rule: new TagNameRule(), weight: 20 }
        ]);

        this.fragmentScorer = new FragmentScorer();
        this.builder = new SelectorBuilder();
        this.selectorGenerator = new SelectorGenerator(new SelectorValidator());
        this.selectorScorer = new SelectorScorer([
            { rule: new SelectorLengthRule(), weight: 5 }
        ]);
        this.countNormalizer = new SelectorCountNormalizer();
    }

    generate(
        context: DOMContext,
        target: HTMLElement
    ) {
        const parts = this.buildParts(context);
        const selectors = this.builder.build(parts);
        const scoredSelectors = selectors
            .map(selector => this.selectorScorer.score(selector))
            .sort((a, b) => b.score - a.score);

        const generated = this.selectorGenerator.generate(scoredSelectors, target);
        const normalized = this.countNormalizer.normalize(generated);

        return normalized
            .sort((a, b) => b.score - a.score)
            .slice(0, 100);
    }

    private buildParts(context: DOMContext): SelectorPart[] {
        return [...[...context.ancestors].reverse(), context.element].map(node => {
            const candidates = extractAttributeCandidates(node.attributes, node.tagname)
                .map(candidate => this.attributeScorer.score(candidate));

            const bestCandidates = [...candidates]
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);

            const fragments = bestCandidates
                .flatMap(candidate =>
                    generateCSSFragments(candidate).map(fragment =>
                        this.fragmentScorer.score(fragment, candidate, node.tagname)
                    )
                )
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

            return {
                tagName: node.tagname,
                fragments,
                score: 0
            };
        });
    }
}
