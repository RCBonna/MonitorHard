from __future__ import annotations

import json
import atexit
import subprocess
import threading
from pathlib import Path
from typing import Any


class LibreHardwareProvider:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._latest: dict[str, Any] = {"available": False, "source": None, "sensors": [], "error": "helper_not_built"}
        self._process: subprocess.Popen[str] | None = None
        self._start()

    def _start(self) -> None:
        executable = Path(__file__).parent / "sensors" / "bin" / "Release" / "net10.0" / "win-x64" / "publish" / "MonitorHard.Sensors.exe"
        if not executable.exists():
            return
        flags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
        try:
            self._process = subprocess.Popen(
                [str(executable)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                text=True, encoding="utf-8", creationflags=flags,
            )
            threading.Thread(target=self._read, name="hardware-sensors", daemon=True).start()
        except OSError as error:
            self._set_error(str(error))

    def _read(self) -> None:
        assert self._process and self._process.stdout
        for line in self._process.stdout:
            try:
                payload = json.loads(line)
                payload["available"] = bool(payload.get("sensors"))
                with self._lock:
                    self._latest = payload
            except (json.JSONDecodeError, TypeError) as error:
                self._set_error(f"invalid_helper_output: {error}")
        if self._process.poll() not in (None, 0):
            self._set_error("sensor_helper_stopped")

    def _set_error(self, message: str) -> None:
        with self._lock:
            self._latest = {**self._latest, "available": False, "error": message}

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            raw = dict(self._latest)
        sensors = raw.get("sensors", [])

        def select(sensor_type: str, hardware_types: set[str], names: tuple[str, ...] = ()) -> float | None:
            matches = [s for s in sensors if s.get("type") == sensor_type and s.get("hardwareType") in hardware_types]
            if names:
                preferred = [s for s in matches if any(name in s.get("name", "").lower() for name in names)]
                matches = preferred or matches
            values = [float(s["value"]) for s in matches if s.get("value") is not None]
            return max(values) if values else None

        gpu_types = {"GpuNvidia", "GpuAmd", "GpuIntel"}
        temperatures = {
            "cpuCelsius": select("Temperature", {"Cpu"}, ("package", "core max", "average")),
            "gpuCelsius": select("Temperature", gpu_types, ("core", "gpu")),
            "storageCelsius": select("Temperature", {"Storage"}, ("composite", "temperature")),
        }
        fans = [
            {"name": f"{s.get('hardware')} · {s.get('name')}", "rpm": round(float(s["value"])), "source": raw.get("source")}
            for s in sensors if s.get("type") == "Fan" and s.get("value") is not None
        ]
        gpu = {
            "name": next((s.get("hardware") for s in sensors if s.get("hardwareType") in gpu_types), None),
            "usagePercent": select("Load", gpu_types, ("gpu core", "d3d 3d", "core")),
            "memoryUsedMb": select("SmallData", gpu_types, ("memory used",)),
            "memoryTotalMb": select("SmallData", gpu_types, ("memory total",)),
            "temperatureCelsius": temperatures["gpuCelsius"],
        }
        return {
            "available": raw.get("available", False),
            "source": raw.get("source"),
            "error": raw.get("error"),
            "temperatures": temperatures,
            "fans": fans,
            "gpu": gpu,
            "sensorCount": len(sensors),
        }

    def close(self) -> None:
        if self._process and self._process.poll() is None:
            self._process.terminate()


provider = LibreHardwareProvider()
atexit.register(provider.close)
