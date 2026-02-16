import { useEffect, useState, useCallback, useRef } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { OverlayAlert, UserSettings, TimerTickEvent, PomodoroTickEvent } from '../types';

// Backend callable
const getOverlayDataCall = callable<[], { alerts: OverlayAlert[]; settings: Record<string, any> }>('get_overlay_data');

export function useOverlayData(settings: UserSettings, isGameRunning?: boolean) {
    const [alerts, setAlerts] = useState<OverlayAlert[]>([]);
    const alertsRef = useRef<OverlayAlert[]>([]);

    // Fetch full overlay data from backend
    const fetchOverlayData = useCallback(async () => {
        if (!settings.overlay_enabled) {
            setAlerts([]);
            alertsRef.current = [];
            return;
        }
        try {
            const data = await getOverlayDataCall();
            if (data && data.alerts) {
                setAlerts(data.alerts);
                alertsRef.current = data.alerts;
            }
        } catch (e) {
            console.error('[AlarMe Overlay] Failed to fetch overlay data:', e);
        }
    }, [settings.overlay_enabled]);

    useEffect(() => {
        if (!settings.overlay_enabled) {
            setAlerts([]);
            alertsRef.current = [];
            return;
        }

        // Initial fetch
        fetchOverlayData();

        // Re-fetch when data sources change
        const handleTimersUpdated = () => fetchOverlayData();
        const handleAlarmsUpdated = () => fetchOverlayData();
        const handleRemindersUpdated = () => fetchOverlayData();
        const handlePomodoroStarted = () => fetchOverlayData();
        const handlePomodoroStopped = () => fetchOverlayData();
        const handlePomodoroPhaseChanged = () => fetchOverlayData();

        // Real-time tick updates for timers (update remaining in-place)
        const handleTimerTick = (event: TimerTickEvent) => {
            setAlerts(prev => prev.map(alert =>
                alert.id === `timer-${event.id}`
                    ? { ...alert, remaining: event.remaining }
                    : alert
            ));
        };

        // Real-time tick updates for pomodoro
        const handlePomodoroTick = (event: PomodoroTickEvent) => {
            setAlerts(prev => prev.map(alert =>
                alert.category === 'pomodoro'
                    ? {
                        ...alert,
                        remaining: event.remaining,
                        label: `${event.is_break ? 'Break' : 'Focus'} #${event.session}`
                    }
                    : alert
            ));
        };

        addEventListener('alarme_timers_updated', handleTimersUpdated);
        addEventListener('alarme_alarms_updated', handleAlarmsUpdated);
        addEventListener('alarme_reminders_updated', handleRemindersUpdated);
        addEventListener('alarme_pomodoro_started', handlePomodoroStarted);
        addEventListener('alarme_pomodoro_stopped', handlePomodoroStopped);
        addEventListener('alarme_pomodoro_phase_changed', handlePomodoroPhaseChanged);
        addEventListener('alarme_timer_tick', handleTimerTick);
        addEventListener('alarme_pomodoro_tick', handlePomodoroTick);

        // Periodic refresh for alarm countdown updates (every 30s)
        const refreshInterval = setInterval(fetchOverlayData, 30000);

        return () => {
            removeEventListener('alarme_timers_updated', handleTimersUpdated);
            removeEventListener('alarme_alarms_updated', handleAlarmsUpdated);
            removeEventListener('alarme_reminders_updated', handleRemindersUpdated);
            removeEventListener('alarme_pomodoro_started', handlePomodoroStarted);
            removeEventListener('alarme_pomodoro_stopped', handlePomodoroStopped);
            removeEventListener('alarme_pomodoro_phase_changed', handlePomodoroPhaseChanged);
            removeEventListener('alarme_timer_tick', handleTimerTick);
            removeEventListener('alarme_pomodoro_tick', handlePomodoroTick);
            clearInterval(refreshInterval);
        };
    }, [settings.overlay_enabled, fetchOverlayData]);

    // Re-fetch when category filters or time window change
    useEffect(() => {
        if (settings.overlay_enabled) {
            fetchOverlayData();
        }
    }, [
        settings.overlay_display_mode,
        settings.overlay_position,
        settings.overlay_custom_x,
        settings.overlay_custom_y,
        settings.overlay_show_timers,
        settings.overlay_show_alarms,
        settings.overlay_show_pomodoros,
        settings.overlay_show_reminders,
        settings.overlay_time_window,
        settings.overlay_max_alerts,
        isGameRunning,
        fetchOverlayData
    ]);

    return alerts;
}
