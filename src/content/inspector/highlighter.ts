let overlay: HTMLDivElement | null = null;
let label: HTMLDivElement | null = null;

function ensureOverlay(): HTMLDivElement {

    if (!overlay) {

        overlay = document.createElement(
            "div"
        );

        Object.assign(
            overlay.style,
            {
                position: "fixed",
                pointerEvents: "none",
                border: "2px solid #2563eb",
                background:
                    "rgba(37,99,235,0.15)",
                zIndex: "999999"
            }
        )

        document.body.appendChild(
            overlay
        );

    }

    return overlay;

}

function ensureLabel(): HTMLDivElement {

    if (!label) {

        label = document.createElement(
            "div"
        );

        Object.assign(
            label.style,
            {
                position: "fixed",
                pointerEvents: "none",
                background: "#2563eb",
                color: "#fff",
                font: "12px/1.4 -apple-system, sans-serif",
                padding: "2px 6px",
                borderRadius: "3px",
                whiteSpace: "nowrap",
                zIndex: "1000000"
            }
        )

        document.body.appendChild(
            label
        );

    }

    return label;

}

// labelText is only passed while adjusting the selection with the keyboard
// (see inspector.ts) — plain hover highlighting has no label.
export function highlight(
    element: HTMLElement,
    labelText?: string
) {

    const box = ensureOverlay();

    const rect = element.getBoundingClientRect();

    Object.assign(
        box.style,
        {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`
        }
    )

    if (!labelText) {
        label?.remove();
        label = null;
        return;
    }

    const text = ensureLabel();
    text.textContent = labelText;

    // Prefer sitting just above the element; fall back to just inside its
    // top edge when there isn't room above the viewport.
    const top = rect.top > 20 ? rect.top - 20 : rect.top + 2;

    Object.assign(
        text.style,
        {
            top: `${top}px`,
            left: `${rect.left}px`
        }
    )

}

export function removeHighlight() {

    overlay?.remove();
    overlay = null;

    label?.remove();
    label = null;

}
