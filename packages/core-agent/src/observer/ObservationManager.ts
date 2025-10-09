import type { ExecutionEvent, Observation } from "../types.js";

export class ObservationManager {
  summarize(events: ExecutionEvent[]): Observation {
    const ok = events.filter((e) => e.ok).length;
    const fail = events.length - ok;
    const details = events
      .map((e) => `${e.id} [${e.tool}]: ${e.ok ? "ok" : e.error || "fail"}`)
      .join("\n");
    return { summary: `Execution complete. ${ok} ok, ${fail} failed.`, details };
  }
}
