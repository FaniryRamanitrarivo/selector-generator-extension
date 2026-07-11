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


export class SelectorGenerationPipeline {


    private scorer: AttributeScorer;

    private builder: SelectorBuilder;

    private generator: SelectorGenerator;


    constructor(){


        this.scorer =
            new AttributeScorer([]);


        this.builder =
            new SelectorBuilder();


        this.generator =
            new SelectorGenerator(
                new SelectorValidator()
            );

    }



    generate(
        context: DOMContext
    ) {


        const parts =
            [
                ...context.ancestors.reverse(),
                context.element
            ]
            .map(node => {


                const candidates =
                    extractAttributeCandidates(
                        node.attributes
                    );


                const scored =
                    candidates.map(candidate =>
                        this.scorer.score(candidate)
                    );


                const best =
                    scored.sort(
                        (a,b)=>
                        b.score - a.score
                    )[0];


                if(!best)
                    return {
                        tagName: node.tagname
                    };


                const fragment =
                    generateCSSFragments(best)[0];


                return {

                    tagName: node.tagname,

                    fragment

                };

            });



        const selector =
            this.builder.build(parts);



        return this.generator.generate([
            selector
        ]);

    }

}