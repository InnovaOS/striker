// packages/vscode-extension/src/features/showDemo.ts
import { showResultsPanel } from '../ui/resultsPanel';
import { ResultsPayload } from '../types';

/** Shape your existing demo generator roughly returns. Kept local to avoid extra deps. */
export interface AgentPayload {
  plan?: {
    steps: any[];
    inputs?: Record<string, any>;
  };
  execution?: any[]; // streaming rows usually; omitted in a demo snapshot
  observation?: {
    notes?: string[];
    metrics?: Record<string, any>;
  };
}

/** Safe normalizer → always returns a valid ResultsPayload v1 */
export function toResultsPayload(p: AgentPayload | undefined | null): ResultsPayload {
  return {
    version: 1,
    plan: p?.plan ?? { steps: [] },
    execution: p?.execution ?? [],
    observation: p?.observation ?? {}
  };
}

/** Simple demo payload factory (replace with your real demo if you have one) */
function makeDemoAgentPayload(prompt: string): AgentPayload {
  const clean = prompt.trim();
  return {
    plan: {
      steps: [
        {
          id: 'analyze-prompt',
          title: 'Analyze Prompt',
          intent: 'analyze',
          inputs: { prompt: clean || '(empty)' },
          rollbackHint: 'N/A'
        },
        {
          id: 'simulate-action',
          title: 'Simulate Action',
          intent: 'dry_run',
          inputs: { file: 'demo1.txt' },
          rollbackHint: 'Revert changes'
        },
        {
          id: 'write-demo1',
          title: 'Write File',
          intent: 'create_file',
          inputs: { path: 'demo1.txt' }
        }
      ]
    },
    observation: {
      notes: ['demo run (showDemo)'],
      metrics: { duration_ms: 123 }
    }
  };
}

/**
 * Public API used by callers to show a demo panel.
 * No top-level await; everything is inside this async fn.
 */
export async function showDemo(prompt: string = ''): Promise<void> {
  const agentPayload: AgentPayload = makeDemoAgentPayload(prompt);
  const resultsPayload: ResultsPayload = toResultsPayload(agentPayload);
  // showResultsPanel itself guards against empty payloads
  showResultsPanel('Striker Results', resultsPayload);
}

export default showDemo;
