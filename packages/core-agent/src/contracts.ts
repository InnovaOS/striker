// keep legacy surface but use explicit re-exports

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

export { AgentTask } from "./AgentTask";

export { PlannerTool } from "./planner/PlannerTool";

export { ToolCoordinator } from "./executor/ToolCoordinator";
export { Executor } from "./executor/Executor";
export { CmdExecTool, FileReadTool, FileWriteTool, NoopTool } from "./executor/CommandHandlers";

export { ObservationManager } from "./observer/ObservationManager";
export { ConsoleReporter } from "./observer/ResultReporter";

export { BufferMemory } from "./memory/BufferMemory";

export { semgrepValidate } from "./safeedit/SemgrepRunner";
export { recipeValidate } from "./safeedit/RecipeRunner";

export type { ContextProvider, ContextSlice, ContextOptions } from "./context/BaseContextProvider";
export { CurrentFileProvider } from "./context/CurrentFileProvider";
export { SelectionProvider } from "./context/SelectionProvider";
export { OpenFilesProvider } from "./context/OpenFilesProvider";
export { SearchProvider } from "./context/SearchProvider";
export { gatherContext } from "./context/gatherContext";

export { parseBlocks } from "./parser/StreamParser";
