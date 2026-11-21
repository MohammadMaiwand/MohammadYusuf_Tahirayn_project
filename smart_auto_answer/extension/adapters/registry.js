/**
 * Smart Auto Answer — رجیستری آداپتورها
 * هر آداپتور سایت خود را با registerAdapter ثبت می‌کند؛ این ماژول آداپتور
 * مناسب دامنهٔ جاری را برمی‌گرداند.
 */
(function () {
  "use strict";

  const SAA = (window.__SAA = window.__SAA || {});
  SAA.adapters = SAA.adapters || [];

  SAA.registerAdapter = function (adapter) {
    if (!adapter || !adapter.name || typeof adapter.matches !== "function") return;
    if (!SAA.adapters.some((item) => item.name === adapter.name)) {
      SAA.adapters.push(adapter);
    }
  };

  SAA.getAdapterForHost = function (hostname) {
    const host = hostname || SAA.hostname();
    for (const adapter of SAA.adapters) {
      try {
        if (adapter.matches(host)) return adapter;
      } catch (err) {
        /* آداپتور خراب نباید کل سیستم را متوقف کند */
      }
    }
    return null;
  };

  // هشدار اگر در فریم اصلی نباشیم و آداپتوری برای دامنه وجود ندارد
  SAA.describeAdapters = function () {
    return SAA.adapters.map((item) => item.name);
  };
})();
