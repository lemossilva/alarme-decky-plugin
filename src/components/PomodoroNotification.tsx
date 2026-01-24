import { ConfirmModal, Focusable } from "@decky/ui";
import { FaPlay, FaStop, FaForward, FaCoffee, FaBrain } from "react-icons/fa";
import { usePomodoro } from "../hooks/usePomodoro";
import { useSettings } from "../hooks/useSettings";
import { formatDuration } from "../utils/time";
import { useState } from "react";

// Focusable button with highlight (Consistent with SnoozeModal)
interface PomodoroButtonProps {
    label: string | React.ReactNode;
    onClick: () => void;
    isPrimary?: boolean;
    icon?: React.ReactNode;
}

const PomodoroButton = ({ label, onClick, isPrimary, icon }: PomodoroButtonProps) => {
    const [focused, setFocused] = useState(false);

    return (
        <Focusable
            onActivate={onClick}
            onClick={onClick}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: isPrimary ? 'bold' : 'normal',
                backgroundColor: focused ? '#5599bb' : (isPrimary ? '#4488aa' : '#ffffff22'),
                color: '#ffffff',
                border: focused ? '2px solid white' : '2px solid transparent',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.1s ease-in-out',
                minWidth: 120, // ensured width
                gap: 8,
                flex: 1
            }}
        >
            {icon}
            {label}
        </Focusable>
    );
};

export const PomodoroNotification = ({ closeModal }: { closeModal?: () => void }) => {
    const {
        isActive,
        isBreak,
        currentSession,
        currentCycle,
        remaining,
        startPomodoro,
        stopPomodoro,
        skipPhase
    } = usePomodoro();
    const { settings } = useSettings();

    const workDuration = settings.pomodoro_work_duration * 60;
    const breakDuration = settings.pomodoro_break_duration * 60;
    const longBreakDuration = settings.pomodoro_long_break_duration * 60;
    const sessionsUntilLong = settings.pomodoro_sessions_until_long_break;

    const getCurrentPhaseDuration = () => {
        if (!isActive) return workDuration;
        if (isBreak) {
            return currentSession % sessionsUntilLong === 0 ? longBreakDuration : breakDuration;
        }
        return workDuration;
    };

    const progress = isActive
        ? ((getCurrentPhaseDuration() - remaining) / getCurrentPhaseDuration()) * 100
        : 0;

    const getPhaseLabel = () => {
        if (!isActive) return "Ready to focus";
        if (isBreak) {
            return currentSession % sessionsUntilLong === 0 ? "Long Break" : "Short Break";
        }
        return "Focus Time";
    };

    const isLongBreakNext = currentSession % sessionsUntilLong === sessionsUntilLong - 1;

    const handleSkip = async () => {
        await skipPhase();
        // Keep modal open to show next phase
    };

    const handleStop = async () => {
        await stopPomodoro();
        closeModal?.();
    };

    const handleDismiss = () => {
        closeModal?.();
    };

    const handleStart = async () => {
        await startPomodoro();
        closeModal?.();
    };

    return (
        <ConfirmModal
            strTitle="Pomodoro Timer"
            strDescription="" // Using custom content
            strOKButtonText="Dismiss"
            onOK={handleDismiss}
            onCancel={handleDismiss} // B button dismisses
        >
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '16px 0',
                gap: 20
            }}>
                {/* Visual Status (Like Focus Screen) */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: 16, animation: isActive ? 'pulse 2s infinite' : 'none' }}>
                        {isActive && isBreak ? (
                            <FaCoffee size={56} color="#44aa88" />
                        ) : (
                            <FaBrain size={56} color={isActive ? "#aa4444" : "#888888"} />
                        )}
                    </div>

                    <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 6 }}>
                        {getPhaseLabel()}
                    </div>

                    {isActive && (
                        <div style={{ fontSize: 13, color: '#aaaaaa' }}>
                            Session {currentSession} / {sessionsUntilLong}
                            <span style={{ margin: '0 8px', opacity: 0.5 }}>|</span>
                            Cycle {currentCycle}
                        </div>
                    )}
                </div>

                {/* Big Timer */}
                <div style={{
                    fontSize: 56,
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    color: isBreak ? '#44aa88' : '#ffffff',
                    lineHeight: 1
                }}>
                    {formatDuration(isActive ? remaining : workDuration)}
                </div>

                {/* Progress Indicators */}
                {isActive && (
                    <div style={{ width: '100%', height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: isBreak ? '#44aa88' : '#aa4444',
                            transition: 'width 1s linear'
                        }} />
                    </div>
                )}

                {/* Long Break Hint */}
                {isActive && isLongBreakNext && !isBreak && (
                    <div style={{ fontSize: 13, color: '#44aa88', fontWeight: 'bold' }}>
                        ✨ Long break coming up next!
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    {isActive ? (
                        <>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <PomodoroButton
                                    label={isBreak ? "Skip Break" : "Skip Work"}
                                    onClick={handleSkip}
                                    isPrimary={true}
                                    icon={<FaForward />}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <PomodoroButton
                                    label="Stop Session"
                                    onClick={handleStop}
                                    icon={<FaStop />}
                                />
                                <PomodoroButton
                                    label="Dismiss"
                                    onClick={handleDismiss}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <PomodoroButton
                                    label="Start Session"
                                    onClick={handleStart}
                                    isPrimary={true}
                                    icon={<FaPlay />}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <PomodoroButton
                                    label="Dismiss"
                                    onClick={handleDismiss}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* CSS Animation */}
            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.9; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </ConfirmModal>
    );
};
