import type { SVGProps } from "react";

// Minimal inline icon set — kept local rather than pulling in an icon library,
// since the sidebar only ever needs these 4. All inherit color via currentColor
// so they pick up dark: text classes on their parent for free.

export function ClipboardIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
            <rect x="6" y="3.5" width="8" height="3" rx="1" />
            <path d="M6 5H5a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 15 5h-1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
            <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} {...props}>
            <path d="M7 5l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function TargetIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
            <circle cx="10" cy="10" r="6.5" />
            <circle cx="10" cy="10" r="2.25" fill="currentColor" stroke="none" />
        </svg>
    );
}
