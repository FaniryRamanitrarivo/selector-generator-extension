export type SelectorQualityTier = "good" | "warning" | "bad";

// Outside multi-result mode a selector only does its job if it uniquely
// identifies the target; a handful of extra matches is still salvageable
// (the user can scope it further by hand) but matching broadly across the
// page means it isn't really scoping to anything anymore.
const AMBIGUOUS_COUNT_CEILING = 5;

export function getSelectorQualityTier(
    count: number,
    multiResultMode: boolean
): SelectorQualityTier {

    if (multiResultMode) {
        // The goal here is matching several elements on purpose — a single
        // match means the selector failed to generalize to the group.
        return count > 1 ? "good" : "warning";
    }

    if (count === 1) {
        return "good";
    }

    return count <= AMBIGUOUS_COUNT_CEILING ? "warning" : "bad";

}

export function getSelectorQualityLabel(
    tier: SelectorQualityTier,
    multiResultMode: boolean
): string {

    if (multiResultMode) {
        return tier === "good" ? "Groupe trouvé" : "Élément unique seulement";
    }

    switch (tier) {
        case "good": return "Robuste";
        case "warning": return "Ambigu";
        case "bad": return "Peu fiable";
    }

}

export const SELECTOR_QUALITY_STYLES: Record<SelectorQualityTier, {
    border: string;
    bg: string;
    text: string;
    badge: string;
    badgeHover: string;
    dot: string;
}> = {
    good: {
        border: "border-emerald-200 dark:border-emerald-900",
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        text: "text-emerald-700 dark:text-emerald-300",
        badge: "bg-emerald-600",
        badgeHover: "hover:bg-emerald-700",
        dot: "bg-emerald-500"
    },
    warning: {
        border: "border-amber-200 dark:border-amber-900",
        bg: "bg-amber-50 dark:bg-amber-950/40",
        text: "text-amber-700 dark:text-amber-300",
        badge: "bg-amber-500",
        badgeHover: "hover:bg-amber-600",
        dot: "bg-amber-500"
    },
    bad: {
        border: "border-red-200 dark:border-red-900",
        bg: "bg-red-50 dark:bg-red-950/40",
        text: "text-red-700 dark:text-red-300",
        badge: "bg-red-600",
        badgeHover: "hover:bg-red-700",
        dot: "bg-red-500"
    }
};
