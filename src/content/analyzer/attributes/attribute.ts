import type { AttributeCategory } from "./attribute-category";

export interface DOMAttribute {

    name: string;

    category: AttributeCategory;

    rawValue: string;

    values: string[];

    tokens: string[];

}