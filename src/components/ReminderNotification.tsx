import { ConfirmModal } from "@decky/ui";
import { FaRedo } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";
import { playAlarmSound, stopSound } from "../utils/sounds";
import { useGameStatus } from "../hooks/useGameStatus";
import { formatTime } from "../utils/time";
import type { Reminder } from "../types";

interface Props {
    reminder: Reminder;
    closeModal?: () => void;
    onDisable?: () => void;
    sound?: string;
    volume?: number;
    use24h?: boolean;
}

export const ReminderNotification = ({ reminder, closeModal, onDisable, sound, volume, use24h = true }: Props) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [canInteract, setCanInteract] = useState(false);
    const isGameRunning = useGameStatus();

    // Current time for display
    const getCurrentTime = () => {
        const now = new Date();
        return formatTime(now.getHours(), now.getMinutes(), use24h);
    };
    const [currentTime] = useState(getCurrentTime());

    useEffect(() => {
        let mounted = true;
        playAlarmSound(sound || 'alarm.mp3', volume).then(audio => {
            if (mounted) {
                audioRef.current = audio;
            } else if (audio) {
                // If unmounted before promise resolved, stop the sound immediately
                stopSound(audio);
            }
        });

        return () => {
            mounted = false;
            if (audioRef.current) {
                stopSound(audioRef.current);
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

    const handleDismiss = () => {
        if (!canInteract) return;
        closeModal?.();
    };

    const handleDisable = () => {
        if (!canInteract) return;
        onDisable?.();
        closeModal?.();
    };

    return (
        <ConfirmModal
            strTitle="⏰ Reminder"
            strOKButtonText="Dismiss"
            strCancelButtonText="Turn off reminder"
            onOK={handleDismiss}
            onCancel={handleDisable}
        >
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: '16px 0'
            }}>
                <div style={{ animation: 'bounce 2s infinite' }}>
                    <FaRedo size={48} color="#88aaff" />
                </div>

                {/* Current time display */}
                <div style={{ fontSize: 14, color: '#888888', marginBottom: -8 }}>
                    {currentTime}
                </div>

                <div style={{
                    fontSize: 20,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    maxWidth: '90%'
                }}>
                    {reminder.label || "Time for a break!"}
                </div>

                <div style={{ fontSize: 13, color: '#aaaaaa' }}>
                    {(reminder.triggers_remaining ?? -1) >= 0
                        ? `${reminder.triggers_remaining} repeats remaining`
                        : "Periodic Reminder"}
                </div>

                {!canInteract && (
                    <div style={{ fontSize: 11, color: '#666666', marginTop: 8 }}>
                        Wait a moment...
                    </div>
                )}
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
            `}</style>
        </ConfirmModal>
    );
};
