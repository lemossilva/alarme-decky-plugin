import { useEffect, useState, useCallback } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { UserSettings, Preset } from '../types';

// Backend callables
const getSettingsCall = callable<[], UserSettings>('get_settings');
const updateSettingsCall = callable<[settings: Partial<UserSettings>], UserSettings>('update_settings');
const getPresetsCall = callable<[], Preset[]>('get_presets');
const savePresetCall = callable<[seconds: number, label: string], Preset>('save_preset');
const removePresetCall = callable<[preset_id: string], boolean>('remove_preset');

const DEFAULT_SETTINGS: UserSettings = {
    snooze_duration: 5,
    time_format_24h: true,
    // Timer settings
    timer_sound: 'alarm.mp3',
    timer_volume: 100,
    timer_subtle_mode: false,
    timer_auto_suspend: false,
    // Pomodoro settings
    pomodoro_sound: 'alarm.mp3',
    pomodoro_volume: 100,
    pomodoro_subtle_mode: false,
    pomodoro_work_duration: 25,
    pomodoro_break_duration: 5,
    pomodoro_long_break_duration: 15,
    pomodoro_sessions_until_long_break: 4,
    pomodoro_daily_goal_enabled: false,
    pomodoro_daily_goal: 4,  // 4 hours default
    // Missed Alerts settings
    missed_alerts_enabled: true,
    missed_alerts_mode: 'report',
    missed_alerts_window: 24,
    // Suspend Behavior
    reminder_suspend_behavior: 'continue', // 'continue' = missed alerts, 'pause' = shift schedule
    pomodoro_suspend_behavior: 'continue'  // 'continue' = missed session, 'pause' = shift session
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
    const savePreset = useCallback(async (seconds: number, label: string) => {
        try {
            await savePresetCall(seconds, label);
        } catch (e) {
            console.error('Failed to save preset:', e);
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
        removePreset,
        refresh: loadData
    };
}
