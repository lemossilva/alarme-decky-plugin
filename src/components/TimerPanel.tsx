import {
    ButtonItem,
    ConfirmModal,
    Focusable,
    PanelSection,
    PanelSectionRow,
    showModal,
    ToggleField
} from "@decky/ui";
import { toaster } from "@decky/api";
import { FaPlus, FaMinus, FaTimes, FaPlay, FaEdit, FaPause, FaStar, FaTrash } from "react-icons/fa";
import { useState, useCallback } from "react";

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

interface TimerItemProps {
    timer: Timer;
    onCancel: (id: string) => void;
    onPause: (id: string) => void;
    onResume: (id: string) => void;
    onSaveAsPreset: (id: string) => void;
    showSavePreset: boolean;
}

const TimerItem = ({ timer, onCancel, onPause, onResume, onSaveAsPreset, showSavePreset }: TimerItemProps) => {
    const [cancelFocused, setCancelFocused] = useState(false);
    const [pauseFocused, setPauseFocused] = useState(false);
    const [saveFocused, setSaveFocused] = useState(false);
    const remaining = timer.remaining ?? 0;
    const isUrgent = remaining < 60 && !timer.paused;
    const isPaused = timer.paused ?? false;

    const handleCancel = useCallback(() => {
        onCancel(timer.id);
    }, [onCancel, timer.id]);

    const handlePauseResume = useCallback(() => {
        if (isPaused) {
            onResume(timer.id);
        } else {
            onPause(timer.id);
        }
    }, [isPaused, onPause, onResume, timer.id]);

    const handleSaveAsPreset = useCallback(() => {
        onSaveAsPreset(timer.id);
    }, [onSaveAsPreset, timer.id]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 12px',
            backgroundColor: isPaused ? '#4488aa44' : (isUrgent ? '#aa444444' : '#ffffff11'),
            borderRadius: 8,
            marginBottom: 8
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                        {timer.label}
                        {isPaused && <span style={{ color: '#4488aa', marginLeft: 8, fontSize: 12 }}>PAUSED</span>}
                    </div>
                    <div style={{
                        fontSize: 24,
                        fontFamily: 'monospace',
                        color: isPaused ? '#4488aa' : (isUrgent ? '#ff6666' : '#ffffff')
                    }}>
                        {formatDuration(remaining)}
                    </div>
                </div>
                <Focusable style={{ display: 'flex', gap: 8 }} flow-children="horizontal">
                    {showSavePreset && (
                        <Focusable
                            onActivate={handleSaveAsPreset}
                            onFocus={() => setSaveFocused(true)}
                            onBlur={() => setSaveFocused(false)}
                            style={{
                                padding: 8,
                                backgroundColor: saveFocused ? '#ddaa00' : '#aa880088',
                                borderRadius: 8,
                                border: saveFocused ? '2px solid white' : '2px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <FaStar size={16} />
                        </Focusable>
                    )}
                    <Focusable
                        onActivate={handlePauseResume}
                        onFocus={() => setPauseFocused(true)}
                        onBlur={() => setPauseFocused(false)}
                        style={{
                            padding: 8,
                            backgroundColor: pauseFocused ? '#4488aa' : '#4488aa88',
                            borderRadius: 8,
                            border: pauseFocused ? '2px solid white' : '2px solid transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {isPaused ? <FaPlay size={16} /> : <FaPause size={16} />}
                    </Focusable>
                    <Focusable
                        onActivate={handleCancel}
                        onFocus={() => setCancelFocused(true)}
                        onBlur={() => setCancelFocused(false)}
                        style={{
                            padding: 8,
                            backgroundColor: cancelFocused ? '#ff6666' : '#aa444488',
                            borderRadius: 8,
                            border: cancelFocused ? '2px solid white' : '2px solid transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <FaTimes size={16} />
                    </Focusable>
                </Focusable>
            </div>
            
            {(timer.subtle_mode || timer.auto_suspend || timer.prevent_sleep) && (
                <div style={{
                    fontSize: 11,
                    color: '#bbbbbb',
                    marginTop: 4,
                    display: 'flex',
                    gap: 8,
                    width: '100%'
                }}>
                    {timer.prevent_sleep && <span style={{ color: '#e69900' }}>🛡️ Prev. Sleep</span>}
                    {timer.auto_suspend && <span>💤 Auto-Suspend</span>}
                    {timer.subtle_mode && !timer.auto_suspend && <span>📵 Subtle</span>}
                </div>
            )}
        </div>
    );
};


interface PresetButtonProps {
    preset: Preset;
    onClick: () => void;
    onDelete: () => void;
    disabled: boolean;
}

const PresetButton = ({ preset, onClick, onDelete, disabled }: PresetButtonProps) => {
    const [focused, setFocused] = useState(false);
    const [deleteFocused, setDeleteFocused] = useState(false);
    const minutes = Math.floor(preset.seconds / 60);

    const handleDelete = () => {
        showModal(
            <ConfirmModal
                strTitle="Delete Preset?"
                strDescription={`Are you sure you want to delete "${preset.label}"?`}
                strOKButtonText="Delete"
                strCancelButtonText="Cancel"
                onOK={onDelete}
            />
        );
    };

    return (
        <Focusable
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
                width: '100%'
            }}
            flow-children="horizontal"
        >
            <Focusable
                onActivate={disabled ? undefined : onClick}
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
                    flex: 1,
                    minWidth: 0, // Allow flex child to shrink
                    opacity: disabled ? 0.5 : 1
                }}
            >
                <FaPlay size={10} style={{ minWidth: 10 }} />
                
                {/* Timer Label - Truncated */}
                <span style={{ 
                    flex: 1, 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    marginRight: 4
                }}>
                    {preset.label}
                </span>

                {/* Info Section - Always visible */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    opacity: 0.7,
                    flexShrink: 0 // Prevent shrinking
                }}>
                    {preset.auto_suspend && <span style={{ fontSize: 12 }}>💤</span>}
                    {preset.subtle_mode && !preset.auto_suspend && <span style={{ fontSize: 12 }}>📵</span>}
                    {preset.prevent_sleep && <span style={{ fontSize: 12, color: '#e69900' }}>🛡️</span>}
                    <span style={{ color: '#888888', fontSize: 12, marginLeft: 2, minWidth: 35, textAlign: 'right' }}>
                        {minutes}m
                    </span>
                </div>
            </Focusable>
            <Focusable
                onActivate={handleDelete}
                onFocus={() => setDeleteFocused(true)}
                onBlur={() => setDeleteFocused(false)}
                style={{
                    padding: 8,
                    backgroundColor: deleteFocused ? '#ff6666' : '#aa444488',
                    borderRadius: 8,
                    border: deleteFocused ? '2px solid white' : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <FaTrash size={14} />
            </Focusable>
        </Focusable>
    );
};

const RecentTimerButton = ({ recent, onClick, isFirst }: { recent: RecentTimer; onClick: () => void; isFirst?: boolean }) => {
    const [focused, setFocused] = useState(false);
    const [pressed, setPressed] = useState(false);
    const minutes = Math.floor(recent.seconds / 60);
    const displayLabel = recent.label || `${minutes} min`;

    const handleActivate = () => {
        if (isFirst) {
            setPressed(true);
            setTimeout(() => setPressed(false), 200);
        }
        onClick();
    };

    return (
        <Focusable
            onActivate={handleActivate}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                backgroundColor: pressed ? '#66bb6a' : (focused ? '#4488aa' : '#ffffff11'),
                borderRadius: 8,
                border: focused ? '2px solid white' : '2px solid transparent',
                transition: 'all 0.1s ease-in-out',
                transform: pressed ? 'scale(0.97)' : 'scale(1)'
            }}
        >
            <FaPlay size={10} />
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayLabel}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
                {recent.auto_suspend && <span style={{ fontSize: 12 }}>💤</span>}
                {recent.subtle_mode && !recent.auto_suspend && <span style={{ fontSize: 12 }}>📵</span>}
                {recent.prevent_sleep && <span style={{ fontSize: 12, color: '#e69900' }}>🛡️</span>}
                <span style={{ color: '#888888', fontSize: 12, marginLeft: 2 }}>{minutes}m</span>
            </div>
        </Focusable>
    );
};

export function TimerPanel() {
    const { timers, recentTimers, createTimer, cancelTimer, pauseTimer, resumeTimer } = useTimers();
    const { presets, settings, updateSetting, savePresetFromTimer, removePreset } = useSettings();
    const [timerMinutes, setTimerMinutes] = useState(5);

    // Use settings directly for persistence
    const timerSubtleMode = settings.timer_subtle_mode ?? false;
    const timerAutoSuspend = settings.timer_auto_suspend ?? false;
    const timerPreventSleep = settings.timer_prevent_sleep ?? false;

    const hasActiveTimers = timers.length > 0;
    const hasRecentTimers = recentTimers.length > 0;

    // Quick start timer (no label)
    const handleQuickStart = async () => {
        await createTimer(timerMinutes * 60, '', timerSubtleMode, timerAutoSuspend, timerPreventSleep);
    };

    // Open modal for labeled timer
    const handleAddLabel = () => {
        showTimerLabelModal({
            seconds: timerMinutes * 60,
            onStart: async (seconds, label) => {
                await createTimer(seconds, label, timerSubtleMode, timerAutoSuspend, timerPreventSleep);
            }
        });
    };

    // Start from preset (use preset's saved settings)
    const handlePresetClick = async (preset: Preset) => {
        const subtleMode = preset.subtle_mode !== undefined ? preset.subtle_mode : timerSubtleMode;
        const autoSuspend = preset.auto_suspend !== undefined ? preset.auto_suspend : timerAutoSuspend;
        const preventSleep = preset.prevent_sleep !== undefined ? preset.prevent_sleep : timerPreventSleep;
        await createTimer(preset.seconds, preset.label, subtleMode, autoSuspend, preventSleep);
    };

    // Start from recent
    const handleRecentClick = async (recent: RecentTimer) => {
        // Use the recent timer's saved settings, falling back to global settings if undefined
        const subtleMode = recent.subtle_mode !== undefined ? recent.subtle_mode : timerSubtleMode;
        const autoSuspend = recent.auto_suspend !== undefined ? recent.auto_suspend : timerAutoSuspend;
        const preventSleep = recent.prevent_sleep !== undefined ? recent.prevent_sleep : timerPreventSleep;
        await createTimer(recent.seconds, recent.label, subtleMode, autoSuspend, preventSleep);
    };

    // Save active timer as preset
    const handleSaveAsPreset = async (timerId: string) => {
        await savePresetFromTimer(timerId);
        toaster.toast({ title: "Preset Saved", body: "Timer saved to Saved Presets" });
    };

    // Delete a preset
    const handleDeletePreset = async (presetId: string) => {
        await removePreset(presetId);
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
                            onCancel={cancelTimer}
                            onPause={pauseTimer}
                            onResume={resumeTimer}
                            onSaveAsPreset={handleSaveAsPreset}
                            showSavePreset={settings.presets_enabled ?? true}
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

                <PanelSectionRow>
                    <ToggleField
                        icon={<span style={{ fontSize: 14 }}>📵</span>}
                        label="Subtle Mode"
                        description={timerAutoSuspend
                            ? "Required when Auto-Suspend is enabled"
                            : "Show a small toast instead of fullscreen popup"}
                        checked={timerAutoSuspend ? true : timerSubtleMode}
                        disabled={timerAutoSuspend}
                        onChange={(value) => updateSetting('timer_subtle_mode', value)}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <ToggleField
                        icon={<span style={{ fontSize: 14 }}>💤</span>}
                        label="Auto-Suspend"
                        description="Suspend device when timer finishes (enables Subtle Mode)"
                        checked={timerAutoSuspend}
                        onChange={async (value) => {
                            await updateSetting('timer_auto_suspend', value);
                            if (value) {
                                await updateSetting('timer_subtle_mode', true);
                            }
                        }}
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <ToggleField
                        icon={<span style={{ fontSize: 14 }}>🛡️</span>}
                        label="Prevent Sleep"
                        description="Keep device awake while timer runs. Use with caution - may drain battery."
                        checked={settings.timer_prevent_sleep ?? false}
                        onChange={(value) => updateSetting('timer_prevent_sleep', value)}
                    />
                </PanelSectionRow>
            </PanelSection>

            {/* Recent Timers */}
            {hasRecentTimers && (
                <PanelSection title="Recent">
                    <PanelSectionRow>
                        <Focusable style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
                            {recentTimers.slice(0, 5).map((recent, idx) => (
                                <RecentTimerButton
                                    key={`${recent.seconds}-${recent.label}-${idx}`}
                                    recent={recent}
                                    onClick={() => handleRecentClick(recent)}
                                    isFirst={idx === 0}
                                />
                            ))}
                        </Focusable>
                    </PanelSectionRow>
                </PanelSection>
            )}

            {/* Saved Presets */}
            {settings.presets_enabled && presets.length > 0 && (
                <PanelSection title="Saved Presets">
                    <PanelSectionRow>
                        <Focusable style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
                            {presets.slice(0, settings.presets_max_visible ?? 5).map(preset => (
                                <PresetButton
                                    key={preset.id}
                                    preset={preset}
                                    onClick={() => handlePresetClick(preset)}
                                    onDelete={() => handleDeletePreset(preset.id)}
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
