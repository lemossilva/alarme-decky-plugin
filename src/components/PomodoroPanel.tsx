import {
    ButtonItem,
    Focusable,
    ConfirmModal,
    showModal,
    PanelSection,
    PanelSectionRow,
    ProgressBarWithInfo
} from "@decky/ui";
import { FaPlay, FaStop, FaForward, FaCoffee, FaBrain } from "react-icons/fa";
import { usePomodoro } from "../hooks/usePomodoro";
import { useSettings } from "../hooks/useSettings";
import { formatDuration } from "../utils/time";

export function PomodoroPanel() {
    const {
        isActive,
        isBreak,
        currentSession,
        currentCycle,
        remaining,
        startPomodoro,
        stopPomodoro,
        skipPhase,
        resetStats,
        stats
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

    const isLongBreakNext = currentSession % sessionsUntilLong === 0;

    // Stats calculation handled inline


    return (
        <div>
            <PanelSection title="Pomodoro Timer">
                {/* Status Display */}
                <PanelSectionRow>
                    <div style={{
                        textAlign: 'center',
                        padding: '24px 0'
                    }}>
                        {/* Phase Icon */}
                        <div style={{ marginBottom: 16 }}>
                            {isActive && isBreak ? (
                                <FaCoffee size={48} color="#44aa88" />
                            ) : (
                                <FaBrain size={48} color={isActive ? "#aa4444" : "#888888"} />
                            )}
                        </div>

                        {/* Phase Label */}
                        <div style={{
                            fontSize: 18,
                            color: isBreak ? '#44aa88' : '#ffffff',
                            marginBottom: 8
                        }}>
                            {getPhaseLabel()}
                        </div>

                        {/* Timer Display */}
                        <div style={{
                            fontSize: 64,
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            color: isActive
                                ? (isBreak ? '#44aa88' : (remaining < 60 ? '#ff6666' : '#ffffff'))
                                : '#666666'
                        }}>
                            {formatDuration(isActive ? remaining : workDuration)}
                        </div>

                        {/* Session Counter */}
                        {isActive && (
                            <div style={{
                                fontSize: 14,
                                color: '#888888',
                                marginTop: 8
                            }}>
                                Session {currentSession} of {sessionsUntilLong} <span style={{ opacity: 0.7 }}>(Cycle {currentCycle})</span>
                                {isLongBreakNext && !isBreak && (
                                    <span style={{ color: '#44aa88' }}> • Long break next!</span>
                                )}
                            </div>
                        )}
                    </div>
                </PanelSectionRow>

                {/* Progress Bar */}
                {isActive && (
                    <PanelSectionRow>
                        <ProgressBarWithInfo
                            nProgress={progress}
                            sOperationText={isBreak ? "Relaxing..." : "Focusing..."}
                        />
                    </PanelSectionRow>
                )}

                {/* Controls */}
                <PanelSectionRow>
                    {!isActive ? (
                        <ButtonItem
                            layout="below"
                            onClick={startPomodoro}
                        >
                            <FaPlay size={12} style={{ marginRight: 8 }} />
                            Start Focus Session
                        </ButtonItem>
                    ) : (
                        <Focusable style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                            <ButtonItem
                                layout="below"
                                onClick={skipPhase}
                            >
                                <FaForward size={12} style={{ marginRight: 8 }} />
                                {isBreak ? "Skip Break → Start Work" : "Skip Work → Take Break"}
                            </ButtonItem>
                            <ButtonItem
                                layout="below"
                                onClick={stopPomodoro}
                            >
                                <FaStop size={12} style={{ marginRight: 8 }} />
                                Stop Session
                            </ButtonItem>
                        </Focusable>
                    )}
                </PanelSectionRow>
            </PanelSection>

            {/* Pomodoro Info */}
            <PanelSection title="How it works">
                <PanelSectionRow>
                    <Focusable style={{ width: '100%' }}>
                        <div style={{ fontSize: 13, color: '#aaaaaa', lineHeight: 1.5 }}>
                            <p style={{ marginBottom: 8 }}>
                                <strong>1.</strong> Focus for {settings.pomodoro_work_duration} minutes
                            </p>
                            <p style={{ marginBottom: 8 }}>
                                <strong>2.</strong> Take a {settings.pomodoro_break_duration} minute break
                            </p>
                            <p style={{ marginBottom: 8 }}>
                                <strong>3.</strong> After {sessionsUntilLong} sessions, enjoy a {settings.pomodoro_long_break_duration} minute break
                            </p>
                            <p style={{ color: '#888888', fontSize: 12 }}>
                                Customize durations in Settings.
                            </p>
                        </div>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            {/* Stats (Persistent) */}
            <PanelSection title="Today's Progress">
                <PanelSectionRow>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-around',
                        textAlign: 'center',
                        padding: '12px 0'
                    }}>
                        <div>
                            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#44aa88' }}>
                                {isActive ? currentSession : (stats?.daily_focus_time ? "-" : 0)}
                            </div>
                            <div style={{ fontSize: 12, color: '#888888' }}>
                                Cycle Session
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#4488aa' }}>
                                {(() => {
                                    // Calculate live pending time
                                    let pending = 0;
                                    if (isActive && !isBreak) {
                                        // Work duration - remaining
                                        // Note: remaining decrements.
                                        // We need accurate elapsed. 
                                        // Use helper or calculation.
                                        // remaining is updated by tick.
                                        pending = Math.max(0, workDuration - remaining);
                                    }

                                    const totalDaily = (stats?.daily_focus_time || 0) + pending;
                                    const h = Math.floor(totalDaily / 3600);
                                    const m = Math.floor((totalDaily % 3600) / 60);
                                    return `${h}h ${m}m`;
                                })()}
                            </div>
                            <div style={{ fontSize: 12, color: '#888888' }}>
                                Today's Focus
                            </div>
                        </div>
                    </div>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Lifetime Stats">
                <PanelSectionRow>
                    <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
                            <span>Total Sessions</span>
                            <span style={{ fontWeight: 'bold', color: 'white' }}>{stats?.total_sessions || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
                            <span>Total Cycles</span>
                            <span style={{ fontWeight: 'bold', color: 'white' }}>{stats?.total_cycles || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
                            <span>Total Focus Time</span>
                            <span style={{ fontWeight: 'bold', color: '#4488aa' }}>
                                {Math.floor((stats?.total_focus_time || 0) / 3600)}h {Math.floor(((stats?.total_focus_time || 0) % 3600) / 60)}m
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
                            <span>Total Break Time</span>
                            <span style={{ fontWeight: 'bold', color: '#44aa88' }}>
                                {Math.floor((stats?.total_break_time || 0) / 3600)}h {Math.floor(((stats?.total_break_time || 0) % 3600) / 60)}m
                            </span>
                        </div>

                        <div style={{ marginTop: 10, padding: '0 8px' }}>
                            <ButtonItem
                                layout="below"
                                onClick={() => {
                                    showModal(
                                        <ConfirmModal
                                            strTitle="Reset Lifetime Stats?"
                                            strDescription="Are you sure you want to wipe all global Pomodoro statistics? This cannot be undone."
                                            onOK={() => resetStats()}
                                        />
                                    );
                                }}
                            >
                                Reset Lifetime Stats
                            </ButtonItem>
                        </div>
                    </div>
                </PanelSectionRow>
            </PanelSection>
        </div>
    );
}
