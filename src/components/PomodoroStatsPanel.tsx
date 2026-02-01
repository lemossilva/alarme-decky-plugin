import { useState } from "react";
import { Focusable, PanelSection, PanelSectionRow, ButtonItem, ConfirmModal, showModal } from "@decky/ui";
import type { PomodoroStats } from "../types";

interface PomodoroStatsPanelProps {
    stats: PomodoroStats | undefined;
    elapsedThisPhase: number;
    isActive: boolean;
    isBreak: boolean;
    onResetStats: () => void;
    dailyGoalEnabled?: boolean;
    dailyGoalHours?: number;
}

type ViewMode = 'today' | 'week' | 'month' | 'lifetime';

// View mode button - defined outside to prevent re-creation
interface ViewModeButtonProps {
    label: string;
    active: boolean;
    onClick: () => void;
}

const ViewModeButton = ({ label, active, onClick }: ViewModeButtonProps) => {
    const [focused, setFocused] = useState(false);

    return (
        <Focusable
            onActivate={onClick}
            onClick={onClick}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: 11,
                textAlign: 'center',
                backgroundColor: active ? '#4488aa' : (focused ? '#ffffff33' : 'transparent'),
                color: active || focused ? '#ffffff' : '#888888',
                borderRadius: 6,
                cursor: 'pointer',
                border: focused ? '2px solid white' : '2px solid transparent',
                transition: 'all 0.1s ease'
            }}
        >
            {label}
        </Focusable>
    );
};

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
    { mode: 'today', label: 'Today' },
    { mode: 'week', label: 'Week' },
    { mode: 'month', label: 'Month' },
    { mode: 'lifetime', label: 'Lifetime' }
];

export function PomodoroStatsPanel({
    stats,
    elapsedThisPhase,
    isActive,
    isBreak,
    onResetStats,
    dailyGoalEnabled = false,
    dailyGoalHours = 4
}: PomodoroStatsPanelProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('today');

    // Calculate live pending time (only for work phases)
    const pendingFocus = isActive && !isBreak ? elapsedThisPhase : 0;
    const todayFocus = (stats?.daily_focus_time || 0) + pendingFocus;
    const todaySessions = stats?.daily_sessions || 0;

    // Format time as Xh Ym
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    // Get week data from history
    const getWeekData = (): { day: string; value: number; max: number }[] => {
        const history = stats?.daily_history || [];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();
        const result: { day: string; value: number; max: number }[] = [];

        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayName = days[date.getDay()];

            // Find in history or use 0
            const entry = history.find(h => h.date === dateStr);
            result.push({
                day: dayName,
                value: entry?.focus_time || 0,
                max: dailyGoalHours * 3600
            });
        }

        // Add today's live data to the last entry
        if (result.length > 0) {
            result[result.length - 1].value = todayFocus;
        }

        return result;
    };

    // Calculate week/month totals from history
    const getWeekTotal = () => {
        const weekData = getWeekData();
        return weekData.reduce((sum, d) => sum + d.value, 0);
    };

    const getMonthTotal = () => {
        const history = stats?.daily_history || [];
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const monthData = history.filter(h => h.date >= monthStart);
        return monthData.reduce((sum, h) => sum + h.focus_time, 0) + todayFocus;
    };

    // Simple SVG bar chart for weekly data
    const WeeklyChart = () => {
        const data = getWeekData();
        const maxVal = Math.max(...data.map(d => d.value), dailyGoalHours * 3600);
        const chartHeight = 60;
        const barWidth = 28;
        const gap = 8;

        return (
            <div style={{ padding: '8px 0' }}>
                <svg width="100%" height={chartHeight + 20} viewBox={`0 0 ${data.length * (barWidth + gap)} ${chartHeight + 20}`}>
                    {data.map((d, i) => {
                        const barHeight = maxVal > 0 ? (d.value / maxVal) * chartHeight : 0;
                        const isToday = i === data.length - 1;
                        return (
                            <g key={i} transform={`translate(${i * (barWidth + gap)}, 0)`}>
                                {/* Bar */}
                                <rect
                                    x={0}
                                    y={chartHeight - barHeight}
                                    width={barWidth}
                                    height={Math.max(barHeight, 2)}
                                    fill={isToday ? '#4488aa' : '#44aa88'}
                                    rx={3}
                                />
                                {/* Day label */}
                                <text
                                    x={barWidth / 2}
                                    y={chartHeight + 14}
                                    textAnchor="middle"
                                    fontSize={10}
                                    fill={isToday ? '#ffffff' : '#888888'}
                                >
                                    {d.day}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>
        );
    };

    // Goal progress bar
    const GoalProgress = () => {
        if (!dailyGoalEnabled) return null;
        const goalSeconds = dailyGoalHours * 3600;
        const progress = Math.min((todayFocus / goalSeconds) * 100, 100);
        const goalMet = todayFocus >= goalSeconds;

        return (
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#aaaaaa' }}>🎯 Daily Goal</span>
                    <span style={{ fontSize: 12, color: goalMet ? '#44aa88' : '#ffffff' }}>
                        {formatTime(todayFocus)} / {dailyGoalHours}h
                    </span>
                </div>
                <div style={{
                    height: 8,
                    backgroundColor: '#333333',
                    borderRadius: 4,
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        backgroundColor: goalMet ? '#44aa88' : '#4488aa',
                        transition: 'width 0.3s ease'
                    }} />
                </div>
            </div>
        );
    };

    return (
        <PanelSection title="📊 Focus Stats">
            {/* View Mode Selector - using same pattern as main tabs */}
            <PanelSectionRow>
                <Focusable
                    flow-children="row"
                    style={{
                        display: 'flex',
                        gap: 4,
                        backgroundColor: '#ffffff11',
                        borderRadius: 8,
                        padding: 4
                    }}
                >
                    {VIEW_MODES.map(({ mode, label }) => (
                        <ViewModeButton
                            key={mode}
                            label={label}
                            active={viewMode === mode}
                            onClick={() => setViewMode(mode)}
                        />
                    ))}
                </Focusable>
            </PanelSectionRow>
            <PanelSectionRow>
                <Focusable style={{ width: '100%' }}>

                    {/* Goal Progress (if enabled) */}
                    {viewMode === 'today' && <GoalProgress />}

                    {/* Today View */}
                    {viewMode === 'today' && (
                        <div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-around',
                                textAlign: 'center',
                                padding: '8px 0'
                            }}>
                                <div>
                                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#4488aa' }}>
                                        {formatTime(todayFocus)}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#888888' }}>Focus Time</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#44aa88' }}>
                                        {todaySessions}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#888888' }}>Sessions</div>
                                </div>
                            </div>

                            {/* Streak Info */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: 16,
                                padding: '8px 0',
                                fontSize: 12,
                                color: '#aaaaaa'
                            }}>
                                <span>🔥 Streak: <strong style={{ color: '#ff8844' }}>{stats?.current_streak || 0}</strong> days</span>
                                <span>Best: <strong style={{ color: '#ffaa00' }}>{stats?.longest_streak || 0}</strong></span>
                            </div>
                        </div>
                    )}

                    {/* Week View */}
                    {viewMode === 'week' && (
                        <div>
                            <WeeklyChart />
                            <div style={{ textAlign: 'center', fontSize: 13, color: '#888888', marginTop: 8 }}>
                                Total: <strong style={{ color: '#4488aa' }}>{formatTime(getWeekTotal())}</strong>
                            </div>
                        </div>
                    )}

                    {/* Month View */}
                    {viewMode === 'month' && (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#4488aa' }}>
                                {formatTime(getMonthTotal())}
                            </div>
                            <div style={{ fontSize: 12, color: '#888888' }}>This Month</div>
                        </div>
                    )}

                    {/* Lifetime View */}
                    {viewMode === 'lifetime' && (
                        <div style={{ padding: '8px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span>Total Sessions</span>
                                <strong>{stats?.total_sessions || 0}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span>Total Cycles</span>
                                <strong>{stats?.total_cycles || 0}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span>Total Focus Time</span>
                                <strong style={{ color: '#4488aa' }}>{formatTime(stats?.total_focus_time || 0)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span>Total Break Time</span>
                                <strong style={{ color: '#44aa88' }}>{formatTime(stats?.total_break_time || 0)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span>Longest Streak</span>
                                <strong style={{ color: '#ffaa00' }}>{stats?.longest_streak || 0} days</strong>
                            </div>

                            <div style={{ marginTop: 12 }}>
                                <ButtonItem
                                    layout="below"
                                    onClick={() => {
                                        showModal(
                                            <ConfirmModal
                                                strTitle="Reset Stats?"
                                                strDescription="This will clear all lifetime statistics. This cannot be undone."
                                                onOK={onResetStats}
                                            />
                                        );
                                    }}
                                >
                                    Reset Lifetime Stats
                                </ButtonItem>
                            </div>
                        </div>
                    )}
                </Focusable>
            </PanelSectionRow>

            {/* Invisible focusable spacer for controller scrolling */}
            <PanelSectionRow>
                <Focusable
                    onActivate={() => { }}
                    style={{
                        height: 1,
                        opacity: 0,
                        outline: 'none'
                    }}
                >
                    {/* Empty spacer for scroll */}
                </Focusable>
            </PanelSectionRow>
        </PanelSection>
    );
}
