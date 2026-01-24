import {
    ButtonItem,
    Focusable,
    PanelSection,
    PanelSectionRow,
    TextField
} from "@decky/ui";
import { FaPlus, FaMinus, FaTimes, FaPlay } from "react-icons/fa";
import { useState } from "react";
import { useTimers } from "../hooks/useTimers";
import { useSettings } from "../hooks/useSettings";
import { formatDuration, formatDurationLong } from "../utils/time";
import type { Timer, Preset } from "../types";

interface QuickButtonProps {
    minutes: number;
    onClick: () => void;
    variant: 'add' | 'subtract';
    disabled?: boolean;
}

const QuickButton = ({ minutes, onClick, variant, disabled }: QuickButtonProps) => {
    const [focused, setFocused] = useState(false);
    const bgColor = disabled
        ? '#00000044'
        : variant === 'add'
            ? (focused ? '#55cc55' : '#44aa44')
            : (focused ? '#cc5555' : '#aa4444');
    const textColor = disabled ? '#aaaaaa' : '#ffffff';

    return (
        <Focusable
            onActivate={disabled ? undefined : onClick}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                display: 'flex',
                fontSize: 13,
                flexDirection: 'row',
                gap: 2,
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 6px',
                borderRadius: 6,
                border: focused && !disabled ? '2px solid white' : '2px solid transparent',
                backgroundColor: bgColor,
                color: textColor,
                minWidth: 0,
                flex: 1,
                transition: 'all 0.1s ease-in-out',
                opacity: disabled ? 0.5 : 1
            }}
        >
            {variant === 'add' ? <FaPlus size={8} /> : <FaMinus size={8} />}
            <span>{minutes}</span>
        </Focusable>
    );
};

const TimerItem = ({ timer, onCancel }: { timer: Timer; onCancel: () => void }) => {
    const [focused, setFocused] = useState(false);
    const remaining = timer.remaining ?? 0;
    const isUrgent = remaining < 60;

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            backgroundColor: isUrgent ? '#aa444444' : '#ffffff11',
            borderRadius: 8,
            marginBottom: 8
        }}>
            <div>
                <div style={{ fontWeight: 'bold', fontSize: 16 }}>{timer.label}</div>
                <div style={{
                    fontSize: 24,
                    fontFamily: 'monospace',
                    color: isUrgent ? '#ff6666' : '#ffffff'
                }}>
                    {formatDuration(remaining)}
                </div>
            </div>
            <Focusable
                onActivate={onCancel}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                    padding: 8,
                    backgroundColor: focused ? '#ff6666' : '#aa444488',
                    borderRadius: 8,
                    border: focused ? '2px solid white' : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <FaTimes size={16} />
            </Focusable>
        </div>
    );
};

const PresetButton = ({ preset, onClick, disabled }: { preset: Preset; onClick: () => void; disabled: boolean }) => (
    <ButtonItem
        disabled={disabled}
        layout="below"
        onClick={onClick}
    >
        <FaPlay size={10} style={{ marginRight: 8 }} />
        {preset.label}
    </ButtonItem>
);

export function TimerPanel() {
    const { timers, createTimer, cancelTimer } = useTimers();
    const { presets } = useSettings();
    const [timerMinutes, setTimerMinutes] = useState(5);
    const [customLabel, setCustomLabel] = useState('');

    const hasActiveTimers = timers.length > 0;

    const handleStartTimer = async () => {
        await createTimer(timerMinutes * 60, customLabel || `${timerMinutes} min timer`);
        setCustomLabel('');
    };

    const handlePresetClick = async (preset: Preset) => {
        await createTimer(preset.seconds, preset.label);
    };

    return (
        <div>
            {/* Active Timers */}
            {hasActiveTimers && (
                <PanelSection title="Active Timers">
                    {timers.map(timer => (
                        <TimerItem
                            key={timer.id}
                            timer={timer}
                            onCancel={() => cancelTimer(timer.id)}
                        />
                    ))}
                </PanelSection>
            )}

            {/* New Timer Controls */}
            <PanelSection title={hasActiveTimers ? "New Timer" : "Set Timer"}>
                {/* Add buttons */}
                <PanelSectionRow>
                    <Focusable
                        flow-children="row"
                        style={{
                            display: 'flex',
                            flex: '1 1 auto',
                            justifyContent: 'center',
                            flexDirection: 'row',
                            gap: 8
                        }}
                    >
                        <QuickButton minutes={1} variant="add" onClick={() => setTimerMinutes(m => m + 1)} />
                        <QuickButton minutes={5} variant="add" onClick={() => setTimerMinutes(m => m + 5)} />
                        <QuickButton minutes={10} variant="add" onClick={() => setTimerMinutes(m => m + 10)} />
                        <QuickButton minutes={30} variant="add" onClick={() => setTimerMinutes(m => m + 30)} />
                    </Focusable>
                </PanelSectionRow>

                {/* Timer display and start */}
                <PanelSectionRow>
                    <div style={{
                        textAlign: 'center',
                        fontSize: 32,
                        fontWeight: 'bold',
                        padding: '12px 0',
                        fontFamily: 'monospace'
                    }}>
                        {formatDurationLong(timerMinutes * 60)}
                    </div>
                </PanelSectionRow>

                {/* Subtract buttons */}
                <PanelSectionRow>
                    <Focusable
                        flow-children="row"
                        style={{
                            display: 'flex',
                            flex: '1 1 auto',
                            justifyContent: 'center',
                            flexDirection: 'row',
                            gap: 8,
                            marginBottom: 12
                        }}
                    >
                        <QuickButton
                            minutes={1}
                            variant="subtract"
                            disabled={timerMinutes <= 1}
                            onClick={() => setTimerMinutes(m => Math.max(1, m - 1))}
                        />
                        <QuickButton
                            minutes={5}
                            variant="subtract"
                            disabled={timerMinutes <= 5}
                            onClick={() => setTimerMinutes(m => Math.max(1, m - 5))}
                        />
                        <QuickButton
                            minutes={10}
                            variant="subtract"
                            disabled={timerMinutes <= 10}
                            onClick={() => setTimerMinutes(m => Math.max(1, m - 10))}
                        />
                        <QuickButton
                            minutes={30}
                            variant="subtract"
                            disabled={timerMinutes <= 30}
                            onClick={() => setTimerMinutes(m => Math.max(1, m - 30))}
                        />
                    </Focusable>
                </PanelSectionRow>

                {/* Optional label */}
                <PanelSectionRow>
                    <TextField
                        label="Timer Label (e.g., Dinner ready)"
                        value={customLabel}
                        onChange={(e) => setCustomLabel(e.target.value)}
                    />
                </PanelSectionRow>

                {/* Start button */}
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={handleStartTimer}
                    >
                        <FaPlay size={12} style={{ marginRight: 8 }} />
                        Start {timerMinutes} Minute Timer
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>

            {/* Quick Presets */}
            {presets.length > 0 && (
                <PanelSection title="Quick Presets">
                    <PanelSectionRow>
                        <Focusable style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                            {presets.slice(0, 5).map(preset => (
                                <PresetButton
                                    key={preset.id}
                                    preset={preset}
                                    onClick={() => handlePresetClick(preset)}
                                    disabled={false}
                                />
                            ))}
                        </Focusable>
                    </PanelSectionRow>
                </PanelSection>
            )}
        </div>
    );
}
