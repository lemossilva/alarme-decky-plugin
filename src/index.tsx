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
import { useState } from "react";

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
import { playAlarmSound } from "./utils/sounds";
import { SteamUtils } from "./utils/steam";

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

    return (
        <div id="alarme-container">
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
    const handleTimerCompleted = (event: TimerCompletedEvent) => {
        // Auto-suspend forces subtle mode (modal before suspend makes no sense)
        const useSubtle = event.subtle || event.auto_suspend;

        if (useSubtle) {
            toaster.toast({
                title: "⏰ Timer Finished!",
                body: event.label
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
                onSnooze: () => { }, // Timers don't snooze
                onDismiss: () => { }
            });
        }
    };

    const handleAlarmTriggered = (event: AlarmTriggeredEvent) => {
        // Auto-suspend forces subtle mode (modal before suspend makes no sense)
        const useSubtle = event.subtle || event.auto_suspend;

        if (useSubtle) {
            toaster.toast({
                title: "🔔 Alarm!",
                body: event.label
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
        // Use subtle_mode from the event
        if (event.subtle_mode) {
            toaster.toast({
                title: "⏰ Reminder",
                body: event.reminder.label || "Time for a break!"
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
