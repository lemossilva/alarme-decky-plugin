import {
    Dropdown,
    PanelSection,
    PanelSectionRow,
    SliderField,
    ToggleField
} from "@decky/ui";
import { FaVolumeUp, FaBell, FaClock, FaBrain, FaCoffee, FaMusic } from "react-icons/fa";
import { useEffect, useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { useAlarms } from "../hooks/useAlarms";
import type { SoundFile } from "../types";

export function SettingsPanel() {
    const { settings, updateSetting } = useSettings();
    const { getSounds } = useAlarms();
    const [sounds, setSounds] = useState<SoundFile[]>([{ filename: 'alarm.mp3', name: 'Alarm' }]);

    // Load available sounds on mount
    useEffect(() => {
        getSounds().then(setSounds);
    }, [getSounds]);

    return (
        <div>
            {/* Notification Settings */}
            <PanelSection title="Notifications">
                <PanelSectionRow>
                    <ToggleField
                        icon={<FaBell />}
                        label="Subtle Mode"
                        description="Show a small toast instead of fullscreen popup"
                        checked={settings.subtle_mode}
                        onChange={(value) => updateSetting('subtle_mode', value)}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <ToggleField
                        icon={<FaClock />}
                        label="Auto-Suspend"
                        description="Automatically suspend when timer/alarm triggers"
                        checked={settings.auto_suspend}
                        onChange={(value) => updateSetting('auto_suspend', value)}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Snooze Duration"
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
                    <SliderField
                        label="Alarm Volume"
                        description={`${settings.alarm_volume}%`}
                        value={settings.alarm_volume}
                        min={0}
                        max={100}
                        step={5}
                        onChange={(value) => updateSetting('alarm_volume', value)}
                        icon={<FaVolumeUp />}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <FaMusic style={{ color: '#888' }} />
                        <span style={{ flex: 1 }}>Timer Sound</span>
                        <Dropdown
                            rgOptions={sounds.map(s => ({ data: s.filename, label: s.name }))}
                            selectedOption={settings.timer_sound || 'alarm.mp3'}
                            onChange={(option) => updateSetting('timer_sound', option.data as string)}
                            strDefaultLabel="Select Sound"
                        />
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <FaMusic style={{ color: '#888' }} />
                        <span style={{ flex: 1 }}>Pomodoro Sound</span>
                        <Dropdown
                            rgOptions={sounds.map(s => ({ data: s.filename, label: s.name }))}
                            selectedOption={settings.pomodoro_sound || 'alarm.mp3'}
                            onChange={(option) => updateSetting('pomodoro_sound', option.data as string)}
                            strDefaultLabel="Select Sound"
                        />
                    </div>
                </PanelSectionRow>
            </PanelSection>

            {/* Time Format */}
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

            {/* Pomodoro Settings */}
            <PanelSection title="Pomodoro Settings">
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

            {/* About */}
            <PanelSection title="About">
                <PanelSectionRow>
                    <div style={{ fontSize: 13, color: '#888888', textAlign: 'center' }}>
                        <p style={{ marginBottom: 8 }}>
                            <strong>Alar.me</strong> v1.0.0
                        </p>
                        <p>
                            By Guilherme Lemos
                        </p>
                    </div>
                </PanelSectionRow>
            </PanelSection>
        </div>
    );
}
