import { FaStopwatch, FaBell, FaBrain, FaRedo, FaHourglassHalf, FaShieldAlt, FaVolumeMute, FaMoon } from "react-icons/fa";
import { useOverlayData } from "../../hooks/useOverlayData";
import { useSettings } from "../../hooks/useSettings";
import { formatDuration, formatTime } from "../../utils/time";
import type { OverlayAlert } from "../../types";

const ICONS: Record<string, JSX.Element> = {
    timer: <FaHourglassHalf />,
    alarm: <FaBell />,
    pomodoro: <FaBrain />,
    reminder: <FaRedo />,
    stopwatch: <FaStopwatch />
};

function formatAlertStr(alert: OverlayAlert, use24h: boolean): string {
    const remaining = alert.remaining ?? (alert.time - Date.now() / 1000);
    if (alert.category === "stopwatch") return formatDuration(Math.round(remaining));
    if (alert.category === "timer" || alert.category === "pomodoro") {
        return remaining > 0 ? formatDuration(Math.round(remaining)) : "0:00";
    }
    if (remaining <= 0) return "Now";
    if (remaining < 60) return "<1m";
    if (remaining < 3600) return `${Math.ceil(remaining / 60)}m`;
    if (remaining < 86400) {
        const hrs = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    }
    const date = new Date(alert.time * 1000);
    return formatTime(date.getHours(), date.getMinutes(), use24h);
}

interface AlertsListWidgetProps {
    fontSize: number;
    maxAlerts: number;
    /** Default 300; use a CSS length for wide layouts (e.g. fullscreen spread). */
    stackMaxWidth?: number | string;
}

export function AlertsListWidget({ fontSize, maxAlerts, stackMaxWidth = 300 }: AlertsListWidgetProps) {
    const { settings } = useSettings();
    const alerts = useOverlayData(settings);
    const visible = alerts.slice(0, maxAlerts);

    if (visible.length === 0) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", maxWidth: stackMaxWidth }}>
            {visible.map(alert => (
                <div key={alert.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: 6,
                    fontSize: fontSize * 0.65,
                }}>
                    <span style={{ opacity: 0.7, display: "flex", alignItems: "center", fontSize: fontSize * 0.55 }}>
                        {ICONS[alert.category] || <FaBell />}
                    </span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.85 }}>
                        {alert.label}
                    </span>
                    {alert.prevent_sleep && (
                        <FaShieldAlt size={fontSize * 0.5} color="#e69900" />
                    )}
                    {alert.auto_suspend ? (
                        <FaMoon size={fontSize * 0.5} opacity={0.6} />
                    ) : alert.subtle_mode && (
                        <FaVolumeMute size={fontSize * 0.5} opacity={0.6} />
                    )}
                    <span style={{ fontFamily: "monospace", fontWeight: 600, flexShrink: 0 }}>
                        {formatAlertStr(alert, settings.time_format_24h)}
                    </span>
                </div>
            ))}
        </div>
    );
}
