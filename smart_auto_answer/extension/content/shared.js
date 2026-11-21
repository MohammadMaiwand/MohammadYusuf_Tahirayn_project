/**
 * Smart Auto Answer — ماژول مشترک
 * ابزارهای پایهٔ تشخیص متن، دسترسی به تنظیمات و ثبت رویداد.
 * همهٔ بخش‌های افزونه از فضای نام سراسری `window.__SAA` استفاده می‌کنند.
 */
(function () {
  "use strict";

  const SAA = (window.__SAA = window.__SAA || {});
  SAA.VERSION = "1.0.0";

  /* ------------------------------------------------------------------ واژه‌ها */

  // برچسب‌هایی که نشان‌دهندهٔ «پاسخ‌دادن / قبول‌کردن» تماس هستند
  SAA.ACCEPT_LABELS = [
    // English
    "accept", "answer", "accept call", "answer call", "join", "join call",
    "join meeting", "receive", "receive call", "pick up", "pick up call",
    "accept video call", "accept voice call", "answer video call", "join now",
    // German
    "annehmen", "beitreten", "anruf annehmen",
    // French
    "accepter", "rejoindre", "répondre",
    // Spanish
    "aceptar", "unirse", "contestar", "responder",
    // Turkish
    "kabul et", "katıl", "cevapla",
    // Dari / Persian
    "قبول", "پاسخ", "پيوستن", "پیوستن", "جواب", "قبول کردن",
    // Arabic (توجه: واژهٔ «رد» به‌تنهایی پذیرفته نمی‌شود؛ در فارسی/دری به‌معنای «رَد» است)
    "قبول", "إجابة", "اجابة", "انضمام", "رد الاتصال"
  ];

  // الگوهایی که نشان می‌دهند دکمه «پاسخ» نیست و نباید کلیک شود
  SAA.NEGATIVE_PATTERNS = [
    "no answer", "not answer", "cannot answer", "unable to answer",
    "missed call", "missed", "unanswered",
    "بی‌پاسخ", "بی پاسخ", "بی جواب", "تماس از دست رفته"
  ];

  SAA.isNegativeText = function (name) {
    const normalized = SAA.normalize(name);
    if (!normalized) return false;
    for (const pattern of SAA.NEGATIVE_PATTERNS) {
      const keyword = SAA.normalize(pattern);
      if (keyword && normalized.includes(keyword)) return true;
    }
    return false;
  };

  // برچسب‌هایی که نشان‌دهندهٔ «ردکردن / قطع‌کردن» هستند (هرگز نباید کلیک شوند)
  SAA.DECLINE_LABELS = [
    "decline", "reject", "dismiss", "ignore", "cancel", "end", "end call",
    "hang up", "hangup", "leave", "leave call", "leave meeting", "stop",
    // German
    "ablehnen", "beenden", "auflegen", "verlassen",
    // French
    "refuser", "rejeter", "terminer", "raccrocher", "quitter",
    // Spanish
    "rechazar", "finalizar", "colgar", "salir",
    // Turkish
    "reddet", "bitir", "kapat", "ayrıl",
    // Dari / Persian
    "رد", "لغو", "قطع", "پایان", "نخیر", "نه", "رد کردن", "قطع تماس",
    // Arabic
    "رفض", "إنهاء", "الغاء", "إلغاء", "خروج"
  ];

  // نشانه‌های «تماس در جریان» برای پرهیز از کلیک مجدد روی تماس فعال
  SAA.ACTIVE_LABELS = [
    "mute", "unmute", "speaker", "camera", "end call", "hang up", "hangup",
    "microphone", "video", "screen share", "participants", "chat", "raise hand",
    "بی‌صدا", "بی صدا", "دوربین", "قطع تماس", "پایان تماس", "میکروفون", "صدا"
  ];

  /* -------------------------------------------------------------- نرمال‌سازی */

  // یکسان‌سازی متن: کوچک‌کردن، حذف اعراب لاتین و یکسان‌سازی حروف عربی/فارسی
  SAA.normalize = function (text) {
    if (!text) return "";
    let value = String(text).toLowerCase();
    try {
      value = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (err) {
      /* normalize ممکن است در برخی محیط‌ها نباشد */
    }
    value = value
      .replace(/\u064a/g, "\u06cc") // ي -> ی
      .replace(/\u0643/g, "\u06a9") // ك -> ک
      .replace(/\u0623|\u0625|\u0622/g, "\u0627") // أ إ آ -> ا
      .replace(/\u0629/g, "\u0647"); // ة -> ه
    // نگه‌داشتن حروف لاتین، ارقام، حروف عربی/فارسی و فاصله
    value = value.replace(/[^0-9a-z\u0600-\u06ff\s]+/g, " ");
    return value.replace(/\s+/g, " ").trim();
  };

  // فاصلهٔ لِوِنشتاین برای تطبیق فازی برچسب‌ها
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      let last = prev[0];
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = Math.min(
          prev[j] + 1,
          prev[j - 1] + 1,
          last + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
        last = tmp;
      }
    }
    return prev[b.length];
  }

  SAA.similarity = function (a, b) {
    a = SAA.normalize(a);
    b = SAA.normalize(b);
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  };

  // آیا نام قابل‌دسترس با یکی از برچسب‌ها مطابقت دارد؟
  SAA.matchesAny = function (name, labels, threshold) {
    const normalized = SAA.normalize(name);
    if (!normalized) return { matched: false, keyword: "", score: 0 };
    const limit = typeof threshold === "number" ? threshold : 0.72;
    let best = { matched: false, keyword: "", score: 0 };
    for (const label of labels) {
      const keyword = SAA.normalize(label);
      if (!keyword) continue;
      // تطبیق دقیق کلمه‌ای (مثلاً «Accept» داخل «Accept Call»)
      if (normalized === keyword || normalized.split(" ").includes(keyword)) {
        return { matched: true, keyword: label, score: 1 };
      }
      if (normalized.includes(keyword) && keyword.length >= 3) {
        return { matched: true, keyword: label, score: 0.95 };
      }
      const score = SAA.similarity(normalized, keyword);
      if (score >= limit && score > best.score) {
        best = { matched: true, keyword: label, score };
      }
    }
    return best;
  };

  SAA.isDeclineText = function (name) {
    return SAA.matchesAny(name, SAA.DECLINE_LABELS, 0.8).matched;
  };

  SAA.isActiveText = function (name) {
    return SAA.matchesAny(name, SAA.ACTIVE_LABELS, 0.82).matched;
  };

  /* ------------------------------------------------- نام قابل‌دسترس و نمایش */

  // استخراج نام قابل‌دسترس یک عنصر از چند منبع مستقل
  SAA.accessibleName = function (el) {
    if (!el) return "";
    const parts = [];
    const push = (value) => {
      if (value && typeof value === "string") parts.push(value.trim());
    };
    try {
      push(el.getAttribute && el.getAttribute("aria-label"));
      push(el.getAttribute && el.getAttribute("title"));
      push(el.getAttribute && el.getAttribute("data-icon"));
      push(el.getAttribute && el.getAttribute("name"));
      push(el.getAttribute && el.getAttribute("data-testid"));
      push(el.getAttribute && el.getAttribute("data-tooltip"));

      const labelledBy = el.getAttribute && el.getAttribute("aria-labelledby");
      if (labelledBy) {
        for (const id of labelledBy.split(/\s+/)) {
          const ref = document.getElementById(id);
          if (ref) push(ref.textContent);
        }
      }
      if (el.innerText) push(el.innerText);
      else if (el.textContent) push(el.textContent);
      // عناصر فرزند (مثلاً svg با title)
      const titled = el.querySelector && el.querySelector("[title]");
      if (titled) push(titled.getAttribute("title"));
    } catch (err) {
      /* دسترسی به برخی ویژگی‌ها ممکن است خطا دهد */
    }
    return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  };

  // آیا عنصر واقعاً دیده می‌شود و قابل‌تعامل است؟
  SAA.isVisible = function (el) {
    if (!el || !el.getBoundingClientRect) return false;
    try {
      const style = window.getComputedStyle(el);
      if (!style) return false;
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (parseFloat(style.opacity || "1") < 0.05) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return false;
      // باید داخل یا نزدیک نمای دید باشد
      const inViewport =
        rect.bottom > -20 &&
        rect.right > -20 &&
        rect.top < (window.innerHeight || 0) + 20 &&
        rect.left < (window.innerWidth || 0) + 20;
      if (!inViewport) return false;
      // عنصر یا یکی از والدینش مخفی نباشد
      let node = el;
      while (node && node.nodeType === 1) {
        const nodeStyle = window.getComputedStyle(node);
        if (nodeStyle && (nodeStyle.display === "none" || nodeStyle.visibility === "hidden")) {
          return false;
        }
        node = node.parentElement;
      }
      return true;
    } catch (err) {
      return false;
    }
  };

  SAA.isEnabled = function (el) {
    if (!el) return false;
    if (el.disabled === true) return false;
    const aria = el.getAttribute && el.getAttribute("aria-disabled");
    if (aria === "true") return false;
    return true;
  };

  SAA.describeElement = function (el) {
    if (!el) return "";
    const tag = (el.tagName || "").toLowerCase();
    const role = (el.getAttribute && el.getAttribute("role")) || "";
    const testid = (el.getAttribute && el.getAttribute("data-testid")) || "";
    return `${tag}${role ? "[role=" + role + "]" : ""}${testid ? "[testid=" + testid + "]" : ""}`;
  };

  /* ---------------------------------------------------------------- تنظیمات */

  SAA.DEFAULT_SETTINGS = {
    enabled: true,
    sound: true,
    notifications: true,
    cooldownMs: 3000,
    verifyTimeoutMs: 4000,
    acceptThreshold: 0.72,
    sites: {
      "web.whatsapp.com": { enabled: true, autoAnswer: true },
      "web.telegram.org": { enabled: true, autoAnswer: true },
      "meet.google.com": { enabled: true, autoAnswer: false },
      "teams.microsoft.com": { enabled: true, autoAnswer: true },
      "teams.live.com": { enabled: true, autoAnswer: true },
      // میزبان آزمون محلی (صفحهٔ شبیه‌ساز تماس) — برای سنجش درستی کار افزونه
      "localhost": { enabled: true, autoAnswer: true },
      "127.0.0.1": { enabled: true, autoAnswer: true }
    },
    customSites: []
  };

  SAA.getSettings = function () {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["saa_settings"], (data) => {
          const stored = (data && data.saa_settings) || {};
          const merged = Object.assign({}, SAA.DEFAULT_SETTINGS, stored);
          merged.sites = Object.assign({}, SAA.DEFAULT_SETTINGS.sites, stored.sites || {});
          resolve(merged);
        });
      } catch (err) {
        resolve(Object.assign({}, SAA.DEFAULT_SETTINGS));
      }
    });
  };

  SAA.saveSettings = function (settings) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ saa_settings: settings }, () => resolve(true));
      } catch (err) {
        resolve(false);
      }
    });
  };

  SAA.hostname = function () {
    return (window.location && window.location.hostname) || "";
  };

  /* ------------------------------------------------------------------ رویداد */

  // ثبت رویداد هم در حافظهٔ افزونه و هم (به‌صورت اختیاری) برای برنامهٔ دسکتاپ
  SAA.log = function (event, status, description, extra) {
    const record = {
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 8),
      timestamp: new Date().toISOString(),
      host: SAA.hostname(),
      event: event,
      status: status || "اطلاع",
      description: description || "",
      extra: extra || {}
    };
    try {
      chrome.runtime.sendMessage({ type: "SAA_LOG", record: record });
    } catch (err) {
      /* اگر سرویس‌ورکر در دسترس نبود، بی‌صدا رد شود */
    }
    return record;
  };

  SAA.notifyAnswered = function (payload) {
    try {
      chrome.runtime.sendMessage({ type: "SAA_ANSWERED", payload: payload });
    } catch (err) {
      /* بی‌صدا */
    }
  };

  SAA.notifyDetected = function (payload) {
    try {
      chrome.runtime.sendMessage({ type: "SAA_DETECTED", payload: payload });
    } catch (err) {
      /* بی‌صدا */
    }
  };

  // قلاب آزمون: آخرین وضعیت موتور را روی <html> می‌گذارد تا صفحه‌های آزمون بتوانند آن را بخوانند.
  // این کار هیچ تأثیری بر رفتار افزونه ندارد (فقط یک ویژگی DOM).
  SAA.markState = function (value) {
    try {
      document.documentElement.setAttribute("data-saa-state", String(value));
    } catch (err) {
      /* بی‌صدا */
    }
  };
})();
