import { useSettings } from "../hooks/useSettings";
import { useScreensaver } from "../hooks/useScreensaver";
import { usePixelShift } from "../hooks/usePixelShift";
import { ClockWidget } from "./screensaver/ClockWidget";
import { DateWidget } from "./screensaver/DateWidget";
import { BatteryWidget } from "./screensaver/BatteryWidget";
import { AlertsListWidget } from "./screensaver/AlertsListWidget";
import { SystemStatsWidget } from "./screensaver/SystemStatsWidget";
import { NetworkWidget } from "./screensaver/NetworkWidget";
import { ACCENT_COLORS } from "../types";
import type { ScreensaverLayout, AccentColorPreset } from "../types";

export function ScreensaverContent() {
    const { settings } = useSettings();
    const { overlayVisible } = useScreensaver();
    const layout = (settings.overlay_screensaver_layout || "compact") as ScreensaverLayout;
    const clockSize = settings.screensaver_clock_size || 20;
    const accent = (settings.screensaver_accent_color || "muted_gray") as AccentColorPreset;
    const color = ACCENT_COLORS[accent];
    const isCompact = layout === "compact";

    const shiftVisible = overlayVisible && layout === "floating";
    const { x: pxX, y: pxY } = usePixelShift(shiftVisible);
    const driftRange = settings.screensaver_floating_drift_range || 40;
    const driftX = shiftVisible ? (pxX / 10) * driftRange : 0;
    const driftY = shiftVisible ? (pxY / 10) * driftRange : 0;

    const showAlertsList = settings.screensaver_show_alerts_list ?? true;
    const showSystemStats = settings.screensaver_show_system_stats ?? false;
    const showNetwork = settings.screensaver_show_network_info ?? false;
    const maxAlerts = settings.overlay_max_alerts || 2;

    if (!overlayVisible || isCompact) return null;

    const widgetFontSize = Math.max(10, clockSize * 0.45);

    const WidgetsRow = () => (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: clockSize * 0.8,
            flexWrap: "wrap",
        }}>
            <DateWidget fontSize={widgetFontSize} />
            <BatteryWidget fontSize={widgetFontSize} showPct />
        </div>
    );

    const BottomWidgets = () => {
        if (!showSystemStats && !showNetwork) return null;
        return (
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                width: "100%",
                maxWidth: 340,
                marginTop: clockSize * 0.3,
            }}>
                <NetworkWidget fontSize={widgetFontSize} show={showNetwork} />
                <SystemStatsWidget fontSize={widgetFontSize} show={showSystemStats} />
            </div>
        );
    };

    const sharedContent = (
        <>
            <ClockWidget clockSize={clockSize} />
            <WidgetsRow />
            {showAlertsList && (
                <div style={{ marginTop: clockSize * 0.3 }}>
                    <AlertsListWidget fontSize={widgetFontSize} maxAlerts={maxAlerts} />
                </div>
            )}
            <BottomWidgets />
        </>
    );

    if (layout === "large") {
        return (
            <div style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1,
                color,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: clockSize * 0.2,
                backgroundColor: "rgba(0,0,0,0.35)",
                borderRadius: 16,
                padding: clockSize * 0.6,
                maxWidth: "80%",
                textAlign: "center",
                userSelect: "none",
            }}>
                {sharedContent}
            </div>
        );
    }

    if (layout === "fullscreen") {
        return (
            <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 1,
                color,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: clockSize * 0.2,
                userSelect: "none",
                padding: clockSize * 0.5,
            }}>
                {sharedContent}
            </div>
        );
    }

    if (layout === "floating") {
        return (
            <div style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: `translate(calc(-50% + ${driftX}px), calc(-50% + ${driftY}px))`,
                transition: "transform 2s linear",
                zIndex: 1,
                color,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: clockSize * 0.2,
                backgroundColor: "rgba(0,0,0,0.45)",
                borderRadius: 12,
                padding: clockSize * 0.5,
                maxWidth: "70%",
                textAlign: "center",
                userSelect: "none",
            }}>
                {sharedContent}
            </div>
        );
    }

    return null;
}
