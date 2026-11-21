/**
 * Smart Auto Answer — نقطهٔ ورود محتوا
 * تنظیمات را بارگذاری می‌کند، آداپتور مناسب دامنه را انتخاب می‌کند و حلقهٔ
 * تشخیص/پاسخ را با MutationObserver و یک بازهٔ زمانی امن اجرا می‌دهد.
 */
(function () {
  "use strict";

  const SAA = (window.__SAA = window.__SAA || {});
  if (SAA.__contentStarted) return;
  SAA.__contentStarted = true;

  const runtime = {
    settings: null,
    adapter: null,
    observer: null,
    intervalId: null,
    busy: false,
    lastDetectionLog: 0,
    lastRun: 0
  };

  // کمترین فاصلهٔ مجاز بین دو اجرای موتور تشخیص (برای جلوگیری از فشار بی‌مورد بر CPU)
  const MIN_RUN_GAP_MS = 300;

  function hostAutoAnswerEnabled(settings) {
    const host = SAA.hostname();
    const siteCfg = (settings.sites && settings.sites[host]) || null;
    if (siteCfg && typeof siteCfg.enabled === "boolean" && !siteCfg.enabled) return false;
    if (siteCfg && typeof siteCfg.autoAnswer === "boolean") return siteCfg.autoAnswer;
    return false; // دامنه‌های سفارشی باید صریحاً فعال شوند
  }

  async function runDetection(reason) {
    if (runtime.busy) return;
    const now = Date.now();
    if (now - runtime.lastRun < MIN_RUN_GAP_MS) return;
    runtime.lastRun = now;
    runtime.busy = true;
    try {
      const settings = runtime.settings || (await SAA.getSettings());
      runtime.settings = settings;
      SAA.currentSettings = settings;

      if (!settings.enabled) {
        SAA.markState("extension_disabled");
        return;
      }

      const detection = SAA.detectIncomingCall(document, runtime.adapter);
      if (!detection.found) {
        SAA.markState("no_call");
        return;
      }

      const best = detection.candidates[0];
      if (!best) {
        SAA.markState("no_candidate");
        return;
      }
      SAA.markState("best:" + best.confidence.toFixed(2) + ":active=" + best.alreadyActive +
        ":reasons=" + (best.reasons || []).join(","));

      // اعلان تشخیص (با محدودیت نرخ برای جلوگیری از اسپم)
      const stamp = Date.now();
      if (stamp - runtime.lastDetectionLog > 4000) {
        runtime.lastDetectionLog = stamp;
        SAA.notifyDetected({
          host: best.host,
          name: best.name,
          confidence: best.confidence,
          reasons: best.reasons
        });
      }

      if (!hostAutoAnswerEnabled(settings)) {
        SAA.markState("detected_auto_off:" + best.name);
        return; // حالت «فقط تشخیص» — بدون کلیک
      }

      if (best.alreadyActive) {
        SAA.markState("detected_already_active:" + best.name);
        return; // تماس فعال است؛ کلیک نکن
      }

      // دروازهٔ اطمینان: دکمه‌ای که فقط برچسب «پاسخ» دارد ولی در بافت تماس نیست
      // (مثلاً یک دکمهٔ معمولی در صفحه) نباید به‌طور تصادفی کلیک شود.
      const minConfidence = typeof settings.acceptThreshold === "number"
        ? settings.acceptThreshold
        : 0.72;
      if (best.confidence < minConfidence) {
        SAA.markState("low_confidence:" + best.confidence.toFixed(2));
        return;
      }

      SAA.markState("detected_auto_on:" + best.name + ":" + best.confidence.toFixed(2));

      const result = await SAA.tryAnswer(best, { reason: reason });
      SAA.markState("answer:" + result.reason);
      if (result.ok) {
        // پس از پاسخ موفق، کمی صبر کن تا رابط به‌روز شود
        await new Promise((r) => setTimeout(r, 800));
      }
    } catch (err) {
      SAA.log("خطای موتور تشخیص", "خطا", String(err && err.message ? err.message : err), {});
    } finally {
      runtime.busy = false;
    }
  }

  function startMonitoring() {
    if (runtime.observer) runtime.observer.stop();
    runtime.observer = SAA.createDomObserver(() => runDetection("mutation"), { debounceMs: 250 });
    runtime.observer.start();

    if (runtime.intervalId) clearInterval(runtime.intervalId);
    // بازهٔ زمانی امن به‌عنوان پشتیبان تا اگر MutationObserver از دست رفت، تشخیص ادامه یابد
    runtime.intervalId = setInterval(() => runDetection("interval"), 1500);

    runDetection("start");
  }

  function stopMonitoring() {
    if (runtime.observer) runtime.observer.stop();
    if (runtime.intervalId) clearInterval(runtime.intervalId);
    runtime.observer = null;
    runtime.intervalId = null;
  }

  // پیام‌های دریافتی از پاپ‌آپ/سرویس‌ورکر
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type) return;
      switch (message.type) {
        case "SAA_PING":
          sendResponse({ ok: true, host: SAA.hostname(), adapter: runtime.adapter ? runtime.adapter.name : "none" });
          return true;
        case "SAA_TEST_DETECT": {
          const detection = SAA.detectIncomingCall(document, runtime.adapter);
          sendResponse({
            ok: true,
            host: SAA.hostname(),
            adapter: runtime.adapter ? runtime.adapter.name : "none",
            found: detection.found,
            acceptCount: detection.acceptCount,
            declineCount: detection.declineCount,
            top: detection.candidates[0]
              ? {
                  name: detection.candidates[0].name,
                  confidence: detection.candidates[0].confidence,
                  reasons: detection.candidates[0].reasons
                }
              : null
          });
          return true;
        }
        case "SAA_UPDATE_SETTINGS":
          SAA.getSettings().then((s) => {
            runtime.settings = s;
            SAA.currentSettings = s;
            sendResponse({ ok: true });
          });
          return true;
        case "SAA_STOP_PERIODIC":
          stopMonitoring();
          sendResponse({ ok: true });
          return true;
        case "SAA_START_PERIODIC":
          startMonitoring();
          sendResponse({ ok: true });
          return true;
        default:
          return;
      }
    });
  } catch (err) {
    /* در فریم‌های خاص ممکن است دسترسی نباشد */
  }

  async function bootstrap() {
    // نشانهٔ تزریق افزونه روی DOM (در دنیای جداگانه قابل خواندن است) — برای آزمون‌های خودکار
    try {
      document.documentElement.setAttribute("data-saa-extension", SAA.VERSION || "1");
    } catch (err) {
      /* بی‌صدا */
    }
    runtime.settings = await SAA.getSettings();
    SAA.currentSettings = runtime.settings;
    runtime.adapter = SAA.getAdapterForHost(SAA.hostname());
    SAA.log("بارگذاری افزونه", "اطلاع",
      `افزونه در ${SAA.hostname()} بارگذاری شد (آداپتور: ${runtime.adapter ? runtime.adapter.name : "هیچ"}).`, {});
    startMonitoring();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
