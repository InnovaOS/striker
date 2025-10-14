// NodeNext-friendly shared types
export type AgentBlock =
  | { type: "text"; text: string; partial?: boolean }
  | { type: "tool"; name: string; params: Record<string, any>; partial?: boolean };

export interface PlanStep {
  id: string;
  title: string;
  intent: string;
  inputs?: any;
}

export interface ExecutionEvent {
  id: string;
  tool: string;
  ok: boolean;
  output?: string;
  error?: string;
  meta?: Record<string, any>;
}

export interface Observation {
  summary: string;
  details?: string;
}

export interface TaskState {
  isStreaming: boolean;
  abort: boolean;
  consecutiveMistakes: number;
}

export interface LLMProvider {
  complete(prompt: string, stream?: boolean): Promise<{ text: string }>;
}

export interface ToolContext {
  model?: LLMProvider;
  reporter?: ResultReporter;
  cwd?: string;
  env?: Record<string, string>;
}

export interface ToolCallResult<T = any> {
  ok: boolean;
  output?: T;
  error?: string;
}

export interface StrikerTool<I = any, O = any> {
  name: string;
  description?: string;
  call: (input: I, ctx: ToolContext) => Promise<ToolCallResult<O>>;
}

export type ResultEvent =
  | { type: "planGenerated"; plan: PlanStep[] }
  | { type: "executionEvent"; event: ExecutionEvent }
  | { type: "safetyFinding"; findings: any[] }
  | { type: "observationComplete"; observation: Observation };

// Reporter interface lives here so all modules can import it without cycles
export interface ResultReporter {
  emit: (evt: ResultEvent) => void;
}
