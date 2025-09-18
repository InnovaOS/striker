/**
 * Striker Planner V1 - Deterministic task planning from natural language prompts
 * Pure TypeScript implementation with no external dependencies
 */

export type StepIntent = "create_file" | "edit_file" | "run_cmd" | "summarize";

export interface Step {
  id: string;                 // short slug, unique within plan
  title: string;              // human-friendly step title
  intent: StepIntent;
  inputs?: Record<string, unknown>;
  acceptance?: string[];      // concise checks to verify the step outcome
  rollbackHint?: string;      // optional safety/undo hint
}

export interface Plan {
  id: string;
  goal: string;
  steps: Step[];
  notes?: string[];
}

export interface PlanInput {
  prompt: string;             // user task in natural language
  workspace?: {
    files?: string[];         // relative paths (optional for simple heuristics)
    languages?: string[];     // e.g., ["ts","py"] (optional)
  };
}

export interface PlanResult {
  plan: Plan;
  warnings?: string[];        // any ambiguity or limitations detected
}

/**
 * Main entry point: converts natural language prompt to structured plan
 */
export function planTask(input: PlanInput): PlanResult {
  const normalizedPrompt = normalizePrompt(input.prompt);
  const planId = generatePlanId(normalizedPrompt);
  
  const steps: Step[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  
  // Template matching in priority order
  const readmeSteps = matchReadmeTemplate(normalizedPrompt, input.workspace);
  const testSteps = matchTestTemplate(normalizedPrompt, input.workspace);
  const refactorSteps = matchRefactorTemplate(normalizedPrompt);
  const docsSteps = matchDocsTemplate(normalizedPrompt);
  
  // Collect all matched steps
  steps.push(...readmeSteps, ...testSteps, ...refactorSteps, ...docsSteps);
  
  // Deduplicate and order steps
  const deduplicatedSteps = deduplicateAndOrderSteps(steps);
  
  // If no templates matched, use fallback
  if (deduplicatedSteps.length === 0) {
    const fallbackStep = createFallbackStep();
    deduplicatedSteps.push(fallbackStep);
    warnings.push("No specific task pattern detected. Generated generic guidance.");
  }
  
  const plan: Plan = {
    id: planId,
    goal: input.prompt,
    steps: deduplicatedSteps,
    notes: notes.length > 0 ? notes : undefined
  };
  
  return {
    plan,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Improved prompt normalization
 */
function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[-'"]/g, ' ')           // replace dashes/quotes with spaces
    .replace(/[^\w\s.]/g, '')        // strip other punctuation except dot
    .replace(/\s+/g, ' ')            // collapse whitespace
    .trim();
}

/**
 * Generate stable plan ID from prompt
 */
function generatePlanId(normalizedPrompt: string): string {
  const words = normalizedPrompt.split(' ').slice(0, 3);
  return `plan-${words.join('-')}`;
}

/**
 * Generate deterministic step ID based on intent and path
 */
function generateStepId(intent: StepIntent, path?: string, counter?: number): string {
  if (path) {
    // Use intent-path with safe chars
    const safePath = path.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `${intent}-${safePath}`;
  }
  // Fall back to counter
  return `${intent}-${counter || 1}`;
}

/**
 * README template matching
 */
function matchReadmeTemplate(normalizedPrompt: string, workspace?: PlanInput['workspace']): Step[] {
  const readmeKeywords = ['readme', 'readme md'];
  const hasReadmeKeyword = readmeKeywords.some(keyword => normalizedPrompt.includes(keyword));
  
  if (!hasReadmeKeyword) return [];
  
  const hasReadmeFile = workspace?.files?.some(file => 
    file.toLowerCase().includes('readme.md') || file.toLowerCase() === 'readme'
  );
  
  const steps: Step[] = [];
  
  if (!hasReadmeFile) {
    steps.push({
      id: generateStepId('create_file', 'README.md'),
      title: 'Create README.md file',
      intent: 'create_file',
      inputs: {
        path: 'README.md',
        contentTemplate: 'basic'
      },
      acceptance: [
        'README.md exists at repo root',
        'contains \'Usage\' or \'Installation\' section'
      ],
      rollbackHint: 'Delete README.md if content is incorrect'
    });
  }
  
  // Always add edit step for README tasks (will be deduplicated if create exists)
  steps.push({
    id: generateStepId('edit_file', 'README.md'),
    title: 'Update README.md content',
    intent: 'edit_file',
    inputs: {
      path: 'README.md',
      section: 'Usage|Installation|Overview',
      mode: 'append_or_create'
    },
    acceptance: [
      'README.md exists at repo root',
      'contains \'Usage\' or \'Installation\' section'
    ],
    rollbackHint: 'Revert README.md changes if content is incorrect'
  });
  
  return steps;
}

/**
 * Test template matching
 */
function matchTestTemplate(normalizedPrompt: string, workspace?: PlanInput['workspace']): Step[] {
  const testKeywords = ['test', 'tests', 'unit test', 'jest', 'vitest'];
  const hasTestKeyword = testKeywords.some(keyword => normalizedPrompt.includes(keyword));
  
  if (!hasTestKeyword) return [];
  
  const hasTypeScript = workspace?.languages?.includes('ts') || 
    workspace?.files?.some(file => file.endsWith('.ts'));
  
  const testPath = hasTypeScript ? 'tests/sample.spec.ts' : 'tests/sample.test.js';
  
  const steps: Step[] = [{
    id: generateStepId('create_file', testPath),
    title: 'Create test scaffold',
    intent: 'create_file',
    inputs: {
      path: testPath,
      contentTemplate: 'test_scaffold'
    },
    acceptance: [
      'test file created in tests/',
      'test contains 1 passing example'
    ],
    rollbackHint: `Delete ${testPath} if test structure is incorrect`
  }];
  
  steps.push({
    id: generateStepId('summarize', undefined, 1),
    title: 'Explain test setup',
    intent: 'summarize',
    inputs: {
      topic: 'test_runner_instructions'
    },
    acceptance: ['summary explains how to run tests'],
    rollbackHint: 'Review test setup instructions'
  });
  
  return steps;
}

/**
 * Refactor template matching
 */
function matchRefactorTemplate(normalizedPrompt: string): Step[] {
  const refactorKeywords = ['refactor', 'rename', 'cleanup'];
  const hasRefactorKeyword = refactorKeywords.some(keyword => normalizedPrompt.includes(keyword));
  
  if (!hasRefactorKeyword) return [];
  
  return [{
    id: generateStepId('summarize', undefined, 1),
    title: 'Create refactoring plan',
    intent: 'summarize',
    inputs: {
      topic: 'refactor_scope',
      style: 'todo_list'
    },
    acceptance: [
      'summary lists concrete refactor targets',
      'includes estimated effort for each target'
    ],
    rollbackHint: 'Review plan before making any code changes'
  }];
}

/**
 * Documentation template matching
 */
function matchDocsTemplate(normalizedPrompt: string): Step[] {
  const docsKeywords = ['contributing', 'changelog', 'docs'];
  const matchedKeyword = docsKeywords.find(keyword => normalizedPrompt.includes(keyword));
  
  if (!matchedKeyword) return [];
  
  let fileName: string;
  let title: string;
  let acceptanceCriteria: string[];
  
  switch (matchedKeyword) {
    case 'contributing':
      fileName = 'CONTRIBUTING.md';
      title = 'Create contribution guide';
      acceptanceCriteria = [
        'CONTRIBUTING.md exists at repo root',
        'contains sections for setup, guidelines, and PR process'
      ];
      break;
    case 'changelog':
      fileName = 'CHANGELOG.md';
      title = 'Create changelog';
      acceptanceCriteria = [
        'CHANGELOG.md exists at repo root',
        'follows Keep a Changelog format with version sections'
      ];
      break;
    default:
      fileName = 'DOCS.md';
      title = 'Create documentation';
      acceptanceCriteria = [
        'DOCS.md exists at repo root',
        'contains structured headings and content sections'
      ];
  }
  
  return [{
    id: generateStepId('create_file', fileName),
    title,
    intent: 'create_file',
    inputs: {
      path: fileName,
      contentTemplate: 'documentation'
    },
    acceptance: acceptanceCriteria,
    rollbackHint: `Delete ${fileName} if content structure is incorrect`
  }];
}

/**
 * Fallback step for unmatched prompts
 */
function createFallbackStep(): Step {
  return {
    id: generateStepId('summarize', undefined, 1),
    title: 'Analyze task requirements',
    intent: 'summarize',
    inputs: {
      topic: 'planner_capabilities',
      message: 'This planner can handle: README tasks, test setup, refactoring plans, and documentation. For other tasks, manual planning may be required.'
    },
    acceptance: [
      'summary explains available planner capabilities',
      'provides guidance for unsupported task types'
    ],
    rollbackHint: 'Consider manual task planning for complex requirements'
  };
}

/**
 * Enhanced deduplication and ordering logic
 */
function deduplicateAndOrderSteps(steps: Step[]): Step[] {
  const seen = new Set<string>();
  const deduplicated: Step[] = [];
  
  // Create deduplication key based on intent + path + section + title
  for (const step of steps) {
    const path = step.inputs?.path as string || '';
    const section = step.inputs?.section as string || '';
    const key = `${step.intent}:${path}:${section}:${step.title}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(step);
    }
  }
  
  // Sort to ensure create_file comes before edit_file for same path
  return deduplicated.sort((a, b) => {
    const aPath = a.inputs?.path as string || '';
    const bPath = b.inputs?.path as string || '';
    
    // If same path, prioritize create_file over edit_file
    if (aPath === bPath && aPath !== '') {
      if (a.intent === 'create_file' && b.intent === 'edit_file') return -1;
      if (a.intent === 'edit_file' && b.intent === 'create_file') return 1;
    }
    
    // Otherwise maintain original order
    return 0;
  });
}
