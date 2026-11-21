"""آزمون انتها-به-انتها افزونه با مرورگر واقعی (Chrome / Edge).

این اسکریپت:
  ۱. صفحهٔ شبیه‌ساز تماس (``extension/test/mock-call.html``) را روی یک سرور محلی سرو می‌کند.
  ۲. مرورگر را با افزونهٔ بارگذاری‌شده (unpacked) باز می‌کند.
  ۳. صفحه به‌صورت خودکار یک «تماس ورودی» شبیه‌سازی می‌کند.
  ۴. منتظر می‌ماند تا افزونه خودش دکمهٔ «پاسخ» را بزند و نتیجه را به سرور گزارش کند.

اجرا:
    python tests/browser_e2e.py
    python tests/browser_e2e.py --browser edge --scenario video
"""

from __future__ import annotations

import argparse
import http.server
import json
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
PROJECT = TESTS_DIR.parent
EXTENSION_DIR = PROJECT / "extension"
MOCK_DIR = EXTENSION_DIR / "test"

BROWSER_PATHS = {
    "chrome": [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ],
    "edge": [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ],
}

REPORTS: list[dict[str, str]] = []
REPORTS_LOCK = threading.Lock()


class Handler(http.server.SimpleHTTPRequestHandler):
    """سرور ساده برای سرو صفحهٔ آزمون و دریافت گزارش کلیک‌ها."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(MOCK_DIR), **kwargs)

    def do_GET(self):  # noqa: N802
        if self.path.startswith("/report"):
            query = self.path.split("?", 1)[1] if "?" in self.path else ""
            params: dict[str, str] = {}
            for part in query.split("&"):
                if "=" in part:
                    key, value = part.split("=", 1)
                    params[key] = value
            params["at"] = time.strftime("%H:%M:%S")
            with REPORTS_LOCK:
                REPORTS.append(params)
            body = b"ok"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *args):  # silence
        pass


def find_free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def find_browser(name: str) -> str | None:
    for path in BROWSER_PATHS.get(name, []):
        if Path(path).exists():
            return path
    return None


def _wait_for_cdp(debug_port: int, timeout: float) -> dict | None:
    """انتظار برای آماده‌شدن نقطهٔ اشکال‌زدایی CDP مرورگر."""
    endpoint = f"http://127.0.0.1:{debug_port}/json/version"
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(endpoint, timeout=1) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            time.sleep(0.3)
    return None


def _list_targets(debug_port: int) -> list[dict]:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{debug_port}/json/list", timeout=2) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return []


def _cdp_call(ws_url: str, method: str, params: dict | None = None, timeout: float = 10.0) -> dict:
    """یک فرمان CDP را روی وب‌سوکت اجرا و پاسخ را برمی‌گرداند."""
    from websockets.sync.client import connect

    with connect(ws_url, max_size=None, open_timeout=timeout) as socket_ws:
        socket_ws.send(json.dumps({"id": 1, "method": method, "params": params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            raw = socket_ws.recv(timeout=timeout)
            message = json.loads(raw)
            if message.get("id") == 1:
                return message
    return {}


def _load_extension_via_cdp(debug_port: int) -> dict:
    """بارگذاری افزونهٔ unpacked با CDP (روش پشتیبانی‌شدهٔ Chrome 137+)."""
    version = _wait_for_cdp(debug_port, timeout=15)
    if not version:
        return {"ok": False, "error": "CDP آماده نشد"}
    ws_url = version.get("webSocketDebuggerUrl")
    if not ws_url:
        return {"ok": False, "error": "نشانی وب‌سوکت CDP پیدا نشد"}
    try:
        response = _cdp_call(ws_url, "Extensions.loadUnpacked", {"path": str(EXTENSION_DIR)})
    except Exception as exc:  # websockets نصب نیست یا اتصال برقرار نشد
        return {"ok": False, "error": f"اجرای CDP ناموفق بود: {exc}"}
    if "error" in response:
        return {"ok": False, "error": response["error"].get("message", str(response["error"]))}
    result = response.get("result") or {}
    return {"ok": True, "id": result.get("id", "")}


def _reload_page(debug_port: int, url: str) -> None:
    """بارگذاری مجدد صفحهٔ آزمون تا کنتنت‌اسکریپت افزونه تزریق شود."""
    for target in _list_targets(debug_port):
        if target.get("type") == "page" and target.get("webSocketDebuggerUrl"):
            try:
                _cdp_call(target["webSocketDebuggerUrl"], "Page.navigate", {"url": url})
            except Exception:
                pass
            return


def run_scenario(browser_name: str, scenario: str, timeout: float, debug: bool) -> int:
    browser = find_browser(browser_name)
    if not browser:
        print(f"مرورگر «{browser_name}» پیدا نشد.")
        return 2

    port = find_free_port()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    url = f"http://127.0.0.1:{port}/mock-call.html?auto={scenario}"
    profile = Path(tempfile.mkdtemp(prefix="saa_e2e_"))
    debug_port = find_free_port()

    print(f"مرورگر: {browser}")
    print(f"افزونه: {EXTENSION_DIR}")
    print(f"آدرس صفحهٔ آزمون: {url}")
    print(f"سناریو: {scenario}")
    print("در حال اجرای مرورگر …")

    command = [
        browser,
        f"--user-data-dir={profile}",
        f"--remote-debugging-port={debug_port}",
        "--enable-unsafe-extension-debugging",
        "--enable-logging=stderr",
        "--v=1",
        # مسیر قدیمی: در نسخه‌های جدید کروم نادیده گرفته می‌شود ولی ضرری ندارد
        f"--load-extension={EXTENSION_DIR}",
        f"--disable-extensions-except={EXTENSION_DIR}",
        "--disable-features=DisableLoadExtensionCommandLineSwitch",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        "--new-window",
        url,
    ]

    log_file = Path(tempfile.gettempdir()) / "saa_chrome.log"
    log_handle = open(log_file, "w", encoding="utf-8", errors="replace")
    process = subprocess.Popen(
        command,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
    )

    # بارگذاری افزونه از راه CDP (روش مدرن). اگر شکست خورد، به پرچم خط فرمان تکیه می‌کنیم.
    load_result = _load_extension_via_cdp(debug_port)
    if load_result.get("ok"):
        print(f"افزونه از راه CDP بارگذاری شد (شناسه: {load_result.get('id', '')}).")
        # صفحه را دوباره بارگذاری کن تا کنتنت‌اسکریپت تزریق شود
        time.sleep(1.0)
        _reload_page(debug_port, url)
    else:
        print(f"بارگذاری افزونه از راه CDP ناموفق بود: {load_result.get('error')}")
        print("تلاش با پرچم خط فرمان …")

    if debug:
        time.sleep(1.5)
        for target in _list_targets(debug_port):
            print(f"  [CDP] نوع={target.get('type')} نشانی={(target.get('url') or '')[:80]}")
        try:
            log_handle.flush()
            interesting = [
                line.rstrip() for line in log_file.read_text(encoding="utf-8", errors="replace").splitlines()
                if any(key in line for key in ("xtension", "Manifest", "ERROR", "error"))
            ]
            print(f"  [لاگ کروم] {len(interesting)} خط مرتبط:")
            for line in interesting[-25:]:
                print("    " + line[:200])
        except Exception as exc:
            print(f"  [لاگ کروم] خواندن ناموفق: {exc}")

    deadline = time.time() + timeout
    found: dict[str, str] | None = None
    try:
        while time.time() < deadline:
            with REPORTS_LOCK:
                for report in REPORTS:
                    if report.get("clicked"):
                        found = dict(report)
                        break
            if found:
                break
            time.sleep(0.4)
    finally:
        try:
            process.terminate()
            process.wait(timeout=10)
        except Exception:
            try:
                process.kill()
            except Exception:
                pass
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)
    print("-" * 60)
    with REPORTS_LOCK:
        all_reports = list(REPORTS)

    if not all_reports:
        print("نتیجه: FAIL — هیچ گزارشی از صفحه دریافت نشد.")
        print("دلیل محتمل: افزونه بارگذاری نشد یا صفحه باز نشد.")
        print("راهنمای عیب‌یابی: مرورگر را دستی باز کنید و افزونه را Load unpacked کنید.")
        return 1

    for report in all_reports:
        if report.get("loaded"):
            print(f"گزارش {report.get('at', '')}: صفحهٔ آزمون بارگذاری شد.")
        elif report.get("injected"):
            print(f"گزارش {report.get('at', '')}: افزونه (کنتنت‌اسکریپت) تزریق شد.")
        elif report.get("clicked"):
            print(f"گزارش {report.get('at', '')}: کلیک={report.get('clicked')} "
                  f"منبع={'کاربر' if report.get('trusted') == '1' else 'افزونه (خودکار)'}")
        elif report.get("state"):
            print(f"گزارش {report.get('at', '')}: وضعیت={report.get('state')}")
        else:
            print(f"گزارش {report.get('at', '')}: {report}")

    injected = any(r.get("injected") for r in all_reports)
    if not injected:
        print("-" * 60)
        print("نتیجه: FAIL — صفحه باز شد ولی افزونه تزریق نشد.")
        print("دلیل محتمل: این نسخهٔ مرورگر بارگذاری خودکار افزودنی را مسدود کرده است.")
        print("راهنما: افزونه را دستی از chrome://extensions با «Load unpacked» بارگذاری کنید،")
        print("       سپس همین صفحه را باز کنید (حالت ?auto= برای شبیه‌سازی خودکار).")
        return 1

    clicked = found.get("clicked") if found else None
    trusted = found.get("trusted") if found else None
    any_click = any(r.get("clicked") for r in all_reports)

    print("-" * 60)
    if scenario == "active":
        # در تماس از قبل فعال، افزونه باید هيچ کلیکی انجام ندهد
        if not any_click:
            print("نتیجه: PASS — تماس از قبل فعال بود و افزونه هیچ کلیکی انجام نداد.")
            return 0
        print(f"نتیجه: FAIL — در تماس فعال نباید کلیک شود (clicked={clicked}).")
        return 1

    ok = clicked == "accept" and trusted == "0"
    if ok:
        print("نتیجه: PASS — افزونه به‌صورت خودکار روی دکمهٔ «پاسخ» کلیک کرد (نه روی «رد»).")
        return 0
    if clicked == "decline":
        print("نتیجه: FAIL — افزونه روی دکمهٔ «رد» کلیک کرد! (باگ ایمنی)")
        return 1
    print(f"نتیجه: FAIL — کلیک ناموفق یا نامشخص (clicked={clicked}).")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="آزمون انتها-به-انتها افزونه")
    parser.add_argument("--browser", choices=["auto", "chrome", "edge"], default="auto",
                        help="مرورگر آزمایش (auto = نخست Edge سپس Chrome)")
    parser.add_argument("--scenario", default="voice",
                        choices=["voice", "video", "persian", "negative", "active"])
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--debug", action="store_true", help="نمایش هدف‌های CDP برای عیب‌یابی")
    args = parser.parse_args()

    # ترتیب پیش‌فرض: Edge سپس Chrome. Chrome نسخهٔ پایدار، بارگذاری خودکار افزودنی را
    # مسدود می‌کند؛ Edge اجازه می‌دهد.
    order = ["edge", "chrome"] if args.browser == "auto" else [args.browser]
    available = [name for name in order if find_browser(name)]
    if not available:
        print("هیچ مرورگر پشتیبانی‌شده‌ای (Edge/Chrome) پیدا نشد.")
        return 2

    last_code = 1
    for name in available:
        print(f"=== تلاش با مرورگر: {name} ===")
        code = run_scenario(name, args.scenario, args.timeout, args.debug)
        last_code = code
        if code == 0:
            return 0
        if code == 2:
            continue
        # اگر افزونه به‌خاطر محدودیت مرورگر تزریق نشد، مرورگر بعدی را امتحان کن
        if code == 1 and args.browser == "auto" and name != available[-1]:
            print(f"—— بارگذاری افزونه در {name} ناموفق بود؛ امتحان مرورگر بعدی ——")
            continue
        return code
    return last_code


if __name__ == "__main__":
    raise SystemExit(main())
