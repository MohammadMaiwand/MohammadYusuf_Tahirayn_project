/**
 * Smart Auto Answer — آداپتور مایکروسافت تیمز (نسخهٔ وب)
 * فقط دکمهٔ «پاسخ/قبول تماس ورودی» تقویت می‌شود؛ «رد» و «پایان تماس» هرگز.
 */
(function () {
  "use strict";

  const SAA = (window.__SAA = window.__SAA || {});
  SAA.adapters = SAA.adapters || [];
  SAA.registerAdapter = SAA.registerAdapter || function (a) { SAA.adapters.push(a); };

  const HOSTS = ["teams.microsoft.com", "teams.live.com"];

  SAA.registerAdapter({
    name: "teams",
    matches: function (hostname) {
      return HOSTS.some((host) => hostname === host || hostname.endsWith("." + host));
    },

    boostConfidence: function (element, dialog) {
      let bonus = 0;
      const aria = (element.getAttribute && element.getAttribute("aria-label")) || "";
      const testid = (element.getAttribute && element.getAttribute("data-tid")) || "";
      const label = (aria + " " + testid).toLowerCase();

      if (/accept|answer|accept call|answer call|پاسخ|قبول/.test(label)) bonus += 0.3;
      if (/call-accept|accept-call|incoming-call-accept/.test(label)) bonus += 0.25;
      // برچسب‌های خطرناک را صریحاً جریمه کن
      if (/decline|reject|end call|hang up|رد|قطع|پایان/.test(label)) bonus -= 0.8;

      if (element.closest && element.closest("[data-tid*='incoming-call' i]")) bonus += 0.2;
      if (dialog) bonus += 0.05;
      return bonus;
    },

    callContainerSelector: "[data-tid*='incoming-call' i], [role='dialog']",
    note: "مایکروسافت تیمز وب — پاسخ به تماس ورودی."
  });
})();
