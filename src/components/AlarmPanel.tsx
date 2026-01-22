import {
    ButtonItem,
    Dropdown,
    DropdownOption,
    Focusable,
    PanelSection,
    PanelSectionRow,
    TextField,
    ToggleField
} from "@decky/ui";
import { FaBell, FaBellSlash, FaPlus, FaTrash } from "react-icons/fa";
import { useRef, useState, useEffect } from "react";
import { useAlarms } from "../hooks/useAlarms";
import { useSettings } from "../hooks/useSettings";
import { formatTime, getRelativeTime, getRecurringText } from "../utils/time";
import type { Alarm, RecurringType, SoundFile } from "../types";

const RECURRING_OPTIONS: DropdownOption[] = [
    { data: 'once', label: 'Once' },
    { data: 'daily', label: 'Every Day' },
    { data: 'weekdays', label: 'Weekdays' },
    { data: 'weekends', label: 'Weekends' }
];

// Arrow button with focus highlighting
interface ArrowButtonProps {
    direction: 'up' | 'down';
    onActivate: () => void;
    onStartRepeat: () => void;
    onStopRepeat: () => void;
}

const ArrowButton = ({ direction, onActivate, onStartRepeat, onStopRepeat }: ArrowButtonProps) => {
    const [focused, setFocused] = useState(false);

    return (
        <Focusable
            onActivate={onActivate}
            onMouseDown={onStartRepeat}
            onMouseUp={onStopRepeat}
            onMouseLeave={onStopRepeat}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                padding: 8,
                marginTop: direction === 'down' ? 8 : 0,
                marginBottom: direction === 'up' ? 8 : 0,
                backgroundColor: focused ? '#4488aa' : '#ffffff22',
                borderRadius: 4,
                minWidth: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: focused ? '2px solid white' : '2px solid transparent',
                transition: 'all 0.1s ease-in-out'
            }}
        >
            {direction === 'up' ? '▲' : '▼'}
        </Focusable>
    );
};

interface AlarmItemProps {
    alarm: Alarm;
    use24h: boolean;
    onToggle: (enabled: boolean) => void;
    onDelete: () => void;
}

const AlarmItem = ({ alarm, use24h, onToggle, onDelete }: AlarmItemProps) => {
    const [deleteFocused, setDeleteFocused] = useState(false);
    const isActive = alarm.enabled;
    const isSnoozed = alarm.snoozed_until && alarm.snoozed_until > Date.now() / 1000;

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px',
            backgroundColor: isActive ? '#ffffff11' : '#ffffff08',
            borderRadius: 8,
            marginBottom: 8,
            opacity: isActive ? 1 : 0.6
        }}>
            <div style={{ flex: 1 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4
                }}>
                    {isActive ? <FaBell size={14} color="#44aa44" /> : <FaBellSlash size={14} color="#888888" />}
                    <span style={{
                        fontSize: 28,
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        color: isActive ? '#ffffff' : '#aaaaaa'
                    }}>
                        {formatTime(alarm.hour, alarm.minute, use24h)}
                    </span>
                </div>
                <div style={{ fontSize: 14, color: '#aaaaaa' }}>
                    {alarm.label}
                </div>
                <div style={{ fontSize: 12, color: '#888888', marginTop: 4 }}>
                    {getRecurringText(alarm.recurring)}
                    {isSnoozed && alarm.snoozed_until && (
                        <span style={{ color: '#ffaa00', marginLeft: 8 }}>
                            Snoozed until {formatTime(
                                new Date(alarm.snoozed_until * 1000).getHours(),
                                new Date(alarm.snoozed_until * 1000).getMinutes(),
                                use24h
                            )}
                        </span>
                    )}
                </div>
                {alarm.next_trigger && isActive && (
                    <div style={{ fontSize: 11, color: '#666666', marginTop: 2 }}>
                        {getRelativeTime(alarm.next_trigger, use24h)}
                    </div>
                )}
            </div>

            <Focusable style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <ToggleField
                    checked={alarm.enabled}
                    onChange={onToggle}
                    label=""
                />
                <Focusable
                    onActivate={onDelete}
                    onFocus={() => setDeleteFocused(true)}
                    onBlur={() => setDeleteFocused(false)}
                    style={{
                        padding: 8,
                        backgroundColor: deleteFocused ? '#ff6666' : '#aa444488',
                        borderRadius: 8,
                        border: deleteFocused ? '2px solid white' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.1s ease-in-out'
                    }}
                >
                    <FaTrash size={12} />
                </Focusable>
            </Focusable>
        </div>
    );
};

export function AlarmPanel() {
    const { alarms, createAlarm, deleteAlarm, toggleAlarm, getSounds } = useAlarms();
    const { settings } = useSettings();

    const [hour, setHour] = useState(() => {
        const now = new Date();
        return now.getHours();
    });
    const [minute, setMinute] = useState(0);
    const [label, setLabel] = useState('');
    const [recurring, setRecurring] = useState<RecurringType>('once');
    const [sound, setSound] = useState('alarm.mp3');
    const [sounds, setSounds] = useState<SoundFile[]>([{ filename: 'alarm.mp3', name: 'Alarm' }]);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const use24h = settings.time_format_24h;

    // Load available sounds on mount
    useEffect(() => {
        getSounds().then(setSounds);
    }, [getSounds]);

    const handleCreateAlarm = async () => {
        await createAlarm(hour, minute, label, recurring, sound);
        setLabel('');
        setRecurring('once');
        setSound('alarm.mp3');
        setShowCreateForm(false);
    };

    // Repeater logic for holding buttons
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const startRepeating = (action: () => void) => {
        action();
        // Initial delay before rapid repeat
        timeoutRef.current = setTimeout(() => {
            intervalRef.current = setInterval(action, 100);
        }, 300);
    };

    const stopRepeating = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const adjustTime = (type: 'hour' | 'minute', delta: number) => {
        if (type === 'hour') {
            setHour(h => {
                let newHour = h + delta;
                if (newHour > 23) newHour = 0;
                return newHour;
            });
        } else {
            setMinute(m => {
                let newMinute = m + delta;
                if (newMinute < 0) newMinute = 59;
                if (newMinute > 59) newMinute = 0;
                return newMinute;
            });
        }
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
                            onDelete={() => deleteAlarm(alarm.id)}
                        />
                    ))}
                </PanelSection>
            )}

            {/* Create New Alarm */}
            <PanelSection title="New Alarm">
                {!showCreateForm ? (
                    <PanelSectionRow>
                        <ButtonItem
                            layout="below"
                            onClick={() => setShowCreateForm(true)}
                        >
                            <FaPlus size={12} style={{ marginRight: 8 }} />
                            Create New Alarm
                        </ButtonItem>
                    </PanelSectionRow>
                ) : (
                    <>
                        {/* Time Picker */}
                        <PanelSectionRow>
                            <Focusable
                                flow-children="row"
                                style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '16px 0'
                                }}
                            >
                                {/* Hour selector */}
                                <Focusable style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <ArrowButton
                                        direction="up"
                                        onActivate={() => adjustTime('hour', 1)}
                                        onStartRepeat={() => startRepeating(() => adjustTime('hour', 1))}
                                        onStopRepeat={stopRepeating}
                                    />
                                    <div style={{
                                        fontSize: 48,
                                        fontWeight: 'bold',
                                        fontFamily: 'monospace',
                                        width: 80,
                                        textAlign: 'center'
                                    }}>
                                        {hour.toString().padStart(2, '0')}
                                    </div>
                                    <ArrowButton
                                        direction="down"
                                        onActivate={() => adjustTime('hour', -1)}
                                        onStartRepeat={() => startRepeating(() => adjustTime('hour', -1))}
                                        onStopRepeat={stopRepeating}
                                    />
                                </Focusable>

                                <div style={{ fontSize: 48, fontWeight: 'bold' }}>:</div>

                                {/* Minute selector */}
                                <Focusable style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <ArrowButton
                                        direction="up"
                                        onActivate={() => adjustTime('minute', 1)}
                                        onStartRepeat={() => startRepeating(() => adjustTime('minute', 1))}
                                        onStopRepeat={stopRepeating}
                                    />
                                    <div style={{
                                        fontSize: 48,
                                        fontWeight: 'bold',
                                        fontFamily: 'monospace',
                                        width: 80,
                                        textAlign: 'center'
                                    }}>
                                        {minute.toString().padStart(2, '0')}
                                    </div>
                                    <ArrowButton
                                        direction="down"
                                        onActivate={() => adjustTime('minute', -1)}
                                        onStartRepeat={() => startRepeating(() => adjustTime('minute', -1))}
                                        onStopRepeat={stopRepeating}
                                    />
                                </Focusable>
                            </Focusable>
                        </PanelSectionRow>

                        {/* Label */}
                        <PanelSectionRow>
                            <TextField
                                label="Alarm Label (e.g., Wake up)"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                            />
                        </PanelSectionRow>

                        {/* Recurring */}
                        <PanelSectionRow>
                            <Dropdown
                                rgOptions={RECURRING_OPTIONS}
                                selectedOption={recurring}
                                onChange={(option) => setRecurring(option.data as any)}
                                strDefaultLabel="When"
                            />
                        </PanelSectionRow>

                        {/* Sound selector */}
                        <PanelSectionRow>
                            <Dropdown
                                rgOptions={sounds.map(s => ({ data: s.filename, label: s.name }))}
                                selectedOption={sound}
                                onChange={(option) => setSound(option.data as string)}
                                strDefaultLabel="Sound"
                            />
                        </PanelSectionRow>

                        {/* Action buttons */}
                        <PanelSectionRow>
                            <ButtonItem
                                layout="below"
                                onClick={() => setShowCreateForm(false)}
                            >
                                Cancel
                            </ButtonItem>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ButtonItem
                                layout="below"
                                onClick={handleCreateAlarm}
                            >
                                Set Alarm
                            </ButtonItem>
                        </PanelSectionRow>
                    </>
                )}
            </PanelSection>
        </div>
    );
}
