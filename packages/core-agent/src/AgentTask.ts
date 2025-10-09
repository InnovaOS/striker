// packages/core-agent/src/AgentTask.ts
import type {
  ExecutionEvent,
  PlanStep,
  ResultReporter,
  TaskState,
  ToolContext,
} from "./types.js";
import { ToolCoordinator } from "./executor/ToolCoordinator.js";
import { Executor } from "./executor/Executor.js";
import { ObservationManager } from "./observer/ObservationManager.js";

function ensureId(step: Partial<PlanStep>, idx: number): PlanStep {
  return {
    id: step.id || `step-${idx + 1}`,
    title: step.title || `Step ${idx + 1}`,
    intent: step.intent || "noop",
    inputs: step.inputs ?? {},
  };
}

export class AgentTask {
  private executor: Executor;
  private observation = new ObservationManager();

  constructor(
    private coordinator: ToolCoordinator,
    private state: TaskState,
    private ctx: ToolContext,
    private reporter: ResultReporter
  ) {
    this.executor = new Executor(this.coordinator, this.ctx);
  }

  async run(goal: string) {
    if (this.state.abort) return;

    const planRes = await this.coordinator.run("plan.respond", { goal }, this.ctx);
    if (!planRes.ok) {
      this.reporter.emit({
        type: "observationComplete",
        observation: { summary: `Planner failed: ${planRes.error}` },
      });
      return;
    }

    const steps = (planRes.output as PlanStep[]).map(ensureId);

    const execEvents: ExecutionEvent[] = [];
    await this.executor.runSteps(steps, (evt) => {
      execEvents.push(evt);
      this.reporter.emit({ type: "executionEvent", event: evt });
    });

    const obs = this.observation.summarize(execEvents);
    this.reporter.emit({ type: "observationComplete", observation: obs });
  }
}
