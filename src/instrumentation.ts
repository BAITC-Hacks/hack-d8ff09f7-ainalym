export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VITEST && process.env.NODE_ENV !== "test" && process.env.AINALYM_WORKER !== "0") {
    const { startScheduler } = await import("@/server/scheduler");
    startScheduler();
  }
}
