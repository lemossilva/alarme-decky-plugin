import { useEffect, useState, useCallback } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { UserSettings, Preset } from '../types';

// Backend callables
const getSettingsCall = callable<[], UserSettings>('get_settings');
const updateSettingsCall = callable<[settings: Partial<UserSettings>], UserSettings>('update_settings');
const getPresetsCall = callable<[], Preset[]>('get_presets');
const savePresetCall = callable<[seconds: number, label: string, subtle_mode?: boolean, auto_suspend?: boolean], Preset>('save_preset');
const savePresetFromTimerCall = callable<[timer_id: string], Preset>('save_preset_from_timer');
const removePresetCall = callable<[preset_id: string], boolean>('remove_preset');

const DEFAULT_SETTINGS: UserSettings = {
    snooze_duration: 5,
    time_format_24h: true,
    // Timer settings
    timer_sound: 'alarm.mp3',
    timer_volume: 100,
    timer_subtle_mode: false,
    timer_auto_suspend: false,
    timer_prevent_sleep: false,
    // Pomodoro settings
    pomodoro_sound: 'alarm.mp3',
    pomodoro_volume: 100,
    pomodoro_subtle_mode: false,
    pomodoro_prevent_sleep: false,
    pomodoro_work_duration: 25,
    pomodoro_break_duration: 5,
    pomodoro_long_break_duration: 15,
    pomodoro_sessions_until_long_break: 4,
    pomodoro_daily_goal_enabled: false,
    pomodoro_daily_goal: 4,  // 4 hours default
    // Missed Alerts settings
    missed_alerts_enabled: true,
    missed_alerts_window: 24,
    // Screensaver settings
    screensaver_mode: 'dim' as 'off' | 'black' | 'dim' | 'wallpaper',
    screensaver_dim_opacity: 0.92,
    pomodoro_screensaver_mode: 'off' as 'off' | 'black' | 'dim',
    screensaver_idle_seconds: 15,
    overlay_during_screensaver: true,
    overlay_screensaver_show_clock: true,
    overlay_screensaver_show_date: true,
    overlay_screensaver_show_battery: true,
    // Screensaver 2.0 settings
    screensaver_standalone_enabled: false,
    screensaver_standalone_idle_seconds: 60,
    overlay_screensaver_layout: 'compact' as const,
    screensaver_clock_style: 'digital' as const,
    screensaver_clock_size: 20,
    screensaver_accent_color: 'muted_gray' as const,
    screensaver_show_day_of_week: true,
    screensaver_show_year: false,
    screensaver_show_calendar_grid: false,
    screensaver_battery_show_bar: false,
    screensaver_battery_low_threshold: 20,
    screensaver_show_alerts_list: true,
    screensaver_show_system_stats: false,
    screensaver_show_network_info: false,
    screensaver_show_weather: false,
    screensaver_weather_lat: null,
    screensaver_weather_lon: null,
    screensaver_weather_city_name: null,
    screensaver_weather_unit: 'C' as const,
    screensaver_weather_show_highlow: true,
    screensaver_weather_show_condition: true,
    screensaver_weather_refresh_minutes: 30,
    screensaver_weather_location_source: null,
    screensaver_nasa_api_key: '',
    screensaver_wallpaper_show_attribution: true,
    screensaver_wallpaper_provider: 'picsum' as const,
    screensaver_wallpaper_fit: 'cover' as const,
    screensaver_wallpaper_blur: 'none' as const,
    screensaver_wallpaper_dim: 0.4,
    screensaver_wallpaper_interval: 300,
    screensaver_wallpaper_pool_size: 5,
    screensaver_wallpaper_auto_rotate: true,
    screensaver_wallpaper_cache_updated_at: null,
    screensaver_wallpaper_shift_local: false,
    screensaver_floating_drift_range: 40,
    // Pixel shift for OLED burn-in prevention
    pixel_shift_enabled: true,
    pixel_shift_range: 3,
    pixel_shift_interval_seconds: 60,
    // Suspend Behavior
    reminder_suspend_behavior: 'continue', // 'continue' = missed alerts, 'pause' = shift schedule
    pomodoro_suspend_behavior: 'continue', // 'continue' = missed session, 'pause' = shift session
    // Display settings
    snooze_activation_delay: 2.0,
    // Overlay settings
    overlay_enabled: false,
    overlay_display_mode: 'both' as const,
    overlay_position: 'default' as const,
    overlay_custom_x: 10,
    overlay_custom_y: 12,
    overlay_text_size: 13,
    overlay_opacity: 0.4,
    overlay_max_alerts: 2,
    overlay_time_window: 1,
    overlay_show_timers: true,
    overlay_show_alarms: true,
    overlay_show_pomodoros: true,
    overlay_show_reminders: true,
    overlay_show_stopwatch: false,
    overlay_compact_mode: false,
    overlay_show_prevent_sleep_badge: true,
    overlay_show_missed_badge: true,
    // Timer presets settings
    presets_enabled: true,
    presets_max_visible: 5,
    // Tab Order
    tab_order: ["timers", "alarms", "pomodoro", "reminders", "stopwatch"],
    // Prevent Sleep settings
    prevent_sleep_enabled: false,
    prevent_sleep_timers: true,
    prevent_sleep_pomodoro: true,
    prevent_sleep_alarms: false,
    prevent_sleep_alarms_window: 60,  // default 1 hour
    prevent_sleep_reminders: false
};

export function useSettings() {
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [loading, setLoading] = useState(true);

    // Load initial settings and presets
    const loadData = useCallback(async () => {
        try {
            const [userSettings, userPresets] = await Promise.all([
                getSettingsCall(),
                getPresetsCall()
            ]);
            setSettings(userSettings);
            setPresets(userPresets);
        } catch (e) {
            console.error('Failed to load settings:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Update a single setting
    const updateSetting = useCallback(async <K extends keyof UserSettings>(
        key: K,
        value: UserSettings[K]
    ) => {
        try {
            const updatedSettings = await updateSettingsCall({ [key]: value });
            setSettings(updatedSettings);
        } catch (e) {
            console.error('Failed to update setting:', e);
        }
    }, []);

    // Update multiple settings
    const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
        try {
            const updatedSettings = await updateSettingsCall(newSettings);
            setSettings(updatedSettings);
        } catch (e) {
            console.error('Failed to update settings:', e);
        }
    }, []);

    // Save a new preset
    const savePreset = useCallback(async (
        seconds: number, 
        label: string, 
        subtleMode?: boolean, 
        autoSuspend?: boolean
    ) => {
        try {
            await savePresetCall(seconds, label, subtleMode, autoSuspend);
        } catch (e) {
            console.error('Failed to save preset:', e);
        }
    }, []);

    // Save preset from an active timer
    const savePresetFromTimer = useCallback(async (timerId: string) => {
        try {
            await savePresetFromTimerCall(timerId);
        } catch (e) {
            console.error('Failed to save preset from timer:', e);
        }
    }, []);

    // Remove a preset
    const removePreset = useCallback(async (presetId: string) => {
        try {
            await removePresetCall(presetId);
        } catch (e) {
            console.error('Failed to remove preset:', e);
        }
    }, []);

    // Event handlers
    useEffect(() => {
        const handleSettingsUpdated = (updatedSettings: UserSettings) => {
            setSettings(updatedSettings);
        };

        const handlePresetsUpdated = (updatedPresets: Preset[]) => {
            setPresets(updatedPresets);
        };

        addEventListener('alarme_settings_updated', handleSettingsUpdated);
        addEventListener('alarme_presets_updated', handlePresetsUpdated);

        // Load initial data
        loadData();

        return () => {
            removeEventListener('alarme_settings_updated', handleSettingsUpdated);
            removeEventListener('alarme_presets_updated', handlePresetsUpdated);
        };
    }, [loadData]);

    return {
        settings,
        presets,
        loading,
        updateSetting,
        updateSettings,
        savePreset,
        savePresetFromTimer,
        removePreset,
        refresh: loadData
    };
}
