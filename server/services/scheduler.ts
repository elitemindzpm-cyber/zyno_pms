// server/services/scheduler.ts
// Background jobs. The reservation-expiry job runs every RESERVATION_EXPIRY_INTERVAL_MS (default 1 hour).
// Set it to 0 to disable the scheduler (the job can still be run through POST /api/jobs/reservation-expiry).
import { expireReservations } from './property';

export function startScheduler() {
  const everyMs = Number(process.env.RESERVATION_EXPIRY_INTERVAL_MS ?? 3600000);
  if (!(everyMs > 0)) return;
  const tick = () => {
    expireReservations()
      .then((r) => { if (r.expired) console.log(`[scheduler] expired ${r.expired} reservation(s)`); })
      .catch((e) => console.error('[scheduler] reservation expiry failed:', e?.message ?? e));
  };
  setInterval(tick, everyMs).unref();
}
