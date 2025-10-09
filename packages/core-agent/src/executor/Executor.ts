// packages/core-agent/src/executor/Executor.ts
import type { ExecutionEvent, PlanStep, ToolContext } from "../types";
import { ToolCoordinator } from "./ToolCoordinator";

export class Executor {
  constructor(private coordinator: ToolCoordinator, private ctx: ToolContext) {}

  async runSteps(steps: PlanStep[], onEvent: (evt: ExecutionEvent) => void) {
    for (const step of steps) {
      const res = await this.coordinator.run(step.intent, step.inputs, this.ctx);
      const event: ExecutionEvent = {
        id: step.id,
        tool: step.intent,
        ok: !!res.ok,
        output: res.output ? JSON.stringify(res.output) : undefined,
        error: res.error,
      };
      onEvent(event);
    }
  }
}
