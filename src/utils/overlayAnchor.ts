import type { CSSProperties } from "react";
import type { OverlayAnchor } from "../types";

export const OVERLAY_ANCHORS: { data: OverlayAnchor; label: string }[] = [
    { data: "top_left", label: "Top left" },
    { data: "top_center", label: "Top center" },
    { data: "top_right", label: "Top right" },
    { data: "bottom_left", label: "Bottom left" },
    { data: "bottom_center", label: "Bottom center" },
    { data: "bottom_right", label: "Bottom right" },
];

export const OVERLAY_CENTER_OFFSET_MAX = 600;

export type HorizontalAnchor = "left" | "center" | "right";
export type VerticalAnchor = "top" | "bottom";

export function splitOverlayAnchor(anchor: OverlayAnchor | undefined): { vertical: VerticalAnchor; horizontal: HorizontalAnchor } {
    const [vertical, horizontal] = (anchor ?? "top_left").split("_") as [VerticalAnchor, HorizontalAnchor];
    return { vertical: vertical ?? "top", horizontal: horizontal ?? "left" };
}

export interface OverlayAnchorLayout {
    /** top/bottom and left/right offsets for a position: fixed or absolute element. */
    position: Pick<CSSProperties, "top" | "bottom" | "left" | "right">;
    /** Horizontal self-translation (-50% when centered); combine with any shift transform. */
    translateX: string;
    /** Cross-axis alignment for a column layout, so a second row lines up with the anchor side. */
    align: "flex-start" | "center" | "flex-end";
}

/**
 * Offsets are measured from the anchored edge; for the center anchors x is a signed offset from the center.
 * `fmtX`/`fmtY` convert a pixel offset to a CSS length (px by default, % for the settings preview).
 */
export function overlayAnchorLayout(
    anchor: OverlayAnchor | undefined,
    x: number,
    y: number,
    fmtX: (px: number) => string = (px) => `${px}px`,
    fmtY: (px: number) => string = (px) => `${px}px`,
): OverlayAnchorLayout {
    const { vertical, horizontal } = splitOverlayAnchor(anchor);
    const position: OverlayAnchorLayout["position"] = {};

    if (vertical === "top") position.top = fmtY(y);
    else position.bottom = fmtY(y);

    if (horizontal === "left") position.left = fmtX(x);
    else if (horizontal === "right") position.right = fmtX(x);
    else position.left = `calc(50% + ${fmtX(x)})`;

    return {
        position,
        translateX: horizontal === "center" ? "-50%" : "0px",
        align: horizontal === "left" ? "flex-start" : horizontal === "right" ? "flex-end" : "center",
    };
}
