# Alar.me - Decky Loader Plugin

An advanced alarm and timer plugin for Steam Deck with persistent alarms, snooze functionality, Pomodoro productivity timer, and customizable sounds.

![Alar.me](https://img.shields.io/badge/Decky-Plugin-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)

## Features

### ⏱️ Timers
- **Multiple concurrent timers** - Run several timers at once
- **Quick presets** - Start timers with one click (5, 10, 15, 30, 60 minutes)
- **Custom labels** - Name your timers for easy identification
- **Persistent** - Timers survive Decky Loader restarts

### 🔔 Alarms
- **Time-based alarms** - Set alarms for specific times with an intuitive time picker
- **Recurring patterns** - Once, Daily, Weekdays, Weekends
- **Snooze functionality** - Configurable snooze duration (1-30 minutes)
- **Persistent** - Alarms survive device reboots

### 🍅 Pomodoro Timer
- **Focus mode** - Customizable work duration (15-60 minutes)
- **Break intervals** - Short breaks (3-15 min) and long breaks (10-45 min)
- **Session tracking** - Configurable sessions until long break (2-8)
- **Visual progress** - See your focus progress at a glance

### 🔊 Customizable Sounds
- **Per-feature sounds** - Set different sounds for Timers, Alarms, and Pomodoro
- **Sound preview** - Test sounds with play/pause toggle before selecting
- **Custom sounds** - Add your own MP3, WAV, or OGG files to the assets folder

### ⚙️ Settings
- **Subtle mode** - Choose between fullscreen alerts or small toasts
- **Auto-suspend** - Automatically suspend the device when timer completes
- **24/12 hour format** - Choose your preferred time display
- **Volume control** - Adjust alarm volume independently

## Installation

### From Decky Store
1. Open Decky Loader on your Steam Deck
2. Go to the Store tab
3. Search for "Alar.me"
4. Click Install

### Manual Installation
1. Download the latest release from the [Releases](https://github.com/your-username/alarme-decky-plugin/releases) page
2. Extract to `~/homebrew/plugins/alarme-decky-plugin`
3. Restart Decky Loader

## Adding Custom Sounds

1. Place your sound files (`.mp3`, `.wav`, or `.ogg`) in the `assets/` folder
2. Rebuild and redeploy the plugin
3. The sounds will appear in the Settings panel dropdowns

## Development

### Prerequisites

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm v9
sudo npm install -g pnpm@9

# Verify
node --version  # Should be 18.x+
pnpm --version  # Should be 9.x
```

### Building

```bash
# Install dependencies
pnpm install

# Build for production
pnpm run build

# Watch mode for development
pnpm run watch
```

### Deploying to Steam Deck

1. Enable SSH on your Steam Deck (Desktop Mode)
2. Set your Steam Deck IP:
   ```bash
   export DECK_IP="192.168.x.x"
   ```
3. Deploy:
   ```bash
   rsync -avz --delete --exclude 'node_modules' --exclude '.git' \
     ./ deck@${DECK_IP}:/home/deck/homebrew/plugins/alarme-decky-plugin/
   ```
4. Restart Decky Loader from the Quick Access Menu

### CEF Debugging

1. Enable "Allow Remote CEF Debugging" in Decky Developer Settings
2. Open Chrome/Edge and go to `chrome://inspect`
3. Configure network target: `DECK_IP:8081`
4. Select "SharedJSContext" to debug

## Known Limitations

- **On-Screen Keyboard**: The Steam Deck on-screen keyboard may appear behind the plugin panel. This is a known Decky Loader/SteamOS limitation. Workaround: Install "CSS Loader" plugin and enable the "Top Keyboard" snippet.

## License

BSD-3-Clause License - See [LICENSE](LICENSE) for details.

## Credits

- **Author**: Guilherme Lemos
- **Framework**: [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader)

## Support

If you encounter any issues, please [open an issue](https://github.com/your-username/alarme-decky-plugin/issues) on GitHub.
