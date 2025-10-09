export interface SafeRecipe {
  id: string;
  title?: string;
  description?: string;
  // Additional fields as you evolve recipes
}

export interface PatchResult {
  recipeId: string;
  ok: boolean;
  message?: string;
}

export async function recipeValidate(
  _file: string,
  _recipes: SafeRecipe[] = []
): Promise<PatchResult[]> {
  // Stub: no patches applied
  return [];
}
