import {
    Dropdown,
    Focusable,
    PanelSection,
    PanelSectionRow,
    SliderField,
    ToggleField
} from "@decky/ui";
import { FaVolumeUp, FaBell, FaClock, FaBrain, FaCoffee, FaPlay, FaPause, FaStopwatch } from "react-icons/fa";
import { useEffect, useState, useRef } from "react";
import { useSettings } from "../hooks/useSettings";
import { useAlarms } from "../hooks/useAlarms";
import { playAlarmSound, stopSound } from "../utils/sounds";
import type { SoundFile } from "../types";

// Reusable sound preview button component
const SoundPreviewButton = ({ soundFile }: { soundFile: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [focused, setFocused] = useState(false);

    const handleToggle = () => {
        if (isPlaying && audioRef.current) {
            stopSound(audioRef.current);
            audioRef.current = null;
            setIsPlaying(false);
        } else {
            // Stop any previous sound first
            if (audioRef.current) {
                stopSound(audioRef.current);
            }
            audioRef.current = playAlarmSound(soundFile);
            if (audioRef.current) {
                setIsPlaying(true);
                audioRef.current.onended = () => {
                    setIsPlaying(false);
                    audioRef.current = null;
                };
            }
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                stopSound(audioRef.current);
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

export function SettingsPanel() {
    const { settings, updateSetting } = useSettings();
    const { getSounds } = useAlarms();
    const [sounds, setSounds] = useState<SoundFile[]>([{ filename: 'alarm.mp3', name: 'Alarm' }]);

    // Load available sounds on mount only
    useEffect(() => {
        getSounds().then(setSounds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div>
            {/* Timer Settings */}
            <PanelSection title="Timer Settings">
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
                        <SoundPreviewButton soundFile={settings.timer_sound || 'alarm.mp3'} />
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
                        icon={<FaBell />}
                        label="Subtle Mode"
                        description={settings.timer_auto_suspend
                            ? "Required when Auto-Suspend is enabled"
                            : "Show a small toast instead of fullscreen popup"}
                        checked={settings.timer_auto_suspend ? true : (settings.timer_subtle_mode ?? false)}
                        disabled={settings.timer_auto_suspend}
                        onChange={(value) => updateSetting('timer_subtle_mode', value)}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <ToggleField
                        icon={<FaClock />}
                        label="Auto-Suspend"
                        description="Suspend device when timer finishes (enables Subtle Mode)"
                        checked={settings.timer_auto_suspend ?? false}
                        onChange={(value) => {
                            updateSetting('timer_auto_suspend', value);
                            // Auto-enable subtle mode when enabling auto-suspend
                            if (value) {
                                updateSetting('timer_subtle_mode', true);
                            }
                        }}
                    />
                </PanelSectionRow>
            </PanelSection>

            {/* Pomodoro Settings */}
            <PanelSection title="Pomodoro Settings">
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
                        <SoundPreviewButton soundFile={settings.pomodoro_sound || 'alarm.mp3'} />
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
                    <ToggleField
                        icon={<FaBell />}
                        label="Subtle Mode"
                        description="Show a small toast instead of fullscreen popup"
                        checked={settings.pomodoro_subtle_mode ?? false}
                        onChange={(value) => updateSetting('pomodoro_subtle_mode', value)}
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
            </PanelSection>

            {/* Alarm Defaults */}
            <PanelSection title="Alarm Defaults">
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

            {/* Display Settings */}
            <PanelSection title="Display">
                <PanelSectionRow>
                    <ToggleField
                        icon={<FaClock />}
                        label="24-Hour Format"
                        description="Use 24-hour time format (e.g., 14:30 instead of 2:30 PM)"
                        checked={settings.time_format_24h}
                        onChange={(value) => updateSetting('time_format_24h', value)}
                    />
                </PanelSectionRow>
            </PanelSection>

            {/* About */}
            <PanelSection title="About">
                <PanelSectionRow>
                    <Focusable style={{ width: '100%' }}>
                        <div style={{ fontSize: 13, color: '#888888', textAlign: 'center' }}>
                            <p style={{ marginBottom: 8 }}>
                                <strong>Alar.me</strong> v1.0.0
                            </p>
                            <p>
                                By Guilherme Lemos
                            </p>
                        </div>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>
        </div>
    );
}
