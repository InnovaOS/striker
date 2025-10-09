export class BufferMemory {
  private history: string[] = [];

  async load(): Promise<{ history: string }> {
    return { history: this.history.join("\n") };
  }

  async save(turn: unknown): Promise<void> {
    try {
      this.history.push(JSON.stringify(turn));
    } catch {
      this.history.push(String(turn));
    }
  }

  clear(): void {
    this.history = [];
  }
}
