// Get the plugin directory path for loading assets
const directoryPath = import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1);
import { callable } from "@decky/api";

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
// Backend callable for custom sounds
const getSoundDataCall = callable<[filename: string], { success: boolean; data: string | null; mime_type: string | null; error?: string }>('get_sound_data');

/**
 * Play the alarm sound
 * @param soundFile - filename of sound to play (or 'soundless' for no sound)
 * @param volume - optional volume override (0-100)
 */
export async function playAlarmSound(soundFile: string = 'alarm.mp3', volume?: number): Promise<HTMLAudioElement | null> {
    // Handle soundless mode - just return null, no sound
    if (isSoundless(soundFile)) {
        console.log('Soundless mode - no audio played');
        return null;
    }

    let audio: HTMLAudioElement;

    // Custom sounds: fetch base64 from backend
    if (soundFile.startsWith('custom:')) {
        try {
            const result = await getSoundDataCall(soundFile);
            if (!result.success || !result.data || !result.mime_type) {
                console.error('[Alarme] Failed to load custom sound:', result.error);
                return null;
            }

            // Convert base64 to blob URL
            const byteCharacters = atob(result.data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: result.mime_type });
            const blobUrl = URL.createObjectURL(blob);

            audio = new Audio(blobUrl);
            // Clean up blob when audio ends or if we manually revoke it later
            const originalOnEnded = audio.onended;
            audio.onended = (ev) => {
                URL.revokeObjectURL(blobUrl);
                if (originalOnEnded) originalOnEnded.call(audio, ev);
            };
        } catch (e) {
            console.error('[Alarme] Failed to prepare custom sound:', e);
            return null;
        }
    } else {
        // Built-in sounds
        audio = new Audio(directoryPath + soundFile);
    }

    if (volume !== undefined) {
        audio.volume = Math.max(0, Math.min(1, volume / 100));
    }

    try {
        await audio.play();
        return audio;
    } catch (e) {
        console.error('Failed to play alarm sound:', e);
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
