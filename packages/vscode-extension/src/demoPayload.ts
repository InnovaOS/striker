// src/demoPayload.ts
import type { AgentPayload } from './types';

export const demoHappy: AgentPayload = {
  plan: {
    steps: [
      { id: 's1', title: 'scan workspace', status: 'ok' },
      { id: 's2', title: 'select target file', status: 'ok' },
      { id: 's3', title: 'summarize', status: 'ok' }
    ],
    summary: 'All steps were no-op'
  },
  execution: {
    steps: [
      { id: 's1', title: 'scan workspace', status: 'ok' },
      { id: 's2', title: 'select target file', status: 'ok' },
      { id: 's3', title: 'summarize', status: 'ok', notes: ['No changes required'] }
    ],
    notes: ['Execution finished successfully.']
  },
  observation: {
    notes: ['Elapsed: 660ms', 'All steps no-op']
  }
};

export const demoWithError: AgentPayload = {
  plan: {
    steps: [
      { id: 's1', title: 'scan workspace', status: 'ok' },
      { id: 's2', title: 'select target file', status: 'ok' },
      { id: 's3', title: 'run tests', status: 'ok' },
      { id: 's4', title: 'deploy', status: 'skipped' }
    ],
    summary: 'CI -> Deploy (deploy skipped if tests fail)'
  },
  execution: {
    steps: [
      { id: 's1', title: 'scan workspace', status: 'ok' },
      { id: 's2', title: 'select target file', status: 'ok' },
      { id: 's3', title: 'run tests', status: 'error', error: 'Unit test failed: tests/file.spec.ts:42', notes: ['1 failing, 27 passing'] },
      { id: 's4', title: 'deploy', status: 'skipped', notes: ['Skipped because tests failed'] }
    ],
    notes: ['Execution completed with errors. See test report.'],
    errors: [
      { message: 'Some tests failed', code: 'TEST_FAIL', stepId: 's3' }
    ]
  },
  observation: {
    notes: ['Observed intermittent network flakiness', 'Consider increasing timeouts by 30%'],
    errors: [{ message: 'Test runner crashed once', trace: 'Error: EADDRINUSE\n    at spawn (...)\n    at ChildProcess.emit (...)' }],
    metrics: { tests_passed: 27, tests_failed: 1, duration_ms: 18342 }
  }
};

export const demoWithWarnings: AgentPayload = {
  plan: {
    steps: [
      { id: 's1', title: 'index repository', status: 'ok' },
      { id: 's2', title: 'infer target module', status: 'ok' },
      { id: 's3', title: 'apply patch', status: 'warning', notes: ['Hunks partially applied; manual review suggested'] }
    ],
    summary: 'Patch applied with warnings'
  },
  execution: {
    steps: [
      { id: 's1', title: 'index repository', status: 'ok' },
      { id: 's2', title: 'infer target module', status: 'ok', notes: ['Multiple candidates found; picked src/ui/resultsPanel.ts'] },
      { id: 's3', title: 'apply patch', status: 'warning', notes: ['Could not patch lines 170–181; file changed upstream'] }
    ],
    notes: [
      '⚠️ Some hunks failed; created backup at patches/failed-2025-09-20.patch',
      'You can open the diff from the Actions menu in the panel.'
    ]
  },
  observation: {
    notes: ['Renderer gracefully handled warning states'],
    metrics: { files_touched: 2, hunks_applied: 3, hunks_failed: 1 }
  }
};
