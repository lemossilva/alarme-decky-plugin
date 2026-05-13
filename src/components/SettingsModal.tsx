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
import { addEventListener, callable, removeEventListener } from "@decky/api";
import { FaVolumeUp, FaBell, FaClock, FaBrain, FaCoffee, FaPlay, FaPause, FaHourglassHalf, FaSave, FaFileImport, FaBullseye, FaMusic, FaTrash, FaCog, FaDatabase, FaEye, FaGamepad, FaHistory, FaBellSlash, FaStar, FaRedo, FaStopwatch, FaShieldAlt, FaDesktop, FaCalendarAlt, FaBatteryFull, FaPhotoVideo, FaCloud } from "react-icons/fa";
import { useEffect, useState, useRef } from "react";
import { useSettings } from "../hooks/useSettings";
import { triggerScreensaverPreviewAfterClosingMenus } from "../hooks/useScreensaver";
import { useUIComposition, UIComposition } from "../utils/uiComposition";
import { useAlarms } from "../hooks/useAlarms";
import { playAlarmSound } from "../utils/sounds";
import { showExportModal, showImportModal } from "./BackupModals";
import { BinarySelector } from "./BinarySelector";
import type { SoundFile, ScreensaverLayout, ClockStyle, AccentColorPreset, WallpaperProvider, WallpaperFit, WallpaperBlur } from "../types";
import { WALLPAPER_POOL_MAX, clampWallpaperPoolSize } from "../hooks/useWallpaper";
import { WeatherLocationPicker } from "./screensaver/WeatherLocationPicker";

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

// Screensaver Settings Page
const ScreensaverSettingsPage = () => {
    const { settings, updateSetting } = useSettings();
    const mode = settings.screensaver_mode ?? 'off';

    const [wallpaperStatus, setWallpaperStatus] = useState<{ reachable: boolean | null; message?: string }>({ reachable: null });
    const [wallpaperPaths, setWallpaperPaths] = useState<{
        runtime_dir: string;
        wallpaper_cache_dir: string;
        local_wallpapers_dir: string;
    } | null>(null);
    const [prefetchProgress, setPrefetchProgress] = useState<{ step: number; total: number } | null>(null);
    const [prefetchBusy, setPrefetchBusy] = useState(false);

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
        { data: 'off' as const, label: 'Off' },
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
        { data: 'compact', label: 'Compact (Top-Left)' },
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

    return (
        <ScrollableContent>
            {/* === Mode === */}
            <PanelSection title="Screensaver Mode">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0', lineHeight: 1.5 }}>
                        Choose the background behavior when the screensaver activates.
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
                        {mode === 'off' && 'Screensaver is disabled.'}
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

            {mode !== 'off' && (
                <>
                    {/* === Activation === */}
                    <PanelSection title="Activation">
                        <PanelSectionRow>
                            <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0', lineHeight: 1.5 }}>
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
                            <div style={{ fontSize: 11, color: '#666', padding: '0 0 4px 0' }}>
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
                                        onChange={(option) => updateSetting('overlay_screensaver_layout', option.data as ScreensaverLayout)}
                                        strDefaultLabel="Select Layout"
                                    />
                                </div>
                            </div>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <div style={{ fontSize: 11, color: '#666', padding: '0 0 4px 0' }}>
                                {(settings.overlay_screensaver_layout || 'compact') === 'compact' && 'Compact keeps a minimal top-left overlay with existing behavior.'}
                                {(settings.overlay_screensaver_layout || 'compact') === 'large' && 'Large keeps the clock/date centered in a stable card with grouped widgets beneath it. With OLED burn-in protection on, this layout also drifts.'}
                                {(settings.overlay_screensaver_layout || 'compact') === 'fullscreen' && 'Fullscreen uses centered content without a card and gives grouped widgets more horizontal room. With OLED burn-in protection on, content drifts too.'}
                            </div>
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <SliderField
                                label="Clock Size"
                                description={`${settings.screensaver_clock_size ?? 20}px`}
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

                    {/* === Widgets === */}
                    <PanelSection title="Widgets">
                        <PanelSectionRow>
                            <div style={{ fontSize: 11, color: '#666', padding: '4px 0' }}>
                                Widgets shown on the screensaver (Large/Fullscreen/Floating layouts only).
                            </div>
                        </PanelSectionRow>

                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaEye size={16} />}
                                label="Show Overlay During"
                                description="Keep alert bar visible above screensaver"
                                checked={settings.overlay_during_screensaver ?? true}
                                onChange={(value) => updateSetting('overlay_during_screensaver', value)}
                            />
                        </PanelSectionRow>

                        {(settings.overlay_during_screensaver ?? true) && (
                            <>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaClock size={16} />}
                                        label="Show Clock Widget"
                                        checked={settings.overlay_screensaver_show_clock ?? true}
                                        onChange={(value) => updateSetting('overlay_screensaver_show_clock', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaCalendarAlt size={16} />}
                                        label="Show Date Widget"
                                        checked={settings.overlay_screensaver_show_date ?? true}
                                        onChange={(value) => updateSetting('overlay_screensaver_show_date', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaCalendarAlt size={16} />}
                                        label="Show Day of Week"
                                        checked={settings.screensaver_show_day_of_week ?? true}
                                        onChange={(value) => updateSetting('screensaver_show_day_of_week', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaCalendarAlt size={16} />}
                                        label="Show Year"
                                        checked={settings.screensaver_show_year ?? false}
                                        onChange={(value) => updateSetting('screensaver_show_year', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaCalendarAlt size={16} />}
                                        label="Show Calendar Grid"
                                        description="Mini monthly calendar (large/fullscreen layouts)"
                                        checked={settings.screensaver_show_calendar_grid ?? false}
                                        onChange={(value) => updateSetting('screensaver_show_calendar_grid', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaBatteryFull size={16} />}
                                        label="Show Battery Widget"
                                        checked={settings.overlay_screensaver_show_battery ?? true}
                                        onChange={(value) => updateSetting('overlay_screensaver_show_battery', value)}
                                    />
                                </PanelSectionRow>
                                {settings.overlay_screensaver_show_battery && (
                                    <>
                                        <PanelSectionRow>
                                            <div style={{ paddingLeft: '40px' }}>
                                                <ToggleField
                                                    icon={<FaBatteryFull size={16} />}
                                                    label="Show Battery Bar"
                                                    checked={settings.screensaver_battery_show_bar ?? false}
                                                    onChange={(value) => updateSetting('screensaver_battery_show_bar', value)}
                                                />
                                            </div>
                                        </PanelSectionRow>
                                        <PanelSectionRow>
                                            <div style={{ paddingLeft: '40px' }}>
                                                <SliderField
                                                    label="Low Battery Threshold"
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
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaBell size={16} />}
                                        label="Show Alerts List"
                                        description="Active alerts as cards (large/fullscreen)"
                                        checked={settings.screensaver_show_alerts_list ?? true}
                                        onChange={(value) => updateSetting('screensaver_show_alerts_list', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaDesktop size={16} />}
                                        label="Show System Stats"
                                        description="CPU temp, RAM usage, fan speed"
                                        checked={settings.screensaver_show_system_stats ?? false}
                                        onChange={(value) => updateSetting('screensaver_show_system_stats', value)}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <ToggleField
                                        icon={<FaDesktop size={16} />}
                                        label="Show Network Info"
                                        description="Wi-Fi SSID and signal strength"
                                        checked={settings.screensaver_show_network_info ?? false}
                                        onChange={(value) => updateSetting('screensaver_show_network_info', value)}
                                    />
                                </PanelSectionRow>
                            </>
                        )}
                    </PanelSection>

                    <PanelSection title="Weather">
                        <PanelSectionRow>
                            <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0', lineHeight: 1.5 }}>
                                Forecasts powered by Open-Meteo. Free, no account required.
                            </div>
                        </PanelSectionRow>
                        {(settings.screensaver_weather_lat != null &&
                            settings.screensaver_weather_lon != null &&
                            (settings.screensaver_weather_city_name || '').trim().length > 0) && (
                            <PanelSectionRow>
                                <div style={{ fontSize: 12, color: '#888', lineHeight: 1.45 }}>
                                    Saved forecast location:{' '}
                                    <span style={{ color: '#ccc' }}>{settings.screensaver_weather_city_name}</span>
                                    {settings.screensaver_weather_location_source === 'ip' ? (
                                        <span style={{ color: '#777' }}> (IP geolocation)</span>
                                    ) : null}
                                </div>
                            </PanelSectionRow>
                        )}
                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaCloud size={16} />}
                                label="Show weather on screensaver"
                                description="Large and fullscreen layouts show a weather card; compact overlay shows a short inline readout when the screensaver is active."
                                checked={settings.screensaver_show_weather ?? false}
                                onChange={(value) => updateSetting('screensaver_show_weather', value)}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
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
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaCloud size={16} />}
                                label="Show daily high / low"
                                checked={settings.screensaver_weather_show_highlow ?? true}
                                onChange={(value) => updateSetting('screensaver_weather_show_highlow', value)}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaCloud size={16} />}
                                label="Show condition label"
                                checked={settings.screensaver_weather_show_condition ?? true}
                                onChange={(value) => updateSetting('screensaver_weather_show_condition', value)}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
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
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <WeatherLocationPicker />
                        </PanelSectionRow>
                    </PanelSection>

                    {/* === OLED Protection === */}
                    <PanelSection title="OLED Protection">
                        <PanelSectionRow>
                            <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0', lineHeight: 1.5 }}>
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
                            <div style={{ fontSize: 12, color: '#aaaaaa', padding: '4px 0' }}>
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
                </>
            )}
        </ScrollableContent>
    );
};

// Backup Settings Page
const BackupSettingsPage = () => {
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
                            <ToggleField
                                icon={<FaCog />}
                                label="Custom Position"
                                description="Fine-tune the overlay position with X/Y offsets"
                                checked={isCustomPosition}
                                onChange={(value) => updateSetting('overlay_position', value ? 'custom' : 'default')}
                            />
                        </PanelSectionRow>

                        {isCustomPosition && (
                            <>
                                {/* Position Preview - shows overlay position on a mini screen mockup */}
                                <PanelSectionRow>
                                    <div style={{
                                        position: 'relative',
                                        width: '100%',
                                        height: 100,
                                        backgroundColor: '#1a1a2e',
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                        border: '1px solid #333'
                                    }}>
                                        {/* Mini overlay preview positioned proportionally */}
                                        <div style={{
                                            position: 'absolute',
                                            left: `${Math.min(Math.max((settings.overlay_custom_x ?? 12) / 12.8, 0), 85)}%`,
                                            top: `${Math.min(Math.max((settings.overlay_custom_y ?? 12) / 8, 0), 75)}%`,
                                            backgroundColor: '#00000088',
                                            padding: '3px 6px',
                                            borderRadius: 4,
                                            fontSize: 9,
                                            color: '#8b8b8b',
                                            whiteSpace: 'nowrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            border: '1px dashed #4488aa'
                                        }}>
                                            <FaStopwatch size={8} />
                                            <span>5:00</span>
                                            <span style={{ opacity: 0.4 }}>•</span>
                                            <FaBell size={8} />
                                            <span>8:30</span>
                                        </div>
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 4,
                                            right: 8,
                                            fontSize: 8,
                                            color: '#555'
                                        }}>
                                            X: {settings.overlay_custom_x ?? 12}px, Y: {settings.overlay_custom_y ?? 12}px
                                        </div>
                                    </div>
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

// Factory Reset Confirmation Modal
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

// Factory Reset Page
const FactoryResetPage = () => {
    const [resetting, setResetting] = useState(false);
    const [resetDone, setResetDone] = useState(false);
    const [version, setVersion] = useState('');

    useEffect(() => {
        getVersionCall()
            .then((v) => setVersion((v || '').trim()))
            .catch(() => setVersion(''));
    }, []);

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
            <PanelSection>
                <PanelSectionRow>
                    <div style={{ fontSize: 13, color: '#cccccc', padding: '8px 0' }}>
                        Reset all settings to defaults and delete all data including alarms, timers, reminders, and Pomodoro sessions.
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#888888', padding: '4px 0', fontStyle: 'italic' }}>
                        Note: Custom sounds in ~/Music/AlarMe_Sounds will not be deleted.
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

            <PanelSection title="About">
                <PanelSectionRow>
                    <Focusable style={{ width: '100%' }}>
                        <div style={{ fontSize: 13, color: '#888888', textAlign: 'center' }}>
                            <p style={{ marginBottom: 8 }}>
                                <strong>AlarMe</strong> {version ? `v${version}` : '…'}
                            </p>
                            <p>
                                By Guilherme Lemos
                            </p>
                        </div>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>
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
            title: "Backup",
            icon: <FaDatabase size={16} />,
            content: <BackupSettingsPage />
        },
        {
            title: "Reset & About",
            icon: <FaTrash size={16} />,
            content: <FactoryResetPage />
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

