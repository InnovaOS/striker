import type { ContextProvider, ContextSlice } from "./BaseContextProvider.js";

export class OpenFilesProvider implements ContextProvider {
  readonly name = "openFiles";
  constructor(private files: Array<{ path: string; content?: string }> = []) {}
  async get(): Promise<ContextSlice | null> {
    if (!this.files?.length) return null;
    return { name: this.name, data: this.files };
  }
}
