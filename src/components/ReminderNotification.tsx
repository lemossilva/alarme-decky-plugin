import { ConfirmModal } from "@decky/ui";
import { FaRedo } from "react-icons/fa";
import { useEffect, useRef } from "react";
import { playAlarmSound, stopSound } from "../utils/sounds";
import type { Reminder } from "../types";

interface Props {
    reminder: Reminder;
    closeModal?: () => void;
    onDisable?: () => void;
    sound?: string;
    volume?: number;
}

export const ReminderNotification = ({ reminder, closeModal, onDisable, sound, volume }: Props) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = playAlarmSound(sound || 'alarm.mp3', volume);
        return () => {
            if (audioRef.current) {
                stopSound(audioRef.current);
            }
        };
    }, [sound, volume]);

    return (
        <ConfirmModal
            strTitle="⏰ Reminder"
            strOKButtonText="Dismiss"
            strCancelButtonText="Turn off reminder"
            onOK={() => closeModal?.()}
            onCancel={() => {
                onDisable?.();
                closeModal?.();
            }}
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
