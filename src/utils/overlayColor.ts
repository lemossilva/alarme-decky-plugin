export const DEFAULT_OVERLAY_TEXT_COLOR = "#8b8b8b";

export interface Hsla {
    h: number;
    s: number;
    l: number;
    a: number;
}

const HSLA_PATTERN = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i;

/** Parses the `hsla(...)` string the Decky color picker produces. */
export function parseHsla(value: string | undefined): Hsla | null {
    const m = HSLA_PATTERN.exec((value ?? "").trim());
    if (!m) return null;
    return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) };
}

/** The saved color when valid, otherwise the default grey. */
export function resolveOverlayTextColor(value: string | undefined): string {
    return parseHsla(value) ? (value as string).trim() : DEFAULT_OVERLAY_TEXT_COLOR;
}
