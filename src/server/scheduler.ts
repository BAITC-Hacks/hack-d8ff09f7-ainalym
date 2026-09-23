import { existsSync } from "node:fs";
import { join } from "node:path";
import { tick } from "@/ai/worker";

declare global { var __ainalymWorkerInterval: ReturnType<typeof setInterval> | undefined; }

export function startScheduler(): void {
  if (globalThis.__ainalymWorkerInterval) return;
  globalThis.__ainalymWorkerInterval = setInterval(async () => {
    try {
      await tick();
      if (process.env.AINALYM_FEED_AUTOPLAY !== "1") return;
      const path = join(process.cwd(), "src", "world", "play.ts");
      if (!existsSync(path)) return;
      const modulePath = path;
      const world = await import(/* webpackIgnore: true */ modulePath) as Record<string, unknown>;
      const play = world.playNext || world.playEvents || world.playWorldEvent || world.play;
      if (typeof play === "function") await play({ steps: 1 });
    } catch {
      // The next interval retries. Worker and feed failures remain visible in their persisted records.
    }
  }, 60_000);
  globalThis.__ainalymWorkerInterval.unref?.();
}
