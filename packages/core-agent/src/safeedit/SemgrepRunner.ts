export interface SafeFinding {
  ruleId: string;
  message: string;
  severity?: "INFO" | "WARNING" | "ERROR";
  path?: string;
  startLine?: number;
  endLine?: number;
}

export async function semgrepValidate(_filePath?: string): Promise<SafeFinding[]> {
  // Stub: no findings
  return [];
}
