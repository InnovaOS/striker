import type { ResultEvent, ResultReporter } from "@striker/core-agent";

export class PanelReporter implements ResultReporter {
  constructor(private post: (msg: any) => void) {}
  emit(evt: ResultEvent): void {
    this.post({ type: "AGENT_RESULT", payload: evt });
  }
}
