import {
    ButtonItem,
    ConfirmModal,
    Dropdown,
    Focusable,
    Navigation,
    PanelSection,
    PanelSectionRow,
    ProgressBarWithInfo,
    showModal,
    SidebarNavigation,
    SliderField,
    TextField,
    ToggleField
} from "@decky/ui";
import { addEventListener, callable, removeEventListener, toaster } from "@decky/api";
import { FaVolumeUp, FaBell, FaClock, FaBrain, FaCoffee, FaPlay, FaPause, FaHourglassHalf, FaSave, FaFileImport, FaBullseye, FaMusic, FaTrash, FaCog, FaDatabase, FaEye, FaGamepad, FaHistory, FaBellSlash, FaStar, FaRedo, FaStopwatch, FaShieldAlt, FaDesktop, FaCalendarAlt, FaBatteryFull, FaPhotoVideo, FaCloud, FaUpload, FaInfoCircle, FaNewspaper } from "react-icons/fa";
import { useEffect, useState, useRef } from "react";
import { useSettings } from "../hooks/useSettings";
import { triggerScreensaverPreviewAfterClosingMenus } from "../hooks/useScreensaver";
import { useUIComposition, UIComposition } from "../utils/uiComposition";
import { useAlarms } from "../hooks/useAlarms";
import { useScreensaverProfiles } from "../hooks/useScreensaverProfiles";
import { playAlarmSound } from "../utils/sounds";
import { showExportModal, showImportModal } from "./BackupModals";
import { BinarySelector } from "./BinarySelector";
import type { SoundFile, ScreensaverLayout, ClockStyle, AccentColorPreset, WallpaperProvider, WallpaperFit, WallpaperBlur, ScreensaverProfile, UserSettings } from "../types";
import { WIDGET_CAPS } from "../types";
import { WALLPAPER_POOL_MAX, clampWallpaperPoolSize } from "../hooks/useWallpaper";
import { WeatherLocationPicker } from "./screensaver/WeatherLocationPicker";
import { OverlayPositionPreview } from "./OverlayPositionPreview";
import { useSuggestMeStatus, useSuggestMePresets } from "../hooks/useSuggestMe";
import { AboutInstructionsPage } from "./SettingsAboutPage";
import { SettingsNewsPage } from "./SettingsNewsPage";
import {
    ALL_BIG_WIDGETS,
    ALL_SMALL_WIDGETS,
    BIG_WIDGET_LABELS,
    SMALL_WIDGET_LABELS,
} from "../utils/widgetOrchestrator";

// Backend callables
const factoryResetCall = callable<[], boolean>('factory_reset');
const getVersionCall = callable<[], string>('get_version');
const checkWallpaperProviderCall = callable<[provider: string], { reachable: boolean; message?: string }>('check_wallpaper_provider');
const getWallpaperStoragePathsCall = callable<
    [],
    { runtime_dir: string; wallpaper_cache_dir: string; local_wallpapers_dir: string }
>('get_wallpaper_storage_paths');
const prefetchWallpapersCall = callable<[provider: string, count?: number], { success: boolean; provider_status?: string }>(
    'prefetch_wallpapers'
);

const showFactoryResetConfirm = (onConfirm: () => void) => {
    showModal(
        <ConfirmModal
            strTitle="Factory Reset"
            strDescription="This will permanently delete all alarms, timers, reminders, Pomodoro data, and reset all settings to defaults. Custom sounds in ~/Music/AlarMe_Sounds will NOT be deleted. This action cannot be undone."
            strOKButtonText="Reset Everything"
            strCancelButtonText="Cancel"
            onOK={onConfirm}
        />
    );
};

// Scrollable wrapper for SidebarNavigation content pages
const ScrollableContent = ({ children }: { children: React.ReactNode }) => (
    <div style={{
        padding: '16px 24px',
        maxHeight: 'calc(100vh - 60px)',
        overflowY: 'auto'
    }}>
        {children}
    </div>
);

// Reusable sound preview button component
const SoundPreviewButton = ({
    soundFile,
    onPlayCustom
}: {
    soundFile: string;
    onPlayCustom: (filename: string, volume: number) => Promise<HTMLAudioElement | null>;
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [focused, setFocused] = useState(false);
    const isCustom = soundFile.startsWith('custom:');

    const handleToggle = async () => {
        if (isPlaying) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
            setIsPlaying(false);
        } else {
            setIsPlaying(true);
            try {
                if (isCustom) {
                    audioRef.current = await onPlayCustom(soundFile, 100);
                } else {
                    audioRef.current = await playAlarmSound(soundFile);
                }

                if (audioRef.current) {
                    audioRef.current.onended = () => {
                        setIsPlaying(false);
                        audioRef.current = null;
                    };
                } else {
                    setIsPlaying(false);
                }
            } catch (e) {
                console.error('Failed to play sound:', e);
                setIsPlaying(false);
            }
        }
    };

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    return (
        <Focusable
            onActivate={handleToggle}
            onClick={handleToggle}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                minWidth: 32,
                padding: 0,
                backgroundColor: focused ? '#4488aa' : '#ffffff22',
                borderRadius: 4,
                border: focused ? '2px solid white' : '2px solid transparent',
                cursor: 'pointer',
                flexShrink: 0
            }}
        >
            {isPlaying ? <FaPause size={12} /> : <FaPlay size={12} />}
        </Focusable>
    );
};

// Binary selector for suspend behavior options
// ==================== BinarySelector is now in ./BinarySelector.tsx ====================

// Timer Settings Page
const TimerSettingsPage = () => {
    const { settings, updateSetting } = useSettings();
    const { getSounds, playCustomSound } = useAlarms();
    const [sounds, setSounds] = useState<SoundFile[]>([{ filename: 'alarm.mp3', name: 'Alarm' }]);

    useEffect(() => {
        getSounds().then(setSounds);
    }, []);

    return (
        <ScrollableContent>
            <PanelSection>
                <PanelSectionRow>
                    <Focusable flow-children="row" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <FaHourglassHalf style={{ color: '#888', flexShrink: 0 }} />
                        <span style={{ flexShrink: 0 }}>Sound</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Dropdown
                                rgOptions={sounds.map(s => ({ data: s.filename, label: s.name }))}
                                selectedOption={settings.timer_sound || 'alarm.mp3'}
                                onChange={(option) => updateSetting('timer_sound', option.data as string)}
                                strDefaultLabel="Select Sound"
                            />
                        </div>
                        {settings.timer_sound !== 'soundless' && (
                            <SoundPreviewButton soundFile={settings.timer_sound || 'alarm.mp3'} onPlayCustom={playCustomSound} />
                        )}
                    </Focusable>
                </PanelSectionRow>

                {settings.timer_sound !== 'soundless' && (
                    <PanelSectionRow>
                        <SliderField
                            label="Volume"
                            description={`${settings.timer_volume ?? 100}%`}
                            value={settings.timer_volume ?? 100}
                            min={0}
                            max={100}
                            step={5}
                            onChange={(value) => updateSetting('timer_volume', value)}
                            icon={<FaVolumeUp size={16} />}
                        />
                    </PanelSectionRow>
                )}

                <PanelSectionRow>
                    <ToggleField
                        icon={<FaStar size={16} />}
                        label="Saved Presets"
                        description="Show preset buttons for quickly starting timers"
                        checked={settings.presets_enabled ?? true}
                        onChange={(value) => updateSetting('presets_enabled', value)}
                    />
                </PanelSectionRow>
                {settings.presets_enabled && (
                    <PanelSectionRow>
                        <div style={{ paddingLeft: '40px' }}>
                            <SliderField
                                label="Max Visible Presets"
                                description={`${settings.presets_max_visible ?? 5} presets`}
                                value={settings.presets_max_visible ?? 5}
                                min={1}
                                max={10}
                                step={1}
                                onChange={(value) => updateSetting('presets_max_visible', value)}
                                icon={<FaClock size={16} />}
                            />
                        </div>
                    </PanelSectionRow>
                )}
            </PanelSection>

            <PanelSection title="Stopwatch">
                <PanelSectionRow>
                    <ToggleField
                        icon={<FaStopwatch size={16} />}
                        label="Reset after reboot"
                        description="When enabled, a running stopwatch is cleared after a full restart (same as Stop). Does not reset when waking from sleep."
                        checked={settings.stopwatch_reset_after_sleep ?? true}
                        onChange={(value) => updateSetting('stopwatch_reset_after_sleep', value)}
                    />
                </PanelSectionRow>
            </PanelSection>
        </ScrollableContent>
    );
};

// Alarm Settings Page
const AlarmSettingsPage = () => {
    const { settings, updateSetting } = useSettings();

    return (
        <ScrollableContent>
            <PanelSection>
                <PanelSectionRow>
                    <SliderField
                        label="Default Snooze Duration"
                        description={`${settings.snooze_duration} minutes`}
                        value={settings.snooze_duration}
                        min={1}
                        max={30}
                        step={1}
                        onChange={(value) => updateSetting('snooze_duration', value)}
                        icon={<FaBell size={16} />}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#888888', padding: '4px 0' }}>
                        💡 Volume, sound, and other settings are configured per-alarm in the alarm editor.
                    </div>
                </PanelSectionRow>
            </PanelSection>
        </ScrollableContent>
    );
};

// Reminder Settings Page
const ReminderSettingsPage = () => {
    const { settings, updateSetting } = useSettings();

    return (
        <ScrollableContent>
            <PanelSection>
                <BinarySelector
                    label="Behavior while Suspended"
                    description="What happens when device is sleeping"
                    leftOption={{ value: 'pause', label: 'Shift (Pause)' }}
                    rightOption={{ value: 'continue', label: 'Miss (Continue)' }}
                    value={settings.reminder_suspend_behavior || 'continue'}
                    onChange={(val) => updateSetting('reminder_suspend_behavior', val as 'continue' | 'pause')}
                    icon={<FaRedo size={16} />}
                />
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#888888', padding: '8px 0' }}>
                        <strong>Shift:</strong> Reminder timer pauses during suspend and resumes when device wakes.<br />
                        <strong>Miss:</strong> Timer continues during suspend; if it expires, it's reported as missed.
                    </div>
                </PanelSectionRow>
            </PanelSection>
        </ScrollableContent>
    );
};

// Pomodoro Settings Page
const PomodoroSettingsPage = () => {
    const { settings, updateSetting } = useSettings();
    const { getSounds, playCustomSound } = useAlarms();
    const [sounds, setSounds] = useState<SoundFile[]>([{ filename: 'alarm.mp3', name: 'Alarm' }]);

    useEffect(() => {
        getSounds().then(setSounds);
    }, []);

    return (
        <ScrollableContent>
            <PanelSection>
                <PanelSectionRow>
                    <Focusable flow-children="row" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <FaBrain style={{ color: '#888', flexShrink: 0 }} />
                        <span style={{ flexShrink: 0 }}>Sound</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Dropdown
                                rgOptions={sounds.map(s => ({ data: s.filename, label: s.name }))}
                                selectedOption={settings.pomodoro_sound || 'alarm.mp3'}
                                onChange={(option) => updateSetting('pomodoro_sound', option.data as string)}
                                strDefaultLabel="Select Sound"
                            />
                        </div>
                        {settings.pomodoro_sound !== 'soundless' && (
                            <SoundPreviewButton soundFile={settings.pomodoro_sound || 'alarm.mp3'} onPlayCustom={playCustomSound} />
                        )}
                    </Focusable>
                </PanelSectionRow>

                {settings.pomodoro_sound !== 'soundless' && (
                    <PanelSectionRow>
                        <SliderField
                            label="Volume"
                            description={`${settings.pomodoro_volume ?? 100}%`}
                            value={settings.pomodoro_volume ?? 100}
                            min={0}
                            max={100}
                            step={5}
                            onChange={(value) => updateSetting('pomodoro_volume', value)}
                            icon={<FaVolumeUp size={16} />}
                        />
                    </PanelSectionRow>
                )}

                <PanelSectionRow>
                    <SliderField
                        label="Work Duration"
                        description={`${settings.pomodoro_work_duration} minutes`}
                        value={settings.pomodoro_work_duration}
                        min={15}
                        max={60}
                        step={5}
                        onChange={(value) => updateSetting('pomodoro_work_duration', value)}
                        icon={<FaBrain size={16} />}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Short Break"
                        description={`${settings.pomodoro_break_duration} minutes`}
                        value={settings.pomodoro_break_duration}
                        min={3}
                        max={15}
                        step={1}
                        onChange={(value) => updateSetting('pomodoro_break_duration', value)}
                        icon={<FaCoffee size={16} />}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Long Break"
                        description={`${settings.pomodoro_long_break_duration} minutes`}
                        value={settings.pomodoro_long_break_duration}
                        min={10}
                        max={45}
                        step={5}
                        onChange={(value) => updateSetting('pomodoro_long_break_duration', value)}
                        icon={<FaCoffee size={16} />}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Sessions Until Long Break"
                        description={`${settings.pomodoro_sessions_until_long_break} sessions`}
                        value={settings.pomodoro_sessions_until_long_break}
                        min={2}
                        max={8}
                        step={1}
                        onChange={(value) => updateSetting('pomodoro_sessions_until_long_break', value)}
                        icon={<FaClock size={16} />}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <ToggleField
                        icon={<FaBullseye size={16} />}
                        label="Daily Goal"
                        description="Track progress toward a daily focus time goal"
                        checked={settings.pomodoro_daily_goal_enabled ?? false}
                        onChange={(value) => updateSetting('pomodoro_daily_goal_enabled', value)}
                    />
                </PanelSectionRow>

                {settings.pomodoro_daily_goal_enabled && (
                    <PanelSectionRow>
                        <SliderField
                            label="Daily Goal Hours"
                            description={`${settings.pomodoro_daily_goal ?? 4} hours`}
                            value={settings.pomodoro_daily_goal ?? 4}
                            min={1}
                            max={8}
                            step={1}
                            onChange={(value) => updateSetting('pomodoro_daily_goal', value)}
                            icon={<FaClock size={16} />}
                        />
                    </PanelSectionRow>
                )}

                <BinarySelector
                    label="Behavior while Suspended"
                    description="What happens when device is sleeping"
                    leftOption={{ value: 'pause', label: 'Shift (Pause)' }}
                    rightOption={{ value: 'continue', label: 'Miss (Continue)' }}
                    value={settings.pomodoro_suspend_behavior || 'continue'}
                    onChange={(val) => updateSetting('pomodoro_suspend_behavior', val as 'continue' | 'pause')}
                    icon={<FaBrain size={16} />}
                />
            </PanelSection>
        </ScrollableContent>
    );
};

// Tab labels for display
const TAB_LABELS: Record<string, string> = {
    "timers": "Timers",
    "alarms": "Alarms",
    "pomodoro": "Focus",
    "reminders": "Reminders",
    "stopwatch": "Stopwatch"
};

const DEFAULT_TAB_ORDER = ["timers", "alarms", "pomodoro", "reminders", "stopwatch"];

// General Settings Page
const GeneralSettingsPage = () => {
    const { settings, updateSetting } = useSettings();
    const { importCustomSounds } = useAlarms();
    const [importStatus, setImportStatus] = useState<{ message: string; success: boolean } | null>(null);

    const tabOrder = settings.tab_order && settings.tab_order.length === 5 
        ? settings.tab_order 
        : DEFAULT_TAB_ORDER;

    const moveTab = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...tabOrder];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newOrder.length) return;
        [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
        updateSetting('tab_order', newOrder);
    };

    const resetTabOrder = () => {
        updateSetting('tab_order', DEFAULT_TAB_ORDER);
    };

    return (
        <ScrollableContent>
            <PanelSection title="Tab Order">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#888888', marginBottom: 8 }}>
                        Reorder navigation tabs using the arrows.
                    </div>
                </PanelSectionRow>
                {tabOrder.map((tabId, index) => (
                    <PanelSectionRow key={tabId}>
                        <Focusable
                            flow-children="horizontal"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 0'
                            }}
                        >
                            <span style={{ flex: 1, fontSize: 14 }}>
                                {TAB_LABELS[tabId] || tabId}
                            </span>
                            <Focusable
                                onActivate={index === 0 ? undefined : () => moveTab(index, 'up')}
                                style={{
                                    padding: '4px 10px',
                                    backgroundColor: index === 0 ? '#ffffff11' : '#ffffff22',
                                    borderRadius: 4,
                                    opacity: index === 0 ? 0.4 : 1,
                                    cursor: index === 0 ? 'default' : 'pointer'
                                }}
                            >
                                ▲
                            </Focusable>
                            <Focusable
                                onActivate={index === tabOrder.length - 1 ? undefined : () => moveTab(index, 'down')}
                                style={{
                                    padding: '4px 10px',
                                    backgroundColor: index === tabOrder.length - 1 ? '#ffffff11' : '#ffffff22',
                                    borderRadius: 4,
                                    opacity: index === tabOrder.length - 1 ? 0.4 : 1,
                                    cursor: index === tabOrder.length - 1 ? 'default' : 'pointer'
                                }}
                            >
                                ▼
                            </Focusable>
                        </Focusable>
                    </PanelSectionRow>
                ))}
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={resetTabOrder}
                    >
                        Reset to Default
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Custom Sounds">
                <PanelSectionRow>
                    <div style={{ fontSize: 13, color: '#dddddd', padding: '4px 0' }}>
                        Add your own sounds by placing files in <span style={{ fontFamily: 'monospace', backgroundColor: '#ffffff22', padding: '2px 4px', borderRadius: 4 }}>~/Music/AlarMe_Sounds</span>
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#888888', paddingBottom: 12 }}>
                        Supported formats: .mp3, .wav, .ogg (Max 2MB per file)
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        icon={<FaMusic />}
                        onClick={async () => {
                            setImportStatus(null);
                            const result = await importCustomSounds();
                            if (result.success) {
                                setImportStatus({ message: result.message, success: true });
                            } else {
                                setImportStatus({ message: result.message, success: false });
                            }
                        }}
                    >
                        Import / Rescan Sounds
                        {importStatus && (
                            <span style={{
                                marginLeft: 8,
                                fontSize: 12,
                                color: importStatus.success ? '#88ff88' : '#ff8888'
                            }}>
                                • {importStatus.message}
                            </span>
                        )}
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Time Format">
                <PanelSectionRow>
                    <ToggleField
                        icon={<FaClock size={16} />}
                        label="24-Hour Format"
                        description="Use 24-hour time format (e.g., 14:30 instead of 2:30 PM)"
                        checked={settings.time_format_24h}
                        onChange={(value) => updateSetting('time_format_24h', value)}
                    />
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Alert Behavior">
                <PanelSectionRow>
                    <ToggleField
                        icon={<FaGamepad size={16} />}
                        label="In-Game Alert Delay"
                        description="Adds a brief delay before you can interact with alert popups while gaming, preventing accidental dismissals from controller input"
                        checked={(settings.snooze_activation_delay ?? 2.0) > 0}
                        onChange={(enabled) => updateSetting('snooze_activation_delay', enabled ? 2.0 : 0)}
                    />
                    {(settings.snooze_activation_delay ?? 2.0) > 0 && (
                        <div style={{ paddingLeft: '40px', paddingTop: '8px' }}>
                            <SliderField
                                label="Delay Duration"
                                description={`${settings.snooze_activation_delay?.toFixed(1) ?? '2.0'} seconds`}
                                value={settings.snooze_activation_delay ?? 2.0}
                                min={0.5}
                                max={5.0}
                                step={0.5}
                                onChange={(value) => updateSetting('snooze_activation_delay', value)}
                                icon={<FaHourglassHalf size={16} />}
                            />
                        </div>
                    )}
                </PanelSectionRow>

                <PanelSectionRow>
                    <ToggleField
                        icon={<FaBellSlash size={16} />}
                        label="Missed Alert Detection"
                        description="Notify about alarms and timers missed while suspended"
                        checked={settings.missed_alerts_enabled ?? true}
                        onChange={(value) => updateSetting('missed_alerts_enabled', value)}
                    />
                    {settings.missed_alerts_enabled && (
                        <div style={{ paddingLeft: '40px', paddingTop: '8px' }}>
                            <SliderField
                                label="Report Time Window"
                                description={`${settings.missed_alerts_window ?? 24} hours`}
                                value={settings.missed_alerts_window ?? 24}
                                min={1}
                                max={72}
                                step={1}
                                onChange={(value) => updateSetting('missed_alerts_window', value)}
                                icon={<FaHistory size={16} />}
                            />
                        </div>
                    )}
                </PanelSectionRow>
            </PanelSection>
        </ScrollableContent>
    );
};

// Screensaver profile slot — compact actions (Load / Save / Delete)
const ProfileSlotCard = ({
    slot,
    profile,
    onLoad,
    onDelete,
    onRequestSave,
}: {
    slot: "slot_1" | "slot_2" | "slot_3";
    profile: ScreensaverProfile | null;
    onLoad: (slot: "slot_1" | "slot_2" | "slot_3") => void;
    onDelete: (slot: "slot_1" | "slot_2" | "slot_3") => void;
    onRequestSave: (slot: "slot_1" | "slot_2" | "slot_3") => void;
}) => {
    const slotNum = slot === "slot_1" ? "1" : slot === "slot_2" ? "2" : "3";
    const [loadF, setLoadF] = useState(false);
    const [saveF, setSaveF] = useState(false);
    const [delF, setDelF] = useState(false);

    const iconBtn = (
        focused: boolean,
        tone: "accent" | "muted" | "danger",
        disabled: boolean,
    ): React.CSSProperties => ({
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        border: focused ? "2px solid #ffffff" : "2px solid transparent",
        backgroundColor: disabled
            ? "rgba(255,255,255,0.04)"
            : tone === "accent"
              ? focused
                  ? "#5599bb"
                  : "#4488aa88"
              : tone === "danger"
                ? focused
                    ? "#cc5555"
                    : "#aa444488"
                : focused
                  ? "#ffffff33"
                  : "#ffffff18",
        color: "#ffffff",
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
    });

    const savedShort =
        profile?.saved_at != null
            ? new Date(profile.saved_at * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : null;

    return (
        <div
            style={{
                flex: 1,
                minWidth: 96,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                backgroundColor: "rgba(255,255,255,0.04)",
                borderRadius: 8,
                padding: "8px 8px",
            }}
        >
            <div style={{ fontSize: 10, opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.6 }}>Slot {slotNum}</div>
            <div
                style={{
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    minHeight: 18,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {profile?.name ?? "—"}
            </div>
            <div style={{ fontSize: 10, opacity: 0.45, minHeight: 14 }}>{savedShort ? `Saved ${savedShort}` : " "}</div>
            <Focusable
                flow-children="horizontal"
                style={{ display: "flex", flexDirection: "row", gap: 6, marginTop: 4, justifyContent: "space-between" }}
            >
                <Focusable
                    onActivate={profile ? () => onLoad(slot) : undefined}
                    onClick={profile ? () => onLoad(slot) : undefined}
                    onFocus={() => setLoadF(true)}
                    onBlur={() => setLoadF(false)}
                    style={iconBtn(loadF, "accent", !profile)}
                    aria-label="Load profile"
                >
                    <FaUpload size={12} />
                </Focusable>
                <Focusable
                    onActivate={() => onRequestSave(slot)}
                    onClick={() => onRequestSave(slot)}
                    onFocus={() => setSaveF(true)}
                    onBlur={() => setSaveF(false)}
                    style={iconBtn(saveF, "muted", false)}
                    aria-label={profile ? "Overwrite profile" : "Save current settings"}
                >
                    <FaSave size={12} />
                </Focusable>
                <Focusable
                    onActivate={profile ? () => onDelete(slot) : undefined}
                    onClick={profile ? () => onDelete(slot) : undefined}
                    onFocus={() => setDelF(true)}
                    onBlur={() => setDelF(false)}
                    style={iconBtn(delF, "danger", !profile)}
                    aria-label="Delete profile"
                >
                    <FaTrash size={12} />
                </Focusable>
            </Focusable>
        </div>
    );
};

// SuggestMe Integration Settings Section
const SUGGESTME_MODE_OPTIONS = [
    { data: "intelligent", label: "Smart" },
    { data: "luck", label: "Random" },
    { data: "guided", label: "Guided" },
    { data: "fresh_air", label: "Fresh Air" },
];

const SUGGESTME_STRATEGY_OPTIONS = [
    { data: "daily", label: "Daily suggestion" },
    { data: "shuffle", label: "Shuffle every time" },
];

const SuggestMeSettingsSection = ({ settings, updateSetting }: {
    settings: UserSettings;
    updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
}) => {
    const status = useSuggestMeStatus();
    const enabled = settings.screensaver_show_suggestme ?? false;
    const presets = useSuggestMePresets(enabled && !!status?.compatible);

    if (!status) return null;

    if (!status.available || !status.compatible) {
        return (
            <PanelSection title="Game Recommendations">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0', lineHeight: 1.6 }}>
                        {!status.available ? (
                            <>
                                Show a game recommendation on your screensaver, powered by <span style={{ color: '#ccc', fontWeight: 600 }}>SuggestMe</span>.
                                <br /><br />
                                SuggestMe is not installed. Install it from the <span style={{ color: '#ccc' }}>Decky Store</span> to enable this feature.
                            </>
                        ) : (
                            <>
                                Your SuggestMe version (<span style={{ color: '#ccc' }}>{status.version}</span>) is too old.
                                Please update to <span style={{ color: '#ccc' }}>v1.6.0</span> or later from the <span style={{ color: '#ccc' }}>Decky Store</span>.
                            </>
                        )}
                    </div>
                </PanelSectionRow>
            </PanelSection>
        );
    }

    const presetOptions = presets.map((p, i) => ({
        data: i,
        label: p ? p.label : `Slot ${i + 1} (empty)`,
        disabled: !p,
    }));
    presetOptions.unshift({ data: -1, label: "No filter preset", disabled: false });

    return (
        <PanelSection title="Game Recommendations">
            <PanelSectionRow>
                <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0', lineHeight: 1.5 }}>
                    Powered by SuggestMe ({status.version}). Shows a game pick from your library on the screensaver.
                </div>
            </PanelSectionRow>
            <PanelSectionRow>
                <ToggleField
                    icon={<FaGamepad size={16} />}
                    label="Show game recommendation"
                    description="Large (Centered) and Fullscreen: SuggestMe card in the upper row (with calendar / forecast when enabled). Compact overlay does not show this widget."
                    checked={enabled}
                    onChange={(value) => updateSetting('screensaver_show_suggestme', value)}
                />
            </PanelSectionRow>
            {enabled && (
                <>
                    <PanelSectionRow>
                        <Dropdown
                            rgOptions={SUGGESTME_MODE_OPTIONS}
                            selectedOption={settings.screensaver_suggestme_mode ?? "intelligent"}
                            onChange={(option) => updateSetting('screensaver_suggestme_mode', option.data)}
                            strDefaultLabel="Recommendation mode"
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <Dropdown
                            rgOptions={presetOptions.filter((o: any) => !o.disabled || o.data === -1)}
                            selectedOption={settings.screensaver_suggestme_preset_slot ?? -1}
                            onChange={(option) => updateSetting('screensaver_suggestme_preset_slot', option.data)}
                            strDefaultLabel="Filter preset"
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <Dropdown
                            rgOptions={SUGGESTME_STRATEGY_OPTIONS}
                            selectedOption={settings.screensaver_suggestme_pick_strategy ?? "daily"}
                            onChange={(option) => updateSetting('screensaver_suggestme_pick_strategy', option.data)}
                            strDefaultLabel="Pick strategy"
                        />
                    </PanelSectionRow>
                </>
            )}
        </PanelSection>
    );
};

// Widget Orchestrator Section
const WidgetOrchestratorSection = ({
    title,
    bucket,
    layout,
    settings,
    updateSetting,
    updateSettings,
}: {
    title: string;
    bucket: "big" | "small";
    layout: "large" | "fullscreen";
    settings: UserSettings;
    updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
    updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
}) => {
    const caps = WIDGET_CAPS[layout];
    const cap = bucket === "big" ? caps.big : caps.small;

    const settingsKey = bucket === "big" ? "screensaver_big_widgets" : "screensaver_small_widgets";
    const currentList: string[] = (settings[settingsKey] as string[] | undefined) ?? [];
    const allWidgets = bucket === "big" ? ALL_BIG_WIDGETS : ALL_SMALL_WIDGETS;
    const labels = bucket === "big" ? BIG_WIDGET_LABELS : SMALL_WIDGET_LABELS;
    const validOrder = currentList.filter((w) => (allWidgets as readonly string[]).includes(w));
    const displayOrder = [...validOrder, ...allWidgets.filter((w) => !validOrder.includes(w))];
    const atCap = validOrder.length >= cap;

    const toggleWidget = async (id: string, on: boolean) => {
        let newList: string[];
        if (on) {
            if (validOrder.includes(id) || validOrder.length >= cap) return;
            newList = [...validOrder, id];
        } else {
            newList = validOrder.filter((w) => w !== id);
        }
        await updateSettings({ [settingsKey]: newList } as Partial<UserSettings>);
    };

    const moveWidget = async (id: string, direction: -1 | 1) => {
        const idx = validOrder.indexOf(id);
        if (idx < 0) return;
        const target = idx + direction;
        if (target < 0 || target >= validOrder.length) return;
        const arr = [...validOrder];
        [arr[idx], arr[target]] = [arr[target], arr[idx]];
        await updateSettings({ [settingsKey]: arr } as Partial<UserSettings>);
    };

    const isBatteryEnabled = validOrder.includes("battery");

    return (
        <PanelSection title={title}>
            <PanelSectionRow>
                <div style={{ fontSize: 12, color: '#888', padding: '6px 0 8px 0' }}>
                    {validOrder.length} / {cap} slots used ({layout === "large" ? "Large" : "Fullscreen"} layout).
                    {atCap ? " Remove a widget to add another." : ""}
                </div>
            </PanelSectionRow>
            {displayOrder.map((id) => {
                const enabled = validOrder.includes(id);
                const disableToggle = !enabled && atCap;
                const idx = enabled ? validOrder.indexOf(id) : -1;
                const showOrderRow = enabled && validOrder.length > 1;
                const atFirst = showOrderRow && idx <= 0;
                const atLast = showOrderRow && idx >= validOrder.length - 1;
                return (
                    <div key={id}>
                        <PanelSectionRow>
                            <ToggleField
                                label={(labels as Record<string, string>)[id] || id}
                                checked={enabled}
                                disabled={disableToggle}
                                description={disableToggle ? `Slot limit reached (${cap})` : undefined}
                                onChange={(value) => toggleWidget(id, value)}
                            />
                        </PanelSectionRow>
                        {showOrderRow && (
                                <PanelSectionRow>
                                    <Focusable
                                        flow-children="horizontal"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            paddingLeft: 40,
                                            paddingTop: 2,
                                        }}
                                    >
                                        <span style={{ flex: 1, fontSize: 12, color: "#888" }}>Order</span>
                                        <Focusable
                                            onActivate={atFirst ? undefined : () => moveWidget(id, -1)}
                                            onClick={atFirst ? undefined : () => moveWidget(id, -1)}
                                            style={{
                                                padding: "4px 10px",
                                                backgroundColor: atFirst ? "#ffffff11" : "#ffffff22",
                                                borderRadius: 4,
                                                opacity: atFirst ? 0.4 : 1,
                                                cursor: atFirst ? "default" : "pointer",
                                            }}
                                        >
                                            ▲
                                        </Focusable>
                                        <Focusable
                                            onActivate={atLast ? undefined : () => moveWidget(id, 1)}
                                            onClick={atLast ? undefined : () => moveWidget(id, 1)}
                                            style={{
                                                padding: "4px 10px",
                                                backgroundColor: atLast ? "#ffffff11" : "#ffffff22",
                                                borderRadius: 4,
                                                opacity: atLast ? 0.4 : 1,
                                                cursor: atLast ? "default" : "pointer",
                                            }}
                                        >
                                            ▼
                                        </Focusable>
                                    </Focusable>
                                </PanelSectionRow>
                        )}
                        {/* Per-widget settings — always enabled when the widget is on */}
                        {enabled && id === "battery" && isBatteryEnabled && (
                            <>
                                <PanelSectionRow>
                                    <div style={{ paddingLeft: '40px' }}>
                                        <ToggleField
                                            icon={<FaBatteryFull size={16} />}
                                            label="Show battery bar"
                                            checked={settings.screensaver_battery_show_bar ?? false}
                                            onChange={(value) => updateSetting('screensaver_battery_show_bar', value)}
                                        />
                                    </div>
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <div style={{ paddingLeft: '40px' }}>
                                        <SliderField
                                            label="Low battery threshold"
                                            description={`${settings.screensaver_battery_low_threshold ?? 20}%`}
                                            value={settings.screensaver_battery_low_threshold ?? 20}
                                            min={5}
                                            max={50}
                                            step={5}
                                            onChange={(value) => updateSetting('screensaver_battery_low_threshold', value)}
                                            icon={<FaBatteryFull size={16} />}
                                        />
                                    </div>
                                </PanelSectionRow>
                            </>
                        )}
                    </div>
                );
            })}
        </PanelSection>
    );
};

// Screensaver Settings Page
const ScreensaverSettingsPage = () => {
    const { settings, updateSetting, updateSettings } = useSettings();
    const { profiles, saveProfile, loadProfile, deleteProfile } = useScreensaverProfiles();
    const mode = settings.screensaver_mode ?? 'dim';

    const [wallpaperStatus, setWallpaperStatus] = useState<{ reachable: boolean | null; message?: string }>({ reachable: null });
    const [wallpaperPaths, setWallpaperPaths] = useState<{
        runtime_dir: string;
        wallpaper_cache_dir: string;
        local_wallpapers_dir: string;
    } | null>(null);
    const [prefetchProgress, setPrefetchProgress] = useState<{ step: number; total: number } | null>(null);
    const [prefetchBusy, setPrefetchBusy] = useState(false);
    const [profileDraftSlot, setProfileDraftSlot] = useState<"slot_1" | "slot_2" | "slot_3" | null>(null);
    const [profileDraftName, setProfileDraftName] = useState("");

    useEffect(() => {
        let cancelled = false;
        getWallpaperStoragePathsCall()
            .then(paths => {
                if (!cancelled) setWallpaperPaths(paths);
            })
            .catch(() => {
                if (!cancelled) setWallpaperPaths(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const checkWallpaperReachable = async (prov: string) => {
        if (prov === 'none') {
            setWallpaperStatus({ reachable: null });
            return;
        }
        setWallpaperStatus({ reachable: null });
        try {
            const result = await checkWallpaperProviderCall(prov);
            setWallpaperStatus({ reachable: result.reachable, message: result.message });
        } catch {
            setWallpaperStatus({ reachable: false, message: 'Check failed' });
        }
    };

    useEffect(() => {
        const prov = settings.screensaver_wallpaper_provider || 'none';
        if (prov !== 'none') {
            checkWallpaperReachable(prov);
        } else {
            setWallpaperStatus({ reachable: null });
        }
    }, [settings.screensaver_wallpaper_provider]);

    useEffect(() => {
        const onProgress = (payload: { step: number; total: number; provider: string }) => {
            const prov = settings.screensaver_wallpaper_provider || 'none';
            if (payload.provider !== prov) return;
            setPrefetchProgress({ step: payload.step, total: Math.max(1, payload.total) });
        };
        const onComplete = (payload: { success: boolean; provider: string }) => {
            const prov = settings.screensaver_wallpaper_provider || 'none';
            if (payload.provider !== prov) return;
            setPrefetchBusy(false);
            setPrefetchProgress(null);
        };
        addEventListener('alarme_wallpaper_prefetch_progress', onProgress);
        addEventListener('alarme_wallpaper_prefetch_complete', onComplete);
        return () => {
            removeEventListener('alarme_wallpaper_prefetch_progress', onProgress);
            removeEventListener('alarme_wallpaper_prefetch_complete', onComplete);
        };
    }, [settings.screensaver_wallpaper_provider]);

    const modeOptions = [
        { data: 'black' as const, label: 'Black' },
        { data: 'dim' as const, label: 'Dim' },
        { data: 'wallpaper' as const, label: 'Wallpaper' },
    ];

    const idleOptions = [
        { data: 5, label: '5 seconds' },
        { data: 15, label: '15 seconds' },
        { data: 30, label: '30 seconds' },
        { data: 60, label: '1 minute' },
        { data: 120, label: '2 minutes' },
        { data: 300, label: '5 minutes' },
        { data: 600, label: '10 minutes' },
    ];

    const layoutOptions = [
        { data: 'compact', label: 'Compact (Overlay bar)' },
        { data: 'large', label: 'Large (Centered)' },
        { data: 'fullscreen', label: 'Fullscreen' },
    ];

    const clockStyleOptions = [
        { data: 'digital', label: 'Digital (HH:MM)' },
        { data: 'digital_seconds', label: 'Digital + Seconds' },
        { data: 'digital_large', label: 'Digital Large (Blinking)' },
        { data: 'analog', label: 'Analog' },
    ];

    const accentColorOptions = [
        { data: 'muted_gray', label: 'Muted Gray' },
        { data: 'white', label: 'White' },
        { data: 'warm_amber', label: 'Warm Amber' },
        { data: 'cool_blue', label: 'Cool Blue' },
        { data: 'soft_red', label: 'Soft Red' },
        { data: 'mint_green', label: 'Mint Green' },
        { data: 'dim_orange', label: 'Dim Orange' },
        ...(mode === 'wallpaper' ? [{ data: 'contrast_auto' as const, label: 'Contrast with Background' }] : []),
    ];

    const wallpaperProviderOptions = [
        { data: 'none' as const, label: 'None' },
        { data: 'picsum', label: 'Lorem Picsum' },
        { data: 'bing_daily', label: 'Bing Daily' },
        { data: 'lorem_flickr', label: 'Lorem Flickr' },
        { data: 'nasa_apod', label: 'NASA Astronomy Picture' },
        { data: 'local_folder', label: 'Local Folder' },
    ];

    const fitOptions = [
        { data: 'cover', label: 'Cover (Fill)' },
        { data: 'contain', label: 'Contain (Letterbox)' },
    ];

    const blurOptions = [
        { data: 'none', label: 'None' },
        { data: 'light', label: 'Light' },
        { data: 'heavy', label: 'Heavy' },
    ];

    const handlePreview = () => {
        triggerScreensaverPreviewAfterClosingMenus();
    };

    const provider = settings.screensaver_wallpaper_provider || 'none';
    const rawLayoutMode = (settings.overlay_screensaver_layout as unknown as string | undefined) || 'compact';
    const layoutMode = rawLayoutMode === 'floating' ? 'large' : rawLayoutMode;
    const weatherInUse = layoutMode === 'compact'
        ? (settings.screensaver_show_weather ?? false)
        : (settings.screensaver_small_widgets ?? []).includes('weather') || (settings.screensaver_big_widgets ?? []).includes('forecast');
    const layoutIsCompact = layoutMode === 'compact';
    const poolSz = clampWallpaperPoolSize(settings.screensaver_wallpaper_pool_size);
    const autoRotateWallpaper = settings.screensaver_wallpaper_auto_rotate ?? true;
    const cacheUpdatedLabel = (() => {
        const iso = settings.screensaver_wallpaper_cache_updated_at;
        if (!iso) return 'Never';
        try {
            return new Date(iso).toLocaleString();
        } catch {
            return iso;
        }
    })();

    const handlePrefetchWallpapers = async () => {
        if (provider === 'none' || prefetchBusy) return;
        const sz = clampWallpaperPoolSize(settings.screensaver_wallpaper_pool_size);
        setPrefetchBusy(true);
        setPrefetchProgress({ step: 0, total: sz });
        try {
            await prefetchWallpapersCall(provider, sz);
        } catch (e) {
            console.error('[AlarMe] prefetch_wallpapers:', e);
            setPrefetchBusy(false);
            setPrefetchProgress(null);
        }
    };

    const handleSaveProfile = async (slot: string, name: string) => {
        await saveProfile(slot, name);
    };

    const beginSaveProfile = (slot: "slot_1" | "slot_2" | "slot_3") => {
        const p = profiles[slot];
        setProfileDraftSlot(slot);
        setProfileDraftName((p?.name ?? "").trim());
    };

    const commitProfileDraft = async () => {
        if (!profileDraftSlot || !profileDraftName.trim()) return;
        await handleSaveProfile(profileDraftSlot, profileDraftName.trim());
        setProfileDraftSlot(null);
        setProfileDraftName("");
    };

    const cancelProfileDraft = () => {
        setProfileDraftSlot(null);
        setProfileDraftName("");
    };

    const handleLoadProfile = async (slot: string) => {
        showModal(
            <ConfirmModal
                strTitle="Load Profile"
                strDescription={`Apply profile "${profiles[slot as keyof typeof profiles]?.name}"? This will change your screensaver settings.`}
                strOKButtonText="Apply"
                strCancelButtonText="Cancel"
                onOK={async () => {
                    await loadProfile(slot);
                }}
            />
        );
    };

    const handleDeleteProfile = async (slot: string) => {
        showModal(
            <ConfirmModal
                strTitle="Delete Profile"
                strDescription={`Delete profile "${profiles[slot as keyof typeof profiles]?.name}"? This cannot be undone.`}
                strOKButtonText="Delete"
                strCancelButtonText="Cancel"
                onOK={async () => {
                    await deleteProfile(slot);
                }}
            />
        );
    };

    return (
        <ScrollableContent>
            {/* Invisible focusable anchor for scroll-to-top */}
            <PanelSection>
                <PanelSectionRow>
                    <Focusable
                        onActivate={() => { }}
                        style={{
                            height: 1,
                            opacity: 0,
                            outline: 'none'
                        }}
                    >
                        <span></span>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            {/* === Profiles === */}
            <PanelSection title="Profiles">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0', lineHeight: 1.5 }}>
                        Save your current screensaver settings to a profile slot, then quickly switch between them.
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <Focusable
                        flow-children="horizontal"
                        style={{ display: "flex", flexDirection: "row", gap: 10, width: "100%", alignItems: "stretch" }}
                    >
                        <ProfileSlotCard
                            slot="slot_1"
                            profile={profiles.slot_1}
                            onLoad={(s) => void handleLoadProfile(s)}
                            onDelete={(s) => void handleDeleteProfile(s)}
                            onRequestSave={beginSaveProfile}
                        />
                        <ProfileSlotCard
                            slot="slot_2"
                            profile={profiles.slot_2}
                            onLoad={(s) => void handleLoadProfile(s)}
                            onDelete={(s) => void handleDeleteProfile(s)}
                            onRequestSave={beginSaveProfile}
                        />
                        <ProfileSlotCard
                            slot="slot_3"
                            profile={profiles.slot_3}
                            onLoad={(s) => void handleLoadProfile(s)}
                            onDelete={(s) => void handleDeleteProfile(s)}
                            onRequestSave={beginSaveProfile}
                        />
                    </Focusable>
                </PanelSectionRow>
                {profileDraftSlot && (
                    <PanelSectionRow>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                                Save current screensaver settings to slot {profileDraftSlot === "slot_1" ? "1" : profileDraftSlot === "slot_2" ? "2" : "3"}
                            </div>
                            <TextField
                                label="Profile name"
                                value={profileDraftName}
                                onChange={(e) => setProfileDraftName(e.target.value)}
                            />
                            <Focusable flow-children="horizontal" style={{ display: "flex", flexDirection: "row", gap: 8 }}>
                                <Focusable
                                    onActivate={() => void commitProfileDraft()}
                                    onClick={() => void commitProfileDraft()}
                                    style={{
                                        padding: "8px 14px",
                                        borderRadius: 6,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        backgroundColor: "#4488aa88",
                                        border: "2px solid transparent",
                                    }}
                                >
                                    Store
                                </Focusable>
                                <Focusable
                                    onActivate={cancelProfileDraft}
                                    onClick={cancelProfileDraft}
                                    style={{
                                        padding: "8px 14px",
                                        borderRadius: 6,
                                        fontSize: 13,
                                        backgroundColor: "#ffffff18",
                                        border: "2px solid transparent",
                                    }}
                                >
                                    Cancel
                                </Focusable>
                            </Focusable>
                        </div>
                    </PanelSectionRow>
                )}
            </PanelSection>

            {/* === Mode === */}
            <PanelSection title="Screensaver Mode">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0', lineHeight: 1.5 }}>
                        Choose the background behavior when the screensaver activates. To turn the screensaver off, disable the Screensaver toggle on each timer, alarm, reminder, stopwatch, or Pomodoro, and leave Standalone Mode off.
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <FaDesktop style={{ color: '#888', flexShrink: 0 }} />
                        <span style={{ flexShrink: 0 }}>Background</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Dropdown
                                rgOptions={modeOptions}
                                selectedOption={mode}
                                onChange={(option) => updateSetting('screensaver_mode', option.data)}
                                strDefaultLabel="Select Mode"
                            />
                        </div>
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#666', padding: '0 0 4px 0' }}>
                        {mode === 'black' && 'Screen turns completely black.'}
                        {mode === 'dim' && 'Screen dims to a configurable opacity.'}
                        {mode === 'wallpaper' && 'A wallpaper image is shown behind the clock and widgets.'}
                    </div>
                </PanelSectionRow>
            </PanelSection>

            {mode === 'wallpaper' && (
                <PanelSection title="Wallpaper">
                    <PanelSectionRow>
                        <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0', lineHeight: 1.5 }}>
                            Wallpapers are prefetched while this mode is selected so the screensaver can open without waiting on the network.
                        </div>
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                            <FaEye style={{ color: '#888', flexShrink: 0 }} />
                            <span style={{ flexShrink: 0 }}>Provider</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Dropdown
                                    rgOptions={wallpaperProviderOptions}
                                    selectedOption={provider}
                                    onChange={(option) => updateSetting('screensaver_wallpaper_provider', option.data as WallpaperProvider)}
                                    strDefaultLabel="Select Provider"
                                />
                            </div>
                        </div>
                    </PanelSectionRow>

                    {provider !== 'none' && (
                        <>
                            {(provider === 'picsum' || provider === 'lorem_flickr' || provider === 'local_folder') && (
                                <PanelSectionRow>
                                    <SliderField
                                        label="Rotation pool size"
                                        description={`${poolSz} image${poolSz === 1 ? '' : 's'} in the cycle (max ${WALLPAPER_POOL_MAX})`}
                                        value={poolSz}
                                        min={1}
                                        max={WALLPAPER_POOL_MAX}
                                        step={1}
                                        onChange={(value) => updateSetting('screensaver_wallpaper_pool_size', value)}
                                        icon={<FaPhotoVideo size={16} />}
                                    />
                                </PanelSectionRow>
                            )}
                            {(provider === 'bing_daily' || provider === 'nasa_apod') && (
                                <PanelSectionRow>
                                    <div style={{ fontSize: 11, color: '#888', padding: '4px 0' }}>
                                        This provider exposes one image per day; rotation pool applies to other providers only. A slow image drift runs automatically on OLED-prone static images.
                                    </div>
                                </PanelSectionRow>
                            )}
                            {provider === 'nasa_apod' && (
                                <PanelSectionRow>
                                    <TextField
                                        label="NASA api.nasa.gov API key (optional)"
                                        value={settings.screensaver_nasa_api_key ?? ''}
                                        onChange={(e) => updateSetting('screensaver_nasa_api_key', e.target.value)}
                                    />
                                    <div style={{ fontSize: 11, color: '#666', marginTop: 6, lineHeight: 1.45 }}>
                                        Without a key the public DEMO_KEY is used (strict rate limits). A free key from{' '}
                                        <span style={{ wordBreak: 'break-all' }}>https://api.nasa.gov/</span> avoids most failures.
                                    </div>
                                </PanelSectionRow>
                            )}
                            {provider === 'local_folder' && (
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaDesktop size={16} />}
                                        label="Slow wallpaper drift (OLED)"
                                        description="Pans a static local image slightly over time to reduce burn-in on OLED panels. Uses extra GPU work while the screensaver is visible."
                                        checked={settings.screensaver_wallpaper_shift_local ?? false}
                                        onChange={(value) => updateSetting('screensaver_wallpaper_shift_local', value)}
                                    />
                                </PanelSectionRow>
                            )}
                            <PanelSectionRow>
                                <ToggleField
                                    icon={<FaRedo size={16} />}
                                    label="Rotate automatically"
                                    description="Advance through the pool on a timer in random order (each image once per cycle). When off, the first image stays until you refresh."
                                    checked={autoRotateWallpaper}
                                    onChange={(value) => updateSetting('screensaver_wallpaper_auto_rotate', value)}
                                />
                            </PanelSectionRow>
                            {autoRotateWallpaper && provider !== 'bing_daily' && provider !== 'nasa_apod' && (
                                <PanelSectionRow>
                                    <SliderField
                                        label="Rotation interval"
                                        description={
                                            (settings.screensaver_wallpaper_interval ?? 300) < 60
                                                ? `Next image every ${settings.screensaver_wallpaper_interval ?? 300}s`
                                                : `Next image every ${Math.round((settings.screensaver_wallpaper_interval ?? 300) / 60)} min`
                                        }
                                        value={settings.screensaver_wallpaper_interval ?? 300}
                                        min={30}
                                        max={1800}
                                        step={30}
                                        onChange={(value) => updateSetting('screensaver_wallpaper_interval', value)}
                                        icon={<FaClock size={16} />}
                                    />
                                </PanelSectionRow>
                            )}
                            <PanelSectionRow>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                    <FaDesktop style={{ color: '#888', flexShrink: 0 }} />
                                    <span style={{ flexShrink: 0 }}>Fit Mode</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Dropdown
                                            rgOptions={fitOptions}
                                            selectedOption={settings.screensaver_wallpaper_fit || 'cover'}
                                            onChange={(option) => updateSetting('screensaver_wallpaper_fit', option.data as WallpaperFit)}
                                            strDefaultLabel="Select Fit"
                                        />
                                    </div>
                                </div>
                            </PanelSectionRow>
                            <PanelSectionRow>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                    <FaEye style={{ color: '#888', flexShrink: 0 }} />
                                    <span style={{ flexShrink: 0 }}>Blur</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Dropdown
                                            rgOptions={blurOptions}
                                            selectedOption={settings.screensaver_wallpaper_blur || 'none'}
                                            onChange={(option) => updateSetting('screensaver_wallpaper_blur', option.data as WallpaperBlur)}
                                            strDefaultLabel="Select Blur"
                                        />
                                    </div>
                                </div>
                            </PanelSectionRow>
                            <PanelSectionRow>
                                <SliderField
                                    label="Dim Overlay"
                                    description={`${Math.round((settings.screensaver_wallpaper_dim ?? 0.4) * 100)}%`}
                                    value={Math.round((settings.screensaver_wallpaper_dim ?? 0.4) * 100)}
                                    min={0}
                                    max={80}
                                    step={5}
                                    onChange={(value) => updateSetting('screensaver_wallpaper_dim', value / 100)}
                                    icon={<FaEye size={16} />}
                                />
                            </PanelSectionRow>
                            <PanelSectionRow>
                                <ToggleField
                                    icon={<FaPhotoVideo size={16} />}
                                    label="Show image title and credit"
                                    description="Bottom-left on the wallpaper when the provider supplies metadata (e.g. Bing, NASA)."
                                    checked={settings.screensaver_wallpaper_show_attribution ?? true}
                                    onChange={(value) => updateSetting('screensaver_wallpaper_show_attribution', value)}
                                />
                            </PanelSectionRow>

                            <PanelSectionRow>
                                <div style={{ fontSize: 11, color: '#aaa', padding: '4px 0', lineHeight: 1.45 }}>
                                    <div>Last prefetch: {cacheUpdatedLabel}</div>
                                    <div style={{ marginTop: 6 }}>
                                        Online cache directory:{' '}
                                        <code style={{ fontSize: 10 }}>{wallpaperPaths?.wallpaper_cache_dir ?? '…'}</code>
                                    </div>
                                    <div style={{ marginTop: 6 }}>
                                        Personal wallpapers folder:{' '}
                                        <code style={{ fontSize: 10 }}>{wallpaperPaths?.local_wallpapers_dir ?? '…'}</code>
                                    </div>
                                </div>
                            </PanelSectionRow>

                            {(prefetchBusy || prefetchProgress !== null) && (
                                <PanelSectionRow>
                                    <ProgressBarWithInfo
                                        nProgress={
                                            prefetchProgress && prefetchProgress.total > 0
                                                ? (prefetchProgress.step / prefetchProgress.total) * 100
                                                : 0
                                        }
                                        sOperationText={
                                            prefetchProgress
                                                ? `Prefetch ${prefetchProgress.step}/${prefetchProgress.total}`
                                                : 'Prefetch…'
                                        }
                                    />
                                </PanelSectionRow>
                            )}

                            <PanelSectionRow>
                                <ButtonItem layout="below" disabled={prefetchBusy} onClick={handlePrefetchWallpapers}>
                                    <FaRedo size={12} style={{ marginRight: 8 }} />
                                    Refetch wallpaper cache
                                </ButtonItem>
                            </PanelSectionRow>

                            <PanelSectionRow>
                                <div style={{ fontSize: 11, padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                backgroundColor:
                                                    wallpaperStatus.reachable === null
                                                        ? '#888'
                                                        : wallpaperStatus.reachable
                                                          ? '#4caf50'
                                                          : '#f44336',
                                            }}
                                        />
                                        <span
                                            style={{
                                                color:
                                                    wallpaperStatus.reachable === null
                                                        ? '#888'
                                                        : wallpaperStatus.reachable
                                                          ? '#8f8'
                                                          : '#f88',
                                            }}
                                        >
                                            {wallpaperStatus.reachable === null
                                                ? 'Checking…'
                                                : wallpaperStatus.reachable
                                                  ? 'Reachable'
                                                  : wallpaperStatus.message || 'Unreachable'}
                                        </span>
                                    </div>
                                </div>
                            </PanelSectionRow>

                            <PanelSectionRow>
                                <div style={{ fontSize: 11, color: '#666', padding: '4px 0', lineHeight: 1.45 }}>
                                    {provider === 'local_folder' ? (
                                        <>
                                            Uses JPG, PNG, or WebP files from the personal folder above (sorted alphabetically). Subfolders are not scanned.
                                            Refetch checks that folder so &quot;Last prefetch&quot; stays meaningful when you add or remove files.
                                        </>
                                    ) : (
                                        <>
                                            Images are downloaded into the online cache path on disk and rotated within the pool size for this provider only.
                                        </>
                                    )}
                                </div>
                            </PanelSectionRow>
                        </>
                    )}

                    {provider === 'none' && (
                        <PanelSectionRow>
                            <div style={{ fontSize: 11, color: '#666', padding: '4px 0' }}>
                                Choose a provider to show a wallpaper behind the clock, or leave None for a blank background.
                            </div>
                        </PanelSectionRow>
                    )}
                </PanelSection>
            )}

                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                    {/* === Activation === */}
                    <PanelSection title="Activation">
                        <PanelSectionRow>
                            <div style={{ fontSize: 12, color: '#aaaaaa', padding: '6px 0', lineHeight: 1.5 }}>
                                The screensaver activates after a period of inactivity.
                            </div>
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaDesktop size={16} />}
                                label="Standalone Mode"
                                description="Activate screensaver based on inactivity. Overrides alert screensaver settings when enabled."
                                checked={settings.screensaver_standalone_enabled ?? false}
                                onChange={(value) => updateSetting('screensaver_standalone_enabled', value)}
                            />
                        </PanelSectionRow>

                        {settings.screensaver_standalone_enabled && (
                            <PanelSectionRow>
                                <div style={{ paddingLeft: '40px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                        <FaClock style={{ color: '#888', flexShrink: 0 }} />
                                        <span style={{ flexShrink: 0 }}>Standalone Idle Time</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <Dropdown
                                                rgOptions={idleOptions}
                                                selectedOption={settings.screensaver_standalone_idle_seconds ?? 60}
                                                onChange={(option) => updateSetting('screensaver_standalone_idle_seconds', option.data as number)}
                                                strDefaultLabel="Select Time"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </PanelSectionRow>
                        )}

                        <PanelSectionRow>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                <FaClock style={{ color: '#888', flexShrink: 0 }} />
                                <span style={{ flexShrink: 0 }}>Inhibitor Idle Time</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Dropdown
                                        rgOptions={idleOptions}
                                        selectedOption={settings.screensaver_idle_seconds ?? 15}
                                        onChange={(option) => updateSetting('screensaver_idle_seconds', option.data as number)}
                                        strDefaultLabel="Select Time"
                                    />
                                </div>
                            </div>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <div style={{ fontSize: 11, color: '#666', padding: '6px 0 4px 0' }}>
                                Idle time used when alerts are preventing sleep. Any button press or touch wakes the screen.
                            </div>
                        </PanelSectionRow>

                        {mode === 'dim' && (
                            <PanelSectionRow>
                                <SliderField
                                    label="Dim Intensity"
                                    description={`${Math.round((settings.screensaver_dim_opacity ?? 0.92) * 100)}%`}
                                    value={Math.round((settings.screensaver_dim_opacity ?? 0.92) * 100)}
                                    min={70}
                                    max={99}
                                    step={1}
                                    onChange={(value) => updateSetting('screensaver_dim_opacity', value / 100)}
                                    icon={<FaEye size={16} />}
                                />
                            </PanelSectionRow>
                        )}
                    </PanelSection>

                    {/* === Layout === */}
                    <PanelSection title="Layout">
                        <PanelSectionRow>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                <FaDesktop style={{ color: '#888', flexShrink: 0 }} />
                                <span style={{ flexShrink: 0 }}>Layout Mode</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Dropdown
                                        rgOptions={layoutOptions}
                                        selectedOption={rawLayoutMode === 'floating' ? 'large' : rawLayoutMode}
                                        onChange={async (option) => {
                                            const newLayout = option.data as ScreensaverLayout;
                                            const batch: Partial<UserSettings> = { overlay_screensaver_layout: newLayout };
                                            if (newLayout !== 'compact') {
                                                const newCaps = WIDGET_CAPS[newLayout];
                                                const curBig: string[] = (settings.screensaver_big_widgets as string[] | undefined) ?? [];
                                                const curSmall: string[] = (settings.screensaver_small_widgets as string[] | undefined) ?? [];
                                                const trimmedBig = curBig.slice(newCaps.big);
                                                const trimmedSmall = curSmall.slice(newCaps.small);
                                                if (trimmedBig.length > 0 || trimmedSmall.length > 0) {
                                                    batch.screensaver_big_widgets = curBig.slice(0, newCaps.big) as any;
                                                    batch.screensaver_small_widgets = curSmall.slice(0, newCaps.small) as any;
                                                    const removed = [...trimmedBig, ...trimmedSmall];
                                                    toaster.toast({
                                                        title: "Layout adjusted",
                                                        body: `Removed ${removed.length} widget${removed.length > 1 ? "s" : ""} to fit ${newLayout === "large" ? "Large" : "Fullscreen"} limits.`,
                                                    });
                                                }
                                            }
                                            await updateSettings(batch);
                                        }}
                                        strDefaultLabel="Select Layout"
                                    />
                                </div>
                            </div>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <div style={{ fontSize: 11, color: '#666', padding: '6px 0 4px 0' }}>
                                {(settings.overlay_screensaver_layout || 'compact') === 'compact' &&
                                    'Compact uses a minimal notification-style overlay bar (default placement is the upper corner; adjust under Overlay → Position).'}
                                {(settings.overlay_screensaver_layout || 'compact') === 'large' &&
                                    'Large (Centered) keeps the clock and widgets in one wide floating panel with a dim backdrop. With OLED burn-in protection on, the panel drifts.'}
                                {(settings.overlay_screensaver_layout || 'compact') === 'fullscreen' &&
                                    'Fullscreen spreads the same widgets with extra space; only each widget’s light surface is shown (no dim panel behind the stack). With OLED burn-in protection on, the layout drifts.'}
                            </div>
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <SliderField
                                label="Screensaver base size"
                                description={`${settings.screensaver_clock_size ?? 20}px — scales clock and all screensaver widgets; size adjusts automatically with display resolution.`}
                                value={settings.screensaver_clock_size ?? 20}
                                min={24}
                                max={96}
                                step={2}
                                onChange={(value) => updateSetting('screensaver_clock_size', value)}
                                icon={<FaClock size={16} />}
                            />
                        </PanelSectionRow>

                        {(settings.overlay_screensaver_layout || 'compact') !== 'compact' && (settings.pixel_shift_enabled ?? true) && (
                            <PanelSectionRow>
                                <SliderField
                                    label="Drift Range"
                                    description={`±${settings.screensaver_floating_drift_range ?? 40}px`}
                                    value={settings.screensaver_floating_drift_range ?? 40}
                                    min={20}
                                    max={100}
                                    step={5}
                                    onChange={(value) => updateSetting('screensaver_floating_drift_range', value)}
                                    icon={<FaDesktop size={16} />}
                                />
                            </PanelSectionRow>
                        )}
                    </PanelSection>

                    {/* === Clock === */}
                    <PanelSection title="Clock">
                        <PanelSectionRow>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                <FaClock style={{ color: '#888', flexShrink: 0 }} />
                                <span style={{ flexShrink: 0 }}>Clock Style</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Dropdown
                                        rgOptions={clockStyleOptions}
                                        selectedOption={settings.screensaver_clock_style || 'digital'}
                                        onChange={(option) => updateSetting('screensaver_clock_style', option.data as ClockStyle)}
                                        strDefaultLabel="Select Style"
                                    />
                                </div>
                            </div>
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                <FaEye style={{ color: '#888', flexShrink: 0 }} />
                                <span style={{ flexShrink: 0 }}>Accent Color</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Dropdown
                                        rgOptions={accentColorOptions}
                                        selectedOption={
                                            (settings.screensaver_accent_color === 'contrast_auto' && mode !== 'wallpaper')
                                                ? 'muted_gray'
                                                : (settings.screensaver_accent_color || 'muted_gray')
                                        }
                                        onChange={(option) => updateSetting('screensaver_accent_color', option.data as AccentColorPreset)}
                                        strDefaultLabel="Select Color"
                                    />
                                </div>
                            </div>
                        </PanelSectionRow>
                        {mode === 'wallpaper' && (
                            <PanelSectionRow>
                                <div style={{ fontSize: 11, color: '#666', padding: '2px 0 6px 40px' }}>
                                    Contrast with Background auto-picks the widget accent color after each wallpaper change.
                                </div>
                            </PanelSectionRow>
                        )}
                    </PanelSection>

                    {/* === Widget Configuration (pre-header) === */}
                    <PanelSection title="Widget Configuration">
                        <PanelSectionRow>
                            <div style={{ fontSize: 12, color: '#aaaaaa', padding: '6px 0', lineHeight: 1.5 }}>
                                Configure integrations used by screensaver widgets. Enable widgets in the sections below.
                            </div>
                        </PanelSectionRow>

                        {/* Weather: location + units (indented under Widget Configuration) */}
                        <PanelSectionRow>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                                <FaCloud style={{ color: "#888", flexShrink: 0 }} />
                                <span style={{ flexShrink: 0, fontWeight: 600, fontSize: 13, color: "#ccc" }}>Weather location</span>
                            </div>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <div style={{ paddingLeft: 40 }}>
                                <div style={{ fontSize: 12, color: "#aaaaaa", lineHeight: 1.5, marginBottom: 6 }}>
                                    Forecasts use Open-Meteo (no account). Pick a city or use approximate IP-based location.
                                </div>
                                {(settings.screensaver_weather_lat != null &&
                                    settings.screensaver_weather_lon != null &&
                                    (settings.screensaver_weather_city_name || "").trim().length > 0) && (
                                    <div style={{ fontSize: 12, color: "#888", lineHeight: 1.45, marginBottom: 8 }}>
                                        Saved:{" "}
                                        <span style={{ color: "#ddd" }}>{settings.screensaver_weather_city_name}</span>
                                        {settings.screensaver_weather_location_source === "ip" ? (
                                            <span style={{ color: "#777" }}> (IP geolocation)</span>
                                        ) : null}
                                    </div>
                                )}
                                <WeatherLocationPicker />
                            </div>
                        </PanelSectionRow>

                        {layoutMode === 'compact' && (
                            <PanelSectionRow>
                                <div style={{ paddingLeft: 40 }}>
                                <ToggleField
                                    icon={<FaCloud size={16} />}
                                    label="Show weather in compact overlay"
                                    description="Adds a short temperature, humidity, and AQI readout to the overlay bar while the screensaver is active."
                                    checked={settings.screensaver_show_weather ?? false}
                                    onChange={(value) => updateSetting('screensaver_show_weather', value)}
                                />
                                </div>
                            </PanelSectionRow>
                        )}

                        {weatherInUse && (
                            <>
                                <PanelSectionRow>
                                    <div style={{ paddingLeft: 40 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                        <FaCloud style={{ color: '#888', flexShrink: 0 }} />
                                        <span style={{ flexShrink: 0 }}>Temperature unit</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <Dropdown
                                                rgOptions={[
                                                    { data: 'C' as const, label: 'Celsius' },
                                                    { data: 'F' as const, label: 'Fahrenheit' },
                                                ]}
                                                selectedOption={settings.screensaver_weather_unit || 'C'}
                                                onChange={(option) => updateSetting('screensaver_weather_unit', option.data)}
                                                strDefaultLabel="Unit"
                                            />
                                        </div>
                                        </div>
                                    </div>
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <div style={{ paddingLeft: 40 }}>
                                    <ToggleField
                                        icon={<FaCloud size={16} />}
                                        label="Show daily high / low"
                                        checked={settings.screensaver_weather_show_highlow ?? true}
                                        onChange={(value) => updateSetting('screensaver_weather_show_highlow', value)}
                                    />
                                    </div>
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <div style={{ paddingLeft: 40 }}>
                                    <ToggleField
                                        icon={<FaCloud size={16} />}
                                        label="Show condition label"
                                        checked={settings.screensaver_weather_show_condition ?? true}
                                        onChange={(value) => updateSetting('screensaver_weather_show_condition', value)}
                                    />
                                    </div>
                                </PanelSectionRow>
                                {weatherInUse && (
                                    <PanelSectionRow>
                                        <div style={{ paddingLeft: 40 }}>
                                        <SliderField
                                            label="Forecast refresh interval"
                                            description={`Cached up to ${settings.screensaver_weather_refresh_minutes ?? 30} minutes between fetches`}
                                            value={settings.screensaver_weather_refresh_minutes ?? 30}
                                            min={5}
                                            max={120}
                                            step={5}
                                            onChange={(value) => updateSetting('screensaver_weather_refresh_minutes', value)}
                                            icon={<FaClock size={16} />}
                                        />
                                        </div>
                                    </PanelSectionRow>
                                )}
                            </>
                        )}

                        {/* SuggestMe integration config */}
                        <SuggestMeSettingsSection settings={settings} updateSetting={updateSetting} />
                    </PanelSection>

                    {/* === Header Widgets === */}
                    <PanelSection title="Header">
                        <PanelSectionRow>
                            <div style={{ fontSize: 11, color: '#666', padding: '6px 0' }}>
                                {layoutIsCompact
                                    ? 'Compact uses the notification overlay bar. These settings apply when a non-compact layout is active.'
                                    : 'Clock and date shown at the top of the screensaver panel.'}
                            </div>
                        </PanelSectionRow>

                        {layoutIsCompact && (
                            <>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaClock size={16} />}
                                        label="Show clock on compact bar"
                                        checked={settings.overlay_compact_screensaver_show_clock ?? true}
                                        onChange={(value) => updateSetting('overlay_compact_screensaver_show_clock', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaCalendarAlt size={16} />}
                                        label="Show date on compact bar"
                                        checked={settings.overlay_compact_screensaver_show_date ?? true}
                                        onChange={(value) => updateSetting('overlay_compact_screensaver_show_date', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaBatteryFull size={16} />}
                                        label="Show battery on compact bar"
                                        checked={settings.overlay_compact_screensaver_show_battery ?? true}
                                        onChange={(value) => updateSetting('overlay_compact_screensaver_show_battery', value)}
                                    />
                                </PanelSectionRow>
                            </>
                        )}

                        {!layoutIsCompact && (
                            <>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaClock size={16} />}
                                        label="Show clock"
                                        checked={settings.screensaver_center_show_clock ?? true}
                                        onChange={(value) => updateSetting('screensaver_center_show_clock', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaCalendarAlt size={16} />}
                                        label="Show date line"
                                        checked={settings.screensaver_center_show_date ?? true}
                                        onChange={(value) => updateSetting('screensaver_center_show_date', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaCalendarAlt size={16} />}
                                        label="Show day of week"
                                        checked={settings.screensaver_show_day_of_week ?? true}
                                        onChange={(value) => updateSetting('screensaver_show_day_of_week', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaCalendarAlt size={16} />}
                                        label="Show year"
                                        checked={settings.screensaver_show_year ?? false}
                                        onChange={(value) => updateSetting('screensaver_show_year', value)}
                                    />
                                </PanelSectionRow>
                            </>
                        )}
                    </PanelSection>

                    {/* === Big Widgets === */}
                    {!layoutIsCompact && (
                        <WidgetOrchestratorSection
                            title="Big Widgets"
                            bucket="big"
                            layout={layoutMode as 'large' | 'fullscreen'}
                            settings={settings}
                            updateSetting={updateSetting}
                            updateSettings={updateSettings}
                        />
                    )}

                    {/* === Small Widgets === */}
                    {!layoutIsCompact && (
                        <WidgetOrchestratorSection
                            title="Small Widgets"
                            bucket="small"
                            layout={layoutMode as 'large' | 'fullscreen'}
                            settings={settings}
                            updateSetting={updateSetting}
                            updateSettings={updateSettings}
                        />
                    )}

                    {!layoutIsCompact && (
                        <PanelSection title="Alerts list (screensaver)">
                            <PanelSectionRow>
                                <div style={{ fontSize: 12, color: "#aaaaaa", padding: "6px 0", lineHeight: 1.5 }}>
                                    Part of the widget layout: shown centered under the small-widget row. Does not use a small-widget slot (see counts above).
                                </div>
                            </PanelSectionRow>
                            <PanelSectionRow>
                                <ToggleField
                                    icon={<FaBell size={16} />}
                                    label="Show upcoming alerts"
                                    description="Same entries as the game overlay bar, ordered by due time, up to the overlay slot limit."
                                    checked={settings.screensaver_show_alerts_list ?? true}
                                    onChange={(value) => updateSetting("screensaver_show_alerts_list", value)}
                                />
                            </PanelSectionRow>
                        </PanelSection>
                    )}

                    {/* === OLED Protection === */}
                    <PanelSection title="OLED Protection">
                        <PanelSectionRow>
                            <div style={{ fontSize: 12, color: '#aaaaaa', padding: '6px 0', lineHeight: 1.5 }}>
                                The overlay slowly orbits in a circle to prevent static elements from burning into OLED screens.
                            </div>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaShieldAlt size={16} />}
                                label="Pixel Shift"
                                description="Slowly move overlay content to prevent OLED burn-in"
                                checked={settings.pixel_shift_enabled ?? true}
                                onChange={(value) => updateSetting('pixel_shift_enabled', value)}
                            />
                        </PanelSectionRow>
                        {(settings.pixel_shift_enabled ?? true) && (
                            <>
                                <PanelSectionRow>
                                    <div style={{ paddingLeft: '40px' }}>
                                        <SliderField
                                            label="Shift Range"
                                            description={`±${settings.pixel_shift_range ?? 3} pixels`}
                                            value={settings.pixel_shift_range ?? 3}
                                            min={1}
                                            max={10}
                                            step={1}
                                            onChange={(value) => updateSetting('pixel_shift_range', value)}
                                            icon={<FaDesktop size={16} />}
                                        />
                                    </div>
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <div style={{ paddingLeft: '40px' }}>
                                        <SliderField
                                            label="Shift Interval"
                                            description={`Every ${settings.pixel_shift_interval_seconds ?? 60} seconds`}
                                            value={settings.pixel_shift_interval_seconds ?? 60}
                                            min={10}
                                            max={300}
                                            step={10}
                                            onChange={(value) => updateSetting('pixel_shift_interval_seconds', value)}
                                            icon={<FaClock size={16} />}
                                        />
                                    </div>
                                </PanelSectionRow>
                            </>
                        )}
                    </PanelSection>

                    {/* === Preview === */}
                    <PanelSection title="Preview">
                        <PanelSectionRow>
                            <div style={{ fontSize: 12, color: '#aaaaaa', padding: '6px 0' }}>
                                Test the screensaver immediately. Press any button or touch the screen to dismiss.
                            </div>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ButtonItem
                                layout="below"
                                icon={<FaEye size={16} />}
                                onClick={handlePreview}
                            >
                                Preview Screensaver
                            </ButtonItem>
                        </PanelSectionRow>
                    </PanelSection>
                </div>
        </ScrollableContent>
    );
};

// Backup Settings Page
const BackupSettingsPage = () => {
    const [resetting, setResetting] = useState(false);
    const [resetDone, setResetDone] = useState(false);

    const handleReset = async () => {
        setResetting(true);
        try {
            await factoryResetCall();
            setResetDone(true);
        } catch (e) {
            console.error('Factory reset failed:', e);
        } finally {
            setResetting(false);
        }
    };

    const handleResetClick = () => {
        showFactoryResetConfirm(handleReset);
    };

    return (
        <ScrollableContent>
            <PanelSection title="Configuration Backup">
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        icon={<FaSave size={16} />}
                        onClick={showExportModal}
                    >
                        Export Backup
                    </ButtonItem>
                </PanelSectionRow>
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        icon={<FaFileImport size={16} />}
                        onClick={showImportModal}
                    >
                        Import Backup
                    </ButtonItem>
                </PanelSectionRow>
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#888888', padding: '4px 0', textAlign: 'center' }}>
                        Save your configuration before reinstalling or moving to a new device.
                    </div>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Factory reset">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0', lineHeight: 1.5 }}>
                        Export a backup above first if you may need your alarms, timers, or settings later. This removes all alarms, timers, reminders, and Pomodoro data and restores every setting to its default.
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#888888', padding: '4px 0', fontStyle: 'italic' }}>
                        Custom sounds in ~/Music/AlarMe_Sounds are not deleted.
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        icon={<FaTrash size={16} />}
                        onClick={handleResetClick}
                        disabled={resetting || resetDone}
                    >
                        {resetting ? 'Resetting...' : resetDone ? 'Reset Complete!' : 'Factory Reset'}
                    </ButtonItem>
                </PanelSectionRow>
                {resetDone && (
                    <PanelSectionRow>
                        <div style={{ fontSize: 12, color: '#88ff88', textAlign: 'center', marginTop: 8 }}>
                            All data has been reset successfully.
                        </div>
                    </PanelSectionRow>
                )}
            </PanelSection>
        </ScrollableContent>
    );
};

// Overlay Settings Page
const OverlaySettingsPage = () => {
    const { settings, updateSetting } = useSettings();
    const isCustomPosition = settings.overlay_position === 'custom';

    // Time window options: 15m, 30m, 45m, 1h, 2h, 3h, 4h, 6h, 8h, 12h, 24h
    const timeWindowOptions = [
        { data: 0.25, label: '15 minutes' },
        { data: 0.5, label: '30 minutes' },
        { data: 0.75, label: '45 minutes' },
        { data: 1, label: '1 hour' },
        { data: 2, label: '2 hours' },
        { data: 3, label: '3 hours' },
        { data: 4, label: '4 hours' },
        { data: 6, label: '6 hours' },
        { data: 8, label: '8 hours' },
        { data: 12, label: '12 hours' },
        { data: 24, label: '24 hours' }
    ];

    const displayModeOptions = [
        { data: 'both', label: 'Steam UI + Inside Games' },
        { data: 'steam_only', label: 'Only in Steam UI' },
        { data: 'gaming_only', label: 'Only Inside Games / Apps' },
    ];

    return (
        <ScrollableContent>
            {/* Invisible focusable anchor for scroll-to-top */}
            <PanelSection>
                <PanelSectionRow>
                    <Focusable
                        onActivate={() => { }}
                        style={{
                            height: 1,
                            opacity: 0,
                            outline: 'none'
                        }}
                    >
                        <span></span>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="About Overlay">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0', lineHeight: 1.5 }}>
                        A compact bar with upcoming timers, alarms, and reminders.
                        It can render on top of the Steam UI <strong>and</strong> on top of running games or apps,
                        so you can keep an eye on your next alerts without leaving what you are doing.
                    </div>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="General">
                <PanelSectionRow>
                    <ToggleField
                        icon={<FaEye />}
                        label="Enable Overlay"
                        description="Show the alerts bar"
                        checked={settings.overlay_enabled ?? false}
                        onChange={(value) => updateSetting('overlay_enabled', value)}
                    />
                </PanelSectionRow>

                {settings.overlay_enabled && (
                    <>
                        <PanelSectionRow>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                <FaEye style={{ color: '#888', flexShrink: 0 }} />
                                <span style={{ flexShrink: 0 }}>Show On</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Dropdown
                                        rgOptions={displayModeOptions}
                                        selectedOption={settings.overlay_display_mode || 'both'}
                                        onChange={(option) => updateSetting('overlay_display_mode', option.data as any)}
                                        strDefaultLabel="Select Mode"
                                    />
                                </div>
                            </div>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <div style={{ fontSize: 11, color: '#888', padding: '0 0 4px 0', lineHeight: 1.5 }}>
                                {settings.overlay_display_mode === 'gaming_only' && (
                                    <span><strong>Only Inside Games / Apps:</strong> The bar appears on top of running games and apps. Hidden in the Steam Library, Quick Access Menu, and other Steam UI screens.</span>
                                )}
                                {settings.overlay_display_mode === 'steam_only' && (
                                    <span><strong>Only in Steam UI:</strong> The bar appears in Steam Library, Quick Access Menu, and other Steam screens. Hidden while a game or app is in foreground.</span>
                                )}
                                {(settings.overlay_display_mode === 'both' || !settings.overlay_display_mode || settings.overlay_display_mode === 'always') && (
                                    <span><strong>Steam UI + Inside Games:</strong> The bar is always visible — both on top of Steam UI screens and on top of running games and apps.</span>
                                )}
                            </div>
                        </PanelSectionRow>
                    </>
                )}
            </PanelSection>

            {settings.overlay_enabled && (
                <>
                    <PanelSection title="Position">
                        <PanelSectionRow>
                            <div style={{ fontSize: 11, color: '#9a9a9a', lineHeight: 1.5, padding: '2px 0 6px 0' }}>
                                The compact overlay stack is positioned with <strong>X</strong> and <strong>Y</strong> (pixels from the display origin; 1280×800 reference).
                                The same offsets move the full stack: upcoming alerts and, when the screensaver runs in <strong>Compact</strong> layout,
                                the optional second line (clock, date, weather, battery) from the Screensaver tab.
                            </div>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaCog />}
                                label="Custom Position"
                                description="Set pixel offsets from the display origin (1280×800 reference). Turn off to reset to the default corner."
                                checked={isCustomPosition}
                                onChange={(value) => updateSetting('overlay_position', value ? 'custom' : 'default')}
                            />
                        </PanelSectionRow>

                        {isCustomPosition && (
                            <>
                                <PanelSectionRow>
                                    <OverlayPositionPreview settings={settings} />
                                </PanelSectionRow>

                                <PanelSectionRow>
                                    <SliderField
                                        label="X Position"
                                        description={`${settings.overlay_custom_x ?? 12}px from left`}
                                        value={settings.overlay_custom_x ?? 12}
                                        min={0}
                                        max={1200}
                                        step={1}
                                        onChange={(value) => updateSetting('overlay_custom_x', value)}
                                        icon={<FaCog />}
                                    />
                                </PanelSectionRow>

                                <PanelSectionRow>
                                    <SliderField
                                        label="Y Position"
                                        description={`${settings.overlay_custom_y ?? 12}px from top`}
                                        value={settings.overlay_custom_y ?? 12}
                                        min={0}
                                        max={720}
                                        step={1}
                                        onChange={(value) => updateSetting('overlay_custom_y', value)}
                                        icon={<FaCog />}
                                    />
                                </PanelSectionRow>
                            </>
                        )}
                    </PanelSection>

                    <PanelSection title="Appearance">
                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaEye />}
                                label="Compact Mode"
                                description="Hide text labels and only show icons to save space"
                                checked={settings.overlay_compact_mode ?? false}
                                onChange={(value) => updateSetting('overlay_compact_mode', value)}
                            />
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <SliderField
                                label="Text Size"
                                description={`${settings.overlay_text_size ?? 11}px`}
                                value={settings.overlay_text_size ?? 11}
                                min={11}
                                max={16}
                                step={1}
                                onChange={(value) => updateSetting('overlay_text_size', value)}
                                icon={<FaCog />}
                            />
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <SliderField
                                label="Opacity"
                                description={`${Math.round((settings.overlay_opacity ?? 0.6) * 100)}%`}
                                value={Math.round((settings.overlay_opacity ?? 0.6) * 100)}
                                min={10}
                                max={100}
                                step={5}
                                onChange={(value) => updateSetting('overlay_opacity', value / 100)}
                                icon={<FaEye />}
                            />
                        </PanelSectionRow>
                    </PanelSection>

                    <PanelSection title="Content">
                        <PanelSectionRow>
                            <SliderField
                                label="Max Alerts Shown"
                                description={`${settings.overlay_max_alerts ?? 3} alert${(settings.overlay_max_alerts ?? 3) !== 1 ? 's' : ''}`}
                                value={settings.overlay_max_alerts ?? 3}
                                min={1}
                                max={5}
                                step={1}
                                onChange={(value) => updateSetting('overlay_max_alerts', value)}
                                icon={<FaBell />}
                            />
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                <FaClock style={{ color: '#888', flexShrink: 0 }} />
                                <span style={{ flexShrink: 0 }}>Time Window</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Dropdown
                                        rgOptions={timeWindowOptions}
                                        selectedOption={settings.overlay_time_window ?? 6}
                                        onChange={(option) => updateSetting('overlay_time_window', option.data as number)}
                                        strDefaultLabel="Select Window"
                                    />
                                </div>
                            </div>
                        </PanelSectionRow>
                    </PanelSection>

                    <PanelSection title="Categories">
                        <div style={{ padding: '0 16px 12px 16px', fontSize: 12, color: '#aaaaaa' }}>
                            Items with "Prevent Sleep" active will always bypass these settings and show in the overlay. Alerts in overlay are ordered by their due time (next alert first).
                        </div>
                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaHourglassHalf size={16} />}
                                label="Timers"
                                description="Show active timer countdowns"
                                checked={settings.overlay_show_timers ?? true}
                                onChange={(value) => updateSetting('overlay_show_timers', value)}
                            />
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaHistory />}
                                label="Stopwatch"
                                description="Show running stopwatch elapsed time. Stopwatch has priority over other alerts."
                                checked={settings.overlay_show_stopwatch ?? true}
                                onChange={(value) => updateSetting('overlay_show_stopwatch', value)}
                            />
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaBell />}
                                label="Alarms"
                                description="Show upcoming alarms"
                                checked={settings.overlay_show_alarms ?? true}
                                onChange={(value) => updateSetting('overlay_show_alarms', value)}
                            />
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaBrain />}
                                label="Pomodoro"
                                description="Show active focus/break countdown"
                                checked={settings.overlay_show_pomodoros ?? true}
                                onChange={(value) => updateSetting('overlay_show_pomodoros', value)}
                            />
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaRedo size={16} />}
                                label="Reminders"
                                description="Show next periodic reminders"
                                checked={settings.overlay_show_reminders ?? true}
                                onChange={(value) => updateSetting('overlay_show_reminders', value)}
                            />
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaShieldAlt size={16} />}
                                label="Prevent Sleep Badge"
                                description="Show a shield icon when the device is being prevented from sleeping"
                                checked={settings.overlay_show_prevent_sleep_badge ?? true}
                                onChange={(value) => updateSetting('overlay_show_prevent_sleep_badge', value)}
                            />
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaBellSlash size={16} />}
                                label="Missed Alerts Badge"
                                description="Show a red dot when there are unread missed alerts"
                                checked={settings.overlay_show_missed_badge ?? true}
                                onChange={(value) => updateSetting('overlay_show_missed_badge', value)}
                            />
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <div style={{ fontSize: 11, color: '#888', padding: '4px 0', lineHeight: 1.4 }}>
                                <strong>🛡️ Note:</strong> Alerts that are actively preventing sleep will always appear in the overlay, regardless of category filters. They are prioritized at the top of the list.
                            </div>
                        </PanelSectionRow>
                    </PanelSection>
                </>
            )}
        </ScrollableContent>
    );
};

// Settings route constant
export const SETTINGS_ROUTE = '/alarme/settings';

// Settings Page Component - exported for route registration
export const SettingsPage = () => {
    // Force the Steam UI surface to render fully on top of any running game.
    // Without this the routed page can open behind the active gamescope window
    // because Steam's default composition state stays at Hidden when a game
    // is in foreground and only the QAM is opened.
    useUIComposition(UIComposition.Opaque);

    const pages = [
        {
            title: "General",
            icon: <FaCog size={16} />,
            content: <GeneralSettingsPage />
        },
        {
            title: "Timers",
            icon: <FaHourglassHalf size={16} />,
            content: <TimerSettingsPage />
        },
        {
            title: "Alarms",
            icon: <FaBell size={16} />,
            content: <AlarmSettingsPage />
        },
        {
            title: "Reminders",
            icon: <FaRedo size={16} />,
            content: <ReminderSettingsPage />
        },
        {
            title: "Pomodoro",
            icon: <FaBrain size={16} />,
            content: <PomodoroSettingsPage />
        },
        {
            title: "Overlay",
            icon: <FaEye size={16} />,
            content: <OverlaySettingsPage />
        },
        {
            title: "Screensaver",
            icon: <FaDesktop size={16} />,
            content: <ScreensaverSettingsPage />
        },
        {
            title: "News",
            icon: <FaNewspaper size={16} />,
            content: <SettingsNewsPage />
        },
        {
            title: "Backup",
            icon: <FaDatabase size={16} />,
            content: <BackupSettingsPage />
        },
        {
            title: "About",
            icon: <FaInfoCircle size={16} />,
            content: <AboutInstructionsPage getVersionCall={getVersionCall} />
        }
    ];

    return (
        <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#0e141b'
        }}>
            <SidebarNavigation pages={pages} />
        </div>
    );
};

// Navigate to settings page (closes QAM first)
export function navigateToSettings() {
    Navigation.CloseSideMenus();
    Navigation.Navigate(SETTINGS_ROUTE);
}

