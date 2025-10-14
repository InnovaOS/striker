// Public API (explicit re-exports; CommonJS-friendly)

// types
export type {
  AgentBlock,
  PlanStep,
  ExecutionEvent,
  Observation,
  TaskState,
  LLMProvider,
  ToolContext,
  ToolCallResult,
  StrikerTool,
  ResultEvent,
  ResultReporter,
} from "./types";

// orchestrator
export { AgentTask } from "./AgentTask";

// planner
export { PlannerTool } from "./planner/PlannerTool";

// executor
export { ToolCoordinator } from "./executor/ToolCoordinator";
export { Executor } from "./executor/Executor";
export { CmdExecTool, FileReadTool, FileWriteTool, NoopTool } from "./executor/CommandHandlers";

// observer
export { ObservationManager } from "./observer/ObservationManager";
export { ConsoleReporter } from "./observer/ResultReporter";

// memory
export { BufferMemory } from "./memory/BufferMemory";

// safety
export { semgrepValidate } from "./safeedit/SemgrepRunner";
export { recipeValidate } from "./safeedit/RecipeRunner";

// context
export type { ContextProvider, ContextSlice, ContextOptions } from "./context/BaseContextProvider";
export { CurrentFileProvider } from "./context/CurrentFileProvider";
export { SelectionProvider } from "./context/SelectionProvider";
export { OpenFilesProvider } from "./context/OpenFilesProvider";
export { SearchProvider } from "./context/SearchProvider";
export { gatherContext } from "./context/gatherContext";

// parser
export { parseBlocks } from "./parser/StreamParser";
