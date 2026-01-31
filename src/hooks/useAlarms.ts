import { useEffect, useState, useCallback } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { Alarm, RecurringType, SoundFile } from '../types';

// Backend callables
const createAlarmCall = callable<[hour: number, minute: number, label: string, recurring: string, sound: string, volume: number, subtle_mode: boolean, auto_suspend: boolean], string>('create_alarm');
const updateAlarmCall = callable<[alarm_id: string, hour: number, minute: number, label: string, recurring: string, sound: string, volume: number, subtle_mode: boolean, auto_suspend: boolean], boolean>('update_alarm');
const cancelAlarmCall = callable<[alarm_id: string], boolean>('cancel_alarm');
const toggleAlarmCall = callable<[alarm_id: string, enabled: boolean], boolean>('toggle_alarm');
const snoozeAlarmCall = callable<[alarm_id: string, minutes: number], boolean>('snooze_alarm');
const getAlarmsCall = callable<[], Alarm[]>('get_alarms');
const getSoundsCall = callable<[], SoundFile[]>('get_sounds');

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
        autoSuspend: boolean = false
    ) => {
        try {
            await createAlarmCall(hour, minute, label, recurring, sound, volume, subtleMode, autoSuspend);
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
        autoSuspend: boolean = false
    ) => {
        try {
            await updateAlarmCall(alarmId, hour, minute, label, recurring, sound, volume, subtleMode, autoSuspend);

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
        refresh: loadAlarms
    };
}
