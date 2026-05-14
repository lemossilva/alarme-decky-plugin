import type { CSSProperties, ReactNode } from "react";
import { useSettings } from "../hooks/useSettings";
import { useScreensaver } from "../hooks/useScreensaver";
import { useScreensaverViewportScale } from "../hooks/useScreensaverViewportScale";
import { ClockWidget } from "./screensaver/ClockWidget";
import { DateWidget, ScreensaverDateHeading, ScreensaverCalendarGrid } from "./screensaver/DateWidget";
import { BatteryWidget } from "./screensaver/BatteryWidget";
import { AlertsListWidget } from "./screensaver/AlertsListWidget";
import { SystemStatsWidget } from "./screensaver/SystemStatsWidget";
import { NetworkWidget } from "./screensaver/NetworkWidget";
import { WeatherWidget } from "./screensaver/WeatherWidget";
import { ForecastWidget } from "./screensaver/ForecastWidget";
import { SuggestMeWidget } from "./screensaver/SuggestMeWidget";
import { Z_INDEX } from "../utils/zIndex";
import { resolveScreensaverAccentColor } from "../utils/screensaverAccent";
import type { ScreensaverLayout } from "../types";

/** Centered floating panel with dim backdrop (this preset is “Large (Centered)” in settings). */
function largeCenteredPanelStyle(clockSize: number, color: string): CSSProperties {
    return {
        transform: "translate(var(--alarme-drift-x, 0px), var(--alarme-drift-y, 0px))",
        opacity: "var(--alarme-shift-opacity, 1)",
        color,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
        textAlign: "center",
        userSelect: "none",
        width: "fit-content",
        maxWidth: "min(920px, 94vw)",
        maxHeight: "min(88vh, 900px)",
        overflowY: "auto",
        padding: `${clockSize * 0.55}px ${clockSize * 0.5}px`,
        borderRadius: 22,
        background: "rgba(18,18,22,0.88)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 10px 44px rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
        pointerEvents: "none",
    };
}

export function ScreensaverContent() {
    const { settings } = useSettings();
    const { overlayVisible } = useScreensaver();
    const rawLayout = (settings.overlay_screensaver_layout as unknown as string | undefined) || "compact";
    const layout = (rawLayout === "floating" ? "large" : rawLayout) as ScreensaverLayout;
    const isCompact = layout === "compact";
    const viewportScale = useScreensaverViewportScale(overlayVisible && !isCompact);
    const baseClock = settings.screensaver_clock_size || 20;
    const clockSize = baseClock * viewportScale;
    const color = resolveScreensaverAccentColor(settings);

    const showAlertsList = settings.screensaver_show_alerts_list ?? true;
    const showSystemStats = settings.screensaver_show_system_stats ?? false;
    const showNetwork = settings.screensaver_show_network_info ?? false;
    const showWeather = settings.screensaver_show_weather ?? false;
    const showForecast = (settings.screensaver_show_forecast ?? false) && showWeather;
    const showSuggestMe = settings.screensaver_show_suggestme ?? false;
    const maxAlerts = settings.overlay_max_alerts || 2;

    const showCenterClock = settings.screensaver_center_show_clock ?? true;
    const showCenterDate = settings.screensaver_center_show_date ?? true;
    const showCenterBattery = settings.screensaver_center_show_battery ?? true;

    const dateHeadingVisible =
        showCenterDate ||
        (settings.screensaver_show_day_of_week ?? true);
    const showLargeCalendar =
        (settings.screensaver_show_calendar_grid ?? false) && dateHeadingVisible;

    if (!overlayVisible || isCompact) return null;

    const spreadLayout = layout === "fullscreen";
    const suggestMeInLargeRow = showSuggestMe && spreadLayout;
    const suggestMeInInfoRow = showSuggestMe && !spreadLayout;
    const showLargeWidgetsRow = showLargeCalendar || showForecast || suggestMeInLargeRow;
    const widgetFontSize = Math.max(10, clockSize * 0.45);

    const widgetSurfacePad = spreadLayout ? "14px 16px" : "8px 10px";
    const largeCardStyle = {
        display: "flex" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: widgetSurfacePad,
    };

    const widgetsRowGap = spreadLayout ? Math.max(24, clockSize * 0.28) : Math.max(12, clockSize * 0.16);
    const widgetsMaxWidth = spreadLayout ? "min(96vw, 1580px)" : "min(100%, 900px)";
    const infoRowGap = spreadLayout ? Math.max(18, Math.round(clockSize * 0.32)) : 10;
    const infoMaxWidth = spreadLayout ? "min(94vw, 1420px)" : "min(100%, 900px)";
    const infoCardPad = spreadLayout ? "10px 12px" : "5px 8px";
    const infoSlotCount =
        (showCenterBattery ? 1 : 0) +
        (showNetwork ? 1 : 0) +
        (showSystemStats ? 1 : 0) +
        (showWeather ? 1 : 0) +
        (suggestMeInInfoRow ? 1 : 0);
    const centeredInfoWrap = !spreadLayout && infoSlotCount >= 3;
    const infoRowGapEff = centeredInfoWrap ? Math.max(6, Math.round(infoRowGap * 0.55)) : infoRowGap;
    const columnGap = spreadLayout ? clockSize * 0.38 : clockSize * 0.22;
    const alertsTop = spreadLayout ? clockSize * 0.42 : clockSize * 0.3;
    const alertsStackMax = spreadLayout ? "min(92vw, 920px)" : 300;

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
            flexWrap: suggestMeInLargeRow ? "nowrap" : "wrap",
            alignItems: "stretch",
            justifyContent: "center",
            gap: widgetsRowGap,
            width: "100%",
            maxWidth: widgetsMaxWidth,
            marginTop: spreadLayout ? clockSize * 0.22 : clockSize * 0.15,
            overflowX: suggestMeInLargeRow ? "auto" : "visible",
        }}>
            {showLargeCalendar && (
                <div style={{ ...largeCardStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>
                    <ScreensaverCalendarGrid fontSize={widgetFontSize} />
                </div>
            )}
            {showForecast && (
                <div style={{ ...largeCardStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>
                    <ForecastWidget fontSize={widgetFontSize} show={showForecast} />
                </div>
            )}
            {suggestMeInLargeRow && (
                <div style={{
                    ...largeCardStyle,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    justifyContent: "center",
                    flex: "0 1 auto",
                    minWidth: 0,
                    maxWidth: "min(100%, 204px)",
                    overflow: "hidden",
                    boxSizing: "border-box",
                }}>
                    <SuggestMeWidget fontSize={widgetFontSize} show={showSuggestMe} screensaverLayout={layout} />
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

    const infoCellStyle: CSSProperties = centeredInfoWrap
        ? {
            flex: "1 1 118px",
            minWidth: 0,
            maxWidth: "calc(50% - 5px)",
            display: "flex",
            alignItems: "stretch",
            justifyContent: "center",
        }
        : {
            flex: "1 1 0",
            minWidth: 0,
            display: "flex",
            alignItems: "stretch",
            justifyContent: "center",
        };

    const infoCardStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: infoCardPad,
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
        overflow: centeredInfoWrap ? "hidden" : "visible",
    };

    const InfoWidgets = () => (
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: centeredInfoWrap ? "wrap" : "nowrap",
                alignItems: "stretch",
                justifyContent: "center",
                rowGap: centeredInfoWrap ? infoRowGapEff : undefined,
                gap: infoRowGapEff,
                width: "100%",
                maxWidth: infoMaxWidth,
                marginTop: spreadLayout ? clockSize * 0.32 : clockSize * 0.25,
            }}
        >
            {showCenterBattery ? (
                <div style={infoCellStyle}>
                    <div style={infoCardStyle}>
                        <BatteryWidget fontSize={widgetFontSize} showPct />
                    </div>
                </div>
            ) : null}
            {showNetwork ? (
                <div style={infoCellStyle}>
                    <div style={infoCardStyle}>
                        <NetworkWidget fontSize={widgetFontSize} show={showNetwork} />
                    </div>
                </div>
            ) : null}
            {showSystemStats ? (
                <div style={infoCellStyle}>
                    <div style={infoCardStyle}>
                        <SystemStatsWidget fontSize={widgetFontSize} show={showSystemStats} />
                    </div>
                </div>
            ) : null}
            {showWeather ? (
                <div style={infoCellStyle}>
                    <div style={infoCardStyle}>
                        <WeatherWidget fontSize={widgetFontSize} layout="card" show={showWeather} />
                    </div>
                </div>
            ) : null}
            {suggestMeInInfoRow ? (
                <div style={infoCellStyle}>
                    <div style={infoCardStyle}>
                        <SuggestMeWidget
                            fontSize={widgetFontSize}
                            show={showSuggestMe}
                            screensaverLayout={layout}
                            infoRowCompact
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );

    const contentColumn: ReactNode = (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: columnGap,
                width: "100%",
                maxWidth: spreadLayout ? "min(96vw, 1520px)" : "100%",
                boxSizing: "border-box",
            }}
        >
            {showCenterClock ? <ClockWidget clockSize={clockSize} /> : null}
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
                <div style={{ marginTop: alertsTop, width: "100%", display: "flex", justifyContent: "center" }}>
                    <AlertsListWidget
                        fontSize={widgetFontSize}
                        maxAlerts={maxAlerts}
                        stackMaxWidth={alertsStackMax}
                    />
                </div>
            )}
        </div>
    );

    if (layout === "large") {
        return (
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    zIndex: Z_INDEX.SCREENSAVER_CONTENT,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: clockSize * 0.35,
                    pointerEvents: "none",
                }}
            >
                <div style={largeCenteredPanelStyle(clockSize, color)}>
                    {contentColumn}
                </div>
            </div>
        );
    }

    if (layout === "fullscreen") {
        return (
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    zIndex: Z_INDEX.SCREENSAVER_CONTENT,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: clockSize * 0.55,
                    pointerEvents: "none",
                    boxSizing: "border-box",
                    color,
                    transform: "translate(var(--alarme-drift-x, 0px), var(--alarme-drift-y, 0px))",
                    opacity: "var(--alarme-shift-opacity, 1)",
                }}
            >
                {contentColumn}
            </div>
        );
    }

    return null;
}
