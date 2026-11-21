/**
 * Smart Auto Answer — آداپتور عمومی
 * برای هر سایت دیگری که کاربر فعال کند. بدون نشانه‌های اختصاصی، فقط بر پایهٔ
 * نام قابل‌دسترس و بافت گفت‌وگو تصمیم می‌گیرد (محافظه‌کارانه).
 */
(function () {
  "use strict";

  const SAA = (window.__SAA = window.__SAA || {});
  SAA.adapters = SAA.adapters || [];
  SAA.registerAdapter = SAA.registerAdapter || function (a) { SAA.adapters.push(a); };

  SAA.registerAdapter({
    name: "generic",
    matches: function () {
      return true; // پوشش نهایی برای همهٔ دامنه‌ها
    },

    boostConfidence: function (element, dialog) {
      let bonus = 0;
      // اگر داخل گفت‌وگو باشد، کمی مطمئن‌تر هستیم
      if (dialog) bonus += 0.1;
      // اگر دکمه درون یک ظرف «تماس» باشد
      if (element && element.closest && element.closest("[class*='call' i], [id*='call' i]")) {
        bonus += 0.15;
      }
      return bonus;
    },

    callContainerSelector: "[role='dialog'], [aria-modal='true']",
    note: "عمومی — سایت‌های سازگار با برچسب‌های استاندارد پاسخ/قبول."
  });
})();
