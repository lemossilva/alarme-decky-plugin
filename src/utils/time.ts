/**
 * Format seconds into a human-readable string
 */
export function formatDuration(seconds: number): string {
    if (seconds < 0) return "0:00";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds into a descriptive string (e.g., "5 minutes", "1 hour 30 minutes")
 */
export function formatDurationLong(seconds: number): string {
    if (seconds < 60) {
        return seconds === 1 ? "1 second" : `${seconds} seconds`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];

    if (hours > 0) {
        parts.push(hours === 1 ? "1 hour" : `${hours} hours`);
    }
    if (minutes > 0) {
        parts.push(minutes === 1 ? "1 minute" : `${minutes} minutes`);
    }

    return parts.join(" ");
}

/**
 * Format time in 12h or 24h format
 */
export function formatTime(hour: number, minute: number, use24h: boolean = true): string {
    if (use24h) {
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }

    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

/**
 * Get relative time string (e.g., "in 5 minutes", "tomorrow at 8:00")
 */
export function getRelativeTime(timestamp: number | null | undefined, use24h: boolean = true): string {
    if (!timestamp) return "Not scheduled";

    const now = Date.now() / 1000;
    const diff = timestamp - now;

    if (diff < 0) return "Expired";

    if (diff < 60) {
        return "Less than a minute";
    }

    if (diff < 3600) {
        const minutes = Math.ceil(diff / 60);
        return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }

    if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        if (minutes > 0) {
            return `in ${hours}h ${minutes}m`;
        }
        return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    }

    const date = new Date(timestamp * 1000);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    const timeStr = formatTime(date.getHours(), date.getMinutes(), use24h);

    if (isTomorrow) {
        return `Tomorrow at ${timeStr}`;
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]} at ${timeStr}`;
}

/**
 * Get recurring pattern display text
 */
export function getRecurringText(recurring: string): string {
    switch (recurring) {
        case 'once':
            return 'Once';
        case 'daily':
            return 'Every day';
        case 'weekdays':
            return 'Weekdays';
        case 'weekends':
            return 'Weekends';
        default:
            // Custom days format: "0,1,2" -> "Mon, Tue, Wed"
            if (recurring.includes(',')) {
                const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                const selectedDays = recurring.split(',').map(d => days[parseInt(d)]);
                return selectedDays.join(', ');
            }
            return recurring;
    }
}
