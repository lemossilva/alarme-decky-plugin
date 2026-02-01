import { ConfirmModal, TextField, showModal } from "@decky/ui";
import { useState } from "react";
import { formatDurationLong } from "../utils/time";

interface TimerLabelModalProps {
    seconds: number;
    onStart: (seconds: number, label: string) => void;
    closeModal?: () => void;
}

export function showTimerLabelModal(props: TimerLabelModalProps) {
    showModal(<TimerLabelModalContent {...props} />);
}

function TimerLabelModalContent({ seconds, onStart, closeModal }: TimerLabelModalProps) {
    const [label, setLabel] = useState('');

    const handleStart = () => {
        onStart(seconds, label);
        closeModal?.();
    };

    const handleCancel = () => {
        closeModal?.();
    };

    const durationStr = formatDurationLong(seconds);
    const minutes = Math.floor(seconds / 60);

    return (
        <ConfirmModal
            strTitle={`⏱️ Timer (${minutes} min)`}
            strDescription=""
            strOKButtonText="Start Timer"
            strCancelButtonText="Cancel"
            onOK={handleStart}
            onCancel={handleCancel}
        >
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                padding: '8px 0',
                minWidth: 350
            }}>
                {/* Timer duration display */}
                <div style={{
                    textAlign: 'center',
                    fontSize: 32,
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    color: '#88ccff'
                }}>
                    {durationStr}
                </div>

                {/* Label input */}
                <div>
                    <TextField
                        label="Timer Label (optional)"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                    />
                    <div style={{ fontSize: 11, color: '#888888', marginTop: 4 }}>
                        e.g., "Pasta ready", "Take a break"
                    </div>
                </div>
            </div>
        </ConfirmModal>
    );
}

export default showTimerLabelModal;
