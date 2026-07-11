export const ATTRIBUTE_CATEGORIES = {

    ID: "id",

    CLASS: "class",

    DATA: "data",

    ARIA: "aria",

    NAME: "name",

    ROLE: "role",

    HREF: "href",

    SRC: "src",

    TITLE: "title",

    ALT: "alt",

    OTHER: "other"

} as const;


export type AttributeCategory =
    typeof ATTRIBUTE_CATEGORIES[keyof typeof ATTRIBUTE_CATEGORIES];