# Changelog

## [1.4.0]

### 🚀 Settings UI Revamp

The Settings experience has been completely reimagined to be more spacious, organized, and easier to navigate on the Steam Deck.

#### New Features

-   **Dedicated Settings Modal**: Moved settings out of the cramped Quick Access Menu panel into a full-screen compatible modal.
-   **Sidebar Navigation**: Settings are now categorized for quick access:
-   **Visual Improvements**: Cleaner layout with consistent spacing and better focus handling.

#### Bug Fixes

-   **Visual Updates**: Fixed an issue where settings might not visually update immediately in the panel.
-   **Layout**: Resolved various style inconsistencies in button layouts.

## [1.3.0]

### 🚨 Missed Alerts & Suspend Awareness
AlarMe now works even when your Steam Deck is asleep!
- **Deep Sleep Monitor**: AlarMe intelligently tracks when your Deck was suspended.
- **Missed Report**: If you missed Alarms, Timers, or Reminders while away, a "View Missed Report" button appears.
- **Persistent Notifications**: Missed reports stay visible until you view them or new ones arrive.
- **Smart Reminders**: 
    - **Continue**: Allows reminders to "stack up" while you are away (reporting 5 missed if you were gone 5 hours).
    - **Pause**: Automatically shifts your reminder schedule forward by your sleep duration.
- **Pomodoro Protection**: 
    - **Pause Mode**: Timer pauses when you suspend, resuming exactly where you left off when you wake.
    - **Continue Mode**: Session completes if time ran out, but reports it as missed.

### ✨ Improvements
- **Persistent "View Missed Report" Button** (persists across reboots until viewed/dismissed).
- **Settings UI**: Added dedicated controls for Suspend Behavior in Settings.
- **Enhanced Reliability**: Fixed potential race conditions during suspend/resume.

### 🐛 Bug Fixes
- Fixed an issue where Suspend Behavior settings were not saving correctly.
- Improved controller navigation in modals.

## [1.2.0]

This release brings significant improvements to AlarMe, introducing proper Periodic Reminders, fixing critical bugs, and enhancing the user experience based on user feedback.

### 🚀 New Features

#### Periodic Reminders & "Start Now"
- **Periodic Reminders**: You can now set reminders that repeat every X minutes (e.g., "Drinking Water" every 45 mins).
- **"Start Now" Option**: Added a toggle to start a reminder cycle immediately, ignoring the time picker.

#### Game Detection Improvements
- **Robust Multi-App Support**: Fixed a bug where closing *one* application would stop game detection even if other games were still running. AlarMe now correctly tracks all running applications.

### ✨ UX Enhancements

- **Friendly Time Display**: "In 0 min" is now displayed as "In less than 1 minute" for better clarity.
- **Interactive Pomodoro Notifications**: Clicking any button (Skip, Stop, Dismiss) in the Pomodoro modal now correctly stops the alarm sound immediately.
- **Input Safety**: Added a 2-second delay to Modal inputs to prevent accidental clicks when a reminder pops up unexpectedly.
- **Custom Sound Preview**: Improved the sound picker experience in the Reminder editor.

### 🐛 Bug Fixes

- **Reminder Auto-Enable**: Fixed an issue where reminders would not automatically re-enable themselves after being edited.
- **Build System**: Resolved various build warnings and clean-up of unused variables.

