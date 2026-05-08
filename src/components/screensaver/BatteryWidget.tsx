import { useState, useEffect, useRef } from "react";
import { FaBatteryFull, FaBatteryThreeQuarters, FaBatteryHalf, FaBatteryQuarter, FaBolt } from "react-icons/fa";
import { useSettings } from "../../hooks/useSettings";

interface BatteryWidgetProps {
    fontSize: number;
    showPct: boolean;
}

export function BatteryWidget({ fontSize, showPct }: BatteryWidgetProps) {
    const { settings } = useSettings();
    const [pct, setPct] = useState<number | null>(null);
    const [charging, setCharging] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const showBar = settings.screensaver_battery_show_bar ?? false;
    const lowThreshold = settings.screensaver_battery_low_threshold ?? 20;
    const showBattery = settings.overlay_screensaver_show_battery ?? true;

    useEffect(() => {
        if (!showBattery) return;

        let cancelled = false;
        const update = async () => {
            try {
                if ("getBattery" in navigator) {
                    const battery = await (navigator as any).getBattery();
                    if (!cancelled) {
                        setPct(Math.round(battery.level * 100));
                        setCharging(battery.charging);
                        battery.addEventListener("levelchange", () => { if (!cancelled) setPct(Math.round(battery.level * 100)); });
                        battery.addEventListener("chargingchange", () => { if (!cancelled) setCharging(battery.charging); });
                    }
                }
            } catch { }
        };

        update();
        intervalRef.current = setInterval(update, 30000);
        return () => { cancelled = true; if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [showBattery]);

    if (!showBattery || pct === null) return null;

    const getColor = () => {
        if (pct <= 10) return "#cc4444";
        if (pct <= lowThreshold) return "#e6a817";
        return undefined;
    };

    const getIcon = () => {
        if (charging) return <FaBolt size={fontSize * 0.85} />;
        if (pct > 75) return <FaBatteryFull size={fontSize * 0.85} />;
        if (pct > 50) return <FaBatteryThreeQuarters size={fontSize * 0.85} />;
        if (pct > 25) return <FaBatteryHalf size={fontSize * 0.85} />;
        return <FaBatteryQuarter size={fontSize * 0.85} />;
    };

    const color = getColor();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3, color, fontSize, fontWeight: 600 }}>
                {getIcon()}
                {showPct && <span>{pct}%</span>}
            </div>
            {showBar && (
                <div style={{
                    width: fontSize * 4, height: 3,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    borderRadius: 2, overflow: "hidden"
                }}>
                    <div style={{
                        width: `${pct}%`, height: "100%",
                        backgroundColor: color || "#8b8b8b",
                        borderRadius: 2,
                        transition: "width 0.5s ease"
                    }} />
                </div>
            )}
        </div>
    );
}
