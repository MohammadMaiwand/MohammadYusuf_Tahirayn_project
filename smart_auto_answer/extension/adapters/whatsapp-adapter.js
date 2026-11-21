/**
 * Smart Auto Answer — آداپتور واتساپ وب
 * تمرکز بر تماس‌های صوتی و تصویری ورودی. هیچ انتخاب‌گر ثابتی تنها مبنای تصمیم نیست؛
 * ابتدا نام قابل‌دسترس بررسی می‌شود و آداپتور فقط «اطمینان» را تقویت می‌کند.
 */
(function () {
  "use strict";

  const SAA = (window.__SAA = window.__SAA || {});
  SAA.adapters = SAA.adapters || [];
  SAA.registerAdapter = SAA.registerAdapter || function (a) { SAA.adapters.push(a); };

  const HOST = "web.whatsapp.com";

  // نشانه‌های سطح‌بالا که نشان می‌دهد این عنصر به کنترل تماس واتساپ مربوط است
  function looksLikeWhatsAppCallControl(el) {
    if (!el || !el.closest) return false;
    return Boolean(
      el.closest("[data-testid='call']") ||
      el.closest("[data-testid*='call' i]") ||
      el.closest("[data-icon='call']") ||
      el.closest("[data-icon='call-reject']") ||
      el.closest("[aria-label*='call' i]")
    );
  }

  SAA.registerAdapter({
    name: "whatsapp",
    matches: function (hostname) {
      return hostname === HOST;
    },

    // تقویت اطمینان بر پایهٔ نشانه‌های اختصاصی واتساپ
    boostConfidence: function (element, dialog) {
      let bonus = 0;
      const testid = (element.getAttribute && element.getAttribute("data-testid")) || "";
      const aria = (element.getAttribute && element.getAttribute("aria-label")) || "";
      const icon = (element.getAttribute && element.getAttribute("data-icon")) || "";

      const normalizedTestid = testid.toLowerCase();
      if (normalizedTestid.includes("accept") || normalizedTestid.includes("answer")) bonus += 0.35;
      if (normalizedTestid === "call-accept" || normalizedTestid === "audio-accept") bonus += 0.15;

      if (/^accept$|^answer$/i.test(aria.trim())) bonus += 0.30;
      if (icon === "call" || icon === "video-call") bonus += 0.2;

      if (looksLikeWhatsAppCallControl(element)) bonus += 0.15;

      // اگر دکمهٔ «رد» در همان ظرف باشد، یقین بیشتری داریم
      if (dialog && dialog.querySelector) {
        const reject = dialog.querySelector(
          "[data-testid='call-reject'], [data-icon='call-reject'], [aria-label*='ecline' i], [aria-label*='رد']"
        );
        if (reject) bonus += 0.2;
      }
      return bonus;
    },

    // ظرف پیشنهادی تماس برای تشخیص بهتر
    callContainerSelector: "[data-testid='call'], [role='dialog'], [aria-modal='true']",

    // توضیح سازگاری برای گزارش
    note: "واتساپ وب — تماس صوتی و تصویری ورودی (پشتیبانی از زبان‌های مختلف رابط)."
  });
})();
