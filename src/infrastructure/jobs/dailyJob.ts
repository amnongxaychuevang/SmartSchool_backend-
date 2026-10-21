import { schoolDateString } from '../../domain/schoolTime';

const CHECK_EVERY_MS = 60 * 1000;

/**
 * Runs `run` at most once per school day, on the first minute `isDue(now)` says
 * it is time. The jobs themselves are idempotent, so the extra run a restart can
 * cause on the same day does nothing harmful.
 */
export function startDailyJob(name: string, isDue: (now: Date) => Promise<boolean>, run: (now: Date) => Promise<unknown>) {
  let lastRunDate: string | null = null;
  let running = false;

  const tick = async () => {
    if (running) return;
    const now = new Date();
    const today = schoolDateString(now);
    if (lastRunDate === today) return;

    running = true;
    try {
      if (!(await isDue(now))) return;
      const result = await run(now);
      lastRunDate = today;
      console.log(`[${name}]`, JSON.stringify(result));
    } catch (err) {
      console.error(`[${name}] run failed:`, (err as Error).message);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, CHECK_EVERY_MS);
  timer.unref();
  return timer;
}
