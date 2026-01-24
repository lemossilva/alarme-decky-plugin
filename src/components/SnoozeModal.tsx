import { ConfirmModal, Focusable, showModal } from "@decky/ui";
import { FaBell, FaBan, FaPowerOff, FaPlus, FaMinus } from "react-icons/fa";
import { playAlarmSound, stopSound } from "../utils/sounds";
import { SteamUtils } from "../utils/steam";
import { useEffect, useRef, useState } from "react";

interface SnoozeModalProps {
    id: string;
    label: string;
    type: 'timer' | 'alarm';
    sound?: string;
    volume?: number;
    onSnooze: (minutes: number) => void;
    onDismiss: () => void;
    closeModal?: () => void;
}

export function showSnoozeModal(props: SnoozeModalProps) {
    showModal(<SnoozeModalContent {...props} />);
}

// Focusable button with highlight
interface SnoozeButtonProps {
    label: string;
    onClick: () => void;
    isDefault?: boolean;
}

const SnoozeButton = ({ label, onClick, isDefault }: SnoozeButtonProps) => {
    const [focused, setFocused] = useState(false);

    return (
        <Focusable
            onActivate={onClick}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: isDefault ? 'bold' : 'normal',
                backgroundColor: focused ? '#5599bb' : (isDefault ? '#4488aa' : '#ffffff22'),
                color: '#ffffff',
                border: focused ? '2px solid white' : '2px solid transparent',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.1s ease-in-out',
                minWidth: 60
            }}
        >
            {label}
        </Focusable>
    );
};

function SnoozeModalContent({ id: _id, label, type, sound, volume, onSnooze, onDismiss, closeModal }: SnoozeModalProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [snoozeMinutes, setSnoozeMinutes] = useState(5);

    // Play alarm sound on mount with volume
    useEffect(() => {
        audioRef.current = playAlarmSound(sound || 'alarm.mp3', volume);

        return () => {
            stopSound(audioRef.current);
        };
    }, [sound, volume]);

    const handleSnooze = () => {
        stopSound(audioRef.current);
        onSnooze(snoozeMinutes);
        closeModal?.();
    };

    const handleDismiss = () => {
        stopSound(audioRef.current);
        onDismiss();
        closeModal?.();
    };

    const handleSuspend = async () => {
        stopSound(audioRef.current);
        onDismiss();
        closeModal?.();
        await SteamUtils.suspend();
    };

    const adjustSnooze = (delta: number) => {
        setSnoozeMinutes(m => Math.max(1, Math.min(60, m + delta)));
    };

    return (
        <ConfirmModal
            strTitle={type === 'timer' ? '⏰ Timer Finished!' : '🔔 Alarm!'}
            strDescription={label}
            strOKButtonText="Dismiss"
            strCancelButtonText="Suspend"
            onOK={handleDismiss}
            onCancel={handleSuspend}
        >
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '16px 0'
            }}>
                {/* Animated Bell */}
                <div style={{
                    fontSize: 48,
                    marginBottom: 16,
                    animation: 'shake 0.5s infinite'
                }}>
                    {type === 'timer' ? '⏰' : '🔔'}
                </div>

                {/* Label */}
                <div style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    marginBottom: 20,
                    textAlign: 'center'
                }}>
                    {label}
                </div>

                {/* Snooze Controls (for alarms only) */}
                {type === 'alarm' && (
                    <div style={{ marginBottom: 16, width: '100%' }}>
                        <div style={{
                            fontSize: 13,
                            color: '#888888',
                            marginBottom: 8,
                            textAlign: 'center'
                        }}>
                            <FaBell style={{ marginRight: 6 }} />
                            Snooze Duration
                        </div>

                        {/* Snooze time adjuster */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            marginBottom: 12
                        }}>
                            <Focusable
                                onActivate={() => adjustSnooze(-5)}
                                style={{
                                    padding: 8,
                                    backgroundColor: '#aa4444',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <FaMinus size={12} />
                            </Focusable>
                            <Focusable
                                onActivate={() => adjustSnooze(-1)}
                                style={{
                                    padding: 8,
                                    backgroundColor: '#aa6644',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                -1
                            </Focusable>

                            <div style={{
                                fontSize: 24,
                                fontWeight: 'bold',
                                minWidth: 60,
                                textAlign: 'center'
                            }}>
                                {snoozeMinutes} min
                            </div>

                            <Focusable
                                onActivate={() => adjustSnooze(1)}
                                style={{
                                    padding: 8,
                                    backgroundColor: '#44aa66',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                +1
                            </Focusable>
                            <Focusable
                                onActivate={() => adjustSnooze(5)}
                                style={{
                                    padding: 8,
                                    backgroundColor: '#44aa44',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <FaPlus size={12} />
                            </Focusable>
                        </div>

                        {/* Snooze button */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <SnoozeButton
                                label={`Snooze ${snoozeMinutes} min`}
                                onClick={handleSnooze}
                                isDefault={true}
                            />
                        </div>
                    </div>
                )}

                {/* Action hints */}
                <div style={{
                    display: 'flex',
                    gap: 20,
                    marginTop: 8,
                    fontSize: 12,
                    color: '#666666'
                }}>
                    <span>
                        <FaBan style={{ marginRight: 4 }} />
                        A = Dismiss
                    </span>
                    <span>
                        <FaPowerOff style={{ marginRight: 4 }} />
                        B = Suspend
                    </span>
                </div>
            </div>

            {/* CSS Animation */}
            <style>{`
        @keyframes shake {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
      `}</style>
        </ConfirmModal>
    );
}

export default showSnoozeModal;
