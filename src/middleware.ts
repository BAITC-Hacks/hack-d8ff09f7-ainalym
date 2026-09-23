import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_DAYS,
  allowApiRequest,
  allowCodeAttempt,
  guardEnabled,
  hasAccess,
  issueAccessCookie,
  providerUnavailable,
  remainingDailyCalls,
  validCode,
} from "./server/demo_guard";

function ipFor(request: NextRequest): string {
  if (process.env.DEMO_PROXY === "cloudflare") return request.headers.get("cf-connecting-ip") || "unknown";
  if (process.env.DEMO_PROXY === "caddy") return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function safeNext(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return "/";
  const url = new URL(value, "http://demo.invalid");
  return url.origin === "http://demo.invalid" ? url.pathname + url.search : "/";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

function codePage(next: string, failed = false): NextResponse {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ainalym · Демо-доступ</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f3ed;color:#202b27;font:16px system-ui,sans-serif}main{width:min(430px,calc(100% - 40px));padding:40px;background:white;border:1px solid #d7dbd5;border-radius:16px;box-shadow:0 14px 45px #202b2714}small{color:#54705e;letter-spacing:.08em;text-transform:uppercase}h1{font-size:29px;line-height:1.12;margin:18px 0 12px}p{line-height:1.5;color:#53635a}label{display:block;margin:26px 0 8px;font-weight:600}input{box-sizing:border-box;width:100%;padding:13px;border:1px solid #8da496;border-radius:8px;font:inherit}button{margin-top:14px;width:100%;padding:14px;border:0;border-radius:8px;background:#214e37;color:#fff;font:inherit;font-weight:600;cursor:pointer}.error{color:#a12d27}</style></head><body><main><small>Ainalym · Демо</small><h1>Решение за вами.<br>Agents run the cycle. You decide.</h1><p>Введите код доступа к демонстрации расчёта заказов поставщикам. Enter the demo access code once to continue.</p><form method="post" action="/__demo_access"><input type="hidden" name="next" value="${escapeHtml(next)}"><label for="code">Код доступа · Access code</label><input id="code" name="code" type="password" autocomplete="one-time-code" required autofocus><button type="submit">Открыть демо · Open demo</button>${failed ? '<p class="error" role="alert">Неверный код · Incorrect code</p>' : ""}</form><p>Данные партнёра обезличены. Локальный режим «Правила без LLM» описан в README.<br>Partner data is anonymised. The local rules path is in README.</p></main></body></html>`;
  return new NextResponse(html, { status: failed ? 401 : 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const active = guardEnabled();

  if (active && path.startsWith("/api/") && !allowApiRequest(ipFor(request))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "1", "Cache-Control": "no-store" } });
  }

  if (path === "/api/health") return NextResponse.next();
  if (!active) return NextResponse.next();

  const code = process.env.DEMO_ACCESS_CODE!;
  if (path === "/__demo_access") {
    if (request.method === "GET") {
      if (hasAccess(request.cookies.get(ACCESS_COOKIE)?.value, code)) return NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url));
      return codePage(safeNext(request.nextUrl.searchParams.get("next")));
    }
    if (request.method !== "POST") return new NextResponse(null, { status: 405 });
    if (!allowCodeAttempt(ipFor(request)) || Number(request.headers.get("content-length") || 0) > 2048) return new NextResponse("Too many attempts", { status: 429 });
    const form = await request.formData();
    const candidate = form.get("code");
    const next = safeNext(typeof form.get("next") === "string" ? String(form.get("next")) : null);
    if (typeof candidate !== "string" || !validCode(candidate, code)) return codePage(next, true);
    const response = NextResponse.redirect(new URL(next, request.url), { status: 303 });
    response.cookies.set(ACCESS_COOKIE, issueAccessCookie(code), { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https", path: "/", maxAge: ACCESS_DAYS * 86_400 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  if (!hasAccess(request.cookies.get(ACCESS_COOKIE)?.value, code)) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Demo access required" }, { status: 401 });
    const destination = new URL("/__demo_access", request.url);
    destination.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(destination);
  }

  if (process.env.AINALYM_MODE === "live" && request.method === "POST" &&
      ["/api/decisions", "/api/drafts", "/api/voice/session", "/api/assistant/message"].includes(path) &&
      remainingDailyCalls() === 0) return providerUnavailable();
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"], runtime: "nodejs" };
