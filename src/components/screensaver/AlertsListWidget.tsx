import { Fragment } from "react";
import type { CSSProperties } from "react";
import { FaStopwatch, FaBell, FaBrain, FaRedo, FaHourglassHalf } from "react-icons/fa";
import { useOverlayData } from "../../hooks/useOverlayData";
import { useSettings } from "../../hooks/useSettings";
import { formatDuration, formatTime } from "../../utils/time";
import { displayAlertLabel } from "../../utils/overlayAlertDisplay";
import type { OverlayAlert } from "../../types";
import { ItemBadges } from "../ItemBadges";

const ICONS: Record<string, JSX.Element> = {
    timer: <FaHourglassHalf />,
    alarm: <FaBell />,
    pomodoro: <FaBrain />,
    reminder: <FaRedo />,
    stopwatch: <FaStopwatch />,
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

export interface AlertsListRowProps {
    alerts: OverlayAlert[];
    fontSize: number;
    maxAlerts: number;
    use24h: boolean;
    rowMaxWidth?: number | string;
    cardPadding?: string;
}

/** Horizontal chips + separators (same idea as GameOverlay). No hooks. */
export function AlertsListRow({
    alerts,
    fontSize,
    maxAlerts,
    use24h,
    rowMaxWidth = "min(92vw, 1200px)",
    cardPadding,
}: AlertsListRowProps) {
    const visible = alerts.slice(0, maxAlerts);
    if (visible.length === 0) return null;

    const textSize = Math.max(9, fontSize * 0.58);
    const iconSize = Math.max(8, textSize - 1);

    const chipStyle: CSSProperties = {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        whiteSpace: "nowrap",
        padding: "5px 9px",
        backgroundColor: "rgba(255,255,255,0.07)",
        borderRadius: 6,
        fontSize: textSize,
        lineHeight: 1,
        flexShrink: 0,
    };

    const row = (
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                maxWidth: rowMaxWidth,
                boxSizing: "border-box",
            }}
        >
            {visible.map((alert, index) => (
                <Fragment key={alert.id}>
                    {index > 0 && (
                        <span
                            style={{
                                opacity: 0.35,
                                fontSize: Math.max(9, textSize * 0.85),
                                lineHeight: 0,
                                userSelect: "none",
                            }}
                        >
                            ·
                        </span>
                    )}
                    <div style={chipStyle}>
                        <span style={{ opacity: 0.75, display: "flex", alignItems: "center", fontSize: iconSize }}>
                            {ICONS[alert.category] || <FaBell />}
                        </span>
                        <span style={{ opacity: 0.88, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {displayAlertLabel(alert)}
                        </span>
                        <ItemBadges item={alert} size={Math.max(8, textSize - 2)} monochrome />
                        <span style={{ fontFamily: "monospace", fontWeight: 600, flexShrink: 0, opacity: 1 }}>
                            {formatAlertStr(alert, use24h)}
                        </span>
                    </div>
                </Fragment>
            ))}
        </div>
    );

    if (!cardPadding) return row;

    return (
        <div
            style={{
                padding: cardPadding,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: 8,
                boxSizing: "border-box",
                display: "flex",
                justifyContent: "center",
                maxWidth: rowMaxWidth,
            }}
        >
            {row}
        </div>
    );
}

interface AlertsListWidgetProps {
    fontSize: number;
    maxAlerts: number;
    rowMaxWidth?: number | string;
    cardPadding?: string;
}

/** Subscribes to overlay data and renders {@link AlertsListRow}. */
export function AlertsListWidget({ fontSize, maxAlerts, rowMaxWidth, cardPadding }: AlertsListWidgetProps) {
    const { settings } = useSettings();
    const alerts = useOverlayData(settings);
    return (
        <AlertsListRow
            alerts={alerts}
            fontSize={fontSize}
            maxAlerts={maxAlerts}
            use24h={settings.time_format_24h}
            rowMaxWidth={rowMaxWidth}
            cardPadding={cardPadding}
        />
    );
}
