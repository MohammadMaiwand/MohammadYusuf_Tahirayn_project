/**
 * Smart Auto Answer — موتور پاسخ‌دهی
 * یک کاندیدای تأییدشده را به‌صورت ایمن فعال می‌کند، سپس بررسی می‌کند که تماس
 * واقعاً پذیرفته شده باشد. هرگز روی «رد/قطع» کلیک نمی‌کند و تماس فعال را دوباره نمی‌زند.
 */
(function () {
  "use strict";

  const SAA = (window.__SAA = window.__SAA || {});

  // وضعیت داخلی موتور (در هر فریم مستقل است)
  const state = {
    lastClickTime: 0,
    answeredSignatures: new Set(),
    lastAttempt: null,
    running: false
  };

  function signatureFor(candidate) {
    // امضای تقریبی برای شناسایی «همین تماس»
    const name = SAA.normalize(candidate.name || "");
    const host = candidate.host || SAA.hostname();
    return `${host}::${name}`;
  }

  function inCooldown(cooldownMs) {
    return Date.now() - state.lastClickTime < (cooldownMs || 3000);
  }

  /**
   * فعال‌سازی ایمن دکمه با رویدادهای واقعی ماوس (نه فقط element.click()).
   * بسیاری از برنامه‌های وب به رویدادهای pointerdown/mouseup واکنش می‌دهند.
   */
  function activateElement(el) {
    if (!el) return false;
    try {
      el.scrollIntoView({ block: "center", inline: "center" });
    } catch (err) {
      /* اختیاری */
    }
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: window.screenX + x,
      screenY: window.screenY + y,
      button: 0,
      buttons: 1
    };
    let clicked = false;
    try {
      const pointerOpts = Object.assign({ pointerId: 1, pointerType: "mouse", isPrimary: true }, base);
      el.dispatchEvent(new PointerEvent("pointerdown", pointerOpts));
      el.dispatchEvent(new MouseEvent("mousedown", base));
      el.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, pointerOpts, { buttons: 0 })));
      el.dispatchEvent(new MouseEvent("mouseup", Object.assign({}, base, { buttons: 0 })));
      // رویداد click تزریق‌شده خودش شنونده‌های click را اجرا می‌کند؛
      // بنابراین el.click() در ادامه فراخوانی نمی‌شود تا شنونده دو بار اجرا نشود.
      el.dispatchEvent(new MouseEvent("click", Object.assign({}, base, { buttons: 0 })));
      clicked = true;
    } catch (err) {
      /* ادامه با روش پشتیبان */
    }
    // فقط اگر زنجیرهٔ بالا ناکام ماند، از روش پشتیبان استفاده کن
    if (!clicked) {
      try {
        if (typeof el.click === "function") {
          el.click();
          clicked = true;
        }
      } catch (err) {
        /* بی‌صدا */
      }
    }
    return clicked;
  }

  // انتظار برای برقراری شرط، با وقفهٔ کوتاه
  function waitFor(checkFn, timeoutMs, intervalMs) {
    return new Promise((resolve) => {
      const started = Date.now();
      const step = intervalMs || 120;
      (function poll() {
        let ok = false;
        try {
          ok = checkFn();
        } catch (err) {
          ok = false;
        }
        if (ok) {
          resolve(true);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(poll, step);
      })();
    });
  }

  // بررسی پذیرفته‌شدن تماس: دکمهٔ پذیرش ناپدید شود یا کنترل‌های تماس فعال ظاهر شوند
  function verifyAccepted(candidate, timeoutMs) {
    const originalElement = candidate.element;
    return waitFor(() => {
      // ۱) اگر دکمهٔ پذیرش دیگر در DOM نیست یا دیده نمی‌شود => احتمالاً پذیرفته شده
      if (!document.contains(originalElement) || !SAA.isVisible(originalElement)) {
        return true;
      }
      // ۲) اگر کنترل‌های تماس فعال (میکروفون/قطع تماس) ظاهر شده‌اند => پذیرفته شده
      const active = SAA.detectActiveCall(document);
      if (active.active && active.endControls >= 1) {
        return true;
      }
      return false;
    }, timeoutMs, 150);
  }

  /**
   * تلاش برای پاسخ‌دادن به یک کاندیدا.
   * خروجی: { ok, reason, verified }
   */
  SAA.tryAnswer = async function (candidate, options) {
    const opts = options || {};
    const settings = SAA.currentSettings || {};
    const cooldownMs = settings.cooldownMs || 3000;
    const verifyTimeoutMs = settings.verifyTimeoutMs || 4000;

    if (!candidate || !candidate.element) {
      return { ok: false, reason: "no_target" };
    }
    if (candidate.alreadyActive) {
      return { ok: false, reason: "already_active" };
    }
    // هرگز روی برچسب رد/قطع کلیک نکن
    if (SAA.isDeclineText(candidate.name) &&
        !SAA.matchesAny(candidate.name, SAA.ACCEPT_LABELS, 0.95).matched) {
      return { ok: false, reason: "decline_guard" };
    }
    // برچسب‌های منفی مانند «No answer / Missed» را نیز رد کن
    if (SAA.isNegativeText(candidate.name)) {
      return { ok: false, reason: "negative_guard" };
    }

    const signature = signatureFor(candidate);
    if (state.answeredSignatures.has(signature)) {
      return { ok: false, reason: "duplicate" };
    }
    if (inCooldown(cooldownMs)) {
      return { ok: false, reason: "cooldown" };
    }

    // تأیید نهایی تعامل‌پذیری
    if (!SAA.isVisible(candidate.element) || !SAA.isEnabled(candidate.element)) {
      return { ok: false, reason: "not_interactable" };
    }

    state.lastAttempt = { candidate: candidate, at: Date.now() };
    const clicked = activateElement(candidate.element);
    if (!clicked) {
      return { ok: false, reason: "click_failed" };
    }
    state.lastClickTime = Date.now();

    const verified = await verifyAccepted(candidate, verifyTimeoutMs);
    if (verified) {
      state.answeredSignatures.add(signature);
      // پاک‌سازی امضاهای قدیمی برای جلوگیری از رشد بی‌پایان
      if (state.answeredSignatures.size > 50) {
        state.answeredSignatures.clear();
        state.answeredSignatures.add(signature);
      }
      SAA.notifyAnswered({
        host: candidate.host,
        name: candidate.name,
        confidence: candidate.confidence,
        verified: true
      });
      SAA.log("پاسخ خودکار به تماس", "موفق",
        `دکمهٔ «${candidate.name}» در ${candidate.host} فعال شد و پذیرش تأیید گردید.`,
        { confidence: candidate.confidence });
      return { ok: true, reason: "answered", verified: true };
    }

    // کلیک انجام شد ولی پذیرش تأیید نشد (مثلاً نیاز به تعامل واقعی کاربر)
    SAA.log("تلاش برای پاسخ", "هشدار",
      `کلیک روی «${candidate.name}» انجام شد ولی تأیید پذیرش دریافت نشد. ممکن است سایت به تعامل واقعی نیاز داشته باشد.`,
      { confidence: candidate.confidence });
    return { ok: false, reason: "unverified", verified: false };
  };

  SAA.answerState = state;
})();
