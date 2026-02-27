import {
    ButtonItem,
    Focusable,
    PanelSection,
    PanelSectionRow,
    ToggleField
} from "@decky/ui";
import { FaBell, FaBellSlash, FaPlus, FaChevronRight, FaSync } from "react-icons/fa";
import { useState } from "react";
import { useReminders } from "../hooks/useReminders";
import { useSettings } from "../hooks/useSettings";
import { useGameStatus } from "../hooks/useGameStatus";
import { showReminderEditorModal } from "./ReminderEditorModal";
import type { Reminder } from "../types";

interface ReminderItemProps {
    reminder: Reminder;
    onToggle: (enabled: boolean) => void;
    onEdit: () => void;
    gameRunning: boolean;
}

// Format frequency for display
function formatFrequency(minutes: number): string {
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
}

// Format next trigger time
function formatNextTrigger(isoString: string | undefined, onlyWhileGaming: boolean, gameRunning: boolean): string {
    if (onlyWhileGaming && !gameRunning) return 'Game not running';
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();

        if (diffMs < 0) return 'Due now';

        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins === 0) return 'In less than 1 minute';
        if (diffMins < 60) return `in ${diffMins} min`;

        const diffHours = Math.floor(diffMins / 60);
        const remainingMins = diffMins % 60;
        if (diffHours < 24) {
            return remainingMins > 0 ? `in ${diffHours}h ${remainingMins}m` : `in ${diffHours}h`;
        }

        return `on ${date.toLocaleDateString()}`;
    } catch {
        return '';
    }
}

const ReminderItem = ({ reminder, onToggle, onEdit, gameRunning }: ReminderItemProps) => {
    const [cardFocused, setCardFocused] = useState(false);
    const isActive = reminder.enabled;
    const isInfinite = reminder.recurrences === -1;
    const triggersRemaining = reminder.triggers_remaining ?? reminder.recurrences;

    // Handle toggle without triggering edit
    const handleToggleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <Focusable
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
                minWidth: 0,
                overflow: 'hidden'
            }}
            flow-children="horizontal"
        >
            {/* Toggle - separate from the clickable card */}
            <div
                onClick={handleToggleClick}
                style={{ flexShrink: 0 }}
            >
                <ToggleField
                    checked={reminder.enabled}
                    onChange={onToggle}
                    label=""
                />
            </div>

            {/* Clickable reminder card*/}
            <Focusable
                onActivate={onEdit}
                onFocus={() => setCardFocused(true)}
                onBlur={() => setCardFocused(false)}
                style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    height: 72,
                    backgroundColor: cardFocused ? '#4488aa' : (isActive ? '#ffffff11' : '#ffffff08'),
                    borderRadius: 8,
                    opacity: isActive ? 1 : 0.6,
                    border: cardFocused ? '2px solid white' : '2px solid transparent',
                    transition: 'all 0.1s ease-in-out',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    overflow: 'hidden'
                }}
            >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, overflow: 'hidden' }}>
                    {/* Row 1: Label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isActive ? <FaBell size={11} color={cardFocused ? '#88dd88' : '#44aa44'} /> : <FaBellSlash size={11} color={cardFocused ? '#cccccc' : '#888888'} />}
                        <span style={{ fontSize: 16, fontWeight: 'bold', color: isActive ? '#ffffff' : cardFocused ? '#ffffff' : '#aaaaaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {reminder.label || `Every ${formatFrequency(reminder.frequency_minutes)}`}
                        </span>
                    </div>

                    {/* Row 2: Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: cardFocused ? '#dddddd' : '#888888', overflow: 'hidden' }}>
                        <span style={{ color: cardFocused ? '#aaccee' : '#6688aa', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <FaSync size={8} />
                            {formatFrequency(reminder.frequency_minutes)}
                        </span>
                        {!isInfinite && <span style={{ color: cardFocused ? '#ddaadd' : '#aa88aa' }}>{triggersRemaining}/{reminder.recurrences}</span>}
                        {reminder.only_while_gaming && <span style={{ color: cardFocused ? '#aaddaa' : '#88aa88' }}>🎮</span>}
                        {reminder.subtle_mode && <span style={{ color: cardFocused ? '#aaddaa' : '#88aa88' }}>📵</span>}
                        {reminder.prevent_sleep && <span style={{ color: cardFocused ? '#ffcc66' : '#e69900' }}>🛡️</span>}
                    </div>

                    {/* Row 3: Next trigger */}
                    <div style={{ fontSize: 10, color: cardFocused ? '#bbbbbb' : '#666666' }}>
                        {reminder.next_trigger && isActive && triggersRemaining !== 0 
                            ? `Next: ${formatNextTrigger(reminder.next_trigger, reminder.only_while_gaming, gameRunning)}${(!gameRunning && reminder.only_while_gaming) ? ' (Paused)' : ''}`
                            : ''}
                    </div>
                </div>

                <FaChevronRight size={12} color={cardFocused ? '#ffffff' : '#666666'} style={{ flexShrink: 0, marginLeft: 8 }} />
            </Focusable>
        </Focusable>
    );
};

export function ReminderPanel() {
    const { reminders, createReminder, updateReminder, deleteReminder, toggleReminder, getSounds } = useReminders();
    const { settings } = useSettings();
    const use24h = settings.time_format_24h;
    const gameRunning = useGameStatus();

    const handleCreateReminder = () => {
        showReminderEditorModal({
            onSave: async (
                label: string,
                frequencyMinutes: number,
                startTime: string | null,
                recurrences: number,
                onlyWhileGaming: boolean,
                resetOnGameStart: boolean,
                sound: string,
                volume: number,
                subtleMode: boolean,
                preventSleep: boolean
            ) => {
                await createReminder(label, frequencyMinutes, startTime, recurrences, onlyWhileGaming, resetOnGameStart, sound, volume, subtleMode, preventSleep);
            },
            getSounds,
            use24h,
            returnFocusId: "create-reminder-btn"
        });
    };

    const handleEditReminder = (reminder: Reminder) => {
        showReminderEditorModal({
            reminder,
            onSave: async (
                label: string,
                frequencyMinutes: number,
                startTime: string | null,
                recurrences: number,
                onlyWhileGaming: boolean,
                resetOnGameStart: boolean,
                sound: string,
                volume: number,
                subtleMode: boolean,
                preventSleep: boolean
            ) => {
                await updateReminder(reminder.id, label, frequencyMinutes, startTime, recurrences, onlyWhileGaming, resetOnGameStart, sound, volume, subtleMode, preventSleep);
            },
            onDelete: async () => {
                await deleteReminder(reminder.id);
            },
            getSounds,
            use24h,
            returnFocusId: `reminder-item-${reminder.id}`
        });
    };

    return (
        <div>
            {/* Existing Reminders */}
            {reminders.length > 0 && (
                <PanelSection title={`Reminders (${reminders.filter(r => r.enabled).length} active)`}>
                    {reminders.map(reminder => (
                        <div key={reminder.id} id={`reminder-item-${reminder.id}`}>
                            <ReminderItem
                                reminder={reminder}
                                onToggle={(enabled) => toggleReminder(reminder.id, enabled)}
                                onEdit={() => {
                                    handleEditReminder(reminder);
                                    // Focus restoration handled by passing returnFocusId to modal
                                }}
                                gameRunning={gameRunning}
                            />
                        </div>
                    ))}
                </PanelSection>
            )}

            {/* Create New Reminder Button */}
            <PanelSection title="New Reminder">
                <PanelSectionRow>
                    <div id="create-reminder-btn">
                        <ButtonItem
                            layout="below"
                            onClick={handleCreateReminder}
                        >
                            <FaPlus size={12} style={{ marginRight: 8 }} />
                            Create New Reminder
                        </ButtonItem>
                    </div>
                </PanelSectionRow>
            </PanelSection>
        </div>
    );
}
