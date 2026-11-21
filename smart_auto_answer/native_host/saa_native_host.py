"""Smart Auto Answer — میزبان Native Messaging.

این برنامهٔ کوچک، پل ارتباطی میان افزونهٔ مرورگر و برنامهٔ دسکتاپ است:
  * رویدادهای افزونه را می‌گیرد و در ``logs/extension_activity.jsonl`` ثبت می‌کند.
  * دستورهای نوشته‌شده در ``logs/extension_commands.jsonl`` را به افزونه می‌فرستد.

پروتکل Native Messaging کروم: هر پیام با ۴ بایت طول (little-endian) و سپس
بدنهٔ JSON (UTF-8) فرستاده می‌شود.
"""

from __future__ import annotations

import json
import os
import struct
import sys
import threading
import time
from pathlib import Path

READ_LOCK = threading.Lock()
WRITE_LOCK = threading.Lock()
STOP = threading.Event()


def _log_dir() -> Path:
    """پوشهٔ logs کنار پروژه (یک پله بالاتر از native_host)."""
    base = Path(__file__).resolve().parent.parent
    target = base / "logs"
    try:
        target.mkdir(parents=True, exist_ok=True)
    except OSError:
        target = Path(os.environ.get("TEMP", ".")) / "smart_auto_answer_logs"
        target.mkdir(parents=True, exist_ok=True)
    return target


ACTIVITY_FILE = _log_dir() / "extension_activity.jsonl"
COMMANDS_FILE = _log_dir() / "extension_commands.jsonl"


def read_message() -> dict | None:
    """خواندن یک پیام از stdin (باینری)."""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        return None
    (length,) = struct.unpack("<I", raw_length)
    if length <= 0 or length > 64 * 1024 * 1024:
        return None
    raw = sys.stdin.buffer.read(length)
    if len(raw) < length:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def write_message(message: dict) -> None:
    """نوشتن یک پیام به stdout (باینری)."""
    try:
        body = json.dumps(message, ensure_ascii=False).encode("utf-8")
    except (TypeError, ValueError):
        return
    with WRITE_LOCK:
        try:
            sys.stdout.buffer.write(struct.pack("<I", len(body)))
            sys.stdout.buffer.write(body)
            sys.stdout.buffer.flush()
        except (BrokenPipeError, OSError):
            STOP.set()


def append_activity(record: dict) -> None:
    try:
        with ACTIVITY_FILE.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError:
        pass


def handle_incoming(message: dict) -> None:
    """پردازش پیام دریافتی از افزونه."""
    if not isinstance(message, dict):
        return
    msg_type = message.get("type")
    if msg_type == "hello":
        append_activity({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "event": "اتصال افزونه",
            "status": "موفق",
            "description": f"افزونهٔ مرورگر متصل شد (نسخهٔ {message.get('version', '?')}).",
        })
        write_message({"type": "welcome", "desktop": os.getpid()})
        return

    if msg_type == "log":
        record = message.get("record") or {}
        record.setdefault("timestamp", time.strftime("%Y-%m-%dT%H:%M:%S"))
        append_activity(record)
        return

    if msg_type in ("detected", "answered"):
        payload = message.get("payload") or {}
        append_activity({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "event": "تماس شناسایی شد" if msg_type == "detected" else "پاسخ خودکار به تماس",
            "status": "موفق" if msg_type == "answered" else "اطلاع",
            "description": f"{payload.get('host', '')} | «{payload.get('name', '')}»",
            "extra": payload,
        })
        return

    # پیام ناشناخته را نادیده بگیر
    append_activity({
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "event": "پیام افزونه",
        "status": "اطلاع",
        "description": json.dumps(message, ensure_ascii=False)[:300],
    })


def reader_loop() -> None:
    while not STOP.is_set():
        message = read_message()
        if message is None:
            STOP.set()
            break
        with READ_LOCK:
            handle_incoming(message)


def command_loop() -> None:
    """دستورهای برنامهٔ دسکتاپ را می‌خواند و به افزونه می‌فرستد."""
    while not STOP.is_set():
        time.sleep(1.0)
        if not COMMANDS_FILE.exists():
            continue
        try:
            with COMMANDS_FILE.open("r", encoding="utf-8") as handle:
                lines = handle.readlines()
            if not lines:
                continue
            COMMANDS_FILE.write_text("", encoding="utf-8")
        except OSError:
            continue
        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                command = json.loads(line)
            except json.JSONDecodeError:
                continue
            write_message(command)


def main() -> int:
    append_activity({
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "event": "اجرای میزبان بومی",
        "status": "اطلاع",
        "description": "میزبان Native Messaging آغاز شد.",
    })
    reader = threading.Thread(target=reader_loop, daemon=True)
    sender = threading.Thread(target=command_loop, daemon=True)
    reader.start()
    sender.start()
    while not STOP.is_set():
        time.sleep(0.2)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
