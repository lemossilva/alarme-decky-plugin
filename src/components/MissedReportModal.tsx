import { ConfirmModal, showModal, Focusable } from "@decky/ui";
import { callable } from "@decky/api";
import { FaBell, FaStopwatch, FaRedo, FaBrain } from "react-icons/fa";
import { MissedItem } from "../types";

const clearMissedItems = callable<[], boolean>('clear_missed_items');

interface MissedReportModalProps {
    items: MissedItem[];
    closeModal?: () => void;
}

export function showMissedReportModal(items: MissedItem[]) {
    showModal(<MissedReportModalContent items={items} />);
}

function MissedReportModalContent({ items, closeModal }: MissedReportModalProps) {
    const handleDismiss = async () => {
        await clearMissedItems();
        closeModal?.();
    };

    const handleCancel = () => {
        closeModal?.();
    };

    // Format time helper (simple JS date, effectively local time)
    const formatDueTime = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                {items.map((item, idx) => (
                    <div key={`spacer-${idx}`} style={{ display: 'contents' }}>
                        {idx > 0 && <div style={{ height: 1, minHeight: 1, width: '100%', flexShrink: 0 }} />}
                        <Focusable key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: '#ffffff11',
                            padding: '10px 12px',
                            borderRadius: 8,
                            gap: 12,
                            transition: 'background-color 0.2s'
                        }}>
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
                    </div>
                ))}
            </div>
        </ConfirmModal>
    );
}

export default showMissedReportModal;
