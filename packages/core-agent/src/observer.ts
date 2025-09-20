/**
 * Striker Observer V1 - Converts ExecutionResult into human-readable summaries
 * Pure TypeScript implementation for UI display
 */

export type StepIntent = "create_file" | "edit_file" | "run_cmd" | "summarize";

export interface Patch {
  path: string;
  action: "create" | "edit";
  before?: string;
  after: string;
  diff?: string; // tiny unified diff as produced by executor
}

export type ExecStatus = "ok" | "skipped" | "error";

export interface ExecStepResult {
  stepId: string;
  intent: StepIntent;
  path?: string;
  status: ExecStatus;
  note?: string;
  patch?: Patch;
}

export interface ExecutionResult {
  steps: ExecStepResult[];
  notes: string[];
}

export interface ObservationSummary {
  created: string[];
  edited: string[];
  skipped: { stepId: string; intent: StepIntent; note?: string }[];
  errors: { stepId: string; intent: StepIntent; note?: string }[];
  stats: {
    filesCreated: number;
    filesEdited: number;
    linesAdded: number;
    linesRemoved: number;
  };
}

export interface ObservationResult {
  summary: ObservationSummary;
  notes: string[]; // short human notes for the panel
}

export interface ObservationInput {
  execution: ExecutionResult;
}

/**
 * Main entry point: converts execution result to human-readable summary
 */
export function observeExecution(input: ObservationInput): ObservationResult {
  const { execution } = input;
  
  if (!execution || !execution.steps) {
    return {
      summary: {
        created: [],
        edited: [],
        skipped: [],
        errors: [],
        stats: {
          filesCreated: 0,
          filesEdited: 0,
          linesAdded: 0,
          linesRemoved: 0
        }
      },
      notes: ["No execution data available"]
    };
  }

  const created: string[] = [];
  const edited: string[] = [];
  const skipped: { stepId: string; intent: StepIntent; note?: string }[] = [];
  const errors: { stepId: string; intent: StepIntent; note?: string }[] = [];
  
  let totalLinesAdded = 0;
  let totalLinesRemoved = 0;

  // Process each step
  for (const step of execution.steps) {
    switch (step.status) {
      case "ok":
        if (step.patch) {
          const { added, removed } = countDiffLines(step.patch.diff);
          totalLinesAdded += added;
          totalLinesRemoved += removed;
          
          if (step.patch.action === "create") {
            if (step.patch.path) {
              created.push(step.patch.path);
            }
          } else if (step.patch.action === "edit") {
            if (step.patch.path) {
              edited.push(step.patch.path);
            }
          }
        }
        break;
        
      case "skipped":
        skipped.push({
          stepId: step.stepId,
          intent: step.intent,
          note: step.note
        });
        break;
        
      case "error":
        errors.push({
          stepId: step.stepId,
          intent: step.intent,
          note: step.note
        });
        break;
    }
  }

  // Sort arrays for determinism
  created.sort();
  edited.sort();

  const summary: ObservationSummary = {
    created,
    edited,
    skipped,
    errors,
    stats: {
      filesCreated: created.length,
      filesEdited: edited.length,
      linesAdded: totalLinesAdded,
      linesRemoved: totalLinesRemoved
    }
  };

  // Generate human-readable notes
  const notes = generateNotes(summary);

  return {
    summary,
    notes
  };
}

/**
 * Count added and removed lines from a diff string
 */
function countDiffLines(diff?: string): { added: number; removed: number } {
  if (!diff) {
    return { added: 0, removed: 0 };
  }

  const lines = diff.split('\n');
  let added = 0;
  let removed = 0;

  for (const line of lines) {
    if (isAddLine(line)) {
      added++;
    } else if (isRemLine(line)) {
      removed++;
    }
  }

  return { added, removed };
}

/**
 * Check if a line is an addition (starts with single +, not +++ or @@)
 */
function isAddLine(line: string): boolean {
  return line.startsWith('+') && 
         !line.startsWith('+++') && 
         !line.startsWith('@@');
}

/**
 * Check if a line is a removal (starts with single -, not --- or @@)
 */
function isRemLine(line: string): boolean {
  return line.startsWith('-') && 
         !line.startsWith('---') && 
         !line.startsWith('@@');
}

/**
 * Generate human-readable notes from summary
 */
function generateNotes(summary: ObservationSummary): string[] {
  const notes: string[] = [];
  
  // File operations summary
  const fileOps: string[] = [];
  
  if (summary.stats.filesCreated > 0) {
    fileOps.push(`Created ${summary.stats.filesCreated} file${summary.stats.filesCreated === 1 ? '' : 's'}`);
  }
  
  if (summary.stats.filesEdited > 0) {
    fileOps.push(`edited ${summary.stats.filesEdited} file${summary.stats.filesEdited === 1 ? '' : 's'}`);
  }
  
  let mainNote = '';
  if (fileOps.length > 0) {
    mainNote = fileOps.join(', ');
    
    // Add line delta info
    if (summary.stats.linesAdded > 0 || summary.stats.linesRemoved > 0) {
      mainNote += ` (+${summary.stats.linesAdded}/−${summary.stats.linesRemoved} lines)`;
    }
    
    mainNote += '.';
  } else {
    mainNote = 'No files modified.';
  }
  
  // Add skipped/error counts if any
  const statusCounts: string[] = [];
  if (summary.skipped.length > 0) {
    statusCounts.push(`${summary.skipped.length} skipped`);
  }
  if (summary.errors.length > 0) {
    statusCounts.push(`${summary.errors.length} error${summary.errors.length === 1 ? '' : 's'}`);
  }
  
  if (statusCounts.length > 0) {
    mainNote = mainNote.replace('.', `. ${statusCounts.join(', ')}.`);
  }
  
  notes.push(mainNote);
  
  // Add specific file details if any
  if (summary.created.length > 0) {
    notes.push(`Created: ${summary.created.join(', ')}`);
  }
  
  if (summary.edited.length > 0) {
    notes.push(`Edited: ${summary.edited.join(', ')}`);
  }
  
  // Add error details if any
  if (summary.errors.length > 0) {
    for (const error of summary.errors) {
      notes.push(`Error in ${error.stepId} (${error.intent}): ${error.note || 'Unknown error'}`);
    }
  }
  
  return notes;
}
