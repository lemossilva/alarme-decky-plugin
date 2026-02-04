import {
    ButtonItem,
    Focusable,
    PanelSection,
    PanelSectionRow
} from "@decky/ui";
import { FaCog } from "react-icons/fa";
import { navigateToSettings } from "./SettingsModal";

export function SettingsPanel() {
    return (
        <div>
            <PanelSection>
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        icon={<FaCog />}
                        onClick={navigateToSettings}
                    >
                        Open Settings
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection>
                <PanelSectionRow>
                    <Focusable style={{ width: '100%' }}>
                        <div style={{ fontSize: 13, color: '#888888', textAlign: 'center' }}>
                            <p style={{ marginBottom: 8 }}>
                                <strong>AlarMe</strong> v1.3.1
                            </p>
                            <p>
                                By Guilherme Lemos
                            </p>
                        </div>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>
        </div>
    );
}
