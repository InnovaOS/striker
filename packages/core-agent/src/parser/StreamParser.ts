import type { AgentBlock } from "../types";

export function parseBlocks(output: string): AgentBlock[] {
  if (!output || typeof output !== "string") {
    return [{ type: "text", text: "" }];
  }
  return [{ type: "text", text: output }];
}
