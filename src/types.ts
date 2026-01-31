// TypeScript type definitions for AlarMe plugin

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
    sound?: string;           // filename of the sound to play
    volume?: number;          // 0-100, per-alarm volume override
    subtle_mode?: boolean;    // per-alarm subtle mode override
    auto_suspend?: boolean;   // per-alarm auto suspend override
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
    current_cycle?: number;
    end_time: number | null;
    duration: number;
    remaining?: number;
    elapsed_this_phase?: number;
    break_type?: 'short' | 'long';
    sound?: string;
    volume?: number;
    subtle_mode?: boolean;
    stats?: PomodoroStats;
}

export interface PomodoroStats {
    daily_focus_time: number;
    daily_break_time: number;
    daily_sessions: number;
    total_focus_time: number;
    total_break_time: number;
    total_sessions: number;
    total_cycles: number;
    last_active_date: string;
    daily_history: DailyHistoryEntry[];
    current_streak: number;
    longest_streak: number;
}

export interface DailyHistoryEntry {
    date: string;
    focus_time: number;
    sessions: number;
}

// Settings types
export interface UserSettings {
    snooze_duration: number;      // default snooze for alarms
    time_format_24h: boolean;
    // Timer settings
    timer_sound: string;
    timer_volume: number;
    timer_subtle_mode: boolean;
    timer_auto_suspend: boolean;
    // Pomodoro settings
    pomodoro_sound: string;
    pomodoro_volume: number;
    pomodoro_subtle_mode: boolean;
    pomodoro_work_duration: number;
    pomodoro_break_duration: number;
    pomodoro_long_break_duration: number;
    pomodoro_sessions_until_long_break: number;
    pomodoro_daily_goal_enabled: boolean;
    pomodoro_daily_goal: number;  // hours per day goal
    // Legacy/deprecated (kept for migration)
    subtle_mode?: boolean;
    auto_suspend?: boolean;
    alarm_volume?: number;
    alarm_sound?: string;
}

// Event payload types
export interface TimerCompletedEvent {
    id: string;
    label: string;
    subtle: boolean;
    sound?: string;
    volume?: number;
    auto_suspend?: boolean;
}

export interface AlarmTriggeredEvent {
    id: string;
    label: string;
    subtle: boolean;
    sound?: string;
    volume?: number;
    snooze_duration?: number;
    auto_suspend?: boolean;
}

export interface TimerTickEvent {
    id: string;
    remaining: number;
}

export interface PomodoroTickEvent {
    remaining: number;
    is_break: boolean;
    session: number;
    cycle?: number;
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
