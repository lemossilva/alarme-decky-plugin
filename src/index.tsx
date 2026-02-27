import {
    Focusable,
    PanelSection,
    PanelSectionRow,
    staticClasses
} from "@decky/ui";
import {
    addEventListener,
    removeEventListener,
    definePlugin,
    routerHook,
    toaster,
    callable
} from "@decky/api";
import { showModal } from "@decky/ui";
import { FaBell, FaCog, FaBrain, FaStopwatch, FaHourglassHalf, FaRedo, FaShieldAlt } from "react-icons/fa";
import { useState, useEffect, useRef, useMemo } from "react";

// Components
import { TimerPanel } from "./components/TimerPanel";
import { AlarmPanel } from "./components/AlarmPanel";
import { StopwatchPanel } from "./components/StopwatchPanel";
import { PomodoroPanel } from "./components/PomodoroPanel";
import { ReminderPanel } from "./components/ReminderPanel";
import { SettingsPage, SETTINGS_ROUTE, navigateToSettings } from "./components/SettingsModal";
import { showSnoozeModal } from "./components/SnoozeModal";
import { PomodoroNotification } from "./components/PomodoroNotification";
import { ReminderNotification } from "./components/ReminderNotification";
import { GameOverlay } from "./components/GameOverlay";
import showMissedReportModal from "./components/MissedReportModal";
import { showSleepInhibitorModal } from "./components/SleepInhibitorModal";
import { playAlarmSound } from "./utils/sounds";
import { SteamUtils } from "./utils/steam";
import { formatTime } from "./utils/time";
import { useSettings } from "./hooks/useSettings";
import { useSleepInhibitor } from "./hooks/useSleepInhibitor";
import { useTimers } from "./hooks/useTimers";
import { useStopwatch } from "./hooks/useStopwatch";
import { usePomodoro } from "./hooks/usePomodoro";
import { useReminders } from "./hooks/useReminders";
import { useGameStatus } from "./hooks/useGameStatus";
import { useMissedAlerts } from "./hooks/useMissedAlerts";

// Types
import type {
    TimerCompletedEvent,
    AlarmTriggeredEvent,
    PomodoroState,
    ReminderTriggeredEvent
} from "./types";

// Backend callables
const snoozeAlarm = callable<[alarm_id: string, minutes: number], boolean>('snooze_alarm');
const snoozeTimerCall = callable<[timer_id: string, minutes: number], boolean>('snooze_timer');
const cancelTimerCall = callable<[timer_id: string], boolean>('cancel_timer');
const setGameRunning = callable<[is_running: boolean], void>('set_game_running');
const toggleReminder = callable<[reminder_id: string, enabled: boolean], boolean>('toggle_reminder');

// Tab configuration
type TabId = 'timers' | 'alarms' | 'stopwatch' | 'pomodoro' | 'reminders';

interface Tab {
    id: TabId;
    label: string;
    icon: JSX.Element;
}

const TABS: Tab[] = [
    { id: 'timers', label: 'Timers', icon: <FaHourglassHalf size={16} /> },
    { id: 'alarms', label: 'Alarms', icon: <FaBell size={16} /> },
    { id: 'pomodoro', label: 'Focus', icon: <FaBrain size={16} /> },
    { id: 'reminders', label: 'Remind', icon: <FaRedo size={16} /> },
    { id: 'stopwatch', label: 'Watch', icon: <FaStopwatch size={16} /> }
];

// Tab Button Component
interface TabButtonProps {
    tab: Tab;
    active: boolean;
    hasActiveItems?: boolean;
    onClick: () => void;
}

const TabButton = ({ tab, active, hasActiveItems, onClick }: TabButtonProps) => {
    const [focused, setFocused] = useState(false);

    return (
        <Focusable
            onActivate={onClick}
            onClick={onClick}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                flex: '1 1 0',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '6px 2px',
                backgroundColor: active ? '#4488aa' : (focused ? '#ffffff22' : 'transparent'),
                color: active || focused ? '#ffffff' : '#888888',
                border: focused ? '2px solid #ffffff' : '2px solid transparent',
                borderRadius: 8,
                cursor: 'pointer',
                gap: 4,
                transition: 'all 0.1s ease-in-out',
                position: 'relative'
            }}
        >
            {hasActiveItems && (
                <div style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 6,
                    height: 6,
                    backgroundColor: '#4488aa',
                    borderRadius: '50%',
                    border: active ? '1px solid white' : 'none'
                }} />
            )}
            {tab.icon}
            <span style={{ 
                fontSize: 11, 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                maxWidth: '100%',
                marginTop: 2
            }}>{tab.label}</span>
        </Focusable>
    );
};

// Main Content Component
function Content() {
    const [activeTab, setActiveTab] = useState<TabId>('timers');
    const { settings: userSettings } = useSettings();
    const { isActive: sleepInhibitorActive, items: sleepInhibitorItems } = useSleepInhibitor();
    const { missedItems, hasMissedAlerts, hasNewMissedAlerts, markAsSeen } = useMissedAlerts();
    const use24h = userSettings.time_format_24h;
    const contentRef = useRef<HTMLDivElement>(null);

    // Track active items for tab indicators
    const { timers } = useTimers();
    const { status: stopwatchStatus } = useStopwatch();
    const { state: pomodoroState } = usePomodoro();
    const { reminders } = useReminders();
    const isGameRunning = useGameStatus();

    // Calculate which tabs have active items
    const hasActiveTimers = timers.some(t => !t.paused);
    const hasActiveStopwatch = stopwatchStatus === 'running';
    const hasActivePomodoro = pomodoroState.active;
    const hasActiveReminders = reminders.some(r => 
        r.enabled && (!r.only_while_gaming || isGameRunning)
    );

    // Sort tabs based on settings, or use default order
    const orderedTabs = useMemo(() => {
        if (!userSettings.tab_order || userSettings.tab_order.length === 0) {
            return TABS;
        }
        
        const sorted = [...TABS].sort((a, b) => {
            const indexA = userSettings.tab_order!.indexOf(a.id);
            const indexB = userSettings.tab_order!.indexOf(b.id);
            
            // If both are found in the custom order, sort by that order
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            // If only A is found, it comes first
            if (indexA !== -1) return -1;
            // If only B is found, it comes first
            if (indexB !== -1) return 1;
            // If neither is found, maintain original order
            return TABS.indexOf(a) - TABS.indexOf(b);
        });
        
        return sorted;
    }, [userSettings.tab_order]);

    // Scroll to top on mount — SteamOS auto-focuses toggle fields which scrolls to middle
    useEffect(() => {
        const scrollToTop = () => {
            if (contentRef.current) {
                // Try to scroll the contentRef itself into view
                contentRef.current.scrollIntoView({ block: 'start' });

                // Also walk up to find the actual scroll container and reset it
                let el: HTMLElement | null = contentRef.current.parentElement;
                while (el) {
                    if (el.scrollHeight > el.clientHeight) {
                        el.scrollTop = 0;
                    }
                    el = el.parentElement;
                }
            }
        };

        // Run multiple times with increasing delays to beat SteamOS focus timing
        scrollToTop();
        requestAnimationFrame(scrollToTop);
        const t1 = setTimeout(scrollToTop, 50);
        const t2 = setTimeout(scrollToTop, 150);
        const t3 = setTimeout(scrollToTop, 300);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, []);

    const handleOpenMissedModal = () => {
        markAsSeen();
        showMissedReportModal(missedItems, use24h);
    };

    return (
        <div ref={contentRef}>
            {/* Notification Bar: 3 buttons (Missed, Sleep, Settings) - compact row */}
            <div style={{ padding: '8px 16px 8px 16px' }}>
                <Focusable
                    flow-children="row"
                    style={{
                        display: 'flex',
                        alignItems: 'stretch',
                        gap: 8,
                        width: '100%'
                    }}
                >
                    {/* Missed Alerts Button */}
                    <Focusable
                        onActivate={hasMissedAlerts ? handleOpenMissedModal : undefined}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: 8,
                            backgroundColor: hasMissedAlerts ? '#ff444422' : '#ffffff08',
                            borderRadius: 12,
                            border: '2px solid transparent',
                            cursor: hasMissedAlerts ? 'pointer' : 'default',
                            opacity: hasMissedAlerts ? 1 : 0.6,
                            transition: 'all 0.1s ease-in-out',
                            position: 'relative'
                        }}
                        onFocus={(e: any) => {
                            if (hasMissedAlerts) {
                                e.target.style.backgroundColor = '#4488aa';
                                e.target.style.borderColor = 'white';
                            }
                        }}
                        onBlur={(e: any) => {
                            e.target.style.backgroundColor = hasMissedAlerts ? '#ff444422' : '#ffffff08';
                            e.target.style.borderColor = 'transparent';
                        }}
                    >
                        <FaBell size={14} style={{ color: hasMissedAlerts ? '#ff4444' : '#666666' }} />
                        <span style={{ fontSize: 12, color: hasMissedAlerts ? '#ff6666' : '#666666', fontWeight: 500 }}>
                            {hasMissedAlerts ? `${missedItems.length} Missed` : 'Missed'}
                        </span>
                        {/* New report indicator (red dot) */}
                        {hasNewMissedAlerts && (
                            <div style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                width: 6,
                                height: 6,
                                backgroundColor: '#ff4444',
                                borderRadius: '50%'
                            }} />
                        )}
                    </Focusable>

                    {/* Sleep Inhibitor Button */}
                    <Focusable
                        onActivate={sleepInhibitorActive ? () => showSleepInhibitorModal(sleepInhibitorItems) : undefined}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: 8,
                            backgroundColor: sleepInhibitorActive ? '#e6990022' : '#ffffff08',
                            borderRadius: 12,
                            border: '2px solid transparent',
                            cursor: sleepInhibitorActive ? 'pointer' : 'default',
                            opacity: sleepInhibitorActive ? 1 : 0.6,
                            transition: 'all 0.1s ease-in-out'
                        }}
                        onFocus={(e: any) => {
                            if (sleepInhibitorActive) {
                                e.target.style.backgroundColor = '#4488aa';
                                e.target.style.borderColor = 'white';
                            }
                        }}
                        onBlur={(e: any) => {
                            e.target.style.backgroundColor = sleepInhibitorActive ? '#e6990022' : '#ffffff08';
                            e.target.style.borderColor = 'transparent';
                        }}
                    >
                        <FaShieldAlt size={14} style={{ color: sleepInhibitorActive ? '#e69900' : '#666666' }} />
                        <span style={{ fontSize: 12, color: sleepInhibitorActive ? '#e69900' : '#666666', fontWeight: 500 }}>
                            {sleepInhibitorActive ? 'Awake' : 'Sleep'}
                        </span>
                    </Focusable>

                    {/* Settings Button */}
                    <Focusable
                        onActivate={navigateToSettings}
                        style={{
                            padding: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#ffffff08',
                            borderRadius: 12,
                            border: '2px solid transparent',
                            cursor: 'pointer',
                            color: '#888888',
                            transition: 'all 0.1s ease-in-out'
                        }}
                        onFocus={(e: any) => {
                            e.target.style.backgroundColor = '#4488aa';
                            e.target.style.borderColor = 'white';
                            e.target.style.color = 'white';
                        }}
                        onBlur={(e: any) => {
                            e.target.style.backgroundColor = '#ffffff08';
                            e.target.style.borderColor = 'transparent';
                            e.target.style.color = '#888888';
                        }}
                    >
                        <FaCog size={16} />
                    </Focusable>
                </Focusable>
            </div>

            {/* Tab Navigation */}
            <PanelSection>
                <PanelSectionRow>
                    <Focusable
                        flow-children="row"
                        style={{
                            display: 'flex',
                            gap: 4,
                            padding: 4,
                            backgroundColor: '#ffffff11',
                            borderRadius: 12,
                            marginBottom: 8
                        }}
                    >
                        {orderedTabs.map(tab => {
                            let hasActiveItems = false;
                            if (tab.id === 'timers') hasActiveItems = hasActiveTimers;
                            else if (tab.id === 'stopwatch') hasActiveItems = hasActiveStopwatch;
                            else if (tab.id === 'pomodoro') hasActiveItems = hasActivePomodoro;
                            else if (tab.id === 'reminders') hasActiveItems = hasActiveReminders;
                            
                            return (
                                <TabButton
                                    key={tab.id}
                                    tab={tab}
                                    active={activeTab === tab.id}
                                    hasActiveItems={hasActiveItems}
                                    onClick={() => setActiveTab(tab.id)}
                                />
                            );
                        })}
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            {/* Tab Content */}
            {activeTab === 'timers' && <TimerPanel />}
            {activeTab === 'alarms' && <AlarmPanel />}
            {activeTab === 'pomodoro' && <PomodoroPanel />}
            {activeTab === 'reminders' && <ReminderPanel />}
            {activeTab === 'stopwatch' && <StopwatchPanel />}
        </div>
    );
}

// Plugin Definition
export default definePlugin(() => {
    // Event handlers
    const getTimeStr = (use24h: boolean = true) => {
        const now = new Date();
        return formatTime(now.getHours(), now.getMinutes(), use24h);
    };

    const handleTimerCompleted = (event: TimerCompletedEvent) => {
        // Auto-suspend forces subtle mode (modal before suspend makes no sense)
        const useSubtle = event.subtle || event.auto_suspend;
        const use24h = event.time_format_24h ?? true;

        if (useSubtle) {
            toaster.toast({
                title: "⏰ Timer Finished!",
                body: `${event.label} • ${getTimeStr(use24h)}`
            });
            // Play sound briefly for non-subtle with auto-suspend
            if (!event.subtle && event.auto_suspend) {
                playAlarmSound(event.sound || 'alarm.mp3', event.volume);
            }
            // Suspend after toast is visible
            if (event.auto_suspend) {
                setTimeout(() => SteamUtils.suspend(), 3000);
            }
        } else {
            showSnoozeModal({
                id: event.id,
                label: event.label,
                type: 'timer',
                sound: event.sound,
                volume: event.volume,
                use24h,
                snoozeActivationDelay: event.snooze_activation_delay,
                onSnooze: (minutes) => snoozeTimerCall(event.id, minutes),
                onDismiss: () => cancelTimerCall(event.id),
            });
        }
    };

    const handleAlarmTriggered = (event: AlarmTriggeredEvent) => {
        // Auto-suspend forces subtle mode (modal before suspend makes no sense)
        const useSubtle = event.subtle || event.auto_suspend;
        const use24h = event.time_format_24h ?? true;

        if (useSubtle) {
            toaster.toast({
                title: "🔔 Alarm!",
                body: `${event.label} • ${getTimeStr(use24h)}`
            });
            // Play sound briefly for non-subtle with auto-suspend
            if (!event.subtle && event.auto_suspend) {
                playAlarmSound(event.sound || 'alarm.mp3', event.volume);
            }
            // Suspend after toast is visible
            if (event.auto_suspend) {
                setTimeout(() => SteamUtils.suspend(), 3000);
            }
        } else {
            showSnoozeModal({
                id: event.id,
                label: event.label,
                type: 'alarm',
                sound: event.sound,
                volume: event.volume,
                defaultSnoozeDuration: event.snooze_duration,
                use24h,
                snoozeActivationDelay: event.snooze_activation_delay,
                onSnooze: (minutes) => snoozeAlarm(event.id, minutes),
                onDismiss: () => { }
            });
        }
    };

    const handlePomodoroWorkEnded = (state: PomodoroState) => {
        if (state.subtle_mode) {
            // Play sound briefly for subtle mode
            playAlarmSound(state.sound || 'alarm.mp3', state.volume);
            toaster.toast({
                title: "🎉 Great work!",
                body: `Session ${state.current_session} complete.`
            });
        } else {
            showModal(<PomodoroNotification sound={state.sound} volume={state.volume} />);
        }
    };

    const handlePomodoroBreakEnded = (state: PomodoroState) => {
        if (state.subtle_mode) {
            // Play sound briefly for subtle mode
            playAlarmSound(state.sound || 'alarm.mp3', state.volume);
            toaster.toast({
                title: "💪 Break's over!",
                body: `Ready for session ${state.current_session}?`
            });
        } else {
            showModal(<PomodoroNotification sound={state.sound} volume={state.volume} />);
        }
    };

    const handleReminderTriggered = (event: ReminderTriggeredEvent) => {
        const use24h = event.time_format_24h ?? true;
        // Use subtle_mode from the event
        if (event.subtle_mode) {
            toaster.toast({
                title: "⏰ Reminder",
                body: `${event.reminder.label || "Time for a break!"} • ${getTimeStr(use24h)}`
            });
        } else {
            // Non-subtle: Show Modal
            // Pass sound details to modal so it plays sound
            showModal(
                <ReminderNotification
                    reminder={event.reminder}
                    onDisable={() => toggleReminder(event.reminder.id, false)}
                    sound={event.sound || 'alarm.mp3'}
                    volume={event.volume}
                    use24h={use24h}
                />
            );
        }
    };

    // Register event listeners
    addEventListener('alarme_timer_completed', handleTimerCompleted);
    addEventListener('alarme_alarm_triggered', handleAlarmTriggered);
    addEventListener('alarme_pomodoro_work_ended', handlePomodoroWorkEnded);
    addEventListener('alarme_pomodoro_break_ended', handlePomodoroBreakEnded);
    addEventListener('alarme_reminder_triggered', handleReminderTriggered);

    // Missed items toast
    addEventListener('alarme_missed_items_toast', (count: number) => {
        toaster.toast({
            title: "AlarMe",
            body: `You missed ${count} alert${count !== 1 ? 's' : ''} while away.`
        });
    });

    // Game lifecycle listeners using app lifetime notification
    let unregisterGameListener: any;

    // Track running app IDs to handle multiple concurrent games/apps
    const runningAppIds = new Set<string>();

    try {
        if (SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications) {
            unregisterGameListener = SteamClient.GameSessions.RegisterForAppLifetimeNotifications((update: any) => {
                if (!update.unAppID) return;

                const appId = String(update.unAppID);

                if (update.bRunning) {
                    // Game start
                    runningAppIds.add(appId);
                    setGameRunning(true);
                    console.log(`[AlarMe] App ${appId} started. Running apps: ${runningAppIds.size}`);
                } else {
                    // Game end
                    runningAppIds.delete(appId);
                    const isAnyGameRunning = runningAppIds.size > 0;
                    setGameRunning(isAnyGameRunning);
                    console.log(`[AlarMe] App ${appId} ended. Running apps: ${runningAppIds.size}`);
                }
            });
        }
    } catch (e) {
        console.error("AlarMe: Failed to register game listeners", e);
    }

    // Register settings route
    routerHook.addRoute(SETTINGS_ROUTE, () => <SettingsPage />);

    // Register in-game overlay using Decky's global component system
    // This API injects components into both Steam UI and game overlay
    const OVERLAY_COMPONENT_NAME = 'AlarMeGameOverlay';
    routerHook.addGlobalComponent(OVERLAY_COMPONENT_NAME, GameOverlay);

    return {
        name: "AlarMe",
        titleView: (
            <div className={staticClasses.Title}>
                <FaHourglassHalf style={{ marginRight: 8 }} />
                AlarMe
            </div>
        ),
        content: <Content />,
        icon: <FaHourglassHalf />,
        alwaysRender: true, // Keep plugin state active for overlay visibility

        onDismount: () => {
            removeEventListener('alarme_timer_completed', handleTimerCompleted);
            removeEventListener('alarme_alarm_triggered', handleAlarmTriggered);
            removeEventListener('alarme_pomodoro_work_ended', handlePomodoroWorkEnded);
            removeEventListener('alarme_pomodoro_break_ended', handlePomodoroBreakEnded);
            removeEventListener('alarme_reminder_triggered', handleReminderTriggered);
            // Unregister settings route and overlay
            routerHook.removeRoute(SETTINGS_ROUTE);
            routerHook.removeGlobalComponent(OVERLAY_COMPONENT_NAME);
            if (unregisterGameListener) {
                if (typeof unregisterGameListener === 'function') {
                    unregisterGameListener();
                } else if (unregisterGameListener.unregister) {
                    unregisterGameListener.unregister();
                }
            }
        }
    };
});
