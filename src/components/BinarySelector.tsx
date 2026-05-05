import { Focusable, PanelSectionRow } from "@decky/ui";
import { useState } from "react";

interface BinaryOption {
    value: string;
    label: string;
}

interface BinarySelectorProps {
    label: string;
    description?: string;
    leftOption: BinaryOption;
    rightOption: BinaryOption;
    value: string;
    onChange: (value: string) => void;
    icon?: React.ReactNode;
}

export const BinarySelector = ({
    label,
    description,
    leftOption,
    rightOption,
    value,
    onChange,
    icon
}: BinarySelectorProps) => {
    const [focusedLeft, setFocusedLeft] = useState(false);
    const [focusedRight, setFocusedRight] = useState(false);

    return (
        <PanelSectionRow>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                justifyContent: 'space-between',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 auto', minWidth: '150px' }}>
                    {icon && <div style={{ color: '#888', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</div>}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{label}</span>
                        {description && <span style={{ fontSize: 12, color: '#888' }}>{description}</span>}
                    </div>
                </div>

                <Focusable
                    flow-children="horizontal"
                    style={{
                        display: 'flex',
                        backgroundColor: '#1a1f2c',
                        borderRadius: 20,
                        padding: 4,
                        gap: 4,
                        flex: '0 0 auto'
                    }}
                >
                    <Focusable
                        onActivate={() => onChange(leftOption.value)}
                        onFocus={() => setFocusedLeft(true)}
                        onBlur={() => setFocusedLeft(false)}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 16,
                            backgroundColor: value === leftOption.value ? '#1a9fff' : (focusedLeft ? '#ffffff22' : 'transparent'),
                            color: value === leftOption.value ? 'white' : '#888',
                            fontSize: 12,
                            fontWeight: 600,
                            textAlign: 'center',
                            minWidth: 60,
                            transition: 'all 0.2s ease',
                            border: focusedLeft ? '1px solid white' : '1px solid transparent'
                        }}
                    >
                        {leftOption.label}
                    </Focusable>
                    <Focusable
                        onActivate={() => onChange(rightOption.value)}
                        onFocus={() => setFocusedRight(true)}
                        onBlur={() => setFocusedRight(false)}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 16,
                            backgroundColor: value === rightOption.value ? '#1a9fff' : (focusedRight ? '#ffffff22' : 'transparent'),
                            color: value === rightOption.value ? 'white' : '#888',
                            fontSize: 12,
                            fontWeight: 600,
                            textAlign: 'center',
                            minWidth: 60,
                            transition: 'all 0.2s ease',
                            border: focusedRight ? '1px solid white' : '1px solid transparent'
                        }}
                    >
                        {rightOption.label}
                    </Focusable>
                </Focusable>
            </div>
        </PanelSectionRow>
    );
};
