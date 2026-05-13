import {
    FaSun,
    FaCloud,
    FaCloudSun,
    FaSmog,
    FaCloudRain,
    FaSnowflake,
    FaBolt,
    FaCloudShowersHeavy,
    FaTint,
} from "react-icons/fa";
import { useSettings } from "../../hooks/useSettings";
import { useWeather, ForecastDay } from "../../hooks/useWeather";

const DAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function wmoIcon(code: number | null, size: number): JSX.Element {
    if (code === null || code === undefined) {
        return <FaCloud size={size} />;
    }
    if (code === 0) {
        return <FaSun size={size} />;
    }
    if (code <= 3) {
        return <FaCloudSun size={size} />;
    }
    if (code <= 48) {
        return <FaSmog size={size} />;
    }
    if (code <= 67) {
        return <FaCloudRain size={size} />;
    }
    if (code <= 77) {
        return <FaSnowflake size={size} />;
    }
    if (code <= 82) {
        return <FaCloudShowersHeavy size={size} />;
    }
    return <FaBolt size={size} />;
}

interface ForecastWidgetProps {
    fontSize: number;
    show: boolean;
}

/**
 * 7-day forecast widget. Total content height is sized to match the calendar
 * grid in DateWidget (heading line + ~6 rows of `fontSize * 1.1`).
 */
export function ForecastWidget({ fontSize, show }: ForecastWidgetProps) {
    const { settings } = useSettings();
    const w = useWeather(show);

    if (!show) return null;

    const showForecast = settings.screensaver_show_forecast ?? false;
    if (!showForecast) return null;

    if (w.loading && w.forecast.length === 0 && !w.error) {
        return (
            <div style={{ fontSize: fontSize * 0.7, opacity: 0.6 }}>Loading forecast…</div>
        );
    }

    if (w.error || !w.success || w.forecast.length === 0) {
        return null;
    }

    const showPrecip = settings.screensaver_forecast_show_precip ?? true;
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const hasPrecipData =
        showPrecip && w.forecast.some((d: ForecastDay) => d.precip_chance != null && d.precip_chance > 0);

    // Visual rhythm tuned to feel like the calendar grid (DateWidget):
    // - column width slightly wider than a single calendar day to fit "24°/18°"
    // - explicit vertical gap between text rows so digits never collide.
    const colWidth = fontSize * 2.0;
    const labelFs = Math.max(9, fontSize * 0.55);
    const tempFs = Math.max(10, fontSize * 0.65);
    const precipFs = Math.max(9, fontSize * 0.5);
    const iconSize = Math.max(14, fontSize * 0.95);
    const rowGap = Math.max(4, fontSize * 0.25);

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: `repeat(7, ${colWidth}px)`,
                columnGap: 2,
                rowGap,
                textAlign: "center",
                alignItems: "stretch",
            }}
        >
            {w.forecast.slice(0, 7).map((day: ForecastDay, i: number) => {
                const isToday = day.date === todayStr;
                const dateObj = day.date ? new Date(day.date + "T12:00:00") : null;
                const dayAbbrev = dateObj ? DAY_ABBREV[dateObj.getDay()] : "—";
                const high = day.high != null ? Math.round(day.high) : null;
                const low = day.low != null ? Math.round(day.low) : null;
                const precip = day.precip_chance;
                const wet = precip != null && precip > 0;

                return (
                    <div
                        key={i}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: rowGap,
                            padding: `${rowGap}px 2px`,
                            backgroundColor: isToday ? "rgba(255,255,255,0.12)" : "transparent",
                            borderRadius: 6,
                            lineHeight: 1,
                        }}
                    >
                        <div
                            style={{
                                fontSize: labelFs,
                                fontWeight: isToday ? 700 : 500,
                                opacity: isToday ? 1 : 0.75,
                                lineHeight: 1,
                            }}
                        >
                            {dayAbbrev}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: iconSize + 4,
                                opacity: 0.9,
                            }}
                        >
                            {wmoIcon(day.code, iconSize)}
                        </div>
                        <div
                            style={{
                                fontSize: tempFs,
                                fontWeight: 700,
                                lineHeight: 1,
                                fontVariantNumeric: "tabular-nums",
                                opacity: 0.95,
                            }}
                        >
                            {high != null ? `${high}°` : "—"}
                        </div>
                        <div
                            style={{
                                fontSize: tempFs * 0.85,
                                lineHeight: 1,
                                fontVariantNumeric: "tabular-nums",
                                opacity: 0.6,
                            }}
                        >
                            {low != null ? `${low}°` : "—"}
                        </div>
                        {hasPrecipData && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 2,
                                    fontSize: precipFs,
                                    lineHeight: 1,
                                    fontVariantNumeric: "tabular-nums",
                                    opacity: wet ? 0.85 : 0.3,
                                    color: precip != null && precip >= 50 ? "#6ba3d6" : undefined,
                                }}
                            >
                                <FaTint size={precipFs * 0.85} style={{ opacity: 0.75 }} />
                                <span>{wet ? `${precip}%` : "—"}</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
