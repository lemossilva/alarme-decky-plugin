import { ConfirmModal, showModal, TextField, Focusable } from "@decky/ui";
import { callable } from "@decky/api";
import { useState } from "react";
import { FaSave, FaFileImport } from "react-icons/fa";

const exportBackupToFileCall = callable<[string], boolean>('export_backup_to_file');
const importBackupFromFileCall = callable<[string], boolean>('import_backup_from_file');

// Default path for Steam Deck user
const DEFAULT_BACKUP_PATH = "/home/deck/alarme_backup.json";

const ExportModalContent = ({ closeModal }: { closeModal?: () => void }) => {
    const [path, setPath] = useState(DEFAULT_BACKUP_PATH);
    const [status, setStatus] = useState<string>("");

    const handleExport = async () => {
        if (!path.trim()) return;

        setStatus("Exporting...");
        try {
            const success = await exportBackupToFileCall(path);
            if (success) {
                setStatus("Success! Backup saved.");
                setTimeout(() => closeModal?.(), 1500);
            } else {
                setStatus("Error: Export failed. Check logs.");
            }
        } catch (e) {
            setStatus(`Error: ${e}`);
        }
    };

    return (
        <ConfirmModal
            strTitle="📤 Export Configuration"
            strDescription="Enter the file path to save your backup."
            strOKButtonText="Export"
            strCancelButtonText="Cancel"
            onOK={handleExport}
            onCancel={() => closeModal?.()}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <TextField
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    label="Export File Path"
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

const ImportModalContent = ({ closeModal }: { closeModal?: () => void }) => {
    const [path, setPath] = useState(DEFAULT_BACKUP_PATH);
    const [status, setStatus] = useState<string>("");

    const handleImport = async () => {
        if (!path.trim()) return;

        setStatus("Importing...");
        try {
            const success = await importBackupFromFileCall(path);
            if (success) {
                setStatus("Success! Configuration restored.");
                setTimeout(() => closeModal?.(), 1500);
            } else {
                setStatus("Error: Import failed. File not found or invalid.");
            }
        } catch (e) {
            setStatus(`Error: ${e}`);
        }
    };

    return (
        <ConfirmModal
            strTitle="📥 Import Configuration"
            strDescription="Enter the file path to load your backup from."
            strOKButtonText="Import"
            strCancelButtonText="Cancel"
            onOK={handleImport}
            onCancel={() => closeModal?.()}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <TextField
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    label="Import File Path"
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
