import { useMemo } from "react";
import { FaStopwatch, FaBell, FaBrain, FaRedo, FaShieldAlt, FaMoon, FaVolumeMute, FaHourglassHalf, FaBellSlash } from "react-icons/fa";
import { useSettings } from "../hooks/useSettings";
import { useOverlayData } from "../hooks/useOverlayData";
import { useGameStatus } from "../hooks/useGameStatus";
import { useSleepInhibitor } from "../hooks/useSleepInhibitor";
import { useMissedAlerts } from "../hooks/useMissedAlerts";
import { formatDuration, formatTime } from "../utils/time";
import type { OverlayAlert } from "../types";

// Category icon mapping
const CATEGORY_ICONS: Record<string, JSX.Element> = {
    timer: <FaHourglassHalf />,
    alarm: <FaBell />,
    pomodoro: <FaBrain />,
    reminder: <FaRedo />,
    stopwatch: <FaStopwatch />
};

// Default position style (top-left corner)
const DEFAULT_POSITION_STYLE: React.CSSProperties = {
    top: 12,
    left: 12,
    justifyContent: 'flex-start',
    display: 'flex',
    alignItems: 'center'
};

// Format alert time display
function formatAlertTime(alert: OverlayAlert, use24h: boolean): string {
    const remaining = alert.remaining ?? (alert.time - Date.now() / 1000);

    // For stopwatch, show elapsed time (remaining is actually elapsed seconds)
    if (alert.category === 'stopwatch') {
        return formatDuration(Math.round(remaining));
    }

    // For timers and active pomodoro, show countdown
    if (alert.category === 'timer' || alert.category === 'pomodoro') {
        if (remaining > 0) {
            return formatDuration(Math.round(remaining));
        }
        return '0:00';
    }

    // For alarms and reminders, show relative or absolute time
    if (remaining <= 0) return 'Now';
    if (remaining < 60) return '<1m';
    if (remaining < 3600) {
        const mins = Math.ceil(remaining / 60);
        return `${mins}m`;
    }
    if (remaining < 86400) {
        const hrs = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    }

    // Show absolute time for far-off alerts
    const date = new Date(alert.time * 1000);
    return formatTime(date.getHours(), date.getMinutes(), use24h);
}

// Single alert item - compact for bar layout
const OverlayAlertItem = ({
    alert,
    textSize,
    use24h,
    compactMode,
    showPreventSleepBadge
}: {
    alert: OverlayAlert;
    textSize: number;
    use24h: boolean;
    compactMode?: boolean;
    showPreventSleepBadge?: boolean;
}) => {
    const iconSize = Math.max(8, textSize - 1);
    const showShield = showPreventSleepBadge && alert.prevent_sleep;

    const hasAnyIcon = alert.subtle_mode || alert.auto_suspend || showShield;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4, // Slightly increased gap for better legibility
            whiteSpace: 'nowrap',
            lineHeight: 1
        }}>
            <div style={{
                fontSize: iconSize,
                opacity: 0.8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                height: iconSize, // Force height to match font size for centering
                width: iconSize
            }}>
                {CATEGORY_ICONS[alert.category] || <FaBell />}
            </div>
            {!compactMode && (
                <span style={{
                    fontSize: textSize,
                    opacity: 0.9,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 80,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    {alert.label}
                </span>
            )}
            {hasAnyIcon && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    opacity: 0.8
                }}>
                    {showShield && (
                        <FaShieldAlt size={Math.max(8, textSize - 2)} color="#e69900" />
                    )}
                    {alert.auto_suspend ? (
                        <FaMoon size={Math.max(8, textSize - 2)} />
                    ) : (
                        alert.subtle_mode && <FaVolumeMute size={Math.max(8, textSize - 2)} />
                    )}
                </div>
            )}
            <span style={{
                fontSize: textSize,
                fontFamily: 'monospace',
                fontWeight: 600,
                opacity: 1,
                flexShrink: 0,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center'
            }}>
                {formatAlertTime(alert, use24h)}
            </span>
        </div>
    );
};

export const GameOverlay = () => {
    const { settings } = useSettings();
    const isGameRunning = useGameStatus();
    const alerts = useOverlayData(settings, isGameRunning);
    const { isActive: sleepInhibitorActive } = useSleepInhibitor();
    const { hasNewMissedAlerts } = useMissedAlerts();

    const positionStyle = useMemo(() => {
        const isCustom = settings.overlay_position === 'custom';
        if (isCustom) {
            return {
                ...DEFAULT_POSITION_STYLE,
                left: settings.overlay_custom_x ?? 12,
                top: settings.overlay_custom_y ?? 12
            };
        }
        return DEFAULT_POSITION_STYLE;
    }, [settings.overlay_position, settings.overlay_custom_x, settings.overlay_custom_y]);

    // Don't render if disabled or (no alerts AND no sleep inhibitor AND no missed alerts)
    if (!settings.overlay_enabled || (alerts.length === 0 && !sleepInhibitorActive && !hasNewMissedAlerts)) {
        return null;
    }

    // Display mode filtering
    const displayMode = settings.overlay_display_mode || 'always';
    if (displayMode === 'gaming_only' && !isGameRunning) {
        return null;
    }

    return (
        <div style={{
            position: 'fixed',
            ...positionStyle,
            zIndex: 7100,
            pointerEvents: 'none',
            opacity: settings.overlay_opacity ?? 0.85,
            color: '#8b8b8b',  // Match SteamOS muted text color
            fontFamily: 'system-ui, -apple-system, sans-serif',
            userSelect: 'none',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12
        }}>
            {/* Badges Container */}
            {((settings.overlay_show_prevent_sleep_badge ?? true) && sleepInhibitorActive) || 
             ((settings.overlay_show_missed_badge ?? true) && hasNewMissedAlerts) ? (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                }}>
                    {/* Sleep Inhibitor Indicator */}
                    {(settings.overlay_show_prevent_sleep_badge ?? true) && sleepInhibitorActive && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: '#e69900' // Elegant yellow-orange hue
                        }}>
                            <FaShieldAlt size={settings.overlay_text_size ?? 11} />
                        </div>
                    )}
                    
                    {/* Missed Alerts Indicator */}
                    {(settings.overlay_show_missed_badge ?? true) && hasNewMissedAlerts && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: '#ff4444' // Red alert hue
                        }}>
                            <FaBellSlash size={settings.overlay_text_size ?? 11} />
                        </div>
                    )}
                </div>
            ) : null}

            {/* Separator between badges and alerts if both exist */}
            {(((settings.overlay_show_prevent_sleep_badge ?? true) && sleepInhibitorActive) || 
              ((settings.overlay_show_missed_badge ?? true) && hasNewMissedAlerts)) && 
             alerts.length > 0 && (
                <div style={{ 
                    width: 1, 
                    height: (settings.overlay_text_size ?? 11) + 2, 
                    backgroundColor: '#8b8b8b', 
                    opacity: 0.3 
                }} />
            )}

            {/* Horizontal bar layout - alerts separated by dots */}
            {alerts.map((alert, index) => (
                <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {index > 0 && (
                        <span style={{
                            opacity: 0.4,
                            fontSize: 10,
                            lineHeight: 0,
                            display: 'flex',
                            alignItems: 'center',
                            height: '100%',
                            marginBottom: -1
                        }}>•</span>
                    )}
                    <OverlayAlertItem
                        alert={alert}
                        textSize={settings.overlay_text_size ?? 11}
                        use24h={settings.time_format_24h}
                        compactMode={settings.overlay_compact_mode}
                        showPreventSleepBadge={(settings.overlay_show_prevent_sleep_badge ?? true) && alerts.length > 1}
                    />
                </div>
            ))}
        </div>
    );
};
