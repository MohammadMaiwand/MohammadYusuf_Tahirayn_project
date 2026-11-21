/**
 * Smart Auto Answer — موتور تشخیص تماس (عمومی)
 * با پیمایش DOM و بررسی نام‌های قابل‌دسترس، ملزومات یک «تماس ورودی» را پیدا می‌کند.
 * این ماژول هیچ‌گاه به‌تنهایی کلیک نمی‌کند؛ فقط کاندیداها را برمی‌گرداند.
 */
(function () {
  "use strict";

  const SAA = (window.__SAA = window.__SAA || {});

  // عناصری که می‌توانند دکمهٔ قابل‌کلیک باشند
  const CLICKABLE_SELECTOR = [
    "button",
    "[role='button']",
    "[role='menuitem']",
    "a[href]",
    "div[aria-label]",
    "span[aria-label]",
    "div[data-testid]",
    "span[data-testid]"
  ].join(",");

  // ظرف‌هایی که معمولاً گفت‌وگوی تماس در آن‌ها ظاهر می‌شود
  const DIALOG_SELECTOR = [
    "[role='dialog']",
    "[role='alertdialog']",
    "[aria-modal='true']",
    "[data-testid*='call']",
    "[data-testid*='Call']",
    "[class*='call' i]",
    "[class*='Call']",
    "[id*='call' i]"
  ].join(",");

  function collectClickableElements(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const nodes = scope.querySelectorAll(CLICKABLE_SELECTOR);
    const result = [];
    for (const node of nodes) {
      const name = SAA.accessibleName(node);
      if (!name) continue;
      // ظرف‌هایی که خودشان یک عنصر قابل‌کلیک دیگر درون دارند کنار گذاشته می‌شوند؛
      // وگرنه نام ظرف، برچسب دکمه‌های فرزند را در خود حل می‌کند و کلیک روی ظرف بی‌اثر می‌شود.
      if (node.querySelector && node.querySelector(CLICKABLE_SELECTOR)) continue;
      result.push({ element: node, name: name });
    }
    return result;
  }

  // آیا این نام، برچسب «رد / قطع» است؟ (برای تشخیص بافت تماس ورودی)
  function nameIsDecline(name) {
    return SAA.isDeclineText(name) && !SAA.matchesAny(name, SAA.ACCEPT_LABELS, 0.9).matched;
  }

  function nameIsAccept(name) {
    return SAA.matchesAny(name, SAA.ACCEPT_LABELS, SAA.acceptThreshold || 0.72);
  }

  // نزدیک‌ترین ظرف گفت‌وگوی مشترک بین دو عنصر (برای اطمینان از هم‌بافت‌بودن)
  function sharedDialog(a, b) {
    if (!a || !b) return null;
    const ancestors = new Map();
    let node = a;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 15) {
      ancestors.set(node, depth);
      node = node.parentElement;
      depth++;
    }
    let cursor = b;
    let steps = 0;
    while (cursor && cursor.nodeType === 1 && steps < 15) {
      if (ancestors.has(cursor)) return cursor;
      cursor = cursor.parentElement;
      steps++;
    }
    return null;
  }

  function dialogHasActiveControls(dialog) {
    if (!dialog) return false;
    const controls = collectClickableElements(dialog);
    let hasMuteOrEnd = false;
    for (const item of controls) {
      if (SAA.isActiveText(item.name) && nameIsDecline(item.name)) {
        hasMuteOrEnd = true;
        break;
      }
    }
    return hasMuteOrEnd;
  }

  /**
   * تشخیص تماس ورودی در کل صفحه.
   * خروجی: { found, candidates: [...], dialogs: [...] }
   * هر کاندیدا شامل: element، name، confidence، dialog، needsDeclineSibling
   */
  SAA.detectIncomingCall = function (root, adapter) {
    const settings = SAA.currentSettings || {};
    const threshold = settings.acceptThreshold || 0.72;
    SAA.acceptThreshold = threshold;

    const elements = collectClickableElements(root);
    const acceptButtons = [];
    const declineButtons = [];

    for (const item of elements) {
      if (!SAA.isVisible(item.element)) continue;
      if (!SAA.isEnabled(item.element)) continue;
      // برچسب‌هایی مانند «No answer / Missed» نه پذیرش‌اند و نه رد؛ نادیده گرفته شوند
      if (SAA.isNegativeText(item.name)) continue;
      const accept = SAA.matchesAny(item.name, SAA.ACCEPT_LABELS, threshold);
      if (accept.matched) {
        acceptButtons.push({ element: item.element, name: item.name, score: accept.score, keyword: accept.keyword });
        continue;
      }
      if (nameIsDecline(item.name)) {
        declineButtons.push({ element: item.element, name: item.name });
      }
    }

    const candidates = [];
    for (const accept of acceptButtons) {
      // ۱) هر دکمهٔ پذیرش باید خواهر «رد» هم‌بافت باشد، مگر آداپتور بگوید لازم نیست.
      let siblingDecline = null;
      for (const decline of declineButtons) {
        const dialog = sharedDialog(accept.element, decline.element);
        if (dialog) {
          siblingDecline = { element: decline.element, dialog: dialog };
          break;
        }
      }

      // ۲) نزدیک‌ترین ظرف تماس (برای امتیاز اطمینان)
      let contextDialog = null;
      let scan = accept.element.parentElement;
      let levels = 0;
      while (scan && scan.nodeType === 1 && levels < 12) {
        if (scan.matches && scan.matches(DIALOG_SELECTOR)) {
          contextDialog = scan;
          break;
        }
        scan = scan.parentElement;
        levels++;
      }

      // ۳) اگر هرکدام از ظرف‌های تماس بالادستی کنترل‌های «تماس در جریان» (میکروفون/قطع تماس)
      //    را داشته باشند، یعنی این تماس قبلاً پاسخ داده شده و نباید دوباره کلیک شود.
      let alreadyActive = false;
      let activeScan = accept.element.parentElement;
      let activeLevels = 0;
      while (activeScan && activeScan.nodeType === 1 && activeLevels < 12) {
        if (activeScan.matches && activeScan.matches(DIALOG_SELECTOR) &&
            dialogHasActiveControls(activeScan)) {
          alreadyActive = true;
          break;
        }
        activeScan = activeScan.parentElement;
        activeLevels++;
      }

      // محاسبهٔ اطمینان
      let confidence = accept.score * 0.6;
      const reasons = [];
      if (siblingDecline) {
        confidence += 0.3;
        reasons.push("هم‌بافت با دکمهٔ رد");
      }
      if (contextDialog) {
        confidence += 0.1;
        reasons.push("داخل ظرف تماس");
      }
      if (adapter && typeof adapter.boostConfidence === "function") {
        const bonus = adapter.boostConfidence(accept.element, contextDialog) || 0;
        confidence += bonus;
        if (bonus) reasons.push("تأیید آداپتور سایت");
      }
      confidence = Math.max(0, Math.min(1, confidence));

      candidates.push({
        element: accept.element,
        name: accept.name,
        keyword: accept.keyword,
        confidence: confidence,
        reasons: reasons,
        dialog: contextDialog || (siblingDecline && siblingDecline.dialog) || null,
        declineSibling: siblingDecline ? siblingDecline.element : null,
        alreadyActive: alreadyActive,
        host: SAA.hostname()
      });
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    return {
      found: candidates.length > 0,
      candidates: candidates,
      acceptCount: acceptButtons.length,
      declineCount: declineButtons.length
    };
  };

  // تشخیص «تماس فعال» برای پرهیز از کلیک دوباره
  SAA.detectActiveCall = function (root) {
    const elements = collectClickableElements(root);
    let mute = 0;
    let end = 0;
    for (const item of elements) {
      if (!SAA.isVisible(item.element)) continue;
      const name = SAA.normalize(item.name);
      if (/\b(mute|unmute|microphone|camera|speaker|screen share|raise hand)\b/.test(name) ||
          /بی.?صدا|میکروفون|دوربین/.test(name)) {
        mute++;
      }
      if (/\b(end call|hang up|hangup|leave)\b/.test(name) || /قطع تماس|پایان تماس/.test(name)) {
        end++;
      }
    }
    return { active: mute >= 1 || end >= 1, muteControls: mute, endControls: end };
  };

  SAA.CLICKABLE_SELECTOR = CLICKABLE_SELECTOR;
  SAA.DIALOG_SELECTOR = DIALOG_SELECTOR;
  SAA.sharedDialog = sharedDialog;
})();
