/**
 * Smart Auto Answer — سرویس‌ورکر (Manifest V3)
 * وظایف: نگه‌داری تنظیمات و آمار، ثبت رویدادها، اعلان‌ها، پل ارتباطی با برنامهٔ
 * دسکتاپ از طریق Native Messaging، و به‌روزرسانی نشان (Badge).
 */

const SAA_HOST_NAME = "com.smartautoanswer.host";
const MAX_LOGS = 500;

const stats = {
  detected: 0,
  answered: 0,
  failed: 0,
  lastActivity: null,
  monitoredTabs: 0,
  nativeConnected: false,
  nativeError: "",
  startedAt: Date.now()
};

let nativePort = null;

/* ------------------------------------------------------------------ ذخیره‌سازی */

async function loadStats() {
  try {
    const data = await chrome.storage.local.get(["saa_stats"]);
    if (data && data.saa_stats) Object.assign(stats, data.saa_stats);
  } catch (err) {
    /* بی‌صدا */
  }
}

async function saveStats() {
  try {
    await chrome.storage.local.set({ saa_stats: stats });
  } catch (err) {
    /* بی‌صدا */
  }
}

async function appendLog(record) {
  try {
    const data = await chrome.storage.local.get(["saa_logs"]);
    const logs = (data && data.saa_logs) || [];
    logs.push(record);
    while (logs.length > MAX_LOGS) logs.shift();
    await chrome.storage.local.set({ saa_logs: logs });
  } catch (err) {
    /* بی‌صدا */
  }
}

/* -------------------------------------------------------------------- نشان */

function updateBadge() {
  const text = stats.answered > 0 ? String(stats.answered) : "";
  try {
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: "#25D366" });
  } catch (err) {
    /* بی‌صدا */
  }
}

/* ------------------------------------------------------------------ اعلان */

async function notify(title, message) {
  try {
    const settings = await getSettings();
    if (!settings.notifications) return;
    chrome.notifications.create({
      type: "basic",
      iconUrl: "assets/icons/icon128.png",
      title: title,
      message: message,
      priority: 1
    });
  } catch (err) {
    /* بی‌صدا */
  }
}

async function getSettings() {
  const data = await chrome.storage.local.get(["saa_settings"]);
  return (data && data.saa_settings) || {};
}

/* --------------------------------------------------------- پل با برنامهٔ دسکتاپ */

function connectNative() {
  if (nativePort) return;
  try {
    nativePort = chrome.runtime.connectNative(SAA_HOST_NAME);
    stats.nativeConnected = true;
    stats.nativeError = "";

    nativePort.onMessage.addListener((message) => {
      // پیام‌های کنترلی از برنامهٔ دسکتاپ (مثلاً غیرفعال‌سازی موقت)
      if (message && message.command === "setEnabled") {
        getSettings().then((settings) => {
          settings.enabled = Boolean(message.value);
          chrome.storage.local.set({ saa_settings: settings });
        });
      }
    });

    nativePort.onDisconnect.addListener(() => {
      stats.nativeConnected = false;
      stats.nativeError = (chrome.runtime.lastError && chrome.runtime.lastError.message) || "قطع ارتباط";
      nativePort = null;
      saveStats();
    });

    nativePort.postMessage({ type: "hello", version: "1.0.0", at: Date.now() });
    saveStats();
  } catch (err) {
    stats.nativeConnected = false;
    stats.nativeError = String(err && err.message ? err.message : err);
    nativePort = null;
    saveStats();
  }
}

function sendToNative(record) {
  if (!nativePort) return;
  try {
    nativePort.postMessage(record);
  } catch (err) {
    /* بی‌صدا */
  }
}

/* ------------------------------------------------------------- شمارش تب‌ها */

const SUPPORTED_HOSTS = [
  "web.whatsapp.com",
  "web.telegram.org",
  "webk.telegram.org",
  "webz.telegram.org",
  "meet.google.com",
  "teams.microsoft.com",
  "teams.live.com"
];

async function refreshMonitoredTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    let count = 0;
    for (const tab of tabs) {
      if (!tab.url) continue;
      const host = safeHost(tab.url);
      if (host && SUPPORTED_HOSTS.some((h) => host === h || host.endsWith("." + h))) count++;
    }
    stats.monitoredTabs = count;
    saveStats();
  } catch (err) {
    /* بی‌صدا */
  }
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch (err) {
    return "";
  }
}

/* --------------------------------------------------------------- رویدادها */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  switch (message.type) {
    case "SAA_LOG": {
      const record = Object.assign({}, message.record, {
        tabId: sender && sender.tab ? sender.tab.id : null
      });
      stats.lastActivity = record.timestamp;
      appendLog(record);
      saveStats();
      sendToNative({ type: "log", record: record });
      sendResponse({ ok: true });
      return true;
    }
    case "SAA_DETECTED": {
      stats.detected += 1;
      stats.lastActivity = new Date().toISOString();
      saveStats();
      sendToNative({ type: "detected", payload: message.payload });
      sendResponse({ ok: true });
      return true;
    }
    case "SAA_ANSWERED": {
      stats.answered += 1;
      stats.lastActivity = new Date().toISOString();
      updateBadge();
      saveStats();
      sendToNative({ type: "answered", payload: message.payload });
      notify("تماس پاسخ داده شد",
        `تماس ورودی در ${message.payload && message.payload.host ? message.payload.host : "سایت"} به‌صورت خودکار پذیرفته شد.`);
      sendResponse({ ok: true });
      return true;
    }
    case "SAA_GET_STATE": {
      sendResponse({ ok: true, stats: stats });
      return true;
    }
    case "SAA_CONNECT_NATIVE": {
      connectNative();
      sendResponse({ ok: true, connected: stats.nativeConnected, error: stats.nativeError });
      return true;
    }
    default:
      return;
  }
});

chrome.runtime.onInstalled.addListener(async (details) => {
  const data = await chrome.storage.local.get(["saa_settings"]);
  if (!data || !data.saa_settings) {
    const defaults = {
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
    await chrome.storage.local.set({ saa_settings: defaults });
  }
  if (details && details.reason === "install") {
    await notify("Smart Auto Answer نصب شد",
      "برای پاسخ خودکار، سرویس برنامهٔ دسکتاپ را اجرا کنید و دکمهٔ افزونه را بزنید.");
  }
  refreshMonitoredTabs();
  connectNative();
});

chrome.tabs.onUpdated.addListener(() => refreshMonitoredTabs());
chrome.tabs.onRemoved.addListener(() => refreshMonitoredTabs());

chrome.alarms.create("saa-heartbeat", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "saa-heartbeat") {
    refreshMonitoredTabs();
    if (!nativePort) connectNative();
    updateBadge();
  }
});

(async function init() {
  await loadStats();
  refreshMonitoredTabs();
  connectNative();
  updateBadge();
})();
