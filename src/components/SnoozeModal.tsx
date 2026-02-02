import { ConfirmModal, Focusable, showModal } from "@decky/ui";
import { callable } from "@decky/api";
import { FaBell, FaBan, FaPowerOff, FaPlus, FaMinus } from "react-icons/fa";
import { playAlarmSound, stopSound } from "../utils/sounds";
import { SteamUtils } from "../utils/steam";
import { useGameStatus } from "../hooks/useGameStatus";
import { useEffect, useRef, useState } from "react";

// Backend callable for base64 sound data
const getSoundDataCall = callable<[filename: string], { success: boolean; data: string | null; mime_type: string | null; error?: string }>('get_sound_data');

interface SnoozeModalProps {
    id: string;
    label: string;
    type: 'timer' | 'alarm';
    sound?: string;
    volume?: number;
    defaultSnoozeDuration?: number;
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

function SnoozeModalContent({ id: _id, label, type, sound, volume, defaultSnoozeDuration, onSnooze, onDismiss, closeModal }: SnoozeModalProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blobUrlRef = useRef<string | null>(null);
    const [snoozeMinutes, setSnoozeMinutes] = useState(defaultSnoozeDuration ?? 5);
    const [canInteract, setCanInteract] = useState(false);
    const isGameRunning = useGameStatus();

    // Play alarm sound on mount with volume, supporting custom sounds via base64
    useEffect(() => {
        let mounted = true;
        const soundFile = sound || 'alarm.mp3';

        const playCustomSound = async () => {
            try {
                const result = await getSoundDataCall(soundFile);
                if (!result.success || !result.data || !result.mime_type) {
                    console.error('[Alarme] SnoozeModal: Failed to load custom sound:', result.error);
                    return;
                }

                // Convert base64 to blob URL
                const byteCharacters = atob(result.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: result.mime_type });
                blobUrlRef.current = URL.createObjectURL(blob);

                // Play via HTML5 Audio
                const audio = new Audio(blobUrlRef.current);
                audio.volume = Math.min(1, Math.max(0, (volume ?? 100) / 100));
                audio.loop = true; // Keep playing until dismissed
                await audio.play();
                audioRef.current = audio;
                console.log('[Alarme] SnoozeModal: Custom sound playing');
            } catch (e) {
                console.error('[Alarme] SnoozeModal: Failed to play custom sound:', e);
            }
        };

        if (soundFile.startsWith('custom:')) {
            // Custom sounds via base64
            playCustomSound();
        } else {
            // Built-in sounds
            playAlarmSound(soundFile, volume).then(audio => {
                if (mounted) {
                    audioRef.current = audio;
                    if (audioRef.current) {
                        audioRef.current.loop = true;
                    }
                } else if (audio) {
                    stopSound(audio);
                }
            });
        }

        return () => {
            mounted = false;
            stopSound(audioRef.current);
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };
    }, [sound, volume]);

    // Delay to prevent accidental button presses ONLY if game is running
    useEffect(() => {
        if (!isGameRunning) {
            setCanInteract(true);
            return;
        }

        setCanInteract(false);
        const timer = setTimeout(() => setCanInteract(true), 2000);
        return () => clearTimeout(timer);
    }, [isGameRunning]);

    const handleSnooze = () => {
        if (!canInteract) return;
        stopSound(audioRef.current);
        onSnooze(snoozeMinutes);
        closeModal?.();
    };

    const handleDismiss = () => {
        if (!canInteract) return;
        stopSound(audioRef.current);
        onDismiss();
        closeModal?.();
    };

    const handleSuspend = async () => {
        if (!canInteract) return;
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

                {!canInteract && (
                    <div style={{ fontSize: 11, color: '#666666', marginTop: 8 }}>
                        Wait a moment...
                    </div>
                )}
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
