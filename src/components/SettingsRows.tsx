import { Dropdown, DropdownProps, PanelSectionRow } from "@decky/ui";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";

/** Left inset of an option that belongs to the toggle or row above it. */
export const SETTINGS_INDENT = 40;

const NOTE_STYLES = {
    intro: { fontSize: 12, color: "#aaaaaa", lineHeight: 1.5, padding: "4px 0 6px 0" },
    hint: { fontSize: 11, color: "#888888", lineHeight: 1.45, padding: "2px 0 6px 0" },
} as const;

interface SettingsNoteProps {
    children: ReactNode;
    /** intro opens a section; hint explains the row above it. */
    tone?: keyof typeof NOTE_STYLES;
    indent?: boolean;
}

export const SettingsNote = ({ children, tone = "hint", indent = false }: SettingsNoteProps) => (
    <PanelSectionRow>
        <div style={{ ...NOTE_STYLES[tone], paddingLeft: indent ? SETTINGS_INDENT : undefined }}>{children}</div>
    </PanelSectionRow>
);

interface DropdownRowProps extends DropdownProps {
    icon: IconType;
    label: string;
    /** Explanation kept inside the row so it sits tight under the dropdown. */
    description?: ReactNode;
    indent?: boolean;
}

/** Icon, label, and dropdown on one line; every settings dropdown goes through this. */
export const DropdownRow = ({ icon: Icon, label, description, indent = false, ...dropdownProps }: DropdownRowProps) => (
    <PanelSectionRow>
        <div style={{ paddingLeft: indent ? SETTINGS_INDENT : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                <Icon style={{ color: "#888", flexShrink: 0 }} />
                <span style={{ flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Dropdown {...dropdownProps} />
                </div>
            </div>
            {description && <div style={{ ...NOTE_STYLES.hint, padding: "6px 0 0 0" }}>{description}</div>}
        </div>
    </PanelSectionRow>
);
