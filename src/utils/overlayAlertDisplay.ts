import type { OverlayAlert } from "../types";

export function displayAlertLabel(alert: OverlayAlert): string {
    const t = (alert.label || "").trim();
    if (t.length > 0) return t;
    switch (alert.category) {
        case "stopwatch":
            return "Stopwatch";
        case "timer":
            return "Timer";
        case "pomodoro":
            return "Focus";
        case "reminder":
            return "Reminder";
        case "alarm":
            return "Alarm";
        default:
            return "Alert";
    }
}
