import type { ContextProvider, ContextSlice } from "./BaseContextProvider.js";

export class SearchProvider implements ContextProvider {
  readonly name = "search";
  constructor(
    private query: string | string[] = "",
    private hits: Array<{ path: string; line: number; text: string }> = []
  ) {}
  async get(): Promise<ContextSlice | null> {
    const q = Array.isArray(this.query) ? this.query.join(" | ") : this.query;
    if (!q) return null;
    return { name: this.name, data: { query: q, hits: this.hits } };
  }
}
