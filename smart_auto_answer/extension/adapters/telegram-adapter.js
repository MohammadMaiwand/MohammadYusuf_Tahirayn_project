/**
 * Smart Auto Answer — آداپتور تلگرام وب
 * پشتیبانی از نسخه‌های K و Z تلگرام وب تا حد امکان.
 */
(function () {
  "use strict";

  const SAA = (window.__SAA = window.__SAA || {});
  SAA.adapters = SAA.adapters || [];
  SAA.registerAdapter = SAA.registerAdapter || function (a) { SAA.adapters.push(a); };

  const HOSTS = ["web.telegram.org", "webk.telegram.org", "webz.telegram.org"];

  SAA.registerAdapter({
    name: "telegram",
    matches: function (hostname) {
      return HOSTS.some((host) => hostname === host || hostname.endsWith("." + host));
    },

    boostConfidence: function (element, dialog) {
      let bonus = 0;
      const cls = (element.className && element.className.toString()) || "";
      const aria = (element.getAttribute && element.getAttribute("aria-label")) || "";
      const title = (element.getAttribute && element.getAttribute("title")) || "";

      if (/btn-primary|btn-success|button-primary/i.test(cls)) bonus += 0.2;
      if (/accept|answer|قبول|پاسخ/i.test(aria) || /accept|answer|قبول|پاسخ/i.test(title)) bonus += 0.25;

      // ظرف تماس تلگرام
      if (element.closest && (element.closest(".popup") || element.closest("[class*='call' i]"))) {
        bonus += 0.15;
      }
      if (dialog) bonus += 0.05;
      return bonus;
    },

    callContainerSelector: "[class*='call' i], .popup, [role='dialog']",
    note: "تلگرام وب — تماس صوتی/تصویری ورودی."
  });
})();
