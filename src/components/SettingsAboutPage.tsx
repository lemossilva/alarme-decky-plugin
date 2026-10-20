import { Focusable, PanelSection, PanelSectionRow } from "@decky/ui";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ITEM_BADGES, ItemBadgeIcon, type ItemBadgeKind } from "./ItemBadges";

const ManualRow = ({ title, description }: { title: string; description: ReactNode }) => {
    return (
        <Focusable
            onActivate={() => {}}
            onFocus={(e: any) => {
                e.target.style.backgroundColor = "#4488aa33";
                e.target.style.border = "2px solid white";
            }}
            onBlur={(e: any) => {
                e.target.style.backgroundColor = "transparent";
                e.target.style.border = "2px solid transparent";
            }}
            style={{
                padding: "10px 12px",
                backgroundColor: "transparent",
                borderRadius: 8,
                marginBottom: 4,
                border: "2px solid transparent",
                transition: "all 0.1s ease-in-out",
            }}
        >
            <strong style={{ color: "#4488aa", fontSize: 13 }}>{title}</strong>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2, lineHeight: 1.4 }}>{description}</div>
        </Focusable>
    );
};

type AboutInstructionsPageProps = {
    getVersionCall: () => Promise<string>;
};

export const AboutInstructionsPage = ({ getVersionCall }: AboutInstructionsPageProps) => {
    const [version, setVersion] = useState("");
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        getVersionCall()
            .then((v) => {
                if (mountedRef.current) setVersion((v || "").trim());
            })
            .catch(() => {
                if (mountedRef.current) setVersion("");
            });
    }, [getVersionCall]);

    return (
        <div
            style={{
                padding: "16px 24px 80px 24px",
                maxHeight: "calc(100vh - 60px)",
                overflowY: "auto",
            }}
        >
            {/* Invisible focusable anchor for scroll-to-top */}
            <PanelSection>
                <PanelSectionRow>
                    <Focusable
                        onActivate={() => {}}
                        style={{
                            height: 1,
                            opacity: 0,
                            outline: "none",
                        }}
                    >
                        <span></span>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection>
                <PanelSectionRow>
                    <Focusable style={{ width: "100%", textAlign: "center", padding: "12px 0" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                            AlarMe {version ? `v${version}` : "…"}
                        </div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                            Timers, alarms, reminders, Pomodoro, and stopwatch with overlay and screensaver support.
                        </div>
                        <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>By Guilherme Lemos</div>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="At a glance">
                <ManualRow
                    title="Main plugin view"
                    description="Use the top tabs for timers, alarms, Pomodoro, reminders, and stopwatch. Tab order is configurable under Settings → General."
                />
                <ManualRow
                    title="Settings sidebar"
                    description="Each page groups defaults for one area. This About page is a quick reference; overlay and screensaver have full detail on their own tabs."
                />
                <ManualRow
                    title="Option badges"
                    description={
                        <span style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                            {(Object.keys(ITEM_BADGES) as ItemBadgeKind[]).map((kind) => (
                                <span key={kind} style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                                    <ItemBadgeIcon kind={kind} size={11} />
                                    {ITEM_BADGES[kind].title}
                                </span>
                            ))}
                        </span>
                    }
                />
            </PanelSection>

            <PanelSection title="Timers">
                <ManualRow
                    title="Multiple timers"
                    description="Run several countdown timers at once. Each timer keeps its own label and duration."
                />
                <ManualRow
                    title="Presets"
                    description="Save favorite durations as presets when presets are enabled under Settings → Timers. Start them with one tap from the timer tab."
                />
                <ManualRow
                    title="Recent timers"
                    description="The last few timer configurations you used stay available for quick reuse."
                />
                <ManualRow
                    title="Per-timer options"
                    description="While creating or editing a timer you can enable Prevent Sleep, optional auto-suspend when it fires, subtle alerts, and the screensaver. Cards show the same option badges everywhere (see At a glance)."
                />
            </PanelSection>

            <PanelSection title="Alarms">
                <ManualRow
                    title="Time and repeat"
                    description="Pick hour and minute, then choose Once, Daily, Weekdays, or Weekends. Alarms persist across reboots."
                />
                <ManualRow
                    title="Snooze"
                    description="When an alarm fires, snooze uses the duration set under Settings → Alarms (1–30 minutes)."
                />
                <ManualRow
                    title="Subtle mode and suspend"
                    description="Per alarm you can prefer a small toast instead of a fullscreen alert, or send the Deck to sleep after the alert. Global defaults live under Settings → General and Alarms."
                />
            </PanelSection>

            <PanelSection title="Stopwatch">
                <ManualRow
                    title="Laps and overlay"
                    description="Record laps (up to the supported limit) and copy the list when needed. A running stopwatch can appear in the in-game overlay when that category is enabled under Settings → Overlay."
                />
                <ManualRow
                    title="After reboot"
                    description="Under Settings → Timers, optional “Reset after reboot” clears a running stopwatch on a full restart (wake from sleep does not reset it)."
                />
            </PanelSection>

            <PanelSection title="Pomodoro">
                <ManualRow
                    title="Focus cycle"
                    description="Work intervals, short breaks, long breaks, and how many focus rounds before a long break are configured under Settings → Pomodoro and on the Pomodoro tab."
                />
                <ManualRow
                    title="Statistics"
                    description="Daily and lifetime focus time and session counts are shown on the Pomodoro tab. You can reset statistics from there when you want a clean slate."
                />
                <ManualRow
                    title="Start automatically"
                    description="Settings → Pomodoro → Start automatically begins a focus session when the Deck boots, or on boot and every wake from sleep, if no session is already running."
                />
            </PanelSection>

            <PanelSection title="Reminders">
                <ManualRow
                    title="Interval reminders"
                    description="Periodic nudges on a fixed cadence. Optional gaming-only timing, start delay, and max repeats are under Settings → Reminders."
                />
                <ManualRow
                    title="While suspended"
                    description="Choose whether the reminder clock pauses during sleep or continues and may report as missed—the binary selector on the Reminders settings page explains each mode."
                />
            </PanelSection>

            <PanelSection title="In-game overlay">
                <ManualRow
                    title="What it shows"
                    description="A compact bar for upcoming timers, alarms, reminders, Pomodoro, and stopwatch. It can appear on the Steam UI, inside games, or both depending on Settings → Overlay → Show On."
                />
                <ManualRow
                    title="Quick Access Menu"
                    description="Opening AlarMe from the QAM uses the same routed UI as the library plugin page. If the bar seems missing, check that the overlay is enabled and not filtered out by category toggles."
                />
                <ManualRow
                    title="Full detail"
                    description="Position (anchor and offsets), text color, opacity, categories, and time window are under Settings → Overlay (About Overlay at the top of that tab)."
                />
            </PanelSection>

            <PanelSection title="Screensaver">
                <ManualRow
                    title="Layouts"
                    description="Compact (bar-style), Large (centered panel), or Fullscreen dim or wallpaper modes. Compact placement follows Overlay custom position when set."
                />
                <ManualRow
                    title="Large / Fullscreen widgets"
                    description="Big and small widget slots are on the Screensaver tab. An optional upcoming-alerts list sits under the small-widget row and has its own toggle; it does not use a small-widget slot."
                />
                <ManualRow
                    title="Wallpapers and profiles"
                    description="Choose a wallpaper source, pool size, and optional weather widgets. Save combinations to profile slots and switch from the Screensaver settings tab. Use Preview in the plugin header to test."
                />
                <ManualRow
                    title="Turning it on or off"
                    description="Each timer, alarm, reminder, stopwatch, and Pomodoro has its own Screensaver toggle under Prevent Sleep, with a Profile picker below it that applies a saved profile when that item's screensaver arms. Standalone Mode on the Screensaver tab covers idle time without alerts."
                />
                <ManualRow
                    title="Dismiss"
                    description="While the screensaver is showing, any gamepad button or a screen touch dismisses it temporarily."
                />
                <ManualRow
                    title="Weather"
                    description="Optional forecast uses Open-Meteo (no API key). Pick a city under Screensaver settings or use approximate IP-based location when none is saved."
                />
            </PanelSection>

            <PanelSection title="News Widget">
                <ManualRow
                    title="Headlines on screensaver"
                    description="Add the News widget to a small-widget slot on the screensaver info row. Enable feeds under Settings → News, then add News under Settings → Screensaver widgets."
                />
                <ManualRow
                    title="Reading an article"
                    description="Tap the newspaper icon in the plugin header (between Sleep and the screensaver preview when both are visible) to open the headline list. The first entry matches what the screensaver last showed. Use Open on any row to read it in the Steam browser."
                />
                <ManualRow
                    title="Feed sources"
                    description="Enable curated feeds or add your own RSS/Atom URLs under Settings → News. Custom feeds are tested (fetch and parse) before they are saved. Headlines from enabled sources are merged on the screensaver."
                />
                <ManualRow
                    title="Prefetch and refresh"
                    description="News headlines are fetched in the background before the screensaver shows (like weather). The refresh interval controls how often fresh data is pulled when the prefetch is active."
                />
                <ManualRow
                    title="Offline support"
                    description="When network is unavailable, cached headlines are shown with an 'offline' label. The cache persists across restarts."
                />
                <ManualRow
                    title="Opening articles in Settings"
                    description="Settings → News also lists recent headlines with Open buttons. The header newspaper icon is the quickest way to browse everything currently cached."
                />
            </PanelSection>

            <PanelSection title="Sounds">
                <ManualRow
                    title="Built-in and soundless"
                    description="Each major feature can use its own built-in sound, a custom file, or soundless mode. Volumes are per feature under their Settings tabs."
                />
                <ManualRow
                    title="Custom sounds"
                    description="Put MP3, WAV, or OGG files in ~/Music/AlarMe_Sounds, then import and rescan from Settings → General → Custom Sounds so they appear in dropdowns."
                />
            </PanelSection>

            <PanelSection title="Backup and reset">
                <ManualRow
                    title="Export and import"
                    description="Under Settings → Backup, export a JSON backup before major changes or reinstall. Import restores from that file."
                />
                <ManualRow
                    title="Factory reset"
                    description="Still on the Backup tab: permanently clears alarms, timers, reminders, Pomodoro data, and settings. Custom files in ~/Music/AlarMe_Sounds are not deleted. Export a backup first if you might need your data."
                />
            </PanelSection>

            <PanelSection title="Support">
                <ManualRow title="Repository" description="https://github.com/lemossilva/alarme-decky-plugin" />
                <ManualRow title="Issues" description="https://github.com/lemossilva/alarme-decky-plugin/issues" />
            </PanelSection>
        </div>
    );
};
