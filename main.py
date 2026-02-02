# AlarMe - Decky Loader Plugin
# Python Backend

from settings import SettingsManager  # type: ignore
from datetime import datetime, timedelta
import time
import os
import decky  # type: ignore
import asyncio
import uuid
import json

# Initialize settings
settingsDir = os.environ["DECKY_PLUGIN_SETTINGS_DIR"]
decky.logger.info(f'AlarMe: Settings path = {os.path.join(settingsDir, "settings.json")}')
settings = SettingsManager(name="settings", settings_directory=settingsDir)
settings.read()

# Settings keys
SETTINGS_KEY_TIMERS = "active_timers"
SETTINGS_KEY_ALARMS = "alarms"
SETTINGS_KEY_PRESETS = "presets"
SETTINGS_KEY_SETTINGS = "user_settings"
SETTINGS_KEY_POMODORO = "pomodoro_state"
SETTINGS_KEY_RECENT_TIMERS = "recent_timers"
SETTINGS_KEY_REMINDERS = "reminders"

# Default user settings
DEFAULT_SETTINGS = {
    "snooze_duration": 5,  # default minutes for alarm snooze
    "time_format_24h": True,
    # Timer settings
    "timer_sound": "alarm.mp3",
    "timer_volume": 100,
    "timer_subtle_mode": False,
    "timer_auto_suspend": False,
    # Pomodoro settings
    "pomodoro_sound": "alarm.mp3",
    "pomodoro_volume": 100,
    "pomodoro_subtle_mode": False,
    "pomodoro_work_duration": 25,  # minutes
    "pomodoro_break_duration": 5,  # minutes
    "pomodoro_long_break_duration": 15,  # minutes
    "pomodoro_sessions_until_long_break": 4
}

# Default presets
DEFAULT_PRESETS = [
    {"id": "preset-5", "seconds": 300, "label": "5 minutes"},
    {"id": "preset-10", "seconds": 600, "label": "10 minutes"},
    {"id": "preset-15", "seconds": 900, "label": "15 minutes"},
    {"id": "preset-30", "seconds": 1800, "label": "30 minutes"},
    {"id": "preset-60", "seconds": 3600, "label": "1 hour"},
]


class Plugin:
    # Active timer tasks
    timer_tasks: dict = {}
    alarm_check_task = None
    pomodoro_task = None
    reminder_check_task = None
    reminder_tasks: dict = {}  # Active reminder countdown tasks
    _game_running: bool = False  # Track game state from frontend
    loop = None

    # ==================== TIMER METHODS ====================

    def _format_timer_label(self, seconds: int) -> str:
        """Generate a human-readable label from duration (e.g., '5 min timer', '1h 30 min timer')."""
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        
        if hours > 0 and minutes > 0:
            return f"{hours}h {minutes} min timer"
        elif hours > 0:
            return f"{hours}h timer"
        elif minutes > 0:
            return f"{minutes} min timer"
        else:
            return f"{seconds}s timer"

    async def create_timer(self, seconds: int, label: str = "") -> str:
        """Create a new countdown timer."""
        timer_id = str(uuid.uuid4())[:8]
        end_time = time.time() + seconds
        
        # Generate default label from duration if not provided
        if not label:
            label = self._format_timer_label(seconds)
        
        timer_data = {
            "id": timer_id,
            "label": label,
            "seconds": seconds,
            "end_time": end_time,
            "created_at": time.time()
        }
        
        # Save to settings
        timers = await self._get_timers()
        timers[timer_id] = timer_data
        await self._save_timers(timers)
        
        # Save to recent timers (for quick access)
        await self._add_to_recent_timers(seconds, label)
        
        # Start the timer task
        self.timer_tasks[timer_id] = self.loop.create_task(
            self._timer_handler(timer_id, end_time, label)
        )
        
        decky.logger.info(f"AlarMe: Created timer {timer_id} for {seconds} seconds")
        await decky.emit("alarme_timer_created", timer_data)
        await self._emit_all_timers()
        
        return timer_id

    async def cancel_timer(self, timer_id: str) -> bool:
        """Cancel an active timer."""
        if timer_id in self.timer_tasks:
            self.timer_tasks[timer_id].cancel()
            del self.timer_tasks[timer_id]
        
        timers = await self._get_timers()
        if timer_id in timers:
            del timers[timer_id]
            await self._save_timers(timers)
            decky.logger.info(f"AlarMe: Cancelled timer {timer_id}")
            await decky.emit("alarme_timer_cancelled", timer_id)
            await self._emit_all_timers()
            return True
        return False

    async def get_active_timers(self) -> list:
        """Get all active timers with remaining time."""
        timers = await self._get_timers()
        current_time = time.time()
        active = []
        
        for timer_id, timer in timers.items():
            remaining = timer["end_time"] - current_time
            if remaining > 0:
                active.append({
                    **timer,
                    "remaining": remaining
                })
        
        return sorted(active, key=lambda x: x["remaining"])

    async def _timer_handler(self, timer_id: str, end_time: float, label: str):
        """Background task to handle timer countdown."""
        try:
            while True:
                remaining = end_time - time.time()
                
                if remaining <= 0:
                    # Timer completed
                    await self.cancel_timer(timer_id)
                    user_settings = await self._get_user_settings()
                    subtle = user_settings.get("timer_subtle_mode", False)
                    timer_sound = user_settings.get("timer_sound", "alarm.mp3")
                    timer_volume = user_settings.get("timer_volume", 100)
                    timer_auto_suspend = user_settings.get("timer_auto_suspend", False)
                    await decky.emit("alarme_timer_completed", {
                        "id": timer_id,
                        "label": label,
                        "subtle": subtle,
                        "sound": timer_sound,
                        "volume": timer_volume,
                        "auto_suspend": timer_auto_suspend
                    })
                    decky.logger.info(f"AlarMe: Timer {timer_id} completed")
                    return
                
                # Emit update every second for real-time display
                await decky.emit("alarme_timer_tick", {
                    "id": timer_id,
                    "remaining": remaining
                })
                await asyncio.sleep(1)
                
        except asyncio.CancelledError:
            decky.logger.info(f"AlarMe: Timer {timer_id} was cancelled")

    async def _get_timers(self) -> dict:
        return await self.settings_getSetting(SETTINGS_KEY_TIMERS, {})

    async def _save_timers(self, timers: dict):
        await self.settings_setSetting(SETTINGS_KEY_TIMERS, timers)
        await self.settings_commit()

    async def _emit_all_timers(self):
        timers = await self.get_active_timers()
        await decky.emit("alarme_timers_updated", timers)

    async def get_recent_timers(self) -> list:
        """Get list of recently used timers for quick access."""
        return await self.settings_getSetting(SETTINGS_KEY_RECENT_TIMERS, [])

    async def clear_recent_timers(self) -> bool:
        """Clear the recent timers list."""
        await self.settings_setSetting(SETTINGS_KEY_RECENT_TIMERS, [])
        await self.settings_commit()
        return True

    async def _add_to_recent_timers(self, seconds: int, label: str):
        """Add a timer to the recent timers list (max 5, dedup by seconds+label)."""
        recent = await self.get_recent_timers()
        
        # Create new entry
        new_entry = {
            "seconds": seconds,
            "label": label or f"{seconds // 60} min timer"
        }
        
        # Remove duplicates (same seconds and label)
        recent = [r for r in recent if not (r["seconds"] == seconds and r["label"] == new_entry["label"])]
        
        # Add to front
        recent.insert(0, new_entry)
        
        # Keep only last 5
        recent = recent[:5]
        
        await self.settings_setSetting(SETTINGS_KEY_RECENT_TIMERS, recent)
        await self.settings_commit()

    # ==================== ALARM METHODS ====================

    async def create_alarm(self, hour: int, minute: int, label: str = "", 
                          recurring: str = "once", sound: str = "alarm.mp3",
                          volume: int = 100, subtle_mode: bool = False, 
                          auto_suspend: bool = False) -> str:
        """
        Create a new alarm.
        recurring: 'once', 'daily', 'weekdays', 'weekends', or comma-separated days (0-6, 0=Monday)
        sound: filename of the sound to play (from assets folder)
        volume: 0-100 alarm volume
        subtle_mode: if True, show only a toast notification
        auto_suspend: if True, suspend device after alarm
        """
        alarm_id = str(uuid.uuid4())[:8]
        
        alarm_data = {
            "id": alarm_id,
            "hour": hour,
            "minute": minute,
            "label": label or f"Alarm {hour:02d}:{minute:02d}",
            "recurring": recurring,
            "enabled": True,
            "created_at": time.time(),
            "snoozed_until": None,
            "sound": sound,
            "volume": volume,
            "subtle_mode": subtle_mode,
            "auto_suspend": auto_suspend
        }
        
        alarms = await self._get_alarms()
        alarms[alarm_id] = alarm_data
        await self._save_alarms(alarms)
        
        decky.logger.info(f"AlarMe: Created alarm {alarm_id} for {hour:02d}:{minute:02d} with sound {sound}")
        await decky.emit("alarme_alarm_created", alarm_data)
        await self._emit_all_alarms()
        
        return alarm_id

    async def cancel_alarm(self, alarm_id: str) -> bool:
        """Delete an alarm."""
        alarms = await self._get_alarms()
        if alarm_id in alarms:
            del alarms[alarm_id]
            await self._save_alarms(alarms)
            decky.logger.info(f"AlarMe: Deleted alarm {alarm_id}")
            await decky.emit("alarme_alarm_deleted", alarm_id)
            await self._emit_all_alarms()
            return True
        return False

    async def toggle_alarm(self, alarm_id: str, enabled: bool) -> bool:
        """Enable or disable an alarm."""
        alarms = await self._get_alarms()
        if alarm_id in alarms:
            alarms[alarm_id]["enabled"] = enabled
            alarms[alarm_id]["snoozed_until"] = None  # Clear snooze when toggling
            await self._save_alarms(alarms)
            await decky.emit("alarme_alarm_updated", alarms[alarm_id])
            await self._emit_all_alarms()
            return True
        return False

    async def update_alarm(self, alarm_id: str, hour: int, minute: int, 
                          label: str = "", recurring: str = "once", 
                          sound: str = "alarm.mp3", volume: int = 100,
                          subtle_mode: bool = False,
                          auto_suspend: bool = False) -> bool:
        """Update an existing alarm's settings."""
        alarms = await self._get_alarms()
        if alarm_id in alarms:
            alarm = alarms[alarm_id]
            alarm["hour"] = hour
            alarm["minute"] = minute
            alarm["label"] = label or f"Alarm {hour:02d}:{minute:02d}"
            alarm["recurring"] = recurring
            alarm["sound"] = sound
            alarm["volume"] = volume
            alarm["subtle_mode"] = subtle_mode
            alarm["auto_suspend"] = auto_suspend
            # Re-enable alarm when edited (user expects it to be active)
            alarm["enabled"] = True
            # Clear snooze and last_triggered when alarm time changes
            alarm["snoozed_until"] = None
            alarm["last_triggered"] = None
            
            await self._save_alarms(alarms)
            decky.logger.info(f"AlarMe: Updated alarm {alarm_id} to {hour:02d}:{minute:02d}, recurring={recurring}, sound={sound}")
            await decky.emit("alarme_alarm_updated", alarm)
            await self._emit_all_alarms()
            return True
        decky.logger.warning(f"AlarMe: Update failed - alarm {alarm_id} not found")
        return False

    async def snooze_alarm(self, alarm_id: str, minutes: int = None) -> bool:
        """Snooze an alarm for the specified minutes."""
        alarms = await self._get_alarms()
        if alarm_id in alarms:
            alarm = alarms[alarm_id]
            # Use provided minutes or fall back to global setting
            if minutes is None:
                user_settings = await self._get_user_settings()
                minutes = user_settings.get("snooze_duration", 5)
            
            snooze_time = time.time() + (minutes * 60)
            alarms[alarm_id]["snoozed_until"] = snooze_time
            # Re-enable the alarm if it was disabled (important for "once" alarms)
            alarms[alarm_id]["enabled"] = True
            await self._save_alarms(alarms)
            
            snooze_dt = datetime.fromtimestamp(snooze_time)
            decky.logger.info(f"AlarMe: Snoozed alarm {alarm_id} for {minutes} minutes until {snooze_dt.strftime('%H:%M:%S')}")
            
            await decky.emit("alarme_alarm_snoozed", {
                "id": alarm_id,
                "snoozed_until": snooze_time,
                "minutes": minutes
            })
            await self._emit_all_alarms()
            return True
        decky.logger.warning(f"AlarMe: Snooze failed - alarm {alarm_id} not found")
        return False

    async def get_alarms(self) -> list:
        """Get all alarms."""
        alarms = await self._get_alarms()
        alarm_list = list(alarms.values())
        
        # Add next trigger time for each alarm
        for alarm in alarm_list:
            alarm["next_trigger"] = self._calculate_next_trigger(alarm)
        
        return sorted(alarm_list, key=lambda x: x.get("next_trigger") or float('inf'))

    async def debug_alarms(self) -> dict:
        """Debug endpoint to check alarm state."""
        now = datetime.now()
        alarms = await self._get_alarms()
        debug_info = {
            "current_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "current_timestamp": now.timestamp(),
            "alarm_count": len(alarms),
            "alarms": []
        }
        
        for alarm_id, alarm in alarms.items():
            next_trigger = self._calculate_next_trigger(alarm)
            trigger_dt = datetime.fromtimestamp(next_trigger) if next_trigger else None
            
            debug_info["alarms"].append({
                "id": alarm_id,
                "time": f"{alarm.get('hour', 0):02d}:{alarm.get('minute', 0):02d}",
                "enabled": alarm.get("enabled", True),
                "recurring": alarm.get("recurring", "once"),
                "next_trigger_ts": next_trigger,
                "next_trigger_str": trigger_dt.strftime("%Y-%m-%d %H:%M:%S") if trigger_dt else None,
                "seconds_until": (next_trigger - now.timestamp()) if next_trigger else None,
                "last_triggered": alarm.get("last_triggered"),
                "snoozed_until": alarm.get("snoozed_until")
            })
        
        decky.logger.info(f"AlarMe Debug: {debug_info}")
        return debug_info

    async def get_sounds(self) -> list:
        """Get list of available sound files from dist and custom_sounds folders."""
        sounds = [
            {"filename": "soundless", "name": "🔇 Soundless"}
        ]
        try:
            plugin_dir = os.environ.get("DECKY_PLUGIN_DIR", "")
            if not plugin_dir:
                plugin_dir = os.path.dirname(settingsDir)
            
            # Built-in sounds from dist/
            dist_dir = os.path.join(plugin_dir, "dist")
            if os.path.exists(dist_dir):
                for filename in os.listdir(dist_dir):
                    if filename.lower().endswith(('.mp3', '.wav', '.ogg')):
                        sounds.append({
                            "filename": filename,
                            "name": os.path.splitext(filename)[0].replace('_', ' ').title()
                        })
            
            # Custom sounds from settingsDir/custom_sounds/
            custom_dir = os.path.join(settingsDir, "custom_sounds")
            if os.path.exists(custom_dir):
                for filename in os.listdir(custom_dir):
                    if filename.lower().endswith(('.mp3', '.wav', '.ogg')):
                        sounds.append({
                            "filename": f"custom:{filename}",
                            "name": f"★ {os.path.splitext(filename)[0].replace('_', ' ').title()}"
                        })
            
            decky.logger.info(f"AlarMe: Found {len(sounds)} sound options")
        except Exception as e:
            decky.logger.error(f"AlarMe: Error listing sounds: {e}")
            sounds = [
                {"filename": "soundless", "name": "🔇 Soundless"},
                {"filename": "alarm.mp3", "name": "Alarm"}
            ]
        
        return sounds

    async def import_custom_sounds(self) -> dict:
        """Sync custom sounds from ~/Music/AlarMe_Sounds.
        
        This acts as a sync: copies new/updated files and removes
        sounds that no longer exist in the source folder.
        """
        import shutil
        
        result = {
            "success": False,
            "imported": 0,
            "removed": 0,
            "errors": [],
            "message": ""
        }
        
        try:
            # Source directory: ~/Music/AlarMe_Sounds
            home_dir = os.path.expanduser("~")
            source_dir = os.path.join(home_dir, "Music", "AlarMe_Sounds")
            
            if not os.path.exists(source_dir):
                result["message"] = f"Folder not found: {source_dir}"
                return result
                
            # Destination directory: settingsDir/custom_sounds (writable)
            custom_dir = os.path.join(settingsDir, "custom_sounds")
            os.makedirs(custom_dir, exist_ok=True)
            
            # Scan and copy files
            valid_extensions = ('.mp3', '.wav', '.ogg')
            max_size = 2 * 1024 * 1024  # 2MB
            
            # Get set of source files (lowercase for case-insensitive comparison)
            source_files = set()
            for filename in os.listdir(source_dir):
                if filename.lower().endswith(valid_extensions):
                    source_files.add(filename)
            
            # Copy new/updated files from source
            count = 0
            for filename in source_files:
                src_path = os.path.join(source_dir, filename)
                
                # Check size
                try:
                    size = os.path.getsize(src_path)
                    if size > max_size:
                        result["errors"].append(f"{filename} too large (>2MB)")
                        continue
                        
                    # Copy file
                    dst_path = os.path.join(custom_dir, filename)
                    shutil.copy2(src_path, dst_path)
                    count += 1
                    decky.logger.info(f"Alarme: Imported sound {filename}")
                    
                except Exception as e:
                    result["errors"].append(f"Error copying {filename}: {str(e)}")
            
            # Remove files that no longer exist in source (sync behavior)
            removed_count = 0
            if os.path.exists(custom_dir):
                for filename in os.listdir(custom_dir):
                    if filename.lower().endswith(valid_extensions):
                        if filename not in source_files:
                            try:
                                dst_path = os.path.join(custom_dir, filename)
                                os.remove(dst_path)
                                removed_count += 1
                                decky.logger.info(f"Alarme: Removed sound {filename} (no longer in source)")
                            except Exception as e:
                                result["errors"].append(f"Error removing {filename}: {str(e)}")
            
            result["success"] = True
            result["imported"] = count
            result["removed"] = removed_count
            
            # Build message
            messages = []
            if count > 0:
                messages.append(f"Imported {count} sound(s)")
            if removed_count > 0:
                messages.append(f"Removed {removed_count} sound(s)")
            if not messages:
                messages.append("No changes - sounds are in sync")
            result["message"] = ". ".join(messages) + "."
                 
        except Exception as e:
            decky.logger.error(f"Alarme: Import sounds failed: {e}")
            result["message"] = f"Sync failed: {str(e)}"
            
        return result

    async def get_sound_data(self, filename: str) -> dict:
        """Get base64-encoded sound data for a custom sound file.
        
        This allows the frontend to play custom sounds via HTML5 Audio,
        which routes correctly through Steam's audio system.
        
        Args:
            filename: Sound filename with 'custom:' prefix
            
        Returns:
            Dict with 'success', 'data' (base64), 'mime_type'
        """
        import base64
        import mimetypes
        
        result = {"success": False, "data": None, "mime_type": None}
        
        if not filename or not filename.startswith("custom:"):
            result["error"] = "Only custom sounds supported"
            return result
            
        actual_name = filename[7:]  # Remove "custom:" prefix
        file_path = os.path.join(settingsDir, "custom_sounds", actual_name)
        
        if not os.path.exists(file_path):
            result["error"] = f"File not found: {file_path}"
            decky.logger.error(f"AlarMe: Sound file not found: {file_path}")
            return result
            
        try:
            # Determine MIME type
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                ext = os.path.splitext(file_path)[1].lower()
                mime_type = {
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav',
                    '.ogg': 'audio/ogg'
                }.get(ext, 'audio/mpeg')
            
            # Read and encode file
            with open(file_path, 'rb') as f:
                audio_data = f.read()
            
            result["success"] = True
            result["data"] = base64.b64encode(audio_data).decode('utf-8')
            result["mime_type"] = mime_type
            decky.logger.info(f"AlarMe: Loaded sound data for {filename} ({len(audio_data)} bytes)")
            
        except Exception as e:
            result["error"] = str(e)
            decky.logger.error(f"AlarMe: Failed to load sound data: {e}")
            
        return result

    async def play_sound(self, filename: str, volume: int = 100, loop: bool = False) -> bool:
        """Play a sound file via paplay (Linux/SteamOS).
        
        Args:
            filename: Sound filename. Can be 'custom:file.mp3' for custom sounds or just 'file.mp3' for built-in.
            volume: Volume 0-100
        """
        import subprocess
        
        if not filename or filename == "soundless":
            return True
            
        # Resolve file path
        file_path = None
        if filename.startswith("custom:"):
            # Custom sound in settingsDir/custom_sounds
            actual_name = filename[7:]  # Remove "custom:" prefix
            file_path = os.path.join(settingsDir, "custom_sounds", actual_name)
        else:
            # Built-in sound in dist/
            plugin_dir = os.environ.get("DECKY_PLUGIN_DIR", "")
            if not plugin_dir:
                plugin_dir = os.path.dirname(settingsDir)
            file_path = os.path.join(plugin_dir, "dist", filename)
        
        if not os.path.exists(file_path):
            decky.logger.error(f"AlarMe: Sound file not found: {file_path}")
            return False
            
        try:
            # Convert volume 0-100 to paplay's 0-65536
            vol = int((min(100, max(0, volume)) / 100) * 65536)
            
            # Stop any currently playing sound first
            if hasattr(self, '_current_sound_process') and self._current_sound_process:
                try:
                    self._current_sound_process.terminate()
                except:
                    pass
            
            decky.logger.info(f"AlarMe: Attempting to play: {file_path} at volume {vol}")
            
            # Play using paplay (non-blocking)
            self._current_sound_process = subprocess.Popen(
                ["paplay", "--volume", str(vol), file_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            decky.logger.info(f"AlarMe: Started paplay PID {self._current_sound_process.pid}")
            return True
        except Exception as e:
            decky.logger.error(f"AlarMe: Failed to play sound: {e}")
            return False

    async def stop_sound(self) -> bool:
        """Stop currently playing sound."""
        import subprocess
        try:
            if hasattr(self, '_current_sound_process') and self._current_sound_process:
                self._current_sound_process.terminate()
                self._current_sound_process = None
                decky.logger.info("AlarMe: Stopped sound")
            return True
        except Exception as e:
            decky.logger.error(f"AlarMe: Failed to stop sound: {e}")
            return False

    async def debug_sound(self, filename: str) -> dict:
        """Debug sound file path resolution."""
        result = {
            "filename": filename,
            "is_custom": filename.startswith("custom:"),
            "resolved_path": None,
            "file_exists": False,
            "settings_dir": settingsDir,
            "custom_sounds_dir": os.path.join(settingsDir, "custom_sounds"),
            "custom_sounds_files": []
        }
        
        # List files in custom_sounds dir
        custom_dir = os.path.join(settingsDir, "custom_sounds")
        if os.path.exists(custom_dir):
            result["custom_sounds_files"] = os.listdir(custom_dir)
        
        # Resolve path
        if filename.startswith("custom:"):
            actual_name = filename[7:]
            result["resolved_path"] = os.path.join(settingsDir, "custom_sounds", actual_name)
        else:
            plugin_dir = os.environ.get("DECKY_PLUGIN_DIR", "")
            if not plugin_dir:
                plugin_dir = os.path.dirname(settingsDir)
            result["resolved_path"] = os.path.join(plugin_dir, "dist", filename)
        
        result["file_exists"] = os.path.exists(result["resolved_path"]) if result["resolved_path"] else False
        
        decky.logger.info(f"AlarMe Debug: {result}")
        return result

    def _calculate_next_trigger(self, alarm: dict) -> float:
        """Calculate the next trigger time for an alarm."""
        if not alarm.get("enabled", True):
            return None
        
        # If snoozed, return snooze time (even if in past, so it triggers)
        if alarm.get("snoozed_until"):
            return alarm["snoozed_until"]
        
        now = datetime.now()
        target = now.replace(
            hour=alarm["hour"],
            minute=alarm["minute"],
            second=0,
            microsecond=0
        )
        
        # Check if this alarm was already triggered recently (within 2 minutes)
        last_triggered = alarm.get("last_triggered", 0)
        if last_triggered and (now.timestamp() - last_triggered) < 120:
            # Already triggered, schedule for next occurrence
            target += timedelta(days=1)
        elif target <= now:
            # Target time has passed today
            grace_seconds = (now - target).total_seconds()
            if grace_seconds < 90:  # 90 second grace period
                # Within grace period - this should trigger!
                pass
            else:
                # Missed it, schedule for tomorrow
                target += timedelta(days=1)
        
        recurring = alarm.get("recurring", "once")
        
        if recurring == "once":
            # For once alarms, return the target timestamp (even if in past for grace period)
            return target.timestamp()
        
        elif recurring == "daily":
            return target.timestamp()
        
        elif recurring == "weekdays":
            while target.weekday() >= 5:  # 5=Saturday, 6=Sunday
                target += timedelta(days=1)
            return target.timestamp()
        
        elif recurring == "weekends":
            while target.weekday() < 5:  # 0-4 are weekdays
                target += timedelta(days=1)
            return target.timestamp()
        
        else:
            # Custom days (comma-separated, 0=Monday)
            try:
                allowed_days = [int(d) for d in recurring.split(",")]
                for _ in range(7):
                    if target.weekday() in allowed_days:
                        return target.timestamp()
                    target += timedelta(days=1)
            except:
                return target.timestamp()
        
        return target.timestamp()

    async def _alarm_checker(self):
        """Background task to check and trigger alarms."""
        decky.logger.info("AlarMe: Alarm checker started!")
        check_count = 0
        try:
            while True:
                check_count += 1
                try:
                    alarms = await self._get_alarms()
                    now = datetime.now()
                    current_time = now.timestamp()
                    
                    # Only log occasionally to avoid spam (every 60 checks = 1 minute)
                    if check_count % 60 == 1:
                        decky.logger.info(f"AlarMe: Alarm check heartbeat - {len(alarms)} alarms")
                    
                    for alarm_id, alarm in alarms.items():
                        if not alarm.get("enabled", True):
                            continue
                        
                        next_trigger = self._calculate_next_trigger(alarm)
                        
                        if next_trigger:
                            diff = next_trigger - current_time
                            
                            if next_trigger <= current_time:
                                # Alarm should trigger!
                                decky.logger.info(f"AlarMe: >>> TRIGGERING alarm {alarm_id}! <<<")
                                
                                # Get per-alarm settings (no global fallback needed for alarms)
                                subtle = alarm.get("subtle_mode", False)
                                auto_suspend = alarm.get("auto_suspend", False)
                                alarm_sound = alarm.get("sound", "alarm.mp3")
                                alarm_volume = alarm.get("volume", 100)
                                
                                # Get global snooze duration
                                user_settings = await self._get_user_settings()
                                snooze_duration = user_settings.get("snooze_duration", 5)
                                
                                await decky.emit("alarme_alarm_triggered", {
                                    "id": alarm_id,
                                    "label": alarm.get("label", "Alarm"),
                                    "subtle": subtle,
                                    "sound": alarm_sound,
                                    "volume": alarm_volume,
                                    "snooze_duration": snooze_duration,
                                    "auto_suspend": auto_suspend
                                })
                                
                                # Handle one-time alarms - disable them
                                if alarm.get("recurring") == "once":
                                    decky.logger.info(f"AlarMe: Disabling one-time alarm {alarm_id}")
                                    alarms[alarm_id]["enabled"] = False
                                    alarms[alarm_id]["snoozed_until"] = None
                                else:
                                    # Check if this was a snooze trigger vs regular trigger
                                    was_snoozed = alarm.get("snoozed_until") is not None
                                    alarms[alarm_id]["snoozed_until"] = None
                                    
                                    if not was_snoozed:
                                        # Only set last_triggered for regular triggers, not snooze
                                        alarms[alarm_id]["last_triggered"] = current_time
                                
                                await self._save_alarms(alarms)
                                await self._emit_all_alarms()
                        else:
                            decky.logger.info(f"AlarMe: Alarm '{alarm_id}' ({alarm_time_str}) - no next trigger")
                
                except Exception as e:
                    decky.logger.error(f"AlarMe: Error in alarm check loop: {e}")
                
                await asyncio.sleep(1)  # Check every second for accuracy
                
        except asyncio.CancelledError:
            decky.logger.info("AlarMe: Alarm checker stopped")

    async def _get_alarms(self) -> dict:
        return await self.settings_getSetting(SETTINGS_KEY_ALARMS, {})

    async def _save_alarms(self, alarms: dict):
        await self.settings_setSetting(SETTINGS_KEY_ALARMS, alarms)
        await self.settings_commit()

    async def _emit_all_alarms(self):
        alarms = await self.get_alarms()
        await decky.emit("alarme_alarms_updated", alarms)

    # ==================== POMODORO METHODS ====================

    async def start_pomodoro(self) -> dict:
        """Start a new Pomodoro session."""
        user_settings = await self._get_user_settings()
        work_duration = user_settings.get("pomodoro_work_duration", 25) * 60
        
        pomodoro_state = await self._get_pomodoro_state()
        session = pomodoro_state.get("current_session", 0) + 1
        
        state = {
            "active": True,
            "is_break": False,
            "current_session": session,
            "current_cycle": 1,
            "start_time": time.time(),
            "end_time": time.time() + work_duration,
            "duration": work_duration
        }
        
        await self._save_pomodoro_state(state)
        
        # Cancel existing task if any
        if self.pomodoro_task:
            self.pomodoro_task.cancel()
        
        self.pomodoro_task = self.loop.create_task(self._pomodoro_handler())
        
        decky.logger.info(f"AlarMe: Started Pomodoro session {session}")
        
        # Inject stats for frontend update
        state["stats"] = await self._get_pomodoro_stats()
        
        await decky.emit("alarme_pomodoro_started", state)
        return state

    async def stop_pomodoro(self) -> bool:
        """Stop the current Pomodoro session."""
        if self.pomodoro_task:
            self.pomodoro_task.cancel()
            self.pomodoro_task = None
            
        # Update stats for partial session
        try:
            current_state = await self._get_pomodoro_state()
            if current_state.get("active") and current_state.get("start_time"):
                elapsed = time.time() - current_state.get("start_time")
                await self._update_pomodoro_stats(
                    is_break=current_state.get("is_break", False),
                    duration=elapsed
                )
        except Exception as e:
            decky.logger.error(f"AlarMe: Failed to update stats on stop: {e}")

        state = {
            "active": False,
            "is_break": False,
            "current_session": 0,
            "current_cycle": 0,
            "end_time": None,
            "duration": 0
        }
        await self._save_pomodoro_state(state)
        
        decky.logger.info("AlarMe: Stopped Pomodoro")
        
        # Inject stats
        state["stats"] = await self._get_pomodoro_stats()
        
        await decky.emit("alarme_pomodoro_stopped", state)
        return True

    async def skip_pomodoro_phase(self) -> dict:
        """Skip the current work/break phase."""
        pomodoro_state = await self._get_pomodoro_state()
        
        if not pomodoro_state.get("active"):
            return pomodoro_state
            
        # Update stats for skipped phase
        try:
            if pomodoro_state.get("start_time"):
                elapsed = time.time() - pomodoro_state.get("start_time")
                await self._update_pomodoro_stats(
                    is_break=pomodoro_state.get("is_break", False),
                    duration=elapsed
                )
        except Exception as e:
            decky.logger.error(f"AlarMe: Failed to update stats on skip: {e}")
        
        user_settings = await self._get_user_settings()
        is_break = pomodoro_state.get("is_break", False)
        session = pomodoro_state.get("current_session", 1)
        
        cycle = pomodoro_state.get("current_cycle", 1)
        
        if is_break:
            # Starting new work session from break
            # Check if we just finished a long break
            was_long_break = pomodoro_state.get("break_type") == "long"
            
            if was_long_break:
                new_session = 1
                new_cycle = cycle + 1
            else:
                new_session = session + 1
                new_cycle = cycle

            work_duration = user_settings.get("pomodoro_work_duration", 25) * 60
            work_duration = user_settings.get("pomodoro_work_duration", 25) * 60
            state = {
                "active": True,
                "is_break": False,
                "current_session": new_session,
                "current_cycle": new_cycle,
                "start_time": time.time(),
                "end_time": time.time() + work_duration,
                "duration": work_duration
            }
        else:
            # Starting break
            sessions_until_long = user_settings.get("pomodoro_sessions_until_long_break", 4)
            if session % sessions_until_long == 0:
                break_duration = user_settings.get("pomodoro_long_break_duration", 15) * 60
                break_type = "long"
            else:
                break_duration = user_settings.get("pomodoro_break_duration", 5) * 60
                break_type = "short"
            
            state = {
                "active": True,
                "is_break": True,
                "current_session": session,
                "current_cycle": cycle,
                "start_time": time.time(),
                "end_time": time.time() + break_duration,
                "duration": break_duration,
                "break_type": break_type
            }
        
        await self._save_pomodoro_state(state)
        
        # Restart handler
        if self.pomodoro_task:
            self.pomodoro_task.cancel()
        self.pomodoro_task = self.loop.create_task(self._pomodoro_handler())
        
        await decky.emit("alarme_pomodoro_phase_changed", state)
        return state

    async def _get_pomodoro_stats(self) -> dict:
        """Get stats from user settings, handling daily buffer reset and streak tracking."""
        settings = await self._get_user_settings()
        # Default structure with new fields
        defaults = {
            "daily_focus_time": 0,
            "daily_break_time": 0,
            "daily_sessions": 0,
            "total_focus_time": 0,
            "total_break_time": 0,
            "total_sessions": 0,
            "total_cycles": 0,
            "last_active_date": "",
            "daily_history": [],  # List of {date, focus_time, sessions}
            "current_streak": 0,
            "longest_streak": 0
        }
        
        stats = settings.get("pomodoro_stats", {})
        # Merge defaults for missing keys
        for k, v in defaults.items():
            if k not in stats:
                stats[k] = v
        
        # Check daily reset
        today = datetime.now().strftime("%Y-%m-%d")
        if stats.get("last_active_date") != today:
            # Archive yesterday's data if there was activity
            last_date = stats.get("last_active_date", "")
            if last_date and (stats.get("daily_focus_time", 0) > 0 or stats.get("daily_sessions", 0) > 0):
                # Add to history
                history_entry = {
                    "date": last_date,
                    "focus_time": stats.get("daily_focus_time", 0),
                    "sessions": stats.get("daily_sessions", 0)
                }
                history = stats.get("daily_history", [])
                history.append(history_entry)
                # Keep only last 30 days
                if len(history) > 30:
                    history = history[-30:]
                stats["daily_history"] = history
                
                # Update streak - check if consecutive
                if last_date:
                    from datetime import timedelta
                    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
                    if last_date == yesterday:
                        # Consecutive day - increment streak
                        stats["current_streak"] = stats.get("current_streak", 0) + 1
                    else:
                        # Gap detected - reset streak (but archive if there was activity today)
                        if stats.get("daily_sessions", 0) > 0:
                            stats["current_streak"] = 1
                        else:
                            stats["current_streak"] = 0
                            
                    # Update longest streak
                    if stats["current_streak"] > stats.get("longest_streak", 0):
                        stats["longest_streak"] = stats["current_streak"]
            
            # Reset daily counters
            stats["daily_focus_time"] = 0
            stats["daily_break_time"] = 0
            stats["daily_sessions"] = 0
            stats["last_active_date"] = today
            
        return stats

    async def _update_pomodoro_stats(self, is_break: bool, duration: float, completed_session: bool = False, completed_cycle: bool = False):
        """Update persistent stats."""
        settings = await self._get_user_settings()
        # Get fresh stats via helper which handles reset logic
        stats = await self._get_pomodoro_stats()
        
        # Add duration (ensure positive)
        duration = max(0, duration)
        
        if is_break:
            stats["daily_break_time"] += duration
            stats["total_break_time"] += duration
        else:
            stats["daily_focus_time"] += duration
            stats["total_focus_time"] += duration
            
        if completed_session and not is_break:
            stats["total_sessions"] = stats.get("total_sessions", 0) + 1
            stats["daily_sessions"] = stats.get("daily_sessions", 0) + 1
            
        if completed_cycle:
            stats["total_cycles"] = stats.get("total_cycles", 0) + 1
            
        # Save back to settings
        settings["pomodoro_stats"] = stats
        await self.settings_setSetting(SETTINGS_KEY_SETTINGS, settings)
        await self.settings_commit()

    async def reset_pomodoro_stats(self) -> bool:
        """Reset all Pomodoro statistics."""
        defaults = {
            "daily_focus_time": 0,
            "daily_break_time": 0,
            "daily_sessions": 0,
            "total_focus_time": 0,
            "total_break_time": 0,
            "total_sessions": 0,
            "total_cycles": 0,
            "last_active_date": "",
            "daily_history": [],
            "current_streak": 0,
            "longest_streak": 0
        }
        
        settings = await self._get_user_settings()
        settings["pomodoro_stats"] = defaults
        await self.settings_setSetting(SETTINGS_KEY_SETTINGS, settings)
        await self.settings_commit()
        return True

    async def get_pomodoro_state(self) -> dict:
        """Get current Pomodoro state with remaining time."""
        state = await self._get_pomodoro_state()
        if state.get("active") and state.get("end_time"):
            state["remaining"] = max(0, state["end_time"] - time.time())
        else:
            state["remaining"] = 0
            
        state["stats"] = await self._get_pomodoro_stats()
        return state

    async def _pomodoro_handler(self):
        """Background task to handle Pomodoro timing."""
        try:
            while True:
                state = await self._get_pomodoro_state()
                
                if not state.get("active"):
                    return
                
                remaining = state.get("end_time", 0) - time.time()
                
                if remaining <= 0:
                    # Phase completed
                    user_settings = await self._get_user_settings()
                    is_break = state.get("is_break", False)
                    session = state.get("current_session", 1)
                    
                    cycle = state.get("current_cycle", 1)
                    
                    # Update stats for completed phase
                    try:
                        if state.get("start_time"):
                            elapsed = time.time() - state.get("start_time")
                            await self._update_pomodoro_stats(
                                is_break=is_break,
                                duration=elapsed,
                                completed_session=not is_break,
                                completed_cycle=is_break and state.get("break_type") == "long"
                            )
                    except Exception as e:
                        decky.logger.error(f"AlarMe: Failed to update stats on completion: {e}")
                    
                    if is_break:
                        # Break finished, start new work session
                        work_duration = user_settings.get("pomodoro_work_duration", 25) * 60
                        pomodoro_sound = user_settings.get("pomodoro_sound", "alarm.mp3")
                        is_subtle = user_settings.get("pomodoro_subtle_mode", False)
                        
                        # Check if we just finished a long break
                        was_long_break = state.get("break_type") == "long"
                        if was_long_break:
                            new_session = 1
                            new_cycle = cycle + 1
                        else:
                            new_session = session + 1
                            new_cycle = cycle
                            
                        new_state = {
                            "active": True,
                            "is_break": False,
                            "current_session": new_session,
                            "current_cycle": new_cycle,
                            "start_time": time.time(),
                            "end_time": time.time() + work_duration,
                            "duration": work_duration,
                            "sound": pomodoro_sound,
                            "subtle_mode": is_subtle
                        }
                        await decky.emit("alarme_pomodoro_break_ended", new_state)
                    else:
                        # Work finished, start break
                        sessions_until_long = user_settings.get("pomodoro_sessions_until_long_break", 4)
                        if session % sessions_until_long == 0:
                            break_duration = user_settings.get("pomodoro_long_break_duration", 15) * 60
                            break_type = "long"
                        else:
                            break_duration = user_settings.get("pomodoro_break_duration", 5) * 60
                            break_type = "short"
                        
                        new_state = {
                            "active": True,
                            "is_break": True,
                            "current_session": session,
                            "current_cycle": cycle,
                            "start_time": time.time(),
                            "end_time": time.time() + break_duration,
                            "duration": break_duration,
                            "break_type": break_type,
                            "sound": user_settings.get("pomodoro_sound", "alarm.mp3"),
                            "subtle_mode": user_settings.get("pomodoro_subtle_mode", False)
                        }
                        await decky.emit("alarme_pomodoro_work_ended", new_state)
                    
                    await self._save_pomodoro_state(new_state)
                    decky.logger.info(f"AlarMe: Pomodoro phase changed - is_break={new_state['is_break']}")
                
                # Emit tick every 5 seconds
                await decky.emit("alarme_pomodoro_tick", {
                    "remaining": max(0, remaining),
                    "is_break": state.get("is_break", False),
                    "session": state.get("current_session", 1),
                    "cycle": state.get("current_cycle", 1)
                })
                
                await asyncio.sleep(1)  # Update every second for real-time display
                
        except asyncio.CancelledError:
            decky.logger.info("AlarMe: Pomodoro handler stopped")

    async def _get_pomodoro_state(self) -> dict:
        return await self.settings_getSetting(SETTINGS_KEY_POMODORO, {
            "active": False,
            "is_break": False,
            "current_session": 0,
            "current_cycle": 0,
            "end_time": None,
            "duration": 0
        })

    async def _save_pomodoro_state(self, state: dict):
        await self.settings_setSetting(SETTINGS_KEY_POMODORO, state)
        await self.settings_commit()

    # ==================== PRESET METHODS ====================

    async def get_presets(self) -> list:
        """Get all timer presets."""
        return await self.settings_getSetting(SETTINGS_KEY_PRESETS, DEFAULT_PRESETS)

    async def save_preset(self, seconds: int, label: str) -> dict:
        """Save a new timer preset."""
        preset_id = str(uuid.uuid4())[:8]
        preset = {
            "id": preset_id,
            "seconds": seconds,
            "label": label
        }
        
        presets = await self.get_presets()
        presets.append(preset)
        await self.settings_setSetting(SETTINGS_KEY_PRESETS, presets)
        await self.settings_commit()
        
        await decky.emit("alarme_presets_updated", presets)
        return preset

    async def remove_preset(self, preset_id: str) -> bool:
        """Remove a timer preset."""
        presets = await self.get_presets()
        presets = [p for p in presets if p.get("id") != preset_id]
        await self.settings_setSetting(SETTINGS_KEY_PRESETS, presets)
        await self.settings_commit()
        
        await decky.emit("alarme_presets_updated", presets)
        return True

    # ==================== SETTINGS METHODS ====================

    async def get_settings(self) -> dict:
        """Get user settings."""
        return await self._get_user_settings()

    async def update_settings(self, new_settings: dict) -> dict:
        """Update user settings."""
        current = await self._get_user_settings()
        current.update(new_settings)
        await self.settings_setSetting(SETTINGS_KEY_SETTINGS, current)
        await self.settings_commit()
        
        await decky.emit("alarme_settings_updated", current)
        return current

    async def export_backup(self) -> str:
        """Export all user data (alarms, presets, settings, recent timers) to JSON string."""
        data = {
            "version": 1,
            "timestamp": time.time(),
            "alarms": await self._get_alarms(),
            "presets": await self.get_presets(),
            "recent_timers": await self.get_recent_timers(),
            "user_settings": await self._get_user_settings()
        }
        return json.dumps(data, indent=2)

    async def export_backup_to_file(self, filepath: str) -> bool:
        """Export backup to a specific file."""
        try:
            # Expand ~ to user home
            filepath = os.path.expanduser(filepath)
            
            # Create directory if it doesn't exist
            directory = os.path.dirname(filepath)
            if directory and not os.path.exists(directory):
                os.makedirs(directory)
                
            json_str = await self.export_backup()
            
            with open(filepath, 'w') as f:
                f.write(json_str)
            
            decky.logger.info(f"AlarMe: Backup exported to {filepath}")
            return True
        except Exception as e:
            decky.logger.error(f"AlarMe: Export to file failed: {e}")
            return False

    async def import_backup_from_file(self, filepath: str) -> bool:
        """Import backup from a specific file."""
        try:
            # Expand ~ to user home
            filepath = os.path.expanduser(filepath)
            
            if not os.path.exists(filepath):
                decky.logger.error(f"AlarMe: Import file not found: {filepath}")
                return False
                
            with open(filepath, 'r') as f:
                json_str = f.read()
                
            return await self.import_backup(json_str)
        except Exception as e:
             decky.logger.error(f"AlarMe: Import from file failed: {e}")
             return False

    async def import_backup(self, json_str: str) -> bool:
        """Import user data from JSON string."""
        try:
            data = json.loads(json_str)
            
            # Basic validation
            if not isinstance(data, dict):
                return False
                
            # Restore components individually if present
            if "alarms" in data:
                await self._save_alarms(data["alarms"])
                await self._emit_all_alarms()
                
            if "presets" in data:
                await self.settings_setSetting(SETTINGS_KEY_PRESETS, data["presets"])
                await self.settings_commit()
                await decky.emit("alarme_presets_updated", data["presets"])
                
            if "recent_timers" in data:
                await self.settings_setSetting(SETTINGS_KEY_RECENT_TIMERS, data["recent_timers"])
                await self.settings_commit()
                
            if "user_settings" in data:
                # Merge with defaults to ensure new settings exist
                settings_to_save = {**DEFAULT_SETTINGS, **data["user_settings"]}
                await self.settings_setSetting(SETTINGS_KEY_SETTINGS, settings_to_save)
                await self.settings_commit()
                await decky.emit("alarme_settings_updated", settings_to_save)
            
            decky.logger.info("AlarMe: Backup imported successfully")
            return True
        except Exception as e:
             decky.logger.error(f"AlarMe: Import failed: {e}")
             return False

    async def _get_user_settings(self) -> dict:
        saved = await self.settings_getSetting(SETTINGS_KEY_SETTINGS, {})
        return {**DEFAULT_SETTINGS, **saved}

    # ==================== CORE SETTINGS METHODS ====================

    async def settings_read(self):
        decky.logger.info('Reading settings')
        return settings.read()

    async def settings_commit(self):
        decky.logger.info('Saving settings')
        return settings.commit()

    async def settings_getSetting(self, key: str, defaults):
        return settings.getSetting(key, defaults)

    async def settings_setSetting(self, key: str, value):
        return settings.setSetting(key, value)

    # ==================== REMINDER METHODS ====================

    async def create_reminder(self, label: str = "", frequency_minutes: int = 60,
                             start_time: str = None, recurrences: int = -1,
                             only_while_gaming: bool = False, reset_on_game_start: bool = False,
                             sound: str = "alarm.mp3", volume: int = 100,
                             subtle_mode: bool = False) -> dict:
        """
        Create a new periodic reminder.
        frequency_minutes: interval between reminders (15-180)
        start_time: ISO timestamp for first trigger, or None for "now"
        recurrences: -1 = infinite, or positive integer
        only_while_gaming: if True, only tick down while a game is running
        reset_on_game_start: if True, reset timer loop when game starts
        """
        reminder_id = str(uuid.uuid4())[:8]
        
        # Calculate first trigger time
        if start_time:
            next_trigger = start_time
        else:
            # "Now" means start counting from now
            next_trigger = (datetime.now() + timedelta(minutes=frequency_minutes)).isoformat()
        
        reminder_data = {
            "id": reminder_id,
            "label": label or f"Reminder every {frequency_minutes} min",
            "frequency_minutes": frequency_minutes,
            "start_time": start_time,
            "recurrences": recurrences,
            "only_while_gaming": only_while_gaming,
            "reset_on_game_start": reset_on_game_start,
            "sound": sound,
            "volume": volume,
            "subtle_mode": subtle_mode,
            "enabled": True,
            "created_at": time.time(),
            "next_trigger": next_trigger,
            "triggers_remaining": recurrences  # -1 = infinite
        }
        
        reminders = await self._get_reminders()
        reminders[reminder_id] = reminder_data
        await self._save_reminders(reminders)
        
        decky.logger.info(f"AlarMe: Created reminder {reminder_id} every {frequency_minutes} min")
        await decky.emit("alarme_reminder_created", reminder_data)
        await self._emit_all_reminders()
        
        return reminder_data

    async def update_reminder(self, reminder_id: str, label: str = "", 
                             frequency_minutes: int = 60, start_time: str = None,
                             recurrences: int = -1, only_while_gaming: bool = False,
                             reset_on_game_start: bool = False,
                             sound: str = "alarm.mp3", volume: int = 100,
                             subtle_mode: bool = False) -> dict:
        """Update an existing reminder's settings."""
        reminders = await self._get_reminders()
        if reminder_id not in reminders:
            return None
        
        reminder = reminders[reminder_id]
        reminder["label"] = label or f"Reminder every {frequency_minutes} min"
        reminder["frequency_minutes"] = frequency_minutes
        reminder["start_time"] = start_time
        reminder["recurrences"] = recurrences
        reminder["only_while_gaming"] = only_while_gaming
        reminder["reset_on_game_start"] = reset_on_game_start
        reminder["sound"] = sound
        reminder["volume"] = volume
        reminder["subtle_mode"] = subtle_mode
        
        # Recalculate next trigger if frequency changed
        if start_time:
            reminder["next_trigger"] = start_time
        else:
            reminder["next_trigger"] = (datetime.now() + timedelta(minutes=frequency_minutes)).isoformat()
        reminder["triggers_remaining"] = recurrences
        
        await self._save_reminders(reminders)
        await decky.emit("alarme_reminder_updated", reminder)
        await self._emit_all_reminders()
        
        decky.logger.info(f"AlarMe: Updated reminder {reminder_id}")
        return reminder

    async def delete_reminder(self, reminder_id: str) -> bool:
        """Delete a reminder."""
        reminders = await self._get_reminders()
        if reminder_id in reminders:
            del reminders[reminder_id]
            await self._save_reminders(reminders)
            
            # Cancel any active task for this reminder
            if reminder_id in self.reminder_tasks:
                self.reminder_tasks[reminder_id].cancel()
                del self.reminder_tasks[reminder_id]
            
            decky.logger.info(f"AlarMe: Deleted reminder {reminder_id}")
            await decky.emit("alarme_reminder_deleted", reminder_id)
            await self._emit_all_reminders()
            return True
        return False

    async def toggle_reminder(self, reminder_id: str, enabled: bool) -> bool:
        """Enable or disable a reminder."""
        reminders = await self._get_reminders()
        if reminder_id in reminders:
            reminders[reminder_id]["enabled"] = enabled
            
            # Reset next trigger if re-enabling
            if enabled:
                freq = reminders[reminder_id]["frequency_minutes"]
                reminders[reminder_id]["next_trigger"] = (datetime.now() + timedelta(minutes=freq)).isoformat()
                reminders[reminder_id]["triggers_remaining"] = reminders[reminder_id]["recurrences"]
            
            await self._save_reminders(reminders)
            await decky.emit("alarme_reminder_updated", reminders[reminder_id])
            await self._emit_all_reminders()
            return True
        return False

    async def get_reminders(self) -> list:
        """Get all reminders."""
        reminders = await self._get_reminders()
        return list(reminders.values())

    async def _get_reminders(self) -> dict:
        return await self.settings_getSetting(SETTINGS_KEY_REMINDERS, {})

    async def _save_reminders(self, reminders: dict):
        await self.settings_setSetting(SETTINGS_KEY_REMINDERS, reminders)
        await self.settings_commit()

    async def _emit_all_reminders(self):
        reminders = await self.get_reminders()
        await decky.emit("alarme_reminders_updated", reminders)

    async def get_game_status(self) -> bool:
        """Get current game running status."""
        return await self._is_game_running()


    async def _is_game_running(self) -> bool:
        """Check if a game is currently running (updated by frontend)."""
        return self._game_running

    async def set_game_running(self, is_running: bool) -> bool:
        """Update game running state from frontend."""
        self._game_running = is_running
        decky.logger.info(f"AlarMe: Game running state set to {is_running}")
        
        # Handle "Reset on game start" logic
        if is_running:
            reminders = await self._get_reminders()
            modified = False
            now = datetime.now()
            
            for reminder_id, reminder in reminders.items():
                if not reminder.get("enabled"):
                    continue
                    
                if reminder.get("only_while_gaming") and reminder.get("reset_on_game_start"):
                    # Reset this reminder
                    freq = reminder.get("frequency_minutes", 60)
                    reminder["next_trigger"] = (now + timedelta(minutes=freq)).isoformat()
                    # Reset recurrences too if they were counting down? 
                    # Usually "reset" implies starting fresh, so yes, reset triggers_remaining
                    # But the user said "start time is set to when the game was launched"
                    # If I have a limit of 3 times, does launching a game reset it to 3 or just delay the next one?
                    # "resetting the reminder" usually means fresh start.
                    original_recurrences = reminder.get("recurrences", -1)
                    if original_recurrences != -1:
                         reminder["triggers_remaining"] = original_recurrences
                    
                    decky.logger.info(f"AlarMe: Reset reminder {reminder_id} on game start")
                    modified = True
            
            if modified:
                await self._save_reminders(reminders)
                await self._emit_all_reminders()
                
        return True

    async def _reminder_checker(self):
        """Background task to check and trigger reminders."""
        decky.logger.info("AlarMe: Reminder checker started")
        
        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                
                reminders = await self._get_reminders()
                now = datetime.now()
                modified = False
                
                for reminder_id, reminder in list(reminders.items()):
                    if not reminder.get("enabled"):
                        continue
                    
                    # Check if exhausted
                    triggers_remaining = reminder.get("triggers_remaining", -1)
                    if triggers_remaining == 0:
                        continue
                    
                    # Check only_while_gaming
                    if reminder.get("only_while_gaming"):
                        if not await self._is_game_running():
                            continue
                    
                    # Check if it's time to trigger
                    next_trigger_str = reminder.get("next_trigger")
                    if not next_trigger_str:
                        continue
                    
                    try:
                        next_trigger = datetime.fromisoformat(next_trigger_str)
                    except:
                        continue
                    
                    if now >= next_trigger:
                        # Trigger the reminder!
                        decky.logger.info(f"AlarMe: Triggering reminder {reminder_id}")
                        
                        user_settings = await self._get_user_settings()
                        await decky.emit("alarme_reminder_triggered", {
                            "reminder": reminder,
                            "sound": reminder.get("sound", "alarm.mp3"),
                            "volume": reminder.get("volume", 100),
                            "subtle_mode": reminder.get("subtle_mode", False)
                        })
                        
                        # Update for next trigger
                        freq = reminder["frequency_minutes"]
                        reminder["next_trigger"] = (now + timedelta(minutes=freq)).isoformat()
                        
                        # Decrement remaining if not infinite
                        if triggers_remaining > 0:
                            reminder["triggers_remaining"] = triggers_remaining - 1
                        
                        modified = True
                
                if modified:
                    await self._save_reminders(reminders)
                    await self._emit_all_reminders()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                decky.logger.error(f"AlarMe: Reminder checker error: {e}")
                await asyncio.sleep(5)
        
        decky.logger.info("AlarMe: Reminder checker stopped")

    # ==================== LIFECYCLE METHODS ====================

    async def _main(self):
        """Plugin initialization."""
        self.loop = asyncio.get_event_loop()
        self.timer_tasks = {}
        
        await self.settings_read()
        
        # Resume any active timers
        timers = await self._get_timers()
        current_time = time.time()
        timers_to_remove = []
        
        for timer_id, timer in timers.items():
            remaining = timer["end_time"] - current_time
            if remaining > 0:
                decky.logger.info(f"AlarMe: Resuming timer {timer_id} with {remaining:.0f}s remaining")
                self.timer_tasks[timer_id] = self.loop.create_task(
                    self._timer_handler(timer_id, timer["end_time"], timer.get("label", "Timer"))
                )
            else:
                timers_to_remove.append(timer_id)
        
        # Clean up expired timers
        for timer_id in timers_to_remove:
            del timers[timer_id]
        if timers_to_remove:
            await self._save_timers(timers)
        
        # Resume Pomodoro if active
        pomodoro = await self._get_pomodoro_state()
        if pomodoro.get("active") and pomodoro.get("end_time"):
            if pomodoro["end_time"] > current_time:
                decky.logger.info("AlarMe: Resuming Pomodoro session")
                self.pomodoro_task = self.loop.create_task(self._pomodoro_handler())
        
        # Start alarm checker
        self.alarm_check_task = self.loop.create_task(self._alarm_checker())
        
        # Start reminder checker
        self.reminder_check_task = self.loop.create_task(self._reminder_checker())
        
        decky.logger.info("AlarMe: Plugin initialized successfully")

    async def _unload(self):
        """Plugin unload cleanup."""
        # Cancel all timer tasks
        for timer_id, task in self.timer_tasks.items():
            task.cancel()
        self.timer_tasks.clear()
        
        # Cancel alarm checker
        if self.alarm_check_task:
            self.alarm_check_task.cancel()
        
        # Cancel Pomodoro
        if self.pomodoro_task:
            self.pomodoro_task.cancel()
        
        # Cancel reminder checker
        if self.reminder_check_task:
            self.reminder_check_task.cancel()
        for task in self.reminder_tasks.values():
            task.cancel()
        self.reminder_tasks.clear()
        
        decky.logger.info("AlarMe: Plugin unloaded")

    async def _uninstall(self):
        """Plugin uninstall cleanup."""
        decky.logger.info("AlarMe: Plugin uninstalled")

    async def _migration(self):
        """Plugin migration."""
        decky.logger.info("AlarMe: Running migration")
        
        decky.migrate_logs(os.path.join(decky.DECKY_USER_HOME, ".config", "alarme", "plugin.log"))
        decky.migrate_settings(
            os.path.join(decky.DECKY_HOME, "settings", "alarme.json"),
            os.path.join(decky.DECKY_USER_HOME, ".config", "alarme"))
        decky.migrate_runtime(
            os.path.join(decky.DECKY_HOME, "alarme"),
            os.path.join(decky.DECKY_USER_HOME, ".local", "share", "alarme"))
