import { ConfirmModal, Dropdown, DropdownOption, Focusable, showModal, SliderField, TextField } from "@decky/ui";
import { FaBell, FaMusic, FaCalendarAlt, FaVolumeUp } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";
import type { Alarm, RecurringType, SoundFile } from "../types";
import { playAlarmSound, stopSound } from "../utils/sounds";

// Days of the week - 0=Monday per backend convention
const DAYS_OF_WEEK = [
    { id: 0, short: 'Mon', full: 'Monday' },
    { id: 1, short: 'Tue', full: 'Tuesday' },
    { id: 2, short: 'Wed', full: 'Wednesday' },
    { id: 3, short: 'Thu', full: 'Thursday' },
    { id: 4, short: 'Fri', full: 'Friday' },
    { id: 5, short: 'Sat', full: 'Saturday' },
    { id: 6, short: 'Sun', full: 'Sunday' }
];

// Quick recurring options
const QUICK_RECURRING_OPTIONS: DropdownOption[] = [
    { data: 'once', label: 'Once' },
    { data: 'daily', label: 'Every Day' },
    { data: 'weekdays', label: 'Weekdays (Mon-Fri)' },
    { data: 'weekends', label: 'Weekends (Sat-Sun)' },
    { data: 'custom', label: 'Custom Days...' }
];

interface AlarmEditorModalProps {
    // If provided, we're editing an existing alarm
    alarm?: Alarm;
    defaultSnooze?: number;
    onSave: (hour: number, minute: number, label: string, recurring: RecurringType, sound: string, volume: number, snoozeDuration: number, subtleMode?: boolean, autoSuspend?: boolean) => Promise<void>;
    onDelete?: () => Promise<void>;
    getSounds: () => Promise<SoundFile[]>;
    closeModal?: () => void;
}

export function showAlarmEditorModal(props: AlarmEditorModalProps) {
    showModal(<AlarmEditorModalContent {...props} />);
}

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
                padding: 12,
                marginTop: direction === 'down' ? 16 : 0,
                marginBottom: direction === 'up' ? 16 : 0,
                backgroundColor: focused ? '#4488aa' : '#ffffff22',
                borderRadius: 8,
                minWidth: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: focused ? '2px solid white' : '2px solid transparent',
                transition: 'all 0.1s ease-in-out',
                fontSize: 18
            }}
        >
            {direction === 'up' ? '▲' : '▼'}
        </Focusable>
    );
};

// Day toggle button
interface DayToggleProps {
    day: typeof DAYS_OF_WEEK[0];
    selected: boolean;
    onToggle: () => void;
}

const DayToggle = ({ day, selected, onToggle }: DayToggleProps) => {
    const [focused, setFocused] = useState(false);

    return (
        <Focusable
            onActivate={onToggle}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 'bold',
                backgroundColor: selected ? '#44aa44' : '#ffffff22',
                color: selected ? '#ffffff' : '#888888',
                border: focused ? '2px solid white' : '2px solid transparent',
                transition: 'all 0.1s ease-in-out'
            }}
        >
            {day.short}
        </Focusable>
    );
};

function AlarmEditorModalContent({ alarm, defaultSnooze, onSave, onDelete, getSounds, closeModal }: AlarmEditorModalProps) {
    const isEditing = !!alarm;

    // Form state
    const [hour, setHour] = useState(alarm?.hour ?? new Date().getHours());
    const [minute, setMinute] = useState(alarm?.minute ?? 0);
    const [label, setLabel] = useState(alarm?.label ?? '');
    const [selectedSound, setSelectedSound] = useState(alarm?.sound ?? 'alarm.mp3');
    const [sounds, setSounds] = useState<SoundFile[]>([{ filename: 'alarm.mp3', name: 'Alarm' }]);

    // Recurrence state
    const [quickRecurring, setQuickRecurring] = useState<string>(() => {
        const recurring = alarm?.recurring ?? 'once';
        if (['once', 'daily', 'weekdays', 'weekends'].includes(recurring)) {
            return recurring;
        }
        return 'custom';
    });
    const [selectedDays, setSelectedDays] = useState<number[]>(() => {
        const recurring = alarm?.recurring ?? 'once';
        if (recurring === 'weekdays') return [0, 1, 2, 3, 4];
        if (recurring === 'weekends') return [5, 6];
        if (recurring === 'daily') return [0, 1, 2, 3, 4, 5, 6];
        if (recurring !== 'once' && recurring.includes(',')) {
            return recurring.split(',').map(d => parseInt(d, 10));
        }
        return [];
    });

    // Per-alarm behavior settings
    const [subtleMode, setSubtleMode] = useState(alarm?.subtle_mode ?? false);
    const [autoSuspend, setAutoSuspend] = useState(alarm?.auto_suspend ?? false);
    const [volume, setVolume] = useState(alarm?.volume ?? 100);
    const [snoozeDuration, setSnoozeDuration] = useState(alarm?.snooze_duration ?? defaultSnooze ?? 5);

    // Sound preview
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    // Repeater logic for time adjustment
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load available sounds
    useEffect(() => {
        getSounds().then(setSounds);
        return () => {
            stopSound(previewAudioRef.current);
        };
    }, [getSounds]);

    const startRepeating = (action: () => void) => {
        action();
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
                if (newHour < 0) newHour = 23;
                return newHour;
            });
        } else {
            setMinute(m => {
                let newMinute = m + delta;
                if (newMinute > 59) newMinute = 0;
                if (newMinute < 0) newMinute = 59;
                return newMinute;
            });
        }
    };

    const toggleDay = (dayId: number) => {
        setSelectedDays(prev =>
            prev.includes(dayId)
                ? prev.filter(d => d !== dayId)
                : [...prev, dayId].sort()
        );
    };

    const handleQuickRecurringChange = (option: DropdownOption) => {
        const value = option.data as string;
        setQuickRecurring(value);

        // Update selected days based on quick option
        if (value === 'once') setSelectedDays([]);
        else if (value === 'daily') setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
        else if (value === 'weekdays') setSelectedDays([0, 1, 2, 3, 4]);
        else if (value === 'weekends') setSelectedDays([5, 6]);
        // 'custom' keeps current selection
    };

    const previewSound = (filename: string) => {
        stopSound(previewAudioRef.current);
        previewAudioRef.current = playAlarmSound(filename);
        // Stop after 2 seconds
        setTimeout(() => stopSound(previewAudioRef.current), 2000);
    };

    const handleSave = async () => {
        stopSound(previewAudioRef.current);

        // Build recurring string
        let recurring: RecurringType;
        if (quickRecurring === 'custom') {
            if (selectedDays.length === 0) {
                recurring = 'once';
            } else if (selectedDays.length === 7) {
                recurring = 'daily';
            } else if (JSON.stringify(selectedDays) === JSON.stringify([0, 1, 2, 3, 4])) {
                recurring = 'weekdays';
            } else if (JSON.stringify(selectedDays) === JSON.stringify([5, 6])) {
                recurring = 'weekends';
            } else {
                recurring = selectedDays.join(',');
            }
        } else {
            recurring = quickRecurring as RecurringType;
        }

        await onSave(hour, minute, label, recurring, selectedSound, volume, snoozeDuration, subtleMode, autoSuspend);
        closeModal?.();
    };

    const handleDelete = async () => {
        stopSound(previewAudioRef.current);
        await onDelete?.();
        closeModal?.();
    };

    const handleCancel = () => {
        stopSound(previewAudioRef.current);
        closeModal?.();
    };

    // Build sound dropdown options
    const soundOptions: DropdownOption[] = sounds.map(s => ({
        data: s.filename,
        label: s.name
    }));

    return (
        <ConfirmModal
            strTitle={isEditing ? '✏️ Edit Alarm' : '🔔 New Alarm'}
            strDescription=""
            strOKButtonText={isEditing ? 'Save Changes' : 'Set Alarm'}
            strCancelButtonText="Cancel"
            onOK={handleSave}
            onCancel={handleCancel}
        >
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                padding: '8px 0',
                minWidth: 400
            }}>
                {/* Time Picker */}
                <div>
                    <div style={{
                        fontSize: 13,
                        color: '#888888',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        <FaBell size={12} />
                        Alarm Time
                    </div>
                    <Focusable
                        flow-children="row"
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 12
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
                                fontSize: 56,
                                fontWeight: 'bold',
                                fontFamily: 'monospace',
                                width: 90,
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

                        <div style={{ fontSize: 56, fontWeight: 'bold' }}>:</div>

                        {/* Minute selector */}
                        <Focusable style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <ArrowButton
                                direction="up"
                                onActivate={() => adjustTime('minute', 1)}
                                onStartRepeat={() => startRepeating(() => adjustTime('minute', 1))}
                                onStopRepeat={stopRepeating}
                            />
                            <div style={{
                                fontSize: 56,
                                fontWeight: 'bold',
                                fontFamily: 'monospace',
                                width: 90,
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
                </div>

                {/* Label */}
                <div>
                    <TextField
                        label="Alarm Label (optional)"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                    />
                </div>

                {/* Recurrence */}
                <div>
                    <div style={{
                        fontSize: 13,
                        color: '#888888',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        <FaCalendarAlt size={12} />
                        Repeat
                    </div>

                    {/* Quick options dropdown */}
                    <div style={{ marginBottom: 12 }}>
                        <Dropdown
                            rgOptions={QUICK_RECURRING_OPTIONS}
                            selectedOption={quickRecurring}
                            onChange={handleQuickRecurringChange}
                            strDefaultLabel="When to repeat"
                        />
                    </div>

                    {/* Custom day selector - shown when custom is selected */}
                    {quickRecurring === 'custom' && (
                        <div>
                            <div style={{
                                fontSize: 12,
                                color: '#666666',
                                marginBottom: 8,
                                textAlign: 'center'
                            }}>
                                Select days to repeat:
                            </div>
                            <Focusable
                                flow-children="row"
                                style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: 6
                                }}
                            >
                                {DAYS_OF_WEEK.map(day => (
                                    <DayToggle
                                        key={day.id}
                                        day={day}
                                        selected={selectedDays.includes(day.id)}
                                        onToggle={() => toggleDay(day.id)}
                                    />
                                ))}
                            </Focusable>
                        </div>
                    )}
                </div>

                {/* Sound Selection */}
                <div>
                    <div style={{
                        fontSize: 13,
                        color: '#888888',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        <FaMusic size={12} />
                        Alarm Sound
                    </div>
                    <Focusable
                        flow-children="row"
                        style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center'
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <Dropdown
                                rgOptions={soundOptions}
                                selectedOption={selectedSound}
                                onChange={(option) => setSelectedSound(option.data as string)}
                                strDefaultLabel="Select sound"
                            />
                        </div>
                        <Focusable
                            onActivate={() => previewSound(selectedSound)}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: '#ffffff22',
                                borderRadius: 6,
                                fontSize: 12
                            }}
                        >
                            ▶ Preview
                        </Focusable>
                    </Focusable>
                </div>

                {/* Volume */}
                <div>
                    <div style={{
                        fontSize: 13,
                        color: '#888888',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        <FaVolumeUp size={12} /> Volume
                    </div>
                    <SliderField
                        value={volume}
                        min={0}
                        max={100}
                        step={5}
                        onChange={setVolume}
                        showValue
                    />
                </div>

                {/* Snooze Duration */}
                <div>
                    <div style={{
                        fontSize: 13,
                        color: '#888888',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        ⏰ Snooze Duration
                    </div>
                    <SliderField
                        value={snoozeDuration}
                        min={1}
                        max={30}
                        step={1}
                        onChange={setSnoozeDuration}
                        showValue
                    />
                    <div style={{ fontSize: 11, color: '#666666', marginTop: 4 }}>
                        {snoozeDuration} minutes
                    </div>
                </div>

                {/* Behavior Settings */}
                <div>
                    <div style={{
                        fontSize: 13,
                        color: '#888888',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        ⚙️ Behavior
                    </div>
                    <Focusable style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Focusable
                            onActivate={() => setSubtleMode(!subtleMode)}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                backgroundColor: '#ffffff11',
                                borderRadius: 6
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 13 }}>📵 Subtle Mode</div>
                                <div style={{ fontSize: 11, color: '#888888' }}>
                                    Show only a toast notification
                                </div>
                            </div>
                            <div style={{
                                width: 40,
                                height: 22,
                                backgroundColor: subtleMode ? '#44aa44' : '#ffffff33',
                                borderRadius: 11,
                                position: 'relative',
                                transition: 'all 0.2s'
                            }}>
                                <div style={{
                                    width: 18,
                                    height: 18,
                                    backgroundColor: '#ffffff',
                                    borderRadius: 9,
                                    position: 'absolute',
                                    top: 2,
                                    left: subtleMode ? 20 : 2,
                                    transition: 'all 0.2s'
                                }} />
                            </div>
                        </Focusable>
                        <Focusable
                            onActivate={() => setAutoSuspend(!autoSuspend)}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                backgroundColor: '#ffffff11',
                                borderRadius: 6
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 13 }}>💤 Auto Suspend</div>
                                <div style={{ fontSize: 11, color: '#888888' }}>
                                    Put device to sleep after alarm
                                </div>
                            </div>
                            <div style={{
                                width: 40,
                                height: 22,
                                backgroundColor: autoSuspend ? '#44aa44' : '#ffffff33',
                                borderRadius: 11,
                                position: 'relative',
                                transition: 'all 0.2s'
                            }}>
                                <div style={{
                                    width: 18,
                                    height: 18,
                                    backgroundColor: '#ffffff',
                                    borderRadius: 9,
                                    position: 'absolute',
                                    top: 2,
                                    left: autoSuspend ? 20 : 2,
                                    transition: 'all 0.2s'
                                }} />
                            </div>
                        </Focusable>
                    </Focusable>
                </div>

                {/* Delete button for editing */}
                {isEditing && onDelete && (
                    <div style={{ borderTop: '1px solid #ffffff22', paddingTop: 16 }}>
                        <Focusable
                            onActivate={handleDelete}
                            style={{
                                padding: '10px 16px',
                                backgroundColor: '#aa4444',
                                borderRadius: 8,
                                textAlign: 'center',
                                fontSize: 14
                            }}
                        >
                            🗑️ Delete Alarm
                        </Focusable>
                    </div>
                )}
            </div>
        </ConfirmModal>
    );
}

export default showAlarmEditorModal;
