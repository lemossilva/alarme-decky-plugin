import { useSettings } from "../hooks/useSettings";
import { useScreensaver } from "../hooks/useScreensaver";
import { ClockWidget } from "./screensaver/ClockWidget";
import { DateWidget, ScreensaverDateHeading, ScreensaverCalendarGrid } from "./screensaver/DateWidget";
import { BatteryWidget } from "./screensaver/BatteryWidget";
import { AlertsListWidget } from "./screensaver/AlertsListWidget";
import { SystemStatsWidget } from "./screensaver/SystemStatsWidget";
import { NetworkWidget } from "./screensaver/NetworkWidget";
import { WeatherWidget } from "./screensaver/WeatherWidget";
import { ForecastWidget } from "./screensaver/ForecastWidget";
import { ACCENT_COLORS } from "../types";
import { Z_INDEX } from "../utils/zIndex";
import type { ScreensaverLayout, AccentColorPreset } from "../types";

export function ScreensaverContent() {
    const { settings } = useSettings();
    const { overlayVisible } = useScreensaver();
    const rawLayout = (settings.overlay_screensaver_layout as unknown as string | undefined) || "compact";
    const layout = (rawLayout === "floating" ? "large" : rawLayout) as ScreensaverLayout;
    const clockSize = settings.screensaver_clock_size || 20;
    const accent = (settings.screensaver_accent_color || "muted_gray") as AccentColorPreset;
    const color = accent === "contrast_auto" && settings.screensaver_mode === "wallpaper"
        ? "var(--alarme-wallpaper-contrast-color, #e0e0e0)"
        : ACCENT_COLORS[accent];
    const isCompact = layout === "compact";

    const showAlertsList = settings.screensaver_show_alerts_list ?? true;
    const showSystemStats = settings.screensaver_show_system_stats ?? false;
    const showNetwork = settings.screensaver_show_network_info ?? false;
    const showWeather = settings.screensaver_show_weather ?? false;
    const showForecast = (settings.screensaver_show_forecast ?? false) && showWeather;
    const maxAlerts = settings.overlay_max_alerts || 2;

    const dateHeadingVisible =
        (settings.overlay_screensaver_show_date ?? true) ||
        (settings.screensaver_show_day_of_week ?? true);
    const showLargeCalendar =
        (settings.screensaver_show_calendar_grid ?? false) && dateHeadingVisible;
    const showLargeWidgetsRow = showLargeCalendar || showForecast;

    if (!overlayVisible || isCompact) return null;

    const widgetFontSize = Math.max(10, clockSize * 0.45);

    const largeCardStyle = {
        display: "flex" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: "8px 10px",
    };

    const DateHeadingRow = () => (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            textAlign: "center",
        }}>
            <ScreensaverDateHeading fontSize={widgetFontSize} />
        </div>
    );

    const LargeWidgetsRow = () => (
        <div style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            maxWidth: layout === "fullscreen" ? 920 : 680,
            marginTop: clockSize * 0.15,
        }}>
            {showLargeCalendar && (
                <div style={largeCardStyle}>
                    <ScreensaverCalendarGrid fontSize={widgetFontSize} />
                </div>
            )}
            {showForecast && (
                <div style={largeCardStyle}>
                    <ForecastWidget fontSize={widgetFontSize} show={showForecast} />
                </div>
            )}
        </div>
    );

    const DateRow = () => (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            textAlign: "center",
        }}>
            <DateWidget fontSize={widgetFontSize} />
        </div>
    );

    const infoCardStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: "6px 10px",
        minWidth: 110,
    };

    const InfoWidgets = () => (
        <div style={{
            display: "flex",
            alignItems: "stretch",
            justifyContent: "center",
            gap: 10,
            flexWrap: "wrap",
            width: "100%",
            maxWidth: layout === "fullscreen" ? 640 : 420,
            marginTop: clockSize * 0.25,
        }}>
            <div style={infoCardStyle}>
                <BatteryWidget fontSize={widgetFontSize} showPct />
            </div>
            {showNetwork && (
                <div style={infoCardStyle}>
                    <NetworkWidget fontSize={widgetFontSize} show={showNetwork} />
                </div>
            )}
            {showSystemStats && (
                <div style={{ ...infoCardStyle, minWidth: 140 }}>
                    <SystemStatsWidget fontSize={widgetFontSize} show={showSystemStats} />
                </div>
            )}
            {showWeather && (
                <div style={{ ...infoCardStyle, minWidth: 140 }}>
                    <WeatherWidget fontSize={widgetFontSize} layout="card" show={showWeather} />
                </div>
            )}
        </div>
    );

    const sharedContent = (
        <>
            <ClockWidget clockSize={clockSize} />
            {showLargeWidgetsRow ? (
                <>
                    {dateHeadingVisible ? <DateHeadingRow /> : null}
                    <LargeWidgetsRow />
                </>
            ) : (
                <DateRow />
            )}
            <InfoWidgets />
            {showAlertsList && (
                <div style={{ marginTop: clockSize * 0.3 }}>
                    <AlertsListWidget fontSize={widgetFontSize} maxAlerts={maxAlerts} />
                </div>
            )}
        </>
    );

    if (layout === "large") {
        return (
            <div style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform:
                    "translate(calc(-50% + var(--alarme-drift-x, 0px)), calc(-50% + var(--alarme-drift-y, 0px)))",
                opacity: "var(--alarme-shift-opacity, 1)",
                zIndex: Z_INDEX.SCREENSAVER_CONTENT,
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
                zIndex: Z_INDEX.SCREENSAVER_CONTENT,
                color,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: clockSize * 0.2,
                userSelect: "none",
                padding: clockSize * 0.5,
                transform: "translate(var(--alarme-drift-x, 0px), var(--alarme-drift-y, 0px))",
                opacity: "var(--alarme-shift-opacity, 1)",
            }}>
                {sharedContent}
            </div>
        );
    }

    return null;
}
