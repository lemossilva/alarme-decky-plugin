import type { CSSProperties } from "react";
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
    FaUmbrella,
    FaWind,
} from "react-icons/fa";
import { useSettings } from "../../hooks/useSettings";
import { useScreensaverClock } from "../../hooks/useScreensaverClock";
import { screensaverCalendarGridContentHeightPx, type ScreensaverWidgetDensity } from "./DateWidget";
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

function formatPrecipSum(mm: number | null): string | null {
    if (mm == null || !Number.isFinite(mm) || mm < 0.05) return null;
    if (mm < 1) return `${(Math.round(mm * 10) / 10).toFixed(1)} mm`;
    return `${Math.round(mm)} mm`;
}

function formatWind(kmh: number | null, useMph: boolean): string | null {
    if (kmh == null || !Number.isFinite(kmh) || kmh < 0.5) return null;
    if (useMph) return `${Math.round(kmh * 0.621371)} mph`;
    return `${Math.round(kmh)} km/h`;
}

function formatHumidity(pct: number | null): string | null {
    if (pct == null || !Number.isFinite(pct)) return null;
    return `${Math.round(pct)}%`;
}

function formatUv(uv: number | null): string | null {
    if (uv == null || !Number.isFinite(uv) || uv < 1) return null;
    if (uv >= 10) return `UV ${Math.round(uv)}`;
    return `UV ${(Math.round(uv * 10) / 10).toFixed(1)}`;
}

interface ForecastWidgetProps {
    fontSize: number;
    show: boolean;
    density?: ScreensaverWidgetDensity;
}

export function ForecastWidget({ fontSize, show, density = "normal" }: ForecastWidgetProps) {
    const { settings } = useSettings();
    const clock = useScreensaverClock();
    const w = useWeather(show);

    if (!show) return null;

    if (w.loading && w.forecast.length === 0 && !w.error) {
        return (
            <div style={{ fontSize: fontSize * 0.7, opacity: 0.6 }}>Loading forecast…</div>
        );
    }

    if (w.error || !w.success || w.forecast.length === 0) {
        return null;
    }

    const unitF = settings.screensaver_weather_unit === "F";
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const tight = density === "tight";
    const colWidth = tight
        ? Math.max(48, Math.round(fontSize * 2.05))
        : Math.max(56, Math.round(fontSize * 2.55));
    const colGap = tight
        ? Math.max(3, Math.min(8, Math.round(fontSize * 0.12)))
        : Math.max(4, Math.min(10, Math.round(fontSize * 0.16)));
    const fontScale = tight ? 0.92 : 1;
    const labelFs = Math.max(9, fontSize * 0.55 * fontScale);
    const tempFs = Math.max(10, fontSize * 0.65 * fontScale);
    const precipFs = Math.max(9, fontSize * 0.5 * fontScale);
    const extrasFs = Math.max(8, fontSize * 0.42 * fontScale);
    const iconSize = Math.max(14, fontSize * 0.95 * fontScale);

    const rowLabel = Math.ceil(labelFs * 1.32);
    const rowIcon = Math.ceil(iconSize + 6);
    const rowHigh = Math.ceil(tempFs * 1.32);
    const rowLow = Math.ceil(tempFs * 0.85 * 1.32);
    const rowChance = Math.ceil(Math.max(17, precipFs * 1.58));
    const rowSum = Math.ceil(Math.max(15, extrasFs * 1.52));
    const rowWind = Math.ceil(Math.max(16, extrasFs * 1.58));
    const rowUv = Math.ceil(Math.max(15, extrasFs * 1.48));
    const rowHumidity = Math.ceil(Math.max(15, extrasFs * 1.52));

    const gridTemplateRows = [
        `${rowLabel}px`,
        `minmax(${rowIcon}px, 1fr)`,
        `minmax(${rowHigh}px, 1fr)`,
        `minmax(${rowLow}px, 1fr)`,
        `minmax(${rowChance}px, 1fr)`,
        `minmax(${rowSum}px, 1fr)`,
        `minmax(${rowWind}px, 1fr)`,
        `minmax(${rowUv}px, 1fr)`,
        `minmax(${rowHumidity}px, 1fr)`,
    ].join(" ");

    const slot: CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minWidth: 0,
        lineHeight: 1,
        boxSizing: "border-box",
    };

    const gridMinH = screensaverCalendarGridContentHeightPx(fontSize, clock.year, clock.month, density);

    return (
        <div
            style={{
                minHeight: gridMinH,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "1 1 auto",
            }}
        >
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(7, ${colWidth}px)`,
                    gridTemplateRows,
                    columnGap: colGap,
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
                    const sumLine = formatPrecipSum(day.precip_sum_mm);
                    const windLine = formatWind(day.wind_speed_max_kmh, unitF);
                    const uvLine = formatUv(day.uv_index_max);
                    const humidityLine = formatHumidity(day.humidity_mean);

                    const rowTrackCount = 9;
                    const colStyle: CSSProperties = {
                        display: "grid",
                        gridColumn: i + 1,
                        gridRow: `1 / ${rowTrackCount + 1}`,
                        gridTemplateRows,
                        height: "100%",
                        boxSizing: "border-box",
                        padding: `${Math.max(2, fontSize * 0.1)}px 1px`,
                        backgroundColor: isToday ? "rgba(255,255,255,0.12)" : "transparent",
                        borderRadius: 6,
                        minWidth: 0,
                    };

                    const cells: JSX.Element[] = [
                        <div
                            key="d"
                            style={{
                                ...slot,
                                fontSize: labelFs,
                                fontWeight: isToday ? 700 : 500,
                                opacity: isToday ? 1 : 0.75,
                            }}
                        >
                            {dayAbbrev}
                        </div>,
                        <div key="ic" style={{ ...slot, opacity: 0.9 }}>
                            {wmoIcon(day.code, iconSize)}
                        </div>,
                        <div
                            key="hi"
                            style={{
                                ...slot,
                                fontSize: tempFs,
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                                opacity: 0.95,
                            }}
                        >
                            {high != null ? `${high}°` : "—"}
                        </div>,
                        <div
                            key="lo"
                            style={{
                                ...slot,
                                fontSize: tempFs * 0.85,
                                fontVariantNumeric: "tabular-nums",
                                opacity: 0.6,
                            }}
                        >
                            {low != null ? `${low}°` : "—"}
                        </div>,
                    ];

                    cells.push(
                        <div
                            key="pc"
                            style={{
                                ...slot,
                                gap: 3,
                                fontSize: precipFs,
                                fontVariantNumeric: "tabular-nums",
                                opacity: wet ? 0.88 : 0.32,
                                color: precip != null && precip >= 50 ? "#6ba3d6" : undefined,
                            }}
                        >
                            <FaUmbrella size={Math.round(precipFs * 0.88)} style={{ opacity: 0.75, flexShrink: 0 }} />
                            <span>{wet && precip != null ? `${Math.round(precip)}%` : "—"}</span>
                        </div>,
                        <div
                            key="ps"
                            style={{
                                ...slot,
                                fontSize: extrasFs,
                                fontVariantNumeric: "tabular-nums",
                                opacity: sumLine ? 0.74 : 0.32,
                            }}
                        >
                            {sumLine ?? "—"}
                        </div>,
                    );

                    cells.push(
                        <div
                            key="wn"
                            style={{
                                ...slot,
                                gap: 3,
                                fontSize: extrasFs,
                                fontVariantNumeric: "tabular-nums",
                                opacity: windLine ? 0.7 : 0.32,
                            }}
                        >
                            <FaWind size={Math.round(extrasFs * 0.92)} style={{ opacity: 0.75, flexShrink: 0 }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {windLine ?? "—"}
                            </span>
                        </div>,
                        <div
                            key="uv"
                            style={{
                                ...slot,
                                fontSize: extrasFs,
                                opacity: uvLine ? 0.8 : 0.32,
                                color: uvLine ? "#f0c674" : undefined,
                            }}
                        >
                            {uvLine ?? "—"}
                        </div>,
                        <div
                            key="hu"
                            style={{
                                ...slot,
                                gap: 3,
                                fontSize: extrasFs,
                                fontVariantNumeric: "tabular-nums",
                                opacity: humidityLine ? 0.74 : 0.32,
                            }}
                        >
                            <FaTint size={Math.round(extrasFs * 0.92)} style={{ opacity: 0.75, flexShrink: 0 }} />
                            <span>{humidityLine ?? "—"}</span>
                        </div>
                    );

                    return (
                        <div key={i} style={colStyle}>
                            {cells}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
