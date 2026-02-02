import { ConfirmModal, Focusable } from "@decky/ui";
import { callable } from "@decky/api";
import { FaStop, FaCoffee, FaBrain } from "react-icons/fa";
import { usePomodoro } from "../hooks/usePomodoro";
import { useSettings } from "../hooks/useSettings";
import { useGameStatus } from "../hooks/useGameStatus";
import { formatDuration } from "../utils/time";
import { playAlarmSound, stopSound } from "../utils/sounds";
import { useEffect, useRef, useState } from "react";

// Backend callable for base64 sound data
const getSoundDataCall = callable<[filename: string], { success: boolean; data: string | null; mime_type: string | null; error?: string }>('get_sound_data');

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

export const PomodoroNotification = ({ closeModal, sound, volume }: { closeModal?: () => void, sound?: string, volume?: number }) => {
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
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blobUrlRef = useRef<string | null>(null);
    const [canInteract, setCanInteract] = useState(false);
    const isGameRunning = useGameStatus();

    // Play sound on mount (supporting custom sounds via base64), stop on unmount
    useEffect(() => {
        let mounted = true;
        const soundFile = sound || 'alarm.mp3';

        const playCustomSound = async () => {
            try {
                const result = await getSoundDataCall(soundFile);
                if (!result.success || !result.data || !result.mime_type) {
                    console.error('[Alarme] PomodoroNotification: Failed to load custom sound:', result.error);
                    return;
                }

                // Convert base64 to blob URL
                const byteCharacters = atob(result.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: result.mime_type });
                blobUrlRef.current = URL.createObjectURL(blob);

                // Play via HTML5 Audio
                const audio = new Audio(blobUrlRef.current);
                audio.volume = Math.min(1, Math.max(0, (volume ?? 100) / 100));
                audio.loop = true; // Keep playing until dismissed
                await audio.play();
                audioRef.current = audio;
                console.log('[Alarme] PomodoroNotification: Custom sound playing');
            } catch (e) {
                console.error('[Alarme] PomodoroNotification: Failed to play custom sound:', e);
            }
        };

        if (soundFile.startsWith('custom:')) {
            // Custom sounds via base64
            playCustomSound();
        } else {
            // Built-in sounds
            playAlarmSound(soundFile, volume).then(audio => {
                if (mounted) {
                    audioRef.current = audio;
                    if (audioRef.current) {
                        audioRef.current.loop = true;
                    }
                } else if (audio) {
                    stopSound(audio);
                }
            });
        }

        return () => {
            mounted = false;
            stopSound(audioRef.current);
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };
    }, []);

    // Delay to prevent accidental button presses ONLY if game is running
    useEffect(() => {
        if (isGameRunning) {
            setCanInteract(false);
            const timer = setTimeout(() => setCanInteract(true), 2000);
            return () => clearTimeout(timer);
        } else {
            setCanInteract(true);
        }
    }, [isGameRunning]);

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

    const isLongBreakNext = currentSession % sessionsUntilLong === 0;

    const stopPlayingSound = () => {
        if (audioRef.current) {
            stopSound(audioRef.current);
            audioRef.current = null;
        }
    };

    const handleSkip = async () => {
        if (!canInteract) return;
        stopPlayingSound();
        await skipPhase();
        // Keep modal open to show next phase
    };

    const handleStop = async () => {
        if (!canInteract) return;
        stopPlayingSound();
        await stopPomodoro();
        closeModal?.();
    };

    const handleDismiss = () => {
        if (!canInteract) return;
        stopPlayingSound();
        closeModal?.();
    };

    const handleStart = async () => {
        if (!canInteract) return;
        stopPlayingSound();
        await startPomodoro();
        closeModal?.();
    };

    const getOKButtonText = () => {
        if (!isActive) return "Start Session";
        return isBreak ? "Skip Break" : "Skip Work";
    };

    const handleOK = async () => {
        if (!canInteract) return;
        // Sound handling is delegated to the specific action handlers
        if (isActive) {
            await handleSkip();
        } else {
            await handleStart();
        }
    };

    return (
        <ConfirmModal
            strTitle="Pomodoro Timer"
            strDescription=""
            strOKButtonText={getOKButtonText()}
            strCancelButtonText="Dismiss"
            onOK={handleOK}
            onCancel={handleDismiss}
        >
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0 0 16px 0'
            }}>
                {/* Visual Status (Like Focus Screen) */}
                <div style={{ textAlign: 'center', width: '100%' }}>
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
                    lineHeight: 1,
                    margin: '10px 0'
                }}>
                    {formatDuration(isActive ? remaining : workDuration)}
                </div>

                {/* Progress Indicators */}
                {isActive && (
                    <div style={{ width: '100%', height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
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
                    <div style={{ fontSize: 13, color: '#44aa88', fontWeight: 'bold', marginBottom: 10 }}>
                        ✨ Long break coming up next!
                    </div>
                )}

                {!canInteract && (
                    <div style={{ fontSize: 11, color: '#666666', marginTop: 8 }}>
                        Wait a moment...
                    </div>
                )}

                {/* Action Buttons (Stop Only - Others are in Footer) */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    {isActive && (
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <PomodoroButton
                                label="Stop Session"
                                onClick={handleStop}
                                icon={<FaStop />}
                            />
                        </div>
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
