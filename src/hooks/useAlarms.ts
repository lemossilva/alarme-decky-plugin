import { useEffect, useState, useCallback } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { Alarm, RecurringType, SoundFile } from '../types';

// Backend callables
const createAlarmCall = callable<[hour: number, minute: number, label: string, recurring: string, sound: string, volume: number, subtle_mode: boolean, auto_suspend: boolean, prevent_sleep: boolean, prevent_sleep_window: number], string>('create_alarm');
const updateAlarmCall = callable<[alarm_id: string, hour: number, minute: number, label: string, recurring: string, sound: string, volume: number, subtle_mode: boolean, auto_suspend: boolean, prevent_sleep: boolean, prevent_sleep_window: number], boolean>('update_alarm');
const cancelAlarmCall = callable<[alarm_id: string], boolean>('cancel_alarm');
const toggleAlarmCall = callable<[alarm_id: string, enabled: boolean], boolean>('toggle_alarm');
const snoozeAlarmCall = callable<[alarm_id: string, minutes: number], boolean>('snooze_alarm');
const getAlarmsCall = callable<[], Alarm[]>('get_alarms');
const getSoundsCall = callable<[], SoundFile[]>('get_sounds');

const importCustomSoundsCall = callable<[], { success: boolean; message: string; imported: number; errors: string[] }>('import_custom_sounds');
const playSoundCall = callable<[filename: string, volume: number, loop: boolean], boolean>('play_sound');
const stopSoundCall = callable<[], boolean>('stop_sound');
const debugSoundCall = callable<[filename: string], { filename: string; is_custom: boolean; resolved_path: string | null; file_exists: boolean; settings_dir: string; custom_sounds_dir: string; custom_sounds_files: string[] }>('debug_sound');
const getSoundDataCall = callable<[filename: string], { success: boolean; data: string | null; mime_type: string | null; error?: string }>('get_sound_data');

export function useAlarms() {
    const [alarms, setAlarms] = useState<Alarm[]>([]);
    const [loading, setLoading] = useState(true);

    // Load initial alarms
    const loadAlarms = useCallback(async () => {
        try {
            const allAlarms = await getAlarmsCall();
            setAlarms(allAlarms);
        } catch (e) {
            console.error('Failed to load alarms:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Create a new alarm
    const createAlarm = useCallback(async (
        hour: number,
        minute: number,
        label: string = '',
        recurring: RecurringType = 'once',
        sound: string = 'alarm.mp3',
        volume: number = 100,
        subtleMode: boolean = false,
        autoSuspend: boolean = false,
        preventSleep: boolean = false,
        preventSleepWindow: number = 60
    ) => {
        try {
            await createAlarmCall(hour, minute, label, recurring, sound, volume, subtleMode, autoSuspend, preventSleep, preventSleepWindow);
        } catch (e) {
            console.error('Failed to create alarm:', e);
        }
    }, []);

    // Get available sounds
    const getSounds = useCallback(async (): Promise<SoundFile[]> => {
        try {
            return await getSoundsCall();
        } catch (e) {
            console.error('Failed to get sounds:', e);
            return [{ filename: 'alarm.mp3', name: 'Alarm' }];
        }
    }, []);

    // Import custom sounds
    const importCustomSounds = useCallback(async () => {
        try {
            return await importCustomSoundsCall();
        } catch (e) {
            console.error('Failed to import sounds:', e);
            return { success: false, message: 'Failed to call backend', imported: 0, errors: [String(e)] };
        }
    }, []);

    // Update an existing alarm
    const updateAlarm = useCallback(async (
        alarmId: string,
        hour: number,
        minute: number,
        label: string = '',
        recurring: RecurringType = 'once',
        sound: string = 'alarm.mp3',
        volume: number = 100,
        subtleMode: boolean = false,
        autoSuspend: boolean = false,
        preventSleep: boolean = false,
        preventSleepWindow: number = 60
    ) => {
        try {
            await updateAlarmCall(alarmId, hour, minute, label, recurring, sound, volume, subtleMode, autoSuspend, preventSleep, preventSleepWindow);

        } catch (e) {
            console.error('Failed to update alarm:', e);
        }
    }, []);

    // Delete an alarm
    const deleteAlarm = useCallback(async (alarmId: string) => {
        try {
            await cancelAlarmCall(alarmId);
        } catch (e) {
            console.error('Failed to delete alarm:', e);
        }
    }, []);

    // Toggle alarm enabled state
    const toggleAlarm = useCallback(async (alarmId: string, enabled: boolean) => {
        try {
            await toggleAlarmCall(alarmId, enabled);
        } catch (e) {
            console.error('Failed to toggle alarm:', e);
        }
    }, []);

    // Snooze an alarm
    const snoozeAlarm = useCallback(async (alarmId: string, minutes?: number) => {
        try {
            await snoozeAlarmCall(alarmId, minutes || 0);
        } catch (e) {
            console.error('Failed to snooze alarm:', e);
        }
    }, []);

    // Play sound via backend (for custom sounds)
    const playSound = useCallback(async (filename: string, volume: number = 100) => {
        try {
            await playSoundCall(filename, volume, false);
        } catch (e) {
            console.error('Failed to play sound:', e);
        }
    }, []);

    // Stop sound via backend
    const stopSound = useCallback(async () => {
        try {
            await stopSoundCall();
        } catch (e) {
            console.error('Failed to stop sound:', e);
        }
    }, []);

    // Debug sound (for troubleshooting)
    const debugSound = useCallback(async (filename: string) => {
        try {
            const result = await debugSoundCall(filename);
            console.log('AlarMe Debug Sound:', result);
            return result;
        } catch (e) {
            console.error('Failed to debug sound:', e);
            return null;
        }
    }, []);

    // Get base64-encoded sound data for custom sounds
    const getSoundData = useCallback(async (filename: string) => {
        try {
            const result = await getSoundDataCall(filename);
            return result;
        } catch (e) {
            console.error('Failed to get sound data:', e);
            return { success: false, data: null, mime_type: null, error: String(e) };
        }
    }, []);

    // Play custom sound via base64 -> HTML5 Audio (proper Steam audio routing)
    const playCustomSound = useCallback(async (filename: string, volume: number = 100): Promise<HTMLAudioElement | null> => {
        try {
            const result = await getSoundDataCall(filename);
            if (!result.success || !result.data || !result.mime_type) {
                console.error('Failed to load custom sound:', result.error);
                return null;
            }

            // Convert base64 to blob URL
            const byteCharacters = atob(result.data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: result.mime_type });
            const blobUrl = URL.createObjectURL(blob);

            // Play via HTML5 Audio
            const audio = new Audio(blobUrl);
            audio.volume = Math.min(1, Math.max(0, volume / 100));
            audio.onended = () => URL.revokeObjectURL(blobUrl);
            audio.onerror = () => URL.revokeObjectURL(blobUrl);
            await audio.play();
            return audio;
        } catch (e) {
            console.error('Failed to play custom sound:', e);
            return null;
        }
    }, []);

    // Event handlers
    useEffect(() => {
        const handleAlarmsUpdated = (updatedAlarms: Alarm[]) => {
            setAlarms(updatedAlarms);
        };

        addEventListener('alarme_alarms_updated', handleAlarmsUpdated);

        // Load initial data
        loadAlarms();

        return () => {
            removeEventListener('alarme_alarms_updated', handleAlarmsUpdated);
        };
    }, [loadAlarms]);

    // Get next active alarm
    const nextAlarm = alarms.find(a => a.enabled && a.next_trigger);

    return {
        alarms,
        loading,
        nextAlarm,
        createAlarm,
        updateAlarm,
        deleteAlarm,
        toggleAlarm,
        snoozeAlarm,
        getSounds,
        importCustomSounds,
        playSound,
        stopSound,
        debugSound,
        getSoundData,
        playCustomSound,
        refresh: loadAlarms
    };
}
