import type { IconType } from "react-icons";
import { FaGamepad, FaMoon, FaPowerOff, FaShieldAlt, FaVolumeMute } from "react-icons/fa";

export type ItemBadgeKind = "prevent_sleep" | "screensaver" | "auto_suspend" | "subtle" | "gaming_only";

interface BadgeSpec {
    Icon: IconType;
    title: string;
    color: string;
    focusedColor: string;
}

/** Shared icon, label, and color for every per-item option across panels, overlay, and screensaver. */
export const ITEM_BADGES: Record<ItemBadgeKind, BadgeSpec> = {
    prevent_sleep: { Icon: FaShieldAlt, title: "Prevent Sleep", color: "#e69900", focusedColor: "#ffcc66" },
    screensaver: { Icon: FaMoon, title: "Screensaver", color: "#9a9ac8", focusedColor: "#dcdcff" },
    auto_suspend: { Icon: FaPowerOff, title: "Auto Suspend", color: "#b48ad6", focusedColor: "#e6c8ff" },
    subtle: { Icon: FaVolumeMute, title: "Subtle Mode", color: "#88aa88", focusedColor: "#c8eec8" },
    gaming_only: { Icon: FaGamepad, title: "Only while gaming", color: "#7fb2d9", focusedColor: "#cfe6ff" },
};

export interface ItemBadgeSource {
    prevent_sleep?: boolean;
    screensaver_mode?: string;
    auto_suspend?: boolean;
    subtle_mode?: boolean;
    only_while_gaming?: boolean;
}

/** Badges in display order. The screensaver only runs under Prevent Sleep; auto suspend implies subtle. */
export function itemBadgeKinds(item: ItemBadgeSource): ItemBadgeKind[] {
    const kinds: ItemBadgeKind[] = [];
    if (item.prevent_sleep) {
        kinds.push("prevent_sleep");
        if (item.screensaver_mode && item.screensaver_mode !== "off") kinds.push("screensaver");
    }
    if (item.auto_suspend) kinds.push("auto_suspend");
    else if (item.subtle_mode) kinds.push("subtle");
    if (item.only_while_gaming) kinds.push("gaming_only");
    return kinds;
}

interface ItemBadgesProps {
    item: ItemBadgeSource;
    size?: number;
    focused?: boolean;
    /** Inherit the surrounding text color (overlay accent); Prevent Sleep keeps its amber. */
    monochrome?: boolean;
    exclude?: ItemBadgeKind[];
}

export const ItemBadges = ({ item, size = 10, focused = false, monochrome = false, exclude }: ItemBadgesProps) => {
    const kinds = itemBadgeKinds(item).filter((kind) => !exclude?.includes(kind));
    if (kinds.length === 0) return null;

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: Math.max(3, Math.round(size * 0.4)),
                flexShrink: 0,
                lineHeight: 1,
            }}
        >
            {kinds.map((kind) => {
                const { Icon, title, color, focusedColor } = ITEM_BADGES[kind];
                const inherit = monochrome && kind !== "prevent_sleep";
                return (
                    <Icon
                        key={kind}
                        size={size}
                        title={title}
                        color={inherit ? undefined : focused ? focusedColor : color}
                        style={{ flexShrink: 0, opacity: inherit ? 0.8 : 1 }}
                    />
                );
            })}
        </span>
    );
};

/** Leading icon for the matching option toggle, so toggles and badges share one glyph. */
export const ItemBadgeIcon = ({ kind, size = 14 }: { kind: ItemBadgeKind; size?: number }) => {
    const { Icon, color } = ITEM_BADGES[kind];
    return <Icon size={size} color={color} />;
};
