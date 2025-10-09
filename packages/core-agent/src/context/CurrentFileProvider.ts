import type { ContextProvider, ContextSlice } from "./BaseContextProvider.js";

export class CurrentFileProvider implements ContextProvider {
  readonly name = "currentFile";
  constructor(private path?: string, private content?: string) {}
  async get(): Promise<ContextSlice | null> {
    if (!this.path) return null;
    return { name: this.name, data: { path: this.path, content: this.content ?? "" } };
  }
}
