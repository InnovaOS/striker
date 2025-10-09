import type { ContextProvider, ContextSlice } from "./BaseContextProvider.js";

export class SelectionProvider implements ContextProvider {
  readonly name = "selection";
  constructor(private selectedText?: string) {}
  async get(): Promise<ContextSlice | null> {
    if (!this.selectedText) return null;
    return { name: this.name, data: { text: this.selectedText } };
  }
}
