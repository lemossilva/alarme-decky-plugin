import { useEffect, useState, useCallback } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { Reminder, SoundFile } from '../types';

// Backend callables
const createReminderCall = callable<
    [label: string, frequency_minutes: number, start_time: string | null,
        recurrences: number, only_while_gaming: boolean, reset_on_game_start: boolean,
        sound: string, volume: number, subtle_mode: boolean], Reminder
>('create_reminder');

const updateReminderCall = callable<
    [reminder_id: string, label: string, frequency_minutes: number,
        start_time: string | null, recurrences: number, only_while_gaming: boolean,
        reset_on_game_start: boolean, sound: string, volume: number, subtle_mode: boolean], Reminder | null
>('update_reminder');

const deleteReminderCall = callable<[reminder_id: string], boolean>('delete_reminder');
const toggleReminderCall = callable<[reminder_id: string, enabled: boolean], boolean>('toggle_reminder');
const getRemindersCall = callable<[], Reminder[]>('get_reminders');
const getSoundsCall = callable<[], SoundFile[]>('get_sounds');

export function useReminders() {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);

    // Load initial reminders
    const loadReminders = useCallback(async () => {
        try {
            const allReminders = await getRemindersCall();
            setReminders(allReminders);
        } catch (e) {
            console.error('Failed to load reminders:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Create a new reminder
    const createReminder = useCallback(async (
        label: string = '',
        frequencyMinutes: number = 60,
        startTime: string | null = null,
        recurrences: number = -1,
        onlyWhileGaming: boolean = false,
        resetOnGameStart: boolean = false,
        sound: string = 'alarm.mp3',
        volume: number = 100,
        subtleMode: boolean = false
    ): Promise<Reminder | null> => {
        try {
            return await createReminderCall(
                label, frequencyMinutes, startTime, recurrences,
                onlyWhileGaming, resetOnGameStart, sound, volume, subtleMode
            );
        } catch (e) {
            console.error('Failed to create reminder:', e);
            return null;
        }
    }, []);

    // Update an existing reminder
    const updateReminder = useCallback(async (
        reminderId: string,
        label: string = '',
        frequencyMinutes: number = 60,
        startTime: string | null = null,
        recurrences: number = -1,
        onlyWhileGaming: boolean = false,
        resetOnGameStart: boolean = false,
        sound: string = 'alarm.mp3',
        volume: number = 100,
        subtleMode: boolean = false
    ): Promise<Reminder | null> => {
        try {
            return await updateReminderCall(
                reminderId, label, frequencyMinutes, startTime, recurrences,
                onlyWhileGaming, resetOnGameStart, sound, volume, subtleMode
            );
        } catch (e) {
            console.error('Failed to update reminder:', e);
            return null;
        }
    }, []);

    // Delete a reminder
    const deleteReminder = useCallback(async (reminderId: string): Promise<boolean> => {
        try {
            return await deleteReminderCall(reminderId);
        } catch (e) {
            console.error('Failed to delete reminder:', e);
            return false;
        }
    }, []);

    // Toggle reminder enabled state
    const toggleReminder = useCallback(async (reminderId: string, enabled: boolean): Promise<boolean> => {
        try {
            return await toggleReminderCall(reminderId, enabled);
        } catch (e) {
            console.error('Failed to toggle reminder:', e);
            return false;
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

    // Event handlers
    useEffect(() => {
        const handleRemindersUpdated = (updatedReminders: Reminder[]) => {
            setReminders(updatedReminders);
        };

        addEventListener('alarme_reminders_updated', handleRemindersUpdated);

        // Load initial data
        loadReminders();

        return () => {
            removeEventListener('alarme_reminders_updated', handleRemindersUpdated);
        };
    }, [loadReminders]);

    // Get next active reminder
    const enabledReminders = reminders.filter(r => r.enabled);
    const nextReminder = enabledReminders.length > 0
        ? enabledReminders.reduce((earliest, r) => {
            if (!earliest.next_trigger) return r;
            if (!r.next_trigger) return earliest;
            return new Date(r.next_trigger) < new Date(earliest.next_trigger) ? r : earliest;
        })
        : undefined;

    return {
        reminders,
        loading,
        nextReminder,
        createReminder,
        updateReminder,
        deleteReminder,
        toggleReminder,
        getSounds,
        refresh: loadReminders
    };
}
