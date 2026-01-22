// Get the plugin directory path for loading assets
const directoryPath = import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1);

// Special filename for vibrate mode
export const VIBRATE_SOUND = 'vibrate';

/**
 * Check if a sound filename is the vibrate option
 */
export function isVibrate(soundFile: string): boolean {
    return soundFile === VIBRATE_SOUND;
}

/**
 * Trigger Steam Deck controller rumble/vibration
 */
export function triggerVibration(intensity: number = 1, durationMs: number = 500): void {
    try {
        // Use the SteamClient gamepad API to trigger rumble
        if (window.SteamClient?.Input) {
            // Haptic pulse on all controllers (left and right motors)
            window.SteamClient.Input.HapticPulse(0, 0, Math.floor(intensity * 65535), 0, durationMs * 1000);
            window.SteamClient.Input.HapticPulse(0, 1, Math.floor(intensity * 65535), 0, durationMs * 1000);
            console.log('Vibration triggered');
        } else {
            console.warn('SteamClient.Input not available for vibration');
        }
    } catch (e) {
        console.error('Failed to trigger vibration:', e);
    }
}

/**
 * Play the alarm sound or vibrate
 * @param soundFile - filename of sound to play (or 'vibrate' for rumble)
 * @param volume - optional volume override (0-100)
 */
export function playAlarmSound(soundFile: string = 'alarm.mp3', volume?: number): HTMLAudioElement | null {
    // Handle vibrate mode
    if (isVibrate(soundFile)) {
        // Trigger multiple pulses for alarm effect
        triggerVibration(1, 300);
        setTimeout(() => triggerVibration(1, 300), 400);
        setTimeout(() => triggerVibration(1, 300), 800);
        return null;
    }

    try {
        const audio = new Audio(directoryPath + soundFile);
        if (volume !== undefined) {
            audio.volume = Math.max(0, Math.min(1, volume / 100));
        }
        audio.play().catch(e => console.error('Failed to play alarm sound:', e));
        return audio;
    } catch (e) {
        console.error('Failed to create audio element:', e);
        return null;
    }
}

/**
 * Play a gentle notification sound
 */
export function playNotificationSound(): HTMLAudioElement | null {
    try {
        const audio = new Audio(directoryPath + 'notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.error('Failed to play notification sound:', e));
        return audio;
    } catch (e) {
        console.error('Failed to create audio element:', e);
        return null;
    }
}

/**
 * Stop playing a sound
 */
export function stopSound(audio: HTMLAudioElement | null): void {
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
}

// Type declaration for SteamClient
declare global {
    interface Window {
        SteamClient?: {
            Input?: {
                HapticPulse: (gamepadIndex: number, motorIndex: number, intensity: number, unused: number, durationMicros: number) => void;
            };
        };
    }
}
