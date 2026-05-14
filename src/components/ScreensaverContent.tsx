import type { CSSProperties, ReactNode } from "react";
import { useSettings } from "../hooks/useSettings";
import { useOverlayData } from "../hooks/useOverlayData";
import { useScreensaver } from "../hooks/useScreensaver";
import { useScreensaverViewportScale } from "../hooks/useScreensaverViewportScale";
import { useSteamDownloads } from "../hooks/useSteamDownloads";
import { ClockWidget } from "./screensaver/ClockWidget";
import { DateWidget, ScreensaverDateHeading, ScreensaverCalendarGrid } from "./screensaver/DateWidget";
import { BatteryWidget } from "./screensaver/BatteryWidget";
import { AlertsListRow } from "./screensaver/AlertsListWidget";
import { SystemStatsWidget } from "./screensaver/SystemStatsWidget";
import { NetworkWidget } from "./screensaver/NetworkWidget";
import { WeatherWidget } from "./screensaver/WeatherWidget";
import { ForecastWidget } from "./screensaver/ForecastWidget";
import { SuggestMeWidget } from "./screensaver/SuggestMeWidget";
import { DownloadQueueWidget } from "./screensaver/DownloadQueueWidget";
import { Z_INDEX } from "../utils/zIndex";
import { resolveScreensaverAccentColor } from "../utils/screensaverAccent";
import type {
    ScreensaverLayout,
    ScreensaverBigWidgetId,
    ScreensaverSmallWidgetId,
} from "../types";

function largeCenteredPanelStyle(clockSize: number, color: string, analogClock: boolean): CSSProperties {
    const padY = analogClock ? clockSize * 0.42 : clockSize * 0.55;
    const padX = clockSize * 0.42;
    return {
        transform: "translate(var(--alarme-drift-x, 0px), var(--alarme-drift-y, 0px))",
        opacity: "var(--alarme-shift-opacity, 1)",
        color,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 0,
        textAlign: "center",
        userSelect: "none",
        width: "min(86vw, 680px)",
        maxWidth: "min(86vw, 680px)",
        boxSizing: "border-box",
        maxHeight: "min(88vh, 900px)",
        overflowY: "auto",
        padding: `${padY}px ${padX}px`,
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

    const bigWidgets: ScreensaverBigWidgetId[] = settings.screensaver_big_widgets ?? [];
    const smallWidgets: ScreensaverSmallWidgetId[] = settings.screensaver_small_widgets ?? [];

    const showCenterClock = settings.screensaver_center_show_clock ?? true;
    const showCenterDate = settings.screensaver_center_show_date ?? true;
    const maxAlerts = settings.overlay_max_alerts || 2;
    const showAlerts = settings.screensaver_show_alerts_list ?? true;
    const overlayAlerts = useOverlayData(settings);
    const alertStripVisible = showAlerts && overlayAlerts.length > 0;

    const dateHeadingVisible =
        showCenterDate ||
        (settings.screensaver_show_day_of_week ?? true);

    const showDownloads = smallWidgets.includes("downloads");
    const dlState = useSteamDownloads(overlayVisible && !isCompact && showDownloads);

    if (!overlayVisible || isCompact) return null;

    const spreadLayout = layout === "fullscreen";
    const clockStyle = (settings.screensaver_clock_style || "digital") as string;
    const isAnalogClock = clockStyle === "analog";
    const hasBigWidgets = bigWidgets.length > 0;
    const hasSuggestMe = bigWidgets.includes("suggestme");
    const displayClockSize =
        layout === "large" && isAnalogClock ? clockSize * 0.75 : clockSize;
    const widgetFontSize = Math.max(10, clockSize * 0.45);

    const widgetSurfacePad = spreadLayout ? "14px 16px" : "8px 10px";
    const largeCardStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: widgetSurfacePad,
    };

    const widgetsRowGap = spreadLayout ? Math.max(24, clockSize * 0.28) : Math.max(12, clockSize * 0.16);
    const widgetsMaxWidth = spreadLayout ? "min(96vw, 1580px)" : "100%";
    const infoRowGap = spreadLayout ? Math.max(18, Math.round(clockSize * 0.32)) : 10;
    const infoMaxWidth = spreadLayout ? "min(94vw, 1420px)" : "100%";
    const infoCardPad = spreadLayout ? "10px 12px" : "4px 6px";
    const columnGap = isAnalogClock
        ? (spreadLayout ? clockSize * 0.24 : displayClockSize * 0.12)
        : (spreadLayout ? clockSize * 0.38 : clockSize * 0.22);
    const alertsTop = spreadLayout ? clockSize * 0.42 : clockSize * 0.3;
    const alertsRowMax = spreadLayout ? infoMaxWidth : "100%";

    const renderBigWidget = (id: ScreensaverBigWidgetId) => {
        switch (id) {
            case "calendar":
                return (
                    <div
                        key={id}
                        style={{
                            ...largeCardStyle,
                            flexDirection: "column",
                            justifyContent: "flex-start",
                            alignItems: hasSuggestMe ? "stretch" : "center",
                            minWidth: 0,
                            minHeight: 0,
                        }}
                    >
                        <ScreensaverCalendarGrid fontSize={widgetFontSize} stretchToContainer={hasSuggestMe} />
                    </div>
                );
            case "forecast":
                return (
                    <div key={id} style={{ ...largeCardStyle, flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>
                        <ForecastWidget fontSize={widgetFontSize} show />
                    </div>
                );
            case "suggestme":
                return (
                    <div
                        key={id}
                        style={{
                            ...largeCardStyle,
                            flexDirection: "column",
                            alignItems: "stretch",
                            justifyContent: "flex-start",
                            flex: "0 1 auto",
                            alignSelf: "stretch",
                            minWidth: 0,
                            maxWidth: "min(100%, 204px)",
                            minHeight: 0,
                            height: "100%",
                            overflow: "hidden",
                            boxSizing: "border-box",
                        }}
                    >
                        <SuggestMeWidget fontSize={widgetFontSize} show />
                    </div>
                );
            default:
                return null;
        }
    };

    const dateHeadingRow: ReactNode = (
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

    const largeWidgetsRow: ReactNode = hasBigWidgets ? (
        <div style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: hasSuggestMe ? "nowrap" : "wrap",
            alignItems: "stretch",
            justifyContent: "center",
            gap: widgetsRowGap,
            width: "100%",
            maxWidth: widgetsMaxWidth,
            marginTop: spreadLayout ? clockSize * 0.22 : clockSize * 0.15,
            overflowX: hasSuggestMe ? "auto" : "visible",
        }}>
            {bigWidgets.map(renderBigWidget)}
        </div>
    ) : null;

    const dateRow: ReactNode = (
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

    const smallCount = smallWidgets.length;

    const infoCellStyle: CSSProperties =
        smallCount === 1
            ? {
                  flex: "0 1 auto",
                  width: spreadLayout ? "min(200px, 100%)" : "min(168px, 100%)",
                  minWidth: 0,
                  display: "flex",
                  alignItems: "stretch",
                  justifyContent: "center",
              }
            : spreadLayout
              ? {
                    flex: "1 1 0",
                    minWidth: 0,
                    display: "flex",
                    alignItems: "stretch",
                    justifyContent: "center",
                }
              : {
                    flex: "0 1 auto",
                    minWidth: 0,
                    maxWidth: "min(30vw, 168px)",
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
        boxSizing: "border-box",
        minWidth: 0,
        overflow: "visible",
        ...(spreadLayout
            ? { width: "100%" }
            : { width: "max-content", maxWidth: "min(30vw, 168px)" }),
    };

    const renderSmallWidget = (id: ScreensaverSmallWidgetId) => {
        let content: ReactNode = null;
        switch (id) {
            case "battery":
                content = <BatteryWidget fontSize={widgetFontSize} showPct />;
                break;
            case "network":
                content = <NetworkWidget fontSize={widgetFontSize} show />;
                break;
            case "system_stats":
                content = <SystemStatsWidget fontSize={widgetFontSize} show />;
                break;
            case "weather":
                content = <WeatherWidget fontSize={widgetFontSize} layout="card" show />;
                break;
            case "downloads":
                content = <DownloadQueueWidget fontSize={widgetFontSize} show downloadState={dlState} />;
                break;
            default:
                return null;
        }
        return (
            <div key={id} style={infoCellStyle}>
                <div style={infoCardStyle}>{content}</div>
            </div>
        );
    };

    const infoWidgets: ReactNode = smallWidgets.length > 0 ? (
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                alignItems: "stretch",
                justifyContent: "center",
                gap: infoRowGap,
                width: spreadLayout ? "100%" : "auto",
                maxWidth: infoMaxWidth,
                minWidth: 0,
                alignSelf: spreadLayout ? "stretch" : "center",
                marginTop: spreadLayout ? clockSize * 0.32 : clockSize * 0.25,
            }}
        >
            {smallWidgets.map(renderSmallWidget)}
        </div>
    ) : null;

    const contentColumn: ReactNode = (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: columnGap,
                width: spreadLayout ? "fit-content" : "100%",
                maxWidth: spreadLayout ? "min(96vw, 1520px)" : "100%",
                marginLeft: spreadLayout ? "auto" : undefined,
                marginRight: spreadLayout ? "auto" : undefined,
                boxSizing: "border-box",
            }}
        >
            {showCenterClock ? <ClockWidget clockSize={displayClockSize} /> : null}
            {hasBigWidgets ? (
                <>
                    {dateHeadingVisible ? dateHeadingRow : null}
                    {largeWidgetsRow}
                </>
            ) : (
                dateRow
            )}
            {infoWidgets}
            {alertStripVisible && (
                <div
                    style={{
                        marginTop: alertsTop,
                        display: "flex",
                        justifyContent: "center",
                        width: "100%",
                        boxSizing: "border-box",
                    }}
                >
                    <AlertsListRow
                        alerts={overlayAlerts}
                        fontSize={widgetFontSize}
                        maxAlerts={maxAlerts}
                        use24h={settings.time_format_24h}
                        rowMaxWidth={alertsRowMax}
                        cardPadding={infoCardPad}
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
                    padding: displayClockSize * (isAnalogClock ? 0.26 : 0.35),
                    pointerEvents: "none",
                }}
            >
                <div style={largeCenteredPanelStyle(displayClockSize, color, isAnalogClock)}>
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
                    padding: clockSize * (isAnalogClock ? 0.38 : 0.55),
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
