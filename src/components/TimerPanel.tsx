import {
    ButtonItem,
    Focusable,
    PanelSection,
    PanelSectionRow
} from "@decky/ui";
import { FaPlus, FaMinus, FaTimes, FaPlay, FaEdit } from "react-icons/fa";
import { useState } from "react";
import { useTimers, RecentTimer } from "../hooks/useTimers";
import { useSettings } from "../hooks/useSettings";
import { formatDuration, formatDurationLong } from "../utils/time";
import { showTimerLabelModal } from "./TimerLabelModal";
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

const RecentTimerButton = ({ recent, onClick }: { recent: RecentTimer; onClick: () => void }) => {
    const [focused, setFocused] = useState(false);
    const minutes = Math.floor(recent.seconds / 60);
    const displayLabel = recent.label || `${minutes} min`;

    return (
        <Focusable
            onActivate={onClick}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                backgroundColor: focused ? '#4488aa' : '#ffffff11',
                borderRadius: 8,
                border: focused ? '2px solid white' : '2px solid transparent',
                transition: 'all 0.1s ease-in-out'
            }}
        >
            <FaPlay size={10} />
            <span style={{ flex: 1 }}>{displayLabel}</span>
            <span style={{ color: '#888888', fontSize: 12 }}>{minutes}m</span>
        </Focusable>
    );
};

export function TimerPanel() {
    const { timers, recentTimers, createTimer, cancelTimer } = useTimers();
    const { presets } = useSettings();
    const [timerMinutes, setTimerMinutes] = useState(5);

    const hasActiveTimers = timers.length > 0;
    const hasRecentTimers = recentTimers.length > 0;

    // Quick start timer (no label)
    const handleQuickStart = async () => {
        await createTimer(timerMinutes * 60, '');
    };

    // Open modal for labeled timer
    const handleAddLabel = () => {
        showTimerLabelModal({
            seconds: timerMinutes * 60,
            onStart: async (seconds, label) => {
                await createTimer(seconds, label);
            }
        });
    };

    // Start from preset
    const handlePresetClick = async (preset: Preset) => {
        await createTimer(preset.seconds, preset.label);
    };

    // Start from recent
    const handleRecentClick = async (recent: RecentTimer) => {
        await createTimer(recent.seconds, recent.label);
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

                {/* Timer display */}
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

                {/* Action buttons - Start and Add Label */}
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={handleQuickStart}
                    >
                        <FaPlay size={12} style={{ marginRight: 8 }} />
                        Start {timerMinutes} Minute Timer
                    </ButtonItem>
                </PanelSectionRow>

                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={handleAddLabel}
                    >
                        <FaEdit size={12} style={{ marginRight: 8 }} />
                        Add Label...
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>

            {/* Recent Timers */}
            {hasRecentTimers && (
                <PanelSection title="Recent">
                    <PanelSectionRow>
                        <Focusable style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                            {recentTimers.slice(0, 5).map((recent, idx) => (
                                <RecentTimerButton
                                    key={`${recent.seconds}-${recent.label}-${idx}`}
                                    recent={recent}
                                    onClick={() => handleRecentClick(recent)}
                                />
                            ))}
                        </Focusable>
                    </PanelSectionRow>
                </PanelSection>
            )}

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
