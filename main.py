# Alar.me - Decky Loader Plugin
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
decky.logger.info(f'Alar.me: Settings path = {os.path.join(settingsDir, "settings.json")}')
settings = SettingsManager(name="settings", settings_directory=settingsDir)
settings.read()

# Settings keys
SETTINGS_KEY_TIMERS = "active_timers"
SETTINGS_KEY_ALARMS = "alarms"
SETTINGS_KEY_PRESETS = "presets"
SETTINGS_KEY_SETTINGS = "user_settings"
SETTINGS_KEY_POMODORO = "pomodoro_state"

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
    loop = None

    # ==================== TIMER METHODS ====================

    async def create_timer(self, seconds: int, label: str = "") -> str:
        """Create a new countdown timer."""
        timer_id = str(uuid.uuid4())[:8]
        end_time = time.time() + seconds
        
        timer_data = {
            "id": timer_id,
            "label": label or f"Timer {timer_id}",
            "seconds": seconds,
            "end_time": end_time,
            "created_at": time.time()
        }
        
        # Save to settings
        timers = await self._get_timers()
        timers[timer_id] = timer_data
        await self._save_timers(timers)
        
        # Start the timer task
        self.timer_tasks[timer_id] = self.loop.create_task(
            self._timer_handler(timer_id, end_time, label or f"Timer {timer_id}")
        )
        
        decky.logger.info(f"Alar.me: Created timer {timer_id} for {seconds} seconds")
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
            decky.logger.info(f"Alar.me: Cancelled timer {timer_id}")
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
                    decky.logger.info(f"Alar.me: Timer {timer_id} completed")
                    return
                
                # Emit update every second for real-time display
                await decky.emit("alarme_timer_tick", {
                    "id": timer_id,
                    "remaining": remaining
                })
                await asyncio.sleep(1)
                
        except asyncio.CancelledError:
            decky.logger.info(f"Alar.me: Timer {timer_id} was cancelled")

    async def _get_timers(self) -> dict:
        return await self.settings_getSetting(SETTINGS_KEY_TIMERS, {})

    async def _save_timers(self, timers: dict):
        await self.settings_setSetting(SETTINGS_KEY_TIMERS, timers)
        await self.settings_commit()

    async def _emit_all_timers(self):
        timers = await self.get_active_timers()
        await decky.emit("alarme_timers_updated", timers)

    # ==================== ALARM METHODS ====================

    async def create_alarm(self, hour: int, minute: int, label: str = "", 
                          recurring: str = "once", sound: str = "alarm.mp3",
                          volume: int = 100, snooze_duration: int = 5,
                          subtle_mode: bool = False, auto_suspend: bool = False) -> str:
        """
        Create a new alarm.
        recurring: 'once', 'daily', 'weekdays', 'weekends', or comma-separated days (0-6, 0=Monday)
        sound: filename of the sound to play (from assets folder)
        volume: 0-100 alarm volume
        snooze_duration: minutes to snooze
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
            "snooze_duration": snooze_duration,
            "subtle_mode": subtle_mode,
            "auto_suspend": auto_suspend
        }
        
        alarms = await self._get_alarms()
        alarms[alarm_id] = alarm_data
        await self._save_alarms(alarms)
        
        decky.logger.info(f"Alar.me: Created alarm {alarm_id} for {hour:02d}:{minute:02d} with sound {sound}")
        await decky.emit("alarme_alarm_created", alarm_data)
        await self._emit_all_alarms()
        
        return alarm_id

    async def cancel_alarm(self, alarm_id: str) -> bool:
        """Delete an alarm."""
        alarms = await self._get_alarms()
        if alarm_id in alarms:
            del alarms[alarm_id]
            await self._save_alarms(alarms)
            decky.logger.info(f"Alar.me: Deleted alarm {alarm_id}")
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
                          snooze_duration: int = 5, subtle_mode: bool = False,
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
            alarm["snooze_duration"] = snooze_duration
            alarm["subtle_mode"] = subtle_mode
            alarm["auto_suspend"] = auto_suspend
            # Re-enable alarm when edited (user expects it to be active)
            alarm["enabled"] = True
            # Clear snooze and last_triggered when alarm time changes
            alarm["snoozed_until"] = None
            alarm["last_triggered"] = None
            
            await self._save_alarms(alarms)
            decky.logger.info(f"Alar.me: Updated alarm {alarm_id} to {hour:02d}:{minute:02d}, recurring={recurring}, sound={sound}")
            await decky.emit("alarme_alarm_updated", alarm)
            await self._emit_all_alarms()
            return True
        decky.logger.warning(f"Alar.me: Update failed - alarm {alarm_id} not found")
        return False

    async def snooze_alarm(self, alarm_id: str, minutes: int = None) -> bool:
        """Snooze an alarm for the specified minutes."""
        alarms = await self._get_alarms()
        if alarm_id in alarms:
            alarm = alarms[alarm_id]
            # Use provided minutes, or per-alarm snooze_duration, or fall back to global setting
            if minutes is None:
                minutes = alarm.get("snooze_duration")
                if minutes is None:
                    user_settings = await self._get_user_settings()
                    minutes = user_settings.get("snooze_duration", 5)
            
            snooze_time = time.time() + (minutes * 60)
            alarms[alarm_id]["snoozed_until"] = snooze_time
            # Re-enable the alarm if it was disabled (important for "once" alarms)
            alarms[alarm_id]["enabled"] = True
            await self._save_alarms(alarms)
            
            snooze_dt = datetime.fromtimestamp(snooze_time)
            decky.logger.info(f"Alar.me: Snoozed alarm {alarm_id} for {minutes} minutes until {snooze_dt.strftime('%H:%M:%S')}")
            
            await decky.emit("alarme_alarm_snoozed", {
                "id": alarm_id,
                "snoozed_until": snooze_time,
                "minutes": minutes
            })
            await self._emit_all_alarms()
            return True
        decky.logger.warning(f"Alar.me: Snooze failed - alarm {alarm_id} not found")
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
        
        decky.logger.info(f"Alar.me Debug: {debug_info}")
        return debug_info

    async def get_sounds(self) -> list:
        """Get list of available sound files from the plugin dist folder."""
        # Start with special soundless option (no sound, no vibration)
        sounds = [
            {"filename": "soundless", "name": "🔇 Soundless"}
        ]
        try:
            # Get the plugin directory (parent of settings dir)
            plugin_dir = os.environ.get("DECKY_PLUGIN_DIR", "")
            if not plugin_dir:
                # Fallback: derive from settings dir
                plugin_dir = os.path.dirname(settingsDir)
            
            dist_dir = os.path.join(plugin_dir, "dist")
            
            if os.path.exists(dist_dir):
                for filename in os.listdir(dist_dir):
                    if filename.lower().endswith(('.mp3', '.wav', '.ogg')):
                        sounds.append({
                            "filename": filename,
                            "name": os.path.splitext(filename)[0].replace('_', ' ').title()
                        })
            
            decky.logger.info(f"Alar.me: Found {len(sounds)} sound options (including soundless)")
        except Exception as e:
            decky.logger.error(f"Alar.me: Error listing sounds: {e}")
            # Return soundless and default sound as fallback
            sounds = [
                {"filename": "soundless", "name": "🔇 Soundless"},
                {"filename": "alarm.mp3", "name": "Alarm"}
            ]
        
        return sounds

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
        decky.logger.info("Alar.me: Alarm checker started!")
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
                        decky.logger.info(f"Alar.me: Alarm check heartbeat - {len(alarms)} alarms")
                    
                    for alarm_id, alarm in alarms.items():
                        if not alarm.get("enabled", True):
                            continue
                        
                        next_trigger = self._calculate_next_trigger(alarm)
                        
                        if next_trigger:
                            diff = next_trigger - current_time
                            
                            if next_trigger <= current_time:
                                # Alarm should trigger!
                                decky.logger.info(f"Alar.me: >>> TRIGGERING alarm {alarm_id}! <<<")
                                
                                # Get per-alarm settings (no global fallback needed for alarms)
                                subtle = alarm.get("subtle_mode", False)
                                auto_suspend = alarm.get("auto_suspend", False)
                                alarm_sound = alarm.get("sound", "alarm.mp3")
                                alarm_volume = alarm.get("volume", 100)
                                
                                await decky.emit("alarme_alarm_triggered", {
                                    "id": alarm_id,
                                    "label": alarm.get("label", "Alarm"),
                                    "subtle": subtle,
                                    "sound": alarm_sound,
                                    "volume": alarm_volume,
                                    "auto_suspend": auto_suspend
                                })
                                
                                # Handle one-time alarms - disable them
                                if alarm.get("recurring") == "once":
                                    decky.logger.info(f"Alar.me: Disabling one-time alarm {alarm_id}")
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
                            decky.logger.info(f"Alar.me: Alarm '{alarm_id}' ({alarm_time_str}) - no next trigger")
                
                except Exception as e:
                    decky.logger.error(f"Alar.me: Error in alarm check loop: {e}")
                
                await asyncio.sleep(1)  # Check every second for accuracy
                
        except asyncio.CancelledError:
            decky.logger.info("Alar.me: Alarm checker stopped")

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
            "end_time": time.time() + work_duration,
            "duration": work_duration
        }
        
        await self._save_pomodoro_state(state)
        
        # Cancel existing task if any
        if self.pomodoro_task:
            self.pomodoro_task.cancel()
        
        self.pomodoro_task = self.loop.create_task(self._pomodoro_handler())
        
        decky.logger.info(f"Alar.me: Started Pomodoro session {session}")
        await decky.emit("alarme_pomodoro_started", state)
        return state

    async def stop_pomodoro(self) -> bool:
        """Stop the current Pomodoro session."""
        if self.pomodoro_task:
            self.pomodoro_task.cancel()
            self.pomodoro_task = None
        
        state = {
            "active": False,
            "is_break": False,
            "current_session": 0,
            "end_time": None,
            "duration": 0
        }
        await self._save_pomodoro_state(state)
        
        decky.logger.info("Alar.me: Stopped Pomodoro")
        await decky.emit("alarme_pomodoro_stopped", state)
        return True

    async def skip_pomodoro_phase(self) -> dict:
        """Skip the current work/break phase."""
        pomodoro_state = await self._get_pomodoro_state()
        
        if not pomodoro_state.get("active"):
            return pomodoro_state
        
        user_settings = await self._get_user_settings()
        is_break = pomodoro_state.get("is_break", False)
        session = pomodoro_state.get("current_session", 1)
        
        if is_break:
            # Starting new work session
            work_duration = user_settings.get("pomodoro_work_duration", 25) * 60
            state = {
                "active": True,
                "is_break": False,
                "current_session": session + 1,
                "end_time": time.time() + work_duration,
                "duration": work_duration
            }
        else:
            # Starting break
            sessions_until_long = user_settings.get("pomodoro_sessions_until_long_break", 4)
            if session % sessions_until_long == 0:
                break_duration = user_settings.get("pomodoro_long_break_duration", 15) * 60
            else:
                break_duration = user_settings.get("pomodoro_break_duration", 5) * 60
            
            state = {
                "active": True,
                "is_break": True,
                "current_session": session,
                "end_time": time.time() + break_duration,
                "duration": break_duration
            }
        
        await self._save_pomodoro_state(state)
        
        # Restart handler
        if self.pomodoro_task:
            self.pomodoro_task.cancel()
        self.pomodoro_task = self.loop.create_task(self._pomodoro_handler())
        
        await decky.emit("alarme_pomodoro_phase_changed", state)
        return state

    async def get_pomodoro_state(self) -> dict:
        """Get current Pomodoro state with remaining time."""
        state = await self._get_pomodoro_state()
        if state.get("active") and state.get("end_time"):
            state["remaining"] = max(0, state["end_time"] - time.time())
        else:
            state["remaining"] = 0
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
                    
                    if is_break:
                        # Break finished, start new work session
                        work_duration = user_settings.get("pomodoro_work_duration", 25) * 60
                        pomodoro_sound = user_settings.get("pomodoro_sound", "alarm.mp3")
                        new_state = {
                            "active": True,
                            "is_break": False,
                            "current_session": session + 1,
                            "end_time": time.time() + work_duration,
                            "duration": work_duration,
                            "sound": pomodoro_sound
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
                            "end_time": time.time() + break_duration,
                            "duration": break_duration,
                            "break_type": break_type,
                            "sound": user_settings.get("pomodoro_sound", "alarm.mp3")
                        }
                        await decky.emit("alarme_pomodoro_work_ended", new_state)
                    
                    await self._save_pomodoro_state(new_state)
                    decky.logger.info(f"Alar.me: Pomodoro phase changed - is_break={new_state['is_break']}")
                
                # Emit tick every 5 seconds
                await decky.emit("alarme_pomodoro_tick", {
                    "remaining": max(0, remaining),
                    "is_break": state.get("is_break", False),
                    "session": state.get("current_session", 1)
                })
                
                await asyncio.sleep(1)  # Update every second for real-time display
                
        except asyncio.CancelledError:
            decky.logger.info("Alar.me: Pomodoro handler stopped")

    async def _get_pomodoro_state(self) -> dict:
        return await self.settings_getSetting(SETTINGS_KEY_POMODORO, {
            "active": False,
            "is_break": False,
            "current_session": 0,
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
                decky.logger.info(f"Alar.me: Resuming timer {timer_id} with {remaining:.0f}s remaining")
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
                decky.logger.info("Alar.me: Resuming Pomodoro session")
                self.pomodoro_task = self.loop.create_task(self._pomodoro_handler())
        
        # Start alarm checker
        self.alarm_check_task = self.loop.create_task(self._alarm_checker())
        
        decky.logger.info("Alar.me: Plugin initialized successfully")

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
        
        decky.logger.info("Alar.me: Plugin unloaded")

    async def _uninstall(self):
        """Plugin uninstall cleanup."""
        decky.logger.info("Alar.me: Plugin uninstalled")

    async def _migration(self):
        """Plugin migration."""
        decky.logger.info("Alar.me: Running migration")
        
        decky.migrate_logs(os.path.join(decky.DECKY_USER_HOME, ".config", "alarme", "plugin.log"))
        decky.migrate_settings(
            os.path.join(decky.DECKY_HOME, "settings", "alarme.json"),
            os.path.join(decky.DECKY_USER_HOME, ".config", "alarme"))
        decky.migrate_runtime(
            os.path.join(decky.DECKY_HOME, "alarme"),
            os.path.join(decky.DECKY_USER_HOME, ".local", "share", "alarme"))
