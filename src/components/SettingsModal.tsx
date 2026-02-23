import {
    ButtonItem,
    ConfirmModal,
    Dropdown,
    Focusable,
    Navigation,
    PanelSection,
    PanelSectionRow,
    showModal,
    SidebarNavigation,
    SliderField,
    ToggleField
} from "@decky/ui";
import { callable } from "@decky/api";
import { FaVolumeUp, FaBell, FaClock, FaBrain, FaCoffee, FaPlay, FaPause, FaStopwatch, FaSave, FaFileImport, FaBullseye, FaMusic, FaTrash, FaCog, FaDatabase, FaEye, FaGamepad, FaHourglassHalf, FaHistory, FaBellSlash, FaStar } from "react-icons/fa";
import { useEffect, useState, useRef } from "react";
import { useSettings } from "../hooks/useSettings";
import { useAlarms } from "../hooks/useAlarms";
import { playAlarmSound } from "../utils/sounds";
import { showExportModal, showImportModal } from "./BackupModals";
import type { SoundFile } from "../types";

// Backend callable for factory reset
const factoryResetCall = callable<[], boolean>('factory_reset');

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
const BinarySelector = ({
    label,
    description,
    leftOption,
    rightOption,
    value,
    onChange,
    icon
}: {
    label: string,
    description?: string,
    leftOption: { value: any, label: string },
    rightOption: { value: any, label: string },
    value: any,
    onChange: (value: any) => void,
    icon?: React.ReactNode
}) => {
    const [focusedLeft, setFocusedLeft] = useState(false);
    const [focusedRight, setFocusedRight] = useState(false);

    return (
        <PanelSectionRow>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                justifyContent: 'space-between',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 auto', minWidth: '150px' }}>
                    {icon && <div style={{ color: '#888', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</div>}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{label}</span>
                        {description && <span style={{ fontSize: 12, color: '#888' }}>{description}</span>}
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    backgroundColor: '#1a1f2c',
                    borderRadius: 20,
                    padding: 4,
                    gap: 4,
                    flex: '0 0 auto'
                }}>
                    <Focusable
                        onActivate={() => onChange(leftOption.value)}
                        onFocus={() => setFocusedLeft(true)}
                        onBlur={() => setFocusedLeft(false)}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 16,
                            backgroundColor: value === leftOption.value ? '#1a9fff' : (focusedLeft ? '#ffffff22' : 'transparent'),
                            color: value === leftOption.value ? 'white' : '#888',
                            fontSize: 12,
                            fontWeight: 600,
                            textAlign: 'center',
                            minWidth: 60,
                            transition: 'all 0.2s ease',
                            border: focusedLeft ? '1px solid white' : '1px solid transparent'
                        }}
                    >
                        {leftOption.label}
                    </Focusable>
                    <Focusable
                        onActivate={() => onChange(rightOption.value)}
                        onFocus={() => setFocusedRight(true)}
                        onBlur={() => setFocusedRight(false)}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 16,
                            backgroundColor: value === rightOption.value ? '#1a9fff' : (focusedRight ? '#ffffff22' : 'transparent'),
                            color: value === rightOption.value ? 'white' : '#888',
                            fontSize: 12,
                            fontWeight: 600,
                            textAlign: 'center',
                            minWidth: 60,
                            transition: 'all 0.2s ease',
                            border: focusedRight ? '1px solid white' : '1px solid transparent'
                        }}
                    >
                        {rightOption.label}
                    </Focusable>
                </div>
            </div>
        </PanelSectionRow>
    );
};

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <FaStopwatch style={{ color: '#888', flexShrink: 0 }} />
                        <span style={{ flexShrink: 0 }}>Sound</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Dropdown
                                rgOptions={sounds.map(s => ({ data: s.filename, label: s.name }))}
                                selectedOption={settings.timer_sound || 'alarm.mp3'}
                                onChange={(option) => updateSetting('timer_sound', option.data as string)}
                                strDefaultLabel="Select Sound"
                            />
                        </div>
                        <SoundPreviewButton soundFile={settings.timer_sound || 'alarm.mp3'} onPlayCustom={playCustomSound} />
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Volume"
                        description={`${settings.timer_volume ?? 100}%`}
                        value={settings.timer_volume ?? 100}
                        min={0}
                        max={100}
                        step={5}
                        onChange={(value) => updateSetting('timer_volume', value)}
                        icon={<FaVolumeUp />}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <ToggleField
                        icon={<FaStar />}
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
                                icon={<FaClock />}
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
                        icon={<FaBell />}
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
                    onChange={(val) => updateSetting('reminder_suspend_behavior', val)}
                    icon={<FaStopwatch />}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
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
                        <SoundPreviewButton soundFile={settings.pomodoro_sound || 'alarm.mp3'} onPlayCustom={playCustomSound} />
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Volume"
                        description={`${settings.pomodoro_volume ?? 100}%`}
                        value={settings.pomodoro_volume ?? 100}
                        min={0}
                        max={100}
                        step={5}
                        onChange={(value) => updateSetting('pomodoro_volume', value)}
                        icon={<FaVolumeUp />}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Work Duration"
                        description={`${settings.pomodoro_work_duration} minutes`}
                        value={settings.pomodoro_work_duration}
                        min={15}
                        max={60}
                        step={5}
                        onChange={(value) => updateSetting('pomodoro_work_duration', value)}
                        icon={<FaBrain />}
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
                        icon={<FaCoffee />}
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
                        icon={<FaCoffee />}
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
                        icon={<FaClock />}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <ToggleField
                        icon={<FaBullseye />}
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
                            icon={<FaClock />}
                        />
                    </PanelSectionRow>
                )}

                <BinarySelector
                    label="Behavior while Suspended"
                    description="What happens when device is sleeping"
                    leftOption={{ value: 'pause', label: 'Shift (Pause)' }}
                    rightOption={{ value: 'continue', label: 'Miss (Continue)' }}
                    value={settings.pomodoro_suspend_behavior || 'continue'}
                    onChange={(val) => updateSetting('pomodoro_suspend_behavior', val)}
                    icon={<FaBrain />}
                />
            </PanelSection>
        </ScrollableContent>
    );
};

// Display Settings Page
const DisplaySettingsPage = () => {
    const { settings, updateSetting } = useSettings();

    return (
        <ScrollableContent>
            <PanelSection>
                <PanelSectionRow>
                    <ToggleField
                        icon={<FaClock />}
                        label="24-Hour Format"
                        description="Use 24-hour time format (e.g., 14:30 instead of 2:30 PM)"
                        checked={settings.time_format_24h}
                        onChange={(value) => updateSetting('time_format_24h', value)}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                        <ToggleField
                            icon={<FaGamepad />}
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
                                    icon={<FaHourglassHalf />}
                                />
                            </div>
                        )}
                </PanelSectionRow>

                <PanelSectionRow>
                        <ToggleField
                            icon={<FaBellSlash />}
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
                                    icon={<FaHistory />}
                                />
                            </div>
                        )}
                </PanelSectionRow>

            </PanelSection>
        </ScrollableContent>
    );
};

// Backup Settings Page
const BackupSettingsPage = () => {
    const { importCustomSounds } = useAlarms();
    const [importStatus, setImportStatus] = useState<{ message: string; success: boolean } | null>(null);

    return (
        <ScrollableContent>
            <PanelSection title="Configuration Backup">
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        icon={<FaSave />}
                        onClick={showExportModal}
                    >
                        Export Backup
                    </ButtonItem>
                </PanelSectionRow>
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        icon={<FaFileImport />}
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
                    </ButtonItem>
                </PanelSectionRow>
                {importStatus && (
                    <PanelSectionRow>
                        <div style={{
                            fontSize: 13,
                            color: importStatus.success ? '#88ff88' : '#ff8888',
                            textAlign: 'center',
                            marginTop: 4,
                            width: '100%'
                        }}>
                            {importStatus.message}
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
        { data: 'always', label: 'Always' },
        { data: 'gaming_only', label: 'Only While Gaming' }
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
                        The overlay displays upcoming timers, alarms, and reminders in a compact bar.
                        It appears in <strong>SteamOS windows</strong> (Steam Menu, QAM, Library, etc.) but <strong>not inside games</strong>.
                        Use it to quickly check your next alerts without opening the plugin.
                    </div>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="General">
                <PanelSectionRow>
                    <ToggleField
                        icon={<FaEye />}
                        label="Enable Overlay"
                        description="Show upcoming alerts in SteamOS windows"
                        checked={settings.overlay_enabled ?? false}
                        onChange={(value) => updateSetting('overlay_enabled', value)}
                    />
                </PanelSectionRow>

                {settings.overlay_enabled && (
                    <>
                        <PanelSectionRow>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                <FaCog style={{ color: '#888', flexShrink: 0 }} />
                                <span style={{ flexShrink: 0 }}>Show When</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Dropdown
                                        rgOptions={displayModeOptions}
                                        selectedOption={settings.overlay_display_mode || 'always'}
                                        onChange={(option) => updateSetting('overlay_display_mode', option.data as any)}
                                        strDefaultLabel="Select Mode"
                                    />
                                </div>
                            </div>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <div style={{ fontSize: 11, color: '#666', padding: '0 0 4px 0', lineHeight: 1.4 }}>
                                {settings.overlay_display_mode === 'gaming_only' ? (
                                    <span><strong>Only While Gaming:</strong> Overlay only appears when a game or app is running. Useful if you only want to track time during gaming sessions.</span>
                                ) : (
                                    <span><strong>Always:</strong> Overlay is always visible in SteamOS windows, whether or not a game is running.</span>
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
                        <PanelSectionRow>
                            <ToggleField
                                icon={<FaStopwatch />}
                                label="Timers"
                                description="Show active timer countdowns"
                                checked={settings.overlay_show_timers ?? true}
                                onChange={(value) => updateSetting('overlay_show_timers', value)}
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
                                icon={<FaClock />}
                                label="Reminders"
                                description="Show next periodic reminders"
                                checked={settings.overlay_show_reminders ?? true}
                                onChange={(value) => updateSetting('overlay_show_reminders', value)}
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
                        icon={<FaTrash />}
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
                                <strong>AlarMe</strong> v1.5.3
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
    const pages = [
        {
            title: "Timers",
            icon: <FaStopwatch />,
            content: <TimerSettingsPage />
        },
        {
            title: "Alarms",
            icon: <FaBell />,
            content: <AlarmSettingsPage />
        },
        {
            title: "Reminders",
            icon: <FaClock />,
            content: <ReminderSettingsPage />
        },
        {
            title: "Pomodoro",
            icon: <FaBrain />,
            content: <PomodoroSettingsPage />
        },
        {
            title: "Display",
            icon: <FaCog />,
            content: <DisplaySettingsPage />
        },
        {
            title: "Overlay",
            icon: <FaEye />,
            content: <OverlaySettingsPage />
        },
        {
            title: "Backup",
            icon: <FaDatabase />,
            content: <BackupSettingsPage />
        },
        {
            title: "Factory Reset",
            icon: <FaTrash />,
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
