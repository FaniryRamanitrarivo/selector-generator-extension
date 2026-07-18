import type { DOMContext } from "../../analyzer/dom-context";

import {
    extractAttributeCandidates
} from "../../analyzer/candidates/attribute-candidate-extractor";

import {
    AttributeScorer
} from "../../analyzer/scoring/attribute-scorer";

import {
    generateCSSFragments
} from "../css/css-fragment-generator";

import {
    SelectorBuilder
} from "../builder/selector-builder";

import {
    SelectorGenerator
} from "../selector-generator";

import {
    SelectorValidator
} from "../validator/selector-validator";

import { CategoryRule } from "@/content/analyzer/scoring/rules/category-rule";
import { SemanticAttributeRule } from "@/content/analyzer/scoring/rules/semantic-attribute-rule";
import { TagNameRule } from "@/content/analyzer/scoring/rules/tagname-rule";

import { SelectorScorer } from "@/content/analyzer/scoring/selector-scorer";
import { SelectorLengthRule } from "@/content/analyzer/scoring/rules/selector-length-rule";

import { SelectorPartScorer } from "@/content/analyzer/scoring/selector-part-scorer";
import { ContainerUniquenessRule } from "@/content/analyzer/scoring/rules/container-uniqueness-rule";

import type { SelectorPart } from "../selector-part";


export class SelectorGenerationPipeline {

    private scorer: AttributeScorer;

    private partScorer: SelectorPartScorer;

    private builder: SelectorBuilder;

    private generator: SelectorGenerator;

    private selectorScorer: SelectorScorer;


    constructor() {

        this.scorer =
            new AttributeScorer([
                {
                    rule: new CategoryRule(),
                    weight: 50
                },
                {
                    rule: new SemanticAttributeRule(),
                    weight: 30
                },
                {
                    rule: new TagNameRule(),
                    weight: 20
                }
            ]);


        this.partScorer =
            new SelectorPartScorer([
                {
                    rule: new ContainerUniquenessRule(),
                    weight: 10
                }
            ]);


        this.selectorScorer =
            new SelectorScorer([
                {
                    rule: new SelectorLengthRule(),
                    weight: 5
                }
            ]);


        this.builder =
            new SelectorBuilder();


        this.generator =
            new SelectorGenerator(
                new SelectorValidator()
            );

    }


    generate(
        context: DOMContext,
        target: HTMLElement
    ) {

        const parts =
            [
                ...[...context.ancestors].reverse(),
                context.element
            ]
            .map(node => {


                const candidates =
                    extractAttributeCandidates(
                        node.attributes
                    );


                const scoredCandidates =
                    candidates.map(candidate =>
                        this.scorer.score(candidate)
                    );


                const bestCandidates =
                    scoredCandidates
                        .sort(
                            (a, b) =>
                                b.score - a.score
                        )
                        .slice(0, 3);



                const fragments =
                    bestCandidates
                        .flatMap(candidate =>
                            generateCSSFragments(candidate)
                        )
                        .sort(
                            (a, b) =>
                                b.score - a.score
                        )
                        .slice(0, 3);



                const part: SelectorPart = {

                    tagName: node.tagname,

                    fragments,

                    score: 0

                };


                return this.partScorer.score(part);

            });


        console.log(
            "parts",
            parts
        );


        const selectors =
            this.builder.build(parts);


        const scoredSelectors =
            selectors
                .map(selector =>
                    this.selectorScorer.score(selector)
                )
                .sort(
                    (a, b) =>
                        b.score - a.score
                );


        console.log(
            "GENERATED SELECTORS",
            scoredSelectors
        );


        return this.generator.generate(
            scoredSelectors,
            target
        )
        .slice(0, 100);

    }

}