import { ConfirmModal, showModal, TextField, Focusable } from "@decky/ui";
import { callable } from "@decky/api";
import { useState, useEffect } from "react";
import { FaCopy, FaPaste, FaCheck } from "react-icons/fa";

const exportBackupCall = callable<[], string>('export_backup');
const importBackupCall = callable<[string], boolean>('import_backup');

const ExportModalContent = ({ closeModal }: { closeModal?: () => void }) => {
    const [data, setData] = useState("Generating backup...");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        exportBackupCall().then(setData).catch(e => setData(`Error: ${e}`));
    }, []);

    const handleCopy = () => {
        // Try standard clipboard API (might fail in game mode depending on focus)
        try {
            navigator.clipboard.writeText(data);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error("Clipboard copy failed", e);
        }
    };

    return (
        <ConfirmModal
            strTitle="📤 Export Configuration"
            strDescription="Copy the text below to save your backup."
            strOKButtonText="Close"
            onOK={() => closeModal?.()}
            onCancel={() => closeModal?.()}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Focusable style={{ position: 'relative' }}>
                    <TextField
                        value={data}
                        onChange={() => { }} // Read-only
                        label="Backup Data (Select All & Copy)"
                    />
                    {/* Overlay copy button if possible, but simple instructions are safer */}
                </Focusable>

                <Focusable
                    onActivate={handleCopy}
                    style={{
                        padding: '10px 16px',
                        backgroundColor: copied ? '#44aa44' : '#ffffff22',
                        borderRadius: 4,
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                    }}
                >
                    {copied ? <FaCheck /> : <FaCopy />}
                    {copied ? "Copied to Clipboard!" : "Copy to Clipboard"}
                </Focusable>

                <div style={{ fontSize: 12, color: '#888888' }}>
                    If the button doesn't work, please verify manually if you have copied the text.
                </div>
            </div>
        </ConfirmModal>
    );
};

const ImportModalContent = ({ closeModal }: { closeModal?: () => void }) => {
    const [data, setData] = useState("");
    const [status, setStatus] = useState<string>("");

    const handleImport = async () => {
        if (!data.trim()) return;

        setStatus("Importing...");
        try {
            const success = await importBackupCall(data);
            if (success) {
                setStatus("Success! Configuration restored.");
                setTimeout(() => closeModal?.(), 1000);
            } else {
                setStatus("Error: Invalid backup data.");
            }
        } catch (e) {
            setStatus(`Error: ${e}`);
        }
    };

    return (
        <ConfirmModal
            strTitle="📥 Import Configuration"
            strDescription="Paste your backup string below."
            strOKButtonText="Import"
            strCancelButtonText="Cancel"
            onOK={handleImport}
            onCancel={() => closeModal?.()}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <TextField
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    label="Paste Backup Data Here"
                />

                {status && (
                    <div style={{
                        color: status.includes("Error") ? '#ff6666' : '#44aa44',
                        textAlign: 'center',
                        fontWeight: 'bold'
                    }}>
                        {status}
                    </div>
                )}
            </div>
        </ConfirmModal>
    );
};

export function showExportModal() {
    showModal(<ExportModalContent />);
}

export function showImportModal() {
    showModal(<ImportModalContent />);
}
