import {
    ConfirmModal,
    Dropdown,
    DropdownOption,
    Focusable,
    showModal,
    SliderField,
    ToggleField,
    TextField
} from "@decky/ui";
import { FaMusic, FaVolumeUp, FaClock, FaGamepad, FaRedo, FaPlay, FaPause, FaCalendarAlt, FaChevronUp, FaChevronDown } from "react-icons/fa";
import { useRef, useEffect, useState } from "react";

import { playAlarmSound, stopSound } from "../utils/sounds";
import type { Reminder, SoundFile } from "../types";

// Frequency options (in minutes)
const FREQUENCY_OPTIONS: DropdownOption[] = [
    { data: 15, label: '15 minutes' },
    { data: 30, label: '30 minutes' },
    { data: 45, label: '45 minutes' },
    { data: 60, label: '1 hour' },
    { data: 90, label: '1.5 hours' },
    { data: 120, label: '2 hours' },
    { data: 180, label: '3 hours' },
    { data: -1, label: 'Custom...' }
];

// Recurrence options
const RECURRENCE_OPTIONS: DropdownOption[] = [
    { data: -1, label: 'Forever (∞)' },
    { data: 1, label: '1 time' },
    { data: 2, label: '2 times' },
    { data: 3, label: '3 times' },
    { data: 5, label: '5 times' },
    { data: 10, label: '10 times' },
    { data: 0, label: 'Custom...' }
];

// Label presets
const LABEL_PRESETS = [
    "Take a Break",
    "Stand Up",
    "Drink Water",
    "Stretch",
    "Check Posture",
    "Eye Rest",
    "Hourly Reminder"
];

interface ReminderEditorModalProps {
    reminder?: Reminder;
    onSave: (
        label: string,
        frequencyMinutes: number,
        startTime: string | null,
        recurrences: number,
        onlyWhileGaming: boolean,
        resetOnGameStart: boolean,
        sound: string,
        volume: number,
        subtleMode: boolean
    ) => Promise<void>;
    onDelete?: () => Promise<void>;
    getSounds: () => Promise<SoundFile[]>;
    closeModal?: () => void;
}

export function showReminderEditorModal(props: ReminderEditorModalProps) {
    showModal(<ReminderEditorModalContent {...props} />);
}



function ReminderEditorModalContent({
    reminder,
    onSave,
    onDelete,
    getSounds,
    closeModal
}: ReminderEditorModalProps) {
    const isEditing = !!reminder;

    // State for form fields
    const [label, setLabel] = useState(reminder?.label || '');
    const [frequencyMinutes, setFrequencyMinutes] = useState(reminder?.frequency_minutes || 60);
    const [recurrences, setRecurrences] = useState(reminder?.recurrences ?? -1);
    const [onlyWhileGaming, setOnlyWhileGaming] = useState(reminder?.only_while_gaming ?? false);
    const [resetOnGameStart, setResetOnGameStart] = useState(reminder?.reset_on_game_start ?? false);
    const [sound, setSound] = useState(reminder?.sound || 'alarm.mp3');
    const [volume, setVolume] = useState(reminder?.volume ?? 100);
    const [subtleMode, setSubtleMode] = useState(reminder?.subtle_mode ?? false);

    // Initial time parsing
    const getInitialTime = () => {
        if (reminder?.start_time) {
            const d = new Date(reminder.start_time);
            if (!isNaN(d.getTime())) return { h: d.getHours(), m: d.getMinutes() };
        }
        const now = new Date();
        return { h: now.getHours(), m: now.getMinutes() };
    };

    const initialTime = getInitialTime();
    const [startHour, setStartHour] = useState(initialTime.h);
    const [startMinute, setStartMinute] = useState(initialTime.m);

    // Custom input states
    const [customFrequency, setCustomFrequency] = useState(false);
    const [customRecurrence, setCustomRecurrence] = useState(false);

    // Audio preview
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Available sounds
    const [sounds, setSounds] = useState<SoundFile[]>([]);
    const [showLabelPresets, setShowLabelPresets] = useState(false);

    // Load sounds and check for custom initial values
    useEffect(() => {
        getSounds().then(setSounds);

        // Check if initial values are custom (not in dropdown options)
        const isFreqInOptions = FREQUENCY_OPTIONS.some(o => o.data === reminder?.frequency_minutes);
        if (reminder && !isFreqInOptions) {
            setCustomFrequency(true);
        }

        const isRecInOptions = RECURRENCE_OPTIONS.some(o => o.data === reminder?.recurrences);
        if (reminder && reminder.recurrences !== -1 && !isRecInOptions) {
            setCustomRecurrence(true);
        }
    }, [getSounds, reminder]);

    // Cleanup sound on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                stopSound(audioRef.current);
            }
        };
    }, []);

    const toggleSoundPreview = () => {
        if (isPlaying && audioRef.current) {
            stopSound(audioRef.current);
            audioRef.current = null;
            setIsPlaying(false);
        } else {
            // Stop any previous sound
            if (audioRef.current) {
                stopSound(audioRef.current);
            }
            audioRef.current = playAlarmSound(sound, volume);
            if (audioRef.current) {
                setIsPlaying(true);
                audioRef.current.onended = () => {
                    setIsPlaying(false);
                    audioRef.current = null;
                };
            }
        }
    };

    const handleSave = async () => {
        // Prepare start time
        let finalStartTime = null;
        if (!onlyWhileGaming) {
            // Logic to determine if chosen time is today or tomorrow
            const now = new Date();
            const target = new Date();
            target.setHours(startHour, startMinute, 0, 0);

            // If target is earlier than now (with 1 min buffer), assume tomorrow
            if (target.getTime() < now.getTime() - 60000) {
                target.setDate(target.getDate() + 1);
            }
            // Use ISO string but correct local time zone issue if needed?
            // Actually implementation in main.py uses local time (datetime.now) usually.
            // But ISO string from JS Date is UTC? No, .toISOString() is UTC.
            // main.py uses datetime.fromisoformat which handles offset if present, else assumes naive local?
            // Wait, main.py uses datetime.now() -> local naive.
            // JS toISOString() -> UTC. 
            // We should send a string that main.py understands as local time or handle conversion.
            // Better: send "YYYY-MM-DDTHH:MM:SS" in local time.
            const offsetMs = target.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(target.getTime() - offsetMs)).toISOString().slice(0, -1);
            finalStartTime = localISOTime;
        }

        await onSave(
            label,
            frequencyMinutes,
            finalStartTime,
            recurrences,
            onlyWhileGaming,
            resetOnGameStart,
            sound,
            volume,
            subtleMode
        );
        closeModal?.();
    };

    const handleDelete = async () => {
        if (onDelete) {
            await onDelete();
        }
        closeModal?.();
    };

    const handleCancel = () => {
        closeModal?.();
    };

    const soundOptions: DropdownOption[] = sounds.map(s => ({
        data: s.filename,
        label: s.name
    }));

    return (
        <ConfirmModal
            strTitle={isEditing ? '✏️ Edit Reminder' : '➕ New Reminder'}
            strOKButtonText="Save"
            strCancelButtonText="Cancel"
            onOK={handleSave}
            onCancel={handleCancel}
            closeModal={closeModal}
        >
            <Focusable style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
                {/* Label Section */}
                <div>
                    <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#ccc' }}>
                        Label
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <TextField
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                            />
                        </div>
                        <Focusable
                            onActivate={() => setShowLabelPresets(!showLabelPresets)}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: '#ffffff22',
                                borderRadius: 4,
                                cursor: 'pointer'
                            }}
                        >
                            Presets
                        </Focusable>
                    </div>
                    {showLabelPresets && (
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 4,
                            marginTop: 8,
                            padding: 8,
                            backgroundColor: '#ffffff11',
                            borderRadius: 4
                        }}>
                            {LABEL_PRESETS.map(preset => (
                                <Focusable
                                    key={preset}
                                    onActivate={() => {
                                        setLabel(preset);
                                        setShowLabelPresets(false);
                                    }}
                                    style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#ffffff22',
                                        borderRadius: 4,
                                        fontSize: 12,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {preset}
                                </Focusable>
                            ))}
                        </div>
                    )}
                </div>

                {/* Frequency Section */}
                <div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8
                    }}>
                        <FaClock size={14} color="#88aaff" />
                        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#ccc' }}>
                            Remind every
                        </span>
                    </div>
                    <Dropdown
                        rgOptions={FREQUENCY_OPTIONS}
                        selectedOption={customFrequency ? -1 : frequencyMinutes}
                        onChange={(option: DropdownOption) => {
                            if (option.data === -1) {
                                setCustomFrequency(true);
                            } else {
                                setCustomFrequency(false);
                                setFrequencyMinutes(option.data as number);
                            }
                        }}
                    />
                    {customFrequency && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 12, color: '#aaa' }}>Duration</span>
                                <span style={{ fontSize: 12, fontWeight: 'bold' }}>{frequencyMinutes} min</span>
                            </div>
                            <SliderField
                                label="Minutes"
                                value={frequencyMinutes}
                                min={1}
                                max={240}
                                step={1}
                                onChange={setFrequencyMinutes}
                                showValue={false}
                            />
                        </div>
                    )}
                </div>

                {/* Recurrences Section */}
                <div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8
                    }}>
                        <FaRedo size={14} color="#aa88ff" />
                        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#ccc' }}>
                            How many times
                        </span>
                    </div>
                    <Dropdown
                        rgOptions={RECURRENCE_OPTIONS}
                        selectedOption={customRecurrence ? 0 : recurrences}
                        onChange={(option: DropdownOption) => {
                            if (option.data === 0) {
                                setCustomRecurrence(true);
                            } else {
                                setCustomRecurrence(false);
                                setRecurrences(option.data as number);
                            }
                        }}
                    />
                    {customRecurrence && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 12, color: '#aaa' }}>Count</span>
                                <span style={{ fontSize: 12, fontWeight: 'bold' }}>{recurrences} times</span>
                            </div>
                            <SliderField
                                label="Count"
                                value={recurrences === -1 ? 1 : recurrences}
                                min={1}
                                max={100}
                                step={1}
                                onChange={setRecurrences}
                                showValue={false}
                            />
                        </div>
                    )}
                </div>

                {/* Only While Gaming Toggle */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#ffffff11',
                    borderRadius: 8
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FaGamepad size={14} color="#88ff88" />
                        <div>
                            <div>Only while gaming</div>
                            <div style={{ fontSize: 10, color: '#888' }}>Pauses when not playing</div>
                        </div>
                    </div>
                    <ToggleField
                        checked={onlyWhileGaming}
                        onChange={setOnlyWhileGaming}
                        label=""
                    />
                </div>

                {/* Reset on Game Start (Nested under Only While Gaming) */}
                {onlyWhileGaming && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: '#ffffff11',
                        borderRadius: 8,
                        marginLeft: 16 // Indent to show relationship
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FaRedo size={12} color="#88ff88" />
                            <div>
                                <div>Reset on game launch</div>
                                <div style={{ fontSize: 10, color: '#888' }}>Restart timer when game opens</div>
                            </div>
                        </div>
                        <ToggleField
                            checked={resetOnGameStart}
                            onChange={setResetOnGameStart}
                            label=""
                        />
                    </div>
                )}


                {/* Start Time (Only when NOT gaming only) */}
                {!onlyWhileGaming && (
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 8
                        }}>
                            <FaCalendarAlt size={14} color="#88ddaa" />
                            <span style={{ fontSize: 14, fontWeight: 'bold', color: '#ccc' }}>
                                Start Time
                            </span>
                        </div>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 16,
                            padding: 12,
                            backgroundColor: '#00000033',
                            borderRadius: 8
                        }}>
                            {/* Hour Picker */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Focusable
                                    onActivate={() => setStartHour(h => (h + 1) % 24)}
                                    style={{ padding: 8, cursor: 'pointer' }}
                                >
                                    <FaChevronUp />
                                </Focusable>
                                <div style={{ fontSize: 24, fontWeight: 'bold', margin: '4px 0' }}>
                                    {startHour.toString().padStart(2, '0')}
                                </div>
                                <Focusable
                                    onActivate={() => setStartHour(h => (h - 1 + 24) % 24)}
                                    style={{ padding: 8, cursor: 'pointer' }}
                                >
                                    <FaChevronDown />
                                </Focusable>
                            </div>

                            <div style={{ fontSize: 24, fontWeight: 'bold', paddingBottom: 8 }}>:</div>

                            {/* Minute Picker */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Focusable
                                    onActivate={() => setStartMinute(m => (m + 1) % 60)}
                                    style={{ padding: 8, cursor: 'pointer' }}
                                >
                                    <FaChevronUp />
                                </Focusable>
                                <div style={{ fontSize: 24, fontWeight: 'bold', margin: '4px 0' }}>
                                    {startMinute.toString().padStart(2, '0')}
                                </div>
                                <Focusable
                                    onActivate={() => setStartMinute(m => (m - 1 + 60) % 60)}
                                    style={{ padding: 8, cursor: 'pointer' }}
                                >
                                    <FaChevronDown />
                                </Focusable>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 4, fontSize: 12, color: '#888' }}>
                            {(() => {
                                const now = new Date();
                                const target = new Date();
                                target.setHours(startHour, startMinute, 0, 0);
                                return target < now ? "Will start tomorrow" : "Will start today";
                            })()}
                        </div>
                    </div>
                )}

                {/* Sound Section */}
                <div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8
                    }}>
                        <FaMusic size={14} color="#ffaa88" />
                        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#ccc' }}>
                            Sound
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <Dropdown
                                rgOptions={soundOptions}
                                selectedOption={sound}
                                onChange={(option: DropdownOption) => setSound(option.data as string)}
                            />
                        </div>
                        <Focusable
                            onActivate={toggleSoundPreview}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: isPlaying ? '#44aa44' : '#ffffff22',
                                borderRadius: 4,
                                cursor: 'pointer',
                                minWidth: 80,
                                textAlign: 'center'
                            }}
                        >
                            {isPlaying ? (
                                <span><FaPause size={10} style={{ marginRight: 4 }} /> Stop</span>
                            ) : (
                                <span><FaPlay size={10} style={{ marginRight: 4 }} /> Play</span>
                            )}
                        </Focusable>
                    </div>
                </div>

                {/* Volume Slider */}
                <div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8
                    }}>
                        <FaVolumeUp size={14} color="#aaaaaa" />
                        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#ccc' }}>
                            Volume: {volume}%
                        </span>
                    </div>
                    <SliderField
                        value={volume}
                        min={0}
                        max={100}
                        step={10}
                        onChange={setVolume}
                        label=""
                        showValue={false}
                    />
                </div>

                {/* Subtle Mode Toggle */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#ffffff11',
                    borderRadius: 8
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>📵</span>
                        <span>Subtle mode</span>
                    </div>
                    <ToggleField
                        checked={subtleMode}
                        onChange={setSubtleMode}
                        label=""
                    />
                </div>

                {/* Delete Button (only when editing) */}
                {isEditing && onDelete && (
                    <Focusable
                        onActivate={handleDelete}
                        style={{
                            marginTop: 8,
                            padding: '10px 16px',
                            backgroundColor: '#aa333355',
                            borderRadius: 8,
                            textAlign: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        🗑️ Delete Reminder
                    </Focusable>
                )}
            </Focusable>
        </ConfirmModal >
    );
}

export default showReminderEditorModal;
