import { ACCENT_COLORS } from "../types";
import type { AccentColorPreset, UserSettings } from "../types";

export function resolveScreensaverAccentColor(
    settings: Pick<UserSettings, "screensaver_accent_color" | "screensaver_mode">
): string {
    const accent = (settings.screensaver_accent_color || "muted_gray") as AccentColorPreset;
    return accent === "contrast_auto" && settings.screensaver_mode === "wallpaper"
        ? "var(--alarme-wallpaper-contrast-color, #e0e0e0)"
        : ACCENT_COLORS[accent];
}
