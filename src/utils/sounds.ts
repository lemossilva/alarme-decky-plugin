// Get the plugin directory path for loading assets
const directoryPath = import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1);

// Special filename for soundless mode
export const SOUNDLESS = 'soundless';

/**
 * Check if a sound filename is the soundless option
 */
export function isSoundless(soundFile: string): boolean {
    return soundFile === SOUNDLESS;
}

/**
 * Play the alarm sound
 * @param soundFile - filename of sound to play (or 'soundless' for no sound)
 * @param volume - optional volume override (0-100)
 */
export function playAlarmSound(soundFile: string = 'alarm.mp3', volume?: number): HTMLAudioElement | null {
    // Handle soundless mode - just return null, no sound
    if (isSoundless(soundFile)) {
        console.log('Soundless mode - no audio played');
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
