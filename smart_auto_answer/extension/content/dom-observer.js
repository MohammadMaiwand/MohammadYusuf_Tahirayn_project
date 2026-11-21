/**
 * Smart Auto Answer — ناظر DOM
 * با MutationObserver تغییرات صفحه را رصد می‌کند و با debounce اعلان می‌دهد
 * تا موتور تشخیص بلافاصله پس از ظاهر شدن گفت‌وگوی تماس اجرا شود.
 */
(function () {
  "use strict";

  const SAA = (window.__SAA = window.__SAA || {});

  SAA.createDomObserver = function (onChange, options) {
    const opts = options || {};
    const debounceMs = opts.debounceMs || 200;
    let timer = null;
    let observer = null;

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        try {
          onChange();
        } catch (err) {
          /* خطای callback نباید ناظر را متوقف کند */
        }
      }, debounceMs);
    }

    function start() {
      if (observer) return;
      const target = opts.target || document.documentElement || document.body;
      if (!target) return;
      observer = new MutationObserver((mutations) => {
        // فقط اگر تغییرات معنادار بودند (افزودن/حذف گره یا تغییر ویژگی) دوباره بررسی کن
        for (const mutation of mutations) {
          if (mutation.type === "childList" && (mutation.addedNodes.length || mutation.removedNodes.length)) {
            schedule();
            return;
          }
          if (mutation.type === "attributes") {
            schedule();
            return;
          }
        }
      });
      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-label", "aria-hidden", "class", "style", "data-testid", "disabled"]
      });
    }

    function stop() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    return { start: start, stop: stop, schedule: schedule };
  };
})();
