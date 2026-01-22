// Get the plugin directory path for loading assets
const directoryPath = import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1);

/**
 * Play the alarm sound
 * @param soundFile - filename of sound to play (defaults to 'alarm.mp3')
 */
export function playAlarmSound(soundFile: string = 'alarm.mp3'): HTMLAudioElement | null {
    try {
        const audio = new Audio(directoryPath + soundFile);
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
