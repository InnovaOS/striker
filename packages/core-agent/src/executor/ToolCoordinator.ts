import type { StrikerTool, ToolCallResult, ToolContext } from "../types.js";

export class ToolCoordinator {
  private tools = new Map<string, StrikerTool<any, any>>();

  constructor(initial: StrikerTool[] = []) {
    initial.forEach((t) => this.register(t));
  }

  register(tool: StrikerTool): void {
    this.tools.set(tool.name, tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async run<I = any, O = any>(
    name: string,
    input: I,
    ctx: ToolContext
  ): Promise<ToolCallResult<O>> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `tool_not_found: ${name}` };
    try {
      return await tool.call(input, ctx);
    } catch (e: any) {
      return { ok: false, error: `tool_runtime_error: ${name}: ${e?.message || e}` };
    }
  }
}
