// src/types.ts
export type StepStatus = 'ok' | 'warning' | 'error' | 'running' | 'skipped';

export interface Step {
  id?: string;
  title: string;
  status: StepStatus;
  error?: string;        // present when status === 'error'
  notes?: string[];      // human-readable notes
  startedAt?: string;    // ISO timestamps (optional)
  endedAt?: string;
}

export interface Plan { steps: Step[]; summary?: string; }

export interface ExecutionError {
  message: string;
  code?: string;
  stepId?: string;
}

export interface ObservationError {
  message: string;
  trace?: string; // stack or detailed trace
}

export interface Execution {
  steps: Step[];
  notes?: string[];        // general execution notes/warnings
  errors?: ExecutionError[];
}

export interface Observation {
  notes?: string[];
  errors?: ObservationError[];
  metrics?: Record<string, number>;
}

export interface AgentPayload {
  plan?: Plan;
  execution?: Execution;
  observation?: Observation;
  meta?: Record<string, any>;
}

// packages/vscode-extension/src/types.ts

/** Top-level payload for results. */
export interface ResultsPayload {
  version: number; // schema version
  plan?: {
    steps: PlanStep[];
    inputs?: Record<string, any>;
  };
  execution?: ExecRow[];
  observation?: {
    notes?: string[];
    metrics?: { duration_ms?: number; [k: string]: any };
  };
}

/** A single planned step. */
export interface PlanStep {
  id?: string | number;
  title?: string;
  step?: string;   // legacy field
  intent?: string;
  inputs?: Record<string, any>;
  rollbackHint?: string;
}

/** A single execution row. */
export interface ExecRow {
  id?: string | number;
  stepId?: string | number;
  title?: string;
  step?: string;   // legacy field
  intent?: string;
  path?: string;
  ok?: boolean;
  status?: string;
  detail?: string;
}

/** Message flowing from extension → webview. */
export type ResultsMessage =
  | { type: 'final-payload'; payload: ResultsPayload }
  | { type: 'append-exec'; row: ExecRow };

/** Message flowing from webview → extension. */
export type ToolbarMessage =
  | { type: 'export-json' }
  | { type: 'open-logs' }
  | { type: 'open-file'; target: string };

