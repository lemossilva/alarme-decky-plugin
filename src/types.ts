// TypeScript type definitions for Alar.me plugin

// Timer types
export interface Timer {
    id: string;
    label: string;
    seconds: number;
    end_time: number;
    created_at: number;
    remaining?: number;
}

// Alarm types
export type RecurringType = 'once' | 'daily' | 'weekdays' | 'weekends' | string;

export interface Alarm {
    id: string;
    hour: number;
    minute: number;
    label: string;
    recurring: RecurringType;
    enabled: boolean;
    created_at: number;
    snoozed_until: number | null;
    next_trigger?: number | null;
    sound?: string;  // filename of the sound to play
}

// Sound file types
export interface SoundFile {
    filename: string;
    name: string;
}

// Preset types
export interface Preset {
    id: string;
    seconds: number;
    label: string;
}

// Pomodoro types
export interface PomodoroState {
    active: boolean;
    is_break: boolean;
    current_session: number;
    end_time: number | null;
    duration: number;
    remaining?: number;
    break_type?: 'short' | 'long';
    sound?: string;
}

// Settings types
export interface UserSettings {
    snooze_duration: number;
    subtle_mode: boolean;
    time_format_24h: boolean;
    auto_suspend: boolean;
    alarm_volume: number;
    timer_sound: string;      // filename of sound for timers
    pomodoro_sound: string;   // filename of sound for pomodoro
    pomodoro_work_duration: number;
    pomodoro_break_duration: number;
    pomodoro_long_break_duration: number;
    pomodoro_sessions_until_long_break: number;
}

// Event payload types
export interface TimerCompletedEvent {
    id: string;
    label: string;
    subtle: boolean;
    sound?: string;
}

export interface AlarmTriggeredEvent {
    id: string;
    label: string;
    subtle: boolean;
    sound?: string;
}

export interface TimerTickEvent {
    id: string;
    remaining: number;
}

export interface PomodoroTickEvent {
    remaining: number;
    is_break: boolean;
    session: number;
}

export interface SnoozeEvent {
    id: string;
    snoozed_until: number;
    minutes: number;
}

// Tab types
export type TabId = 'timers' | 'alarms' | 'pomodoro' | 'settings';

// Global type augmentation for Steam
declare global {
    interface Window {
        SP_REACT: typeof import('react');
    }
}
