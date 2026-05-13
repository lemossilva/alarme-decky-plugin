import { useUIComposition, UIComposition } from "../utils/uiComposition";
import { useSettings } from "../hooks/useSettings";
import { useScreensaver } from "../hooks/useScreensaver";
import { useGameStatus } from "../hooks/useGameStatus";
import { useOverlayData } from "../hooks/useOverlayData";
import { useMissedAlerts } from "../hooks/useMissedAlerts";

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

    const needsNotificationHud =
        (settings.overlay_enabled ?? false) &&
        hasContent &&
        !hideHudForNonCompactSaver &&
        !hudHiddenByDisplayMode;

    const level = screensaverDimVisible
        ? UIComposition.Overlay
        : needsNotificationHud
          ? UIComposition.Notification
          : UIComposition.Hidden;

    useUIComposition(level);

    return null;
}
