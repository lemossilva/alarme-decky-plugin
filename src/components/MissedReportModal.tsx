import { ConfirmModal, showModal, Focusable } from "@decky/ui";
import { callable } from "@decky/api";
import { FaBell, FaStopwatch, FaRedo, FaBrain } from "react-icons/fa";
import { MissedItem } from "../types";
import { formatTime } from "../utils/time";

const clearMissedItems = callable<[], boolean>('clear_missed_items');

interface MissedReportModalProps {
    items: MissedItem[];
    use24h: boolean;
    closeModal?: () => void;
}

export function showMissedReportModal(items: MissedItem[], use24h: boolean) {
    showModal(<MissedReportModalContent items={items} use24h={use24h} />);
}

function MissedReportModalContent({ items, use24h, closeModal }: MissedReportModalProps) {
    const handleDismiss = async () => {
        await clearMissedItems();
        closeModal?.();
    };

    const handleCancel = () => {
        closeModal?.();
    };

    // Format time helper - respects user's 12h/24h preference
    const formatDueTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return formatTime(date.getHours(), date.getMinutes(), use24h);
    };

    return (
        <ConfirmModal
            strTitle="Missed Alerts"
            strDescription={`You missed ${items.length} alerts while away.`}
            strOKButtonText="Clear & Close"
            strCancelButtonText="Keep & Close"
            onOK={handleDismiss}
            onCancel={handleCancel}
        >
            <div style={{
                height: '40vh',
                maxHeight: '400px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '4px 8px 4px 0',
                marginTop: '10px'
            }}>
                <Focusable>
                    {items.map((item, idx) => (
                        <Focusable
                            key={idx}
                            onActivate={() => {}}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: '#ffffff11',
                                padding: '10px 12px',
                                borderRadius: 8,
                                gap: 12,
                                marginBottom: idx < items.length - 1 ? 8 : 0,
                                transition: 'background-color 0.2s'
                            }}
                        >
                            <div style={{ fontSize: 18, color: '#aaeeff', display: 'flex', alignItems: 'center' }}>
                                {item.type === 'alarm' && <FaBell />}
                                {item.type === 'timer' && <FaStopwatch />}
                                {item.type === 'reminder' && <FaRedo />}
                                {item.type === 'pomodoro' && <FaBrain />}
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.label}</div>
                                <div style={{ fontSize: 12, color: '#aaaaaa' }}>
                                    {item.details || `Due at ${formatDueTime(item.due_time)}`}
                                </div>
                            </div>
                        </Focusable>
                    ))}
                </Focusable>
            </div>
        </ConfirmModal>
    );
}

export default showMissedReportModal;
