import { useEffect } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { nextFire } from "@/lib/dates";
import { desktopNotify } from "@/lib/platform";
import { nowIso } from "@/lib/id";

const TICK_MS = 15_000;

/**
 * Fires due reminders as desktop notifications, reschedules repeating ones,
 * and auto-archives long-finished tasks. Runs while the app is open.
 */
export function useReminderScheduler(): void {
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;

    const archived = useStore.getState().autoArchiveDoneTasks();
    if (archived > 0) {
      toast(`Archived ${archived} finished task${archived === 1 ? "" : "s"}`);
    }

    const tick = () => {
      const { data, updateReminder } = useStore.getState();
      const now = Date.now();
      for (const r of data.reminders) {
        if (r.archivedAt || r.done) continue;
        const at = new Date(r.remindAt).getTime();
        if (Number.isNaN(at) || at > now) continue;

        if (data.settings.notifications) {
          desktopNotify(r.title, r.message || "Waymark reminder");
        }
        toast(r.title, { description: r.message || "Reminder" });

        const fired = nowIso();
        const next = nextFire(r.remindAt, r.repeat, now);
        if (next) {
          updateReminder(r.id, { remindAt: next, lastFiredAt: fired, firedCount: r.firedCount + 1 });
        } else {
          updateReminder(r.id, { done: true, lastFiredAt: fired, firedCount: r.firedCount + 1 });
        }
      }
    };

    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [hydrated]);
}
