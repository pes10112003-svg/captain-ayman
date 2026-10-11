// End-to-end test of the real Android app on an emulator (run by .github/workflows/android-test.yml).
// The test build (APP_DEBUG=true) points at a local copy of the site with the demo data and allows
// WebView debugging, so Playwright can drive the page while adb checks the phone side.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { _android } from "playwright";
import sharp from "sharp";

const PKG = "com.captainayman.app";
const BASE = process.env.APP_BASE ?? "http://10.0.2.2:3000/";
const OUT = process.env.REPORT_DIR ?? "android-report";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = "", soft = false) {
  results.push({ name, ok: Boolean(ok), soft, detail: String(detail).slice(0, 400) });
  console.log(`${ok ? "PASS" : soft ? "WARN" : "FAIL"}  ${name}${detail ? `  — ${String(detail).slice(0, 200)}` : ""}`);
}
const adb = (...args) => execFileSync("adb", ["shell", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Our alarms in the "N pending alarms:" section only (history sections further down mention old ones too).
let lastAlarmDump = "";
const pendingReminders = () => {
  const lines = (lastAlarmDump = adb("dumpsys", "alarm")).split("\n");
  const start = lines.findIndex((l) => /^\s*\d+ pending alarms:\s*$/i.test(l)); // e.g. "  20 pending alarms:"
  if (start === -1) return -1;
  const indent = lines[start].search(/\S/);
  let n = 0;
  for (const l of lines.slice(start + 1)) {
    if (l.trim() && l.search(/\S/) <= indent) break;
    if (/tag=\*walarm\*:com\.captainayman\.app\.MEAL_REMINDER/.test(l)) n++;
  }
  return n;
};
const uiDump = () => {
  adb("uiautomator", "dump", "/sdcard/ui.xml");
  return adb("cat", "/sdcard/ui.xml");
};
async function waitFor(fn, ms, step = 2000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn().catch(() => null);
    if (v) return v;
    await sleep(step);
  }
  return null;
}

async function run() {
  adb("pm", "grant", PKG, "android.permission.POST_NOTIFICATIONS");
  adb("appops", "set", PKG, "SCHEDULE_EXACT_ALARM", "allow");
  // Control: a screenshot of the home screen works on this emulator.
  const screencap = () => {
    try {
      return execFileSync("adb", ["exec-out", "screencap", "-p"], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      return Buffer.alloc(0);
    }
  };
  const brightness = async (png) => {
    const { width, height } = await sharp(png).metadata();
    // Only the middle: status/navigation bar icons belong to the system and stay visible.
    const s = await sharp(png)
      .extract({ left: 0, top: Math.round(height * 0.15), width, height: Math.round(height * 0.7) })
      .stats();
    return s.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3;
  };
  adb("input", "keyevent", "3");
  await sleep(3000);
  const home = screencap();
  if (home.length > 100) fs.writeFileSync(path.join(OUT, "control-home-screen.png"), home);
  check("control: a normal screenshot works on this phone", home.length > 100 && (await brightness(home)) > 5, `${home.length} bytes`);

  adb("am", "start", "-W", "-n", `${PKG}/.MainActivity`);

  const [device] = await _android.devices({ omitDriverInstall: true });
  const webview = await device.webView({ pkg: PKG }, { timeout: 90_000 });
  let page = await webview.page();
  const context = page.context();
  page.setDefaultTimeout(45_000);

  // 1. Screenshots are blocked: capturing the app gives nothing or a black image.
  await sleep(4000);
  const cap = screencap();
  if (cap.length > 100) fs.writeFileSync(path.join(OUT, "system-screenshot-of-app.png"), cap);
  const capBrightness = cap.length > 100 ? await brightness(cap) : 0;
  check(
    "screenshot of the app is blocked (FLAG_SECURE)",
    cap.length <= 100 || capBrightness < 2,
    cap.length <= 100 ? "the phone refused to capture the screen" : `black image, mean brightness ${capBrightness.toFixed(2)}`,
  );
  const ourWindow =
    adb("dumpsys", "window", "windows")
      .split("Window #")
      .find((w) => w.includes(`${PKG}/`)) ?? "";
  check("app window is marked secure", /\bSECURE\b/.test(ourWindow));

  // 2. The site sees the app.
  const ua = await page.evaluate(() => navigator.userAgent);
  check("User-Agent carries the app mark", ua.includes("CaptainAymanApp/1"), ua);
  check("bridge is available to the page", await page.evaluate(() => typeof window.CaptainAymanApp?.setMealReminders === "function"));

  // 3. Access code → sign in as the demo client → the client area opens (not /get-app).
  await page.waitForURL(/\/(access|login)/);
  if (page.url().includes("/access")) {
    await page.fill("#code", "AYMAN-2026");
    await Promise.all([page.waitForURL(/\/login/), page.click("button[type=submit]")]);
  }
  await page.fill("#email", "omar@kinetic.test");
  await page.fill("#password", "ClientDemo!2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
  await page.waitForLoadState("networkidle");
  check("client signs in and lands on the client area", /\/client\/?$/.test(new URL(page.url()).pathname), page.url());
  await page.screenshot({ path: path.join(OUT, "1-home.png") });
  check("name watermark is on the page", (await page.locator(".ca-watermark").count()) === 1);
  check("no service worker inside the app", (await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0)) === 0);

  // 4. Meal reminders: the client's meals are scheduled as alarms on the phone.
  const alarms = await waitFor(async () => {
    const n = pendingReminders();
    return n === 4 ? n : null;
  }, 20_000);
  check("one alarm per meal is scheduled (4 demo meals)", alarms, `pending: ${pendingReminders()}`);

  // 5. A reminder actually shows up as a notification at its time.
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(Date.now() + 100_000),
  );
  await page.evaluate(
    (json) => window.CaptainAymanApp.setMealReminders(json),
    JSON.stringify({ tz: "Africa/Cairo", meals: [{ time: t, title: "وقت وجبة الاختبار", body: "Emulator test reminder" }] }),
  );
  const shown = await waitFor(async () => /Emulator test reminder/.test(adb("dumpsys", "notification", "--noredact")), 200_000, 5000);
  check("meal reminder notification appears on time", shown, `scheduled for ${t} Cairo`);
  if (shown) {
    adb("cmd", "statusbar", "expand-notifications");
    await sleep(1500);
    const ui = uiDump();
    const m = ui.match(/text="Emulator test reminder"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (m) {
      adb("input", "tap", String((+m[1] + +m[3]) >> 1), String((+m[2] + +m[4]) >> 1));
      // Same WebView normally; if Android rebuilt the screen, follow the new page.
      const opened = await waitFor(
        async () => context.pages().find((p) => !p.isClosed() && new URL(p.url()).pathname === "/client/nutrition") ?? null,
        25_000,
        1000,
      );
      if (opened) page = opened;
      check("tapping the reminder opens the nutrition page", opened, page.url());
      check(
        "the screen was kept (not rebuilt) when the reminder opened it",
        opened && !page.isClosed() && context.pages().length === 1,
        `pages: ${context.pages().length}`,
        true,
      );
    } else {
      check("tapping the reminder opens the nutrition page", false, "notification not found in the shade", true);
      adb("cmd", "statusbar", "collapse");
    }
  }

  // 6. Pages render inside the app (screenshots taken through the WebView, not the screen).
  for (const [i, p] of [
    ["2", "client/nutrition"],
    ["3", "client/workout"],
    ["4", "client/progress"],
  ]) {
    await page.goto(BASE + p);
    await page.waitForLoadState("networkidle");
    check(`page /${p} opens in the app`, new URL(page.url()).pathname === `/${p}`, page.url());
    await page.screenshot({ path: path.join(OUT, `${i}-${p.split("/")[1]}.png`) });
  }
  // The real schedule goes back after the test reminder.
  const back = await waitFor(async () => {
    const n = pendingReminders();
    return n === 4 ? n : null;
  }, 15_000);
  check("real meal schedule restored", back, `pending: ${pendingReminders()}`);

  // 7. Back button goes back inside the app.
  adb("input", "keyevent", "4");
  const wentBack = await waitFor(async () => (new URL(page.url()).pathname === "/client/workout" ? true : null), 15_000, 1000);
  check("phone back button goes to the previous page", wentBack, page.url());

  // 8. /get-app knows it's the app.
  await page.goto(BASE + "get-app");
  const h1 = await page.locator("h1").innerText();
  check("/get-app recognises the app", /already|بالفعل/.test(h1), h1);

  // 9. Offline screen and retry.
  adb("svc", "wifi", "disable");
  adb("svc", "data", "disable");
  await sleep(3000);
  await page.goto(BASE + "client").catch(() => undefined);
  const offline = await waitFor(async () => /No internet|مفيش إنترنت/.test(uiDump()), 20_000);
  check("offline screen shows without internet", offline, "", true);
  adb("svc", "wifi", "enable");
  adb("svc", "data", "enable");
  await sleep(6000);
  if (offline) {
    const m = uiDump().match(/text="(?:Try again|حاول تاني)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (m) adb("input", "tap", String((+m[1] + +m[3]) >> 1), String((+m[2] + +m[4]) >> 1));
    const recovered = await waitFor(async () => (/No internet|مفيش إنترنت/.test(uiDump()) ? null : true), 30_000);
    check("“Try again” reloads once the internet is back", recovered, "", true);
  }

  // 10. In the phone's Chrome the site offers the app instead (best effort: Chrome may show its welcome screen first).
  const hasChrome = adb("pm", "list", "packages", "com.android.chrome").includes("com.android.chrome");
  if (hasChrome) adb("am", "start", "-a", "android.intent.action.VIEW", "-d", BASE + "get-app", "com.android.chrome");
  const chrome = hasChrome && (await waitFor(async () => /افتح من تطبيق كابتن أيمن|Open it in the Captain Ayman app/.test(uiDump()), 25_000, 2500));
  const chromeShot = screencap();
  if (chromeShot.length > 100) fs.writeFileSync(path.join(OUT, "5-chrome-get-app.png"), chromeShot);
  if (hasChrome) check("Chrome on Android gets the “install the app” page", chrome, "", true);
  adb("am", "start", "-W", "-n", `${PKG}/.MainActivity`);
  await sleep(2000);

  // 11. Signing out clears the reminders.
  await page.goto(BASE + "client/profile");
  await Promise.all([
    page.waitForURL(/\/login/),
    page
      .locator("form button[type=submit]")
      .filter({ hasText: /تسجيل الخروج|Sign out/ })
      .click(),
  ]);
  const cleared = await waitFor(async () => (pendingReminders() === 0 ? true : null), 15_000);
  check("signing out clears the reminders", cleared, `pending: ${pendingReminders()}`);
}

try {
  await run();
} catch (e) {
  check("test run finished without crashing", false, e?.stack ?? e);
}
try {
  const log = execFileSync("adb", ["logcat", "-d", "-t", "3000"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const keep = log
    .split("\n")
    .filter((l) => /captainayman|AndroidRuntime|ActivityTaskManager|ActivityManager|cr_|chromium|WebView|lowmemorykiller|Process .* died/i.test(l));
  fs.writeFileSync(path.join(OUT, "logcat.txt"), keep.slice(-1500).join("\n"));
} catch {
  /* no logcat */
}
const crash = /FATAL EXCEPTION[\s\S]{0,2000}/.exec(execFileSync("adb", ["logcat", "-d", "-b", "crash"], { encoding: "utf8" }))?.[0];
check("app did not crash", !crash, crash ?? "");

if (lastAlarmDump) fs.writeFileSync(path.join(OUT, "alarms.txt"), lastAlarmDump);
const failed = results.filter((r) => !r.ok && !r.soft);
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ passed: results.filter((r) => r.ok).length, failed: failed.length, results }, null, 2));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
