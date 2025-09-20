/**
 * Striker Executor V1 - Converts plans into patches without side effects
 * Pure TypeScript implementation for preview and apply modes
 */

export type StepIntent = "create_file" | "edit_file" | "run_cmd" | "summarize";

export interface Step {
  id: string;
  title: string;
  intent: StepIntent;
  inputs?: Record<string, unknown>;
  acceptance?: string[];
  rollbackHint?: string;
}

export interface Plan {
  id: string;
  goal: string;
  steps: Step[];
  notes?: string[];
}

export type ExecStatus = "ok" | "skipped" | "error";

export interface Patch {
  path: string;              // repo-relative file path
  action: "create" | "edit";
  before?: string;           // omitted for create
  after: string;             // proposed content
  diff?: string;             // small unified diff for display
}

export interface ExecStepResult {
  stepId: string;
  intent: StepIntent;
  path?: string;
  status: ExecStatus;
  note?: string;
  patch?: Patch;             // present for create/edit in preview/apply
}

export interface ExecutionInput {
  plan: Plan;
  mode: "preview" | "apply";
  // Optional snapshot of current files so we can compute diffs
  // (key = path, value = file contents)
  fs?: Record<string, string>;
}

export interface ExecutionResult {
  steps: ExecStepResult[];
  notes: string[];
}

/**
 * Main entry point: executes a plan and returns patches
 */
export function executePlan(input: ExecutionInput): ExecutionResult {
  const { plan, mode, fs = {} } = input;
  const steps: ExecStepResult[] = [];
  const notes: string[] = [];
  
  if (mode === "apply") {
    notes.push("apply-requested (apply handled by extension)");
  }
  
  for (const step of plan.steps) {
    const result = executeStep(step, { fs, mode });
    steps.push(result);
  }
  
  return { steps, notes };
}

/**
 * Execute a single step based on its intent
 */
function executeStep(step: Step, ctx: { fs: Record<string, string>; mode: string }): ExecStepResult {
  const baseResult: ExecStepResult = {
    stepId: step.id,
    intent: step.intent,
    status: "ok"
  };
  
  switch (step.intent) {
    case "create_file":
      return execCreate(step, ctx);
    case "edit_file":
      return execEdit(step, ctx);
    case "run_cmd":
      return {
        ...baseResult,
        status: "skipped",
        note: "run_cmd disabled in core executor"
      };
    case "summarize":
      return {
        ...baseResult,
        status: "skipped",
        note: "no-op in executor"
      };
    default:
      return {
        ...baseResult,
        status: "error",
        note: `Unknown intent: ${step.intent}`
      };
  }
}

/**
 * Execute create_file step
 */
function execCreate(step: Step, ctx: { fs: Record<string, string>; mode: string }): ExecStepResult {
  const path = normalizePath(step.inputs?.path);
  if (!path) {
    return {
      stepId: step.id,
      intent: step.intent,
      status: "error",
      note: "Invalid or missing path"
    };
  }
  
  const contentTemplate = stringifyTemplate(step.inputs?.contentTemplate, "basic");
  let content: string;
  
  // Generate content based on template
  if (contentTemplate === "basic") {
    content = renderReadmeBasic("Project");
  } else {
    content = contentTemplate;
  }
  
  // Check if file already exists
  const existingContent = ctx.fs[path];
  if (existingContent !== undefined) {
    // Convert to edit operation
    return {
      stepId: step.id,
      intent: step.intent,
      path,
      status: "ok",
      note: "File exists, converted to edit",
      patch: {
        path,
        action: "edit",
        before: existingContent,
        after: content,
        diff: makeDiff(path, existingContent, content)
      }
    };
  }
  
  return {
    stepId: step.id,
    intent: step.intent,
    path,
    status: "ok",
    patch: {
      path,
      action: "create",
      after: content,
      diff: makeDiff(path, undefined, content)
    }
  };
}

/**
 * Execute edit_file step
 */
function execEdit(step: Step, ctx: { fs: Record<string, string>; mode: string }): ExecStepResult {
  const path = normalizePath(step.inputs?.path);
  if (!path) {
    return {
      stepId: step.id,
      intent: step.intent,
      status: "error",
      note: "Invalid or missing path"
    };
  }
  
  const section = stringifyTemplate(step.inputs?.section, "Usage");
  const mode = stringifyTemplate(step.inputs?.mode, "append_or_create");
  const contentTemplate = stringifyTemplate(step.inputs?.contentTemplate, "usage_basic");
  
  let insertContent: string;
  if (contentTemplate === "usage_basic") {
    insertContent = usageSnippet("Project");
  } else {
    insertContent = contentTemplate;
  }
  
  const existingContent = ctx.fs[path];
  
  // If file doesn't exist, promote to create
  if (existingContent === undefined) {
    const basicContent = renderReadmeBasic("Project");
    const newContent = ensureSection(basicContent, section, insertContent);
    
    return {
      stepId: step.id,
      intent: step.intent,
      path,
      status: "ok",
      note: "File missing, promoted to create",
      patch: {
        path,
        action: "create",
        after: newContent,
        diff: makeDiff(path, undefined, newContent)
      }
    };
  }
  
  // Edit existing file
  let newContent: string;
  if (mode === "append_or_create") {
    newContent = ensureSection(existingContent, section, insertContent);
  } else {
    // replace_section mode - simplified implementation
    newContent = ensureSection(existingContent, section, insertContent);
  }
  
  return {
    stepId: step.id,
    intent: step.intent,
    path,
    status: "ok",
    patch: {
      path,
      action: "edit",
      before: existingContent,
      after: newContent,
      diff: makeDiff(path, existingContent, newContent)
    }
  };
}

/**
 * Normalize and validate file path
 */
function normalizePath(p: unknown): string | undefined {
  if (typeof p !== "string") return undefined;
  const normalized = p.trim().replace(/\s+/g, " ");
  return normalized || undefined;
}

/**
 * Convert template input to string with fallback
 */
function stringifyTemplate(x: unknown, fallback: string): string {
  if (typeof x === "string") return x;
  return fallback;
}

/**
 * Generate basic README content
 */
function renderReadmeBasic(goal: string): string {
  return `# ${goal}

## Overview

This project provides functionality for ${goal.toLowerCase()}.

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

See the usage examples below.
`;
}

/**
 * Generate usage snippet
 */
function usageSnippet(goal: string): string {
  return `
### Basic Usage

\`\`\`javascript
// Example usage for ${goal.toLowerCase()}
const result = await run();
console.log(result);
\`\`\`
`;
}

/**
 * Ensure section exists in content and append insert text
 */
function ensureSection(content: string, sectionName: string, insert: string): string {
  const sectionHeader = `## ${sectionName}`;
  
  if (content.includes(sectionHeader)) {
    // Section exists, append to it
    const lines = content.split('\n');
    const sectionIndex = lines.findIndex(line => line.includes(sectionHeader));
    
    if (sectionIndex !== -1) {
      // Find next section or end of file
      let insertIndex = lines.length;
      for (let i = sectionIndex + 1; i < lines.length; i++) {
        if (lines[i].startsWith('## ')) {
          insertIndex = i;
          break;
        }
      }
      
      // Insert content before next section
      lines.splice(insertIndex, 0, '', insert.trim());
      return lines.join('\n');
    }
  }
  
  // Section doesn't exist, add at end
  return content.trim() + '\n\n' + sectionHeader + '\n' + insert.trim() + '\n';
}

/**
 * Generate simple unified diff for display
 */
function makeDiff(path: string, before: string | undefined, after: string): string {
  if (before === undefined) {
    // New file
    const lines = after.split('\n').slice(0, 5); // Show first 5 lines
    return `--- /dev/null
+++ b/${path}
@@ -0,0 +1,${lines.length} @@
${lines.map(line => `+${line}`).join('\n')}`;
  }
  
  if (before === after) {
    return `--- a/${path}
+++ b/${path}
@@ (no changes) @@`;
  }
  
  // Simple diff - show a few lines of context
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  const contextLines = Math.min(3, maxLines);
  
  let diff = `--- a/${path}
+++ b/${path}
@@ -1,${beforeLines.length} +1,${afterLines.length} @@\n`;
  
  // Show first few lines of each
  for (let i = 0; i < contextLines; i++) {
    if (i < beforeLines.length) {
      diff += `-${beforeLines[i]}\n`;
    }
    if (i < afterLines.length) {
      diff += `+${afterLines[i]}\n`;
    }
  }
  
  if (maxLines > contextLines) {
    diff += `... (${maxLines - contextLines} more lines)\n`;
  }
  
  return diff;
}
