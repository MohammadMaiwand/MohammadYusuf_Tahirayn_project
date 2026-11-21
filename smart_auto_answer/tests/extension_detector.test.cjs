/**
 * آزمون خودکار موتور تشخیص افزونهٔ Smart Auto Answer.
 *
 * این آزمون، ماژول‌های واقعی افزونه (shared.js، call-detector.js، answer-engine.js و
 * آداپتورها) را داخل یک DOM شبیه‌سازی‌شده (jsdom) بارگذاری می‌کند و رفتار موتور را
 * روی «صحنه‌های تماس» بررسی می‌کند — بدون نیاز به تماس واقعی.
 *
 * اجرا:  node extension_detector.test.cjs
 * پیش‌نیاز: نصب وابستگی‌ها با  npm install  در همین پوشه.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const EXT_DIR = path.resolve(__dirname, "..", "extension");
const CONTENT_FILES = [
  "content/shared.js",
  "content/call-detector.js",
  "content/answer-engine.js",
  "adapters/registry.js",
  "adapters/whatsapp-adapter.js",
  "adapters/telegram-adapter.js",
  "adapters/meet-adapter.js",
  "adapters/teams-adapter.js",
  "adapters/generic-adapter.js",
];

/* ----------------------------------------------------------------- نتایج آزمون */

const results = [];

function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail: detail || "" });
}

function makeChromeStub(store) {
  return {
    runtime: {
      sendMessage: () => {},
      lastError: null,
      onMessage: { addListener: () => {} },
      id: "test-extension-id",
    },
    storage: {
      local: {
        get: (keys, cb) => {
          const out = {};
          const list = Array.isArray(keys) ? keys : [keys];
          for (const key of list) out[key] = store[key];
          if (typeof cb === "function") cb(out);
          return Promise.resolve(out);
        },
        set: (obj, cb) => {
          Object.assign(store, obj);
          if (typeof cb === "function") cb();
          return Promise.resolve();
        },
      },
    },
  };
}

/** ساخت یک محیط jsdom با ماژول‌های افزونه بارگذاری‌شده. */
function createEnv(html, url) {
  const dom = new JSDOM(html, {
    url: url || "https://web.whatsapp.com/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;

  window.chrome = makeChromeStub({});

  // jsdom همهٔ مستطیل‌ها را صفر برمی‌گرداند؛ برای آزمون «دیدپذیری» یک کادر واقعی می‌سازیم
  window.Element.prototype.getBoundingClientRect = function () {
    return { left: 10, top: 10, width: 140, height: 44, right: 150, bottom: 54, x: 10, y: 10 };
  };
  window.Element.prototype.scrollIntoView = function () {};

  // تنظیمات پیش‌فرض موتور
  for (const rel of CONTENT_FILES) {
    const source = fs.readFileSync(path.join(EXT_DIR, rel), "utf8");
    window.eval(source);
  }

  const SAA = window.__SAA;
  SAA.currentSettings = {
    enabled: true,
    cooldownMs: 3000,
    verifyTimeoutMs: 400,
    acceptThreshold: 0.72,
    sites: {},
  };
  SAA.acceptThreshold = 0.72;
  return { dom, window, document: window.document, SAA };
}

function namesOf(candidates) {
  return candidates.map((item) => item.name);
}

/* ------------------------------------------------------------------- صحنه‌ها */

// صحنهٔ ۱ — تماس ورودی واتساپ (انگلیسی)
function scenarioWhatsAppEnglish() {
  const html = `<!DOCTYPE html><html><body>
    <div data-testid="call">
      <div role="button" aria-label="Accept" data-testid="call-accept"></div>
      <div role="button" aria-label="Decline" data-testid="call-reject"></div>
    </div>
  </body></html>`;
  const env = createEnv(html, "https://web.whatsapp.com/");
  const adapter = env.SAA.getAdapterForHost("web.whatsapp.com");
  const detection = env.SAA.detectIncomingCall(env.document, adapter);

  check("۱) واتساپ انگلیسی: تماس ورودی تشخیص داده می‌شود", detection.found === true,
    "found=" + detection.found);
  const top = detection.candidates[0];
  check("۱) واتساپ انگلیسی: دکمهٔ درست (Accept) انتخاب می‌شود",
    top && /accept/i.test(top.name), top ? "top=" + top.name : "بدون کاندیدا");
  check("۱) واتساپ انگلیسی: اطمینان بالای آستانه است",
    top && top.confidence >= 0.72, top ? "confidence=" + top.confidence.toFixed(2) : "-");
  check("۱) واتساپ انگلیسی: آداپتور اختصاصی شناسایی شد",
    adapter && adapter.name === "whatsapp", adapter ? adapter.name : "هیچ");
  return env;
}

// صحنهٔ ۲ — تماس ورودی با برچسب‌های فارسی/دری
function scenarioPersianLabels() {
  const html = `<!DOCTYPE html><html><body>
    <div role="dialog" aria-modal="true">
      <button aria-label="پاسخ" class="btn">پاسخ</button>
      <button aria-label="رد" class="btn">رد</button>
    </div>
  </body></html>`;
  const env = createEnv(html, "https://web.whatsapp.com/");
  const adapter = env.SAA.getAdapterForHost("web.whatsapp.com");
  const detection = env.SAA.detectIncomingCall(env.document, adapter);

  check("۲) فارسی: تماس ورودی تشخیص داده می‌شود", detection.found === true,
    "found=" + detection.found);
  const top = detection.candidates[0];
  check("۲) فارسی: دکمهٔ «پاسخ» انتخاب می‌شود (نه «رد»)",
    top && env.SAA.normalize(top.name).includes("پاسخ"),
    top ? "top=" + top.name : "بدون کاندیدا");
  const clickedDecline = detection.candidates.some(
    (item) => (item.element.getAttribute("aria-label") || "") === "رد"
  );
  check("۲) فارسی: دکمهٔ «رد» هرگز کاندیدا نمی‌شود", clickedDecline === false,
    "کاندیداها=" + namesOf(detection.candidates).join(" | "));
  return env;
}

// صحنهٔ ۳ — برچسب منفی «No answer» باید نادیده گرفته شود
function scenarioNegativeLabel() {
  const html = `<!DOCTYPE html><html><body>
    <div role="dialog">
      <button aria-label="Answer">Answer</button>
      <button aria-label="Decline">Decline</button>
    </div>
    <div role="button">No answer</div>
    <div role="button">Missed call</div>
  </body></html>`;
  const env = createEnv(html, "https://web.whatsapp.com/");
  const adapter = env.SAA.getAdapterForHost("web.whatsapp.com");
  const detection = env.SAA.detectIncomingCall(env.document, adapter);

  check("۳) برچسب منفی: فقط یک دکمهٔ پاسخ شناخته می‌شود",
    detection.acceptCount === 1, "acceptCount=" + detection.acceptCount);
  const top = detection.candidates[0];
  check("۳) برچسب منفی: «No answer / Missed call» انتخاب نمی‌شود",
    top && !env.SAA.isNegativeText(top.name) && env.SAA.normalize(top.name).includes("answer"),
    top ? "top=" + top.name : "-");
  return env;
}

// صحنهٔ ۴ — فقط دکمهٔ رد وجود دارد (نباید هیچ کلیکی رخ دهد)
function scenarioOnlyDecline() {
  const html = `<!DOCTYPE html><html><body>
    <div role="dialog">
      <button aria-label="Decline">Decline</button>
      <button aria-label="Ignore">Ignore</button>
    </div>
  </body></html>`;
  const env = createEnv(html, "https://web.whatsapp.com/");
  const adapter = env.SAA.getAdapterForHost("web.whatsapp.com");
  const detection = env.SAA.detectIncomingCall(env.document, adapter);
  check("۴) فقط دکمهٔ رد: هیچ تماسی تشخیص داده نمی‌شود", detection.found === false,
    "found=" + detection.found + " acceptCount=" + detection.acceptCount);
  return env;
}

// صحنهٔ ۵ — پاسخ خودکار: کلیک انجام شود و پذیرش تأیید گردد
async function scenarioAutomaticAnswer() {
  const html = `<!DOCTYPE html><html><body>
    <div data-testid="call" id="callDialog">
      <div role="button" aria-label="Accept" data-testid="call-accept" id="acceptBtn"></div>
      <div role="button" aria-label="Decline" data-testid="call-reject" id="rejectBtn"></div>
    </div>
  </body></html>`;
  const env = createEnv(html, "https://web.whatsapp.com/");
  const adapter = env.SAA.getAdapterForHost("web.whatsapp.com");
  const detection = env.SAA.detectIncomingCall(env.document, adapter);
  const candidate = detection.candidates[0];

  let acceptClicks = 0;
  let declineClicks = 0;
  const acceptEl = env.document.getElementById("acceptBtn");
  const rejectEl = env.document.getElementById("rejectBtn");
  acceptEl.addEventListener("click", () => {
    acceptClicks += 1;
    // شبیه‌سازی تغییر رابط پس از پذیرش تماس: دکمه‌های تماس ورودی حذف و کنترل‌های تماس فعال ظاهر می‌شوند
    const dialog = env.document.getElementById("callDialog");
    dialog.innerHTML =
      '<div role="button" aria-label="Mute"></div>' +
      '<div role="button" aria-label="End call"></div>';
  });
  rejectEl.addEventListener("click", () => { declineClicks += 1; });

  const result = await env.SAA.tryAnswer(candidate, {});
  check("۵) پاسخ خودکار: نتیجهٔ پاسخ موفق است", result.ok === true, "reason=" + result.reason);
  check("۵) پاسخ خودکار: دقیقاً یک‌بار روی دکمهٔ پاسخ کلیک شد", acceptClicks === 1,
    "acceptClicks=" + acceptClicks);
  check("۵) پاسخ خودکار: هرگز روی دکمهٔ رد کلیک نشد", declineClicks === 0,
    "declineClicks=" + declineClicks);

  // تلاش دوم برای همان تماس نباید تکرار شود (جلوگیری از قطع تماس فعال)
  const second = await env.SAA.tryAnswer(candidate, {});
  check("۵) پاسخ خودکار: کلیک دوباره روی تماس فعال انجام نمی‌شود",
    second.ok === false && (second.reason === "duplicate" || second.reason === "already_active"),
    "reason=" + second.reason);
  return env;
}

// صحنهٔ ۶ — محافظ «رد»: تلاش برای پاسخ روی دکمهٔ رد باید مسدود شود
async function scenarioDeclineGuard() {
  const html = `<!DOCTYPE html><html><body>
    <div role="dialog">
      <button aria-label="Decline" id="rejectOnly">Decline</button>
    </div>
  </body></html>`;
  const env = createEnv(html, "https://web.whatsapp.com/");
  let clicks = 0;
  const el = env.document.getElementById("rejectOnly");
  el.addEventListener("click", () => { clicks += 1; });

  const result = await env.SAA.tryAnswer(
    { element: el, name: "Decline", confidence: 0.99, host: "web.whatsapp.com" },
    {}
  );
  check("۶) محافظ رد: کلیک روی دکمهٔ رد مسدود می‌شود",
    result.ok === false && result.reason === "decline_guard", "reason=" + result.reason);
  check("۶) محافظ رد: هیچ کلیکی انجام نشد", clicks === 0, "clicks=" + clicks);
  return env;
}

// صحنهٔ ۷ — تماس از قبل فعال است (نباید دوباره کلیک شود)
function scenarioAlreadyActive() {
  const html = `<!DOCTYPE html><html><body>
    <div role="dialog" aria-modal="true">
      <button aria-label="Accept">Accept</button>
      <button aria-label="Decline">Decline</button>
      <button aria-label="Mute">Mute</button>
      <button aria-label="End call">End call</button>
    </div>
  </body></html>`;
  const env = createEnv(html, "https://web.whatsapp.com/");
  const adapter = env.SAA.getAdapterForHost("web.whatsapp.com");
  const detection = env.SAA.detectIncomingCall(env.document, adapter);
  const top = detection.candidates[0];
  check("۷) تماس فعال: به‌عنوان «قبلاً پاسخ‌داده‌شده» علامت می‌خورد",
    top && top.alreadyActive === true, top ? "alreadyActive=" + top.alreadyActive : "-");
  return env;
}

// صحنهٔ ۸ — آداپتور عمومی روی یک سایت ناشناس با ساختار استاندارد
function scenarioGenericSite() {
  const html = `<!DOCTYPE html><html><body>
    <div role="dialog">
      <button aria-label="Answer call">Answer call</button>
      <button aria-label="Decline call">Decline call</button>
    </div>
  </body></html>`;
  const env = createEnv(html, "https://example.com/");
  const adapter = env.SAA.getAdapterForHost("example.com");
  const detection = env.SAA.detectIncomingCall(env.document, adapter);
  check("۸) سایت عمومی: آداپتور «generic» استفاده می‌شود",
    adapter && adapter.name === "generic", adapter ? adapter.name : "هیچ");
  check("۸) سایت عمومی: تماس ورودی تشخیص داده می‌شود", detection.found === true,
    "found=" + detection.found);
  return env;
}

/* --------------------------------------------------------------------- اجرا */

async function main() {
  console.log("آزمون موتور تشخیص افزونهٔ Smart Auto Answer");
  console.log("پوشهٔ افزونه: " + EXT_DIR);
  console.log("─".repeat(64));

  const envs = [];
  envs.push(scenarioWhatsAppEnglish());
  envs.push(scenarioPersianLabels());
  envs.push(scenarioNegativeLabel());
  envs.push(scenarioOnlyDecline());
  envs.push(await scenarioAutomaticAnswer());
  envs.push(await scenarioDeclineGuard());
  envs.push(scenarioAlreadyActive());
  envs.push(scenarioGenericSite());

  for (const item of results) {
    console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.detail ? "  [" + item.detail + "]" : ""}`);
  }

  const passed = results.filter((item) => item.ok).length;
  const total = results.length;
  console.log("─".repeat(64));
  console.log(`نتیجه: ${passed} از ${total} بررسی موفق`);
  if (passed !== total) {
    console.log("بررسی‌های ناموفق:");
    for (const item of results.filter((entry) => !entry.ok)) console.log("  - " + item.name);
  }

  for (const env of envs) {
    try { env.dom.window.close(); } catch (err) { /* بی‌صدا */ }
  }
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error("خطای اجرای آزمون:", err);
  process.exit(2);
});
