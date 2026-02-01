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
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8
        }}>
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

            {/* Clickable reminder card */}
            <Focusable
                onActivate={onEdit}
                onFocus={() => setCardFocused(true)}
                onBlur={() => setCardFocused(false)}
                style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    backgroundColor: cardFocused ? '#4488aa' : (isActive ? '#ffffff11' : '#ffffff08'),
                    borderRadius: 8,
                    opacity: isActive ? 1 : 0.6,
                    border: cardFocused ? '2px solid white' : '2px solid transparent',
                    transition: 'all 0.1s ease-in-out',
                    cursor: 'pointer'
                }}
            >
                <div style={{ flex: 1 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 2
                    }}>
                        {isActive ? <FaBell size={12} color="#44aa44" /> : <FaBellSlash size={12} color="#888888" />}
                        <span style={{
                            fontSize: 18,
                            fontWeight: 'bold',
                            color: isActive ? '#ffffff' : '#aaaaaa'
                        }}>
                            {reminder.label || `Every ${formatFrequency(reminder.frequency_minutes)}`}
                        </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#888888', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: '#6688aa' }}>
                            <FaSync size={9} style={{ marginRight: 4 }} />
                            {formatFrequency(reminder.frequency_minutes)}
                        </span>
                        {!isInfinite && (
                            <span style={{ color: '#aa88aa' }}>
                                {triggersRemaining}/{reminder.recurrences} left
                            </span>
                        )}
                        {reminder.only_while_gaming && (
                            <span style={{ color: '#88aa88' }}>🎮 Gaming only</span>
                        )}
                        {reminder.subtle_mode && (
                            <span style={{ color: '#88aa88' }}>📵 Subtle</span>
                        )}
                    </div>
                    {reminder.next_trigger && isActive && triggersRemaining !== 0 && (
                        <div style={{ fontSize: 10, color: '#666666', marginTop: 2 }}>
                            {formatNextTrigger(reminder.next_trigger, reminder.only_while_gaming, gameRunning)}
                        </div>
                    )}
                </div>

                {/* Edit indicator */}
                <FaChevronRight size={12} color={cardFocused ? '#ffffff' : '#666666'} />
            </Focusable>
        </div>
    );
};

export function ReminderPanel() {
    const { reminders, createReminder, updateReminder, deleteReminder, toggleReminder, getSounds } = useReminders();
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
                subtleMode: boolean
            ) => {
                await createReminder(label, frequencyMinutes, startTime, recurrences, onlyWhileGaming, resetOnGameStart, sound, volume, subtleMode);
            },
            getSounds
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
                subtleMode: boolean
            ) => {
                await updateReminder(reminder.id, label, frequencyMinutes, startTime, recurrences, onlyWhileGaming, resetOnGameStart, sound, volume, subtleMode);
            },
            onDelete: async () => {
                await deleteReminder(reminder.id);
            },
            getSounds
        });
    };

    return (
        <div>
            {/* Existing Reminders */}
            {reminders.length > 0 && (
                <PanelSection title={`Reminders (${reminders.filter(r => r.enabled).length} active)`}>
                    {reminders.map(reminder => (
                        <ReminderItem
                            key={reminder.id}
                            reminder={reminder}
                            onToggle={(enabled) => toggleReminder(reminder.id, enabled)}
                            onEdit={() => handleEditReminder(reminder)}
                            gameRunning={gameRunning}
                        />
                    ))}
                </PanelSection>
            )}

            {/* Create New Reminder Button */}
            <PanelSection title="New Reminder">
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={handleCreateReminder}
                    >
                        <FaPlus size={12} style={{ marginRight: 8 }} />
                        Create New Reminder
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>
        </div>
    );
}
