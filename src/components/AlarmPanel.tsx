import {
    ButtonItem,
    Focusable,
    PanelSection,
    PanelSectionRow,
    ToggleField
} from "@decky/ui";
import { FaBell, FaBellSlash, FaPlus, FaChevronRight } from "react-icons/fa";
import { useState, useCallback } from "react";

import { useAlarms } from "../hooks/useAlarms";
import { useSettings } from "../hooks/useSettings";
import { showAlarmEditorModal } from "./AlarmEditorModal";
import { formatTime, getRelativeTime, getRecurringText } from "../utils/time";
import type { Alarm } from "../types";

interface AlarmItemProps {
    alarm: Alarm;
    use24h: boolean;
    onToggle: (id: string, enabled: boolean) => void;
    onEdit: (alarm: Alarm) => void;
}

const AlarmItem = ({ alarm, use24h, onToggle, onEdit }: AlarmItemProps) => {
    const [cardFocused, setCardFocused] = useState(false);
    const isActive = alarm.enabled;
    const isSnoozed = alarm.snoozed_until && alarm.snoozed_until > Date.now() / 1000;

    const handleToggle = useCallback((enabled: boolean) => {
        onToggle(alarm.id, enabled);
    }, [onToggle, alarm.id]);

    const handleEdit = useCallback(() => {
        onEdit(alarm);
    }, [onEdit, alarm]);

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
                marginBottom: 8
            }}
            flow-children="horizontal"
        >
            {/* Toggle - separate from the clickable card */}
            <div
                onClick={handleToggleClick}
                style={{ flexShrink: 0 }}
            >
                <ToggleField
                    checked={alarm.enabled}
                    onChange={handleToggle}
                    label=""
                />
            </div>

            {/* Clickable alarm card */}
            <Focusable
                onActivate={handleEdit}

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
                        {alarm.prevent_sleep && (
                            <span style={{ color: '#e69900' }}>🛡️ Prevent Sleep</span>
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
        </Focusable>
    );
};

export function AlarmPanel() {
    const { alarms, createAlarm, updateAlarm, deleteAlarm, toggleAlarm, getSounds } = useAlarms();
    const { settings } = useSettings();

    const use24h = settings.time_format_24h;

    const handleCreateAlarm = useCallback(() => {
        showAlarmEditorModal({
            onSave: async (hour, minute, label, recurring, sound, volume, subtleMode, autoSuspend, preventSleep, preventSleepWindow) => {
                await createAlarm(hour, minute, label, recurring, sound, volume, subtleMode, autoSuspend, preventSleep, preventSleepWindow);
            },
            getSounds,
            use24h,
            returnFocusId: "create-alarm-btn"
        });
    }, [createAlarm, getSounds, use24h]);

    const handleEditAlarm = useCallback((alarm: Alarm) => {
        showAlarmEditorModal({
            alarm,
            onSave: async (hour, minute, label, recurring, sound, volume, subtleMode, autoSuspend, preventSleep, preventSleepWindow) => {
                await updateAlarm(alarm.id, hour, minute, label, recurring, sound, volume, subtleMode, autoSuspend, preventSleep, preventSleepWindow);
            },
            onDelete: async () => {
                await deleteAlarm(alarm.id);
            },
            getSounds,
            use24h,
            returnFocusId: `alarm-item-${alarm.id}`
        });

    }, [updateAlarm, deleteAlarm, getSounds, use24h]);

    return (
        <div>
            {/* Existing Alarms */}
            {alarms.length > 0 && (
                <PanelSection title={`Alarms (${alarms.filter(a => a.enabled).length} active)`}>
                    {alarms.map(alarm => (
                        <div key={alarm.id} id={`alarm-item-${alarm.id}`}>
                            <AlarmItem
                                alarm={alarm}
                                use24h={use24h}
                                onToggle={toggleAlarm}
                                onEdit={() => {
                                    handleEditAlarm(alarm);
                                    // Focus restoration handled by passing returnFocusId to modal
                                }}
                            />
                        </div>
                    ))}
                </PanelSection>
            )}

            {/* Create New Alarm Button */}
            <PanelSection title="New Alarm">
                <PanelSectionRow>
                    <div id="create-alarm-btn">
                        <ButtonItem
                            layout="below"
                            onClick={handleCreateAlarm}
                        >
                            <FaPlus size={12} style={{ marginRight: 8 }} />
                            Create New Alarm
                        </ButtonItem>
                    </div>
                </PanelSectionRow>
            </PanelSection>
        </div>
    );
}
