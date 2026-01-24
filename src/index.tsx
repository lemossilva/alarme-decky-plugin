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
import { FaClock, FaBell, FaCog, FaBrain, FaStopwatch } from "react-icons/fa";
import { useState } from "react";

// Components
import { TimerPanel } from "./components/TimerPanel";
import { AlarmPanel } from "./components/AlarmPanel";
import { PomodoroPanel } from "./components/PomodoroPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { showSnoozeModal } from "./components/SnoozeModal";
import { PomodoroNotification } from "./components/PomodoroNotification";
import { playAlarmSound } from "./utils/sounds";
import { SteamUtils } from "./utils/steam";

// Types
import type {
    TabId,
    TimerCompletedEvent,
    AlarmTriggeredEvent,
    PomodoroState
} from "./types";

// Backend callables for snooze
const snoozeAlarm = callable<[alarm_id: string, minutes: number], boolean>('snooze_alarm');

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
                onSnooze: (minutes) => snoozeAlarm(event.id, minutes),
                onDismiss: () => { }
            });
        }
    };

    const handlePomodoroWorkEnded = (state: PomodoroState) => {
        // Play sound with volume
        playAlarmSound(state.sound || 'alarm.mp3', state.volume);

        // Show modal with controls (Subtle mode or not, user requested modal for interaction)
        // If "Subtle Mode" setting implies Toast vs Modal, we should technically respect it,
        // but user specifically asked for Modal behavior for "Subtle Mode" (or generally when it wasn't working).
        // Since previous behavior was ONLY toast, adding Modal improves it.
        // We can keep Toast if in subtle mode? User said "It should open a modal".
        // Let's open the modal.
        showModal(<PomodoroNotification />);

        // Optional: Keep toast for history/quick glance?
        toaster.toast({
            title: "🎉 Great work!",
            body: `Session ${state.current_session} complete.`
        });
    };

    const handlePomodoroBreakEnded = (state: PomodoroState) => {
        // Play sound
        playAlarmSound(state.sound || 'alarm.mp3');

        showModal(<PomodoroNotification />);

        toaster.toast({
            title: "💪 Break's over!",
            body: `Ready for session ${state.current_session}?`
        });
    };

    // Register event listeners
    addEventListener('alarme_timer_completed', handleTimerCompleted);
    addEventListener('alarme_alarm_triggered', handleAlarmTriggered);
    addEventListener('alarme_pomodoro_work_ended', handlePomodoroWorkEnded);
    addEventListener('alarme_pomodoro_break_ended', handlePomodoroBreakEnded);

    return {
        name: "Alar.me",
        titleView: (
            <div className={staticClasses.Title}>
                <FaClock style={{ marginRight: 8 }} />
                Alar.me
            </div>
        ),
        content: <Content />,
        icon: <FaClock />,
        onDismount: () => {
            removeEventListener('alarme_timer_completed', handleTimerCompleted);
            removeEventListener('alarme_alarm_triggered', handleAlarmTriggered);
            removeEventListener('alarme_pomodoro_work_ended', handlePomodoroWorkEnded);
            removeEventListener('alarme_pomodoro_break_ended', handlePomodoroBreakEnded);
        }
    };
});
