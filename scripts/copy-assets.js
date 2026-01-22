import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'assets');
const distDir = path.join(rootDir, 'dist');

// Create dist dir if not exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy audio files (.mp3, .wav, .ogg)
if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    files.forEach(file => {
        if (file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.ogg')) {
            const src = path.join(assetsDir, file);
            const dest = path.join(distDir, file);
            fs.copyFileSync(src, dest);
            console.log(`Copied ${file} to dist/`);
        }
    });
} else {
    console.warn('Assets directory not found!');
}
