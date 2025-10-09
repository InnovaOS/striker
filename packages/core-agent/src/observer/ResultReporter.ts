import type { ResultEvent, ResultReporter as ReporterIface } from "../types.js";

export class ConsoleReporter implements ReporterIface {
  emit(evt: ResultEvent): void {
    // eslint-disable-next-line no-console
    console.log("[RESULT-EVENT]", JSON.stringify(evt));
  }
}

