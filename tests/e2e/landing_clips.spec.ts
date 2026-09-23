/**
 * Opt-in live-demo recorder (not part of the normal test suite).
 * E2E_BASE_URL and DEMO_ACCESS_CODE stay in the environment; auth stays in memory.
 * Run: node --experimental-strip-types tests/e2e/landing_clips.spec.ts record today
 * Repeat for purchases, order, money, assistant. Set FFMPEG to a full binary if needed.
 * The assistant budget is one request, guarded across invocations by a temporary marker.
 */
import { chromium, expect, type Locator, type Page } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const NAMES = ["today", "purchases", "order", "money", "assistant"] as const;
type Clip = typeof NAMES[number];
const OUT = "public/landing/clips";
const SIZE = { width: 1280, height: 800 };
const pause = (page: Page, ms = 750) => page.waitForTimeout(ms);

async function move(page: Page, x: number, y: number) {
  const from = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-recording-cursor]");
    return { x: Number(el?.dataset.x ?? 1080), y: Number(el?.dataset.y ?? 680) };
  });
  for (let i = 1; i <= 24; i++) {
    await page.mouse.move(from.x + (x - from.x) * i / 24, from.y + (y - from.y) * i / 24);
    await pause(page, 20);
  }
}

async function point(page: Page, target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error("Recording target is not visible");
  await move(page, box.x + box.width / 2, box.y + box.height / 2);
}

async function scroll(page: Page, pixels: number) {
  for (let i = 0; i < 24; i++) {
    await page.mouse.wheel(0, pixels / 24);
    await pause(page, 25);
  }
  await pause(page);
}

async function cursor(page: Page) {
  // Headless recordings omit the OS pointer. This overlay only visualises real mouse events.
  await page.evaluate(() => {
    const el = document.createElement("div");
    el.dataset.recordingCursor = "";
    el.style.cssText = "position:fixed;left:0;top:0;width:22px;height:28px;pointer-events:none;z-index:2147483647;transform:translate(1080px,680px)";
    el.innerHTML = '<svg viewBox="0 0 22 28" fill="none"><path d="M2 2v21l5-5 4 8 4-2-4-8h8L2 2Z" fill="#171717" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.appendChild(el);
    document.addEventListener("mousemove", event => {
      el.dataset.x = String(event.clientX); el.dataset.y = String(event.clientY);
      el.style.transform = `translate(${event.clientX}px,${event.clientY}px)`;
    });
  });
}

async function poster(page: Page, name: Clip) {
  await page.locator("[data-recording-cursor]").evaluate(el => { (el as HTMLElement).style.visibility = "hidden"; });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.locator("[data-recording-cursor]").evaluate(el => { (el as HTMLElement).style.visibility = "visible"; });
}

async function ready(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await pause(page);
}

function ffmpegPath() {
  const candidates = [process.env.FFMPEG, "ffmpeg"];
  // Reuse an existing imageio installation; never install a dependency for recording.
  const python = spawnSync("python3", ["-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" });
  if (python.status === 0) candidates.push(python.stdout.trim());
  return candidates.find(binary => binary && spawnSync(binary, ["-version"], { stdio: "ignore" }).status === 0);
}

export async function recordClip(name: Clip) {
  if (!process.env.E2E_BASE_URL || !process.env.DEMO_ACCESS_CODE) throw new Error("Demo environment is required");
  if (existsSync(`${OUT}/${name}.webm`)) throw new Error("Clip already exists; review it before explicitly replacing it");
  mkdirSync(OUT, { recursive: true });
  const temp = mkdtempSync(join(tmpdir(), `ainalym-clip-${name}-`));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL, viewport: SIZE, deviceScaleFactor: 1,
    ignoreHTTPSErrors: true, recordVideo: { dir: temp, size: SIZE },
  });
  let assistantRequests = 0;
  let start = 0;
  let answerAt: number | undefined;
  let questionSentAt: number | undefined;
  let reviewRoute: string | undefined;
  let page: Page | undefined;
  const auth = await context.request.post("/__demo_access", { form: { code: process.env.DEMO_ACCESS_CODE, next: "/" } });
  if (!auth.ok()) { await browser.close(); throw new Error("Demo authentication failed"); }
  await context.route("**/*", async route => {
    const request = route.request();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return route.continue();
    if (name === "assistant" && new URL(request.url()).pathname === "/api/assistant/ask" && assistantRequests === 0) {
      writeFileSync(join(tmpdir(), "ainalym-landing-assistant-request-used"), "One live request reserved.\n", { flag: "wx" });
      assistantRequests++;
      return route.continue();
    }
    await route.abort("blockedbyclient");
  });
  const videoClock = Date.now();
  try {
    page = await context.newPage();
    page.setDefaultTimeout(15_000);
    if (name === "order") {
      await ready(page, "/orders");
      // Select an existing priced draft. Opening it is read-only; never click approval.
      const draft = page.locator("article").filter({ hasText: /Заказ SE/ }).filter({ has: page.getByRole("button", { name: "Утвердить заказ", exact: true }) }).first();
      const href = await draft.getByRole("link", { name: "Открыть", exact: true }).getAttribute("href");
      if (!href) throw new Error("No existing draft order to record");
      await ready(page, href);
      reviewRoute = new URL(page.url()).pathname.replace(/\/[^/]+$/, "/[order]");
      await expect(page.getByRole("button", { name: /Утвердить заказ/ })).toBeVisible();
      await page.mouse.move(900, 600);
      await scroll(page, 390);
    } else {
      await ready(page, name === "purchases" ? "/replenishment?supplier=SE" : `/${name}`);
    }
    await cursor(page);
    start = (Date.now() - videoClock) / 1000;
    const began = Date.now();

    if (name === "today") {
      await poster(page, name);
      await move(page, 427, 319); await pause(page);
      await move(page, 679, 319); await pause(page);
      await move(page, 967, 589); await pause(page);
      await scroll(page, 540);
      await move(page, 1040, 468); await pause(page);
    } else if (name === "purchases") {
      const row = page.locator("tbody tr").first();
      await point(page, row); await pause(page); await row.click(); await pause(page);
      await scroll(page, 530);
      const add = page.getByRole("button", { name: "Добавить в корзину", exact: true }).first();
      await expect(add).toBeInViewport();
      await point(page, add); await pause(page); await add.click(); await pause(page);
      const totals = page.locator("[data-cart-supplier='SE'] [data-cart-totals]");
      await totals.scrollIntoViewIfNeeded(); await pause(page);
      await expect(totals).toBeVisible();
      await point(page, totals); await poster(page, name);
    } else if (name === "order") {
      await poster(page, name);
      const approval = page.getByRole("button", { name: /Утвердить заказ/ });
      await move(page, 576, 533); await pause(page);
      await scroll(page, 200);
      await point(page, approval); await pause(page, 850);
      await move(page, 816, 451); await pause(page, 850);
    } else if (name === "money") {
      await move(page, 879, 598); await pause(page, 850);
      await scroll(page, 560);
      await poster(page, name);
      await move(page, 590, 551); await pause(page, 850);
      await move(page, 870, 687); await pause(page, 850);
    } else {
      if (existsSync(join(tmpdir(), "ainalym-landing-assistant-request-used"))) throw new Error("The single assistant request budget is already used");
      const input = page.getByRole("textbox", { name: "Вопрос ассистенту" });
      await point(page, input); await pause(page); await input.click();
      await input.pressSequentially("Что срочно заказать?", { delay: 85 });
      await pause(page, 650);
      questionSentAt = (Date.now() - videoClock) / 1000;
      await input.press("Enter");
      await page.locator('[data-who="assistant"] article').first().waitFor({ timeout: 90_000 });
      answerAt = (Date.now() - videoClock) / 1000;
      await pause(page, 750);
      await poster(page, name);
      await move(page, 869, 419);
      await pause(page, 4000);
    }
    await pause(page, Math.max(750, 9300 - (Date.now() - began)));
  } finally {
    await context.close();
    await browser.close();
  }
  if (!page) throw new Error("No page recorded");
  const raw = await page.video()!.path();
  const ffmpeg = ffmpegPath();
  if (!ffmpeg) {
    await page.video()!.saveAs(`${OUT}/${name}.webm`);
    throw new Error("Raw WebM saved; trimming/duration verification needs FFmpeg");
  }
  const run = (args: string[]) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "pipe" });
  const webm = `${OUT}/${name}.webm`;
  // Retain typed input + real answer if the network wait exceeds the clip budget.
  // Only waiting is removed; the response is never replayed or fabricated.
  let edit: string[] = ["-ss", start.toFixed(3), "-i", raw, "-t", "9"];
  let waitingCut = false;
  if (answerAt !== undefined && questionSentAt !== undefined && answerAt - start > 5) {
    const first = Math.min(5, questionSentAt - start + 0.35);
    edit = ["-i", raw, "-filter_complex", `[0:v]trim=start=${start}:duration=${first},setpts=PTS-STARTPTS[a];[0:v]trim=start=${answerAt}:duration=${9 - first},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]`, "-map", "[v]"];
    waitingCut = true;
  }
  run([...edit, "-an", "-c:v", "libvpx", "-crf", "20", "-b:v", "1200k", "-deadline", "good", "-cpu-used", "4", webm]);
  const encoders = spawnSync(ffmpeg, ["-encoders"], { encoding: "utf8" }).stdout;
  const mp4 = encoders.includes("libx264");
  if (mp4) run(["-i", webm, "-an", "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${OUT}/${name}.mp4`]);
  const files = ["webm", ...(mp4 ? ["mp4"] : []), "png"].map(ext => ({ file: `${name}.${ext}`, bytes: statSync(`${OUT}/${name}.${ext}`).size }));
  for (const file of files) if (file.bytes > 2_500_000) throw new Error(`${file.file} exceeds 2.5 MB`);
  const manifestPath = `${OUT}/manifest.json`;
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  manifest[name] = { ...SIZE, durationSeconds: 9, audio: false, files, assistantRequests, waitingCut, ...(reviewRoute ? { reviewRoute } : {}) };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ clip: name, files, assistantRequests, waitingCut }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, name] = process.argv.slice(2);
  if (command !== "record" || !NAMES.includes(name as Clip)) throw new Error("Usage: record today|purchases|order|money|assistant");
  await recordClip(name as Clip);
}
