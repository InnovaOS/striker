# ADR 0003: Cline Adapter Boundaries (Planner/Executor/Tools)

**Date:** 2025-09-15  
**Status:** Accepted

## Context
Striker will reuse as much as possible from **Cline OSS (MIT)**. To keep Striker modular and future-proof, we’ll import Cline logic behind a thin **adapter** so our VS Code extension depends only on stable interfaces (not Cline internals). This enables fast OSS reuse while preserving room for Striker-specific differentiators.

## Decision
Introduce a `cline-adapter` package exposing three stable surfaces:

1) **Planner API**  
   - Input: user goal + context (repo snapshot, editor selection, system info)  
   - Output: ordered steps / tool calls / messages (Cline-compatible plan schema)

2) **Executor API**  
   - Input: a single step/tool call + environment (workspace, fs, net, process)  
   - Output: step result + telemetry + next hints (incl. cancellation hooks)

3) **Tool Registry**  
   - Declarative registry mapping tool ids → implementations (fs, search, edit, run, http).  
   - Each tool implements a small `Tool<TInput,TOutput>` interface with validation.

These are wrapped by a **Session Orchestrator** that loops: plan → execute → observe → replan (bounded by safety/limits).

## Non-Goals
- Rewriting Cline end-to-end.  
- Baking model/vendor specifics into the extension layer.  
- Shipping Pro features in this adapter (they will live in separate packages).

## Interfaces (TypeScript, stable v0)
```ts
export type ModelMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'tool'; name: string; content: string };

export interface PlanStep {
  id: string;
  tool?: string;            // e.g., 'fs.read', 'fs.write', 'shell.run'
  input?: unknown;          // json-serializable
  rationale?: string;
}

export interface Plan {
  steps: PlanStep[];
  summary?: string;
}

export interface Planner {
  plan(messages: ModelMessage[], ctx: PlanningContext): Promise<Plan>;
}

export interface Executor {
  run(step: PlanStep, env: ExecutionEnv): Promise<ExecutionResult>;
}

export interface Tool<TIn = unknown, TOut = unknown> {
  name: string;
  run(input: TIn, env: ExecutionEnv): Promise<TOut>;
}

export interface ToolRegistry {
  get(name: string): Tool | undefined;
  list(): string[];
}

export interface PlanningContext {
  repoSummary?: string;     // file tree, languages, sizes
  selection?: string;       // active editor selection
  filesOpen?: string[];     // currently open files
  limits?: { maxSteps?: number; maxTokens?: number };
}

export interface ExecutionEnv {
  cwd: string;
  fs: {
    readFile(p: string): Promise<string>;
    writeFile(p: string, data: string): Promise<void>;
    exists(p: string): Promise<boolean>;
  };
  shell: (cmd: string, args?: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;
  net?: { fetch(url: string, init?: any): Promise<{ status: number; text: () => Promise<string> }> };
  onCancel?: (cb: () => void) => void;
}

export interface ExecutionResult {
  ok: boolean;
  output?: unknown;
  logs?: string[];
  error?: string;
}
