/**
 * Smart Auto Answer — آداپتور گوگل میت
 * پیوستن به جلسه با «Join now» انجام می‌شود، ولی «انتظار برای پذیرش میزبان» هرگز
 * دور زده نمی‌شود؛ گزینهٔ پاسخ خودکار برای این سایت به‌صورت پیش‌فرض خاموش است.
 */
(function () {
  "use strict";

  const SAA = (window.__SAA = window.__SAA || {});
  SAA.adapters = SAA.adapters || [];
  SAA.registerAdapter = SAA.registerAdapter || function (a) { SAA.adapters.push(a); };

  SAA.registerAdapter({
    name: "google-meet",
    matches: function (hostname) {
      return hostname === "meet.google.com";
    },

    boostConfidence: function (element) {
      let bonus = 0;
      const aria = (element.getAttribute && element.getAttribute("aria-label")) || "";
      const text = (element.innerText || element.textContent || "").trim();
      const label = (aria + " " + text).toLowerCase();

      if (/join now|ask to join|پیوستن|company|join meeting/.test(label)) bonus += 0.3;
      // دکمهٔ «Join now» در میت معمولاً کلاس خاصی دارد
      if (element.closest && element.closest("[data-meeting-title]")) bonus += 0.1;
      // «Return to home screen» و مشابه آن‌ها نباید تقویت شوند
      if (/return to home|back to home|leave|بازگشت/.test(label)) bonus -= 0.5;
      return bonus;
    },

    callContainerSelector: "[data-meeting-title], [role='dialog']",
    note: "گوگل میت — پیوستن به جلسه؛ پذیرش میزبان دور زده نمی‌شود (پیش‌فرض: خاموش)."
  });
})();
