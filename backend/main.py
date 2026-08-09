from __future__ import annotations

import asyncio
import platform
import socket
import time
from datetime import datetime, timezone
from pathlib import Path

import psutil
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sensor_provider import provider

try:
    import winreg
except ImportError:
    winreg = None


def _registry_value(path: str, name: str) -> str | int | None:
    if winreg is None:
        return None
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path) as key:
            return winreg.QueryValueEx(key, name)[0]
    except OSError:
        return None


_cpu_name = _registry_value(r"HARDWARE\DESCRIPTION\System\CentralProcessor\0", "ProcessorNameString")
_cpu_nominal_mhz = _registry_value(r"HARDWARE\DESCRIPTION\System\CentralProcessor\0", "~MHz")
_device_manufacturer = _registry_value(r"HARDWARE\DESCRIPTION\System\BIOS", "SystemManufacturer")
_device_model = _registry_value(r"HARDWARE\DESCRIPTION\System\BIOS", "SystemProductName")

app = FastAPI(title="MonitorHard Agent", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://rcbonna.github.io"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=[],
)

_last_io = {"at": time.monotonic(), "disk": psutil.disk_io_counters(), "net": psutil.net_io_counters()}


def _rate(current: int, previous: int, elapsed: float) -> float:
    return max(0.0, (current - previous) / max(elapsed, 0.001))


def collect_metrics() -> dict:
    now = time.monotonic()
    elapsed = now - _last_io["at"]
    disk_now = psutil.disk_io_counters()
    net_now = psutil.net_io_counters()
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage(Path.home().anchor)
    battery = psutil.sensors_battery()
    frequency = psutil.cpu_freq()

    hardware = provider.snapshot()
    result = {
        "protocolVersion": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "hostname": socket.gethostname(),
        "device": {
            "manufacturer": _device_manufacturer,
            "model": _device_model,
            "operatingSystem": platform.system(),
        },
        "uptimeSeconds": int(time.time() - psutil.boot_time()),
        "cpu": {
            "name": _cpu_name or platform.processor() or None,
            "nominalFrequencyMhz": _cpu_nominal_mhz,
            "usagePercent": psutil.cpu_percent(interval=None),
            "frequencyMhz": frequency.current if frequency else None,
            "cores": psutil.cpu_percent(interval=None, percpu=True),
        },
        "memory": {"usagePercent": memory.percent, "usedBytes": memory.used, "totalBytes": memory.total},
        "disk": {
            "usagePercent": disk.percent,
            "readBytesPerSecond": _rate(disk_now.read_bytes, _last_io["disk"].read_bytes, elapsed) if disk_now and _last_io["disk"] else 0,
            "writeBytesPerSecond": _rate(disk_now.write_bytes, _last_io["disk"].write_bytes, elapsed) if disk_now and _last_io["disk"] else 0,
        },
        "network": {
            "downloadBytesPerSecond": _rate(net_now.bytes_recv, _last_io["net"].bytes_recv, elapsed),
            "uploadBytesPerSecond": _rate(net_now.bytes_sent, _last_io["net"].bytes_sent, elapsed),
        },
        "battery": None if battery is None else {"percent": battery.percent, "plugged": battery.power_plugged, "secondsLeft": battery.secsleft if battery.secsleft >= 0 else None},
        "temperatures": hardware["temperatures"],
        "gpu": hardware["gpu"],
        "fans": hardware["fans"],
        "capabilities": {
            "hardwareSensors": hardware["available"],
            "sensorSource": hardware["source"],
            "sensorCount": hardware["sensorCount"],
            "sensorError": hardware["error"],
        },
    }
    _last_io.update(at=now, disk=disk_now, net=net_now)
    return result


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def dashboard() -> RedirectResponse:
    return RedirectResponse("https://rcbonna.github.io/MonitorHard/")


@app.get("/api/v1/status")
def status() -> dict:
    return collect_metrics()


@app.websocket("/api/v1/metrics")
async def metrics_socket(websocket: WebSocket) -> None:
    origin = websocket.headers.get("origin", "")
    if origin not in {"http://localhost:5173", "http://127.0.0.1:5173", "https://rcbonna.github.io"}:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(collect_metrics())
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765)
