import { reserveLiveTurn } from "../../../../server/demo_guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let turnId: unknown;
  try { turnId = (await request.json() as { turn_id?: unknown }).turn_id; } catch { turnId = null; }
  if (typeof turnId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(turnId))
    return Response.json({ ok: false, message: "Не удалось начать ответ" }, { status: 400 });
  try {
    const reservation = reserveLiveTurn(turnId);
    return Response.json({ ok: reservation.allowed, remaining: reservation.remaining, ...(reservation.allowed ? {} : { message: "Сегодня ответы закончились" }) },
      { status: reservation.allowed ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, message: "Не удалось начать ответ" }, { status: 503 });
  }
}
