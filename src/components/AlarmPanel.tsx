import {
    ButtonItem,
    Focusable,
    PanelSection,
    PanelSectionRow,
    ToggleField
} from "@decky/ui";
import { FaBell, FaBellSlash, FaPlus, FaChevronRight } from "react-icons/fa";
import { useState } from "react";
import { useAlarms } from "../hooks/useAlarms";
import { useSettings } from "../hooks/useSettings";
import { showAlarmEditorModal } from "./AlarmEditorModal";
import { formatTime, getRelativeTime, getRecurringText } from "../utils/time";
import type { Alarm } from "../types";

interface AlarmItemProps {
    alarm: Alarm;
    use24h: boolean;
    onToggle: (enabled: boolean) => void;
    onEdit: () => void;
}

const AlarmItem = ({ alarm, use24h, onToggle, onEdit }: AlarmItemProps) => {
    const [cardFocused, setCardFocused] = useState(false);
    const isActive = alarm.enabled;
    const isSnoozed = alarm.snoozed_until && alarm.snoozed_until > Date.now() / 1000;

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
                    checked={alarm.enabled}
                    onChange={onToggle}
                    label=""
                />
            </div>

            {/* Clickable alarm card */}
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
                            fontSize: 24,
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            color: isActive ? '#ffffff' : '#aaaaaa'
                        }}>
                            {formatTime(alarm.hour, alarm.minute, use24h)}
                        </span>
                        <span style={{ fontSize: 13, color: '#aaaaaa', marginLeft: 4 }}>
                            {alarm.label}
                        </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#888888', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{getRecurringText(alarm.recurring)}</span>
                        {alarm.sound && alarm.sound !== 'alarm.mp3' && (
                            <span style={{ color: '#6688aa' }}>
                                🔊 {alarm.sound.replace('.mp3', '').replace('.wav', '').replace('.ogg', '')}
                            </span>
                        )}
                        {alarm.subtle_mode && (
                            <span style={{ color: '#88aa88' }}>📵 Subtle</span>
                        )}
                        {alarm.auto_suspend && (
                            <span style={{ color: '#aa88aa' }}>💤 Auto-suspend</span>
                        )}
                        {isSnoozed && alarm.snoozed_until && (
                            <span style={{ color: '#ffaa00' }}>
                                ⏸️ Until {formatTime(
                                    new Date(alarm.snoozed_until * 1000).getHours(),
                                    new Date(alarm.snoozed_until * 1000).getMinutes(),
                                    use24h
                                )}
                            </span>
                        )}
                    </div>
                    {alarm.next_trigger && isActive && !isSnoozed && (
                        <div style={{ fontSize: 10, color: '#666666', marginTop: 2 }}>
                            {getRelativeTime(alarm.next_trigger, use24h)}
                        </div>
                    )}
                </div>

                {/* Edit indicator */}
                <FaChevronRight size={12} color={cardFocused ? '#ffffff' : '#666666'} />
            </Focusable>
        </div>
    );
};

export function AlarmPanel() {
    const { alarms, createAlarm, updateAlarm, deleteAlarm, toggleAlarm, getSounds } = useAlarms();
    const { settings } = useSettings();

    const use24h = settings.time_format_24h;

    const handleCreateAlarm = () => {
        showAlarmEditorModal({
            defaultSnooze: settings.snooze_duration,
            onSave: async (hour, minute, label, recurring, sound, volume, snoozeDuration, subtleMode, autoSuspend) => {
                await createAlarm(hour, minute, label, recurring, sound, volume, snoozeDuration, subtleMode, autoSuspend);
            },
            getSounds
        });
    };

    const handleEditAlarm = (alarm: Alarm) => {
        showAlarmEditorModal({
            alarm,
            defaultSnooze: settings.snooze_duration,
            onSave: async (hour, minute, label, recurring, sound, volume, snoozeDuration, subtleMode, autoSuspend) => {
                await updateAlarm(alarm.id, hour, minute, label, recurring, sound, volume, snoozeDuration, subtleMode, autoSuspend);
            },
            onDelete: async () => {
                await deleteAlarm(alarm.id);
            },
            getSounds
        });
    };

    return (
        <div>
            {/* Existing Alarms */}
            {alarms.length > 0 && (
                <PanelSection title={`Alarms (${alarms.filter(a => a.enabled).length} active)`}>
                    {alarms.map(alarm => (
                        <AlarmItem
                            key={alarm.id}
                            alarm={alarm}
                            use24h={use24h}
                            onToggle={(enabled) => toggleAlarm(alarm.id, enabled)}
                            onEdit={() => handleEditAlarm(alarm)}
                        />
                    ))}
                </PanelSection>
            )}

            {/* Create New Alarm Button */}
            <PanelSection title="New Alarm">
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={handleCreateAlarm}
                    >
                        <FaPlus size={12} style={{ marginRight: 8 }} />
                        Create New Alarm
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>
        </div>
    );
}
