import { useEffect, useState, useRef, useMemo } from "react";
import { FaStopwatch, FaBell, FaBrain, FaRedo } from "react-icons/fa";
import { useSettings } from "../hooks/useSettings";
import { useOverlayData } from "../hooks/useOverlayData";
import { useGameStatus } from "../hooks/useGameStatus";
import { formatDuration, formatTime } from "../utils/time";
import type { OverlayAlert, OverlayPosition } from "../types";

// Category icon mapping
const CATEGORY_ICONS: Record<string, JSX.Element> = {
    timer: <FaStopwatch />,
    alarm: <FaBell />,
    pomodoro: <FaBrain />,
    reminder: <FaRedo />
};

// Position CSS mapping - designed to fit in SteamOS UI black bar areas
// top-bar: The black strip at the very top (left of system tray)
// bottom-bar: The black strip at bottom (between STEAM MENU and controller hints)
const POSITION_STYLES: Record<OverlayPosition, React.CSSProperties> = {
    'top-bar': {
        top: 0,
        left: 0,
        right: 0,
        height: 40, // Match typical SteamOS header height
        paddingLeft: 24, // Safe margin from left edge
        paddingRight: 320, // Avoid system icons on the right
        justifyContent: 'flex-start',
        paddingTop: 0,    // Force zero padding
        paddingBottom: 0, // Force zero padding
        marginTop: 0,     // Ensure no margins
        // Ensure vertical centering happens in the container
        display: 'flex',
        alignItems: 'center'
    },
    'bottom-bar': {
        bottom: 0,
        left: 0,
        right: 0,
        height: 40, // Match typical SteamOS footer height
        paddingLeft: 200, // Safe margin after "STEAM MENU" button area
        paddingRight: 240, // Avoid controller hints area
        paddingTop: 0,
        paddingBottom: 0,
        marginBottom: 0,
        justifyContent: 'flex-start',
        display: 'flex',
        alignItems: 'center'
    }
};

// Format alert time display
function formatAlertTime(alert: OverlayAlert, use24h: boolean): string {
    const remaining = alert.remaining ?? (alert.time - Date.now() / 1000);

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
    use24h
}: {
    alert: OverlayAlert;
    textSize: number;
    use24h: boolean;
}) => {
    const iconSize = Math.max(8, textSize - 1);

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
    const alerts = useOverlayData(settings);
    const isGameRunning = useGameStatus();

    // Pixel shift state
    const [shiftX, setShiftX] = useState(0);
    const shiftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Pixel shift effect
    useEffect(() => {
        if (!settings.overlay_enabled || !settings.overlay_pixel_shift) {
            setShiftX(0);
            if (shiftTimerRef.current) {
                clearInterval(shiftTimerRef.current);
                shiftTimerRef.current = null;
            }
            return;
        }

        const range = settings.overlay_pixel_shift_range || 3;
        const interval = (settings.overlay_pixel_shift_interval || 45) * 1000;

        const doShift = () => {
            setShiftX(Math.round((Math.random() * 2 - 1) * range));
        };

        // Initial shift
        doShift();

        shiftTimerRef.current = setInterval(doShift, interval);

        return () => {
            if (shiftTimerRef.current) {
                clearInterval(shiftTimerRef.current);
                shiftTimerRef.current = null;
            }
        };
    }, [
        settings.overlay_enabled,
        settings.overlay_pixel_shift,
        settings.overlay_pixel_shift_interval,
        settings.overlay_pixel_shift_range
    ]);

    // Position styles - use different positions for in-game vs SteamOS UI
    // Unified position setting for both in-game and SteamOS UI
    const currentPosition = settings.overlay_position || 'bottom-bar';

    const positionStyle = useMemo(() =>
        POSITION_STYLES[currentPosition] || POSITION_STYLES['top-bar'],
        [currentPosition]
    );

    // For bar positions, transform is already in the style. Only add pixel shift.
    // Apply pixel shift only horizontally for bar positions to avoid breaking the bar layout
    const shiftTransform = `translateX(${shiftX}px)`;
    // Combine with any existing transform from position style
    const existingTransform = positionStyle.transform || '';
    const transform = existingTransform ? `${existingTransform} ${shiftTransform}` : shiftTransform;

    // Don't render if disabled or no alerts
    if (!settings.overlay_enabled || alerts.length === 0) {
        return null;
    }

    // Display mode check
    const displayMode = settings.overlay_display_mode || 'always';
    if (displayMode === 'games_only' && !isGameRunning) return null;
    if (displayMode === 'steamui_only' && isGameRunning) return null;

    return (
        <div style={{
            position: 'fixed',
            ...positionStyle,
            zIndex: 7100,
            pointerEvents: 'none',
            transform,
            transition: 'transform 0.5s ease',
            opacity: settings.overlay_opacity ?? 0.85,
            color: '#8b8b8b',  // Match SteamOS muted text color
            fontFamily: 'system-ui, -apple-system, sans-serif',
            userSelect: 'none',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12
        }}>
            {/* Horizontal bar layout - alerts separated by dots */}
            {alerts.map((alert, index) => (
                <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {index > 0 && (
                        <span style={{
                            opacity: 0.4,
                            fontSize: 10, // Slightly larger dot for better centering visual
                            lineHeight: 0, // Reset line height for symbols
                            display: 'flex',
                            alignItems: 'center',
                            height: '100%',
                            marginBottom: -1 // Half-pixel adjustment for symbol baseline bias
                        }}>•</span> // Used smaller bullet for better centering
                    )}
                    <OverlayAlertItem
                        alert={alert}
                        textSize={settings.overlay_text_size ?? 11}
                        use24h={settings.time_format_24h}
                    />
                </div>
            ))}
        </div>
    );
};
