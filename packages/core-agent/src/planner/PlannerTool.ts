import { gatherContext } from "../context/gatherContext";
import type { StrikerTool, PlanStep, ToolCallResult, ToolContext } from "../types";

function makePlannerPrompt(goal: string, context: any): string {
  const ctx = JSON.stringify(context?.slices ?? [], null, 2);
  return (
    `You are Striker Planner. Given a goal, plan atomic steps (intent + inputs).\n` +
    `Goal: ${goal}\n` +
    `Context: ${ctx}\n` +
    `Respond ONLY with JSON array of steps.`
  );
}

function safeParsePlan(text: string): PlanStep[] {
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) return arr as PlanStep[];
  } catch {}
  const id = `plan-${Date.now()}`;
  return [{ id, title: "Fallback plan", intent: "noop", inputs: { note: text } }];
}

export const PlannerTool: StrikerTool<
  { goal: string; contextOptions?: any },
  PlanStep[]
> = {
  name: "plan.respond",
  description: "Generate plan steps for a given goal.",
  call: async (
    input: { goal: string; contextOptions?: any },
    ctx: ToolContext
  ): Promise<ToolCallResult<PlanStep[]>> => {
    const context = await gatherContext(input.contextOptions);
    const prompt = makePlannerPrompt(input.goal, context);

    let planText = "[]";
    if (ctx.model) {
      try {
        const res = await ctx.model.complete(prompt, false);
        planText = res.text ?? "[]";
      } catch (e: any) {
        return { ok: false, error: `planner.model_error: ${e?.message || e}` };
      }
    }

    const steps = safeParsePlan(planText);
    ctx.reporter?.emit({ type: "planGenerated", plan: steps });
    return { ok: true, output: steps };
  },
};
