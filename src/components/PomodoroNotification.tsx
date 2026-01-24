import {
    ButtonItem,
    Focusable,
    ProgressBarWithInfo
} from "@decky/ui";
import { FaPlay, FaStop, FaForward, FaCoffee, FaBrain } from "react-icons/fa";
import { usePomodoro } from "../hooks/usePomodoro";
import { useSettings } from "../hooks/useSettings";
import { formatDuration } from "../utils/time";

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

    // If not active, we might have just finished a session but the state is waiting
    // Just show the current state logic similar to the panel

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

    // Handlers that also close the modal potentially, or keep it open based on user flow
    // User said: "(Skip/break), (Stop session), (Dismiss) -> This will just close the modal"

    const handleSkip = async () => {
        await skipPhase();
        // Typically we might want to keep the modal open to see the new phase starting?
        // But let's follow standard behavior or maybe close it if they want "Dismiss" separate.
        // User said "(Dismiss) -> This will just close the modal". Implies others might NOT close it?
        // But usually interacting with a notification modal performs action and closes it.
        // Let's keep it open to show the new state, or close it. 
        // Let's try keeping it open so they see "OK now it's break" then they can dismiss.
    };

    const handleStop = async () => {
        await stopPomodoro();
        closeModal?.();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 300 }}>
            {/* Header/Status */}
            <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 16 }}>
                    {isActive && isBreak ? (
                        <FaCoffee size={48} color="#44aa88" />
                    ) : (
                        <FaBrain size={48} color={isActive ? "#aa4444" : "#888888"} />
                    )}
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>
                    {getPhaseLabel()}
                </div>
                {isActive && (
                    <div style={{ fontSize: 14, color: '#888888' }}>
                        Session {currentSession} of {sessionsUntilLong} <span style={{ opacity: 0.7 }}>(Cycle {currentCycle})</span>
                        {isLongBreakNext && !isBreak && (
                            <span style={{ color: '#44aa88' }}> • Long break next!</span>
                        )}
                    </div>
                )}
            </div>

            {/* Timer / Progress */}
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    fontSize: 48,
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    marginBottom: 16,
                    color: isBreak ? '#44aa88' : '#ffffff'
                }}>
                    {formatDuration(isActive ? remaining : workDuration)}
                </div>
                {isActive && (
                    <ProgressBarWithInfo
                        nProgress={progress}
                        sOperationText={isBreak ? "Relaxing..." : "Focusing..."}
                    />
                )}
            </div>

            {/* Controls */}
            <Focusable style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {isActive ? (
                    <>
                        <ButtonItem layout="below" onClick={handleSkip}>
                            <FaForward /> {isBreak ? "Skip Break" : "Skip Work"}
                        </ButtonItem>
                        <ButtonItem layout="below" onClick={handleStop}>
                            <FaStop /> Stop Session
                        </ButtonItem>
                    </>
                ) : (
                    <ButtonItem layout="below" onClick={() => { startPomodoro(); closeModal?.(); }}>
                        <FaPlay /> Start Session
                    </ButtonItem>
                )}

                <ButtonItem layout="below" onClick={() => closeModal?.()}>
                    Dismiss
                </ButtonItem>
            </Focusable>
        </div>
    );
};
