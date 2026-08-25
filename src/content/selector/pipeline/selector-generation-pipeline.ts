import type { DOMContext, ElementNodeContext } from "../../analyzer/dom-context";
import { buildNodeFragmentCandidates } from "../../analyzer/candidates/node-fragment-candidates";
import { AttributeScorer } from "../../analyzer/scoring/attribute-scorer";
import { CategoryRule } from "@/content/analyzer/scoring/rules/category-rule";
import { SemanticAttributeRule } from "@/content/analyzer/scoring/rules/semantic-attribute-rule";
import { TagNameRule } from "@/content/analyzer/scoring/rules/tagname-rule";
import { FragmentScorer } from "../scoring/fragment-scorer";
import { SelectorBuilder } from "../builder/selector-builder";
import { SelectorGenerator } from "../selector-generator";
import { SelectorValidator } from "../validator/selector-validator";
import { SelectorScorer } from "@/content/analyzer/scoring/selector-scorer";
import { SelectorLengthRule } from "@/content/analyzer/scoring/rules/selector-length-rule";
import { SelectorCountNormalizer } from "@/content/analyzer/scoring/selector-count-normalizer";
import { ContainerSelector } from "../container/container-selector";
import type { SelectorPart } from "../selector-part";

export class SelectorGenerationPipeline {

    private readonly attributeScorer: AttributeScorer;
    private readonly fragmentScorer: FragmentScorer;
    private readonly builder: SelectorBuilder;
    private readonly selectorGenerator: SelectorGenerator;
    private readonly selectorScorer: SelectorScorer;
    private readonly countNormalizer: SelectorCountNormalizer;
    private readonly containerSelector: ContainerSelector;

    constructor() {
        this.attributeScorer = new AttributeScorer([
            { rule: new CategoryRule(), weight: 50 },
            { rule: new SemanticAttributeRule(), weight: 40 },
            { rule: new TagNameRule(), weight: 20 }
        ]);

        this.fragmentScorer = new FragmentScorer();
        this.builder = new SelectorBuilder();
        this.selectorGenerator = new SelectorGenerator(new SelectorValidator());
        this.selectorScorer = new SelectorScorer([
            { rule: new SelectorLengthRule(), weight: 5 }
        ]);
        this.countNormalizer = new SelectorCountNormalizer();
        this.containerSelector = new ContainerSelector(this.attributeScorer, this.fragmentScorer);
    }

    generate(
        context: DOMContext,
        target: HTMLElement,
        options: { multiResultMode?: boolean } = {}
    ) {
        const multiResultMode = options.multiResultMode ?? false;
        const targetPart = this.buildTargetPart(context.element, multiResultMode);
        const containerSelection = this.containerSelector.select(context, multiResultMode);

        const parts: SelectorPart[] = containerSelection
            ? [containerSelection.part, targetPart]
            : [targetPart];

        const selectors = this.builder.build(parts);
        const scoredSelectors = selectors
            .map(selector => this.selectorScorer.score(selector))
            .sort((a, b) => this.selectorScorer.compare(b, a));

        const generated = this.selectorGenerator.generate(scoredSelectors, target);
        const normalized = this.countNormalizer.normalize(generated, options);

        return normalized
            .sort((a, b) => b.score - a.score)
            .slice(0, 100);
    }

    private buildTargetPart(node: ElementNodeContext, multiResultMode: boolean): SelectorPart {
        const fragments = buildNodeFragmentCandidates(node, this.attributeScorer, this.fragmentScorer, multiResultMode)
            .map(({ fragment }) => fragment)
            .slice(0, 5);

        return {
            tagName: node.tagname,
            fragments,
            score: 0
        };
    }
}
