/**
 * Smart Auto Answer — منطق پاپ‌آپ
 * بارگذاری/ذخیرهٔ تنظیمات، نمایش وضعیت، و اجرای آزمون تشخیص روی تب فعال.
 */
(function () {
  "use strict";

  const SITE_DEFS = [
    { host: "web.whatsapp.com", name: "واتساپ وب", note: "صوتی و تصویری" },
    { host: "web.telegram.org", name: "تلگرام وب", note: "صوتی و تصویری" },
    { host: "meet.google.com", name: "گوگل میت", note: "پیوستن به جلسه" },
    { host: "teams.microsoft.com", name: "مایکروسافت تیمز", note: "تماس ورودی" },
    { host: "localhost", name: "صفحهٔ آزمون محلی", note: "شبیه‌ساز تماس" }
  ];

  const $ = (id) => document.getElementById(id);

  const DEFAULT_SETTINGS = {
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
      "localhost": { enabled: true, autoAnswer: true },
      "127.0.0.1": { enabled: true, autoAnswer: true }
    },
    customSites: []
  };

  let settings = null;

  function toPersianDigits(value) {
    return String(value).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["saa_settings"], (data) => {
        const stored = (data && data.saa_settings) || {};
        const merged = Object.assign({}, DEFAULT_SETTINGS, stored);
        merged.sites = Object.assign({}, DEFAULT_SETTINGS.sites, stored.sites || {});
        resolve(merged);
      });
    });
  }

  function saveSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ saa_settings: settings }, resolve);
    });
  }

  function setStatus(kind, text) {
    const dot = $("statusDot");
    dot.className = "status-dot " + kind;
    if (text) $("statusText").textContent = text;
  }

  function renderSites() {
    const container = $("sitesList");
    container.innerHTML = "";
    for (const def of SITE_DEFS) {
      const cfg = settings.sites[def.host] || { enabled: true, autoAnswer: true };
      const row = document.createElement("div");
      row.className = "site-row";

      const info = document.createElement("div");
      const nameEl = document.createElement("div");
      nameEl.className = "site-name";
      nameEl.textContent = def.name;
      const metaEl = document.createElement("div");
      metaEl.className = "site-meta";
      metaEl.textContent = def.note;
      info.appendChild(nameEl);
      info.appendChild(metaEl);

      const toggleWrap = document.createElement("div");
      toggleWrap.className = "site-toggle";
      const label = document.createElement("span");
      label.className = "site-meta";
      label.textContent = "پاسخ خودکار";
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.className = "switch";
      toggle.checked = Boolean(cfg.autoAnswer);
      toggle.addEventListener("change", () => {
        settings.sites[def.host] = Object.assign({}, settings.sites[def.host], {
          enabled: true,
          autoAnswer: toggle.checked
        });
        saveSettings();
      });
      toggleWrap.appendChild(label);
      toggleWrap.appendChild(toggle);

      row.appendChild(info);
      row.appendChild(toggleWrap);
      container.appendChild(row);
    }
  }

  function renderStats(stats) {
    if (!stats) return;
    $("detectedCount").textContent = toPersianDigits(stats.detected || 0);
    $("answeredCount").textContent = toPersianDigits(stats.answered || 0);
    $("tabsCount").textContent = toPersianDigits(stats.monitoredTabs || 0);
    const nativeEl = $("nativeText");
    if (stats.nativeConnected) {
      nativeEl.textContent = "اتصال به برنامهٔ دسکتاپ: برقرار";
    } else if (stats.nativeError) {
      nativeEl.textContent = "اتصال به برنامهٔ دسکتاپ: برقرار نیست (" + stats.nativeError + ")";
    } else {
      nativeEl.textContent = "اتصال به برنامهٔ دسکتاپ: برقرار نیست";
    }
  }

  function refreshState() {
    chrome.runtime.sendMessage({ type: "SAA_GET_STATE" }, (response) => {
      if (response && response.stats) {
        renderStats(response.stats);
        if (settings && settings.enabled) {
          setStatus("status-on", "پایش فعال است.");
        } else {
          setStatus("status-idle", "پایش متوقف است.");
        }
      }
    });
  }

  async function init() {
    settings = await loadSettings();

    $("enabledToggle").checked = Boolean(settings.enabled);
    $("notifyToggle").checked = Boolean(settings.notifications);
    $("cooldownInput").value = settings.cooldownMs;
    $("thresholdInput").value = settings.acceptThreshold;

    renderSites();
    setStatus(settings.enabled ? "status-on" : "status-idle",
      settings.enabled ? "پایش فعال است." : "پایش متوقف است.");
    refreshState();

    $("enabledToggle").addEventListener("change", (e) => {
      settings.enabled = e.target.checked;
      saveSettings();
      setStatus(settings.enabled ? "status-on" : "status-idle",
        settings.enabled ? "پایش فعال است." : "پایش متوقف است.");
      broadcastSettings();
    });

    $("notifyToggle").addEventListener("change", (e) => {
      settings.notifications = e.target.checked;
      saveSettings();
    });

    $("cooldownInput").addEventListener("change", (e) => {
      settings.cooldownMs = Math.max(500, Math.min(15000, Number(e.target.value) || 3000));
      e.target.value = settings.cooldownMs;
      saveSettings();
    });

    $("thresholdInput").addEventListener("change", (e) => {
      settings.acceptThreshold = Math.max(0.3, Math.min(0.99, Number(e.target.value) || 0.72));
      e.target.value = settings.acceptThreshold;
      saveSettings();
      broadcastSettings();
    });

    $("testBtn").addEventListener("click", runTest);
    $("logsBtn").addEventListener("click", showLogs);
  }

  function broadcastSettings() {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (!tab.id) continue;
        chrome.tabs.sendMessage(tab.id, { type: "SAA_UPDATE_SETTINGS" }, () => void chrome.runtime.lastError);
      }
    });
  }

  function runTest() {
    const resultEl = $("testResult");
    resultEl.classList.remove("hidden", "ok", "fail");
    resultEl.textContent = "در حال بررسی تب فعال…";
    setStatus("status-testing", "آزمون تشخیص در جریان است…");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        resultEl.classList.add("fail");
        resultEl.textContent = "تب فعالی پیدا نشد.";
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "SAA_TEST_DETECT" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          resultEl.classList.add("fail");
          resultEl.textContent =
            "افزونه در این تب فعال نیست.\n" +
            "مطمئن شوید سایت پشتیبانی‌شده (مثل واتساپ وب) باز است و صفحه را یک‌بار بازخوانی کنید.";
          setStatus("status-idle", "افزونه در تب فعال نیست.");
          return;
        }
        if (response.found && response.top) {
          resultEl.classList.add("ok");
          resultEl.textContent =
            "تماس ورودی تشخیص داده شد ✔\n" +
            "آداپتور: " + response.adapter + "\n" +
            "دکمهٔ پاسخ: «" + response.top.name + "»\n" +
            "اطمینان: " + Math.round((response.top.confidence || 0) * 100) + "%\n" +
            "دلایل: " + ((response.top.reasons || []).join("، ") || "—");
          setStatus("status-detected", "تماس ورودی تشخیص داده شد.");
        } else {
          resultEl.classList.add("fail");
          resultEl.textContent =
            "تماس ورودی فعالی یافت نشد.\n" +
            "آداپتور: " + response.adapter + "\n" +
            "دکمه‌های پاسخ یافت‌شده: " + toPersianDigits(response.acceptCount || 0) + "\n" +
            "دکمه‌های رد یافت‌شده: " + toPersianDigits(response.declineCount || 0);
          setStatus("status-on", "تماس ورودی یافت نشد.");
        }
      });
    });
  }

  function showLogs() {
    chrome.storage.local.get(["saa_logs"], (data) => {
      const logs = (data && data.saa_logs) || [];
      const resultEl = $("testResult");
      resultEl.classList.remove("hidden", "ok", "fail");
      if (!logs.length) {
        resultEl.textContent = "گزارشی ثبت نشده است.";
        return;
      }
      const recent = logs.slice(-15).reverse();
      resultEl.innerHTML = '<div class="log-list"></div>';
      const list = resultEl.querySelector(".log-list");
      for (const item of recent) {
        const node = document.createElement("div");
        node.className = "log-item";
        const head = document.createElement("div");
        head.className = "log-head";
        head.textContent = (item.date || "") + " " + (item.time || "") + " — " + (item.host || "");
        const event = document.createElement("div");
        event.className = "log-event";
        event.textContent = (item.event || "") + ": " + (item.description || "");
        node.appendChild(head);
        node.appendChild(event);
        list.appendChild(node);
      }
    });
  }

  init();
})();
