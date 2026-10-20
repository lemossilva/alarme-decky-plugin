import { useUIComposition, UIComposition } from "../utils/uiComposition";
import { useSettings } from "../hooks/useSettings";
import { useScreensaver } from "../hooks/useScreensaver";
import { useGameStatus } from "../hooks/useGameStatus";
import { useOnGameRoute } from "../hooks/useGameRoute";
import { useOverlayData } from "../hooks/useOverlayData";
import { useMissedAlerts } from "../hooks/useMissedAlerts";

/**
 * Steam falls back to an opaque page for routes without an explicit state only while no
 * composition request is held, so a request exists only for as long as it is needed.
 */
function CompositionRequest({ level }: { level: UIComposition }) {
    useUIComposition(level);
    return null;
}

export function AlarMeUIComposition() {
    const { settings } = useSettings();
    const { overlayVisible: screensaverDimVisible, inhibitorActive } = useScreensaver();
    const isGameRunning = useGameStatus();
    const alerts = useOverlayData(settings, isGameRunning);
    const { hasNewMissedAlerts } = useMissedAlerts();

    const hasContent =
        alerts.length > 0 ||
        inhibitorActive ||
        hasNewMissedAlerts ||
        screensaverDimVisible;

    const rawLayout =
        (settings.overlay_screensaver_layout as unknown as string | undefined) ||
        "compact";
    const layout = rawLayout === "floating" ? "large" : rawLayout;
    const hideHudForNonCompactSaver =
        screensaverDimVisible && layout !== "compact";

    const displayMode = settings.overlay_display_mode || "both";
    const hudHiddenByDisplayMode =
        (displayMode === "gaming_only" && !isGameRunning) ||
        (displayMode === "steam_only" && isGameRunning);

    const wantsHud =
        (settings.overlay_enabled ?? false) &&
        hasContent &&
        !hideHudForNonCompactSaver &&
        !hudHiddenByDisplayMode &&
        isGameRunning;
    const onGameRoute = useOnGameRoute(wantsHud && !screensaverDimVisible);

    if (screensaverDimVisible) return <CompositionRequest level={UIComposition.Overlay} />;
    if (wantsHud && onGameRoute) return <CompositionRequest level={UIComposition.Notification} />;
    return null;
}
