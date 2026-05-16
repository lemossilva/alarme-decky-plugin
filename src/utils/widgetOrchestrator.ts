import type {
    ScreensaverBigWidgetId,
    ScreensaverSmallWidgetId,
    ScreensaverLayout,
} from "../types";
import { WIDGET_CAPS } from "../types";

export const ALL_BIG_WIDGETS: ScreensaverBigWidgetId[] = [
    "calendar",
    "forecast",
    "suggestme",
];

export const ALL_SMALL_WIDGETS: ScreensaverSmallWidgetId[] = [
    "battery",
    "system_stats",
    "network",
    "weather",
];

export const BIG_WIDGET_LABELS: Record<ScreensaverBigWidgetId, string> = {
    calendar: "Calendar Grid",
    forecast: "7-Day Forecast",
    suggestme: "Game Recommendation",
};

export const SMALL_WIDGET_LABELS: Record<ScreensaverSmallWidgetId, string> = {
    battery: "Battery",
    system_stats: "System Stats",
    network: "Network Info",
    weather: "Weather",
};

export function getCaps(layout: ScreensaverLayout): { big: number; small: number } {
    if (layout === "compact") return { big: 0, small: 0 };
    return WIDGET_CAPS[layout];
}

export function trimToLayout(
    bigWidgets: ScreensaverBigWidgetId[],
    smallWidgets: ScreensaverSmallWidgetId[],
    layout: ScreensaverLayout,
): { big: ScreensaverBigWidgetId[]; small: ScreensaverSmallWidgetId[]; trimmedBig: ScreensaverBigWidgetId[]; trimmedSmall: ScreensaverSmallWidgetId[] } {
    const caps = getCaps(layout);
    const trimmedBig = bigWidgets.slice(caps.big);
    const trimmedSmall = smallWidgets.slice(caps.small);
    return {
        big: bigWidgets.slice(0, caps.big),
        small: smallWidgets.slice(0, caps.small),
        trimmedBig,
        trimmedSmall,
    };
}

export function isAtCap(
    widgets: string[],
    bucket: "big" | "small",
    layout: ScreensaverLayout,
): boolean {
    const caps = getCaps(layout);
    return widgets.length >= caps[bucket];
}
