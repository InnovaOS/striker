export interface ContextSlice {
  name: string;
  data: any;
}

export interface ContextOptions {
  includeOpenFiles?: boolean;
  includeSelection?: boolean;
  includeSearch?: string | string[];
}

export interface ContextProvider {
  readonly name: string;
  get: () => Promise<ContextSlice | null>;
}
