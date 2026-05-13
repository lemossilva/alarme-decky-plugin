# AlarMe - Decky Loader Plugin
# Python Backend

from settings import SettingsManager
from datetime import datetime, timedelta
import time
import os
import decky 
import asyncio
import uuid
import json
import fcntl
import struct
import ssl

# SSL context that doesn't verify certificates (Steam Deck Python may lack CA bundles)
_NO_VERIFY_SSL = ssl.create_default_context()
_NO_VERIFY_SSL.check_hostname = False
_NO_VERIFY_SSL.verify_mode = ssl.CERT_NONE

# Browser-like User-Agent for all HTTP requests
_BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

_WALLPAPER_POOL_MAX = 20


def _http_get_bytes(url: str, timeout: int = 20) -> bytes:
    import urllib.request

    req = urllib.request.Request(url, headers={"User-Agent": _BROWSER_UA})
    with urllib.request.urlopen(req, timeout=timeout, context=_NO_VERIFY_SSL) as resp:
        return resp.read()


# Initialize settings
settingsDir = os.environ["DECKY_PLUGIN_SETTINGS_DIR"]
runtimeDir = os.environ["DECKY_PLUGIN_RUNTIME_DIR"]
decky.logger.info(f'AlarMe: Settings path = {os.path.join(settingsDir, "settings.json")}')
decky.logger.info(f"AlarMe: Runtime data path = {runtimeDir}")
settings = SettingsManager(name="settings", settings_directory=settingsDir)
settings.read()


def _wallpaper_cache_dir() -> str:
    d = os.path.join(runtimeDir, "wallpaper_cache")
    os.makedirs(d, exist_ok=True)
    return d


def _weather_cache_path() -> str:
    return os.path.join(_wallpaper_cache_dir(), "weather_cache.json")


def _wallpaper_meta_sidecar_path(image_path: str) -> str:
    base, _ext = os.path.splitext(image_path)
    return base + ".json"


def _wallpaper_write_meta(image_path: str, title: str | None, credit: str | None) -> None:
    t = (title or "").strip()
    c = (credit or "").strip()
    if not t and not c:
        return
    try:
        p = _wallpaper_meta_sidecar_path(image_path)
        with open(p, "w", encoding="utf-8") as f:
            json.dump({"title": t, "credit": c}, f, indent=0)
    except OSError as e:
        decky.logger.debug(f"AlarMe: wallpaper meta write failed: {e}")


def _wallpaper_read_meta(image_path: str) -> dict | None:
    p = _wallpaper_meta_sidecar_path(image_path)
    if not os.path.isfile(p):
        return None
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _merge_wallpaper_attribution_into_result(result: dict, image_path: str | None) -> None:
    if not image_path:
        return
    m = _wallpaper_read_meta(image_path)
    if not m:
        return
    t = (m.get("title") or "").strip()
    c = (m.get("credit") or "").strip()
    if t or c:
        result["attribution"] = {"title": t or None, "credit": c or None}


def _local_wallpapers_dir() -> str:
    d = os.path.join(runtimeDir, "wallpapers")
    os.makedirs(d, exist_ok=True)
    return d


def _legacy_settings_wallpapers_dir() -> str:
    return os.path.join(settingsDir, "wallpapers")

# Settings keys
SETTINGS_KEY_TIMERS = "active_timers"
SETTINGS_KEY_ALARMS = "alarms"
SETTINGS_KEY_PRESETS = "presets"
SETTINGS_KEY_SETTINGS = "user_settings"
SETTINGS_KEY_POMODORO = "pomodoro_state"
SETTINGS_KEY_RECENT_TIMERS = "recent_timers"
SETTINGS_KEY_REMINDERS = "reminders"
SETTINGS_KEY_STOPWATCH = "stopwatch_state"

# Limits to prevent excessive data
MAX_ACTIVE_TIMERS = 50
MAX_ALARMS = 100
MAX_REMINDERS = 50
MAX_RECENT_TIMERS = 20
MAX_PRESETS = 50
MAX_STOPWATCH_LAPS = 100
MAX_STOPWATCH_RUNTIME_MS = 24 * 60 * 60 * 1000  # 24 hours in milliseconds

# Default user settings
DEFAULT_SETTINGS = {
    "snooze_duration": 5,  # default minutes for alarm snooze
    "time_format_24h": True,
    # Timer settings
    "timer_sound": "alarm.mp3",
    "timer_volume": 100,
    "timer_subtle_mode": False,
    "timer_auto_suspend": False,
    "timer_prevent_sleep": False,
    # Pomodoro settings
    "pomodoro_sound": "alarm.mp3",
    "pomodoro_volume": 100,
    "pomodoro_subtle_mode": False,
    "pomodoro_prevent_sleep": False,
    "pomodoro_work_duration": 25,  # minutes
    "pomodoro_break_duration": 5,  # minutes
    "pomodoro_long_break_duration": 15,  # minutes
    "pomodoro_sessions_until_long_break": 4,
    # Missed Alerts settings
    "missed_alerts_enabled": True,
    "missed_alerts_window": 24,
    "reminder_suspend_behavior": "continue",
    "pomodoro_suspend_behavior": "continue",
    # Display settings
    "snooze_activation_delay": 2.0,
    # Overlay settings
    "overlay_enabled": False,
    "overlay_display_mode": "both",
    "overlay_position": "default",
    "overlay_custom_x": 10,
    "overlay_custom_y": 12,
    "overlay_text_size": 13,
    "overlay_opacity": 0.4,
    "overlay_max_alerts": 2,
    "overlay_time_window": 1,
    "overlay_show_timers": True,
    "overlay_show_alarms": True,
    "overlay_show_pomodoros": True,
    "overlay_show_reminders": True,
    "overlay_show_stopwatch": False,
    "overlay_compact_mode": False,
    "overlay_show_prevent_sleep_badge": True,
    "overlay_show_missed_badge": True,
    # Timer presets settings
    "presets_enabled": True,
    "presets_max_visible": 5,
    # Tab Order
    "tab_order": ["timers", "alarms", "pomodoro", "reminders", "stopwatch"],
    # Screensaver settings
        "screensaver_mode": "dim",           # "off" | "black" | "dim" | "wallpaper" — global default
    "screensaver_dim_opacity": 0.92,     # opacity of the dim overlay (0.0–1.0)
    "pomodoro_screensaver_mode": "off",  # pomodoro screensaver mode
    # Screensaver timer
    "screensaver_idle_seconds": 15,      # seconds idle before screensaver kicks in
    # Overlay during screensaver
    "overlay_during_screensaver": True,  # show GameOverlay above screensaver
    # Overlay extra info during screensaver
    "overlay_screensaver_show_clock": True,
    "overlay_screensaver_show_date": True,
    "overlay_screensaver_show_battery": True,
    # Screensaver 2.0 settings
    "screensaver_standalone_enabled": False,
    "screensaver_standalone_idle_seconds": 60,
    "overlay_screensaver_layout": "compact",
    "screensaver_clock_style": "digital",
    "screensaver_clock_size": 20,
    "screensaver_accent_color": "muted_gray",
    "screensaver_show_day_of_week": True,
    "screensaver_show_year": False,
    "screensaver_show_calendar_grid": False,
    "screensaver_battery_show_bar": False,
    "screensaver_battery_low_threshold": 20,
    "screensaver_show_alerts_list": True,
    "screensaver_show_system_stats": False,
    "screensaver_show_network_info": False,
    "screensaver_wallpaper_provider": "picsum",
    "screensaver_wallpaper_fit": "cover",
    "screensaver_wallpaper_blur": "none",
    "screensaver_wallpaper_dim": 0.4,
    "screensaver_wallpaper_interval": 300,
    "screensaver_wallpaper_pool_size": 5,
    "screensaver_wallpaper_auto_rotate": True,
    "screensaver_wallpaper_cache_updated_at": None,
    "screensaver_wallpaper_shift_local": False,
    "screensaver_show_weather": False,
    "screensaver_weather_lat": None,
    "screensaver_weather_lon": None,
    "screensaver_weather_city_name": None,
    "screensaver_weather_unit": "C",
    "screensaver_weather_show_highlow": True,
    "screensaver_weather_show_condition": True,
    "screensaver_weather_refresh_minutes": 30,
    "screensaver_weather_location_source": None,
    "screensaver_nasa_api_key": "",
    "screensaver_wallpaper_show_attribution": True,
    "screensaver_floating_drift_range": 40,
    # Pixel shift for OLED burn-in prevention
    "pixel_shift_enabled": True,
    "pixel_shift_range": 3,          # max pixel displacement (1-10)
    "pixel_shift_interval_seconds": 60  # seconds between shifts
}

# Default presets
DEFAULT_PRESETS = [
    {"id": "preset-5", "seconds": 300, "label": "5 minutes", "subtle_mode": False, "auto_suspend": False},
    {"id": "preset-10", "seconds": 600, "label": "10 minutes", "subtle_mode": False, "auto_suspend": False},
    {"id": "preset-15", "seconds": 900, "label": "15 minutes", "subtle_mode": False, "auto_suspend": False},
    {"id": "preset-30", "seconds": 1800, "label": "30 minutes", "subtle_mode": False, "auto_suspend": False},
    {"id": "preset-60", "seconds": 3600, "label": "1 hour", "subtle_mode": False, "auto_suspend": False},
]


class Plugin:
    # Active timer tasks
    timer_tasks: dict = {}
    alarm_check_task = None
    pomodoro_task = None
    reminder_check_task = None
    suspend_monitor_task = None
    reminder_tasks: dict = {}  # Active reminder countdown tasks
    _game_running: bool = False  # Track game state from frontend
    loop = None
    
    # Missed Items State
    missed_items: list = []
    last_tick: float = 0

    # Sleep Inhibitor State
    _sleep_inhibitor_active: bool = False
    _uinput_fd = -1
    _jiggler_task = None

    # ==================== MISSED ITEMS METHODS ====================

    async def get_missed_items(self) -> list:
        """Get list of missed items."""
        return await self.settings_getSetting("missed_alerts_items", [])

    async def clear_missed_items(self) -> bool:
        """Clear all missed items."""
        await self.settings_setSetting("missed_alerts_items", [])
        await self.settings_commit()
        await self._emit_missed_update()
        return True

    async def _emit_missed_update(self):
        """Emit the current missed items to the frontend."""
        missed = await self.get_missed_items()
        await decky.emit("alarme_missed_items_updated", missed)

    async def _add_missed_item(self, m_type: str, m_id: str, label: str, timestamp: float, details: str = None):
        """Add an item to the missed alerts list."""
        user_settings = await self._get_user_settings()
        if not user_settings.get("missed_alerts_enabled", True):
            return

        missed = await self.settings_getSetting("missed_alerts_items", [])
        
        # Check for duplicates (same ID within small window)
        for item in missed:
            if item["id"] == m_id and abs(item["missed_at"] - timestamp) < 60:
                return

        item = {
            "id": m_id,
            "type": m_type,
            "label": label,
            "due_time": timestamp,
            "missed_at": timestamp
        }
        if details:
            item["details"] = details
            
        missed.append(item)
        
        # Prune old items
        window = float(user_settings.get("missed_alerts_window", 24)) * 3600
        cutoff = time.time() - window
        missed = [i for i in missed if i["missed_at"] > cutoff]
        
        await self.settings_setSetting("missed_alerts_items", missed)
        await self.settings_commit()
        
        # Notify frontend
        await self._emit_missed_update()

    # ==================== SLEEP INHIBITOR METHODS ====================

    def _compute_effective_screensaver_mode(self, user_settings: dict) -> str:
        """Return the global screensaver mode. Per-alert modes are no longer used."""
        return user_settings.get("screensaver_mode", "off")

    async def _update_sleep_inhibitor(self):
        """Update the sleep inhibitor based on per-item prevent_sleep flags.
        Per-alert screensaver_mode determines whether that alert contributes to the screensaver.
        The global screensaver_mode determines the visual behavior."""
        should_inhibit = False
        reason_parts = []
        inhibiting_items = []
        timer_count = 0
        alarm_count = 0
        reminder_count = 0
        
        user_settings = await self._get_user_settings()
        global_mode = user_settings.get("screensaver_mode", "off")
        
        # Check timers with prevent_sleep=True AND screensaver_mode != "off"
        timers = await self._get_timers()
        for timer_id, timer in timers.items():
            if not timer.get("paused", False) and timer.get("prevent_sleep", False):
                should_inhibit = True
                mode = timer.get("screensaver_mode", "off")
                # Only include if screensaver is enabled for this timer
                if mode != "off":
                    timer_count += 1
                    inhibiting_items.append({"type": "timer", "id": timer_id, "label": timer.get("label", "Timer"), "screensaver_mode": global_mode})
        
        # Check pomodoro with prevent_sleep=True AND screensaver enabled
        pomodoro = await self._get_pomodoro_state()
        if pomodoro.get("active", False) and user_settings.get("pomodoro_prevent_sleep", False):
            should_inhibit = True
            pomo_mode = user_settings.get("pomodoro_screensaver_mode", "off")
            if pomo_mode != "off":
                reason_parts.append("Pomodoro")
                inhibiting_items.append({"type": "pomodoro", "id": "pomodoro", "label": "Pomodoro", "screensaver_mode": global_mode})
        
        # Check alarms with prevent_sleep=True AND screensaver enabled
        alarms = await self._get_alarms()
        now = time.time()
        for alarm_id, alarm in alarms.items():
            if not alarm.get("enabled", False) or not alarm.get("prevent_sleep", False):
                continue
            alarm_mode = alarm.get("screensaver_mode", "off")
            if alarm_mode == "off":
                continue
            window_minutes = alarm.get("prevent_sleep_window", 60)
            window_seconds = window_minutes * 60
            next_trigger = self._calculate_next_trigger(alarm)
            if next_trigger and 0 < (next_trigger - now) <= window_seconds:
                should_inhibit = True
                alarm_count += 1
                inhibiting_items.append({"type": "alarm", "id": alarm_id, "label": alarm.get("label", "Alarm"), "screensaver_mode": global_mode})
        
        # Check reminders with prevent_sleep=True AND screensaver enabled
        reminders = await self._get_reminders()
        for reminder_id, reminder in reminders.items():
            if reminder.get("enabled", False) and reminder.get("prevent_sleep", False):
                should_inhibit = True
                rem_mode = reminder.get("screensaver_mode", "off")
                if rem_mode != "off":
                    reminder_count += 1
                    inhibiting_items.append({"type": "reminder", "id": reminder_id, "label": reminder.get("label", "Reminder"), "screensaver_mode": global_mode})
        
        # Check stopwatch with prevent_sleep=True AND screensaver enabled
        stopwatch = await self._get_stopwatch_state()
        if stopwatch.get("status") == "running" and stopwatch.get("prevent_sleep", False):
            should_inhibit = True
            sw_mode = stopwatch.get("screensaver_mode", "off")
            if sw_mode != "off":
                reason_parts.append("Stopwatch")
                inhibiting_items.append({"type": "stopwatch", "id": "stopwatch", "label": "Stopwatch", "screensaver_mode": global_mode})
        
        # Build reason string
        if timer_count > 0:
            reason_parts.insert(0, f"{timer_count} timer(s)")
        if alarm_count > 0:
            reason_parts.append(f"{alarm_count} alarm(s)")
        if reminder_count > 0:
            reason_parts.append(f"{reminder_count} reminder(s)")
        
        dim_opacity = user_settings.get("screensaver_dim_opacity", 0.92)
        idle_seconds = user_settings.get("screensaver_idle_seconds", 15)
        overlay_during = user_settings.get("overlay_during_screensaver", True)
        
        if should_inhibit:
            reason = "AlarMe: " + ", ".join(reason_parts) + " active"
            await self._acquire_sleep_inhibitor(reason)
            await decky.emit("alarme_sleep_inhibitor_updated", {
                "active": True,
                "reason": reason,
                "items": inhibiting_items,
                "screensaver_mode": global_mode,
                "screensaver_dim_opacity": dim_opacity,
                "screensaver_idle_seconds": idle_seconds,
                "overlay_during_screensaver": overlay_during
            })
        else:
            await self._release_sleep_inhibitor()
            # Do NOT emit a second event — _release_sleep_inhibitor already emits one

    async def _jiggler_loop(self):
        """Simulate activity periodically to prevent sleep using uinput keyboard events."""
        decky.logger.info("AlarMe: Sleep inhibitor jiggler started")
        
        # KEY_UNKNOWN (240) - a key code that doesn't map to any real key
        # This resets idle timers without affecting games or triggering any action
        KEY_UNKNOWN = 240
        EV_KEY = 1
        EV_SYN = 0
        
        try:
            while self._sleep_inhibitor_active:
                # Use uinput keyboard device if available (most reliable for Game Mode)
                if self._uinput_fd > 0:
                    try:
                        now = time.time()
                        sec = int(now)
                        usec = int((now - sec) * 1000000)
                        
                        # struct input_event: 'llHHi' = timeval(16) + type(2) + code(2) + value(4) = 24 bytes
                        # Send KEY_UNKNOWN press (value=1) then release (value=0)
                        key_press = struct.pack('llHHi', sec, usec, EV_KEY, KEY_UNKNOWN, 1)
                        os.write(self._uinput_fd, key_press)
                        
                        # SYN_REPORT
                        syn = struct.pack('llHHi', sec, usec, EV_SYN, 0, 0)
                        os.write(self._uinput_fd, syn)
                        
                        # Key release
                        key_release = struct.pack('llHHi', sec, usec, EV_KEY, KEY_UNKNOWN, 0)
                        os.write(self._uinput_fd, key_release)
                        os.write(self._uinput_fd, syn)
                        
                        decky.logger.debug("AlarMe: uinput key event sent")
                    except Exception as e:
                        decky.logger.warning(f"AlarMe: uinput write error: {e}")
                    
                # Wait 30 seconds (well under typical sleep timeouts)
                await asyncio.sleep(30)
                
        except asyncio.CancelledError:
            pass
        except Exception as e:
            decky.logger.error(f"AlarMe: Jiggler loop error: {e}")
            self._sleep_inhibitor_active = False

    async def _acquire_sleep_inhibitor(self, reason: str):
        """Acquire the sleep inhibitor using uinput virtual keyboard."""
        if self._sleep_inhibitor_active:
            return  # Already active
        
        try:
            # Create uinput virtual keyboard device for Game Mode sleep prevention
            # Using keyboard KEY_UNKNOWN to avoid interfering with gamepad input
            try:
                # ioctl constants for uinput
                UI_SET_EVBIT = 0x40045564
                UI_SET_KEYBIT = 0x40045565
                UI_DEV_CREATE = 0x5501
                
                fd = os.open('/dev/uinput', os.O_WRONLY | os.O_NONBLOCK)
                
                # Enable EV_KEY (keyboard events) and KEY_UNKNOWN (240)
                fcntl.ioctl(fd, UI_SET_EVBIT, 1)  # EV_KEY
                fcntl.ioctl(fd, UI_SET_KEYBIT, 240)  # KEY_UNKNOWN - doesn't map to any real key
                
                # Build uinput_user_dev struct (size 1116 on Steam Deck)
                name = b'AlarMe Sleep Inhibitor'.ljust(80, b'\x00')
                input_id = struct.pack('HHHH', 3, 1, 1, 1)  # bustype, vendor, product, version
                total_size = 1116  # Confirmed working size on Steam Deck
                payload = name + input_id + (b'\x00' * (total_size - len(name) - len(input_id)))
                
                os.write(fd, payload)
                fcntl.ioctl(fd, UI_DEV_CREATE)
                
                self._uinput_fd = fd
                decky.logger.info("AlarMe: Created uinput keyboard device successfully")
            except Exception as e:
                decky.logger.error(f"AlarMe: Failed to setup uinput: {e}")
                self._uinput_fd = -1
                return  # Cannot proceed without uinput
            
            # Start jiggler task
            if self.loop and self._uinput_fd > 0:
                self._sleep_inhibitor_active = True
                self._jiggler_task = self.loop.create_task(self._jiggler_loop())
                decky.logger.info(f"AlarMe: Sleep inhibitor active - {reason}")
                user_settings = await self._get_user_settings()
                await decky.emit("alarme_sleep_inhibitor_updated", {
                    "active": True,
                    "reason": reason,
                    "screensaver_mode": user_settings.get("screensaver_mode", "off"),
                    "screensaver_dim_opacity": user_settings.get("screensaver_dim_opacity", 0.92)
                })
        except Exception as e:
            decky.logger.error(f"AlarMe: Failed to acquire sleep inhibitor: {e}")

    async def _release_sleep_inhibitor(self):
        """Release the sleep inhibitor."""
        if not self._sleep_inhibitor_active:
            return  # Not active
        
        try:
            # Release jiggler task
            if self._jiggler_task:
                self._jiggler_task.cancel()
                self._jiggler_task = None
            
            # Destroy and close uinput device
            if self._uinput_fd > 0:
                try:
                    UI_DEV_DESTROY = 0x5502
                    fcntl.ioctl(self._uinput_fd, UI_DEV_DESTROY)
                    os.close(self._uinput_fd)
                    decky.logger.info("AlarMe: uinput device destroyed")
                except Exception as e:
                    decky.logger.warning(f"AlarMe: Error closing uinput: {e}")
                self._uinput_fd = -1
                
            self._sleep_inhibitor_active = False
            decky.logger.info("AlarMe: Sleep inhibitor released")
            user_settings = await self._get_user_settings()
            await decky.emit("alarme_sleep_inhibitor_updated", {
                "active": False,
                "reason": "",
                "items": [],
                "screensaver_mode": user_settings.get("screensaver_mode", "off"),
                "screensaver_dim_opacity": user_settings.get("screensaver_dim_opacity", 0.92),
                "screensaver_idle_seconds": user_settings.get("screensaver_idle_seconds", 15),
                "overlay_during_screensaver": user_settings.get("overlay_during_screensaver", True)
            })
        except Exception as e:
            decky.logger.error(f"AlarMe: Failed to release sleep inhibitor: {e}")
            # Force cleanup
            if self._uinput_fd > 0:
                try:
                    os.close(self._uinput_fd)
                except:
                    pass
                self._uinput_fd = -1
            self._jiggler_task = None
            self._sleep_inhibitor_active = False

    async def get_sleep_inhibitor_status(self) -> dict:
        """Get current sleep inhibitor status. Only items with screensaver_mode != 'off' are included."""
        inhibiting_items = []
        
        user_settings = await self._get_user_settings()
        global_mode = user_settings.get("screensaver_mode", "off")
        
        # Collect all items that are preventing sleep AND have screensaver enabled
        timers = await self._get_timers()
        for timer_id, timer in timers.items():
            if (not timer.get("paused", False) and 
                timer.get("prevent_sleep", False) and 
                timer.get("screensaver_mode", "off") != "off"):
                inhibiting_items.append({"type": "timer", "id": timer_id, "label": timer.get("label", "Timer"), "screensaver_mode": global_mode})
        
        pomodoro = await self._get_pomodoro_state()
        if (pomodoro.get("active", False) and 
            user_settings.get("pomodoro_prevent_sleep", False) and
            user_settings.get("pomodoro_screensaver_mode", "off") != "off"):
            inhibiting_items.append({"type": "pomodoro", "id": "pomodoro", "label": "Focus Session", "screensaver_mode": global_mode})
        
        alarms = await self._get_alarms()
        now = time.time()
        for alarm_id, alarm in alarms.items():
            if (not alarm.get("enabled", False) or 
                not alarm.get("prevent_sleep", False) or
                alarm.get("screensaver_mode", "off") == "off"):
                continue
            window_minutes = alarm.get("prevent_sleep_window", 60)
            window_seconds = window_minutes * 60
            next_trigger = self._calculate_next_trigger(alarm)
            if next_trigger and 0 < (next_trigger - now) <= window_seconds:
                inhibiting_items.append({"type": "alarm", "id": alarm_id, "label": alarm.get("label", "Alarm"), "screensaver_mode": global_mode})
        
        reminders = await self._get_reminders()
        for reminder_id, reminder in reminders.items():
            if (reminder.get("enabled", False) and 
                reminder.get("prevent_sleep", False) and
                reminder.get("screensaver_mode", "off") != "off"):
                inhibiting_items.append({"type": "reminder", "id": reminder_id, "label": reminder.get("label", "Reminder"), "screensaver_mode": global_mode})
        
        stopwatch = await self._get_stopwatch_state()
        if (stopwatch.get("status") == "running" and 
            stopwatch.get("prevent_sleep", False) and
            stopwatch.get("screensaver_mode", "off") != "off"):
            inhibiting_items.append({"type": "stopwatch", "id": "stopwatch", "label": "Stopwatch", "screensaver_mode": global_mode})
        
        return {
            "active": self._sleep_inhibitor_active,
            "items": inhibiting_items,
            "screensaver_mode": global_mode,
            "screensaver_dim_opacity": user_settings.get("screensaver_dim_opacity", 0.92)
        }

    async def _emit_screensaver_reset_state(self) -> None:
        """Reset frontend runtime screensaver state after plugin startup."""
        user_settings = await self._get_user_settings()
        await decky.emit("alarme_sleep_inhibitor_updated", {
            "active": False,
            "reason": "",
            "items": [],
            "screensaver_mode": user_settings.get("screensaver_mode", "off"),
            "screensaver_dim_opacity": user_settings.get("screensaver_dim_opacity", 0.92),
            "screensaver_idle_seconds": user_settings.get("screensaver_idle_seconds", 15),
            "overlay_during_screensaver": user_settings.get("overlay_during_screensaver", True),
        })

    async def disable_all_sleep_inhibitors(self) -> bool:
        """Disable all mechanisms preventing sleep."""
        decky.logger.info("AlarMe: Disabling all sleep inhibitors")
        
        # Cancel all timers with prevent_sleep
        timers = await self._get_timers()
        for timer_id, timer in list(timers.items()):
            if timer.get("prevent_sleep", False):
                await self.cancel_timer(timer_id)
        
        # Stop pomodoro if active
        pomodoro = await self._get_pomodoro_state()
        if pomodoro.get("active", False):
            await self.stop_pomodoro()
        
        # Turn off all alarms that are preventing sleep
        alarms = await self._get_alarms()
        for alarm_id, alarm in alarms.items():
            if alarm.get("prevent_sleep", False) and alarm.get("enabled", False):
                alarm["enabled"] = False
        await self._save_alarms(alarms)
        await decky.emit("alarme_alarms_updated", list(alarms.values()))
        
        # Turn off all reminders that are preventing sleep
        reminders = await self._get_reminders()
        for reminder_id, reminder in reminders.items():
            if reminder.get("prevent_sleep", False) and reminder.get("enabled", False):
                reminder["enabled"] = False
        await self._save_reminders(reminders)
        await decky.emit("alarme_reminders_updated", list(reminders.values()))
        
        # Reset stopwatch if running (regardless of prevent_sleep flag, since it's in the inhibitor list)
        stopwatch = await self._get_stopwatch_state()
        if stopwatch.get("status") == "running":
            await self.stopwatch_reset()
        
        # Update sleep inhibitor state
        await self._update_sleep_inhibitor()
        
        return True

    async def set_screensaver_mode(self, mode: str, dim_opacity: float = None) -> dict:
        """Update screensaver mode and optionally dim opacity. Emits update if inhibitor is active."""
        if mode not in ("off", "black", "dim", "wallpaper"):
            return {"success": False, "error": "Invalid mode"}
        
        user_settings = await self._get_user_settings()
        user_settings["screensaver_mode"] = mode
        if dim_opacity is not None:
            user_settings["screensaver_dim_opacity"] = max(0.0, min(1.0, dim_opacity))
        await self.settings_setSetting(SETTINGS_KEY_SETTINGS, user_settings)
        await self.settings_commit()

        # If inhibitor is currently active, emit immediately so overlay updates live
        if self._sleep_inhibitor_active:
            # Recompute effective mode from all active items
            await self._update_sleep_inhibitor()

        return {"success": True, "screensaver_mode": mode}

    async def get_screensaver_state(self) -> dict:
        """Get the current screensaver state for frontend initialization."""
        user_settings = await self._get_user_settings()
        return {
            "screensaver_mode": user_settings.get("screensaver_mode", "off"),
            "screensaver_dim_opacity": user_settings.get("screensaver_dim_opacity", 0.92),
            "screensaver_idle_seconds": user_settings.get("screensaver_idle_seconds", 15),
            "overlay_during_screensaver": user_settings.get("overlay_during_screensaver", True)
        }

    async def get_system_stats(self) -> dict:
        """Get real-time system stats from sysfs/proc for the screensaver widget."""
        result = {
            "cpu_temp": None,
            "cpu_usage": None,
            "ram_used_gb": None,
            "ram_total_gb": None,
            "gpu_temp": None,
            "fan_rpm": None
        }

        # CPU temperature from thermal zones
        try:
            thermal_base = "/sys/class/thermal/thermal_zone"
            if os.path.exists(thermal_base):
                for i in range(10):
                    zone_dir = f"{thermal_base}{i}"
                    type_file = os.path.join(zone_dir, "type")
                    temp_file = os.path.join(zone_dir, "temp")
                    if os.path.exists(type_file) and os.path.exists(temp_file):
                        with open(type_file, "r") as f:
                            zone_type = f.read().strip()
                        with open(temp_file, "r") as f:
                            temp_raw = f.read().strip()
                        temp = int(temp_raw) / 1000.0
                        if zone_type in ("x86_pkg_temp", "cpu-thermal", "Tctl", "k10temp"):
                            result["cpu_temp"] = temp
                        elif zone_type in ("gpu", "GPU", "amdgpu", "iwlwifi_1"):
                            pass  # not GPU temp
                        elif result["gpu_temp"] is None and temp > 20:
                            result["gpu_temp"] = temp
        except Exception as e:
            decky.logger.debug(f"AlarMe: Error reading temps: {e}")

        # Try GPU temp from hwmon
        try:
            hwmon_base = "/sys/class/hwmon"
            if os.path.exists(hwmon_base):
                for hwmon_name in os.listdir(hwmon_base):
                    hwmon_dir = os.path.join(hwmon_base, hwmon_name)
                    name_file = os.path.join(hwmon_dir, "name")
                    if os.path.exists(name_file):
                        with open(name_file, "r") as f:
                            name = f.read().strip()
                        for label_idx in range(1, 6):
                            label_file = os.path.join(hwmon_dir, f"temp{label_idx}_label")
                            temp_file = os.path.join(hwmon_dir, f"temp{label_idx}_input")
                            if os.path.exists(label_file) and os.path.exists(temp_file):
                                with open(label_file, "r") as f:
                                    label = f.read().strip().lower()
                                if "gpu" in label or "edge" in label or "junction" in label:
                                    with open(temp_file, "r") as f:
                                        result["gpu_temp"] = int(f.read().strip()) / 1000.0
                                    break
        except Exception as e:
            decky.logger.debug(f"AlarMe: Error reading GPU temp: {e}")

        # CPU usage from /proc/stat
        try:
            with open("/proc/stat", "r") as f:
                for line in f:
                    if line.startswith("cpu "):
                        parts = line.split()
                        if len(parts) >= 8:
                            user = int(parts[1])
                            nice = int(parts[2])
                            system = int(parts[3])
                            idle = int(parts[4])
                            total = user + nice + system + idle
                            if total > 0:
                                result["cpu_usage"] = round((1 - idle / total) * 100, 1)
                        break
        except Exception as e:
            decky.logger.debug(f"AlarMe: Error reading CPU usage: {e}")

        # RAM from /proc/meminfo
        try:
            mem_total = 0
            mem_avail = 0
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        mem_total = int(line.split()[1])
                    elif line.startswith("MemAvailable:"):
                        mem_avail = int(line.split()[1])
                    if mem_total and mem_avail:
                        break
            if mem_total > 0:
                result["ram_total_gb"] = round(mem_total / 1024 / 1024, 1)
                result["ram_used_gb"] = round((mem_total - mem_avail) / 1024 / 1024, 1)
        except Exception as e:
            decky.logger.debug(f"AlarMe: Error reading RAM: {e}")

        # Fan speed from hwmon
        try:
            for hwmon_name in os.listdir(hwmon_base) if os.path.exists("/sys/class/hwmon") else []:
                hwmon_dir = os.path.join("/sys/class/hwmon", hwmon_name)
                for fan_idx in range(1, 4):
                    fan_file = os.path.join(hwmon_dir, f"fan{fan_idx}_input")
                    if os.path.exists(fan_file):
                        with open(fan_file, "r") as f:
                            result["fan_rpm"] = int(f.read().strip())
                        break
                if result["fan_rpm"] is not None:
                    break
        except Exception as e:
            decky.logger.debug(f"AlarMe: Error reading fan: {e}")

        return result

    async def _wallpaper_pool_size(self) -> int:
        user_settings = await self._get_user_settings()
        try:
            n = int(user_settings.get("screensaver_wallpaper_pool_size", 5))
        except (TypeError, ValueError):
            n = 5
        return max(1, min(n, _WALLPAPER_POOL_MAX))

    async def _wallpaper_mark_cache_refreshed(self) -> None:
        user_settings = await self._get_user_settings()
        user_settings["screensaver_wallpaper_cache_updated_at"] = datetime.now().isoformat(timespec="seconds")
        await self.settings_setSetting(SETTINGS_KEY_SETTINGS, user_settings)
        await self.settings_commit()
        await decky.emit("alarme_settings_updated", user_settings)

    def _nasa_apod_fetch_meta_sync(self, user_settings: dict) -> dict | None:
        import urllib.parse
        import urllib.request

        keys_ordered: list[str] = []
        uk = (user_settings.get("screensaver_nasa_api_key") or "").strip()
        if uk:
            keys_ordered.append(uk)
        if "DEMO_KEY" not in keys_ordered:
            keys_ordered.append("DEMO_KEY")
        for k in keys_ordered:
            try:
                q = urllib.parse.urlencode({"api_key": k})
                url = f"https://api.nasa.gov/planetary/apod?{q}"
                req = urllib.request.Request(url, headers={"User-Agent": _BROWSER_UA})
                with urllib.request.urlopen(req, timeout=18, context=_NO_VERIFY_SSL) as resp:
                    meta = json.loads(resp.read().decode("utf-8"))
                if not isinstance(meta, dict):
                    continue
                if meta.get("error") or meta.get("msg"):
                    decky.logger.debug(f"AlarMe: NASA APOD error payload: {meta}")
                    continue
                if meta.get("media_type") and str(meta.get("media_type")).lower() != "image":
                    return meta
                if meta.get("url") or meta.get("hdurl"):
                    return meta
            except Exception as e:
                decky.logger.debug(f"AlarMe: NASA APOD request failed: {e}")
        return None

    async def fetch_wallpaper(self, provider: str, slot: int = 0) -> dict:
        """Fetch a wallpaper as base64 data for CEF rendering."""
        import urllib.request
        import base64
        import json as json_mod

        result: dict = {
            "success": False,
            "url": None,
            "is_base64": False,
            "provider_status": None,
            "last_fetch": None,
            "attribution": None,
        }
        legacy_wallpapers_dir = _legacy_settings_wallpapers_dir()
        os.makedirs(legacy_wallpapers_dir, exist_ok=True)
        cache_dir = _wallpaper_cache_dir()

        pool_sz = await self._wallpaper_pool_size()
        slot_idx = slot % pool_sz if slot >= 0 else 0

        def _cleanup_old_wallpapers(directory: str, prefix: str, keep: int = 3):
            try:
                files = [os.path.join(directory, f) for f in os.listdir(directory) if f.startswith(prefix)]
                files.sort(key=os.path.getmtime, reverse=True)
                for old_file in files[keep:]:
                    os.remove(old_file)
            except Exception:
                pass

        def _img_to_data_url(img_data: bytes, filename: str) -> str:
            if filename.lower().endswith(".png"):
                mime = "image/png"
            elif filename.lower().endswith(".webp"):
                mime = "image/webp"
            else:
                mime = "image/jpeg"
            b64 = base64.b64encode(img_data).decode("ascii")
            return f"data:{mime};base64,{b64}"

        def _read_as_data_url(path: str) -> str | None:
            try:
                with open(path, "rb") as f:
                    img_data = f.read()
                return _img_to_data_url(img_data, path)
            except Exception:
                return None

        try:
            if provider == "picsum":
                path = os.path.join(cache_dir, f"picsum_slot_{slot_idx}.jpg")
                if os.path.exists(path):
                    data_url = _read_as_data_url(path)
                    if data_url:
                        result["url"] = data_url
                        result["is_base64"] = True
                        result["success"] = True
                        result["last_fetch"] = datetime.now().isoformat()
                if not result["success"]:
                    img_data = _http_get_bytes(f"https://picsum.photos/seed/{10000 + slot_idx}/1280/800")
                    with open(path, "wb") as f:
                        f.write(img_data)
                    result["url"] = _img_to_data_url(img_data, path)
                    result["is_base64"] = True
                    result["success"] = True
                    result["last_fetch"] = datetime.now().isoformat()
                    _cleanup_old_wallpapers(legacy_wallpapers_dir, "picsum")

            elif provider == "bing_daily":
                today = datetime.now().strftime("%Y-%m-%d")
                cached_new = os.path.join(cache_dir, f"bing_{today}.jpg")
                cached_legacy = os.path.join(legacy_wallpapers_dir, f"bing_{today}.jpg")

                chosen_cache = None
                if os.path.exists(cached_new):
                    chosen_cache = cached_new
                elif os.path.exists(cached_legacy):
                    chosen_cache = cached_legacy

                if chosen_cache:
                    data_url = _read_as_data_url(chosen_cache)
                    if data_url:
                        result["url"] = data_url
                        result["is_base64"] = True
                        result["success"] = True
                        result["last_fetch"] = today
                        _merge_wallpaper_attribution_into_result(result, chosen_cache)

                if not result["success"]:
                    req = urllib.request.Request(
                        "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US",
                        headers={"User-Agent": _BROWSER_UA},
                    )
                    with urllib.request.urlopen(req, timeout=10, context=_NO_VERIFY_SSL) as resp:
                        data = json_mod.loads(resp.read().decode("utf-8"))
                    if data.get("images"):
                        img_path = data["images"][0].get("urlbase", data["images"][0]["url"])
                        img_url = f"https://www.bing.com{img_path}_1280x800.jpg"
                        try:
                            img_req = urllib.request.Request(img_url, headers={"User-Agent": _BROWSER_UA})
                            with urllib.request.urlopen(img_req, timeout=10, context=_NO_VERIFY_SSL) as img_resp:
                                img_data = img_resp.read()
                        except Exception:
                            img_url = f"https://www.bing.com{data['images'][0]['url']}"
                            img_req = urllib.request.Request(img_url, headers={"User-Agent": _BROWSER_UA})
                            with urllib.request.urlopen(img_req, timeout=10, context=_NO_VERIFY_SSL) as img_resp:
                                img_data = img_resp.read()

                        path = cached_new
                        with open(path, "wb") as f:
                            f.write(img_data)
                        _cleanup_old_wallpapers(legacy_wallpapers_dir, "bing")

                        user_settings = await self._get_user_settings()
                        user_settings["_bing_date"] = today
                        await self.settings_setSetting(SETTINGS_KEY_SETTINGS, user_settings)
                        await self.settings_commit()

                        result["url"] = _img_to_data_url(img_data, path)
                        result["is_base64"] = True
                        result["success"] = True
                        result["last_fetch"] = today
                        img0 = data["images"][0]
                        _wallpaper_write_meta(
                            path,
                            img0.get("title"),
                            img0.get("copyright"),
                        )
                        _merge_wallpaper_attribution_into_result(result, path)

            elif provider == "lorem_flickr":
                path = os.path.join(cache_dir, f"loremflickr_slot_{slot_idx}.jpg")
                if os.path.exists(path):
                    data_url = _read_as_data_url(path)
                    if data_url:
                        result["url"] = data_url
                        result["is_base64"] = True
                        result["success"] = True
                        result["last_fetch"] = datetime.now().isoformat()
                if not result["success"]:
                    img_data = _http_get_bytes(f"https://loremflickr.com/1280/800?lock={slot_idx + 1}")
                    with open(path, "wb") as f:
                        f.write(img_data)
                    result["url"] = _img_to_data_url(img_data, path)
                    result["is_base64"] = True
                    result["success"] = True
                    result["last_fetch"] = datetime.now().isoformat()

            elif provider == "nasa_apod":
                user_settings = await self._get_user_settings()
                today_key = datetime.now().strftime("%Y-%m-%d")
                path_guess = os.path.join(cache_dir, f"nasa_apod_{today_key}.jpg")
                image_path_for_meta: str | None = None
                if os.path.exists(path_guess):
                    data_url = _read_as_data_url(path_guess)
                    if data_url:
                        result["url"] = data_url
                        result["is_base64"] = True
                        result["success"] = True
                        result["last_fetch"] = today_key
                        image_path_for_meta = path_guess
                if not result["success"]:
                    meta = self._nasa_apod_fetch_meta_sync(user_settings)
                    if not meta:
                        result["provider_status"] = (
                            "NASA APOD unavailable (network or rate limit). "
                            "Add a free API key from api.nasa.gov in Wallpaper settings."
                        )
                        return result
                    if str(meta.get("media_type", "image")).lower() != "image":
                        result["provider_status"] = "Today's APOD is not a still image"
                        return result
                    apod_date = meta.get("date") or today_key
                    path = os.path.join(cache_dir, f"nasa_apod_{apod_date}.jpg")
                    if os.path.exists(path):
                        data_url = _read_as_data_url(path)
                        if data_url:
                            result["url"] = data_url
                            result["is_base64"] = True
                            result["success"] = True
                            result["last_fetch"] = apod_date
                            image_path_for_meta = path
                    else:
                        img_link = meta.get("url") or meta.get("hdurl")
                        if not img_link:
                            result["provider_status"] = "APOD response missing image URL"
                            return result
                        img_data = _http_get_bytes(img_link)
                        with open(path, "wb") as f:
                            f.write(img_data)
                        _wallpaper_write_meta(path, meta.get("title"), meta.get("copyright"))
                        result["url"] = _img_to_data_url(img_data, path)
                        result["is_base64"] = True
                        result["success"] = True
                        result["last_fetch"] = apod_date
                        image_path_for_meta = path
                if image_path_for_meta:
                    _merge_wallpaper_attribution_into_result(result, image_path_for_meta)

            elif provider == "local_folder":
                local_dir = _local_wallpapers_dir()
                valid_exts = (".jpg", ".jpeg", ".png", ".webp")
                try:
                    names = sorted(
                        f for f in os.listdir(local_dir) if f.lower().endswith(valid_exts)
                    )
                except FileNotFoundError:
                    names = []
                if names:
                    cycle = min(pool_sz, len(names))
                    pick = names[slot_idx % cycle]
                    file_path = os.path.join(local_dir, pick)
                    with open(file_path, "rb") as f:
                        img_data = f.read()
                    data_url = _img_to_data_url(img_data, pick)
                    result["url"] = data_url
                    result["is_base64"] = True
                    result["success"] = True
                    result["last_fetch"] = datetime.now().isoformat()
                else:
                    result["provider_status"] = f"No images found in {local_dir}"

        except urllib.error.URLError as e:
            decky.logger.error(f"AlarMe: Network error fetching wallpaper ({provider}): {e}")
            result["provider_status"] = f"Network error: {e.reason}"
        except Exception as e:
            decky.logger.error(f"AlarMe: Failed to fetch wallpaper ({provider}): {e}")
            result["provider_status"] = str(e)

        return result

    async def prefetch_wallpapers(self, provider: str, count: int | None = None) -> dict:
        """Download or validate wallpaper pool under DECKY_PLUGIN_RUNTIME_DIR/wallpaper_cache/."""
        import urllib.request
        import json as json_mod

        result: dict = {"success": False, "provider_status": None}
        cache_dir = _wallpaper_cache_dir()
        pool = await self._wallpaper_pool_size()
        n = pool
        if count is not None:
            try:
                n = max(1, min(int(count), pool, _WALLPAPER_POOL_MAX))
            except (TypeError, ValueError):
                n = pool

        async def emit_progress(step: int, total: int) -> None:
            try:
                await decky.emit(
                    "alarme_wallpaper_prefetch_progress",
                    {"step": step, "total": total, "provider": provider},
                )
            except Exception as e:
                decky.logger.debug(f"AlarMe: wallpaper prefetch progress emit: {e}")

        try:
            if provider in ("none",):
                result["success"] = True
                return result

            if provider == "local_folder":
                local_dir = _local_wallpapers_dir()
                valid_exts = (".jpg", ".jpeg", ".png", ".webp")
                try:
                    names = sorted(f for f in os.listdir(local_dir) if f.lower().endswith(valid_exts))
                except FileNotFoundError:
                    names = []
                total_steps = max(1, min(n, len(names)))
                if not names:
                    result["provider_status"] = f"No images in {local_dir}"
                    result["success"] = False
                    return result
                for i in range(total_steps):
                    await emit_progress(i + 1, total_steps)
                result["success"] = True
                await self._wallpaper_mark_cache_refreshed()
                return result

            if provider == "picsum":
                for i in range(n):
                    await emit_progress(i + 1, n)
                    path = os.path.join(cache_dir, f"picsum_slot_{i}.jpg")
                    if os.path.exists(path) and os.path.getsize(path) > 512:
                        continue
                    img_data = _http_get_bytes(f"https://picsum.photos/seed/{10000 + i}/1280/800")
                    with open(path, "wb") as f:
                        f.write(img_data)

            elif provider == "bing_daily":
                await emit_progress(1, 1)
                today = datetime.now().strftime("%Y-%m-%d")
                path = os.path.join(cache_dir, f"bing_{today}.jpg")
                if not (os.path.exists(path) and os.path.getsize(path) > 512):
                    req = urllib.request.Request(
                        "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US",
                        headers={"User-Agent": _BROWSER_UA},
                    )
                    with urllib.request.urlopen(req, timeout=10, context=_NO_VERIFY_SSL) as resp:
                        data = json_mod.loads(resp.read().decode("utf-8"))
                    if data.get("images"):
                        img_path = data["images"][0].get("urlbase", data["images"][0]["url"])
                        img_url = f"https://www.bing.com{img_path}_1280x800.jpg"
                        try:
                            img_req = urllib.request.Request(img_url, headers={"User-Agent": _BROWSER_UA})
                            with urllib.request.urlopen(img_req, timeout=10, context=_NO_VERIFY_SSL) as img_resp:
                                img_data = img_resp.read()
                        except Exception:
                            img_url = f"https://www.bing.com{data['images'][0]['url']}"
                            img_req = urllib.request.Request(img_url, headers={"User-Agent": _BROWSER_UA})
                            with urllib.request.urlopen(img_req, timeout=10, context=_NO_VERIFY_SSL) as img_resp:
                                img_data = img_resp.read()
                        with open(path, "wb") as f:
                            f.write(img_data)
                        img0 = data["images"][0]
                        _wallpaper_write_meta(path, img0.get("title"), img0.get("copyright"))
                        user_settings = await self._get_user_settings()
                        user_settings["_bing_date"] = today
                        await self.settings_setSetting(SETTINGS_KEY_SETTINGS, user_settings)
                        await self.settings_commit()

            elif provider == "lorem_flickr":
                for i in range(n):
                    await emit_progress(i + 1, n)
                    path = os.path.join(cache_dir, f"loremflickr_slot_{i}.jpg")
                    if os.path.exists(path) and os.path.getsize(path) > 512:
                        continue
                    img_data = _http_get_bytes(f"https://loremflickr.com/1280/800?lock={i + 1}")
                    with open(path, "wb") as f:
                        f.write(img_data)

            elif provider == "nasa_apod":
                await emit_progress(1, 1)
                user_settings = await self._get_user_settings()
                meta = self._nasa_apod_fetch_meta_sync(user_settings)
                if not meta:
                    result["provider_status"] = "NASA APOD prefetch failed (network or API key)"
                    result["success"] = False
                    return result
                if str(meta.get("media_type", "image")).lower() != "image":
                    result["provider_status"] = "Today's APOD is not a still image"
                    result["success"] = True
                    await self._wallpaper_mark_cache_refreshed()
                    return result
                apod_date = meta.get("date") or datetime.now().strftime("%Y-%m-%d")
                path = os.path.join(cache_dir, f"nasa_apod_{apod_date}.jpg")
                if not (os.path.exists(path) and os.path.getsize(path) > 512):
                    img_link = meta.get("url") or meta.get("hdurl")
                    if img_link:
                        img_data = _http_get_bytes(img_link)
                        with open(path, "wb") as f:
                            f.write(img_data)
                        _wallpaper_write_meta(path, meta.get("title"), meta.get("copyright"))
            else:
                result["provider_status"] = f"Unknown provider: {provider}"
                return result

            result["success"] = True
            await self._wallpaper_mark_cache_refreshed()
        except urllib.error.URLError as e:
            decky.logger.error(f"AlarMe: prefetch_wallpapers network error ({provider}): {e}")
            result["provider_status"] = f"Network error: {e.reason}"
        except Exception as e:
            decky.logger.error(f"AlarMe: prefetch_wallpapers failed ({provider}): {e}")
            result["provider_status"] = str(e)
        finally:
            try:
                await decky.emit(
                    "alarme_wallpaper_prefetch_complete",
                    {
                        "success": result.get("success", False),
                        "provider": provider,
                        "message": result.get("provider_status"),
                    },
                )
            except Exception as e:
                decky.logger.debug(f"AlarMe: wallpaper prefetch complete emit: {e}")

        return result

    async def check_wallpaper_provider(self, provider: str) -> dict:
        """Check if a wallpaper provider is reachable."""
        import urllib.request

        result = {"reachable": False, "message": None}

        try:
            if provider == "picsum":
                req = urllib.request.Request(
                    "https://picsum.photos",
                    headers={"User-Agent": _BROWSER_UA},
                    method="HEAD",
                )
                urllib.request.urlopen(req, timeout=5, context=_NO_VERIFY_SSL)
                result["reachable"] = True

            elif provider == "bing_daily":
                req = urllib.request.Request(
                    "https://www.bing.com",
                    headers={"User-Agent": _BROWSER_UA},
                    method="HEAD",
                )
                urllib.request.urlopen(req, timeout=5, context=_NO_VERIFY_SSL)
                result["reachable"] = True

            elif provider == "lorem_flickr":
                req = urllib.request.Request(
                    "https://loremflickr.com/",
                    headers={"User-Agent": _BROWSER_UA},
                    method="HEAD",
                )
                urllib.request.urlopen(req, timeout=8, context=_NO_VERIFY_SSL)
                result["reachable"] = True

            elif provider == "nasa_apod":
                req = urllib.request.Request(
                    "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY",
                    headers={"User-Agent": _BROWSER_UA},
                    method="HEAD",
                )
                urllib.request.urlopen(req, timeout=8, context=_NO_VERIFY_SSL)
                result["reachable"] = True

            elif provider == "local_folder":
                local_dir = _local_wallpapers_dir()
                valid_exts = (".jpg", ".jpeg", ".png", ".webp")
                files = [f for f in os.listdir(local_dir) if f.lower().endswith(valid_exts)]
                if files:
                    result["reachable"] = True
                else:
                    result["message"] = "No images found in wallpapers folder"

        except Exception as e:
            result["message"] = f"Unreachable: {e}"

        return result

    async def get_wallpaper_storage_paths(self) -> dict:
        """Paths under DECKY_PLUGIN_RUNTIME_DIR for wallpaper cache and user images."""
        return {
            "runtime_dir": runtimeDir,
            "wallpaper_cache_dir": _wallpaper_cache_dir(),
            "local_wallpapers_dir": _local_wallpapers_dir(),
        }

    async def get_wifi_info(self) -> dict:
        """Get current Wi-Fi SSID and signal strength.

        Signal strength is converted from dBm to a 0-100 percentage:
        -30 dBm or better = 100%, -90 dBm or worse = 0%.
        """
        import subprocess

        def dbm_to_quality(dbm: int) -> int:
            """Convert dBm signal strength to a 0-100 quality percentage."""
            if dbm >= -30:
                return 100
            if dbm <= -90:
                return 0
            return int((dbm + 90) / 60 * 100)

        result = {"ssid": None, "signal": None}

        try:
            proc = subprocess.run(["iw", "dev", "wlan0", "link"], capture_output=True, text=True, timeout=3)
            if proc.returncode == 0:
                for line in proc.stdout.split("\n"):
                    line = line.strip()
                    if line.startswith("SSID:"):
                        result["ssid"] = line.split(":", 1)[1].strip()
                    elif line.startswith("signal:"):
                        signal_str = line.split(":", 1)[1].strip().split()[0]
                        dbm = int(signal_str)
                        result["signal"] = dbm_to_quality(dbm)
                if result["ssid"] or result["signal"] is not None:
                    return result
        except Exception:
            pass

        try:
            proc = subprocess.run(["iwconfig", "wlan0"], capture_output=True, text=True, timeout=3)
            if proc.returncode == 0:
                for line in proc.stdout.split("\n"):
                    line = line.strip()
                    if "ESSID:" in line:
                        ssid = line.split("ESSID:")[1].strip().strip('"')
                        if ssid != "off/any":
                            result["ssid"] = ssid
                    if "Signal level=" in line:
                        part = line.split("Signal level=")[1].split()[0]
                        if "/" in part:
                            num, denom = part.split("/")
                            result["signal"] = int(float(num) / float(denom) * 100)
                        else:
                            dbm = int(part)
                            result["signal"] = dbm_to_quality(dbm)
        except Exception:
            pass

        return result

    async def list_local_wallpapers(self) -> list:
        """List available files in the local wallpapers folder."""
        local_dir = _local_wallpapers_dir()
        if not os.path.exists(local_dir):
            return []
        valid_exts = (".jpg", ".jpeg", ".png", ".webp")
        return sorted([f for f in os.listdir(local_dir) if f.lower().endswith(valid_exts)])

    # ==================== TIMER METHODS ====================

    def _format_timer_label(self, seconds: int) -> str:
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

    async def create_timer(self, seconds: int, label: str = "",
                          subtle_mode: bool = None,
                          auto_suspend: bool = None,
                          prevent_sleep: bool = None,
                          screensaver_mode: str = None) -> str:
        """Create a new countdown timer."""
        # Check limit
        timers = await self._get_timers()
        if len(timers) >= MAX_ACTIVE_TIMERS:
            decky.logger.warning(f"AlarMe: Timer limit reached ({MAX_ACTIVE_TIMERS})")
            return None
        
        timer_id = str(uuid.uuid4())[:8]
        end_time = time.time() + seconds
        user_settings = await self._get_user_settings()

        if subtle_mode is None:
            subtle_mode = user_settings.get("timer_subtle_mode", False)
        if auto_suspend is None:
            auto_suspend = user_settings.get("timer_auto_suspend", False)
        if prevent_sleep is None:
            prevent_sleep = False
        if screensaver_mode is None:
            screensaver_mode = user_settings.get("screensaver_mode", "off")
        if auto_suspend:
            subtle_mode = True
        
        # Generate default label from duration if not provided
        if not label:
            label = self._format_timer_label(seconds)
        
        timer_data = {
            "id": timer_id,
            "label": label,
            "seconds": seconds,
            "end_time": end_time,
            "created_at": time.time(),
            "subtle_mode": subtle_mode,
            "auto_suspend": auto_suspend,
            "prevent_sleep": prevent_sleep,
            "screensaver_mode": screensaver_mode
        }
        
        # Save to settings
        timers = await self._get_timers()
        timers[timer_id] = timer_data
        await self._save_timers(timers)
        
        # Save to recent timers (for quick access)
        await self._add_to_recent_timers(seconds, label, subtle_mode, auto_suspend, prevent_sleep, screensaver_mode)
        
        # Start the timer task
        self.timer_tasks[timer_id] = self.loop.create_task(
            self._timer_handler(timer_id, end_time, label)
        )
        
        decky.logger.info(f"AlarMe: Created timer {timer_id} for {seconds} seconds")
        await decky.emit("alarme_timer_created", timer_data)
        await self._emit_all_timers()
        
        # Update sleep inhibitor
        await self._update_sleep_inhibitor()
        
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
            # Update sleep inhibitor
            await self._update_sleep_inhibitor()
            return True
        return False

    async def pause_timer(self, timer_id: str) -> bool:
        """Pause an active timer."""
        timers = await self._get_timers()
        if timer_id not in timers:
            return False
        
        timer = timers[timer_id]
        if timer.get("paused"):
            return False  # Already paused
        
        # Cancel the background task
        if timer_id in self.timer_tasks:
            self.timer_tasks[timer_id].cancel()
            del self.timer_tasks[timer_id]
        
        # Store remaining time and mark as paused
        remaining = timer["end_time"] - time.time()
        timer["paused"] = True
        timer["paused_remaining"] = max(0, remaining)
        
        await self._save_timers(timers)
        decky.logger.info(f"AlarMe: Paused timer {timer_id} with {remaining:.0f}s remaining")
        await decky.emit("alarme_timer_paused", {"id": timer_id, "remaining": remaining})
        await self._emit_all_timers()
        # Update sleep inhibitor
        await self._update_sleep_inhibitor()
        return True

    async def resume_timer(self, timer_id: str) -> bool:
        """Resume a paused timer."""
        timers = await self._get_timers()
        if timer_id not in timers:
            return False
        
        timer = timers[timer_id]
        if not timer.get("paused"):
            return False  # Not paused
        
        # Calculate new end time from paused remaining
        remaining = timer.get("paused_remaining", 0)
        new_end_time = time.time() + remaining
        
        timer["end_time"] = new_end_time
        timer["paused"] = False
        timer.pop("paused_remaining", None)
        
        await self._save_timers(timers)
        
        # Restart the background task
        self.timer_tasks[timer_id] = self.loop.create_task(
            self._timer_handler(timer_id, new_end_time, timer["label"])
        )
        
        decky.logger.info(f"AlarMe: Resumed timer {timer_id} with {remaining:.0f}s remaining")
        await decky.emit("alarme_timer_resumed", {"id": timer_id, "remaining": remaining})
        await self._emit_all_timers()
        # Update sleep inhibitor
        await self._update_sleep_inhibitor()
        return True

    async def update_timer(self, timer_id: str, label: str = None,
                          subtle_mode: bool = None, auto_suspend: bool = None) -> dict:
        """Update an active timer's editable properties."""
        timers = await self._get_timers()
        if timer_id not in timers:
            return None

        timer = timers[timer_id]
        if label is not None:
            timer["label"] = label
        if subtle_mode is not None:
            timer["subtle_mode"] = subtle_mode
        if auto_suspend is not None:
            timer["auto_suspend"] = auto_suspend
            if auto_suspend:
                timer["subtle_mode"] = True

        await self._save_timers(timers)
        await decky.emit("alarme_timer_updated", timer)
        await self._emit_all_timers()
        return timer

    async def get_active_timers(self) -> list:
        """Get all active timers with remaining time."""
        timers = await self._get_timers()
        current_time = time.time()
        active = []
        
        for timer_id, timer in timers.items():
            # Handle paused timers
            if timer.get("paused"):
                active.append({
                    **timer,
                    "remaining": timer.get("paused_remaining", 0)
                })
            else:
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
                    timers = await self._get_timers()
                    timer = timers.get(timer_id, {})

                    # Timer completed
                    await self.cancel_timer(timer_id)
                    
                    #  Check if missed by > 60 seconds
                    if remaining < -60:
                        decky.logger.info(f"AlarMe: Timer {timer_id} finished {abs(remaining):.0f}s ago - counting as MISSED")
                        await self._add_missed_item("timer", timer_id, label, end_time)
                        return # Skip sound/notification for missed items

                    user_settings = await self._get_user_settings()
                    subtle = timer.get("subtle_mode", user_settings.get("timer_subtle_mode", False))
                    timer_sound = user_settings.get("timer_sound", "alarm.mp3")
                    timer_volume = user_settings.get("timer_volume", 100)
                    timer_auto_suspend = timer.get("auto_suspend", user_settings.get("timer_auto_suspend", False))
                    if timer_auto_suspend:
                        subtle = True
                    await decky.emit("alarme_timer_completed", {
                        "id": timer_id,
                        "label": label,
                        "subtle": subtle,
                        "sound": timer_sound,
                        "volume": timer_volume,
                        "auto_suspend": timer_auto_suspend,
                        "time_format_24h": user_settings.get("time_format_24h", True),
                        "snooze_activation_delay": user_settings.get("snooze_activation_delay", 2.0)
                    })
                    decky.logger.info(f"AlarMe: Timer {timer_id} completed")
                    return
                
                # Emit update every second for real-time display
                await decky.emit("alarme_timer_tick", {
                    "id": timer_id,
                    "remaining": max(0, int(remaining))
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

    async def _add_to_recent_timers(self, seconds: int, label: str, subtle_mode: bool = False, auto_suspend: bool = False, prevent_sleep: bool = False, screensaver_mode: str = "off"):
        """Add a timer to the recent timers list (max 5, dedup by seconds+label+modes)."""
        recent = await self.get_recent_timers()
        
        # Create new entry
        new_entry = {
            "seconds": seconds,
            "label": label or f"{seconds // 60} min timer",
            "subtle_mode": subtle_mode,
            "auto_suspend": auto_suspend,
            "prevent_sleep": prevent_sleep,
            "screensaver_mode": screensaver_mode
        }
        
        # Remove duplicates (same seconds, label, subtle_mode, auto_suspend, prevent_sleep, and screensaver_mode)
        recent = [r for r in recent if not (
            r.get("seconds") == seconds and 
            r.get("label") == new_entry["label"] and
            r.get("subtle_mode", False) == subtle_mode and
            r.get("auto_suspend", False) == auto_suspend and
            r.get("prevent_sleep", False) == prevent_sleep and
            r.get("screensaver_mode", "off") == screensaver_mode
        )]
        
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
                          auto_suspend: bool = False,
                          prevent_sleep: bool = False,
                          prevent_sleep_window: int = 60,
                          screensaver_mode: str = "off") -> str:
        """
        Create a new alarm.
        recurring: 'once', 'daily', 'weekdays', 'weekends', or comma-separated days (0-6, 0=Monday)
        sound: filename of the sound to play (from assets folder)
        volume: 0-100 alarm volume
        subtle_mode: if True, show only a toast notification
        auto_suspend: if True, suspend device after alarm
        prevent_sleep: if True, keep device awake while alarm is upcoming
        prevent_sleep_window: minutes before alarm to start preventing sleep
        """
        # Check limit
        alarms = await self._get_alarms()
        if len(alarms) >= MAX_ALARMS:
            decky.logger.warning(f"AlarMe: Alarm limit reached ({MAX_ALARMS})")
            return None
        
        alarm_id = str(uuid.uuid4())[:8]
        
        if not label:
            user_settings = await self._get_user_settings()
            use24h = user_settings.get("time_format_24h", True)
            if use24h:
                label = f"Alarm {hour:02d}:{minute:02d}"
            else:
                period = "PM" if hour >= 12 else "AM"
                display_hour = hour % 12 or 12
                label = f"Alarm {display_hour}:{minute:02d} {period}"

        alarm_data = {
            "id": alarm_id,
            "hour": hour,
            "minute": minute,
            "label": label,
            "recurring": recurring,
            "enabled": True,
            "created_at": time.time(),
            "snoozed_until": None,
            "sound": sound,
            "volume": volume,
            "subtle_mode": subtle_mode,
            "auto_suspend": auto_suspend,
            "prevent_sleep": prevent_sleep,
            "prevent_sleep_window": prevent_sleep_window,
            "screensaver_mode": screensaver_mode
        }
        
        alarms = await self._get_alarms()
        alarms[alarm_id] = alarm_data
        await self._save_alarms(alarms)
        
        decky.logger.info(f"AlarMe: Created alarm {alarm_id} for {hour:02d}:{minute:02d} with sound {sound}")
        await decky.emit("alarme_alarm_created", alarm_data)
        await self._emit_all_alarms()
        # Update sleep inhibitor
        await self._update_sleep_inhibitor()
        
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
            # Update sleep inhibitor
            await self._update_sleep_inhibitor()
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
            # Update sleep inhibitor
            await self._update_sleep_inhibitor()
            return True
        return False

    async def update_alarm(self, alarm_id: str, hour: int, minute: int, 
                          label: str = "", recurring: str = "once", 
                          sound: str = "alarm.mp3", volume: int = 100,
                          subtle_mode: bool = False,
                          auto_suspend: bool = False,
                          prevent_sleep: bool = False,
                          prevent_sleep_window: int = 60,
                          screensaver_mode: str = "off") -> bool:
        """Update an existing alarm's settings."""
        alarms = await self._get_alarms()
        if alarm_id in alarms:
            alarm = alarms[alarm_id]
            alarm["hour"] = hour
            alarm["minute"] = minute
            if not label:
                user_settings = await self._get_user_settings()
                use24h = user_settings.get("time_format_24h", True)
                if use24h:
                    label = f"Alarm {hour:02d}:{minute:02d}"
                else:
                    period = "PM" if hour >= 12 else "AM"
                    display_hour = hour % 12 or 12
                    label = f"Alarm {display_hour}:{minute:02d} {period}"
            
            alarm["label"] = label
            alarm["recurring"] = recurring
            alarm["sound"] = sound
            alarm["volume"] = volume
            alarm["subtle_mode"] = subtle_mode
            alarm["auto_suspend"] = auto_suspend
            alarm["prevent_sleep"] = prevent_sleep
            alarm["prevent_sleep_window"] = prevent_sleep_window
            alarm["screensaver_mode"] = screensaver_mode
            # Re-enable alarm when edited (user expects it to be active)
            alarm["enabled"] = True
            # Clear snooze and last_triggered when alarm time changes
            alarm["snoozed_until"] = None
            alarm["last_triggered"] = None
            
            await self._save_alarms(alarms)
            decky.logger.info(f"AlarMe: Updated alarm {alarm_id} to {hour:02d}:{minute:02d}, recurring={recurring}, sound={sound}")
            await decky.emit("alarme_alarm_updated", alarm)
            await self._emit_all_alarms()
            # Update sleep inhibitor
            await self._update_sleep_inhibitor()
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
            await self._update_sleep_inhibitor()
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
        
        recurring = alarm.get("recurring", "once")
        
        # For "once" alarms: if target is in the past (with 90s grace), schedule for tomorrow
        # This handles the case where user sets alarm for 3:30 when it's 3:45 - should be tomorrow
        if recurring == "once":
            if target.timestamp() < now.timestamp() - 90:
                # Target is more than 90s in the past, schedule for tomorrow
                target += timedelta(days=1)
            return target.timestamp()
        
        elif recurring == "daily":
            # For daily, if target is in the past, schedule for tomorrow
            if target.timestamp() < now.timestamp() - 90:
                target += timedelta(days=1)
            return target.timestamp()
        
        elif recurring == "weekdays":
            # If target is in the past, move to tomorrow first
            if target.timestamp() < now.timestamp() - 90:
                target += timedelta(days=1)
            # Then find next weekday
            while target.weekday() >= 5:  # 5=Saturday, 6=Sunday
                target += timedelta(days=1)
            return target.timestamp()
        
        elif recurring == "weekends":
            # If target is in the past, move to tomorrow first
            if target.timestamp() < now.timestamp() - 90:
                target += timedelta(days=1)
            # Then find next weekend day
            while target.weekday() < 5:  # 0-4 are weekdays
                target += timedelta(days=1)
            return target.timestamp()
        
        else:
            # Custom days (comma-separated, 0=Monday)
            # If target is in the past, move to tomorrow first
            if target.timestamp() < now.timestamp() - 90:
                target += timedelta(days=1)
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
                    now = datetime.now()
                    current_time = now.timestamp()
                    
                    # Sync with suspend monitor to avoid double-processing during resume
                    if self.last_tick > 0 and current_time - self.last_tick > 5:
                        await asyncio.sleep(0.5)
                        continue

                    alarms = await self._get_alarms()
                    
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

                                delay = current_time - next_trigger
                                
                                # Grace period
                                if delay > 90:
                                    # Missed!
                                    decky.logger.info(f"AlarMe: Alarm {alarm_id} missed by {delay:.0f}s")
                                    await self._add_missed_item("alarm", alarm_id, alarm.get("label", "Alarm"), next_trigger)
                                    

                                    if alarm.get("recurring") == "once":
                                        alarms[alarm_id]["enabled"] = False
                                        alarms[alarm_id]["snoozed_until"] = None
                                    else:
                                        alarms[alarm_id]["snoozed_until"] = None
                                        alarms[alarm_id]["last_triggered"] = current_time 
                                    
                                    await self._save_alarms(alarms)
                                    await self._emit_all_alarms()
                                    continue

                                # Triggering (within grace period)
                                decky.logger.info(f"AlarMe: >>> TRIGGERING alarm {alarm_id}! <<<")
                                
                                # Get per-alarm settings (no global fallback needed for alarms)
                                subtle = alarm.get("subtle_mode", False)
                                auto_suspend = alarm.get("auto_suspend", False)
                                alarm_sound = alarm.get("sound", "alarm.mp3")
                                alarm_volume = alarm.get("volume", 100)
                                user_settings = await self._get_user_settings()
                                default_snooze = user_settings.get("snooze_duration", 5)
                                time_format_24h = user_settings.get("time_format_24h", True)
                                snooze_activation_delay = user_settings.get("snooze_activation_delay", 2.0)
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
                                await self._update_sleep_inhibitor()
                                await decky.emit("alarme_alarm_triggered", {
                                    "id": alarm_id,
                                    "label": alarm.get("label", "Alarm"),
                                    "subtle": subtle,
                                    "sound": alarm_sound,
                                    "volume": alarm_volume,
                                    "snooze_duration": default_snooze,
                                    "auto_suspend": auto_suspend,
                                    "time_format_24h": time_format_24h,
                                    "snooze_activation_delay": snooze_activation_delay
                                })
                        else:
                             # No next trigger
                             pass
                
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
        # Update sleep inhibitor
        await self._update_sleep_inhibitor()
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
                is_break = current_state.get("is_break", False)
                await self._update_pomodoro_stats(
                    is_break=is_break,
                    duration=elapsed,
                    completed_session=not is_break,
                    completed_cycle=is_break and current_state.get("break_type") == "long"
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
        # Update sleep inhibitor
        await self._update_sleep_inhibitor()
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
                is_break = pomodoro_state.get("is_break", False)
                await self._update_pomodoro_stats(
                    is_break=is_break,
                    duration=elapsed,
                    completed_session=not is_break,
                    completed_cycle=is_break and pomodoro_state.get("break_type") == "long"
                )
        except Exception as e:
            decky.logger.error(f"AlarMe: Failed to update stats on skip: {e}")
        
        user_settings = await self._get_user_settings()
        is_break = pomodoro_state.get("is_break", False)
        session = pomodoro_state.get("current_session", 1)
        
        cycle = pomodoro_state.get("current_cycle", 1)
        
        if is_break:
            # Starting new work session from break
            # Check if a long break just finished
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
        
        # Inject stats for frontend
        state["stats"] = await self._get_pomodoro_stats()
        
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
            "daily_cycles": 0,
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
            # Archive previous day's data if there was activity
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
            
            # Check streak: was there activity YESTERDAY specifically?
            yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            # Only keep streak if last activity was yesterday AND there was actual focus time
            if last_date == yesterday and stats.get("daily_focus_time", 0) > 0:
                pass
            else:
                stats["current_streak"] = 0
            
            # Reset daily counters for the new day
            stats["daily_focus_time"] = 0
            stats["daily_break_time"] = 0
            stats["daily_sessions"] = 0
            stats["daily_cycles"] = 0
            stats["last_active_date"] = today
            
            # Save reset stats immediately to prevent zeroed stats on next read
            settings["pomodoro_stats"] = stats
            await self.settings_setSetting(SETTINGS_KEY_SETTINGS, settings)
            await self.settings_commit()
            
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
            old_focus = stats.get("daily_focus_time", 0)
            stats["daily_focus_time"] += duration
            stats["total_focus_time"] += duration
            
            # Increment streak on the first focus time of the day
            if old_focus == 0 and duration > 0:
                stats["current_streak"] = stats.get("current_streak", 0) + 1
                if stats["current_streak"] > stats.get("longest_streak", 0):
                    stats["longest_streak"] = stats["current_streak"]
            
        if completed_session and not is_break:
            stats["total_sessions"] = stats.get("total_sessions", 0) + 1
            old_daily = stats.get("daily_sessions", 0)
            stats["daily_sessions"] = old_daily + 1
            
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
            "daily_cycles": 0,
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
                now = time.time()
                # Sync with suspend monitor to avoid double-processing during resume
                if self.last_tick > 0 and now - self.last_tick > 5:
                    await asyncio.sleep(0.5)
                    continue

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
                    
                    # Check if missed by > 60 seconds
                    if remaining < -60:
                        decky.logger.info(f"AlarMe: Pomodoro phase missed by {abs(remaining):.0f}s")
                        missed_label = f"Pomodoro: {'Break' if is_break else 'Focus Session'} {session}"
                        # Use scheduled end time as due time
                        due_time = state.get("end_time", time.time())
                        await self._add_missed_item("pomodoro", "pomodoro", missed_label, due_time)
                        
                        # Stop the cycle (do not auto-advance)
                        # Credit the session duration (capped) because it "finished"
                        elapsed = state.get("duration", 0) # Use intended duration
                        try:
                            await self._update_pomodoro_stats(
                                is_break=is_break,
                                duration=elapsed,
                                completed_session=not is_break,
                                completed_cycle=is_break and state.get("break_type") == "long"
                            )
                        except Exception as e:
                            decky.logger.error(f"AlarMe: Stats update error: {e}")

                        # Reset state to inactive
                        new_state = await self._get_pomodoro_state()
                        new_state["active"] = False
                        new_state["remaining"] = 0
                        await self._save_pomodoro_state(new_state)
                        await decky.emit("alarme_pomodoro_updated", new_state)
                        # Update sleep inhibitor
                        await self._update_sleep_inhibitor()
                        return # Exit loop

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
                        
                        # Check if a long break just finished
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
                            "subtle_mode": is_subtle,
                            "stats": await self._get_pomodoro_stats()
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
                            "subtle_mode": user_settings.get("pomodoro_subtle_mode", False),
                            "stats": await self._get_pomodoro_stats()
                        }
                        await decky.emit("alarme_pomodoro_work_ended", new_state)
                    
                    await self._save_pomodoro_state(new_state)
                    decky.logger.info(f"AlarMe: Pomodoro phase changed - is_break={new_state['is_break']}")
                
                # Emit tick every 5 seconds
                await decky.emit("alarme_pomodoro_tick", {
                    "remaining": int(max(0, remaining)),
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

    # ==================== STOPWATCH METHODS ====================

    async def _get_stopwatch_state(self) -> dict:
        return await self.settings_getSetting(SETTINGS_KEY_STOPWATCH, {
            "status": "idle",
            "start_time": None,
            "elapsed_ms": 0,
            "laps": [],
            "prevent_sleep": False
        })

    async def _save_stopwatch_state(self, state: dict):
        await self.settings_setSetting(SETTINGS_KEY_STOPWATCH, state)
        await self.settings_commit()

    async def stopwatch_get_state(self) -> dict:
        """Get current stopwatch state. Auto-resets if max runtime exceeded."""
        state = await self._get_stopwatch_state()
        
        if state.get("status") == "running" and state.get("start_time"):
            running_ms = (time.time() - state["start_time"]) * 1000
            current_elapsed = state.get("elapsed_ms", 0) + running_ms
            
            # Check max runtime limit
            if current_elapsed >= MAX_STOPWATCH_RUNTIME_MS:
                decky.logger.info(f"AlarMe: Stopwatch max runtime ({MAX_STOPWATCH_RUNTIME_MS}ms) exceeded, auto-resetting")
                await self.stopwatch_reset()
                state = await self._get_stopwatch_state()
                state["current_elapsed_ms"] = 0
                state["auto_reset"] = True
                return state
            
            state["current_elapsed_ms"] = current_elapsed
        else:
            state["current_elapsed_ms"] = state.get("elapsed_ms", 0)
        
        return state

    async def stopwatch_start(self) -> dict:
        """Start or resume the stopwatch."""
        state = await self._get_stopwatch_state()
        
        if state.get("status") == "running":
            return await self.stopwatch_get_state()
        
        state["status"] = "running"
        state["start_time"] = time.time()
        
        await self._save_stopwatch_state(state)
        await self._update_sleep_inhibitor()
        
        await decky.emit("alarme_stopwatch_updated", state)
        
        decky.logger.info("AlarMe: Stopwatch started")
        return await self.stopwatch_get_state()

    async def stopwatch_pause(self) -> dict:
        """Pause the stopwatch."""
        state = await self._get_stopwatch_state()
        
        if state.get("status") != "running":
            return await self.stopwatch_get_state()
        
        if state.get("start_time"):
            running_ms = (time.time() - state["start_time"]) * 1000
            state["elapsed_ms"] = state.get("elapsed_ms", 0) + running_ms
        
        state["status"] = "paused"
        state["start_time"] = None
        
        await self._save_stopwatch_state(state)
        await self._update_sleep_inhibitor()
        
        # Emit an event to force overlay update since stopwatch is no longer running/preventing sleep
        await decky.emit("alarme_stopwatch_updated", state)
        
        decky.logger.info(f"AlarMe: Stopwatch paused at {state['elapsed_ms']:.0f}ms")
        return await self.stopwatch_get_state()

    async def stopwatch_reset(self) -> dict:
        """Reset the stopwatch to initial state."""
        state = {
            "status": "idle",
            "start_time": None,
            "elapsed_ms": 0,
            "laps": []
        }
        
        await self._save_stopwatch_state(state)
        await self._update_sleep_inhibitor()
        
        # Emit an event to force overlay update since stopwatch is reset
        await decky.emit("alarme_stopwatch_updated", state)
        
        decky.logger.info("AlarMe: Stopwatch reset")
        return await self.stopwatch_get_state()

    async def stopwatch_lap(self) -> dict:
        """Record a lap time. Returns state with 'lap_limit_reached' flag if max laps exceeded."""
        state = await self._get_stopwatch_state()
        
        if state.get("status") != "running":
            return await self.stopwatch_get_state()
        
        current_ms = state.get("elapsed_ms", 0)
        if state.get("start_time"):
            current_ms += (time.time() - state["start_time"]) * 1000
        
        laps = state.get("laps", [])
        
        # Track total lap count separately (continues incrementing even after limit)
        total_lap_count = state.get("total_lap_count", len(laps))
        total_lap_count += 1
        
        lap_limit_reached = False
        
        if laps:
            last_lap_absolute = laps[-1].get("absolute_ms", 0)
            split_ms = current_ms - last_lap_absolute
        else:
            split_ms = current_ms
        
        new_lap = {
            "label": f"Lap {total_lap_count}",
            "absolute_ms": current_ms,
            "split_ms": split_ms
        }
        
        # Enforce max laps limit - remove oldest when exceeded
        if len(laps) >= MAX_STOPWATCH_LAPS:
            laps.pop(0)
            lap_limit_reached = True
            decky.logger.info(f"AlarMe: Stopwatch lap limit ({MAX_STOPWATCH_LAPS}) reached, removing oldest lap")
        
        laps.append(new_lap)
        state["laps"] = laps
        state["total_lap_count"] = total_lap_count
        
        await self._save_stopwatch_state(state)
        decky.logger.info(f"AlarMe: Lap {total_lap_count} recorded at {current_ms:.0f}ms (split: {split_ms:.0f}ms)")
        
        result = await self.stopwatch_get_state()
        result["lap_limit_reached"] = lap_limit_reached
        return result

    async def stopwatch_set_prevent_sleep(self, prevent_sleep: bool, screensaver_mode: str = "off") -> dict:
        """Set prevent_sleep and screensaver_mode options for stopwatch."""
        state = await self._get_stopwatch_state()
        state["prevent_sleep"] = prevent_sleep
        state["screensaver_mode"] = screensaver_mode
        await self._save_stopwatch_state(state)
        await self._update_sleep_inhibitor()
        
        await decky.emit("alarme_stopwatch_updated", state)
        
        decky.logger.info(f"AlarMe: Stopwatch prevent_sleep set to {prevent_sleep}, screensaver_mode={screensaver_mode}")
        return await self.stopwatch_get_state()

    async def stopwatch_get_laps_text(self) -> str:
        """Get formatted lap list for clipboard copy in tab-separated format."""
        state = await self._get_stopwatch_state()
        laps = state.get("laps", [])
        
        if not laps:
            return ""
        
        lines = ["Lap\tSplit\tTotal"]
        for lap in laps:
            absolute = self._format_stopwatch_time(lap.get("absolute_ms", 0))
            split = self._format_stopwatch_time(lap.get("split_ms", 0))
            label = lap.get('label', 'Lap').replace('Lap ', '')
            lines.append(f"{label}\t{split}\t{absolute}")
        
        return "\n".join(lines)

    def _format_stopwatch_time(self, ms: float) -> str:
        """Format milliseconds to HH:MM:SS.cs string."""
        if ms < 0:
            ms = 0
        
        total_seconds = int(ms / 1000)
        centiseconds = int((ms % 1000) / 10)
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{centiseconds:02d}"
        return f"{minutes:02d}:{seconds:02d}.{centiseconds:02d}"

    # ==================== PRESET METHODS ====================

    async def get_presets(self) -> list:
        """Get all timer presets."""
        presets = await self.settings_getSetting(SETTINGS_KEY_PRESETS, DEFAULT_PRESETS)
        user_settings = await self._get_user_settings()
        enabled = user_settings.get("presets_enabled", True)
        max_visible = user_settings.get("presets_max_visible", 5) if enabled else 0
        
        if len(presets) > max_visible:
            presets = presets[:max_visible]
            # Silently fix the saved state if it was out of sync
            await self.settings_setSetting(SETTINGS_KEY_PRESETS, presets)
            await self.settings_commit()
            
        return presets

    async def save_preset(self, seconds: int, label: str, 
                          subtle_mode: bool = False, auto_suspend: bool = False,
                          prevent_sleep: bool = False,
                          screensaver_mode: str = "off") -> dict:
        """Save a new timer preset with all options. Overwrites oldest if max is reached.
        Moves existing identical presets to the top instead of duplicating."""
        user_settings = await self._get_user_settings()
        enabled = user_settings.get("presets_enabled", True)
        if not enabled:
            decky.logger.warning("AlarMe: Presets are disabled. Cannot save preset.")
            return None
            
        presets = await self.get_presets()
        max_visible = user_settings.get("presets_max_visible", 5)
        
        # Check for exact duplicate
        existing_idx = -1
        preset_id = str(uuid.uuid4())[:8]
        
        for i, p in enumerate(presets):
            if (p.get("seconds") == seconds and 
                p.get("label") == label and 
                bool(p.get("subtle_mode", False)) == bool(subtle_mode) and 
                bool(p.get("auto_suspend", False)) == bool(auto_suspend) and
                bool(p.get("prevent_sleep", False)) == bool(prevent_sleep) and
                p.get("screensaver_mode", "off") == screensaver_mode):
                existing_idx = i
                preset_id = p.get("id")
                break
                
        if existing_idx >= 0:
            presets.pop(existing_idx)
        
        preset = {
            "id": preset_id,
            "seconds": seconds,
            "label": label,
            "subtle_mode": subtle_mode,
            "auto_suspend": auto_suspend,
            "prevent_sleep": prevent_sleep,
            "screensaver_mode": screensaver_mode
        }
        
        # Insert at the beginning (index 0) so the newest is always visible
        presets.insert(0, preset)
        
        # Enforce max limit by keeping only the newest
        if len(presets) > max_visible:
            decky.logger.info(f"AlarMe: Preset limit reached ({max_visible}). Overwriting oldest preset.")
            presets = presets[:max_visible]
            
        await self.settings_setSetting(SETTINGS_KEY_PRESETS, presets)
        await self.settings_commit()
        
        decky.logger.info(f"AlarMe: Created preset '{label}' ({seconds}s, subtle={subtle_mode}, suspend={auto_suspend}, prevent_sleep={prevent_sleep})")
        await decky.emit("alarme_presets_updated", presets)
        return preset

    async def save_preset_from_timer(self, timer_id: str) -> dict:
        """Create a preset from an active or paused timer."""
        timers = await self._get_timers()
        if timer_id not in timers:
            decky.logger.warning(f"AlarMe: Timer {timer_id} not found for preset creation")
            return None
        
        timer = timers[timer_id]
        return await self.save_preset(
            seconds=timer.get("seconds", 300),
            label=timer.get("label", "Timer"),
            subtle_mode=timer.get("subtle_mode", False),
            auto_suspend=timer.get("auto_suspend", False),
            prevent_sleep=timer.get("prevent_sleep", False),
            screensaver_mode=timer.get("screensaver_mode", "off")
        )

    async def remove_preset(self, preset_id: str) -> bool:
        """Remove a timer preset."""
        presets = await self.get_presets()
        presets = [p for p in presets if p.get("id") != preset_id]
        await self.settings_setSetting(SETTINGS_KEY_PRESETS, presets)
        await self.settings_commit()
        
        await decky.emit("alarme_presets_updated", presets)
        return True

    # ==================== SETTINGS METHODS ====================

    async def get_version(self) -> str:
        """Get plugin version from plugin.json."""
        try:
            plugin_dir = os.path.dirname(os.path.realpath(__file__))
            plugin_json_path = os.path.join(plugin_dir, "plugin.json")
            with open(plugin_json_path, 'r') as f:
                plugin_data = json.load(f)
            return plugin_data.get("version", "unknown")
        except Exception as e:
            decky.logger.error(f"AlarMe: Failed to read plugin version: {e}")
            return "unknown"

    async def get_settings(self) -> dict:
        """Get user settings."""
        return await self._get_user_settings()

    async def update_settings(self, new_settings: dict) -> dict:
        """Update user settings."""
        current = await self._get_user_settings()
        current.update(new_settings)
        await self.settings_setSetting(SETTINGS_KEY_SETTINGS, current)
        
        # Truncate presets if max_visible is changed to prevent hidden presets
        if "presets_max_visible" in new_settings:
            max_visible = new_settings["presets_max_visible"]
            presets = await self.get_presets()
            if len(presets) > max_visible:
                decky.logger.info(f"AlarMe: Truncating presets list to {max_visible}")
                presets = presets[:max_visible]
                await self.settings_setSetting(SETTINGS_KEY_PRESETS, presets)
                await decky.emit("alarme_presets_updated", presets)
        
        # Update sleep inhibitor if prevent_sleep or screensaver settings changed
        if any(k in new_settings for k in ("pomodoro_prevent_sleep", "timer_prevent_sleep", "screensaver_mode", "screensaver_dim_opacity", "pomodoro_screensaver_mode")):
            await self._update_sleep_inhibitor()
                
        await self.settings_commit()
        
        await decky.emit("alarme_settings_updated", current)
        return current

    def _weather_ip_resolve_sync(self) -> tuple[float, float, str] | None:
        import urllib.request

        def _parse_lat_lon(data: dict) -> tuple[float, float] | None:
            lat = data.get("latitude")
            lon = data.get("longitude")
            if lat is None or lon is None:
                return None
            try:
                return (float(lat), float(lon))
            except (TypeError, ValueError):
                return None

        def _label_ipapi(d: dict) -> str:
            parts = [
                p
                for p in (
                    (d.get("city") or "").strip(),
                    (d.get("region") or "").strip(),
                    (d.get("country_name") or d.get("country_code") or "").strip(),
                )
                if p
            ]
            return ", ".join(parts) if parts else "Unknown"

        def _label_geojs(d: dict) -> str:
            parts = [
                p
                for p in (
                    (d.get("city") or "").strip(),
                    (d.get("region") or "").strip(),
                    (d.get("country") or "").strip(),
                )
                if p
            ]
            return ", ".join(parts) if parts else "Unknown"

        try:
            req = urllib.request.Request(
                "https://ipapi.co/json/",
                headers={"User-Agent": _BROWSER_UA},
            )
            with urllib.request.urlopen(req, timeout=10, context=_NO_VERIFY_SSL) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if data.get("error"):
                decky.logger.debug(f"AlarMe: ipapi.co error payload: {data.get('reason', data)}")
            else:
                ll = _parse_lat_lon(data)
                if ll:
                    return (ll[0], ll[1], f"{_label_ipapi(data)} · IP")
        except Exception as e:
            decky.logger.debug(f"AlarMe: ipapi.co lookup failed: {e}")

        try:
            req = urllib.request.Request(
                "https://get.geojs.io/v1/ip/geo.json",
                headers={"User-Agent": _BROWSER_UA},
            )
            with urllib.request.urlopen(req, timeout=10, context=_NO_VERIFY_SSL) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            ll = _parse_lat_lon(data)
            if ll:
                return (ll[0], ll[1], f"{_label_geojs(data)} · IP")
        except Exception as e:
            decky.logger.debug(f"AlarMe: geojs IP lookup failed: {e}")

        decky.logger.error("AlarMe: IP geolocation failed (ipapi.co and geojs)")
        return None

    async def search_weather_locations(self, query: str, limit: int = 8) -> dict:
        import urllib.parse
        import urllib.request

        q = (query or "").strip()
        if len(q) < 2:
            return {"success": False, "results": [], "error": "query_too_short"}

        try:
            n = int(limit)
        except (TypeError, ValueError):
            n = 8
        n = max(1, min(n, 10))

        enc = urllib.parse.quote(q)
        url = f"https://geocoding-api.open-meteo.com/v1/search?name={enc}&count={n}&language=en"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": _BROWSER_UA})
            with urllib.request.urlopen(req, timeout=12, context=_NO_VERIFY_SSL) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            decky.logger.error(f"AlarMe: Open-Meteo geocoding failed: {e}")
            return {"success": False, "results": [], "error": str(e)}

        raw = data.get("results") or []
        results = []
        for r in raw:
            name = r.get("name") or ""
            admin1 = r.get("admin1") or ""
            cc = r.get("country_code") or ""
            country = r.get("country") or ""
            lat = r.get("latitude")
            lon = r.get("longitude")
            if lat is None or lon is None:
                continue
            sub_parts = [p for p in (admin1, country or cc) if p]
            subtitle = ", ".join(sub_parts) if sub_parts else (cc or "")
            display_name = f"{name}, {subtitle}" if subtitle else name
            results.append(
                {
                    "name": name,
                    "admin1": admin1,
                    "country": country,
                    "country_code": cc,
                    "latitude": float(lat),
                    "longitude": float(lon),
                    "display_name": display_name,
                }
            )

        return {"success": True, "results": results, "error": None}

    async def set_weather_location(
        self, lat: float, lon: float, display_name: str
    ) -> dict:
        try:
            la = float(lat)
            lo = float(lon)
        except (TypeError, ValueError):
            return {"success": False, "error": "invalid_coordinates"}
        if not (-90 <= la <= 90 and -180 <= lo <= 180):
            return {"success": False, "error": "coordinates_out_of_range"}
        label = (display_name or "").strip()
        if not label:
            label = f"{la:.2f}, {lo:.2f}"
        try:
            wp = _weather_cache_path()
            if os.path.isfile(wp):
                os.remove(wp)
        except OSError as e:
            decky.logger.debug(f"AlarMe: weather cache remove: {e}")

        merged = await self.update_settings(
            {
                "screensaver_weather_lat": la,
                "screensaver_weather_lon": lo,
                "screensaver_weather_city_name": label,
                "screensaver_weather_location_source": "manual",
            }
        )
        return {"success": True, "error": None, "settings": merged}

    async def set_weather_location_from_ip(self) -> dict:
        ip_ll = self._weather_ip_resolve_sync()
        if not ip_ll:
            return {"success": False, "error": "ip_geo_failed"}
        la, lo, label = ip_ll
        try:
            wp = _weather_cache_path()
            if os.path.isfile(wp):
                os.remove(wp)
        except OSError as e:
            decky.logger.debug(f"AlarMe: weather cache remove: {e}")

        merged = await self.update_settings(
            {
                "screensaver_weather_lat": la,
                "screensaver_weather_lon": lo,
                "screensaver_weather_city_name": label,
                "screensaver_weather_location_source": "ip",
            }
        )
        return {"success": True, "error": None, "settings": merged}

    async def fetch_weather(self) -> dict:
        import urllib.parse
        import urllib.request

        empty = {
            "success": False,
            "temperature": None,
            "temperature_unit": "C",
            "weathercode": None,
            "is_day": None,
            "temp_max": None,
            "temp_min": None,
            "fetched_at": None,
            "error": None,
        }

        user = await self._get_user_settings()
        unit = user.get("screensaver_weather_unit") or "C"
        if unit not in ("C", "F"):
            unit = "C"
        try:
            refresh_min = int(user.get("screensaver_weather_refresh_minutes") or 30)
        except (TypeError, ValueError):
            refresh_min = 30
        refresh_min = max(5, min(refresh_min, 180))

        cache_path = _weather_cache_path()
        now_ts = time.time()
        try:
            if os.path.isfile(cache_path):
                with open(cache_path, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                ts = cached.get("fetched_at_ts")
                payload = cached.get("payload")
                if (
                    isinstance(ts, (int, float))
                    and isinstance(payload, dict)
                    and (now_ts - ts) < refresh_min * 60
                ):
                    out = dict(empty)
                    out.update(payload)
                    out["success"] = True
                    out["from_cache"] = True
                    return out
        except Exception as e:
            decky.logger.debug(f"AlarMe: weather cache read skipped: {e}")

        lat = user.get("screensaver_weather_lat")
        lon = user.get("screensaver_weather_lon")
        if lat is None or lon is None:
            ip_ll = self._weather_ip_resolve_sync()
            if not ip_ll:
                out = dict(empty)
                out["error"] = "no_location"
                return out
            lat, lon, _ip_label = ip_ll

        try:
            la = float(lat)
            lo = float(lon)
        except (TypeError, ValueError):
            out = dict(empty)
            out["error"] = "invalid_stored_coordinates"
            return out

        temp_q = "celsius" if unit == "C" else "fahrenheit"
        q = urllib.parse.urlencode(
            {
                "latitude": la,
                "longitude": lo,
                "current_weather": "true",
                "daily": "temperature_2m_max,temperature_2m_min",
                "timezone": "auto",
                "forecast_days": 1,
                "temperature_unit": temp_q,
            }
        )
        url = f"https://api.open-meteo.com/v1/forecast?{q}"

        try:
            req = urllib.request.Request(url, headers={"User-Agent": _BROWSER_UA})
            with urllib.request.urlopen(req, timeout=15, context=_NO_VERIFY_SSL) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            decky.logger.error(f"AlarMe: Open-Meteo forecast failed: {e}")
            out = dict(empty)
            out["temperature_unit"] = unit
            out["error"] = str(e)
            return out

        cur = data.get("current_weather") or {}
        daily = data.get("daily") or {}
        tmax_list = daily.get("temperature_2m_max") or []
        tmin_list = daily.get("temperature_2m_min") or []

        try:
            temp = float(cur["temperature"]) if cur.get("temperature") is not None else None
        except (TypeError, ValueError, KeyError):
            temp = None
        try:
            tmax = float(tmax_list[0]) if tmax_list else None
        except (TypeError, ValueError, IndexError):
            tmax = None
        try:
            tmin = float(tmin_list[0]) if tmin_list else None
        except (TypeError, ValueError, IndexError):
            tmin = None

        wc = cur.get("weathercode")
        try:
            wc_int = int(wc) if wc is not None else None
        except (TypeError, ValueError):
            wc_int = None
        try:
            is_day = int(cur["is_day"]) if cur.get("is_day") is not None else None
        except (TypeError, ValueError):
            is_day = None

        fetched_iso = datetime.now().isoformat(timespec="seconds")
        payload = {
            "success": True,
            "temperature": temp,
            "temperature_unit": unit,
            "weathercode": wc_int,
            "is_day": is_day,
            "temp_max": tmax,
            "temp_min": tmin,
            "fetched_at": fetched_iso,
            "error": None,
        }

        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump({"fetched_at_ts": now_ts, "payload": payload}, f, indent=0)
        except Exception as e:
            decky.logger.error(f"AlarMe: weather cache write failed: {e}")

        return dict(payload)

    async def get_overlay_data(self) -> dict:
        """Get aggregated data for the in-game overlay.
        
        Returns upcoming alerts across all categories, filtered by user settings,
        sorted by trigger time, and capped at max_alerts.
        """
        user_settings = await self._get_user_settings()
        
        if not user_settings.get("overlay_enabled", False):
            return {"alerts": [], "settings": {}}

        display_mode = user_settings.get("overlay_display_mode", "both")
        if display_mode == "gaming_only" and not await self._is_game_running():
            return {"alerts": [], "settings": {}}
        if display_mode == "steam_only" and await self._is_game_running():
            return {"alerts": [], "settings": {}}
        
        max_alerts = user_settings.get("overlay_max_alerts", 3)
        time_window = user_settings.get("overlay_time_window", 6) * 3600  # hours to seconds
        now = time.time()
        cutoff = now + time_window
        use24h = user_settings.get("time_format_24h", True)
        
        alerts = []
        sleep_preventing_alerts = []  # Always shown, regardless of filters
        
        # Timers - always check for sleep-preventing ones
        timers = await self._get_timers()
        for timer_id, timer in timers.items():
            remaining = int(timer["end_time"] - now)
            if remaining > 0:
                alert = {
                    "id": f"timer-{timer_id}",
                    "category": "timer",
                    "label": timer.get("label", "Timer"),
                    "time": timer["end_time"],
                    "remaining": remaining,
                    "subtle_mode": timer.get("subtle_mode", False),
                    "auto_suspend": timer.get("auto_suspend", False),
                    "prevent_sleep": timer.get("prevent_sleep", False)
                }
                # Sleep-preventing alerts always show
                if timer.get("prevent_sleep"):
                    sleep_preventing_alerts.append(alert)
                elif user_settings.get("overlay_show_timers", True):
                    alerts.append(alert)
        
        # Alarms - always check for sleep-preventing ones
        alarms = await self._get_alarms()
        for alarm_id, alarm in alarms.items():
            if not alarm.get("enabled", True):
                continue
            next_trigger = self._calculate_next_trigger(alarm)
            if not next_trigger:
                continue
            # Check if this alarm is currently preventing sleep (within its window)
            is_preventing = False
            if alarm.get("prevent_sleep"):
                window_minutes = alarm.get("prevent_sleep_window", 60)
                window_seconds = window_minutes * 60
                if 0 < (next_trigger - now) <= window_seconds:
                    is_preventing = True
            
            if next_trigger <= cutoff or is_preventing:
                alert = {
                    "id": f"alarm-{alarm_id}",
                    "category": "alarm",
                    "label": alarm.get("label", "Alarm"),
                    "time": next_trigger,
                    "remaining": next_trigger - now,
                    "subtle_mode": alarm.get("subtle_mode", False),
                    "auto_suspend": alarm.get("auto_suspend", False),
                    "prevent_sleep": alarm.get("prevent_sleep", False)
                }
                if is_preventing:
                    sleep_preventing_alerts.append(alert)
                elif user_settings.get("overlay_show_alarms", True):
                    alerts.append(alert)
        
        # Pomodoro - always check for sleep-preventing
        pomodoro = await self._get_pomodoro_state()
        if pomodoro.get("active") and pomodoro.get("end_time"):
            remaining = int(pomodoro["end_time"] - now)
            if remaining > 0:
                phase = "Break" if pomodoro.get("is_break") else "Focus"
                session = pomodoro.get("current_session", 1)
                is_preventing = user_settings.get("pomodoro_prevent_sleep", False)
                alert = {
                    "id": "pomodoro",
                    "category": "pomodoro",
                    "label": f"{phase} #{session}",
                    "time": pomodoro["end_time"],
                    "remaining": remaining,
                    "subtle_mode": user_settings.get("pomodoro_subtle_mode", False),
                    "auto_suspend": False,
                    "prevent_sleep": is_preventing
                }
                if is_preventing:
                    sleep_preventing_alerts.append(alert)
                elif user_settings.get("overlay_show_pomodoros", True):
                    alerts.append(alert)
        
        # Reminders - always check for sleep-preventing ones
        reminders = await self._get_reminders()
        for reminder_id, reminder in reminders.items():
            if not reminder.get("enabled"):
                continue
            if reminder.get("only_while_gaming") and not await self._is_game_running():
                continue
            next_trigger_str = reminder.get("next_trigger")
            if not next_trigger_str:
                continue
            try:
                next_trigger_dt = datetime.fromisoformat(next_trigger_str)
                next_ts = next_trigger_dt.timestamp()
                is_preventing = reminder.get("prevent_sleep", False)
                
                if next_ts <= cutoff or is_preventing:
                    alert = {
                        "id": f"reminder-{reminder_id}",
                        "category": "reminder",
                        "label": reminder.get("label", "Reminder"),
                        "time": next_ts,
                        "remaining": next_ts - now,
                        "subtle_mode": reminder.get("subtle_mode", False),
                        "auto_suspend": False,
                        "prevent_sleep": is_preventing
                    }
                    if is_preventing:
                        sleep_preventing_alerts.append(alert)
                    elif user_settings.get("overlay_show_reminders", True):
                        alerts.append(alert)
            except:
                continue
        
        # Stopwatch - show first if enabled and running
        stopwatch = await self._get_stopwatch_state()
        if stopwatch.get("status") == "running":
            is_preventing = stopwatch.get("prevent_sleep", False)
            
            laps = stopwatch.get("laps", [])
            total_lap_count = stopwatch.get("total_lap_count", len(laps))
            
            # Show lap count if any laps recorded, otherwise empty label (icon only)
            label = f"L{total_lap_count + 1}" if total_lap_count > 0 else ""
            
            stopwatch_alert = {
                "id": "stopwatch",
                "category": "stopwatch",
                "label": label,
                "time": stopwatch.get("start_time") or 0,
                "remaining": int(stopwatch.get("elapsed_ms", 0) / 1000),
                "subtle_mode": False,
                "auto_suspend": False,
                "prevent_sleep": is_preventing
            }
            
            if is_preventing:
                sleep_preventing_alerts.insert(0, stopwatch_alert)
            elif user_settings.get("overlay_show_stopwatch", False):
                alerts.insert(0, stopwatch_alert)
        
        # Combine: sleep-preventing alerts first (sorted by time), then regular alerts
        sleep_preventing_alerts.sort(key=lambda a: a["time"])
        alerts.sort(key=lambda a: a["time"])
        
        # Merge: prioritize sleep-preventing, fill remaining slots with regular alerts
        # Remove duplicates (an alert might be in both lists if it's within time window AND preventing sleep)
        sleep_ids = {a["id"] for a in sleep_preventing_alerts}
        alerts = [a for a in alerts if a["id"] not in sleep_ids]
        
        combined = sleep_preventing_alerts + alerts
        combined = combined[:max_alerts]
        
        # Return overlay-relevant settings alongside alerts
        overlay_settings = {
            "enabled": user_settings.get("overlay_enabled", False),
            "display_mode": user_settings.get("overlay_display_mode", "both"),
            "position": user_settings.get("overlay_position", "top"),
            "position_x": user_settings.get("overlay_custom_x", 24),
            "position_y": user_settings.get("overlay_custom_y", 0),
            "text_size": user_settings.get("overlay_text_size", 12),
            "opacity": user_settings.get("overlay_opacity", 0.6),
            "time_format_24h": use24h
        }
        
        return {"alerts": combined, "settings": overlay_settings}

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
            
            if "reminders" in data:
                await self._save_reminders(data["reminders"])
                await self._emit_all_reminders()
            
            # Emit general event so frontend can trigger full refresh
            await decky.emit("alarme_data_imported", True)
            
            decky.logger.info("AlarMe: Backup imported successfully")
            return True
        except Exception as e:
             decky.logger.error(f"AlarMe: Import failed: {e}")
             return False

    async def _get_user_settings(self) -> dict:
        saved = await self.settings_getSetting(SETTINGS_KEY_SETTINGS, {})
        merged = {**DEFAULT_SETTINGS, **saved}

        # Migrate old display mode values to new schema
        display_mode_map = {
            "menu_only": "steam_only",
            "gaming_and_menu": "both",
            "games_only": "gaming_only",
            "steamui_only": "steam_only",
            "steam_menu_only": "steam_only",
            "always": "both",
        }
        current_mode = merged.get("overlay_display_mode")
        if current_mode in display_mode_map:
            merged["overlay_display_mode"] = display_mode_map[current_mode]
        elif current_mode not in {"both", "steam_only", "gaming_only"}:
            merged["overlay_display_mode"] = "both"

        # Migrate old position values to new schema
        position_map = {
            "top": "default",
            "bottom": "default",
            "left": "default",
            "right": "default",
            "top-bar": "default",
            "bottom-bar": "default",
            "top-right": "default",
            "top-left": "default",
            "bottom-right": "default",
            "bottom-left": "default"
        }
        current_position = merged.get("overlay_position")
        if current_position in position_map:
            merged["overlay_position"] = position_map[current_position]
        elif current_position not in {"default", "custom"}:
            merged["overlay_position"] = "default"

        # Remove legacy floating layout mode in favor of large + pixel shift drift.
        if merged.get("overlay_screensaver_layout") == "floating":
            merged["overlay_screensaver_layout"] = "large"

        valid_wallpaper_providers = frozenset(
            {"none", "picsum", "bing_daily", "lorem_flickr", "nasa_apod", "local_folder"}
        )
        wp_provider = merged.get("screensaver_wallpaper_provider")
        if wp_provider not in valid_wallpaper_providers:
            merged["screensaver_wallpaper_provider"] = DEFAULT_SETTINGS["screensaver_wallpaper_provider"]

        return merged

    async def _migrate_settings_schema(self):
        """One-time migration for updated overlay settings schema."""
        saved = await self.settings_getSetting(SETTINGS_KEY_SETTINGS, {})
        if not isinstance(saved, dict):
            return

        updated = dict(saved)
        changed = False

        # Migrate old display mode values to new schema
        display_mode_map = {
            "menu_only": "steam_only",
            "gaming_and_menu": "both",
            "games_only": "gaming_only",
            "steamui_only": "steam_only",
            "steam_menu_only": "steam_only",
            "always": "both",
        }
        current_display_mode = updated.get("overlay_display_mode")
        if current_display_mode in display_mode_map:
            updated["overlay_display_mode"] = display_mode_map[current_display_mode]
            changed = True

        # Migrate old position values to new schema
        position_map = {
            "top": "default",
            "bottom": "default",
            "left": "default",
            "right": "default",
            "top-bar": "default",
            "bottom-bar": "default",
            "top-right": "default",
            "top-left": "default",
            "bottom-right": "default",
            "bottom-left": "default"
        }
        current_position = updated.get("overlay_position")
        if current_position in position_map:
            updated["overlay_position"] = position_map[current_position]
            changed = True

        if updated.get("overlay_screensaver_layout") == "floating":
            updated["overlay_screensaver_layout"] = "large"
            changed = True

        if "overlay_custom_x" not in updated:
            updated["overlay_custom_x"] = DEFAULT_SETTINGS["overlay_custom_x"]
            changed = True

        if "overlay_custom_y" not in updated:
            updated["overlay_custom_y"] = DEFAULT_SETTINGS["overlay_custom_y"]
            changed = True

        for stale_key in (
            "overlay_pixel_shift",
            "overlay_pixel_shift_interval",
            "overlay_pixel_shift_range",
            "overlay_position_steamui"
        ):
            if stale_key in updated:
                del updated[stale_key]
                changed = True

        if changed:
            await self.settings_setSetting(SETTINGS_KEY_SETTINGS, updated)
            await self.settings_commit()
            decky.logger.info("AlarMe: Migrated overlay settings schema")

    async def _migrate_timer_settings(self):
        """Migrate legacy global timer defaults into per-timer properties."""
        timers = await self._get_timers()
        if not timers:
            return

        user_settings = await self._get_user_settings()
        default_subtle = user_settings.get("timer_subtle_mode", False)
        default_auto_suspend = user_settings.get("timer_auto_suspend", False)
        changed = False

        for timer in timers.values():
            if "subtle_mode" not in timer:
                timer["subtle_mode"] = default_subtle
                changed = True

            if "auto_suspend" not in timer:
                timer["auto_suspend"] = default_auto_suspend
                changed = True

            if timer.get("auto_suspend") and not timer.get("subtle_mode"):
                timer["subtle_mode"] = True
                changed = True

        if changed:
            await self._save_timers(timers)
            decky.logger.info("AlarMe: Migrated timers to per-timer subtle/auto suspend settings")

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
                             subtle_mode: bool = False,
                             prevent_sleep: bool = False,
                             screensaver_mode: str = "off") -> dict:
        """
        Create a new periodic reminder.
        frequency_minutes: interval between reminders (15-180)
        start_time: ISO timestamp for first trigger, or None for "now"
        recurrences: -1 = infinite, or positive integer
        only_while_gaming: if True, only tick down while a game is running
        reset_on_game_start: if True, reset timer loop when game starts
        prevent_sleep: if True, keep device awake while reminder is active
        """
        # Check limit
        reminders = await self._get_reminders()
        if len(reminders) >= MAX_REMINDERS:
            decky.logger.warning(f"AlarMe: Reminder limit reached ({MAX_REMINDERS})")
            return None
        
        reminder_id = str(uuid.uuid4())[:8]
        
        # Calculate first trigger time
        if start_time:
            # Start time is reference point; first trigger is freq minutes after
            try:
                start_dt = datetime.fromisoformat(start_time)
                next_trigger = (start_dt + timedelta(minutes=frequency_minutes)).isoformat()
            except ValueError:
                # Fallback if format error
                next_trigger = (datetime.now() + timedelta(minutes=frequency_minutes)).isoformat()
        else:
            # "Now" means start counting from now
            next_trigger = (datetime.now() + timedelta(minutes=frequency_minutes)).isoformat()
        
        #Force disable prevent_sleep if only_while_gaming is active
        if only_while_gaming:
            prevent_sleep = False
            
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
            "prevent_sleep": prevent_sleep,
            "screensaver_mode": screensaver_mode,
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
        # Update sleep inhibitor
        await self._update_sleep_inhibitor()
        
        return reminder_data

    async def update_reminder(self, reminder_id: str, label: str = "", 
                             frequency_minutes: int = 60, start_time: str = None,
                             recurrences: int = -1, only_while_gaming: bool = False,
                             reset_on_game_start: bool = False,
                             sound: str = "alarm.mp3", volume: int = 100,
                             subtle_mode: bool = False,
                             prevent_sleep: bool = False,
                             screensaver_mode: str = "off") -> dict:
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
        reminder["prevent_sleep"] = prevent_sleep
        reminder["screensaver_mode"] = screensaver_mode
        
        #Force disable prevent_sleep if only_while_gaming is active
        if only_while_gaming:
            reminder["prevent_sleep"] = False
        
        # Recalculate next trigger if frequency changed
        if start_time:
            # Start time is reference point
            try:
                start_dt = datetime.fromisoformat(start_time)
                reminder["next_trigger"] = (start_dt + timedelta(minutes=frequency_minutes)).isoformat()
            except ValueError:
                reminder["next_trigger"] = (datetime.now() + timedelta(minutes=frequency_minutes)).isoformat()
        else:
            reminder["next_trigger"] = (datetime.now() + timedelta(minutes=frequency_minutes)).isoformat()
        
        # Reset counters and enable on update
        reminder["triggers_remaining"] = recurrences
        reminder["enabled"] = True
        
        await self._save_reminders(reminders)
        await decky.emit("alarme_reminder_updated", reminder)
        await self._emit_all_reminders()
        # Update sleep inhibitor
        await self._update_sleep_inhibitor()
        
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
            # Update sleep inhibitor
            await self._update_sleep_inhibitor()
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
            # Update sleep inhibitor
            await self._update_sleep_inhibitor()
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
                await asyncio.sleep(1)  # Check every second
                now_ts = time.time()
                
                # Sync with suspend monitor to avoid double-processing during resume
                if self.last_tick > 0 and now_ts - self.last_tick > 5:
                    continue

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
                        #  Check if missed by > 60 seconds
                        missed_delay = (now - next_trigger).total_seconds()
                        if missed_delay > 60:
                             # Gaming-only reminders fall behind when no game runs — not a real miss
                             if not reminder.get("only_while_gaming"):
                                 decky.logger.info(f"AlarMe: Reminder {reminder_id} missed by {missed_delay:.0f}s")
                                 await self._add_missed_item("reminder", reminder_id, reminder["label"], next_trigger.timestamp())
                             else:
                                 decky.logger.info(f"AlarMe: Gaming-only reminder {reminder_id} overdue by {missed_delay:.0f}s - advancing silently")
                             # Fall through to update next trigger, but SKIP emit
                        else:
                            # Trigger the reminder!
                            if reminder.get("only_while_gaming") and not await self._is_game_running():
                                continue

                            decky.logger.info(f"AlarMe: Triggering reminder {reminder_id}")
                            
                            user_settings = await self._get_user_settings()
                            await decky.emit("alarme_reminder_triggered", {
                                "reminder": reminder,
                                "sound": reminder.get("sound", "alarm.mp3"),
                                "volume": reminder.get("volume", 100),
                                "subtle_mode": reminder.get("subtle_mode", False),
                                "time_format_24h": user_settings.get("time_format_24h", True),
                                "snooze_activation_delay": user_settings.get("snooze_activation_delay", 2.0)
                            })
                        
                        # Update for next trigger
                        freq = reminder["frequency_minutes"]
                        reminder["next_trigger"] = (now + timedelta(minutes=freq)).isoformat()
                        
                        # Decrement remaining if not infinite
                        if triggers_remaining > 0:
                            reminder["triggers_remaining"] = triggers_remaining - 1
                            # Auto-disable when exhausted
                            if reminder["triggers_remaining"] == 0:
                                reminder["enabled"] = False
                                decky.logger.info(f"AlarMe: Reminder {reminder_id} exhausted, auto-disabled")
                        
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

    async def _check_missed_alarms(self, start_time: float, end_time: float):
        """Check for alarms missed between start_time and end_time.
        
        Alarms within MISS_THRESHOLD_SECONDS of end_time are left for _alarm_checker
        to handle live, avoiding double-firing on resume.
        """
        MISS_THRESHOLD_SECONDS = 90
        alarms = await self._get_alarms()
        modified = False
        
        for alarm_id, alarm in alarms.items():
            if not alarm.get("enabled", True):
                continue

            # Start checking from start_time
            start_dt = datetime.fromtimestamp(start_time)
            
            # Construct candidate for the Start Date
            candidate = start_dt.replace(
                hour=alarm["hour"],
                minute=alarm["minute"],
                second=0,
                microsecond=0
            ) 
            
            # If candidate is before start_time, move to next day
            if candidate.timestamp() < start_time:
                candidate += timedelta(days=1)
            
            # Iterate forward until end_time
            while candidate.timestamp() < end_time:
                is_valid = False
                recurring = alarm.get("recurring", "once")
                
                if recurring == "once":
                    #If 'once' alarm is active, it applies to the first valid time found
                    is_valid = True
                
                elif recurring == "daily":
                    is_valid = True
                
                elif recurring == "weekdays":
                    if candidate.weekday() < 5: is_valid = True
                
                elif recurring == "weekends":
                    if candidate.weekday() >= 5: is_valid = True
                
                else: # Custom
                    try:
                         days = [int(d) for d in recurring.split(",")]
                         if candidate.weekday() in days: is_valid = True
                    except: pass
                
                if is_valid:
                    candidate_ts = candidate.timestamp()
                    # Skip alarms within threshold of resume time - let _alarm_checker handle them live
                    if end_time - candidate_ts < MISS_THRESHOLD_SECONDS:
                        candidate += timedelta(days=1)
                        continue
                    
                    await self._add_missed_item("alarm", alarm_id, alarm.get("label", "Alarm"), candidate_ts)
                    
                    if recurring == "once":
                        alarms[alarm_id]["enabled"] = False
                        alarms[alarm_id]["snoozed_until"] = None
                        modified = True
                        break
                
                candidate += timedelta(days=1)
                
        if modified:
            await self._save_alarms(alarms)

    async def _check_missed_reminders(self, start_time: float, end_time: float):
        """Check for reminders missed between start_time and end_time."""
        reminders = await self._get_reminders()
        user_settings = await self._get_user_settings()
        behavior = user_settings.get("reminder_suspend_behavior", "continue")
        
        modified = False
        
        # PAUSE behavior: shift the schedule instead of logging missed items
        if behavior == "pause":
            suspend_duration = end_time - start_time
            if suspend_duration > 0:
                for reminder_id, reminder in reminders.items():
                    if not reminder.get("enabled"): continue
                    # Gaming-only reminders don't tick during suspend, no shift needed
                    if reminder.get("only_while_gaming"): continue
                    try:
                        # Shift next_trigger forward by the duration of suspend
                        if reminder.get("next_trigger"):
                            dt = datetime.fromisoformat(reminder["next_trigger"])
                            dt += timedelta(seconds=suspend_duration)
                            reminder["next_trigger"] = dt.isoformat()
                            modified = True
                    except Exception as e:
                        decky.logger.error(f"AlarMe: Error shifting reminder {reminder_id}: {e}")
            
            if modified:
                await self._save_reminders(reminders)
            return

        # Behavior is CONTINUE (Report Missed)
        for reminder_id, reminder in reminders.items():
             if not reminder.get("enabled"): continue
             
             # Gaming-only reminders should NOT be missed during suspend
             # (device is not gaming when suspended)
             if reminder.get("only_while_gaming"):
                 continue
             
             try:
                 next_trigger_dt = datetime.fromisoformat(reminder["next_trigger"])
             except: continue
             
             next_ts = next_trigger_dt.timestamp()
             freq = reminder["frequency_minutes"]
             
             # Loop to count missed occurrences and find the last one
             check_ts = next_ts
             processed_count = 0
             last_missed = None
             
             while check_ts < end_time:
                 if check_ts >= start_time:
                     # In window - tracking as missed
                     last_missed = check_ts
                 
                 check_ts += (freq * 60)
                 processed_count += 1
            
             if last_missed:
                 # Calculate proper next triggers
                 reminder["next_trigger"] = datetime.fromtimestamp(check_ts).isoformat()
                 
                 # Handle triggers remaining
                 triggers_remaining = reminder.get("triggers_remaining", -1)
                 if triggers_remaining > 0:
                     rem = max(0, triggers_remaining - processed_count)
                     reminder["triggers_remaining"] = rem
                     if rem == 0:
                         reminder["enabled"] = False
                 
                 # Log only the last missed occurrence (Smart Recurrence)
                 details = None
                 missed_in_window = processed_count 
                 if missed_in_window > 1:
                     details = f"Missed {missed_in_window} occurrences while away"
                 
                 await self._add_missed_item("reminder", reminder_id, reminder["label"], last_missed, details)
                 
                 modified = True
        
        if modified:
            await self._save_reminders(reminders)

    async def _check_missed_pomodoro(self, start_time: float, end_time: float):
        """Check for pomodoro session interruptions."""
        pomodoro = await self._get_pomodoro_state()
        if not pomodoro.get("active"):
             return

        user_settings = await self._get_user_settings()
        behavior = user_settings.get("pomodoro_suspend_behavior", "continue")
        
        if behavior == "pause":
             # Shift end_time by suspend duration
             suspend_duration = end_time - start_time
             if pomodoro.get("end_time"):
                 pomodoro["end_time"] += suspend_duration
                 await self._save_pomodoro_state(pomodoro)
                 decky.logger.info(f"AlarMe: Pomodoro paused during suspend. Extended by {suspend_duration:.0f}s")
                 
                 # Restart the task to respect new end time
                 if hasattr(self, 'pomodoro_task') and self.pomodoro_task:
                     self.pomodoro_task.cancel()
                 self.pomodoro_task = self.loop.create_task(self._pomodoro_handler())
             return
        
        # Else "continue" (Report Missed)
        p_end = pomodoro.get("end_time", 0)
        # Check if it finished during suspend window
        if p_end <= end_time:
             # Session finished during suspend
             
             # Cancel existing handler first to prevent double-fire
             if hasattr(self, 'pomodoro_task') and self.pomodoro_task:
                 self.pomodoro_task.cancel()
                 self.pomodoro_task = None
             
             # Add missed item
             label = "Pomodoro Break" if pomodoro.get("is_break") else "Pomodoro Focus"
             finished_at_str = datetime.fromtimestamp(p_end).strftime('%H:%M')
             details = f"Session finished at {finished_at_str}"
             
             await self._add_missed_item("pomodoro", "pomodoro-session", label, p_end, details)
             
             # Mark inactive
             pomodoro["active"] = False
             pomodoro["remaining"] = 0
             await self._save_pomodoro_state()
             
             await decky.emit("alarme_pomodoro_updated", pomodoro)

    # ==================== LIFECYCLE METHODS ====================

    async def _suspend_monitor(self):
        """Monitor for system suspend/resume events via time jumps."""
        decky.logger.info("AlarMe: Suspend monitor started")
        self.last_tick = time.time()
        
        while True:
            try:
                await asyncio.sleep(1)
                now = time.time()
                
                # Check for significant time jump (>5s) indicating suspend
                if now - self.last_tick > 5:
                    jump_duration = now - self.last_tick
                    decky.logger.info(f"AlarMe: Suspend detected! Jumped {jump_duration:.1f}s")
                    
                    user_settings = await self._get_user_settings()
                    
                    # Run historical checks (Missed Alerts Report logic)
                    if user_settings.get("missed_alerts_enabled", True):
                        # Determine check window
                        window_hours = user_settings.get("missed_alerts_window", 24)
                        check_start = max(self.last_tick, now - (window_hours * 3600))
                        
                        # Run historical checks for Alarms (Always Miss if enabled)
                        await self._check_missed_alarms(check_start, now)
                        
                        # Run historical checks for Reminders/Pomodoro ONLY if mode is CONTINUE
                        if user_settings.get("reminder_suspend_behavior", "continue") == "continue":
                            await self._check_missed_reminders(check_start, now)
                        
                        if user_settings.get("pomodoro_suspend_behavior", "continue") == "continue":
                            await self._check_missed_pomodoro(check_start, now)

                    # Run Pause (Shift) logic regardless of missed_alerts_enabled
                    # Shift logic handles its own behavior check internally
                    if user_settings.get("reminder_suspend_behavior", "continue") == "pause":
                        await self._check_missed_reminders(self.last_tick, now)
                    
                    if user_settings.get("pomodoro_suspend_behavior", "continue") == "pause":
                        await self._check_missed_pomodoro(self.last_tick, now)
                        
                    # Wait briefly for synchronous checkers to resume
                    await asyncio.sleep(1)
                    
                    # Notify about new items in the report if applicable
                    if user_settings.get("missed_alerts_enabled", True):
                        all_missed = await self.settings_getSetting("missed_alerts_items", [])
                        recent_missed = [i for i in all_missed if i.get("missed_at", 0) >= self.last_tick]
                        
                        if recent_missed:
                            count = len(recent_missed)
                            decky.logger.info(f"AlarMe: Emitting missed items: {count}")
                            await decky.emit("alarme_missed_items_toast", count)

                self.last_tick = now
            except asyncio.CancelledError:
                break
            except Exception as e:
                decky.logger.error(f"AlarMe: Suspend monitor error: {e}")
                await asyncio.sleep(5)

    async def _main(self):
        """Plugin initialization."""
        self.loop = asyncio.get_event_loop()
        self.timer_tasks = {}
        
        await self.settings_read()
        await self._migrate_settings_schema()
        await self._migrate_timer_settings()
        await self._emit_screensaver_reset_state()

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

        # Start suspend monitor
        self.suspend_monitor_task = self.loop.create_task(self._suspend_monitor())
        
        # Check and activate sleep inhibitor if any alerts require it
        await self._update_sleep_inhibitor()
        
        decky.logger.info("AlarMe: Plugin initialized successfully")

    async def factory_reset(self) -> bool:
        """Factory reset - restore all settings to defaults and clear all data."""
        try:
            decky.logger.info("AlarMe: Starting factory reset...")
            
            # 1. Cancel all active timer tasks
            for timer_id, task in list(self.timer_tasks.items()):
                task.cancel()
            self.timer_tasks.clear()
            
            # 2. Cancel alarm checker
            if self.alarm_check_task:
                self.alarm_check_task.cancel()
                self.alarm_check_task = None
            
            # 3. Cancel Pomodoro task
            if self.pomodoro_task:
                self.pomodoro_task.cancel()
                self.pomodoro_task = None
            
            # 4. Cancel reminder checker and all reminder tasks
            if self.reminder_check_task:
                self.reminder_check_task.cancel()
                self.reminder_check_task = None
            for task in self.reminder_tasks.values():
                task.cancel()
            self.reminder_tasks.clear()
            
            # 5. Cancel suspend monitor
            if self.suspend_monitor_task:
                self.suspend_monitor_task.cancel()
                self.suspend_monitor_task = None
            
            # 6. Reset settings to defaults
            await self.settings_setSetting(SETTINGS_KEY_SETTINGS, DEFAULT_SETTINGS)
            
            # 7. Clear all data keys
            await self.settings_setSetting(SETTINGS_KEY_TIMERS, {})
            await self.settings_setSetting(SETTINGS_KEY_ALARMS, {})
            await self.settings_setSetting(SETTINGS_KEY_RECENT_TIMERS, [])
            await self.settings_setSetting(SETTINGS_KEY_POMODORO, {
                "active": False,
                "is_break": False,
                "current_session": 1,
                "end_time": None,
                "duration": 0
            })
            await self.settings_setSetting(SETTINGS_KEY_REMINDERS, {})
            await self.settings_setSetting(SETTINGS_KEY_STOPWATCH, {
                "status": "idle",
                "start_time": None,
                "elapsed_ms": 0,
                "laps": []
            })
            await self.settings_setSetting("missed_alerts_items", [])
            
            # 8. Reset Pomodoro stats
            await self.settings_setSetting("pomodoro_stats", {
                "daily_focus_time": 0,
                "daily_break_time": 0,
                "daily_sessions": 0,
                "daily_cycles": 0,
                "total_focus_time": 0,
                "total_break_time": 0,
                "total_sessions": 0,
                "total_cycles": 0,
                "last_active_date": "",
                "daily_history": [],
                "current_streak": 0,
                "longest_streak": 0
            })
            
            # 9. Commit all changes
            await self.settings_commit()
            
            # 10. Emit update events to frontend
            await decky.emit("alarme_settings_updated", DEFAULT_SETTINGS)
            await decky.emit("alarme_alarms_updated", [])
            await decky.emit("alarme_timers_updated", [])
            await decky.emit("alarme_reminders_updated", [])
            await decky.emit("alarme_pomodoro_updated", {
                "active": False,
                "is_break": False,
                "current_session": 1,
                "end_time": None,
                "duration": 0
            })
            await decky.emit("alarme_missed_items_updated", [])
            
            # 11. Restart background tasks
            self.alarm_check_task = self.loop.create_task(self._alarm_checker())
            self.reminder_check_task = self.loop.create_task(self._reminder_checker())
            self.suspend_monitor_task = self.loop.create_task(self._suspend_monitor())
            
            decky.logger.info("AlarMe: Factory reset completed successfully")
            return True
            
        except Exception as e:
            decky.logger.error(f"AlarMe: Factory reset failed: {e}")
            return False

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

        # Cancel suspend monitor
        if self.suspend_monitor_task:
            self.suspend_monitor_task.cancel()
        
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
