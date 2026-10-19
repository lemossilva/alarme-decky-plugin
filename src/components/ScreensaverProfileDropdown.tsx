import { Dropdown } from "@decky/ui";
import { FaLayerGroup } from "react-icons/fa";
import { useScreensaverProfiles } from "../hooks/useScreensaverProfiles";
import type { ScreensaverMode, ScreensaverProfileSlot, UserSettings } from "../types";

const PROFILE_SLOTS: ScreensaverProfileSlot[] = ["slot_1", "slot_2", "slot_3"];
const CURRENT_SETTINGS = "current";

const MODE_LABELS: Record<ScreensaverMode, string> = {
    black: "Black",
    dim: "Dim",
    wallpaper: "Wallpaper",
};

export function screensaverToggleDescription(settings: Pick<UserSettings, "screensaver_mode">): string {
    const mode = MODE_LABELS[settings.screensaver_mode] ?? MODE_LABELS.dim;
    return `Currently set to ${mode} · Change in Settings → Screensaver`;
}

interface ScreensaverProfileDropdownProps {
    value: ScreensaverProfileSlot | null | undefined;
    onChange: (slot: ScreensaverProfileSlot | null) => void;
    indent?: number;
}

/** Picks the screensaver profile an item applies when its screensaver arms. */
export const ScreensaverProfileDropdown = ({ value, onChange, indent = 40 }: ScreensaverProfileDropdownProps) => {
    const { profiles } = useScreensaverProfiles();
    const savedSlots = PROFILE_SLOTS.filter((slot) => profiles[slot]);
    const options = [
        { data: CURRENT_SETTINGS, label: "Current settings" },
        ...savedSlots.map((slot) => ({ data: slot, label: profiles[slot]?.name || slot })),
    ];
    const selected = value && profiles[value] ? value : CURRENT_SETTINGS;

    return (
        <div style={{ paddingLeft: indent }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                <FaLayerGroup style={{ color: "#888", flexShrink: 0 }} />
                <span style={{ flexShrink: 0 }}>Profile</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Dropdown
                        rgOptions={options}
                        selectedOption={selected}
                        disabled={savedSlots.length === 0}
                        onChange={(option) =>
                            onChange(option.data === CURRENT_SETTINGS ? null : (option.data as ScreensaverProfileSlot))
                        }
                        strDefaultLabel="Current settings"
                    />
                </div>
            </div>
            {savedSlots.length === 0 && (
                <div style={{ fontSize: 11, color: "#666", padding: "4px 0 0 0" }}>
                    Save a profile in Settings → Screensaver to pick it here.
                </div>
            )}
        </div>
    );
};
