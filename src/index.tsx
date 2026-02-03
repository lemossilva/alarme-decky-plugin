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
    toaster,
    callable
} from "@decky/api";
import { showModal } from "@decky/ui";
import { FaBell, FaCog, FaBrain, FaStopwatch, FaHourglassHalf, FaRedo } from "react-icons/fa";
import { useState, useEffect } from "react";

// Global declaration for SteamClient
declare const SteamClient: any;

// Components
import { TimerPanel } from "./components/TimerPanel";
import { AlarmPanel } from "./components/AlarmPanel";
import { PomodoroPanel } from "./components/PomodoroPanel";
import { ReminderPanel } from "./components/ReminderPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { showSnoozeModal } from "./components/SnoozeModal";
import { PomodoroNotification } from "./components/PomodoroNotification";
import { ReminderNotification } from "./components/ReminderNotification";
import showMissedReportModal from "./components/MissedReportModal";
import { MissedItem } from "./types";
import { playAlarmSound } from "./utils/sounds";
import { SteamUtils } from "./utils/steam";
import { formatTime } from "./utils/time";

// Types
import type {
    TabId,
    TimerCompletedEvent,
    AlarmTriggeredEvent,
    PomodoroState,
    ReminderTriggeredEvent
} from "./types";

// Backend callables
const snoozeAlarm = callable<[alarm_id: string, minutes: number], boolean>('snooze_alarm');
const setGameRunning = callable<[is_running: boolean], void>('set_game_running');
const toggleReminder = callable<[reminder_id: string, enabled: boolean], boolean>('toggle_reminder');
const getMissedItems = callable<[], MissedItem[]>('get_missed_items');

// Tab configuration
interface Tab {
    id: TabId;
    label: string;
    icon: JSX.Element;
}

const TABS: Tab[] = [
    { id: 'timers', label: 'Timers', icon: <FaStopwatch size={16} /> },
    { id: 'alarms', label: 'Alarms', icon: <FaBell size={16} /> },
    { id: 'pomodoro', label: 'Focus', icon: <FaBrain size={16} /> },
    { id: 'reminders', label: 'Remind', icon: <FaRedo size={16} /> },
    { id: 'settings', label: 'Settings', icon: <FaCog size={16} /> }
];

// Tab Button Component
interface TabButtonProps {
    tab: Tab;
    active: boolean;
    onClick: () => void;
}

const TabButton = ({ tab, active, onClick }: TabButtonProps) => {
    const [focused, setFocused] = useState(false);

    return (
        <Focusable
            onActivate={onClick}
            onClick={onClick}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '6px 4px', // Reduced padding to account for border
                backgroundColor: active ? '#4488aa' : (focused ? '#ffffff22' : 'transparent'),
                color: active || focused ? '#ffffff' : '#888888',
                border: focused ? '2px solid #ffffff' : '2px solid transparent',
                borderRadius: 8,
                cursor: 'pointer',
                gap: 4,
                transition: 'all 0.1s ease-in-out'
            }}
        >
            {tab.icon}
            <span style={{ fontSize: 11 }}>{tab.label}</span>
        </Focusable>
    );
};

// Main Content Component
function Content() {
    const [activeTab, setActiveTab] = useState<TabId>('timers');
    const [missedItems, setMissedItems] = useState<MissedItem[]>([]);
    // Persistent dismissal logic
    const [lastDismissed, setLastDismissed] = useState<number>(() => {
        return parseInt(localStorage.getItem('alarme_missed_dismissed_at') || '0');
    });

    const latestMissedTime = missedItems.length > 0
        ? Math.max(...missedItems.map(i => i.missed_at))
        : 0;

    const showMissedAlerts = missedItems.length > 0 && latestMissedTime > lastDismissed;

    const handleHideReport = () => {
        const now = Date.now() / 1000; // UNIX timestamp in seconds
        setLastDismissed(now);
        localStorage.setItem('alarme_missed_dismissed_at', now.toString());
    };

    const fetchMissed = async () => {
        try {
            const items = await getMissedItems();
            if (items) {
                setMissedItems(items);
            }
        } catch (e) {
            console.error("Failed to fetch missed items", e);
        }
    };

    useEffect(() => {
        fetchMissed();

        const handleMissedUpdate = (items: MissedItem[]) => {
            setMissedItems(items || []);
            // If new items arrive (and they are newer than dismissal), they will naturally show up
            // because latestMissedTime > lastDismissed
        };

        addEventListener('alarme_missed_items_updated', handleMissedUpdate);
        return () => { removeEventListener('alarme_missed_items_updated', handleMissedUpdate); };
    }, []);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Missed Alerts Notification Area */}
            {showMissedAlerts && (
                <PanelSection title="Missed Alerts">
                    <Focusable
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px 8px 4px' }}
                        flow-children="horizontal"
                    >
                        {/* Main Report Button */}
                        <Focusable
                            onClick={() => showMissedReportModal(missedItems)}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                backgroundColor: '#1a1a1a',
                                border: '2px solid #aa4444',
                                color: '#eeeeee',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontWeight: '500',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ color: '#ff6666', fontSize: '1.2em' }}><FaBell /></div>
                                <span style={{ fontSize: '1em', fontWeight: 'bold' }}>
                                    {missedItems.length} Missed Alert{missedItems.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <span style={{ fontSize: 13, opacity: 0.9, color: '#ffaaaa', fontWeight: '600' }}>View Report</span>
                        </Focusable>

                        {/* Hide Button */}
                        <Focusable
                            onClick={handleHideReport}
                            style={{
                                width: 48,
                                height: 48,
                                padding: 0,
                                backgroundColor: '#2a2a2a',
                                color: '#aaaaaa',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid transparent',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }}
                            title="Hide until new alert"
                        >
                            <span style={{ fontSize: 20, fontWeight: 'bold' }}>✕</span>
                        </Focusable>
                    </Focusable>
                </PanelSection>
            )}

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
                        {TABS.map(tab => (
                            <TabButton
                                key={tab.id}
                                tab={tab}
                                active={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                            />
                        ))}
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            {/* Tab Content */}
            {activeTab === 'timers' && <TimerPanel />}
            {activeTab === 'alarms' && <AlarmPanel />}
            {activeTab === 'pomodoro' && <PomodoroPanel />}
            {activeTab === 'reminders' && <ReminderPanel />}
            {activeTab === 'settings' && <SettingsPanel />}
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
                onSnooze: () => { }, // Timers don't snooze
                onDismiss: () => { }
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
            // Play sound briefly if configured? No, subtle implies quiet or toast only.
            // But user might want sound + toast.
            // Current logic in main.py sends sound in event.
            // In handleTimerCompleted we play sound if auto_suspend is on.
            // For periodic reminders, subtle usually means minimal intrusion.
            // We'll stick to just toast for subtle as per original design.
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

    // Game lifecycle listeners
    // Using SteamGameLifetimeNotification or similar
    // For now we use the general app lifetime notification which is reliable
    let unregisterGameListener: any;

    // Track running app IDs to handle multiple concurrent games/apps
    const runningAppIds = new Set<string>();

    try {
        if (SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications) {
            unregisterGameListener = SteamClient.GameSessions.RegisterForAppLifetimeNotifications((update: any) => {
                // Ensure we have an AppID to track
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

        onDismount: () => {
            removeEventListener('alarme_timer_completed', handleTimerCompleted);
            removeEventListener('alarme_alarm_triggered', handleAlarmTriggered);
            removeEventListener('alarme_pomodoro_work_ended', handlePomodoroWorkEnded);
            removeEventListener('alarme_pomodoro_break_ended', handlePomodoroBreakEnded);
            removeEventListener('alarme_reminder_triggered', handleReminderTriggered);
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
