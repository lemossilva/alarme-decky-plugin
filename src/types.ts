// TypeScript type definitions for AlarMe plugin

// Timer types
export interface Timer {
    id: string;
    label: string;
    seconds: number;
    end_time: number;
    created_at: number;
    subtle_mode?: boolean;
    auto_suspend?: boolean;
    remaining?: number;
    paused?: boolean;
    paused_remaining?: number;
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
    daily_cycles: number;
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

// Reminder types (Periodic Reminders)
export interface Reminder {
    id: string;
    label: string;
    frequency_minutes: number;  // 15-180 minutes
    start_time: string | null;  // ISO timestamp or null for "now"
    recurrences: number;        // -1 = infinite, or positive integer
    only_while_gaming: boolean; // only tick down while a game is running
    reset_on_game_start: boolean; // if true, reset timer when game starts
    sound: string;
    volume: number;
    subtle_mode: boolean;
    enabled: boolean;
    created_at: number;
    // Runtime state (read-only from backend)
    next_trigger?: string;
    triggers_remaining?: number;
}

export interface ReminderTriggeredEvent {
    reminder: Reminder;
    sound: string;
    volume: number;
    subtle_mode: boolean;
    time_format_24h?: boolean;
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
    // Missed Alerts Global Settings
    missed_alerts_enabled: boolean;
    missed_alerts_window: number; // hours to look back
    // Suspend Behavior
    reminder_suspend_behavior?: 'continue' | 'pause';
    pomodoro_suspend_behavior?: 'continue' | 'pause';
    // Display settings
    snooze_activation_delay: number;
    // Overlay settings
    overlay_enabled: boolean;
    overlay_display_mode: OverlayDisplayMode;
    overlay_position: OverlayPosition;
    overlay_custom_x: number;
    overlay_custom_y: number;
    overlay_text_size: number;
    overlay_opacity: number;
    overlay_max_alerts: number;
    overlay_time_window: number;        // hours ahead to show
    overlay_show_timers: boolean;
    overlay_show_alarms: boolean;
    overlay_show_pomodoros: boolean;
    overlay_show_reminders: boolean;
    // Legacy/deprecated (kept for migration)
    overlay_position_steamui?: OverlayPosition;
    overlay_pixel_shift?: boolean;
    overlay_pixel_shift_interval?: number;
    overlay_pixel_shift_range?: number;
    subtle_mode?: boolean;
    auto_suspend?: boolean;
    alarm_volume?: number;
    alarm_sound?: string;
}

export interface MissedItem {
    id: string;
    type: 'alarm' | 'timer' | 'reminder' | 'pomodoro';
    label: string;
    due_time: number;
    missed_at: number;
    details?: string; // Richer details about what was missed
}

// Event payload types
export interface TimerCompletedEvent {
    id: string;
    label: string;
    subtle: boolean;
    sound?: string;
    volume?: number;
    auto_suspend?: boolean;
    time_format_24h?: boolean;
    snooze_activation_delay?: number;
}

export interface AlarmTriggeredEvent {
    id: string;
    label: string;
    subtle: boolean;
    sound?: string;
    volume?: number;
    snooze_duration?: number;
    auto_suspend?: boolean;
    time_format_24h?: boolean;
    snooze_activation_delay?: number;
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

// Overlay types
export type OverlayPosition = 'default' | 'custom';

export type OverlayDisplayMode = 'always' | 'gaming_only';

export type OverlayCategory = 'timer' | 'alarm' | 'pomodoro' | 'reminder';

export interface OverlayAlert {
    id: string;
    category: OverlayCategory;
    label: string;
    time: number;       // UNIX timestamp of trigger/end
    remaining?: number; // seconds remaining (for timers/pomodoro)
    subtle_mode?: boolean;
    auto_suspend?: boolean;
}

// Tab types
export type TabId = 'timers' | 'alarms' | 'pomodoro' | 'reminders' | 'settings';
