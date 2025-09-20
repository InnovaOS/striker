// packages/core-agent/src/index.ts
import { planTask } from "./planner.js";
import { executePlan } from "./executor.js";
import { observeExecution } from "./observer.js";
import type { PlanResult } from "./planner.js";

export function runTask(args: { prompt: string; mode?: "preview" | "apply"; fs?: Record<string, string> }) {
  const { prompt, mode = "preview", fs } = args;
  const planResult: PlanResult = planTask({ prompt });

  // Execute the plan to get patches
  const executionResult = executePlan({
    plan: planResult.plan,
    mode,
    fs
  });

  // Observe the execution to get human-readable summary
  const observationResult = observeExecution({
    execution: executionResult
  });

  return {
    plan: planResult.plan,
    execution: executionResult,
    observation: observationResult,
  };
}

// re-export types for consumers (optional, handy)
export type { PlanInput, Plan, PlanResult as PlannerResult } from "./planner.js";
export type { ExecutionInput, ExecutionResult, Patch, ExecStepResult } from "./executor.js";
export type { ObservationInput, ObservationResult, ObservationSummary } from "./observer.js";
