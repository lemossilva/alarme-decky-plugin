import { useState, useEffect, useRef } from "react";
import {
    FaBatteryFull,
    FaBatteryThreeQuarters,
    FaBatteryHalf,
    FaBatteryQuarter,
    FaBolt,
} from "react-icons/fa";
import { useSettings } from "../../hooks/useSettings";
import { useBatteryInfo } from "../../hooks/useBatteryInfo";

interface BatteryWidgetProps {
    fontSize: number;
    showPct: boolean;
}

function formatBatteryEta(seconds: number): string | null {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h >= 72) return ">3d";
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return "<1m";
}

interface BatteryLike {
    level: number;
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    addEventListener: (ev: string, fn: () => void) => void;
    removeEventListener: (ev: string, fn: () => void) => void;
}

export function BatteryWidget({ fontSize, showPct }: BatteryWidgetProps) {
    const { settings } = useSettings();
    const showBattery = settings.screensaver_center_show_battery ?? true;
    const upower = useBatteryInfo(showBattery);
    const [webPct, setWebPct] = useState<number | null>(null);
    const [webCharging, setWebCharging] = useState(false);
    const [webChargeEtaSec, setWebChargeEtaSec] = useState<number | null>(null);
    const [webDischargeEtaSec, setWebDischargeEtaSec] = useState<number | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);
    const showBar = settings.screensaver_battery_show_bar ?? false;
    const lowThreshold = settings.screensaver_battery_low_threshold ?? 20;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!showBattery) return;

        let battery: BatteryLike | null = null;

        const apply = (b: BatteryLike) => {
            const c = b.charging;
            const ct = b.chargingTime;
            const dt = b.dischargingTime;
            let charge: number | null = null;
            let discharge: number | null = null;
            if (c && Number.isFinite(ct) && ct > 0 && ct !== Number.POSITIVE_INFINITY) {
                charge = ct;
            }
            if (!c && Number.isFinite(dt) && dt > 0 && dt !== Number.POSITIVE_INFINITY) {
                discharge = dt;
            }
            if (!mountedRef.current) return;
            setWebPct(Math.round(b.level * 100));
            setWebCharging(c);
            setWebChargeEtaSec(charge);
            setWebDischargeEtaSec(discharge);
        };

        const onLevel = () => battery && apply(battery);
        const onCharging = () => battery && apply(battery);
        const onChargeTime = () => battery && apply(battery);
        const onDischargeTime = () => battery && apply(battery);

        const start = async () => {
            try {
                if (!("getBattery" in navigator)) return;
                const b = (await (navigator as Navigator & { getBattery?: () => Promise<BatteryLike> }).getBattery?.()) as
                    | BatteryLike
                    | undefined;
                if (!b || !mountedRef.current) return;
                battery = b;
                apply(b);
                b.addEventListener("levelchange", onLevel);
                b.addEventListener("chargingchange", onCharging);
                b.addEventListener("chargingtimechange", onChargeTime);
                b.addEventListener("dischargingtimechange", onDischargeTime);
            } catch {
                /* Battery API unavailable */
            }
        };

        void start();
        intervalRef.current = setInterval(() => {
            if (battery) apply(battery);
        }, 30000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            if (battery) {
                battery.removeEventListener("levelchange", onLevel);
                battery.removeEventListener("chargingchange", onCharging);
                battery.removeEventListener("chargingtimechange", onChargeTime);
                battery.removeEventListener("dischargingtimechange", onDischargeTime);
            }
            battery = null;
        };
    }, [showBattery]);

    if (!showBattery) return null;

    const pct =
        upower.ok && upower.percent != null ? upower.percent : webPct;
    const charging =
        upower.ok && upower.charging != null ? upower.charging : webCharging;

    const dischargeEtaSec = !charging
        ? (upower.ok && upower.time_to_empty_sec != null ? upower.time_to_empty_sec : webDischargeEtaSec)
        : null;
    const chargeEtaSec = charging
        ? (upower.ok && upower.time_to_full_sec != null ? upower.time_to_full_sec : webChargeEtaSec)
        : null;

    if (pct === null) return null;

    const getColor = () => {
        if (pct <= 10) return "#cc4444";
        if (pct <= lowThreshold) return "#e6a817";
        return undefined;
    };

    const iconSize = fontSize * 0.85;
    const boltSmall = Math.max(10, iconSize * 0.55);

    const getIcon = () => {
        if (charging) {
            if (pct >= 96) {
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <FaBatteryFull size={iconSize} />
                        <FaBolt size={boltSmall} style={{ opacity: 0.95 }} />
                    </span>
                );
            }
            return <FaBolt size={iconSize} />;
        }
        if (pct >= 95) return <FaBatteryFull size={iconSize} />;
        if (pct > 75) return <FaBatteryThreeQuarters size={iconSize} />;
        if (pct > 40) return <FaBatteryHalf size={iconSize} />;
        return <FaBatteryQuarter size={iconSize} />;
    };

    const color = getColor();
    const etaFs = Math.max(8, fontSize * 0.48);
    const chargeLabel = chargeEtaSec != null ? formatBatteryEta(chargeEtaSec) : null;
    const dischargeLabel = dischargeEtaSec != null ? formatBatteryEta(dischargeEtaSec) : null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center", maxWidth: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color, fontSize, fontWeight: 600 }}>
                {getIcon()}
                {showPct && <span style={{ fontVariantNumeric: "tabular-nums" }}>{pct}%</span>}
            </div>
            {(charging ? chargeLabel : dischargeLabel) ? (
                <div
                    style={{
                        fontSize: etaFs,
                        opacity: 0.72,
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "center",
                        lineHeight: 1.2,
                        maxWidth: "100%",
                    }}
                >
                    {charging ? (
                        <>
                            {pct >= 98 ? "Full ~" : "Full in "}
                            {chargeLabel}
                        </>
                    ) : (
                        <>~{dischargeLabel} left</>
                    )}
                </div>
            ) : null}
            {showBar && (
                <div
                    style={{
                        width: fontSize * 4,
                        maxWidth: "100%",
                        height: 3,
                        backgroundColor: "rgba(255,255,255,0.1)",
                        borderRadius: 2,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            width: `${pct}%`,
                            height: "100%",
                            backgroundColor: color || "#8b8b8b",
                            borderRadius: 2,
                            transition: "width 0.5s ease",
                        }}
                    />
                </div>
            )}
        </div>
    );
}
