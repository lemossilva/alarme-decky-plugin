import {
    FaSun,
    FaMoon,
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
import { useWeather } from "../../hooks/useWeather";
import { resolveScreensaverAccentColor } from "../../utils/screensaverAccent";

function aqiColor(aqi: number): string {
    if (aqi <= 50) return "#9dffb0";
    if (aqi <= 100) return "#f0e68c";
    if (aqi <= 150) return "#ffb87a";
    if (aqi <= 200) return "#ff9a9a";
    if (aqi <= 300) return "#d4b5ff";
    return "#ff9ecf";
}

function wmoIconAndLabel(code: number | null, isDay: number | null): { label: string; icon: JSX.Element; size: number } {
    const day = isDay === 1;
    const sz = 14;
    if (code === null || code === undefined) {
        return { label: "", icon: <FaCloud size={sz} />, size: sz };
    }
    if (code === 0) {
        return {
            label: "Clear",
            icon: day ? <FaSun size={sz} /> : <FaMoon size={sz} />,
            size: sz,
        };
    }
    if (code <= 3) {
        return {
            label: "Cloudy",
            icon: day ? <FaCloudSun size={sz} /> : <FaCloud size={sz} />,
            size: sz,
        };
    }
    if (code <= 48) {
        return { label: "Fog", icon: <FaSmog size={sz} />, size: sz };
    }
    if (code <= 67) {
        return { label: "Rain", icon: <FaCloudRain size={sz} />, size: sz };
    }
    if (code <= 77) {
        return { label: "Snow", icon: <FaSnowflake size={sz} />, size: sz };
    }
    if (code <= 82) {
        return { label: "Showers", icon: <FaCloudShowersHeavy size={sz} />, size: sz };
    }
    return { label: "Storm", icon: <FaBolt size={sz} />, size: sz };
}

interface WeatherWidgetProps {
    fontSize: number;
    show: boolean;
    layout: "compact" | "card";
}

export function WeatherWidget({ fontSize, show, layout }: WeatherWidgetProps) {
    const { settings } = useSettings();
    const w = useWeather(show);

    if (!show) return null;

    if (w.loading && w.temperature === null && !w.error) {
        return layout === "compact" ? (
            <span style={{ opacity: 0.5, fontSize, whiteSpace: "nowrap" }}>…</span>
        ) : (
            <div style={{ fontSize: fontSize * 0.7, opacity: 0.6 }}>Loading weather…</div>
        );
    }

    if (w.error || !w.success) {
        if (layout === "compact") return null;
        return (
            <div style={{ fontSize: fontSize * 0.55, opacity: 0.65, textAlign: "center", maxWidth: 280 }}>
                {w.error === "no_location" ? "Set a location in Weather settings." : w.error || "Weather unavailable"}
            </div>
        );
    }

    const unit = settings.screensaver_weather_unit === "F" ? "F" : "C";
    const showHiLo = settings.screensaver_weather_show_highlow ?? true;
    const showCond = settings.screensaver_weather_show_condition ?? true;
    const city = settings.screensaver_weather_city_name || "";
    const code = w.weathercode != null && Number.isFinite(w.weathercode) ? Math.round(w.weathercode) : null;
    const { label, icon } = wmoIconAndLabel(code, w.isDay);
    const t = w.temperature != null ? Math.round(w.temperature) : "—";
    const u = `°${unit}`;

    const aqiVal = w.aqiUs != null && Number.isFinite(w.aqiUs) ? Math.round(w.aqiUs) : null;
    const humidityVal = w.humidity != null && Number.isFinite(w.humidity) ? Math.round(w.humidity) : null;

    if (layout === "compact") {
        return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", fontSize }}>
                <span style={{ display: "flex", opacity: 0.9 }}>{icon}</span>
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{t}{u}</span>
                {humidityVal != null ? (
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            fontFamily: "monospace",
                            fontWeight: 600,
                            fontSize: fontSize * 0.88,
                            opacity: 0.8,
                        }}
                    >
                        · <FaTint size={Math.round(fontSize * 0.75)} /> {humidityVal}%
                    </span>
                ) : null}
                {aqiVal != null ? (
                    <span
                        style={{
                            fontFamily: "monospace",
                            fontWeight: 600,
                            fontSize: fontSize * 0.88,
                            color: resolveScreensaverAccentColor(settings),
                            opacity: 0.92,
                        }}
                    >
                        · AQI {aqiVal}
                    </span>
                ) : null}
            </span>
        );
    }

    const subParts: string[] = [];
    if (showCond && label) subParts.push(label);
    if (showHiLo && w.tempMin != null && w.tempMax != null) {
        subParts.push(`${Math.round(w.tempMax)}° / ${Math.round(w.tempMin)}°`);
    }

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: fontSize * 0.12,
            textAlign: "center",
            minWidth: 120,
        }}>
            {city ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: fontSize * 0.08, maxWidth: 280 }}>
                    <div style={{ fontSize: fontSize * 0.55, opacity: 0.72 }}>
                        {city}
                    </div>
                </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "flex", opacity: 0.95 }}>{icon}</span>
                <span style={{ fontFamily: "monospace", fontSize: fontSize * 1.55, fontWeight: 700, lineHeight: 1 }}>
                    {t}{u}
                </span>
            </div>
            {subParts.length > 0 && (
                <div style={{ fontSize: fontSize * 0.68, opacity: 0.78 }}>
                    {subParts.join(" · ")}
                </div>
            )}
            {humidityVal != null ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: fontSize * 0.62, opacity: 0.78, lineHeight: 1.2 }}>
                    <FaTint size={Math.round(fontSize * 0.55)} />
                    <span>{humidityVal}% humidity</span>
                </div>
            ) : null}
            {aqiVal != null ? (
                <div style={{ fontSize: fontSize * 0.62, fontWeight: 600, color: aqiColor(aqiVal), lineHeight: 1.2 }}>
                    AQI {aqiVal}
                </div>
            ) : null}
        </div>
    );
}
