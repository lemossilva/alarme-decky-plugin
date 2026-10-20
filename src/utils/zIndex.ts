/**
 * Centralized z-index orchestration for AlarMe overlays.
 *
 * Layering rules (from bottom to top):
 *  - Game / app window:                  rendered by gamescope (no CSS z-index)
 *  - Steam UI base:                      Steam-managed
 *  - Wallpaper inside ScreensaverOverlay: WallpaperLayer is positioned inside the
 *    overlay container, so it inherits the overlay's z-index.
 *  - Floating screensaver content:       layered inside the screensaver overlay,
 *    using a small local z-index (1) that does not compete with overlays above.
 *  - Game overlay (alerts bar) when no screensaver is active.
 *  - Screensaver overlay (dim/black/wallpaper background fill).
 *  - Game overlay (alerts bar) on top of the screensaver, so users see alerts.
 *  - Modal portals (snooze, pomodoro, reminder, sleep blocker, etc.).
 *
 * Z-index values stay within the safe 32-bit signed integer space
 * Steam UI tolerates without breaking native popovers.
 */
export const Z_INDEX = {
    /** Screensaver inner content stays inside the overlay container. */
    SCREENSAVER_CONTENT: 1,
    /** Default alerts overlay layer when not stacked over the screensaver. */
    GAME_OVERLAY_BASE: 2147483645,
    /** Screensaver overlay (background dim, black or wallpaper). */
    SCREENSAVER_OVERLAY: 2147483646,
    /** Alerts overlay raised above the screensaver when the user opted-in. */
    GAME_OVERLAY_ABOVE_SCREENSAVER: 2147483647,
    /** Modal portals (alarm snooze, pomodoro, reminder triggers, etc.). */
    MODAL_PORTAL: 2147483647,
} as const;

/**
 * CSS that lifts Steam / Decky modal portals above the screensaver overlay, for cases
 * where the modal portal has a default z-index lower than ours.
 *
 * It overrides Steam's own modal layering, so it is only present while the screensaver
 * is visible (see `setModalLayering`).
 */
export const MODAL_ZINDEX_CSS = `
.ModalPosition,
.ModalPosition_BottomSheet,
.DialogOverlay,
.ModalOverlayContent,
.ReactModal__Overlay,
.ReactModalPortal,
.ReactModalPortal > div {
    z-index: ${Z_INDEX.MODAL_PORTAL} !important;
}
`;

const MODAL_STYLE_ID = 'alarme-modal-zindex-fix';

export function setModalLayering(active: boolean) {
    const existing = document.getElementById(MODAL_STYLE_ID);
    if (!active) {
        existing?.remove();
        return;
    }
    if (existing) return;
    const style = document.createElement('style');
    style.id = MODAL_STYLE_ID;
    style.textContent = MODAL_ZINDEX_CSS;
    document.head.appendChild(style);
}
