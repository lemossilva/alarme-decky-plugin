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
    prevent_sleep?: boolean;
    screensaver_mode?: 'off' | 'black' | 'dim';
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
    prevent_sleep?: boolean;  // per-alarm prevent sleep override
    prevent_sleep_window?: number; // minutes before alarm to start preventing sleep
    screensaver_mode?: 'off' | 'black' | 'dim';
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
    subtle_mode?: boolean;
    auto_suspend?: boolean;
    prevent_sleep?: boolean;
    screensaver_mode?: 'off' | 'black' | 'dim';
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
    prevent_sleep?: boolean;
    screensaver_mode?: 'off' | 'black' | 'dim';
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
    prevent_sleep?: boolean;    // per-reminder prevent sleep
    screensaver_mode?: 'off' | 'black' | 'dim';
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
    timer_prevent_sleep: boolean;
    // Pomodoro settings
    pomodoro_sound: string;
    pomodoro_volume: number;
    pomodoro_subtle_mode: boolean;
    pomodoro_prevent_sleep: boolean;
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
    // Stopwatch settings
    stopwatch_reset_after_sleep?: boolean;
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
    overlay_show_stopwatch: boolean;
    overlay_compact_mode: boolean;
    overlay_show_prevent_sleep_badge: boolean;
    overlay_show_missed_badge: boolean;
    // Legacy Prevent Sleep settings (deprecated - now per-item)
    prevent_sleep_enabled?: boolean;
    prevent_sleep_timers?: boolean;
    prevent_sleep_pomodoro?: boolean;
    prevent_sleep_alarms?: boolean;
    prevent_sleep_alarms_window?: number;  // minutes before alarm to keep awake
    prevent_sleep_reminders?: boolean;
    // Timer presets settings
    presets_enabled: boolean;
    presets_max_visible: number;
    // Tab Order
    tab_order?: string[];
    // Screensaver settings
    screensaver_mode: 'off' | 'black' | 'dim' | 'wallpaper';
    screensaver_dim_opacity: number;
    pomodoro_screensaver_mode: 'off' | 'black' | 'dim';
    screensaver_idle_seconds: number;
    overlay_during_screensaver: boolean;
    overlay_screensaver_show_clock?: boolean;
    overlay_screensaver_show_date?: boolean;
    overlay_screensaver_show_battery?: boolean;
    screensaver_center_show_clock?: boolean;
    screensaver_center_show_date?: boolean;
    screensaver_center_show_battery?: boolean;
    overlay_compact_screensaver_show_clock?: boolean;
    overlay_compact_screensaver_show_date?: boolean;
    overlay_compact_screensaver_show_battery?: boolean;
    // Screensaver 2.0 settings
    screensaver_standalone_enabled?: boolean;
    screensaver_standalone_idle_seconds?: number;
    overlay_screensaver_layout?: ScreensaverLayout;
    screensaver_clock_style?: ClockStyle;
    screensaver_clock_size?: number;
    screensaver_accent_color?: AccentColorPreset;
    screensaver_show_day_of_week?: boolean;
    screensaver_show_year?: boolean;
    screensaver_show_calendar_grid?: boolean;
    screensaver_battery_show_bar?: boolean;
    screensaver_battery_low_threshold?: number;
    screensaver_show_alerts_list?: boolean;
    screensaver_show_system_stats?: boolean;
    screensaver_show_network_info?: boolean;
    screensaver_show_weather?: boolean;
    screensaver_weather_lat?: number | null;
    screensaver_weather_lon?: number | null;
    screensaver_weather_city_name?: string | null;
    screensaver_weather_unit?: "C" | "F";
    screensaver_weather_show_highlow?: boolean;
    screensaver_weather_show_condition?: boolean;
    screensaver_weather_refresh_minutes?: number;
    screensaver_weather_location_source?: 'manual' | 'ip' | null;
    screensaver_show_forecast?: boolean;
    screensaver_nasa_api_key?: string;
    screensaver_wallpaper_show_attribution?: boolean;
    screensaver_wallpaper_provider?: WallpaperProvider;
    screensaver_wallpaper_fit?: WallpaperFit;
    screensaver_wallpaper_blur?: WallpaperBlur;
    screensaver_wallpaper_dim?: number;
    screensaver_wallpaper_interval?: number;
    screensaver_wallpaper_pool_size?: number;
    screensaver_wallpaper_auto_rotate?: boolean;
    screensaver_wallpaper_cache_updated_at?: string | null;
    screensaver_wallpaper_shift_local?: boolean;
    screensaver_floating_drift_range?: number;
    // Pixel shift
    pixel_shift_enabled?: boolean;
    pixel_shift_range?: number;
    pixel_shift_interval_seconds?: number;
    // Widget orchestrator
    screensaver_big_widgets?: ScreensaverBigWidgetId[];
    screensaver_small_widgets?: ScreensaverSmallWidgetId[];
    // SuggestMe integration
    screensaver_show_suggestme?: boolean;
    screensaver_suggestme_mode?: string;
    screensaver_suggestme_preset_slot?: number;
    screensaver_suggestme_pick_strategy?: 'daily' | 'shuffle';
    // News widget settings
    screensaver_news_custom_feeds?: NewsCustomFeed[];
    screensaver_news_enabled?: boolean;
    screensaver_news_refresh_minutes?: number;
    screensaver_news_enabled_preset_ids?: string[];
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

    // Sleep inhibitor status
export interface SleepInhibitorItem {
    type: string;
    id: string;
    label: string;
    screensaver_mode?: 'off' | 'black' | 'dim';
}

export interface SleepInhibitorStatus {
    active: boolean;
    reason?: string;
    items?: SleepInhibitorItem[];
    screensaver_mode?: 'off' | 'black' | 'dim' | 'wallpaper';
    screensaver_dim_opacity?: number;
    screensaver_idle_seconds?: number;
    overlay_during_screensaver?: boolean;
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

export type OverlayDisplayMode = 'both' | 'steam_only' | 'gaming_only' | 'always';

export type OverlayCategory = 'timer' | 'alarm' | 'pomodoro' | 'reminder' | 'stopwatch';

export interface OverlayAlert {
    id: string;
    category: OverlayCategory;
    label: string;
    time: number;       // UNIX timestamp of trigger/end
    remaining?: number; // seconds remaining (for timers/pomodoro)
    subtle_mode?: boolean;
    auto_suspend?: boolean;
    prevent_sleep?: boolean;
}

// Stopwatch types
export interface StopwatchLap {
    label: string;
    absolute_ms: number;
    split_ms: number;
}

export type StopwatchStatus = 'idle' | 'running' | 'paused';

export interface StopwatchState {
    status: StopwatchStatus;
    start_time: number | null;
    elapsed_ms: number;
    laps: StopwatchLap[];
    prevent_sleep?: boolean;
    screensaver_mode?: 'off' | 'black' | 'dim';
}

// Tab types
export type TabId = 'timers' | 'alarms' | 'stopwatch' | 'pomodoro' | 'reminders' | 'settings';

// Screensaver 2.0 types
export type ScreensaverLayout = 'compact' | 'large' | 'fullscreen';

// Widget orchestrator types
export type ScreensaverBigWidgetId = 'calendar' | 'forecast' | 'suggestme';
export interface NewsCustomFeed {
    id: string;
    label: string;
    url: string;
}

export type ScreensaverSmallWidgetId = 'battery' | 'system_stats' | 'network' | 'weather' | 'news';
export type ScreensaverWidgetId = ScreensaverBigWidgetId | ScreensaverSmallWidgetId;

export const WIDGET_CAPS: Record<'large' | 'fullscreen', { big: number; small: number }> = {
    large: { big: 2, small: 4 },
    fullscreen: { big: 3, small: 5 },
};

export type ClockStyle = 'digital' | 'digital_seconds' | 'digital_large' | 'analog';

export type AccentColorPreset =
    | 'muted_gray'
    | 'white'
    | 'warm_amber'
    | 'cool_blue'
    | 'soft_red'
    | 'mint_green'
    | 'dim_orange'
    | 'contrast_auto';

export const ACCENT_COLORS: Record<AccentColorPreset, string> = {
    muted_gray: '#8b8b8b',
    white: '#e0e0e0',
    warm_amber: '#e6a817',
    cool_blue: '#4499cc',
    soft_red: '#cc5544',
    mint_green: '#66bb88',
    dim_orange: '#cc7733',
    contrast_auto: '#e0e0e0',
};

export type WallpaperProvider =
    | 'none'
    | 'picsum'
    | 'bing_daily'
    | 'lorem_flickr'
    | 'nasa_apod'
    | 'local_folder';

export type WallpaperFit = 'cover' | 'contain';

export type WallpaperBlur = 'none' | 'light' | 'heavy';

export interface SystemStats {
    cpu_temp: number | null;
    cpu_usage: number | null;
    ram_used_gb: number | null;
    ram_total_gb: number | null;
    gpu_temp: number | null;
    fan_rpm: number | null;
}

export interface WifiInfo {
    ssid: string | null;
    signal: number | null;
    connection_type?: "wifi" | "ethernet" | "none" | null;
    link_speed_mbps?: number | null;
    ipv4?: string | null;
    ipv6?: string[];
}

/** UPower snapshot from backend (`get_battery_info`); aligns with Steam OS QAM when `ok`. */
export interface BatteryInfo {
    percent: number | null;
    charging: boolean | null;
    time_to_empty_sec: number | null;
    time_to_full_sec: number | null;
    ok: boolean;
}

export interface WallpaperAttribution {
    title: string | null;
    credit: string | null;
}

export interface WallpaperState {
    url: string | null;
    provider: WallpaperProvider;
    attribution: WallpaperAttribution | null;
}

export interface WeatherGeocodeResult {
    name: string;
    admin1: string;
    country: string;
    country_code: string;
    latitude: number;
    longitude: number;
    display_name: string;
}

export interface SuggestMeStatus {
    available: boolean;
    version: string | null;
    compatible: boolean;
}

export interface SuggestMeGame {
    appid: number;
    name: string;
    playtime_forever?: number;
    img_icon_url?: string;
    genres?: string[];
    tags?: string[];
    community_tags?: string[];
    is_non_steam?: boolean;
    matched_appid?: number | null;
    source?: string;
    steam_review_score?: number;
    steam_review_description?: string;
    metacritic_score?: number;
    release_date?: string | number;
}

export interface SuggestMeCard {
    game: SuggestMeGame | null;
    reason?: string;
    mode_used?: string;
    error?: string | null;
    needs_fetch?: boolean;
    candidates_count?: number;
    excluded_count?: number;
}

export interface SuggestMeFilterPreset {
    label: string;
    filters: Record<string, unknown>;
}

export interface ScreensaverProfile {
    name: string;
    settings: Partial<UserSettings>;
    saved_at: number;
}

export interface ScreensaverProfiles {
    slot_1: ScreensaverProfile | null;
    slot_2: ScreensaverProfile | null;
    slot_3: ScreensaverProfile | null;
}
