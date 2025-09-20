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
