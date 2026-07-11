let overlay: HTMLDivElement | null = null;

export function highlight(
    element: HTMLElement
) {

    if(!overlay) {

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

    const rect = element.getBoundingClientRect();

    Object.assign(
        overlay.style,
        {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`
        }
    )


}

export function removeHighlight() {

    overlay?.remove();

    overlay = null;

}